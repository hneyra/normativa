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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
 * <b>El ejercicio 2026 se sella, y lo que lo desbloqueo fue una firma y no una linea de codigo.</b>
 *
 * <h2>Esta clase se ha llamado de las dos maneras, y ese vaiven ES el registro</h2>
 *
 * <p>Nacio como {@code ElEjercicio2026SeSellaTest}. Se renombro a {@code
 * ElEjercicio2026TodaviaNoSeSellaTest} porque la fila de la que dependia —el {@code
 * PORCENTAJE_DE_ACTUALIZACION} de {@code parametros-2026.csv}— se apoyaba en un archivo del corpus
 * marcado {@code VERIFICADO} con una <b>segunda firma que nunca ocurrio</b>: la escribio el propio
 * agente que redacto el razonamiento. La direccion lo rechazo, la cabecera volvio a {@code —} y a
 * {@code TRANSCRITO}, y con ella se fue la fila —{@code verificar-publicacion.mjs} no publica desde
 * ese estado—. Vuelve a su nombre original el <b>2026-09-06</b>, cuando una persona leyo §1.6 y
 * firmo.
 *
 * <p><b>El intervalo entre los dos renombrados es lo que ADR-0007 compra</b>, y tiene precio
 * medido: mientras duro, {@code catastro} valorizo <b>0 de 23</b> predios del padron de
 * demostracion, los 23 nombrando esta misma llave. Ninguna de las dos veces cambio un razonamiento;
 * cambio quien respondia por el.
 *
 * <h2>Lo que se compone, y con que credenciales</h2>
 *
 * <p>Las 33 filas del derivado del corpus y los <b>dos cuadros nacionales</b> de los que depende
 * valorizar un predio: valores unitarios de edificacion (H-14) y depreciacion (H-15), los dos
 * {@code VERIFICADO} con firmas humanas de verdad. Publicar es {@code rol_carga_parametros} —la
 * unica que puede escribir las tres tablas de valuacion desde V55— y componer es {@code
 * kamayuk_app}, que sobre {@code parametro_tributario} solo tiene {@code SELECT}. Con una sola
 * conexion de superusuario esto pasaria en verde sin verificar ni la politica, ni el privilegio, ni
 * el disparador.
 *
 * <h2>Lo que sellar cuesta, y por que aun asi se sella</h2>
 *
 * <p>Un conjunto sellado <b>no admite un parametro mas</b> (disparador de {@code V9}), y lo mide
 * {@code unSelloNoAdmiteUnaCifraMas} aqui abajo. Lo que <b>no</b> es cierto —y este issue lo
 * corrigio despues de leer el esquema en vez de repetirlo— es que sellar deje el ejercicio sin
 * salida: no existe ninguna restriccion de «un solo conjunto sellado por ejercicio». Hay {@code
 * conjunto_uq (municipalidad_id, ejercicio, version)}, y {@code
 * ParametrosRepositoryJdbc.selladoVigenteDe} <b>ordena por version y toma la ultima</b>, con su
 * comentario diciendo que desde {@code V10} puede haber varias selladas del mismo ejercicio (ARQ-09
 * §3). Lo que cuesta sellar antes de tiempo es otra cosa: cada valuacion guarda el {@code
 * conjuntoId} con que se calculo (ADR-0025 §3), asi que las cifras de la version 1 y las de la
 * version 2 son hechos sellados distintos y hacerlas converger es <b>recalcular el padron</b>.
 *
 * <h2>Lo que NO entra en este conjunto, contado antes de sellar y no despues</h2>
 *
 * <p>Diez filas del mapa normativo no tienen ni archivo del corpus: <b>ocho de D-02b</b> —tasas de
 * arbitrios y sus criterios de distribucion, el descuento por pago anual, las inafectaciones, la
 * tasa de anuncios, la TIM, el CUIS y el interes del fraccionamiento— y <b>dos de D-02c</b> —el
 * arancel de costas coactivas y los descuentos por pronto pago de papeletas—. Las diez son de
 * <b>acto propio de la municipalidad</b>, no de norma nacional, asi que este repositorio no las
 * puede publicar: entran en el conjunto de cada municipalidad que apruebe su ordenanza, en una
 * version posterior. Se cuentan aqui porque «faltan cosas» no es una lista, y quien selle tiene que
 * poder ver si alguna es suya.
 *
 * <h2>Y lo que este sello NO comprueba: el paso 4 (#7)</h2>
 *
 * <p>La lista «Antes de sellar» de {@code publicacion/README.md} tiene <b>cinco</b> puntos, y el
 * <b>3</b> —«el arancel de la municipalidad esta cargado», con {@code cargar-arancel-vial.sh}
 * contra ESE conjunto— <b>esta clase no lo puede ver, ni podria</b>: {@code arancel} no es una de
 * las 19 tablas de este esquema, esta en el reparto como tabla de {@code catastro}, y la undecima
 * regla —ningun SQL cruza la frontera de sistema— prohibe consultarla desde aqui. Hasta #7 se
 * sellaba sin decirlo, que es la unica parte que estaba mal: no que se sellara, sino que el punto
 * se quedara sin respuesta y nada lo dijera.
 *
 * <p>Lo que si se puede afirmar es <b>la frontera</b>, y {@code
 * elPasoCuatroNoSePuedeComprobarDesdeAqui} la afirma: le pregunta a {@code information_schema} —un
 * catalogo del motor, no una tabla de nadie— y comprueba que la tabla del paso 4 no esta en este
 * esquema, con las tablas propias presentes como contraste para que «no esta» no pueda ser cierto
 * sobre la nada. <b>El {@code --sellar} de verdad lo decide quien ve los dos lados</b>: quien selle
 * el conjunto de su municipalidad corre el paso 4 entre abrir y sellar, y este repositorio no puede
 * comprobar que lo hizo.
 *
 * <p><b>Y la consecuencia esta medida, del otro lado.</b> {@code ValorizacionDelPredio} comprueba
 * el arancel como cuarta precondicion —despues de los dos cuadros y ANTES del {@code %
 * actualizacion}— y sin el devuelve {@code SinValorizar} con la llave {@code ARANCEL:‹ejercicio›}.
 * Su censo del padron lo escribe como premisa suya: «el arancel de cada via se supone publicado …
 * sin la premisa, los 23 predios saldrian por {@code ARANCEL:2026}». O sea que el <b>4 de 23</b>
 * que este repositorio cita se mide <b>suponiendo cargado el arancel</b>; sin cargarlo son <b>0 de
 * 23</b>, y los 23 por esa llave.
 */
@DisplayName(
        "catastro#8 y #7 — El ejercicio 2026 se sella: 33 filas, dos cuadros, lo que cuesta y el"
                + " paso 4 que no se puede ver")
class ElEjercicio2026SeSellaTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-06T10:00:00Z"), ZoneOffset.UTC);

    /** El ejercicio del que habla el corpus. No es un numero de prueba. */
    private static final Ejercicio EJERCICIO = new Ejercicio(2026);

    /** La llave que faltaba, escrita una vez. Es la misma constante que `catastro` exige. */
    private static final String LA_LLAVE_QUE_FALTABA = "PORCENTAJE_DE_ACTUALIZACION";

    /** El archivo del corpus que la respalda, firmado el 2026-09-06. */
    private static final String SU_ARCHIVO_DEL_CORPUS = "predial-porcentaje-de-actualizacion.md";

    private static final Path CORPUS =
            Path.of("../../docs/10-negocio/valores-normativos").toAbsolutePath().normalize();

    private static final Path PARAMETROS = CORPUS.resolve("publicacion/parametros-2026.csv");

    private static final Path CUADROS = CORPUS.resolve("publicacion/cuadros-2026.csv");

    /** La lista «Antes de sellar», que es lo que hay que poder contestar antes de escribirlo. */
    private static final Path LISTA_DE_ANTES_DE_SELLAR = CORPUS.resolve("publicacion/README.md");

    /**
     * La tabla que llena el paso 4, y que este esquema NO tiene: es de {@code catastro}.
     *
     * <p>Escrita una vez y no dos: la afirmacion de la frontera y el mensaje que la explica leen
     * esta misma constante, para que no puedan decir cosas distintas.
     */
    private static final String LA_TABLA_DEL_PASO_4 = "arancel";

    /** El guion del paso 4, tal como la lista lo nombra. */
    private static final String EL_GUION_DEL_PASO_4 = "cargar-arancel-vial.sh";

    /** La llave con la que `catastro` se para cuando ese paso no se corrio (#7). */
    private static final String LA_LLAVE_QUE_DEVUELVE_CATASTRO = "ARANCEL:";

    /** Tres tablas propias, como contraste: si no salen, la consulta no mira este esquema. */
    private static final List<String> TABLAS_DE_ESTE_SISTEMA =
            List.of("conjunto_parametros", "parametro_tributario", "depreciacion");

    /** Una fila numerada de una tabla de Markdown: {@code | 3 | …}. */
    private static final Pattern FILA_NUMERADA = Pattern.compile("^\\|\\s*(\\d+)\\s*\\|");

    private static BaseDeDatosDePrueba base;
    private static long municipalidad;
    private static AdministrarParametros administrar;
    private static ImportarParametrosDelConjunto importar;
    private static ComponerSnapshot componer;
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

        // Paso 1, composicion y SELLO. Como kamayuk_app y con su contexto de tenant.
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

        // Y se sella. Es el acto que este issue anade, y va en el @BeforeAll a proposito: lo que
        // las pruebas miden no es el mecanismo de sellar —eso es `AbrirConjuntoDeParametrosTest`—
        // sino que el ejercicio 2026, compuesto con lo que el corpus publica de verdad, QUEDA
        // sellado; si sellarlo fallara, ninguna de las tres tendria sentido y todas caerian juntas.
        administrar.sellar(
                conjunto, Observacion.de("Se sella el ejercicio 2026 (catastro#8, AC-3)"));
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
                        "las 33 filas de parametros-2026.csv mas las 2 ediciones de cuadros que el"
                                + " ambito VALUACION compone (la vehicular es de OBLIGACION). Fueron"
                                + " 34 mientras el «% actualizacion» espero su segunda firma")
                .isEqualTo(35);
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
    // La fila que faltaba, y el sello
    // ------------------------------------------------------------------

    @Test
    @DisplayName("el «% actualizacion» ya esta, y lo que lo trajo fue la SEGUNDA FIRMA")
    void laFilaQueFaltabaEsElPorcentajeDeActualizacion() throws IOException, SQLException {
        // Los tres hechos, cada uno leido de su fuente y no de una lista escrita aqui. Son los
        // mismos tres que esta prueba media al reves mientras la firma no estuvo: el estado del
        // archivo, su presencia en el derivado y su fila en la base. Ninguno de los tres se
        // consigue razonando mejor; los tres cuelgan de que una persona firmara.
        assertThat(estadoDelArchivoDelCorpus(SU_ARCHIVO_DEL_CORPUS))
                .as("una segunda persona leyo §1.6 y lo firmo el 2026-09-06 (ADR-0007)")
                .isEqualTo("VERIFICADO");
        assertThat(Files.readString(PARAMETROS, StandardCharsets.UTF_8))
                .as(
                        "y por eso hay fila suya en el derivado publicable:"
                                + " verificar-publicacion.mjs solo publica desde VERIFICADO")
                .contains(LA_LLAVE_QUE_FALTABA);
        assertThat(
                        dato(
                                "SELECT count(*) FROM parametro_tributario WHERE tipo = '"
                                        + LA_LLAVE_QUE_FALTABA
                                        + "'"))
                .as("y una sola fila publicada, que es lo que `catastro` va a encontrar")
                .isEqualTo("1");
    }

    @Test
    @DisplayName("el conjunto de 2026 queda SELLADO, y su snapshot entrega la llave que faltaba")
    void elEjercicio2026QuedaSellado() throws SQLException {
        assertThat(estadoDelConjunto(conjunto))
                .as("compuesto con todo lo que el corpus publica, y sellado (catastro#8, AC-3)")
                .isEqualTo("SELLADO");

        // Y se lee como lo leera `catastro`: por el snapshot del ambito VALUACION, no por la tabla.
        // Un conjunto ABIERTO no lo devuelve esta consulta —exige `estado = 'SELLADO'`—, asi que
        // esta linea tambien mide el sello, y ademas por el camino que usa el consumidor.
        SnapshotDelConjunto snapshot = componer.vigenteDe(EJERCICIO, Ambito.VALUACION);
        assertThat(snapshot.conjuntoId()).isEqualTo(conjunto);
        assertThat(snapshot.parametros())
                .as(
                        "la llave que paro la valuacion de 23 predios viaja en el conjunto sellado,"
                                + " que es la unica forma en que `catastro` la puede leer")
                .anySatisfy(p -> assertThat(p.tipo()).isEqualTo(LA_LLAVE_QUE_FALTABA));
        assertThat(snapshot.valoresUnitarios()).as("el cuadro de H-14, dentro").isNotEmpty();
        assertThat(snapshot.depreciaciones()).as("el cuadro de H-15, dentro").isNotEmpty();
    }

    @Test
    @DisplayName("y un sello no admite una cifra mas: es lo que costaba contar antes de sellar")
    void unSelloNoAdmiteUnaCifraMas() throws SQLException {
        // El mecanismo lo mide `AbrirConjuntoDeParametrosTest`; lo que se mide aqui es el COSTE de
        // la decision que este issue toma, sobre el ejercicio real y con sus parametros reales.
        //
        // No se hace sobre `conjunto` porque ya tiene dentro TODOS los parametros nacionales
        // publicados: anadirle uno fallaria por duplicado y no por sellado, y las dos causas se
        // leerian igual desde aqui.
        //
        // Y se hace en OTRA MUNICIPALIDAD, que es lo que la primera ejecucion enseno. Escrito
        // como una version 2 de la misma, la prueba pasaba a verde o a rojo segun el orden en que
        // JUnit corriera los casos: `selladoVigenteDe` ordena por version y toma la ultima, asi
        // que el conjunto de juguete de dos filas se convertia en «el conjunto sellado de 2026» y
        // `elEjercicio2026QuedaSellado` caia con «expected: 1L but was: 2L». El rojo es correcto
        // —eso es exactamente lo que le pasaria a una municipalidad que sellara de mas— y por eso
        // se mide donde no puede tapar al ejercicio de verdad.
        //
        // Que una version 2 se pueda sellar teniendo la 1 sellada NO es un descuido: no existe
        // ninguna restriccion de «un solo conjunto sellado por ejercicio» —hay `conjunto_uq
        // (municipalidad_id, ejercicio, version)`—. Es la salida de un sello prematuro, y su
        // precio es que cada valuacion guarda con que `conjuntoId` se calculo (ADR-0025 §3):
        // converger es recalcular el padron.
        long otra = crearMunicipalidad("200101", "Municipalidad Provincial de Sullana");
        TenantContext.fijar(new MunicipalidadId(otra));
        try {
            Observacion porque = Observacion.de("Se mide lo que cuesta sellar");
            ConjuntoDeParametros suyo = administrar.abrirVersion(EJERCICIO, porque);
            long sellado = java.util.Objects.requireNonNull(suyo.id());

            // Hay que meterle algo antes de sellar, y eso ya es una medida: sellar un conjunto
            // vacio se rechaza con «El conjunto N no tiene ningun parametro: sellarlo vacio diria
            // que el ejercicio esta parametrizado cuando no lo esta». Lo dijo la primera ejecucion
            // de este caso, y es la misma familia de guardas que la de abajo.
            List<Long> dosParametros = dosParametrosNacionales();
            administrar.agregarParametro(sellado, dosParametros.get(0), porque);
            administrar.sellar(sellado, porque);

            assertThatThrownBy(
                            () ->
                                    administrar.agregarParametro(
                                            sellado, dosParametros.get(1), porque))
                    .as(
                            "un conjunto sellado no admite un parametro mas, y por eso las diez"
                                    + " filas de D-02b y D-02c que no tienen archivo del corpus se"
                                    + " contaron ANTES de sellar (ver el javadoc de la clase)")
                    .isInstanceOf(RuntimeException.class);
            assertThat(estadoDelConjunto(sellado)).isEqualTo("SELLADO");
        } finally {
            TenantContext.fijar(new MunicipalidadId(municipalidad));
        }
    }

    // ------------------------------------------------------------------
    // #7 — El paso 4, que este sistema no puede comprobar y hasta ahora no decia
    // ------------------------------------------------------------------

    @Test
    @DisplayName("el paso 4 no se puede comprobar desde aqui: su tabla no es de este esquema")
    void elPasoCuatroNoSePuedeComprobarDesdeAqui() throws SQLException {
        // La afirmacion es sobre LA FRONTERA y no un cruce: se le pregunta a `information_schema`,
        // que es un catalogo del motor y no una tabla de ningun sistema. Consultar `arancel` desde
        // aqui seria justo lo que la undecima regla prohibe, y por eso lo unico que se puede
        // afirmar es que no esta.
        Set<String> tablas = tablasDeEsteEsquema();

        // El contraste va PRIMERO y a proposito: sin el, «arancel no esta» seria cierto tambien
        // con la consulta rota, con el esquema vacio o con el nombre mal escrito, y esta prueba
        // pasaria en verde sin haber mirado nada.
        assertThat(tablas)
                .as(
                        "si esta consulta no encuentra las tablas de este sistema, no esta mirando"
                                + " este esquema y «%s no esta» seria cierto sobre la nada: no se habria"
                                + " medido nada",
                        LA_TABLA_DEL_PASO_4)
                .containsAll(TABLAS_DE_ESTE_SISTEMA)
                .hasSizeGreaterThanOrEqualTo(19);

        assertThat(tablas)
                .as(
                        "«%s» es de `catastro` y la carga el paso 4 (`%s --conjunto-id N`), entre"
                                + " abrir y sellar. No esta en este esquema, asi que esta clase sella"
                                + " sobre una precondicion que NO PUEDE VER: el `--sellar` de verdad lo"
                                + " decide quien ve los dos lados (#7)",
                        LA_TABLA_DEL_PASO_4, EL_GUION_DEL_PASO_4)
                .doesNotContain(LA_TABLA_DEL_PASO_4);
    }

    @Test
    @DisplayName("la lista «Antes de sellar» esta contestada punto por punto, y no en un parrafo")
    void laListaDeAntesDeSellarEstaContestadaPuntoPorPunto() throws IOException {
        // Hasta #7 el parrafo que seguia a la lista contestaba a los puntos 1, 2, 4 y 5 y saltaba
        // el 3, y nada lo decia: un parrafo no tiene forma de declarar que se dejo un punto sin
        // mirar. Esto lo tiene.
        List<Integer> puntos = puntosDeLaSeccion("Antes de sellar");
        List<Integer> respuestas = puntosDeLaSeccion("Los cinco puntos, contestados uno a uno");

        // Los dos centinelas, por separado: una lista que se queda vacia hace que lo de abajo se
        // cumpla sobre el conjunto vacio, y entonces el verde no significa nada.
        assertThat(puntos)
                .as(
                        "no se leyo ni un punto de la lista «Antes de sellar» de %s: o la seccion"
                                + " cambio de nombre o la tabla se fue, y esta comprobacion no midio"
                                + " nada",
                        LISTA_DE_ANTES_DE_SELLAR.getFileName())
                .isNotEmpty();
        assertThat(respuestas)
                .as("no se leyo ni una respuesta: lo de abajo se cumpliria sobre el vacio")
                .isNotEmpty();

        assertThat(respuestas)
                .as(
                        "cada punto de «Antes de sellar» tiene su respuesta, y en su orden. El que"
                                + " falte se queda sin contestar sin que nada lo diga, que es lo que"
                                + " paso con el 3 hasta #7; y una respuesta de mas habla de un punto"
                                + " que no existe")
                .containsExactlyElementsOf(puntos);
    }

    @Test
    @DisplayName("y la del punto 3 nombra el paso que no se corrio y lo que cuesta, no «falta»")
    void laRespuestaDelPuntoTresNombraElPasoYSuConsecuencia() throws IOException {
        String respuesta = seccionDe("El punto 3");

        assertThat(respuesta)
                .as(
                        "no se encontro la seccion que contesta al punto 3 en %s: esta comprobacion"
                                + " no midio nada",
                        LISTA_DE_ANTES_DE_SELLAR.getFileName())
                .isNotBlank();

        assertThat(respuesta)
                .as(
                        "la respuesta tiene que nombrar el paso que no se corrio; sin el, «no esta"
                                + " cargado» no dice que habria que correr")
                .contains(EL_GUION_DEL_PASO_4);

        assertThat(respuesta)
                .as(
                        "y la consecuencia MEDIDA, que es la llave con la que `catastro` se para"
                                + " (`ValorizacionDelPredio`). Sin ella la respuesta es «faltan cosas»,"
                                + " que es lo que este repositorio lleva prohibiendo desde que la lista"
                                + " nombra sus diez filas una a una")
                .contains(LA_LLAVE_QUE_DEVUELVE_CATASTRO);
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

    /**
     * Las tablas de este esquema, preguntadas al catalogo del motor.
     *
     * <p><b>No es un cruce de frontera</b> y por eso se puede escribir aqui: {@code
     * information_schema.tables} es una vista del catalogo de PostgreSQL, no una tabla de ningun
     * sistema, y lo que se lee de ella son NOMBRES. Consultar {@code arancel} —que es de {@code
     * catastro}— es lo que la undecima regla prohibe; preguntar si esta es justo lo contrario, y es
     * la unica forma que este repositorio tiene de afirmar donde acaba.
     */
    private static Set<String> tablasDeEsteEsquema() throws SQLException {
        Set<String> nombres = new LinkedHashSet<>();
        try (Connection admin = base.conexionAdmin();
                PreparedStatement sentencia =
                        admin.prepareStatement(
                                "SELECT table_name FROM information_schema.tables"
                                        + " WHERE table_schema = 'public'");
                ResultSet filas = sentencia.executeQuery()) {
            while (filas.next()) {
                nombres.add(filas.getString(1));
            }
        }
        return nombres;
    }

    /**
     * Los numeros de las filas numeradas de la primera tabla que sigue a un encabezado.
     *
     * <p>La seccion acaba en el encabezado siguiente, sea del nivel que sea: por eso las diez filas
     * de D-02b/D-02c —que tambien son filas numeradas— no entran, viven bajo su propio {@code
     * ####}. Si alguien las mueve dentro, esto sale rojo diciendo que sobran respuestas, que es
     * mejor que contarlas en silencio.
     */
    private static List<Integer> puntosDeLaSeccion(String encabezado) throws IOException {
        List<Integer> puntos = new java.util.ArrayList<>();
        boolean dentro = false;
        for (String linea : Files.readAllLines(LISTA_DE_ANTES_DE_SELLAR, StandardCharsets.UTF_8)) {
            String texto = linea.strip();
            if (texto.startsWith("#")) {
                if (dentro) {
                    break;
                }
                dentro = texto.contains(encabezado);
                continue;
            }
            if (!dentro) {
                continue;
            }
            Matcher fila = FILA_NUMERADA.matcher(texto);
            if (fila.find()) {
                puntos.add(Integer.parseInt(fila.group(1)));
            }
        }
        return List.copyOf(puntos);
    }

    /** El cuerpo de la seccion cuyo encabezado contiene ese texto, sin el encabezado. */
    private static String seccionDe(String encabezado) throws IOException {
        StringBuilder cuerpo = new StringBuilder();
        boolean dentro = false;
        for (String linea : Files.readAllLines(LISTA_DE_ANTES_DE_SELLAR, StandardCharsets.UTF_8)) {
            String texto = linea.strip();
            if (texto.startsWith("#")) {
                if (dentro) {
                    break;
                }
                dentro = texto.contains(encabezado);
                continue;
            }
            if (dentro) {
                cuerpo.append(linea).append('\n');
            }
        }
        return cuerpo.toString();
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
