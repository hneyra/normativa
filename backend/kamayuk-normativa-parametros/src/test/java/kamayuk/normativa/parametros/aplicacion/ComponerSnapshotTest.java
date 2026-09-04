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
import kamayuk.normativa.auditoria.AuditoriaJdbc;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto;
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.parametros.infraestructura.SnapshotRepositoryJdbc;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.reglas.Ambito;
import kamayuk.normativa.reglas.IdentificadorDeConjunto;
import kamayuk.normativa.reglas.LectorDeParametros;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

/**
 * ADR-0025 §1 — el conjunto sellado, entero y en una sola pieza, contra PostgreSQL real.
 *
 * <p>Lo que se mide aqui es lo que hace posible que {@code rentas} calcule con {@code normativa}
 * apagada: que el snapshot traiga <b>todo</b> lo que el calculo lee —los parametros y los cuadros—,
 * que el reparto por ambito no se deje nada de su mitad, y que dos composiciones del mismo conjunto
 * sean <b>identicas</b>, que es lo que permite firmarlas con una huella y cachearlas para siempre.
 *
 * <p>El proxy transaccional se construye con {@code AnnotationTransactionAttributeSource} —
 * obedeciendo a la anotacion, igual que el contenedor— y no con un {@code TransactionTemplate}
 * incondicional: envolver siempre dejaria la prueba pasando con la anotacion quitada, que es
 * justamente el modo de fallo que existe para impedir (#486, #535, #569).
 */
