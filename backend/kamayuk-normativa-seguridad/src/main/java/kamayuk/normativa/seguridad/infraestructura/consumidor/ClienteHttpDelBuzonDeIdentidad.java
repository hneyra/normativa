package kamayuk.normativa.seguridad.infraestructura.consumidor;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import kamayuk.normativa.seguridad.dominio.consumidor.BuzonDeIdentidad;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Trae los hechos del buzon de {@code identidad} y los acusa (etapa 4 de ADR-0039).
 *
 * <p>Las dos rutas son las que {@code EventosController} de {@code identidad} publica, y lo que
 * este cliente pide y lee esta comprometido en {@code docs/50-api/contratos-que-consume/
 * identidad.json}, que el CI del proveedor comprueba: un campo que {@code identidad} deje de
 * publicar pone rojo SU build, y no el nuestro a media noche.
 *
 * <h2>Todo fallo de aqui es TRANSITORIO, incluidos el 401 y el 403</h2>
 *
 * <p>Todo lo que este cliente lanza es {@link BuzonDeIdentidad.IdentidadNoContesta}: la red, un
 * cuerpo que no es JSON, un 500 — y un <b>401 o 403</b>, que no hablan del hecho sino de quien
 * llama: la cuenta de servicio no existe, la clave no vale, o el acceso {@code eventos} no esta
 * concedido a este consumidor. Las tres se arreglan en el despliegue y cambian solas; matar un
 * hecho por eso seria matarlo por un motivo que iba a arreglarse (la leccion de {@code caja}#21
 * AC-3). El mensaje dice cual de las dos cosas es —«esta copia no manda ninguna credencial» o «la
 * que manda no vale»—, porque se arreglan en sitios distintos.
 *
 * <h2>Un 4xx de negocio al acusar se REGISTRA, y no se reintenta a ciegas</h2>
 *
 * <p>Un 422 al acusar es {@code identidad} diciendo que uno de los identificadores no es suyo o no
 * es un uuid. Los hechos SI estan aplicados aqui; lo que hay que mirar es que se le mando. Sale
 * como {@link BuzonDeIdentidad.IdentidadNoContesta} con el cuerpo del rechazo dentro —para que la
 * corrida termine distinta de cero y alguien lo lea—, y en la vuelta siguiente los mismos hechos
 * vuelven, se deduplican y se vuelven a acusar: si el rechazo era transitorio, se arregla solo; si
 * no, se repite con el mismo mensaje hasta que alguien lo mire.
 */
public class ClienteHttpDelBuzonDeIdentidad implements BuzonDeIdentidad {

    private static final Duration ESPERA_DE_CONEXION = Duration.ofSeconds(5);
    private static final Duration ESPERA_DE_LECTURA = Duration.ofSeconds(30);

    /** La raiz de la API de `identidad`, tal como su `Api.RAIZ` la fija. */
    public static final String RAIZ_DE_LA_API = "/identidad/api/v1";

    static final String PENDIENTES = RAIZ_DE_LA_API + "/eventos/pendientes";
    static final String ACUSES = RAIZ_DE_LA_API + "/eventos/acuses";

    /** La propiedad con la que se configura la direccion, para nombrarla cuando falte. */
    public static final String PROPIEDAD_DE_LA_URL = "kamayuk.identidad.url";

    private final HttpClient cliente;
    private final JsonMapper json;
    private final String raiz;
    private final CredencialDeServicio credencial;

    public ClienteHttpDelBuzonDeIdentidad(
            JsonMapper json, String raiz, CredencialDeServicio credencial) {
        this.json = json;
        this.raiz = raiz.endsWith("/") ? raiz.substring(0, raiz.length() - 1) : raiz;
        this.credencial = credencial;
        this.cliente = HttpClient.newBuilder().connectTimeout(ESPERA_DE_CONEXION).build();
    }

    @Override
    public Lote pendientes(int limite) {
        JsonNode cuerpo = pedir(PENDIENTES + "?limite=" + limite, "leer el buzon de identidad");
        List<EventoRecibido> eventos = new ArrayList<>();
        for (JsonNode evento : cuerpo.path("eventos")) {
            eventos.add(leer(evento));
        }
        return new Lote(List.copyOf(eventos), cuerpo.path("quedan").asLong(0));
    }

