import type { Fecha, Importe } from './valores.ts';

/**
 * Como se escriben una cifra y una fecha en la pantalla.
 *
 * Las dos funciones son **puras y trabajan sobre texto**. Ninguna construye un `Number` ni
 * un `Date`, y no es una preferencia de estilo:
 *
 *   · Un `Number` pierde centimos (regla 1). `Number("0.1") + Number("0.2")` no es `0.3`, y
 *     aunque aqui no se sume, convertir y volver a escribir ya redondea:
 *     `String(Number("104740.005"))` no promete nada con quince digitos por delante.
 *   · Un `Date` arrastra la zona horaria del puesto. `new Date("2026-09-06")` se interpreta
 *     en UTC y se imprime en local: en Lima sale el **5**. Una edicion normativa que cambia
 *     de dia segun donde este el navegador no es un detalle de formato.
 *
 * Y ninguna redondea. Si llega una cifra con tres decimales, esta funcion **falla** en vez
 * de recortarla: recortar es aritmetica, la decide el backend con su `NUMERIC(x,y)`, y un
 * decimal que desaparece al pintarlo no deja rastro en ningun sitio. En un sistema cuyo
 * unico producto son cifras selladas, pintar una cifra distinta de la sellada es el peor
 * fallo posible, y es silencioso.
 */

/** El separador de miles del artboard: `104,740.00` en el cuadro de valores referenciales. */
const MILES = ',';

/** El separador decimal: el mismo que trae el dato, asi que no se traduce. */
const DECIMAL = '.';

/**
 * Una cifra servida por el backend: opcionalmente negativa, con 0..2 decimales.
 *
 * Dos decimales y no mas porque es lo que los tres cuadros y los parametros publican
 * (`NUMERIC(14,2)` y compania). Si algun dia una alicuota necesitara mas, se amplia aqui y
 * la prueba lo dice; lo que no puede pasar es que llegue y se recorte sola.
 */
const CIFRA_SERVIDA = /^-?\d+(\.\d{1,2})?$/;

/** Una fecha ISO sin hora. */
const FECHA_SERVIDA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `"104740.5"` -> `"104,740.50"`.
 *
 * Agrupa de tres en tres y completa a dos decimales. Lo hace con texto, asi que una cifra
 * de quince digitos sale igual de exacta que una de tres.
 *
 * **Sin simbolo de moneda, y es una decision del artboard, no un olvido.** NormativaV6
 * pone la moneda en la CABECERA de la columna —«Valor por m² (S/)», «Valor (S/)»— y deja
 * las celdas con la cifra sola. Tiene sentido aqui y no lo tendria en un sistema de cobro:
 * lo que este publica son cuadros enteros de una misma unidad, y repetir «S/» en 54 129
 * filas es ruido; ademas hay columnas que no son soles —una alicuota es un porcentaje— y un
 * simbolo puesto por omision las convertiria en dinero.
 */
export function formatearImporte(valor: Importe): string {
  const limpio = valor.trim();

  if (!CIFRA_SERVIDA.test(limpio)) {
    // Falla ruidosamente y nombra el valor. La alternativa —devolver el texto tal cual—
    // pinta «104740.005» en una columna de cifras y nadie lo mira dos veces; la otra
    // —recortar— pierde el decimal en silencio.
    throw new Error(
      `Cifra con una forma que el backend no sirve: «${valor}». ` +
        'Se espera texto decimal con dos decimales como mucho, sin separador de miles. ' +
        'Redondear aqui seria aritmetica sobre una cifra sellada (regla 1, ADR-0018).',
    );
  }

  const negativo = limpio.startsWith('-');
  const sinSigno = negativo ? limpio.slice(1) : limpio;
  const [enteraCruda, decimalesCrudos] = sinSigno.split(DECIMAL);

  // `?? ''` y no `!`: con `noUncheckedIndexedAccess` el compilador no da por hecho que
  // `split` devolvio algo, y tiene razon aunque la expresion regular ya lo garantice.
  const entera = (enteraCruda ?? '').replace(/^0+(?=\d)/, '');
  const decimales = `${decimalesCrudos ?? ''}00`.slice(0, 2);
  const agrupada = entera.replace(/\B(?=(\d{3})+(?!\d))/g, MILES);

  return `${negativo ? '-' : ''}${agrupada}${DECIMAL}${decimales}`;
}

/** `"2026-09-06"` -> `"06/09/2026"`, que es como el artboard escribe las fechas. */
export function formatearFecha(fecha: Fecha): string {
  const partes = FECHA_SERVIDA.exec(fecha.trim());

  if (partes === null) {
    throw new Error(
      `Fecha con una forma que el backend no sirve: «${fecha}». ` +
        'Se espera ISO 8601 sin hora, «2026-09-06».',
    );
  }

  const [, anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}
