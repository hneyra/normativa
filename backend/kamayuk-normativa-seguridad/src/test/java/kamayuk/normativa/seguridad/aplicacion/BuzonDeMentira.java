package kamayuk.normativa.seguridad.aplicacion;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * El buzon de {@code identidad} de mentira: sirve por HTTP lo que {@code EventosController} sirve,
 * con la misma forma, y recuerda lo que se acuso.
 *
 * <p>Sirve <b>lo no acusado en orden de secuencia</b>, que es lo que el buzon de verdad hace: un
 * hecho que no se acusa vuelve en la vuelta siguiente. Y puede contestar 401 o dejar de contestar,
 * que son las dos formas en que el de verdad falla.
 */
final class BuzonDeMentira implements AutoCloseable {

    static final String PENDIENTES = "/identidad/api/v1/eventos/pendientes";
    static final String ACUSES = "/identidad/api/v1/eventos/acuses";

    private final JsonMapper json;
    private final ServidorDeMentira servidor;
    private final List<Evento> publicados = new CopyOnWriteArrayList<>();
    private final Set<String> acusados = Collections.synchronizedSet(new LinkedHashSet<>());
    private final List<List<String>> acuses = new CopyOnWriteArrayList<>();
    private final AtomicInteger lecturas = new AtomicInteger();
    private volatile int rechazaCon = 0;

    /** Un hecho tal como `identidad` lo publica. */
    record Evento(
            UUID eventoId,
            long secuencia,
            String tipo,
            long sujetoId,
            String cuerpo,
            String huella) {}

    private BuzonDeMentira(JsonMapper json) throws IOException {
        this.json = json;
        this.servidor = ServidorDeMentira.arrancar(this::atender);
    }

    static BuzonDeMentira arrancar(JsonMapper json) throws IOException {
        return new BuzonDeMentira(json);
    }

    String raiz() {
        return servidor.raiz();
    }

    /** Publica un hecho con el cuerpo dado; devuelve su identificador. */
    UUID publicar(long secuencia, String tipo, long sujetoId, String cuerpo) {
        UUID id = UUID.randomUUID();
        publicados.add(new Evento(id, secuencia, tipo, sujetoId, cuerpo, huellaDe(cuerpo)));
        return id;
    }

    /** Que todo 4xx de quien llama: `rechazaCon(401)`. Cero para volver a servir. */
    void rechazaCon(int estado) {
        this.rechazaCon = estado;
    }

    /** Olvida los acuses: es la entrega al menos una vez, simulada. */
    void olvidarLosAcuses() {
        acusados.clear();
    }

    Set<String> acusados() {
        return Set.copyOf(acusados);
    }

    /** Cada acuse que llego, tal como llego, en orden. */
    List<List<String>> acuses() {
        return List.copyOf(acuses);
    }

    int lecturas() {
        return lecturas.get();
    }

    long pendientes() {
        return publicados.stream().filter(e -> !acusados.contains(e.eventoId().toString())).count();
    }

    @Override
    public void close() throws IOException {
        servidor.close();
    }

    private ServidorDeMentira.Respuesta atender(String ruta, String cuerpo) {
        if (rechazaCon != 0) {
            return new ServidorDeMentira.Respuesta(rechazaCon, "{\"codigo\":\"RECHAZADO\"}");
        }
        if (ruta.startsWith(PENDIENTES)) {
            lecturas.incrementAndGet();
            int limite = Integer.parseInt(ruta.substring(ruta.indexOf("limite=") + 7));
            List<Evento> sinAcusar =
                    publicados.stream()
                            .filter(e -> !acusados.contains(e.eventoId().toString()))
                            .sorted((a, b) -> Long.compare(a.secuencia(), b.secuencia()))
                            .toList();
            List<Evento> pagina = sinAcusar.subList(0, Math.min(limite, sinAcusar.size()));
            StringBuilder eventos = new StringBuilder("[");
            for (int i = 0; i < pagina.size(); i++) {
                Evento e = pagina.get(i);
                if (i > 0) {
                    eventos.append(',');
                }
                eventos.append("{\"eventoId\":\"")
                        .append(e.eventoId())
                        .append("\",\"secuencia\":")
                        .append(e.secuencia())
                        .append(",\"tipo\":")
                        .append(comillas(e.tipo()))
                        .append(",\"sujetoId\":")
                        .append(e.sujetoId())
                        .append(",\"cuerpo\":")
                        .append(comillas(e.cuerpo()))
                        .append(",\"huella\":\"")
                        .append(e.huella())
                        .append("\",\"creadoEn\":\"")
                        .append(Instant.parse("2026-09-09T10:00:00Z").plusSeconds(e.secuencia()))
                        .append("\"}");
            }
            eventos.append(']');
            return ServidorDeMentira.Respuesta.ok(
                    "{\"eventos\":"
                            + eventos
                            + ",\"quedan\":"
                            + (sinAcusar.size() - pagina.size())
                            + "}");
        }
        if (ruta.startsWith(ACUSES)) {
            JsonNode peticion = json.readTree(cuerpo);
            List<String> ids = new ArrayList<>();
            for (JsonNode id : peticion.path("eventos")) {
                ids.add(id.asString());
            }
            acuses.add(List.copyOf(ids));
            // Como el de verdad: un identificador que no es suyo se rechaza ENTERO, con 422.
            for (String id : ids) {
                if (publicados.stream().noneMatch(e -> e.eventoId().toString().equals(id))) {
                    return new ServidorDeMentira.Respuesta(
                            422, "{\"codigo\":\"VALIDACION\",\"detalle\":\"" + id + "\"}");
                }
            }
            acusados.addAll(ids);
            return ServidorDeMentira.Respuesta.ok(
                    "{\"recibidos\":"
                            + ids.size()
                            + ",\"escritos\":"
                            + ids.size()
                            + ",\"quedan\":"
                            + pendientes()
                            + "}");
        }
        return new ServidorDeMentira.Respuesta(404, "{\"codigo\":\"NO_ENCONTRADO\"}");
    }

    private String comillas(String texto) {
        return json.writeValueAsString(texto);
    }

    private static String huellaDe(String cuerpo) {
        try {
            byte[] resumen =
                    java.security.MessageDigest.getInstance("SHA-256")
                            .digest(cuerpo.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : resumen) {
                hex.append(String.format(Locale.ROOT, "%02x", b));
            }
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException imposible) {
            throw new IllegalStateException(imposible);
        }
    }
}
