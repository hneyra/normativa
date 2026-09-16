package kamayuk.normativa.seguridad.infraestructura;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.persistencia.OrdenSeguro;
import kamayuk.normativa.persistencia.RepositorioJdbc;
import kamayuk.normativa.seguridad.dominio.AccesoDelSistema;
import kamayuk.normativa.seguridad.dominio.Identidad;
import kamayuk.normativa.seguridad.dominio.LecturaDeLaCopiaLocal;
import kamayuk.normativa.seguridad.dominio.ModuloDelSistema;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * La lectura de la copia local de la autorizacion para la interfaz (#54).
 *
 * <p>Ni un {@code INSERT} ni un {@code UPDATE}: la copia la escribe {@code
 * AplicarUnEventoDeIdentidad} y el catalogo {@code SembradorDelCatalogo}, y la regla 12 vigila que
 * no aparezca un tercero. Sin {@code WHERE municipalidad_id}: lo pone RLS con el {@code SET LOCAL}
 * de la transaccion (regla 2).
 *
 * <h2>Sin {@code @Transactional}, y eso obliga a quien llama</h2>
 *
 * <p>Las tablas que lee llevan RLS con {@code FORCE} y sus politicas leen {@code
 * app.municipalidad_id}, que {@code TenantTransactionManager} fija <b>al abrir la transaccion</b>.
 * Como todo repositorio de este sistema, este no la abre: la abren {@code ConsultaDelCatalogo} y
 * {@code LecturasDeLaSesion}, que es la capa que Spring proxifica. Leer desde un controlador sin
 * pasar por ellas no devolveria vacio: contestaria 500 con «invalid input syntax for type bigint:
 * ""», que es exactamente lo que {@code rentas} pago en la etapa 4 de ADR-0039.
 *
 * <h2>La matriz y el guardia dicen lo mismo</h2>
 *
 * <p>{@link #permisosEfectivosDe} conserva la precedencia de {@link ComprobadorDeAccesoJdbc}: la
 * excepcion del usuario sustituye al grupo entero para ese acceso, la vigencia se mira en el
 * usuario y en el grupo, y <b>las dos ramas miran {@code a.activo}</b>. Si se separaran, el menu
 * ofreceria una pantalla y el guardia la negaria, y ese 403 no se parece a su causa. Lo ata {@code
 * LaMatrizYElGuardiaDicenLoMismoTest}, que recorre toda la matriz de prueba (AC-4).
 *
 * <p><b>La diferencia que {@code rentas} y {@code catastro} dejaron abierta, aqui esta cerrada.</b>
 * En los dos, la rama de la excepcion del guardia <b>no</b> filtra {@code a.activo} y la matriz si,
 * asi que sobre una opcion retirada con una excepcion que otorga el guardia deja pasar y el menu no
 * la ofrece. Se cerro en {@link ComprobadorDeAccesoJdbc} y no aqui —quitar el filtro de la matriz
 * dibujaria lo retirado— porque el sentido que no abre nada es el estricto: retirar una opcion
 * tiene que cerrar la puerta, no dejarla entreabierta para quien tenga una excepcion.
 */
@Repository
public class LecturaDeLaCopiaLocalJdbc extends RepositorioJdbc implements LecturaDeLaCopiaLocal {

    /** La misma lista blanca que {@code rentas}: el dialecto de paginacion es uno solo. */
    private static final OrdenSeguro ORDEN_MODULO =
            OrdenSeguro.sobre("codigo", "nombre", "orden", "id").desempatandoPor("id");

    private static final OrdenSeguro ORDEN_ACCESO =
            OrdenSeguro.sobre("codigo", "nombre", "tipo", "id").desempatandoPor("id");

    public LecturaDeLaCopiaLocalJdbc(JdbcClient jdbc) {
        super(jdbc);
    }

    @Override
    public Pagina<ModuloDelSistema> modulos(Paginacion paginacion) {
        return paginar(
                "SELECT id, codigo, nombre, orden, activo FROM modulo_sistema",
                "SELECT count(*) FROM modulo_sistema",
                Map.of(),
                paginacion,
                ORDEN_MODULO,
                LecturaDeLaCopiaLocalJdbc::mapearModulo);
    }

    @Override
    public Pagina<AccesoDelSistema> accesos(Paginacion paginacion) {
        return paginar(
                "SELECT id, modulo_id, tipo, codigo, nombre, activo FROM acceso",
                "SELECT count(*) FROM acceso",
                Map.of(),
                paginacion,
                ORDEN_ACCESO,
                LecturaDeLaCopiaLocalJdbc::mapearAcceso);
    }

    /**
     * La fila del usuario y el ejercicio de su sesion abierta, en <b>una</b> consulta.
     *
     * <p>Una y no dos por lo que dice {@code Identidad}: afirma que ese ejercicio es el de
     * <b>esa</b> sesion. La subconsulta toma la sesion abierta mas reciente, que es la que {@code
     * rentas} lee. <b>En este sistema devuelve siempre nulo</b>, porque nada escribe {@code
     * sesion}; la subconsulta se conserva igual para que el dia que algo la escriba no haya que
     * acordarse de esto.
     */
    @Override
    public Optional<Identidad> identidadDe(String cuenta) {
        return jdbc().sql(
                        "SELECT u.id, u.cuenta, u.nombre,"
                                + " (SELECT s.ejercicio_trabajo FROM sesion s"
                                + "   WHERE s.usuario_id = u.id AND s.fin IS NULL"
                                + "   ORDER BY s.inicio DESC LIMIT 1) AS ejercicio_trabajo"
                                + " FROM usuario u WHERE u.cuenta = :cuenta")
                .param("cuenta", cuenta)
                .query(LecturaDeLaCopiaLocalJdbc::mapearIdentidad)
                .optional();
    }

    /**
     * La matriz efectiva, en <b>una</b> consulta: por cada acceso activo, la fila de la excepcion
     * del usuario si existe, y si no la union de sus grupos habilitados y vigentes.
     */
    @Override
    public Map<String, Set<Privilegio>> permisosEfectivosDe(String cuenta, LocalDate fecha) {
        // Las siete columnas salen del enumerado y no se escriben a mano: `Privilegio` lleva el
        // nombre de su columna precisamente para que agregar un privilegio obligue a decir donde se
        // guarda, y una lista escrita aqui se quedaria con seis sin que nada lo dijera.
        StringBuilder efectivas = new StringBuilder();
        StringBuilder propias = new StringBuilder();
        StringBuilder uniones = new StringBuilder();
        for (Privilegio privilegio : Privilegio.values()) {
            String columna = privilegio.columna();
            efectivas.append(", ").append(columnaEfectiva(columna));
            propias.append(", p.").append(columna);
            uniones.append(uniones.isEmpty() ? "" : ", ")
                    .append("bool_or(p.")
                    .append(columna)
                    .append(") AS ")
                    .append(columna);
        }

        String sql =
                "SELECT a.codigo"
                        + efectivas
                        + " FROM acceso a"
                        // 1. La excepcion del usuario, si la hay: decide, otorgue o niegue.
                        + " LEFT JOIN LATERAL ("
                        + "   SELECT p.acceso_id"
                        + propias
                        + "     FROM permiso p JOIN usuario u ON u.id = p.usuario_id"
                        + "    WHERE p.acceso_id = a.id AND u.cuenta = :cuenta"
                        + " ) ux ON true"
                        // 2. Si no la hay: la union de los grupos habilitados y vigentes.
                        + " LEFT JOIN LATERAL ("
                        + "   SELECT "
                        + uniones
                        + "     FROM permiso p"
                        + "     JOIN grupo g ON g.id = p.grupo_id AND g.habilitado"
                        + "                 AND (g.vigencia_desde IS NULL OR g.vigencia_desde <= :fecha)"
                        + "                 AND (g.vigencia_hasta IS NULL OR g.vigencia_hasta >= :fecha)"
                        + "     JOIN miembro m ON m.grupo_id = g.id AND m.activo"
                        + "     JOIN usuario u ON u.id = m.usuario_id AND u.cuenta = :cuenta"
                        + "    WHERE p.acceso_id = a.id"
                        + " ) gx ON true"
                        + " WHERE a.activo"
                        // 3. Y por encima de todo: el usuario habilitado y vigente.
                        + "   AND EXISTS (SELECT 1 FROM usuario u"
                        + "                WHERE u.cuenta = :cuenta AND u.habilitado"
                        + "                  AND (u.vigencia_desde IS NULL OR u.vigencia_desde <= :fecha)"
                        + "                  AND (u.vigencia_hasta IS NULL OR u.vigencia_hasta >= :fecha))"
                        // Por codigo, para que la matriz salga siempre en el mismo orden: la
                        // interfaz no lo necesita, pero una captura que cambia de orden entre dos
                        // corridas sin que cambie nada es un diff que alguien acaba aceptando.
                        + " ORDER BY a.codigo";

        Map<String, Set<Privilegio>> matriz = new LinkedHashMap<>();
        RowCallbackHandler porFila =
                fila -> {
                    Set<Privilegio> otorgados = EnumSet.noneOf(Privilegio.class);
                    for (Privilegio privilegio : Privilegio.values()) {
                        if (fila.getBoolean(privilegio.columna())) {
                            otorgados.add(privilegio);
                        }
                    }
                    if (!otorgados.isEmpty()) {
                        matriz.put(fila.getString("codigo"), otorgados);
                    }
                };
        jdbc().sql(sql).param("cuenta", cuenta).param("fecha", fecha).query(porFila);
        return matriz;
    }

    private static String columnaEfectiva(String columna) {
        return "CASE WHEN ux.acceso_id IS NOT NULL THEN ux."
                + columna
                + " ELSE COALESCE(gx."
                + columna
                + ", false) END AS "
                + columna;
    }

    private static ModuloDelSistema mapearModulo(ResultSet fila, int numero) throws SQLException {
        return new ModuloDelSistema(
                fila.getLong("id"),
                fila.getString("codigo"),
                fila.getString("nombre"),
                fila.getInt("orden"),
                fila.getBoolean("activo"));
    }

    private static AccesoDelSistema mapearAcceso(ResultSet fila, int numero) throws SQLException {
        return new AccesoDelSistema(
                fila.getLong("id"),
                fila.getLong("modulo_id"),
                fila.getString("tipo"),
                fila.getString("codigo"),
                fila.getString("nombre"),
                fila.getBoolean("activo"));
    }

    /**
     * El ejercicio se lee como {@code Integer} y no con {@code getInt} + {@code wasNull}: {@code
     * wasNull} habla de la ULTIMA columna leida, y entre las dos cabe la lectura del nombre. Asi
     * fue como la primera version de {@code catastro} devolvia un ejercicio 0 —«fuera de rango»— a
     * quien no tenia sesion, que aqui seria <b>todo el mundo</b>.
     */
    private static Identidad mapearIdentidad(ResultSet fila, int numero) throws SQLException {
        Integer ejercicio = fila.getObject("ejercicio_trabajo", Integer.class);
        return new Identidad(
                fila.getLong("id"),
                fila.getString("cuenta"),
                fila.getString("nombre"),
                ejercicio == null ? null : new Ejercicio(ejercicio));
    }
}
