import { existsSync, readFileSync } from 'node:fs';

import { rutaDe, type Artboard } from './artboards.ts';

/**
 * **Lo que un artboard con la gramatica V8 declara, leido como dato.**
 *
 * Es el lector de `rentas/frontend/verificaciones/artboard-v8.ts@ac379ac`, con una diferencia: el
 * artboard entra **como parametro**. Aquel buscaba `RentasV8.dc.html` en su lista; este lee el que
 * se le pase, para que `NormativaV8.dc.html` —y, si alguna vez hace falta comparar,
 * `RentasV8.dc.html`— se lean con el MISMO analizador. Dos analizadores del mismo concepto pueden
 * divergir, y el que divergiera compararia contra otra cosa sin decirlo.
 *
 * <h2>Aqui NO se lee ningun archivo al importar</h2>
 *
 * Es la leccion de `rentas`#78: una guarda que lee su artboard en el cuerpo del modulo muere
 * durante la RECOLECCION con un `ENOENT` el dia que el archivo no esta, y sus `it` no llegan a
 * existir. Asi que este modulo solo declara funciones: el disco se toca cuando alguien llama a
 * {@link artboardV8}, o sea **dentro de un `it`**, y si el archivo falta el rojo lo nombra con su
 * procedencia.
 *
 * <h2>Y no se interpreta con `eval`, ni con `JSON.parse` sobre una sustitucion</h2>
 *
 * `PANTALLAS` lleva comentarios dentro —`/* ═══ Panel ═══ *\/`— que `JSON.parse` no admite, y
 * `ARBOL` nombra la constante `PROPIO` en vez de repetir su texto. Un lector de verdad —cadenas,
 * comentarios, identificadores— es mas corto que las excepciones que harian falta, y falla
 * diciendo en que posicion se perdio. Las rutas del arbol llevan llaves
 * —`/conjuntos/{id}/snapshot`— y un contador ingenuo las tomaria por el principio de un objeto.
 */

/* ── El lector de literales de JavaScript ──────────────────────────────────────────────── */

/** Lo que un literal del artboard puede ser. */
export type ValorDelArtboard =
  | string
  | number
  | boolean
  | null
  | readonly ValorDelArtboard[]
  | { readonly [clave: string]: ValorDelArtboard };

