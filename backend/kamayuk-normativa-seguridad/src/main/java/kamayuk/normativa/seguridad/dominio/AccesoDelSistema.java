package kamayuk.normativa.seguridad.dominio;

/**
 * Una opcion del catalogo de este sistema, tal como esta en {@code acceso} (#54).
 *
 * <p>El {@link #codigo()} es el mismo que declara el endpoint en {@code @RequiereAcceso} y el mismo
 * que trae la matriz de permisos de la sesion: es lo que ata un permiso a una pantalla. Y {@link
 * #moduloId()} es lo unico que ata esa pantalla a un modulo —la matriz es una bolsa plana de
 * codigos y no dice a que modulo pertenece cada uno—, que es por lo que esta lectura hace falta (el
 * menu de #64 filtra por modulo).
 *
 * @param id el identificador de la fila
 * @param moduloId la fila de {@code modulo_sistema} de la que cuelga ({@code acceso_modulo_fk})
 * @param tipo {@code OPCION_MENU} o {@code POLITICA}, lo unico que admite {@code acceso_tipo_check}
 * @param codigo el id de la opcion en el catalogo de pantallas (NEG-03)
 * @param nombre el rotulo de la opcion
 * @param activo una opcion retirada se desactiva; los permisos que cuelgan de ella son constancia.
 *     La lectura no la filtra
 */
public record AccesoDelSistema(
        long id, long moduloId, String tipo, String codigo, String nombre, boolean activo) {}
