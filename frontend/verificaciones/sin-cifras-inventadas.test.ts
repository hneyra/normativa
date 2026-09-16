// @vitest-environment node
//
// Barre `src/` y lee el artboard. No es un DOM lo que necesita.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FORMAS_DE_CIFRA,
  RAIZ,
  artboardDeclarado,
  cadenasQueBuscaElDockerfile,
  rutaDe,
  type Artboard,
} from './artboards.ts';
import { ejemplosDe } from './artboard-v8.ts';

/**
 * **Ni una cifra inventada en el codigo que se sirve** (#58, AC 7).
 *
 * <h2>La historia, porque explica por que esta guarda es como es</h2>
 *
 * · La V6 lo cumplia por otra via: las cifras vivian detras de un proxy con bandera, y el
 *   `Dockerfile` buscaba cinco cadenas en lo servido. Esa negativa sigue, y sigue siendo la unica
 *   que impide **publicar** una imagen sucia.
 * · `rentas` lo rompio en su #90 —las cuarenta pantallas de V8 llevaban las cifras de ejemplo
 *   DENTRO de su definicion— y lo recupero en su #97: las definiciones conservan la FORMA y las
 *   cifras se quedan solo en el artboard, que viaja vendorizado, no esta bajo `src/` y no lo
 *   importa una linea de produccion.
 * · Aqui se escribe **antes** de que ninguna cifra haya llegado a `src/`, y es a proposito: la
 *   barrera se pone antes que el negocio.
 *
 * <h2>Por que se barre `src/` y no el `dist/`</h2>
 *
 * Porque el `dist/` hay que construirlo y porque un rojo sobre el `dist` dice «hay una cifra en un
 * archivo minificado de 200 kB», que no se puede leer. Barriendo `src/` el rojo nombra **el archivo
 * y la cifra**. La comprobacion sobre lo servido sigue existiendo, en el `Dockerfile`; esta es la
 * que lo dice antes.
 *
 * <h2>Que cifras, y por que NO todas las del artboard</h2>
 *
 * El artboard trae cientos de cadenas entre valores y celdas, y muchas son inocentes: «2026», «—»,
 * «SELLADO», «hneyra». Buscarlas todas daria rojos sobre codigo legitimo, y una guarda que da rojos
 * sobre codigo bueno se acaba desactivando. Se buscan las **inconfundibles**, y son dos listas:
 *
 * · Las que casan con `FORMAS_DE_CIFRA` de `artboards.ts` —las dos que #52 declaro como dato: dos
 *   decimales con separador de millares o sin el, `894.27` y `18,000.00`—. La de `rentas`
 *   (`sin-cifras-inventadas.test.ts@ac379ac:64`) solo tenia la segunda, y sobre este corpus eso
 *   dejaba fuera la UIT y los 24 valores unitarios: **no se calca, se lee del dato**.
 * · Las **cinco del `Dockerfile`**, leidas de el y no copiadas. Dos de ellas —«AUTOCRAFT»,
 *   «Carreras de caballos»— no son cifras y son igual de delatoras.
 *
 * <h2>Y se omiten los COMENTARIOS, como hacen las otras guardas de este arbol</h2>
 *
 * Porque un docblock **tiene que poder citar lo que explica**: el de `src/pantallas/index.ts` dice
 * de que artboard salen las cifras, y eso es la explicacion y no un dato. Es la misma decision que
 * toma `sin-el-nombre-del-monolito` en `infrastructure` y por el mismo motivo. Lo que no puede
 * aparecer es en el CODIGO, que es lo que viaja.
 */

const NORMATIVA_V8 = (): Artboard => artboardDeclarado('NormativaV8.dc.html');

/**
 * Las cadenas de ejemplo del artboard que **no pueden ser otra cosa**, mas las del `Dockerfile`.
 *
 * Se calcula **al llamar** y no en el cuerpo del modulo: es lo que separa «la guarda se pone roja
 * diciendo que falta el artboard» de «las pruebas de la guarda dejan de existir» (`rentas`#78).
 */
function inconfundibles(): readonly string[] {
  const delArtboard = ejemplosDe(NORMATIVA_V8())
    .map(({ texto }) => texto)
    .filter((texto) => FORMAS_DE_CIFRA.some((forma) => forma.test(texto)));
  return [...new Set([...delArtboard, ...cadenasQueBuscaElDockerfile()])];
}

/** Sin comentarios de bloque ni de linea. Ver el javadoc. */
const sinComentarios = (fuente: string): string =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');

/** Todo el codigo de produccion, archivo a archivo. */
function fuentes(dir: string): readonly { readonly ruta: string; readonly texto: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return fuentes(ruta);
    if (!/\.tsx?$/.test(entrada.name) || entrada.name.includes('.test.')) return [];
    return [{ ruta, texto: sinComentarios(readFileSync(ruta, 'utf8')) }];
  });
}