/** Lee el literal que empieza en `posicion`. */
function leerValor(
  texto: string,
  posicion: number,
  constantes: Readonly<Record<string, ValorDelArtboard>>,
): ValorDelArtboard {
  let i = posicion;

  const saltarHueco = (): void => {
    for (;;) {
      while (i < texto.length && /\s/.test(texto.charAt(i))) i += 1;
      if (texto.startsWith('/*', i)) {
        const cierre = texto.indexOf('*/', i + 2);
        i = cierre === -1 ? texto.length : cierre + 2;
        continue;
      }
      if (texto.startsWith('//', i)) {
        const salto = texto.indexOf('\n', i);
        i = salto === -1 ? texto.length : salto + 1;
        continue;
      }
      return;
    }
  };

  const leerCadena = (): string => {
    const comilla = texto.charAt(i);
    i += 1;
    let salida = '';
    while (i < texto.length && texto.charAt(i) !== comilla) {
      if (texto.charAt(i) === '\\') {
        salida += texto.charAt(i + 1);
        i += 2;
      } else {
        salida += texto.charAt(i);
        i += 1;
      }
    }
    if (i >= texto.length) throw new Error(`una cadena abierta en ${posicion} no se cierra`);
    i += 1;
    return salida;
  };

  const donde = (): string => JSON.stringify(texto.slice(i, i + 40));

  const valor = (): ValorDelArtboard => {
    saltarHueco();
    const caracter = texto.charAt(i);

    if (caracter === '[') {
      i += 1;
      const salida: ValorDelArtboard[] = [];
      for (;;) {
        saltarHueco();
        if (i >= texto.length) throw new Error(`una lista abierta no se cierra: ${donde()}`);
        if (texto.charAt(i) === ']') {
          i += 1;
          return salida;
        }
        salida.push(valor());
        saltarHueco();
        if (texto.charAt(i) === ',') i += 1;
      }
    }

    if (caracter === '{') {
      i += 1;
      const salida: Record<string, ValorDelArtboard> = {};
      for (;;) {
        saltarHueco();
        if (i >= texto.length) throw new Error(`un objeto abierto no se cierra: ${donde()}`);
        if (texto.charAt(i) === '}') {
          i += 1;
          return salida;
        }
        let clave: string;
        if (texto.charAt(i) === "'" || texto.charAt(i) === '"') {
          clave = leerCadena();
        } else {
          const nombre = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(texto.slice(i));
          if (nombre === null) throw new Error(`clave ilegible en ${i}: ${donde()}`);
          clave = nombre[0];
          i += clave.length;
        }
        saltarHueco();
        if (texto.charAt(i) !== ':') throw new Error(`falta «:» tras «${clave}» en ${i}`);
        i += 1;
        salida[clave] = valor();
        saltarHueco();
        if (texto.charAt(i) === ',') i += 1;
      }
    }

    if (caracter === "'" || caracter === '"') return leerCadena();

    const numero = /^-?\d+(\.\d+)?/.exec(texto.slice(i));
    if (numero !== null) {
      i += numero[0].length;
      return Number(numero[0]);
    }

    const identificador = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(texto.slice(i));
    if (identificador !== null) {
      const nombre = identificador[0];
      i += nombre.length;
      if (nombre === 'true') return true;
      if (nombre === 'false') return false;
      if (nombre === 'null') return null;
      const resuelta = constantes[nombre];
      if (resuelta === undefined) {
        throw new Error(
          `el artboard nombra la constante «${nombre}» y esta guarda no sabe su valor. ` +
            'Anadela a las constantes que se resuelven antes de leer el literal.',
        );
      }
      return resuelta;
    }

    throw new Error(`no se puede leer el literal en ${i}: ${donde()}`);
  };

  return valor();
}

/**
 * El valor de `const <nombre> = …` en el texto de un artboard.
 *
 * Exportada porque `el-artboard-dice-lo-que-cuenta` lee `PROPIO` y `RAIZ` con ella: dos constantes
 * de una linea no justifican un segundo lector.
 */
export function constanteDelArtboard(
  html: string,
  nombre: string,
  constantes: Readonly<Record<string, ValorDelArtboard>> = {},
): ValorDelArtboard {
  const marca = `const ${nombre} = `;
  const inicio = html.indexOf(marca);
  if (inicio === -1) {
    throw new Error(
      `El artboard ya no declara «const ${nombre}»: la referencia cambio. ` +
        'Esta guarda compara contra esa constante, asi que sin ella no compara nada.',
    );
  }
  return leerValor(html, inicio + marca.length, constantes);
}

/* ── La forma posicional del artboard ──────────────────────────────────────────────────── */

/** `[verbo, ruta, nota]`. */
export type OperacionDelArtboard = readonly [string, string, string];
/** `[pieza, uso]`. */
export type PiezaDelArtboard = readonly [string, string];
/** `[clave, rotulo, operaciones, piezas]`. */
export type HojaDelArtboard = readonly [
  string,
  string,
  readonly OperacionDelArtboard[],
  readonly PiezaDelArtboard[],
];
/** `[rotulo, nota, clave, codigo, trazos, submodulos]`. */
export type ModuloDelArtboard = readonly [
  string,
  string,
  string,
  string,
  readonly string[],
  readonly HojaDelArtboard[],
];

/** `[etiqueta, tipo]` o `[etiqueta, tipo, opciones | ayuda | valor]`. */
export type CampoDelArtboard =
  | readonly [string, string]
  | readonly [string, string, string | readonly string[]];

