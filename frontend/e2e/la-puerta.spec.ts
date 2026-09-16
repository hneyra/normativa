import { createHash } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { AUTORIZACION, CANJE, DESCUBRIMIENTO, REALM_POR_OMISION } from './instalacion.ts';

/**
 * **La puerta de identidad, en un navegador de verdad y SIN emisor falso** (#61, AC 3).
 *
 * <h2>De donde viene: lo que la V6 media y #50 se llevo</h2>
 *
 * `c01fe9a:frontend/src/api/identidad.test.ts` media en jsdom, sobre la puerta escrita a mano que
 * la V6 tenia (394 lineas). Esa puerta salio con ella y hoy la pone `@kamayuk/sesion` (#57), pero
 * **lo que aquellas pruebas afirmaban no se puede perder** (epica #47, «Lo que la V6 aprendio»):
 *
 *   · el cliente es `kamayuk-backoffice` y el reto es **S256** (`:75`);
 *   · el `redirect_uri` es la raiz de la APLICACION —`/normativa/`— y no la del sitio (`:103`),
 *     sacada de `BASE_URL` (`:112`; `identidad.ts:374-376`). Es la linea que costo el acceso a
 *     produccion en `rentas`#71: valia `origin + '/'`, la autenticacion funcionaba y el retorno
 *     devolvia un **404** con el `code` y el `iss` correctos;
 *   · el reto es el SHA-256 del verificador (`:119`);
 *   · tras el canje, **nada del token en `localStorage` ni en `sessionStorage`** (`:197`);
 *   · el alcance por omision es `openid profile` (`c01fe9a:frontend/src/api/configuracion.ts:69`).
 *
 * <h2>Y por que en NAVEGADOR y no otra vez en jsdom</h2>
 *
 * Porque tres de esas cinco cosas dependen de algo que jsdom no tiene:
 *
 *   · `import.meta.env.BASE_URL` en jsdom es lo que `vitest.config.ts` diga; aqui es **lo que el
 *     bundle construido lleva dentro**, que es el unico valor que llega a una municipalidad;
 *   · `crypto.subtle.digest` es el del navegador, no un relleno;
 *   · `location.assign` en jsdom es un espia, asi que «se fue a la puerta» y «se quedo» son la
 *     misma cosa. Aqui la navegacion ocurre y la URL se puede leer.
 *
 * <h2>Sin emisor falso</h2>
 *
 * No se levanta ningun Keycloak de mentira: se **intercepta** lo que la puerta pide. Es lo mismo
 * que hacia `catastro`#121 al heredar de `identidad.mjs`, y lo que hace que estas cinco
 * afirmaciones no dependan de que la plataforma este levantada. Entrar por el formulario de
 * Keycloak de verdad es #69.
 */

/** Las claves del rebote, con el prefijo de ESTE sistema (`src/sesion.ts`). */
const VERIFICADOR = 'kamayuk.normativa.pkce.verificador';
const ESTADO = 'kamayuk.normativa.pkce.estado';

/** El token que el emisor interceptado devuelve. No es un secreto: es el hilo que se busca luego. */
const TOKEN_DEVUELTO = 'el-token-que-no-puede-quedar-guardado-en-ninguna-parte';

/** El reto que S256 exige: base64url del SHA-256 del verificador, sin relleno. */
function retoDe(verificador: string): string {
  return createHash('sha256').update(verificador).digest('base64url');
}

/**
 * Manda a la puerta y devuelve la URL de autorizacion a la que el navegador fue.
 *
 * La autorizacion se contesta con **204** y no con una pagina: asi el navegador HACE la
 * navegacion —que es lo que se quiere medir— y se queda donde estaba, con el documento vivo y su
 * `sessionStorage` a mano.
 */
