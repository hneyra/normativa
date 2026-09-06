package kamayuk.normativa.parametros.aplicacion;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import kamayuk.normativa.auditoria.AuditoriaJdbc;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.esquema.BaseDeDatosDePrueba;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto;
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.parametros.infraestructura.PublicacionDeCuadrosJdbc;
import kamayuk.normativa.parametros.infraestructura.PublicacionDeParametrosJdbc;
import kamayuk.normativa.parametros.infraestructura.SnapshotRepositoryJdbc;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
import kamayuk.normativa.reglas.Ambito;
import kamayuk.normativa.reglas.IdentificadorDeConjunto;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

/**
 * <b>El ejercicio 2026 se sella</b> (catastro#8, AC-3), con los cinco pasos reales y contra
 * PostgreSQL de verdad.
 *
 * <h2>Que mide, y por que no lo mide ninguna otra prueba</h2>
 *
 * <p>Las demas pruebas de este modulo miden <b>mecanismos</b> con cifras ficticias, y hacen bien:
 * lo que valen las cifras es D-02a y lo comprueban los verificadores del corpus. Esta corre la
 * cadena entera con <b>los dos manifiestos que se despliegan</b>, en el orden que
 * `publicar-cuadros.sh` documenta, y termina con un conjunto SELLADO del ejercicio 2026 cuyo
 * snapshot trae dentro las tres cosas de las que depende la valuacion de un predio:
 *
 * <ol>
 *   <li>el cuadro de valores unitarios de edificacion (H-14);
 *   <li>la tabla de depreciacion (H-15);
 *   <li>y el {@code PORCENTAJE_DE_ACTUALIZACION} del ejercicio, que es la llave por la que {@code
 *       catastro} llevaba parandose en todos los predios (D-11).
 * </ol>
 *
 * <p><b>Hasta este cambio ningun ejercicio estaba sellado en ninguna instalacion</b>, y sin
 * conjunto sellado {@code conjuntoDeLaCorrida} de {@code catastro} lanza {@code EjercicioSinSellar}
 * y la corrida ni arranca. Esto cierra D-02a <b>solo para 2026</b>: el ejercicio siguiente vuelve a
 * necesitar sus propias publicaciones y su propio sellado.
 *
 * <h2>Las dos credenciales, que no son una comodidad</h2>
 *
 * <p>Publicar es {@code rol_carga_parametros} —la unica que puede escribir las tres tablas de
 * valuacion desde V55— y componer y sellar es {@code kamayuk_app}, que sobre {@code
 * parametro_tributario} solo tiene {@code SELECT}. Con una sola conexion de superusuario esto
 * pasaria en verde sin verificar ni la politica, ni el privilegio, ni el disparador.
 */