/** `{ t, c, f, n?, i?, a?, cn? }`. */
export interface TablaDelArtboard {
  readonly t: string;
  readonly c: readonly (readonly [string, number])[];
  readonly f: readonly (readonly string[])[];
  readonly n?: string;
  readonly i?: number;
  readonly a?: string;
  readonly cn?: string;
}

/** `[titulo, nota, campos]` o `[titulo, nota, campos, tabla]`. */
export type BloqueDelArtboard =
  | readonly [string, string, readonly CampoDelArtboard[]]
  | readonly [string, string, readonly CampoDelArtboard[], TablaDelArtboard];

/**
 * `const BARRA`: la barra global que G2 decidio (hneyra/normativa#76).
 *
 * `titulo` viaja a `src/` como texto; `entidad` y los tres de `cuenta` son marcadores de dato de
 * sesion; las dos notas son del artboard y no viajan.
 */
export interface BarraDelArtboard {
  readonly titulo: string;
  readonly entidad: string;
  readonly notaEntidad: string;
  readonly cuenta: { readonly iniciales: string; readonly nombre: string; readonly nota: string };
  readonly notaCuenta: string;
}

/** `const TONOS`: el tono de una insignia, por la primera celda de su fila o por su texto. */
export interface TonosDelArtboard {
  readonly porTexto: readonly (readonly [texto: string, tono: string])[];
  readonly porFila: readonly (readonly [primeraCelda: string, tono: string])[];
  readonly resto: string;
}

/** Las constantes que las guardas leen. */
export interface ArtboardV8 {
  /** El texto entero, para las guardas que buscan cadenas en el archivo. */
  readonly html: string;
  readonly propio: string;
  readonly raiz: string;
  readonly barra: BarraDelArtboard;
  readonly tonos: TonosDelArtboard;
  readonly arbol: readonly ModuloDelArtboard[];
  readonly pantallas: Readonly<Record<string, readonly BloqueDelArtboard[]>>;
  readonly instrucciones: Readonly<Record<string, string>>;
}

const memoria = new Map<string, ArtboardV8>();

/**
 * Ese artboard, leido y memorizado por ruta.
 *
 * **Llamala desde dentro de un `it`, nunca desde el cuerpo del modulo.** Es lo unico que separa «la
 * guarda se pone roja diciendo que falta el artboard» de «las pruebas de la guarda dejan de
 * existir».
 */
export function artboardV8(artboard: Artboard): ArtboardV8 {
  const ruta = rutaDe(artboard);
  const recordado = memoria.get(ruta);
  if (recordado !== undefined) return recordado;

  if (!existsSync(ruta)) {
    throw new Error(
      `FALTA EL ARTBOARD VENDORIZADO: ${artboard.archivo}\n\n` +
        `  Que dibuja: ${artboard.que}\n` +
        `  De donde se trae: ${artboard.deDonde}\n\n` +
        '  Sin el no hay contra que comparar: esta guarda se pone roja NOMBRANDO el archivo en\n' +
        '  vez de morir durante la recoleccion con un ENOENT.',
    );
  }

  const html = readFileSync(ruta, 'utf8');
  const propio = constanteDelArtboard(html, 'PROPIO');
  const leido: ArtboardV8 = {
    html,
    propio: String(propio),
    raiz: String(constanteDelArtboard(html, 'RAIZ')),
    barra: constanteDelArtboard(html, 'BARRA') as unknown as BarraDelArtboard,
    tonos: constanteDelArtboard(html, 'TONOS') as unknown as TonosDelArtboard,
    arbol: constanteDelArtboard(html, 'ARBOL', { PROPIO: propio }) as readonly ModuloDelArtboard[],
    pantallas: constanteDelArtboard(html, 'PANTALLAS') as Readonly<
      Record<string, readonly BloqueDelArtboard[]>
    >,
    instrucciones: constanteDelArtboard(html, 'INSTRUCCIONES') as Readonly<Record<string, string>>,
  };
  memoria.set(ruta, leido);
  return leido;
}

