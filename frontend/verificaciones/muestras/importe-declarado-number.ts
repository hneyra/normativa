// Viola: un importe se declara «string», nunca «number» (regla 1, RNF-055).
//
// `NUMERIC(14,2)` en la base y `BigDecimal` en el backend no sirven de nada si el ultimo
// tramo lo mete en un `double` de JavaScript. Aqui duele mas que en ningun otro sistema:
// lo que se muestra es la cifra FIRMADA del corpus, y una que se redondea al pintarla ya
// no es la que se firmo.

export interface ParametroEnPantalla {
  readonly numero: number;
  readonly uit: number;
}

export function mostrar(importe: number) {
  return importe.toFixed(2);
}
