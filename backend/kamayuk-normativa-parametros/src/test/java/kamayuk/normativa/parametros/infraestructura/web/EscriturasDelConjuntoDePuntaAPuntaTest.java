package kamayuk.normativa.parametros.infraestructura.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import kamayuk.normativa.auditoria.AuditoriaJdbc;
import kamayuk.normativa.autorizacion.ComprobadorDeAcceso;
import kamayuk.normativa.autorizacion.GuardiaDeAcceso;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.parametros.aplicacion.AdministrarParametros;
import kamayuk.normativa.parametros.aplicacion.EscriturasDelConjunto;
import kamayuk.normativa.parametros.dominio.ClaveDeIdempotencia;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.LlaveDeParametro;
import kamayuk.normativa.parametros.dominio.ParametroTributario;
import kamayuk.normativa.parametros.dominio.ParametrosRepository;
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.plataforma.tenant.OrigenContextFilter;
import kamayuk.normativa.plataforma.tenant.TenantContextFilter;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.web.ConfiguracionDeJson;
import kamayuk.normativa.web.GuardiaDeParametros;
import kamayuk.normativa.web.ManejadorDeErrores;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * #59 — Abrir, agregar y sellar <b>de HTTP a PostgreSQL</b>, con el inquilino puesto solo por el
 * token y las carreras forzadas con hilos de verdad.
 *
 * <h2>Por que de punta a punta</h2>
 *
 * <p>Lo que ADR-0043 §5 y §7 deciden lo deciden la base y las transacciones: el indice {@code
 * conjunto_idempotencia_uq} que la {@code V3} trae, {@code conjunto_uq}, la clave primaria del
 * detalle y los dos disparadores de inmutabilidad. Y la relectura tras un choque tiene que ir en
 * <b>otra</b> transaccion, porque la que choco queda abortada. Nada de eso se ve con un repositorio
 * de mentira ni con una transaccion abierta por la prueba. Aqui, como en {@code
 * LecturasDeSeguridadDePuntaAPuntaTest}: el inquilino lo pone {@link TenantContextFilter} desde el
 * claim del token, el usuario lo pone {@link OrigenContextFilter}, y {@link AdministrarParametros}
 * va envuelto en un {@link TransactionInterceptor} como Spring lo proxifica en produccion.
 *
 * <h2>Como se fuerza una carrera sin depender de la suerte</h2>
 *
 * <p>Dos hilos que piden a la vez casi nunca se cruzan donde duele: uno termina antes de que el
 * otro empiece. Por eso el repositorio va envuelto en {@link RepositorioConPausas}, que detiene a
 * cada hilo <b>en el punto exacto</b> del caso de uso que la carrera necesita —despues de buscar la
 * clave, despues de calcular la version, antes de escribir el detalle, antes de sellar— hasta que
 * el otro llega o termina. Las pausas no cambian ni una sentencia: lo que se ejecuta es el
 * repositorio de verdad, en el orden que produciria una carrera real.
 *
 * <p><b>Ninguna cifra tributaria aparece en esta prueba</b>: los parametros son ficticios y estan
 * marcados como tales.
 */