/** Las hojas del artboard, en el orden del arbol, aplanadas. */
export function hojasDelArtboard(artboard: Artboard): readonly HojaDelArtboard[] {
  return artboardV8(artboard).arbol.flatMap((modulo) => modulo[5]);
}

/** Todos los bloques, en el orden de `PANTALLAS`. */
export function bloquesDelArtboard(artboard: Artboard): readonly BloqueDelArtboard[] {
  return Object.values(artboardV8(artboard).pantallas).flat();
}

/** Si el tipo de un campo es de solo lectura: `r` o su variante de ancho completo `r1`. */
export const esDeSoloLectura = (campo: CampoDelArtboard): boolean =>
  campo[1] === 'r' || campo[1] === 'r1';

/* ── Lo que viaja y lo que no ──────────────────────────────────────────────────────────── */

/** Una cadena del artboard con la coordenada que la nombra en un rojo. */
export interface CadenaDelArtboard {
  readonly donde: string;
  readonly texto: string;
}

/** `nor-panel · bloque 0 «Estado del ejercicio»`: lo que un rojo tiene que decir para encontrarla. */
const coordenada = (hoja: string, indice: number, bloque: BloqueDelArtboard): string =>
  `${hoja} · bloque ${String(indice)} «${bloque[0]}»`;

/**
 * **Lo que acabara en `src/`**: el texto de la pantalla, que la definicion de hneyra/normativa#58
 * transcribe.
 *
 * Es la lista de `rentas/frontend/src/pantallas/tipos.ts@ac379ac`: los rotulos y notas del arbol,
 * las instrucciones, el titulo y la nota de cada bloque, la etiqueta de cada campo, las opciones de
 * un desplegable, la ayuda de un campo que se escribe y el texto de una casilla, y de cada tabla
 * su titulo, sus columnas, su nota y su accion.
 *
 * **Y la barra global** (hneyra/normativa#76), que no es de `tipos.ts` sino de la configuracion del
 * `Armazon` de `@kamayuk/shell`: su titulo viaja como texto, y la entidad y la cuenta viajan como el
 * hueco que la sesion rellena. Van aqui para que un literal que se cuele en cualquiera de las cinco
 * lo vea la misma guarda que ve una cifra en una nota. Las notas de los marcadores no viajan.
 *
 * **No** viajan —desde `rentas`#97— el valor de un campo de solo lectura, las filas `f` ni el
 * conteo `cn`: son ejemplo, y los devuelve {@link ejemplosDe}.
 */
export function loQueViaja(artboard: Artboard): readonly CadenaDelArtboard[] {
  const { arbol, pantallas, instrucciones, barra } = artboardV8(artboard);
  const salida: CadenaDelArtboard[] = [];
  const anotar = (donde: string, texto: string): void => {
    if (texto !== '') salida.push({ donde, texto });
  };

  anotar('barra · titulo', barra.titulo);
  for (const { donde, texto } of huecosDeSesion(artboard)) anotar(donde, texto);

  for (const modulo of arbol) {
    anotar(`arbol · modulo «${modulo[2]}» · rotulo`, modulo[0]);
    anotar(`arbol · modulo «${modulo[2]}» · nota`, modulo[1]);
    for (const hoja of modulo[5]) anotar(`arbol · hoja «${hoja[0]}» · rotulo`, hoja[1]);
  }
  for (const [hoja, texto] of Object.entries(instrucciones)) anotar(`${hoja} · instruccion`, texto);

  for (const [hoja, bloques] of Object.entries(pantallas)) {
    bloques.forEach((bloque, indice) => {
      const aqui = coordenada(hoja, indice, bloque);
      anotar(`${aqui} · titulo`, bloque[0]);
      anotar(`${aqui} · nota`, bloque[1]);
      bloque[2].forEach((campo, j) => {
        const delCampo = `${aqui} · campo ${String(j)} «${campo[0]}»`;
        anotar(`${delCampo} · etiqueta`, campo[0]);
        if (esDeSoloLectura(campo) || campo.length < 3) return;
        const tercero = campo[2];
        if (Array.isArray(tercero)) {
          tercero.forEach((opcion) => {
            anotar(`${delCampo} · opcion`, opcion);
          });
        } else {
          anotar(`${delCampo} · ayuda`, String(tercero));
        }
      });
      const tabla = bloque[3];
      if (tabla === undefined) return;
      anotar(`${aqui} · tabla · titulo`, tabla.t);
      tabla.c.forEach(([rotulo], j) => {
        anotar(`${aqui} · tabla · columna ${String(j)}`, rotulo);
      });
      anotar(`${aqui} · tabla · nota`, tabla.n ?? '');
      anotar(`${aqui} · tabla · accion`, tabla.a ?? '');
    });
  }
  return salida;
}

