/**
 * El guardia: los siete privilegios del manual, comprobados <b>en el servidor</b> (ADR-0005,
 * RF-121).
 *
 * <p>Que la interfaz oculte una opcion de menu es comodidad, no seguridad: la peticion se puede
 * hacer igual con {@code curl}. La comprobacion que cuenta es esta, y ocurre antes de que el
 * controlador reciba el control.
 *
 * <h2>Por que esta aqui y no en el contexto que administra la seguridad</h2>
 *
 * <p>Todo contexto declara su acceso con {@link kamayuk.normativa.autorizacion.RequiereAcceso}, asi
 * que la anotacion y el enum tienen que estar en un modulo que todos puedan importar. Si vivieran
 * en el contexto de seguridad, cada contexto dependeria de el —lo que ARQ-01 admite— pero aquel no
 * podria aplicar las mismas convenciones sin depender de si mismo.
 *
 * <p>De ahi el reparto: aqui el <b>contrato</b> —la anotacion, el enum y el puerto {@link
 * kamayuk.normativa.autorizacion.ComprobadorDeAcceso}—, y en el contexto de seguridad la
 * <b>implementacion</b>, que es la que sabe de {@code acceso}, {@code grupo}, {@code miembro} y
 * {@code permiso}. La capa web no conoce el modelo de autorizacion; solo sabe preguntarle.
 *
 * <p><b>Este sistema no tiene ese contexto</b>, y por eso {@code ComprobadorDeAcceso} aqui no tiene
 * implementacion propia: `normativa` publica datos sellados y su unico contexto acotado es {@code
 * parametros} (ADR-0025). El contrato viaja igual porque la capa web es la misma —llego copiada de
 * `rentas` en P5B—, y quien lo implemente sera quien despliegue este servicio.
 */
@org.jspecify.annotations.NullMarked
package kamayuk.normativa.autorizacion;
