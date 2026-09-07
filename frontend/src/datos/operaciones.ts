/**
 * Las operaciones que el proxy contesta, y el cuerpo JSON de cada una.
 *
 * <h2>Cuatro son reales y tres son un dibujo, y la tabla lo dice</h2>
 *
 * Medido sobre `backend/**\/src/main`: **no hay un solo `@PostMapping`, `@PutMapping`,
 * `@PatchMapping` ni `@DeleteMapping`**, y las rutas publicadas son cuatro, las cuatro `GET`,
 * bajo `Api.RAIZ = "/normativa/api/v1"`. Esas cuatro llevan `origen: 'REAL'` y su `forma` es el
 * nombre del `record` de Java que las declara; `formas.test.ts` abre ese `.java` y compara campo
 * a campo. Las tres escrituras llevan `origen: 'SIMULADA'`, viven en `simulados.ts` y de aqui
 * solo pasan por la tabla.
 *
 * Eso es todo lo que hace util a este proxy. Una pantalla escrita contra una forma inventada hay
 * que reescribirla el dia de la integracion, y entonces el proxy no habria adelantado trabajo:
 * lo habria duplicado.
 *
 * <h2>Lo que este archivo NO hace (AC5)</h2>
 *
 * No filtra, no ordena, no pagina y no persiste. **Los constructores no reciben ni la cadena de
 * consulta ni el cuerpo de la peticion: no PUEDEN mirarlos**, que es mas fuerte que no mirarlos.
 * `?ambito=OBLIGACION` devuelve exactamente lo mismo que `?ambito=VALUACION`, y dos `POST`
 * iguales devuelven lo mismo la primera vez y la decima.
 *
 * El envoltorio de paginacion se publica porque el backend lo publica —`{ contenido, pagina,
 * tamano, totalElementos, totalPaginas, hayMas }`, `tamano` sin enie—, y siempre con la pagina
 * cero, el conjunto entero y `hayMas` en falso. Fingir el corte por `?pagina=3` seria fingir que
 * existen paginas que nadie ha decidido como se cortan.
 *
 * <h2>Lo que si reproduce, y por que no es lo mismo</h2>
 *
 * `parametros` declara, operacion por operacion, **lo que su handler sabe leer de la consulta**.
 * No es una validacion de valores: es el borde del transporte que el backend ya tiene puesto
 * —`GuardiaDeParametros` rechaza con 422 cualquier parametro que la operacion no declare,
 * admitiendo siempre los cuatro de la paginacion— y que, sin reproducirlo, el frontend se
 * acostumbraria a saltarse. Un filtro que el servidor ignora en silencio devuelve el listado
 * entero con `200`, que es exactamente el defecto que esa guarda cerro.
 *
 * <h2>De donde salen las cifras</h2>
 *
 * De `prototipo.ts`, que es la captura del artboard, y de `simulados.ts`, que es lo que hubo que
 * inventar y nombra la operacion que lo sustituira. Un valor que no venga de uno de los dos no
 * deberia existir en este archivo.
 *
 * <h2>Los importes son TEXTO (regla 1, RNF-055)</h2>
 *
 * Ningun importe pasa por `Number` en ningun punto: lo unico que se les hace es quitarles los
 * separadores de millar que el artboard usa para dibujar —`'104,780.00'` es una cifra formateada
 * para un ojo, `'104780.00'` es la cifra decimal que el backend publica—. Los enteros que si
 * pasan por `Number` son **anios y cuentas de cosas**, nunca dinero.
 */

import {
  CUADROS,
  DEPRECIACIONES,
  EDICIONES,
  EJERCICIO_DE_CAPTURA,
  PARAMETROS,
  SIN_VALOR,
  VALORES_REFERENCIALES,
  VALORES_UNITARIOS,
  edicionVigente,
  type EdicionDelConjunto,
} from './prototipo.ts';
import { ESCRITURAS_SIMULADAS, simulado, type EscrituraSimulada } from './simulados.ts';

