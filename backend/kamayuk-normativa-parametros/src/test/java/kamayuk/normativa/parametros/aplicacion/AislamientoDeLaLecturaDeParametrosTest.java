package kamayuk.normativa.parametros.aplicacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Objects;
import kamayuk.normativa.auditoria.AuditoriaJdbc;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.ParametroTributario;
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.web.CodigoDeError;
import kamayuk.normativa.web.ProblemaDeNegocio;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

/**
 * #56 — Las dos lecturas nuevas, contra PostgreSQL real y con <b>dos</b> municipalidades.
 *
 * <h2>Que se mide aqui, y por que no se puede medir sin base de datos</h2>
 *
 * <p>Lo que separa a una municipalidad de otra <b>no esta en este codigo</b>: lo hacen las
 * politicas RLS del esquema —{@code conjunto_parametros_tenant} y {@code parametro_lectura}—, con
 * el valor que {@code TenantTransactionManager} fija con {@code SET LOCAL} al abrir la transaccion
 * (regla 2, regla 3, ADR-0002). Una prueba con repositorio de mentira mediria la imitacion.
 *
 * <p>Las dos mitades del aislamiento son distintas y hay que medirlas por separado:
 *
 * <ul>
 *   <li><b>Un conjunto de la otra municipalidad no existe</b>, y por eso sale el <b>mismo 404</b>
 *       que un identificador inventado. No es una cortesia: contestar cosas distintas convertiria
 *       la ruta en un detector de conjuntos ajenos —«403» dice que existe, «404» dice que no— y eso
 *       es filtrar el padron de otra municipalidad de a un bit por peticion.
 *   <li><b>El listado trae los nacionales y los propios, nunca los ajenos.</b> La politica es
 *       {@code municipalidad_id IS NULL OR municipalidad_id = <la del contexto>}: los nacionales
 *       son la excepcion declarada de ADR-0007 —la UIT es de todos— y por eso la prueba exige que
 *       esten, no solo que falten los de la otra.
 * </ul>
 *
 * <p>El proxy transaccional obedece a la anotacion ({@code AnnotationTransactionAttributeSource}) y
 * no envuelve incondicionalmente: envolver siempre dejaria la prueba en verde con el
 * {@code @Transactional} quitado, que es el modo de fallo que estas pruebas existen para impedir.
 */
