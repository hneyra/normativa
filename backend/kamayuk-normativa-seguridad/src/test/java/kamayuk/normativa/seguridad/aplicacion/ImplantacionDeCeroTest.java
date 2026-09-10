package kamayuk.normativa.seguridad.aplicacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import kamayuk.normativa.auditoria.AuditoriaJdbc;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.seguridad.dominio.CatalogoDelSistema;
import kamayuk.normativa.seguridad.infraestructura.RegistroDeMunicipalidadesJdbc;
import kamayuk.normativa.seguridad.infraestructura.consumidor.AlertaAlCanalDelResponsable;
import kamayuk.normativa.seguridad.infraestructura.consumidor.ClienteHttpDelBuzonDeIdentidad;
import kamayuk.normativa.seguridad.infraestructura.consumidor.CopiaLocalDeLaAutorizacionJdbc;
import kamayuk.normativa.seguridad.infraestructura.consumidor.CredencialDeServicio;
import kamayuk.normativa.seguridad.infraestructura.consumidor.ResponsableDeLaCopiaLocal;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import tools.jackson.databind.json.JsonMapper;

/**
 * Una implantacion DE CERO, contra PostgreSQL de verdad: la municipalidad se da de alta, el
 * catalogo se siembra, y <b>el administrador entra por el buzon de {@code identidad}</b> (etapa 5
 * de ADR-0039, AC-2 y AC-3 de {@code identidad#5}).
 *
 * <h2>Que cambio, y por que esta prueba no existia antes</h2>
 *
 * <p>Hasta la etapa 4 el administrador lo escribia {@code SembradorDeLaCopiaLocal} con cuatro
 * {@code INSERT} directos, asi que «despues de implantar hay a quien entrar» era cierto por
 * construccion y no habia nada que medir —de hecho <b>este repositorio no tenia ni una prueba de
 * {@code ImplantarMunicipalidad}</b>, medido sobre {@code origin/main}—. Desde la etapa 5 la unica
 * forma de que esta base conozca a alguien es que llegue por el buzon, asi que la afirmacion pasa a
 * depender de otro sistema y hay que ejercerla.
 *
 * <h2>El buzon es de mentira; la corriente de eventos, la de verdad</h2>
 *
 * <p>{@code identidad} no se levanta aqui —sin demonio de Docker en esta maquina—, asi que el buzon
 * lo sirve {@link BuzonDeMentira} por HTTP, con la forma de {@code EventosController}, y el cliente
 * que lo lee es el de produccion. Lo que se le publica es <b>lo que su implantacion emite</b>, en
 * su orden: el grupo de administracion, el administrador, su afiliacion, sus permisos sobre los
 * CINCO catalogos —de los que solo uno es de este sistema—, el grupo de consumidores del buzon con
 * su unica opcion, y las cuatro cuentas de servicio con sus afiliaciones. Los cuerpos se copian
 * campo a campo de {@code HechoDeIdentidad}: ver {@link CuerposComoLosPublicaIdentidad}.
 *
 * <p>Lo que esto NO demuestra, y se dice: que {@code identidad} conteste eso <b>por HTTP de
 * verdad</b>. Lo que se ejerce de verdad es de HTTP a PostgreSQL de este lado.
 */
@DisplayName(
        "Etapa 5 de ADR-0039 — una implantacion de cero, y el administrador llega por el buzon")
class ImplantacionDeCeroTest {

    private static final Instant AHORA = Instant.parse("2026-09-10T12:00:00Z");

    /** La unica opcion de este sistema, y la unica sobre la que se puede fijar un permiso aqui. */
    private static final String OPCION = CatalogoDelSistema.opciones().get(0).codigo();

    private static final String ADMINISTRADOR = "administrador";
    private static final String GRUPO_DE_ADMINISTRACION = "Administracion del sistema";
    private static final String GRUPO_DE_CONSUMIDORES = "Consumidores del buzon";

    /** Los cuatro sistemas que consumen el buzon: `identidad` no se consume a si mismo. */
    private static final List<String> CONSUMIDORES =
            List.of("rentas", "catastro", "normativa", "caja");

    private static BaseDeDatosDePrueba base;
    private static JsonMapper json;
    private static DriverManagerDataSource pool;
    private static TenantTransactionManager gestor;
    private static ServidorDeMentira canalDelResponsable;
    private static final List<String> AVISOS = new CopyOnWriteArrayList<>();
    private static final AtomicInteger SIGUIENTE_UBIGEO = new AtomicInteger(219901);

