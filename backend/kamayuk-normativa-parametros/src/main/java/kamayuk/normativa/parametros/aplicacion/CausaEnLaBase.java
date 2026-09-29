package kamayuk.normativa.parametros.aplicacion;

import java.sql.SQLException;
import java.util.Optional;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * La causa <b>concreta</b> de un rechazo de la base: su {@code SQLState} y el nombre de lo que
 * rechazo (ADR-0043 §7).
 *
 * <h2>Por que no basta el tipo de la excepcion</h2>
 *
 * <p>Spring traduce un {@code unique_violation} ({@code 23505}) a {@code DuplicateKeyException}, y
 * un {@code restrict_violation} ({@code 23001}) a un {@code DataIntegrityViolationException}
 * generico, el mismo que recibiria un {@code CHECK} o una clave foranea. Ninguno de los dos dice
 * <b>que</b> choco: {@code conjunto_parametros} tiene dos indices unicos que pueden saltar al abrir
 * —{@code conjunto_uq} y {@code conjunto_idempotencia_uq}— y el detalle tiene su clave primaria y
 * un disparador. ADR-0043 §7 decide traducir cada uno en la operacion que lo puede producir y
 * <b>ninguno mas</b>: todo lo demas sigue siendo 500 con incidencia, que es lo correcto para lo que
 * no se espera. Una traduccion por tipo convertiria en 409 un defecto de verdad.
 *
 * <h2>Como se lee el nombre</h2>
 *
 * <p>Del <b>mensaje</b> del motor, y no de la clase del controlador JDBC: esta capa no depende de
 * {@code org.postgresql} y no debe. Es el mismo criterio que {@code choqueDe} de {@code
 * ConvenioRepositoryJdbc} en {@code rentas}. Lo que se busca en cada caso es lo que PostgreSQL
 * escribe:
 *
 * <ul>
 *   <li>un indice unico sale entre comillas dobles, {@code unique constraint "conjunto_uq"}; con
 *       las comillas, {@code conjunto_uq} no casa dentro de {@code conjunto_idempotencia_uq};
 *   <li>un {@code RAISE} de un disparador no tiene restriccion, pero su contexto nombra la funcion,
 *       {@code PL/pgSQL function detalle_de_conjunto_sellado_es_inmutable() line …}. Se exige que
 *       el nombre no vaya pegado a otro identificador, porque {@code conjunto_sellado_es_inmutable}
 *       esta <b>dentro</b> de {@code detalle_de_conjunto_sellado_es_inmutable}.
 * </ul>
 *
 * <p>El mensaje nunca sale por HTTP: lo que sale es el 409 que la operacion escribe, sin una
 * palabra del esquema ({@code ManejadorDeErrores}).
 */
final class CausaEnLaBase {

    /** {@code unique_violation}. */
    static final String VIOLACION_DE_UNICIDAD = "23505";

    /** {@code restrict_violation}, el que lanzan los disparadores de inmutabilidad de V1. */
    static final String VIOLACION_DE_RESTRICCION = "23001";

    private CausaEnLaBase() {}

    /**
     * Si el rechazo es un {@code unique_violation} sobre alguno de esos indices o restricciones.
     */
    static boolean esChoqueDeUnicidadEn(Throwable rechazo, String... restricciones) {
        if (!VIOLACION_DE_UNICIDAD.equals(sqlStateDe(rechazo).orElse(null))) {
            return false;
        }
        String mensajes = mensajesDe(rechazo);
        for (String restriccion : restricciones) {
            if (mensajes.contains('"' + restriccion + '"')) {
                return true;
            }
        }
        return false;
    }

    /** Si el rechazo es el {@code restrict_violation} que lanza esa funcion de disparador. */
    static boolean loRechazoElDisparador(Throwable rechazo, String funcion) {
        if (!VIOLACION_DE_RESTRICCION.equals(sqlStateDe(rechazo).orElse(null))) {
            return false;
        }
        return Pattern.compile("(?<![A-Za-z0-9_])" + Pattern.quote(funcion) + "\\(")
                .matcher(mensajesDe(rechazo))
                .find();
    }

    /** El {@code SQLState} del primer {@link SQLException} de la cadena de causas. */
    private static Optional<String> sqlStateDe(Throwable rechazo) {
        for (@Nullable Throwable causa = rechazo; causa != null; causa = causa.getCause()) {
            if (causa instanceof SQLException sql && sql.getSQLState() != null) {
                return Optional.of(sql.getSQLState());
            }
        }
        return Optional.empty();
    }

    /** Los mensajes de toda la cadena, juntos: el nombre puede venir en cualquiera. */
    private static String mensajesDe(Throwable rechazo) {
        StringBuilder mensajes = new StringBuilder();
        for (@Nullable Throwable causa = rechazo; causa != null; causa = causa.getCause()) {
            String mensaje = causa.getMessage();
            if (mensaje != null) {
                mensajes.append(mensaje).append('\n');
            }
        }
        return mensajes.toString();
    }
}
