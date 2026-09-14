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
 *
 * <h2>Lo que salio con la V6 (#50), y donde vuelve</h2>
 *
 * Hasta `c01fe9a` este archivo importaba `src/` para cinco barreras mas: que `solicitar` no
 * admite un metodo inventado ni devuelve `any`, que `Aplicacion` no admite props, que `Importe`
 * no compila sin `fechaCalculo` —con JSX y con `createElement`— ni con un `number`, que
 * `formatearImporte` no recibe un `number` y que `Insignia` no compila sin texto. Las piezas que
 * median salieron con la V6, y sus barreras vuelven con las que las sustituyen: `Importe` e
 * `Insignia` desde `@kamayuk/ui` (#55, como en `rentas`), el cliente desde `@kamayuk/api` (#57).
 * Queda la mitad que no importa nada: la que prueba el propio compilador.
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
