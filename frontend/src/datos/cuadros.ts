import type { Conector } from './conectores.ts';

/**
 * **Cuadros de valuacion: su conector, puesto y vacio** (#63, AC 1 — lo llena #66).
 *
 * Existe hoy por lo mismo que el de Ediciones: `src/datos/conectores.ts` ya lo importa y ya lo
 * coloca, asi que #66 solo cambia el cuerpo de este archivo y no toca ningun registro compartido.
 *
 * <h2>Que pide esta hoja, medido contra lo publicado</h2>
 *
 *   · `GET /conjuntos?ejercicio=` — el conjunto vigente de un ejercicio. `ejercicio` es
 *     **obligatorio** (`docs/50-api/parametros-de-la-api.json`), y la operacion contesta **404 con
 *     `parametroQueFalta`** cuando no hay ninguno sellado. Eso no es un 404 de ruta y no se puede
 *     dibujar como tal, y hay una medida que lo complica: `CuerpoDeProblema` de `@kamayuk/api`
 *     **no conserva `parametroQueFalta`** (`paquetes/api/errores.ts`), que es justo lo que separa
 *     «ese ejercicio no esta publicado» de «esa ruta no existe». Con lo que hay hoy, la unica
 *     manera honesta de distinguirlos es preguntar antes por
 *     `GET /seguridad/parametros/ejercicios/{ejercicio}`, que contesta **200 con `sellado:false`**.
 *   · `GET /conjuntos/{id}/snapshot?ambito=` — las tres tablas nacionales. Su forma publicada trae
 *     `valoresUnitarios`, `depreciaciones` y `valoresReferenciales`, cada una con su
 *     `documentoFuente`.
 *
 * <h2>Y lo que le falta</h2>
 *
 * · **El tamano.** La V6 media decenas de miles de filas en estas tablas, y el snapshot llega
 *   entero en una sola respuesta: la paginacion que necesita es la **de cliente**
 *   (`paginacion: { en: 'cliente' }`, `kamayuk-lib`#61), no la de servidor que usa el listado.
 * · **Los campos y la prosa de `kamayuk-lib`#86**, que es lo que bloquea a #66 ademas de esto.
 * · **Ni una cifra inventada**: las tablas de valuacion son norma nacional, y una fila de ejemplo en
 *   esta hoja se leeria como un valor unitario de verdad. Lo vigila `sin-cifras-inventadas`.
 */
export const CUADROS: Conector | undefined = undefined;
