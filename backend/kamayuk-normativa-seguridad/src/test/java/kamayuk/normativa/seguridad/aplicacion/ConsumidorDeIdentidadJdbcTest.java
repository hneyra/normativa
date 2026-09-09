package kamayuk.normativa.seguridad.aplicacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.seguridad.dominio.consumidor.BuzonDeIdentidad;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;
import kamayuk.normativa.seguridad.infraestructura.consumidor.AlertaAlCanalDelResponsable;
import kamayuk.normativa.seguridad.infraestructura.consumidor.ClienteHttpDelBuzonDeIdentidad;
import kamayuk.normativa.seguridad.infraestructura.consumidor.CopiaLocalDeLaAutorizacionJdbc;
import kamayuk.normativa.seguridad.infraestructura.consumidor.CredencialDeServicio;
import kamayuk.normativa.seguridad.infraestructura.consumidor.ResponsableDeLaCopiaLocal;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * El consumidor del buzon de {@code identidad}, de punta a punta y contra PostgreSQL real: el
 * cliente HTTP de verdad hablando con un buzon de mentira que sirve lo que sirve el de verdad, el
 * aplicador con sus transacciones de verdad, y la copia local leida como superusuario para saber
 * DONDE quedo cada fila (etapa 4 de ADR-0039, AC-2 y AC-7 de {@code identidad#4}).
 *
 * <h2>Los casos de uso van ENVUELTOS con el interceptor transaccional de verdad</h2>
 *
 * <p>El aplicador y el consumidor se proxifican con {@code TransactionInterceptor} + {@code
 * AnnotationTransactionAttributeSource}, que es lo que hace Spring en produccion. Sin eso, un
 * {@code @Transactional} sobre cualquiera de los dos es un comentario, y la propiedad que sostiene
 * el AC-2 —el acuse DESPUES del commit— no la podria medir nadie (es lo que {@code identidad} midio
 * en su etapa 2 con el buzon sin envolver).
 */
@DisplayName("Etapa 4 de ADR-0039 — el consumidor del buzon de identidad, contra PostgreSQL")
class ConsumidorDeIdentidadJdbcTest {

    private static final Instant AHORA = Instant.parse("2026-09-09T12:00:00Z");
    private static final String OPCION = "parametros";

    private static BaseDeDatosDePrueba base;
    private static final AtomicInteger SIGUIENTE_UBIGEO = new AtomicInteger(209901);

    /**
     * Cada caso estrena SU municipalidad (y la B cuando la pide): ninguna afirmacion lee lo que
     * dejo otro caso, que es lo que separa «esta vacio» de «esta vacio porque nadie escribio».
     */
    private long municipalidadA;

    private long municipalidadB;
    private static JsonMapper json;
    private static DriverManagerDataSource pool;
    private static TenantTransactionManager gestor;
    private static ServidorDeMentira canalDelResponsable;
    private static final List<String> AVISOS = new CopyOnWriteArrayList<>();

    private static final ch.qos.logback.core.read.ListAppender<
                    ch.qos.logback.classic.spi.ILoggingEvent>
            ANOTADOS = new ch.qos.logback.core.read.ListAppender<>();

    private final List<BuzonDeMentira> buzones = new ArrayList<>();

    @BeforeAll
    static void provisionar() throws Exception {
        ANOTADOS.start();
        ((ch.qos.logback.classic.Logger)
                        org.slf4j.LoggerFactory.getLogger(ConsumirEventosDeIdentidad.class))
                .addAppender(ANOTADOS);
        base = BaseDeDatosDePrueba.provisionar();
        json = JsonMapper.builder().build();

        pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));
        gestor = new TenantTransactionManager(pool);

        canalDelResponsable =
                ServidorDeMentira.arrancar(
                        (ruta, cuerpo) -> {
                            AVISOS.add(cuerpo);
                            return ServidorDeMentira.Respuesta.ok("{\"recibido\":true}");
                        });
    }

    @AfterAll
    static void liberar() throws IOException {
        if (canalDelResponsable != null) {
            canalDelResponsable.close();
        }
        if (base != null) {
            base.close();
        }
    }

    @BeforeEach
    void enLaMunicipalidadA() throws SQLException {
        municipalidadA = nuevaMunicipalidad();
        municipalidadB = nuevaMunicipalidad();
        TenantContext.fijar(new MunicipalidadId(municipalidadA));
        ANOTADOS.list.clear();
        AVISOS.clear();
    }

    /**
     * Una municipalidad recien implantada: con la opcion de este sistema, que es lo que la
     * implantacion siembra y sin la cual un PERMISO_FIJADO no tiene sobre que fijarse.
     */
    private static long nuevaMunicipalidad() throws SQLException {
        int ubigeo = SIGUIENTE_UBIGEO.getAndIncrement();
        long id = crearMunicipalidad(String.valueOf(ubigeo), "Municipalidad " + ubigeo);
        sembrarLaOpcion(id);
        return id;
    }

    @AfterEach
    void limpiar() throws IOException {
        TenantContext.limpiar();
        for (BuzonDeMentira buzon : buzones) {
            buzon.close();
        }
        buzones.clear();
    }

    // ------------------------------------------------------------------ el arnes

    private BuzonDeMentira buzon() throws IOException {
        BuzonDeMentira buzon = BuzonDeMentira.arrancar(json);
        buzones.add(buzon);
        return buzon;
    }

    private static AplicarUnEventoDeIdentidad aplicador() {
        return envolver(
                new AplicarUnEventoDeIdentidad(
                        new CopiaLocalDeLaAutorizacionJdbc(JdbcClient.create(pool), json)),
                gestor);
    }

    private ConsumirEventosDeIdentidad consumidorDe(BuzonDeMentira buzon) {
        return consumidorDe(
                new ClienteHttpDelBuzonDeIdentidad(
                        json, buzon.raiz(), CredencialDeServicio.fija("Bearer de-prueba")));
    }

    private ConsumirEventosDeIdentidad consumidorDe(BuzonDeIdentidad fuente) {
        return envolver(
                new ConsumirEventosDeIdentidad(
                        fuente,
                        aplicador(),
                        new AlertaAlCanalDelResponsable(
                                json,
                                new ResponsableDeLaCopiaLocal(
                                        "Quien atiende", canalDelResponsable.raiz())),
                        Clock.fixed(AHORA, ZoneOffset.UTC)),
                gestor);
    }

    /** El interceptor transaccional DE VERDAD, sobre un proxy de la clase. */
    private static <T> T envolver(T objetivo, TenantTransactionManager gestor) {
        ProxyFactory fabrica = new ProxyFactory(objetivo);
        fabrica.setProxyTargetClass(true);
        fabrica.addAdvice(
                new TransactionInterceptor(gestor, new AnnotationTransactionAttributeSource()));
        @SuppressWarnings("unchecked")
        T proxy = (T) fabrica.getProxy();
        return proxy;
    }

    private static String usuario(String cuenta, boolean habilitado) {
        return "{\"usuarioId\":7,\"cuenta\":\""
                + cuenta
                + "\",\"nombre\":\"Persona "
                + cuenta
                + "\",\"correo\":null,\"habilitado\":"
                + habilitado
                + ",\"vigenciaDesde\":\"2026-01-01\",\"vigenciaHasta\":null}";
    }

    private static String grupo(String nombre) {
        return "{\"grupoId\":3,\"nombre\":\""
                + nombre
                + "\",\"descripcion\":\"El grupo "
                + nombre
                + "\",\"habilitado\":true,\"vigenciaDesde\":null,\"vigenciaHasta\":null}";
    }

    private static String miembro(String grupo, String cuenta, boolean activo) {
        return "{\"grupoId\":3,\"grupoNombre\":\""
                + grupo
                + "\",\"usuarioId\":7,\"usuarioCuenta\":\""
                + cuenta
                + "\",\"activo\":"
                + activo
                + ",\"usuarioAlta\":\"admin\",\"usuarioBaja\":"
                + (activo ? "null" : "\"admin\"")
                + "}";
    }

    private static String permiso(String sistema, String codigo, String grupo, boolean lectura) {
        return "{\"sujeto\":\"GRUPO\",\"sujetoId\":3,\"sujetoNombre\":\""
                + grupo
                + "\",\"sistema\":\""
                + sistema
                + "\",\"codigo\":\""
                + codigo
                + "\",\"privilegios\":{\"ejecucion\":false,\"lectura\":"
                + lectura
                + ",\"registro\":true,\"modificacion\":false,\"eliminacion\":false,"
                + "\"impresion\":false,\"especial\":false},\"usuarioRegistro\":\"admin\"}";
    }

    // ------------------------------------------------------------------ los siete tipos

    @Nested
    @DisplayName("los siete tipos se aplican sobre la copia local, por clave natural")
    class LosSieteTipos {

        @Test
        @DisplayName("un usuario que llega y no existe se da de alta; su baja se aplica como baja")
        void altaYBajaDeUsuario() throws Exception {
            BuzonDeMentira buzon = buzon();
            UUID alta = buzon.publicar(1, "USUARIO_DADO_DE_ALTA", 7, usuario("jperez", true));
            UUID baja = buzon.publicar(2, "USUARIO_MODIFICADO", 7, usuario("jperez", false));

            ConsumirEventosDeIdentidad.Vuelta vuelta = consumidorDe(buzon).consumir();

            assertThat(vuelta.aplicados()).isEqualTo(2);
            assertThat(buzon.acusados())
                    .containsExactlyInAnyOrder(alta.toString(), baja.toString());
            // Una fila, y de baja. NO cero filas: una baja no borra (regla 4).
            assertThat(filas("usuario", "cuenta = 'jperez'", municipalidadA))
                    .containsExactly("jperez|false");
            assertThat(filas("identidad_evento_aplicado", "true", municipalidadA)).hasSize(2);
        }

        @Test
        @DisplayName("un grupo, su afiliacion y su desafiliacion: la fila se queda, con su baja")
        void afiliacionYDesafiliacion() throws Exception {
            BuzonDeMentira buzon = buzon();
            buzon.publicar(1, "USUARIO_DADO_DE_ALTA", 7, usuario("mlopez", true));
            buzon.publicar(2, "GRUPO_DADO_DE_ALTA", 3, grupo("Mesa de Partes"));
            buzon.publicar(3, "MIEMBRO_AFILIADO", 3, miembro("Mesa de Partes", "mlopez", true));
            buzon.publicar(4, "MIEMBRO_DESAFILIADO", 3, miembro("Mesa de Partes", "mlopez", false));

            ConsumirEventosDeIdentidad.Vuelta vuelta = consumidorDe(buzon).consumir();

            assertThat(vuelta.aplicados()).isEqualTo(4);
            assertThat(
                            consultar(
                                    "SELECT m.activo || '|' || (m.fecha_baja IS NOT NULL) || '|' ||"
                                            + " coalesce(m.usuario_baja, '-') || '|' || m.usuario_alta"
                                            + " FROM miembro m JOIN grupo g ON g.id = m.grupo_id"
                                            + "   AND g.municipalidad_id = m.municipalidad_id"
                                            + " WHERE m.municipalidad_id = "
                                            + municipalidadA
                                            + " AND g.nombre = 'Mesa de Partes'"))
                    .containsExactly("false|true|admin|admin");
        }

        @Test
        @DisplayName(
                "un permiso de `normativa` se fija con sus siete privilegios, y se vuelve a fijar")
        void unPermisoDeNormativaSeFija() throws Exception {
            BuzonDeMentira buzon = buzon();
            buzon.publicar(1, "GRUPO_DADO_DE_ALTA", 3, grupo("Lectores"));
            buzon.publicar(2, "PERMISO_FIJADO", 3, permiso("normativa", OPCION, "Lectores", true));

            consumidorDe(buzon).consumir();

            assertThat(privilegiosDe("Lectores", municipalidadA))
                    .containsExactly("false|true|true|false|false|false|false");

            // Volver a fijar sobre el mismo par NO crea una segunda fila: la reemplaza.
            buzon.publicar(3, "PERMISO_FIJADO", 3, permiso("normativa", OPCION, "Lectores", false));
            consumidorDe(buzon).consumir();

            assertThat(privilegiosDe("Lectores", municipalidadA))
                    .containsExactly("false|false|true|false|false|false|false");
        }

        @Test
        @DisplayName(
                "AC-7 (4): un permiso de OTRO sistema sobre una opcion homonima se IGNORA, con aviso y acusado")
        void unPermisoDeOtroSistemaSeIgnora() throws Exception {
            BuzonDeMentira buzon = buzon();
            buzon.publicar(1, "GRUPO_DADO_DE_ALTA", 3, grupo("Cajeros"));
            // `parametros` es una opcion de `normativa` Y de `rentas`: el codigo coincide, el
            // sistema no. Aplicarlo aqui fijaria un permiso que nadie concedio en este sistema.
            UUID ajeno =
                    buzon.publicar(
                            2, "PERMISO_FIJADO", 3, permiso("rentas", OPCION, "Cajeros", true));

            ConsumirEventosDeIdentidad.Vuelta vuelta = consumidorDe(buzon).consumir();

            assertThat(vuelta.ignorados())
                    .as("un permiso de otro sistema no es de esta copia")
                    .isEqualTo(1);
            assertThat(privilegiosDe("Cajeros", municipalidadA))
                    .as(
                            "[AC-7 (4)] aplicado como propio, «Cajeros» tendria permiso sobre"
                                    + " `parametros` de normativa sin que nadie lo concediera aqui")
                    .isEmpty();
            assertThat(buzon.acusados()).contains(ajeno.toString());
            assertThat(filas("identidad_evento_muerto", "true", municipalidadA))
                    .as("ignorado no es apartado: el hecho esta bien, solo que no es de aqui")
                    .isEmpty();
            assertThat(ANOTADOS.list)
                    .anySatisfy(
                            linea ->
                                    assertThat(linea.getFormattedMessage())
                                            .contains("IGNORADO")
                                            .contains("OTRO sistema"));
        }

        @Test
        @DisplayName("un hecho servido dos veces se aplica UNA: la entrega es al menos una vez")
        void unHechoServidoDosVecesSeAplicaUna() throws Exception {
            BuzonDeMentira buzon = buzon();
            UUID alta = buzon.publicar(1, "USUARIO_DADO_DE_ALTA", 7, usuario("rquispe", true));
            ConsumirEventosDeIdentidad consumidor = consumidorDe(buzon);
            consumidor.consumir();

            // El acuse se perdio por el camino: el emisor lo vuelve a servir.
            buzon.olvidarLosAcuses();
            ConsumirEventosDeIdentidad.Vuelta segunda = consumidor.consumir();

            assertThat(segunda.yaEstaban()).isEqualTo(1);
            assertThat(segunda.aplicados()).isZero();
            assertThat(buzon.acusados()).containsExactly(alta.toString());
            assertThat(filas("usuario", "cuenta = 'rquispe'", municipalidadA)).hasSize(1);
        }
    }

    // ------------------------------------------------------------------ nunca / hoy no

    @Nested
    @DisplayName("lo que no se puede aplicar")
    class LoQueNoSePuedeAplicar {

        @Test
        @DisplayName(
                "NUNCA: se aparta con su cuerpo y su motivo, se acusa y se avisa al responsable")
        void nuncaSeApartaSeAcusaYSeAvisa() throws Exception {
            BuzonDeMentira buzon = buzon();
            UUID tipoDesconocido = buzon.publicar(1, "USUARIO_BORRADO", 7, usuario("nadie", true));
            UUID ilegible = buzon.publicar(2, "USUARIO_DADO_DE_ALTA", 7, "esto no es JSON");
            buzon.publicar(3, "GRUPO_DADO_DE_ALTA", 3, grupo("Tesoreria"));
            UUID sinOpcion =
                    buzon.publicar(
                            4,
                            "PERMISO_FIJADO",
                            3,
                            permiso("normativa", "opcion_que_no_hay", "Tesoreria", true));
            UUID despues = buzon.publicar(5, "USUARIO_DADO_DE_ALTA", 8, usuario("despues", true));

            ConsumirEventosDeIdentidad.Vuelta vuelta = consumidorDe(buzon).consumir();

            assertThat(vuelta.apartados()).isEqualTo(3);
            assertThat(vuelta.aplicados()).as("la vuelta SIGUE con los demas").isEqualTo(2);
            assertThat(buzon.acusados())
                    .as("apartado y acusado deja de servirse: no bloquea la cola")
                    .contains(
                            tipoDesconocido.toString(),
                            ilegible.toString(),
                            sinOpcion.toString(),
                            despues.toString());
            assertThat(
                            consultar(
                                    "SELECT tipo || '|' || cuerpo || '|' || motivo"
                                            + " FROM identidad_evento_muerto"
                                            + " WHERE municipalidad_id = "
                                            + municipalidadA
                                            + " ORDER BY secuencia"))
                    .hasSize(3)
                    .satisfies(
                            filas -> {
                                assertThat(filas.get(0))
                                        .startsWith("USUARIO_BORRADO|")
                                        .contains("no lo conoce");
                                // El cuerpo se conserva TAL COMO LLEGO, y por eso es `text`.
                                assertThat(filas.get(1))
                                        .contains("|esto no es JSON|")
                                        .contains("no es JSON");
                                assertThat(filas.get(2)).contains("opcion_que_no_hay");
                            });
            assertThat(AVISOS)
                    .as("un aviso por hecho apartado, al canal del responsable, con su nombre")
                    .hasSize(3)
                    .allSatisfy(aviso -> assertThat(aviso).contains("Quien atiende"))
                    .last()
                    .asString()
                    .contains("\"apartadosSinExplicar\":3");
        }

        @Test
        @DisplayName(
                "AC-7 (3): HOY NO —lo que nombra no llego— NO se acusa, NO se aparta, y la vuelta se corta en orden")
        void hoyNoSePostergaSinAcusar() throws Exception {
            BuzonDeMentira buzon = buzon();
            // La secuencia se asigna al INSERT y no al COMMIT (V2 de `identidad`): el hecho 2
            // puede quedar visible antes que el 1 si aquel tardo mas en confirmar.
            UUID afiliacion =
                    buzon.publicar(2, "MIEMBRO_AFILIADO", 3, miembro("Recaudacion", "acruz", true));
            UUID detras = buzon.publicar(3, "USUARIO_DADO_DE_ALTA", 9, usuario("detras", true));
            ConsumirEventosDeIdentidad consumidor = consumidorDe(buzon);

            ConsumirEventosDeIdentidad.Vuelta primera = consumidor.consumir();

            assertThat(primera.postergado())
                    .as(
                            "[AC-7 (3)] la afiliacion cuyo grupo no llego se POSTERGA —la vuelta la"
                                    + " nombra y no la acusa— y no se aparta: apartada, `identidad`"
                                    + " ya no la sirve y el grupo que llegue despues se queda sin su"
                                    + " miembro para siempre, sin un solo error")
                    .isEqualTo(afiliacion);
            assertThat(primera.sinProgreso()).isTrue();
            assertThat(buzon.acusados())
                    .as("[AC-7 (3)] postergado NO es acusado: `identidad` lo vuelve a servir")
                    .isEmpty();
            assertThat(filas("identidad_evento_muerto", "true", municipalidadA))
                    .as(
                            "[AC-7 (3)] postergado NO es apartado: el hecho esta bien, falta lo de antes")
                    .isEmpty();
            assertThat(AVISOS).as("y no se avisa: no hay nada roto que atender").isEmpty();
            assertThat(filas("usuario", "cuenta = 'detras'", municipalidadA))
                    .as("la vuelta se corta EN ORDEN: lo que va detras espera")
                    .isEmpty();
            assertThat(ANOTADOS.list)
                    .anySatisfy(
                            linea ->
                                    assertThat(linea.getFormattedMessage())
                                            .contains("POSTERGADO")
                                            .contains("Recaudacion")
                                            .contains("acruz"));

            // Llegan los que iban delante, y la vuelta siguiente aplica los cuatro en orden.
            buzon.publicar(0, "USUARIO_DADO_DE_ALTA", 9, usuario("acruz", true));
            buzon.publicar(1, "GRUPO_DADO_DE_ALTA", 3, grupo("Recaudacion"));
            ConsumirEventosDeIdentidad.Vuelta segunda = consumidor.consumir();

            assertThat(segunda.aplicados()).isEqualTo(4);
            assertThat(segunda.postergado()).isNull();
            assertThat(buzon.acusados()).contains(afiliacion.toString(), detras.toString());
        }

        @Test
        @DisplayName("AC-7 (1): un hecho cuyo COMMIT falla NO se acusa, y lo que iba delante si")
        void unCommitQueFallaNoSeAcusa() throws Exception {
            // Un CONSTRAINT TRIGGER diferido: la fila entra, y es el COMMIT el que la rechaza. Es
            // la
            // unica forma de separar «la escritura fallo» de «la confirmacion fallo», que es donde
            // un acuse anticipado pierde el hecho para siempre.
            ejecutarComoAdmin(
                    "CREATE OR REPLACE FUNCTION rechazar_al_confirmar() RETURNS trigger"
                            + " LANGUAGE plpgsql AS $$ BEGIN"
                            + " IF NEW.cuenta = 'commit-que-falla' THEN"
                            + "   RAISE EXCEPTION 'el commit falla a proposito';"
                            + " END IF; RETURN NEW; END $$",
                    "CREATE CONSTRAINT TRIGGER usuario_commit_que_falla AFTER INSERT ON usuario"
                            + " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW"
                            + " EXECUTE FUNCTION rechazar_al_confirmar()");
            try {
                BuzonDeMentira buzon = buzon();
                UUID delante =
                        buzon.publicar(1, "USUARIO_DADO_DE_ALTA", 1, usuario("delante", true));
                UUID falla =
                        buzon.publicar(
                                2, "USUARIO_DADO_DE_ALTA", 2, usuario("commit-que-falla", true));
                UUID detras =
                        buzon.publicar(
                                3, "USUARIO_DADO_DE_ALTA", 3, usuario("detras-del-fallo", true));

                Throwable fallo = catchThrowable(() -> consumidorDe(buzon).consumir());

                // Medido: un trigger diferido que falla sale como TransactionSystemException («JDBC
                // commit failed»), no como DataAccessException; el consumidor atrapa las dos.
                assertThat(fallo)
                        .as("la base rechazo el commit: la corrida sale distinta de cero")
                        .isInstanceOfAny(DataAccessException.class, TransactionException.class);
                assertThat(buzon.acusados())
                        .as(
                                "[AC-7 (1)] el hecho cuyo commit fallo NO puede estar acusado:"
                                        + " acusado, `identidad` no lo vuelve a servir y se pierde"
                                        + " para siempre. Y lo que iba delante, confirmado, SI")
                        .containsExactly(delante.toString());
                assertThat(filas("usuario", "cuenta = 'commit-que-falla'", municipalidadA))
                        .isEmpty();
                assertThat(filas("usuario", "cuenta = 'delante'", municipalidadA)).hasSize(1);
                assertThat(filas("usuario", "cuenta = 'detras-del-fallo'", municipalidadA))
                        .as("y lo que iba detras espera a la vuelta siguiente")
                        .isEmpty();
                assertThat(buzon.acusados()).doesNotContain(falla.toString(), detras.toString());
            } finally {
                ejecutarComoAdmin(
                        "DROP TRIGGER IF EXISTS usuario_commit_que_falla ON usuario",
                        "DROP FUNCTION IF EXISTS rechazar_al_confirmar()");
            }
        }
    }

    // ------------------------------------------------------------------ una transaccion por hecho

    @Test
    @DisplayName(
            "AC-7 (2): cada hecho abre SU transaccion con SU municipalidad, aunque el llamador tenga una abierta")
    void cadaHechoEnSuMunicipalidad() {
        AplicarUnEventoDeIdentidad aplicador = aplicador();
        EventoRecibido deA = evento(1, "USUARIO_DADO_DE_ALTA", usuario("de-a", true));
        EventoRecibido deB = evento(2, "USUARIO_DADO_DE_ALTA", usuario("de-b", true));

        // Una transaccion AJENA abierta con A, y dentro de ella dos hechos de dos municipalidades:
        // es lo que haria una implantacion que recorriera varias, o una prueba descuidada.
        new TransactionTemplate(gestor)
                .executeWithoutResult(
                        tx -> {
                            aplicador.aplicar(deA, AHORA);
                            TenantContext.fijar(new MunicipalidadId(municipalidadB));
                            aplicador.aplicar(deB, AHORA);
                        });

        assertThat(filas("usuario", "cuenta = 'de-b'", municipalidadB))
                .as(
                        "[AC-7 (2)] con REQUIRED el hecho de B se escribiria bajo el SET LOCAL de A"
                                + " —las escrituras ponen current_setting(), no un parametro— y la"
                                + " cuenta de B apareceria en A, sin un solo error")
                .hasSize(1);
        assertThat(filas("usuario", "cuenta = 'de-b'", municipalidadA)).isEmpty();
        assertThat(filas("usuario", "cuenta = 'de-a'", municipalidadA)).hasSize(1);
        assertThat(filas("identidad_evento_aplicado", "true", municipalidadB)).hasSize(1);
    }

    @Test
    @DisplayName("y dos municipalidades con sus dos buzones no se mezclan")
    void dosMunicipalidadesDosBuzones() throws Exception {
        BuzonDeMentira deA = buzon();
        BuzonDeMentira deB = buzon();
        deA.publicar(1, "GRUPO_DADO_DE_ALTA", 3, grupo("Solo en A"));
        deB.publicar(1, "GRUPO_DADO_DE_ALTA", 3, grupo("Solo en B"));
        ConsumirEventosDeIdentidad consumidorA = consumidorDe(deA);
        ConsumirEventosDeIdentidad consumidorB = consumidorDe(deB);

        consumidorA.consumir();
        TenantContext.fijar(new MunicipalidadId(municipalidadB));
        consumidorB.consumir();

        assertThat(filas("grupo", "nombre LIKE 'Solo en %'", municipalidadA))
                .containsExactly("Solo en A|true");
        assertThat(filas("grupo", "nombre LIKE 'Solo en %'", municipalidadB))
                .containsExactly("Solo en B|true");
    }

    // ------------------------------------------------------------------ el buzon que no contesta

    @Nested
    @DisplayName("el buzon que no contesta")
    class ElBuzonQueNoContesta {

        @Test
        @DisplayName("un buzon apagado corta la vuelta sin acusar nada, y es transitorio")
        void apagado() throws Exception {
            BuzonDeMentira buzon = buzon();
            String raiz = buzon.raiz();
            buzon.close();

            assertThatThrownBy(
                            () ->
                                    consumidorDe(
                                                    new ClienteHttpDelBuzonDeIdentidad(
                                                            json,
                                                            raiz,
                                                            CredencialDeServicio.fija("Bearer x")))
                                            .consumir())
                    .isInstanceOf(BuzonDeIdentidad.IdentidadNoContesta.class);
        }

        @Test
        @DisplayName("un 403 al leer NO mata ningun hecho: habla de quien llama y se reintenta")
        void rechazadoAlLeer() throws Exception {
            BuzonDeMentira buzon = buzon();
            buzon.publicar(1, "USUARIO_DADO_DE_ALTA", 7, usuario("nunca-llega", true));
            buzon.rechazaCon(403);

            assertThatThrownBy(() -> consumidorDe(buzon).consumir())
                    .isInstanceOf(BuzonDeIdentidad.IdentidadNoContesta.class)
                    .hasMessageContaining("quien llama");
            assertThat(filas("identidad_evento_muerto", "true", municipalidadA)).isEmpty();
            assertThat(buzon.acusados()).isEmpty();
        }

        @Test
        @DisplayName(
                "un 422 al acusar se REGISTRA con el cuerpo del rechazo; lo aplicado sigue aplicado")
        void rechazadoAlAcusar() throws Exception {
            BuzonDeMentira buzon = buzon();
            UUID alta =
                    buzon.publicar(
                            1, "USUARIO_DADO_DE_ALTA", 7, usuario("aplicado-y-sin-acusar", true));
            BuzonDeIdentidad fuente =
                    new ClienteHttpDelBuzonDeIdentidad(
                            json, buzon.raiz(), CredencialDeServicio.fija("Bearer x"));
            // Un acuse que nombra un hecho que el buzon no publico: el de verdad lo rechaza entero.
            BuzonDeIdentidad conUnAcuseDeMas =
                    new BuzonDeIdentidad() {
                        @Override
                        public Lote pendientes(int limite) {
                            return fuente.pendientes(limite);
                        }

                        @Override
                        public void acusar(List<UUID> eventoIds) {
                            List<UUID> deMas = new ArrayList<>(eventoIds);
                            deMas.add(UUID.randomUUID());
                            fuente.acusar(deMas);
                        }
                    };

            assertThatThrownBy(() -> consumidorDe(conUnAcuseDeMas).consumir())
                    .isInstanceOf(BuzonDeIdentidad.IdentidadNoContesta.class)
                    .hasMessageContaining("RECHAZO el acuse con 422")
                    .hasMessageContaining("VALIDACION");
            assertThat(filas("usuario", "cuenta = 'aplicado-y-sin-acusar'", municipalidadA))
                    .as("lo aplicado SIGUE aplicado; se volvera a servir y a deduplicar")
                    .hasSize(1);
            assertThat(buzon.acusados()).doesNotContain(alta.toString());
        }
    }

    // ------------------------------------------------------------------ el runner

    @Test
    @DisplayName("las vueltas paran cuando una no avanza, y no a las cincuenta")
    void lasVueltasParanSinProgreso() throws Exception {
        BuzonDeMentira buzon = buzon();
        buzon.publicar(1, "MIEMBRO_AFILIADO", 3, miembro("Nunca llega", "nadie", true));

        CorrerElConsumidorDeIdentidad.darVueltas(
                consumidorDe(buzon), org.slf4j.LoggerFactory.getLogger("prueba"));

        assertThat(buzon.lecturas())
                .as(
                        "un hecho postergado no se acusa y volveria en cada vuelta: se para a la primera")
                .isEqualTo(1);
    }

    @Test
    @DisplayName(
            "y siguen mientras haya algo que aplicar: dos paginas son dos vueltas y una mas vacia")
    void lasVueltasSiguenMientrasAvancen() throws Exception {
        BuzonDeMentira buzon = buzon();
        for (int i = 1; i <= 201; i++) {
            buzon.publicar(i, "USUARIO_DADO_DE_ALTA", i, usuario("cuenta-" + i, true));
        }

        CorrerElConsumidorDeIdentidad.darVueltas(
                consumidorDe(buzon), org.slf4j.LoggerFactory.getLogger("prueba"));

        assertThat(buzon.pendientes()).isZero();
        assertThat(buzon.lecturas()).isEqualTo(3);
        assertThat(filas("usuario", "cuenta LIKE 'cuenta-%'", municipalidadA)).hasSize(201);
    }

    // ------------------------------------------------------------------ ayudantes

    private static EventoRecibido evento(long secuencia, String tipo, String cuerpo) {
        return new EventoRecibido(
                UUID.randomUUID(), secuencia, tipo, secuencia, cuerpo, "x".repeat(64), AHORA);
    }

    private static long crearMunicipalidad(String ubigeo, String nombre) throws SQLException {
        try (Connection admin = base.conexionAdmin();
                Statement sentencia = admin.createStatement()) {
            try (ResultSet fila =
                    sentencia.executeQuery(
                            "INSERT INTO municipalidad (ubigeo, nombre, tipo) VALUES ('"
                                    + ubigeo
                                    + "', '"
                                    + nombre
                                    + "', 'DISTRITAL') RETURNING id")) {
                fila.next();
                return fila.getLong(1);
            }
        }
    }

    private static void sembrarLaOpcion(long municipalidad) throws SQLException {
        try (Connection admin = base.conexionAdmin();
                Statement sentencia = admin.createStatement()) {
            sentencia.execute(
                    "INSERT INTO modulo_sistema (municipalidad_id, codigo, nombre) VALUES ("
                            + municipalidad
                            + ", 'SEGURIDAD', 'Seguridad')");
            sentencia.execute(
                    "INSERT INTO acceso (municipalidad_id, modulo_id, tipo, codigo, nombre)"
                            + " SELECT "
                            + municipalidad
                            + ", id, 'OPCION_MENU', '"
                            + OPCION
                            + "', 'Parametros del sistema' FROM modulo_sistema"
                            + " WHERE municipalidad_id = "
                            + municipalidad);
        }
    }

    private static void ejecutarComoAdmin(String... sentencias) throws SQLException {
        try (Connection admin = base.conexionAdmin();
                Statement sentencia = admin.createStatement()) {
            for (String sql : sentencias) {
                sentencia.execute(sql);
            }
        }
    }

    /** Filas de una tabla EN una municipalidad, leidas como superusuario: donde quedo cada una. */
    private static List<String> filas(String tabla, String donde, long municipalidad) {
        String columnas =
                switch (tabla) {
                    case "usuario" -> "cuenta || '|' || habilitado";
                    case "grupo" -> "nombre || '|' || habilitado";
                    default -> "evento_id::text";
                };
        return consultar(
                "SELECT "
                        + columnas
                        + " FROM "
                        + tabla
                        + " WHERE municipalidad_id = "
                        + municipalidad
                        + " AND ("
                        + donde
                        + ") ORDER BY 1");
    }

    private static List<String> privilegiosDe(String grupo, long municipalidad) {
        return consultar(
                "SELECT p.ejecucion || '|' || p.lectura || '|' || p.registro || '|' ||"
                        + " p.modificacion || '|' || p.eliminacion || '|' || p.impresion || '|' ||"
                        + " p.especial"
                        + " FROM permiso p JOIN grupo g ON g.id = p.grupo_id"
                        + "   AND g.municipalidad_id = p.municipalidad_id"
                        + " WHERE p.municipalidad_id = "
                        + municipalidad
                        + " AND g.nombre = '"
                        + grupo
                        + "'");
    }

    private static List<String> consultar(String sql) {
        List<String> filas = new ArrayList<>();
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia = admin.prepareStatement(sql);
                ResultSet fila = sentencia.executeQuery()) {
            while (fila.next()) {
                filas.add(fila.getString(1));
            }
            return filas;
        } catch (SQLException noSePudo) {
            throw new IllegalStateException(sql, noSePudo);
        }
    }
}
