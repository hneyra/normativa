package kamayuk.normativa.seguridad.aplicacion;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import kamayuk.normativa.seguridad.dominio.consumidor.BuzonDeIdentidad;
import kamayuk.normativa.seguridad.dominio.consumidor.CopiaLocalDeLaAutorizacion;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;

/**
 * Una vuelta del consumidor: trae una pagina del buzon de {@code identidad}, aplica cada hecho en
 * su propia transaccion, y acusa lo que quedo resuelto (etapa 4 de ADR-0039).
 *
 * <h2>Lo que pasa con cada hecho, y por que no se confunden</h2>
 *
 * <ul>
 *   <li><b>Se aplica, ya estaba, o es de otro sistema</b>: se acusa. Lo tercero —un {@code
 *       PERMISO_FIJADO} sobre una opcion de {@code rentas}— se dice con un aviso, porque un hecho
 *       que se ignora sin dejar rastro es indistinguible de uno que se perdio.
 *   <li><b>No se puede aplicar NUNCA</b>: se aparta con su cuerpo y su motivo, se acusa —apartado y
 *       acusado deja de servirse, que es lo que impide que bloquee la cola detras de el— y se avisa
 *       al responsable. Sin el aviso, la copia local diria de alguien algo que {@code identidad} ya
 *       no dice y ninguna cifra lo delataria.
 *   <li><b>No se puede aplicar HOY</b> —lo que nombra no ha llegado—: NO se acusa, y <b>la vuelta
 *       se corta ahi, en orden</b>. Seguir con los que van detras aplicaria un {@code
 *       USUARIO_MODIFICADO} antes que su {@code USUARIO_DADO_DE_ALTA}, y cuando el alta llegara por
 *       fin pisaria la modificacion con la fila vieja. Lo que iba delante queda acusado; lo
 *       postergado se vuelve a servir en la vuelta siguiente, cuando lo que falta haya llegado.
 *   <li><b>La base no esta</b> ({@link DataAccessException} al escribir, o {@link
 *       TransactionException} cuando lo que falla es el {@code COMMIT} —medido: un {@code
 *       CONSTRAINT TRIGGER} diferido sale como «JDBC commit failed», que es una {@code
 *       TransactionSystemException} y no una de acceso a datos—): se acusa lo que ya quedo
 *       confirmado y la excepcion sale entera, o sea la corrida termina distinta de cero y la
 *       siguiente reintenta. Tragarsela dejaria el {@code CronJob} en verde con la copia parada.
 * </ul>
 *
 * <h2>El acuse va al FINAL y fuera de toda transaccion</h2>
 *
 * <p>Cada hecho ya esta confirmado —{@link AplicarUnEventoDeIdentidad} abre y cierra la suya—
 * cuando su identificador entra en la lista de resueltos. Este metodo <b>no</b> es transaccional a
 * proposito, y una prueba lo mide: envuelto en una transaccion, el acuse saldria antes del {@code
 * COMMIT} y un hecho cuyo commit fallara despues quedaria acusado y perdido.
 */
public class ConsumirEventosDeIdentidad {

    private static final Logger log = LoggerFactory.getLogger(ConsumirEventosDeIdentidad.class);

    /** Lo que se pide por vuelta. Es el tope que `identidad` sirve por pagina. */
    private static final int POR_VUELTA = 200;

    private final BuzonDeIdentidad buzon;
    private final AplicarUnEventoDeIdentidad aplicador;
    private final AlertaDeEventosSinAplicar alerta;
    private final Clock reloj;

    public ConsumirEventosDeIdentidad(
            BuzonDeIdentidad buzon,
            AplicarUnEventoDeIdentidad aplicador,
            AlertaDeEventosSinAplicar alerta,
            Clock reloj) {
        this.buzon = buzon;
        this.aplicador = aplicador;
        this.alerta = alerta;
        this.reloj = reloj;
    }