/** Verbos que el contrato usa. */
export type Verbo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Si la operacion existe en el backend o es un dibujo.
 *
 * `REAL` significa «publicada en `src/main`, con su `record` de retorno»; `SIMULADA`, «ADR-0025
 * §5 la anticipa y hoy no existe». La distincion no es documental: `formas.test.ts` solo compara
 * contra el `.java` las que dicen ser reales, y exige que ninguna simulada afirme una forma que
 * el backend no publica.
 */
export type OrigenDeLaOperacion = 'REAL' | 'SIMULADA';

/** Una operacion que el proxy contesta. */
export interface Operacion {
  readonly metodo: Verbo;
  /** Ruta bajo `/normativa/api/v1`, con sus parametros entre llaves. */
  readonly ruta: string;
  readonly origen: OrigenDeLaOperacion;
  /**
   * El `record` de Java que declara la forma de la respuesta. Solo en las reales.
   *
   * Es la misma cadena que el nombre de la interfaz de `lecturas.ts`, a proposito: asi la prueba
   * puede cruzar las dos leyendo los dos fuentes, sin un mapa que alguien deje desactualizado.
   */
  readonly forma?: string;
  /**
   * Los parametros de consulta que el handler sabe leer, **sin** los cuatro de la paginacion.
   *
   * Los cuatro del dialecto se admiten siempre, tambien en la operacion que no pagina: es lo que
   * hace `GuardiaDeParametros.DIALECTO_DE_LA_PAGINACION`, y sin eso pedir la pagina siguiente de
   * un listado se contestaria «parametro desconocido: pagina».
   */
  readonly parametros: readonly string[];
  /** Los de `parametros` que el handler exige. Sin ellos el backend contesta 422. */
  readonly obligatorios: readonly string[];
  /**
   * El cuerpo JSON que sirve.
   *
   * **No recibe argumentos, y es el corazon de AC5**: sin la peticion delante no hay manera de
   * filtrar por ella. Que la firma lo impida vale mas que un comentario pidiendo que no se haga.
   */
  readonly cuerpo: () => unknown;
  /**
   * Si la respuesta lleva `ETag` y `Cache-Control: immutable`.
   *
   * La huella la calcula el proxy sobre **los bytes que acaba de componer**, igual que el
   * servidor: `sha256(cuerpo)`. No se copia del artboard, cuyos `ETag` son de ejemplo.
   */
  readonly huella?: boolean;
  /** La negativa que reproduce, en las escrituras simuladas. Ver `simulados.ts`. */
  readonly negativa?: EscrituraSimulada['negativa'];
}

/** La clave con que se nombra una operacion: `«VERBO /ruta»`. */
export function claveDe(operacion: Pick<Operacion, 'metodo' | 'ruta'>): string {
  return `${operacion.metodo} ${operacion.ruta}`;
}

// ── Lo que el artboard escribe para dibujar, traducido a lo que el backend publica ──────────

/** `'104,780.00'` → `'104780.00'`. Sin pasar por `Number` en ningun punto (regla 1). */
function decimal(formateado: string): string {
  return formateado.replace(/\s/g, '').replace(/,/g, '');
}

/** Un entero del artboard: anios y cuentas de cosas, jamas dinero. */
function entero(formateado: string): number {
  return Number(formateado.replace(/\s/g, '').replace(/,/g, ''));
}

/** El marcador «—» del artboard es una ausencia, y viaja como `null`, nunca como cero. */
function opcional(valor: string): string | null {
  return valor === SIN_VALOR || valor === '' ? null : valor;
}

/** Lo mismo, para un entero: `'—'` es el tramo abierto, no un cero. */
function enteroOpcional(valor: string): number | null {
  const texto = opcional(valor);
  return texto === null ? null : entero(texto);
}

/**
 * `'2026-09-06 15:22'` → `'2026-09-06T15:22:00Z'`.
 *
 * El artboard escribe la fecha de sellado como la dibuja y el backend publica un `Instant`. Lo
 * que se le anade —segundos y zona— esta declarado en `simulados.ts`.
 */
function instante(delArtboard: string): string | null {
  if (delArtboard === '') return null;
  return delArtboard.replace(' ', 'T') + simulado<string>('zonaDelSellado');
}

