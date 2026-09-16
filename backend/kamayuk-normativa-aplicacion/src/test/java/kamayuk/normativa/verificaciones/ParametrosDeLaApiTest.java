package kamayuk.normativa.verificaciones;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kamayuk.comun.verificaciones.contrato.EndpointsPublicados;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.parametros.infraestructura.ParametrosRepositoryJdbc;
import kamayuk.normativa.persistencia.OrdenSeguro;
import kamayuk.normativa.seguridad.infraestructura.LecturaDeLaCopiaLocalJdbc;
import kamayuk.normativa.web.ParametrosDePaginacion;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ValueConstants;

/**
 * Que hace falta para PEDIR cada operacion, derivado de los controladores (#49).
 *
 * <h2>El hueco que cierra</h2>
 *
 * <p>{@code formas-de-la-api.json} recoge <b>solo la forma de la RESPUESTA</b>. Con eso, una
 * pantalla se puede construir sobre una operacion sin un parametro que el backend exige, y el dia
 * que la ruta se encienda sale un {@code 422} que nada anuncio. Es lo que {@code rentas} midio en
 * su #26, y este archivo hermano, {@code docs/50-api/parametros-de-la-api.json}, es su respuesta:
 * la interfaz de {@code rentas} —la que sustituye a la V6, epica #47— lo lee para no servir una
 * operacion sin lo que el backend exige.
 *
 * <h2>Las categorias, las mismas claves que en {@code rentas}</h2>
 *
 * <ul>
 *   <li>{@code obligatorios} — <b>derivados de la firma</b>: {@code @RequestParam} con {@code
 *       required = true} y sin {@code defaultValue}, mas los {@code params = "..."} del mapeo.
 *   <li>{@code algunoDeEstos}, {@code condicionales} y {@code enElCuerpo} — lo que el controlador
 *       exige <b>en el cuerpo del metodo</b>, declarado aqui porque una anotacion no lo sabe decir.
 *       <b>Hoy los tres estan vacios, y esta medido</b>: ningun controlador de este backend escribe
 *       «falta «X»». Se conservan con su escaner porque #56 y #59 anaden operaciones, y la guarda
 *       tiene que estar puesta el dia que la primera exija algo asi, no despues.
 *   <li>{@code opcionales} — el resto de los de consulta, derivados del mismo recorrido.
 * </ul>
 *
 * <p>El recorrido excluye {@code @PathVariable}, {@code @RequestBody} y {@code @RequestHeader}
 * <b>por su cuenta</b>, como hace {@code rentas}. No se usa {@code
 * EndpointsPublicados.parametrosDeConsulta} de {@code comun-verificaciones} para esto, y el motivo
 * esta medido en su fuente: cuenta los componentes de <b>todo</b> {@code record} que no lleve
 * {@code @RequestParam}, lleve o no {@code @RequestBody}, asi que la {@code observacion} del cuerpo
 * de una escritura saldria como parametro de consulta. Hoy da igual —no hay escrituras—; desde #59
 * no. {@link #elRecorridoExcluyeRutaCuerpoYCabecera()} lo fija con un controlador de muestra.
 *
 * <h2>Lo que {@code rentas} no publica y aqui si: el orden y el tope de un listado</h2>
 *
 * <p>Cada operacion paginada lleva dos claves mas, <b>que el archivo de {@code rentas} no
 * tiene</b>: {@code ordenarPorAdmitidos} y {@code tamanoMaximo}. Son la leccion de la V6 que renace
 * aqui: {@code frontend/src/secciones/conjuntos.ts:44-55} (en {@code c01fe9a}) copiaba a mano los
 * campos de {@code ParametrosRepositoryJdbc.ORDEN_CONJUNTO}, porque cualquier otro contesta {@code
 * 422 ORDEN_NO_ADMITIDO}, y el tope de {@code tamano} igual. Aqui no se escriben:
 *
 * <ul>
 *   <li>{@code ordenarPorAdmitidos} se lee <b>por reflexion</b> del {@link OrdenSeguro} del
 *       repositorio que sirve el listado, declarado en {@link #ORDEN_DE_CADA_LISTADO}. Es la lista
 *       blanca de {@link OrdenSeguro#camposAdmitidos()}: la que decide el {@code 422}.
 *   <li>{@code tamanoMaximo} es {@link Paginacion#TAMANO_MAXIMO}, el que el constructor de {@link
 *       Paginacion} hace cumplir.
 * </ul>
 *
 * <p>Las operaciones que no paginan no llevan ninguna de las dos claves: su presencia es lo que
 * dice que la operacion pagina.
 *
 * <pre>
 * ./gradlew :kamayuk-normativa-aplicacion:test --tests '*FormasDeLaApiTest*' --tests '*ParametrosDeLaApiTest*' -Dkamayuk.formas.regenerar=true
 * </pre>
 */
