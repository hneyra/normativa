package kamayuk.normativa.seguridad.dominio;

import kamayuk.normativa.dominio.Ejercicio;
import org.jspecify.annotations.Nullable;

/**
 * Quien es la sesion en curso: la cuenta del token, ya resuelta a la fila de {@code usuario} de
 * <b>esta</b> municipalidad (#54, la gemela de {@code rentas}#559 y de {@code catastro}#117).
 *
 * <p>Son dos hechos de dos tablas en un solo valor: {@code usuario} dice quien es y {@code sesion}
 * dice sobre que ejercicio trabaja. Publicarlos por separado obligaria a la interfaz a componer la
 * relacion entre la persona y su sesion, que es justo lo que no debe componer.
 *
 * <p>{@link #usuarioId()} es el de esta municipalidad: la misma persona en dos municipalidades son
 * dos filas de {@code usuario} con dos identificadores, y por eso no sale del token —que trae la
 * cuenta— sino de la consulta.
 *
 * @param ejercicioDeTrabajo el ejercicio que la sesion abierta tiene <b>registrado</b>, o {@code
 *     null} si no hay ningun acto que lo diga. <b>En este sistema es nulo siempre</b>: {@code
 *     normativa} no publica {@code PUT /seguridad/sesion/ejercicio} y <b>nada escribe {@code
 *     sesion}</b> —la tabla existe en {@code V1} y ningun {@code INSERT INTO sesion} aparece en
 *     {@code src/main}—. Poner aqui el año del reloj afirmaria que alguien lo eligio (AC-5)
 */
public record Identidad(
        long usuarioId, String cuenta, String nombre, @Nullable Ejercicio ejercicioDeTrabajo) {}