    private final List<BuzonDeMentira> buzones = new ArrayList<>();
    private String ubigeo;

    @BeforeAll
    static void provisionar() throws Exception {
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

    /** Cada caso estrena SU ubigeo: ninguna afirmacion lee lo que dejo otro. */
    @BeforeEach
    void unaMunicipalidadNueva() {
        ubigeo = String.valueOf(SIGUIENTE_UBIGEO.getAndIncrement());
        AVISOS.clear();
    }

    @AfterEach
    void limpiar() throws IOException {
        TenantContext.limpiar();
        for (BuzonDeMentira buzon : buzones) {
            buzon.close();
        }
        buzones.clear();
    }

    // ------------------------------------------------------------------ AC-2

    @Nested
    @DisplayName("AC-2 — de cero: la municipalidad, su catalogo y la autorizacion del buzon")
    class DeCero {

        @Test
        @DisplayName(
                "el administrador queda con sus SIETE privilegios sobre la opcion de este sistema,"
                        + " llegado por el buzon y no sembrado")
        void unaImplantacionDeCero() throws Exception {
            BuzonDeMentira buzon = buzonConLoQueIdentidadPublica();

            implantar(buzon).run(null);

            long id = municipalidad();
            assertThat(filas("SELECT cuenta FROM usuario WHERE municipalidad_id = " + id))
                    .as(
                            "[AC-2] las cinco cuentas que `identidad` publica: el administrador y"
                                    + " las cuatro de servicio. Ninguna la escribio esta implantacion:"
                                    + " desde la etapa 5 el sembrador no toca `usuario`")
                    .containsExactlyInAnyOrder(
                            ADMINISTRADOR,
                            "service-account-kamayuk-rentas-servicio-" + ubigeo,
                            "service-account-kamayuk-catastro-servicio-" + ubigeo,
                            "service-account-kamayuk-normativa-servicio-" + ubigeo,
                            "service-account-kamayuk-caja-servicio-" + ubigeo);

            assertThat(
                            filas(
                                    "SELECT g.nombre FROM miembro m JOIN grupo g ON g.id ="
                                            + " m.grupo_id AND g.municipalidad_id = m.municipalidad_id"
                                            + " JOIN usuario u ON u.id = m.usuario_id AND"
                                            + " u.municipalidad_id = m.municipalidad_id WHERE"
                                            + " m.municipalidad_id = "
                                            + id
                                            + " AND u.cuenta = '"
                                            + ADMINISTRADOR
                                            + "' AND m.activo"))
                    .as("y esta afiliado al grupo de administracion")
                    .containsExactly(GRUPO_DE_ADMINISTRACION);

            assertThat(privilegiosDelAdministrador(id))
                    .as(
                            "[AC-2] los SIETE sobre «%s», que es la unica opcion de `normativa`."
                                    + " Sin esto la cuenta entra y el guardia le niega todo: el 403"
                                    + " que ADR-0039 §«Lo que cuesta» pone como precio de equivocarse"
                                    + " de orden",
                            OPCION)
                    .containsExactly("true|true|true|true|true|true|true");

            assertThat(cuantas("permiso", id))
                    .as(
                            "UNA fila de permiso y no una por cada opcion de los cinco catalogos:"
                                    + " los permisos de los otros cuatro sistemas se ignoran, porque"
                                    + " esta copia solo guarda a quien se concede cada opcion de"
                                    + " `normativa`")
                    .isEqualTo(1);

            assertThat(cuantas("grupo", id))
                    .as("los dos grupos que `identidad` publica: administracion y consumidores")
                    .isEqualTo(2);
            assertThat(cuantas("miembro", id)).isEqualTo(5);

            assertThat(filas("SELECT codigo FROM acceso WHERE municipalidad_id = " + id))
                    .as(
                            "y el catalogo lo sigue sembrando ESTE sistema: es lo unico que le"
                                    + " queda al sembrador (ADR-0039 §«Lo que cuesta» punto 5)")
                    .containsExactly(OPCION);
            assertThat(filas("SELECT codigo FROM modulo_sistema WHERE municipalidad_id = " + id))
                    .containsExactly("SEGURIDAD");

            assertThat(buzon.pendientes())
                    .as("y todo lo que se resolvio se acuso: el buzon del emisor queda vacio")
                    .isZero();
        }

        @Test
        @DisplayName(
                "reimplantar no aplica ni un hecho —ya se acusaron— y termina bien: la cuenta esta")
        void segundaImplantacion() throws Exception {
            BuzonDeMentira buzon = buzonConLoQueIdentidadPublica();
            implantar(buzon).run(null);
            long id = municipalidad();

            implantar(buzon).run(null);

            assertThat(cuantas("usuario", id))
                    .as(
                            "[EL CONTRASTE de AC-2] la segunda corrida aplica CERO hechos —el"
                                    + " emisor no vuelve a servir lo acusado— y aun asi tiene a quien"
                                    + " entrar. Por eso la comprobacion cuenta FILAS de `usuario` y no"
                                    + " hechos aplicados: con «al menos un evento aplicado» todo"
                                    + " segundo despliegue saldria rojo por hacer lo correcto")
                    .isEqualTo(5);
            assertThat(cuantas("permiso", id)).isEqualTo(1);
            assertThat(cuantas("miembro", id)).isEqualTo(5);
        }
    }

    // ------------------------------------------------------------------ AC-3

    @Nested
    @DisplayName("AC-3 — el orden equivocado falla diciendolo, y nunca en verde con cero cuentas")
    class ElOrdenEquivocado {

        @Test
        @DisplayName("sin consumidor configurado: falla nombrando la variable que falta")
        void sinConsumidorConfigurado() throws Exception {
            Throwable fallo = catchThrowable(() -> implantarSinConsumidor().run(null));

            assertThat(fallo)
                    .as(
                            "[AC-3] sin `kamayuk.identidad.url` no hay consumidor, asi que la copia"
                                    + " local se queda vacia. Hasta la etapa 4 esto era un INFO y la"
                                    + " implantacion terminaba en verde, porque el sembrador ya habia"
                                    + " dejado al administrador; retirado el sembrador, ese verde es un"
                                    + " `Job` en Complete sobre una base donde nadie puede entrar")
                    .isInstanceOf(ImplantarMunicipalidad.SinAutorizacion.class)
                    .hasMessageContaining("kamayuk.identidad.url")
                    .hasMessageContaining("implantar `identidad` PRIMERO");

            assertThat(cuantas("usuario", municipalidad()))
                    .as("y lo que dejo es exactamente lo que dice: cero cuentas")
                    .isZero();
        }

        @Test
        @DisplayName("el buzon no contesta: falla con la causa dentro y el remedio detras")
        void elBuzonNoContesta() throws Exception {
            BuzonDeMentira buzon = buzonConLoQueIdentidadPublica();
            buzon.rechazaCon(401);

            Throwable fallo = catchThrowable(() -> implantar(buzon).run(null));

            assertThat(fallo)
                    .as(
                            "[AC-3] un 401 es el caso mas probable en un despliegue de verdad —la"
                                    + " cuenta de servicio no existe todavia en el emisor, o su clave"
                                    + " no vale— y hasta la etapa 4 salia como WARN")
                    .isInstanceOf(ImplantarMunicipalidad.SinAutorizacion.class)
                    .hasMessageContaining("401")
                    .hasMessageContaining("sin ninguna cuenta: nadie puede entrar")
                    .hasMessageContaining("implantar `identidad` PRIMERO");
            assertThat(fallo.getCause())
                    .as("la causa entera viaja: quien atiende necesita saber que contesto el buzon")
                    .isNotNull();
        }

        @Test
        @DisplayName(
                "el buzon contesta y no tiene nada que decir de esta municipalidad: TAMBIEN falla")
        void elBuzonContestaYNoPublicoNada() throws Exception {
            BuzonDeMentira buzon = buzon();

            Throwable fallo = catchThrowable(() -> implantar(buzon).run(null));

            assertThat(fallo)
                    .as(
                            "[AC-3, y es el caso que las otras dos NO cubren] `identidad` esta en"
                                    + " pie, contesta 200 y su cola esta vacia porque ESTA"
                                    + " municipalidad todavia no se implanto alli. Ni falta"
                                    + " configuracion ni falla la red: las dos comprobaciones"
                                    + " anteriores pasan y la copia se queda con cero usuarios. Es"
                                    + " literalmente «el orden equivocado», y sin contar filas se"
                                    + " colaria en verde")
                    .isInstanceOf(ImplantarMunicipalidad.SinAutorizacion.class)
                    .hasMessageContaining("no publico ni una cuenta")
                    .hasMessageContaining("todavia no esta implantada en `identidad`");

            long id = municipalidad();
            assertThat(cuantas("usuario", id)).isZero();
            assertThat(filas("SELECT codigo FROM acceso WHERE municipalidad_id = " + id))
                    .as(
                            "lo que SI quedo hecho se dice en el mensaje y se comprueba aqui: la"
                                    + " municipalidad esta dada de alta y su catalogo sembrado. Los"
                                    + " dos pasos confirmaron antes, y repetir la implantacion —que es"
                                    + " el remedio— es idempotente sobre ellos")
                    .containsExactly(OPCION);
        }
    }

    // ------------------------------------------------------------------ la vuelta periodica

    @Nested
    @DisplayName("la corrida periodica NO hereda la exigencia de la implantacion")
    class LaVueltaDelCronJob {

        @Test
        @DisplayName(
                "una vuelta sobre una copia vacia termina normal: el CronJob no falla cada cinco"
                        + " minutos")
        void unaVueltaSobreUnaCopiaVaciaTerminaNormal() throws Exception {
            // La municipalidad existe y su copia esta vacia, que es exactamente el estado en el
            // que la implantacion falla. Aqui NO se esta implantando: es la vuelta de las 12:05.
            BuzonDeMentira buzon = buzon();
            catchThrowable(() -> implantar(buzon).run(null));
            long id = municipalidad();
            TenantContext.fijar(new kamayuk.normativa.dominio.MunicipalidadId(id));

            ConsumirEventosDeIdentidad consumidor = consumidorDe(buzon);
            Throwable fallo = catchThrowable(consumidor::correr);

            assertThat(fallo)
                    .as(
                            "[la separacion que el AC-3 pide decidir] «no queda nadie que pueda"
                                    + " entrar» es una exigencia DEL MOMENTO DE IMPLANTAR, no de cada"
                                    + " vuelta. Si esa comprobacion se moviera a `correr()`, el"
                                    + " `CronJob` saldria `Failed` cada cinco minutos sobre una copia"
                                    + " que todavia no ha recibido nada — y un `Job` que falla siempre"
                                    + " no lo mira nadie. Es la misma leccion que la etapa 4 dejo"
                                    + " escrita para los hechos pospuestos (rc=0, un aviso por corrida)")
                    .isNull();
            assertThat(consumidor.cuentasEnLaCopia())
                    .as(
                            "y la copia sigue vacia: lo que se afirma es que no falla, no que traiga algo")
                    .isZero();
        }
    }

    // ------------------------------------------------------------------ el arnes

    /**
     * Lo que la implantacion de {@code identidad} emite, en su orden de secuencia. Comprobado
     * contra {@code ImplantacionEmiteSusEventosTest} y {@code ImplantarMunicipalidad} de aquel
     * repositorio: grupo de administracion, administrador, afiliacion, un {@code PERMISO_FIJADO}
     * por cada opcion de los CINCO catalogos, y despues el grupo del buzon con su opcion y las
     * cuatro cuentas de servicio con sus afiliaciones.
     */
    private BuzonDeMentira buzonConLoQueIdentidadPublica() throws IOException {
        BuzonDeMentira buzon = buzon();
        long secuencia = 0;
        long grupoAdministracion = 1;
        long usuarioAdministrador = 1;
        buzon.publicar(
                ++secuencia,
                "GRUPO_DADO_DE_ALTA",
                grupoAdministracion,
                CuerposComoLosPublicaIdentidad.grupo(
                        grupoAdministracion,
                        GRUPO_DE_ADMINISTRACION,
                        "Creado por la implantacion: administra este sistema entero"));
        buzon.publicar(
                ++secuencia,
                "USUARIO_DADO_DE_ALTA",
                usuarioAdministrador,
                CuerposComoLosPublicaIdentidad.usuario(
                        usuarioAdministrador, ADMINISTRADOR, "Administrador del sistema", true));
        buzon.publicar(
                ++secuencia,
                "MIEMBRO_AFILIADO",
                grupoAdministracion,
                CuerposComoLosPublicaIdentidad.miembro(
                        grupoAdministracion,
                        GRUPO_DE_ADMINISTRACION,
                        usuarioAdministrador,
                        ADMINISTRADOR,
                        ADMINISTRADOR));

        // Los permisos del administrador sobre los cinco catalogos. Solo uno es de este sistema;
        // los otros llegan igual —el buzon es de la municipalidad, no del sistema— y se ignoran.
        // `permisos` es una opcion de `identidad` Y de `rentas`, y `parametros` lo es de
        // `normativa` Y de `rentas`: el homonimo es lo que hace que el `sistema` del hecho no sea
        // decorativo.
        for (String sistema : List.of("identidad", "rentas", "catastro", "caja")) {
            buzon.publicar(
                    ++secuencia,
                    "PERMISO_FIJADO",
                    grupoAdministracion,
                    CuerposComoLosPublicaIdentidad.permiso(
                            grupoAdministracion,
                            GRUPO_DE_ADMINISTRACION,
                            sistema,
                            OPCION,
                            CuerposComoLosPublicaIdentidad.LOS_SIETE));
        }
        buzon.publicar(
                ++secuencia,
                "PERMISO_FIJADO",
                grupoAdministracion,
                CuerposComoLosPublicaIdentidad.permiso(
                        grupoAdministracion,
                        GRUPO_DE_ADMINISTRACION,
                        "normativa",
                        OPCION,
                        CuerposComoLosPublicaIdentidad.LOS_SIETE));

        long grupoConsumidores = 2;
        buzon.publicar(
                ++secuencia,
                "GRUPO_DADO_DE_ALTA",
                grupoConsumidores,
                CuerposComoLosPublicaIdentidad.grupo(
                        grupoConsumidores,
                        GRUPO_DE_CONSUMIDORES,
                        "Las cuentas de servicio que leen y acusan el buzon"));
        buzon.publicar(
                ++secuencia,
                "PERMISO_FIJADO",
                grupoConsumidores,
                CuerposComoLosPublicaIdentidad.permiso(
                        grupoConsumidores,
                        GRUPO_DE_CONSUMIDORES,
                        "identidad",
                        "eventos",
                        "{\"ejecucion\":false,\"lectura\":true,\"registro\":true,"
                                + "\"modificacion\":false,\"eliminacion\":false,"
                                + "\"impresion\":false,\"especial\":false}"));

        long usuario = usuarioAdministrador;
        for (String sistema : CONSUMIDORES) {
            String cuenta = "service-account-kamayuk-" + sistema + "-servicio-" + ubigeo;
            long suyo = ++usuario;
            buzon.publicar(
                    ++secuencia,
                    "USUARIO_DADO_DE_ALTA",
                    suyo,
                    CuerposComoLosPublicaIdentidad.usuario(
                            suyo, cuenta, "Cuenta de servicio de " + sistema, true));
            buzon.publicar(
                    ++secuencia,
                    "MIEMBRO_AFILIADO",
                    grupoConsumidores,
                    CuerposComoLosPublicaIdentidad.miembro(
                            grupoConsumidores, GRUPO_DE_CONSUMIDORES, suyo, cuenta, ADMINISTRADOR));
        }
        return buzon;
    }

    private BuzonDeMentira buzon() throws IOException {
        BuzonDeMentira buzon = BuzonDeMentira.arrancar(json);
        buzones.add(buzon);
        return buzon;
    }

    /** La implantacion de produccion, con su consumidor apuntando al buzon dado. */
    private ImplantarMunicipalidad implantar(BuzonDeMentira buzon) {
        return implantarCon(consumidorDe(buzon));
    }

    /** La misma, sin consumidor: el estado de un despliegue que no configuro `identidad`. */
    private ImplantarMunicipalidad implantarSinConsumidor() {
        return implantarCon(null);
    }

    private ImplantarMunicipalidad implantarCon(@Nullable ConsumirEventosDeIdentidad consumidor) {
        Clock reloj = Clock.fixed(AHORA, ZoneOffset.UTC);
        SembradorDelCatalogo sembrador =
                envolver(
                        new SembradorDelCatalogo(
                                JdbcClient.create(pool),
                                new AuditoriaJdbc(JdbcClient.create(pool), reloj),
                                reloj));
        return new ImplantarMunicipalidad(
                new RegistroDeMunicipalidadesJdbc(
                        base.url(),
                        BaseDeDatosDePrueba.OWNER,
                        base.clave(BaseDeDatosDePrueba.OWNER)),
                sembrador,
                new DatosDeImplantacion(
                        ubigeo,
                        "Municipalidad " + ubigeo,
                        "DISTRITAL",
                        ADMINISTRADOR,
                        "Administrador del sistema",
                        true,
                        "implantacion"),
                new ElUnico<>(consumidor));
    }

    private ConsumirEventosDeIdentidad consumidorDe(BuzonDeMentira buzon) {
        Clock reloj = Clock.fixed(AHORA, ZoneOffset.UTC);
        AplicarUnEventoDeIdentidad aplicador =
                envolver(
                        new AplicarUnEventoDeIdentidad(
                                new CopiaLocalDeLaAutorizacionJdbc(JdbcClient.create(pool), json)));
        return envolver(
                new ConsumirEventosDeIdentidad(
                        new ClienteHttpDelBuzonDeIdentidad(
                                json, buzon.raiz(), CredencialDeServicio.fija("Bearer de-prueba")),
                        aplicador,
                        new AlertaAlCanalDelResponsable(
                                json,
                                new ResponsableDeLaCopiaLocal(
                                        "Quien atiende", canalDelResponsable.raiz())),
                        reloj));
    }

    /** El interceptor transaccional DE VERDAD, sobre un proxy de la clase. */
    private static <T> T envolver(T objetivo) {
        ProxyFactory fabrica = new ProxyFactory(objetivo);
        fabrica.setProxyTargetClass(true);
        fabrica.addAdvice(
                new TransactionInterceptor(gestor, new AnnotationTransactionAttributeSource()));
        @SuppressWarnings("unchecked")
        T proxy = (T) fabrica.getProxy();
        return proxy;
    }

    /**
     * El {@code ObjectProvider} que Spring le pasa al constructor, con uno o con ninguno. Solo se
     * implementa lo que {@code ImplantarMunicipalidad} llama: {@code getIfAvailable()}. Lo demas
     * lanza, para que una llamada nueva no se resuelva sola en {@code null} y nadie se entere.
     */
    private static final class ElUnico<T> implements ObjectProvider<T> {

        private final @Nullable T unico;

        ElUnico(@Nullable T unico) {
            this.unico = unico;
        }

        @Override
        public @Nullable T getIfAvailable() {
            return unico;
        }

        @Override
        public T getObject() throws BeansException {
            throw new UnsupportedOperationException(
                    "Esta implantacion pide el consumidor con getIfAvailable(): si alguien lo pide"
                            + " de otra forma, hay que decidir que pasa cuando no esta");
        }

        @Override
        public T getObject(Object... argumentos) throws BeansException {
            return getObject();
        }

        @Override
        public @Nullable T getIfUnique() throws BeansException {
            return getIfAvailable();
        }
    }

    // ------------------------------------------------------------------ lo que se lee

    /** El identificador de la municipalidad de este caso; 0 si ni siquiera se dio de alta. */
    private long municipalidad() {
        List<String> filas = filas("SELECT id FROM municipalidad WHERE ubigeo = '" + ubigeo + "'");
        return filas.isEmpty() ? 0 : Long.parseLong(filas.get(0));
    }

    private static long cuantas(String tabla, long municipalidad) {
        return Long.parseLong(
                filas(
                                "SELECT count(*) FROM "
                                        + tabla
                                        + " WHERE municipalidad_id = "
                                        + municipalidad)
                        .get(0));
    }

    private static List<String> privilegiosDelAdministrador(long municipalidad) {
        return filas(
                "SELECT p.ejecucion || '|' || p.lectura || '|' || p.registro || '|' ||"
                        + " p.modificacion || '|' || p.eliminacion || '|' || p.impresion || '|' ||"
                        + " p.especial FROM permiso p"
                        + " JOIN grupo g ON g.id = p.grupo_id"
                        + "   AND g.municipalidad_id = p.municipalidad_id"
                        + " JOIN acceso a ON a.id = p.acceso_id"
                        + "   AND a.municipalidad_id = p.municipalidad_id"
                        + " WHERE p.municipalidad_id = "
                        + municipalidad
                        + " AND g.nombre = '"
                        + GRUPO_DE_ADMINISTRACION
                        + "' AND a.codigo = '"
                        + OPCION
                        + "'");
    }

    /** Se lee como superusuario, que es lo que dice DONDE quedo cada fila y no solo si se ve. */
    private static List<String> filas(String sql) {
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
