package kamayuk.normativa.seguridad.infraestructura.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.autorizacion.ComprobadorDeAcceso;
import kamayuk.normativa.autorizacion.GuardiaDeAcceso;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.persistencia.OrdenSeguro;
import kamayuk.normativa.seguridad.aplicacion.ConsultaDelCatalogo;
import kamayuk.normativa.seguridad.aplicacion.LecturasDeLaSesion;
import kamayuk.normativa.seguridad.dominio.AccesoDelSistema;
import kamayuk.normativa.seguridad.dominio.Identidad;
import kamayuk.normativa.seguridad.dominio.LecturaDeLaCopiaLocal;
import kamayuk.normativa.seguridad.dominio.ModuloDelSistema;
import kamayuk.normativa.seguridad.dominio.Municipalidad;
import kamayuk.normativa.web.ConfiguracionDeJson;
import kamayuk.normativa.web.GuardiaDeParametros;
import kamayuk.normativa.web.ManejadorDeErrores;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

/**
 * Capa web de #54 — las cinco lecturas de seguridad, sin base de datos.
 *
 * <h2>Que se mide aqui y que no</h2>
 *
 * <p>Aqui el <b>transporte</b>: el estado HTTP, la forma exacta del JSON —los nombres de campo que
 * lee la interfaz de {@code rentas}, en su orden—, la paginacion, los privilegios en minuscula, que
 * una cuenta sin permisos reciba {@code {}} y no un 403, que una cuenta desconocida sea 404 y que
 * ninguna ruta admita un parametro con el que preguntar por otro. La consulta, la vigencia y el
 * aislamiento van contra PostgreSQL: {@code LecturaDeLaCopiaLocalJdbcTest} y {@code
 * LecturasDeSeguridadDePuntaAPuntaTest}.
 *
 * <p><b>El guardia es el de verdad, y niega todo.</b> Su comprobador contesta que la cuenta no
 * tiene ningun privilegio y que el sistema ni la conoce: si alguna de las cinco rutas exigiera una
 * opcion del catalogo en vez de {@code SESION_PROPIA} —lo que ADR-0043 §3 decide—, saldria 403
 * aqui.
 */
@DisplayName("#54 — Capa web de /seguridad: catalogo y sesion")
class LecturasDeSeguridadFronteraTest {

    private static final String RAIZ = "/normativa/api/v1/seguridad";

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-16T15:00:00Z"), ZoneId.of("America/Lima"));

    private final CopiaEnMemoria copia = new CopiaEnMemoria();

