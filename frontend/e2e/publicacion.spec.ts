import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { PUERTO } from '../puerto-del-arnes.mjs';
import {
  CACHE_DEL_CONTRATO,
  CONJUNTO_SERVIDO,
  abrir,
  conLaPuertaAgotada,
  conLoDePublicacion,
  cuerpoDelSnapshot,
  erroresDeConsola,
  laConsolaQuedoLimpia,
  sha256,
} from './instalacion.ts';

/**
 * **La huella del snapshot, comprobada en un navegador de verdad** (#67, AC 10).
 *
 * <h2>Por que este arnes y no solo las pruebas de jsdom</h2>
 *
 * Porque lo que esta hoja afirma **depende del navegador**, y jsdom no es uno:
 *
 * · el `sha256` lo calcula la criptografia del navegador, y el navegador **solo la ofrece en un
 *   origen seguro**. Ese caso —servir la interfaz por `http://` con un nombre de maquina— no se
 *   puede montar en jsdom, y es exactamente el que hace que la hoja no pueda afirmar nada;
 * · la descarga la hace el navegador: un `Blob`, un `<a download>` y un archivo en el disco. Lo que
 *   hay que medir es **el archivo**, no la llamada.
 *
 * <h2>Las respuestas son las del contrato, y con tildes</h2>
 *
 * Los cuerpos los compone `e2e/instalacion.ts` **campo a campo contra
 * `docs/50-api/formas-de-la-api.json`** —uno de mas o de menos pone rojo el arnes— y llevan
 * «Resolución Ministerial» dentro, que es donde la huella de los bytes y la de las unidades de
 * codigo de JavaScript divergen. Su `ETag` es el `sha256` de verdad de lo que se sirve, calculado
 * aqui con `node:crypto`: es la misma cuenta que hace el backend
 * (`sha.digest(cuerpo.getBytes(UTF_8))`), hecha en el otro lado del cable.
 */

/**
 * El nombre por el que se alcanza esta misma pagina **sin origen seguro**, y su regla.
 *
 * `launchOptions` es opcion del *worker*: va a nivel de archivo y no dentro de un `describe`, que
 * es lo que Playwright dice con «Cannot use({ launchOptions }) in a describe group, because it
 * forces a new worker». Que este puesta para todo el archivo no estorba a las demas pruebas: un
 * `MAP` solo reescribe ESE nombre, y las demas van por `localhost`.
 */
const NOMBRE = 'normativa.prueba';
const POR_UN_NOMBRE = `http://${NOMBRE}:${String(PUERTO)}/normativa/`;

