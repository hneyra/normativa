import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { MUNICIPALIDAD_MEDIDA, SESION_MEDIDA } from '../desarrollo/sesionMedida.ts';
import { ACCESOS_MEDIDOS } from '../src/datos/seguridadMedida.ts';

/**
 * **La siembra de desarrollo NO viaja al paquete que se publica** (#64, AC 7).
 *
 * Calcado de `rentas/frontend/e2e/la-siembra-no-viaja-al-bundle.spec.ts@ac379ac` (`rentas`#114).
 *
 * <h2>Por que este camino vive aqui y no en `vitest`</h2>
 *
 * Porque lo que hay que medir es **el `dist/`**, y el `dist/` hay que construirlo: `yarn verificar`
 * no construye nada. Este arnes YA construye el bundle antes de levantar nada —`playwright.config.ts`,
 * `webServer: yarn build && yarn preview`—, asi que aqui la medicion sale gratis y encima es sobre
 * **el artefacto de verdad**. No abre navegador.
 *
 * <h2>Que se busca, y por que ESTAS cadenas</h2>
 *
 * Cadenas que **solo pueden venir de las capturas**, derivadas de ellas y no escritas aqui:
 *
 *   · los rotulos de los ACCESOS —«Conjuntos de parametros», «Parametros del sistema»—, que ninguna
 *     hoja dibuja: el carril dice el nombre del MODULO, no el de sus opciones;
 *   · el nombre de la persona y el de la municipalidad de la captura de la sesion. El de la
 *     municipalidad es ademas lo que G2 prohibe ver compilado: si viajara, la imagen de las veinte
 *     instalaciones diria el de una;
 *   · y la frase con que la siembra avisa por la consola, que prueba que no viajo ni el modulo que
 *     siembra, ademas de lo sembrado.
 *
 * <h2>Y se mira el `.map` tambien, a proposito</h2>
 *
 * `vite.config.ts` declara `build.sourcemap: true`, y un `.map` lleva dentro el **codigo fuente
 * entero** de cada modulo que entro en el paquete. Mirar solo el `.js` diria que el modulo no viajo
 * cuando si viajo — la imagen borra los mapas al final (`Dockerfile`), pero eso es la imagen, y esto
 * mide `yarn build`.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, '../dist');

/** Lo que solo puede salir de las capturas o de la siembra. Ver el javadoc. */
const DE_LA_CAPTURA: readonly string[] = [
  ...ACCESOS_MEDIDOS.contenido.map((acceso) => acceso.nombre),
  SESION_MEDIDA.nombre,
  MUNICIPALIDAD_MEDIDA.nombre,
  'EL CATALOGO ESTA SEMBRADO',
];

/** Todo lo que `vite build` dejo en `dist/`, con su ruta absoluta. */
function loConstruido(desde = DIST): readonly string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    return statSync(ruta).isDirectory() ? loConstruido(ruta) : [ruta];
  });
}

test('EL CENTINELA: hay un `dist/` que mirar y cadenas que buscar', () => {
  // Sin esto, un `dist/` vacio —o unas capturas vacias— dejarian la comprobacion de abajo buscando
  // nada en ninguna parte, y saldria verde sin haber medido.
  const construido = loConstruido();
  expect(construido.filter((r) => r.endsWith('.js')).length).toBeGreaterThan(0);
  expect(construido.filter((r) => r.endsWith('.js.map')).length).toBeGreaterThan(0);
  expect(ACCESOS_MEDIDOS.contenido.length).toBeGreaterThan(0);
  for (const cadena of DE_LA_CAPTURA) expect(cadena.length).toBeGreaterThan(5);
});

test('ni una cadena de la captura de `/seguridad`, ni la siembra, estan en el bundle construido', () => {
  const culpables: string[] = [];

  for (const archivo of loConstruido()) {
    const contenido = readFileSync(archivo, 'utf8');
    for (const cadena of DE_LA_CAPTURA) {
      if (contenido.includes(cadena)) culpables.push(`${relative(DIST, archivo)} — «${cadena}»`);
    }
  }

  expect(
    culpables,
    'La siembra de desarrollo VIAJO al paquete:\n' +
      `  ${culpables.join('\n  ')}\n\n` +
      '  Solo puede entrar por el `import()` dinamico de `src/arranque.ts`, y solo si las dos\n' +
      '  condiciones que lo guardan se leen AL CONSTRUIR. Leidas en tiempo de ejecucion, Rollup no\n' +
      '  puede plegarlas y el modulo se queda dentro — con el nombre de una municipalidad, que G2\n' +
      '  no deja compilar, y `yarn dev` igual de verde.',
  ).toEqual([]);
});
