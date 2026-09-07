import type { Tono } from '../dominio/valores.ts';

/**
 * Lo que el Panel dice y **ninguna operacion del backend publica**: las decisiones abiertas y
 * las diez filas del mapa normativo sin archivo del corpus.
 *
 * <h2>Por que esta aqui y no en `datos/prototipo.ts`</h2>
 *
 * Por dos motivos, y el segundo es el que decide.
 *
 * <ol>
 *   <li><b>No son datos servidos.</b> `prototipo.ts` alimenta los cuerpos que el proxy contesta,
 *       y esto **no lo contesta ninguna ruta**: son prosa del modulo. Su propio javadoc lo dice y
 *       remite a «el issue que las dibuja», que es este.</li>
 *   <li><b>Una seccion no puede importar `prototipo.ts`.</b> `arranque.ts` carga el proxy con un
 *       `import()` dinamico detras de `VITE_KAMAYUK_PROXY_DE_DATOS` para que un `yarn build` de
 *       produccion no lleve dentro ni una cifra del corpus —la UIT de cinco ejercicios, los tres
 *       tramos con sus alicuotas, los tres cuadros nacionales—. Un `import` estatico desde aqui
 *       tiraria esa propiedad al suelo **en silencio**, y este es el repositorio que existe para
 *       que ninguna cifra normativa viva fuera del corpus firmado a dos manos (regla 5,
 *       ADR-0007).</li>
 * </ol>
 *
 * Asi que en este archivo no hay ni una cifra tributaria: hay numeros de fila del mapa normativo,
 * identificadores de decision y cuentas de cosas. Las cifras —la UIT, las alicuotas, los valores
 * unitarios— llegan por HTTP, del conjunto sellado, y ninguna pantalla las escribe (AC10).
 *
 * <h2>Cada dato, con donde se midio</h2>
 *
 * Un dato de este archivo sin procedencia es una afirmacion del producto que nada respalda. Los
 * tres bloques la llevan, y las tres fuentes viven en este mismo repositorio.
 */

// ── Las diez filas del mapa normativo sin archivo del corpus (AC1) ──────────────────────────

/**
 * Una fila del mapa normativo que este repositorio **no puede publicar**.
 *
 * `fila` es su numero en el mapa, y no un indice de esta lista: es como se la nombra en
 * `docs/10-negocio/valores-normativos/publicacion/README.md`, y es lo que permite ir a buscarla.
 */
export interface FilaSinArchivo {
  readonly fila: string;
  readonly que: string;
  /** La decision abierta de la que forma parte: `D-02b` o `D-02c`. */
  readonly parte: string;
}

/**
 * Las diez, una a una, de `publicacion/README.md` (lineas 224-246).
 *
 * **«Faltan cosas» no es una lista.** Las diez son de **acto propio de la municipalidad** —una
 * ordenanza de arbitrios, un arancel de costas, un CUIS—, y el conjunto es **por municipalidad**
 * (`conjunto_uq` lleva `municipalidad_id` delante, con RLS estricta): una que todavia no ha
 * aprobado su ordenanza y una que si sellan cosas distintas el mismo ano. Por eso van nombradas:
 * quien selle el conjunto de SU municipalidad tiene que poder ver si alguna es suya.
 *
 * Ocho son de D-02b y dos de D-02c. Que sean ocho y dos lo cuenta el Panel de esta lista, no de
 * un literal: una fila que se anada manana cambia el conteo sola.
 */
export const SIN_ARCHIVO: readonly FilaSinArchivo[] = [
  {
    fila: '11',
    que: 'Tasas de limpieza pública, relleno sanitario, parques y jardines y serenazgo',
    parte: 'D-02b',
  },
  { fila: '12', que: 'Criterios de distribución del costo del servicio', parte: 'D-02b' },
  { fila: '13', que: 'Descuento por pago anual adelantado', parte: 'D-02b' },
  { fila: '14', que: 'Inafectaciones de arbitrios', parte: 'D-02b' },
  { fila: '18', que: 'Anuncios y propaganda: tasas por tipo y dimensión', parte: 'D-02b' },
  { fila: '19', que: 'Interés moratorio (TIM), que fija una ordenanza municipal', parte: 'D-02b' },
  { fila: '23', que: 'Costas y gastos del procedimiento coactivo', parte: 'D-02c' },
  {
    fila: '25',
    que: 'Cuadro único de infracciones y sanciones administrativas (CUIS)',
    parte: 'D-02b',
  },
  { fila: '26', que: 'Descuentos por pronto pago de papeletas', parte: 'D-02c' },
  {
    fila: '28',
    que: 'Interés del convenio de fraccionamiento y número máximo de cuotas',
    parte: 'D-02b',
  },
];

// ── Las cuatro decisiones, y no todas iguales (AC1) ─────────────────────────────────────────

/**
 * Una decision del registro de GOB-02, con el estado que tiene HOY.
 *
 * `cerrada` no es lo mismo que «resuelta para siempre», y por eso hay un campo aparte para el
 * alcance: D-11 esta cerrada **y solo para 2026**.
 */
export interface DecisionAbierta {
  readonly id: string;
  /** Como se rotula el estado en la insignia: «Abierta», «Cerrada para 2026». */
  readonly estado: string;
  readonly tono: Tono;
  readonly titulo: string;
  readonly detalle: string;
  /** Si sigue bloqueando algo hoy. Lo que separa las tres abiertas de la cerrada. */
  readonly abierta: boolean;
}

