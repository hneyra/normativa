import type { ReactNode } from 'react';

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
 */

/**
 * El nombre del sistema, decidido en G2.
 *
 * Sale del artboard V8 —`frontend/diseno/NormativaV8.dc.html`, `const BARRA.titulo`— y no de la
 * V6: la V6 ponia «Sistema de gestión tributaria municipal» (`c01fe9a:src/marco/BarraGlobal.tsx`)
 * y G2 lo cambio por este. Si no cabe, G2 acepto «SGRTM»; quien lo acorte lo hace en el artboard
 * primero, que es donde la decision vive.
 */
export const TITULO = 'Sistema de Gestión de Rentas y Tributos Municipales';

/**
 * **Sin escudo, y a proposito** (G2: «no se porta»).
 *
 * La V6 no lo porto tampoco (`c01fe9a:src/marco/BarraGlobal.tsx:16-19`). Es `undefined` y no un
 * dibujo vacio: el `Armazon` declara `escudo?`, asi que ausente significa «no lo dibujes», y un
 * `<svg>` en blanco seria un hueco que alguien tendria que explicar.
 */
export const ESCUDO: ReactNode = undefined;

/**
 * La linea del pie del carril de modulos, **la del artboard V8** (#58).
 *
 * Sale de `pieArbol` de `NormativaV8.dc.html`, literal. La V6 no tenia pie en el arbol: lo propuso
 * #52 y G2 lo acepto, y dice lo unico que un carril con **un solo modulo** tiene que explicar — que
 * no falta nada, que los demas modulos son de otros sistemas (ADR-0029). Sin esa linea, un arbol de
 * un modulo se lee como un arbol a medio cargar.
 *
 * `undefined` seguiria siendo legitimo —el armazon distingue «no hay pie» de «hay un pie sin
 * texto», y lo segundo deja un filo dibujado bajo el arbol—, pero aqui hay algo que decir.
 */
export const PIE_DEL_CARRIL: string | undefined =
  'El módulo de este sistema y sus submódulos, de src/pantallas/arbol.ts. Los demás módulos son ' +
  'de otros sistemas (ADR-0029).';
