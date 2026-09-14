import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * La raiz de `frontend/`, deducida de este archivo.
 *
 * `verificaciones/tokens.ts` ya exporta una igual, y no se importa de alli a proposito: ese archivo
 * lee el artboard V6 y sale con la V6 (hneyra/normativa#50). Una guarda del artboard V8 que
 * dependiera de el moriria con el, que es la leccion de `rentas`#74: la guarda que avisa de que
 * algo falta no puede depender de ese algo.
 */
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Lo que el artboard V8 declara, **contado sobre el al cerrar hneyra/normativa#52**.
 *
 * <h2>Por que las cuentas viven aqui y no en cada prueba</h2>
 *
 * Las guardas de `rentas` llevan sus cuentas escritas en el cuerpo de cada prueba —10 modulos, 40
 * hojas, 45 bloques, 302 campos, 31 tablas— y por eso no se pueden calcar tal cual: copiadas aqui
 * afirmarian los numeros de OTRO sistema. Asi que se declaran **una vez, como dato, junto al
 * archivo que cuentan**, y las leen `el-artboard-dice-lo-que-cuenta` aqui y, en
 * hneyra/normativa#58, `pantallas-del-artboard` y `sin-cifras-inventadas`. Cambiar el artboard
 * obliga a cambiar este bloque en el mismo PR, y el rojo dice cual de las cuentas se movio.
 */
export interface CuentasDelArtboardV8 {
  readonly modulos: number;
  readonly hojas: number;
  readonly pantallas: number;
  readonly instrucciones: number;
  readonly bloques: number;
  readonly campos: number;
  /** Los de solo lectura, `r` y `r1`: los que llevan un valor de ejemplo. */
  readonly camposDeSoloLectura: number;
  readonly tablas: number;
  /** Un SUELO, no una cuenta: menos bytes que esto es un artboard truncado. */
  readonly bytesAlMenos: number;
}

/**
 * Los artboards que este repositorio vendoriza, con su procedencia.
 *
 * <h2>Por que una lista, y por que con procedencia</h2>
 *
 * Porque un artboard que falta no se distingue de uno que nadie tenia que traer. La lista dice
 * cuales se esperan; la procedencia dice de donde se vuelve a sacar el que falte, que es la
 * pregunta que uno se hace justo despues de leer el rojo.
 *
 * Viven en `frontend/diseno/` y viajan en el arbol —no se descargan al verificar— porque una
 * guarda que depende de la red no es una guarda: es una que se salta el dia que la red falla.
 * `.dockerignore` excluye `diseno/`, asi que ninguno entra en la imagen.
 */
export interface Artboard {
  /** El archivo, relativo a `frontend/`. */
  readonly archivo: string;
  /** Que dibuja, en una linea. */
  readonly que: string;
  /** De donde se trae si falta. */
  readonly deDonde: string;
  /**
   * Sus cuentas, si es un artboard con la gramatica V8.
   *
   * `NormativaV6.dc.html` no las lleva, y no es un olvido: su forma es otra —`MODULOS`, `PASOS`,
   * plantilla `sc-if`/`sc-for` y una clase con estado— y el lector de `artboard-v8.ts` no la sabe
   * leer. Contarla con otro lector seria un segundo analizador del mismo concepto, justo lo que
   * `artboard-v8.ts` existe para evitar.
   */
  readonly cuentas?: CuentasDelArtboardV8;
  /** El sha256 de sus bytes, si tiene que ser una copia EXACTA de otro archivo. */
  readonly sha256?: string;
}

export const ARTBOARDS: readonly Artboard[] = [
  {
    archivo: 'diseno/NormativaV6.dc.html',
    que: 'El artboard de la V6: trece modulos, el de `normativa` con sus cuatro secciones, y los datos del corpus con los que se dibujaba. Es la fuente de los EJEMPLOS del artboard V8. Sale en hneyra/normativa#69, con la V6.',
    deDonde: 'c01fe9a:frontend/diseno/NormativaV6.dc.html (git show)',
  },
  {
    archivo: 'diseno/NormativaV8.dc.html',
    que: 'El artboard NUEVO: un modulo, cuatro submodulos y cuatro pantallas con la gramatica de RentasV8. Es contra el que se reconstruye la interfaz (hneyra/normativa#58).',
    deDonde: 'derivado de RentasV8@ac379ac + NormativaV6@c01fe9a en hneyra/normativa#52',
    cuentas: {
      modulos: 1,
      hojas: 4,
      pantallas: 4,
      instrucciones: 4,
      bloques: 19,
      campos: 54,
      camposDeSoloLectura: 43,
      tablas: 10,
      bytesAlMenos: 85_000,
    },
  },
  {
    archivo: 'diseno/normativa-tokens.css',
    que: 'Los tokens que el artboard V8 pinta —colores, radios y sombras—. El `.dc.html` los ENLAZA y no los lleva dentro. Es la hoja de RentasV8 byte a byte: la paleta es de `@kamayuk/ui` y no de un sistema.',
    deDonde: 'copia de rentas-tokens.css@ac379ac',
    sha256: 'f19775fd44cb27360c84065fc8e3b1ac6964f7e3ad63f5fa037dbf20036a940e',
  },
];

/**
 * **La forma de una cifra del corpus**, las dos que un texto que viaja no puede llevar.
 *
 * - `5500.00`, `894.27`: la UIT, un valor unitario. Dos decimales sin separador, que es como las
 *   escribe el corpus y como las devuelve la API.
 * - `18,000.00`: un valor referencial vehicular, con separador de millares. Es la unica que la
 *   guarda de `rentas` cazaba, y sobre el artboard V6 solo encuentra las diez celdas del cuadro
 *   vehicular: ni la UIT ni un valor unitario.
 *
 * Se aplican a cada PALABRA del texto, no al texto entero: una nota que diga «la UIT es 5500.00»
 * no es una cadena con forma de cifra, pero lleva una.
 */
export const FORMAS_DE_CIFRA: readonly RegExp[] = [/^\d+\.\d{2}$/, /^\d{1,3}(?:,\d{3})+\.\d{2}$/];

/** El artboard declarado cuyo archivo acaba en `sufijo`. Lanza si no esta en la lista. */
export function artboardDeclarado(sufijo: string): Artboard {
  const encontrado = ARTBOARDS.find((a) => a.archivo.endsWith(sufijo));
  if (encontrado === undefined) {
    throw new Error(
      `«${sufijo}» no esta declarado en \`verificaciones/artboards.ts\`. Sin esa entrada la guarda ` +
        'no sabe contra que comparar, y `los-artboards-estan` no comprueba que exista.',
    );
  }
  return encontrado;
}

/** La ruta absoluta de un artboard declarado. */
export const rutaDe = (artboard: Artboard): string => join(RAIZ, artboard.archivo);

/**
 * Las cadenas del corpus que `frontend/Dockerfile` busca en lo que se sirve, **leidas del
 * `Dockerfile`** y no copiadas aqui.
 *
 * Copiarlas seria una segunda lista que se queda vieja sin que nada lo diga: `rentas` busco hasta
 * su #97 una cadena que ya no estaba en su artboard. Leyendolas, las guardas del artboard exigen
 * lo que la imagen de verdad comprueba. Se leen **al llamar**, nunca al importar; y si el
 * `Dockerfile` o su bucle faltan, el rojo lo dice aqui.
 */
export function cadenasQueBuscaElDockerfile(): readonly string[] {
  const ruta = join(RAIZ, 'Dockerfile');
  if (!existsSync(ruta)) {
    throw new Error(
      'Falta `frontend/Dockerfile`, y con el la comprobacion de que lo servido no lleva cifras del ' +
        'corpus. Las guardas del artboard exigen que sus ejemplos contengan lo que esa comprobacion ' +
        'busca: sin la lista no hay que exigir.',
    );
  }
  const bucle = /for cadena in ((?:'[^']*'\s*)+);/.exec(readFileSync(ruta, 'utf8'));
  if (bucle === null) {
    throw new Error(
      '`frontend/Dockerfile` ya no trae `for cadena in … ;`: la comprobacion de que lo servido no ' +
        'lleva cifras del corpus cambio de forma o se fue.',
    );
  }
  return [...(bucle[1] ?? '').matchAll(/'([^']*)'/g)].map(([, cadena]) => cadena ?? '');
}
