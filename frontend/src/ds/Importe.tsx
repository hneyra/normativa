import { formatearFecha, formatearImporte } from '../dominio/formato.ts';
import type { Fecha, Importe as CifraDecimal } from '../dominio/valores.ts';

/**
 * Una cifra decimal, **con la fecha a la que esta calculada**.
 *
 * `fechaCalculo` es obligatoria y NO tiene valor por omision. Es la regla 9 llevada al
 * tipo: no existe «la deuda», existe `deudaActualizadaA(fecha)` (RNF-075). En este sistema
 * la regla se lee igual con otro sujeto: no existe «el valor unitario», existe el valor
 * unitario de la edicion vigente a una fecha — y una tabla nacional que se ensena sin decir
 * a que fecha esta resuelta manda a calcular con la edicion equivocada.
 *
 * **Dos barreras, no una**, y las dos se demuestran:
 *
 *   1. El TIPO. `verificaciones/tipos/barreras-de-tipos.tsx` escribe `<Importe valor="…" />`
 *      bajo un `@ts-expect-error`: el dia que `fechaCalculo` deje de ser obligatoria, ese
 *      error no ocurrira y **`tsc` fallara por la directiva no usada**.
 *   2. ESLint. La prohibicion `importe-sin-fecha` rechaza cualquier `<Importe>` sin ese
 *      atributo, con su muestra en `verificaciones/muestras/importe-sin-fecha.tsx`.
 *
 * Hacen falta las dos porque no cubren lo mismo, y en `reglas-de-eslint.test.ts` esta
 * medido en los dos sentidos: el tipo no ve un `<Importe {...props} />` donde `props` viene
 * de un `any` que se colo por un `JSON.parse`, y ESLint no ve un
 * `createElement(Importe, …)`. Y sobre todo: la regla de ESLint sobrevive a que alguien
 * ponga un valor por omision al tipo, y el tipo sobrevive a que alguien apague la regla —
 * que son las dos formas realistas de perder esto.
 *
 * **No hace aritmetica y no pone simbolo de moneda.** Formatea el texto que envio el
 * backend, y la moneda va en la cabecera de la columna: es como el artboard escribe sus
 * cuadros —«Valor por m² (S/)»— y ademas hay columnas que no son soles, porque una alicuota
 * es un porcentaje.
 */
export interface ImporteProps {
  readonly valor: CifraDecimal;
  /** Obligatoria y sin valor por omision. Ver el javadoc del componente. */
  readonly fechaCalculo: Fecha;
  /**
   * Oculta la fecha cuando **ya la dice** la pantalla o la fila.
   *
   * No la hace opcional: `fechaCalculo` sigue habiendo que pasarla. Lo que se evita es
   * repetir «al 06/09/2026» en las 492 filas de un cuadro de depreciacion que ya lleva su
   * `FechaDeCalculo` arriba.
   */
  readonly fechaImplicita?: boolean;
}

export function Importe({ valor, fechaCalculo, fechaImplicita = false }: ImporteProps) {
  return (
    <span className="kn-importe">
      <span className="kn-importe__valor">{formatearImporte(valor)}</span>
      {!fechaImplicita && <span className="kn-importe__fecha">al {formatearFecha(fechaCalculo)}</span>}
    </span>
  );
}
