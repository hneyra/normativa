package kamayuk.normativa.seguridad.infraestructura;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import kamayuk.normativa.autorizacion.ComprobadorDeAcceso;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.persistencia.OrdenSeguro;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.seguridad.dominio.AccesoDelSistema;
import kamayuk.normativa.seguridad.dominio.Identidad;
import kamayuk.normativa.seguridad.dominio.LecturaDeLaCopiaLocal;
import kamayuk.normativa.seguridad.dominio.ModuloDelSistema;
import kamayuk.normativa.seguridad.dominio.Municipalidad;
import kamayuk.normativa.seguridad.dominio.MunicipalidadRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * La lectura de la copia local de #54, contra PostgreSQL real y como {@code kamayuk_app}.
 *
 * <h2>Lo que se mide, y por que hace falta el motor</h2>
 *
 * <p>La matriz efectiva vive en una sola sentencia —la excepcion del usuario, la union de sus
 * grupos, la vigencia de los dos— y un doble del repositorio devolveria lo que se le pidiera. Lo
 * que hay que comprobar es lo que hace PostgreSQL con las filas que la copia tiene de verdad.
 *
 * <p><b>La prueba que manda es la de los dos grupos, uno vencido</b> (AC-7). El vencido otorga mas
 * que el vigente —{@code REGISTRO} y {@code MODIFICACION} sobre los conjuntos, y {@code LECTURA}
 * sobre los cuadros—, asi que si la consulta dejara de mirar la vigencia del grupo la matriz
 * saldria mas ancha y la interfaz ofreceria pantallas que el guardia niega.
 *
 * <p>Se conecta como {@code kamayuk_app}, y el {@code SET LOCAL} lo emite {@link
 * TenantTransactionManager}, el de produccion. Se siembra como superusuario a proposito: lo que
 * esta bajo prueba es la LECTURA, y en produccion estas filas las escribe el consumidor del buzon
 * de {@code identidad} (regla 12).
 */
@DisplayName("#54 — la copia local que lee la interfaz, contra PostgreSQL")
class LecturaDeLaCopiaLocalJdbcTest {

    /** Hoy, para la vigencia. El grupo vencido dejo de valer el 30 de junio. */
    private static final LocalDate HOY = LocalDate.of(2026, 9, 14);

    private static final LocalDate FIN_DEL_VENCIDO = LocalDate.of(2026, 6, 30);

    /**
     * Las cuatro opciones sembradas, activas o no: es sobre estas que se compara con el guardia.
     */
    private static final List<String> OPCIONES =
            List.of("conjuntos", "cuadros", "parametros", "reporte_retirado");

    /** Las cuentas del escenario, mas una que no existe. */
    private static final List<String> CUENTAS =
            List.of("jperez", "mrojas", "lsalas", "cvega", "rvaldez", "msolano", "nadie");

    private static BaseDeDatosDePrueba base;
    private static TransactionTemplate transaccion;
    private static LecturaDeLaCopiaLocal copia;
    private static MunicipalidadRepository municipalidades;
    private static ComprobadorDeAcceso guardia;
    private static long municipalidad;

    @BeforeAll
    static void provisionar() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();

