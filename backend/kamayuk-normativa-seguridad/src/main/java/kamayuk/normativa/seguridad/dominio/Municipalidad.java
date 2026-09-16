package kamayuk.normativa.seguridad.dominio;

/**
 * La municipalidad a la que pertenece la sesion, tal como esta en el registro de tenants (#54).
 *
 * <p>Es lo que hace honesta la barra de la interfaz. La compuerta G2 (#52) lo decidio con todas las
 * letras: la barra muestra la municipalidad <b>de la sesion, resuelta por su UBIGEO</b>, nunca como
 * literal compilado. Sin esta lectura, el nombre de la entidad acaba dentro del marco y con el
 * token de otra municipalidad afirma de quien son unas cifras que no son suyas.
 *
 * <p>No lleva {@code MunicipalidadId} sino un {@code long}: el tipo del dominio no aparece en
 * ninguna firma (regla 2), y un componente de {@code record} es un parametro del constructor.
 *
 * @param id el identificador de la municipalidad, el mismo que trae el claim del token
 * @param ubigeo los seis digitos del distrito, sin el relleno de {@code character(6)}
 * @param nombre el nombre completo, verbatim de la columna: con su tipo delante. <b>No se
 *     compone</b> con {@link #tipo()}, o sale «Municipalidad Distrital de Municipalidad Distrital
 *     de …»
 * @param tipo {@code DISTRITAL} o {@code PROVINCIAL}, lo que admite {@code
 *     municipalidad_tipo_check}
 */
public record Municipalidad(long id, String ubigeo, String nombre, String tipo) {}
