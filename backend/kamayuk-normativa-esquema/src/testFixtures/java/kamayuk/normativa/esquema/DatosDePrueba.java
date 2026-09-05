package kamayuk.normativa.esquema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;

/**
 * Siembra una fila en <b>cada</b> tabla de tenant de {@code normativa}, para las dos
 * municipalidades de la prueba.
 *
 * <p>La cobertura completa no es adorno: la verificacion "con contexto de A no se ve ninguna fila
 * de B" es vacia si en la tabla no hay filas de B. Una tabla sin datos sembrados pasaria en verde
 * sin probar nada, que es justamente el modo de fallo contra el que existe esta prueba. Por eso la
 * prueba exige ademas que cada tabla de tenant tenga al menos una fila propia.
 *
 * <p><b>Al agregar una tabla de tenant hay que sembrarla aqui.</b> Si no, el build se pone rojo con
 * el mensaje de que la municipalidad A no ve filas suyas en esa tabla.
 *
 * <p><b>Es la version recortada de la de {@code rentas}</b>, no una copia: alli siembra 130 tablas
 * y aqui hay 19. Se recorto y no se copio entera porque una siembra que nombra tablas que este
 * esquema no tiene no compilaria contra el motor, y una que las nombrara «por si acaso» diria que
 * este sistema tiene un padron y no lo tiene.
 */
public final class DatosDePrueba {

    private static final LocalDate VIGENCIA = LocalDate.of(2026, 1, 1);
    private static final short EJERCICIO = 2026;

    /**
     * El modelo minimo que {@code documento_emitido.datos} admite: un {@code ModeloDeDocumento}.
     */
    private static final String MODELO_DE_DOCUMENTO =
            "{\"titulo\":\"Documento de prueba\",\"subtitulo\":null,\"aLaFecha\":\"2026-01-01\","
                    + "\"cabecera\":[],\"tablas\":[],\"pie\":[],\"duplicado\":null}";

    private DatosDePrueba() {}

    /** El alta de una municipalidad es una operacion de implantacion: la hace el owner. */
    public static long crearMunicipalidad(BaseDeDatosDePrueba base, String ubigeo, String nombre)
            throws SQLException {
        try (Connection owner = base.conexion(BaseDeDatosDePrueba.OWNER)) {
            long id =
                    insertar(
                            owner,
                            "INSERT INTO municipalidad (ubigeo, nombre, tipo)"
                                    + " VALUES (?, ?, 'DISTRITAL') RETURNING id",
                            ubigeo,
                            nombre);
            owner.commit();
            return id;
        }
    }

