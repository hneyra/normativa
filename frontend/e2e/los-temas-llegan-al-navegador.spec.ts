import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { hermanaDe, hojaDeUi } from '../verificaciones/especificadores.ts';
import { abrir, conLaPuertaAgotada } from './instalacion.ts';

/**
 * **Los temas llegan al NAVEGADOR, y no solo al archivo** (#61, AC 3).
 *
 * **Calcado de `rentas/frontend/e2e/los-temas-llegan-al-navegador.spec.ts@ac379ac`**
 * (`rentas`#111, #134, #138), con dos diferencias medidas y dichas:
 *
 *   · **son OCHO paletas y no seis**: `kamayuk-lib`#56 anadio la identidad `clasico`, y
 *     `estilos/temas.css` de la libreria rotula hoy trece bloques —cuatro identidades por claro y
 *     los dos escritos del oscuro—. Aqui no se escribe ni el numero ni los nombres: se leen del
 *     archivo generado, asi que una quinta identidad entra sola;
 *   · **no entra la mitad del contraste** (`rentas`#140): `verificaciones/contraste.ts` no existe
 *     en este arbol y traerlo seria copiar una pieza de otro repositorio en un issue que no es el
 *     suyo. Queda dicho, y con ello lo que aqui NO se afirma: que las dos frases del cajon cumplan
 *     WCAG 1.4.3 en las ocho combinaciones. Lo miden hoy las pruebas de `@kamayuk/ui`, que es
 *     donde vive el generador de las paletas.
 *
 * <h2>Por que esta guarda existe, dicho sin rodeos</h2>
 *
 * `@kamayuk/ui` tenia `estilos/temas.css` con sus paletas, su generador, su prueba de regeneracion
 * y su contraste medido. Todo verde. Y **no lo importaba nadie**: el `package.json` no lo
 * exportaba y ninguna hoja lo arrastraba. Medido en `rentas` sobre `dist/assets/*.css`:
 * `data-tema` 0, `data-modo` 0, `prefers-color-scheme` 0. `ProveedorDeTema` estampaba dos
 * atributos sobre un documento sin una sola regla que los leyera.
 *
 * Todas las pruebas que existian median **el archivo**. Un archivo perfectamente escrito y
 * perfectamente inalcanzable las pasa todas. Asi que esta mide el otro extremo del camino: lo que
 * el servidor entrega y lo que el navegador computa.
 *
 * <h2>Y aqui hay ademas algo propio: el `prefijoDeClaves`</h2>
 *
 * `src/aplicacion.tsx` declara `prefijoDeClaves: 'kamayuk.normativa'`, y no es decoracion: las
 * cuatro interfaces del producto se sirven **del mismo origen** —`/rentas/`, `/caja/`,
 * `/catastro/`, `/normativa/`— y comparten el almacenamiento del navegador. Sin prefijo propio,
 * cambiar el tema aqui se lo cambia a las otras tres. El ultimo camino de este archivo lo mide
 * donde se puede medir: en el almacenamiento del navegador que sirve este bundle.
 *
 * <h2>Los valores esperados salen de la libreria, no de una tabla de aqui</h2>
 *
 * Las paletas son **generadas** —el oscuro se deriva en OKLCH— y copiarlas aqui seria una segunda
 * fuente que se queda vieja sola. Se leen del `temas.css` de la libreria, alcanzado **por el
 * especificador de la hoja que lo arrastra** y no por una ruta al clon hermano (`rentas`#138).
 *
 * Y para que la comparacion no sea circular —el archivo contra si mismo— hay un ancla: la paleta
 * clara de `institucional` tiene que ser la del artboard, `#f2f6f9`, que es la que
 * `se-ve.spec.ts` clava por su cuenta. Si la libreria regenerara otra cosa, esto sale rojo.
 */

/**
 * **`temas.css`, alcanzado COMO LO ALCANZA EL NAVEGADOR** (`rentas`#138).
 *
 * No tiene entrada propia en el `exports` de `@kamayuk/ui`, y es deliberado (`kamayuk-lib`#23): se
 * ARRASTRA desde la hoja publicada, porque con una entrada propia el consumidor tendria que
 * escribir dos `import` y quien se olvidara del segundo se quedaria sin paletas y sin que nada se
 * lo dijera.
 *
 * Asi que el camino aqui es el mismo que el del navegador: resolver `@kamayuk/ui/estilos.css` por
 * su especificador —que SI pasa por el `exports`— y de ahi seguir el `@import` relativo que esa
 * hoja escribe.
 */
