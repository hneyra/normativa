package kamayuk.normativa.verificaciones;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import kamayuk.comun.verificaciones.contrato.EndpointsPublicados;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.autorizacion.ComprobadorDeAcceso;
import kamayuk.normativa.autorizacion.GuardiaDeAcceso;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.autorizacion.RequiereAcceso;
import kamayuk.normativa.seguridad.dominio.CatalogoDelSistema;
import kamayuk.normativa.web.ProblemaDeNegocio;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

/**
 * El censo de las operaciones que <b>dos opciones del catalogo</b> autorizan (#548, ADR-0043 §2).
 *
 * <p>{@code RequiereAcceso.oTambien} existe porque hay lecturas que dos opciones necesitan por
 * igual. Aqui el caso es el de #53: ADR-0043 §2 mete el modulo {@code NORMATIVA} con la opcion
 * {@code conjuntos}, y las CINCO lecturas de conjuntos —sellados o no— y de su contenido pasan a
 * declararla como acceso propio. Sin {@code oTambien}, esa reanotacion le quitaria el snapshot a
 * quien lo lee <b>hoy</b> con {@code parametros} —y {@code rentas} lo lee reenviando el {@code
 * Authorization} de la persona que calcula—, sin tocar ningun permiso y sin que nada lo dijera.
 *
 * <p><b>Y es tambien el mecanismo con el que se puede abrir una puerta sin querer.</b> Una linea de
 * mas en una anotacion amplia el publico de una lectura sin tocar el catalogo de permisos, sin
 * migracion y sin que ninguna pantalla cambie. Por eso esta censado: la lista de abajo es la
 * enumeracion completa de lo que el sistema comparte, cada entrada con su motivo escrito, y la
 * prueba falla en <b>las dos direcciones</b> —un endpoint que declare alternativas sin estar aqui,
 * y una entrada de aqui cuyo endpoint ya no las declare—.
 *
 * <p>Esta prueba es la que el javadoc de {@code RequiereAcceso.oTambien} nombra desde que se
 * escribio. Hasta #53 <b>no existia en {@code normativa}</b> —solo en {@code rentas}—, asi que ese
 * parrafo prometia un censo que nadie llevaba.
 */
@DisplayName("Los accesos que dos opciones comparten (#548, ADR-0043 §2)")
class AccesosCompartidosTest {

    private static final Clock RELOJ =
            Clock.fixed(Instant.parse("2026-09-16T10:00:00Z"), ZoneId.of("America/Lima"));

    /**
     * Las operaciones que una segunda opcion del catalogo tambien autoriza, con su motivo.
     *
     * <p><b>Se acorta, no se alarga.</b> Anadir una entrada es ampliar el publico de una lectura, y
     * cuesta esta linea a proposito: el diff dice que dos opciones cubren lo mismo y por que.
     */
    private static final Map<String, Set<String>> LO_QUE_DOS_OPCIONES_CUBREN =
            Map.of(
                    // ADR-0043 §2 — las CINCO lecturas del mismo recurso: conjuntos y lo que llevan
                    // dentro. Su opcion propia pasa a ser `conjuntos`, del modulo NORMATIVA del que
                    // cuelgan las cuatro hojas de la interfaz nueva; `parametros` se queda como
                    // alternativa porque es lo que hoy tiene concedido quien las lee, y NO se
                    // retira ni se mueve (SembradorDelCatalogo solo agrega; retirar es
                    // `identidad`#16, que dejo una replica parada 20 h). No se ensancha que se ve:
                    // las cinco leen lo mismo, y quien tiene `parametros` las leia ya todas.
                    //
                    // Las ESCRITURAS de #59 nacen sobre `conjuntos` y SIN `oTambien`: darlas por la
                    // alternativa seria dejar componer y sellar a todo el que tenga REGISTRO o
                    // ESPECIAL sobre `parametros`.
                    //
                    // La lista de conjuntos por ejercicio y su estado.
                    "GET /seguridad/parametros",
                    Set.of("parametros"),
                    // Que conjunto sellado rige hoy el ejercicio: la identidad, sin ninguna fila.
                    "GET /conjuntos",
                    Set.of("parametros"),
                    // El snapshot entero. Es la que `rentas` pide con el `Authorization` de la
                    // persona que calcula (`ClienteHttpDeNormativa`): sin la alternativa, esa
                    // persona deja de poder calcular el dia que se despliega esto.
                    "GET /conjuntos/{id}/snapshot",
                    Set.of("parametros"),
                    // Las dos de #56, que entro antes que este PR y las dejo sobre `parametros`
                    // diciendolo: «ADR-0043 §2 la mueve a `conjuntos` con `oTambien = parametros`
                    // cuando #53 declare el modulo NORMATIVA». Es aqui.
                    "GET /conjuntos/{id}/parametros",
                    Set.of("parametros"),
                    "GET /parametros",
                    Set.of("parametros"));