    /**
     * Catalogo nacional: lo carga su propio rol, no la aplicacion.
     *
     * <p>Aqui entran tambien las tres tablas de valuacion (ADR-0017, D-13): el cuadro de valores
     * unitarios, la depreciacion y la tabla de valores referenciales del MEF son de norma nacional,
     * se cargan una vez para todas y llevan {@code municipalidad_id} nulo (ARQ-09 §2.1). Se
     * siembran <b>una sola vez para las dos municipalidades</b>, que es exactamente lo que la
     * decision afirma: una copia nacional no puede divergir de si misma. Y se siembran como {@code
     * rol_carga_parametros}, porque {@code kamayuk_app} no tiene {@code INSERT} sobre ellas.
     *
     * @return el identificador del parametro de relleno que las tablas de tenant componen
     */
    public static long crearParametroNacional(BaseDeDatosDePrueba base) throws SQLException {
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS)) {
            long id =
                    insertar(
                            carga,
                            "INSERT INTO parametro_tributario"
                                    + " (municipalidad_id, tipo, clave, valor_numerico, vigencia_desde,"
                                    + "  documento_fuente, usuario_carga)"
                                    + " VALUES (NULL, 'PRUEBA', 'valor-de-relleno', 1.000000, ?,"
                                    + "         'fixture de la prueba de aislamiento', 'prueba')"
                                    + " RETURNING id",
                            VIGENCIA);
            sembrarValuacionNacional(carga);
            carga.commit();
            return id;
        }
    }

    /**
     * La cabecera de una edicion nacional y una fila de cada uno de los tres cuadros. La cabecera
     * es un {@code parametro_tributario} mas: es lo que un conjunto municipal compone por {@code
     * conjunto_parametro_detalle} para congelar que edicion uso.
     */
    private static void sembrarValuacionNacional(Connection carga) throws SQLException {
        long edicion =
                insertar(
                        carga,
                        "INSERT INTO parametro_tributario"
                                + " (municipalidad_id, tipo, clave, valor_texto, vigencia_desde,"
                                + "  documento_fuente, usuario_carga, usuario_aprueba)"
                                + " VALUES (NULL, 'PRUEBA_EDICION', 'valuacion', 'edicion de"
                                + " prueba', ?, 'fixture de la prueba de aislamiento', 'prueba',"
                                + " 'otra persona')"
                                + " RETURNING id",
                        VIGENCIA);
        ejecutar(
                carga,
                "INSERT INTO valor_unitario_edificacion (publicacion_id, partida, categoria,"
                        + " anio_construccion_desde, valor_m2, documento_fuente)"
                        + " VALUES (?, 'MUROS', 'C', 2000, 1.000000, 'fixture de la prueba')",
                edicion);
        ejecutar(
                carga,
                "INSERT INTO depreciacion (publicacion_id, uso, material, estado_conservacion,"
                        + " antiguedad_hasta, porcentaje, documento_fuente)"
                        + " VALUES (?, '01', 'CONCRETO', 'BUENO', 10, 1.0000, 'fixture de la"
                        + " prueba')",
                edicion);
        ejecutar(
                carga,
                "INSERT INTO valor_referencial_vehiculo (publicacion_id, ejercicio, categoria,"
                        + " marca, modelo, anio_fabricacion, valor, documento_fuente)"
                        + " VALUES (?, ?, 'A1', 'MARCA', 'MODELO', 2020, 1000.00,"
                        + "         'fixture de la prueba')",
                edicion,
                EJERCICIO);
    }

    /**
     * Siembra todas las tablas de tenant como {@code kamayuk_app} y con el contexto de la
     * municipalidad fijado. Sembrar con el rol de la aplicacion, y no con el owner, verifica de
     * paso que la clausula {@code WITH CHECK} deja pasar lo que debe dejar pasar.
     */
    public static void sembrarTenant(
            BaseDeDatosDePrueba base, long muni, long parametroId, String sufijo)
            throws SQLException {
        try (Connection app = base.conexion(BaseDeDatosDePrueba.APP)) {
            ContextoDeTenant.fijar(app, muni);

            sembrarConjunto(app, muni, parametroId);
            sembrarSeguridad(app, muni, sufijo);
            sembrarDocumento(app, muni, sufijo);

            app.commit();
        }
    }

    private static long sembrarConjunto(Connection app, long muni, long parametroId)
            throws SQLException {
        long conjuntoId =
                insertar(
                        app,
                        "INSERT INTO conjunto_parametros (municipalidad_id, ejercicio, version)"
                                + " VALUES (?, ?, 1) RETURNING id",
                        muni,
                        EJERCICIO);
        ejecutar(
                app,
                "INSERT INTO conjunto_parametro_detalle (municipalidad_id, conjunto_id,"
                        + " parametro_id) VALUES (?, ?, ?)",
                muni,
                conjuntoId,
                parametroId);
        return conjuntoId;
    }

    private static void sembrarSeguridad(Connection app, long muni, String sufijo)
            throws SQLException {
        long moduloId =
                insertar(
                        app,
                        "INSERT INTO modulo_sistema (municipalidad_id, codigo, nombre)"
                                + " VALUES (?, ?, 'Normativa') RETURNING id",
                        muni,
                        "MOD-" + sufijo);
        long accesoId =
                insertar(
                        app,
                        "INSERT INTO acceso (municipalidad_id, modulo_id, tipo, codigo, nombre)"
                                + " VALUES (?, ?, 'OPCION_MENU', ?, 'Parametros') RETURNING id",
                        muni,
                        moduloId,
                        "parametros-" + sufijo);
        long grupoId =
                insertar(
                        app,
                        "INSERT INTO grupo (municipalidad_id, nombre, descripcion)"
                                + " VALUES (?, ?, 'Grupo de prueba') RETURNING id",
                        muni,
                        "Normativa " + sufijo);
        long usuarioId =
                insertar(
                        app,
                        "INSERT INTO usuario (municipalidad_id, cuenta, nombre)"
                                + " VALUES (?, ?, 'Usuario de prueba') RETURNING id",
                        muni,
                        "usuario-" + sufijo);
        ejecutar(
                app,
                "INSERT INTO miembro (municipalidad_id, grupo_id, usuario_id, usuario_alta)"
                        + " VALUES (?, ?, ?, 'prueba')",
                muni,
                grupoId,
                usuarioId);
        ejecutar(
                app,
                "INSERT INTO permiso (municipalidad_id, acceso_id, grupo_id, lectura, registro,"
                        + " usuario_registro) VALUES (?, ?, ?, true, true, 'prueba')",
                muni,
                accesoId,
                grupoId);
        ejecutar(
                app,
                "INSERT INTO sesion (municipalidad_id, usuario_id, origen_equipo, origen_ip,"
                        + " ejercicio_trabajo)"
                        + " VALUES (?, ?, 'PC-PRUEBA', CAST(? AS inet), ?)",
                muni,
                usuarioId,
                "10.0.0.1",
                EJERCICIO);
        ejecutar(
                app,
                "INSERT INTO auditoria (municipalidad_id, ejercicio, tabla, clave, operacion,"
                        + " usuario_id, origen_equipo, origen_ip, observacion)"
                        + " VALUES (?, ?, 'conjunto_parametros', '1', 'ALTA', 'prueba', 'PC-PRUEBA',"
                        + "         CAST(? AS inet), 'alta inicial de la prueba de aislamiento')",
                muni,
                EJERCICIO,
                "10.0.0.1");
    }

    private static void sembrarDocumento(Connection app, long muni, String sufijo)
            throws SQLException {
        ejecutar(
                app,
                "INSERT INTO documento_emitido (municipalidad_id, tipo, numero, ejercicio,"
                        + " referencia, datos, formato, resumen, fecha_emision, usuario_emision,"
                        + " observacion)"
                        + " VALUES (?, 'CONJUNTO_SELLADO', ?, 2026, 'conjunto#1',"
                        + "         CAST(? AS jsonb), 'PDF', repeat('a', 64), ?, 'siembra',"
                        + "         'documento de prueba')",
                muni,
                "CONJUNTO_SELLADO-2026-00000" + (sufijo.equals("A") ? "1" : "2"),
                MODELO_DE_DOCUMENTO,
                VIGENCIA);
    }

    /** Identificador del grupo sembrado en una municipalidad. */
    public static long grupoDe(BaseDeDatosDePrueba base, long municipalidadId) throws SQLException {
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia =
                        admin.prepareStatement(
                                "SELECT id FROM grupo WHERE municipalidad_id = ?"
                                        + " ORDER BY id LIMIT 1")) {
            sentencia.setLong(1, municipalidadId);
            return unicoLong(sentencia);
        }
    }

    private static long insertar(Connection conexion, String sql, Object... valores)
            throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            fijar(sentencia, valores);
            return unicoLong(sentencia);
        }
    }

    private static void ejecutar(Connection conexion, String sql, Object... valores)
            throws SQLException {
        try (PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            fijar(sentencia, valores);
            sentencia.executeUpdate();
        }
    }

    private static void fijar(PreparedStatement sentencia, Object... valores) throws SQLException {
        for (int i = 0; i < valores.length; i++) {
            sentencia.setObject(i + 1, valores[i]);
        }
    }

    private static long unicoLong(PreparedStatement sentencia) throws SQLException {
        try (ResultSet resultado = sentencia.executeQuery()) {
            if (!resultado.next()) {
                throw new IllegalStateException("La sentencia no devolvio ninguna fila");
            }
            return resultado.getLong(1);
        }
    }
}
