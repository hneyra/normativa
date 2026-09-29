import { expect, test } from '@playwright/test';

import {
  abrir,
  conElEstadoDelEjercicio,
  conLaPuertaAgotada,
  conLosCuadros,
  conLoDeEdiciones,
  erroresDeConsola,
  laConsolaQuedoLimpia,
} from './instalacion.ts';

/**
 * **Que la interfaz se VE** (#61, AC 3).
 *
 * Todo lo de aqui es lo que las 391 pruebas de `vitest` **no pueden** decir, porque comparan
 * `className` como texto: que Tailwind emita el CSS, que el navegador lo aplique, que la rejilla
 * se reacomode y que un `overflow` no corte una tabla.
 *
 * Y lo mide sobre valores **computados en el DOM**, no leidos del CSS (AC 3). Entre una clase
 * escrita y un pixel pintado hay cuatro cosas que pueden fallar solas —que la hoja viaje, que el
 * selector case, que la cascada lo alcance y que no lo tape un `@layer`—, y ninguna de las cuatro
 * la ve una comparacion de cadenas.
 */

/**
 * **Este archivo mide la paleta CLARA de `institucional`, y lo dice** (`kamayuk-lib`#23, #56).
 *
 * El CSS servido trae **ocho** combinaciones —cuatro identidades por dos modos—, asi que
 * `--color-fondo` no tiene un valor: tiene ocho, y cual sale depende de dos atributos del `<html>`
 * y —cuando el segundo falta— de `prefers-color-scheme`. Lo de aqui se compara contra
 * `diseno/normativa-tokens.css`, que es la combinacion `institucional/claro` y ninguna otra.
 *
 * <h2>Por que se declara, si Playwright ya va en claro</h2>
 *
 * Porque «ya va en claro» es un valor por omision de otra herramienta, medido en `rentas`#111 y no
 * supuesto: `contextOptions.colorScheme ?? "light"` en `playwright-core`, o sea que emula claro
 * **aunque el equipo este en oscuro**, y solo `colorScheme: null` hereda el del sistema. O sea: el
 * rojo que este archivo daria si el eje se moviera **no hablaria del eje**, hablaria de un color.
 * El otro eje —que la pagina cambie de color de verdad al elegir otra— se mide entero en
 * `los-temas-llegan-al-navegador.spec.ts`.
 */
test.use({ colorScheme: 'light' });

test.beforeEach(async ({ page }) => {
  await conLaPuertaAgotada(page);
});

test('la paleta del artboard LLEGA al navegador, no solo al CSS', async ({ page }) => {
  await abrir(page, 'panel');

  // El lienzo. `--fondo` de `diseno/normativa-tokens.css` es #f2f6f9.
  const lienzo = await page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue('--color-fondo').trim(),
  );
  expect(lienzo, 'el token del lienzo no llego al documento').toBe('#f2f6f9');

  // Y la cabecera de tarjeta es AZUL de verdad, no una clase escrita.
  const cabecera = page.locator('[data-slot="tarjeta-cabecera"]').first();
  await expect(cabecera).toBeVisible();
  const fondo = await cabecera.evaluate((e) => getComputedStyle(e).backgroundColor);
  // `--azul: #005284`
  expect(fondo, 'la cabecera de la tarjeta no esta pintada de azul').toBe('rgb(0, 82, 132)');
});

test('el radio es el del artboard —3 px— y NO el 0.625rem de shadcn', async ({ page }) => {
  await abrir(page, 'panel');
  const tarjeta = page.locator('[data-slot="tarjeta"]').first();
  const radio = await tarjeta.evaluate((e) => getComputedStyle(e).borderRadius);
  // `kamayuk-lib`#8 midio que con el token mal nombrado shadcn cae en 10px. Esto lo ve de verdad.
  expect(radio, 'la tarjeta cayo en el radio por omision de shadcn').toBe('3px');
});

test('la tipografia no carga NINGUNA webfont: es la pila del sistema', async ({ page }) => {
  await abrir(page, 'panel');

  // **Lo medido, y por que no se clava «Arial»**: `institucional` no declara `--font-sans`; la
  // unica identidad que lo trae es `clasico` (`kamayuk-lib`#56, `estilos/clasico.css:114`). Lo que
  // el navegador computa aqui es la pila por omision de Tailwind —`-apple-system,
  // BlinkMacSystemFont, "Segoe UI", Roboto, …, Arial, sans-serif, …`—, que lleva `Arial` dentro.
  // Clavar «arial» pasaria por ese accidente y no diria nada: lo que importa es que **no hay
  // webfont**, ni declarada ni cargada.
  const familia = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(familia, 'la pagina no computa ninguna familia').not.toBe('');
  expect(
    familia.toLowerCase(),
    'la tipografia no es la pila del sistema: alguien declaro una familia propia',
  ).toContain('sans-serif');

  // Ninguna hoja externa: el artboard no carga ninguna, y cargarla seria una ida a la red por cada
  // pantalla de una ventanilla que a veces no tiene salida.
  const externas = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((l) => l.getAttribute('href') ?? '')
      .filter((h) => h.startsWith('http')),
  );
  expect(externas, 'la pagina carga una hoja de estilos externa').toEqual([]);

  // Y ninguna cara de fuente cargada por el documento: un `@font-face` en la hoja servida no
  // aparece como `link` y haria pasar la comprobacion de arriba.
  const caras = await page.evaluate(() => document.fonts.size);
  expect(caras, 'el documento declara una cara de fuente propia').toBe(0);
});

