package kamayuk.normativa.seguridad.infraestructura.consumidor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import kamayuk.normativa.seguridad.dominio.consumidor.BuzonDeIdentidad.IdentidadNoContesta;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * El token con el que este sistema le pide el buzon a {@code identidad}, medido contra un emisor DE
 * VERDAD y no contra un doble (la doctrina de {@code rentas} #21 AC-2): un doble que devolviera
 * «Bearer x» probaria que el codigo llama a un metodo; un emisor real prueba que la peticion se
 * compone bien —{@code grant_type}, cliente y clave por cuerpo, medido sobre lo que LLEGO— y que
 * del JSON sale el token que despues viaja.
 *
 * <p>Escrito sobre {@link ServerSocket}: Checkstyle prohibe {@code com.sun.net.httpserver}, y con
 * razon —ata el arbol a una JDK concreta—.
 */
@DisplayName("Etapa 4 de ADR-0039 — el consumidor pide su token con client_credentials")
class ElTokenDeServicioDeIdentidadTest {

    private static final Instant AHORA = Instant.parse("2026-09-09T12:00:00Z");
    private static final String CLIENTE = "kamayuk-normativa-servicio-200105";

    private EmisorDeMentira emisor;
    private Instant ahora = AHORA;

    @BeforeEach
    void levantar() throws IOException {
        emisor = EmisorDeMentira.arranca();
    }

    @AfterEach
    void apagar() throws IOException {
        emisor.close();
    }

    private TokenDeServicioDeKeycloak proveedor() {
        return new TokenDeServicioDeKeycloak(
                JsonMapper.builder().build(),
                Clock.fixed(AHORA, ZoneOffset.UTC),
                emisor.raiz(),
                CLIENTE,
                "la-clave-del-cliente");
    }

    private TokenDeServicioDeKeycloak proveedorConRelojMovil() {
        Clock movil =
                new Clock() {
                    @Override
                    public ZoneOffset getZone() {
                        return ZoneOffset.UTC;
                    }

                    @Override
                    public Clock withZone(ZoneId zona) {
                        return this;
                    }

                    @Override
                    public Instant instant() {
                        return ahora;
                    }
                };
        return new TokenDeServicioDeKeycloak(
                JsonMapper.builder().build(),
                movil,
                emisor.raiz(),
                CLIENTE,
                "la-clave-del-cliente");
    }

    @Test
    @DisplayName("pide el token y devuelve la cabecera con el que el emisor emitio")
    void pideElToken() {
        emisor.responde(200, "{\"access_token\":\"el-token-de-verdad\",\"expires_in\":300}");

        assertThat(proveedor().cabecera()).isEqualTo("Bearer el-token-de-verdad");
    }

    @Test
    @DisplayName("y la peticion lleva client_credentials, el cliente y su clave")
    void componeLaPeticion() {
        emisor.responde(200, "{\"access_token\":\"t\",\"expires_in\":300}");

        proveedor().cabecera();

        // Se mira el cuerpo que llego, no el que se penso mandar: un emisor real rechaza una
        // peticion sin `grant_type`, y ese 400 se leeria como «la clave no vale».
        assertThat(emisor.cuerpos()).hasSize(1);
        assertThat(emisor.cuerpos().get(0))
                .contains("grant_type=client_credentials")
                .contains("client_id=" + CLIENTE)
                .contains("client_secret=la-clave-del-cliente");
    }

    @Test
    @DisplayName("lo GUARDA: dos llamadas, un solo viaje al emisor")
    void loGuarda() {
        emisor.responde(200, "{\"access_token\":\"t\",\"expires_in\":300}");
        TokenDeServicioDeKeycloak proveedor = proveedor();

        proveedor.cabecera();
        proveedor.cabecera();

        assertThat(emisor.peticiones()).isEqualTo(1);
    }

    @Test
    @DisplayName("y lo RENUEVA antes de que caduque, que es lo que impide un 401 diferido")
    void loRenueva() {
        emisor.responde(200, "{\"access_token\":\"t\",\"expires_in\":300}");
        TokenDeServicioDeKeycloak proveedor = proveedorConRelojMovil();
        proveedor.cabecera();

        // 300 s de vigencia menos 30 de margen: a los 271 ya hay que pedir otro.
        ahora = AHORA.plus(Duration.ofSeconds(271));
        proveedor.cabecera();

        assertThat(emisor.peticiones()).isEqualTo(2);
    }

    @Test
    @DisplayName("EL CONTRASTE: antes del margen no lo renueva")
    void antesDelMargenNoLoRenueva() {
        emisor.responde(200, "{\"access_token\":\"t\",\"expires_in\":300}");
        TokenDeServicioDeKeycloak proveedor = proveedorConRelojMovil();
        proveedor.cabecera();

        ahora = AHORA.plus(Duration.ofSeconds(269));
        proveedor.cabecera();

        // Sin este contraste, «lo renueva» se cumpliria pidiendolo siempre.
        assertThat(emisor.peticiones()).isEqualTo(1);
    }

    @Test
    @DisplayName("sin `expires_in` no lo guarda: suponer una vigencia cuesta un 401 a media vuelta")
    void sinVigenciaNoLoGuarda() {
        emisor.responde(200, "{\"access_token\":\"t\"}");
        TokenDeServicioDeKeycloak proveedor = proveedor();

        proveedor.cabecera();
        proveedor.cabecera();

        assertThat(emisor.peticiones()).isEqualTo(2);
    }

    @Test
    @DisplayName("un emisor que rechaza la clave es IdentidadNoContesta: se reintenta la vuelta")
    void unEmisorQueRechazaSeReintenta() {
        emisor.responde(401, "{\"error\":\"invalid_client\"}");

        assertThatThrownBy(() -> proveedor().cabecera())
                .isInstanceOf(IdentidadNoContesta.class)
                // El mensaje nombra al cliente y dice donde se arregla: «el emisor contesto 401»
                // manda al despliegue; «identidad no contesta» mandaria a mirar un sistema que
                // esta perfectamente.
                .hasMessageContaining(CLIENTE)
                .hasMessageContaining("No es `identidad`");
    }

    @Test
    @DisplayName("y el cuerpo del rechazo NO viaja en el mensaje: puede traer la clave dentro")
    void elCuerpoDelRechazoNoViaja() {
        emisor.responde(400, "{\"error_description\":\"client_secret la-clave-del-cliente\"}");

        assertThatThrownBy(() -> proveedor().cabecera())
                .isInstanceOf(IdentidadNoContesta.class)
                .satisfies(
                        fallo ->
                                assertThat(fallo.getMessage())
                                        .doesNotContain("la-clave-del-cliente"));
    }

    @Test
    @DisplayName("un 200 sin `access_token` tampoco pasa por bueno")
    void unDoscientosVacioNoPasa() {
        emisor.responde(200, "{\"scope\":\"kamayuk-servicio\"}");

        assertThatThrownBy(() -> proveedor().cabecera())
                .isInstanceOf(IdentidadNoContesta.class)
                .hasMessageContaining("no esta emitiendo");
    }

    @Test
    @DisplayName("EL CONTRASTE: sin identidad configurada no llama a nadie y devuelve vacio")
    void sinConfigurarNoLlama() {
        TokenDeServicioDeKeycloak proveedor =
                new TokenDeServicioDeKeycloak(
                        JsonMapper.builder().build(),
                        Clock.fixed(AHORA, ZoneOffset.UTC),
                        emisor.raiz(),
                        CLIENTE,
                        "");

        // Vacio y no una excepcion, y sobre todo NO se llama al emisor: el compose sin identidad
        // de servicio se pasaria la vida pidiendo tokens que nadie va a dar.
        assertThat(proveedor.cabecera()).isEmpty();
        assertThat(proveedor.configurada()).isFalse();
        assertThat(emisor.peticiones()).isZero();
    }

    @Test
    @DisplayName("y el token que el emisor emitio es el que le llega a `identidad`")
    void elTokenLlegaAlDestino() throws IOException {
        emisor.responde(200, "{\"access_token\":\"el-token-de-verdad\",\"expires_in\":300}");
        try (EmisorDeMentira identidad = EmisorDeMentira.arranca()) {
            identidad.responde(200, "{\"eventos\":[],\"quedan\":0}");
            ClienteHttpDelBuzonDeIdentidad cliente =
                    new ClienteHttpDelBuzonDeIdentidad(
                            JsonMapper.builder().build(),
                            "http://127.0.0.1:" + identidad.puerto(),
                            proveedor());

            cliente.pendientes(10);

            assertThat(identidad.autorizaciones()).containsExactly("Bearer el-token-de-verdad");
            assertThat(identidad.rutas())
                    .containsExactly("/identidad/api/v1/eventos/pendientes?limite=10");
        }
    }

    @Test
    @DisplayName("un 401 del buzon habla de quien llama, y lo dice: NO es un hecho muerto")
    void unRechazoDelBuzonHablaDeQuienLlama() throws IOException {
        try (EmisorDeMentira identidad = EmisorDeMentira.arranca()) {
            identidad.responde(401, "{\"codigo\":\"NO_AUTENTICADO\"}");
            ClienteHttpDelBuzonDeIdentidad sinCredencial =
                    new ClienteHttpDelBuzonDeIdentidad(
                            JsonMapper.builder().build(),
                            "http://127.0.0.1:" + identidad.puerto(),
                            CredencialDeServicio.fija(""));
            ClienteHttpDelBuzonDeIdentidad conCredencialMala =
                    new ClienteHttpDelBuzonDeIdentidad(
                            JsonMapper.builder().build(),
                            "http://127.0.0.1:" + identidad.puerto(),
                            CredencialDeServicio.fija("Bearer una-que-no-vale"));

            // Los dos diagnosticos se arreglan en sitios distintos, y se distinguen.
            assertThatThrownBy(() -> sinCredencial.pendientes(10))
                    .isInstanceOf(IdentidadNoContesta.class)
                    .hasMessageContaining("quien llama")
                    .hasMessageContaining("no manda ninguna credencial");
            assertThatThrownBy(() -> conCredencialMala.pendientes(10))
                    .isInstanceOf(IdentidadNoContesta.class)
                    .hasMessageContaining("quien llama")
                    .hasMessageContaining("no vale");
        }
    }

    /** Un emisor sobre un `ServerSocket`: anota la autorizacion, la ruta y el cuerpo que llegan. */
    private static final class EmisorDeMentira implements AutoCloseable {

        private final ServerSocket socket;
        private final Thread hilo;
        private final List<String> cuerpos = Collections.synchronizedList(new ArrayList<>());
        private final List<String> cabeceras = Collections.synchronizedList(new ArrayList<>());
        private final List<String> rutas = Collections.synchronizedList(new ArrayList<>());
        private volatile int estado = 200;
        private volatile String cuerpo = "{}";

        private EmisorDeMentira(ServerSocket socket) {
            this.socket = socket;
            this.hilo =
                    new Thread(
                            () -> {
                                while (!socket.isClosed()) {
                                    try (Socket cliente = socket.accept()) {
                                        Peticion recibida = leerPeticion(cliente);
                                        rutas.add(recibida.ruta());
                                        cabeceras.add(recibida.autorizacion());
                                        cuerpos.add(recibida.cuerpo());
                                        responder(cliente, estado, cuerpo);
                                    } catch (IOException cerrado) {
                                        return;
                                    }
                                }
                            },
                            "emisor-de-mentira");
            this.hilo.setDaemon(true);
        }

        static EmisorDeMentira arranca() throws IOException {
            ServerSocket socket = new ServerSocket(0, 0, InetAddress.getLoopbackAddress());
            EmisorDeMentira emisor = new EmisorDeMentira(socket);
            emisor.hilo.start();
            return emisor;
        }

        void responde(int estado, String cuerpo) {
            this.estado = estado;
            this.cuerpo = cuerpo;
        }

        String raiz() {
            return "http://127.0.0.1:" + socket.getLocalPort() + "/realms/sgtm/token";
        }

        int puerto() {
            return socket.getLocalPort();
        }

        int peticiones() {
            return cuerpos.size();
        }

        List<String> cuerpos() {
            return List.copyOf(cuerpos);
        }

        List<String> autorizaciones() {
            return List.copyOf(cabeceras);
        }

        List<String> rutas() {
            return List.copyOf(rutas);
        }

        private record Peticion(String ruta, String autorizacion, String cuerpo) {}

        private static Peticion leerPeticion(Socket cliente) throws IOException {
            BufferedReader lector =
                    new BufferedReader(
                            new InputStreamReader(
                                    cliente.getInputStream(), StandardCharsets.UTF_8));
            String primera = lector.readLine();
            String ruta = primera == null ? "" : primera.split(" ")[1];
            int longitud = 0;
            String autorizacion = "";
            String linea = lector.readLine();
            while (linea != null && !linea.isEmpty()) {
                String enMinusculas = linea.toLowerCase(Locale.ROOT);
                if (enMinusculas.startsWith("content-length:")) {
                    longitud = Integer.parseInt(linea.substring(linea.indexOf(':') + 1).trim());
                }
                if (enMinusculas.startsWith("authorization:")) {
                    autorizacion = linea.substring(linea.indexOf(':') + 1).trim();
                }
                linea = lector.readLine();
            }
            char[] cuerpo = new char[longitud];
            int leidos = 0;
            while (leidos < longitud) {
                int n = lector.read(cuerpo, leidos, longitud - leidos);
                if (n < 0) {
                    break;
                }
                leidos += n;
            }
            return new Peticion(ruta, autorizacion, new String(cuerpo, 0, Math.max(leidos, 0)));
        }

        private static void responder(Socket cliente, int estado, String cuerpo)
                throws IOException {
            byte[] datos = cuerpo.getBytes(StandardCharsets.UTF_8);
            String cabeceras =
                    "HTTP/1.1 "
                            + estado
                            + " \r\nContent-Type: application/json\r\nContent-Length: "
                            + datos.length
                            + "\r\nConnection: close\r\n\r\n";
            OutputStream salida = cliente.getOutputStream();
            salida.write(cabeceras.getBytes(StandardCharsets.US_ASCII));
            salida.write(datos);
            salida.flush();
        }

        @Override
        public void close() throws IOException {
            socket.close();
        }
    }
}
