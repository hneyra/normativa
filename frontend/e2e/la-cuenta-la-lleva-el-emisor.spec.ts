import { expect, test, type Page } from '@playwright/test';

import { REALM_POR_OMISION, abrir, conLaPuertaAgotada } from './instalacion.ts';

/**
 * **«Mi perfil» y «Cambiar la contrasena» llevan a la consola de cuenta del emisor** (#61, AC 3).
 *
 * Es la mitad de navegador de #57, que cableo las cuatro opciones del menu de sesion a
 * `@kamayuk/sesion` (`kamayuk-lib`#42). Calcado de
 * `rentas/frontend/e2e/la-cuenta-la-lleva-el-emisor.spec.ts@ac379ac` (`rentas`#115).
 *
 * <h2>Por que esto necesita un NAVEGADOR y no basta con jsdom</h2>
 *
 * Porque lo que se mide es un **boton al pulsarlo**, y «al pulsarlo» es la mitad de la frase. Las
 * pruebas de `@kamayuk/sesion` miden que `abrirLaCuenta()` construya la URL y abra la pestana;
 * `ninguna-opcion-del-menu-se-queda-muda.test.ts` mide que la opcion tenga un `al` que llame a
 * algo. Entre las dos cosas hay un menu de Radix que se abre, un `onSelect` que se dispara y una
 * **activacion de usuario** que el navegador exige para dejar abrir una pestana — y de eso jsdom
 * no sabe nada.
 *
 * El defecto que esto cierra esta medido en `rentas`#115: antes de aquel issue, pulsar las dos
 * opciones **no abria ninguna pestana, no navegaba y no escribia nada en la consola**. El menu se
 * cerraba y ya.
 *
 * <h2>El emisor se intercepta, y lo que se mide es la IDA</h2>
 *
 * La plataforma no esta levantada —ni puede estarlo en CI—, asi que `localhost:8181` no contesta.
 * Lo que este arnes puede afirmar es **a donde va el navegador**; que un Keycloak vivo sirva esas
 * dos rutas se apoya en el codigo de `keycloak:26.0`, citado archivo y linea en
 * `kamayuk-lib/paquetes/sesion/identidad.ts`, y queda dicho que no se pidio de verdad.
 */

/**
 * Contesta por el emisor con una pagina cualquiera.
 *
 * Sin esto la pestana nueva aterriza en el error de conexion de Chromium, y `pestana.url()`
 * devuelve la URL pedida igual — pero la espera de `load` no vuelve nunca y el camino tarda su
 * tiempo de espera entero. Lo que se mide es la ida, no lo que conteste el emisor.
 */
async function conElEmisorContestado(pagina: Page): Promise<void> {
  await pagina.context().route(`${REALM_POR_OMISION}/**`, (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>consola de cuenta</title><h1>Keycloak</h1>',
    }),
  );
}

/**
 * Lo que se espera a que la pestana aparezca.
 *
 * Cinco segundos y no el tope del arnes, porque **el caso interesante es que no aparezca**: asi el
 * rojo del boton mudo llega en cinco segundos con su frase, y no en treinta como un planton.
 */
const ESPERA_DE_LA_PESTANA = 5_000;

/** Pulsa una opcion del menu de sesion y devuelve la pestana que se abrio. Si no se abre, lo dice. */
async function pulsarEnElMenu(pagina: Page, rotulo: string): Promise<Page> {
  await pagina.locator('[data-slot="abrir-la-sesion"]').click();
  const [pestana] = await Promise.all([
    pagina
      .context()
      .waitForEvent('page', { timeout: ESPERA_DE_LA_PESTANA })
      .catch(() => {
        throw new Error(
          `Pulsar «${rotulo}» no abrio ninguna pestana en ` +
            `${String(ESPERA_DE_LA_PESTANA / 1000)} s, y la pagina no se movio.\n\n` +
            '  Es el sintoma EXACTO del defecto de `rentas`#115: el menu se cierra y no pasa\n' +
            '  nada. Un boton que no dice nada al pulsarlo se lee como una pantalla rota.',
        );
      }),
    pagina.getByRole('menuitem', { name: rotulo, exact: true }).click(),
  ]);
  return pestana;
}

test.beforeEach(async ({ page }) => {
  await conLaPuertaAgotada(page);
  await conElEmisorContestado(page);
});

test('EL CENTINELA: el menu de sesion se abre y trae las cuatro opciones', async ({ page }) => {
  // Sin esto, un menu que no abriera dejaria los dos caminos de abajo fallando por el sitio
  // equivocado —o, con otra espera, pasando sin haber pulsado nada—.
  await abrir(page, 'panel');
  await page.locator('[data-slot="abrir-la-sesion"]').click();

  // Las cuatro de `src/sesion.ts`, en su orden. Los rotulos van en castellano y sin `t()`: el
  // i18n es #60, y el castellano es la clave (epica #47).
  await expect(page.getByRole('menuitem')).toHaveText([
    'Mi perfil',
    'Cambiar la contrasena',
    'Preferencias',
    'Cerrar sesión',
  ]);
});

test('«Mi perfil» abre la consola de cuenta del emisor en otra pestana', async ({ page }) => {
  await abrir(page, 'panel');

  const pestana = await pulsarEnElMenu(page, 'Mi perfil');

  // La ruta indice de la consola: ahi es donde la consola dibuja los datos personales.
  expect(pestana.url()).toBe(`${REALM_POR_OMISION}/account/`);
  // Y esta pestana NO se movio: el token vive en memoria, y perderla seria perder la sesion.
  expect(page.url()).toContain('/normativa/');
});

test('«Cambiar la contrasena» abre la pagina de credenciales, no una pantalla de Normativa', async ({
  page,
}) => {
  await abrir(page, 'panel');

  const pestana = await pulsarEnElMenu(page, 'Cambiar la contrasena');

  expect(pestana.url()).toBe(`${REALM_POR_OMISION}/account/account-security/signing-in`);
  expect(page.url()).toContain('/normativa/');
});

test('y las dos URL cuelgan del MISMO origen por el que se entra: no hay una segunda sena', async ({
  page,
}) => {
  // Es lo que hace honesto mandar ahi. Si ese origen no fuera alcanzable desde el navegador, nadie
  // habria entrado a Normativa: el formulario de identificacion se sirve del mismo sitio.
  await abrir(page, 'panel');

  const perfil = await pulsarEnElMenu(page, 'Mi perfil');
  const clave = await pulsarEnElMenu(page, 'Cambiar la contrasena');

  expect(new URL(perfil.url()).origin).toBe(new URL(REALM_POR_OMISION).origin);
  expect(new URL(clave.url()).origin).toBe(new URL(REALM_POR_OMISION).origin);
});
