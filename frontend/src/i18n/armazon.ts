import type { TextosDelArmazon } from '@kamayuk/shell';

import { TEXTOS_DEL_MARCO_TRADUCIDOS } from './textosDelMarco.ts';

/**
 * **Las palabras del marco** — costura de #55, la lleno #58 con dos y **#60 con las treinta y dos**.
 *
 * <h2>Lo que esta costura decia hasta este issue, y por que cambia</h2>
 *
 * Decia que `undefined` no era «sin texto» sino «los de la libreria», y que copiar aqui las treinta
 * y una restantes seria «una segunda fuente de verdad que se queda vieja en silencio la primera vez
 * que la libreria corrija una». **Era cierto mientras nadie las tradujera**: una copia que solo
 * repite no aporta nada y solo puede divergir.
 *
 * Desde #60 aporta, porque el castellano **es la clave** del locale: lo que no pase por `t()` no
 * tiene clave, y un segundo idioma dejaria el marco entero en castellano con el cuerpo traducido —
 * que no se lee como un marco sin traducir sino como una traduccion rota. Y la divergencia dejo de
 * ser silenciosa: `src/i18n/textosDelMarco.ts` declara las frases con
 * `satisfies Record<keyof TextosDelArmazon, string>` —una de menos no compila— y
 * `verificaciones/todo-el-texto-se-traduce.test.tsx` compara el saco entero contra
 * `TEXTOS_DEL_ARMAZON` de `@kamayuk/shell` y sale rojo **nombrando** la que falte o la que sobre.
 *
 * <h2>Las DOS que este sistema dice distinto (#58) siguen siendo distintas</h2>
 *
 * Son los avisos del pie de una pantalla, y los dibuja el marco —`avisoDelPie(destino, textos)` de
 * `paquetes/shell/acciones.ts`—, no el interprete. Viven en `src/pantallas/avisos.ts`, que es donde
 * una guarda los compara **literales** contra el artboard; entran al saco desde alli y no se
 * reescriben aqui. El de escritura coincide byte a byte con el de la libreria; el de consulta
 * **no**: el suyo dice «Los datos son los que figuran a la fecha de hoy», que es cierto en `rentas`
 * —un padron cambia cada dia— y falso aqui, donde lo que se ensena es un conjunto SELLADO.
 *
 * <h2>Y `aplicacion.tsx` sigue sin tocarse, que era lo que esta costura prometia</h2>
 *
 * Lo que se exporta es un objeto de **captadores**: `t()` corre cuando el marco lee la propiedad, no
 * cuando este modulo se importa. Por eso no hace falta ningun `useTranslation()` en
 * `src/aplicacion.tsx` —que es de #55, y `verificaciones/la-costura-es-la-que-es.test.ts` da rojo si
 * ese archivo importa `react-i18next`— y por eso este PR no lo abre. Lo que un captador NO puede
 * hacer esta dicho donde se decide: `alCambiarElIdioma`, en `i18n.ts`.
 */
export const TEXTOS_DEL_MARCO: TextosDelArmazon = TEXTOS_DEL_MARCO_TRADUCIDOS;
