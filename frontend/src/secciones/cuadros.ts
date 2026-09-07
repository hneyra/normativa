import { formatearImporte } from '../dominio/formato.ts';
import type {
  Ambito,
  DepreciacionDelSnapshot,
  SnapshotResource,
  ValorReferencialDelSnapshot,
  ValorUnitarioDelSnapshot,
} from '../datos/lecturas.ts';
import type { CeldaDeTabla, ColumnaDeTabla, FilaDeTabla } from './Tabla.tsx';

/**
 * Los tres cuadros nacionales de ADR-0017, y lo que la pantalla tiene que saber de ellos.
 *
 * <h2>Esto es un modulo de datos y de funciones puras, no de JSX</h2>
 *
 * Las columnas, sus dominios, el reparto por ambito y la lectura de un tramo abierto se pueden
 * probar sin montar nada, y se prueban asi. Lo que queda en `Cuadros.tsx` es el dibujo.
 *
 * <h2>Y NO importa `datos/prototipo.ts`, a proposito</h2>
 *
 * Las cifras llegan por la API, siempre. `prototipo.ts` es la captura del artboard que el
 * **proxy** usa para componer los cuerpos, y entra en el bundle **solo** por el `import()`
 * dinamico de `arranque.ts`: con la bandera apagada, Rollup se lleva por delante ese trozo y las
 * cifras del corpus no viajan a produccion. Una pantalla que importara `prototipo.ts` para
 * ensenar la UIT, un valor unitario o el `sha256` de una edicion **volveria a meterlas en el
 * bundle**, y ademas las publicaria sin ninguna de las dos firmas que ADR-0007 exige. Que
 * ninguna seccion lo haga lo comprueba `secciones.test.ts`.
 *
 * La consecuencia se acepta y se dice en pantalla en vez de esquivarla: hay cosas de la edicion
 * —su `sha256`, su doble firma, su clave, y con ella **la region**— que ninguna de las cuatro
 * operaciones publica, y la pantalla las nombra como lo que son.
 */

/** Los tres, por su identificador estable. */
export type IdDeCuadro = 'unitarios' | 'depreciacion' | 'referenciales';

/** Un cuadro nacional: de donde sale, que ambito lo lleva y como se dibuja. */
export interface CuadroDeValuacion {
  readonly id: IdDeCuadro;
  readonly rotulo: string;
  /** El campo del `SnapshotResource` que lo trae. */
  readonly campo: 'valoresUnitarios' | 'depreciaciones' | 'valoresReferenciales';
  /** La tabla de la base, con su CHECK de nacionalidad. */
  readonly tabla: string;
  readonly checkNacional: string;
  /**
   * La mitad de la frontera de ADR-0024 que lo lleva.
   *
   * No es una etiqueta: es lo que `ComponerSnapshot` mira para dejar la lista vacia o llenarla,
   * y por eso la pantalla razona con ella en vez de con lo que le haya llegado (AC3).
   */
  readonly ambito: Ambito;
  readonly columnas: readonly ColumnaDeTabla[];
  /** Modificador de anchura minima de la tabla. */
  readonly variante: string;
  readonly nota: string;
  readonly pie: string;
}

/**
 * Los dominios literales, leidos de los CHECK del baseline (`V1__baseline.sql`).
 *
 * No se escriben a ojo y no se resumen: son la restriccion que la base aplica, con el nombre de
 * la restriccion al lado para que se pueda buscar. Un dominio escrito en la interfaz que no sea
 * el de la base es peor que ninguno, porque se lee como una promesa.
 */
export const DOMINIOS = {
  /** `valor_unitario_edificacion_partida_check`. Son las tres de apreciacion exterior. */
  partida: ['MUROS', 'TECHOS', 'PUERTAS'],
  /** `valor_unitario_edificacion_categoria_check`: `categoria ~ '^[A-J]$'`. */
  categoria: /^[A-J]$/,
  /** `depreciacion_uso_check`: `uso ~ '^0[1-4]$'`. */
  uso: /^0[1-4]$/,
} as const;

