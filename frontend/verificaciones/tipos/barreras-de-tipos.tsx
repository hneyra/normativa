import { createElement } from 'react';

import { solicitar } from '../../src/api/cliente.ts';
import { Aplicacion } from '../../src/aplicacion.tsx';
import { formatearImporte } from '../../src/dominio/formato.ts';
import { Importe, Insignia } from '../../src/ds/index.ts';

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
 * Sobre el `eslint-disable` del final: hasta #11 este archivo NO llevaba ninguno, y estaba
 * escrito por que —lo que incumplia eran reglas del COMPILADOR, no prohibiciones de ESLint,
 * asi que `yarn lint` pasaba limpio—. Con las barreras de `Importe` deja de ser cierto: un
 * `<Importe valor="…" />` sin fecha viola **a la vez** el tipo y la prohibicion
 * `importe-sin-fecha`, que es justamente lo que se viene a demostrar. Asi que el
 * `eslint-disable` va **acotado a ese bloque y reactivado despues** con `eslint-enable`, en
 * vez de puesto en la cabecera: si cubriera el archivo entero, apagaria las prohibiciones
 * para la barrera que alguien anada manana sin que nadie lo decida.
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

/* ════════════════════════════════════════════════════════════════════════════════════
   Las barreras del sistema de diseno (#11).

   A partir de aqui el codigo viola tambien prohibiciones de ESLint, y **eso es lo que se
   viene a demostrar**: un `Importe` sin su fecha esta prohibido por el TIPO y por la
   regla, y las dos barreras tienen que poder verse fallar. El `eslint-disable` esta
   acotado a este bloque y se reactiva al final: apagarlo para el archivo entero dejaria
   sin proteccion a la barrera que alguien escriba manana.
   ════════════════════════════════════════════════════════════════════════════════════ */
/* eslint-disable no-restricted-syntax -- este bloque VIOLA las reglas a proposito: es lo que verifica */

/**
 * AC8, primera barrera: `<Importe>` sin `fechaCalculo` no compila.
 *
 * La segunda barrera es la prohibicion `importe-sin-fecha` de ESLint, con su muestra en
 * `verificaciones/muestras/importe-sin-fecha.tsx`. **Hacen falta las dos, y en
 * `reglas-de-eslint.test.ts` esta medido en los dos sentidos**: el tipo no ve un
 * `<Importe {...props} />` donde `props` viene de un `any`; ESLint no ve un
 * `createElement(Importe, …)`. Ademas, esta sobrevive a que alguien apague la regla, y
 * aquella sobrevive a que alguien le ponga un valor por omision al tipo.
 */
export const importeSinFecha = (
  // @ts-expect-error — falta `fechaCalculo`, que es obligatoria: no existe «la cifra», existe la cifra vigente a una fecha (regla 9, RNF-075).
  <Importe valor="894.27" />
);

/** Y no vale ponersela a `undefined` para callar al compilador. */
export const importeConFechaIndefinida = (
  // @ts-expect-error — `undefined` no es una `Fecha`.
  <Importe valor="894.27" fechaCalculo={undefined} />
);

/**
 * **Lo que ESLint NO puede ver, y el tipo si.**
 *
 * `createElement` no produce un `JSXOpeningElement`, asi que la prohibicion
 * `importe-sin-fecha` no lo mira: su selector habla de JSX. El tipo si lo ve, porque
 * `createElement` esta tipado sobre las props del componente. Es la mitad del AC8 que
 * justifica tener dos barreras y no una.
 */
export const importeSinFechaSinJsx = createElement(
  Importe,
  // @ts-expect-error — falta `fechaCalculo`, y aqui no hay JSX que ESLint pueda mirar.
  { valor: '894.27' },
);

/**
 * Regla 1: una cifra es texto, jamas `number`. En coma flotante `894.27` ya ha perdido la
 * forma con la que llego, y `0.1 + 0.2` no es `0.30`.
 */
export const importeComoNumero = (
  // @ts-expect-error — `number` no es un `Importe`.
  <Importe valor={894.27} fechaCalculo="2026-09-06" />
);

/** Lo mismo, una capa mas abajo: el formateador tampoco acepta un `number`. */
export function formatearUnNumero(): string {
  // @ts-expect-error — `formatearImporte` recibe texto decimal, no `number`.
  return formatearImporte(894.27);
}

/**
 * AC9: una insignia sin texto no compila.
 *
 * Un estado que se comunica solo por color no se comunica a quien no distingue ese color, y
 * lo que estas insignias dicen es si un ejercicio esta SELLADO o abierto.
 */
export const insigniaSinTexto = (
  // @ts-expect-error — falta el texto del estado; el color no es el unico canal.
  <Insignia tono="ok" />
);

/** Y el tono es uno de los cuatro del artboard, no una cadena cualquiera. */
export const insigniaConTonoInventado = (
  // @ts-expect-error — «verde» no es un `Tono`.
  <Insignia tono="verde">Sellado</Insignia>
);

/* eslint-enable no-restricted-syntax */
