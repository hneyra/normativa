package kamayuk.normativa.verificaciones;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.reflect.GenericArrayType;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.lang.reflect.WildcardType;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import kamayuk.comun.verificaciones.contrato.EndpointsPublicados;
import kamayuk.comun.verificaciones.contrato.FormaDeLaRespuesta;
import kamayuk.normativa.dominio.ValorNormativo;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto;
import kamayuk.normativa.parametros.infraestructura.web.ParametrosController;
import kamayuk.normativa.parametros.infraestructura.web.SnapshotController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/**
 * Lo que devuelve cada operacion, campo a campo, derivado de los controladores (#49).
 *
 * <h2>Para que sirve</h2>
 *
 * <p>La interfaz que sustituye a la V6 (epica #47) es la de {@code rentas}, y esa interfaz no
 * adivina que devuelve cada ruta: lo lee de {@code docs/50-api/formas-de-la-api.json} y sus guardas
 * comparan contra el. Hasta este issue {@code normativa} no lo tenia, y la V6 copiaba las formas a
 * mano. Aqui los campos salen de los {@code record} del backend, con el resolutor compartido de
 * {@code comun-verificaciones} —el mismo que usan los contratos con {@code rentas} y {@code
 * catastro}—, y <b>sin copia local</b>: dos resolutores de «que forma tiene este JSON» acabarian
 * discrepando justo en el caso raro.
 *
 * <h2>Por que un archivo comprometido y no una comparacion en memoria</h2>
 *
 * <p>Porque los dos lados son dos lenguajes y dos builds: el frontend no puede leer los {@code
 * record} de Java. El archivo es la frontera y <b>no se edita a mano</b>: esta prueba exige que
 * siga siendo lo que producen los controladores. Un {@code Resource} con un campo nuevo y este
 * archivo sin regenerar es rojo aqui, no un desajuste que aparece en integracion. Y el archivo es
 * entrada declarada de {@code tasks.test} en {@code build.gradle.kts}: sin eso, una edicion a mano
 * deja la tarea {@code UP-TO-DATE} y pasa en verde sin haber comparado nada (#192 punto 2).
 *
 * <h2>El snapshot no se publica como «texto»</h2>
 *
 * <p>{@code GET /conjuntos/{id}/snapshot} devuelve {@code ResponseEntity<String>}: el {@code ETag}
 * es el {@code sha256} de los bytes, y hay que serializar a mano para tenerlos. Leida del tipo de
 * retorno, su forma seria la hoja {@code "texto"}, y la respuesta con mas campos del sistema
 * saldria publicada sin ninguno. Se publica la forma de {@code SnapshotResource}, declarada en
 * {@link RespuestasEscritasAMano}; {@link #lasRespuestasEscritasAManoSonLegitimas()} impide que la
 * declaracion se quede rancia o tape una forma real.
 *
 * <h2>{@code ValorNormativo} nunca sale como numero: la rama decidida del punto 6</h2>
 *
 * <p>{@code ConfiguracionDeJson} serializa como cadena {@code Dinero}, {@code Alicuota}, {@code
 * Porcentaje} y {@code AreaM2}, y <b>no</b> {@code ValorNormativo}: un recurso que lo llevara
 * emitiria {@code {"valor": 5350.000000}}, un numero JSON, que es lo que la regla 1 y RNF-055
 * prohiben en el transporte. Habia dos salidas y <b>se toma la segunda</b>:
 *
 * <ul>
 *   <li>registrarlo con {@code writeString} en {@code ConfiguracionDeJson}. Arregla el JSON pero
 *       <b>no la forma publicada</b>: {@code FormaDeLaRespuesta.COMO_CADENA} es compartida y no lo
 *       nombra, asi que este archivo diria {@code {valor: numero}} de un campo que el backend emite
 *       como cadena — el defecto exacto que {@link FormaSegunJacksonTest} existe para cazar.
 *       Cerrarlo exige un PR a {@code infrastructure} que toca los cinco builds, y ningun recurso
 *       de hoy lo necesita.
 *   <li><b>prohibirlo en cualquier componente de un recurso publicado</b>, y que los recursos
 *       lleven {@code String}, como ya hace el snapshot ({@code
 *       ParametroDelSnapshot.valorNumerico}). Es {@link
 *       #ningunRecursoPublicadoLlevaUnValorNormativo()}.
 * </ul>
 *
 * <p>La premisa de la decision —que hoy saldria como numero— la fija {@link
 * FormaSegunJacksonTest#unValorNormativoSaldriaComoNumero()}: el dia que alguien lo registre como
 * cadena, esa prueba se pone roja y dice que la otra rama ya es posible.
 *
 * <pre>
 * ./gradlew :kamayuk-normativa-aplicacion:test --tests '*FormasDeLaApiTest*' --tests '*ParametrosDeLaApiTest*' -Dkamayuk.formas.regenerar=true
 * </pre>
 */
