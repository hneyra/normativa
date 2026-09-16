package kamayuk.normativa.parametros.infraestructura.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import kamayuk.normativa.auditoria.AuditoriaJdbc;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.parametros.aplicacion.AdministrarParametros;
import kamayuk.normativa.parametros.aplicacion.ComponerSnapshot;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.parametros.infraestructura.SnapshotRepositoryJdbc;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.web.ConfiguracionDeJson;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import tools.jackson.databind.json.JsonMapper;

/**
 * #56 — <b>Este PR no le toca la huella a ningun conjunto sellado</b>, y esto lo demuestra.
 *
 * <h2>Que se esta protegiendo</h2>
 *
 * <p>El {@code ETag} de {@code GET /conjuntos/{id}/snapshot} es el {@code sha256} <b>de los bytes
 * servidos</b> ({@code SnapshotController}), y ADR-0025 §Consecuencias lo dice con todas las
 * letras: «Un {@code ETag} que cambie sin que cambie el {@code conjuntoId} es un defecto del
 * servidor». Los bytes los decide, entre otras cosas, el orden de las filas — y ese orden sale de
 * {@code ParametrosRepositoryJdbc.parametrosDe}, {@code ORDER BY p.tipo, p.clave}, <b>la misma
 * consulta</b> que #56 necesitaba para su lectura nueva.
 *
 * <p>Ese {@code ORDER BY} no es total: {@code parametros-2026.csv} publica cinco filas {@code UIT}
 * con la misma clave vacia. Lo natural seria completarlo aqui, y <b>no se hizo</b>: {@code rentas}
 * y {@code catastro} guardan el snapshot en cache con esa huella, y cambiarla los obliga a
 * redescargar todo lo sellado sin que ningun conjunto haya cambiado. El orden total de #56 se puso
 * en el caso de uso ({@code AdministrarParametros.contenidoDe}), que no pasa por aqui.
 *
 * <h2>Como muerde</h2>
 *
 * <p>La huella esta escrita como literal, medida sobre esta siembra. Los tres parametros se
 * publican en un orden —{@code ZETA}, {@code ALFA}, {@code MEDIO}— que <b>no</b> es el que sirve el
 * snapshot —{@code ALFA}, {@code MEDIO}, {@code ZETA}—, asi que cualquier cambio del {@code ORDER
 * BY} —a {@code id}, a {@code tipo DESC}, o completarlo con un desempate que reordene— cambia los
 * bytes y esta prueba lo dice con el {@code sha256} viejo y el nuevo delante.
 *
 * <p>Si algun dia hay que cambiar la huella a proposito, se cambia este literal <b>en el PR que lo
 * decide</b>, con la medicion de a quien le invalida la cache. Que cueste es el punto.
 */