@DisplayName("Parametros de la API (docs/50-api)")
class ParametrosDeLaApiTest {

    /** La misma propiedad que las formas: los dos archivos se regeneran del mismo recorrido. */
    private static final String REGENERAR = "kamayuk.formas.regenerar";

    private static final String ARCHIVO = "docs/50-api/parametros-de-la-api.json";

    private static final String PROCEDENCIA =
            "ARCHIVO GENERADO — no editar a mano. Lo produce ParametrosDeLaApiTest de la FIRMA de"
                    + " cada controlador; se regenera con -Dkamayuk.formas.regenerar=true. Dice que"
                    + " hace falta para PEDIR cada operacion: «obligatorios» sale de @RequestParam"
                    + " required=true sin defaultValue; «algunoDeEstos» son grupos de los que hay"
                    + " que mandar al menos uno; «condicionales» son los que solo hacen falta segun"
                    + " el cuerpo de la peticion; «opcionales» es el resto, y «enElCuerpo» son los"
                    + " que el controlador exige en el cuerpo JSON y NO en la URL. Las operaciones"
                    + " paginadas llevan ademas «ordenarPorAdmitidos», leido del OrdenSeguro del"
                    + " repositorio que las sirve —otro campo contesta 422 ORDEN_NO_ADMITIDO—, y"
                    + " «tamanoMaximo», el tope de Paginacion (#49).";

    /**
     * Los grupos de nombres de los que hay que mandar al menos uno. Vacio: medido en #49, ningun
     * controlador los exige.
     */
    private static final Map<String, List<List<String>>> ALGUNO_DE_ESTOS = Map.of();

    /** Lo que el controlador exige y no viaja en la URL. Vacio: no hay escrituras todavia. */
    private static final Map<String, List<String>> EXIGIDOS_EN_EL_CUERPO = Map.of();

    /** Los que solo hacen falta segun el cuerpo. Vacio por lo mismo. */
    private static final Map<String, List<String>> CONDICIONALES = Map.of();

    /** Donde vive la lista blanca de orden de un listado: un campo estatico de su repositorio. */
    record OrigenDelOrden(Class<?> repositorio, String campo) {}

    /**
     * La lista blanca de cada operacion paginada.
     *
     * <p>Lo unico que se escribe a mano es <b>donde</b> esta, no <b>que</b> contiene: el contenido
     * se lee del campo. Y lo que se escribe no puede quedarse viejo en silencio: {@link
     * #cadaListadoPaginadoDeclaraSuOrden()} exige que las claves sean exactamente las operaciones
     * que reciben {@link ParametrosDePaginacion}, y un campo renombrado no se puede leer.
     */
    private static final Map<String, OrigenDelOrden> ORDEN_DE_CADA_LISTADO =
            Map.of(
                    "GET /seguridad/parametros",
                    new OrigenDelOrden(ParametrosRepositoryJdbc.class, "ORDEN_CONJUNTO"),
                    // #56: el listado de parametros publicados, el segundo que pagina. Su lista
                    // blanca es la otra del mismo repositorio, y desde #56 lleva desempate por
                    // `id`: sin el, las cinco filas `UIT` de `parametros-2026.csv` empatan y dos
                    // paginas consecutivas pueden repetir una y omitir otra.
                    "GET /parametros",
                    new OrigenDelOrden(ParametrosRepositoryJdbc.class, "ORDEN_PARAMETRO"),
                    // Las dos lecturas del catalogo de #54, que la interfaz usa para componer su
                    // menu. Su lista blanca es la misma que la de `rentas`: el dialecto de
                    // paginacion es uno solo.
                    "GET /seguridad/modulos",
                    new OrigenDelOrden(LecturaDeLaCopiaLocalJdbc.class, "ORDEN_MODULO"),
                    "GET /seguridad/accesos",
                    new OrigenDelOrden(LecturaDeLaCopiaLocalJdbc.class, "ORDEN_ACCESO"));

