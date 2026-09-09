package kamayuk.normativa.seguridad.aplicacion;

import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.MunicipalidadId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;

/**
 * El proceso que el {@code CronJob} despierta cada cinco minutos: vueltas acotadas sobre el buzon
 * de {@code identidad} hasta que una no avance (etapa 4 de ADR-0039).
 *
 * <p>Vive en el perfil {@code batch} y solo existe cuando el despliegue dice de que municipalidad
 * es este consumidor ({@code kamayuk.identidad.consumidor.municipalidad}): el proceso web no
 * consume nada, y la implantacion hace su propia pasada al terminar de sembrar sin necesitar este
 * runner.
 *
 * <p>La municipalidad se fija a mano porque no hay peticion de la que sacarla, y se limpia SIEMPRE:
 * sin eso, cualquier cosa que corriera despues leeria con el contexto de esta municipalidad.
 */
@Profile("batch")
public class CorrerElConsumidorDeIdentidad implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CorrerElConsumidorDeIdentidad.class);

    /**
     * Cincuenta vueltas de doscientos son diez mil hechos por corrida. Es una cota, no una
     * expectativa: la corrida acaba a proposito en vez de no acabar, y la siguiente sigue.
     */
    private static final int VUELTAS_MAXIMAS = 50;

    private final ConsumirEventosDeIdentidad consumidor;
    private final long municipalidadId;

    public CorrerElConsumidorDeIdentidad(
            ConsumirEventosDeIdentidad consumidor, long municipalidadId) {
        this.consumidor = consumidor;
        this.municipalidadId = municipalidadId;
    }

    @Override
    public void run(ApplicationArguments argumentos) {
        TenantContext.fijar(new MunicipalidadId(municipalidadId));
        try {
            darVueltas(consumidor, log);
        } finally {
            TenantContext.limpiar();
        }
    }

    /**
     * Las vueltas, con el contexto de tenant ya fijado por quien llama.
     *
     * <p>Es {@code static} y publico para que la implantacion haga la misma pasada con las mismas
     * reglas, sin necesitar un segundo runner ni copiar el bucle.
     *
     * @throws BuzonDeIdentidad.IdentidadNoContesta si el buzon no contesta: la corrida se corta SIN
     *     acusar nada y sale distinta de cero. Es transitorio y la invocacion siguiente lo
     *     reintenta; tragarselo dejaria el {@code CronJob} en verde con la copia parada
     */
    public static void darVueltas(ConsumirEventosDeIdentidad consumidor, Logger registro) {
        for (int vuelta = 1; vuelta <= VUELTAS_MAXIMAS; vuelta++) {
            ConsumirEventosDeIdentidad.Vuelta resultado = consumidor.consumir();
            registro.info("Vuelta {}: {}", vuelta, resultado);
            if (resultado.sinProgreso()) {
                return;
            }
        }
        registro.warn(
                "Se agotaron las {} vueltas y el buzon de `identidad` sigue teniendo hechos. No es"
                        + " un fallo: la corrida acaba a proposito en vez de no acabar. La siguiente"
                        + " invocacion sigue por donde esta se quedo",
                VUELTAS_MAXIMAS);
    }
}
