package kamayuk.normativa.parametros.aplicacion;

import java.util.Objects;
import kamayuk.normativa.parametros.dominio.ParametroTributario;

/**
 * Lo que contesta agregar un parametro a un conjunto: cual es, y si ya estaba dentro (ADR-0043 §5).
 *
 * <p>Agregar es idempotente <b>por su estado</b> —un parametro esta en el conjunto o no—, asi que
 * repetirlo no es un error: por HTTP contesta el mismo 201 con la misma fila. Lo que distingue
 * {@link #yaEstaba()} es lo que <b>no</b> se ve por HTTP y si importa a otros: que esta vez no se
 * escribio nada ni se audito, y que el informe del proceso batch sigue pudiendo decir «ya estaba en
 * este conjunto» de una fila repetida en su archivo.
 *
 * @param parametro el parametro publicado que responde a la llave
 * @param yaEstaba si ya estaba en el conjunto y por eso no se escribio ni se audito nada
 */
public record ParametroIncorporado(ParametroTributario parametro, boolean yaEstaba) {

    public ParametroIncorporado {
        Objects.requireNonNull(parametro, "Lo incorporado es un parametro concreto");
    }

    static ParametroIncorporado nuevo(ParametroTributario parametro) {
        return new ParametroIncorporado(parametro, false);
    }

    static ParametroIncorporado queYaEstaba(ParametroTributario parametro) {
        return new ParametroIncorporado(parametro, true);
    }
}