    private final MockMvc mvc =
            MockMvcBuilders.standaloneSetup(
                            new SeguridadController(new ConsultaDelCatalogo(copia)),
                            new SesionController(
                                    new LecturasDeLaSesion(copia, copia::municipalidad, RELOJ)))
                    .addInterceptors(
                            new GuardiaDeAcceso(new ComprobadorQueNiegaTodo(), RELOJ),
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

    /** Sin borde no hay filtro que lo fije; el de verdad lo saca del token. */
    @BeforeEach
    void entrar() {
        OrigenContext.fijar(new Origen("jperez", null, "10.1.1.9"));
    }

    @AfterEach
    void salir() {
        OrigenContext.limpiar();
    }

    // ── El catalogo ────────────────────────────────────────────────────

    @Test
    @DisplayName("los modulos salen en la pagina unica, con los cinco campos de rentas")
    void losModulos() throws Exception {
        MvcResult respuesta = mvc.perform(get(RAIZ + "/modulos")).andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(200);
        assertThat(respuesta.getResponse().getContentAsString())
                .as(
                        "`ModuloDelSistema` de rentas/frontend/src/datos/lecturas.ts lee exactamente"
                                + " {id, codigo, nombre, orden, activo} dentro de la pagina unica")
                .isEqualTo(
                        "{\"contenido\":["
                                + "{\"id\":1,\"codigo\":\"SEGURIDAD\",\"nombre\":\"Seguridad\","
                                + "\"orden\":0,\"activo\":true},"
                                + "{\"id\":2,\"codigo\":\"RETIRADO\",\"nombre\":\"Modulo retirado\","
                                + "\"orden\":0,\"activo\":false}],"
                                + "\"pagina\":0,\"tamano\":20,\"totalElementos\":2,"
                                + "\"totalPaginas\":1,\"hayMas\":false}");
        assertThat(copia.pedidas)
                .as("sin `ordenarPor`, los modulos se ordenan por `orden`, como en rentas")
                .containsExactly(Paginacion.de(0, 20, "orden"));
    }

    @Test
    @DisplayName("los accesos llevan su moduloId, que es lo que ata un permiso a un modulo")
    void losAccesos() throws Exception {
        MvcResult respuesta = mvc.perform(get(RAIZ + "/accesos")).andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(200);
        assertThat(respuesta.getResponse().getContentAsString())
                .isEqualTo(
                        "{\"contenido\":["
                                + "{\"id\":11,\"moduloId\":1,\"tipo\":\"OPCION_MENU\","
                                + "\"codigo\":\"parametros\","
                                + "\"nombre\":\"Parametros del sistema\","
                                + "\"activo\":true}],"
                                + "\"pagina\":0,\"tamano\":20,\"totalElementos\":1,"
                                + "\"totalPaginas\":1,\"hayMas\":false}");
        assertThat(copia.pedidas)
                .as("y los accesos por `codigo`, como en rentas")
                .containsExactly(Paginacion.de(0, 20, "codigo"));
    }

    @Test
    @DisplayName("la paginacion viaja con el dialecto de siempre")
    void laPaginacionViaja() throws Exception {
        MvcResult respuesta =
                mvc.perform(
                                get(RAIZ + "/accesos")
                                        .param("pagina", "2")
                                        .param("tamano", "5")
                                        .param("ordenarPor", "nombre")
                                        .param("direccion", "DESCENDENTE"))
                        .andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(200);
        assertThat(copia.pedidas)
                .containsExactly(new Paginacion(2, 5, "nombre", Paginacion.Direccion.DESCENDENTE));
    }

    @Test
    @DisplayName("y un `ordenarPor` que la lista blanca no admite contesta 422, no 500")
    void unOrdenarPorQueNoSeAdmite() throws Exception {
        MvcResult respuesta =
                mvc.perform(get(RAIZ + "/accesos").param("ordenarPor", "municipalidad_id"))
                        .andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(422);
        assertThat(respuesta.getResponse().getContentAsString()).contains("ORDEN_NO_ADMITIDO");
    }

    // ── La sesion ──────────────────────────────────────────────────────

    @Test
    @DisplayName("la matriz lleva los privilegios en minuscula y en el orden del manual")
    void laMatrizEnMinuscula() throws Exception {
        Map<String, Set<Privilegio>> matriz = new LinkedHashMap<>();
        matriz.put(
                "conjuntos",
                EnumSet.of(Privilegio.MODIFICACION, Privilegio.LECTURA, Privilegio.REGISTRO));
        matriz.put("parametros", EnumSet.of(Privilegio.ESPECIAL, Privilegio.EJECUCION));
        copia.matriz = matriz;

        MvcResult respuesta = mvc.perform(get(RAIZ + "/sesion/permisos")).andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(200);
        assertThat(respuesta.getResponse().getContentAsString())
                .as(
                        "la interfaz de rentas busca \"lectura\" tal cual (permisos.ts): un"
                                + " \"LECTURA\" dejaria el menu vacio sin ningun error")
                .isEqualTo(
                        "{\"conjuntos\":[\"lectura\",\"registro\",\"modificacion\"],"
                                + "\"parametros\":[\"ejecucion\",\"especial\"]}");
        assertThat(copia.cuentasPreguntadas)
                .as("la cuenta sale del origen de la peticion, no de un parametro")
                .containsExactly("jperez");
        assertThat(copia.fechasPreguntadas)
                .as("y la fecha del reloj inyectado, en la zona de la municipalidad")
                .containsExactly(LocalDate.of(2026, 9, 16));
    }

    @Test
    @DisplayName("una cuenta sin ningun permiso recibe {} y un 200, no un 403")
    void sinPermisosEsUnObjetoVacio() throws Exception {
        MvcResult respuesta = mvc.perform(get(RAIZ + "/sesion/permisos")).andReturn();

        assertThat(respuesta.getResponse().getStatus())
                .as(
                        "el guardia de esta prueba niega TODO: si esta ruta exigiera una opcion del"
                                + " catalogo, quien no tiene ninguna no podria ni saber que no tiene"
                                + " nada")
                .isEqualTo(200);
        assertThat(respuesta.getResponse().getContentAsString()).isEqualTo("{}");
    }

    @Test
    @DisplayName("quien soy: los cuatro campos, y el ejercicio nulo, que aqui es siempre")
    void quienSoy() throws Exception {
        MvcResult respuesta = mvc.perform(get(RAIZ + "/sesion")).andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(200);
        assertThat(respuesta.getResponse().getContentAsString())
                .as(
                        "`SesionDeLaVentanilla` de rentas lee {usuarioId, cuenta, nombre,"
                                + " ejercicioDeTrabajo}, y el ultimo tiene que VIAJAR nulo: ausente se lee"
                                + " undefined, y un año por omision afirmaria que alguien lo eligio")
                .isEqualTo(
                        "{\"usuarioId\":7,\"cuenta\":\"jperez\",\"nombre\":\"Juan Perez Castillo\","
                                + "\"ejercicioDeTrabajo\":null}");
    }

    @Test
    @DisplayName("y si algo escribiera `sesion`, el ejercicio saldria como numero")
    void elEjercicioRegistrado() throws Exception {
        copia.ejercicio = new Ejercicio(2026);

        MvcResult respuesta = mvc.perform(get(RAIZ + "/sesion")).andReturn();

        assertThat(respuesta.getResponse().getContentAsString())
                .contains("\"ejercicioDeTrabajo\":2026");
    }

    @Test
    @DisplayName("una cuenta que no es usuario de esta municipalidad es 404, no un usuario cero")
    void unaCuentaDesconocidaEs404() throws Exception {
        OrigenContext.fijar(new Origen("nadie", null, "10.1.1.9"));

        MvcResult respuesta = mvc.perform(get(RAIZ + "/sesion")).andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(404);
        assertThat(respuesta.getResponse().getContentAsString())
                .contains("NO_ENCONTRADO")
                .contains("nadie")
                .doesNotContain("usuarioId");
    }

    @Test
    @DisplayName("de que municipalidad: los cuatro campos, con el ubigeo y el nombre verbatim")
    void deQueMunicipalidad() throws Exception {
        MvcResult respuesta = mvc.perform(get(RAIZ + "/sesion/municipalidad")).andReturn();

        assertThat(respuesta.getResponse().getStatus()).isEqualTo(200);
        assertThat(respuesta.getResponse().getContentAsString())
                .as("G2 (#52): la barra resuelve la municipalidad por su UBIGEO, nunca por literal")
                .isEqualTo(
                        "{\"id\":3,\"ubigeo\":\"200601\","
                                + "\"nombre\":\"Municipalidad Provincial de Sullana\","
                                + "\"tipo\":\"PROVINCIAL\"}");
    }

    @Test
    @DisplayName("ninguna ruta de la sesion admite con que preguntar por otro: 422 nombrandolo")
    void nadiePreguntaPorOtro() throws Exception {
        for (String ruta :
                List.of(
                        RAIZ + "/sesion?cuenta=mrojas",
                        RAIZ + "/sesion/permisos?cuenta=mrojas",
                        RAIZ + "/sesion/municipalidad?municipalidadId=9")) {
            MvcResult respuesta = mvc.perform(get(ruta)).andReturn();

            assertThat(respuesta.getResponse().getStatus())
                    .as(
                            "%s: un parametro que la operacion no lee no se ignora. Ignorado, la"
                                    + " peticion pareceria preguntar por otro y contestaria por uno"
                                    + " mismo; leido, la ruta seria un directorio",
                            ruta)
                    .isEqualTo(422);
        }
        assertThat(copia.cuentasPreguntadas).as("y no se llego a leer nada").isEmpty();
    }

    @Test
    @DisplayName("las cinco rutas contestan 200 a quien no tiene ningun privilegio del catalogo")
    void lasCincoSonDeLaSesionPropia() throws Exception {
        copia.matriz = Map.of();
        for (String ruta :
                List.of(
                        RAIZ + "/modulos",
                        RAIZ + "/accesos",
                        RAIZ + "/sesion",
                        RAIZ + "/sesion/municipalidad",
                        RAIZ + "/sesion/permisos")) {
            assertThat(mvc.perform(get(ruta)).andReturn().getResponse().getStatus())
                    .as(
                            "%s: ADR-0043 §3. El catalogo de normativa no declara ninguna opcion para"
                                    + " leerse a si mismo, asi que exigir una —`modulos`, como rentas— la"
                                    + " dejaria en 403 para todo el mundo y el menu vacio",
                            ruta)
                    .isEqualTo(200);
        }
    }

    // ------------------------------------------------------------------

    /** Un guardia que no deja pasar nada que pase por el catalogo, y que no conoce a nadie. */
    private static final class ComprobadorQueNiegaTodo implements ComprobadorDeAcceso {

        @Override
        public boolean autoriza(
                String usuario, String acceso, Privilegio privilegio, LocalDate fecha) {
            return false;
        }

        @Override
        public boolean conoceAlUsuario(String usuario) {
            return false;
        }
    }

    /** La copia local fabricada: una municipalidad, dos modulos, un acceso y a «jperez». */
    private static final class CopiaEnMemoria implements LecturaDeLaCopiaLocal {

        final List<Paginacion> pedidas = new ArrayList<>();
        final List<String> cuentasPreguntadas = new ArrayList<>();
        final List<LocalDate> fechasPreguntadas = new ArrayList<>();
        Map<String, Set<Privilegio>> matriz = Map.of();
        @Nullable Ejercicio ejercicio;

        /** Las listas blancas de verdad: asi el 422 de un orden que no esta sale de donde sale. */
        private static final OrdenSeguro ORDEN_MODULO =
                OrdenSeguro.sobre("codigo", "nombre", "orden", "id").desempatandoPor("id");

        private static final OrdenSeguro ORDEN_ACCESO =
                OrdenSeguro.sobre("codigo", "nombre", "tipo", "id").desempatandoPor("id");

        @Override
        public Pagina<ModuloDelSistema> modulos(Paginacion paginacion) {
            pedidas.add(paginacion);
            ORDEN_MODULO.clausula(paginacion);
            return Pagina.de(
                    List.of(
                            new ModuloDelSistema(1, "SEGURIDAD", "Seguridad", 0, true),
                            new ModuloDelSistema(2, "RETIRADO", "Modulo retirado", 0, false)),
                    paginacion,
                    2);
        }

        @Override
        public Pagina<AccesoDelSistema> accesos(Paginacion paginacion) {
            pedidas.add(paginacion);
            ORDEN_ACCESO.clausula(paginacion);
            return Pagina.de(
                    List.of(
                            new AccesoDelSistema(
                                    11,
                                    1,
                                    "OPCION_MENU",
                                    "parametros",
                                    "Parametros del sistema",
                                    true)),
                    paginacion,
                    1);
        }

        @Override
        public Optional<Identidad> identidadDe(String cuenta) {
            cuentasPreguntadas.add(cuenta);
            return "jperez".equals(cuenta)
                    ? Optional.of(new Identidad(7, "jperez", "Juan Perez Castillo", ejercicio))
                    : Optional.empty();
        }

        @Override
        public Map<String, Set<Privilegio>> permisosEfectivosDe(String cuenta, LocalDate fecha) {
            cuentasPreguntadas.add(cuenta);
            fechasPreguntadas.add(fecha);
            return matriz;
        }

        Optional<Municipalidad> municipalidad() {
            return Optional.of(
                    new Municipalidad(
                            3, "200601", "Municipalidad Provincial de Sullana", "PROVINCIAL"));
        }
    }
}
