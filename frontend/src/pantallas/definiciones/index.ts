import type { ClaveDeHoja } from '../arbol.ts';
import type { Pantalla } from '../tipos.ts';
import { CUADROS } from './cuadros.ts';
import { EDICIONES } from './ediciones.ts';
import { PANEL } from './panel.ts';
import { PUBLICACION } from './publicacion.ts';

/**
 * **Las cuatro pantallas del artboard V8**, reunidas (#58, AC 2).
 *
 * Una por hoja del arbol, en los cuatro archivos de al lado. Aqui solo se juntan, y juntarlas es lo
 * que pone a trabajar al compilador:
 *
 * `satisfies Record<ClaveDeHoja, Pantalla>` —sin `Partial`— exige **las cuatro**. Una hoja nueva en
 * el arbol sin su pantalla no compila, y una pantalla cuya clave no sea de ninguna hoja, tampoco.
 * «Cero hojas sin pantalla y cero pantallas sin hoja» deja de ser algo que haya que acordarse de
 * comprobar.
 *
 * Que ademas **digan lo que el artboard dice** es otra cosa, y de eso responde la guarda
 * anti-deriva `verificaciones/pantallas-del-artboard.test.ts`: el compilador cuenta, no lee.
 *
 * El orden de los cuatro es el del arbol —panel, ediciones, cuadros, publicacion— y no el
 * alfabetico de los `import`: es el orden en que se dibujan y el que la guarda compara.
 */
export const PANTALLAS = {
  ...PANEL,
  ...EDICIONES,
  ...CUADROS,
  ...PUBLICACION,
} satisfies Record<ClaveDeHoja, Pantalla>;

/** La pantalla de una hoja. Con `ClaveDeHoja` no hay caso «no existe» que tratar. */
export const pantallaDe = (clave: ClaveDeHoja): Pantalla => PANTALLAS[clave];