/**
 * El conjunto entero, en la pagina cero.
 *
 * No pagina: sirve todo lo que hay y lo dice —`hayMas` en falso, una sola pagina—. Es la
 * respuesta honesta de quien no sabe como se corta.
 */
function todoEnUnaPagina<T>(contenido: readonly T[]): unknown {
  return {
    contenido,
    pagina: 0,
    tamano: contenido.length,
    totalElementos: contenido.length,
    totalPaginas: 1,
    hayMas: false,
  };
}

// ── Los cuerpos ─────────────────────────────────────────────────────────────────────────────

/** Una edicion de la captura, con la forma de `ConjuntoResource`. */
function conjuntoResource(edicion: EdicionDelConjunto): unknown {
  return {
    id: edicion.id,
    ejercicio: edicion.ejercicio,
    version: edicion.version,
    estado: edicion.estado,
    fechaSellado: instante(edicion.fechaSellado),
    usuarioSellado: edicion.usuarioSellado === '' ? null : edicion.usuarioSellado,
  };
}

/** El documento fuente de una edicion de cuadro, por su identificador. */
function fuenteDe(id: string): string {
  const cuadro = CUADROS.find((c) => c.id === id);
  if (cuadro === undefined) {
    throw new Error(`La captura no tiene la edicion de cuadro «${id}».`);
  }
  return cuadro.documentoFuente;
}

/** Las 33 filas del corpus, con la forma de `ParametroDelSnapshot`. */
function parametrosDelSnapshot(): readonly unknown[] {
  return PARAMETROS.map((f) => ({
    tipo: f[0],
    clave: opcional(f[1]),
    valorNumerico: opcional(f[2]),
    valorTexto: opcional(f[3]),
    vigenciaDesde: opcional(f[4]),
    vigenciaHasta: opcional(f[5]),
    documentoFuente: f[6],
  }));
}

/** Las 24 celdas del Anexo I.2, con la forma de `ValorUnitarioDelSnapshot`. */
function valoresUnitariosDelSnapshot(): readonly unknown[] {
  const fuente = fuenteDe('unitarios');
  return VALORES_UNITARIOS.map((f) => ({
    partida: f[0],
    categoria: f[1],
    anioConstruccionDesde: entero(f[2]),
    anioConstruccionHasta: enteroOpcional(f[3]),
    valorM2: decimal(f[4]),
    documentoFuente: fuente,
  }));
}

/** Las 14 filas del RNT, con la forma de `DepreciacionDelSnapshot`. */
function depreciacionesDelSnapshot(): readonly unknown[] {
  const fuente = fuenteDe('depreciacion');
  return DEPRECIACIONES.map((f) => ({
    uso: f[0],
    material: f[1],
    estadoConservacion: f[2],
    antiguedadHasta: enteroOpcional(f[3]),
    porcentaje: decimal(f[4]),
    documentoFuente: fuente,
  }));
}

/** Las 10 filas del anexo del MEF, con la forma de `ValorReferencialDelSnapshot`. */
function valoresReferencialesDelSnapshot(): readonly unknown[] {
  const fuente = fuenteDe('referenciales');
  return VALORES_REFERENCIALES.map((f) => ({
    ejercicio: entero(f[0]),
    categoria: f[1],
    marca: f[2],
    modelo: f[3],
    anioFabricacion: entero(f[4]),
    valor: decimal(f[5]),
    documentoFuente: fuente,
  }));
}

/**
 * El snapshot entero, con la forma y **el orden** de `SnapshotResource`.
 *
 * <h2>Las cuatro listas llegan llenas, y eso es no filtrar</h2>
 *
 * El backend reparte los cuadros por ambito —`VALUACION` lleva los dos de la valuacion,
 * `OBLIGACION` lleva los valores referenciales, y los parametros van en los dos— y el proxy no
 * mira la consulta (AC5). Asi que sirve las cuatro llenas y **el ambito que declara es fijo**.
 * Fingir el reparto seria fingir el filtro.
 *
 * <h2>`filas` se CUENTA, no se copia</h2>
 *
 * Es la suma de las cuatro listas servidas, como `SnapshotDelConjunto.filas()`. La captura trae
 * 24 + 14 + 10 filas de cuadro donde el corpus tiene 24 + 492 + 54 129: copiar los totales del
 * corpus haria que `filas` dijera 54 678 mientras el cuerpo trae 81, y una pantalla que dibujara
 * «54 678 filas» sobre 81 no tendria como enterarse.
 */
