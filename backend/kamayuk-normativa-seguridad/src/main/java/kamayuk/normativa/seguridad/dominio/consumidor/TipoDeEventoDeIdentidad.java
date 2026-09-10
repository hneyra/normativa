package kamayuk.normativa.seguridad.dominio.consumidor;

import java.util.Locale;
import org.jspecify.annotations.Nullable;

/**
 * Los siete hechos que {@code identidad} publica en su buzon (etapa 2 de ADR-0039, su {@code V2}),
 * y que este sistema sabe aplicar a su copia local.
 *
 * <p><b>Es una copia del enumerado del emisor, y se dice.</b> El contrato entre los dos es el
 * archivo {@code docs/50-api/contratos-que-consume/identidad.json} que este repositorio publica y
 * el CI de {@code identidad} comprueba; lo que aqui se enumera es que hace este lado con cada tipo.
 * Un octavo tipo que llegue con un nombre que no esta aqui <b>no es una capacidad que falte</b>,
 * como lo era en {@code rentas}#54 con los hechos del territorio: los siete son la autorizacion
 * entera —quien es, en que grupo esta y que puede hacer—, asi que un hecho de un tipo desconocido
 * es un hecho que este sistema no puede aplicar NUNCA hasta que se despliegue una version que lo
 * conozca. Se aparta con su motivo y se avisa, en vez de dejarlo en el buzon bloqueando la cola
 * detras de el.
 *
 * <p>Es dominio: sin Spring, sin base de datos y sin reloj (regla 7).
 */
public enum TipoDeEventoDeIdentidad {
    USUARIO_DADO_DE_ALTA,
    USUARIO_MODIFICADO,
    GRUPO_DADO_DE_ALTA,
    GRUPO_MODIFICADO,
    MIEMBRO_AFILIADO,
    MIEMBRO_DESAFILIADO,
    PERMISO_FIJADO;

    /** El tipo con ese nombre, o {@code null} si este sistema no lo conoce. */
    public static @Nullable TipoDeEventoDeIdentidad deNombre(@Nullable String nombre) {
        if (nombre == null || nombre.isBlank()) {
            return null;
        }
        String buscado = nombre.strip().toUpperCase(Locale.ROOT);
        for (TipoDeEventoDeIdentidad tipo : values()) {
            if (tipo.name().equals(buscado)) {
                return tipo;
            }
        }
        return null;
    }
}