/**
 * **Los cuatro sitios de la barra que rellena la sesion**: la entidad y el nombre, las iniciales y la
 * nota de la cuenta. Tienen que ser marcadores (G2), y los devuelve con su coordenada.
 */
export function huecosDeSesion(artboard: Artboard): readonly CadenaDelArtboard[] {
  const { entidad, cuenta } = artboardV8(artboard).barra;
  return [
    { donde: 'barra · entidad', texto: String(entidad) },
    { donde: 'barra · cuenta · iniciales', texto: String(cuenta.iniciales) },
    { donde: 'barra · cuenta · nombre', texto: String(cuenta.nombre) },
    { donde: 'barra · cuenta · nota', texto: String(cuenta.nota) },
  ];
}

/**
 * **El tono con que el artboard pinta una insignia**, leido de su `const TONOS` con la misma regla que
 * su `tono(t, fila)`: primero la primera celda de la fila, despues el texto entero en minusculas, y si
 * no, `resto`.
 *
 * Es la unica logica del artboard que se repite aqui, y es a proposito una tabla de busqueda y no una
 * expresion regular: lo que el artboard y esta funcion comparten es el DATO, y la regla que lo recorre
 * cabe en tres lineas que se leen de un vistazo en los dos sitios.
 */
export function tonoDeLaInsignia(
  artboard: Artboard,
  texto: string,
  fila: readonly string[],
): string {
  const { porFila, porTexto, resto } = artboardV8(artboard).tonos;
  const deFila = porFila.find(([primera]) => primera === fila[0]);
  if (deFila !== undefined) return deFila[1];
  const deTexto = porTexto.find(([valor]) => valor === texto.toLowerCase());
  return deTexto === undefined ? resto : deTexto[1];
}

/**
 * **Los valores de ejemplo**: el tercer elemento de cada campo de solo lectura, cada celda de las
 * filas `f` y el conteo `cn`. Ninguno viaja a `src/` (`rentas`#97); viven solo en el artboard.
 */
export function ejemplosDe(artboard: Artboard): readonly CadenaDelArtboard[] {
  const salida: CadenaDelArtboard[] = [];
  for (const [hoja, bloques] of Object.entries(artboardV8(artboard).pantallas)) {
    bloques.forEach((bloque, indice) => {
      const aqui = coordenada(hoja, indice, bloque);
      bloque[2].forEach((campo, j) => {
        if (esDeSoloLectura(campo)) {
          salida.push({ donde: `${aqui} · campo ${String(j)} «${campo[0]}»`, texto: String(campo[2] ?? '') });
        }
      });
      const tabla = bloque[3];
      if (tabla === undefined) return;
      tabla.f.forEach((fila, j) => {
        fila.forEach((celda, k) => {
          salida.push({ donde: `${aqui} · fila ${String(j)} · celda ${String(k)}`, texto: celda });
        });
      });
      if (tabla.cn !== undefined) salida.push({ donde: `${aqui} · cn`, texto: tabla.cn });
    });
  }
  return salida;
}