const COLUMNA_DOCUMENTO: ColumnaDeTabla = {
  etiqueta: 'Documento fuente',
  campo: 'documentoFuente',
};

export const CUADROS_DE_VALUACION: readonly CuadroDeValuacion[] = [
  {
    id: 'unitarios',
    rotulo: 'Valores unitarios de edificación',
    campo: 'valoresUnitarios',
    tabla: 'valor_unitario_edificacion',
    checkNacional: 'valor_unitario_nacional_ck',
    ambito: 'VALUACION',
    variante: 'unitarios',
    // El documento fuente NO se escribe aquí: llega en cada fila, y la ficha de la edición lo
    // lee de ellas. Escribirlo ademas en el codigo lo metería en el bundle de producción, que es
    // lo que la medida de F-1 (AC9) comprueba que no pasa.
    nota:
      'El anexo de valores unitarios de edificación que publica cada año el MVCS. Es una matriz ' +
      'de categoría por año de construcción, no sólo de categoría, y la letra que sale de aquí ' +
      'es lo que multiplica los metros construidos del predio.',
    pie:
      'La J existe sólo en el anexo de la Selva y sólo en muros; la H no tiene muros. Por eso el ' +
      'derivado de la Costa son 24 celdas y no 30: no es un hueco, es el cuadro.',
    columnas: [
      { etiqueta: 'Partida', campo: 'partida', dominio: DOMINIOS.partida.join(' · ') },
      { etiqueta: 'Categoría', campo: 'categoria', dominio: 'A … J' },
      { etiqueta: 'Desde', campo: 'anioConstruccionDesde', cifra: true },
      { etiqueta: 'Hasta', campo: 'anioConstruccionHasta', cifra: true },
      { etiqueta: 'Valor por m² (S/)', campo: 'valorM2', cifra: true },
      COLUMNA_DOCUMENTO,
    ],
  },
  {
    id: 'depreciacion',
    rotulo: 'Depreciación',
    campo: 'depreciaciones',
    tabla: 'depreciacion',
    checkNacional: 'depreciacion_nacional_ck',
    ambito: 'VALUACION',
    variante: 'depreciacion',
    nota:
      'El Anexo I del Reglamento Nacional de Tasaciones. El uso es la tabla a la que pertenece ' +
      'la fila, con el número que usa la propia norma: 01 vivienda, 02 tiendas y depósitos, ' +
      '03 oficinas, 04 salud, industria y educación. Qué tabla le toca a un predio es criterio, ' +
      'y no vive aquí.',
    pie:
      'Cada tabla del Anexo I cierra con un tramo abierto, y en el JSON llega como ' +
      '«antiguedadHasta»: null. No es un dato que falte: es el tramo que no tiene tope, y en un ' +
      'padrón viejo es el que más predios cubre.',
    columnas: [
      { etiqueta: 'Uso', campo: 'uso', dominio: '01 … 04' },
      { etiqueta: 'Material', campo: 'material' },
      { etiqueta: 'Estado de conservación', campo: 'estadoConservacion' },
      { etiqueta: 'Antigüedad hasta', campo: 'antiguedadHasta', cifra: true },
      { etiqueta: 'Depreciación %', campo: 'porcentaje', cifra: true },
      COLUMNA_DOCUMENTO,
    ],
  },
  {
    id: 'referenciales',
    rotulo: 'Valores referenciales vehiculares',
    campo: 'valoresReferenciales',
    tabla: 'valor_referencial_vehiculo',
    checkNacional: 'valor_referencial_nacional_ck',
    ambito: 'OBLIGACION',
    variante: 'referenciales',
    nota:
      'El anexo del MEF con el valor referencial de los vehículos. Es la única de las tres ' +
      'tablas que no interviene en la valuación de un predio: sirve para la base imponible del ' +
      'patrimonio vehicular, que es obligación y no valuación (ADR-0024).',
    pie:
      '«OTROS MODELOS» es una fila de verdad y aparece en cada categoría con un valor distinto, ' +
      'así que la categoría es parte de la identidad y no una etiqueta. Son siete columnas: la ' +
      'tabla se desplaza dentro de su marco y no arrastra la página.',
    columnas: [
      { etiqueta: 'Ejercicio', campo: 'ejercicio', cifra: true },
      { etiqueta: 'Categoría', campo: 'categoria' },
      { etiqueta: 'Marca', campo: 'marca' },
      { etiqueta: 'Modelo', campo: 'modelo' },
      { etiqueta: 'Año de fabricación', campo: 'anioFabricacion', cifra: true },
      { etiqueta: 'Valor (S/)', campo: 'valor', cifra: true },
      COLUMNA_DOCUMENTO,
    ],
  },
];