test('la rejilla SE REACOMODA: varias columnas anchas, una sola estrecha', async ({ page }) => {
  // **Desde #63 hay que contestar a la lectura del estado del ejercicio.** El primer bloque del
  // Panel declara `lectura`, asi que sin respuesta su cuerpo —los CINCO campos que esta prueba
  // cuenta— lo sustituye el aviso del fallo, y quedan solo los cuatro del segundo bloque. Medido:
  // «a 400 px los campos no bajaron a una columna — Expected: >= 8, Received: 4».
  await conElEstadoDelEjercicio(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await abrir(page, 'panel');
  const campos = page.locator('[data-slot="tarjeta-campos"] > [data-slot="etiqueta"]');
  await expect(campos.first()).toBeVisible();

  /** Cuantas filas distintas ocupan los campos, por su posicion vertical. */
  const filasDe = async () =>
    page.evaluate(() => {
      const nodos = [
        ...document.querySelectorAll('[data-slot="tarjeta-campos"] > [data-slot="etiqueta"]'),
      ];
      return new Set(nodos.map((n) => Math.round(n.getBoundingClientRect().top))).size;
    });

  const anchas = await filasDe();
  await page.setViewportSize({ width: 400, height: 900 });
  const estrechas = await filasDe();

  // `auto-fit` con minimo de 216 px promete esto y nadie lo habia visto cumplirse. Medido en el
  // Panel, que tiene nueve campos entre sus dos primeros bloques: a 1400 px caben en **3** filas;
  // a 400 px van uno debajo de otro, o sea **9**.
  expect(anchas, 'a 1400 px los campos no se reparten en columnas').toBeLessThan(estrechas);
  expect(estrechas, 'a 400 px los campos no bajaron a una columna').toBeGreaterThanOrEqual(8);
});

test('ninguna tabla desplaza la PAGINA de lado', async ({ page }) => {
  // **Desde #66 hay que contestar tambien a la lectura de Cuadros**, por lo mismo que desde #63
  // hay que contestar a la del estado del ejercicio en la prueba de la rejilla: sus tres bloques
  // declaran `lectura`, asi que sin respuesta el cuerpo de cada uno —y con el su TABLA— lo
  // sustituye el aviso del fallo. Medido: «expect(locator).toBeVisible() failed — element(s) not
  // found» sobre `[data-slot="tabla"]` al llegar a «cuadros».
  await conLosCuadros(page);
  await page.setViewportSize({ width: 900, height: 900 });
  // **Las lecturas de Ediciones hay que contestarlas desde #65**, y no es un apano: sus dos
  // bloques declaran su `lectura`, asi que con la peticion caida el interprete dibuja el fallo EN
  // EL SITIO DEL CUERPO y esa hoja se queda sin ninguna tabla que medir. Lo que este caso mide es
  // una tabla ancha dentro de una pagina estrecha, y para eso tiene que haber filas. Las otras
  // tres hojas siguen igual: sus tablas se dibujan con su ausencia debajo.
  await conLoDeEdiciones(page);
  // Las cuatro hojas llevan tabla: Panel y Cuadros tres, Ediciones y Publicacion dos.
  for (const slug of ['panel', 'ediciones', 'cuadros', 'publicacion']) {
    await abrir(page, slug);
    await expect(page.locator('[data-slot="tabla"]').first()).toBeVisible();
    const seSale = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    // El desplazamiento se acota a la tabla, que es lo unico que lo necesita. Si la pagina entera
    // se desplaza, el resto de la pantalla se va de lado con ella.
    expect(seSale, `«${slug}» hace que la pagina se desplace de lado`).toBe(false);
  }
});

test('y la consola queda limpia', async ({ page }) => {
  const errores = erroresDeConsola(page);

  await abrir(page, 'panel');
  await page.locator('[data-slot="tarjeta"]').first().waitFor();

  laConsolaQuedoLimpia(errores, 'panel');
});