const HOJA_DE_LOS_TEMAS = hermanaDe(hojaDeUi(), './temas.css');

/** El fondo que el artboard V8 dibuja. El ancla contra la que se mide la libreria. */
const FONDO_DEL_ARTBOARD = '#f2f6f9';

type Modo = 'claro' | 'oscuro';

interface Paleta {
  readonly identidad: string;
  readonly modo: Modo;
  readonly fondo: string;
  readonly tinta: string;
  readonly azul: string;
  readonly superficie: string;
}

/**
 * Las paletas, leidas del archivo generado de la libreria.
 *
 * Cada bloque viene rotulado con un comentario `identidad/modo`, y el oscuro esta escrito dos
 * veces —bajo `prefers-color-scheme` y bajo `[data-modo='oscuro']`— con los mismos valores. El
 * mapa los une: son ocho combinaciones y no doce.
 *
 * **La identidad no se enumera**: el patron acepta cualquier nombre en minusculas con guiones, asi
 * que una quinta entra sola. En `rentas` estaban las tres escritas en el patron, y por eso
 * `clasico` no habria movido nada alli.
 */
function lasDeLaLibreria(): readonly Paleta[] {
  const css = readFileSync(HOJA_DE_LOS_TEMAS, 'utf8');
  const paletas = new Map<string, Paleta>();
  const bloques = css.matchAll(/\/\*\s*([a-z-]+)\/(claro|oscuro)[^*]*\*\/([\s\S]*?)(?=\/\*|$)/g);
  for (const [, identidad, modo, cuerpo] of bloques) {
    const token = (nombre: string) =>
      new RegExp(`--color-${nombre}:\\s*(#[0-9a-f]{6})`, 'i').exec(cuerpo ?? '')?.[1] ?? '';
    paletas.set(`${identidad ?? ''}/${modo ?? ''}`, {
      identidad: identidad ?? '',
      modo: modo as Modo,
      fondo: token('fondo'),
      tinta: token('tinta'),
      azul: token('azul'),
      superficie: token('superficie'),
    });
  }
  return [...paletas.values()];
}

const PALETAS = lasDeLaLibreria();

/**
 * **El mismo color, se escriba como se escriba** (medido al correr esto por primera vez).
 *
 * El archivo de la libreria escribe `#333333` y lo que llega al navegador es `#333`: Vite minimiza
 * el CSS al construir y acorta los hexadecimales que puede. Los dos rojos que dio antes de esto
 * decian «Expected: "#333333" / Received: "#333"» y «clasico/claro: falta --color-tinta:
 * #333333» — o sea, un rojo sobre la ORTOGRAFIA de un color y no sobre el color.
 *
 * Y es exactamente la clase de cosa que hay que normalizar y no clavar: comparar la forma larga
 * ataria esta guarda al minimizador, y el dia que cambie de opinion sobre `#ffffff` saldria roja
 * sin que nadie hubiera tocado una paleta.
 */
