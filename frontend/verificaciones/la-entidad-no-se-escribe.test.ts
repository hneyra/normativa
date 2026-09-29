// @vitest-environment node
//
// Lee las fuentes del disco y mira su texto. No es un DOM lo que necesita.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MUNICIPALIDAD_MEDIDA, SESION_MEDIDA } from '../desarrollo/sesionMedida.ts';
import { LITERALES_DE_SESION } from './artboards.ts';

/**
 * **Ningun nombre de municipalidad se escribe en `src/`** (G2 de #52, actualizacion del 2026-09-15
 * de #64).
 *
 * G2 decidio que la entidad de la barra es la municipalidad **de la sesion**, resuelta por su
 * UBIGEO en `GET /seguridad/sesion/municipalidad`, y que **nunca** va como literal. `rentas` llevo
 * «Municipalidad Distrital de Catacaos» en su marco hasta su I-1, y la habria visto cualquier
 * municipalidad que no fuera Catacaos sin que ninguna prueba sobre los valores lo notara. Esta
 * guarda es la que lo nota: barre **todo `src/`** —produccion, pruebas y el locale— buscando las
 * formas de `LITERALES_DE_SESION`, que son las mismas con que `lo-que-viaja-no-lleva-cifras` mira
 * el artboard.
 *
 * <h2>Que se mira, y que no</h2>
 *
 * · **El codigo de produccion y el locale**: las cuatro formas —cualquier nombre de municipalidad,
 *   Catacaos, y las dos cuentas que ya estuvieron escritas en una barra—.
 * · **Las pruebas de `src/`**: solo la primera, la forma de CUALQUIER nombre de municipalidad. Una
 *   prueba puede decir «que no aparezca Catacaos» —es la negativa de G2—, pero no puede escribir
 *   el nombre de una municipalidad para compararlo: lo importa de la captura.
 * · **Los comentarios, no**: la prosa NOMBRA lo que se prohibe, y lo nombra mucho.
 *
 * **Y la captura de la sesion vive fuera de `src/`** (`desarrollo/sesionMedida.ts`), que es lo que
 * deja esta guarda sin una sola excepcion que tallar. Lo que se comprueba aqui es que esa captura
 * SI tiene la forma que se busca: si el patron dejara de reconocer el nombre de la captura, esta
 * guarda estaria vigilando el conjunto vacio.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const SRC = join(FRONTEND, 'src');

/** Todo lo de `src/` que lleva texto: codigo y locale. */
function archivosDe(desde = SRC): readonly string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return archivosDe(ruta);
    return /\.(tsx?|json)$/.test(entrada) ? [ruta] : [];
  });
}

/** El texto sin comentarios: los de bloque, los de linea entera y los de JSX. */
export function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

const esPrueba = (ruta: string) => /\.test\.tsx?$/.test(ruta);

/** Lo que se busca en cada archivo: las cuatro formas, o solo la del nombre si es una prueba. */
function formasPara(ruta: string): typeof LITERALES_DE_SESION {
  return esPrueba(ruta) ? LITERALES_DE_SESION.slice(0, 1) : LITERALES_DE_SESION;
}

/** Los hallazgos de un texto, con lo que dice cada forma. */
function hallazgosDe(texto: string, formas: typeof LITERALES_DE_SESION): readonly string[] {
  return formas.flatMap(([forma, que]) => {
    const encontrado = new RegExp(forma.source, `${forma.flags.replace('g', '')}g`).exec(texto);
    return encontrado === null ? [] : [`${que}: «${encontrado[0]}»`];
  });
}

describe('G2 — ningun nombre de municipalidad se escribe en `src/`', () => {
  it('EL CENTINELA: hay que barrer, y la forma reconoce el nombre de la captura', () => {
    // Sin esto, un `src/` que no se pudiera leer o una forma que ya no casara con nada dejarian la
    // guarda en verde vigilando nada.
    expect(archivosDe().length).toBeGreaterThan(40);
    expect(
      hallazgosDe(MUNICIPALIDAD_MEDIDA.nombre, LITERALES_DE_SESION),
      'la forma de un nombre de municipalidad no reconoce el de la captura de la sesion',
    ).not.toEqual([]);
    // Y los comentarios se quitan: la prosa de `src/sesion.ts` nombra a Catacaos a proposito.
    expect(hallazgosDe(sinComentarios('// Municipalidad Distrital de Catacaos'), LITERALES_DE_SESION)).toEqual([]);
    expect(
      hallazgosDe(sinComentarios("const entidad = 'Municipalidad Distrital de Catacaos';"), LITERALES_DE_SESION),
    ).not.toEqual([]);
  });

  it('ni en el codigo, ni en las pruebas, ni en el locale', () => {
    const culpables = archivosDe().flatMap((ruta) => {
      const texto = ruta.endsWith('.json') ? readFileSync(ruta, 'utf8') : sinComentarios(readFileSync(ruta, 'utf8'));
      return hallazgosDe(texto, formasPara(ruta)).map((h) => `  ${relative(FRONTEND, ruta)} — ${h}`);
    });

    expect(
      culpables,
      'Hay un nombre de municipalidad —o una cuenta— escrito en `src/`:\n' +
        `${culpables.join('\n')}\n\n` +
        '  G2 (#52): la entidad es la municipalidad DE LA SESION, que contesta\n' +
        '  `GET /seguridad/sesion/municipalidad`, y la cuenta la de `GET /seguridad/sesion`. Escritas,\n' +
        '  las ve igual cualquier municipalidad. Una prueba que necesite el nombre lo importa de\n' +
        '  `desarrollo/sesionMedida.ts`, que es la captura del backend.',
    ).toEqual([]);
  });

  it('y lo que la captura de la sesion lleva no esta en `src/`, NI EN UN COMENTARIO', () => {
    // Aqui los comentarios SI cuentan, y esta medido por que: el `.map` que `vite build` deja en
    // `dist/` lleva el fuente entero de cada modulo, comentarios incluidos. Un javadoc de
    // `src/sesion.ts` que ponia de ejemplo el nombre de la persona de la captura lo llevo al
    // paquete, y lo encontro `e2e/la-siembra-no-viaja-al-bundle.spec.ts`:
    //   assets/index-BSbE5Lq-.js.map — «Juan Perez Castillo»
    // Esto lo dice antes, sin construir, y nombrando el archivo.
    const deLaCaptura = [MUNICIPALIDAD_MEDIDA.nombre, SESION_MEDIDA.nombre, SESION_MEDIDA.cuenta];
    const enSrc = archivosDe().flatMap((ruta) => {
      const texto = readFileSync(ruta, 'utf8');
      return deLaCaptura
        .filter((cadena) => texto.includes(cadena))
        .map((cadena) => `  ${relative(FRONTEND, ruta)} — «${cadena}»`);
    });
    expect(
      enSrc,
      'Lo que contesta la sesion de la captura esta escrito en `src/`:\n' +
        `${enSrc.join('\n')}\n\n` +
        '  La captura vive en `desarrollo/sesionMedida.ts` y la leen las pruebas importandola. En\n' +
        '  `src/` viaja al paquete —el `.map` lleva hasta los comentarios—.',
    ).toEqual([]);
  });
});
