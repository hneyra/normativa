package kamayuk.normativa.seguridad.aplicacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;
import kamayuk.normativa.seguridad.infraestructura.consumidor.AlertaAlCanalDelResponsable;
import kamayuk.normativa.seguridad.infraestructura.consumidor.ResponsableDeLaCopiaLocal;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;

/**
 * El aviso al responsable, con el canal que los ambientes declaran DE VERDAD.
 *
 * <p>{@code kamayuk:canalDeOperacion} vale {@code operaciones@example.pe} en los dos stacks, y es
 * lo que llega a {@code KAMAYUK_IDENTIDAD_CONSUMIDOR_CANAL}. La primera version de {@code
 * ResponsableDeLaCopiaLocal} exigia http(s) —copiada de {@code rentas}— y con ese canal el {@code
 * Job} de implantacion no habria arrancado en ningun ambiente. Estas pruebas son el contraste de la
 * decision que lo corrigio, la misma que {@code catastro} midio: con un correo el consumidor
 * ARRANCA y el aviso queda en el registro con el responsable y el canal dentro; con http(s),
 * ademas, se entrega.
 */
@DisplayName("El aviso al responsable de la copia local")
class AvisoAlResponsableTest {

    private static final ListAppender<ILoggingEvent> ANOTADOS = new ListAppender<>();
    private static final List<String> ENTREGADOS = new CopyOnWriteArrayList<>();
    private static ServidorDeMentira canal;
    private static JsonMapper json;

    @BeforeAll
    static void arrancar() throws IOException {
        ANOTADOS.start();
        ((Logger) LoggerFactory.getLogger(AlertaAlCanalDelResponsable.class)).addAppender(ANOTADOS);
        json = JsonMapper.builder().build();
        canal =
                ServidorDeMentira.arrancar(
                        (ruta, cuerpo) -> {
                            ENTREGADOS.add(cuerpo);
                            return ServidorDeMentira.Respuesta.ok("{\"recibido\":true}");
                        });
    }

    @AfterAll
    static void parar() throws IOException {
        if (canal != null) {
            canal.close();
        }
        ((Logger) LoggerFactory.getLogger(AlertaAlCanalDelResponsable.class))
                .detachAppender(ANOTADOS);
    }

    @BeforeEach
    void limpiar() {
        ANOTADOS.list.clear();
        ENTREGADOS.clear();
    }

    @Test
    @DisplayName("con el canal que los stacks declaran —un correo— el consumidor ARRANCA")
    void unCorreoEsUnCanalValido() {
        ResponsableDeLaCopiaLocal responsable =
                new ResponsableDeLaCopiaLocal("Equipo de operacion", "operaciones@example.pe");
        assertThat(responsable.canal()).isEqualTo("operaciones@example.pe");
        assertThat(responsable.seLeEntrega())
                .as("a un correo no se le puede hacer un POST: solo se nombra")
                .isFalse();
    }

    @Test
    @DisplayName("y con un correo el aviso queda en el registro, con responsable y canal dentro")
    void conUnCorreoElAvisoQuedaEnElRegistro() {
        AlertaAlCanalDelResponsable alerta =
                new AlertaAlCanalDelResponsable(
                        json,
                        new ResponsableDeLaCopiaLocal(
                                "Equipo de operacion", "operaciones@example.pe"));

        alerta.hayUnEventoSinAplicar(evento(), "el cuerpo del hecho no es un objeto JSON", 1);

        assertThat(ANOTADOS.list)
                .as("una linea de ERROR, y ninguna otra: no hay POST que pueda fallar")
                .hasSize(1);
        ILoggingEvent linea = ANOTADOS.list.get(0);
        assertThat(linea.getLevel()).isEqualTo(Level.ERROR);
        assertThat(linea.getFormattedMessage())
                .contains("Equipo de operacion <operaciones@example.pe>")
                .contains("el cuerpo del hecho no es un objeto JSON")
                .contains("LA COPIA LOCAL DE LA AUTORIZACION ESTA DESATRASADA");
        assertThat(ENTREGADOS).as("a un correo no se le entrega nada por HTTP").isEmpty();
    }

    @Test
    @DisplayName("con un canal http(s) el aviso ADEMAS se entrega")
    void conHttpSeEntrega() {
        AlertaAlCanalDelResponsable alerta =
                new AlertaAlCanalDelResponsable(
                        json, new ResponsableDeLaCopiaLocal("Quien atiende", canal.raiz()));

        alerta.hayUnEventoSinAplicar(evento(), "tipo desconocido", 2);

        assertThat(ANOTADOS.list).as("la linea de ERROR queda igual").hasSize(1);
        assertThat(ENTREGADOS).hasSize(1);
        assertThat(ENTREGADOS.get(0))
                .contains("\"responsable\":\"Quien atiende\"")
                .contains("\"motivo\":\"tipo desconocido\"")
                .contains("\"apartadosSinExplicar\":2");
    }