/** El cuadro de ese identificador. Revienta si no existe: los tres son fijos. */
export function cuadroPorId(id: IdDeCuadro): CuadroDeValuacion {
  const encontrado = CUADROS_DE_VALUACION.find((cuadro) => cuadro.id === id);
  if (encontrado === undefined) {
    throw new Error(`No hay ningun cuadro de valuacion con identificador «${id}».`);
  }
  return encontrado;
}

// ── AC3: lo que un cuadro vacio SIGNIFICA ───────────────────────────────────────────────────

/**
 * Los cuatro desenlaces de un cuadro dentro de un snapshot.
 *
 * **Un cuadro vacio por ambito no es un cuadro sin datos**, y pintar los dos igual haria que un
 * error de carga pasara por normal. Los cuatro se distinguen mirando **dos** cosas: si el ambito
 * pedido lleva ese cuadro (`ComponerSnapshot:71-73`) y cuantas filas llegaron.
 *
 * <ul>
 *   <li>`CON_FILAS` — el ambito lo lleva y llego. Es el caso normal.</li>
 *   <li>`FUERA_DEL_AMBITO` — el ambito no lo lleva y llego vacio. **No es un vacio**: es el
 *       reparto de ADR-0024 funcionando, y se lee como tal.</li>
 *   <li>`SIN_FILAS` — el ambito SI lo lleva y llego vacio. Eso es una anomalia: o el conjunto se
 *       sello sin esa edicion —la version 1 de 2026 se sello sin la vehicular— o algo no
 *       compuso. Se dice, no se disimula.</li>
 *   <li>`DE_MAS` — el ambito no lo lleva y llego lleno. Contra el backend no puede pasar; contra
 *       el proxy de datos si, porque **no mira la consulta** y sirve las cuatro listas llenas
 *       (`simulados.ts`, clave `ambitoDelSnapshot`). Nombrarlo es lo que impide que la pantalla
 *       se acostumbre a un reparto que el servidor no hace.</li>
 * </ul>
 */
export type EstadoDelCuadro = 'CON_FILAS' | 'FUERA_DEL_AMBITO' | 'SIN_FILAS' | 'DE_MAS';

export function estadoDelCuadro(
  ambitoPedido: Ambito,
  cuadro: CuadroDeValuacion,
  cuantasFilas: number,
): EstadoDelCuadro {
  const loLleva = cuadro.ambito === ambitoPedido;
  if (loLleva) {
    return cuantasFilas > 0 ? 'CON_FILAS' : 'SIN_FILAS';
  }
  return cuantasFilas > 0 ? 'DE_MAS' : 'FUERA_DEL_AMBITO';
}

/** Cuantas filas de ese cuadro trae el snapshot. */
export function cuantasFilasDe(cuadro: CuadroDeValuacion, snapshot: SnapshotResource): number {
  return snapshot[cuadro.campo].length;
}

// ── Los tramos abiertos, que no son datos que falten (AC2) ──────────────────────────────────

