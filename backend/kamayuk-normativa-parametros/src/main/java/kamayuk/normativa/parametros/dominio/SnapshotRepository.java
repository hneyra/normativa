package kamayuk.normativa.parametros.dominio;

import java.util.List;

/**
 * Lo que hace falta leer para componer un snapshot, y nada mas.
 *
 * <p>Va aparte de {@link ParametrosRepository} porque las tres consultas de aqui devuelven
 * <b>cuadros enteros</b> —hasta 54 000 filas del anexo vehicular— y no filas sueltas. Mezclarlas
 * con las del conjunto invitaria a usarlas para resolver una celda, que es exactamente el camino
 * que ADR-0025 §1 cierra.
 *
 * <p>Las tres llevan el mismo {@code JOIN} con {@code conjunto_parametro_detalle}, y no es adorno:
 * desde {@code V55} los tres cuadros son <b>nacionales</b> y no tienen {@code conjunto_id}; lo que
 * un conjunto sella es <b>que edicion</b> uso, y eso lo dice esa tabla. El {@code JOIN} es ademas
 * lo que mantiene el aislamiento sin escribirlo: {@code conjunto_parametro_detalle} es tabla de
 * tenant y su politica RLS acota la consulta a la municipalidad del contexto, de modo que preguntar
 * por el conjunto de otra municipalidad no devuelve nada en vez de devolver su cuadro.
 */
public interface SnapshotRepository {

    List<SnapshotDelConjunto.ValorUnitarioDelSnapshot> valoresUnitariosDe(long conjuntoId);

    List<SnapshotDelConjunto.DepreciacionDelSnapshot> depreciacionesDe(long conjuntoId);

    List<SnapshotDelConjunto.ValorReferencialDelSnapshot> valoresReferencialesDe(long conjuntoId);
}
