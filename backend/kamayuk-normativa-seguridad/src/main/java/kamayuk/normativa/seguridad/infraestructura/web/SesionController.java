package kamayuk.normativa.seguridad.infraestructura.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.autorizacion.RequiereAcceso;
import kamayuk.normativa.seguridad.aplicacion.LecturasDeLaSesion;
import kamayuk.normativa.web.Api;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * La sesion hablando de si misma: quien es, de que municipalidad y que puede (#54).
 *
 * <p>Son tres de las rutas que {@code SesionController} de {@code rentas} publica, con su misma
 * forma. Las otras cuatro de aquel —el cambio de ejercicio, el cambio de clave, la auditoria y los
 * respaldos— <b>no</b> estan aqui a proposito: son escrituras u opciones del modulo Seguridad que
 * este sistema no tiene, y si hacen falta son otro issue.
 *
 * <h2>El requisito de acceso: {@link RequiereAcceso#SESION_PROPIA}, las tres</h2>
 *
 * <p>Lo decide ADR-0043 §3, aceptado sin enmiendas en la compuerta G1 el 2026-09-16. No es una
 * analogia con {@code rentas} —que declara lo mismo—: es que ninguna de las tres es una opcion del
 * catalogo y no hay nada que medir en el. {@code CatalogoDelSistema} no declara ninguna opcion de
 * sesion, y no puede declararla, porque leer la sesion propia no tiene privilegio que configurar
 * (ADR-0013). Es lo que el centinela dice con todas las letras:
 *
 * <ul>
 *   <li><b>Quien soy</b> no revela nada que no revele el token que ya se presento.
 *   <li><b>De que municipalidad</b> tampoco: se lo dice su propio claim. Sin esta lectura la barra
 *       de la interfaz lleva el nombre de la entidad compilado —lo que G2 (#52) prohibe—, y con el
 *       token de otra afirma de quien son unas cifras que no son suyas.
 *   <li><b>Que puedo</b> no revela nada que no se pueda enumerar probando cada endpoint (REQ-03
 *       §5), y una cuenta sin ningun permiso tiene que recibir {@code {}} y no un 403: exigir aqui
 *       una opcion dejaria sin menu justo a quien hay que decirle que no tiene nada.
 * </ul>
 *
 * <h2>Ninguna recibe nada</h2>
 *
 * <p>Ni ruta, ni consulta, ni cuerpo: la cuenta sale del token y la municipalidad del {@code SET
 * LOCAL} que ese token decidio. Con un parametro, cada una seria un directorio —de personas, de
 * municipalidades, de permisos ajenos—. Uno de mas ni siquiera se ignora: {@code
 * GuardiaDeParametros} lo rechaza con 422 nombrandolo.
 */
@RestController
@RequestMapping(Api.RAIZ + "/seguridad/sesion")
public class SesionController {

    private final LecturasDeLaSesion sesion;

    public SesionController(LecturasDeLaSesion sesion) {
        this.sesion = sesion;
    }

    /**
     * Quien es la sesion: la cuenta del token, resuelta a su fila de {@code usuario} en esta
     * municipalidad. 404 si la cuenta no es usuario de esta municipalidad.
     *
     * <p>{@code ejercicioDeTrabajo} sale <b>nulo siempre</b> en este sistema: {@code sesion} es una
     * tabla que existe y que nadie escribe, y no hay {@code PUT /seguridad/sesion/ejercicio} que la
     * escriba (AC-5).
     */
    @GetMapping
    @RequiereAcceso(acceso = RequiereAcceso.SESION_PROPIA, privilegio = Privilegio.LECTURA)
    public Recursos.IdentidadResource identidad() {
        return Recursos.IdentidadResource.de(sesion.identidad());
    }

    /**
     * A quien pertenecen las cifras de la pantalla: la municipalidad de la sesion, con su {@code
     * ubigeo} y su {@code nombre} (G2, #52).
     *
     * <p>La consulta lleva un {@code WHERE} explicito contra {@code
     * current_setting('app.municipalidad_id')}, porque la politica de lectura de {@code
     * municipalidad} es {@code USING (true)} (V1:620-621): sin el, esta ruta contestaria con la
     * fila de otra.
     */
    @GetMapping("/municipalidad")
    @RequiereAcceso(acceso = RequiereAcceso.SESION_PROPIA, privilegio = Privilegio.LECTURA)
    public Recursos.MunicipalidadResource municipalidad() {
        return Recursos.MunicipalidadResource.de(sesion.municipalidad());
    }

    /**
     * La matriz de permisos efectivos: {@code {"<opcion>": ["lectura", "registro", …]}}.
     *
     * <p>Solo las opciones sobre las que la cuenta tiene algun privilegio, en orden de codigo. Los
     * privilegios van en <b>minuscula</b> —el nombre de su columna, {@link Privilegio#columna()}— y
     * en el orden del enumerado, que es el del manual: la interfaz de {@code rentas} busca {@code
     * "lectura"} tal cual, y un {@code "LECTURA"} dejaria el menu vacio sin ningun error.
     */
    @GetMapping("/permisos")
    @RequiereAcceso(acceso = RequiereAcceso.SESION_PROPIA, privilegio = Privilegio.LECTURA)
    public Map<String, List<String>> permisos() {
        Map<String, List<String>> salida = new LinkedHashMap<>();
        sesion.permisos()
                .forEach(
                        (opcion, privilegios) ->
                                salida.put(
                                        opcion,
                                        privilegios.stream()
                                                .sorted()
                                                .map(Privilegio::columna)
                                                .toList()));
        return salida;
    }
}
