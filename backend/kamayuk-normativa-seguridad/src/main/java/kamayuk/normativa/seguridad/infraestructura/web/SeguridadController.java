package kamayuk.normativa.seguridad.infraestructura.web;

import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.autorizacion.RequiereAcceso;
import kamayuk.normativa.seguridad.aplicacion.ConsultaDelCatalogo;
import kamayuk.normativa.web.Api;
import kamayuk.normativa.web.ParametrosDePaginacion;
import kamayuk.normativa.web.RespuestaPaginada;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Las dos lecturas del catalogo con las que la interfaz compone su menu: {@code GET
 * /seguridad/modulos} y {@code GET /seguridad/accesos} (#54, y #64 las consume).
 *
 * <p>Son las de {@code rentas} —la misma ruta, la misma paginacion ({@link RespuestaPaginada} con
 * {@link ParametrosDePaginacion}) y los mismos campos—, porque la interfaz de este sistema se
 * reconstruye con la de {@code rentas} (epica #47) y lee con sus tipos. Leen la copia local bajo
 * RLS y no cruzan a ninguna otra base (regla 11): {@code modulo_sistema} y {@code acceso} estan
 * replicadas en los cuatro baselines (ADR-0032) y esta base tiene las suyas.
 *
 * <h2>El requisito de acceso: {@link RequiereAcceso#SESION_PROPIA}, y lo decide ADR-0043 §3</h2>
 *
 * <p>La compuerta G1 acepto ADR-0043 sin enmiendas el 2026-09-16, y su §3 dice que las cinco
 * lecturas de {@code /seguridad} se anotan con el centinela. El motivo, escrito alli: publican el
 * catalogo <b>de este sistema</b> —el mismo en todas las municipalidades, escrito en {@code
 * CatalogoDelSistema}— y lo que la propia sesion puede hacer; no revelan nada que el token no
 * permita enumerar probando cada endpoint ({@code RequiereAcceso}:35-44, REQ-03 §5, ADR-0013).
 *
 * <p><b>Y por que NO como {@code rentas}</b>, que exige {@code LECTURA} sobre {@code modulos} y
 * sobre {@code accesos} ({@code SeguridadController}:42 y :49): esas opciones <b>no existen</b> en
 * el catalogo de {@code normativa} —hoy tiene una sola, {@code parametros}—. Crearlas seria el trio
 * {@code normativa}/{@code identidad}/{@code infrastructure} por dos opciones que no protegen nada;
 * exigirlas sin crearlas dejaria el menu vacio para todo el mundo, porque un {@code PERMISO_FIJADO}
 * sobre una opcion que la copia no tiene no se puede aplicar nunca ({@code
 * CopiaLocalDeLaAutorizacionJdbc}:272-279). {@code catastro} tomo la misma salida en su #117.
 * <b>Este PR no toca {@code CatalogoDelSistema}</b>: la opcion {@code conjuntos} de ADR-0043 §2 la
 * trae #53, y ninguna de estas cinco rutas la necesita.
 *
 * <p>El precedente escrito en este repositorio es {@code
 * ParametrosController.ejercicio(...)}:63-89, que ya declara el centinela por un motivo del mismo
 * tipo.
 *
 * <p>Pasan por {@link ConsultaDelCatalogo}, que abre la transaccion donde se fija el inquilino, y
 * no por el repositorio (regla {@code NINGUN_CONTROLADOR_SOSTIENE_UN_REPOSITORIO}).
 */
@RestController
@RequestMapping(Api.RAIZ + "/seguridad")
public class SeguridadController {

    private final ConsultaDelCatalogo catalogo;

    public SeguridadController(ConsultaDelCatalogo catalogo) {
        this.catalogo = catalogo;
    }

    /** Los modulos, por {@code orden} y desempatados por {@code id}; activos o no. */
    @GetMapping("/modulos")
    @RequiereAcceso(acceso = RequiereAcceso.SESION_PROPIA, privilegio = Privilegio.LECTURA)
    public RespuestaPaginada<Recursos.ModuloResource> modulos(ParametrosDePaginacion paginacion) {
        return RespuestaPaginada.de(
                catalogo.modulos(paginacion.aPaginacion("orden")), Recursos.ModuloResource::de);
    }

    /** Las opciones, por {@code codigo}; activas o no, con el modulo del que cuelgan. */
    @GetMapping("/accesos")
    @RequiereAcceso(acceso = RequiereAcceso.SESION_PROPIA, privilegio = Privilegio.LECTURA)
    public RespuestaPaginada<Recursos.AccesoResource> accesos(ParametrosDePaginacion paginacion) {
        return RespuestaPaginada.de(
                catalogo.accesos(paginacion.aPaginacion("codigo")), Recursos.AccesoResource::de);
    }
}
