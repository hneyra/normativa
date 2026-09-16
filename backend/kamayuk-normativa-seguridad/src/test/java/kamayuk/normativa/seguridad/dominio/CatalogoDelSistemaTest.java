package kamayuk.normativa.seguridad.dominio;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * El catalogo de este sistema es <b>exactamente</b> lo que sus endpoints exigen.
 *
 * <p>{@link CatalogoDelSistema} es una lista escrita, y una lista escrita se desincroniza. Lo que
 * la ata a la realidad es esta prueba: recorre {@code src/main} de todo el repositorio, junta los
 * valores de {@code @RequiereAcceso(acceso = "...")} —y los de {@code oTambien}— y exige que sean
 * los mismos codigos.
 *
 * <p>Los dos sentidos importan, y por motivos distintos:
 *
 * <ul>
 *   <li><b>Un acceso que el catalogo no tiene</b> es una pantalla a la que nadie puede dar permiso
 *       —el guardia niega lo que no encuentra en {@code acceso}—, que es el defecto que RF-122
 *       existe para impedir.
 *   <li><b>Un acceso que sobra</b> es una fila que la implantacion siembra y un permiso que se
 *       otorga sobre algo que no existe: ruido en la pantalla de permisos y una promesa falsa.
 * </ul>
 *
 * <h2>{@code oTambien} cuenta, desde #53</h2>
 *
 * <p>Una opcion declarada <b>solo</b> como alternativa sigue siendo una opcion del catalogo: el
 * guardia la consulta igual que la propia, y sin fila en {@code acceso} no autorizaria a nadie. Sin
 * recogerla, ADR-0043 §2 pondria esta prueba roja diciendo que {@code parametros} «sobra» —las
 * cinco lecturas lo declaran como alternativa y ninguna como acceso propio—, y no seria verdad. Se
 * reconocen sus <b>dos formas</b>: {@code oTambien = "x"} y {@code oTambien = {"x", "y"}}.
 *
 * <h2>Lo que el recorrido NO mira, y por que hace falta decirlo</h2>
 *
 * <p>Se podan {@code build/}, {@code .git/}, {@code node_modules/} y <b>{@code .claude/}</b>. El
 * ultimo no es higiene: los worktrees de los agentes cuelgan de {@code .claude/worktrees/} y sus
 * {@code src/main} se contaban. Mientras todos declaraban lo mismo salia verde por coincidencia; un
 * worktree de otra rama a medias —una opcion nueva ya anotada y el catalogo todavia no— pone roja
 * la prueba de {@code main} en esa maquina, por codigo que no esta en este arbol. Es el mismo
 * recorrido que {@code infrastructure} ya poda en su guarda cruzada.
 */
@DisplayName("C-7 — el catalogo de este sistema es el de sus endpoints")
class CatalogoDelSistemaTest {

    /**
     * La anotacion entera, {@code @RequiereAcceso(…)}, con la arroba de verdad.
     *
     * <p>Anclado a la arroba a proposito: el javadoc de la propia anotacion trae un ejemplo escrito
     * con la entidad HTML, y contarlo pondria esta prueba roja por una frase.
     *
     * <p>Se captura el <b>bloque</b> y no solo el primer campo porque {@code oTambien} puede ir
     * antes o despues de {@code acceso}, y porque asi ningun {@code oTambien} suelto de un javadoc
     * —los hay en {@code RequiereAcceso} y en {@code GuardiaDeAcceso}— se cuela: para contar hay
     * que estar dentro de una anotacion. {@code [^()]} basta porque ningun campo de esta anotacion
     * lleva parentesis.
     */
    private static final Pattern ANOTACION = Pattern.compile("@RequiereAcceso\\s*\\(([^()]*)\\)");

    /** El acceso propio. Los centinelas no casan: no van entre comillas. */
    private static final Pattern ACCESO_PROPIO =
            Pattern.compile("\\bacceso\\s*=\\s*\"([a-z0-9_]+)\"");

    /** Las alternativas, en sus dos formas: {@code "x"} y {@code {"x", "y"}}. */
    private static final Pattern ALTERNATIVAS =
            Pattern.compile("\\boTambien\\s*=\\s*(\\{[^}]*\\}|\"[a-z0-9_]+\")");

    private static final Pattern LITERAL = Pattern.compile("\"([a-z0-9_]+)\"");

    @Test
    @DisplayName("los mismos codigos, en los dos sentidos, contando tambien las alternativas")
    void losMismosCodigos() throws IOException {
        Set<String> deLosEndpoints = new TreeSet<>();
        for (Path fuente : fuentesDeProduccion(raizDelRepositorio())) {
            deLosEndpoints.addAll(accesosDe(Files.readString(fuente, StandardCharsets.UTF_8)));
        }

        assertThat(deLosEndpoints)
                .as(
                        "ningun endpoint declara acceso. O el patron dejo de reconocer la anotacion"
                                + " o este repositorio se quedo sin capa web: en los dos casos la"
                                + " comparacion de abajo pasaria sin comprobar nada")
                .isNotEmpty();

        List<String> delCatalogo =
                CatalogoDelSistema.opciones().stream()
                        .map(CatalogoDelSistema.Opcion::codigo)
                        .sorted()
                        .toList();

        assertThat(delCatalogo)
                .as(
                        "el catalogo que siembra la implantacion y los accesos que los endpoints"
                                + " exigen tienen que ser el mismo conjunto. Un acceso sin fila es una"
                                + " pantalla a la que nadie puede dar permiso (RF-122); una fila sin"
                                + " acceso es un permiso sobre algo que no existe")
                .containsExactlyElementsOf(deLosEndpoints);
    }

