package kamayuk.normativa.dominio;

import org.jspecify.annotations.Nullable;

/**
 * El «por que» de una escritura, escrito por quien la hace.
 *
 * <p>Regla 10 y ADR-0008. El manual del sistema original lo dice sin rodeos: se registra «una
 * observacion que debe escribir el usuario, de lo contrario no le permite guardar la modificacion».
 * El <i>que cambio</i> lo reconstruye cualquier sistema; el <i>por que</i> solo lo sabe quien lo
 * cambio, en el momento de cambiarlo.
 *
 * <p><b>Por que es un tipo y no un {@code String}.</b> Un parametro {@code String observacion} se
 * cumple pasando {@code ""}, y se cumple asi el dia que corre prisa. Un tipo que no se puede
 * construir vacio convierte la regla en algo que el compilador y el constructor sostienen: quien
 * quiera saltarsela tiene que escribir cinco caracteres a proposito, y eso ya deja rastro.
 *
 * <p>Los limites son los de la base, para que el rechazo ocurra en el dominio y no en un {@code
 * INSERT} a medio camino: al menos 5 caracteres una vez recortada —la restriccion {@code
 * auditoria_observacion_ck}— y como mucho 500, que es el ancho de las columnas {@code observacion
 * NOT NULL} del esquema.
 *
 * <h2>Un nulo es un 422, no un 500 (#59, ADR-0043 §6)</h2>
 *
 * <p>Hasta #59 el nulo se rechazaba con {@code Objects.requireNonNull}, o sea con un {@link
 * NullPointerException}, y el borde solo traduce {@link IllegalArgumentException} a 422: una
 * escritura por HTTP cuyo cuerpo no trajera {@code observacion} —o la trajera {@code null}— salia
 * como <b>500 con incidencia</b>, que le dice al cliente que el servidor se rompio cuando lo que
 * falta es su dato. Se arregla <b>aqui</b>, donde pasan todas las escrituras, y no con una
 * comprobacion en cada controlador que el cuarto olvide: es lo que hizo {@code rentas} en su #30.
 * El constructor canonico se declara entero —y no compacto— para que su parametro pueda ser
 * {@code @Nullable} sin que lo sea el componente: una {@code Observacion} construida nunca lleva
 * nulo.
 */
public record Observacion(String texto) {

    /** {@code CHECK (length(btrim(observacion)) >= 5)} en la tabla de auditoria. */
    private static final int LARGO_MINIMO = 5;

    /** El ancho de {@code observacion varchar(500) NOT NULL} de las tablas de negocio. */
    private static final int LARGO_MAXIMO = 500;

    /**
     * La observacion, recortada.
     *
     * @throws IllegalArgumentException si falta, o si recortada tiene menos de 5 caracteres o mas
     *     de 500; el mensaje nombra la observacion en los tres casos
     */
    public Observacion(@Nullable String texto) {
        if (texto == null) {
            throw new IllegalArgumentException(
                    "Toda escritura exige una observacion que explique el cambio, y no llego"
                            + " ninguna (regla 10, ADR-0008)");
        }
        String recortado = texto.strip();
        if (recortado.length() < LARGO_MINIMO) {
            throw new IllegalArgumentException(
                    "La observacion debe explicar el cambio: al menos "
                            + LARGO_MINIMO
                            + " caracteres, y no espacios en blanco (ADR-0008)");
        }
        if (recortado.length() > LARGO_MAXIMO) {
            throw new IllegalArgumentException(
                    "La observacion excede "
                            + LARGO_MAXIMO
                            + " caracteres, que es lo que admite la columna: "
                            + recortado.length());
        }
        this.texto = recortado;
    }

    public static Observacion de(@Nullable String texto) {
        return new Observacion(texto);
    }

    @Override
    public String toString() {
        return texto;
    }
}