async function laUrlDeAutorizacion(pagina: Page): Promise<URL> {
  await pagina.route(DESCUBRIMIENTO, (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  let ida: string | null = null;
  await pagina.route(AUTORIZACION, (ruta) => {
    ida = ruta.request().url();
    return ruta.fulfill({ status: 204 });
  });

  await pagina.goto('./');
  await expect
    .poll(() => ida, {
      timeout: 15_000,
      message: 'la aplicacion no mando a nadie a la puerta: no hubo peticion de autorizacion',
    })
    .not.toBeNull();
  return new URL(ida ?? '');
}

test('la URL de autorizacion lleva las cuatro cosas que la V6 media', async ({ page }) => {
  const url = await laUrlDeAutorizacion(page);
  const parametros = url.searchParams;

  // **El retorno es la raiz de la APLICACION.** Es `rentas`#71 escrito como prueba: con
  // `origin + '/'` esto diria `http://localhost:<puerto>/` y el emisor devolveria a un 404.
  const origen = new URL(page.url()).origin;
  expect(
    parametros.get('redirect_uri'),
    'el retorno no es la raiz de la aplicacion: con la del sitio, quien se autentica vuelve a un 404',
  ).toBe(`${origen}/normativa/`);

  expect(parametros.get('client_id')).toBe('kamayuk-backoffice');
  expect(parametros.get('scope')).toBe('openid profile');
  expect(parametros.get('response_type')).toBe('code');
  expect(parametros.get('code_challenge_method'), 'el reto dejo de ser S256').toBe('S256');

  // Y el emisor es el que `src/configuracion.ts` trae por omision, sin `ConfigMap` montado.
  expect(url.href.startsWith(`${REALM_POR_OMISION}/protocol/openid-connect/auth`)).toBe(true);
});

test('y el reto es el SHA-256 del verificador, calculado por el navegador', async ({ page }) => {
  const url = await laUrlDeAutorizacion(page);

  const verificador = await page.evaluate(
    (clave) => window.sessionStorage.getItem(clave),
    VERIFICADOR,
  );
  expect(verificador, 'no se guardo ningun verificador: no hubo PKCE').not.toBeNull();
  expect(
    url.searchParams.get('code_challenge'),
    'el reto no es el SHA-256 del verificador: S256 esta anunciado y no cumplido',
  ).toBe(retoDe(verificador ?? ''));

  // Y el verificador es largo de verdad: con uno corto, S256 no protege de nada.
  expect((verificador ?? '').length).toBeGreaterThanOrEqual(43);
});

test('tras el canje el token NO aparece en localStorage ni en sessionStorage', async ({ page }) => {
  await laUrlDeAutorizacion(page);

  // El estado se lee ANTES de volver: `canjearSiVuelve()` lo borra al usarlo.
  const estado = await page.evaluate((clave) => window.sessionStorage.getItem(clave), ESTADO);
  expect(estado, 'no se guardo ningun estado: la vuelta no se podria comprobar').not.toBeNull();

  await page.route(CANJE, (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: TOKEN_DEVUELTO,
        id_token: 'el-id-token',
        token_type: 'Bearer',
      }),
    }),
  );

  await page.goto(`./?code=un-codigo-cualquiera&state=${encodeURIComponent(estado ?? '')}`);
  await page.locator('[data-slot="barra-global"]').first().waitFor({ timeout: 15_000 });

  // La barra de direcciones quedo limpia: un codigo ya usado no vale dos veces, y dejarlo hace
  // que recargar de un error que no tiene nada que ver con lo que paso.
  expect(page.url(), 'el codigo se quedo en la barra de direcciones').not.toContain('code=');

  // Y AHORA lo que la V6 media: los dos almacenamientos, enteros.
  const guardado = await page.evaluate(() => {
    const volcar = (almacen: Storage) =>
      Object.keys(almacen).map((clave) => ({ clave, valor: almacen.getItem(clave) ?? '' }));
    return { local: volcar(window.localStorage), sesion: volcar(window.sessionStorage) };
  });

  const conElToken = [...guardado.local, ...guardado.sesion].filter(
    (entrada) =>
      entrada.valor.includes(TOKEN_DEVUELTO) ||
      entrada.valor.includes('el-id-token') ||
      /token|jwt|bearer/i.test(entrada.clave),
  );
  expect(
    conElToken.map((e) => `  ${e.clave} = ${e.valor.slice(0, 60)}`),
    'El token quedo guardado en el navegador. En una PC de ventanilla compartida entre turnos,\n' +
      'un token persistido sobrevive al cierre del navegador (ADR-0030 §3). Vive en memoria y\n' +
      'muere con la pestana: eso es lo que esta prueba defiende.',
  ).toEqual([]);
});

test('un `/normativa/configuracion.js` servido distinto cambia el emisor SIN reconstruir', async ({
  page,
}) => {
  // Es la razon de ser de `src/configuracion.ts`: la URL del emisor no es la misma en el puesto de
  // quien desarrolla, en la marcha blanca y en la municipalidad, y una URL horneada convierte la
  // imagen en la imagen **de un ambiente**. En el cluster lo entrega el `ConfigMap` que declara
  // `infrastructure/src/descriptor.ts`, montado ENCIMA del que la imagen trae. Aqui se monta lo
  // mismo interceptando el archivo — **sobre el mismo bundle**, sin volver a construir.
  const otroRealm = 'http://emisor-de-otra-municipalidad.prueba/realms/otro';
  await page.route('**/normativa/configuracion.js', (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.__KAMAYUK_NORMATIVA__ = ${JSON.stringify({
        oidcRealm: otroRealm,
        oidcCliente: 'otro-cliente',
        oidcAlcance: 'openid profile email',
      })};`,
    }),
  );

  const url = await laUrlDeAutorizacion(page);

  expect(
    url.href.startsWith(`${otroRealm}/protocol/openid-connect/auth`),
    `se fue a «${url.origin}${url.pathname}» y no al emisor servido: la sena quedo horneada en el paquete`,
  ).toBe(true);
  expect(url.searchParams.get('client_id')).toBe('otro-cliente');
  expect(url.searchParams.get('scope')).toBe('openid profile email');
});