function expandido(hex: string): string {
  if (!/^#[0-9a-f]{3}$/i.test(hex)) return hex.toLowerCase();
  const [, r = '', v = '', a = ''] = /^#(.)(.)(.)$/.exec(hex) ?? [];
  return `#${r}${r}${v}${v}${a}${a}`.toLowerCase();
}

/** La otra ortografia: `#333333` -> `#333`, que es la que el bundle lleva. */
function acortado(hex: string): string {
  const [, r1 = '', r2 = '', v1 = '', v2 = '', a1 = '', a2 = ''] =
    /^#(.)(.)(.)(.)(.)(.)$/.exec(hex) ?? [];
  return r1 === r2 && v1 === v2 && a1 === a2 ? `#${r1}${v1}${a1}`.toLowerCase() : hex.toLowerCase();
}

/** `#005284` -> `rgb(0, 82, 132)`, que es como el navegador devuelve un color pintado. */
function comoLoDevuelveElNavegador(hex: string): string {
  const n = Number.parseInt(expandido(hex).slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** El valor computado de un token en el documento. Es lo que la cascada resolvio, no lo escrito. */
async function tokenComputado(pagina: Page, nombre: string): Promise<string> {
  return pagina.evaluate(
    (t) => getComputedStyle(document.body).getPropertyValue(t).trim(),
    `--color-${nombre}`,
  );
}

/** La senal que el `<html>` le da al navegador: `light` o `dark`. */
async function elEsquemaDelDocumento(pagina: Page): Promise<string> {
  return pagina.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
}

async function abrirElMando(pagina: Page): Promise<void> {
  await pagina.locator('[data-slot="abrir-la-sesion"]').click();
  await pagina.getByRole('menuitem', { name: 'Preferencias' }).click();
  await expect(pagina.locator('[data-slot="mando-de-tema"]')).toBeVisible();
}

/**
 * Elige una combinacion POR EL MANDO, que es como la elige una persona.
 *
 * Se apunta a `data-opcion` y no al rotulo: es la clave estable y **sin tildes** que
 * `src/preferencias/MandoDeTema.tsx` pone ahi justo para esto. Con el rotulo, la identidad
 * `clasico` habria que escribirla «Clásico», y una prueba atada a una tilde se rompe al traducir
 * (#60).
 */
async function elegir(pagina: Page, identidad: string, modo: Modo | 'sistema'): Promise<void> {
  await abrirElMando(pagina);
  await pagina.locator(`[data-slot="opcion-del-tema"][data-opcion="${identidad}"] input`).check();
  await pagina.locator(`[data-slot="opcion-del-tema"][data-opcion="${modo}"] input`).check();
  await pagina.keyboard.press('Escape');
  await expect(pagina.locator('[data-slot="mando-de-tema"]')).toBeHidden();
  // Y el velo del cajon, DESAPARECIDO. No es celo: mientras siga montado intercepta el puntero, y
  // la segunda llamada seguida a `elegir()` se queda esperando al boton de la sesion hasta agotar
  // el tiempo. Medido en este arbol al sondear la paleta de mando: «<div
  // data-slot="velo-del-cajon"> intercepts pointer events», 30 s.
  await expect(pagina.locator('[data-slot="velo-del-cajon"]')).toHaveCount(0);
}

/** Todo el CSS que la pagina carga, pedido POR SU URL al servidor que sirve el `dist`. */
async function elCssQueSeSirve(pagina: Page): Promise<string> {
  const hojas = await pagina.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => (l as HTMLLinkElement).href),
  );
  const enLinea = await pagina.evaluate(() =>
    [...document.querySelectorAll('style')].map((s) => s.textContent ?? ''),
  );
  const pedidas = await Promise.all(hojas.map(async (url) => (await pagina.request.get(url)).text()));
  return [...pedidas, ...enLinea].join('\n');
}

test.beforeEach(async ({ page }) => {
  await conLaPuertaAgotada(page);
});

test('EL CENTINELA: la libreria publica ocho paletas distintas, y la clara es la del artboard', () => {
  // Sin esto, un cambio de forma en `temas.css` dejaria `PALETAS` vacio y TODO lo de abajo pasaria
  // en verde sin haber comparado nada. Es como `rentas` se quedo sin guarda dos veces.
  expect(PALETAS.length, 'no se leyeron las paletas de `@kamayuk/ui`').toBe(8);
  expect(PALETAS.every((p) => /^#[0-9a-f]{6}$/i.test(p.fondo))).toBe(true);
  expect(new Set(PALETAS.map((p) => p.fondo)).size, 'hay dos paletas con el mismo fondo').toBe(8);

  // El ancla: sin el, todo lo demas seria el archivo comparado consigo mismo.
  const institucionalClaro = PALETAS.find(
    (p) => p.identidad === 'institucional' && p.modo === 'claro',
  );
  expect(institucionalClaro?.fondo).toBe(FONDO_DEL_ARTBOARD);
});

test('el CSS QUE SE SIRVE trae las ocho combinaciones, y los dos ejes', async ({ page }) => {
  await abrir(page, 'panel');
  const css = await elCssQueSeSirve(page);

  // Sin esto, una hoja vacia —un `link` que devuelve 404 con codigo 200, por ejemplo— dejaria
  // pasar todas las comprobaciones de abajo.
  expect(css.length, 'no se sirvio ni un byte de CSS').toBeGreaterThan(10_000);

  // Los dos ejes y el tercero que no es un atributo: lo que el equipo tenga puesto.
  //
  // Se compara una lista y NO con `toContain`, a proposito: el CSS servido son decenas de kB en
  // una sola linea, y `toContain` los vuelca enteros en el rojo.
  const sinSenal = ['data-tema', 'data-modo', 'prefers-color-scheme'].filter(
    (s) => !css.includes(s),
  );
  expect(
    sinSenal,
    `El CSS servido no menciona ${sinSenal.join(', ')}: los temas no salieron del paquete.`,
  ).toEqual([]);

  // Y las ocho paletas, cada una por dos de sus valores.
  const plano = css.replace(/\s+/g, '').toLowerCase();
  const ausentes = PALETAS.flatMap((p) =>
    [
      { que: 'fondo', valor: p.fondo },
      { que: 'tinta', valor: p.tinta },
    ]
      // Las dos ortografias: el archivo escribe `#333333` y el bundle minimizado lleva `#333`.
      .filter(
        ({ que, valor }) =>
          !plano.includes(`--color-${que}:${expandido(valor)}`) &&
          !plano.includes(`--color-${que}:${acortado(valor)}`),
      )
      .map(({ que, valor }) => `  ${p.identidad}/${p.modo}: falta --color-${que}: ${valor}`),
  );
  expect(
    ausentes,
    'El CSS que se sirve no trae las ocho paletas:\n' +
      `${ausentes.join('\n')}\n\n` +
      '  El proveedor estamparia los atributos sobre un documento sin reglas que los lean, que es\n' +
      '  el defecto del que viene esta guarda: archivo perfecto, camino roto, todo en verde.',
  ).toEqual([]);
});

test('el `<html>` lleva los dos atributos, y «el del sistema» QUITA el segundo', async ({
  page,
}) => {
  await abrir(page, 'panel');

  // De fabrica: la identidad del servicio puesta, y el modo SIN poner —que no es lo mismo que
  // puesto en claro: ausente significa «lo que diga el equipo».
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'institucional');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-modo'))).toBe(false);

  await elegir(page, 'sepia', 'oscuro');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'sepia');
  await expect(page.locator('html')).toHaveAttribute('data-modo', 'oscuro');

  await elegir(page, 'sepia', 'sistema');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'sepia');
  expect(
    await page.evaluate(() => document.documentElement.hasAttribute('data-modo')),
    'devolver el mando al equipo dejo el atributo puesto: quien lo hace se queda clavado en el modo que tuviera',
  ).toBe(false);
});