    @BeforeEach
    void fijarOrigen() {
        OrigenContext.fijar(new Origen("jperez", null, null));
    }

    @AfterEach
    void limpiarOrigen() {
        OrigenContext.limpiar();
    }

    @Test
    @DisplayName("todo endpoint que comparte su acceso esta censado, y el censo no miente")
    void elCensoEnumeraExactamenteLoQueSeComparte() {
        Map<String, Set<String>> compartidos = alternativasPublicadas();

        assertThat(compartidos)
                .as(
                        "un endpoint que declare `oTambien` sin figurar en el censo amplia el"
                                + " publico de una lectura sin que el diff lo diga. Se anota en"
                                + " LO_QUE_DOS_OPCIONES_CUBREN con su motivo, o se retira la"
                                + " anotacion")
                .containsExactlyInAnyOrderEntriesOf(LO_QUE_DOS_OPCIONES_CUBREN);
    }

    @Test
    @DisplayName("y la opcion alternativa existe en el catalogo de este sistema")
    void laOpcionAlternativaExisteEnElCatalogo() {
        Set<String> delCatalogo = new TreeSet<>();
        for (CatalogoDelSistema.Opcion opcion : CatalogoDelSistema.opciones()) {
            delCatalogo.add(opcion.codigo());
        }

        Set<String> inventadas = new TreeSet<>();
        for (Set<String> alternativas : alternativasPublicadas().values()) {
            for (String alternativa : alternativas) {
                if (!delCatalogo.contains(alternativa)) {
                    inventadas.add(alternativa);
                }
            }
        }

        assertThat(delCatalogo)
                .as("el catalogo trae sus opciones; sin ellas la comprobacion de abajo es vacua")
                .isNotEmpty();
        assertThat(inventadas)
                .as(
                        "un acceso que no esta en el catalogo no lo tiene nadie: la alternativa no"
                                + " autorizaria a nadie y el endpoint pareceria compartido sin"
                                + " estarlo (#366)")
                .isEmpty();
    }

    @Test
    @DisplayName("una opcion no se declara alternativa de si misma: seria una linea sin efecto")
    void ningunaOpcionEsAlternativaDeSiMisma() {
        Map<String, Set<String>> redundantes = new TreeMap<>();
        for (Map.Entry<String, Method> publicada : EndpointsPublicados.porOperacion().entrySet()) {
            RequiereAcceso requisito = requisitoDe(publicada.getValue());
            if (requisito == null) {
                continue;
            }
            Set<String> repetidas = new TreeSet<>(Arrays.asList(requisito.oTambien()));
            repetidas.retainAll(Set.of(requisito.acceso()));
            if (!repetidas.isEmpty()) {
                redundantes.put(publicada.getKey(), repetidas);
            }
        }

        assertThat(redundantes)
                .as("`oTambien` repitiendo el acceso propio no comparte nada y disimula el censo")
                .isEmpty();
    }

    /**
     * Lo que #53 promete a quien ya tenia permiso: que no pierde nada.
     *
     * <p>Se ejerce el guardia <b>de produccion</b> sobre las anotaciones <b>de produccion</b>: no
     * un controlador de prueba con dos opciones inventadas —eso ya lo mide {@code
     * GuardiaDeAccesoTest}— sino las lecturas que este PR reanota. Es la unica forma de que
     * quitarle el {@code oTambien} a una de ellas salga rojo aqui, y no en la municipalidad.
     */
    @Test
    @DisplayName(
            "[AC-6] quien solo tiene `parametros` sigue leyendo las cinco, y quien solo tiene"
                    + " la opcion nueva tambien")
    void lasDosOpcionesAutorizanCadaLecturaCompartida() {
        for (String operacion : LO_QUE_DOS_OPCIONES_CUBREN.keySet()) {
            HandlerMethod manejador = manejadorDe(operacion);

            assertThat(dejaPasar(manejador, "parametros"))
                    .as(
                            "«%s» con SOLO `parametros`: es lo que la cuenta tiene hoy y lo que"
                                    + " `rentas` reenvia al pedir el snapshot. Si esto niega, el"
                                    + " dia del despliegue deja de poder calcular quien podia",
                            operacion)
                    .isTrue();

            assertThat(dejaPasar(manejador, "conjuntos"))
                    .as(
                            "«%s» con SOLO la opcion nueva: es lo que la implantacion concede al"
                                    + " grupo de administracion en cuanto el buzon sirve su"
                                    + " PERMISO_FIJADO",
                            operacion)
                    .isTrue();

            assertThat(catchThrowable(() -> dejaPasar(manejador, "ninguna_de_las_dos")))
                    .as("«%s» sin ninguna de las dos sigue siendo 403", operacion)
                    .isInstanceOf(ProblemaDeNegocio.class);
        }
    }