    // ------------------------------------------------------------------

    @Test
    @DisplayName("el archivo de parametros es el que producen los controladores de hoy")
    void losParametrosSonLosDelArchivo() throws IOException {
        String producido = comoJson(parametrosPorOperacion());
        Path destino = RaizDelRepositorio.ruta().resolve(ARCHIVO);

        if (Boolean.getBoolean(REGENERAR)) {
            Files.writeString(destino, producido, StandardCharsets.UTF_8);
            return;
        }

        assertThat(destino)
                .as("«%s» no existe: regeneralo con -D%s=true", ARCHIVO, REGENERAR)
                .exists();
        assertThat(Files.readString(destino, StandardCharsets.UTF_8))
                .as(
                        "los parametros publicados y «%s» no cuadran. Si cambiaste la firma de un"
                                + " controlador, regenera con -D%s=true; si no, alguien edito el"
                                + " archivo a mano.",
                        ARCHIVO, REGENERAR)
                .isEqualTo(producido);
    }

    @Test
    @DisplayName("las dos operaciones que exigen un parametro de consulta lo publican obligatorio")
    void lasQueExigenUnParametroLoPublican() {
        // El contraste: sin estas dos afirmaciones, un generador que dejara `obligatorios` siempre
        // vacio produciria un archivo estable y la comparacion de arriba pasaria en verde.
        Map<String, Map<String, Object>> parametros = parametrosPorOperacion();

        assertThat(listaDe(parametros, "GET /conjuntos", "obligatorios"))
                .as("SnapshotController.vigente lee `@RequestParam int ejercicio` sin omision")
                .containsExactly("ejercicio");
        assertThat(listaDe(parametros, "GET /conjuntos/{id}/snapshot", "obligatorios"))
                .as(
                        "SnapshotController.snapshot exige el ambito, y a proposito sin valor por"
                                + " omision: un «todo» implicito serviria otra huella")
                .containsExactly("ambito");
    }