/**
 * **Las ocho, una por una, sobre el color COMPUTADO** (AC 3).
 *
 * No se mira el atributo: se mira lo que el navegador resolvio. Con el atributo basta que React
 * haga su trabajo; con el color tienen que ser ciertas ademas otras cuatro cosas —que la hoja
 * viaje, que el selector case, que la cascada lo alcance y que no lo tape un `@layer`—, y son
 * exactamente las cuatro que fallaron en `rentas`#111.
 */
for (const paleta of PALETAS) {
  test(`la pagina CAMBIA DE COLOR: ${paleta.identidad}/${paleta.modo}`, async ({ page }) => {
    await abrir(page, 'panel');
    await elegir(page, paleta.identidad, paleta.modo);

    expect(expandido(await tokenComputado(page, 'fondo')), 'el lienzo').toBe(
      expandido(paleta.fondo),
    );
    expect(expandido(await tokenComputado(page, 'tinta')), 'la tinta').toBe(
      expandido(paleta.tinta),
    );

    // Y LA SENAL AL NAVEGADOR (`rentas`#134). No es un token mas: los `--color-*` pintan lo que
    // pinta la hoja, y `color-scheme` pinta lo que dibuja el navegador por su cuenta —controles
    // nativos, barra de desplazamiento, lienzo—. Sin ella la pantalla se oscurece entera menos
    // eso, que es exactamente el defecto de `kamayuk-lib`#33: entro, vivio y se arreglo sin mover
    // un rojo alli.
    expect(
      await elEsquemaDelDocumento(page),
      'el `<html>` no le dice al navegador en que modo dibujar LO SUYO',
    ).toBe(paleta.modo === 'oscuro' ? 'dark' : 'light');

    // Y en pixeles de verdad, no en tokens: la cabecera azul de la tarjeta y su papel. Es lo que
    // `se-ve.spec.ts` mide para la paleta clara; aqui para las ocho.
    const cabecera = page.locator('[data-slot="tarjeta-cabecera"]').first();
    await expect(cabecera).toBeVisible();
    expect(
      await cabecera.evaluate((e) => getComputedStyle(e).backgroundColor),
      'la cabecera de la tarjeta no se pinto con el azul de esta paleta',
    ).toBe(comoLoDevuelveElNavegador(paleta.azul));

    const tarjeta = page.locator('[data-slot="tarjeta"]').first();
    expect(
      await tarjeta.evaluate((e) => getComputedStyle(e).backgroundColor),
      'el papel de la tarjeta no se pinto con la superficie de esta paleta',
    ).toBe(comoLoDevuelveElNavegador(paleta.superficie));
  });
}

