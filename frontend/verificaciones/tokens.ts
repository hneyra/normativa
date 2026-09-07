import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lo que las dos pruebas de tokens necesitan leer, leido UNA vez.
 *
 * `tokens-del-artboard.test.ts` compara los valores contra el artboard y
 * `contraste.test.ts` calcula sus ratios WCAG. Las dos parten del mismo archivo de CSS, y
 * si cada una lo interpretara a su manera podrian estar de acuerdo con dos paletas
 * distintas.
 *
 * No es un modulo de `src/`: no se empaqueta, no se importa desde la aplicacion y existe
 * solo para que las barreras midan lo mismo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** La raiz de `frontend/`. */
export const RAIZ = join(AQUI, '..');

/** El directorio de los cinco archivos de tokens. */
export const TOKENS = join(RAIZ, 'src/estilos/tokens');

/**
 * El artboard de este modulo, vendorizado en #9.
 *
 * Vive en el repositorio y no en un directorio de trabajo porque **la comparacion tiene que
 * poder correr en la CI**: una prueba que solo pasa en la maquina donde alguien bajo el
 * archivo no verifica nada en un PR.
 *
 * Los tokens se leen de AQUI y no se copian de `rentas`, aunque las once constantes con
 * nombre coincidan. Copiarlas habria heredado sus decisiones sin nada que las atara a este
 * modulo; leyendolas, cambiar una en el CSS pone esta prueba roja — y si algun dia el
 * artboard de `normativa` se separa del de `rentas`, se enteran los tokens de `normativa`.
 */
export const ARTBOARD = join(RAIZ, 'diseno/NormativaV6.dc.html');

export const leer = (ruta: string): string => readFileSync(ruta, 'utf8');

/**
 * El CSS sin sus comentarios.
 *
 * Los comentarios de este proyecto NOMBRAN tokens —«`--tinta-4` es la unica que…»— y
 * escriben hexadecimales al citar el artboard, asi que un analizador que no los quite
 * acabaria leyendo la prosa como si fueran declaraciones. Se quitan antes de mirar nada.
 */
export const sinComentarios = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * El contenido de un bloque `{ … }` que empieza en el selector dado.
 *
 * Cuenta llaves en vez de buscar el primer `}`, porque un bloque de tema envuelve a otro:
 * `@media (…) { :root:not(…) { … } }`.
 */
export function bloque(cssConComentarios: string, selector: string): string {
  const css = sinComentarios(cssConComentarios);
  const inicio = css.indexOf(selector);
  if (inicio === -1) {
    throw new Error(`No hay ningun bloque «${selector}» en el CSS.`);
  }

  let profundidad = 0;
  for (let i = css.indexOf('{', inicio); i < css.length; i += 1) {
    if (css[i] === '{') {
      profundidad += 1;
    } else if (css[i] === '}') {
      profundidad -= 1;
      if (profundidad === 0) {
        return css.slice(css.indexOf('{', inicio) + 1, i);
      }
    }
  }
  throw new Error(`El bloque «${selector}» no se cierra.`);
}

/** Las custom properties declaradas en un trozo de CSS, en orden de aparicion. */
export function propiedades(cssConComentarios: string): Map<string, string> {
  const css = sinComentarios(cssConComentarios);
  const declaradas = new Map<string, string>();
  const patron = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let encontrada = patron.exec(css);
  while (encontrada !== null) {
    const [, nombre, valor] = encontrada;
    if (nombre !== undefined && valor !== undefined) {
      declaradas.set(nombre, valor.trim());
    }
    encontrada = patron.exec(css);
  }
  return declaradas;
}

/** El `#rgb` de tres digitos, expandido a seis, y todo en minusculas. */
export function normalizar(hex: string): string {
  const limpio = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(limpio)) {
    const [, r, g, b] = limpio;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return limpio;
}

/** Las tres paletas de `colors.css`: la clara y las dos declaraciones de la oscura. */
export function paletas(): {
  claro: Map<string, string>;
  oscuroPorPreferencia: Map<string, string>;
  oscuroPorAtributo: Map<string, string>;
} {
  const css = leer(join(TOKENS, 'colors.css'));
  return {
    claro: propiedades(bloque(css, ':root {')),
    oscuroPorPreferencia: propiedades(bloque(css, '@media (prefers-color-scheme: dark) {')),
    oscuroPorAtributo: propiedades(bloque(css, ":root[data-tema='oscuro'] {")),
  };
}

/**
 * Las constantes con nombre del artboard: `const AZUL = '#005284';`.
 *
 * Viven en el bloque `<script type="text/x-dc" data-dc-script>` de `NormativaV6.dc.html`,
 * que es donde el prototipo declara su paleta.
 */
export function constantesDelArtboard(): Map<string, string> {
  const html = leer(ARTBOARD);
  const declaradas = new Map<string, string>();
  // Sin `$` al final: un artboard guardado con fin de linea de Windows dejaria un `\r`
  // delante y el ancla no casaria, de modo que la prueba no encontraria NINGUNA constante y
  // —si no fuera por la comprobacion de que son once— pasaria en verde sin comparar nada.
  const patron = /^const ([A-Z][A-Z0-9_]*) = '(#[0-9A-Fa-f]{3,6})';/gm;
  let encontrada = patron.exec(html);
  while (encontrada !== null) {
    const [, nombre, valor] = encontrada;
    if (nombre !== undefined && valor !== undefined) {
      declaradas.set(nombre, normalizar(valor));
    }
    encontrada = patron.exec(html);
  }
  return declaradas;
}

/** Todos los colores hexadecimales que aparecen en el artboard, normalizados. */
export function coloresDelArtboard(): Set<string> {
  const html = leer(ARTBOARD);
  const encontrados = new Set<string>();
  for (const hex of html.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g) ?? []) {
    encontrados.add(normalizar(hex));
  }
  return encontrados;
}