@DisplayName("ADR-0025 §1 — El snapshot del conjunto sellado")
class ComponerSnapshotTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-04T10:00:00Z"), ZoneId.of("America/Lima"));

    private static BaseDeDatosDePrueba base;
    private static long municipalidad;
    private static AdministrarParametros administrar;
    private static ComponerSnapshot componer;

    /** El conjunto sellado con las tres clases de fila dentro, compartido por las pruebas. */
    private static long conjuntoConTodo;

    private static final Ejercicio EJERCICIO = new Ejercicio(2051);

    @BeforeAll
    static void provisionar() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        municipalidad = crearMunicipalidad("290401", "Municipalidad del snapshot");

        DriverManagerDataSource pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));

        JdbcClient jdbc = JdbcClient.create(pool);
        TenantTransactionManager gestor = new TenantTransactionManager(pool);
        ParametrosRepositoryJdbc repositorio = new ParametrosRepositoryJdbc(jdbc);

        administrar =
                envolver(
                        new AdministrarParametros(
                                repositorio, new AuditoriaJdbc(jdbc, RELOJ), RELOJ),
                        gestor);
        componer =
                envolver(
                        new ComponerSnapshot(repositorio, new SnapshotRepositoryJdbc(jdbc)),
                        gestor);

        TenantContext.fijar(new MunicipalidadId(municipalidad));
        OrigenContext.fijar(new Origen("jefe.rentas", null, null));
        conjuntoConTodo = sembrarConjuntoCompleto();
        TenantContext.limpiar();
        OrigenContext.limpiar();
    }

    @SuppressWarnings("unchecked")
    private static <T> T envolver(T objetivo, TenantTransactionManager gestor) {
        ProxyFactory fabrica = new ProxyFactory(objetivo);
        fabrica.setProxyTargetClass(true);
        fabrica.addAdvice(
                new TransactionInterceptor(gestor, new AnnotationTransactionAttributeSource()));
        return (T) fabrica.getProxy();
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
        OrigenContext.fijar(new Origen("jefe.rentas", null, null));
    }

    @AfterEach
    void limpiarContexto() {
        TenantContext.limpiar();
        OrigenContext.limpiar();
    }

    @Test
    @DisplayName("el snapshot trae el conjunto entero: parametros y los tres cuadros")
    void traeElConjuntoEntero() {
        SnapshotDelConjunto todo =
                componer.porConjunto(IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.VALUACION);
        SnapshotDelConjunto obligacion =
                componer.porConjunto(
                        IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.OBLIGACION);

        assertThat(todo.valoresUnitarios())
                .as("sin el cuadro de valores unitarios, catastro no puede valorizar sin la red")
                .isNotEmpty();
        assertThat(todo.depreciaciones()).isNotEmpty();
        assertThat(obligacion.valoresReferenciales())
                .as("sin el anexo del MEF, rentas no puede calcular el vehicular sin la red")
                .isNotEmpty();
        assertThat(todo.parametros())
                .as("los parametros van en LOS DOS ambitos: son 33 filas y los dos los necesitan")
                .isNotEmpty();
        assertThat(obligacion.parametros()).isNotEmpty();
    }

    @Test
    @DisplayName("el ambito reparte los cuadros, y la IDENTIDAD es la misma en los dos")
    void elAmbitoRepartLosCuadrosYNoLaIdentidad() {
        SnapshotDelConjunto valuacion =
                componer.porConjunto(IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.VALUACION);
        SnapshotDelConjunto obligacion =
                componer.porConjunto(
                        IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.OBLIGACION);

        assertThat(valuacion.valoresReferenciales())
                .as("catastro no valoriza vehiculos: 54 000 filas que nunca leeria")
                .isEmpty();
        assertThat(obligacion.valoresUnitarios())
                .as("la obligacion no compone el autovaluo: eso es de catastro (ADR-0024)")
                .isEmpty();
        assertThat(obligacion.depreciaciones()).isEmpty();

        assertThat(valuacion.conjuntoId())
                .as(
                        "la identidad es lo unico que NO cambia entre ambitos, y es lo que las dos"
                                + " corridas comparan para saber que calcularon con lo mismo"
                                + " (ADR-0025 §Consecuencias)")
                .isEqualTo(obligacion.conjuntoId());
        assertThat(valuacion.version()).isEqualTo(obligacion.version());
        assertThat(valuacion.ejercicio()).isEqualTo(obligacion.ejercicio());
    }

    @Test
    @DisplayName("dos composiciones del mismo conjunto son identicas, fila a fila y en orden")
    void dosComposicionesSonIdenticas() {
        SnapshotDelConjunto una =
                componer.porConjunto(IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.VALUACION);
        SnapshotDelConjunto otra =
                componer.porConjunto(IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.VALUACION);

        assertThat(una)
                .as(
                        "si el orden dependiera del plan, el ETag cambiaria sin que cambiara el"
                                + " conjunto: es el defecto que ADR-0025 §Consecuencias manda probar")
                .isEqualTo(otra);
    }

    @Test
    @DisplayName("el parametro viaja con su VIGENCIA, no ya resuelto")
    void elParametroViajaConSuVigencia() {
        SnapshotDelConjunto snapshot =
                componer.porConjunto(
                        IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.OBLIGACION);

        assertThat(snapshot.parametros())
                .as(
                        "resolver aqui cual rige moveria al servidor la decision de #659 y la"
                                + " haria invisible: el conjunto contiene el historico a proposito")
                .anySatisfy(p -> assertThat(p.vigenciaDesde()).isNotNull());
    }

    @Test
    @DisplayName("un conjunto abierto no se sirve, y un ejercicio sin sellar tampoco")
    void loAbiertoNoSeSirve() throws SQLException {
        ConjuntoDeParametros abierto =
                administrar.abrirVersion(
                        new Ejercicio(2052), Observacion.de("Se prepara el ejercicio 2052"));

        assertThatThrownBy(
                        () ->
                                componer.porConjunto(
                                        IdentificadorDeConjunto.de(abierto.id()),
                                        Ambito.OBLIGACION))
                .as("cachear «para siempre» algo que manana puede ser otra cosa es el defecto")
                .isInstanceOf(LectorDeParametros.ConjuntoNoSellado.class);

        assertThatThrownBy(() -> componer.vigenteDe(new Ejercicio(2053), Ambito.OBLIGACION))
                .isInstanceOf(LectorDeParametros.EjercicioSinSellar.class)
                .hasMessageContaining("2053");
    }

    @Test
    @DisplayName("el vigente del ejercicio y el conjunto por id son el mismo conjunto")
    void elVigenteYElConjuntoPorIdCoinciden() {
        SnapshotDelConjunto porEjercicio = componer.vigenteDe(EJERCICIO, Ambito.OBLIGACION);
        SnapshotDelConjunto porId =
                componer.porConjunto(
                        IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.OBLIGACION);

        assertThat(porEjercicio).isEqualTo(porId);
    }

    @Test
    @DisplayName("el tramo abierto de la depreciacion viaja como nulo, no como cero")
    void elTramoAbiertoViajaComoNulo() {
        SnapshotDelConjunto snapshot =
                componer.porConjunto(IdentificadorDeConjunto.de(conjuntoConTodo), Ambito.VALUACION);

        assertThat(snapshot.depreciaciones())
                .as(
                        "leer «mas de 50 anios» como cero convierte el tramo abierto en uno que no"
                                + " cubre nada, sin ningun error de por medio (#188 H-15)")
                .anySatisfy(d -> assertThat(d.antiguedadHasta()).isNull());
    }

    // ------------------------------------------------------------------
    // Siembra
    // ------------------------------------------------------------------

    private static long sembrarConjuntoCompleto() throws SQLException {
        ConjuntoDeParametros conjunto =
                administrar.abrirVersion(EJERCICIO, Observacion.de("Se abre el ejercicio 2051"));

        long uit = parametroConVigencia("UIT_FICTICIA", null, 550_000L, "2051-01-01", "2051-12-31");
        administrar.agregarParametro(
                conjunto.id(), uit, Observacion.de("Se incorpora la UIT ficticia de 2051"));

        long edicion = edicionDeValuacion();
        sembrarCuadros(edicion);
        administrar.agregarParametro(
                conjunto.id(),
                edicion,
                Observacion.de("Se compone la edicion ficticia de valuacion"));

        administrar.sellar(conjunto.id(), Observacion.de("Se sella 2051 con los tres cuadros"));
        return conjunto.id();
    }

    private static long edicionDeValuacion() throws SQLException {
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS);
                PreparedStatement sentencia =
                        carga.prepareStatement(
                                "INSERT INTO parametro_tributario (municipalidad_id, tipo, clave,"
                                        + " valor_texto, vigencia_desde, documento_fuente,"
                                        + " usuario_carga, usuario_aprueba) VALUES (NULL,"
                                        + " 'EDICION_FICTICIA', 'valuacion-2051', 'edicion"
                                        + " ficticia', DATE '2051-01-01', 'Valor ficticio de"
                                        + " prueba; no representa ninguna norma', 'carga',"
                                        + " 'aprueba') RETURNING id")) {
            try (ResultSet resultado = sentencia.executeQuery()) {
                resultado.next();
                long id = resultado.getLong(1);
                carga.commit();
                return id;
            }
        }
    }

    private static void sembrarCuadros(long edicion) throws SQLException {
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS)) {
            ejecutar(
                    carga,
                    "INSERT INTO valor_unitario_edificacion (publicacion_id, partida, categoria,"
                            + " anio_construccion_desde, valor_m2, documento_fuente)"
                            + " VALUES (?, 'MUROS', 'C', 2000, 123.456789, 'Cuadro ficticio de"
                            + " prueba; no representa ninguna norma')",
                    edicion);
            ejecutar(
                    carga,
                    "INSERT INTO valor_unitario_edificacion (publicacion_id, partida, categoria,"
                            + " anio_construccion_desde, valor_m2, documento_fuente)"
                            + " VALUES (?, 'TECHOS', 'A', 2000, 200.000000, 'Cuadro ficticio de"
                            + " prueba; no representa ninguna norma')",
                    edicion);
            // Un tramo cerrado y el abierto: el nulo de «mas de 50 anios» es lo que no puede
            // llegar al cliente como cero.
            ejecutar(
                    carga,
                    "INSERT INTO depreciacion (publicacion_id, uso, material, estado_conservacion,"
                            + " antiguedad_hasta, porcentaje, documento_fuente)"
                            + " VALUES (?, '01', 'CONCRETO', 'BUENO', 10, 5.0000, 'Cuadro ficticio"
                            + " de prueba; no representa ninguna norma')",
                    edicion);
            ejecutar(
                    carga,
                    "INSERT INTO depreciacion (publicacion_id, uso, material, estado_conservacion,"
                            + " antiguedad_hasta, porcentaje, documento_fuente)"
                            + " VALUES (?, '01', 'CONCRETO', 'BUENO', NULL, 40.0000, 'Cuadro"
                            + " ficticio de prueba; no representa ninguna norma')",
                    edicion);
            ejecutar(
                    carga,
                    "INSERT INTO valor_referencial_vehiculo (publicacion_id, ejercicio, categoria,"
                            + " marca, modelo, anio_fabricacion, valor, documento_fuente)"
                            + " VALUES (?, 2051, 'A1', 'MARCA FICTICIA', 'MODELO', 2048, 30000.00,"
                            + " 'Anexo ficticio de prueba; no representa ninguna norma')",
                    edicion);
            carga.commit();
        }
    }

    private static void ejecutar(Connection conexion, String sql, long edicion)
            throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setLong(1, edicion);
            sentencia.executeUpdate();
        }
    }

    private static long parametroConVigencia(
            String tipo, String clave, long valor, String desde, String hasta) throws SQLException {
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS);
                PreparedStatement sentencia =
                        carga.prepareStatement(
                                "INSERT INTO parametro_tributario (municipalidad_id, tipo, clave,"
                                        + " valor_numerico, vigencia_desde, vigencia_hasta,"
                                        + " documento_fuente, usuario_carga, usuario_aprueba)"
                                        + " VALUES (NULL, ?, ?, ?, CAST(? AS date),"
                                        + " CAST(? AS date), 'Valor ficticio de prueba; no"
                                        + " representa ninguna norma', 'carga', 'aprueba')"
                                        + " RETURNING id")) {
            sentencia.setString(1, tipo);
            sentencia.setString(2, clave);
            sentencia.setLong(3, valor);
            sentencia.setString(4, desde);
            sentencia.setString(5, hasta);
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
}
