package kamayuk.normativa.parametros.infraestructura.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.auditoria.RegistroDeAuditoria;
import kamayuk.normativa.autorizacion.ComprobadorDeAcceso;
import kamayuk.normativa.autorizacion.GuardiaDeAcceso;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.autorizacion.RequiereAcceso;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.parametros.aplicacion.AdministrarParametros;
import kamayuk.normativa.parametros.aplicacion.EscriturasDelConjunto;
import kamayuk.normativa.parametros.dominio.ClaveDeIdempotencia;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.LlaveDeParametro;
import kamayuk.normativa.parametros.dominio.ParametroTributario;
import kamayuk.normativa.parametros.dominio.ParametrosRepository;
import kamayuk.normativa.web.ConfiguracionDeJson;
import kamayuk.normativa.web.GuardiaDeParametros;
import kamayuk.normativa.web.ManejadorDeErrores;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.ResponseStatus;
import tools.jackson.databind.json.JsonMapper;

/**
 * #59 — El borde de las tres escrituras: lo que se contesta <b>antes</b> de llegar a la base.
 *
 * <h2>Que se mide aqui y que no</h2>
 *
 * <p>Aqui se mide que toda peticion mal formada sea <b>422 nombrando lo que falta o no vale, y
 * nunca 500</b> (ADR-0043 §6 y §7), y que ninguna llegue a escribir: el repositorio de esta prueba
 * <b>revienta</b> si alguien lo llama, y la bitacora tiene que quedar vacia. Lo que pasa cuando la
 * peticion si es buena —codigos, idempotencia, carreras, auditoria— se mide contra PostgreSQL en
 * {@code EscriturasDelConjuntoDePuntaAPuntaTest}, porque lo deciden los indices y los disparadores
 * de la base.
 *
 * <h2>La observacion, en las tres rutas y de las cinco maneras (AC 4)</h2>
 *
 * <p>Ausente, nula, en blanco, corta y larga, en cada una de las tres rutas: quince peticiones, y
 * las quince tienen que salir 422 con {@code observacion} en el mensaje. Es la prueba que {@code
 * rentas} escribio en su #30 ({@code NingunaEscrituraSeRompePorLaObservacionTest}), y la razon es
 * la misma: con el {@code Objects.requireNonNull} que {@code Observacion} tenia hasta #59, la
 * ausente y la nula salian 500 con incidencia.
 */