    public Vuelta consumir() {
        Instant cuando = reloj.instant();
        BuzonDeIdentidad.Lote lote = buzon.pendientes(POR_VUELTA);
        List<UUID> resueltos = new ArrayList<>();
        int aplicados = 0;
        int yaEstaban = 0;
        int ignorados = 0;
        int apartados = 0;
        EventoRecibido postergado = null;

        for (EventoRecibido evento : lote.eventos()) {
            try {
                CopiaLocalDeLaAutorizacion.Aplicacion resultado = aplicador.aplicar(evento, cuando);
                switch (resultado) {
                    case APLICADO -> aplicados++;
                    case YA_APLICADO -> yaEstaban++;
                    case IGNORADO_POR_AJENO -> {
                        ignorados++;
                        log.warn(
                                "Hecho {} ({}, secuencia {}) IGNORADO: habla de una opcion de OTRO"
                                        + " sistema y esta copia solo guarda a quien se concede"
                                        + " cada opcion de `normativa`. Se acusa sin escribir"
                                        + " nada: un permiso ajeno no es de esta copia",
                                evento.eventoId(),
                                evento.tipoPublicado(),
                                evento.secuencia());
                    }
                    default ->
                            throw new IllegalStateException(
                                    "Un resultado de aplicacion sin rama: " + resultado);
                }
                resueltos.add(evento.eventoId());
            } catch (CopiaLocalDeLaAutorizacion.NoSePuedeAplicar noSePuede) {
                String motivo = motivoDe(noSePuede);
                aplicador.apartar(evento, motivo, cuando);
                apartados++;
                resueltos.add(evento.eventoId());
                alerta.hayUnEventoSinAplicar(evento, motivo, aplicador.apartadosSinExplicar());
            } catch (CopiaLocalDeLaAutorizacion.DependenciaQueNoLlego todaviaNo) {
                postergado = evento;
                log.warn(
                        "Hecho {} ({}, secuencia {}) POSTERGADO, y la vuelta se corta aqui en"
                                + " orden: {}. No se acusa: `identidad` lo vuelve a servir en la"
                                + " vuelta siguiente, cuando lo que falta haya llegado. Si esto se"
                                + " repite corrida tras corrida, lo que iba delante no llego y hay"
                                + " que mirar por que",
                        evento.eventoId(),
                        evento.tipoPublicado(),
                        evento.secuencia(),
                        todaviaNo.getMessage());
                break;
            } catch (DataAccessException | TransactionException laBaseNoEsta) {
                // Lo que ya quedo confirmado se acusa igual: no acusarlo solo haria que se
                // sirviera otra vez y se deduplicara. Y despues la excepcion sale ENTERA.
                acusar(resueltos);
                throw laBaseNoEsta;
            }
        }

        acusar(resueltos);
        return new Vuelta(
                lote.eventos().size(),
                aplicados,
                yaEstaban,
                ignorados,
                apartados,
                resueltos.size(),
                postergado == null ? null : postergado.eventoId(),
                lote.quedan());
    }

    private void acusar(List<UUID> resueltos) {
        if (!resueltos.isEmpty()) {
            buzon.acusar(List.copyOf(resueltos));
        }
    }

    private static String motivoDe(RuntimeException noSePudo) {
        String mensaje = noSePudo.getMessage();
        return mensaje == null ? noSePudo.getClass().getSimpleName() : mensaje;
    }

    /**
     * Lo que dio de si una vuelta.
     *
     * @param leidos cuantos vinieron en la pagina
     * @param aplicados cuantos escribieron algo
     * @param yaEstaban cuantos ya se habian aplicado (entrega al menos una vez)
     * @param ignorados cuantos hablaban de otro sistema
     * @param apartados cuantos no se van a poder aplicar nunca
     * @param acusados cuantos se retiraron del buzon
     * @param postergado el hecho en el que la vuelta se corto, si se corto
     * @param quedan cuantos siguen en el buzon del emisor despues de esta vuelta
     */
    public record Vuelta(
            int leidos,
            int aplicados,
            int yaEstaban,
            int ignorados,
            int apartados,
            int acusados,
            @Nullable UUID postergado,
            long quedan) {

        /**
         * Sin progreso, no «vacia»: un hecho postergado no se acusa y el emisor lo vuelve a servir,
         * asi que dar vueltas hasta que el lote llegue vacio seria darlas todas sobre el mismo.
         */
        public boolean sinProgreso() {
            return acusados == 0;
        }

        @Override
        public String toString() {
            return leidos
                    + " hecho(s) leidos: "
                    + aplicados
                    + " aplicados, "
                    + yaEstaban
                    + " ya estaban, "
                    + ignorados
                    + " ignorados por ser de otro sistema, "
                    + apartados
                    + " apartados sin poder aplicar, "
                    + acusados
                    + " acusados"
                    + (postergado == null ? "" : ", postergado en " + postergado)
                    + "; quedan "
                    + quedan
                    + " en el buzon de `identidad`";
        }
    }
}
