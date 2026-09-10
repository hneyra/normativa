package kamayuk.normativa.seguridad.aplicacion;

import java.time.Instant;
import java.util.List;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;

/**
 * A quien se le dice que la copia local de la autorizacion se quedo sin algo que {@code identidad}
 * ya publico.
 *
 * <p>Un hecho que no llega deja la copia diciendo de alguien algo que {@code identidad} ya no dice
 * —un permiso que alli se retiro y aqui sigue, una cuenta que alli se inhabilito y aqui entra—, y
 * ninguna cifra lo delata: por eso se avisa a una persona con nombre y no solo a un registro (la
 * misma doctrina que ADR-0026 §4 fijo para el dinero).
 *
 * <p>Son <b>dos</b> avisos porque son dos cosas distintas y se arreglan en dos sitios: uno se
 * aparta y no va a volver solo; el otro esta esperando algo que puede llegar, y lo que se avisa es
 * que <b>lleva demasiado esperando</b>.
 */
public interface AlertaDeEventosSinAplicar {

    /**
     * Un hecho que no se va a poder aplicar nunca: se aparto, se acuso, y alguien tiene que verlo.
     */
    void hayUnEventoSinAplicar(EventoRecibido evento, String motivo, long apartadosSinExplicar);

    /**
     * Al terminar una corrida quedan hechos pospuestos que llevan demasiado tiempo esperando.
     *
     * <p><b>UNO por corrida, no uno por hecho ni uno por vuelta</b>: lo que hay que atender es la
     * situacion —esta copia lleva un rato sin poder aplicar lo que le llega—, y un aviso por hecho
     * convierte una implantacion a medias en un centenar de correos que nadie lee. El ensayo de
     * AC-5/AC-6 midio lo contrario y peor: <b>cero</b> avisos en dos corridas con un hecho
     * pospuesto (H7).
     *
     * @param pospuestos los que pasan de {@link ConsumirEventosDeIdentidad#EDAD_QUE_SE_AVISA}, en
     *     orden de secuencia
     * @param cuando el instante contra el que se midio su edad
     */
    void hayEventosPospuestosDesdeHaceRato(List<EventoRecibido> pospuestos, Instant cuando);
}
