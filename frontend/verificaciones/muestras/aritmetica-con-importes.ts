// Viola: la interfaz no hace aritmetica con las cifras del dominio (regla 1, ADR-0018).
//
// El problema no es solo la precision: es que quien opera una cifra sellada la deja de
// publicar y la empieza a calcular. Quien calcula en este producto es el motor de reglas,
// con su redondeo sellado y su escala ratificada; una suma escrita en una pantalla no
// tiene ni lo uno ni lo otro, y su resultado no se puede reproducir en 2037.

interface Tramo {
  readonly insoluto: string;
  readonly interes: string;
}

export function totalDelTramo(tramo: Tramo) {
  return tramo.insoluto + tramo.interes;
}

export function totalDelCuadro(cuadro: { valores: number[] }) {
  return cuadro.valores.reduce((izquierda, derecha) => izquierda + derecha, 0);
}
