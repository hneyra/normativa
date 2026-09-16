import type { FallaDeLaPuerta, Vuelta } from '@kamayuk/sesion';

/**
 * **Por que no se entro, cuando no se entro** (#57, AC 4).
 *
 * <h2>Son DOS cosas distintas, y las dos dejan la pantalla muda si no se cuentan</h2>
 *
 *   · **No se pudo llegar al emisor** (`FallaDeLaPuerta`, de `rentas`#112): el emisor apagado, un
 *     DNS que no resuelve, una espera agotada. La navegacion se rechaza y no queda ni documento
 *     nuevo ni aplicacion — medido alli: `body.innerText` vacio y la consola con dos lineas de
 *     Vite, ni un error.
 *   · **El emisor no dejo entrar** (`Vuelta` con `estado: 'fallo'`): volvimos con un `?error=`.
 *     Aqui la pagina si esta, pero la causa vive en una cadena de la URL que el canje **borra**, y
 *     lo que quedaria en pantalla es el armazon vacio sin sesion.
 *
 * <h2>El segundo no es de la libreria, y esto es lo que lo hace visible</h2>
 *
 * `canjearSiVuelve()` devuelve el motivo —ya no es un `false` mudo—, pero **no lo recuerda**: quien
 * llama lo tiene una vez y lo pierde. La V6 de este sistema tenia `ultimoFalloDeLaPuerta()` por
 * exactamente eso, y su docblock dice por que hacia falta aqui y no en `rentas`
 * (`c01fe9a:src/api/identidad.test.ts:273-304`): alli el casco pide `GET /seguridad/sesion` al
 * montar y un canje fallido acaba saliendo como un 401 que la puerta explica; **esta interfaz no
 * tiene ninguna lectura obligatoria al arrancar**, asi que un canje fallido se quedaria mudo.
 *
 * Y hay algo peor que quedarse mudo, que es el motivo de que ademas **se pare la ida**: sin esto el
 * arranque volveria a la puerta, el emisor devolveria el mismo error, y a la tercera vuelta el tope
 * pararia sin una palabra de la causa. Tres rebotes y una pantalla en blanco.
 *
 * No se copia nada de la libreria para conseguirlo: se guarda lo que ella devuelve. Si algun dia
 * `@kamayuk/sesion` lo recuerda por su cuenta, este archivo se queda en una linea.
 *
 * <h2>Por que es un modulo propio y no una variable de `arranque.ts`</h2>
 *
 * En `rentas` esta variable vive en `src/arranque.ts` y la lee `src/aplicacion.tsx`
 * (`ac379ac:src/arranque.ts:111`). Aqui no se puede: `src/aplicacion.tsx` **lo toca solo #55**
 * (epica #47), asi que quien dibuja es `PuertaCaida`, una costura de `src/sesion.ts`. Y
 * `src/arranque.ts` importa la `identidad` de `src/sesion.ts`, asi que dejar la variable en el
 * arranque cerraria el circulo: `sesion -> arranque -> sesion`.
 *
 * Un ciclo de modulos en ESM no revienta al cargar: deja una de las dos mitades a medio evaluar, y
 * lo que se ve es un `undefined` en una constante que el codigo de al lado da por puesta. Es un
 * fallo que aparece en el navegador y no en `tsc`. Partirlo aqui lo hace imposible: lo escribe el
 * arranque, lo lee la costura, y ninguno de los dos importa al otro.
 *
 * <h2>No hace falta que sea reactivo, y se dice por que</h2>
 *
 * `arrancar()` lo fija **antes** de llamar a `montar()` —el montaje es lo ultimo que esa funcion
 * hace, y ese es todo su diseno—, asi que en la primera pintada ya esta puesto.
 */

/** Lo que impidio entrar, dicho con lo que hace falta para arreglarlo. */
export type PorQueNoSeEntro =
  | { readonly tipo: 'no-contesto'; readonly falla: FallaDeLaPuerta }
  | { readonly tipo: 'no-dejo-entrar'; readonly motivo: string; readonly detalle: string };

let elPorQue: PorQueNoSeEntro | null = null;

/**
 * Lo que el arranque anota antes de montar. Cada pasada lo vuelve a fijar —con `null` cuando no lo
 * hubo—, asi que no hay estado viejo que arrastrar de una a otra.
 */
export function fijarElPorQue(porQue: PorQueNoSeEntro | null): void {
  elPorQue = porQue;
}

/**
 * Lo mismo, a partir de lo que devolvio `canjearSiVuelve()`.
 *
 * Devuelve si hubo fallo, que es lo que decide si se para la ida a la puerta. Una vuelta
 * `sin-vuelta` o `canjeado` **no toca** lo que ya hubiera anotado: en la pasada de un arranque la
 * unica que llega antes es la de `fijarElPorQue(null)`.
 */
export function anotarLaVuelta(vuelta: Vuelta): boolean {
  if (vuelta.estado !== 'fallo') return false;
  elPorQue = { tipo: 'no-dejo-entrar', motivo: vuelta.motivo, detalle: vuelta.detalle };
  return true;
}

/**
 * Por que no se entro, si es que no se entro.
 *
 * `null` en todo lo demas, **incluido el caso normal de ir a la puerta** — ese no monta nada, asi
 * que nadie llega a preguntar.
 */
export function porQueNoSeEntro(): PorQueNoSeEntro | null {
  return elPorQue;
}