/**
 * El texto de un `antiguedadHasta` nulo: **«Más de N años»**, nunca un guion y nunca un cero.
 *
 * El nulo es el tramo con que cierra cada tabla del Anexo I —lo dice el propio comentario de la
 * columna en el baseline: «NULO es "mas de 50 anios"»—, y `N` es el tope del ultimo tramo
 * cerrado de **su misma tabla**: mismo uso, mismo material y mismo estado de conservacion, que
 * son las tres columnas con las que `depreciacion_uq` identifica la fila.
 *
 * Pintarlo como guion diria que no se sabe; pintarlo como cero convertiria el tramo que todo lo
 * cubre en uno que no cubre nada, y sin ningun error de por medio. En un padron viejo ese tramo
 * es el que mas predios alcanza.
 *
 * Cuando el snapshot no trae ningun tramo cerrado de esa tabla —pasa si el cuadro llega
 * recortado— no se inventa un numero: se dice «Sin tope», que es lo unico cierto.
 */
export function antiguedadAbierta(
  filas: readonly DepreciacionDelSnapshot[],
  fila: DepreciacionDelSnapshot,
): string {
  let mayor: number | null = null;
  for (const otra of filas) {
    if (
      otra.uso === fila.uso &&
      otra.material === fila.material &&
      otra.estadoConservacion === fila.estadoConservacion &&
      otra.antiguedadHasta !== null &&
      (mayor === null || otra.antiguedadHasta > mayor)
    ) {
      mayor = otra.antiguedadHasta;
    }
  }
  return mayor === null ? 'Sin tope' : `Más de ${String(mayor)} años`;
}

/** La nota que acompana a un tramo abierto de depreciacion. */
const NOTA_ANTIGUEDAD =
  'Tramo abierto: «antiguedadHasta» llega como null, y eso no es un dato que falte sino que no ' +
  'hay tope. Leerlo como cero convertiría el tramo que todo lo cubre en uno que no cubre nada.';

/** La nota que acompana a un tramo abierto de valores unitarios. */
const NOTA_ANIO =
  'Tramo abierto: «anioConstruccionHasta» llega como null cuando la tabla no le pone tope — la ' +
  'construcción más reciente. No es un dato que falte.';

// ── Las filas, ya listas para la tabla ──────────────────────────────────────────────────────

/** Una celda de texto sin nota. */
function texto(valor: string): CeldaDeTabla {
  return { texto: valor };
}

/** Una celda de cifra decimal, formateada con el separador de miles y sin aritmetica. */
function cifra(valor: string): CeldaDeTabla {
  return { texto: formatearImporte(valor) };
}

/** Una celda de entero del dominio: un anio o una cuenta de anios, jamas dinero. */
function entero(valor: number): CeldaDeTabla {
  return { texto: String(valor) };
}

function filasDeUnitarios(filas: readonly ValorUnitarioDelSnapshot[]): readonly FilaDeTabla[] {
  return filas.map((fila) => ({
    clave: `${fila.partida}-${fila.categoria}-${String(fila.anioConstruccionDesde)}`,
    celdas: [
      texto(fila.partida),
      texto(fila.categoria),
      entero(fila.anioConstruccionDesde),
      fila.anioConstruccionHasta === null
        ? { texto: 'Sin tope', nota: NOTA_ANIO }
        : entero(fila.anioConstruccionHasta),
      cifra(fila.valorM2),
      texto(fila.documentoFuente),
    ],
  }));
}

function filasDeDepreciacion(filas: readonly DepreciacionDelSnapshot[]): readonly FilaDeTabla[] {
  return filas.map((fila) => ({
    clave: `${fila.uso}-${fila.material}-${fila.estadoConservacion}-${String(fila.antiguedadHasta)}`,
    celdas: [
      texto(fila.uso),
      texto(fila.material),
      texto(fila.estadoConservacion),
      fila.antiguedadHasta === null
        ? { texto: antiguedadAbierta(filas, fila), nota: NOTA_ANTIGUEDAD }
        : entero(fila.antiguedadHasta),
      cifra(fila.porcentaje),
      texto(fila.documentoFuente),
    ],
  }));
}