test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${NOMBRE} [::1]`] } });

/** El boton que guarda, por su acto y no por su rotulo: el rotulo se traduce. */
const GUARDAR = '[data-accion="hace:guardar-el-snapshot"]';

/** La barra de la tabla «Que viene y que no», que es donde va el veredicto de la comprobacion. */
const LA_BARRA = '[data-slot="tarjeta-barra-de-tabla"]';

/** Los campos de solo lectura de la hoja, en el orden en que la definicion los escribe. */
const DATOS = '[data-slot="dato"]';

/** Abre Publicacion con sus dos lecturas contestadas. */
async function abrirPublicacion(
  pagina: Page,
  cambios: Parameters<typeof conLoDePublicacion>[1] = {},
): Promise<{ readonly peticiones: string[] }> {
  await conLaPuertaAgotada(pagina);
  const servido = await conLoDePublicacion(pagina, cambios);
  await abrir(pagina, 'publicacion');
  // El veredicto no se puede leer antes de que la lectura conteste: la barra de esa tabla no existe
  // mientras el bloque esta «pidiendo», y medir ahi daria verde o rojo segun la maquina.
  await pagina.locator(LA_BARRA).first().waitFor({ timeout: 15_000 });
  return servido;
}

/** Todo el texto de la hoja, para buscar una huella dentro sin atarse a un nodo. */
const textoDeLaHoja = (pagina: Page) => pagina.locator('main, body').first().innerText();

test('servida con su ETag real, la hoja dice que el sha256 CUADRA', async ({ page }) => {
  const errores = erroresDeConsola(page);
  await abrirPublicacion(page);

  const cuerpo = cuerpoDelSnapshot('VALUACION');
  const huella = sha256(cuerpo);

  // El ETag que llego, tal cual. Se busca por SU VALOR y no por su sitio en la rejilla: el orden
  // de los campos es cosa del artboard, y atarse a un indice convertiria un cambio de diseño en un
  // rojo que habla de otra cosa.
  // **Con sus comillas**: es lo que distingue el campo `ETag` —que ensena la CABECERA tal cual—
  // del campo «ETag en VALUACION» del bloque de abajo, que ensena la huella comparada.
  const etag = page.locator(DATOS).filter({ hasText: `"${huella}"` });
  await expect(etag, 'la hoja no ensena el ETag que llego').toHaveCount(1);
  await expect(page.locator(DATOS).filter({ hasText: huella })).toHaveCount(2);
  // Y con el tono de que la comprobacion salio bien, que es un DATO y no una deduccion del texto
  // (la leccion H18): un sha256 no dice de que color va.
  await expect(etag.locator('.bg-ok-fondo')).toHaveCount(1);

  const barra = await page.locator(LA_BARRA).first().innerText();
  expect(barra).toContain('sha256');
  // Y el boton de guardar NO esta impedido: con la huella comprobada, hay algo que guardar.
  await expect(page.locator(GUARDAR)).toBeEnabled();

  laConsolaQuedoLimpia(errores, 'publicacion con su ETag real');
});

test('con UN BYTE del cuerpo cambiado, dice que NO cuadra y enseña las DOS huellas', async ({
  page,
}) => {
  const bueno = cuerpoDelSnapshot('VALUACION');
  const anunciada = sha256(bueno);
  // El servidor sigue anunciando la huella del cuerpo bueno; lo que viaja es el cuerpo tocado. Es
  // lo que hace un intermediario que recomprime, y es el caso que un `immutable` de un año vuelve
  // irreparable si nadie lo mira.
  const tocado = bueno.replace('Resolución', 'Resolucion');
  expect(tocado, 'el cuerpo no cambio: no hay nada que medir').not.toBe(bueno);
  const calculada = createHash('sha256').update(tocado, 'utf8').digest('hex');

  await abrirPublicacion(page, { VALUACION: { cuerpo: tocado, etag: `"${anunciada}"` } });

  const texto = await textoDeLaHoja(page);
  expect(texto, 'la pantalla no dice la huella que el servidor anuncio').toContain(anunciada);
  expect(texto, 'la pantalla no dice la huella que calculo').toContain(calculada);

  // **Y no se ofrece «Reintentar»**: no es una averia de red, y pulsar otra vez lo trae igual.
  await expect(page.getByRole('button', { name: /reintent/i })).toHaveCount(0);
  // Guardar sale impedido, con el motivo a la vista.
  await expect(page.locator(GUARDAR)).toBeDisabled();
  await expect(page.locator('[data-slot="motivo"]').first()).toBeVisible();
});

test('sin ETag no se acepta, y se dice', async ({ page }) => {
  await abrirPublicacion(page, { VALUACION: { etag: null } });

  expect(await page.locator(LA_BARRA).first().innerText()).toContain('ETag');
  await expect(page.locator(GUARDAR)).toBeDisabled();
});

test('y con un ETag debil `W/` tampoco, aunque la huella de dentro sea la correcta', async ({
  page,
}) => {
  const cuerpo = cuerpoDelSnapshot('VALUACION');
  await abrirPublicacion(page, { VALUACION: { etag: `W/"${sha256(cuerpo)}"` } });

  const barra = await page.locator(LA_BARRA).first().innerText();
  expect(barra).toContain('W/');
  await expect(page.locator(GUARDAR)).toBeDisabled();
});

test('con el Cache-Control reescrito, los bytes valen y la CACHE no: atencion', async ({ page }) => {
  await abrirPublicacion(page, { VALUACION: { cacheControl: 'no-store' } });

  const barra = await page.locator(LA_BARRA).first().innerText();
  // Las dos mitades: el sha256 cuadra, y la promesa de un año no es la del contrato.
  expect(barra).toContain('sha256');
  expect(barra).toContain('no-store');
  expect(barra).toContain(CACHE_DEL_CONTRATO);
  // Y aun asi se puede guardar: los bytes son los que el ETag anuncia.
  await expect(page.locator(GUARDAR)).toBeEnabled();
});

test('«Guardar el snapshot» baja un archivo cuyo sha256 ES el ETag, y no vuelve a pedir la ruta', async ({
  page,
}) => {
  const { peticiones } = await abrirPublicacion(page);
  const cuantasAntes = peticiones.filter((url) => url.includes('/snapshot')).length;
  expect(cuantasAntes, 'la hoja no pidio los dos ambitos').toBe(2);

  const descarga = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator(GUARDAR).click(),
  ]).then(([evento]) => evento);

  const ruta = await descarga.path();
  const bajado = readFileSync(ruta, 'utf8');

  // **El sha256 de lo bajado ES el ETag.** El criterio entero en una linea.
  const cuerpo = cuerpoDelSnapshot('VALUACION');
  expect(createHash('sha256').update(bajado, 'utf8').digest('hex')).toBe(sha256(cuerpo));
  expect(bajado).toBe(cuerpo);

  expect(descarga.suggestedFilename()).toBe(
    `normativa-conjunto-${String(CONJUNTO_SERVIDO.conjuntoId)}-${String(
      CONJUNTO_SERVIDO.ejercicio,
    )}-v${String(CONJUNTO_SERVIDO.version)}-VALUACION.json`,
  );

  // Y no salio una segunda peticion: lo que se guarda es lo que ya se verifico, no lo que el
  // servidor —o la cache del navegador, bajo `immutable`— volviera a dar.
  expect(
    peticiones.filter((url) => url.includes('/snapshot')).length,
    'guardar volvio a pedir el snapshot',
  ).toBe(cuantasAntes);
});

test('los dos ambitos: misma identidad y huellas distintas, y las dos se ven', async ({ page }) => {
  await abrirPublicacion(page);

  const texto = await textoDeLaHoja(page);
  expect(texto).toContain(sha256(cuerpoDelSnapshot('VALUACION')));
  expect(texto).toContain(sha256(cuerpoDelSnapshot('OBLIGACION')));
  expect(texto).toContain(`conjunto ${String(CONJUNTO_SERVIDO.conjuntoId)}`);
});

/* ── Sin origen seguro ─────────────────────────────────────────────────────────────────────── */

/**
 * **Por un nombre que no es `localhost`, la hoja NO puede comprobar — y lo dice** (AC 3).
 *
 * Medido en Chromium 151 sobre este mismo bundle y escrito en `e2e/sin-origen-seguro.spec.ts`: por
 * `http://normativa.prueba` el navegador da `isSecureContext: false` y no expone la criptografia,
 * mientras que por `localhost` y `127.0.0.1` si. Sin la comprobacion de `src/datos/huella.ts`, lo
 * que sale es `TypeError: Cannot read properties of undefined (reading 'digest')` y la hoja se
 * queda a medias sin decir por que.
 *
 * El nombre se resuelve con `--host-resolver-rules` —declarado arriba del todo, que es donde
 * Playwright admite `launchOptions`—, y esta en `preview.allowedHosts` de `vite.config.ts`.
 */
