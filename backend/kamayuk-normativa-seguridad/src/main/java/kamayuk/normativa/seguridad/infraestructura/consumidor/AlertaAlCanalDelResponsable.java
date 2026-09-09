package kamayuk.normativa.seguridad.infraestructura.consumidor;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import kamayuk.normativa.seguridad.aplicacion.AlertaDeEventosSinAplicar;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;

/**
 * Le dice al responsable que un hecho de la autorizacion se aparto: una linea de ERROR con su
 * nombre y su canal dentro, SIEMPRE; y ademas un {@code POST} con el aviso a su canal cuando el
 * canal es una direccion http(s) ({@link ResponsableDeLaCopiaLocal#seLeEntrega()}).
 *
 * <p>Las dos cosas y no una: la linea queda aunque el canal no conteste —o no sea entregable, que
 * es el caso de los dos stacks, cuyo canal es un correo—, y el canal llega aunque nadie lea el
 * registro. Y ninguna de las dos puede tumbar la vuelta: un aviso que no se pudo entregar se
 * registra y el consumidor sigue, porque lo que estaba pendiente de acusar ya esta apartado y
 * acusado. Es la doctrina que {@code catastro} midio antes de copiar la clase de {@code rentas}.
 */
public class AlertaAlCanalDelResponsable implements AlertaDeEventosSinAplicar {

    private static final Logger REGISTRO =
            LoggerFactory.getLogger(AlertaAlCanalDelResponsable.class);

    private static final Duration ESPERA = Duration.ofSeconds(10);

    private final HttpClient cliente;
    private final JsonMapper json;
    private final ResponsableDeLaCopiaLocal responsable;

    public AlertaAlCanalDelResponsable(JsonMapper json, ResponsableDeLaCopiaLocal responsable) {
        this.json = json;
        this.responsable = responsable;
        this.cliente = HttpClient.newBuilder().connectTimeout(ESPERA).build();
    }

    @Override
    public void hayUnEventoSinAplicar(
            EventoRecibido evento, String motivo, long apartadosSinExplicar) {
        String texto =
                "LA COPIA LOCAL DE LA AUTORIZACION ESTA DESATRASADA: el hecho "
                        + evento.eventoId()
                        + " ("
                        + evento.tipoPublicado()
                        + ", sujeto "
                        + evento.sujetoId()
                        + ", secuencia "
                        + evento.secuencia()
                        + ") no se pudo aplicar y se aparto. Motivo: "
                        + motivo
                        + ". Hay "
                        + apartadosSinExplicar
                        + " hecho(s) apartados sin explicar. Mientras esten ahi, `normativa` dice"
                        + " de alguien algo que `identidad` ya no dice —un permiso que sigue, una"
                        + " cuenta que entra— y ninguna cifra lo delata (ADR-0039).";
        REGISTRO.error("{} Responsable: {}", texto, responsable);
        if (responsable.seLeEntrega()) {
            entregar(
                    new Aviso(
                            responsable.nombre(),
                            evento.eventoId().toString(),
                            motivo,
                            apartadosSinExplicar,
                            texto));
        }
    }

    @SuppressWarnings("checkstyle:IllegalCatch")
    private void entregar(Aviso aviso) {
        try {
            HttpRequest peticion =
                    HttpRequest.newBuilder(URI.create(responsable.canal()))
                            .timeout(ESPERA)
                            .header("Content-Type", "application/json")
                            .POST(
                                    HttpRequest.BodyPublishers.ofString(
                                            json.writeValueAsString(aviso)))
                            .build();
            HttpResponse<String> respuesta =
                    cliente.send(peticion, HttpResponse.BodyHandlers.ofString());
            if (respuesta.statusCode() >= 300) {
                REGISTRO.error(
                        "El canal {} contesto {} al aviso: el responsable NO se ha enterado por"
                                + " ahi, y la unica constancia es la linea de arriba",
                        responsable.canal(),
                        respuesta.statusCode());
            }
        } catch (IOException | RuntimeException noSePudo) {
            REGISTRO.error(
                    "Y el aviso NO se pudo entregar en {}: {}. La unica constancia es la linea de"
                            + " arriba",
                    responsable.canal(),
                    noSePudo.toString());
        } catch (InterruptedException interrumpido) {
            Thread.currentThread().interrupt();
            REGISTRO.error("Se interrumpio al entregar el aviso en {}", responsable.canal());
        }
    }

    record Aviso(
            String responsable,
            String eventoId,
            String motivo,
            long apartadosSinExplicar,
            String texto) {}
}
