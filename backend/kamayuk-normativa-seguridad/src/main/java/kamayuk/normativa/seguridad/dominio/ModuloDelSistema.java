package kamayuk.normativa.seguridad.dominio;

/**
 * Un modulo del catalogo de este sistema, tal como esta en {@code modulo_sistema} (#54).
 *
 * <p>Lo siembra {@code SembradorDelCatalogo} a partir de {@link CatalogoDelSistema}: hoy es
 * <b>uno</b>, {@code SEGURIDAD}, con la unica opcion que este sistema declara ({@code parametros}).
 * ADR-0043 §2 agrega {@code NORMATIVA} con {@code conjuntos}, y eso lo trae #53: esta lectura
 * publica lo que haya, sin listas escritas.
 *
 * @param id el identificador de la fila; es lo que {@link AccesoDelSistema#moduloId()} nombra
 * @param codigo el codigo del catalogo, en mayusculas
 * @param nombre el rotulo con que la municipalidad lo llama
 * @param orden la posicion en el menu. <b>Hoy es 0 en todas las filas</b>: el sembrador no lo
 *     escribe y nadie mas escribe esta tabla, asi que el orden efectivo es el del desempate por
 *     {@code id}, que es el orden de siembra
 * @param activo un modulo retirado se desactiva; no se borra (RNF-051). La lectura <b>no</b> lo
 *     filtra: decidir que hacer con un inactivo es de quien compone el menu
 */
public record ModuloDelSistema(long id, String codigo, String nombre, int orden, boolean activo) {}