@DisplayName("#56 — La lectura de un conjunto y de los publicados, entre dos municipalidades")
class AislamientoDeLaLecturaDeParametrosTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-16T10:00:00Z"), ZoneId.of("America/Lima"));

    /**
     * Un valor inventado, y dicho aqui para que no se confunda con uno real. No representa ninguna
     * UIT, ningun tramo y ninguna alicuota: sirve para que la fila exista (regla 5).
     */
    private static final String VALOR_FICTICIO = "1.000000";

    private static final String FUENTE = "Valor ficticio de prueba; no representa ninguna norma";

    private static BaseDeDatosDePrueba base;

    private static long municipalidadA;
    private static long municipalidadB;

    private static long conjuntoDeA;
    private static long conjuntoDeB;

    private static long parametroNacional;
    private static long parametroDeA;
    private static long parametroDeB;

    private static AdministrarParametros administrar;

    @BeforeAll
    static void provisionar() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        municipalidadA = crearMunicipalidad("300101", "Municipalidad A");
        municipalidadB = crearMunicipalidad("300102", "Municipalidad B");

        DriverManagerDataSource pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));

        JdbcClient jdbc = JdbcClient.create(pool);
        TenantTransactionManager gestor = new TenantTransactionManager(pool);
        ProxyFactory fabrica =
                new ProxyFactory(
                        new AdministrarParametros(
                                new ParametrosRepositoryJdbc(jdbc),
                                new AuditoriaJdbc(jdbc, RELOJ),
                                RELOJ));
        fabrica.setProxyTargetClass(true);
        fabrica.addAdvice(
                new TransactionInterceptor(gestor, new AnnotationTransactionAttributeSource()));
        administrar = (AdministrarParametros) fabrica.getProxy();

        parametroNacional = publicar(null, "FICTICIO", "NACIONAL");
        parametroDeA = publicar(municipalidadA, "FICTICIO", "SOLO_DE_A");
        parametroDeB = publicar(municipalidadB, "FICTICIO", "SOLO_DE_B");

        conjuntoDeA =
                componer(municipalidadA, new Ejercicio(2031), parametroNacional, parametroDeA);
        conjuntoDeB =
                componer(municipalidadB, new Ejercicio(2031), parametroNacional, parametroDeB);
    }

    @AfterAll
    static void cerrar() {
        if (base != null) {
            base.close();
        }
    }

    @AfterEach
    void limpiarContexto() {
        TenantContext.limpiar();
        OrigenContext.limpiar();
    }

    @Test
    @DisplayName("el conjunto propio se lee entero, abierto, con su ejercicio y su version")
    void elConjuntoPropioSeLeeEntero() {
        entrarComo(municipalidadA);

        AdministrarParametros.ContenidoDelConjunto dentro = administrar.contenidoDe(conjuntoDeA);

        assertThat(dentro.conjunto().id()).isEqualTo(conjuntoDeA);
        assertThat(dentro.conjunto().ejercicio().valor()).isEqualTo(2031);
        assertThat(dentro.conjunto().estaSellado())
                .as("#56 sirve el conjunto ABIERTO, que es el que el snapshot se niega a servir")
                .isFalse();
        assertThat(dentro.parametros().stream().map(ParametroTributario::clave))
                .containsExactly("NACIONAL", "SOLO_DE_A");
    }

    @Test
    @DisplayName(
            "el conjunto de la OTRA municipalidad es 404, con el mismo mensaje que uno que no existe")
    void elConjuntoDeLaOtraMunicipalidadEs404() {
        entrarComo(municipalidadA);

        ProblemaDeNegocio porElAjeno = capturar(() -> administrar.contenidoDe(conjuntoDeB));
        ProblemaDeNegocio porElInventado = capturar(() -> administrar.contenidoDe(999_999L));

        assertThat(porElAjeno.codigo())
                .as(
                        "con RLS, «no existe» y «es de otra municipalidad» son el MISMO hecho: la"
                                + " politica esconde la fila (ADR-0043 §7)")
                .isEqualTo(CodigoDeError.NO_ENCONTRADO);
        assertThat(porElAjeno.getMessage())
                .as(
                        "dos mensajes distintos convertirian la ruta en un detector de conjuntos"
                                + " ajenos: uno diria «existe pero no es tuyo»")
                .isEqualTo(
                        porElInventado.getMessage().replace("999999", String.valueOf(conjuntoDeB)));
        assertThat(porElInventado.codigo()).isEqualTo(CodigoDeError.NO_ENCONTRADO);
    }

    @Test
    @DisplayName("y el 404 NO es un 200 con la lista vacia, que es lo que `parametrosDe` devuelve")
    void elContenidoNoSeConfundeConUnaListaVacia() {
        entrarComo(municipalidadA);

        assertThat(administrar.parametrosDe(conjuntoDeB))
                .as(
                        "esta es la trampa que #56 cierra: el JOIN no encuentra detalle de la otra"
                                + " municipalidad y contesta cero filas, que servido tal cual seria"
                                + " un 200 diciendo «existe y esta vacio»")
                .isEmpty();
        assertThatThrownBy(() -> administrar.contenidoDe(conjuntoDeB))
                .isInstanceOf(ProblemaDeNegocio.class);
    }

    @Test
    @DisplayName("el listado trae los nacionales y los propios, y ni una fila de la otra")
    void elListadoTraeLosNacionalesYLosPropios() {
        entrarComo(municipalidadA);

        Pagina<ParametroTributario> pagina = administrar.parametros(Paginacion.de(0, 50, "tipo"));

        assertThat(pagina.contenido().stream().map(ParametroTributario::id))
                .as(
                        "el nacional ESTA —la excepcion declarada de ADR-0007, la UIT es de todos—"
                                + " y el propio tambien; el de la otra municipalidad no")
                .contains(parametroNacional, parametroDeA)
                .doesNotContain(parametroDeB);
    }

    @Test
    @DisplayName("y desde la otra municipalidad se ve lo simetrico: el nacional y el suyo")
    void elListadoEsSimetrico() {
        entrarComo(municipalidadB);

        Pagina<ParametroTributario> pagina = administrar.parametros(Paginacion.de(0, 50, "tipo"));

        assertThat(pagina.contenido().stream().map(ParametroTributario::id))
                .contains(parametroNacional, parametroDeB)
                .doesNotContain(parametroDeA);
    }

    // ------------------------------------------------------------------

    private static void entrarComo(long municipalidad) {
        TenantContext.fijar(new MunicipalidadId(municipalidad));
        OrigenContext.fijar(new Origen("jefe.rentas", "PC-RENTAS-01", "10.2.2.2"));
    }

    private static ProblemaDeNegocio capturar(Runnable lectura) {
        try {
            lectura.run();
        } catch (ProblemaDeNegocio problema) {
            return problema;
        }
        throw new AssertionError("La lectura no fallo, y tenia que contestar 404");
    }

    /** Publica una fila con {@code rol_carga_parametros}: la aplicacion solo tiene SELECT (V7). */
    private static long publicar(Long municipalidad, String tipo, String clave)
            throws SQLException {
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS);
                PreparedStatement sentencia =
                        carga.prepareStatement(
                                "INSERT INTO parametro_tributario (municipalidad_id, tipo, clave,"
                                        + " valor_numerico, vigencia_desde, documento_fuente,"
                                        + " usuario_carga, usuario_aprueba) VALUES (?, ?, ?,"
                                        + " ?::numeric, DATE '2031-01-01', ?, 'carga', 'aprueba')"
                                        + " RETURNING id")) {
            if (municipalidad == null) {
                sentencia.setNull(1, java.sql.Types.BIGINT);
            } else {
                sentencia.setLong(1, municipalidad);
            }
            sentencia.setString(2, tipo);
            sentencia.setString(3, clave);
            sentencia.setString(4, VALOR_FICTICIO);
            sentencia.setString(5, FUENTE);
            try (ResultSet resultado = sentencia.executeQuery()) {
                resultado.next();
                long id = resultado.getLong(1);
                carga.commit();
                return id;
            }
        }
    }

    private static long componer(long municipalidad, Ejercicio ejercicio, long... parametros) {
        entrarComo(municipalidad);
        try {
            ConjuntoDeParametros conjunto =
                    administrar.abrirVersion(
                            ejercicio, Observacion.de("Se abre el conjunto de la prueba de #56"));
            long id = Objects.requireNonNull(conjunto.id(), "El conjunto creado tiene id");
            for (long parametro : parametros) {
                administrar.agregarParametro(
                        id, parametro, Observacion.de("Se incorpora un parametro ya publicado"));
            }
            return id;
        } finally {
            TenantContext.limpiar();
            OrigenContext.limpiar();
        }
    }

    private static long crearMunicipalidad(String ubigeo, String nombre) throws SQLException {
        try (Connection owner = base.conexion(BaseDeDatosDePrueba.OWNER);
                PreparedStatement sentencia =
                        owner.prepareStatement(
                                "INSERT INTO municipalidad (ubigeo, nombre, tipo)"
                                        + " VALUES (?, ?, 'DISTRITAL') RETURNING id")) {
            sentencia.setString(1, ubigeo);
            sentencia.setString(2, nombre);
            try (ResultSet resultado = sentencia.executeQuery()) {
                resultado.next();
                long id = resultado.getLong(1);
                owner.commit();
                return id;
            }
        }
    }
}
