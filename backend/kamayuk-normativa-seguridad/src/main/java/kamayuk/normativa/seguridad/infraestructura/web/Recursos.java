package kamayuk.normativa.seguridad.infraestructura.web;

import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.seguridad.dominio.AccesoDelSistema;
import kamayuk.normativa.seguridad.dominio.Identidad;
import kamayuk.normativa.seguridad.dominio.ModuloDelSistema;
import kamayuk.normativa.seguridad.dominio.Municipalidad;
import org.jspecify.annotations.Nullable;

/**
 * Los recursos de las cinco lecturas de seguridad (#54).
 *
 * <p><b>Son los de {@code rentas}, campo por campo y en el mismo orden</b>: la interfaz de {@code
 * normativa} se reconstruye con la de {@code rentas} (epica #47) y lee con sus mismos tipos —{@code
 * ModuloDelSistema}, {@code AccesoDelSistema}, {@code SesionDeLaVentanilla} y {@code
 * MunicipalidadDeLaSesion} de {@code rentas/frontend/src/datos/lecturas.ts}—. Un nombre distinto
 * aqui no rompe ninguna compilacion: sale como {@code undefined} en una pantalla.
 *
 * <p>Campos en español {@code camelCase} (ARQ-04 §3). Ninguno lleva {@code municipalidadId}, y el
 * usuario no publica su {@code sujeto_oidc}: es un identificador del proveedor de identidad y no
 * tiene por que salir de la base.
 */
public final class Recursos {

    private Recursos() {}

    /** Un modulo, de {@code GET /seguridad/modulos}. */
    public record ModuloResource(long id, String codigo, String nombre, int orden, boolean activo) {

        static ModuloResource de(ModuloDelSistema modulo) {
            return new ModuloResource(
                    modulo.id(), modulo.codigo(), modulo.nombre(), modulo.orden(), modulo.activo());
        }
    }

    /** Una opcion del catalogo, de {@code GET /seguridad/accesos}. */
    public record AccesoResource(
            long id, long moduloId, String tipo, String codigo, String nombre, boolean activo) {

        static AccesoResource de(AccesoDelSistema acceso) {
            return new AccesoResource(
                    acceso.id(),
                    acceso.moduloId(),
                    acceso.tipo(),
                    acceso.codigo(),
                    acceso.nombre(),
                    acceso.activo());
        }
    }

    /**
     * Quien es la sesion, de {@code GET /seguridad/sesion}.
     *
     * <p>{@code ejercicioDeTrabajo} viaja <b>nulo</b> mientras ningun acto lo haya fijado, y en
     * este sistema no hay ruta que lo fije ni nada que escriba {@code sesion}: es nulo siempre. No
     * es una falta de dato, es la respuesta, y un año por omision la convertiria en otra (AC-5).
     */
    public record IdentidadResource(
            long usuarioId, String cuenta, String nombre, @Nullable Integer ejercicioDeTrabajo) {

        static IdentidadResource de(Identidad identidad) {
            Ejercicio ejercicio = identidad.ejercicioDeTrabajo();
            return new IdentidadResource(
                    identidad.usuarioId(),
                    identidad.cuenta(),
                    identidad.nombre(),
                    ejercicio == null ? null : ejercicio.valor());
        }
    }

    /**
     * De que municipalidad es la sesion, de {@code GET /seguridad/sesion/municipalidad}.
     *
     * <p>{@code ubigeo} y {@code nombre} son los dos que la compuerta G2 (#52) pide para la barra:
     * la municipalidad se resuelve por su UBIGEO y nunca como literal. {@code nombre} es la columna
     * verbatim, con su tipo delante; {@code tipo} va aparte para quien necesite distinguirlas y
     * <b>no</b> para anteponerlo —componer «Municipalidad » + tipo + « de » + nombre da
     * «Municipalidad Distrital de Municipalidad Distrital de …», y eso no se ve hasta que esta
     * impreso—.
     */
    public record MunicipalidadResource(long id, String ubigeo, String nombre, String tipo) {

        static MunicipalidadResource de(Municipalidad municipalidad) {
            return new MunicipalidadResource(
                    municipalidad.id(),
                    municipalidad.ubigeo(),
                    municipalidad.nombre(),
                    municipalidad.tipo());
        }
    }
}
