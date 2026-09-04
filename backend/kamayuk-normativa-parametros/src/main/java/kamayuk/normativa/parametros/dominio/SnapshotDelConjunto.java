package kamayuk.normativa.parametros.dominio;

import java.util.List;
import java.util.Objects;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.reglas.Ambito;
import org.jspecify.annotations.Nullable;

/**
 * Todo lo que un conjunto sellado contiene, en una sola pieza descargable (ADR-0025 §1).
 *
 * <h2>Por que existe</h2>
 *
 * <p>Porque la alternativa natural —una API de consulta por parametro en el camino del calculo,
 * {@code GET /uit?ejercicio=2026}— convierte la emision anual en un problema de disponibilidad: una
 * corrida de trescientos mil predios haria trescientas mil peticiones y el dia que {@code
 * normativa} no este arriba no hay padron. Con esto hace <b>una</b>.
 *
 * <h2>Por que se puede cachear para siempre</h2>
 *
 * <p>Porque lo sellado no cambia: el disparador de {@code V9} vuelve inmutable el conjunto y su
 * contenido en cuanto se sella. No hay invalidacion que disenar, ni ventana de inconsistencia, ni
 * TTL que ajustar. La cache se indexa por <b>contenido</b> —el {@code conjuntoId} y su huella— y no
 * por tiempo.
 *
 * <h2>Los ambitos, y que es lo unico que NO cambia entre ellos</h2>
 *
 * <p>{@code catastro} solo necesita los dos cuadros de valuacion; {@code rentas} necesita ademas
 * los parametros y la tabla de valores referenciales. Por eso el snapshot se puede pedir por {@link
 * Ambito}, y por eso <b>su huella depende del ambito</b>: son bytes distintos. Lo que <b>no</b>
 * cambia es la identidad —{@code conjuntoId}, ejercicio y version—, que es lo que las dos corridas
 * comparan para saber que calcularon con el mismo juego de valores (ADR-0025 §Consecuencias).
 *
 * <p>Los parametros van en <b>los dos</b> ambitos y no solo en {@code OBLIGACION}: son treinta y
 * tres filas, y una valuacion que necesitara el {@code % actualizacion} (D-11) tendria que pedir
 * otro snapshot para una cifra. Lo que se reparte por ambito son los cuadros, que es donde estan
 * las decenas de miles de filas.
 *
 * @param conjuntoId el identificador que le dio {@code normativa}; es lo que una determinacion
 *     guarda para poder repetirse (ADR-0007, ADR-0025 §3)
 * @param ambito para que mitad de la frontera de ADR-0024 se compuso
 */
public record SnapshotDelConjunto(
        long conjuntoId,
        Ejercicio ejercicio,
        int version,
        Ambito ambito,
        List<ParametroDelSnapshot> parametros,
        List<ValorUnitarioDelSnapshot> valoresUnitarios,
        List<DepreciacionDelSnapshot> depreciaciones,
        List<ValorReferencialDelSnapshot> valoresReferenciales) {

    public SnapshotDelConjunto {
        Objects.requireNonNull(ejercicio, "El snapshot lleva el ejercicio de su conjunto");
        Objects.requireNonNull(ambito, "El snapshot lleva el ambito con que se compuso");
        parametros = List.copyOf(parametros);
        valoresUnitarios = List.copyOf(valoresUnitarios);
        depreciaciones = List.copyOf(depreciaciones);
        valoresReferenciales = List.copyOf(valoresReferenciales);
        if (conjuntoId < 1) {
            throw new IllegalArgumentException(
                    "El snapshot es de un conjunto concreto: " + conjuntoId);
        }
        if (version < 1) {
            throw new IllegalArgumentException("La version empieza en 1: " + version);
        }
    }

    /**
     * Cuantas filas lleva en total. Es lo que se registra al descargarlo, no una cifra de dinero.
     */
    public int filas() {
        return parametros.size()
                + valoresUnitarios.size()
                + depreciaciones.size()
                + valoresReferenciales.size();
    }

    /**
     * Una fila de {@code parametro_tributario} tal como el conjunto la compuso.
     *
     * <p>Lleva la <b>vigencia</b>, y no el valor ya resuelto, porque un conjunto sellado contiene a
     * proposito el historico de una llave —{@code parametros-2026.csv} publica cinco filas de
     * {@code UIT}— y quien resuelve cual rige es el lector, contra el ejercicio del conjunto
     * (#659). Entregar aqui «la que rige» seria mover esa decision al servidor y hacerla invisible.
     */
    public record ParametroDelSnapshot(
            String tipo,
            @Nullable String clave,
            @Nullable String valorNumerico,
            @Nullable String valorTexto,
            @Nullable String vigenciaDesde,
            @Nullable String vigenciaHasta,
            String documentoFuente) {}

    /** Una celda del cuadro de valores unitarios de edificacion (ADR-0017). */
    public record ValorUnitarioDelSnapshot(
            String partida,
            String categoria,
            int anioConstruccionDesde,
            @Nullable Integer anioConstruccionHasta,
            String valorM2,
            String documentoFuente) {}

    /**
     * Una fila del cuadro de depreciacion (ADR-0017, #188 H-15).
     *
     * <p>{@code antiguedadHasta} es nulo en el tramo abierto —«mas de 50 anios»—, y va como {@code
     * Integer} y no como {@code int} justamente por eso: leer ese nulo como cero convierte el tramo
     * abierto en uno que no cubre nada, sin ningun error de por medio.
     */
    public record DepreciacionDelSnapshot(
            String uso,
            String material,
            String estadoConservacion,
            @Nullable Integer antiguedadHasta,
            String porcentaje,
            String documentoFuente) {}

    /** Una fila del anexo de valores referenciales de vehiculos del MEF (ADR-0017). */
    public record ValorReferencialDelSnapshot(
            int ejercicio,
            String categoria,
            String marca,
            String modelo,
            int anioFabricacion,
            String valor,
            String documentoFuente) {}
}