    @Test
    @DisplayName("el orden admitido de los conjuntos es el que la V6 copiaba a mano, y el tope 500")
    void elOrdenDeLosConjuntosEsElQueLaV6CopiabaAMano() {
        // El contraste del punto 7: la comparacion de archivos no ve un generador que publicara la
        // lista vacia. Esta mira lo que la V6 tenia copiado en `conjuntos.ts:44-55` —medido contra
        // el 422 del backend—, y un campo que desaparezca de la lista blanca sale nombrado.
        Map<String, Object> listado = parametrosPorOperacion().get("GET /seguridad/parametros");
        assertThat(listado).as("GET /seguridad/parametros tiene que estar publicada").isNotNull();

        assertThat(listado.get("ordenarPorAdmitidos"))
                .as(
                        "los campos por los que GET /seguridad/parametros ordena sin contestar 422"
                                + " ORDEN_NO_ADMITIDO: ParametrosRepositoryJdbc.ORDEN_CONJUNTO")
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.LIST)
                .containsExactlyInAnyOrder("ejercicio", "version", "estado", "id");
        assertThat(listado.get("tamanoMaximo"))
                .as("el tope de tamano que Paginacion hace cumplir, que la V6 tambien copiaba")
                .isEqualTo(500);
    }

    @Test
    @DisplayName("cada operacion paginada declara su lista blanca de orden, y ninguna otra")
    void cadaListadoPaginadoDeclaraSuOrden() {
        Set<String> paginadas = new TreeSet<>();
        for (Map.Entry<String, Method> endpoint : EndpointsPublicados.porOperacion().entrySet()) {
            if (pagina(endpoint.getValue())) {
                paginadas.add(endpoint.getKey());
            }
        }

        assertThat(paginadas)
                .as("sin ninguna operacion paginada esta guarda compara el vacio con el vacio")
                .isNotEmpty();
        assertThat(new TreeSet<>(ORDEN_DE_CADA_LISTADO.keySet()))
                .as(
                        "ORDEN_DE_CADA_LISTADO tiene que nombrar exactamente las operaciones que"
                                + " reciben ParametrosDePaginacion. Una que falte publicaria un"
                                + " listado sin decir por que se puede ordenar, y la interfaz"
                                + " volveria a copiarlo a mano (la V6); una que sobre ya no pagina.")
                .isEqualTo(paginadas);
    }

    @Test
    @DisplayName("el orden por omision de cada listado esta en su propia lista blanca")
    void elOrdenPorOmisionEstaAdmitido() throws IOException {
        // `aPaginacion("ejercicio")` es lo que se usa cuando la peticion no dice `ordenarPor`. Si
        // no estuviera en la lista blanca, TODA peticion sin orden contestaria 422: el defecto no
        // lo veria la comparacion de archivos, porque el literal no sale de ninguna firma.
        //
        // EL RECORRIDO VA POR EL CUERPO DEL METODO Y NO POR EL ARCHIVO ENTERO (#54). Hasta este
        // issue cada controlador servia UN listado, asi que leer el fuente entero y compararlo
        // contra la unica lista blanca daba lo mismo. `SeguridadController` sirve dos —los modulos
        // por `orden` y los accesos por `codigo`, dos tablas distintas—, y con el recorrido viejo
        // el `orden` de los modulos se comparaba tambien contra la lista de los accesos, que no
        // tiene esa columna: rojo por leer de mas. El cuerpo de cada metodo se aisla cerrando
        // llaves desde su declaracion.
        int encontrados = 0;
        Set<String> cubiertos = new TreeSet<>();
        for (Map.Entry<String, OrigenDelOrden> listado : ORDEN_DE_CADA_LISTADO.entrySet()) {
            Method metodo = EndpointsPublicados.porOperacion().get(listado.getKey());
            assertThat(metodo).as("«%s» no esta publicada", listado.getKey()).isNotNull();
            Path fuente = fuenteDe(metodo.getDeclaringClass());
            assertThat(fuente).as("no se encontro el fuente de %s", metodo).isNotNull();
            String cuerpo =
                    cuerpoDe(Files.readString(fuente, StandardCharsets.UTF_8), metodo.getName());
            assertThat(cuerpo)
                    .as("no se pudo aislar el cuerpo de %s.%s", fuente, metodo.getName())
                    .isNotNull();

            Matcher literal = POR_OMISION.matcher(cuerpo);
            while (literal.find()) {
                encontrados++;
                cubiertos.add(literal.group(1));
                assertThat(camposAdmitidos(listado.getValue()))
                        .as(
                                "%s.%s ordena por omision por «%s», y %s.%s no lo admite",
                                metodo.getDeclaringClass().getSimpleName(),
                                metodo.getName(),
                                literal.group(1),
                                listado.getValue().repositorio().getSimpleName(),
                                listado.getValue().campo())
                        .contains(literal.group(1));
            }
        }
        assertThat(encontrados)
                .as("el patron no encuentra ningun aPaginacion(\"…\"): esta ciego")
                .isPositive();

        // Y ninguno se queda fuera: un `aPaginacion("…")` en un controlador cuyo listado no este
        // declarado arriba no se compararia contra ninguna lista blanca, y ese es justo el defecto
        // —toda peticion sin orden en 422— que esta guarda existe para ver.
        Set<String> enTodosLosControladores = new TreeSet<>();
        for (Method publicado : EndpointsPublicados.porOperacion().values()) {
            Path fuente = fuenteDe(publicado.getDeclaringClass());
            if (fuente == null) {
                continue;
            }
            Matcher literal = POR_OMISION.matcher(Files.readString(fuente, StandardCharsets.UTF_8));
            while (literal.find()) {
                enTodosLosControladores.add(literal.group(1));
            }
        }
        assertThat(cubiertos)
                .as(
                        "estos ordenes por omision no se comprobaron contra ninguna lista blanca:"
                                + " falta declarar su listado en ORDEN_DE_CADA_LISTADO")
                .isEqualTo(enTodosLosControladores);
    }

    /** {@code aPaginacion("campo")}: el orden que se usa cuando la peticion no dice ninguno. */
    private static final Pattern POR_OMISION = Pattern.compile("aPaginacion\\(\"([^\"]+)\"\\)");

    /**
     * El cuerpo del metodo {@code nombre}, aislado del resto del archivo cerrando llaves.
     *
     * <p>Se busca {@code nombre(} cuyo parentesis de cierre lleve detras —tras los espacios— una
     * llave de apertura: eso descarta las llamadas, como {@code catalogo.modulos(…)}, y las
     * referencias de javadoc, que son lo unico que se parece a una declaracion.
     *
     * @return el cuerpo, o {@code null} si no se encontro la declaracion
     */
    private static @Nullable String cuerpoDe(String fuente, String nombre) {
        Matcher candidato =
                Pattern.compile("\\b" + Pattern.quote(nombre) + "\\s*\\(").matcher(fuente);
        while (candidato.find()) {
            int cierre = cerrar(fuente, candidato.end() - 1, '(', ')');
            if (cierre < 0) {
                continue;
            }
            int siguiente = cierre + 1;
            while (siguiente < fuente.length()
                    && Character.isWhitespace(fuente.charAt(siguiente))) {
                siguiente++;
            }
            if (siguiente < fuente.length() && fuente.charAt(siguiente) == '{') {
                int fin = cerrar(fuente, siguiente, '{', '}');
                if (fin > 0) {
                    return fuente.substring(siguiente, fin + 1);
                }
            }
        }
        return null;
    }

    /** El indice del delimitador que cierra el que esta en {@code desde}, o -1. */
    private static int cerrar(String texto, int desde, char abre, char cierra) {
        int nivel = 0;
        for (int i = desde; i < texto.length(); i++) {
            char caracter = texto.charAt(i);
            if (caracter == abre) {
                nivel++;
            } else if (caracter == cierra) {
                nivel--;
                if (nivel == 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    @Test
    @DisplayName("ningun parametro exigido en el cuerpo se queda sin declarar, ni al reves")
    void ningunParametroExigidoEnElCuerpoSeQuedaSinDeclarar() throws IOException {
        Map<Class<?>, Set<String>> declaradosPorClase = new LinkedHashMap<>();

        // Se recorren TODOS los controladores, no solo los que declaran algo: si el recorrido
        // partiera de las declaraciones —hoy vacias— no se miraria ninguno, y un controlador que
        // exigiera un parametro en su cuerpo pasaria en verde.
        for (Map.Entry<String, Method> endpoint : EndpointsPublicados.porOperacion().entrySet()) {
            Set<String> declarados =
                    declaradosPorClase.computeIfAbsent(
                            endpoint.getValue().getDeclaringClass(), c -> new TreeSet<>());
            ALGUNO_DE_ESTOS.getOrDefault(endpoint.getKey(), List.of()).forEach(declarados::addAll);
            declarados.addAll(CONDICIONALES.getOrDefault(endpoint.getKey(), List.of()));
            declarados.addAll(EXIGIDOS_EN_EL_CUERPO.getOrDefault(endpoint.getKey(), List.of()));
        }

        List<String> sinDeclarar = new ArrayList<>();
        List<String> rancios = new ArrayList<>();
        int fuentesLeidas = 0;
        for (Map.Entry<Class<?>, Set<String>> clase : declaradosPorClase.entrySet()) {
            Path fuente = fuenteDe(clase.getKey());
            if (fuente == null) {
                continue;
            }
            fuentesLeidas++;
            Set<String> enElFuente =
                    exigidosEnElTexto(Files.readString(fuente, StandardCharsets.UTF_8));
            for (String nombre : enElFuente) {
                if (!clase.getValue().contains(nombre)) {
                    sinDeclarar.add(clase.getKey().getSimpleName() + " exige «" + nombre + "»");
                }
            }
            for (String nombre : clase.getValue()) {
                if (!enElFuente.contains(nombre)) {
                    rancios.add(
                            clase.getKey().getSimpleName()
                                    + " ya no exige «"
                                    + nombre
                                    + "» en su fuente");
                }
            }
        }

        assertThat(fuentesLeidas)
                .as(
                        "no se leyo el fuente de todos los controladores: esta guarda estaria"
                                + " comparando contra lo que no miro")
                .isEqualTo(declaradosPorClase.size());
        assertThat(sinDeclarar)
                .as(
                        "un controlador exige un parametro en el cuerpo de su metodo y «%s» no lo"
                                + " dice. La interfaz lo pediria sin el y el backend contestaria un"
                                + " 422 que nada anuncio. Se declara en ALGUNO_DE_ESTOS, CONDICIONALES"
                                + " o EXIGIDOS_EN_EL_CUERPO.",
                        ARCHIVO)
                .isEmpty();
        assertThat(rancios)
                .as("esto se declara exigido y su controlador ya no lo exige: quita la linea")
                .isEmpty();
    }

    @Test
    @DisplayName("y el escaner del fuente encuentra de verdad, las dos formas del mismo filtro")
    void elEscanerEncuentra() {
        // Hoy ningun controlador de este backend exige nada asi, de modo que la guarda de arriba
        // no puede demostrar sobre el codigo real que ve algo. Se demuestra sobre una muestra con
        // la
        // forma exacta que escribe `rentas` —cadena partida por el formateador y alias detras—:
        // si el patron dejara de casar, esto sale rojo y la guarda de arriba no mediria nada.
        String muestra =
                "throw new ProblemaDeNegocio(CodigoDeError.VALIDACION, \"Hay que decir de quien son"
                        + " los predios: falta\"\n + \" «codContribuyente» (o su otro nombre,"
                        + " «contribuyente»)\");";
        assertThat(exigidosEnElTexto(muestra))
                .containsExactlyInAnyOrder("codContribuyente", "contribuyente");
    }

    @Test
    @DisplayName("el recorrido de la consulta excluye ruta, cuerpo y cabecera")
    void elRecorridoExcluyeRutaCuerpoYCabecera() throws NoSuchMethodException {
        // La escritura de #59 llevara los tres, y ninguno viaja en la URL: `{id}` es la ruta, la
        // observacion va en el cuerpo JSON y la clave de idempotencia en una cabecera. Contarlos
        // como de consulta publicaria `observacion` como parametro, y una pantalla que la mandara
        // en la URL recibiria el 422 de GuardiaDeParametros.
        Method escritura =
                ControladorDeMuestra.class.getDeclaredMethod(
                        "escribir",
                        long.class,
                        ControladorDeMuestra.CuerpoDeMuestra.class,
                        String.class,
                        String.class,
                        ParametrosDePaginacion.class);

        assertThat(todosLosDeConsulta(escritura))
                .containsExactlyInAnyOrder("ambito", "direccion", "ordenarPor", "pagina", "tamano");
        assertThat(obligatoriosDeLaFirma(escritura)).containsExactly("ambito");
    }

    // ------------------------------------------------------------------

    /** Un controlador que no se publica: solo existe para ejercer el recorrido. */
    static final class ControladorDeMuestra {

        /** El cuerpo de una escritura, con el campo que NO puede salir como parametro. */
        record CuerpoDeMuestra(String observacion) {}

        @PostMapping("/muestras/{id}")
        void escribir(
                @PathVariable long id,
                @RequestBody CuerpoDeMuestra cuerpo,
                @RequestHeader("Idempotency-Key") String claveDeIdempotencia,
                @RequestParam String ambito,
                ParametrosDePaginacion paginacion) {
            throw new UnsupportedOperationException("Solo se lee su firma");
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Object> listaDe(
            Map<String, Map<String, Object>> parametros, String operacion, String clave) {
        Map<String, Object> declarado = parametros.get(operacion);
        assertThat(declarado).as("«%s» no esta publicada", operacion).isNotNull();
        return (List<Object>) declarado.get(clave);
    }

    private static Map<String, Map<String, Object>> parametrosPorOperacion() {
        Map<String, Map<String, Object>> porOperacion = new TreeMap<>();
        for (Map.Entry<String, Method> endpoint : EndpointsPublicados.porOperacion().entrySet()) {
            Method metodo = endpoint.getValue();
            Set<String> obligatorios = obligatoriosDeLaFirma(metodo);
            List<List<String>> grupos = ALGUNO_DE_ESTOS.getOrDefault(endpoint.getKey(), List.of());
            List<String> condicionales = CONDICIONALES.getOrDefault(endpoint.getKey(), List.of());

            Set<String> opcionales = new TreeSet<>(todosLosDeConsulta(metodo));
            opcionales.removeAll(obligatorios);
            grupos.forEach(opcionales::removeAll);
            condicionales.forEach(opcionales::remove);

            Map<String, Object> declarado = new LinkedHashMap<>();
            declarado.put("obligatorios", new ArrayList<>(obligatorios));
            declarado.put("algunoDeEstos", grupos);
            declarado.put("condicionales", new ArrayList<>(new TreeSet<>(condicionales)));
            declarado.put("opcionales", new ArrayList<>(opcionales));
            declarado.put(
                    "enElCuerpo",
                    new ArrayList<>(
                            new TreeSet<>(
                                    EXIGIDOS_EN_EL_CUERPO.getOrDefault(
                                            endpoint.getKey(), List.of()))));
            OrigenDelOrden orden = ORDEN_DE_CADA_LISTADO.get(endpoint.getKey());
            if (orden != null) {
                declarado.put("ordenarPorAdmitidos", new ArrayList<>(camposAdmitidos(orden)));
                declarado.put("tamanoMaximo", Paginacion.TAMANO_MAXIMO);
            }
            porOperacion.put(endpoint.getKey(), declarado);
        }
        return porOperacion;
    }

    /** La lista blanca real, leida del campo estatico del repositorio. Ordenada. */
    private static Set<String> camposAdmitidos(OrigenDelOrden origen) {
        try {
            Field campo = origen.repositorio().getDeclaredField(origen.campo());
            if (!Modifier.isStatic(campo.getModifiers())) {
                throw new IllegalStateException(
                        origen.repositorio().getSimpleName()
                                + "."
                                + origen.campo()
                                + " no es estatico: la lista blanca de un listado es una constante");
            }
            campo.setAccessible(true);
            if (!(campo.get(null) instanceof OrdenSeguro orden)) {
                throw new IllegalStateException(
                        origen.repositorio().getSimpleName()
                                + "."
                                + origen.campo()
                                + " no es un OrdenSeguro");
            }
            return new TreeSet<>(orden.camposAdmitidos());
        } catch (NoSuchFieldException | IllegalAccessException noSePuedeLeer) {
            throw new IllegalStateException(
                    "No se pudo leer "
                            + origen.repositorio().getSimpleName()
                            + "."
                            + origen.campo()
                            + ": si se renombro, ORDEN_DE_CADA_LISTADO tiene que decir el nombre"
                            + " nuevo",
                    noSePuedeLeer);
        }
    }

    private static boolean pagina(Method metodo) {
        for (Parameter parametro : metodo.getParameters()) {
            if (ParametrosDePaginacion.class.equals(parametro.getType())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Los que la FIRMA declara obligatorios: {@code required = true} y sin {@code defaultValue}.
     *
     * <p>Un {@code defaultValue} hace opcional el parametro aunque {@code required} siga en cierto
     * —lo dice Spring y lo hace—, asi que mirar solo {@code required()} declararia obligatorio lo
     * que no lo es.
     */
    private static Set<String> obligatoriosDeLaFirma(Method metodo) {
        Set<String> nombres = new TreeSet<>();
        for (Parameter parametro : metodo.getParameters()) {
            RequestParam anotacion =
                    AnnotatedElementUtils.findMergedAnnotation(parametro, RequestParam.class);
            if (anotacion == null
                    || !anotacion.required()
                    || !ValueConstants.DEFAULT_NONE.equals(anotacion.defaultValue())) {
                continue;
            }
            nombres.add(nombreDe(anotacion, parametro));
        }
        RequestMapping mapeo =
                AnnotatedElementUtils.findMergedAnnotation(metodo, RequestMapping.class);
        if (mapeo != null) {
            // `params = "formato"` en el mapeo tambien es un parametro que el endpoint exige:
            // sin el, Spring enruta al OTRO metodo.
            for (String condicion : mapeo.params()) {
                nombres.add(condicion.split("[=!]", 2)[0].trim());
            }
        }
        return nombres;
    }

    /** Todos los de consulta que el endpoint puede leer, obligatorios incluidos. */
    private static Set<String> todosLosDeConsulta(Method metodo) {
        Set<String> nombres = new TreeSet<>();
        for (Parameter parametro : metodo.getParameters()) {
            if (AnnotatedElementUtils.hasAnnotation(parametro, PathVariable.class)
                    || AnnotatedElementUtils.hasAnnotation(parametro, RequestBody.class)
                    || AnnotatedElementUtils.hasAnnotation(parametro, RequestHeader.class)) {
                continue;
            }
            RequestParam anotacion =
                    AnnotatedElementUtils.findMergedAnnotation(parametro, RequestParam.class);
            if (anotacion != null) {
                nombres.add(nombreDe(anotacion, parametro));
                continue;
            }
            // Sin anotacion, Spring enlaza por nombre los tipos simples; los compuestos —la
            // paginacion— los compone campo a campo, y esos campos tambien viajan en la URL.
            if (parametro.getType().isRecord()) {
                for (var componente : parametro.getType().getRecordComponents()) {
                    nombres.add(componente.getName());
                }
            } else if (esSimple(parametro.getType())) {
                nombres.add(parametro.getName());
            }
        }
        return nombres;
    }

    private static String nombreDe(RequestParam anotacion, Parameter parametro) {
        String declarado = anotacion.name().isEmpty() ? anotacion.value() : anotacion.name();
        return declarado.isEmpty() ? parametro.getName() : declarado;
    }

    private static boolean esSimple(Class<?> tipo) {
        return tipo.isPrimitive()
                || tipo.isEnum()
                || CharSequence.class.isAssignableFrom(tipo)
                || Number.class.isAssignableFrom(tipo)
                || Boolean.class.equals(tipo)
                || Character.class.equals(tipo)
                || java.time.temporal.Temporal.class.isAssignableFrom(tipo)
                || java.util.Optional.class.equals(tipo);
    }

    // ------------------------------------------------------------------

    /**
     * «… falta «codContribuyente» (o su otro nombre, «contribuyente»)», que es como los
     * controladores de {@code rentas} escriben la exigencia, y como la escribiran los de aqui.
     *
     * <p>Ceñido a {@code falta} pegado al nombre: escrito mas ancho, {@code rentas} encontraba
     * nueve falsos en prosa de javadoc (#437).
     */
    private static final Pattern EXIGENCIA =
            Pattern.compile("falta\\s+«([A-Za-z][A-Za-z0-9]*)»([^;]{0,120})");

    /** Los otros nombres del mismo filtro, dentro del mismo mensaje. */
    private static final Pattern OTRO_NOMBRE = Pattern.compile("«([A-Za-z][A-Za-z0-9]*)»");

    private static Set<String> exigidosEnElTexto(String fuente) {
        // Las cadenas partidas por el formateador se vuelven a juntar antes de mirar.
        String texto = fuente.replaceAll("\"\\s*\\+\\s*\"", "");
        Set<String> nombres = new TreeSet<>();
        Matcher encontrado = EXIGENCIA.matcher(texto);
        while (encontrado.find()) {
            nombres.add(encontrado.group(1));
            Matcher otro = OTRO_NOMBRE.matcher(encontrado.group(2));
            while (otro.find()) {
                nombres.add(otro.group(1));
            }
        }
        return nombres;
    }

    /** El `.java` de esa clase dentro de `backend/<modulo>/src/main/java/…`, o nulo. */
    private static Path fuenteDe(Class<?> clase) throws IOException {
        Path modulos = RaizDelRepositorio.ruta().resolve("backend");
        String relativa = clase.getName().replace('.', '/').replaceAll("\\$.*", "") + ".java";
        try (var modulo = Files.list(modulos)) {
            for (Path candidato :
                    modulo.map(m -> m.resolve("src/main/java").resolve(relativa)).toList()) {
                if (Files.isRegularFile(candidato)) {
                    return candidato;
                }
            }
        }
        return null;
    }

    /** JSON estable: operaciones ordenadas, y dentro de cada una sus listas en orden fijo. */
    private static String comoJson(Map<String, Map<String, Object>> parametros) {
        StringBuilder json = new StringBuilder("{\n");
        json.append("  \"_\": ").append(entrecomillado(PROCEDENCIA));
        json.append(parametros.isEmpty() ? "\n" : ",\n");
        int quedan = parametros.size();
        for (Map.Entry<String, Map<String, Object>> operacion : parametros.entrySet()) {
            json.append("  ").append(entrecomillado(operacion.getKey())).append(": {\n");
            int campos = operacion.getValue().size();
            for (Map.Entry<String, Object> campo : operacion.getValue().entrySet()) {
                json.append("    ").append(entrecomillado(campo.getKey())).append(": ");
                if (campo.getValue() instanceof Integer entero) {
                    json.append(entero);
                } else {
                    escribirLista(json, campo.getValue());
                }
                json.append(--campos == 0 ? "" : ",").append('\n');
            }
            json.append("  }").append(--quedan == 0 ? "" : ",").append('\n');
        }
        return json.append("}\n").toString();
    }

    private static void escribirLista(StringBuilder json, Object valor) {
        List<?> lista = (List<?>) valor;
        json.append('[');
        for (int i = 0; i < lista.size(); i++) {
            json.append(i == 0 ? "" : ", ");
            Object elemento = lista.get(i);
            if (elemento instanceof List<?> grupo) {
                escribirLista(json, grupo);
            } else {
                json.append(entrecomillado(String.valueOf(elemento)));
            }
        }
        json.append(']');
    }

    private static String entrecomillado(String texto) {
        return '"' + texto.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
    }
}
