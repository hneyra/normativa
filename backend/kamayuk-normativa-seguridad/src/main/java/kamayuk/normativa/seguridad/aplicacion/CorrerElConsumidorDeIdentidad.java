package kamayuk.normativa.seguridad.aplicacion;

import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.MunicipalidadId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;

/**
 * El proceso que el {@code CronJob} despierta cada cinco minutos: una corrida del consumidor sobre
 * el buzon de {@code identidad} (etapa 4 de ADR-0039).
 *
 * <p>Las vueltas, el corte por «sin progreso» y el aviso de lo que lleva demasiado pospuesto son de
 * {@link ConsumirEventosDeIdentidad#correr()}, y no de aqui: la implantacion hace <b>la misma</b>
 * pasada al terminar de sembrar, y dos bucles con las mismas reglas escritos en dos sitios se
 * separan.
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
            ConsumirEventosDeIdentidad.Corrida corrida = consumidor.correr();
            log.info(
                    "Corrida del consumidor de `identidad`: {} vuelta(s), {} aplicados, {}"
                            + " apartados, {} pospuestos ({} avisados por llevar demasiado"
                            + " esperando)",
                    corrida.vueltas(),
                    corrida.aplicados(),
                    corrida.apartados(),
                    corrida.pospuestos().size(),
                    corrida.avisados().size());
        } finally {
            TenantContext.limpiar();
        }
    }
}
