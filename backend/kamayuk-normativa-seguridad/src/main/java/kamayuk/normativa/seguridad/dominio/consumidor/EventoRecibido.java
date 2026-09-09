package kamayuk.normativa.seguridad.dominio.consumidor;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Un hecho del buzon de {@code identidad}, tal como llego.
 *
 * <p>El tipo se guarda <b>como lo escribio el emisor</b> ({@link #tipoPublicado()}) y se traduce al
 * pedirlo ({@link #tipo()}): un nombre que este sistema no conoce no se rechaza al leer el lote
 * —eso se llevaria por delante la pagina entera, que es lo que {@code rentas}#54 midio— sino hecho
 * a hecho, en el aplicador, que es quien decide que se hace con el.
 *
 * @param eventoId lo que se acusa y por lo que se deduplica
 * @param secuencia el orden de entrega en el buzon del emisor
 * @param tipoPublicado el nombre del tipo, tal cual llego
 * @param sujetoId el identificador del sujeto EN LA BASE DE {@code identidad}: no coincide con los
 *     de aqui, y por eso el cuerpo lleva las claves naturales (cuenta, nombre del grupo, codigo)
 * @param cuerpo la fila entera del sujeto, como TEXTO con JSON dentro. Se guarda tal cual: si no es
 *     JSON, es exactamente lo que hay que conservar al apartarlo
 * @param huella el sha256 que el emisor calculo sobre el cuerpo
 * @param creadoEn cuando lo escribio el emisor
 */
public record EventoRecibido(
        UUID eventoId,
        long secuencia,
        String tipoPublicado,
        long sujetoId,
        String cuerpo,
        String huella,
        Instant creadoEn) {

    public EventoRecibido {
        Objects.requireNonNull(eventoId, "un hecho sin identificador no se puede acusar");
        Objects.requireNonNull(tipoPublicado, "el tipo se guarda tal como llego, aunque sea vacio");
        Objects.requireNonNull(cuerpo, "el cuerpo se guarda tal como llego, aunque sea vacio");
        Objects.requireNonNull(huella, "la huella se guarda tal como llego");
        Objects.requireNonNull(creadoEn, "un hecho tiene fecha");
    }

    /** El tipo que este sistema conoce, o {@code null} si no lo conoce. */
    public @Nullable TipoDeEventoDeIdentidad tipo() {
        return TipoDeEventoDeIdentidad.deNombre(tipoPublicado);
    }
}