    @Test
    @DisplayName(
            "el aviso de los pospuestos viejos nombra tipo, sujeto, secuencia y edad de cada uno")
    void elAvisoDeLosPospuestosLosNombra() {
        AlertaAlCanalDelResponsable alerta =
                new AlertaAlCanalDelResponsable(
                        json,
                        new ResponsableDeLaCopiaLocal(
                                "Equipo de operacion", "operaciones@example.pe"));
        Instant cuando = Instant.parse("2026-09-09T12:00:00Z");

        alerta.hayEventosPospuestosDesdeHaceRato(
                List.of(
                        pospuesto("MIEMBRO_AFILIADO", 31, 77, cuando.minusSeconds(20 * 60)),
                        pospuesto("PERMISO_FIJADO", 31, 78, cuando.minusSeconds(31 * 60))),
                cuando);

        assertThat(ANOTADOS.list).hasSize(1);
        assertThat(ANOTADOS.list.get(0).getFormattedMessage())
                .contains("2 hecho(s) de `identidad` estan pospuestos")
                .contains("mas de 15 minutos")
                .contains("MIEMBRO_AFILIADO sujeto 31, secuencia 77, 20 min esperando")
                .contains("PERMISO_FIJADO sujeto 31, secuencia 78, 31 min esperando")
                .contains("Equipo de operacion <operaciones@example.pe>");
        assertThat(ENTREGADOS).as("a un correo no se le entrega nada por HTTP").isEmpty();
    }

    @Test
    @DisplayName("y con un canal http(s) ese mismo aviso se entrega una sola vez")
    void elAvisoDeLosPospuestosSeEntregaUnaVez() {
        AlertaAlCanalDelResponsable alerta =
                new AlertaAlCanalDelResponsable(
                        json, new ResponsableDeLaCopiaLocal("Quien atiende", canal.raiz()));
        Instant cuando = Instant.parse("2026-09-09T12:00:00Z");

        alerta.hayEventosPospuestosDesdeHaceRato(
                List.of(pospuesto("MIEMBRO_AFILIADO", 31, 77, cuando.minusSeconds(16 * 60))),
                cuando);

        assertThat(ENTREGADOS).hasSize(1);
        assertThat(ENTREGADOS.get(0))
                .contains("\"motivo\":\"pospuestos desde hace rato\"")
                .contains("\"apartadosSinExplicar\":1");
    }

    @Test
    @DisplayName("un canal que no contesta NO tumba la vuelta: se registra y se sigue")
    void unCanalQueNoContestaNoTumba() {
        AlertaAlCanalDelResponsable alerta =
                new AlertaAlCanalDelResponsable(
                        json,
                        new ResponsableDeLaCopiaLocal("Quien atiende", "http://127.0.0.1:1/aviso"));

        alerta.hayUnEventoSinAplicar(evento(), "tipo desconocido", 1);

        assertThat(ANOTADOS.list).hasSize(2);
        assertThat(ANOTADOS.list.get(1).getFormattedMessage())
                .contains("NO se pudo entregar")
                .contains("http://127.0.0.1:1/aviso");
    }

    @Test
    @DisplayName("sin nombre o sin canal no hay responsable, y el consumidor no arranca")
    void sinNombreOSinCanalNoArranca() {
        assertThatThrownBy(() -> new ResponsableDeLaCopiaLocal(" ", "operaciones@example.pe"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("kamayuk.identidad.consumidor.responsable");
        assertThatThrownBy(() -> new ResponsableDeLaCopiaLocal("Quien atiende", ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(".canal");
    }

    private static EventoRecibido pospuesto(
            String tipo, long sujetoId, long secuencia, Instant creadoEn) {
        return new EventoRecibido(
                UUID.randomUUID(), secuencia, tipo, sujetoId, "{}", "b".repeat(64), creadoEn);
    }

    private static EventoRecibido evento() {
        return new EventoRecibido(
                UUID.fromString("00000000-0000-4000-8000-000000000042"),
                42,
                "USUARIO_DADO_DE_ALTA",
                7,
                "esto no es JSON",
                "a".repeat(64),
                Instant.parse("2026-09-09T12:00:00Z"));
    }
}
