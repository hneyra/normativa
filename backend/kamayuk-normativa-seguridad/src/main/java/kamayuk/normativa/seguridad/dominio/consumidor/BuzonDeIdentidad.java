package kamayuk.normativa.seguridad.dominio.consumidor;

import java.util.List;
import java.util.UUID;

/**
 * De donde salen los hechos de la autorizacion y a donde vuelve el acuse (ADR-0039, etapa 4).
 *
 * <p>Es la PRIMERA arista de este sistema hacia otro, y merece decirse con todas las letras porque
 * ADR-0025 afirma que {@code normativa} «no llama a ningun otro sistema». Sigue siendo cierto para
 * lo que ADR-0025 gobierna —ninguna cifra que este sistema sella depende de nadie—; lo que esta
 * arista trae no es un dato de negocio sino <b>la copia local de la autorizacion</b>, que ADR-0039
 * §«Lo que cuesta» decide que se replica por el buzon y no se pregunta por HTTP en cada peticion.
 * El guardia sigue leyendo su propia tabla: con {@code identidad} caido, este sistema autoriza
 * igual, y lo unico que deja de pasar es que un permiso nuevo llegue.
 *
 * <h2>Todo fallo de aqui es TRANSITORIO</h2>
 *
 * <p>Lo unico que este puerto lanza es {@link IdentidadNoContesta}, y lo lanza para todo: la red,
 * un cuerpo que no es JSON, un 500, y tambien un <b>401 o un 403</b>. Los dos ultimos no hablan del
 * hecho sino de quien llama —la cuenta de servicio no existe, la clave no vale, el acceso {@code
 * eventos} no esta concedido— y se arreglan en el despliegue: matar un hecho por eso seria matarlo
 * por un motivo que iba a arreglarse solo (la leccion de {@code caja}#21 AC-3).
 */
public interface BuzonDeIdentidad {

    /** Los hechos que este sistema no ha acusado todavia, en orden de secuencia. */
    Lote pendientes(int limite);

    /**
     * Retira del buzon lo que YA ESTA aplicado o apartado aqui.
     *
     * <p>Solo despues del {@code COMMIT}: lo acusado no se vuelve a servir, asi que acusar antes de
     * confirmar convierte un fallo del commit en un hecho perdido para siempre.
     */
    void acusar(List<UUID> eventoIds);

    /** Una pagina del buzon, con cuantos quedan detras. */
    record Lote(List<EventoRecibido> eventos, long quedan) {}

    /** El buzon no contesta, o contesta algo que no se puede leer. Se reintenta en otra vuelta. */
    final class IdentidadNoContesta extends RuntimeException {
        @java.io.Serial private static final long serialVersionUID = 1L;

        public IdentidadNoContesta(String mensaje) {
            super(mensaje);
        }

        public IdentidadNoContesta(String mensaje, Throwable causa) {
            super(mensaje, causa);
        }
    }
}
