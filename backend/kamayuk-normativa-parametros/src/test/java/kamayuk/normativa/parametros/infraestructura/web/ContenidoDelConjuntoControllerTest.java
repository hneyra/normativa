package kamayuk.normativa.parametros.infraestructura.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
import kamayuk.normativa.dominio.ValorNormativo;
import kamayuk.normativa.dominio.Vigencia;
import kamayuk.normativa.parametros.aplicacion.AdministrarParametros;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.EstadoDelConjunto;
import kamayuk.normativa.parametros.dominio.LlaveDeParametro;
import kamayuk.normativa.parametros.dominio.ParametroTributario;
import kamayuk.normativa.parametros.dominio.ParametrosRepository;
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.persistencia.OrdenSeguro;
import kamayuk.normativa.web.ConfiguracionDeJson;
import kamayuk.normativa.web.GuardiaDeParametros;
import kamayuk.normativa.web.ManejadorDeErrores;
import kamayuk.normativa.web.ParametrosDePaginacion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

/**
 * #56 — Capa web: {@code GET /conjuntos/{id}/parametros} y {@code GET /parametros}.
 *
 * <h2>Que se mide aqui y que no</h2>
 *
 * <p>Aqui se mide el <b>borde</b>: la forma de la respuesta, que un conjunto <b>abierto</b> se
 * sirva —que es lo que el snapshot se niega a hacer—, que un identificador que no existe sea <b>404
 * y no un 200 con la lista vacia</b>, que un {@code ordenarPor} fuera de la lista blanca sea
 * <b>422</b> y que la cifra viaje como <b>cadena</b>. Lo que <b>no</b> se puede medir sin base de
 * datos es el aislamiento entre municipalidades —que un conjunto de otra tambien sea 404 y que el
 * listado no traiga sus filas—, y eso esta en {@code AislamientoDeLaLecturaDeParametrosTest},
 * contra PostgreSQL real, porque lo hace la politica RLS y no este codigo.
 *
 * <h2>Por que el 422 del orden se mide contra la lista blanca de verdad</h2>
 *
 * <p>El repositorio de mentira de esta prueba <b>no</b> escribe su propia lista de campos
 * admitidos: lee por reflexion el {@code ORDEN_PARAMETRO} de {@link ParametrosRepositoryJdbc}, que
 * es el que decide el 422 en produccion. Una copia local pasaria en verde el dia que la lista
 * blanca de verdad cambiara, que es justo el dia en que la interfaz empezaria a recibir 422 por un
 * campo que el contrato publica.
 */
