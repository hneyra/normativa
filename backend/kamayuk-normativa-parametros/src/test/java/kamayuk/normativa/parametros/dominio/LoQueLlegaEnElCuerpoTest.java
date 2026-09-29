package kamayuk.normativa.parametros.dominio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * #59 — Los tres objetos de valor que llegan por HTTP en las escrituras del conjunto rechazan lo
 * que no vale con un {@link IllegalArgumentException} que nombra el campo, <b>nulo incluido</b>.
 *
 * <p>El borde traduce ese y solo ese a 422; cualquier otra excepcion —un {@link
 * NullPointerException} de un {@code requireNonNull}— sale 500 con incidencia (ADR-0043 §6 y §7).
 */
@DisplayName("#59 — Lo que llega en el cuerpo y en la cabecera, validado donde pasan todas")
class LoQueLlegaEnElCuerpoTest {

    @Nested
    @DisplayName("ClaveDeIdempotencia: de 1 a 64 ASCII visibles, sin normalizar (ADR-0043 §5)")
    class Clave {

        @Test
        @DisplayName("admite los dos extremos del rango visible y el largo maximo")
        void admiteLosExtremos() {
            assertThat(new ClaveDeIdempotencia("!").valor()).isEqualTo("!");
            assertThat(new ClaveDeIdempotencia("~").valor()).isEqualTo("~");
            assertThat(new ClaveDeIdempotencia("a".repeat(64)).valor()).hasSize(64);
            assertThat(new ClaveDeIdempotencia("9f8c1e2a-4b7d-4c1e-9a3b-7e2f1d0c5b6a").valor())
                    .as("un UUID, que es lo que manda una interfaz")
                    .isEqualTo("9f8c1e2a-4b7d-4c1e-9a3b-7e2f1d0c5b6a");
        }

        @Test
        @DisplayName("no recorta ni cambia mayusculas: dos claves parecidas son dos claves")
        void noNormaliza() {
            assertThat(new ClaveDeIdempotencia("Clave-1"))
                    .isNotEqualTo(new ClaveDeIdempotencia("clave-1"));
            assertThatThrownBy(() -> new ClaveDeIdempotencia(" clave-1"))
                    .as("recortarla haria pasar por reintento una peticion distinta")
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @ParameterizedTest(name = "«{0}»")
        @ValueSource(strings = {"", " ", "con espacio", "tab\tulador", "eñe", "\u007f", "é"})
        @DisplayName("rechaza vacia, espacios, controles y todo lo que no es ASCII visible")
        void rechazaLoQueNoEsVisible(String clave) {
            assertThatThrownBy(() -> new ClaveDeIdempotencia(clave))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining(ClaveDeIdempotencia.CABECERA);
        }

        @Test
        @DisplayName("rechaza la de 65, y la nula como dato invalido y no como defecto")
        void rechazaLaLargaYLaNula() {
            assertThatThrownBy(() -> new ClaveDeIdempotencia("a".repeat(65)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("64");
            assertThatThrownBy(() -> new ClaveDeIdempotencia(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining(ClaveDeIdempotencia.CABECERA);
        }
    }

    @Nested
    @DisplayName("DeclaracionDelArancel: dos valores y ninguno por omision (ADR-0043 §8)")
    class Declaracion {

        @Test
        @DisplayName("lee los dos valores tal cual")
        void leeLosDos() {
            assertThat(DeclaracionDelArancel.de("DECLARADO_CARGADO"))
                    .isEqualTo(DeclaracionDelArancel.DECLARADO_CARGADO);
            assertThat(DeclaracionDelArancel.de("SIN_CARGAR"))
                    .isEqualTo(DeclaracionDelArancel.SIN_CARGAR);
        }

        @ParameterizedTest(name = "«{0}»")
        @ValueSource(strings = {"", "sin_cargar", " SIN_CARGAR", "CARGADO", "SI"})
        @DisplayName("rechaza cualquier otra cosa, nombrando el campo y los dos admitidos")
        void rechazaLoDemas(String valor) {
            assertThatThrownBy(() -> DeclaracionDelArancel.de(valor))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining(DeclaracionDelArancel.CAMPO)
                    .hasMessageContaining("DECLARADO_CARGADO")
                    .hasMessageContaining("SIN_CARGAR");
        }

        @Test
        @DisplayName(
                "y la ausente no se convierte en ninguna: seria una declaracion que nadie hizo")
        void laAusenteNoEsNinguna() {
            assertThatThrownBy(() -> DeclaracionDelArancel.de(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining(DeclaracionDelArancel.CAMPO);
        }
    }

    @Nested
    @DisplayName("LlaveDeParametro: sin tipo o sin vigencia no hay llave (ADR-0043 §6)")
    class Llave {

        @Test
        @DisplayName("sin tipo o sin vigenciaDesde, un 422 que nombra el campo y no un 500")
        void losNulosNombranElCampo() {
            assertThatThrownBy(() -> new LlaveDeParametro(null, "A", LocalDate.of(2026, 1, 1)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("'tipo'");
            assertThatThrownBy(() -> new LlaveDeParametro("FICTICIO", "A", null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("'vigenciaDesde'");
        }

        @Test
        @DisplayName("recorta el tipo y lleva a nulo la clave en blanco, como antes")
        void normalizaComoAntes() {
            LlaveDeParametro llave =
                    new LlaveDeParametro("  FICTICIO ", "   ", LocalDate.of(2026, 1, 1));
            assertThat(llave.tipo()).isEqualTo("FICTICIO");
            assertThat(llave.clave()).isNull();
            assertThatThrownBy(() -> new LlaveDeParametro("  ", "A", LocalDate.of(2026, 1, 1)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("vacio");
        }
    }
}