/**
 * Las cuatro, **pintadas con su estado real y no todas iguales**.
 *
 * <h2>La distincion que evita sellar 2027 con el fundamento de 2026</h2>
 *
 * **D-11 se cerro el 2026-09-06 y SOLO para 2026.** Su fundamento es un hecho de ese ejercicio
 * —ese ano se publicaron los aranceles de terrenos y los precios unitarios oficiales, asi que el
 * supuesto del art. 12 del TUO LTM no se cumple y no hay actualizacion que aplicar: cero—, y
 * §1.6 lo lee **contra 2026 y ningun otro**. **No se hereda.** Quien mire este panel el ano que
 * viene y vea «cerrada» a secas dara por bueno para 2027 un fundamento que nadie ha comprobado
 * para 2027 — y el valor neutro del `% actualizacion` es cero, no uno, asi que equivocarse ahi
 * no deja una cifra rara: deja una cifra creible y equivocada.
 *
 * Los tonos son los de `const DECISIONES` del artboard, con sus nombres pasados al castellano:
 * `bad` es `mal` y `warn` es `atencion`. D-03d va en `atencion` y no en `mal` porque no bloquea
 * el sello: bloquea el cierre de caja.
 */
export const DECISIONES: readonly DecisionAbierta[] = [
  {
    id: 'D-02b',
    estado: 'Abierta',
    tono: 'mal',
    titulo: 'Valores de ordenanza local con su ratificación provincial',
    detalle:
      'Ocho de las diez filas sin archivo del corpus. Bloquea sellar un ejercicio COMPLETO en ' +
      'una municipalidad concreta; no bloquea lo de norma nacional, que ya está.',
    abierta: true,
  },
  {
    id: 'D-02c',
    estado: 'Abierta',
    tono: 'mal',
    titulo: 'Lo que fija un acto propio que no es ordenanza ratificada',
    detalle: 'El arancel de costas coactivas y el CUIS. Bloquea coactiva y sanciones.',
    abierta: true,
  },
  {
    id: 'D-11',
    estado: 'Cerrada para 2026',
    tono: 'ok',
    titulo: 'El «% actualización» del art. 12',
    detalle:
      'Cerrada el 2026-09-06 y SÓLO para 2026: el fundamento es un hecho —ese año se ' +
      'publicaron los aranceles y los precios unitarios, así que el supuesto del art. 12 no se ' +
      'cumple y no hay actualización que aplicar—. Sigue ABIERTA para cualquier otro ejercicio: ' +
      'no se hereda.',
    abierta: false,
  },
  {
    id: 'D-03d',
    estado: 'Abierta',
    tono: 'atencion',
    titulo: 'Redondeo del importe a pagar en el cierre de caja',
    detalle:
      'Puede no ser el del cálculo (ADR-0018 fija el del cálculo). Bloquea el cierre de caja, ' +
      'no el sello.',
    abierta: true,
  },
];

/** Cuantas siguen abiertas hoy. Se cuenta, no se escribe. */
export function cuantasAbiertas(): number {
  return DECISIONES.filter((una) => una.abierta).length;
}

/** Cuantas de las diez filas sin archivo pertenecen a esa decision. */
export function filasSinArchivoDe(decision: string): number {
  return SIN_ARCHIVO.filter((una) => una.parte === decision).length;
}

// ── Lo que el sello del 2026-09-06 llevo dentro (AC1) ───────────────────────────────────────

/**
 * La composicion de un sello: cuantas filas del corpus entraron y cuantos detalles se compusieron.
 *
 * **Son cuentas de filas, no cifras tributarias.** La distincion no es una coartada: una cifra
 * tributaria es la que una norma fija y que recalcular en 2037 tiene que devolver igual —la UIT,
 * una alicuota, un valor por metro cuadrado—, y ninguna de esas esta aqui ni puede estarlo
 * (regla 5). Lo que hay es cuantas hubo.
 *
 * `detalles` no lo publica ninguna operacion: `ConjuntoResource` lleva identidad y estado, no
 * conteos, y el snapshot cuenta FILAS SERVIDAS, que no es lo mismo —un cuadro entra en el
 * conjunto como **un** detalle y sirve 24, 492 o 54 129 filas—. Por eso se declara aqui, con
 * donde se midio, en vez de derivarse de una respuesta que no lo dice.
 */
export interface ComposicionDelSello {
  readonly ejercicio: number;
  readonly version: number;
  /** La fecha del sello, en ISO sin hora. */
  readonly fecha: string;
  /** Las filas del derivado del corpus que entraron. */
  readonly filasDelCorpus: number;
  /** Las ediciones de cuadro nacional que entraron. */
  readonly cuadros: number;
  /** Los detalles compuestos: las filas mas los cuadros. */
  readonly detalles: number;
}

/**
 * El sello de 2026, **medido y no supuesto**.
 *
 * De `ElEjercicio2026SeSellaTest`, que lo compone y lo sella contra PostgreSQL real: las 33
 * filas de `publicacion/parametros-2026.csv` mas las **dos** ediciones de cuadro de las que
 * depende la valuacion, y afirma `isEqualTo(35)` sobre los detalles compuestos. Es la misma
 * cifra que `CLAUDE.md:24`.
 *
 * Que las 33 son las que el conjunto publica no se queda en esta declaracion: `panel.test.ts`
 * pide el snapshot al proxy y cuenta sus `parametros`. Si el corpus creciera y esto no, sale
 * rojo — que es lo unico que impide que una cuenta escrita a mano se quede atras.
 */
export const SELLO_DE_2026: ComposicionDelSello = {
  ejercicio: 2026,
  version: 1,
  fecha: '2026-09-06',
  filasDelCorpus: 33,
  cuadros: 2,
  detalles: 35,
};