@DisplayName("#56 — La huella del snapshot de un conjunto sellado no cambia")
class LaHuellaDelSnapshotNoCambiaTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-16T10:00:00Z"), ZoneId.of("America/Lima"));

    /**
     * Un valor inventado, y dicho aqui para que no se confunda con uno real. No representa ninguna
     * UIT, ningun tramo y ninguna alicuota: sirve para que la fila exista (regla 5).
     */
    private static final String VALOR_FICTICIO = "1.000000";

    private static final String FUENTE = "Valor ficticio de prueba; no representa ninguna norma";

    /** El orden en que se publican, distinto del que el snapshot sirve. */
    private static final List<String> COMO_SE_PUBLICAN = List.of("ZETA", "ALFA", "MEDIO");

    /** El orden en que el snapshot los sirve: {@code ORDER BY p.tipo, p.clave}. */
    private static final List<String> COMO_SE_SIRVEN = List.of("ALFA", "MEDIO", "ZETA");

    /**
     * La huella de este conjunto sellado, medida contra PostgreSQL 16 el 2026-09-16, antes y
     * despues de #56.
     */
    private static final String HUELLA =
            "9aa9042eb82cf413b402da29524b65962226e84fff7727c3b3cf650719b6f75e";

    private static BaseDeDatosDePrueba base;
    private static long municipalidad;
    private static long conjunto;
    private static SnapshotController controlador;

    @BeforeAll
    static void provisionar() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        municipalidad = crearMunicipalidad("300201", "Municipalidad de la huella");

        DriverManagerDataSource pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));

        JdbcClient jdbc = JdbcClient.create(pool);
        TenantTransactionManager gestor = new TenantTransactionManager(pool);
        ParametrosRepositoryJdbc repositorio = new ParametrosRepositoryJdbc(jdbc);

        AdministrarParametros administrar =
                envolver(
                        new AdministrarParametros(
                                repositorio, new AuditoriaJdbc(jdbc, RELOJ), RELOJ),
                        gestor);
        ComponerSnapshot componer =
                envolver(
                        new ComponerSnapshot(repositorio, new SnapshotRepositoryJdbc(jdbc)),
                        gestor);
        controlador =
                new SnapshotController(
                        componer,
                        JsonMapper.builder()
                                .addModule(new ConfiguracionDeJson().moduloDeObjetosDeValor())
                                .build());

        TenantContext.fijar(new MunicipalidadId(municipalidad));
        OrigenContext.fijar(new Origen("jefe.rentas", "PC-RENTAS-01", "10.2.2.2"));
        conjunto = sembrarConjuntoSellado(administrar);
        TenantContext.limpiar();
        OrigenContext.limpiar();
    }

    @AfterAll
    static void cerrar() {
        if (base != null) {
            base.close();
        }
    }

    @BeforeEach
    void fijarContexto() {
        TenantContext.fijar(new MunicipalidadId(municipalidad));
        OrigenContext.fijar(new Origen("jefe.rentas", "PC-RENTAS-01", "10.2.2.2"));
    }

    @AfterEach
    void limpiarContexto() {
        TenantContext.limpiar();
        OrigenContext.limpiar();
    }

    @Test
    @DisplayName("el ETag es el sha256 de los bytes, y es el de siempre")
    void elEtagEsElDeSiempre() {
        ResponseEntity<String> respuesta = controlador.snapshot(conjunto, "OBLIGACION");
        String cuerpo = Objects.requireNonNull(respuesta.getBody(), "El snapshot tiene cuerpo");

        assertThat(respuesta.getHeaders().getETag())
                .as("el ETag es el sha256 de los bytes servidos, no de una canonica aparte")
                .isEqualTo("\"" + sha256(cuerpo) + "\"");
        assertThat(sha256(cuerpo))
                .as(
                        "la huella de este conjunto sellado cambio. Si fue a proposito —un campo"
                                + " nuevo en el recurso, otro ORDER BY en `parametrosDe`— hay que"
                                + " decir en el PR a quien le invalida la cache: `rentas` y"
                                + " `catastro` guardan el snapshot con esta huella y tendrian que"
                                + " redescargar todo lo sellado sin que ningun conjunto haya"
                                + " cambiado (ADR-0025 §Consecuencias)")
                .isEqualTo(HUELLA);
    }

    @Test
    @DisplayName("y las filas salen en el orden de la consulta, que no es el de la siembra")
    void lasFilasSalenEnElOrdenDeLaConsulta() {
        String cuerpo =
                Objects.requireNonNull(
                        controlador.snapshot(conjunto, "OBLIGACION").getBody(),
                        "El snapshot tiene cuerpo");

        // El contraste que hace util a la huella literal: con la siembra en el mismo orden que la
        // consulta, cambiar el ORDER BY no cambiaria un byte y el literal no protegeria nada.
        assertThat(COMO_SE_PUBLICAN).isNotEqualTo(COMO_SE_SIRVEN);
        assertThat(COMO_SE_SIRVEN.stream().map(cuerpo::indexOf).toList())
                .as("ORDER BY p.tipo, p.clave — y el snapshot serializa esa misma lista")
                .isSorted();
    }

    // ------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private static <T> T envolver(T objetivo, TenantTransactionManager gestor) {
        ProxyFactory fabrica = new ProxyFactory(objetivo);
        fabrica.setProxyTargetClass(true);
        fabrica.addAdvice(
                new TransactionInterceptor(gestor, new AnnotationTransactionAttributeSource()));
        return (T) fabrica.getProxy();
    }

    private static long sembrarConjuntoSellado(AdministrarParametros administrar)
            throws SQLException {
        ConjuntoDeParametros abierto =
                administrar.abrirVersion(
                        new Ejercicio(2041),
                        Observacion.de("Se abre el conjunto de la prueba de la huella"));
        long id = Objects.requireNonNull(abierto.id(), "El conjunto creado tiene id");
        for (String tipo : COMO_SE_PUBLICAN) {
            administrar.agregarParametro(
                    id, publicar(tipo), Observacion.de("Se incorpora un parametro ya publicado"));
        }
        administrar.sellar(id, Observacion.de("Se sella el conjunto de la prueba de la huella"));
        return id;
    }

    /** Publica una fila nacional con {@code rol_carga_parametros}: la aplicacion solo lee (V7). */
    private static long publicar(String tipo) throws SQLException {
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS);
                PreparedStatement sentencia =
                        carga.prepareStatement(
                                "INSERT INTO parametro_tributario (municipalidad_id, tipo, clave,"
                                        + " valor_numerico, vigencia_desde, documento_fuente,"
                                        + " usuario_carga, usuario_aprueba) VALUES (NULL, ?, NULL,"
                                        + " ?::numeric, DATE '2041-01-01', ?, 'carga', 'aprueba')"
                                        + " RETURNING id")) {
            sentencia.setString(1, tipo);
            sentencia.setString(2, VALOR_FICTICIO);
            sentencia.setString(3, FUENTE);
            try (ResultSet resultado = sentencia.executeQuery()) {
                resultado.next();
                long id = resultado.getLong(1);
                carga.commit();
                return id;
            }
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

    private static String sha256(String cuerpo) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(cuerpo.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException imposible) {
            throw new IllegalStateException("SHA-256 es obligatorio en toda JVM", imposible);
        }
    }
}