@DisplayName("catastro#8 — El ejercicio 2026 se sella, con los manifiestos que se despliegan")
class ElEjercicio2026SeSellaTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-06T10:00:00Z"), ZoneOffset.UTC);

    /** El ejercicio que este trabajo sella. No es un numero de prueba: es el del corpus. */
    private static final Ejercicio EJERCICIO = new Ejercicio(2026);

    private static final Path PARAMETROS =
            Path.of("../../docs/10-negocio/valores-normativos/publicacion/parametros-2026.csv")
                    .toAbsolutePath()
                    .normalize();

    private static final Path CUADROS =
            Path.of("../../docs/10-negocio/valores-normativos/publicacion/cuadros-2026.csv")
                    .toAbsolutePath()
                    .normalize();

    private static BaseDeDatosDePrueba base;
    private static long municipalidad;

    private static AdministrarParametros administrar;
    private static ImportarParametrosDelConjunto importar;
    private static ComponerSnapshot componer;
    private static long conjunto;

    @BeforeAll
    static void sellarElEjercicio() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        municipalidad = crearMunicipalidad("200105", "Municipalidad Distrital de Catacaos");

        // Paso 2 y 3: publicar. Como rol_carga_parametros, sin contexto de tenant porque lo que se
        // publica no es de ninguna municipalidad.
        DriverManagerDataSource carga = new DriverManagerDataSource();
        carga.setUrl(base.url());
        carga.setUsername(BaseDeDatosDePrueba.CARGA_PARAMETROS);
        carga.setPassword(base.clave(BaseDeDatosDePrueba.CARGA_PARAMETROS));
        JdbcClient jdbcCarga = JdbcClient.create(carga);
        Path cuadros = cuadrosDeLaValuacion();
        new PublicarParametros(
                        new PublicacionDeParametrosJdbc(jdbcCarga),
                        new DatosDeLaPublicacion(PARAMETROS.toString(), "cadena-de-2026"))
                .run(null);
        new PublicarCuadros(
                        new PublicacionDeCuadrosJdbc(jdbcCarga),
                        new DatosDelCuadro(cuadros.toString(), "cadena-de-2026"))
                .run(null);

        // Pasos 1 y 5: abrir, componer y sellar. Como kamayuk_app y con su contexto de tenant.
        DriverManagerDataSource pool = new DriverManagerDataSource();
        pool.setUrl(base.url());
        pool.setUsername(BaseDeDatosDePrueba.APP);
        pool.setPassword(base.clave(BaseDeDatosDePrueba.APP));
        JdbcClient jdbcApp = JdbcClient.create(pool);
        TenantTransactionManager gestor = new TenantTransactionManager(pool);
        ParametrosRepositoryJdbc repositorio = new ParametrosRepositoryJdbc(jdbcApp);
        administrar =
                envolver(
                        new AdministrarParametros(
                                repositorio, new AuditoriaJdbc(jdbcApp, RELOJ), RELOJ),
                        gestor);
        importar = envolver(new ImportarParametrosDelConjunto(administrar), gestor);
        componer =
                envolver(
                        new ComponerSnapshot(repositorio, new SnapshotRepositoryJdbc(jdbcApp)),
                        gestor);

        TenantContext.fijar(new MunicipalidadId(municipalidad));
        OrigenContext.fijar(Origen.deProceso("cadena-de-2026"));
        Observacion porque = Observacion.de("Se parametriza el ejercicio 2026 (catastro#8)");
        ConjuntoDeParametros abierto = administrar.abrirVersion(EJERCICIO, porque);
        conjunto = java.util.Objects.requireNonNull(abierto.id());
        // EL MISMO archivo que se publico compone el conjunto: sus tres primeras columnas son la
        // llave, y las demas se ignoran. Con dos archivos, el dia que alguien cambia uno y se
        // olvida del otro, el conjunto se sella nombrando algo que no se publico.
        componerCon(PARAMETROS, porque);
        componerCon(cuadros, porque);
        administrar.sellar(conjunto, porque);
    }

    /**
     * El manifiesto desplegado <b>sin la edicion vehicular</b>, escrito en un temporal.
     *
     * <p><b>Lo que se deja fuera se deja fuera diciendolo, y se comprueba.</b> El anexo vehicular
     * son 18 043 lineas y 54 129 filas, y {@code ComponerSnapshot} las excluye del ambito {@code
     * VALUACION} —{@code ambito == VALUACION ? List.of() : cuadros.valoresReferencialesDe(id)}—,
     * asi que publicarlas aqui costaria varios minutos de corrida para no cambiar ni una asercion
     * de esta clase. La linea que se cae es exactamente una y la prueba lo exige: si el manifiesto
     * ganara otro cuadro y este filtro se lo comiera en silencio, el conjunto se sellaria sin el.
     *
     * <p>Que la edicion vehicular se publique entera lo mide {@code PublicarCuadrosTest} sobre su
     * propio derivado, que es donde ese coste compra algo.
     */
    private static Path cuadrosDeLaValuacion() throws IOException {
        List<String> lineas = Files.readAllLines(CUADROS, StandardCharsets.UTF_8);
        List<String> deLaValuacion =
                lineas.stream().filter(linea -> !linea.endsWith(",VALOR_REFERENCIAL")).toList();
        assertThat(lineas.size() - deLaValuacion.size())
                .as(
                        "del manifiesto desplegado solo se deja fuera la edicion vehicular, que el"
                                + " ambito VALUACION no compone")
                .isEqualTo(1);
        Path recorte = Files.createTempFile("cuadros-de-la-valuacion", ".csv");
        Files.writeString(recorte, String.join("\n", deLaValuacion) + "\n", StandardCharsets.UTF_8);
        // El manifiesto nombra sus archivos de filas como hermanos suyos, asi que el recorte tiene
        // que vivir al lado del original: se copia a su directorio y se borra al salir.
        Path alLado = CUADROS.resolveSibling("cuadros-de-la-valuacion-de-prueba.csv");
        Files.copy(recorte, alLado, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        alLado.toFile().deleteOnExit();
        Files.delete(recorte);
        return alLado;
    }

    private static void componerCon(Path manifiesto, Observacion porque) throws IOException {
        try (var lectura = Files.newBufferedReader(manifiesto, StandardCharsets.UTF_8)) {
            assertThat(importar.importar(lectura, conjunto, porque).rechazadas())
                    .as(
                            "todo lo que %s publica tiene que poder componer el conjunto",
                            manifiesto.getFileName())
                    .isEmpty();
        }
    }

    @AfterAll
    static void cerrar() {
        TenantContext.limpiar();
        OrigenContext.limpiar();
        if (base != null) {
            base.close();
        }
    }

    @Test
    @DisplayName("2026 queda SELLADO: hasta hoy ningun ejercicio lo estaba en ninguna instalacion")
    void elEjercicioQuedaSellado() throws SQLException {
        assertThat(estadoDelConjunto()).isEqualTo("SELLADO");
    }

    @Test
    @DisplayName("el snapshot trae el PORCENTAJE_DE_ACTUALIZACION de 2026, y vale cero")
    void elSnapshotTraeElPorcentajeDeActualizacion() {
        SnapshotDelConjunto snapshot =
                componer.porConjunto(IdentificadorDeConjunto.de(conjunto), Ambito.VALUACION);

        // La llave por la que `catastro` se paraba en TODOS los predios (D-11). No se sella un
        // valor por omision: se sella que el supuesto del art. 12 del TUO LTM no se cumple en
        // 2026, porque ese ano se publicaron los aranceles y los precios unitarios. El fundamento
        // esta en `predial-porcentaje-de-actualizacion.md` §1.6, con sus dos firmas.
        assertThat(snapshot.parametros())
                .filteredOn(p -> "PORCENTAJE_DE_ACTUALIZACION".equals(p.tipo()))
                .singleElement()
                .satisfies(
                        p -> {
                            assertThat(
                                            new BigDecimal(
                                                    java.util.Objects.requireNonNull(
                                                            p.valorNumerico())))
                                    .isEqualByComparingTo(BigDecimal.ZERO);
                            assertThat(p.vigenciaDesde()).isEqualTo("2026-01-01");
                            assertThat(p.vigenciaHasta())
                                    .as(
                                            "2026 y solo 2026: el ejercicio siguiente vuelve a"
                                                    + " necesitar la lectura de sus dos publicaciones")
                                    .isEqualTo("2026-12-31");
                            assertThat(p.documentoFuente()).contains("art. 12");
                        });
    }

    @Test
    @DisplayName("el snapshot trae los dos cuadros que la valuacion necesita, enteros")
    void elSnapshotTraeLosDosCuadros() {
        SnapshotDelConjunto snapshot =
                componer.porConjunto(IdentificadorDeConjunto.de(conjunto), Ambito.VALUACION);

        // Las cifras NO estan escritas aqui: se cuentan sobre los derivados del corpus, que es
        // donde viven. Escribirlas seria un segundo sitio donde una cifra puede estar mal.
        assertThat(snapshot.valoresUnitarios())
                .as("la matriz del Anexo I.2 entera, sin las tres celdas de puntos suspensivos")
                .hasSize(
                        filasDelDerivado(
                                "fuentes/valores-unitarios-2026/valores-unitarios-costa-2026.csv"));
        assertThat(snapshot.depreciaciones())
                .as("las cuatro tablas del Anexo I del Reglamento Nacional de Tasaciones")
                .hasSize(filasDelDerivado("fuentes/depreciacion-rnt-2016/depreciacion.csv"));
        assertThat(snapshot.valoresUnitarios())
                .extracting(SnapshotDelConjunto.ValorUnitarioDelSnapshot::partida)
                .as("las TRES partidas de apreciacion exterior, no las siete de la ficha (V59)")
                .containsOnly("MUROS", "TECHOS", "PUERTAS");
    }

    @Test
    @DisplayName("una vez sellado no admite un parametro mas, y por eso hubo que meterlo todo")
    void selladoNoAdmiteUnParametroMas() throws SQLException {
        // Es la razon por la que `normativa` no habia sellado 2026 antes: un conjunto sellado no
        // admite un parametro mas, asi que sellarlo sin los valores unitarios ni el
        // `% actualizacion` lo habria dejado con la mitad de sus cifras y SIN PODER recibir la
        // otra mitad. Aqui se comprueba que esa puerta sigue cerrada.
        assertThat(estadoDelConjunto()).isEqualTo("SELLADO");
        assertThat(
                        Integer.parseInt(
                                dato(
                                        "SELECT count(*) FROM conjunto_parametro_detalle"
                                                + " WHERE conjunto_id = "
                                                + conjunto)))
                .as(
                        "las 33 filas de parametros-2026.csv mas las 2 ediciones de cuadros-2026.csv"
                                + " que el ambito VALUACION compone (la vehicular es de OBLIGACION)")
                .isEqualTo(35);
    }

    // ------------------------------------------------------------------

    /**
     * Una cifra leida con la conexion de administracion, fuera de toda transaccion de aplicacion.
     *
     * <p>Y tiene que ser esa: {@code kamayuk_app} sin {@code SET LOCAL} no devuelve vacio sino que
     * <b>revienta</b> —{@code current_setting('app.municipalidad_id')} no existe, SQLSTATE 42704—,
     * que es lo que hace visible un olvido de contexto en produccion (#486). Lo dijo la primera
     * ejecucion de esta clase, con un {@code BadSqlGrammarException} sobre un SQL correcto.
     */
    private static String dato(String sql) throws SQLException {
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia = admin.prepareStatement(sql);
                ResultSet resultado = sentencia.executeQuery()) {
            resultado.next();
            return resultado.getString(1);
        }
    }

    private static String estadoDelConjunto() throws SQLException {
        return dato("SELECT estado FROM conjunto_parametros WHERE id = " + conjunto);
    }

    /** Cuantas filas trae un derivado del corpus, contadas ahi y no escritas aqui. */
    private static int filasDelDerivado(String relativo) {
        Path archivo =
                Path.of("../../docs/10-negocio/valores-normativos/", relativo)
                        .toAbsolutePath()
                        .normalize();
        try (var lineas = Files.lines(archivo, StandardCharsets.UTF_8)) {
            return (int) lineas.filter(linea -> !linea.isBlank()).count() - 1; // menos la cabecera
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer el derivado " + archivo, e);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T envolver(T objetivo, TenantTransactionManager gestor) {
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
}
