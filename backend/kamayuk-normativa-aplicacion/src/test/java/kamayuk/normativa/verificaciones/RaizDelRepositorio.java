package kamayuk.normativa.verificaciones;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Donde esta el repositorio, para las pruebas que leen fuera del build de Gradle.
 *
 * <p>La usan {@link FormasDeLaApiTest} y {@link ParametrosDeLaApiTest}, que escriben y comparan
 * {@code docs/50-api/*.json}, y la segunda ademas lee el fuente de los controladores. Un solo
 * recorrido para las dos: dos escritos por separado empiezan iguales y acaban discrepando en el
 * caso raro, y entonces una prueba escribe un archivo y la otra lee otro.
 *
 * <h2>El ancla, y por que esta y no la que habia</h2>
 *
 * <p>Hasta #49 esta clase buscaba {@code docs/50-api/openapi/rentas-v1.yaml}: llego copiada de
 * {@code rentas} en P5B, y ese archivo <b>no existe en este repositorio</b>. Nadie la usaba, asi
 * que nada se ponia rojo; la primera prueba que la hubiera llamado habria recibido la excepcion de
 * abajo en vez de su archivo.
 *
 * <p>El ancla es ahora {@code docs/50-api/contratos-que-consume}, que existe aqui desde la etapa 4
 * de ADR-0039 —lo escribe {@code ContratoQueConsumeDeIdentidad}— junto con {@code backend/}. Las
 * dos juntas, porque el directorio que contiene los clones hermanos no tiene ninguna de las dos, y
 * un clon hermano que tuviera la primera sin la segunda no es un backend.
 */
final class RaizDelRepositorio {

    /** Lo que tiene que haber en la raiz: un directorio de {@code docs} y el backend. */
    static final String ANCLA = "docs/50-api/contratos-que-consume";

    private RaizDelRepositorio() {}

    static Path ruta() {
        Path actual = Path.of("").toAbsolutePath();
        while (actual != null) {
            if (Files.isDirectory(actual.resolve(ANCLA))
                    && Files.isDirectory(actual.resolve("backend"))) {
                return actual;
            }
            actual = actual.getParent();
        }
        throw new IllegalStateException(
                "No se encontro la raiz del repositorio: ningun directorio, subiendo desde «"
                        + Path.of("").toAbsolutePath()
                        + "», tiene «"
                        + ANCLA
                        + "» y «backend» a la vez");
    }
}
