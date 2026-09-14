package kamayuk.normativa.verificaciones;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import kamayuk.comun.verificaciones.contrato.FormaDeLaRespuesta;
import kamayuk.normativa.dominio.Alicuota;
import kamayuk.normativa.dominio.AreaM2;
import kamayuk.normativa.dominio.Dinero;
import kamayuk.normativa.dominio.Porcentaje;
import kamayuk.normativa.dominio.ValorNormativo;
import kamayuk.normativa.web.ConfiguracionDeJson;
import kamayuk.normativa.web.ImporteActualizado;
import kamayuk.normativa.web.RespuestaPaginada;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * La forma que {@link FormaDeLaRespuesta} describe es la que Jackson emite (#49).
 *
 * <h2>Por que hace falta</h2>
 *
 * <p>{@code docs/50-api/formas-de-la-api.json} lo deriva {@link FormasDeLaApiTest} de los {@code
 * record} de cada controlador. Todo eso descansa en una traduccion escrita a mano —de tipos de Java
 * a hojas de JSON— y esa traduccion <b>ya se equivoco una vez</b> en {@code rentas}: {@code Dinero}
 * es un record, asi que salia como <code>{valor: numero}</code> cuando {@code ConfiguracionDeJson}
 * lo serializa con {@code writeString} (RNF-055). No lo detecto nada, porque el comparador del
 * frontend ve una cadena donde la forma dice objeto, no puede comparar y se calla.
 *
 * <p>Asi que aqui no se razona sobre lo que Jackson emite: <b>se le hace emitir</b>. Se serializa
 * una respuesta con el mismo modulo que registra <b>esta</b> aplicacion —el {@code
 * ConfiguracionDeJson} de {@code kamayuk-normativa-plataforma}, que es copia del de {@code rentas}
 * y puede divergir de el— y se compara su arbol de claves con lo que el resolutor compartido dice
 * de ese mismo tipo.
 *
 * <h2>Por que un ejemplo y no los recursos publicados</h2>
 *
 * <p>Porque los recursos de hoy no llevan ninguno de los cuatro objetos de valor que se serializan
 * como cadena, ni un instante junto a un enumerado: compararlos dejaria sin probar justo lo que
 * puede equivocarse. El ejemplo lleva <b>eso</b>: el sobre paginado, los cuatro objetos de valor de
 * {@code ConfiguracionDeJson}, un record que <b>si</b> sale como objeto ({@link
 * ImporteActualizado}), un record anidado, una lista de records, una fecha, un instante, un
 * enumerado y un nulo.
 */
@DisplayName("La forma descrita es la que Jackson emite")
class FormaSegunJacksonTest {

    /** Un enumerado sale como su nombre, que en JSON es una cadena. */
    enum EstadoDeEjemplo {
        SELLADO
    }

    /** Un record anidado dentro de otro, para que la comparacion baje un nivel. */
    record HijoDeEjemplo(String descripcion, AreaM2 area, @Nullable LocalDate desde) {}

    /**
     * Lo que puede equivocarse, en un solo recurso.
     *
     * <p>Los cuatro objetos de valor son records y se serializan como cadena; {@link
     * ImporteActualizado} es un record que <b>si</b> sale como objeto, y tenerlos juntos es lo que
     * distingue «es un record» de «se serializa como objeto».
     */
    record RecursoDeEjemplo(
            long id,
            String codigo,
            EstadoDeEjemplo estado,
            LocalDate fecha,
            Instant selladoEn,
            Dinero importe,
            Alicuota alicuota,
            Porcentaje porcentaje,
            AreaM2 area,
            ImporteActualizado conSuFecha,
            List<HijoDeEjemplo> hijos,
            @Nullable String sinValor) {}

    /** Un recurso que llevara el objeto de valor que {@code ConfiguracionDeJson} no registra. */
    record RecursoConValorNormativo(ValorNormativo uit) {}

    /** El metodo cuyo tipo de retorno describe el resolutor. Se lee por reflexion, no se llama. */
    RespuestaPaginada<RecursoDeEjemplo> ejemplo() {
        throw new UnsupportedOperationException("Solo se lee su tipo de retorno");
    }

    @Test
    @DisplayName("el arbol de claves coincide, campo a campo y nivel a nivel")
    void loDescritoYLoEmitidoCoinciden() throws Exception {
        Object descrito = FormaDeLaRespuesta.de(getClass().getDeclaredMethod("ejemplo"));

        Object emitido =
                clavesDe(
                        mapper().readValue(
                                        mapper().writeValueAsString(unaRespuesta()), Object.class));

        assertThat(emitido)
                .as(
                        "lo que Jackson emite y lo que «FormaDeLaRespuesta» dice de ese mismo tipo"
                                + " tienen que tener las mismas claves en los mismos sitios")
                .isEqualTo(clavesDe(descrito));
    }

    @Test
    @DisplayName("los cuatro objetos de valor salen como cadena, no como objeto")
    void losObjetosDeValorSalenComoCadena() {
        JsonMapper mapper = mapper();

        // La comprobacion de arriba compara claves, y una cadena y un objeto vacio
        // tienen las mismas: ninguna. Esta mira el JSON tal cual.
        assertThat(mapper.writeValueAsString(Dinero.de("1842.60"))).isEqualTo("\"1842.60\"");
        assertThat(mapper.writeValueAsString(Alicuota.de("0.60"))).isEqualTo("\"0.60\"");
        assertThat(mapper.writeValueAsString(Porcentaje.de("50.00"))).isEqualTo("\"50.00\"");
        assertThat(mapper.writeValueAsString(AreaM2.de("120.50"))).isEqualTo("\"120.50\"");
    }

    /**
     * La premisa de la rama del punto 6 que {@link FormasDeLaApiTest} decidio: prohibir {@code
     * ValorNormativo} en los recursos publicados en vez de registrarlo como cadena.
     *
     * <p>Se fija aqui para que la decision no se quede vieja en silencio. Si alguien registra
     * {@code ValorNormativo} en {@code ConfiguracionDeJson}, esto se pone rojo: el JSON ya sale
     * bien, y lo que queda es que {@code FormaDeLaRespuesta.COMO_CADENA} —compartida— lo nombre,
     * para que la forma publicada diga «texto». Entonces la prohibicion se puede cambiar por la
     * otra rama.
     */
    @Test
    @DisplayName("y un ValorNormativo saldria como numero JSON, que es por lo que se prohibe")
    void unValorNormativoSaldriaComoNumero() {
        assertThat(
                        mapper().writeValueAsString(
                                        new RecursoConValorNormativo(
                                                ValorNormativo.de("5350.000000"))))
                .as(
                        "ConfiguracionDeJson ya no emite ValorNormativo como numero. La prohibicion"
                                + " de FormasDeLaApiTest descansaba en eso: con el registro puesto,"
                                + " falta que FormaDeLaRespuesta.COMO_CADENA (comun-verificaciones)"
                                + " lo nombre, y entonces el punto 6 de #49 puede tomar la otra rama")
                .isEqualTo("{\"uit\":{\"valor\":5350.000000}}");
        assertThat(FormaDeLaRespuesta.deTipo(RecursoConValorNormativo.class))
                .as("y la forma publicada lo describiria como un objeto con un numero dentro")
                .isEqualTo(Map.of("uit", Map.of("valor", "numero")));
    }

    // ------------------------------------------------------------------

    private static JsonMapper mapper() {
        return JsonMapper.builder()
                .addModule(new ConfiguracionDeJson().moduloDeObjetosDeValor())
                .build();
    }

    private static RespuestaPaginada<RecursoDeEjemplo> unaRespuesta() {
        RecursoDeEjemplo recurso =
                new RecursoDeEjemplo(
                        1L,
                        "UIT",
                        EstadoDeEjemplo.SELLADO,
                        LocalDate.of(2026, 9, 6),
                        Instant.parse("2026-09-06T09:00:00Z"),
                        Dinero.de("1842.60"),
                        Alicuota.de("0.60"),
                        Porcentaje.de("50.00"),
                        AreaM2.de("120.50"),
                        new ImporteActualizado(Dinero.de("10.00"), LocalDate.of(2026, 9, 6)),
                        List.of(
                                new HijoDeEjemplo(
                                        "Piso 1", AreaM2.de("60.00"), LocalDate.of(2026, 1, 1))),
                        null);
        return new RespuestaPaginada<>(List.of(recurso), 0, 1, 1L, 1, false);
    }

    /**
     * El arbol de claves de un valor, sin sus datos: objetos con sus campos, listas con su primer
     * elemento y cualquier otra cosa como la cadena vacia.
     *
     * <p>Se reduce a claves porque lo que se compara son dos idiomas: el resolutor dice «texto» y
     * Jackson emite «1842.60». Lo que tiene que coincidir es <b>que campos hay y donde</b>.
     */
    private static Object clavesDe(@Nullable Object valor) {
        if (valor instanceof Map<?, ?> objeto) {
            Map<String, Object> claves = new LinkedHashMap<>();
            for (String clave :
                    new TreeSet<>(objeto.keySet().stream().map(String::valueOf).toList())) {
                claves.put(clave, clavesDe(objeto.get(clave)));
            }
            return claves;
        }
        if (valor instanceof List<?> lista) {
            List<Object> elementos = new ArrayList<>();
            if (!lista.isEmpty()) {
                elementos.add(clavesDe(lista.get(0)));
            }
            return elementos;
        }
        return "";
    }
}