test('la eleccion SOBREVIVE a recargar', async ({ page }) => {
  await abrir(page, 'panel');
  await elegir(page, 'alto-contraste', 'oscuro');

  await page.reload();
  await page.locator('[data-slot="barra-global"]').first().waitFor({ timeout: 15_000 });

  const esperada = PALETAS.find((p) => p.identidad === 'alto-contraste' && p.modo === 'oscuro');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'alto-contraste');
  await expect(page.locator('html')).toHaveAttribute('data-modo', 'oscuro');
  expect(expandido(await tokenComputado(page, 'fondo'))).toBe(expandido(esperada?.fondo ?? ''));
});

/**
 * **Y lo que se guarda lleva el nombre de ESTE sistema** (AC 3).
 *
 * Es la mitad que ninguna prueba de jsdom puede afirmar de verdad: las cuatro interfaces del
 * producto se sirven del mismo origen, asi que comparten `localStorage`. Con el prefijo por
 * omision de la libreria, elegir sepia aqui se lo pone tambien a `rentas`, a `catastro` y a
 * `caja` — y nadie lo veria hasta abrir otra.
 *
 * Se leen TODAS las claves y no una concreta: escribir aqui la clave exacta seria copiar el
 * formato que compone `@kamayuk/ui`, y el dia que lo cambie esto seguiria en verde midiendo una
 * clave que ya no existe.
 */
test('lo que se guarda lleva el prefijo de `normativa` y de nadie mas', async ({ page }) => {
  await abrir(page, 'panel');
  await elegir(page, 'sepia', 'oscuro');

  const claves = await page.evaluate(() => Object.keys(window.localStorage));
  expect(claves.length, 'elegir un tema no guardo nada: no sobrevivira a recargar').toBeGreaterThan(
    0,
  );
  const ajenas = claves.filter((clave) => !clave.startsWith('kamayuk.normativa'));
  expect(
    ajenas,
    'Hay claves sin el prefijo de este sistema:\n' +
      `${ajenas.join('\n')}\n\n` +
      '  Las cuatro interfaces se sirven del MISMO origen y comparten el almacenamiento: una\n' +
      '  clave sin prefijo le cambia el tema a las otras tres, en silencio.',
  ).toEqual([]);
});

/**
 * **Con el equipo en oscuro y sin elegir modo, manda el equipo — y se puede salir de ahi.**
 *
 * Son las dos mitades de `modo = null`. La primera es lo que la libreria sirve sin mando ninguno:
 * el `@media` basta. La segunda es la que el mando aporta, y la que el `:not([data-modo='claro'])`
 * del archivo generado sostiene — sin ese `:not`, pedir claro en una maquina puesta en oscuro no
 * serviria de nada.
 */
test.describe('con el equipo puesto en oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('sin elegir modo manda el equipo, y elegir «Claro» saca de ahi', async ({ page }) => {
    await abrir(page, 'panel');

    const oscuro = PALETAS.find((p) => p.identidad === 'institucional' && p.modo === 'oscuro');
    expect(
      expandido(await tokenComputado(page, 'fondo')),
      'con el equipo en oscuro y sin modo elegido, la interfaz no se puso oscura',
    ).toBe(expandido(oscuro?.fondo ?? ''));
    // La senal al navegador va por el OTRO bloque de la hoja —el del `@media`—, que es una regla
    // distinta de la del atributo y puede quedarse sin ella por su cuenta (`rentas`#134).
    expect(
      await elEsquemaDelDocumento(page),
      'con el equipo en oscuro, el `<html>` no le dijo al navegador que dibujara en oscuro',
    ).toBe('dark');

    await elegir(page, 'institucional', 'claro');
    expect(
      expandido(await tokenComputado(page, 'fondo')),
      'pedir claro en un equipo puesto en oscuro no saco de oscuro',
    ).toBe(FONDO_DEL_ARTBOARD);
    expect(
      await elEsquemaDelDocumento(page),
      'pedir claro dejo al navegador dibujando lo suyo en oscuro',
    ).toBe('light');
  });
});