@DisplayName("#59 — abrir, agregar y sellar de HTTP a PostgreSQL")
class EscriturasDelConjuntoDePuntaAPuntaTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-29T15:00:00Z"), ZoneId.of("America/Lima"));

    private static final String RAIZ = "/normativa/api/v1";

    /** Tiene REGISTRO y ESPECIAL sobre `conjuntos`: compone y sella. */
    private static final String JEFE = "jefe.rentas";

    /** Solo REGISTRO: compone y no sella (ADR-0043 §1, separar quien compone de quien sella). */
    private static final String COMPONE = "compone.solo";

    /** Un valor inventado. No representa ninguna UIT, ningun tramo y ninguna alicuota. */
    private static final String VALOR_FICTICIO = "1.000000";

    private static final LocalDate DESDE = LocalDate.of(2026, 1, 1);

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static BaseDeDatosDePrueba base;
    private static MockMvc mvc;
    private static long municipalidadA;
    private static long municipalidadB;
    private static RepositorioConPausas repositorio;
    private static ComprobadorQueAnota comprobador;

    @BeforeAll
    static void provisionar() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        municipalidadA = crearMunicipalidad("200601", "Municipalidad de las escrituras A");
        municipalidadB = crearMunicipalidad("200602", "Municipalidad de las escrituras B");
        for (String clave : List.of("E2E_A", "E2E_B", "E2E_C", "E2E_D", "E2E_E", "E2E_F")) {
            publicar(clave);
        }

        DriverManagerDataSource pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));
        JdbcClient jdbc = JdbcClient.create(pool);
        TenantTransactionManager gestor = new TenantTransactionManager(pool);

        repositorio = new RepositorioConPausas(new ParametrosRepositoryJdbc(jdbc));
        comprobador = new ComprobadorQueAnota();
        AdministrarParametros administrar =
                proxificado(
                        new AdministrarParametros(
                                repositorio, new AuditoriaJdbc(jdbc, RELOJ), RELOJ),
                        gestor);

        // `EscriturasDelConjunto` NO se proxifica: no lleva ninguna anotacion transaccional, y es
        // justo lo que le permite releer en otra transaccion. Envolverla aqui mediria otra cosa.
        mvc =
                MockMvcBuilders.standaloneSetup(
                                new EscriturasDelConjuntoController(
                                        new EscriturasDelConjunto(administrar)))
                        .addFilters(new TenantContextFilter(), new OrigenContextFilter())
                        .addInterceptors(
                                new GuardiaDeAcceso(comprobador, RELOJ), new GuardiaDeParametros())
                        .setControllerAdvice(new ManejadorDeErrores())
                        .setMessageConverters(
                                new JacksonJsonHttpMessageConverter(
                                        JsonMapper.builder()
                                                .addModule(
                                                        new ConfiguracionDeJson()
                                                                .moduloDeObjetosDeValor())
                                                .build()))
                        .build();
    }

    @AfterAll
    static void cerrar() {
        if (base != null) {
            base.close();
        }
    }

    @AfterEach
    void sinPausas() {
        repositorio.quitarLasPausas();
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------
    //  Ruta 1 — POST /conjuntos, con Idempotency-Key (ADR-0043 §5)
    // ------------------------------------------------------------------

    @Nested
    @DisplayName("abrir, con su clave de idempotencia")
    class Abrir {

        @Test
        @DisplayName("abre con 201 y el ConjuntoResource, guarda la clave y audita el ALTA")
        void abre() throws Exception {
            MvcResult resultado = abrir(municipalidadA, "abrir-2031", 2031, "Se abre el 2031");

            assertThat(resultado.getResponse().getStatus()).isEqualTo(201);
            JsonNode conjunto = cuerpo(resultado);
            long id = conjunto.path("id").asLong();
            assertThat(conjunto.path("ejercicio").asInt()).isEqualTo(2031);
            assertThat(conjunto.path("version").asInt()).isEqualTo(1);
            assertThat(conjunto.path("estado").asString()).isEqualTo("ABIERTO");
            assertThat(conjunto.path("fechaSellado").isNull()).isTrue();
            assertThat(resultado.getResponse().getHeader("Location"))
                    .as("no hay GET /conjuntos/{id}: sin Location (ADR-0043 §1)")
                    .isNull();
            assertThat(texto("SELECT clave_idempotencia FROM conjunto_parametros WHERE id = " + id))
                    .isEqualTo("abrir-2031");
            assertThat(auditoriaDe("conjunto_parametros", id))
                    .as("AC 9: la escritura deja su fila, con la observacion de quien la pidio")
                    .containsExactly("ALTA|Se abre el 2031");
        }

        @Test
        @DisplayName("el reintento con la misma clave es el mismo 201, y no escribe ni audita")
        void elReintentoNoEscribe() throws Exception {
            MvcResult primero = abrir(municipalidadA, "reintento-2032", 2032, "Primera vez 2032");
            long id = cuerpo(primero).path("id").asLong();
            long identidadAntes = ultimaIdentidadDeConjunto();

            MvcResult reenvio =
                    abrir(municipalidadA, "reintento-2032", 2032, "La observacion del reenvio");

            assertThat(reenvio.getResponse().getStatus())
                    .as("dos codigos para el mismo exito obligan a quien llama a distinguirlos")
                    .isEqualTo(201);
            assertThat(cuerpo(reenvio).path("id").asLong())
                    .as("el reintento devuelve el MISMO conjunto, no otra version")
                    .isEqualTo(id);
            assertThat(cuerpo(reenvio).path("version").asInt()).isEqualTo(1);
            assertThat(ultimaIdentidadDeConjunto())
                    .as(
                            "el reintento se contesta con la LECTURA previa por clave, sin llegar al"
                                    + " INSERT: un INSERT que choca en el indice tambien gasta un"
                                    + " identificador, y aqui no se gasta ninguno")
                    .isEqualTo(identidadAntes);
            assertThat(contar("SELECT count(*) FROM conjunto_parametros WHERE ejercicio = 2032"))
                    .isEqualTo(1);
            assertThat(auditoriaDe("conjunto_parametros", id))
                    .as("la observacion del reenvio se ignora: la auditada es la de la primera vez")
                    .containsExactly("ALTA|Primera vez 2032");
        }

        @Test
        @DisplayName("y lo devuelve en su estado de ahora: si ya se sello, sellado")
        void elReintentoDevuelveElEstadoDeAhora() throws Exception {
            long id =
                    cuerpo(abrir(municipalidadA, "ahora-2037", 2037, "Se abre el 2037"))
                            .path("id")
                            .asLong();
            agregar(municipalidadA, id, "E2E_A", "Se agrega el primero");
            sellar(municipalidadA, id, "SIN_CARGAR", "Se sella el 2037");

            MvcResult reenvio = abrir(municipalidadA, "ahora-2037", 2037, "Se abre el 2037");

            assertThat(reenvio.getResponse().getStatus()).isEqualTo(201);
            assertThat(cuerpo(reenvio).path("id").asLong()).isEqualTo(id);
            assertThat(cuerpo(reenvio).path("estado").asString()).isEqualTo("SELLADO");
        }

        @Test
        @DisplayName("la misma clave con otro ejercicio es 409, nombra el conjunto y pide otra")
        void laMismaClaveConOtroEjercicio() throws Exception {
            long id =
                    cuerpo(abrir(municipalidadA, "reusada", 2033, "Se abre el 2033"))
                            .path("id")
                            .asLong();

            MvcResult otro = abrir(municipalidadA, "reusada", 2034, "Se abre el 2034");

            assertThat(otro.getResponse().getStatus())
                    .as(
                            "no es un reintento sino una clave reusada: devolverle el conjunto de"
                                    + " 2033 le haria componer el ano equivocado")
                    .isEqualTo(409);
            assertThat(otro.getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .contains("conjunto " + id)
                    .contains("clave nueva");
            assertThat(contar("SELECT count(*) FROM conjunto_parametros WHERE ejercicio = 2034"))
                    .isZero();
        }

        @Test
        @DisplayName("la misma clave en dos municipalidades abre dos conjuntos")
        void laMismaClaveEnDosMunicipalidades() throws Exception {
            JsonNode deA = cuerpo(abrir(municipalidadA, "compartida", 2035, "Se abre en A"));
            JsonNode deB = cuerpo(abrir(municipalidadB, "compartida", 2035, "Se abre en B"));

            assertThat(deA.path("id").asLong())
                    .as("el ambito de la clave es la municipalidad (ADR-0043 §5)")
                    .isNotEqualTo(deB.path("id").asLong());
            assertThat(deA.path("version").asInt()).isEqualTo(1);
            assertThat(deB.path("version").asInt()).isEqualTo(1);
        }

        @Test
        @DisplayName("A LA VEZ, y la segunda calcula despues de que la primera termino: una sola")
        void aLaVezLaSegundaLlegaTarde() throws Exception {
            // Las dos buscan la clave y no la encuentran; la segunda espera a que la primera
            // termine ENTERA antes de calcular su version, asi que calcula `1 + 1` y no choca en
            // `conjunto_uq`. Lo unico que la para es el indice de la clave.
            CyclicBarrier lasDosBuscaron = new CyclicBarrier(2);
            CountDownLatch laPrimeraTermino = new CountDownLatch(1);
            repositorio.pausarDespues(
                    "abiertoConLaClave",
                    2,
                    () -> {
                        esperar(lasDosBuscaron);
                        if ("segunda".equals(Thread.currentThread().getName())) {
                            esperar(laPrimeraTermino);
                        }
                    });

            List<MvcResult> resultados =
                    aLaVez(
                            () -> {
                                try {
                                    return abrir(
                                            municipalidadA, "a-la-vez", 2036, "Primera peticion");
                                } finally {
                                    laPrimeraTermino.countDown();
                                }
                            },
                            () -> abrir(municipalidadA, "a-la-vez", 2036, "Segunda peticion"));

            assertThat(resultados)
                    .extracting(r -> r.getResponse().getStatus())
                    .containsExactly(201, 201);
            assertThat(contar("SELECT count(*) FROM conjunto_parametros WHERE ejercicio = 2036"))
                    .as(
                            "la garantia es el indice, no la lectura previa: las dos peticiones"
                                    + " leyeron que la clave no existia, y aun asi sale UN conjunto")
                    .isEqualTo(1);
            assertThat(cuerpo(resultados.get(1)).path("id").asLong())
                    .as("y la segunda contesta el conjunto de la primera")
                    .isEqualTo(cuerpo(resultados.get(0)).path("id").asLong());
            assertThat(
                            contar(
                                    "SELECT count(*) FROM auditoria WHERE tabla ="
                                            + " 'conjunto_parametros' AND operacion = 'ALTA' AND"
                                            + " datos_nuevos->>'ejercicio' = '2036'"))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("A LA VEZ y con la misma version calculada: chocan, y sale uno")
        void aLaVezConLaMismaVersion() throws Exception {
            CyclicBarrier lasDosCalcularon = new CyclicBarrier(2);
            repositorio.pausarDespues("ultimaVersionDe", 2, () -> esperar(lasDosCalcularon));

            List<MvcResult> resultados =
                    aLaVez(
                            () -> abrir(municipalidadA, "misma-version", 2038, "Primera"),
                            () -> abrir(municipalidadA, "misma-version", 2038, "Segunda"));

            assertThat(resultados)
                    .extracting(r -> r.getResponse().getStatus())
                    .as(
                            "las dos calcularon la version 1: la que pierde choca en conjunto_uq o"
                                    + " en el indice de la clave, relee por clave en otra"
                                    + " transaccion y encuentra la de la otra")
                    .containsExactly(201, 201);
            assertThat(contar("SELECT count(*) FROM conjunto_parametros WHERE ejercicio = 2038"))
                    .isEqualTo(1);
            assertThat(cuerpo(resultados.get(0)).path("id").asLong())
                    .isEqualTo(cuerpo(resultados.get(1)).path("id").asLong());
        }

        @Test
        @DisplayName("A LA VEZ con claves distintas: una abre, la otra 409 y se puede reenviar")
        void aLaVezConClavesDistintas() throws Exception {
            CyclicBarrier lasDosCalcularon = new CyclicBarrier(2);
            repositorio.pausarDespues("ultimaVersionDe", 2, () -> esperar(lasDosCalcularon));

            List<MvcResult> resultados =
                    aLaVez(
                            () -> abrir(municipalidadA, "distinta-1", 2039, "Primera"),
                            () -> abrir(municipalidadA, "distinta-2", 2039, "Segunda"));

            List<Integer> estados =
                    resultados.stream().map(r -> r.getResponse().getStatus()).toList();
            assertThat(estados)
                    .as("dos peticiones distintas que calcularon la misma version")
                    .containsExactlyInAnyOrder(201, 409);
            MvcResult perdedora = resultados.get(estados.indexOf(409));
            String claveQuePerdio = estados.indexOf(409) == 0 ? "distinta-1" : "distinta-2";
            assertThat(perdedora.getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .as(
                            "chocaron dos claves distintas en la misma version: no escribio nada, y"
                                    + " se dice que se puede reenviar con la MISMA clave")
                    .contains("a la vez")
                    .contains("MISMA clave");

            repositorio.quitarLasPausas();
            MvcResult reenvio = abrir(municipalidadA, claveQuePerdio, 2039, "Se reenvia");
            assertThat(reenvio.getResponse().getStatus()).isEqualTo(201);
            assertThat(cuerpo(reenvio).path("version").asInt())
                    .as("y reenviada con su clave abre la version siguiente")
                    .isEqualTo(2);
        }
    }

    // ------------------------------------------------------------------
    //  Ruta 2 — POST /conjuntos/{id}/parametros, idempotente por su estado
    // ------------------------------------------------------------------

    @Nested
    @DisplayName("agregar, que es idempotente por su estado")
    class Agregar {

        @Test
        @DisplayName("agrega con 201 y la fila del parametro, con la cifra como cadena, y audita")
        void agrega() throws Exception {
            long id = abierto(2040);

            MvcResult resultado = agregar(municipalidadA, id, "E2E_A", "Se agrega E2E_A");

            assertThat(resultado.getResponse().getStatus()).isEqualTo(201);
            JsonNode fila = cuerpo(resultado);
            assertThat(fila.path("tipo").asString()).isEqualTo("FICTICIO");
            assertThat(fila.path("clave").asString()).isEqualTo("E2E_A");
            assertThat(fila.path("vigenciaDesde").asString()).isEqualTo("2026-01-01");
            assertThat(fila.path("valorNumerico").isString())
                    .as("ADR-0043 §1: la cifra viaja como cadena, nunca como numero JSON")
                    .isTrue();
            assertThat(
                            auditoriaDe(
                                    "conjunto_parametro_detalle",
                                    id + ":" + fila.path("id").asLong()))
                    .containsExactly("ALTA|Se agrega E2E_A");
        }

        @Test
        @DisplayName("repetirlo es el mismo 201 con la misma fila, sin escribir ni auditar")
        void repetirloNoEscribe() throws Exception {
            long id = abierto(2041);
            long parametro =
                    cuerpo(agregar(municipalidadA, id, "E2E_A", "Primera")).path("id").asLong();

            MvcResult otraVez = agregar(municipalidadA, id, "E2E_A", "Segunda");

            assertThat(otraVez.getResponse().getStatus())
                    .as("un reintento tras un tiempo de espera no debe leerse como un error")
                    .isEqualTo(201);
            assertThat(cuerpo(otraVez).path("id").asLong()).isEqualTo(parametro);
            assertThat(auditoriaDe("conjunto_parametro_detalle", id + ":" + parametro))
                    .containsExactly("ALTA|Primera");
        }

        @Test
        @DisplayName("a un sellado es 409; pero lo que ya estaba dentro sigue contestando 201")
        void aUnSellado() throws Exception {
            long id = abierto(2042);
            agregar(municipalidadA, id, "E2E_A", "Se agrega antes de sellar");
            sellar(municipalidadA, id, "DECLARADO_CARGADO", "Se sella el 2042");

            MvcResult nuevo = agregar(municipalidadA, id, "E2E_B", "Intento tardio");
            MvcResult yaDentro = agregar(municipalidadA, id, "E2E_A", "Reintento tardio");

            assertThat(nuevo.getResponse().getStatus()).isEqualTo(409);
            assertThat(nuevo.getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .contains("sellado: su contenido no cambia");
            assertThat(yaDentro.getResponse().getStatus())
                    .as(
                            "«ya esta dentro» se contesta antes que «esta sellado»: lo que se pidio"
                                    + " —que este— es verdad (ADR-0043 §5)")
                    .isEqualTo(201);
            assertThat(
                            contar(
                                    "SELECT count(*) FROM conjunto_parametro_detalle WHERE conjunto_id = "
                                            + id))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("una llave sin publicado es 404, y un conjunto de otra municipalidad tambien")
        void losDos404() throws Exception {
            long id = abierto(2043);
            long deB =
                    cuerpo(abrir(municipalidadB, "de-b-2043", 2043, "Se abre en B"))
                            .path("id")
                            .asLong();

            MvcResult sinPublicado = agregar(municipalidadA, id, "NO_PUBLICADA", "Se intenta");
            MvcResult ajeno = agregar(municipalidadA, deB, "E2E_A", "Se intenta en el de B");
            MvcResult inexistente = agregar(municipalidadA, 999_999L, "E2E_A", "Se intenta");

            assertThat(sinPublicado.getResponse().getStatus()).isEqualTo(404);
            assertThat(sinPublicado.getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .contains("No hay ningun parametro publicado");
            assertThat(ajeno.getResponse().getStatus())
                    .as("con RLS, el de otra municipalidad y uno que no existe son el mismo hecho")
                    .isEqualTo(404);
            assertThat(mensaje(ajeno).replace(String.valueOf(deB), "N"))
                    .isEqualTo(mensaje(inexistente).replace("999999", "N"));
            assertThat(
                            contar(
                                    "SELECT count(*) FROM conjunto_parametro_detalle WHERE conjunto_id = "
                                            + deB))
                    .isZero();
        }

        @Test
        @DisplayName("A LA VEZ el mismo parametro: los dos 201 con la misma fila, y un solo ALTA")
        void aLaVezElMismo() throws Exception {
            long id = abierto(2044);
            CyclicBarrier lasDosMiraron = new CyclicBarrier(2);
            repositorio.pausarDespues("contiene", 2, () -> esperar(lasDosMiraron));

            List<MvcResult> resultados =
                    aLaVez(
                            () -> agregar(municipalidadA, id, "E2E_C", "Primera"),
                            () -> agregar(municipalidadA, id, "E2E_C", "Segunda"));

            assertThat(resultados)
                    .extracting(r -> r.getResponse().getStatus())
                    .as(
                            "la que pierde choca en conjunto_detalle_pk: otro lo agrego a la vez, y"
                                    + " lo que se pidio ya es verdad (ADR-0043 §7)")
                    .containsExactly(201, 201);
            long parametro = cuerpo(resultados.get(0)).path("id").asLong();
            assertThat(cuerpo(resultados.get(1)).path("id").asLong()).isEqualTo(parametro);
            assertThat(auditoriaDe("conjunto_parametro_detalle", id + ":" + parametro))
                    .as("audita quien escribio, y solo el")
                    .hasSize(1);
        }

        @Test
        @DisplayName("mientras otro sella: el disparador lo rechaza, y sale 409 y no 500")
        void mientrasOtroSella() throws Exception {
            long id = abierto(2045);
            agregar(municipalidadA, id, "E2E_A", "Para que no este vacio");
            CountDownLatch agregaEspera = new CountDownLatch(1);
            CountDownLatch selloTermino = new CountDownLatch(1);
            // Quien agrega ya comprobo que el conjunto esta ABIERTO; se detiene justo antes del
            // INSERT hasta que otro lo selle. Es la carrera que la comprobacion previa no puede
            // ver.
            repositorio.pausarAntes(
                    "agregarParametro",
                    1,
                    () -> {
                        agregaEspera.countDown();
                        esperar(selloTermino);
                    });

            FutureTask<MvcResult> agrega =
                    new FutureTask<>(() -> agregar(municipalidadA, id, "E2E_D", "Llega tarde"));
            Thread hilo = new Thread(agrega, "agrega");
            hilo.start();
            esperar(agregaEspera);
            MvcResult sello = sellar(municipalidadA, id, "SIN_CARGAR", "Se sella mientras tanto");
            selloTermino.countDown();
            MvcResult tardio = agrega.get(30, TimeUnit.SECONDS);

            assertThat(sello.getResponse().getStatus()).isEqualTo(200);
            assertThat(tardio.getResponse().getStatus())
                    .as(
                            "el restrict_violation de detalle_de_conjunto_sellado_inmutable se"
                                    + " traduce, por su SQLState y su funcion, al mismo 409 que la"
                                    + " comprobacion previa. Contesto: %s",
                            tardio.getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .isEqualTo(409);
            assertThat(mensaje(tardio)).contains("sellado: su contenido no cambia");
            assertThat(
                            contar(
                                    "SELECT count(*) FROM conjunto_parametro_detalle WHERE conjunto_id = "
                                            + id))
                    .as("y el conjunto sellado sigue con lo que tenia")
                    .isEqualTo(1);
        }
    }

    // ------------------------------------------------------------------
    //  Ruta 3 — POST /conjuntos/{id}/sellar, con la declaracion del arancel
    // ------------------------------------------------------------------

    @Nested
    @DisplayName("sellar, con el punto 3 de «Antes de sellar»")
    class Sellar {

        @Test
        @DisplayName("sella con 200, y la declaracion queda en la auditoria y en ningun otro sitio")
        void sella() throws Exception {
            long id = abierto(2046);
            agregar(municipalidadA, id, "E2E_A", "Se agrega el primero");

            MvcResult resultado =
                    sellar(municipalidadA, id, "SIN_CARGAR", "Se sella sabiendo que falta");

            assertThat(resultado.getResponse().getStatus())
                    .as("no crea un recurso: cambia el estado de uno que existe")
                    .isEqualTo(200);
            JsonNode conjunto = cuerpo(resultado);
            assertThat(conjunto.path("estado").asString()).isEqualTo("SELLADO");
            assertThat(conjunto.path("usuarioSellado").asString())
                    .as("el sello es de quien lo pidio, con su token")
                    .isEqualTo(JEFE);
            assertThat(auditoriaDe("conjunto_parametros", id))
                    .containsExactly(
                            "ALTA|Se abre el 2046", "MODIFICACION|Se sella sabiendo que falta");
            assertThat(
                            texto(
                                    "SELECT (datos_nuevos->>'arancelDeLaMunicipalidad') || '|' ||"
                                            + " (datos_nuevos->'comprobadoPorNormativa')::text ||"
                                            + " '|' || (datos_nuevos->>'estado') FROM auditoria"
                                            + " WHERE tabla = 'conjunto_parametros' AND operacion ="
                                            + " 'MODIFICACION' AND clave = '"
                                            + id
                                            + "'"))
                    .as(
                            "ADR-0043 §8: lo declarado, y `comprobadoPorNormativa` SIEMPRE false:"
                                    + " normativa no comprueba el arancel")
                    .isEqualTo("SIN_CARGAR|false|SELLADO");
            assertThat(
                            contar(
                                    "SELECT count(*) FROM information_schema.columns"
                                            + " WHERE table_name = 'conjunto_parametros'"
                                            + "   AND column_name ILIKE '%arancel%'"))
                    .as("no es una propiedad del conjunto: no va en conjunto_parametros")
                    .isZero();
        }

        @Test
        @DisplayName("DECLARADO_CARGADO tambien queda dicho, y tampoco lo comprueba nadie")
        void declaradoCargado() throws Exception {
            long id = abierto(2047);
            agregar(municipalidadA, id, "E2E_A", "Se agrega el primero");

            sellar(municipalidadA, id, "DECLARADO_CARGADO", "Se sella con el arancel cargado");

            assertThat(
                            texto(
                                    "SELECT (datos_nuevos->>'arancelDeLaMunicipalidad') || '|' ||"
                                            + " (datos_nuevos->'comprobadoPorNormativa')::text"
                                            + " FROM auditoria WHERE tabla = 'conjunto_parametros'"
                                            + " AND operacion = 'MODIFICACION' AND clave = '"
                                            + id
                                            + "'"))
                    .isEqualTo("DECLARADO_CARGADO|false");
        }

        @Test
        @DisplayName(
                "repetirlo es el 409 de «ya sellado»; y sellar vacio, otro 409 con otro mensaje")
        void losDos409() throws Exception {
            long lleno = abierto(2048);
            agregar(municipalidadA, lleno, "E2E_A", "Se agrega el primero");
            sellar(municipalidadA, lleno, "SIN_CARGAR", "Primer sello");
            long vacio = abierto(2049);

            MvcResult otraVez = sellar(municipalidadA, lleno, "SIN_CARGAR", "Segundo sello");
            MvcResult sinNada = sellar(municipalidadA, vacio, "SIN_CARGAR", "Sello de un vacio");

            assertThat(otraVez.getResponse().getStatus())
                    .as(
                            "no un exito: usuario_sellado es de quien sello primero, y contestar"
                                    + " «hecho» le atribuiria un sello que puede ser de otro")
                    .isEqualTo(409);
            assertThat(sinNada.getResponse().getStatus()).isEqualTo(409);
            assertThat(mensaje(otraVez)).contains("ya esta sellado");
            assertThat(mensaje(sinNada)).contains("no tiene ningun parametro");
            assertThat(mensaje(otraVez))
                    .as("los dos 409 de sellar dicen cosas distintas: se corrigen distinto")
                    .isNotEqualTo(mensaje(sinNada));
            assertThat(
                            contar(
                                    "SELECT count(*) FROM auditoria WHERE tabla ="
                                            + " 'conjunto_parametros' AND operacion ="
                                            + " 'MODIFICACION' AND clave = '"
                                            + lleno
                                            + "'"))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("A LA VEZ dos sellos: uno sella y el otro recibe el 409 de «ya sellado»")
        void aLaVezDosSellos() throws Exception {
            long id = abierto(2050);
            agregar(municipalidadA, id, "E2E_A", "Se agrega el primero");
            CyclicBarrier lasDosComprobaron = new CyclicBarrier(2);
            repositorio.pausarAntes("sellar", 2, () -> esperar(lasDosComprobaron));

            List<MvcResult> resultados =
                    aLaVez(
                            () -> sellar(municipalidadA, id, "SIN_CARGAR", "Un sello"),
                            () -> sellar(municipalidadA, id, "SIN_CARGAR", "Otro sello"));

            List<Integer> estados =
                    resultados.stream().map(r -> r.getResponse().getStatus()).toList();
            assertThat(estados)
                    .as(
                            "las dos vieron el conjunto ABIERTO; al segundo UPDATE lo rechaza"
                                    + " conjunto_sellado_inmutable, y ese rechazo es un 409, no un"
                                    + " 500 (ADR-0043 §7)")
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(mensaje(resultados.get(estados.indexOf(409)))).contains("ya esta sellado");
            assertThat(
                            contar(
                                    "SELECT count(*) FROM auditoria WHERE tabla ="
                                            + " 'conjunto_parametros' AND operacion ="
                                            + " 'MODIFICACION' AND clave = '"
                                            + id
                                            + "'"))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("sellar pide ESPECIAL: quien solo compone recibe 403")
        void sellarPideEspecial() throws Exception {
            MvcResult abrio =
                    pedir(
                            municipalidadA,
                            COMPONE,
                            post(RAIZ + "/conjuntos")
                                    .header(ClaveDeIdempotencia.CABECERA, "compone-2051")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            "{\"ejercicio\":2051,\"observacion\":\"Lo abre quien"
                                                    + " compone\"}"));
            long id = cuerpo(abrio).path("id").asLong();
            pedir(municipalidadA, COMPONE, cuerpoDeAgregar(id, "E2E_A", "Lo compone"));

            MvcResult selloAjeno =
                    pedir(municipalidadA, COMPONE, cuerpoDeSellar(id, "SIN_CARGAR", "Lo intenta"));

            assertThat(abrio.getResponse().getStatus()).isEqualTo(201);
            assertThat(selloAjeno.getResponse().getStatus())
                    .as("ADR-0043 §1: una municipalidad puede separar quien compone de quien sella")
                    .isEqualTo(403);
            assertThat(comprobador.preguntas)
                    .contains(COMPONE + ":conjuntos:REGISTRO", COMPONE + ":conjuntos:ESPECIAL")
                    .noneMatch(pregunta -> pregunta.contains(":parametros:"));
            assertThat(texto("SELECT estado FROM conjunto_parametros WHERE id = " + id))
                    .isEqualTo("ABIERTO");
        }
    }

    // ------------------------------------------------------------------

    private static MvcResult abrir(long municipalidad, String clave, int ejercicio, String porque)
            throws Exception {
        return pedir(
                municipalidad,
                JEFE,
                post(RAIZ + "/conjuntos")
                        .header(ClaveDeIdempotencia.CABECERA, clave)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"ejercicio\":"
                                        + ejercicio
                                        + ",\"observacion\":\""
                                        + porque
                                        + "\"}"));
    }

    /** Un conjunto recien abierto en la municipalidad A, con la observacion «Se abre el N». */
    private static long abierto(int ejercicio) throws Exception {
        MvcResult resultado =
                abrir(municipalidadA, "abre-" + ejercicio, ejercicio, "Se abre el " + ejercicio);
        assertThat(resultado.getResponse().getStatus()).isEqualTo(201);
        return cuerpo(resultado).path("id").asLong();
    }

    private static MvcResult agregar(long municipalidad, long conjunto, String clave, String porque)
            throws Exception {
        return pedir(municipalidad, JEFE, cuerpoDeAgregar(conjunto, clave, porque));
    }

    private static MvcResult sellar(
            long municipalidad, long conjunto, String arancel, String porque) throws Exception {
        return pedir(municipalidad, JEFE, cuerpoDeSellar(conjunto, arancel, porque));
    }

    private static MockHttpServletRequestBuilder cuerpoDeAgregar(
            long conjunto, String clave, String porque) {
        return post(RAIZ + "/conjuntos/" + conjunto + "/parametros")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                        "{\"tipo\":\"FICTICIO\",\"clave\":\""
                                + clave
                                + "\",\"vigenciaDesde\":\""
                                + DESDE
                                + "\",\"observacion\":\""
                                + porque
                                + "\"}");
    }

    private static MockHttpServletRequestBuilder cuerpoDeSellar(
            long conjunto, String arancel, String porque) {
        return post(RAIZ + "/conjuntos/" + conjunto + "/sellar")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                        "{\"arancelDeLaMunicipalidad\":\""
                                + arancel
                                + "\",\"observacion\":\""
                                + porque
                                + "\"}");
    }

    /**
     * La peticion con un token de esa municipalidad y esa cuenta, en el hilo que la hace.
     *
     * <p>El contexto de seguridad es de hilo: cada hilo de una carrera pone el suyo, y lo quita.
     */
    private static MvcResult pedir(
            long municipalidad, String cuenta, MockHttpServletRequestBuilder peticion)
            throws Exception {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new JwtAuthenticationToken(
                                Jwt.withTokenValue("t")
                                        .header("alg", "none")
                                        .subject(cuenta)
                                        .claim("preferred_username", cuenta)
                                        .claim(TenantContextFilter.CLAIM, municipalidad)
                                        .issuedAt(Instant.now())
                                        .expiresAt(Instant.now().plusSeconds(60))
                                        .build(),
                                List.of()));
        try {
            return mvc.perform(peticion).andReturn();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** Las dos peticiones en dos hilos con nombre, a la vez; sus resultados, en ese orden. */
    private static List<MvcResult> aLaVez(Callable<MvcResult> primera, Callable<MvcResult> segunda)
            throws Exception {
        FutureTask<MvcResult> una = new FutureTask<>(primera);
        FutureTask<MvcResult> otra = new FutureTask<>(segunda);
        new Thread(una, "primera").start();
        new Thread(otra, "segunda").start();
        return List.of(una.get(60, TimeUnit.SECONDS), otra.get(60, TimeUnit.SECONDS));
    }

    private static void esperar(CyclicBarrier barrera) {
        try {
            barrera.await(20, TimeUnit.SECONDS);
        } catch (InterruptedException interrumpido) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(interrumpido);
        } catch (BrokenBarrierException | TimeoutException noLlego) {
            throw new IllegalStateException(
                    "El otro hilo no llego a la pausa: la carrera no se produjo", noLlego);
        }
    }

    private static void esperar(CountDownLatch senal) {
        try {
            if (!senal.await(20, TimeUnit.SECONDS)) {
                throw new IllegalStateException("La senal no llego: la carrera no se produjo");
            }
        } catch (InterruptedException interrumpido) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(interrumpido);
        }
    }

    private static JsonNode cuerpo(MvcResult resultado) throws Exception {
        return JSON.readTree(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    /** El {@code detail} del problem+json: el mensaje que la operacion escribio. */
    private static String mensaje(MvcResult resultado) throws Exception {
        return cuerpo(resultado).path("detail").asString();
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxificado(T objetivo, TenantTransactionManager gestor) {
        ProxyFactory fabrica = new ProxyFactory(objetivo);
        fabrica.setProxyTargetClass(true);
        fabrica.addAdvice(
                new TransactionInterceptor(gestor, new AnnotationTransactionAttributeSource()));
        return (T) fabrica.getProxy();
    }

    private static long crearMunicipalidad(String ubigeo, String nombre) throws SQLException {
        try (Connection owner = base.conexion(BaseDeDatosDePrueba.OWNER);
                PreparedStatement sentencia =
                        owner.prepareStatement(
                                "INSERT INTO municipalidad (ubigeo, nombre, tipo)"
                                        + " VALUES (?, ?, 'DISTRITAL') RETURNING id")) {
            sentencia.setString(1, ubigeo);
            sentencia.setString(2, nombre);
            try (ResultSet resultado = sentencia.executeQuery()) {
                resultado.next();
                long id = resultado.getLong(1);
                owner.commit();
                return id;
            }
        }
    }

    /** Publica un parametro ficticio nacional con el rol que corresponde, no con la aplicacion. */
    private static void publicar(String clave) throws SQLException {
        try (Connection carga = base.conexion(BaseDeDatosDePrueba.CARGA_PARAMETROS);
                PreparedStatement sentencia =
                        carga.prepareStatement(
                                "INSERT INTO parametro_tributario (municipalidad_id, tipo, clave,"
                                        + " valor_numerico, vigencia_desde, documento_fuente,"
                                        + " usuario_carga, usuario_aprueba) VALUES (NULL,"
                                        + " 'FICTICIO', ?, ?::numeric, ?, 'Valor ficticio de"
                                        + " prueba; no representa ninguna norma', 'carga',"
                                        + " 'aprueba')")) {
            sentencia.setString(1, clave);
            sentencia.setString(2, VALOR_FICTICIO);
            sentencia.setDate(3, java.sql.Date.valueOf(DESDE));
            sentencia.executeUpdate();
            carga.commit();
        }
    }

    /** Operacion y observacion de cada fila de la bitacora sobre esa fila, en orden. */
    private static List<String> auditoriaDe(String tabla, Object clave) throws SQLException {
        List<String> filas = new ArrayList<>();
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia =
                        admin.prepareStatement(
                                "SELECT operacion || '|' || observacion FROM auditoria"
                                        + " WHERE tabla = ? AND clave = ? ORDER BY id")) {
            sentencia.setString(1, tabla);
            sentencia.setString(2, String.valueOf(clave));
            try (ResultSet resultado = sentencia.executeQuery()) {
                while (resultado.next()) {
                    filas.add(resultado.getString(1));
                }
            }
        }
        return filas;
    }

    /** El ultimo identificador que la columna identidad de conjunto_parametros entrego. */
    private static long ultimaIdentidadDeConjunto() throws SQLException {
        return contar(
                "SELECT pg_sequence_last_value("
                        + "pg_get_serial_sequence('conjunto_parametros', 'id')::regclass)");
    }

    private static long contar(String sql) throws SQLException {
        return Long.parseLong(texto(sql));
    }

    private static @Nullable String texto(String sql) throws SQLException {
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia = admin.prepareStatement(sql);
                ResultSet resultado = sentencia.executeQuery()) {
            return resultado.next() ? resultado.getString(1) : null;
        }
    }

    // ------------------------------------------------------------------

    /**
     * El repositorio de verdad, con pausas en los puntos que una carrera necesita.
     *
     * <p>Cada pausa se aplica un numero de veces y despues deja de estar: la relectura que el caso
     * de uso hace tras un choque pasa por los mismos metodos, y no puede quedarse esperando a un
     * hilo que ya termino.
     */
    private static final class RepositorioConPausas implements ParametrosRepository {

        private final ParametrosRepository real;
        private final Map<String, Pausa> antes = new ConcurrentHashMap<>();
        private final Map<String, Pausa> despues = new ConcurrentHashMap<>();

        RepositorioConPausas(ParametrosRepository real) {
            this.real = real;
        }

        void pausarAntes(String metodo, int veces, Runnable accion) {
            antes.put(metodo, new Pausa(new AtomicInteger(veces), accion));
        }

        void pausarDespues(String metodo, int veces, Runnable accion) {
            despues.put(metodo, new Pausa(new AtomicInteger(veces), accion));
        }

        void quitarLasPausas() {
            antes.clear();
            despues.clear();
        }

        private <T> T en(String metodo, Supplier<T> llamada) {
            Optional.ofNullable(antes.get(metodo)).ifPresent(Pausa::pasar);
            T resultado = llamada.get();
            Optional.ofNullable(despues.get(metodo)).ifPresent(Pausa::pasar);
            return resultado;
        }

        @Override
        public Pagina<ConjuntoDeParametros> conjuntos(Paginacion paginacion) {
            return real.conjuntos(paginacion);
        }

        @Override
        public Optional<ConjuntoDeParametros> conjunto(long id) {
            return real.conjunto(id);
        }

        @Override
        public Optional<ConjuntoDeParametros> selladoVigenteDe(Ejercicio ejercicio) {
            return real.selladoVigenteDe(ejercicio);
        }

        @Override
        public Optional<ConjuntoDeParametros> selladoPorId(long id) {
            return real.selladoPorId(id);
        }

        @Override
        public int ultimaVersionDe(Ejercicio ejercicio) {
            return en("ultimaVersionDe", () -> real.ultimaVersionDe(ejercicio));
        }

        @Override
        public ConjuntoDeParametros crear(ConjuntoDeParametros conjunto) {
            return real.crear(conjunto);
        }

        @Override
        public ConjuntoDeParametros crear(
                ConjuntoDeParametros conjunto, ClaveDeIdempotencia clave) {
            return real.crear(conjunto, clave);
        }

        @Override
        public Optional<ConjuntoDeParametros> abiertoConLaClave(ClaveDeIdempotencia clave) {
            return en("abiertoConLaClave", () -> real.abiertoConLaClave(clave));
        }

        @Override
        public ConjuntoDeParametros sellar(long conjuntoId, Instant cuando, String quien) {
            return en("sellar", () -> real.sellar(conjuntoId, cuando, quien));
        }

        @Override
        public void agregarParametro(long conjuntoId, long parametroId) {
            en(
                    "agregarParametro",
                    () -> {
                        real.agregarParametro(conjuntoId, parametroId);
                        return Boolean.TRUE;
                    });
        }

        @Override
        public boolean contiene(long conjuntoId, long parametroId) {
            return en("contiene", () -> real.contiene(conjuntoId, parametroId));
        }

        @Override
        public List<ParametroTributario> parametrosDe(long conjuntoId) {
            return real.parametrosDe(conjuntoId);
        }

        @Override
        public List<ParametroTributario> publicados(LlaveDeParametro llave) {
            return real.publicados(llave);
        }

        @Override
        public Pagina<ParametroTributario> parametros(Paginacion paginacion) {
            return real.parametros(paginacion);
        }
    }

    /** Una pausa que se aplica las veces que le quedan, y luego no. */
    private record Pausa(AtomicInteger restantes, Runnable accion) {
        void pasar() {
            if (restantes.getAndDecrement() > 0) {
                accion.run();
            }
        }
    }

    /**
     * Autoriza segun lo concedido a cada cuenta, y anota cada pregunta.
     *
     * <p>El guardia es el de verdad; lo que se sustituye es la copia local de la autorizacion, que
     * vive en el modulo {@code seguridad} y este no puede ver. Anotar las preguntas es lo que
     * permite afirmar que opcion y que privilegio exige cada ruta, visto desde la peticion.
     */
    private static final class ComprobadorQueAnota implements ComprobadorDeAcceso {

        private static final Map<String, Set<String>> CONCEDIDO =
                Map.of(
                        JEFE, Set.of("conjuntos:REGISTRO", "conjuntos:ESPECIAL"),
                        COMPONE, Set.of("conjuntos:REGISTRO"));

        private final List<String> preguntas = new CopyOnWriteArrayList<>();

        @Override
        public boolean autoriza(
                String usuario, String acceso, Privilegio privilegio, LocalDate fecha) {
            preguntas.add(usuario + ":" + acceso + ":" + privilegio);
            return CONCEDIDO.getOrDefault(usuario, Set.of()).contains(acceso + ":" + privilegio);
        }

        @Override
        public boolean conoceAlUsuario(String usuario) {
            return CONCEDIDO.containsKey(usuario);
        }
    }
}