@DisplayName("#59 — Capa web: las tres escrituras contestan 422, y no 500, a lo mal formado")
class EscriturasDelConjuntoControllerTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-29T10:00:00Z"), ZoneOffset.UTC);

    private static final String RAIZ = "/normativa/api/v1";

    private static final String CLAVE = "abrir-2027-intento-1";

    private final List<RegistroDeAuditoria> bitacora = new ArrayList<>();

    private final MockMvc mvc =
            MockMvcBuilders.standaloneSetup(
                            new EscriturasDelConjuntoController(
                                    new EscriturasDelConjunto(
                                            new AdministrarParametros(
                                                    new NadaLlegaALaBase(), bitacora::add, RELOJ))))
                    .addInterceptors(
                            new GuardiaDeAcceso(new TodoAutorizado(), RELOJ),
                            new GuardiaDeParametros())
                    .setControllerAdvice(new ManejadorDeErrores())
                    .setMessageConverters(
                            new JacksonJsonHttpMessageConverter(
                                    JsonMapper.builder()
                                            .addModule(
                                                    new ConfiguracionDeJson()
                                                            .moduloDeObjetosDeValor())
                                            .build()))
                    .build();

    @BeforeEach
    void fijarOrigen() {
        // GuardiaDeAcceso pide OrigenContext.actual() ANTES de entrar al controlador.
        OrigenContext.fijar(new Origen("jefe.rentas", "PC-RENTAS-01", "10.2.2.2"));
    }

    @AfterEach
    void limpiar() {
        OrigenContext.limpiar();
        assertThat(bitacora)
                .as("una peticion rechazada en el borde no deja fila en la bitacora")
                .isEmpty();
    }

    // ------------------------------------------------------------------
    //  AC 4 — la observacion nunca da 500
    // ------------------------------------------------------------------

    /** Las cinco maneras de no traer una observacion valida, con su nombre y su fragmento JSON. */
    private static final List<List<String>> OBSERVACIONES_QUE_NO_VALEN =
            List.of(
                    List.of("ausente", ""),
                    List.of("nula", "\"observacion\":null"),
                    List.of("en blanco", "\"observacion\":\"     \""),
                    List.of("de 4 caracteres", "\"observacion\":\"abcd\""),
                    List.of("de 501 caracteres", "\"observacion\":\"" + "a".repeat(501) + "\""));

    static Stream<Arguments> lasTresRutasPorLasCincoObservaciones() {
        List<Arguments> casos = new ArrayList<>();
        for (List<String> caso : OBSERVACIONES_QUE_NO_VALEN) {
            String nombre = caso.get(0);
            String observacion = caso.get(1);
            casos.add(
                    Arguments.of(
                            "POST /conjuntos", nombre, abrir("\"ejercicio\":2027", observacion)));
            casos.add(
                    Arguments.of(
                            "POST /conjuntos/{id}/parametros",
                            nombre,
                            agregar(
                                    "\"tipo\":\"FICTICIO\",\"clave\":\"A\","
                                            + "\"vigenciaDesde\":\"2026-01-01\"",
                                    observacion)));
            casos.add(
                    Arguments.of(
                            "POST /conjuntos/{id}/sellar",
                            nombre,
                            sellar("\"arancelDeLaMunicipalidad\":\"SIN_CARGAR\"", observacion)));
        }
        return casos.stream();
    }

    @ParameterizedTest(name = "{0} con la observacion {1}")
    @MethodSource("lasTresRutasPorLasCincoObservaciones")
    @DisplayName("ausente, nula, en blanco, corta o larga: 422 nombrando la observacion")
    void laObservacionNuncaDa500(String ruta, String caso, MockHttpServletRequestBuilder peticion)
            throws Exception {
        MvcResult resultado = mvc.perform(peticion).andReturn();

        assertThat(resultado.getResponse().getStatus())
                .as(
                        "%s con la observacion %s: ADR-0043 §6 — la observacion es del"
                                + " cliente, y lo que le falta a su peticion no es una incidencia"
                                + " del servidor. Contesto: %s",
                        ruta, caso, resultado.getResponse().getContentAsString())
                .isEqualTo(422);
        assertThat(resultado.getResponse().getContentAsString())
                .contains("VALIDACION")
                .contains("observacion")
                .doesNotContain("incidencia");
    }

    // ------------------------------------------------------------------
    //  ADR-0043 §5 — Idempotency-Key, obligatoria y con forma
    // ------------------------------------------------------------------

    @Test
    @DisplayName("abrir sin Idempotency-Key es 422, nombrando la cabecera")
    void abrirSinClaveEs422() throws Exception {
        MvcResult resultado =
                mvc.perform(
                                post(RAIZ + "/conjuntos")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"ejercicio\":2027,\"observacion\":\"Se abre el"
                                                        + " ejercicio 2027\"}"))
                        .andReturn();

        assertThat(resultado.getResponse().getStatus())
                .as(
                        "obligatoria, y no opcional como en rentas: sin ella un reintento abre otra"
                                + " version que no se puede borrar (ADR-0043 §5)")
                .isEqualTo(422);
        assertThat(resultado.getResponse().getContentAsString()).contains("Idempotency-Key");
    }

    @ParameterizedTest(name = "«{0}»")
    @ValueSource(
            strings = {
                "",
                "con espacio",
                "\tcon-tabulador",
                "clave-con-eñe",
                "abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij12345"
            })
    @DisplayName("una clave fuera de 1 a 64 ASCII visibles es 422, nombrando la cabecera")
    void unaClaveFueraDeFormaEs422(String clave) throws Exception {
        MvcResult resultado =
                mvc.perform(
                                post(RAIZ + "/conjuntos")
                                        .header(ClaveDeIdempotencia.CABECERA, clave)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"ejercicio\":2027,\"observacion\":\"Se abre el"
                                                        + " ejercicio 2027\"}"))
                        .andReturn();

        assertThat(resultado.getResponse().getStatus()).isEqualTo(422);
        assertThat(resultado.getResponse().getContentAsString()).contains("Idempotency-Key");
    }

    // ------------------------------------------------------------------
    //  Lo demas que el cuerpo exige
    // ------------------------------------------------------------------

    @Test
    @DisplayName("abrir sin ejercicio es 422 nombrandolo, y fuera de rango tambien")
    void abrirSinEjercicio() throws Exception {
        MvcResult sinEjercicio =
                mvc.perform(abrir("", "\"observacion\":\"Se abre un ejercicio\"")).andReturn();
        MvcResult fueraDeRango =
                mvc.perform(abrir("\"ejercicio\":1900", "\"observacion\":\"Se abre un ejercicio\""))
                        .andReturn();

        assertThat(sinEjercicio.getResponse().getStatus()).isEqualTo(422);
        assertThat(sinEjercicio.getResponse().getContentAsString()).contains("«ejercicio»");
        assertThat(fueraDeRango.getResponse().getStatus())
                .as("lo rechaza el constructor de Ejercicio, y el borde lo traduce")
                .isEqualTo(422);
        assertThat(fueraDeRango.getResponse().getContentAsString()).contains("fuera de rango");
    }

    @Test
    @DisplayName("agregar con la llave incompleta o una fecha que no es fecha es 422")
    void agregarConLaLlaveIncompleta() throws Exception {
        String observacion = "\"observacion\":\"Se agrega el parametro de la ordenanza\"";

        MvcResult sinTipo =
                mvc.perform(agregar("\"vigenciaDesde\":\"2026-01-01\"", observacion)).andReturn();
        MvcResult sinVigencia =
                mvc.perform(agregar("\"tipo\":\"FICTICIO\"", observacion)).andReturn();
        MvcResult fechaMala =
                mvc.perform(
                                agregar(
                                        "\"tipo\":\"FICTICIO\",\"vigenciaDesde\":\"2026-13-01\"",
                                        observacion))
                        .andReturn();

        assertThat(sinTipo.getResponse().getStatus()).isEqualTo(422);
        assertThat(sinTipo.getResponse().getContentAsString()).contains("«tipo»");
        assertThat(sinVigencia.getResponse().getStatus()).isEqualTo(422);
        assertThat(sinVigencia.getResponse().getContentAsString()).contains("«vigenciaDesde»");
        assertThat(fechaMala.getResponse().getStatus())
                .as(
                        "un LocalDate.parse sin atrapar seria un DateTimeParseException, que no es"
                                + " IllegalArgumentException: 500")
                .isEqualTo(422);
        assertThat(fechaMala.getResponse().getContentAsString())
                .contains("vigenciaDesde")
                .contains("2026-13-01");
    }

    @ParameterizedTest(name = "«{0}»")
    @ValueSource(
            strings = {
                "",
                "\"arancelDeLaMunicipalidad\":null",
                "\"arancelDeLaMunicipalidad\":\"sin_cargar\"",
                "\"arancelDeLaMunicipalidad\":\"CARGADO\""
            })
    @DisplayName("sellar sin la declaracion del arancel, o con otra, es 422 nombrando el campo")
    void sellarSinLaDeclaracion(String declaracion) throws Exception {
        MvcResult resultado =
                mvc.perform(
                                sellar(
                                        declaracion,
                                        "\"observacion\":\"Se sella tras revisar el conjunto\""))
                        .andReturn();

        assertThat(resultado.getResponse().getStatus())
                .as(
                        "ADR-0043 §8: sin valor por omision —un valor por omision seria una"
                                + " declaracion que nadie hizo—, y sin leer en minusculas")
                .isEqualTo(422);
        assertThat(resultado.getResponse().getContentAsString())
                .contains("arancelDeLaMunicipalidad");
    }

    @Test
    @DisplayName("un cuerpo que no es JSON, o que no se declara JSON, es 422")
    void unCuerpoIlegibleEs422() throws Exception {
        MvcResult noEsJson =
                mvc.perform(
                                post(RAIZ + "/conjuntos/7/sellar")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{no-json"))
                        .andReturn();
        MvcResult textoPlano =
                mvc.perform(
                                post(RAIZ + "/conjuntos/7/sellar")
                                        .contentType(MediaType.TEXT_PLAIN)
                                        .content("observacion=hola"))
                        .andReturn();

        assertThat(noEsJson.getResponse().getStatus()).isEqualTo(422);
        assertThat(textoPlano.getResponse().getStatus())
                .as("hasta #59, HttpMediaTypeNotSupportedException caia en el 500")
                .isEqualTo(422);
    }

    // ------------------------------------------------------------------
    //  AC 3 — acceso, privilegio y codigo de exito, que ArchUnit no ve
    // ------------------------------------------------------------------

    @Test
    @DisplayName("las tres exigen `conjuntos` sin alternativa: REGISTRO, REGISTRO y ESPECIAL")
    void lasTresDeclaranSuAcceso() throws NoSuchMethodException {
        RequiereAcceso abrir = anotacionDe(metodo("abrir"));
        RequiereAcceso agregar = anotacionDe(metodo("agregar"));
        RequiereAcceso sellar = anotacionDe(metodo("sellar"));

        assertThat(List.of(abrir.acceso(), agregar.acceso(), sellar.acceso()))
                .containsOnly("conjuntos");
        assertThat(List.of(abrir.oTambien(), agregar.oTambien(), sellar.oTambien()))
                .as(
                        "ADR-0043 §2: `oTambien = \"parametros\"` daria componer y sellar a todo el"
                                + " que tenga esos privilegios sobre la opcion del modulo Seguridad")
                .allSatisfy(alternativas -> assertThat(alternativas).isEmpty());
        assertThat(abrir.privilegio()).isEqualTo(Privilegio.REGISTRO);
        assertThat(agregar.privilegio()).isEqualTo(Privilegio.REGISTRO);
        assertThat(sellar.privilegio())
                .as(
                        "sellar es el acto que no se deshace: quien concede MODIFICACION para"
                                + " corregir algo no debe estar concediendo el sello (ADR-0043 §1)")
                .isEqualTo(Privilegio.ESPECIAL);
    }

    @Test
    @DisplayName("abrir y agregar contestan 201; sellar, 200: no crea un recurso")
    void losCodigosDeExito() throws NoSuchMethodException {
        assertThat(estadoDeExito(metodo("abrir"))).isEqualTo(HttpStatus.CREATED);
        assertThat(estadoDeExito(metodo("agregar"))).isEqualTo(HttpStatus.CREATED);
        assertThat(estadoDeExito(metodo("sellar"))).isEqualTo(HttpStatus.OK);
    }

    // ------------------------------------------------------------------

    private static MockHttpServletRequestBuilder abrir(String campos, String observacion) {
        return post(RAIZ + "/conjuntos")
                .header(ClaveDeIdempotencia.CABECERA, CLAVE)
                .contentType(MediaType.APPLICATION_JSON)
                .content(cuerpo(campos, observacion));
    }

    private static MockHttpServletRequestBuilder agregar(String campos, String observacion) {
        return post(RAIZ + "/conjuntos/7/parametros")
                .contentType(MediaType.APPLICATION_JSON)
                .content(cuerpo(campos, observacion));
    }

    private static MockHttpServletRequestBuilder sellar(String campos, String observacion) {
        return post(RAIZ + "/conjuntos/7/sellar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(cuerpo(campos, observacion));
    }

    private static String cuerpo(String campos, String observacion) {
        if (campos.isEmpty()) {
            return "{" + observacion + "}";
        }
        return "{" + campos + (observacion.isEmpty() ? "" : "," + observacion) + "}";
    }

    private static Method metodo(String nombre) throws NoSuchMethodException {
        for (Method metodo : EscriturasDelConjuntoController.class.getDeclaredMethods()) {
            if (metodo.getName().equals(nombre)) {
                return metodo;
            }
        }
        throw new NoSuchMethodException(nombre);
    }

    private static RequiereAcceso anotacionDe(Method metodo) {
        RequiereAcceso anotacion =
                AnnotatedElementUtils.findMergedAnnotation(metodo, RequiereAcceso.class);
        assertThat(anotacion)
                .as("%s sin @RequiereAcceso no tiene guardia", metodo.getName())
                .isNotNull();
        return anotacion;
    }

    private static HttpStatus estadoDeExito(Method metodo) {
        ResponseStatus estado =
                AnnotatedElementUtils.findMergedAnnotation(metodo, ResponseStatus.class);
        return estado == null ? HttpStatus.OK : estado.code();
    }

    /** Revienta en cuanto alguien lo llama: todo lo de esta prueba se contesta antes de la base. */
    private static final class NadaLlegaALaBase implements ParametrosRepository {

        private static AssertionError noDebiaLlegar() {
            return new AssertionError(
                    "Esta peticion no debia llegar a la base: se tenia que contestar en el borde");
        }

        @Override
        public Pagina<ConjuntoDeParametros> conjuntos(Paginacion paginacion) {
            throw noDebiaLlegar();
        }

        @Override
        public Optional<ConjuntoDeParametros> conjunto(long id) {
            throw noDebiaLlegar();
        }

        @Override
        public Optional<ConjuntoDeParametros> selladoVigenteDe(Ejercicio ejercicio) {
            throw noDebiaLlegar();
        }

        @Override
        public Optional<ConjuntoDeParametros> selladoPorId(long id) {
            throw noDebiaLlegar();
        }

        @Override
        public int ultimaVersionDe(Ejercicio ejercicio) {
            throw noDebiaLlegar();
        }

        @Override
        public ConjuntoDeParametros crear(ConjuntoDeParametros conjunto) {
            throw noDebiaLlegar();
        }

        @Override
        public ConjuntoDeParametros crear(
                ConjuntoDeParametros conjunto, ClaveDeIdempotencia clave) {
            throw noDebiaLlegar();
        }

        @Override
        public Optional<ConjuntoDeParametros> abiertoConLaClave(ClaveDeIdempotencia clave) {
            throw noDebiaLlegar();
        }

        @Override
        public ConjuntoDeParametros sellar(long conjuntoId, Instant cuando, String quien) {
            throw noDebiaLlegar();
        }

        @Override
        public void agregarParametro(long conjuntoId, long parametroId) {
            throw noDebiaLlegar();
        }

        @Override
        public boolean contiene(long conjuntoId, long parametroId) {
            throw noDebiaLlegar();
        }

        @Override
        public List<ParametroTributario> parametrosDe(long conjuntoId) {
            throw noDebiaLlegar();
        }

        @Override
        public List<ParametroTributario> publicados(LlaveDeParametro llave) {
            throw noDebiaLlegar();
        }

        @Override
        public Pagina<ParametroTributario> parametros(Paginacion paginacion) {
            throw noDebiaLlegar();
        }
    }

    /** Autoriza todo: lo que aqui se mide es el cuerpo, no el guardia. */
    private static final class TodoAutorizado implements ComprobadorDeAcceso {
        @Override
        public boolean autoriza(
                String usuario, String acceso, Privilegio privilegio, LocalDate fecha) {
            return true;
        }

        @Override
        public boolean conoceAlUsuario(String usuario) {
            return true;
        }
    }
}