function snapshot(): unknown {
  const conjunto = simulado<number>('conjuntoDelSnapshot');
  const parametros = parametrosDelSnapshot();
  const unitarios = valoresUnitariosDelSnapshot();
  const depreciaciones = depreciacionesDelSnapshot();
  const referenciales = valoresReferencialesDelSnapshot();
  const edicion = EDICIONES.find((e) => e.id === conjunto) ?? edicionVigente();

  return {
    conjuntoId: conjunto,
    ejercicio: edicion.ejercicio,
    version: edicion.version,
    ambito: simulado<string>('ambitoDelSnapshot'),
    filas:
      parametros.length + unitarios.length + depreciaciones.length + referenciales.length,
    parametros,
    valoresUnitarios: unitarios,
    depreciaciones,
    valoresReferenciales: referenciales,
  };
}

/** Los cuatro nombres que `GuardiaDeParametros` admite en toda operacion. */
export const DIALECTO_DE_LA_PAGINACION: readonly string[] = [
  'pagina',
  'tamano',
  'ordenarPor',
  'direccion',
];

/** Lo que una operacion admite de verdad: lo suyo mas el dialecto. */
export function admitidosDe(operacion: Operacion): readonly string[] {
  return [...DIALECTO_DE_LA_PAGINACION, ...operacion.parametros];
}

/** Las cuatro que este sistema sirve, mas las tres que ADR-0025 §5 anticipa. */
export const OPERACIONES: readonly Operacion[] = [
  // ── Las cuatro reales, las cuatro GET ────────────────────────────────────────────────────
  {
    metodo: 'GET',
    ruta: '/seguridad/parametros',
    origen: 'REAL',
    forma: 'ConjuntoResource',
    // El handler no declara ningun `@RequestParam`: recibe `ParametrosDePaginacion`, y sus
    // cuatro componentes ya son el dialecto.
    parametros: [],
    obligatorios: [],
    cuerpo: () => todoEnUnaPagina(EDICIONES.map(conjuntoResource)),
  },
  {
    metodo: 'GET',
    ruta: '/seguridad/parametros/ejercicios/{ejercicio}',
    origen: 'REAL',
    forma: 'EjercicioParametrizadoResource',
    parametros: [],
    obligatorios: [],
    cuerpo: () => {
      const vigente = edicionVigente();
      return {
        ejercicio: vigente.ejercicio,
        sellado: true,
        conjuntoId: vigente.id,
        version: vigente.version,
      };
    },
  },
  {
    metodo: 'GET',
    ruta: '/conjuntos',
    origen: 'REAL',
    forma: 'ConjuntoVigenteResource',
    parametros: ['ejercicio'],
    obligatorios: ['ejercicio'],
    cuerpo: () => {
      const vigente = edicionVigente();
      return {
        conjuntoId: vigente.id,
        ejercicio: vigente.ejercicio,
        version: vigente.version,
      };
    },
  },
  {
    metodo: 'GET',
    ruta: '/conjuntos/{id}/snapshot',
    origen: 'REAL',
    forma: 'SnapshotResource',
    parametros: ['ambito'],
    obligatorios: ['ambito'],
    huella: true,
    cuerpo: snapshot,
  },

  // ── Las tres simuladas, que viven en `simulados.ts` ──────────────────────────────────────
  ...ESCRITURAS_SIMULADAS.map(
    (escritura): Operacion => ({
      metodo: escritura.metodo,
      ruta: escritura.ruta,
      origen: 'SIMULADA',
      parametros: [],
      obligatorios: [],
      cuerpo: escritura.cuerpo,
      negativa: escritura.negativa,
    }),
  ),
];

/** El ejercicio del que hablan los cuerpos servidos. Lo usan las pruebas y las pantallas. */
export const EJERCICIO_SERVIDO = EJERCICIO_DE_CAPTURA;
