import { expect, test, type Page } from '@playwright/test';

import { ARBOL } from '../src/pantallas/arbol.ts';
import { ejemplosDe } from '../verificaciones/artboard-v8.ts';
import {
  FORMAS_DE_CIFRA,
  artboardDeclarado,
  cadenasQueBuscaElDockerfile,
} from '../verificaciones/artboards.ts';
import { conLaPuertaAgotada, conLaSeguridadMedida } from './instalacion.ts';

/**
 * **Sin red y sin siembra, ninguna hoja ensena una cifra** (#64, AC 8).
 *
 * <h2>La leccion, y por que se mide en el paquete construido</h2>
 *
 * Es la de `sin-red` que `catastro`#122 recoge: cuando no hay de donde leer, una pantalla que se
 * «rellena» con algo —un ejemplo del artboard, un valor por omision, una cifra que se quedo en una
 * definicion— se lee como si fuera de verdad. En `normativa` eso es peor que en ningun otro sistema:
 * lo que ensena son los valores con los que se cobra. Las guardas de `vitest` barren el codigo
 * (`sin-cifras-inventadas`) y el `Dockerfile` barre lo servido; esto mira **lo que se VE** en el
 * bundle construido, sin red y sin la siembra de desarrollo —que no viaja, y eso lo mide
 * `la-siembra-no-viaja-al-bundle.spec.ts`—.
 *
 * <h2>Dos niveles de «sin red»</h2>
 *
 *   · **Nadie contesta**: tampoco `/seguridad`. No hay menu, asi que no hay hoja — y la espera que
 *     lo dice tampoco puede llevar una cifra.
 *   · **Contesta la seguridad y ninguna hoja**: el menu se compone con las capturas —como en el
 *     resto del arnes— y cada hoja se abre, pide sus datos, se queda sin ellos y lo dice. Es el caso
 *     que importa: la hoja ESTA, con sus bloques, y tiene que estar vacia de cifras.
 *
 * <h2>Que es una cifra aqui, y por que no «cualquier digito»</h2>
 *
 * Medido al escribir esto: sin datos, las hojas ensenan digitos legitimos —el numero de un ADR en
 * una nota, el ejercicio de trabajo en un desplegable, el tope de una pagina—. Prohibir todo digito
 * seria una guarda que da rojos sobre texto bueno. Lo que se prohibe es lo que el repositorio ya
 * declara como inconfundible, **leido de donde vive** y no copiado: `FORMAS_DE_CIFRA` (dos
 * decimales, con millares o sin ellos), los ejemplos del artboard V8 que casan con ellas, y las
 * cinco cadenas que busca el `Dockerfile`.
 */

/** Los slugs de las cuatro hojas, del arbol —que no importa `@kamayuk/*`, y el runner lo carga—. */
const SLUGS = ARBOL.flatMap((modulo) => modulo.hojas.map((hoja) => hoja.clave.replace(/^nor-/, '')));

/** Lo que el artboard trae como ejemplo y es una cifra: si se ve, se relleno con el artboard. */
const EJEMPLOS = ejemplosDe(artboardDeclarado('NormativaV8.dc.html'))
  .map((cadena) => cadena.texto)
  .filter((texto) => FORMAS_DE_CIFRA.some((forma) => forma.test(texto)));

/** Las cifras que se ven en una pagina: por forma, por ejemplo del artboard y por el `Dockerfile`. */
async function cifrasEn(pagina: Page): Promise<readonly string[]> {
  const texto = await pagina.locator('body').innerText();
  const palabras = texto
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{N}]+|[^\p{N}]+$/gu, ''))
    .filter((p) => p !== '');
  return [
    ...palabras.filter((p) => FORMAS_DE_CIFRA.some((forma) => forma.test(p))),
    ...[...EJEMPLOS, ...cadenasQueBuscaElDockerfile()].filter((cadena) => texto.includes(cadena)),
  ];
}

test('EL CENTINELA: hay cuatro hojas, y cifras con que comparar', () => {
  // Sin esto, un arbol vacio dejaria los bucles sin casos, y una lista de ejemplos vacia dejaria
  // la comparacion buscando nada.
  expect(SLUGS).toEqual(['panel', 'ediciones', 'cuadros', 'publicacion']);
  expect(EJEMPLOS.length, 'el artboard ya no trae ejemplos con forma de cifra').toBeGreaterThan(0);
  expect(cadenasQueBuscaElDockerfile().length).toBeGreaterThan(0);
  // Y la forma reconoce una cifra de verdad —la UIT de la V6—, o no reconoceria ninguna.
  expect(FORMAS_DE_CIFRA.some((forma) => forma.test('5500.00'))).toBe(true);
});

test('nadie contesta: no hay menu, no hay hoja, y lo que se lee no lleva ni una cifra', async ({
  page,
}) => {
  await conLaPuertaAgotada(page);
  // Declarada la ULTIMA, gana a las dos de `conLaPuertaAgotada`: ni la seguridad contesta.
  await page.route('**/normativa/api/v1/**', (ruta) => ruta.abort('internetdisconnected'));

  for (const slug of SLUGS) {
    await page.goto(`./#/${slug}`);
    await page.locator('[data-slot="espera-del-catalogo"][data-estado="error"]').waitFor();
    expect(await page.locator('[data-slot="barra-global"]').count(), `«${slug}» monto el armazon`).toBe(0);
    expect(await cifrasEn(page), `«${slug}» sin red ensena cifras`).toEqual([]);
  }
});

test('contesta la seguridad y ninguna hoja: las cuatro se abren, y ninguna ensena una cifra', async ({
  page,
}) => {
  await conLaPuertaAgotada(page);
  await page.route('**/normativa/api/v1/**', (ruta) => ruta.abort('internetdisconnected'));
  // Y otra vez las cinco de `/seguridad`, que asi ganan al corte de arriba.
  await conLaSeguridadMedida(page);

  for (const slug of SLUGS) {
    await page.goto(`./#/${slug}`);
    await page.locator('[data-slot="barra-global"]').first().waitFor();
    await expect(page.locator('h1').first()).toBeVisible();
    // Que las lecturas hayan terminado de fallar: con una «pidiendo», la hoja ensena barras y no
    // el estado que se viene a medir.
    await expect(page.locator('[data-estado-de-la-lectura="pidiendo"]')).toHaveCount(0);
    expect(
      await cifrasEn(page),
      `«${slug}» ensena cifras sin haberlas recibido de nadie.\n` +
        '  En el sistema que publica los valores con los que se cobra, una cifra que la pantalla se\n' +
        '  pone sola se lee como sellada. Viven en el conjunto sellado y se PIDEN (regla 5).',
    ).toEqual([]);
  }
});