@DisplayName("Formas de la API (docs/50-api)")
class FormasDeLaApiTest {

    /** Con esto puesto, la prueba reescribe el archivo en vez de compararlo. */
    private static final String REGENERAR = "kamayuk.formas.regenerar";

    /**
     * La primera clave del archivo dice de donde sale.
     *
     * <p>Va como una clave mas y no como un comentario porque JSON no tiene comentarios, y el
     * frontend lo lee con {@code JSON.parse}: un archivo que hay que limpiar antes de leerlo es un
     * archivo que alguien acabara leyendo mal.
     */
    private static final String PROCEDENCIA =
            "ARCHIVO GENERADO — no editar a mano. Lo produce FormasDeLaApiTest del tipo de retorno"
                    + " de cada controlador —o, si serializa a mano, del tipo que declara"
                    + " RespuestasEscritasAMano—; se regenera con -Dkamayuk.formas.regenerar=true. Es"
                    + " la forma del JSON que devuelve cada operacion —nombres de campo y"
                    + " anidamiento, con los tipos reducidos a hojas—, y la lee la interfaz para"
                    + " comprobar que lo que pinta es lo que el backend publica (#49, epica #47).";

    private static final String ARCHIVO = "docs/50-api/formas-de-la-api.json";

    @Test
    @DisplayName("el archivo de formas es el que producen los controladores de hoy")
    void lasFormasSonLasDelArchivo() throws IOException {
        Map<String, Object> formas = formasPorOperacion();

        assertThat(formas)
                .as("sin endpoints publicados no hay ninguna forma que comparar")
                .isNotEmpty();

        String producido = comoJson(formas);
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
                        "las formas publicadas y «%s» no cuadran. Si cambiaste un Resource,"
                                + " regenera con -D%s=true; si no, alguien edito el archivo a mano.",
                        ARCHIVO, REGENERAR)
                .isEqualTo(producido);
    }

    @Test
    @DisplayName("el sobre paginado se resuelve hasta el ConjuntoResource que lleva dentro")
    void elSobrePaginadoSeResuelve() {
        // La prueba de arriba compararia dos archivos identicos aunque el resolutor devolviera
        // «objeto» para todo. Esta mira una forma concreta y conocida: sin resolver la variable
        // de tipo de `RespuestaPaginada<T>`, `contenido` seria una lista de «objeto» y esto se
        // pone rojo.
        Map<String, Object> sobre = objeto(formasPorOperacion().get("GET /seguridad/parametros"));
        assertThat(sobre).containsKeys("contenido", "pagina", "tamano", "totalElementos");

        Object contenido = sobre.get("contenido");
        assertThat(contenido).isInstanceOf(List.class);
        Map<String, Object> conjunto = objeto(((List<?>) contenido).get(0));
        assertThat(conjunto).containsKeys("id", "ejercicio", "version", "estado");
    }

    @Test
    @DisplayName("el snapshot se publica con la forma de SnapshotResource, no como «texto»")
    void elSnapshotNoSePublicaComoTexto() {
        // El contraste de la declaracion: sin ella, la clave del snapshot valdria «texto» y la
        // comparacion de archivos pasaria igual de verde.
        Object snapshot = formasPorOperacion().get("GET /conjuntos/{id}/snapshot");
        assertThat(snapshot)
                .as("el snapshot se serializa a mano, y lo publicado tiene que ser lo que escribe")
                .isNotEqualTo(FormaDeLaRespuesta.TEXTO);

        Map<String, Object> cuerpo = objeto(snapshot);
        assertThat(cuerpo)
                .containsKeys(
                        "conjuntoId",
                        "ambito",
                        "parametros",
                        "valoresUnitarios",
                        "depreciaciones",
                        "valoresReferenciales");
        Map<String, Object> parametro = objeto(((List<?>) cuerpo.get("parametros")).get(0));
        assertThat(parametro.get("valorNumerico"))
                .as("el snapshot lleva la cifra como cadena (SnapshotDelConjunto.java)")
                .isEqualTo(FormaDeLaRespuesta.TEXTO);
    }

    @Test
    @DisplayName("lo declarado como escrito a mano devuelve ResponseEntity<String>, y viceversa")
    void lasRespuestasEscritasAManoSonLegitimas() {
        Map<String, Method> publicadas = EndpointsPublicados.porOperacion();

        for (Map.Entry<String, Class<?>> declarada :
                RespuestasEscritasAMano.DE_ESTE_BACKEND.entrySet()) {
            Method metodo = publicadas.get(declarada.getKey());
            assertThat(metodo)
                    .as("«%s» no es una operacion de este backend", declarada.getKey())
                    .isNotNull();
            assertThat(devuelveTextoEnUnSobre(metodo))
                    .as(
                            "«%s» se declara serializada a mano y ya no devuelve"
                                    + " ResponseEntity<String> sino «%s»: la declaracion sustituiria"
                                    + " la forma real por la de %s, y el archivo publicaria algo que"
                                    + " el backend no manda. Quitala de RespuestasEscritasAMano.",
                            declarada.getKey(),
                            metodo.getGenericReturnType().getTypeName(),
                            declarada.getValue().getSimpleName())
                    .isTrue();
        }

        // Y al reves: una operacion nueva que serialice a mano y no se declare saldria publicada
        // como «texto», sin un solo campo que la interfaz pudiera comparar.
        List<String> sinDeclarar = new ArrayList<>();
        for (Map.Entry<String, Method> publicada : publicadas.entrySet()) {
            if (FormaDeLaRespuesta.TEXTO.equals(FormaDeLaRespuesta.de(publicada.getValue()))
                    && !RespuestasEscritasAMano.DE_ESTE_BACKEND.containsKey(publicada.getKey())) {
                sinDeclarar.add(publicada.getKey());
            }
        }
        assertThat(sinDeclarar)
                .as(
                        "estas operaciones devuelven texto y no declaran que tipo escriben: en «%s»"
                                + " saldrian como la hoja «texto». Declaralas en"
                                + " RespuestasEscritasAMano con el record que serializan.",
                        ARCHIVO)
                .isEmpty();
    }

    @Test
    @DisplayName("ningun recurso publicado lleva un ValorNormativo, que saldria como numero JSON")
    void ningunRecursoPublicadoLlevaUnValorNormativo() {
        Set<Class<?>> visitados = new LinkedHashSet<>();
        List<String> hallazgos = new ArrayList<>();

        for (Map.Entry<String, Method> publicada : EndpointsPublicados.porOperacion().entrySet()) {
            Class<?> aMano = RespuestasEscritasAMano.DE_ESTE_BACKEND.get(publicada.getKey());
            Type raiz = aMano == null ? publicada.getValue().getGenericReturnType() : aMano;
            recorrer(raiz, publicada.getKey(), new LinkedHashSet<>(), visitados, hallazgos);
        }

        // El contraste: un recorrido que no bajara por los genericos ni por las listas no
        // encontraria nada y pasaria en verde. Estos tres solo se alcanzan bajando: el primero es
        // el argumento de `RespuestaPaginada<T>`, el segundo va dentro de una `List` de un tipo
        // escrito a mano, y el tercero es un retorno directo.
        assertThat(visitados)
                .as("el recorrido no baja hasta los recursos: su verde no mediria nada")
                .contains(
                        ParametrosController.ConjuntoResource.class,
                        SnapshotDelConjunto.ParametroDelSnapshot.class,
                        SnapshotController.ConjuntoVigenteResource.class);

        assertThat(hallazgos)
                .as(
                        "un recurso publicado lleva un ValorNormativo. ConfiguracionDeJson no lo"
                                + " serializa como cadena, asi que saldria como {\"valor\": 5350.000000},"
                                + " un numero JSON que el navegador redondea (regla 1, RNF-055). El"
                                + " recurso lleva String, como ParametroDelSnapshot.valorNumerico; ver"
                                + " el javadoc de FormasDeLaApiTest, punto 6 de #49.")
                .isEmpty();
    }

    // ------------------------------------------------------------------

    /** La forma de cada operacion: la del tipo de retorno o, si serializa a mano, la declarada. */
    static Map<String, Object> formasPorOperacion() {
        Map<String, Object> formas = new TreeMap<>();
        for (Map.Entry<String, Method> endpoint : EndpointsPublicados.porOperacion().entrySet()) {
            Class<?> aMano = RespuestasEscritasAMano.DE_ESTE_BACKEND.get(endpoint.getKey());
            formas.put(
                    endpoint.getKey(),
                    aMano == null
                            ? FormaDeLaRespuesta.de(endpoint.getValue())
                            : FormaDeLaRespuesta.deTipo(aMano));
        }
        return formas;
    }

    private static boolean devuelveTextoEnUnSobre(Method metodo) {
        return metodo.getGenericReturnType() instanceof ParameterizedType tipo
                && ResponseEntity.class.equals(tipo.getRawType())
                && tipo.getActualTypeArguments().length == 1
                && String.class.equals(tipo.getActualTypeArguments()[0]);
    }

    /**
     * Baja por el tipo entero —argumentos genericos, listas, arreglos y componentes de record— y
     * anota cada sitio donde aparece un {@link ValorNormativo}.
     *
     * <p>Una variable de tipo no se sigue: su valor real es el argumento del tipo parametrizado que
     * la declara, y ese argumento se recorre ahi.
     */
    private static void recorrer(
            Type tipo,
            String camino,
            Set<Class<?>> enCurso,
            Set<Class<?>> visitados,
            List<String> hallazgos) {
        switch (tipo) {
            case ParameterizedType parametrizado -> {
                recorrer(parametrizado.getRawType(), camino, enCurso, visitados, hallazgos);
                for (Type argumento : parametrizado.getActualTypeArguments()) {
                    recorrer(
                            argumento,
                            camino + "<" + argumento.getTypeName() + ">",
                            enCurso,
                            visitados,
                            hallazgos);
                }
            }
            case WildcardType comodin -> {
                for (Type superior : comodin.getUpperBounds()) {
                    recorrer(superior, camino, enCurso, visitados, hallazgos);
                }
            }
            case GenericArrayType arreglo ->
                    recorrer(
                            arreglo.getGenericComponentType(),
                            camino + "[]",
                            enCurso,
                            visitados,
                            hallazgos);
            case Class<?> clase when clase.isArray() ->
                    recorrer(
                            clase.getComponentType(), camino + "[]", enCurso, visitados, hallazgos);
            case Class<?> clase when ValorNormativo.class.equals(clase) ->
                    hallazgos.add(camino + " es un ValorNormativo");
            case Class<?> clase when clase.isRecord() && !enCurso.contains(clase) -> {
                visitados.add(clase);
                Set<Class<?>> siguiente = new LinkedHashSet<>(enCurso);
                siguiente.add(clase);
                for (RecordComponent componente : clase.getRecordComponents()) {
                    recorrer(
                            componente.getGenericType(),
                            camino + " → " + clase.getSimpleName() + "." + componente.getName(),
                            siguiente,
                            visitados,
                            hallazgos);
                }
            }
            default -> {
                // Una hoja, una variable de tipo o un record que ya se esta recorriendo.
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> objeto(Object forma) {
        assertThat(forma)
                .as("se esperaba un objeto y la forma es «%s»", forma)
                .isInstanceOf(Map.class);
        return (Map<String, Object>) forma;
    }

    /** JSON estable: rutas ordenadas, campos en el orden en que los declara su record. */
    private static String comoJson(Map<String, Object> formas) {
        StringBuilder json = new StringBuilder("{\n");
        json.append("  ")
                .append(entrecomillado("_"))
                .append(": ")
                .append(entrecomillado(PROCEDENCIA));
        json.append(formas.isEmpty() ? "\n" : ",\n");
        int quedan = formas.size();
        for (Map.Entry<String, Object> forma : formas.entrySet()) {
            json.append("  ").append(entrecomillado(forma.getKey())).append(": ");
            escribir(json, forma.getValue(), 1);
            json.append(--quedan == 0 ? "" : ",").append('\n');
        }
        return json.append("}\n").toString();
    }

    private static void escribir(StringBuilder json, Object valor, int nivel) {
        String sangria = "  ".repeat(nivel);
        switch (valor) {
            case Map<?, ?> objeto when objeto.isEmpty() -> json.append("{}");
            case Map<?, ?> objeto -> {
                json.append("{\n");
                int quedan = objeto.size();
                for (Map.Entry<?, ?> campo : objeto.entrySet()) {
                    json.append(sangria)
                            .append("  ")
                            .append(entrecomillado(String.valueOf(campo.getKey())));
                    json.append(": ");
                    escribir(json, campo.getValue(), nivel + 1);
                    json.append(--quedan == 0 ? "" : ",").append('\n');
                }
                json.append(sangria).append('}');
            }
            case List<?> lista -> {
                json.append("[\n").append(sangria).append("  ");
                escribir(json, lista.isEmpty() ? "objeto" : lista.get(0), nivel + 1);
                json.append('\n').append(sangria).append(']');
            }
            default -> json.append(entrecomillado(String.valueOf(valor)));
        }
    }

    private static String entrecomillado(String texto) {
        return '"' + texto.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
    }
}