    @Override
    public long acusar(List<UUID> eventoIds) {
        if (eventoIds.isEmpty()) {
            return 0;
        }
        List<String> ids = new ArrayList<>();
        for (UUID id : eventoIds) {
            ids.add(id.toString());
        }
        HttpRequest.Builder peticion =
                HttpRequest.newBuilder(URI.create(raiz + ACUSES))
                        .timeout(ESPERA_DE_LECTURA)
                        .header("Content-Type", "application/json")
                        .header("Accept", "application/json")
                        .POST(
                                HttpRequest.BodyPublishers.ofString(
                                        escribir(new PeticionDeAcuse(List.copyOf(ids)))));
        conCredencial(peticion);
        HttpResponse<String> respuesta = enviar(peticion, "acusar los hechos aplicados");
        if (esDeQuienLlama(respuesta.statusCode())) {
            throw rechazoDeQuienLlama(respuesta.statusCode(), "acusar");
        }
        if (respuesta.statusCode() >= 400 && respuesta.statusCode() < 500) {
            throw new IdentidadNoContesta(
                    "`identidad` RECHAZO el acuse con "
                            + respuesta.statusCode()
                            + ": "
                            + respuesta.body()
                            + ". Los hechos SI estan aplicados aqui; lo que hay que mirar es que"
                            + " se le mando. Se volveran a servir y a deduplicar");
        }
        if (respuesta.statusCode() != 200) {
            throw new IdentidadNoContesta(
                    "`identidad` contesto "
                            + respuesta.statusCode()
                            + " al acusar. Los hechos SI estan aplicados aqui: se volveran a"
                            + " servir y se descartaran por deduplicacion");
        }
        // `quedan` DESPUES del acuse, que es lo que el contrato publica en esta respuesta. El del
        // lote se cuenta al servir la pagina, o sea antes (H6).
        return leerJson(respuesta.body(), "leer el acuse").path("quedan").asLong(0L);
    }

    // ------------------------------------------------------------------

    private EventoRecibido leer(JsonNode evento) {
        try {
            return new EventoRecibido(
                    UUID.fromString(evento.path("eventoId").asString()),
                    evento.path("secuencia").asLong(),
                    evento.path("tipo").asString(""),
                    evento.path("sujetoId").asLong(),
                    evento.path("cuerpo").asString(""),
                    evento.path("huella").asString(""),
                    Instant.parse(evento.path("creadoEn").asString()));
        } catch (IllegalArgumentException | DateTimeParseException malFormado) {
            throw new IdentidadNoContesta(
                    "El buzon de `identidad` contesto algo que no tiene la forma de un hecho: "
                            + malFormado.getMessage());
        }
    }

    private JsonNode pedir(String ruta, String que) {
        if (raiz.isBlank()) {
            throw new IdentidadNoContesta(
                    que + ": " + PROPIEDAD_DE_LA_URL + " no esta configurada");
        }
        HttpRequest.Builder peticion =
                HttpRequest.newBuilder(URI.create(raiz + ruta))
                        .timeout(ESPERA_DE_LECTURA)
                        .header("Accept", "application/json")
                        .GET();
        conCredencial(peticion);
        HttpResponse<String> respuesta = enviar(peticion, que);
        if (esDeQuienLlama(respuesta.statusCode())) {
            throw rechazoDeQuienLlama(respuesta.statusCode(), que);
        }
        if (respuesta.statusCode() != 200) {
            throw new IdentidadNoContesta(
                    "`identidad` contesto " + respuesta.statusCode() + " al " + que);
        }
        return leerJson(respuesta.body(), que);
    }

    private JsonNode leerJson(String cuerpo, String que) {
        try {
            return json.readTree(cuerpo);
        } catch (JacksonException ilegible) {
            throw new IdentidadNoContesta(
                    "`identidad` contesto algo que no es JSON al " + que, ilegible);
        }
    }

    /** Un 401 o un 403 no hablan del hecho: hablan de quien llama. */
    private static boolean esDeQuienLlama(int estado) {
        return estado == 401 || estado == 403;
    }

    private IdentidadNoContesta rechazoDeQuienLlama(int estado, String que) {
        String diagnostico =
                credencial.cabecera().isBlank()
                        ? "esta copia no manda ninguna credencial: falta configurar la identidad de"
                                + " servicio (kamayuk.identidad.token, .cliente y .credencial)"
                        : "la credencial que esta copia manda no vale para ese buzon: la cuenta de"
                                + " servicio «kamayuk-normativa-servicio-<ubigeo>» tiene que existir"
                                + " en el emisor con esa clave y tener el acceso `eventos` en"
                                + " `identidad`";
        return new IdentidadNoContesta(
                "`identidad` contesto "
                        + estado
                        + " al "
                        + que
                        + ", y eso no habla de ningun hecho sino de quien llama: "
                        + diagnostico
                        + ". Se reintenta en la vuelta siguiente; se arregla en el despliegue");
    }

    /** Pone la cabecera si la hay. Se pide AQUI y no al construir: un token caduca. */
    private void conCredencial(HttpRequest.Builder peticion) {
        String cabecera = credencial.cabecera();
        if (!cabecera.isBlank()) {
            peticion.header("Authorization", cabecera);
        }
    }

    private HttpResponse<String> enviar(HttpRequest.Builder peticion, String que) {
        try {
            return cliente.send(peticion.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException noContesta) {
            throw new IdentidadNoContesta("No se pudo " + que, noContesta);
        } catch (InterruptedException interrumpido) {
            Thread.currentThread().interrupt();
            throw new IdentidadNoContesta("Se interrumpio al " + que, interrumpido);
        }
    }

    private String escribir(Object cuerpo) {
        try {
            return json.writeValueAsString(cuerpo);
        } catch (JacksonException noSePuede) {
            throw new IllegalStateException("No se pudo componer el acuse", noSePuede);
        }
    }

    /** Lo que se manda al acusar: la forma que `EventosController.PeticionDeAcuse` lee. */
    record PeticionDeAcuse(List<String> eventos) {}
}
