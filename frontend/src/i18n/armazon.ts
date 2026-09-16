import type { TextosDelArmazon } from '@kamayuk/shell';

import { TEXTOS_DEL_PIE } from '../pantallas/avisos.ts';

/**
 * **Las palabras del marco** — costura de #55, la llena #60.
 *
 * <h2>`undefined` no era «sin texto»: era «los de la libreria»</h2>
 *
 * `@kamayuk/shell` trae las treinta y una palabras que el marco dice por su cuenta —«No hay ningun
 * destino abierto…», «Guardar», «Buscar»— en castellano, y `textos?` es un `Partial`: lo que no se
 * pasa sale como ellas. Hasta #58 aqui iba `undefined`, y el marco hablaba entero con las suyas.
 *
 * Lo contrario —un objeto con las treinta y una copiadas aqui— seria una segunda fuente de verdad
 * que se queda vieja en silencio la primera vez que la libreria corrija una: `textos.ts` de
 * `@kamayuk/shell` dice por escrito que traducir el marco no puede ser todo o nada, y por eso es
 * `Partial`.
 *
 * <h2>Las DOS que este sistema dice distinto, y por que entran aqui (#58)</h2>
 *
 * Son los avisos del pie de una pantalla, y los dibuja el marco —`avisoDelPie(destino, textos)` de
 * `paquetes/shell/acciones.ts`—, no el interprete: `TextosDelInterprete` y `TextosDeLasPiezas` no
 * tienen ninguna clave para ellos, asi que pasarselos a `<Pantalla>` no los dibujaria en ningun
 * sitio. Viven en `src/pantallas/avisos.ts`, que es donde una guarda los compara **literales**
 * contra el artboard; aqui solo se enchufan.
 *
 * El de escritura coincide byte a byte con el de la libreria. El de consulta **no**: el suyo dice
 * «Los datos son los que figuran a la fecha de hoy», que es cierto en `rentas` —un padron cambia
 * cada dia— y falso aqui, donde lo que se ensena es un conjunto SELLADO que no cambia con la fecha.
 *
 * <h2>Que hace #60 con esto</h2>
 *
 * Monta `i18next` con el español como clave —la decision de la epica #47— y pasa por aqui solo lo
 * que este sistema diga distinto del resto, **estas dos incluidas**: son texto de interfaz y se
 * traducen como el resto. El tipo ya estaba escrito para que ese PR no tenga que tocar
 * `aplicacion.tsx`, y sigue sin tener que tocarlo.
 */
export const TEXTOS_DEL_MARCO: Partial<TextosDelArmazon> | undefined = TEXTOS_DEL_PIE;
