package kamayuk.normativa.parametros.dominio;

import org.jspecify.annotations.Nullable;

/**
 * La {@code Idempotency-Key} con la que se pide abrir un conjunto por HTTP (ADR-0043 §5).
 *
 * <h2>Por que {@code POST /conjuntos} la exige, y las otras dos escrituras no</h2>
 *
 * <p>Abrir es la unica escritura del conjunto que <b>no es idempotente por su estado</b>: cada
 * llamada abre la version {@code max + 1}. Un reintento sin clave —la red se corto entre el {@code
 * COMMIT} y la respuesta— deja una version {@code ABIERTA} de mas que la aplicacion no puede borrar
 * (no tiene {@code DELETE} sobre {@code conjunto_parametros}, regla 4) y que corre la numeracion
 * del ejercicio. Agregar ya es idempotente por su estado —un parametro esta en el conjunto o no— y
 * sellar dos veces es un 409, no un exito: ninguna de las dos la lee.
 *
 * <p>Es <b>obligatoria</b>, y no opcional como en {@code rentas}: alli la hizo opcional tener
 * clientes anteriores a ella, y esta ruta no tiene ninguno (ADR-0043 §5 y «Lo descartado»).
 *
 * <h2>La forma: de 1 a 64 caracteres ASCII visibles, sin normalizar</h2>
 *
 * <p>De {@code !} a {@code ~}: ni espacios, ni tabuladores, ni nada fuera de ASCII. Se compara
 * <b>byte a byte</b> y no se recorta ni se pasa a minusculas: dos claves que se parecen son dos
 * claves, y normalizar haria que dos peticiones distintas se tomaran por un reintento. Con solo
 * ASCII visible, un caracter de Java es un byte, y el largo en caracteres es el largo en bytes que
 * cabe en {@code varchar(64)} (V3).
 *
 * <p>El ambito es la municipalidad —el indice {@code conjunto_idempotencia_uq} lleva {@code
 * municipalidad_id} delante—, y no lo decide este tipo: lo decide la base.
 *
 * @param valor la clave tal como llego en la cabecera
 */
public record ClaveDeIdempotencia(String valor) {

    /** El nombre de la cabecera HTTP que la trae. */
    public static final String CABECERA = "Idempotency-Key";

    /** El ancho de {@code conjunto_parametros.clave_idempotencia varchar(64)} (V3). */
    private static final int LARGO_MAXIMO = 64;

    private static final char PRIMER_VISIBLE = '!';
    private static final char ULTIMO_VISIBLE = '~';

    /**
     * Valida la forma y rechaza, nombrando la cabecera, todo lo que no la cumpla.
     *
     * <p>El parametro admite nulo a proposito: es lo que llega de una cabecera ausente, y el
     * rechazo tiene que ser un {@link IllegalArgumentException} —un 422 que nombra la cabecera— y
     * no un {@link NullPointerException} que el borde convertiria en un 500 (ADR-0043 §7).
     *
     * @throws IllegalArgumentException si falta, esta vacia, pasa de 64 caracteres o lleva alguno
     *     fuera de {@code !}..{@code ~}
     */
    public ClaveDeIdempotencia(@Nullable String valor) {
        if (valor == null || valor.isEmpty()) {
            throw new IllegalArgumentException(
                    "Abrir un conjunto exige la cabecera '"
                            + CABECERA
                            + "', con una clave que identifique esta peticion: sin ella un"
                            + " reintento abriria otra version que no se puede borrar (ADR-0043"
                            + " §5)");
        }
        if (valor.length() > LARGO_MAXIMO) {
            throw new IllegalArgumentException(
                    "La cabecera '"
                            + CABECERA
                            + "' admite hasta "
                            + LARGO_MAXIMO
                            + " caracteres, y llegaron "
                            + valor.length());
        }
        for (int i = 0; i < valor.length(); i++) {
            char caracter = valor.charAt(i);
            if (caracter < PRIMER_VISIBLE || caracter > ULTIMO_VISIBLE) {
                throw new IllegalArgumentException(
                        "La cabecera '"
                                + CABECERA
                                + "' solo admite caracteres ASCII visibles, de '"
                                + PRIMER_VISIBLE
                                + "' a '"
                                + ULTIMO_VISIBLE
                                + "' —sin espacios—, y el de la posicion "
                                + (i + 1)
                                + " no lo es. Se compara byte a byte y no se normaliza");
            }
        }
        this.valor = valor;
    }

    @Override
    public String toString() {
        return valor;
    }
}
