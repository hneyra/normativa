package kamayuk.normativa.esquema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import org.flywaydb.core.api.FlywayException;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * La {@code V3} aplica sobre una base que <b>ya tiene un conjunto sellado</b> (#59, AC 1).
 *
 * <h2>Por que hace falta una base parada en la V2</h2>
 *
 * <p>{@link BaseDeDatosDePrueba#provisionar()} migra hasta la ultima, asi que ninguna otra prueba
 * ve el momento que importa: una base de una municipalidad que ya emitio —con su conjunto {@code
 * SELLADO}— recibiendo la {@code V3}. Y es justo el momento en que un {@code UPDATE} de relleno la
 * romperia: {@code conjunto_sellado_inmutable} rechaza todo {@code UPDATE} de una fila sellada, y
 * el migrador corre sin contexto de tenant sobre una tabla con {@code FORCE ROW LEVEL SECURITY}.
 * Por eso aqui el motor se provisiona a mano, se migra con {@link Migrador#configuracion} hasta la
 * {@code V2} —la misma configuracion que usa el despliegue, con {@code target("2")}—, se siembra y
 * se sella un conjunto como lo haria la aplicacion, y solo entonces se aplica lo que falta.
 *
 * <p>{@code DatosDePrueba} no sirve para esto: su conjunto queda {@code ABIERTO}, y la siembra ya
 * escribe la columna de la {@code V3}.
 */
@DisplayName("#59 — la V3 aplica sobre una base con un conjunto sellado")
class LaV3SobreUnConjuntoSelladoTest {

    private static MotorPostgres motor;
    private static Map<String, String> claves;
    private static long municipalidad;
    private static long sellado;
    private static long parametro;

    /** Lo que se midio ANTES de aplicar la V3: version, estado del conjunto y si hay columna. */
    private static String antes;

    /** Cuantas aplico el migrador, y con que fallo si fallo. */
    private static int aplicadas;

    private static @Nullable Exception falloDeLaV3;

    @BeforeAll
    static void provisionarEnLaV2() throws SQLException, IOException {
        motor = MotorPostgres.iniciar();
        claves = BaseDeDatosDePrueba.provisionarRoles(motor);
        Migrador.configuracion(
                        motor.url(),
                        BaseDeDatosDePrueba.OWNER,
                        claves.get(BaseDeDatosDePrueba.OWNER))
                .target("2")
                .load()
                .migrate();

        try (Connection owner = conexion(BaseDeDatosDePrueba.OWNER)) {
            municipalidad =
                    unLong(
                            owner,
                            "INSERT INTO municipalidad (ubigeo, nombre, tipo)"
                                    + " VALUES ('200699', 'Municipalidad que ya emitio',"
                                    + " 'DISTRITAL') RETURNING id");
            owner.commit();
        }
        try (Connection carga = conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS)) {
            // Un valor inventado: no representa ninguna cifra de ninguna norma (regla 5).
            parametro =
                    unLong(
                            carga,
                            "INSERT INTO parametro_tributario (municipalidad_id, tipo, clave,"
                                    + " valor_numerico, vigencia_desde, documento_fuente,"
                                    + " usuario_carga, usuario_aprueba) VALUES (NULL, 'FICTICIO',"
                                    + " 'V3', 1.000000, DATE '2026-01-01', 'Valor ficticio de"
                                    + " prueba; no representa ninguna norma', 'carga', 'aprueba')"
                                    + " RETURNING id");
            carga.commit();
        }
        try (Connection app = conexion(BaseDeDatosDePrueba.APP)) {
            ContextoDeTenant.fijar(app, municipalidad);
            sellado =
                    unLong(
                            app,
                            "INSERT INTO conjunto_parametros (municipalidad_id, ejercicio, version)"
                                    + " VALUES ("
                                    + municipalidad
                                    + ", 2026, 1) RETURNING id");
            ejecutar(
                    app,
                    "INSERT INTO conjunto_parametro_detalle (municipalidad_id, conjunto_id,"
                            + " parametro_id) VALUES ("
                            + municipalidad
                            + ", "
                            + sellado
                            + ", "
                            + parametro
                            + ")");
            ejecutar(
                    app,
                    "UPDATE conjunto_parametros SET estado = 'SELLADO', fecha_sellado = now(),"
                            + " usuario_sellado = 'jefe.rentas' WHERE id = "
                            + sellado);
            app.commit();
        }

        antes =
                unTexto(
                        "SELECT (SELECT max(version::int) FROM flyway_schema_history)"
                                + " || ':' || (SELECT estado FROM conjunto_parametros WHERE id = "
                                + sellado
                                + ") || ':' || (SELECT count(*) FROM information_schema.columns"
                                + " WHERE table_name = 'conjunto_parametros'"
                                + "   AND column_name = 'clave_idempotencia')");

        // Se aplica aqui y se guarda el desenlace, en vez de dejar que reviente el arranque: si la
        // V3 fallara, lo que tiene que salir rojo es la prueba que dice «la V3 aplica», con la
        // causa, y no un initializationError que no dice que se estaba midiendo.
        try {
            aplicadas =
                    Migrador.migrar(
                            motor.url(),
                            BaseDeDatosDePrueba.OWNER,
                            claves.get(BaseDeDatosDePrueba.OWNER));
        } catch (FlywayException | SQLException fallo) {
            falloDeLaV3 = fallo;
        }
    }

    @AfterAll
    static void cerrar() {
        if (motor != null) {
            motor.close();
        }
    }

    @Test
    @DisplayName("la base de partida estaba en la V2, con su conjunto SELLADO y sin la columna")
    void laBaseDePartida() {
        // El contraste: sin esto, una base que ya viniera en la V3 haria pasar la prueba de abajo
        // sin haber aplicado nada sobre un sellado.
        assertThat(antes).isEqualTo("2:SELLADO:0");
    }

    @Test
    @DisplayName("la V3 aplica, y el sellado sigue sellado y sin clave")
    void laV3Aplica() throws SQLException {
        assertThat(falloDeLaV3)
                .as(
                        "sobre una base con un conjunto sellado, la V3 tiene que aplicar. Un UPDATE de"
                                + " relleno la romperia aqui: `conjunto_sellado_inmutable` rechaza"
                                + " todo UPDATE de una fila sellada, y el migrador no tiene contexto"
                                + " de tenant para pasar la politica")
                .isNull();
        assertThat(aplicadas).isEqualTo(1);
        assertThat(unTexto("SELECT max(version::int)::text FROM flyway_schema_history"))
                .isEqualTo("3");
        assertThat(
                        unTexto(
                                "SELECT estado || ':' || coalesce(clave_idempotencia, 'NULL')"
                                        + " FROM conjunto_parametros WHERE id = "
                                        + sellado))
                .as("lo que abrio el batch no tiene clave que inventarle, y no se toca")
                .isEqualTo("SELLADO:NULL");
        assertThat(
                        unTexto(
                                "SELECT indexdef FROM pg_indexes"
                                        + " WHERE indexname = 'conjunto_idempotencia_uq'"))
                .as("el indice es unico, parcial y por municipalidad")
                .contains("UNIQUE")
                .contains("(municipalidad_id, clave_idempotencia)")
                .contains("WHERE (clave_idempotencia IS NOT NULL)");
    }

    @Test
    @DisplayName("y despues, abrir con clave y sellar sigue funcionando, y lo sellado sigue quieto")
    void despuesSeAbreConClaveYSeSella() throws SQLException {
        assertThat(falloDeLaV3).as("sin la V3 aplicada no hay nada que medir aqui").isNull();
        try (Connection app = conexion(BaseDeDatosDePrueba.APP)) {
            ContextoDeTenant.fijar(app, municipalidad);
            long conClave =
                    unLong(
                            app,
                            "INSERT INTO conjunto_parametros (municipalidad_id, ejercicio, version,"
                                    + " clave_idempotencia) VALUES ("
                                    + municipalidad
                                    + ", 2026, 2, 'correccion-2026-v2') RETURNING id");
            ejecutar(
                    app,
                    "INSERT INTO conjunto_parametro_detalle (municipalidad_id, conjunto_id,"
                            + " parametro_id) VALUES ("
                            + municipalidad
                            + ", "
                            + conClave
                            + ", "
                            + parametro
                            + ")");
            int selladas =
                    ejecutar(
                            app,
                            "UPDATE conjunto_parametros SET estado = 'SELLADO', fecha_sellado ="
                                    + " now(), usuario_sellado = 'jefe.rentas' WHERE id = "
                                    + conClave);
            app.commit();

            assertThat(selladas)
                    .as("la columna nueva no estorba al sellado: es un UPDATE sobre una ABIERTA")
                    .isEqualTo(1);
        }

        try (Connection app = conexion(BaseDeDatosDePrueba.APP)) {
            ContextoDeTenant.fijar(app, municipalidad);
            assertThatThrownBy(
                            () ->
                                    ejecutar(
                                            app,
                                            "UPDATE conjunto_parametros SET clave_idempotencia ="
                                                    + " 'otra' WHERE id = "
                                                    + sellado))
                    .as(
                            "y la V3 no ablando la inmutabilidad: tampoco la columna nueva se"
                                    + " puede escribir en una fila sellada")
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("esta sellado y no se modifica");
            app.rollback();
        }
    }

    // ------------------------------------------------------------------

    private static Connection conexion(String rol) throws SQLException {
        Connection conexion = DriverManager.getConnection(motor.url(), rol, claves.get(rol));
        conexion.setAutoCommit(false);
        return conexion;
    }

    private static long unLong(Connection conexion, String sql) throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(sql);
                ResultSet fila = sentencia.executeQuery()) {
            fila.next();
            return fila.getLong(1);
        }
    }

    private static int ejecutar(Connection conexion, String sql) throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            return sentencia.executeUpdate();
        }
    }

    private static String unTexto(String sql) throws SQLException {
        try (Connection admin =
                        DriverManager.getConnection(
                                motor.url(), motor.usuarioAdmin(), motor.claveAdmin());
                PreparedStatement sentencia = admin.prepareStatement(sql);
                ResultSet fila = sentencia.executeQuery()) {
            fila.next();
            return fila.getString(1);
        }
    }
}
