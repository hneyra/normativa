package kamayuk.normativa.seguridad.dominio;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;

/**
 * Lo que la interfaz LEE de la copia local de la autorizacion, y nada mas (#54).
 *
 * <p>La copia la escribe el consumidor del buzon de {@code identidad} —{@code
 * AplicarUnEventoDeIdentidad}, el unico escritor que la regla 12 admite, declarada en {@code
 * ConfiguracionDeNormativa.escritoresDeLaAutorizacionConMotivo}— y el catalogo lo siembra {@code
 * SembradorDelCatalogo}. Lo que queda de este lado es lo que la interfaz necesita para componer su
 * menu y su barra: los modulos, los accesos, quien es la cuenta del token y su matriz efectiva. Es
 * la misma lectura que {@code rentas} publica desde la etapa 4 de ADR-0039 y que {@code catastro}
 * porto en su #117, sobre las mismas tablas replicadas (ADR-0032).
 *
 * <p><b>No tiene ningun metodo de escritura, a proposito.</b> Y ningun metodo recibe la
 * municipalidad: la pone la politica RLS con el {@code SET LOCAL} de la transaccion (regla 2).
 */
public interface LecturaDeLaCopiaLocal {

    /** Los modulos del catalogo de esta municipalidad, activos o no. */
    Pagina<ModuloDelSistema> modulos(Paginacion paginacion);

    /** Las opciones del catalogo de esta municipalidad, activas o no. */
    Pagina<AccesoDelSistema> accesos(Paginacion paginacion);

    /**
     * La cuenta, resuelta a la fila de {@code usuario} de esta municipalidad, con el ejercicio que
     * su sesion abierta tenga registrado —que en este sistema es siempre ninguno—.
     *
     * @return vacio si la cuenta no es usuario de esta municipalidad
     */
    Optional<Identidad> identidadDe(String cuenta);

    /**
     * La matriz efectiva de una cuenta a una fecha: por acceso activo, la excepcion del usuario si
     * la hay —otorgue o niegue— y si no la union de sus grupos habilitados y vigentes. Es la
     * precedencia de {@code ComprobadorDeAccesoJdbc}, y tiene que serlo: si se separaran, el menu
     * ofreceria una pantalla y el guardia la negaria, y ese 403 no se parece a su causa. Lo ata
     * {@code LaMatrizYElGuardiaDicenLoMismoTest} (AC-4).
     *
     * @return solo las opciones sobre las que la cuenta tiene algun privilegio; vacio para una
     *     cuenta sin ninguno, deshabilitada, fuera de vigencia o que no existe
     */
    Map<String, Set<Privilegio>> permisosEfectivosDe(String cuenta, LocalDate fecha);
}