function filasDeReferenciales(
  filas: readonly ValorReferencialDelSnapshot[],
): readonly FilaDeTabla[] {
  return filas.map((fila) => ({
    clave: `${String(fila.ejercicio)}-${fila.categoria}-${fila.marca}-${fila.modelo}-${String(fila.anioFabricacion)}`,
    celdas: [
      entero(fila.ejercicio),
      texto(fila.categoria),
      texto(fila.marca),
      texto(fila.modelo),
      entero(fila.anioFabricacion),
      cifra(fila.valor),
      texto(fila.documentoFuente),
    ],
  }));
}

/** Las filas de ese cuadro, en el orden en que el snapshot las trae. */
export function filasDelCuadro(
  cuadro: CuadroDeValuacion,
  snapshot: SnapshotResource,
): readonly FilaDeTabla[] {
  if (cuadro.id === 'unitarios') return filasDeUnitarios(snapshot.valoresUnitarios);
  if (cuadro.id === 'depreciacion') return filasDeDepreciacion(snapshot.depreciaciones);
  return filasDeReferenciales(snapshot.valoresReferenciales);
}

// ── El documento fuente, que es lo que hace auditable cada cifra ────────────────────────────

/** Lo que se sabe del documento fuente de un cuadro mirando sus filas. */
export interface FuenteDelCuadro {
  /** El documento, si las filas dicen todas el mismo. */
  readonly documento: string | null;
  /** Los distintos que llegaron. Mas de uno es una edicion mezclada con otra. */
  readonly distintos: readonly string[];
}

/**
 * El documento fuente del cuadro, sacado **de sus filas** y no de una constante.
 *
 * Cada fila lo lleva, asi que la pantalla no tiene que creerselo: lo lee y comprueba que todas
 * dicen lo mismo. Que digan dos cosas distintas significa que el conjunto compuso dos ediciones
 * del mismo cuadro, y eso no se puede resumir en una linea de cabecera sin mentir.
 */
export function fuenteDelCuadro(filas: readonly FilaDeTabla[]): FuenteDelCuadro {
  const distintos: string[] = [];
  for (const fila of filas) {
    const celda = fila.celdas[fila.celdas.length - 1];
    const valor = celda?.texto;
    if (valor !== undefined && valor !== null && !distintos.includes(valor)) {
      distintos.push(valor);
    }
  }
  return { documento: distintos.length === 1 ? (distintos[0] ?? null) : null, distintos };
}

// ── Los dominios, comprobados contra lo que llego ───────────────────────────────────────────

/**
 * Los valores servidos que se salen del dominio que la base declara.
 *
 * La pantalla no se limita a escribir el dominio en la cabecera: lo **comprueba** contra lo que
 * llego. Un `partida: 'MURO'` o un `uso: '05'` no los puede haber escrito la base —tiene su
 * CHECK—, asi que si aparecen es que el cuerpo no viene de donde se cree, y eso hay que verlo
 * antes de usar la cifra que va al lado.
 *
 * Devuelve una descripcion por valor infractor, sin repetir.
 */
export function fueraDeDominio(
  cuadro: CuadroDeValuacion,
  snapshot: SnapshotResource,
): readonly string[] {
  const fallos: string[] = [];
  const anotar = (mensaje: string) => {
    if (!fallos.includes(mensaje)) fallos.push(mensaje);
  };

  if (cuadro.id === 'unitarios') {
    for (const fila of snapshot.valoresUnitarios) {
      if (!(DOMINIOS.partida as readonly string[]).includes(fila.partida)) {
        anotar(`partida «${fila.partida}» (valor_unitario_edificacion_partida_check)`);
      }
      if (!DOMINIOS.categoria.test(fila.categoria)) {
        anotar(`categoria «${fila.categoria}» (valor_unitario_edificacion_categoria_check)`);
      }
    }
  }
  if (cuadro.id === 'depreciacion') {
    for (const fila of snapshot.depreciaciones) {
      if (!DOMINIOS.uso.test(fila.uso)) {
        anotar(`uso «${fila.uso}» (depreciacion_uso_check)`);
      }
    }
  }
  return fallos;
}
