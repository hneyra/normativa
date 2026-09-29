package kamayuk.normativa.parametros.infraestructura.web;

import java.util.List;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.autorizacion.RequiereAcceso;
import kamayuk.normativa.parametros.aplicacion.AdministrarParametros;
import kamayuk.normativa.parametros.dominio.ParametroTributario;
import kamayuk.normativa.web.Api;
import kamayuk.normativa.web.ParametrosDePaginacion;
import kamayuk.normativa.web.RespuestaPaginada;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lo que un conjunto lleva dentro, y lo que se le puede agregar (ADR-0043 §1, filas 4 y 5).
 *
 * <h2>Las dos preguntas que hasta aqui no tenian respuesta</h2>
 *
 * <ul>
 *   <li><b>Que lleva dentro un conjunto</b>, este <b>abierto</b> o sellado. Lo unico que se servia
 *       era el snapshot, y el snapshot <b>se niega</b> a servir un conjunto abierto ({@code
 *       SnapshotController.snapshot}) — que es justo el que se esta componiendo, y del que la hoja
 *       de Ediciones tiene que ensenar el contenido mientras se compone.
 *   <li><b>Que parametros publicados hay</b>, que es entre los que se elige antes de agregar uno
 *       (ADR-0043 §1, ruta 2, que implementa #59).
 * </ul>
 *
 * <h2>Por que un controlador nuevo y no dos metodos mas en {@code SnapshotController}</h2>
 *
 * <p>Porque {@code SnapshotController} sirve <b>una sola cosa</b>: el conjunto sellado, entero,
 * inmutable y cacheable para siempre —{@code Cache-Control: immutable}, {@code ETag} igual al
 * {@code sha256} de los bytes—. Estas dos lecturas son lo contrario: la primera sirve un conjunto
 * que todavia cambia, y ninguna de las dos se puede cachear asi. Meterlas ahi obligaria a que la
 * clase que promete inmutabilidad tuviera dentro las lecturas que no la tienen.
 *
 * <h2>La cifra viaja como CADENA, nunca como numero JSON</h2>
 *
 * <p>Lo fija ADR-0043 §1 con todas las letras, y la razon esta medida en {@code FormasDeLaApiTest}:
 * {@code ConfiguracionDeJson} no serializa {@link kamayuk.normativa.dominio.ValorNormativo} como
 * cadena, asi que un recurso que llevara el objeto de dominio emitiria {@code {"valor":
 * 5350.000000}} — un numero JSON que el navegador lee como {@code double} y redondea (regla 1,
 * RNF-055). {@link ParametroResource#valorNumerico()} es {@code String}, como ya lo es {@code
 * SnapshotDelConjunto.ParametroDelSnapshot.valorNumerico}, y la prohibicion la vigila {@code
 * FormasDeLaApiTest.ningunRecursoPublicadoLlevaUnValorNormativo}.
 *
 * <h2>Ninguna de las dos audita, y hay que decirlo</h2>
 *
 * <p>Ninguna deja fila en la bitacora. No es un olvido ni una excepcion: {@code Operacion.ACCESO}
 * es «entrada o salida del sistema» y <b>ningun</b> caso de uso de este repositorio audita una
 * lectura. Lo que la bitacora registra son los actos que cambian el conjunto —abrir, agregar y
 * sellar—, que es lo que ADR-0008 pide poder reconstruir; auditar aqui pondria una escritura sin
 * cota sobre una tabla que no tiene {@code DELETE} (regla 4, RNF-051) al alcance de cualquiera que
 * recorra identificadores.
 */
@RestController
@RequestMapping(Api.RAIZ)
public class ContenidoDelConjuntoController {

    private final AdministrarParametros administrar;

    public ContenidoDelConjuntoController(AdministrarParametros administrar) {
        this.administrar = administrar;
    }

    /**
     * El conjunto y lo que lleva dentro, abierto o sellado.
     *
     * <p><b>404 si no existe, y el mismo 404 si es de otra municipalidad</b>, con el mismo mensaje
     * en los dos casos: con RLS son el mismo hecho (ADR-0043 §7). Contestar 200 con la lista vacia
     * —que es lo que hace {@code AdministrarParametros.parametrosDe} por su cuenta— diria «existe y
     * esta vacio» de un conjunto que puede ser de otra municipalidad.
     *
     * <p>Lleva el conjunto <b>ademas</b> de la lista porque la pantalla tiene que poder decir de
     * que habla —ejercicio, version y estado— sin una segunda peticion, y porque el estado es lo
     * que decide si la hoja ofrece agregar o solo mirar.
     */
    @GetMapping("/conjuntos/{id}/parametros")
    @RequiereAcceso(acceso = "conjuntos", oTambien = "parametros", privilegio = Privilegio.LECTURA)
    public ContenidoDelConjuntoResource contenido(@PathVariable long id) {
        return ContenidoDelConjuntoResource.de(administrar.contenidoDe(id));
    }

    /**
     * Los parametros publicados: lo que se le puede agregar a un conjunto abierto.
     *
     * <p><b>Que se ve.</b> Los <b>nacionales</b> y los <b>de esta municipalidad</b>, nunca los de
     * otra. No lo decide esta clase sino la politica {@code parametro_lectura} del esquema ({@code
     * municipalidad_id IS NULL OR municipalidad_id = <la del contexto>}), y por eso se mide contra
     * PostgreSQL y no aqui.
     *
     * <p><b>Sin filtros</b>, y esta decidido: ADR-0043 §1 lo dice —{@code parametros-2026.csv} son
     * 33 filas y la ruta pagina—. Un filtro por tipo o por vigencia entra con su issue el dia que
     * la lista deje de caber, y declarado en {@code GuardiaDeParametros}; mandarlo hoy es un 422
     * «parametro desconocido», que es lo correcto: un filtro que el servidor ignora devuelve la
     * lista entera al que pidio una parte.
     *
     * <p><b>El orden por omision es {@code tipo}</b>, que es como se lee una lista de parametros:
     * todas las {@code UIT} juntas. Cualquier otro campo que no este en {@code
     * ParametrosRepositoryJdbc.ORDEN_PARAMETRO} es un 422 {@code ORDEN_NO_ADMITIDO}, y la lista
     * blanca la publica {@code docs/50-api/parametros-de-la-api.json} para que la interfaz no la
     * copie a mano como hacia la V6.
     */
    @GetMapping("/parametros")
    @RequiereAcceso(acceso = "conjuntos", oTambien = "parametros", privilegio = Privilegio.LECTURA)
    public RespuestaPaginada<ParametroResource> publicados(ParametrosDePaginacion paginacion) {
        return RespuestaPaginada.de(
                administrar.parametros(paginacion.aPaginacion("tipo")), ParametroResource::de);
    }

    /**
     * Un conjunto y su contenido, en una sola respuesta.
     *
     * <p>El conjunto va con el {@link ParametrosController.ConjuntoResource} que <b>ya existe</b>,
     * y no con una forma propia: dos formas del mismo recurso acaban divergiendo justo en el campo
     * que una pantalla lee (ADR-0043 §1).
     *
     * @param conjunto de que conjunto es este contenido
     * @param parametros lo que lleva dentro, en orden total
     */
    public record ContenidoDelConjuntoResource(
            ParametrosController.ConjuntoResource conjunto, List<ParametroResource> parametros) {

        static ContenidoDelConjuntoResource de(AdministrarParametros.ContenidoDelConjunto dentro) {
            return new ContenidoDelConjuntoResource(
                    ParametrosController.ConjuntoResource.de(dentro.conjunto()),
                    dentro.parametros().stream().map(ParametroResource::de).toList());
        }
    }

    /**
     * Una fila de {@code parametro_tributario} tal como sale por HTTP.
     *
     * <p>Lleva el {@code id} porque es lo que identifica la fila en una pantalla que ensena varias
     * con la misma llave —{@code parametros-2026.csv} publica cinco {@code UIT}—, y lleva la
     * <b>vigencia</b> entera en vez del valor «que rige»: resolver cual rige es del lector, contra
     * el ejercicio del conjunto, y hacerlo aqui moveria esa decision al servidor y la volveria
     * invisible (es lo mismo que decidio {@code SnapshotDelConjunto.ParametroDelSnapshot}).
     *
     * @param valorNumerico la cifra <b>como cadena</b>, con todos sus decimales; nula si el
     *     parametro es de texto
     * @param valorTexto el valor cuando no es una cifra; nulo si es numerico
     */
    public record ParametroResource(
            long id,
            String tipo,
            @Nullable String clave,
            @Nullable String valorNumerico,
            @Nullable String valorTexto,
            @Nullable String vigenciaDesde,
            @Nullable String vigenciaHasta,
            String documentoFuente) {

        static ParametroResource de(ParametroTributario parametro) {
            return new ParametroResource(
                    parametro.id() == null ? 0L : parametro.id(),
                    parametro.tipo(),
                    parametro.clave(),
                    parametro.valorNumerico() == null
                            ? null
                            : parametro.valorNumerico().valor().toPlainString(),
                    parametro.valorTexto(),
                    parametro.vigencia().desde() == null
                            ? null
                            : parametro.vigencia().desde().toString(),
                    parametro.vigencia().hasta() == null
                            ? null
                            : parametro.vigencia().hasta().toString(),
                    parametro.documentoFuente());
        }
    }
}