@DisplayName("#56 — Capa web: el contenido de un conjunto y los parametros publicados")
class ContenidoDelConjuntoControllerTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-16T10:00:00Z"), ZoneOffset.UTC);

    /**
     * Un valor inventado, y dicho aqui para que no se confunda con uno real. No representa ninguna
     * UIT, ningun tramo y ninguna alicuota: sirve para que la fila exista (regla 5).
     */
    private static final String VALOR_FICTICIO = "1.500000";

    private static final long ABIERTO = 11L;
    private static final long SELLADO = 12L;
    private static final long NO_EXISTE = 999L;

    private final ParametrosDeMentira repositorio = new ParametrosDeMentira();
    private final List<RegistroDeAuditoria> bitacora = new ArrayList<>();

    private final AdministrarParametros administrar =
            new AdministrarParametros(repositorio, bitacora::add, RELOJ);

    private final MockMvc mvc =
            MockMvcBuilders.standaloneSetup(new ContenidoDelConjuntoController(administrar))
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
    void sembrar() {
        // GuardiaDeAcceso pide OrigenContext.actual() ANTES de entrar al controlador: sin esto
        // hasta el camino feliz daria 500, y se corregiria el controlador equivocado (#540).
        OrigenContext.fijar(new Origen("jefe.rentas", "PC-RENTAS-01", "10.2.2.2"));

        repositorio.conjunto(ABIERTO, new Ejercicio(2027), 2, EstadoDelConjunto.ABIERTO);
        repositorio.conjunto(SELLADO, new Ejercicio(2026), 1, EstadoDelConjunto.SELLADO);

        // Se siembran DESORDENADOS a proposito: el orden de la respuesta lo pone el caso de uso, y
        // con la lista ya ordenada esta prueba no distinguiria entre ordenar y no hacerlo.
        repositorio.dentroDe(ABIERTO, parametro(3L, "UIT", null, "2026-01-01"));
        repositorio.dentroDe(ABIERTO, parametro(1L, "FICTICIO", "ZONA_B", "2026-01-01"));
        repositorio.dentroDe(ABIERTO, parametro(2L, "UIT", null, "2025-01-01"));
        repositorio.dentroDe(SELLADO, parametro(4L, "FICTICIO", "ZONA_A", "2026-01-01"));
    }

    @AfterEach
    void limpiar() {
        OrigenContext.limpiar();
    }

    // ------------------------------------------------------------------
    //  AC 1 — GET /conjuntos/{id}/parametros
    // ------------------------------------------------------------------

    @Test
    @DisplayName("un conjunto ABIERTO se sirve entero: es el que el snapshot se niega a servir")
    void unConjuntoAbiertoSeSirve() throws Exception {
        MvcResult resultado = pedir("/conjuntos/" + ABIERTO + "/parametros");

        assertThat(resultado.getResponse().getStatus()).isEqualTo(200);
        String cuerpo = resultado.getResponse().getContentAsString();
        assertThat(cuerpo)
                .as(
                        "la hoja tiene que poder decir DE QUE conjunto habla sin otra peticion:"
                                + " ejercicio, version y estado van con la lista")
                .contains("\"ejercicio\":2027")
                .contains("\"version\":2")
                .contains("\"estado\":\"ABIERTO\"");
        assertThat(cuerpo).contains("\"UIT\"").contains("\"ZONA_B\"");
    }

    @Test
    @DisplayName("y uno SELLADO tambien: esta ruta no discrimina por estado")
    void unConjuntoSelladoTambienSeSirve() throws Exception {
        MvcResult resultado = pedir("/conjuntos/" + SELLADO + "/parametros");

        assertThat(resultado.getResponse().getStatus()).isEqualTo(200);
        assertThat(resultado.getResponse().getContentAsString())
                .contains("\"estado\":\"SELLADO\"")
                .contains("\"ZONA_A\"");
    }

    @Test
    @DisplayName("la fila lleva sus ocho campos, y la cifra como CADENA")
    void laFilaLlevaSusCamposYLaCifraComoCadena() throws Exception {
        String cuerpo =
                pedir("/conjuntos/" + SELLADO + "/parametros").getResponse().getContentAsString();

        assertThat(cuerpo)
                .contains("\"id\":4")
                .contains("\"tipo\":\"FICTICIO\"")
                .contains("\"clave\":\"ZONA_A\"")
                .contains("\"valorTexto\":null")
                .contains("\"vigenciaDesde\":\"2026-01-01\"")
                .contains("\"vigenciaHasta\":null")
                .contains("\"documentoFuente\":");
        assertThat(cuerpo)
                .as(
                        "ADR-0043 §1: la cifra viaja como cadena, NUNCA como numero JSON. Como"
                                + " numero, el navegador la lee en double y la redondea (regla 1,"
                                + " RNF-055)")
                .contains("\"valorNumerico\":\"" + VALOR_FICTICIO + "\"")
                .doesNotContain("\"valorNumerico\":" + VALOR_FICTICIO);
    }

    @Test
    @DisplayName("el contenido sale en orden TOTAL, y no en el que la consulta devolvio")
    void elContenidoSaleEnOrdenTotal() throws Exception {
        String cuerpo =
                pedir("/conjuntos/" + ABIERTO + "/parametros").getResponse().getContentAsString();

        // FICTICIO/ZONA_B, luego las dos UIT por vigencia: 2025 antes que 2026. La lista se sembro
        // 3, 1, 2; si el caso de uso no ordenara, saldria asi.
        assertThat(cuerpo.indexOf("\"id\":1")).isLessThan(cuerpo.indexOf("\"id\":2"));
        assertThat(cuerpo.indexOf("\"id\":2")).isLessThan(cuerpo.indexOf("\"id\":3"));
    }

    @Test
    @DisplayName("un conjunto que no existe es 404, y NO un 200 con la lista vacia")
    void unConjuntoQueNoExisteEs404() throws Exception {
        MvcResult resultado = pedir("/conjuntos/" + NO_EXISTE + "/parametros");

        assertThat(resultado.getResponse().getStatus())
                .as(
                        "`parametrosDe` de un conjunto que no existe devuelve lista vacia: servido"
                                + " tal cual, el 200 diria «existe y esta vacio» — y con RLS ese"
                                + " mismo 200 lo recibiria quien pide el conjunto de OTRA"
                                + " municipalidad")
                .isEqualTo(404);
        assertThat(resultado.getResponse().getContentAsString())
                .contains("No hay ningun conjunto de parametros con identificador " + NO_EXISTE);
    }

    // ------------------------------------------------------------------
    //  AC 2 — GET /parametros
    // ------------------------------------------------------------------

    @Test
    @DisplayName("el listado pagina y trae los publicados, con el sobre de siempre")
    void elListadoPaginaYTraeLosPublicados() throws Exception {
        MvcResult resultado = pedir("/parametros");

        assertThat(resultado.getResponse().getStatus()).isEqualTo(200);
        assertThat(resultado.getResponse().getContentAsString())
                .contains("\"contenido\":[")
                .contains("\"totalElementos\":4")
                .contains("\"totalPaginas\":1");
    }

    @Test
    @DisplayName("el orden por omision es `tipo`, y esta en la lista blanca de verdad")
    void elOrdenPorOmisionEsTipo() throws Exception {
        pedir("/parametros");

        assertThat(repositorio.ultimaPaginacion)
                .as("sin orden pedido, el que pone el controlador")
                .isNotNull();
        assertThat(repositorio.ultimaPaginacion.ordenarPor()).isEqualTo("tipo");
        assertThat(ordenDeVerdad().camposAdmitidos())
                .as("un orden por omision fuera de la lista blanca haria 422 TODA peticion")
                .contains("tipo");
    }

    @Test
    @DisplayName("un `ordenarPor` fuera de la lista blanca es 422 ORDEN_NO_ADMITIDO")
    void unOrdenFueraDeLaListaBlancaEs422() throws Exception {
        MvcResult resultado = pedir("/parametros?ordenarPor=valorNumerico");

        assertThat(resultado.getResponse().getStatus()).isEqualTo(422);
        assertThat(resultado.getResponse().getContentAsString())
                .contains("ORDEN_NO_ADMITIDO")
                .contains("valorNumerico");
    }

    @Test
    @DisplayName("y un parametro de consulta desconocido tambien es 422, nombrandolo")
    void unParametroDesconocidoEs422() throws Exception {
        MvcResult resultado = pedir("/parametros?tipo=UIT");

        assertThat(resultado.getResponse().getStatus())
                .as(
                        "ADR-0043 §1: esta ruta va SIN filtros. Ignorar `tipo` devolveria la lista"
                                + " entera a quien pidio una parte, que es el defecto de #539")
                .isEqualTo(422);
        assertThat(resultado.getResponse().getContentAsString()).contains("tipo");
    }

    // ------------------------------------------------------------------
    //  AC 4 — que acceso exige cada ruta, que es lo que ArchUnit no ve
    // ------------------------------------------------------------------

    @Test
    @DisplayName("las dos rutas exigen el mismo acceso con privilegio de LECTURA")
    void lasDosRutasDeclaranSuAcceso() throws NoSuchMethodException {
        RequiereAcceso delContenido =
                anotacionDe(
                        ContenidoDelConjuntoController.class.getMethod("contenido", long.class));
        RequiereAcceso delListado =
                anotacionDe(
                        ContenidoDelConjuntoController.class.getMethod(
                                "publicados", ParametrosDePaginacion.class));

        assertThat(delContenido)
                .as("sin la anotacion no hay guardia, y `verificarArquitectura` se pone rojo")
                .isNotNull();
        assertThat(delListado).isNotNull();
        assertThat(delContenido.privilegio()).isEqualTo(Privilegio.LECTURA);
        assertThat(delListado.privilegio()).isEqualTo(Privilegio.LECTURA);
        assertThat(delContenido.acceso())
                .as(
                        "las dos leen el mismo recurso —un conjunto y lo que lleva dentro— asi que"
                                + " exigen la misma opcion. ADR-0043 §2 la mueve a `conjuntos` con"
                                + " `oTambien = parametros` cuando #53 declare el modulo NORMATIVA;"
                                + " hasta entonces es la unica opcion que este sistema tiene, y"
                                + " `CatalogoDelSistemaTest` no admite ninguna otra")
                .isEqualTo(delListado.acceso())
                .isEqualTo("parametros");
    }

    @Test
    @DisplayName("ninguna de las dos lecturas deja fila en la bitacora")
    void ningunaLecturaAudita() throws Exception {
        pedir("/conjuntos/" + ABIERTO + "/parametros");
        pedir("/conjuntos/" + SELLADO + "/parametros");
        pedir("/parametros");

        assertThat(bitacora)
                .as(
                        "`Operacion.ACCESO` es «entrada o salida del sistema», y ningun caso de uso"
                                + " de este repositorio audita una lectura. Auditar aqui pondria una"
                                + " escritura sin cota sobre una tabla sin DELETE (regla 4,"
                                + " RNF-051) al alcance de quien recorra identificadores")
                .isEmpty();
    }

    // ------------------------------------------------------------------

    private MvcResult pedir(String ruta) throws Exception {
        return mvc.perform(get("/normativa/api/v1" + ruta)).andReturn();
    }

    private static RequiereAcceso anotacionDe(Method metodo) {
        return AnnotatedElementUtils.findMergedAnnotation(metodo, RequiereAcceso.class);
    }

    private static ParametroTributario parametro(long id, String tipo, String clave, String desde) {
        return new ParametroTributario(
                id,
                tipo,
                clave,
                ValorNormativo.de(VALOR_FICTICIO),
                null,
                new Vigencia(LocalDate.parse(desde), null),
                "Valor ficticio de prueba; no representa ninguna norma");
    }

    /** La lista blanca de verdad, la que decide el 422 en produccion. */
    private static OrdenSeguro ordenDeVerdad() {
        try {
            Field campo = ParametrosRepositoryJdbc.class.getDeclaredField("ORDEN_PARAMETRO");
            campo.setAccessible(true);
            return (OrdenSeguro) campo.get(null);
        } catch (ReflectiveOperationException noSePudo) {
            throw new IllegalStateException(
                    "No se pudo leer ORDEN_PARAMETRO de ParametrosRepositoryJdbc: sin el, esta"
                            + " prueba mediria una copia y no la lista blanca que contesta el 422",
                    noSePudo);
        }
    }

    /**
     * Lo justo para el borde: conjuntos, su contenido y el listado de publicados.
     *
     * <p>El aislamiento —que un conjunto de otra municipalidad no se vea— lo hace la politica RLS,
     * no este objeto: imitarlo aqui seria una prueba de la imitacion.
     */
    private static final class ParametrosDeMentira implements ParametrosRepository {

        private final Map<Long, ConjuntoDeParametros> conjuntos = new HashMap<>();
        private final Map<Long, List<ParametroTributario>> contenido = new HashMap<>();
        private final List<ParametroTributario> publicados = new ArrayList<>();

        private Paginacion ultimaPaginacion;

        void conjunto(long id, Ejercicio ejercicio, int version, EstadoDelConjunto estado) {
            conjuntos.put(
                    id,
                    new ConjuntoDeParametros(
                            id,
                            ejercicio,
                            version,
                            estado,
                            estado == EstadoDelConjunto.SELLADO
                                    ? Instant.parse("2026-09-06T12:00:00Z")
                                    : null,
                            estado == EstadoDelConjunto.SELLADO ? "jefe.rentas" : null));
        }

        void dentroDe(long conjuntoId, ParametroTributario parametro) {
            contenido.computeIfAbsent(conjuntoId, id -> new ArrayList<>()).add(parametro);
            publicados.add(parametro);
        }

        @Override
        public Optional<ConjuntoDeParametros> conjunto(long id) {
            return Optional.ofNullable(conjuntos.get(id));
        }

        @Override
        public List<ParametroTributario> parametrosDe(long conjuntoId) {
            // Tal cual se sembro, sin ordenar: es lo que hace la consulta con las filas que
            // empatan, y lo que el caso de uso tiene que arreglar.
            return List.copyOf(contenido.getOrDefault(conjuntoId, List.of()));
        }

        @Override
        public Pagina<ParametroTributario> parametros(Paginacion paginacion) {
            ultimaPaginacion = paginacion;
            // El 422 sale de la lista blanca DE VERDAD, que es la que valida `RepositorioJdbc`
            // antes de concatenar el ORDER BY.
            ordenDeVerdad().clausula(paginacion);
            return Pagina.de(publicados, paginacion, publicados.size());
        }

        @Override
        public Pagina<ConjuntoDeParametros> conjuntos(Paginacion paginacion) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }

        @Override
        public Optional<ConjuntoDeParametros> selladoVigenteDe(Ejercicio ejercicio) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }

        @Override
        public Optional<ConjuntoDeParametros> selladoPorId(long id) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }

        @Override
        public int ultimaVersionDe(Ejercicio ejercicio) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }

        @Override
        public ConjuntoDeParametros crear(ConjuntoDeParametros conjunto) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }

        @Override
        public ConjuntoDeParametros sellar(long conjuntoId, Instant cuando, String quien) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }

        @Override
        public void agregarParametro(long conjuntoId, long parametroId) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }

        @Override
        public List<ParametroTributario> publicados(LlaveDeParametro llave) {
            throw new UnsupportedOperationException("no lo usa esta prueba");
        }
    }

    /**
     * Autoriza todo: lo que aqui se mide es la ruta, no el guardia (eso es GuardiaDeAccesoTest).
     */
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
