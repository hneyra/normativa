// Viola: ninguna cifra tributaria literal en el codigo (regla 5, RNF-053).
//
// LA MUESTRA DE LA REGLA PROPIA DE ESTE REPOSITORIO. Ninguno de los otros tres frontends
// la tiene, y aqui muerde mas que en ninguno: `normativa` es el sistema cuyo trabajo
// entero es que estas cifras vivan en datos versionados, firmados a dos manos (ADR-0007)
// y sellados por ejercicio. Cada linea de abajo es una cifra normativa publicada **por
// fuera del corpus**, por el repositorio que existe para que no las haya.
//
// Y el modo de fallo no es que se vea mal: es que se vea BIEN. Una alicuota escrita aqui
// se muestra igual que una leida del conjunto sellado, no cambia cuando cambia la
// ordenanza —cambiarla exige un despliegue, que es exactamente lo que RNF-053 impide— y
// no aparece en ninguna comprobacion de las que verifican el corpus.

// Un decreto supremo la fija cada ano; aqui se queda congelada en el bundle.
export const uit = 5500;

// La forma que de verdad se escribiria en ESTA interfaz: como texto, porque un importe es
// `string` (regla 1). Una prohibicion que solo mirase los numeros la dejaria pasar.
export const alicuotaPredial = '0.006';

// Los tres tramos del predial, clavados en un objeto.
export const TRAMOS_DEL_PREDIAL = {
  tramo1: 0.002,
  tramo2: 0.006,
  tramo3: 0.01,
};

// Una fila del cuadro de valores unitarios, en una propiedad de clase.
export class CuadroDeValoresUnitarios {
  readonly valorUnitarioC3 = '412.88';
}

// Y por omision, que es donde una cifra se esconde mejor: el parametro no se pasa nunca y
// nadie vuelve a leer la firma.
export function depreciar(valor: string, depreciacion = 0.05) {
  return `${valor} ${depreciacion}`;
}
