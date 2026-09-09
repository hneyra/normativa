package kamayuk.normativa.seguridad.aplicacion;

import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;

/**
 * A quien se le dice que un hecho de la autorizacion se aparto sin aplicar.
 *
 * <p>Un hecho apartado deja la copia local diciendo de alguien algo que {@code identidad} ya no
 * dice —un permiso que alli se retiro y aqui sigue, una cuenta que alli se inhabilito y aqui
 * entra—, y ninguna cifra lo delata: por eso se avisa a una persona con nombre y no solo a un
 * registro (la misma doctrina que ADR-0026 §4 fijo para el dinero).
 */
public interface AlertaDeEventosSinAplicar {

    void hayUnEventoSinAplicar(EventoRecibido evento, String motivo, long apartadosSinExplicar);
}
