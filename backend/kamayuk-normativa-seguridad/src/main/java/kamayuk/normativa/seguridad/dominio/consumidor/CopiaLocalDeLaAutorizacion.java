package kamayuk.normativa.seguridad.dominio.consumidor;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/**
 * La copia local de la autorizacion —{@code usuario}, {@code grupo}, {@code miembro}, {@code
 * permiso}— vista desde el consumidor del buzon: donde se aplica un hecho, y donde se aparta el que
 * no se puede aplicar nunca.
 *
 * <h2>Tres desenlaces, y no se confunden porque se arreglan en tres sitios</h2>
 *
 * <ul>
 *   <li><b>Se aplica</b> ({@link Aplicacion#APLICADO}), o ya estaba ({@link
 *       Aplicacion#YA_APLICADO}: la entrega es al menos una vez y aqui se deduplica), o se ignora
 *       porque habla de otro sistema ({@link Aplicacion#IGNORADO_POR_AJENO}: un permiso sobre una
 *       opcion de {@code rentas} no es de esta copia). Los tres se acusan.
 *   <li><b>No se puede aplicar NUNCA</b> ({@link NoSePuedeAplicar}): el cuerpo no es JSON, el tipo
 *       no existe en este sistema, la opcion no esta en este catalogo. Se aparta con su motivo, se
 *       acusa y se avisa. Se arregla mirando el hecho.
 *   <li><b>No se puede aplicar HOY</b> ({@link DependenciaQueNoLlego}): el grupo o la cuenta que el
 *       hecho nombra no estan todavia en esta copia. NO se acusa y NO se aparta: se reintenta en la
 *       vuelta siguiente, cuando lo que falta haya llegado. Se arregla esperando —o mirando por que
 *       lo que iba delante no llego—.
 * </ul>
 *
 * <p>Lo que no se puede aplicar hoy por la BASE —caida, sin privilegio— no es de este puerto: es la
 * excepcion de acceso a datos de quien lo implemente, y corta la vuelta sin acusar nada.
 */
public interface CopiaLocalDeLaAutorizacion {

    /**
     * Aplica UN hecho, en una transaccion que abre quien llama.
     *
     * @throws NoSePuedeAplicar si no se va a poder aplicar nunca
     * @throws DependenciaQueNoLlego si hoy no, porque falta algo que tiene que llegar antes
     */
    Aplicacion aplicar(EventoRecibido evento, Instant cuando);

    /** Deja constancia del hecho que no se pudo aplicar, con su cuerpo entero y su motivo. */
    void apartar(EventoRecibido evento, String motivo, Instant cuando);

    /** Cuantos apartados sigue sin mirar nadie. Es la cifra que lleva el aviso. */
    long apartadosSinExplicar();

    /**
     * La FILA de esta copia que ese hecho escribe, en clave natural —{@code usuario:jperez}, {@code
     * grupo:Caja}, {@code miembro:Caja/jperez}, {@code permiso:GRUPO/Caja/normativa/…}—, o {@code
     * null} si el hecho no se puede leer (que es un caso de {@link NoSePuedeAplicar} y lo decide
     * {@link #aplicar}, no este metodo).
     *
     * <p><b>Existe por una sola cosa: para conservar el orden DENTRO de una fila</b> cuando la
     * vuelta sigue con los hechos que van detras de uno pospuesto. Sin ella, una afiliacion
     * pospuesta y su desafiliacion posterior se aplicarian al reves y la copia acabaria diciendo
     * que alguien es miembro de un grupo del que {@code identidad} ya lo saco: no «desordenada»,
     * <b>falsa</b>. Esta medido, con su rotura, en {@code ConsumidorDeIdentidadJdbcTest}.
     *
     * <p>No toca la base: lee el cuerpo del hecho y nada mas.
     */
    @Nullable String filaQueEscribe(EventoRecibido evento);

    /** Lo que paso con un hecho que SI se acusa. */
    enum Aplicacion {
        APLICADO,
        YA_APLICADO,
        IGNORADO_POR_AJENO
    }

    /** Este hecho no se va a poder aplicar nunca: se aparta, se acusa y se avisa. */
    final class NoSePuedeAplicar extends RuntimeException {
        @java.io.Serial private static final long serialVersionUID = 1L;

        public NoSePuedeAplicar(String motivo) {
            super(motivo);
        }

        public NoSePuedeAplicar(String motivo, Throwable causa) {
            super(motivo, causa);
        }
    }

    /** Este hecho no se puede aplicar HOY: lo que nombra todavia no llego. No se acusa. */
    final class DependenciaQueNoLlego extends RuntimeException {
        @java.io.Serial private static final long serialVersionUID = 1L;

        public DependenciaQueNoLlego(String motivo) {
            super(motivo);
        }
    }
}
