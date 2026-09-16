import type { ReactNode } from 'react';

import { alCambiarElIdioma, t } from './i18n/i18n.ts';

/**
 * **La marca de este sistema en la barra global** — una de las ocho costuras de #55.
 *
 * <h2>Que es una costura, y por que hay ocho</h2>
 *
 * `src/aplicacion.tsx` lo toca **solo este issue** (epica #47, «Para que los issues de una ola no
 * se pisen»). Todo lo que el `Armazon` recibe sale de un archivo como este, asi que #57, #58, #60,
 * #63 y #64 pueden ir en paralelo sin tocar el mismo archivo ni una vez.
 *
 * <h2>Lo que este archivo SI puede llevar, y lo que no</h2>
 *
 * Puede llevar lo que nombra al SISTEMA, que es lo mismo en las veinte municipalidades que lo
 * instalen. **No puede llevar el nombre de una municipalidad ni el de una cuenta**: eso es dato de
 * la sesion y vive en `src/sesion.ts`. Es la decision G2 (comentario del dueño en #52, 2026-09-15,
 * aplicada al artboard en #76), y no es de estilo: «Municipalidad Distrital de Catacaos» escrita
 * aqui la veria cualquier municipalidad que no sea Catacaos, y ninguna prueba sobre los valores lo
 * notaria. `rentas` la tuvo en su marco hasta su I-1.
 *
 * **Diferencia declarada con el AC 3 de #55**: aquella tabla ponia `entidad` en este archivo,
 * «transcrita de la V6» (`c01fe9a:src/marco/Marco.tsx:43`). G2 se decidio despues y la movio a la
 * sesion, asi que `entidad` esta en `src/sesion.ts`. Lo demas de la fila —`titulo`, `escudo`,
 * `pieDelCarril`— sigue aqui.
 *
 * <h2>Y desde #60 lo que se exporta esta TRADUCIDO, no escrito</h2>
 *
 * Las frases siguen aqui —son la clave, porque el castellano es la clave (epica #47)— y lo que sale
 * por `TITULO` y `PIE_DEL_CARRIL` es lo que `t()` devuelve. Ver {@link FRASES_DE_LA_MARCA}.
 */

/**
 * **Lo que este archivo dice, en castellano, que es la clave** (#60).
 *
 * Existe para que las dos frases entren solas en el inventario del locale
 * —`src/i18n/catalogo-de-claves.ts`— en vez de tener que acordarse de listarlas: un olvido ahi no
 * produce ningun rojo, porque lo que nadie lista tampoco nadie lo echa de menos.
 */
export const FRASES_DE_LA_MARCA = {
  /**
   * El nombre del sistema, decidido en G2.
   *
   * Sale del artboard V8 —`frontend/diseno/NormativaV8.dc.html`, `const BARRA.titulo`— y no de la
   * V6: la V6 ponia «Sistema de gestión tributaria municipal»
   * (`c01fe9a:src/marco/BarraGlobal.tsx`) y G2 lo cambio por este. Si no cabe, G2 acepto «SGRTM»;
   * quien lo acorte lo hace en el artboard primero, que es donde la decision vive.
   */
  titulo: 'Sistema de Gestión de Rentas y Tributos Municipales',

  /**
   * La linea del pie del carril de modulos, **la del artboard V8** (#58).
   *
   * Sale de `pieArbol` de `NormativaV8.dc.html`, literal. La V6 no tenia pie en el arbol: lo
   * propuso #52 y G2 lo acepto, y dice lo unico que un carril con **un solo modulo** tiene que
   * explicar — que no falta nada, que los demas modulos son de otros sistemas (ADR-0029). Sin esa
   * linea, un arbol de un modulo se lee como un arbol a medio cargar.
   */
  pieDelCarril:
    'El módulo de este sistema y sus submódulos, de src/pantallas/arbol.ts. Los demás módulos son ' +
    'de otros sistemas (ADR-0029).',
} as const;

/**
 * El nombre del sistema, ya traducido. Ver {@link FRASES_DE_LA_MARCA.titulo}.
 *
 * **`let` y no `const`, y esa es la unica forma que hay** (#60): `src/aplicacion.tsx` lo consume
 * como una CADENA suelta —`titulo={TITULO}`— y una cadena exportada no se puede traducir al leerla,
 * como si se puede una propiedad de un objeto. Asi que se rehace cuando cambia el idioma y
 * `aplicacion.tsx`, que la lee dentro de su funcion de pintada, ve el valor nuevo en la siguiente
 * sin que ese archivo cambie ni una linea —es de #55 y no lo toca nadie mas (epica #47)—. El limite
 * de esto, escrito: `alCambiarElIdioma` en `src/i18n/i18n.ts`.
 */
export let TITULO: string = FRASES_DE_LA_MARCA.titulo;

/**
 * **Sin escudo, y a proposito** (G2: «no se porta»).
 *
 * La V6 no lo porto tampoco (`c01fe9a:src/marco/BarraGlobal.tsx:16-19`). Es `undefined` y no un
 * dibujo vacio: el `Armazon` declara `escudo?`, asi que ausente significa «no lo dibujes», y un
 * `<svg>` en blanco seria un hueco que alguien tendria que explicar.
 */
export const ESCUDO: ReactNode = undefined;

/**
 * La linea del pie del carril, ya traducida. Ver {@link FRASES_DE_LA_MARCA.pieDelCarril}.
 *
 * `undefined` seguiria siendo legitimo —el armazon distingue «no hay pie» de «hay un pie sin
 * texto», y lo segundo deja un filo dibujado bajo el arbol—, pero aqui hay algo que decir. El
 * `let`, por lo mismo que {@link TITULO}.
 */
export let PIE_DEL_CARRIL: string | undefined = FRASES_DE_LA_MARCA.pieDelCarril;

/** Las dos, rehechas en el idioma de la sesion. Ver `alCambiarElIdioma` en `src/i18n/i18n.ts`. */
alCambiarElIdioma(() => {
  TITULO = t(FRASES_DE_LA_MARCA.titulo);
  PIE_DEL_CARRIL = t(FRASES_DE_LA_MARCA.pieDelCarril);
});
