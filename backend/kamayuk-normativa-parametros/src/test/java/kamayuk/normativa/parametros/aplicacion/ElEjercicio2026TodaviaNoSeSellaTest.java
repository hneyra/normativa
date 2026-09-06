package kamayuk.normativa.parametros.aplicacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.parametros.infraestructura.PublicacionDeCuadrosJdbc;
import kamayuk.normativa.parametros.infraestructura.PublicacionDeParametrosJdbc;
import kamayuk.normativa.parametros.infraestructura.SnapshotRepositoryJdbc;
import kamayuk.normativa.plataforma.tenant.TenantTransactionManager;
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
 * <b>El ejercicio 2026 todavia NO se sella, y esta clase mide exactamente por que</b> (catastro#8).
 *
 * <h2>Que cambio, y por que esta clase se llama al reves de como nacio</h2>
 *
 * <p>Nacio afirmando que 2026 quedaba sellado. Lo hacia apoyandose en una fila de {@code
 * parametros-2026.csv} —el {@code PORCENTAJE_DE_ACTUALIZACION}— cuyo archivo del corpus se habia
 * marcado {@code VERIFICADO} con una <b>firma humana que nunca ocurrio</b>. La direccion lo rechazo
 * y la firma volvio a {@code —}; con ella se fue la fila, porque {@code verificar-publicacion.mjs}
 * no deja publicar desde {@code TRANSCRITO}: «una transcripcion sin re-verificar no se carga
 * (ADR-0007)». <b>Esa guarda funcionando es el motivo de que esta clase diga hoy lo contrario de lo
 * que decia, y no un fallo de la guarda.</b>
 *
 * <h2>Lo que SI esta hecho, y se mide aqui</h2>
 *
 * <p>Los <b>dos cuadros nacionales</b> de los que depende valorizar un predio se publican y se
 * componen en el conjunto de 2026 sin un solo rechazo: el de valores unitarios de edificacion
 * (H-14, que es lo que catastro#8 anadio) y el de depreciacion (H-15). Sus dos archivos del corpus
 * estan {@code VERIFICADO} con firmas humanas <b>de verdad</b> —JNA y HNA, de agosto—, asi que esa
 * mitad no depende de nada pendiente.
 *
 * <h2>Y por que NO se sella</h2>
 *
 * <p>Porque <b>un conjunto sellado no admite un parametro mas</b> —lo mide {@code
 * AbrirConjuntoDeParametrosTest} y lo vuelve a medir aqui sobre el ejercicio real, que es la
 * decision y no el mecanismo—, y `catastro` <b>exige</b> la llave que falta para publicar una sola
 * cifra. Sellar la version 1 de 2026 ahora la dejaria inservible para la valuacion y obligaria a
 * abrir una version 2 el dia que la firma llegue; y dos versiones del mismo ejercicio no son un
 * detalle administrativo, porque cada valuacion guarda el {@code conjuntoId} con que se calculo
 * (ADR-0025 §3). Es la misma frase que el {@code CLAUDE.md} de este repositorio trae desde antes de
 * este issue, con la mitad de los cuadros ya tachada.
 *
 * <h2>Las dos credenciales, que no son una comodidad</h2>
 *
 * <p>Publicar es {@code rol_carga_parametros} —la unica que puede escribir las tres tablas de
 * valuacion desde V55— y componer es {@code kamayuk_app}, que sobre {@code parametro_tributario}
 * solo tiene {@code SELECT}. Con una sola conexion de superusuario esto pasaria en verde sin
 * verificar ni la politica, ni el privilegio, ni el disparador.
 */
@DisplayName("catastro#8 — El ejercicio 2026: lo que ya se compone, y la fila que impide sellarlo")
class ElEjercicio2026TodaviaNoSeSellaTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-06T10:00:00Z"), ZoneOffset.UTC);

    /** El ejercicio del que habla el corpus. No es un numero de prueba. */
    private static final Ejercicio EJERCICIO = new Ejercicio(2026);

    /** La llave que falta, escrita una vez. Es la misma constante que `catastro` exige. */
    private static final String LA_LLAVE_QUE_FALTA = "PORCENTAJE_DE_ACTUALIZACION";

    /** El archivo del corpus que la respaldaria, y que sigue esperando su segunda firma. */
    private static final String SU_ARCHIVO_DEL_CORPUS = "predial-porcentaje-de-actualizacion.md";

    private static final Path CORPUS =
            Path.of("../../docs/10-negocio/valores-normativos").toAbsolutePath().normalize();

    private static final Path PARAMETROS = CORPUS.resolve("publicacion/parametros-2026.csv");

    private static final Path CUADROS = CORPUS.resolve("publicacion/cuadros-2026.csv");

    private static BaseDeDatosDePrueba base;
    private static long municipalidad;
    private static AdministrarParametros administrar;
    private static ImportarParametrosDelConjunto importar;
    private static long conjunto;

    @BeforeAll
    static void componerElEjercicio() throws SQLException, IOException {
        base = BaseDeDatosDePrueba.provisionar();
        municipalidad = crearMunicipalidad("200105", "Municipalidad Distrital de Catacaos");

        // Pasos 2 y 3: publicar. Como rol_carga_parametros, sin contexto de tenant porque lo que
        // se publica no es de ninguna municipalidad.
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

        // Paso 1 y composicion. Como kamayuk_app y con su contexto de tenant. NO se sella: ver el
        // javadoc de la clase, y el caso `sellarloAhoraCerrariaLaPuerta` que lo mide.
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
        // Se construye aunque no se use en ninguna asercion: si algun dia esta clase vuelve a
        // sellar, el snapshot es lo que hay que mirar. Se deja nombrado y no comentado.
        envolver(new ComponerSnapshot(repositorio, new SnapshotRepositoryJdbc(jdbcApp)), gestor);

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
    }

    /**
     * El manifiesto desplegado <b>sin la edicion vehicular</b>, escrito en un temporal.
     *
     * <p><b>Lo que se deja fuera se deja fuera diciendolo, y se comprueba.</b> El anexo vehicular
     * son 18 043 lineas y 54 129 filas, y {@code ComponerSnapshot} las excluye del ambito {@code
     * VALUACION}, asi que publicarlas aqui costaria varios minutos de corrida para no cambiar ni
     * una asercion de esta clase. La linea que se cae es exactamente una y la prueba lo exige: si
     * el manifiesto ganara otro cuadro y este filtro se lo comiera en silencio, el conjunto se
     * compondria sin el.
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

    // ------------------------------------------------------------------
    // Lo que YA esta hecho
    // ------------------------------------------------------------------

    @Test
    @DisplayName(
            "los dos cuadros de la valuacion se publican y se componen, enteros y sin rechazos")
    void losDosCuadrosSeComponen() throws SQLException {
        // Las cifras NO estan escritas aqui: se cuentan sobre los derivados del corpus, que es
        // donde viven. Escribirlas seria un segundo sitio donde una cifra puede estar mal.
        assertThat(Integer.parseInt(dato("SELECT count(*) FROM valor_unitario_edificacion")))
                .as("la matriz del Anexo I.2 entera, sin las tres celdas de puntos suspensivos")
                .isEqualTo(
                        filasDelDerivado(
                                "fuentes/valores-unitarios-2026/valores-unitarios-costa-2026.csv"));
        assertThat(Integer.parseInt(dato("SELECT count(*) FROM depreciacion")))
                .as("las cuatro tablas del Anexo I del Reglamento Nacional de Tasaciones")
                .isEqualTo(filasDelDerivado("fuentes/depreciacion-rnt-2016/depreciacion.csv"));
        assertThat(
                        Integer.parseInt(
                                dato(
                                        "SELECT count(*) FROM conjunto_parametro_detalle"
                                                + " WHERE conjunto_id = "
                                                + conjunto)))
                .as(
                        "las 32 filas de parametros-2026.csv mas las 2 ediciones de cuadros que el"
                                + " ambito VALUACION compone (la vehicular es de OBLIGACION). Eran 33 +"
                                + " 2 mientras la fila del «% actualizacion» estuvo publicada con una"
                                + " firma que nadie puso")
                .isEqualTo(34);
    }

    @Test
    @DisplayName("y sus dos archivos del corpus estan VERIFICADO con firmas humanas de verdad")
    void losDosCuadrosLlevanFirmaHumana() throws IOException {
        // Es lo que separa esta mitad del trabajo de la otra: aqui la doble firma de ADR-0007
        // ocurrio de verdad, en agosto, y por eso el cuadro se publica.
        assertThat(estadoDelArchivoDelCorpus("valores-unitarios-2026.md")).isEqualTo("VERIFICADO");
        assertThat(estadoDelArchivoDelCorpus("depreciacion.md")).isEqualTo("VERIFICADO");
    }

    // ------------------------------------------------------------------
    // Lo que falta, y por que no se sella
    // ------------------------------------------------------------------

    @Test
    @DisplayName(
            "la fila que falta es el «% actualizacion», y falta porque le falta la SEGUNDA FIRMA")
    void laFilaQueFaltaEsElPorcentajeDeActualizacion() throws IOException, SQLException {
        // Los tres hechos, cada uno leido de su fuente y no de una lista escrita aqui.
        assertThat(estadoDelArchivoDelCorpus(SU_ARCHIVO_DEL_CORPUS))
                .as(
                        "su §1.6 esta escrito y razonado; lo que no ha ocurrido es que una segunda"
                                + " persona lo lea y lo firme (ADR-0007)")
                .isEqualTo("TRANSCRITO");
        assertThat(Files.readString(PARAMETROS, StandardCharsets.UTF_8))
                .as(
                        "y por eso no hay fila suya en el derivado publicable:"
                                + " verificar-publicacion.mjs no publica desde TRANSCRITO")
                .doesNotContain(LA_LLAVE_QUE_FALTA);
        assertThat(
                        dato(
                                "SELECT count(*) FROM parametro_tributario WHERE tipo = '"
                                        + LA_LLAVE_QUE_FALTA
                                        + "'"))
                .as("ni una fila publicada, que es lo que `catastro` va a encontrar")
                .isEqualTo("0");
    }

    @Test
    @DisplayName("por eso el conjunto de 2026 queda ABIERTO: sellarlo ahora cerraria la puerta")
    void sellarloAhoraCerrariaLaPuerta() throws SQLException {
        assertThat(estadoDelConjunto(conjunto))
                .as("compuesto con todo lo publicable, y sin sellar")
                .isEqualTo("ABIERTO");

        // Y la razon, medida sobre el ejercicio real y no sobre uno de prueba. El mecanismo ya lo
        // mide `AbrirConjuntoDeParametrosTest` («con la bandera queda sellado, y despues no admite
        // ninguna escritura»); lo que se mide aqui es la DECISION: sellar la version 1 de 2026
        // ahora la dejaria sin poder recibir nunca la fila que falta, y obligaria a abrir una
        // version 2 el dia que la firma llegue —dos conjuntos distintos del mismo ejercicio, y
        // cada valuacion guarda con cual se calculo (ADR-0025 §3)—.
        Observacion porque = Observacion.de("Se comprueba que sellar cierra la puerta");
        ConjuntoDeParametros otraVersion = administrar.abrirVersion(EJERCICIO, porque);
        long sellado = java.util.Objects.requireNonNull(otraVersion.id());

        // Hay que meterle algo antes de sellar, y eso ya es una medida: sellar un conjunto vacio
        // se rechaza con «El conjunto N no tiene ningun parametro: sellarlo vacio diria que el
        // ejercicio esta parametrizado cuando no lo esta». Lo dijo la primera ejecucion de este
        // caso, y es la misma familia de guardas que la de abajo.
        List<Long> dosParametros = dosParametrosNacionales();
        administrar.agregarParametro(sellado, dosParametros.get(0), porque);
        administrar.sellar(sellado, porque);

        assertThatThrownBy(
                        () -> administrar.agregarParametro(sellado, dosParametros.get(1), porque))
                .as(
                        "un conjunto sellado no admite un parametro mas: es la frase que este"
                                + " repositorio trae escrita desde antes de catastro#8, y sigue"
                                + " siendo la que impide sellar 2026 hoy")
                .isInstanceOf(RuntimeException.class);
        assertThat(estadoDelConjunto(sellado)).isEqualTo("SELLADO");
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

    private static String estadoDelConjunto(long cual) throws SQLException {
        return dato("SELECT estado FROM conjunto_parametros WHERE id = " + cual);
    }

    /** Dos parametros nacionales cualesquiera de los ya publicados. No se inventa ninguno. */
    private static List<Long> dosParametrosNacionales() throws SQLException {
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia =
                        admin.prepareStatement(
                                "SELECT id FROM parametro_tributario"
                                        + " WHERE municipalidad_id IS NULL ORDER BY id LIMIT 2");
                ResultSet filas = sentencia.executeQuery()) {
            List<Long> ids = new java.util.ArrayList<>();
            while (filas.next()) {
                ids.add(filas.getLong(1));
            }
            if (ids.size() < 2) {
                throw new IllegalStateException(
                        "Hacen falta dos parametros publicados para medir que sellar cierra la"
                                + " puerta, y solo hay "
                                + ids.size());
            }
            return List.copyOf(ids);
        }
    }

    /** El campo {@code Estado} de la cabecera de un archivo del corpus, leido del archivo. */
    private static String estadoDelArchivoDelCorpus(String nombre) throws IOException {
        for (String linea : Files.readAllLines(CORPUS.resolve(nombre), StandardCharsets.UTF_8)) {
            String texto = linea.trim();
            if (texto.startsWith("| Estado |")) {
                return texto.replace("|", " ").replace("Estado", " ").trim();
            }
        }
        throw new IllegalStateException("«" + nombre + "» no declara su Estado en la cabecera");
    }

    /** Cuantas filas trae un derivado del corpus, contadas ahi y no escritas aqui. */
    private static int filasDelDerivado(String relativo) {
        Path archivo = CORPUS.resolve(relativo);
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
