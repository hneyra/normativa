package kamayuk.normativa.seguridad.infraestructura.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import kamayuk.normativa.auditoria.AuditoriaJdbc;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.autorizacion.GuardiaDeAcceso;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.plataforma.tenant.OrigenContextFilter;
import kamayuk.normativa.plataforma.tenant.TenantContextFilter;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.seguridad.aplicacion.ConsultaDelCatalogo;
import kamayuk.normativa.seguridad.aplicacion.LecturasDeLaSesion;
import kamayuk.normativa.seguridad.aplicacion.SembradorDelCatalogo;
import kamayuk.normativa.seguridad.dominio.CatalogoDelSistema;
import kamayuk.normativa.seguridad.dominio.LecturaDeLaCopiaLocal;
import kamayuk.normativa.seguridad.infraestructura.ComprobadorDeAccesoJdbc;
import kamayuk.normativa.seguridad.infraestructura.LecturaDeLaCopiaLocalJdbc;
import kamayuk.normativa.seguridad.infraestructura.MunicipalidadRepositoryJdbc;
import kamayuk.normativa.web.ConfiguracionDeJson;
import kamayuk.normativa.web.GuardiaDeParametros;
import kamayuk.normativa.web.ManejadorDeErrores;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Las cinco lecturas de seguridad de #54 <b>de HTTP a PostgreSQL</b>, con el inquilino puesto SOLO
 * por {@link TenantContextFilter}. La corre {@code verificarAislamiento}.
 *
 * <h2>Por que de punta a punta, y no con la transaccion abierta por la prueba</h2>
 *
 * <p>Porque el defecto que hay que ver vive justo entre las dos familias de pruebas. {@code rentas}
 * lo pago en la etapa 4 de ADR-0039: retiro su caso de uso transaccional, dejo al controlador
 * llamando al repositorio, y {@code GET /seguridad/modulos} y {@code /accesos} contestaron 500 a
 * todo el mundo —sin transaccion no hay {@code SET LOCAL} y la politica RLS evalua {@code
 * ''::bigint}—. Ninguna prueba lo veia porque todas abrian su propia transaccion. Aqui:
 *
 * <ul>
 *   <li><b>nadie fija el inquilino a mano</b> durante la peticion: lo pone el filtro, del claim
 *       {@code municipalidad_id} del token;
 *   <li><b>nadie abre la transaccion por fuera</b>: los dos casos de uso van envueltos en un {@code
 *       TransactionInterceptor}, como Spring los proxifica en produccion, asi que lo que decide si
 *       hay transaccion es su anotacion;
 *   <li>y el guardia y el comprobador son los de verdad, contra la misma base.
 * </ul>
 *
 * <h2>El aislamiento (AC-7)</h2>
 *
 * <p>Dos municipalidades con <b>la misma cuenta</b>, «jperez», y todo lo demas distinto: el
 * catalogo de la B tiene un modulo y una opcion mas, la persona se llama distinto y los grupos
 * otorgan opciones que no se tocan. Si una lectura corriera con el inquilino de otra —o sin
 * ninguno—, alguna de esas diferencias saldria en la respuesta de la otra, o saldria un 500. Y la
 * fila de {@code municipalidad} es la que mas hay que mirar: su politica de lectura es {@code USING
 * (true)} (V1:620-621), asi que ahi el aislamiento no lo pone RLS sino el {@code WHERE} de {@code
 * MunicipalidadRepositoryJdbc} (G2, #52).
 *
 * <h2>Las capturas (AC-9)</h2>
 *
 * <p>La ultima clase compara lo que contesta la municipalidad A con los cinco JSON de {@code
 * docs/50-api/seguridad/}, que la interfaz usa como siembra de desarrollo (#64). Se regeneran con:
 *
 * <pre>
 * ./gradlew :kamayuk-normativa-seguridad:pruebaDeAislamiento -Dkamayuk.capturas.regenerar=true
 * </pre>
 *
 * <p>Se comparan en vez de escribirse siempre, a proposito: quien cambie la forma de una respuesta
 * tiene que ver el rojo y regenerar sabiendo que la interfaz lee ese archivo, no enterarse por un
 * diff que nadie mira.
 */
@DisplayName("#54 — las lecturas de seguridad, de HTTP a PostgreSQL")
class LecturasDeSeguridadDePuntaAPuntaTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-16T15:00:00Z"), ZoneId.of("America/Lima"));

    private static final String RAIZ = "/normativa/api/v1/seguridad";
    private static final String MODULOS = RAIZ + "/modulos";
    private static final String ACCESOS = RAIZ + "/accesos";
    private static final String SESION = RAIZ + "/sesion";
    private static final String MUNICIPALIDAD = RAIZ + "/sesion/municipalidad";
    private static final String PERMISOS = RAIZ + "/sesion/permisos";

    /** La misma cuenta en las dos: es lo que hace visible una fuga. */
    private static final String CUENTA = "jperez";

    private static final String REGENERAR = "kamayuk.capturas.regenerar";

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static BaseDeDatosDePrueba base;
    private static MockMvc mvc;
    private static long municipalidadA;
    private static long municipalidadB;

    @BeforeAll
    static void provisionar() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        municipalidadA =
                crearMunicipalidad("200601", "Municipalidad Provincial de Sullana", "PROVINCIAL");
        municipalidadB =
                crearMunicipalidad("200104", "Municipalidad Distrital de Catacaos", "DISTRITAL");

        DriverManagerDataSource pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));

        JdbcClient jdbc = JdbcClient.create(pool);
        TenantTransactionManager gestor = new TenantTransactionManager(pool);

        // El catalogo se siembra como lo siembra la implantacion: con el sembrador de verdad, su
        // transaccion y su contexto. Es lo unico que fija el inquilino a mano, y se limpia
        // enseguida.
        SembradorDelCatalogo sembrador =
                proxificado(
                        new SembradorDelCatalogo(jdbc, new AuditoriaJdbc(jdbc, RELOJ), RELOJ),
                        gestor);
        sembrarCatalogo(sembrador, municipalidadA);
        sembrarCatalogo(sembrador, municipalidadB);

        // Y lo que en produccion llega por el buzon de `identidad`, escrito con SQL: lo que esta
        // clase mide es la LECTURA, y montar el buzon para poblar la copia mediria otra cosa.
        TransactionTemplate transaccion = new TransactionTemplate(gestor);
        enLa(
                municipalidadA,
                transaccion,
                () -> {
                    usuario(jdbc, "Juan Perez Castillo");
                    grupo(jdbc, "Parametros del sistema", Map.of("parametros", "lectura"));
                });
        enLa(
                municipalidadB,
                transaccion,
                () -> {
                    // Lo que solo tiene la B: un modulo y una opcion que la A no puede ver.
                    jdbc.sql(
                                    "INSERT INTO modulo_sistema (municipalidad_id, codigo, nombre)"
                                            + " VALUES (current_setting('app.municipalidad_id')::bigint,"
                                            + " 'SOLO_DE_B', 'Solo de la municipalidad B')")
                            .update();
                    jdbc.sql(
                                    "INSERT INTO acceso (municipalidad_id, modulo_id, tipo, codigo,"
                                            + " nombre) SELECT"
                                            + " current_setting('app.municipalidad_id')::bigint, id,"
                                            + " 'OPCION_MENU', 'solo_de_b', 'Opcion de la B'"
                                            + " FROM modulo_sistema WHERE codigo = 'SOLO_DE_B'")
                            .update();
                    usuario(jdbc, "Juana Perez Sandoval");
                    grupo(
                            jdbc,
                            "Solo de la B",
                            Map.of(
                                    "solo_de_b", "lectura, registro",
                                    "parametros", "lectura, impresion"));
                });

        LecturaDeLaCopiaLocal copia = new LecturaDeLaCopiaLocalJdbc(jdbc);
        mvc =
                MockMvcBuilders.standaloneSetup(
                                new SeguridadController(
                                        proxificado(new ConsultaDelCatalogo(copia), gestor)),
                                new SesionController(
                                        proxificado(
                                                new LecturasDeLaSesion(
                                                        copia,
                                                        new MunicipalidadRepositoryJdbc(jdbc),
                                                        RELOJ),
                                                gestor)))
                        .addFilters(new TenantContextFilter(), new OrigenContextFilter())
                        .addInterceptors(
                                new GuardiaDeAcceso(
                                        proxificado(new ComprobadorDeAccesoJdbc(jdbc), gestor),
                                        RELOJ),
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
    }

    @AfterAll
    static void cerrar() {
        if (base != null) {
            base.close();
        }
    }

    @AfterEach
    void salir() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("una sesion de la municipalidad A no ve la copia de la B")
    class Aislamiento {

        @Test
        @DisplayName("los modulos: los de SU municipalidad, fila por fila")
        void losModulos() throws Exception {
            JsonNode deA = contenido(leer(municipalidadA, MODULOS));
            JsonNode deB = contenido(leer(municipalidadB, MODULOS));

            assertThat(ids(deA))
                    .as(
                            "[sin la transaccion de ConsultaDelCatalogo esta peticion es un 500, y con"
                                    + " el inquilino de otra serian las filas de otra] los ids que la"
                                    + " API da para A son los que la base tiene para A")
                    .containsExactlyInAnyOrderElementsOf(
                            idsEnLaBase("modulo_sistema", municipalidadA))
                    .doesNotContainAnyElementsOf(ids(deB));
            assertThat(codigos(deA))
                    .as(
                            "los modulos del catalogo de este sistema, y el que solo tiene la B no se"
                                    + " ve desde la A. Se derivan del catalogo y no se escriben: desde"
                                    + " #53 son DOS —SEGURIDAD y NORMATIVA— y una lista a mano habria"
                                    + " que volver a tocarla en el siguiente")
                    .containsExactlyInAnyOrderElementsOf(
                            CatalogoDelSistema.opciones().stream()
                                    .map(CatalogoDelSistema.Opcion::moduloCodigo)
                                    .distinct()
                                    .toList());
            assertThat(codigos(deB)).contains("SOLO_DE_B");
        }

        @Test
        @DisplayName("los accesos: las opciones de este sistema, sin la que solo tiene la B")
        void losAccesos() throws Exception {
            JsonNode deA = contenido(leer(municipalidadA, ACCESOS));
            JsonNode deB = contenido(leer(municipalidadB, ACCESOS));

            assertThat(ids(deA))
                    .containsExactlyInAnyOrderElementsOf(idsEnLaBase("acceso", municipalidadA))
                    .doesNotContainAnyElementsOf(ids(deB));
            assertThat(codigos(deA))
                    .as("el catalogo sembrado es CatalogoDelSistema, ni una opcion mas")
                    .containsExactlyInAnyOrderElementsOf(
                            CatalogoDelSistema.opciones().stream()
                                    .map(CatalogoDelSistema.Opcion::codigo)
                                    .toList())
                    .doesNotContain("solo_de_b");
            assertThat(codigos(deB)).contains("solo_de_b");
        }

        @Test
        @DisplayName("los permisos: la misma cuenta, y cada municipalidad contesta los suyos")
        void losPermisos() throws Exception {
            assertThat(leer(municipalidadA, PERMISOS))
                    .as(
                            "«jperez» de A solo tiene LECTURA sobre parametros; los permisos de"
                                    + " «jperez» de B —la opcion de la B, y la impresion— no son suyos")
                    .isEqualTo("{\"parametros\":[\"lectura\"]}");
            assertThat(leer(municipalidadB, PERMISOS))
                    .isEqualTo(
                            "{\"parametros\":[\"lectura\",\"impresion\"],"
                                    + "\"solo_de_b\":[\"lectura\",\"registro\"]}");
        }

        @Test
        @DisplayName("quien soy: la fila de usuario de SU municipalidad, con el ejercicio nulo")
        void quienSoy() throws Exception {
            JsonNode deA = JSON.readTree(leer(municipalidadA, SESION));
            JsonNode deB = JSON.readTree(leer(municipalidadB, SESION));

            assertThat(deA.path("nombre").asString()).isEqualTo("Juan Perez Castillo");
            assertThat(deB.path("nombre").asString()).isEqualTo("Juana Perez Sandoval");
            assertThat(deA.path("usuarioId").asLong())
                    .as("la misma cuenta son dos filas y dos identificadores")
                    .isNotEqualTo(deB.path("usuarioId").asLong());
            assertThat(deA.path("ejercicioDeTrabajo").isNull())
                    .as("nada escribe `sesion` en este sistema: el ejercicio viaja nulo (AC-5)")
                    .isTrue();
            assertThat(deB.path("ejercicioDeTrabajo").isNull()).isTrue();
        }

        @Test
        @DisplayName("de que municipalidad: la del token, y no otra")
        void deQueMunicipalidad() throws Exception {
            JsonNode deA = JSON.readTree(leer(municipalidadA, MUNICIPALIDAD));
            JsonNode deB = JSON.readTree(leer(municipalidadB, MUNICIPALIDAD));

            assertThat(deA.path("id").asLong()).isEqualTo(municipalidadA);
            assertThat(deA.path("ubigeo").asString())
                    .as("G2 (#52): la barra resuelve la municipalidad por su UBIGEO")
                    .isEqualTo("200601");
            assertThat(deA.path("nombre").asString())
                    .isEqualTo("Municipalidad Provincial de Sullana");
            assertThat(deB.path("id").asLong())
                    .as(
                            "`municipalidad` NO lleva RLS de tenant —su politica de lectura es USING"
                                    + " (true), V1:620-621—, asi que aqui el aislamiento lo pone el WHERE"
                                    + " contra current_setting y nada mas: sin el, el token de la B leeria"
                                    + " la fila de otra")
                    .isEqualTo(municipalidadB);
            assertThat(deB.path("ubigeo").asString()).isEqualTo("200104");
            assertThat(deB.path("tipo").asString()).isEqualTo("DISTRITAL");
        }

        @Test
        @DisplayName("el inquilino lo pone el TOKEN: nadie lo fija a mano, ni antes ni despues")
        void elInquilinoLoPoneElToken() throws Exception {
            assertThat(TenantContext.actualSiHay())
                    .as(
                            "[en cuanto alguien ponga un TenantContext.fijar alrededor de la peticion,"
                                    + " dejara de correr como en produccion y el 500 volvera a ser"
                                    + " invisible]")
                    .isEmpty();
            assertThat(OrigenContext.actualSiHay()).isEmpty();

            leer(municipalidadA, PERMISOS);

            assertThat(TenantContext.actualSiHay())
                    .as("y el filtro lo limpia al salir: el hilo vuelve al pool sin inquilino")
                    .isEmpty();
            assertThat(OrigenContext.actualSiHay()).isEmpty();
        }
    }

    @Nested
    @DisplayName("las capturas de docs/50-api/seguridad son lo que el backend contesta")
    class Capturas {

        @Test
        @DisplayName("GET /seguridad/modulos")
        void modulos() throws Exception {
            capturar("modulos.json", leer(municipalidadA, MODULOS));
        }

        @Test
        @DisplayName("GET /seguridad/accesos")
        void accesos() throws Exception {
            capturar("accesos.json", leer(municipalidadA, ACCESOS));
        }

        @Test
        @DisplayName("GET /seguridad/sesion")
        void sesion() throws Exception {
            capturar("sesion.json", leer(municipalidadA, SESION));
        }

        @Test
        @DisplayName("GET /seguridad/sesion/municipalidad")
        void municipalidad() throws Exception {
            capturar("sesion-municipalidad.json", leer(municipalidadA, MUNICIPALIDAD));
        }

        @Test
        @DisplayName("GET /seguridad/sesion/permisos")
        void permisos() throws Exception {
            capturar("sesion-permisos.json", leer(municipalidadA, PERMISOS));
        }
    }

    // ------------------------------------------------------------------

    /** La peticion con un token de la municipalidad y la cuenta, y su cuerpo si fue 200. */
    private static String leer(long municipalidad, String ruta) throws Exception {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new JwtAuthenticationToken(
                                Jwt.withTokenValue("t")
                                        .header("alg", "none")
                                        .subject(CUENTA)
                                        .claim("preferred_username", CUENTA)
                                        .claim(TenantContextFilter.CLAIM, municipalidad)
                                        .issuedAt(Instant.now())
                                        .expiresAt(Instant.now().plusSeconds(60))
                                        .build(),
                                List.of()));
        try {
            MvcResult resultado = mvc.perform(get(ruta)).andReturn();
            String cuerpo = resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
            assertThat(resultado.getResponse().getStatus())
                    .as(
                            "GET %s con el token de la municipalidad %d contesto: %s",
                            ruta, municipalidad, cuerpo)
                    .isEqualTo(200);
            return cuerpo;
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * Compara la respuesta con su captura, o la reescribe si se pidio regenerar.
     *
     * <p>La captura es el cuerpo tal cual, con sangria: la interfaz la carga como siembra y no
     * lleva ningun campo que el backend no publique.
     */
    private static void capturar(String nombre, String cuerpo) throws IOException {
        Path archivo = raizDelRepositorio().resolve("docs/50-api/seguridad").resolve(nombre);
        String publicada =
                JSON.writerWithDefaultPrettyPrinter().writeValueAsString(JSON.readTree(cuerpo))
                        + "\n";

        if (Boolean.getBoolean(REGENERAR)) {
            Files.createDirectories(archivo.getParent());
            Files.writeString(archivo, publicada, StandardCharsets.UTF_8);
            return;
        }

        assertThat(archivo)
                .as(
                        "«%s» no existe. Es la captura que la interfaz usa como siembra (#64); se"
                                + " genera con ./gradlew"
                                + " :kamayuk-normativa-seguridad:pruebaDeAislamiento -D%s=true",
                        archivo, REGENERAR)
                .exists();
        assertThat(Files.readString(archivo, StandardCharsets.UTF_8))
                .as(
                        "la respuesta del backend ya no es la captura publicada en «%s». La interfaz"
                                + " la usa como siembra de desarrollo: si el cambio de forma es"
                                + " deliberado, regenerala con -D%s=true y dilo en el PR",
                        archivo, REGENERAR)
                .isEqualTo(publicada);
    }

    /** El primer directorio hacia arriba que tiene {@code docs/50-api}. */
    private static Path raizDelRepositorio() {
        Path aqui = Path.of("").toAbsolutePath();
        while (aqui != null) {
            if (Files.isDirectory(aqui.resolve("docs").resolve("50-api"))) {
                return aqui;
            }
            aqui = aqui.getParent();
        }
        throw new IllegalStateException(
                "No se encontro docs/50-api subiendo desde " + Path.of("").toAbsolutePath());
    }

    private static JsonNode contenido(String pagina) {
        return JSON.readTree(pagina).path("contenido");
    }

    private static List<Long> ids(JsonNode filas) {
        List<Long> ids = new ArrayList<>();
        filas.forEach(fila -> ids.add(fila.path("id").asLong()));
        return ids;
    }

    private static List<String> codigos(JsonNode filas) {
        List<String> codigos = new ArrayList<>();
        filas.forEach(fila -> codigos.add(fila.path("codigo").asString()));
        return codigos;
    }

    private static List<Long> idsEnLaBase(String tabla, long municipalidad) throws SQLException {
        List<Long> ids = new ArrayList<>();
        try (Connection admin = base.conexionAdmin();
                PreparedStatement consulta =
                        admin.prepareStatement(
                                "SELECT id FROM " + tabla + " WHERE municipalidad_id = ?")) {
            consulta.setLong(1, municipalidad);
            try (ResultSet filas = consulta.executeQuery()) {
                while (filas.next()) {
                    ids.add(filas.getLong(1));
                }
            }
        }
        return ids;
    }

    private static long crearMunicipalidad(String ubigeo, String nombre, String tipo)
            throws SQLException {
        try (Connection admin = base.conexionAdmin();
                PreparedStatement alta =
                        admin.prepareStatement(
                                "INSERT INTO municipalidad (ubigeo, nombre, tipo) VALUES (?, ?, ?)"
                                        + " RETURNING id")) {
            alta.setString(1, ubigeo);
            alta.setString(2, nombre);
            alta.setString(3, tipo);
            try (ResultSet fila = alta.executeQuery()) {
                fila.next();
                return fila.getLong(1);
            }
        }
    }

    private static void sembrarCatalogo(SembradorDelCatalogo sembrador, long municipalidad) {
        TenantContext.fijar(new MunicipalidadId(municipalidad));
        OrigenContext.fijar(Origen.deProceso("implantacion"));
        try {
            sembrador.sembrar(Observacion.de("Siembra del catalogo para la prueba de #54"));
        } finally {
            OrigenContext.limpiar();
            TenantContext.limpiar();
        }
    }

    private static void enLa(long municipalidad, TransactionTemplate transaccion, Runnable cuerpo) {
        TenantContext.fijar(new MunicipalidadId(municipalidad));
        try {
            transaccion.executeWithoutResult(estado -> cuerpo.run());
        } finally {
            TenantContext.limpiar();
        }
    }

    /** La fila de «jperez» en la municipalidad del contexto. */
    private static long usuario(JdbcClient jdbc, String nombre) {
        return jdbc.sql(
                        "INSERT INTO usuario (municipalidad_id, cuenta, nombre) VALUES"
                                + " (current_setting('app.municipalidad_id')::bigint, :cuenta,"
                                + " :nombre) RETURNING id")
                .param("cuenta", CUENTA)
                .param("nombre", nombre)
                .query(Long.class)
                .single();
    }

    /**
     * Un grupo vigente con «jperez» dentro y sus permisos, por codigo de opcion.
     *
     * <p>Los privilegios van como la lista de columnas que se ponen a {@code true}; el orden en que
     * se escriben aqui no es el que sale, y eso es parte de lo que se mide.
     */
    private static void grupo(JdbcClient jdbc, String nombre, Map<String, String> permisos) {
        jdbc.sql(
                        "INSERT INTO grupo (municipalidad_id, nombre) VALUES"
                                + " (current_setting('app.municipalidad_id')::bigint, :nombre)")
                .param("nombre", nombre)
                .update();
        jdbc.sql(
                        "INSERT INTO miembro (municipalidad_id, grupo_id, usuario_id, usuario_alta)"
                                + " SELECT current_setting('app.municipalidad_id')::bigint, g.id,"
                                + " u.id, 'identidad' FROM grupo g, usuario u"
                                + " WHERE g.nombre = :nombre AND u.cuenta = :cuenta")
                .param("nombre", nombre)
                .param("cuenta", CUENTA)
                .update();
        new LinkedHashMap<>(permisos)
                .forEach(
                        (codigo, privilegios) -> {
                            String columnas =
                                    List.of(privilegios.split(",\\s*")).stream()
                                            .collect(Collectors.joining(", ", ", ", ""));
                            String verdades =
                                    List.of(privilegios.split(",\\s*")).stream()
                                            .map(privilegio -> "true")
                                            .collect(Collectors.joining(", ", ", ", ""));
                            int escritas =
                                    jdbc.sql(
                                                    "INSERT INTO permiso (municipalidad_id,"
                                                            + " acceso_id, grupo_id, usuario_registro"
                                                            + columnas
                                                            + ") SELECT"
                                                            + " current_setting('app.municipalidad_id')::bigint,"
                                                            + " a.id, g.id, 'identidad'"
                                                            + verdades
                                                            + " FROM acceso a, grupo g"
                                                            + " WHERE a.codigo = :codigo"
                                                            + " AND g.nombre = :nombre")
                                            .param("codigo", codigo)
                                            .param("nombre", nombre)
                                            .update();
                            assertThat(escritas)
                                    .as(
                                            "la opcion «%s» tiene que estar en el catalogo sembrado",
                                            codigo)
                                    .isEqualTo(1);
                        });
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxificado(T objetivo, TenantTransactionManager gestor) {
        ProxyFactory fabrica = new ProxyFactory(objetivo);
        fabrica.setProxyTargetClass(true);
        fabrica.addAdvice(
                new TransactionInterceptor(gestor, new AnnotationTransactionAttributeSource()));
        return (T) fabrica.getProxy();
    }
}
