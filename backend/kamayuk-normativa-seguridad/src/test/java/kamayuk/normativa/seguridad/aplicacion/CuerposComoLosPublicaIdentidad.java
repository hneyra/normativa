package kamayuk.normativa.seguridad.aplicacion;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Los cuerpos de los hechos, con los <b>mismos campos y en el mismo orden</b> con que los compone
 * el emisor.
 *
 * <p>La fuente es {@code identidad}: {@code HechoDeIdentidad.deUsuario}, {@code deGrupo}, {@code
 * deMiembro} y {@code dePermiso} —{@code
 * kamayuk-identidad-nucleo/src/main/java/kamayuk/identidad/nucleo/dominio/HechoDeIdentidad.java}—,
 * leidos campo a campo y copiados aqui:
 *
 * <ul>
 *   <li>usuario: {@code usuarioId, cuenta, nombre, correo, habilitado, vigenciaDesde,
 *       vigenciaHasta};
 *   <li>grupo: {@code grupoId, nombre, descripcion, habilitado, vigenciaDesde, vigenciaHasta};
 *   <li>miembro: {@code grupoId, grupoNombre, usuarioId, usuarioCuenta, activo, usuarioAlta,
 *       usuarioBaja} —de los dos ultimos, uno es {@code null} segun el hecho sea alta o baja—;
 *   <li>permiso: {@code sujeto, sujetoId, sujetoNombre, sistema, codigo, privilegios{los siete, en
 *       el orden de {@code Privilegio.values()}}, usuarioRegistro}.
 * </ul>
 *
 * <p><b>Por que se copia en vez de inventarse.</b> Lo que estas pruebas afirman es que una
 * implantacion de cero deja al administrador dentro; si el cuerpo que las alimenta no es el que el
 * emisor publica, lo que se demuestra es que este consumidor sabe leer <b>lo que este arnes
 * escribe</b>, que es una afirmacion sobre nada. En la etapa 4 tres de los cuatro consumidores
 * tenian su doble sirviendo mal {@code quedan}, y el rojo que lo tenia que cazar pasaba en verde
 * por eso: el instrumento mentia sobre el campo medido.
 *
 * <p>El orden de los campos <b>no</b> lo comprueba este consumidor —lee por nombre—, pero se
 * conserva igual: es la forma canonica sobre la que el emisor calcula la {@code huella}, y un
 * cuerpo escrito en otro orden se parece a uno cuya huella no cuadraria.
 */
final class CuerposComoLosPublicaIdentidad {

    private CuerposComoLosPublicaIdentidad() {}

    /** Los siete, en el orden del enumerado, todos otorgados: lo que recibe un administrador. */
    static final String LOS_SIETE =
            "{\"ejecucion\":true,\"lectura\":true,\"registro\":true,\"modificacion\":true,"
                    + "\"eliminacion\":true,\"impresion\":true,\"especial\":true}";

    static String usuario(long id, String cuenta, String nombre, boolean habilitado) {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("usuarioId", String.valueOf(id));
        campos.put("cuenta", texto(cuenta));
        campos.put("nombre", texto(nombre));
        campos.put("correo", "null");
        campos.put("habilitado", String.valueOf(habilitado));
        campos.put("vigenciaDesde", texto("2026-01-01"));
        campos.put("vigenciaHasta", "null");
        return objeto(campos);
    }

    static String grupo(long id, String nombre, String descripcion) {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("grupoId", String.valueOf(id));
        campos.put("nombre", texto(nombre));
        campos.put("descripcion", texto(descripcion));
        campos.put("habilitado", "true");
        campos.put("vigenciaDesde", "null");
        campos.put("vigenciaHasta", "null");
        return objeto(campos);
    }

    static String miembro(long grupoId, String grupo, long usuarioId, String cuenta, String quien) {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("grupoId", String.valueOf(grupoId));
        campos.put("grupoNombre", texto(grupo));
        campos.put("usuarioId", String.valueOf(usuarioId));
        campos.put("usuarioCuenta", texto(cuenta));
        campos.put("activo", "true");
        campos.put("usuarioAlta", texto(quien));
        campos.put("usuarioBaja", "null");
        return objeto(campos);
    }

    /**
     * Una matriz de grupo sobre una opcion de {@code sistema}, con los privilegios que se digan.
     */
    static String permiso(
            long grupoId, String grupo, String sistema, String codigo, String privilegios) {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("sujeto", texto("GRUPO"));
        campos.put("sujetoId", String.valueOf(grupoId));
        campos.put("sujetoNombre", texto(grupo));
        campos.put("sistema", texto(sistema));
        campos.put("codigo", texto(codigo));
        campos.put("privilegios", privilegios);
        campos.put("usuarioRegistro", texto("administrador"));
        return objeto(campos);
    }

    private static String objeto(Map<String, String> campos) {
        StringBuilder json = new StringBuilder("{");
        boolean primero = true;
        for (Map.Entry<String, String> campo : campos.entrySet()) {
            if (!primero) {
                json.append(',');
            }
            primero = false;
            json.append('"').append(campo.getKey()).append("\":").append(campo.getValue());
        }
        return json.append('}').toString();
    }

    private static String texto(String valor) {
        return "\"" + valor + "\"";
    }
}