describe('el codigo que se sirve no lleva cifras inventadas', () => {
  it('EL CENTINELA: el artboard trae cifras inconfundibles, y hay fuentes que barrer', () => {
    // Sin esto, un artboard que dejara de traerlas —o una ruta mal calculada— dejaria la
    // comprobacion de abajo buscando la lista vacia y pasando en verde sobre la nada. Es como
    // `rentas` se quedo sin guarda dos veces (#78, #80).
    expect(
      inconfundibles().length,
      'el artboard no trae ni una cifra inconfundible',
    ).toBeGreaterThan(30);
    expect(fuentes(join(RAIZ, 'src')).length, 'no se leyo ni una fuente de `src/`').toBeGreaterThan(
      8,
    );
    // Y que lo leido es el artboard entero y no un archivo truncado. El suelo es el de
    // `artboards.ts`, no un numero escrito aqui.
    const suelo = NORMATIVA_V8().cuentas?.bytesAlMenos ?? 0;
    expect(suelo, '`artboards.ts` no declara el suelo de bytes del artboard').toBeGreaterThan(0);
    expect(
      readFileSync(rutaDe(NORMATIVA_V8()), 'utf8').length,
      'el artboard vino vacio o truncado',
    ).toBeGreaterThan(suelo);
  });

  it('ninguna aparece en `src/`', () => {
    const cifras = inconfundibles();
    const hallazgos = fuentes(join(RAIZ, 'src')).flatMap(({ ruta, texto }) =>
      cifras.filter((cifra) => texto.includes(cifra)).map((cifra) => `  ${ruta}: «${cifra}»`),
    );
    expect(
      hallazgos,
      'Hay cifras de ejemplo del artboard en el codigo que se sirve:\n' +
        `${hallazgos.join('\n')}\n\n` +
        '  `normativa` existe para que las cifras normativas vivan en el corpus firmado a dos manos\n' +
        '  y se PIDAN (regla 5, ADR-0007). Las de ejemplo viven en `diseno/NormativaV8.dc.html`,\n' +
        '  que no viaja y que `.dockerignore` deja fuera de la imagen; lo que la pantalla no sepa,\n' +
        '  se dice.',
    ).toEqual([]);
  });

  it('y el `Dockerfile` vuelve a comprobarlo sobre lo SERVIDO', () => {
    // Esta prueba mira `src/`; la del Dockerfile mira lo que nginx tiene como raiz, que es lo unico
    // que impide **publicar** una imagen sucia. Las dos hacen falta: `rentas`#44 midio que un
    // `COPY` en la ultima etapa se salta cualquier comprobacion hecha en una anterior.
    const dockerfile = readFileSync(join(RAIZ, 'Dockerfile'), 'utf8');
    expect(dockerfile, 'el Dockerfile dejo de buscar cifras').toMatch(/for cadena in/);

    const cifras = inconfundibles();
    const delDockerfile = cadenasQueBuscaElDockerfile();
    expect(delDockerfile.length, 'el Dockerfile no busca ni una cadena').toBe(5);
    for (const cadena of delDockerfile) {
      expect(dockerfile, `el Dockerfile no busca «${cadena}»`).toContain(cadena);
      expect(
        cifras,
        `«${cadena}» no esta entre las inconfundibles: esta guarda y la imagen buscarian cosas ` +
          'distintas, y la que se salta una no lo diria.',
      ).toContain(cadena);
    }
  });

  it('y las cinco del `Dockerfile` siguen estando en el artboard: no busca lo que no existe', () => {
    // La leccion de `rentas`#97: una lista escrita en un Dockerfile se queda vieja sin que nada lo
    // diga, y entonces busca cadenas que no existen — que es una guarda que no puede fallar. Alli
    // busco hasta su #97 una cadena del volcado de la marcha blanca que ya no estaba en el
    // artboard. Aqui se comprueba contra los EJEMPLOS del artboard, y por contenido y no por
    // igualdad: «Carreras de caballos» es parte de una celda mas larga.
    const ejemplos = ejemplosDe(NORMATIVA_V8()).map(({ texto }) => texto);
    expect(ejemplos.length, 'el artboard no trae ni un valor de ejemplo').toBeGreaterThan(100);

    const huerfanas = cadenasQueBuscaElDockerfile()
      .filter((cadena) => !ejemplos.some((texto) => texto.includes(cadena)))
      .map((cadena) => `  «${cadena}»`);
    expect(
      huerfanas,
      'El `Dockerfile` busca en lo servido cadenas que el artboard ya no trae:\n' +
        `${huerfanas.join('\n')}\n\n` +
        '  Una guarda que busca lo que no existe no puede fallar. Si la cifra salio del artboard,\n' +
        '  sale tambien del `Dockerfile`, y en el mismo PR.',
    ).toEqual([]);
  });
});
