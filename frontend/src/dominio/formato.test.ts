import { describe, expect, it } from 'vitest';

import { formatearFecha, formatearImporte } from './formato.ts';

/**
 * Las dos funciones que convierten el dato del backend en lo que se lee.
 *
 * Son puras y trabajan sobre texto, y estas pruebas existen sobre todo para sujetar las dos
 * decisiones que se pueden perder sin que se note: que **no se redondea** y que **no se
 * construye un `Date`**.
 */

describe('formatearImporte', () => {
  it('agrupa de tres en tres, como el artboard escribe los valores referenciales', () => {
    // `'104,740.00'` esta escrito tal cual en `VALORES_REFERENCIALES` del artboard.
    expect(formatearImporte('104740.00')).toBe('104,740.00');
    expect(formatearImporte('135890.00')).toBe('135,890.00');
  });

  it('completa a dos decimales sin tocar los que ya hay', () => {
    expect(formatearImporte('5500')).toBe('5,500.00');
    expect(formatearImporte('5500.5')).toBe('5,500.50');
    expect(formatearImporte('894.27')).toBe('894.27');
  });

  it('no pone simbolo de moneda: la moneda va en la cabecera de la columna', () => {
    // El artboard escribe «Valor por m² (S/)» en la cabecera y deja la celda con la cifra
    // sola. Ademas hay columnas que no son soles: una alicuota es un porcentaje, y un «S/»
    // por omision la convertiria en dinero.
    expect(formatearImporte('0.60')).toBe('0.60');
  });

  it('conserva el signo', () => {
    expect(formatearImporte('-1234.5')).toBe('-1,234.50');
  });

  it('FALLA con tres decimales en vez de recortar', () => {
    // Recortar es aritmetica, y la decide el backend con su `NUMERIC(x,y)`. Un decimal que
    // desaparece al pintarlo no deja rastro en ningun sitio.
    expect(() => formatearImporte('104740.005')).toThrow(/no sirve/);
  });

  it('y con cualquier cosa que no sea una cifra decimal', () => {
    expect(() => formatearImporte('1,234.00')).toThrow(/no sirve/);
    expect(() => formatearImporte('')).toThrow(/no sirve/);
  });
});

describe('formatearFecha', () => {
  it('escribe la fecha como el artboard: dia, mes y ano', () => {
    expect(formatearFecha('2026-09-06')).toBe('06/09/2026');
  });

  it('NO construye un Date, asi que no se corre un dia por la zona horaria', () => {
    // `new Date("2026-01-01")` se interpreta en UTC y se imprime en local: en Lima sale el
    // 31 de diciembre. Una edicion normativa que cambia de ejercicio segun donde este el
    // navegador no es un detalle de formato.
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
    expect(formatearFecha('2025-12-31')).toBe('31/12/2025');
  });

  it('falla con una fecha que trae hora, que es la forma que invita al Date', () => {
    expect(() => formatearFecha('2026-09-06T00:00:00Z')).toThrow(/ISO 8601 sin hora/);
  });
});