        DriverManagerDataSource pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));

        transaccion = new TransactionTemplate(new TenantTransactionManager(pool));
        transaccion.setReadOnly(true);
        JdbcClient jdbc = JdbcClient.create(pool);
        copia = new LecturaDeLaCopiaLocalJdbc(jdbc);
        municipalidades = new MunicipalidadRepositoryJdbc(jdbc);
        guardia = new ComprobadorDeAccesoJdbc(jdbc);

        try (Connection admin = base.conexionAdmin()) {
            municipalidad =
                    insertar(
                            admin,
                            "INSERT INTO municipalidad (ubigeo, nombre, tipo) VALUES ('200601',"
                                    + " 'Municipalidad Provincial de Sullana', 'PROVINCIAL')"
                                    + " RETURNING id");
            sembrar(admin, municipalidad);
        }
    }

    @AfterAll
    static void liberar() {
        if (base != null) {
            base.close();
        }
    }

    @AfterEach
    void limpiarContexto() {
        TenantContext.limpiar();
    }

    @Nested
    @DisplayName("la matriz de permisos")
    class LaMatriz {

        @Test
        @DisplayName("dos grupos, uno vencido: solo cuenta lo que otorga el vigente")
        void dosGruposUnoVencido() {
            assertThat(permisos("jperez", HOY))
                    .as(
                            "«jperez» esta en «Parametros del sistema» (vigente: LECTURA sobre los"
                                    + " parametros y sobre los conjuntos) y en «Comision de sellado»"
                                    + " (vencido el %s: REGISTRO y MODIFICACION sobre los conjuntos,"
                                    + " LECTURA sobre los cuadros). Si la consulta dejara de mirar la"
                                    + " vigencia del grupo, la interfaz ofreceria la hoja de cuadros y el"
                                    + " guardia contestaria 403",
                            FIN_DEL_VENCIDO)
                    .isEqualTo(
                            Map.of(
                                    "conjuntos", EnumSet.of(Privilegio.LECTURA),
                                    "parametros", EnumSet.of(Privilegio.LECTURA)));
        }

        @Test
        @DisplayName(
                "y el ultimo dia de su vigencia el vencido todavia cuenta: la fecha es inclusiva")
        void elUltimoDiaTodaviaCuenta() {
            assertThat(permisos("jperez", FIN_DEL_VENCIDO))
                    .as(
                            "es la misma consulta con otra fecha: lo que separa las dos respuestas es"
                                    + " la vigencia del grupo y nada mas")
                    .isEqualTo(
                            Map.of(
                                    "conjuntos",
                                    EnumSet.of(
                                            Privilegio.LECTURA,
                                            Privilegio.REGISTRO,
                                            Privilegio.MODIFICACION),
                                    "cuadros",
                                    EnumSet.of(Privilegio.LECTURA),
                                    "parametros",
                                    EnumSet.of(Privilegio.LECTURA)));
        }

        @Test
        @DisplayName(
                "la excepcion del usuario SUSTITUYE al grupo para ese acceso, tambien para negar")
        void laExcepcionSustituye() {
            // «mrojas» esta en el mismo grupo vigente que «jperez» y tiene ademas una excepcion
            // sobre los conjuntos que niega LECTURA y otorga IMPRESION. Con una union pura saldria
            // [LECTURA, IMPRESION]; es la precedencia de ComprobadorDeAccesoJdbc.
            assertThat(permisos("mrojas", HOY))
                    .isEqualTo(
                            Map.of(
                                    "conjuntos", EnumSet.of(Privilegio.IMPRESION),
                                    "parametros", EnumSet.of(Privilegio.LECTURA)));
        }

        @Test
        @DisplayName("un usuario deshabilitado no puede nada, aunque su grupo si")
        void unUsuarioDeshabilitado() {
            assertThat(permisos("lsalas", HOY)).isEmpty();
        }

        @Test
        @DisplayName("una pertenencia dada de baja no trae los permisos del grupo")
        void unaPertenenciaDeBaja() {
            assertThat(permisos("cvega", HOY)).isEmpty();
        }

        @Test
        @DisplayName(
                "una opcion retirada no sale, ni por el grupo ni por una excepcion del usuario")
        void unaOpcionRetirada() {
            assertThat(permisos("jperez", HOY))
                    .as("el grupo vigente la otorga, y la matriz solo recorre accesos activos")
                    .doesNotContainKey("reporte_retirado");
            assertThat(permisos("rvaldez", HOY))
                    .as(
                            "«rvaldez» no esta en ningun grupo y tiene una excepcion que la otorga:"
                                    + " la matriz tampoco la dibuja, y el guardia tampoco la autoriza"
                                    + " (ver LaMatrizYElGuardia)")
                    .isEmpty();
        }

        @Test
        @DisplayName("y una cuenta que no existe recibe la matriz vacia")
        void unaCuentaQueNoExiste() {
            assertThat(permisos("nadie", HOY)).isEmpty();
        }
    }

    @Nested
    @DisplayName("la matriz y el guardia dicen lo mismo (AC-4)")
    class LaMatrizYElGuardia {

        /**
         * Para <b>cada</b> combinacion de cuenta, opcion y privilegio del escenario: lo que publica
         * {@code GET /seguridad/sesion/permisos} y lo que contesta {@link
         * ComprobadorDeAcceso#autoriza} tienen que coincidir.
         *
         * <p>Es la guarda que impide el defecto que nadie relaciona con su causa: un menu que
         * ofrece una pantalla y un 403 al entrar en ella, o —peor— una pantalla que no se dibuja y
         * a la que si se puede entrar tecleando la ruta.
         *
         * <p><b>Lo que esta comparacion obligo a cambiar</b>, y esta escrito en {@link
         * ComprobadorDeAccesoJdbc}: la rama de la excepcion del usuario del guardia no filtraba
         * {@code a.activo} y la de los grupos si, asi que sobre {@code reporte_retirado} —una
         * opcion retirada con una excepcion que otorga— el guardia decia que si y la matriz no la
         * dibujaba. Se cerro en el guardia, que es el sentido que no abre nada.
         */
        @Test
        @DisplayName("cada cuenta, cada opcion y cada privilegio del escenario")
        void cadaCombinacion() {
            List<String> discrepancias = new ArrayList<>();
            int comparadas = 0;

            for (String cuenta : CUENTAS) {
                Map<String, Set<Privilegio>> matriz = permisos(cuenta, HOY);
                for (String opcion : OPCIONES) {
                    for (Privilegio privilegio : Privilegio.values()) {
                        boolean segunLaMatriz =
                                matriz.getOrDefault(opcion, Set.of()).contains(privilegio);
                        boolean segunElGuardia = autoriza(cuenta, opcion, privilegio);
                        comparadas++;
                        if (segunLaMatriz != segunElGuardia) {
                            discrepancias.add(
                                    cuenta
                                            + " / "
                                            + opcion
                                            + " / "
                                            + privilegio.columna()
                                            + ": la matriz dice "
                                            + segunLaMatriz
                                            + " y el guardia "
                                            + segunElGuardia);
                        }
                    }
                }
            }

            assertThat(comparadas)
                    .as("sin combinaciones esta guarda compara el vacio con el vacio")
                    .isEqualTo(CUENTAS.size() * OPCIONES.size() * Privilegio.values().length);
            assertThat(discrepancias)
                    .as(
                            "el menu se compone con la matriz y la puerta la abre el guardia: donde"
                                    + " discrepan, el sintoma —un 403, o una pantalla que no se dibuja"
                                    + " y a la que se entra— no se parece a su causa")
                    .isEmpty();
        }

        @Test
        @DisplayName(
                "y la comparacion no es vacua: hay casos que dicen «si» y casos que dicen «no»")
        void laComparacionNoEsVacua() {
            // El contraste: si la matriz saliera siempre vacia y el guardia negara siempre, la
            // prueba de arriba pasaria en verde sin medir nada.
            assertThat(autoriza("jperez", "parametros", Privilegio.LECTURA)).isTrue();
            assertThat(autoriza("jperez", "cuadros", Privilegio.LECTURA)).isFalse();
            assertThat(permisos("jperez", HOY)).isNotEmpty();
        }
    }

    @Nested
    @DisplayName("el catalogo")
    class ElCatalogo {

        @Test
        @DisplayName("los modulos, por orden y desempatados por id, activos o no")
        void losModulos() {
            Pagina<ModuloDelSistema> pagina =
                    leer(() -> copia.modulos(Paginacion.de(0, 20, "orden")));

            assertThat(pagina.totalElementos()).isEqualTo(3);
            assertThat(pagina.contenido())
                    .extracting(ModuloDelSistema::codigo)
                    .as("los tres tienen orden 0: decide el id, que es el orden de siembra")
                    .containsExactly("SEGURIDAD", "NORMATIVA", "RETIRADO");
            assertThat(pagina.contenido().get(2).activo())
                    .as("la lectura no filtra los inactivos: eso lo decide quien compone el menu")
                    .isFalse();
        }

        @Test
        @DisplayName("los accesos, por codigo, con el id de su modulo")
        void losAccesos() {
            Pagina<AccesoDelSistema> pagina =
                    leer(() -> copia.accesos(Paginacion.de(0, 2, "codigo")));

            assertThat(pagina.totalElementos()).isEqualTo(4);
            assertThat(pagina.hayMas()).isTrue();
            assertThat(pagina.contenido())
                    .extracting(AccesoDelSistema::codigo)
                    .containsExactly("conjuntos", "cuadros");
            assertThat(pagina.contenido().getFirst())
                    .isEqualTo(
                            new AccesoDelSistema(
                                    pagina.contenido().getFirst().id(),
                                    unModulo("NORMATIVA"),
                                    "OPCION_MENU",
                                    "conjuntos",
                                    "Conjuntos de parametros",
                                    true));
        }

        @Test
        @DisplayName("un orden fuera de la lista blanca no llega a la consulta")
        void unOrdenQueNoEsta() {
            Throwable fallo =
                    catchThrowable(
                            () ->
                                    leer(
                                            () ->
                                                    copia.accesos(
                                                            Paginacion.de(
                                                                    0, 20, "municipalidad_id"))));

            assertThat(fallo).isInstanceOf(OrdenSeguro.OrdenNoAdmitido.class);
        }
    }

    @Nested
    @DisplayName("la sesion")
    class LaSesion {

        @Test
        @DisplayName("el ejercicio de trabajo es nulo, porque nada escribe `sesion` aqui (AC-5)")
        void sinSesionElEjercicioEsNulo() {
            Optional<Identidad> identidad = leer(() -> copia.identidadDe("jperez"));

            assertThat(identidad).isPresent();
            assertThat(identidad.get().cuenta()).isEqualTo("jperez");
            assertThat(identidad.get().nombre()).isEqualTo("Juan Perez Castillo");
            assertThat(identidad.get().ejercicioDeTrabajo())
                    .as(
                            "`sesion` existe en V1 y ningun INSERT de src/main la escribe: lo que la"
                                    + " API publica es null, no el año del reloj")
                    .isNull();
        }

        @Test
        @DisplayName("y si algo la escribiera, la lectura traeria la de la sesion ABIERTA")
        void conSesionAbiertaTraeSuEjercicio() {
            // «msolano» tiene dos filas sembradas a mano —una cerrada de 2025 y una abierta de
            // 2026—, que es lo unico que puede haber en esta tabla hoy. Sin este caso, la
            // subconsulta podria estar mal escrita y nadie lo veria: contesta null para todo el
            // mundo igual.
            Optional<Identidad> identidad = leer(() -> copia.identidadDe("msolano"));

            assertThat(identidad).isPresent();
            assertThat(identidad.get().ejercicioDeTrabajo())
                    .as("la cerrada decia 2025 y es mas reciente; la abierta dice 2026")
                    .isEqualTo(new Ejercicio(2026));
        }

        @Test
        @DisplayName("una cuenta que no es usuario de esta municipalidad no tiene identidad")
        void unaCuentaDesconocida() {
            assertThat(leer(() -> copia.identidadDe("nadie"))).isEmpty();
        }

        @Test
        @DisplayName("la municipalidad es la del SET LOCAL, con el ubigeo sin relleno")
        void laMunicipalidad() {
            assertThat(leer(municipalidades::deLaSesion))
                    .contains(
                            new Municipalidad(
                                    municipalidad,
                                    "200601",
                                    "Municipalidad Provincial de Sullana",
                                    "PROVINCIAL"));
        }

        @Test
        @DisplayName("y fuera de una transaccion la municipalidad no se contesta: revienta")
        void sinTransaccionRevienta() {
            TenantContext.fijar(new MunicipalidadId(municipalidad));

            Throwable fallo = catchThrowable(municipalidades::deLaSesion);

            assertThat(fallo)
                    .as(
                            "el WHERE compara current_setting('app.municipalidad_id'), que solo existe"
                                    + " dentro de la transaccion que lo fijo: sin ella tiene que fallar,"
                                    + " no contestar «no existe» ni contestar por otra")
                    .isInstanceOf(DataAccessException.class)
                    .rootCause()
                    .hasMessageContaining("unrecognized configuration parameter");
        }
    }

    // ------------------------------------------------------------------

    private static Map<String, Set<Privilegio>> permisos(String cuenta, LocalDate fecha) {
        return leer(() -> copia.permisosEfectivosDe(cuenta, fecha));
    }

    private static boolean autoriza(String cuenta, String acceso, Privilegio privilegio) {
        return leer(() -> guardia.autoriza(cuenta, acceso, privilegio, HOY));
    }

    private static <T> T leer(Supplier<T> lectura) {
        TenantContext.fijar(new MunicipalidadId(municipalidad));
        try {
            return transaccion.execute(estado -> lectura.get());
        } finally {
            TenantContext.limpiar();
        }
    }

    private static long unModulo(String codigo) {
        try (Connection admin = base.conexionAdmin();
                PreparedStatement consulta =
                        admin.prepareStatement(
                                "SELECT id FROM modulo_sistema WHERE municipalidad_id = ? AND codigo"
                                        + " = ?")) {
            consulta.setLong(1, municipalidad);
            consulta.setString(2, codigo);
            try (ResultSet fila = consulta.executeQuery()) {
                fila.next();
                return fila.getLong(1);
            }
        } catch (SQLException noSePudo) {
            throw new IllegalStateException(noSePudo);
        }
    }

    /**
     * El escenario, entero y en un solo sitio para poder leerlo de un vistazo.
     *
     * <ul>
     *   <li>Tres modulos —{@code SEGURIDAD}, {@code NORMATIVA} y uno {@code RETIRADO}— y cuatro
     *       opciones, una de ellas retirada.
     *   <li>«Parametros del sistema», vigente desde enero: {@code LECTURA} sobre {@code
     *       parametros}, {@code conjuntos} y la opcion retirada.
     *   <li>«Comision de sellado», vencida el 30 de junio: {@code REGISTRO} y {@code MODIFICACION}
     *       sobre {@code conjuntos}, {@code LECTURA} sobre {@code cuadros}.
     *   <li>«jperez» en los dos; «mrojas» en el vigente con una excepcion sobre {@code conjuntos};
     *       «lsalas» en el vigente y deshabilitado; «cvega» en el vigente con la pertenencia dada
     *       de baja; «rvaldez» sin grupo y con una excepcion sobre la opcion retirada; «msolano»
     *       sin grupo, con una sesion cerrada y otra abierta.
     * </ul>
     */
    private static void sembrar(Connection admin, long muni) throws SQLException {
        long seguridad = modulo(admin, muni, "SEGURIDAD", "Seguridad", true);
        long normativa = modulo(admin, muni, "NORMATIVA", "Normativa", true);
        modulo(admin, muni, "RETIRADO", "Modulo retirado", false);

        long parametros = acceso(admin, muni, seguridad, "parametros", "Parametros del sistema");
        long conjuntos = acceso(admin, muni, normativa, "conjuntos", "Conjuntos de parametros");
        long cuadros = acceso(admin, muni, normativa, "cuadros", "Cuadros de valuacion");
        long retirado = acceso(admin, muni, seguridad, "reporte_retirado", "Reporte retirado");
        ejecutar(admin, "UPDATE acceso SET activo = false WHERE id = ?", retirado);

        long vigente =
                insertar(
                        admin,
                        "INSERT INTO grupo (municipalidad_id, nombre, vigencia_desde) VALUES (?,"
                                + " 'Parametros del sistema', DATE '2026-01-01') RETURNING id",
                        muni);
        long vencido =
                insertar(
                        admin,
                        "INSERT INTO grupo (municipalidad_id, nombre, vigencia_desde,"
                                + " vigencia_hasta) VALUES (?, 'Comision de sellado',"
                                + " DATE '2026-01-01', ?) RETURNING id",
                        muni,
                        java.sql.Date.valueOf(FIN_DEL_VENCIDO));

        permisoDeGrupo(admin, muni, vigente, parametros, "lectura");
        permisoDeGrupo(admin, muni, vigente, conjuntos, "lectura");
        permisoDeGrupo(admin, muni, vigente, retirado, "lectura");
        permisoDeGrupo(admin, muni, vencido, conjuntos, "registro", "modificacion");
        permisoDeGrupo(admin, muni, vencido, cuadros, "lectura");

        long jperez = usuario(admin, muni, "jperez", "Juan Perez Castillo", true);
        miembro(admin, muni, vigente, jperez, true);
        miembro(admin, muni, vencido, jperez, true);

        long mrojas = usuario(admin, muni, "mrojas", "Maria Rojas Ubillus", true);
        miembro(admin, muni, vigente, mrojas, true);
        ejecutar(
                admin,
                "INSERT INTO permiso (municipalidad_id, acceso_id, usuario_id, lectura, impresion,"
                        + " usuario_registro) VALUES (?, ?, ?, false, true, 'identidad')",
                muni,
                conjuntos,
                mrojas);

        long lsalas = usuario(admin, muni, "lsalas", "Luis Salas Ramos", false);
        miembro(admin, muni, vigente, lsalas, true);

        long cvega = usuario(admin, muni, "cvega", "Carmen Vega Nunez", true);
        miembro(admin, muni, vigente, cvega, false);

        // Sin grupo, y con una excepcion sobre la opcion RETIRADA que la otorga. Es el caso que
        // separaba a la matriz del guardia antes de este PR.
        long rvaldez = usuario(admin, muni, "rvaldez", "Rosa Valdez Chero", true);
        ejecutar(
                admin,
                "INSERT INTO permiso (municipalidad_id, acceso_id, usuario_id, lectura,"
                        + " usuario_registro) VALUES (?, ?, ?, true, 'identidad')",
                muni,
                retirado,
                rvaldez);

        long msolano = usuario(admin, muni, "msolano", "Mario Solano Zapata", true);
        ejecutar(
                admin,
                "INSERT INTO sesion (municipalidad_id, usuario_id, inicio, fin, ejercicio_trabajo)"
                        + " VALUES (?, ?, TIMESTAMPTZ '2026-09-01 08:00-05',"
                        + " TIMESTAMPTZ '2026-09-01 18:00-05', 2025)",
                muni,
                msolano);
        ejecutar(
                admin,
                "INSERT INTO sesion (municipalidad_id, usuario_id, inicio, ejercicio_trabajo)"
                        + " VALUES (?, ?, TIMESTAMPTZ '2026-08-01 08:00-05', 2026)",
                muni,
                msolano);
    }

    private static long modulo(
            Connection admin, long muni, String codigo, String nombre, boolean activo)
            throws SQLException {
        return insertar(
                admin,
                "INSERT INTO modulo_sistema (municipalidad_id, codigo, nombre, activo)"
                        + " VALUES (?, ?, ?, ?) RETURNING id",
                muni,
                codigo,
                nombre,
                activo);
    }

    private static long acceso(
            Connection admin, long muni, long modulo, String codigo, String nombre)
            throws SQLException {
        return insertar(
                admin,
                "INSERT INTO acceso (municipalidad_id, modulo_id, tipo, codigo, nombre)"
                        + " VALUES (?, ?, 'OPCION_MENU', ?, ?) RETURNING id",
                muni,
                modulo,
                codigo,
                nombre);
    }

    private static long usuario(
            Connection admin, long muni, String cuenta, String nombre, boolean habilitado)
            throws SQLException {
        return insertar(
                admin,
                "INSERT INTO usuario (municipalidad_id, cuenta, nombre, habilitado)"
                        + " VALUES (?, ?, ?, ?) RETURNING id",
                muni,
                cuenta,
                nombre,
                habilitado);
    }

    private static void miembro(
            Connection admin, long muni, long grupo, long usuario, boolean activo)
            throws SQLException {
        ejecutar(
                admin,
                "INSERT INTO miembro (municipalidad_id, grupo_id, usuario_id, usuario_alta, activo)"
                        + " VALUES (?, ?, ?, 'identidad', ?)",
                muni,
                grupo,
                usuario,
                activo);
    }

    private static void permisoDeGrupo(
            Connection admin, long muni, long grupo, long acceso, String... privilegios)
            throws SQLException {
        StringBuilder columnas = new StringBuilder();
        StringBuilder valores = new StringBuilder();
        for (String privilegio : List.of(privilegios)) {
            columnas.append(", ").append(privilegio);
            valores.append(", true");
        }
        ejecutar(
                admin,
                "INSERT INTO permiso (municipalidad_id, acceso_id, grupo_id, usuario_registro"
                        + columnas
                        + ") VALUES (?, ?, ?, 'identidad'"
                        + valores
                        + ")",
                muni,
                acceso,
                grupo);
    }

    private static long insertar(Connection admin, String sql, Object... valores)
            throws SQLException {
        try (PreparedStatement sentencia = admin.prepareStatement(sql)) {
            for (int i = 0; i < valores.length; i++) {
                sentencia.setObject(i + 1, valores[i]);
            }
            try (ResultSet fila = sentencia.executeQuery()) {
                fila.next();
                return fila.getLong(1);
            }
        }
    }

    private static void ejecutar(Connection admin, String sql, Object... valores)
            throws SQLException {
        try (PreparedStatement sentencia = admin.prepareStatement(sql)) {
            for (int i = 0; i < valores.length; i++) {
                sentencia.setObject(i + 1, valores[i]);
            }
            sentencia.executeUpdate();
        }
    }
}