    // ------------------------------------------------------------------

    /** Cada operacion publicada que declara alternativas, con las que declara. */
    private static Map<String, Set<String>> alternativasPublicadas() {
        Map<String, Set<String>> compartidos = new TreeMap<>();
        for (Map.Entry<String, Method> publicada : EndpointsPublicados.porOperacion().entrySet()) {
            RequiereAcceso requisito = requisitoDe(publicada.getValue());
            if (requisito == null || requisito.oTambien().length == 0) {
                continue;
            }
            Set<String> alternativas = new LinkedHashSet<>(List.of(requisito.oTambien()));
            compartidos
                    .computeIfAbsent(publicada.getKey(), clave -> new TreeSet<>())
                    .addAll(alternativas);
        }
        return compartidos;
    }

    /** La anotacion del metodo, y si no la del controlador: el mismo orden que el guardia. */
    private static RequiereAcceso requisitoDe(Method metodo) {
        RequiereAcceso delMetodo =
                AnnotatedElementUtils.findMergedAnnotation(metodo, RequiereAcceso.class);
        return delMetodo != null
                ? delMetodo
                : AnnotatedElementUtils.findMergedAnnotation(
                        metodo.getDeclaringClass(), RequiereAcceso.class);
    }

    /**
     * El manejador real de una operacion, tal como se lo pasa Spring al interceptor.
     *
     * <p>El controlador se instancia con sus dependencias en {@code null} <b>y no se invoca
     * nunca</b>: el guardia corre antes y decide con la anotacion. Lo que hace falta de verdad es
     * que el {@code Method} sea el de produccion.
     */
    private static HandlerMethod manejadorDe(String operacion) {
        Method metodo = EndpointsPublicados.porOperacion().get(operacion);
        assertThat(metodo)
                .as(
                        "«%s» esta en el censo y ningun controlador la publica. O la ruta cambio de"
                                + " nombre o el endpoint se fue: el censo no puede hablar de lo que"
                                + " no existe",
                        operacion)
                .isNotNull();
        try {
            Constructor<?> constructor = metodo.getDeclaringClass().getDeclaredConstructors()[0];
            Object controlador =
                    constructor.newInstance(new Object[constructor.getParameterCount()]);
            return new HandlerMethod(controlador, metodo);
        } catch (ReflectiveOperationException noSePudo) {
            throw new IllegalStateException(
                    "No se pudo instanciar "
                            + metodo.getDeclaringClass().getName()
                            + " para ejercer el guardia sobre su anotacion",
                    noSePudo);
        }
    }

    /** Corre el guardia de produccion con un comprobador que autoriza sobre UNA sola opcion. */
    private static boolean dejaPasar(HandlerMethod manejador, String laUnicaQueTiene) {
        HttpServletRequest peticion = new MockHttpServletRequest();
        HttpServletResponse respuesta = new MockHttpServletResponse();
        return new GuardiaDeAcceso(new SoloSobre(laUnicaQueTiene), RELOJ)
                .preHandle(peticion, respuesta, manejador);
    }

    /** El perfil que tiene permiso en UNA opcion y en ninguna otra. */
    private static final class SoloSobre implements ComprobadorDeAcceso {

        private final String opcion;

        private SoloSobre(String opcion) {
            this.opcion = opcion;
        }

        @Override
        public boolean autoriza(
                String usuario, String acceso, Privilegio privilegio, LocalDate fecha) {
            return opcion.equals(acceso);
        }

        @Override
        public boolean conoceAlUsuario(String usuario) {
            return true;
        }
    }
}
