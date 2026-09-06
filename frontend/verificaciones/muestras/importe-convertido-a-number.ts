// Viola: un importe es texto y pierde centimos como number (regla 1, RNF-055).
//
// La conversion es la forma educada de romper la regla anterior: el tipo dice `string`, y
// tres lineas mas abajo alguien lo convierte «solo para ordenar la tabla».

export function comoNumero(fila: { valorUnitario: string }) {
  return Number(fila.valorUnitario);
}

export function tambienProhibido(cuadro: { total: string }) {
  return parseFloat(cuadro.total);
}
