import { expect, test } from '@playwright/test';

import { PUERTO } from '../puerto-del-arnes.mjs';
import { AUTORIZACION, DESCUBRIMIENTO } from './instalacion.ts';

/**
 * **Sin origen seguro no hay puerta, y hay que DECIRLO** (#61, AC 3).
 *
 * <h2>Lo medido, en Chromium 151 y sobre este mismo bundle</h2>
 *
 * La misma pagina, servida en `[::1]` y alcanzada por tres nombres:
 *
 *     http://localhost          isSecureContext: true    crypto.subtle: objeto
 *     http://127.0.0.1          isSecureContext: true    crypto.subtle: objeto
 *     http://normativa.prueba   isSecureContext: false   crypto.subtle: undefined
 *       (MAP a [::1])                                    crypto.randomUUID: undefined
 *
 * O sea: **basta con servir esta interfaz por `http://` con un nombre de maquina** —lo mas normal
 * del mundo en una marcha blanca antes de que haya certificado— para que no haya `crypto.subtle`.
 * Y sin `crypto.subtle` no hay S256, que es lo unico que la puerta de este producto sabe hacer.
 *
 * <h2>Las dos formas de fallar que esto cierra, y son distintas</h2>
 *
 *   1. **Reventar.** Sin la comprobacion `hayPuerta()` del arranque, `entrar()` llega hasta
 *      `reto(verificador)` y sale
 *      `TypeError: Cannot read properties of undefined (reading 'digest')` — un rojo que no nombra
 *      ni el origen ni el certificado que falta, en una pagina que ademas se queda en blanco.
 *   2. **Quedarse muda.** Con la comprobacion pero sin anotar el porque —que es como estaba hasta
 *      este issue—, la aplicacion monta, no va a ninguna parte y **no dice nada**: lo unico
 *      visible es que las pantallas no traen datos, que se parece a un backend caido.
 *
 * Asi que se miden las dos: que no se vaya a ningun sitio, y que lo diga.
 *
 * <h2>Como se sirve por un nombre que no es `localhost`</h2>
 *
 * Con `--host-resolver-rules`, que es cosa del navegador y no de la red: no hace falta tocar
 * `/etc/hosts` ni levantar un DNS. El `[::1]` esta medido —`vite preview` escucha ahi y no en
 * `127.0.0.1`— y el nombre esta declarado en `preview.allowedHosts` de `vite.config.ts`, con su
 * motivo dentro.
 */

/** El nombre que Chromium resuelve a mano, y el que `vite.config.ts` deja pasar. */
const NOMBRE = 'normativa.prueba';

/** La misma aplicacion, por un origen que el navegador NO considera seguro. */
const POR_UN_NOMBRE = `http://${NOMBRE}:${String(PUERTO)}/normativa/`;

// `launchOptions` es opcion del *worker*: va a nivel de archivo y no dentro de un `describe`.
test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${NOMBRE} [::1]`] } });

test('EL CENTINELA: por ese nombre el navegador NO da un origen seguro', async ({ page }) => {
  // Sin esto, un Chromium que algun dia considerara seguro a `normativa.prueba` —o un `MAP` que
  // dejara de aplicarse— haria pasar la prueba de abajo por el motivo equivocado: la puerta
  // funcionaria, no habria aviso que buscar, y el rojo no llegaria nunca.
  await page.goto(POR_UN_NOMBRE);

  const medido = await page.evaluate(() => ({
    seguro: window.isSecureContext,
    subtle: typeof crypto === 'undefined' ? 'no hay crypto' : String(crypto.subtle),
  }));
  expect(medido.seguro, `«${NOMBRE}» resulto ser un origen seguro: no hay nada que medir`).toBe(
    false,
  );
  expect(medido.subtle, 'el navegador si expone `crypto.subtle` en este origen').toBe('undefined');
});

test('no se va a ninguna parte, y la pagina DICE por que', async ({ page }) => {
  // Si alguien fuera a la puerta, se veria aqui. Las dos rutas se dejan contestadas para que el
  // camino malo sea «se fue» y no «se fue y ademas no contestaron».
  let ido = false;
  await page.route(DESCUBRIMIENTO, (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route(AUTORIZACION, (ruta) => {
    ido = true;
    return ruta.fulfill({ status: 204 });
  });

  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));

  await page.goto(POR_UN_NOMBRE);

  const aviso = page.locator('[data-slot="puerta-caida"]');

  // Se espera a que pase **cualquiera de las dos cosas** y solo entonces se juzga cual, y el orden
  // importa: con la comprobacion del arranque fuera, lo que ocurre es el `TypeError` de mas abajo
  // y la pagina se queda en blanco. Un rojo que dijera «no encontre el aviso» mandaria a buscar un
  // componente cuando lo que falta es una linea del arranque; este dice el `TypeError`.
  await expect
    .poll(async () => errores.length > 0 || (await aviso.count()) > 0, {
      timeout: 15_000,
      message: 'la pagina ni dijo nada ni reviento: se quedo con la aplicacion muda',
    })
    .toBe(true);

  expect(
    errores,
    'La pagina lanzo un error en vez de explicarse. Es lo que pasa sin la comprobacion\n' +
      '`hayPuerta()` del arranque: se pide el reto S256 a una criptografia que este origen no\n' +
      'ofrece, y lo que queda es una pagina en blanco con un `TypeError` en la consola.',
  ).toEqual([]);

  await expect(aviso, 'la pagina no dijo nada: se quedo con la aplicacion muda').toBeVisible();
  await expect(aviso).toHaveAttribute('data-porque', 'sin-origen-seguro');

  const texto = await aviso.innerText();
  // Las tres cosas que hacen falta para arreglarlo: que falta, desde donde se sirvio y que hacer.
  //
  // **El texto NO nombra `crypto.subtle`, y eso esta decidido**: esa cadena esta prohibida en
  // `src/` por `verificaciones/la-puerta-y-el-cliente-son-de-la-libreria.test.ts` —que vigila que
  // nadie escriba PKCE a mano— y ponerla en el aviso la puso roja de verdad al escribir este
  // issue. El nombre de la API vive donde esa guarda no barre: el docblock de `puerta/falla.ts` y
  // el `data-porque` de arriba, que es lo que esta prueba clava. Para quien mira la pantalla, el
  // dato accionable no es el nombre de una funcion: es que falta «https».
  expect(texto).toContain('no es un origen seguro');
  expect(texto).toContain(`http://${NOMBRE}:${String(PUERTO)}`);
  expect(texto).toContain('https://');

  // Y no se fue a ninguna parte.
  expect(ido, 'se mando el navegador a la puerta sin poder calcular el reto S256').toBe(false);
  expect(page.url()).toContain(`${NOMBRE}:${String(PUERTO)}`);
});

test('y por `localhost` la puerta SI esta: el aviso no sale siempre', async ({ page }) => {
  // La otra direccion, y hace falta. Un aviso que saliera en todas partes cerraria este issue y
  // dejaria la interfaz sin puerta en el puesto de quien desarrolla, en verde.
  await page.route(DESCUBRIMIENTO, (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  let ido = false;
  await page.route(AUTORIZACION, (ruta) => {
    ido = true;
    return ruta.fulfill({ status: 204 });
  });

  await page.goto('./');

  await expect
    .poll(() => ido, { timeout: 15_000, message: 'por `localhost` tampoco se fue a la puerta' })
    .toBe(true);
});
