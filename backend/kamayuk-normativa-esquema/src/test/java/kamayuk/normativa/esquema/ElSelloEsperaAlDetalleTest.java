package kamayuk.normativa.esquema;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * La {@code V4}: un conjunto no se sella mientras alguien tiene escrito, y sin confirmar, un
 * detalle suyo (revision de #100).
 *
 * <h2>Por que aqui, y no solo por HTTP</h2>
 *
 * <p>La garantia es de la base: la da el disparador {@code detalle_de_conjunto_sellado_inmutable}
 * leyendo el conjunto {@code FOR SHARE}, y el detalle lo escriben dos caminos —la ruta HTTP y el
 * proceso {@code batch}—. {@code EscriturasDelConjuntoDePuntaAPuntaTest} mide la carrera por la
 * ruta; esta la mide con dos conexiones de {@code kamayuk_app} y SQL a secas, sin ningun caso de
 * uso en medio, que es lo que tiene delante el {@code batch}.
 *
 * <p>Las esperas se miden con {@code lock_timeout}: una sentencia que tiene que esperar un candado
 * y no lo obtiene en un segundo falla con {@code 55P03}. Sin el {@code FOR SHARE} no hay candado
 * que esperar y la sentencia pasa al instante, que es el rojo.
 *
 * <h2>Y la premisa de la {@code V4}, que se comprobo antes de escribirla</h2>
 *
 * <p>{@code FOR SHARE} exige privilegio {@code UPDATE} sobre {@code conjunto_parametros}, y la
 * funcion es {@code SECURITY INVOKER}: ese privilegio lo necesita quien inserta el detalle. Hoy lo
 * tiene todo el que puede insertarlo; el dia que un {@code GRANT} le de el detalle a un rol sin el,
 * sus {@code INSERT} fallarian con {@code permission denied for table conjunto_parametros}, y esta
 * prueba lo dice antes.
 */
@DisplayName("V4 — el sello espera al detalle que todavia no se confirmo")
class ElSelloEsperaAlDetalleTest {

    /** {@code lock_not_available}: la sentencia espero su candado y no lo obtuvo a tiempo. */
    private static final String ESPERO_UN_CANDADO = "55P03";

    /** {@code restrict_violation}, el de los disparadores de inmutabilidad. */
    private static final String SELLADO_NO_CAMBIA = "23001";

    private static BaseDeDatosDePrueba base;
    private static long municipalidad;
    private static long primero;
    private static long segundo;

    @BeforeAll
    static void provisionar() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        try (Connection owner = base.conexion(BaseDeDatosDePrueba.OWNER)) {
            municipalidad =
                    unLong(
                            owner,
                            "INSERT INTO municipalidad (ubigeo, nombre, tipo)"
                                    + " VALUES ('200698', 'Municipalidad de la V4', 'DISTRITAL')"
                                    + " RETURNING id");
            owner.commit();
        }
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS)) {
            primero = publicar(carga, "V4_A");
            segundo = publicar(carga, "V4_B");
            carga.commit();
        }
    }

    @AfterAll
    static void cerrar() {
        if (base != null) {
            base.close();
        }
    }

    @Test
    @DisplayName(
            "con el detalle escrito y sin confirmar, el sello espera; y sella con el dentro cuando"
                    + " se confirma")
    void elSelloEsperaAlDetalle() throws SQLException {
        long conjunto = abiertoConElPrimero(2061);

        try (Connection agrega = base.conexion(BaseDeDatosDePrueba.APP);
                Connection sella = base.conexion(BaseDeDatosDePrueba.APP)) {
            ContextoDeTenant.fijar(agrega, municipalidad);
            ejecutar(agrega, insertarElSegundo(conjunto));

            ContextoDeTenant.fijar(sella, municipalidad);
            ejecutar(sella, "SET LOCAL lock_timeout = '1s'");
            String elSello = comoTermina(sella, sellarlo(conjunto));
            sella.rollback();

            assertThat(elSello)
                    .as(
                            "el sello no espero al detalle sin confirmar: confirmaria antes que el,"
                                    + " y el conjunto quedaria SELLADO con un parametro que no"
                                    + " estaba al sellar (ADR-0007)")
                    .startsWith(ESPERO_UN_CANDADO);

            agrega.commit();
            ContextoDeTenant.fijar(sella, municipalidad);
            assertThat(ejecutar(sella, sellarlo(conjunto))).isEqualTo(1);
            sella.commit();
        }

        assertThat(estadoYDetalles(conjunto))
                .as("confirmado el detalle, el sello lo encuentra dentro")
                .isEqualTo("SELLADO:2");
    }

    @Test
    @DisplayName(
            "con el sello escrito y sin confirmar, el detalle espera; y cuando se confirma, lo"
                    + " rechaza el disparador")
    void elDetalleEsperaAlSello() throws SQLException {
        long conjunto = abiertoConElPrimero(2062);

        try (Connection sella = base.conexion(BaseDeDatosDePrueba.APP);
                Connection agrega = base.conexion(BaseDeDatosDePrueba.APP)) {
            ContextoDeTenant.fijar(sella, municipalidad);
            ejecutar(sella, sellarlo(conjunto));

            ContextoDeTenant.fijar(agrega, municipalidad);
            ejecutar(agrega, "SET LOCAL lock_timeout = '1s'");
            String elDetalle = comoTermina(agrega, insertarElSegundo(conjunto));
            agrega.rollback();

            assertThat(elDetalle)
                    .as(
                            "el detalle no espero al sello sin confirmar: el disparador leyo ABIERTO,"
                                    + " y si el sello confirma primero el detalle llega despues")
                    .startsWith(ESPERO_UN_CANDADO);

            sella.commit();
            ContextoDeTenant.fijar(agrega, municipalidad);
            String rechazado = comoTermina(agrega, insertarElSegundo(conjunto));
            agrega.rollback();

            assertThat(rechazado)
                    .as(
                            "el mismo codigo, el mismo mensaje y la misma funcion en su contexto que"
                                    + " V1: CausaEnLaBase lo reconoce por los dos")
                    .startsWith(SELLADO_NO_CAMBIA)
                    .contains(
                            "El conjunto de parametros "
                                    + conjunto
                                    + " esta sellado: su contenido no cambia (ADR-0007)")
                    .contains("detalle_de_conjunto_sellado_es_inmutable()");
        }

        assertThat(estadoYDetalles(conjunto)).isEqualTo("SELLADO:1");
    }

    @Test
    @DisplayName(
            "todo rol que puede escribir el detalle puede bloquear el conjunto, y la funcion no es"
                    + " SECURITY DEFINER")
    void quienEscribeElDetallePuedeBloquearElConjunto() throws SQLException {
        List<String> escriben =
                textos(
                        "SELECT r.rolname FROM pg_roles r"
                                + " WHERE r.rolname !~ '^pg_'"
                                + "   AND (has_table_privilege(r.oid,"
                                + "          'public.conjunto_parametro_detalle', 'INSERT')"
                                + "     OR has_table_privilege(r.oid,"
                                + "          'public.conjunto_parametro_detalle', 'UPDATE'))"
                                + " ORDER BY 1");
        List<String> sinUpdate =
                textos(
                        "SELECT r.rolname FROM pg_roles r"
                                + " WHERE r.rolname !~ '^pg_'"
                                + "   AND (has_table_privilege(r.oid,"
                                + "          'public.conjunto_parametro_detalle', 'INSERT')"
                                + "     OR has_table_privilege(r.oid,"
                                + "          'public.conjunto_parametro_detalle', 'UPDATE'))"
                                + "   AND NOT has_table_privilege(r.oid,"
                                + "          'public.conjunto_parametros', 'UPDATE')"
                                + " ORDER BY 1");

        assertThat(escriben)
                .as("el contraste: el censo mira algo, y ahi estan la aplicacion y el dueno")
                .contains(BaseDeDatosDePrueba.APP, BaseDeDatosDePrueba.OWNER);
        assertThat(sinUpdate)
                .as(
                        "FOR SHARE exige UPDATE sobre conjunto_parametros a quien inserta el"
                                + " detalle: sin el, su INSERT fallaria con permission denied")
                .isEmpty();
        assertThat(
                        textos(
                                "SELECT prosecdef::text FROM pg_proc"
                                        + " WHERE proname = 'detalle_de_conjunto_sellado_es_inmutable'"))
                .as("SECURITY DEFINER correria el disparador como su dueno para cualquiera")
                .containsExactly("false");
    }

    // ------------------------------------------------------------------

    /** Un conjunto abierto con el primer parametro dentro, ya confirmado. */
    private static long abiertoConElPrimero(int ejercicio) throws SQLException {
        try (Connection app = base.conexion(BaseDeDatosDePrueba.APP)) {
            ContextoDeTenant.fijar(app, municipalidad);
            long conjunto =
                    unLong(
                            app,
                            "INSERT INTO conjunto_parametros (municipalidad_id, ejercicio, version)"
                                    + " VALUES ("
                                    + municipalidad
                                    + ", "
                                    + ejercicio
                                    + ", 1) RETURNING id");
            ejecutar(
                    app,
                    "INSERT INTO conjunto_parametro_detalle (municipalidad_id, conjunto_id,"
                            + " parametro_id) VALUES ("
                            + municipalidad
                            + ", "
                            + conjunto
                            + ", "
                            + primero
                            + ")");
            app.commit();
            return conjunto;
        }
    }

    private static String insertarElSegundo(long conjunto) {
        return "INSERT INTO conjunto_parametro_detalle (municipalidad_id, conjunto_id,"
                + " parametro_id) VALUES ("
                + municipalidad
                + ", "
                + conjunto
                + ", "
                + segundo
                + ")";
    }

    private static String sellarlo(long conjunto) {
        return "UPDATE conjunto_parametros SET estado = 'SELLADO', fecha_sellado = now(),"
                + " usuario_sellado = 'jefe.rentas' WHERE id = "
                + conjunto;
    }

    /** Un valor inventado: no representa ninguna cifra de ninguna norma (regla 5). */
    private static long publicar(Connection carga, String clave) throws SQLException {
        return unLong(
                carga,
                "INSERT INTO parametro_tributario (municipalidad_id, tipo, clave, valor_numerico,"
                        + " vigencia_desde, documento_fuente, usuario_carga, usuario_aprueba)"
                        + " VALUES (NULL, 'FICTICIO', '"
                        + clave
                        + "', 1.000000, DATE '2026-01-01', 'Valor ficticio de prueba; no"
                        + " representa ninguna norma', 'carga', 'aprueba') RETURNING id");
    }

    private static String estadoYDetalles(long conjunto) throws SQLException {
        return textos(
                        "SELECT c.estado || ':' || (SELECT count(*) FROM conjunto_parametro_detalle d"
                                + " WHERE d.conjunto_id = c.id) FROM conjunto_parametros c"
                                + " WHERE c.id = "
                                + conjunto)
                .get(0);
    }

    private static long unLong(Connection conexion, String sql) throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(sql);
                ResultSet fila = sentencia.executeQuery()) {
            fila.next();
            return fila.getLong(1);
        }
    }

    /**
     * Como termina la sentencia: {@code SQLState: mensaje} si falla, o {@code sin fallar}. Asi el
     * rojo dice que paso en vez de que no se lanzo nada.
     */
    private static String comoTermina(Connection conexion, String sql) {
        try {
            ejecutar(conexion, sql);
            return "sin fallar";
        } catch (SQLException fallo) {
            return fallo.getSQLState() + ": " + fallo.getMessage();
        }
    }

    private static int ejecutar(Connection conexion, String sql) throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            return sentencia.executeUpdate();
        }
    }

    private static List<String> textos(String sql) throws SQLException {
        List<String> filas = new ArrayList<>();
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia = admin.prepareStatement(sql);
                ResultSet fila = sentencia.executeQuery()) {
            while (fila.next()) {
                filas.add(fila.getString(1));
            }
        }
        return filas;
    }
}