test.describe('servida por un nombre que no es `localhost`', () => {
  test('la hoja no revienta, no afirma nada sobre la huella y dice que hace falta https', async ({
    page,
  }) => {
    const reventones: string[] = [];
    page.on('pageerror', (error) => reventones.push(error.message));

    await conLaPuertaAgotada(page);
    await conLoDePublicacion(page);
    await page.goto(`${POR_UN_NOMBRE}#/publicacion`);
    await page.locator('[data-slot="barra-global"]').first().waitFor({ timeout: 15_000 });

    // EL CENTINELA: que por ese nombre el navegador de verdad no ofrezca la criptografia. Sin esto,
    // un Chromium que algun dia considerara seguro a `normativa.prueba` haria pasar lo de abajo por
    // el motivo equivocado.
    expect(
      await page.evaluate(() => ({
        seguro: window.isSecureContext,
        hay: typeof crypto === 'undefined' ? 'no hay crypto' : String(crypto.subtle),
      })),
    ).toEqual({ seguro: false, hay: 'undefined' });

    await page.locator(LA_BARRA).first().waitFor({ timeout: 15_000 });
    const barra = await page.locator(LA_BARRA).first().innerText();

    // Ni «cuadra» ni «no cuadra»: que no se puede comprobar.
    expect(barra).toContain('origen seguro');
    expect(barra, 'la hoja afirma que la huella cuadra en un origen donde no la pudo calcular').not.toContain(
      'es el que el ETag anunció',
    );

    // Y el remedio, con las tres cosas que hacen falta para arreglarlo: que falta, desde donde se
    // sirvio y que hacer. Va en el motivo del boton impedido, que es donde el desenlace malo se
    // explica largo.
    const motivo = await page.locator('[data-slot="motivo"]').first().innerText();
    expect(motivo).toContain('https://');
    expect(motivo).toContain('localhost');

    // El ETag que el servidor anuncio SI se ensena: llego.
    expect(await textoDeLaHoja(page)).toContain(sha256(cuerpoDelSnapshot('VALUACION')));

    // Y guardar no entrega nada: solo se guarda lo verificado.
    await expect(page.locator(GUARDAR)).toBeDisabled();

    expect(
      reventones,
      'La hoja lanzo un error en vez de explicarse. Es lo que pasa sin la comprobacion de\n' +
        '`sePuedeCalcularLaHuella()`: se le pide un resumen a una criptografia que este origen no\n' +
        'ofrece, y lo que queda es un `TypeError` que no nombra ni el origen ni el certificado.',
    ).toEqual([]);
  });
});
