import { solicitar } from '../../src/api/cliente.ts';
import { Aplicacion } from '../../src/aplicacion.tsx';

/**
 * Las barreras que pone el COMPILADOR, y la prueba de que muerden.
 *
 * Este archivo no es una prueba de vitest: es una prueba de `tsc`, y se apoya en una
 * propiedad de `@ts-expect-error` que ninguna asercion tiene — **`@ts-expect-error` falla
 * cuando NO hay error**:
 *
 *     error TS2578: Unused '@ts-expect-error' directive.
 *
 * O sea que cada bloque de aqui abajo dice «esto tiene que no compilar», y si un dia
 * compila, `yarn typecheck` se pone rojo por eso mismo. Una prueba que comprobara lo mismo
 * con un `expect` no podria: para escribirla habria que escribir primero el codigo que no
 * compila, y entonces no compilaria la prueba.
 *
 * Y es la otra mitad de `andamiaje.test.ts`. Aquella lee `tsconfig.base.json` y comprueba
 * que las banderas **estan escritas**; esta comprueba que **hacen algo**. Las dos hacen
 * falta: una bandera puede estar puesta y no aplicar a este arbol —`include` mal escrito,
 * un `tsconfig` que no se extiende— y el JSON seguiria diciendo `true`.
 *
 * Va aparte de `src/` a proposito: aqui vive codigo que **esta mal escrito queriendo**, y
 * no tiene nada que hacer en el arbol que se empaqueta.
 */

/**
 * NO lleva `eslint-disable`, y se comprobo antes de no ponerlo: lo que este archivo
 * incumple son reglas del COMPILADOR, no prohibiciones de ESLint, asi que `yarn lint` pasa
 * sobre el limpio. Un `eslint-disable` preventivo saldria como «Unused eslint-disable
 * directive» —lo dijo ESLint la primera vez— y, peor, apagaria las prohibiciones para la
 * barrera que alguien anada manana sin que nadie lo decida.
 */

/** Las filas de un cuadro, tal como llegarian del conjunto sellado. */
const filas: readonly string[] = ['412.88'];

/**
 * `noUncheckedIndexedAccess` muerde.
 *
 * Sin el, `filas[0]` es `string` y la lista vacia da `undefined` en tiempo de ejecucion:
 * en una pantalla de cifras eso se muestra como «undefined» o, peor, como «NaN» despues
 * de pasar por cualquier formateo.
 */
export function primeraFila(): string {
  // @ts-expect-error — `filas[0]` es `string | undefined`: el cuadro puede venir vacio.
  return filas[0];
}

/**
 * `strict` muerde: `undefined` no se cuela en un `string`.
 *
 * Es la bandera de la que cuelgan las demas. Sin ella, las otras dos no significan nada.
 */
export function sinValor(): string {
  const nada: string | undefined = undefined;
  // @ts-expect-error — `undefined` no es un `string`.
  return nada;
}

/**
 * El cliente de API no admite un metodo que no sea de su lista.
 *
 * La lista es cerrada a proposito: un `TRACE` o un `HEAD` sueltos no fallan al escribirlos
 * sino contra un backend que contesta 405, y eso se descubre desplegado.
 */
export const metodoInventado = solicitar('/conjuntos/2026', {
  // @ts-expect-error — «TRACE» no es uno de los metodos que el cliente admite.
  metodo: 'TRACE',
});

/**
 * `solicitar<T>` devuelve **lo que se le pide**, no `any`.
 *
 * Si devolviera `any`, todo lo que viene detras dejaria de comprobarse: la UIT se podria
 * sumar, restar y comparar con un numero sin que el compilador dijera nada, y las reglas
 * de ESLint de este mismo repositorio serian la unica barrera que queda.
 */
export async function elTipoNoEsAny(): Promise<number> {
  const conjunto = await solicitar<{ readonly uit: string }>('/conjuntos/2026');
  // @ts-expect-error — `uit` es texto decimal (regla 1), no un `number`.
  return conjunto.uit;
}

/**
 * `tsc` mira de verdad el JSX.
 *
 * Es una propiedad del andamiaje y no de un componente: si `jsx` o `@types/react` no
 * estuvieran enchufados, la mitad `.tsx` del arbol pasaria sin comprobar y nada lo diria.
 */
export const cascoConPropInventada = (
  // @ts-expect-error — `Aplicacion` no declara ninguna prop.
  <Aplicacion titulo="Normativa" />
);
