package kamayuk.normativa.seguridad.aplicacion;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
 * El consumidor del buzon de {@code identidad}: vueltas acotadas sobre una pagina de hechos, cada
 * hecho en su propia transaccion, y acuse de lo que quedo resuelto (etapa 4 de ADR-0039).
 *
 * <h2>Lo que pasa con cada hecho, y por que no se confunden</h2>
 *
 * <ul>
 *   <li><b>Se aplica, ya estaba, o es de otro sistema</b>: se acusa. Lo tercero —un {@code
 *       PERMISO_FIJADO} sobre una opcion de {@code rentas}— se cuenta y se dice en <b>una linea por
 *       vuelta</b>: un hecho que se ignora sin dejar rastro es indistinguible de uno que se perdio,
 *       pero una linea por hecho son 161 lineas en una implantacion entera (H6 del ensayo de
 *       AC-5/AC-6), y lo que se lee de un registro asi es nada.
 *   <li><b>No se puede aplicar NUNCA</b>: se aparta con su cuerpo y su motivo, se acusa —apartado y
 *       acusado deja de servirse, que es lo que impide que bloquee la cola detras de el— y se avisa
 *       al responsable.
 *   <li><b>No se puede aplicar HOY</b> —lo que nombra no ha llegado—: NO se acusa, y <b>la vuelta
 *       SIGUE con los demas</b>. Lo unico que se retiene detras de un pospuesto son los hechos que
 *       escriben LA MISMA FILA (ver abajo).
 *   <li><b>La base no esta</b> ({@link DataAccessException} al escribir, o {@link
 *       TransactionException} cuando lo que falla es el {@code COMMIT} —medido: un {@code
 *       CONSTRAINT TRIGGER} diferido sale como «JDBC commit failed», que es una {@code
 *       TransactionSystemException} y no una de acceso a datos—): se acusa lo que ya quedo
 *       confirmado y la excepcion sale entera, o sea la corrida termina distinta de cero y la
 *       siguiente reintenta. Tragarsela dejaria el {@code CronJob} en verde con la copia parada.
 * </ul>
 *
 * <h2>Un hecho pospuesto NO corta la vuelta, y esto se cambio con la medida delante</h2>
 *
 * <p>Hasta el ensayo de AC-5/AC-6 esta clase cortaba la vuelta en el primer pospuesto y no acusaba
 * nada de lo que iba detras. El argumento escrito era el orden; lo medido con las cinco
 * aplicaciones levantadas fue el precio: con una afiliacion pospuesta —un grupo que esta copia
 * habia perdido—, <b>el alta de un usuario que iba detras y no dependia de nada no entro</b>,
 * mientras {@code rentas} y {@code caja} si la aplicaron, y a nadie le llego un aviso. O sea que
 * una fila perdida congelaba la autorizacion entera de este sistema —una revocacion concedida en
 * {@code identidad} no llegaba nunca— en silencio y sin fecha. Eso es peor que una copia a medias.
 *
 * <p><b>Y el orden no se tira: se conserva DONDE importa, que es dentro de una fila.</b> Seguir con
 * todo lo de detras tiene un caso medido en el que la copia acaba diciendo algo <b>falso</b>: una
 * afiliacion pospuesta, el grupo que llega despues, y la desafiliacion de ese mismo par aplicada
 * antes que su afiliacion — la vuelta siguiente aplica la afiliacion pospuesta y la copia dice que
 * alguien esta en un grupo del que {@code identidad} lo saco. Por eso lo que se retiene no es «todo
 * lo de detras» sino <b>los hechos que escriben la misma fila que uno ya pospuesto</b> ({@link
 * CopiaLocalDeLaAutorizacion#filaQueEscribe}). Las dos cosas estan medidas, cada una con su rotura,
 * en {@code ConsumidorDeIdentidadJdbcTest}.
 *
 * <h2>El acuse va al FINAL y fuera de toda transaccion</h2>
 *
 * <p>Cada hecho ya esta confirmado —{@link AplicarUnEventoDeIdentidad} abre y cierra la suya—
 * cuando su identificador entra en la lista de resueltos. {@link #consumir()} <b>no</b> es
 * transaccional a proposito, y una prueba lo mide: envuelto en una transaccion, el acuse saldria
 * antes del {@code COMMIT} y un hecho cuyo commit fallara despues quedaria acusado y perdido.
 */
public class ConsumirEventosDeIdentidad {

    private static final Logger log = LoggerFactory.getLogger(ConsumirEventosDeIdentidad.class);

    /** Lo que se pide por vuelta. Es el tope que `identidad` sirve por pagina. */
    private static final int POR_VUELTA = 200;

    /**
     * Cincuenta vueltas de doscientos son diez mil hechos por corrida. Es una cota, no una
     * expectativa: la corrida acaba a proposito en vez de no acabar, y la siguiente sigue.
     */
    private static final int VUELTAS_MAXIMAS = 50;

    /**
     * Cuanto puede llevar un hecho pospuesto sin que nadie se entere: <b>TRES ticks</b> del {@code
     * CronJob}, que corre cada cinco minutos.
     *
     * <p>Tres y no uno porque el primero es normal —un hecho puede llegar en la misma pagina que su
     * dependencia y aplicarse a la vuelta siguiente— y el segundo todavia puede serlo si una
     * corrida se solapo o fallo con {@code backoffLimit: 1}. A los quince minutos ya no es una
     * carrera: es que lo que iba delante no esta, y eso no se arregla solo. La edad se mide contra
     * el {@code creadoEn} que {@code identidad} publica en cada hecho, no contra cuando lo leimos:
     * lo segundo se reinicia con cada corrida y no diria nunca que algo lleva quince minutos.
     */
    public static final Duration EDAD_QUE_SE_AVISA = Duration.ofMinutes(15);

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

    /**
     * Una corrida entera: vueltas hasta que una no avance, y el aviso de lo que lleva demasiado
     * pospuesto.
     *
     * <p>Termina normal —codigo cero— aunque queden pospuestos: un pospuesto no es un fallo, es un
     * hecho esperando a otro, y lo que hace falta cuando la espera se alarga es que alguien se
     * entere, no que un {@code Job} salga {@code Failed} cada cinco minutos.
     *
     * @throws BuzonDeIdentidad.IdentidadNoContesta si el buzon no contesta: eso SI corta la corrida
     *     sin acusar nada. Es transitorio y la invocacion siguiente lo reintenta; tragarselo
     *     dejaria el {@code CronJob} en verde con la copia parada
     */
    public Corrida correr() {
        int vueltas = 0;
        int aplicados = 0;
        int apartados = 0;
        // Por identificador: el mismo hecho se pospone en varias vueltas y es UNO.
        Map<UUID, EventoRecibido> pospuestos = new LinkedHashMap<>();
        boolean seAgotaron = true;
        for (int vuelta = 1; vuelta <= VUELTAS_MAXIMAS; vuelta++) {
            Vuelta resultado = consumir();
            vueltas = vuelta;
            aplicados += resultado.aplicados();
            apartados += resultado.apartados();
            for (EventoRecibido pospuesto : resultado.pospuestos()) {
                pospuestos.put(pospuesto.eventoId(), pospuesto);
            }
            log.info("Vuelta {}: {}", vuelta, resultado);
            if (resultado.sinProgreso()) {
                seAgotaron = false;
                break;
            }
        }
        if (seAgotaron) {
            log.warn(
                    "Se agotaron las {} vueltas y el buzon de `identidad` sigue teniendo hechos. No"
                            + " es un fallo: la corrida acaba a proposito en vez de no acabar. La"
                            + " siguiente invocacion sigue por donde esta se quedo",
                    VUELTAS_MAXIMAS);
        }
        Instant cuando = reloj.instant();
        List<EventoRecibido> viejos = losQueLlevanDemasiado(pospuestos.values(), cuando);
        if (!viejos.isEmpty()) {
            alerta.hayEventosPospuestosDesdeHaceRato(viejos, cuando);
        }
        return new Corrida(vueltas, aplicados, apartados, List.copyOf(pospuestos.values()), viejos);
    }

    private static List<EventoRecibido> losQueLlevanDemasiado(
            Iterable<EventoRecibido> pospuestos, Instant cuando) {
        List<EventoRecibido> viejos = new ArrayList<>();
        for (EventoRecibido pospuesto : pospuestos) {
            if (Duration.between(pospuesto.creadoEn(), cuando).compareTo(EDAD_QUE_SE_AVISA) > 0) {
                viejos.add(pospuesto);
            }
        }
        viejos.sort((uno, otro) -> Long.compare(uno.secuencia(), otro.secuencia()));
        return List.copyOf(viejos);
    }

    public Vuelta consumir() {
        Instant cuando = reloj.instant();
        BuzonDeIdentidad.Lote lote = buzon.pendientes(POR_VUELTA);
        List<UUID> resueltos = new ArrayList<>();
        List<EventoRecibido> pospuestos = new ArrayList<>();
        List<String> ajenos = new ArrayList<>();
        // Las FILAS que se han pospuesto en esta vuelta. Lo que escriba una de ellas espera, para
        // que dentro de una fila el orden del emisor se conserve; lo demas sigue.
        Set<String> filasPospuestas = new LinkedHashSet<>();
        int aplicados = 0;
        int yaEstaban = 0;
        int apartados = 0;

        for (EventoRecibido evento : lote.eventos()) {
            String fila = filasPospuestas.isEmpty() ? null : aplicador.filaQueEscribe(evento);
            if (fila != null && filasPospuestas.contains(fila)) {
                pospuestos.add(evento);
                continue;
            }
            try {
                CopiaLocalDeLaAutorizacion.Aplicacion resultado = aplicador.aplicar(evento, cuando);
                switch (resultado) {
                    case APLICADO -> aplicados++;
                    case YA_APLICADO -> yaEstaban++;
                    case IGNORADO_POR_AJENO ->
                            ajenos.add(evento.tipoPublicado() + "/" + evento.sujetoId());
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
                pospuestos.add(evento);
                String suya = aplicador.filaQueEscribe(evento);
                if (suya != null) {
                    filasPospuestas.add(suya);
                }
                log.warn(
                        "Hecho {} ({}, secuencia {}) POSPUESTO: {}. No se acusa: `identidad` lo"
                                + " vuelve a servir cuando lo que falta haya llegado. La vuelta"
                                + " SIGUE con los demas; lo unico que espera detras de el es lo que"
                                + " escriba su misma fila",
                        evento.eventoId(),
                        evento.tipoPublicado(),
                        evento.secuencia(),
                        todaviaNo.getMessage());
            } catch (DataAccessException | TransactionException laBaseNoEsta) {
                // Lo que ya quedo confirmado se acusa igual: no acusarlo solo haria que se
                // sirviera otra vez y se deduplicara. Y despues la excepcion sale ENTERA.
                acusar(resueltos, lote);
                throw laBaseNoEsta;
            }
        }

        if (!ajenos.isEmpty()) {
            log.warn(
                    "{} hecho(s) IGNORADOS en esta vuelta: hablan de una opcion de OTRO sistema y"
                            + " esta copia solo guarda a quien se concede cada opcion de"
                            + " `normativa`. Se acusan sin escribir nada. Sujetos: {}",
                    ajenos.size(),
                    ajenos);
        }
        long quedan = acusar(resueltos, lote);
        return new Vuelta(
                lote.eventos().size(),
                aplicados,
                yaEstaban,
                ajenos.size(),
                apartados,
                resueltos.size(),
                List.copyOf(pospuestos),
                quedan);
    }

    /**
     * Acusa lo resuelto y devuelve cuantos quedan DESPUES; sin nada que acusar, lo que traia el
     * lote.
     */
    private long acusar(List<UUID> resueltos, BuzonDeIdentidad.Lote lote) {
        if (resueltos.isEmpty()) {
            return lote.quedan();
        }
        return buzon.acusar(List.copyOf(resueltos));
    }

    private static String motivoDe(RuntimeException noSePudo) {
        String mensaje = noSePudo.getMessage();
        return mensaje == null ? noSePudo.getClass().getSimpleName() : mensaje;
    }

    /**
     * Lo que dio de si una corrida entera.
     *
     * @param vueltas cuantas paginas se llegaron a pedir
     * @param aplicados cuantos hechos escribieron algo, sumando las vueltas
     * @param apartados cuantos no se van a poder aplicar nunca
     * @param pospuestos los que quedaron esperando a lo que va delante, sin repetir
     * @param avisados los pospuestos que pasaban de {@link #EDAD_QUE_SE_AVISA} y por los que se
     *     avisó al responsable
     */
    public record Corrida(
            int vueltas,
            int aplicados,
            int apartados,
            List<EventoRecibido> pospuestos,
            List<EventoRecibido> avisados) {}

    /**
     * Lo que dio de si una vuelta.
     *
     * @param leidos cuantos vinieron en la pagina
     * @param aplicados cuantos escribieron algo
     * @param yaEstaban cuantos ya se habian aplicado (entrega al menos una vez)
     * @param ignorados cuantos hablaban de otro sistema
     * @param apartados cuantos no se van a poder aplicar nunca
     * @param acusados cuantos se retiraron del buzon
     * @param pospuestos los que esperan a lo que va delante: no se acusan
     * @param quedan cuantos siguen en el buzon del emisor DESPUES del acuse
     */
    public record Vuelta(
            int leidos,
            int aplicados,
            int yaEstaban,
            int ignorados,
            int apartados,
            int acusados,
            List<EventoRecibido> pospuestos,
            long quedan) {

        /**
         * Sin progreso, no «vacia»: un hecho pospuesto no se acusa y el emisor lo vuelve a servir,
         * asi que dar vueltas hasta que el lote llegue vacio seria darlas todas sobre el mismo.
         */
        public boolean sinProgreso() {
            return acusados == 0;
        }

        /** El primero que se pospuso, si alguno. Lo usan las pruebas y los mensajes. */
        public @Nullable UUID pospuesto() {
            return pospuestos.isEmpty() ? null : pospuestos.get(0).eventoId();
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
                    + pospuestos.size()
                    + " pospuestos, "
                    + acusados
                    + " acusados; quedan "
                    + quedan
                    + " en el buzon de `identidad` despues del acuse";
        }
    }
}