    @Test
    @DisplayName("y ninguna opcion se declara dos veces")
    void ningunaDosVeces() {
        List<String> codigos =
                CatalogoDelSistema.opciones().stream()
                        .map(CatalogoDelSistema.Opcion::codigo)
                        .toList();
        assertThat(codigos).doesNotHaveDuplicates();
    }

    /**
     * Las dos formas de {@code oTambien} se recogen, y un {@code oTambien} de javadoc no.
     *
     * <p>Se ejerce sobre un texto escrito aqui y no sobre el arbol porque hoy ninguna anotacion usa
     * la forma de llaves: comprobarla contra el arbol seria comprobar que no hay ninguna. El dia
     * que una la use, esto ya dice que se cuenta.
     */
    @Test
    @DisplayName("las dos formas de `oTambien` cuentan, y lo que no esta en la anotacion no")
    void lasDosFormasDeOTambien() {
        assertThat(
                        accesosDe(
                                "@RequiereAcceso(acceso = \"conjuntos\", oTambien = \"parametros\","
                                        + " privilegio = Privilegio.LECTURA)"))
                .containsExactlyInAnyOrder("conjuntos", "parametros");

        assertThat(
                        accesosDe(
                                "@RequiereAcceso(\n  oTambien = {\"uno\", \"dos\"},\n  acceso ="
                                        + " \"propio\",\n  privilegio = Privilegio.LECTURA)"))
                .containsExactlyInAnyOrder("propio", "uno", "dos");

        assertThat(accesosDe("@RequiereAcceso(acceso = RequiereAcceso.SESION_PROPIA)"))
                .as("los centinelas no son opciones del catalogo: no van entre comillas")
                .isEmpty();

        assertThat(accesosDe(" * <p>Cada endpoint que declare oTambien = \"algo\" esta censado."))
                .as("una frase de javadoc no es una anotacion, y no siembra ninguna fila")
                .isEmpty();
    }

    // ------------------------------------------------------------------ el recorrido

    /** Los accesos que un texto declara: el propio y sus alternativas, en sus dos formas. */
    private static Set<String> accesosDe(String fuente) {
        Set<String> declarados = new TreeSet<>();
        Matcher anotaciones = ANOTACION.matcher(fuente);
        while (anotaciones.find()) {
            String campos = anotaciones.group(1);
            Matcher propio = ACCESO_PROPIO.matcher(campos);
            if (propio.find()) {
                declarados.add(propio.group(1));
            }
            Matcher alternativas = ALTERNATIVAS.matcher(campos);
            while (alternativas.find()) {
                Matcher literales = LITERAL.matcher(alternativas.group(1));
                while (literales.find()) {
                    declarados.add(literales.group(1));
                }
            }
        }
        return declarados;
    }

    /**
     * Los {@code .java} de {@code src/main} del arbol, podando lo que no es de este arbol.
     *
     * <p>Se poda <b>al entrar en el directorio</b> y no filtrando rutas al final: {@code
     * .claude/worktrees/} contiene clones enteros y {@code node_modules/} decenas de miles de
     * archivos, y recorrerlos para descartarlos despues cuesta lo mismo que contarlos.
     */
    private static List<Path> fuentesDeProduccion(Path raiz) throws IOException {
        Set<String> podados = Set.of("build", ".git", ".claude", "node_modules");
        List<Path> fuentes = new ArrayList<>();
        Files.walkFileTree(
                raiz,
                new SimpleFileVisitor<Path>() {
                    @Override
                    public FileVisitResult preVisitDirectory(
                            Path dir, BasicFileAttributes atributos) throws IOException {
                        Path nombre = dir.getFileName();
                        return nombre != null && podados.contains(nombre.toString())
                                ? FileVisitResult.SKIP_SUBTREE
                                : super.preVisitDirectory(dir, atributos);
                    }

                    @Override
                    public FileVisitResult visitFile(Path archivo, BasicFileAttributes atributos) {
                        String ruta = archivo.toString();
                        if (ruta.endsWith(".java") && ruta.contains("/src/main/")) {
                            fuentes.add(archivo);
                        }
                        return FileVisitResult.CONTINUE;
                    }
                });
        return fuentes;
    }

    /**
     * La raiz del clon, subiendo hasta encontrar {@code .git}.
     *
     * <p><b>{@code Files.exists} y no {@code Files.isDirectory}</b>: en un {@code git worktree} el
     * {@code .git} de la raiz es un <b>archivo</b> con una linea {@code gitdir:} dentro, asi que
     * con {@code isDirectory} el recorrido sube hasta {@code /} y esta prueba muere sin poder
     * hablar de lo que vigila. No es un rojo util —es «no se pudo comprobar», que es peor que un
     * rojo porque deja el build inejecutable—, y es el mismo defecto que {@code catastro} cerro en
     * sus dos ayudantes al medir la linea base de su #5.
     */
    private static Path raizDelRepositorio() {
        Path candidato = Path.of("").toAbsolutePath();
        while (candidato != null && !Files.exists(candidato.resolve(".git"))) {
            candidato = candidato.getParent();
        }
        if (candidato == null) {
            throw new IllegalStateException(
                    "No se encontro la raiz del repositorio subiendo desde "
                            + Path.of("").toAbsolutePath()
                            + ". Sin ella esta prueba no puede leer ningun endpoint, y «no se pudo"
                            + " comprobar» no es «esta bien»");
        }
        return candidato;
    }
}
