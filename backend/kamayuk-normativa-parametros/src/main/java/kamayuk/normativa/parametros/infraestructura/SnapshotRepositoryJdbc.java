package kamayuk.normativa.parametros.infraestructura;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto.DepreciacionDelSnapshot;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto.ValorReferencialDelSnapshot;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto.ValorUnitarioDelSnapshot;
import kamayuk.normativa.parametros.dominio.SnapshotRepository;
import kamayuk.normativa.persistencia.RepositorioJdbc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Los tres cuadros de un conjunto sellado, enteros y en un orden fijo.
 *
 * <h2>El orden es parte del contrato, no una comodidad</h2>
 *
 * <p>La huella del snapshot se calcula sobre los bytes que se sirven, asi que dos respuestas del
 * mismo conjunto tienen que traer las mismas filas <b>en el mismo orden</b> o el {@code ETag}
 * cambiaria sin que cambiara el conjunto — que es el defecto que ADR-0025 §Consecuencias manda
 * probar. Un {@code SELECT} sin {@code ORDER BY} devuelve las filas en el orden del monton, que
 * cambia con un {@code VACUUM}.
 *
 * <p>Y los tres {@code ORDER BY} son <b>totales</b>: la clave unica de cada cuadro entera. Ordenar
 * por una columna con empates dejaria el orden decidido por el plan, que es «determinista por
 * accidente» y deja de serlo al cambiar el tamano de la tabla (#548).
 */
@Repository
public class SnapshotRepositoryJdbc extends RepositorioJdbc implements SnapshotRepository {

    public SnapshotRepositoryJdbc(JdbcClient jdbc) {
        super(jdbc);
    }

    @Override
    public List<ValorUnitarioDelSnapshot> valoresUnitariosDe(long conjuntoId) {
        return jdbc().sql(
                        """
                        SELECT v.partida, v.categoria, v.anio_construccion_desde,
                               v.anio_construccion_hasta, v.valor_m2, v.documento_fuente
                          FROM valor_unitario_edificacion v
                          JOIN conjunto_parametro_detalle d
                            ON d.parametro_id = v.publicacion_id
                         WHERE d.conjunto_id = :conjunto
                         ORDER BY v.partida, v.categoria, v.anio_construccion_desde
                        """)
                .param("conjunto", conjuntoId)
                .query(SnapshotRepositoryJdbc::mapearValorUnitario)
                .list();
    }

    private static ValorUnitarioDelSnapshot mapearValorUnitario(ResultSet fila, int numero)
            throws SQLException {
        Object hasta = fila.getObject("anio_construccion_hasta");
        return new ValorUnitarioDelSnapshot(
                fila.getString("partida"),
                fila.getString("categoria"),
                fila.getInt("anio_construccion_desde"),
                hasta == null ? null : ((Number) hasta).intValue(),
                fila.getBigDecimal("valor_m2").toPlainString(),
                fila.getString("documento_fuente"));
    }

    @Override
    public List<DepreciacionDelSnapshot> depreciacionesDe(long conjuntoId) {
        return jdbc().sql(
                        """
                        SELECT p.uso, p.material, p.estado_conservacion, p.antiguedad_hasta,
                               p.porcentaje, p.documento_fuente
                          FROM depreciacion p
                          JOIN conjunto_parametro_detalle d
                            ON d.parametro_id = p.publicacion_id
                         WHERE d.conjunto_id = :conjunto
                         ORDER BY p.uso, p.material, p.estado_conservacion,
                                  p.antiguedad_hasta NULLS LAST
                        """)
                .param("conjunto", conjuntoId)
                .query(SnapshotRepositoryJdbc::mapearDepreciacion)
                .list();
    }

    private static DepreciacionDelSnapshot mapearDepreciacion(ResultSet fila, int numero)
            throws SQLException {
        // getInt sobre un nulo devuelve 0, y aqui el nulo es «mas de 50 anios»: leerlo como cero
        // convertiria el tramo abierto en uno que no cubre nada, sin ningun error de por medio.
        Object tope = fila.getObject("antiguedad_hasta");
        return new DepreciacionDelSnapshot(
                fila.getString("uso"),
                fila.getString("material"),
                fila.getString("estado_conservacion"),
                tope == null ? null : ((Number) tope).intValue(),
                fila.getBigDecimal("porcentaje").toPlainString(),
                fila.getString("documento_fuente"));
    }

    @Override
    public List<ValorReferencialDelSnapshot> valoresReferencialesDe(long conjuntoId) {
        return jdbc().sql(
                        """
                        SELECT v.ejercicio, v.categoria, v.marca, v.modelo, v.anio_fabricacion,
                               v.valor, v.documento_fuente
                          FROM valor_referencial_vehiculo v
                          JOIN conjunto_parametro_detalle d
                            ON d.parametro_id = v.publicacion_id
                         WHERE d.conjunto_id = :conjunto
                         ORDER BY v.categoria, v.marca, v.modelo, v.anio_fabricacion
                        """)
                .param("conjunto", conjuntoId)
                .query(SnapshotRepositoryJdbc::mapearValorReferencial)
                .list();
    }

    private static ValorReferencialDelSnapshot mapearValorReferencial(ResultSet fila, int numero)
            throws SQLException {
        return new ValorReferencialDelSnapshot(
                fila.getInt("ejercicio"),
                fila.getString("categoria"),
                fila.getString("marca"),
                fila.getString("modelo"),
                fila.getInt("anio_fabricacion"),
                fila.getBigDecimal("valor").toPlainString(),
                fila.getString("documento_fuente"));
    }
}
