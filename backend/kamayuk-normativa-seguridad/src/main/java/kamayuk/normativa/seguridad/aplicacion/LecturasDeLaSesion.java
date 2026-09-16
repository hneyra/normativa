package kamayuk.normativa.seguridad.aplicacion;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.seguridad.dominio.Identidad;
import kamayuk.normativa.seguridad.dominio.LecturaDeLaCopiaLocal;
import kamayuk.normativa.seguridad.dominio.Municipalidad;
import kamayuk.normativa.seguridad.dominio.MunicipalidadRepository;
import kamayuk.normativa.web.CodigoDeError;
import kamayuk.normativa.web.ProblemaDeNegocio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * La sesion hablando de si misma: quien es, de que municipalidad y que puede (#54).
 *
 * <p>Son las tres lecturas que en {@code rentas} viven en {@code IdentidadDeLaSesion}, {@code
 * MunicipalidadDeLaSesion} y {@code PermisosDeLaSesion}; aqui van juntas —como en {@code catastro}—
 * porque no hay nada mas que las separe: ni escrituras de sesion, ni cambio de ejercicio, ni cambio
 * de clave, que este sistema no publica.
 *
 * <h2>Ningun metodo recibe nada</h2>
 *
 * <p>La cuenta sale de {@link OrigenContext}, que llena el filtro que ya valido el token, y la
 * municipalidad del {@code SET LOCAL} que ese mismo token decidio. Con un parametro, cualquiera de
 * las tres seria un directorio: quien pregunta elegiria por quien pregunta (regla 2).
 *
 * <h2>La transaccion no es cosmetica</h2>
 *
 * <p>Las cinco tablas de la copia local llevan RLS con {@code FORCE}, y {@code municipalidad}
 * compara su {@code WHERE} contra {@code current_setting('app.municipalidad_id')}. Ese parametro
 * solo existe dentro de la transaccion que lo fijo: sin la anotacion no hay una respuesta
 * equivocada, hay un 500.
 */
@Service
public class LecturasDeLaSesion {

    private final LecturaDeLaCopiaLocal copiaLocal;
    private final MunicipalidadRepository municipalidades;
    private final Clock reloj;

    public LecturasDeLaSesion(
            LecturaDeLaCopiaLocal copiaLocal,
            MunicipalidadRepository municipalidades,
            Clock reloj) {
        this.copiaLocal = copiaLocal;
        this.municipalidades = municipalidades;
        this.reloj = reloj;
    }

    /**
     * La persona autenticada, tal como la conoce esta municipalidad.
     *
     * @throws ProblemaDeNegocio con {@code NO_ENCONTRADO} si la cuenta del token no es usuario de
     *     esta municipalidad. Sale dicho en vez de devolver un {@code usuarioId} inventado: un cero
     *     ahi se lee como un usuario
     */
    @Transactional(readOnly = true)
    public Identidad identidad() {
        String cuenta = OrigenContext.actual().usuario();
        return copiaLocal
                .identidadDe(cuenta)
                .orElseThrow(
                        () ->
                                new ProblemaDeNegocio(
                                        CodigoDeError.NO_ENCONTRADO,
                                        "El token identifica a '"
                                                + cuenta
                                                + "', que no es un usuario de esta municipalidad"));
    }

    /**
     * La municipalidad de la sesion en curso, con su {@code ubigeo} y su {@code nombre} (G2, #52).
     *
     * @throws IllegalStateException si el token trae una municipalidad que no esta en el registro.
     *     Es una instalacion rota y sale ruidosa: un nombre vacio acabaria en la barra
     */
    @Transactional(readOnly = true)
    public Municipalidad municipalidad() {
        return municipalidades
                .deLaSesion()
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "La municipalidad de la sesion no esta en el registro de"
                                                + " municipalidades. Sin su nombre no se puede decir"
                                                + " de quien son las cifras de la pantalla."));
    }

    /**
     * La matriz efectiva de la cuenta del token, a la fecha del reloj inyectado.
     *
     * <p>«Hoy» sale del reloj y no de {@code LocalDate.now()}: la vigencia de un grupo se evalua
     * contra el, y tiene que poder fijarse en una prueba. Es la misma fecha que usa el guardia.
     */
    @Transactional(readOnly = true)
    public Map<String, Set<Privilegio>> permisos() {
        return copiaLocal.permisosEfectivosDe(
                OrigenContext.actual().usuario(), LocalDate.now(reloj));
    }
}
