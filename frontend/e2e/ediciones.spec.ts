import { expect, test, type Page } from '@playwright/test';

import {
  CUANTAS_EDICIONES,
  abrir,
  conLaPuertaAgotada,
  conLoDeEdiciones,
  elContenidoDelConjunto,
  erroresDeConsola,
  laConsolaQuedoLimpia,
  unaEdicion,
} from './instalacion.ts';

/**
 * **Ediciones lee del backend: la ventana, el orden y el detalle, en un navegador de verdad**
 * (#65, AC 8).
 *
 * <h2>Por que este arnes y no solo las pruebas de jsdom</h2>
 *
 * Porque lo que esta hoja afirma **pasa por la barra de direcciones**, y eso jsdom no lo tiene:
 *
 * · la pagina y el orden viven en el hash. Pulsar «Siguiente» escribe la direccion, el marco la
 *   lee, el conector vuelve a pedir y la tabla cambia de filas. **Ninguno de esos cuatro pasos
 *   falla solo**: si uno se rompe, la direccion cambia y las filas no, que es una paginacion que
 *   no pagina;
 * · recargar tiene que dejar lo mismo, que es lo unico que hace que un enlace se pueda compartir;
 * · y lo que se pide se mide **en el cable**, no en una llamada doblada: la URL del listado tiene
 *   que llevar exactamente los cuatro nombres del dialecto.
 *
 * <h2>Las respuestas son las del contrato</h2>
 *
 * Los cuerpos los compone `e2e/instalacion.ts` **campo a campo contra
 * `docs/50-api/formas-de-la-api.json`** —uno de mas o de menos pone rojo el arnes—, y el listado
 * se pagina y se ordena **de verdad** sobre un padron de {@link CUANTAS_EDICIONES} filas: con un
 * cuerpo fijo, «Siguiente» daria las mismas filas y esta prueba pasaria con la paginacion rota.
 *
 * <h2>Lo que este arnes NO mide, y de quien es</h2>
 *
 * · **La marca «rige»** del AC 2. La decide `GET /seguridad/parametros/ejercicios/{e}`, que es una
 *   lectura POR EJERCICIO, y una pagina trae tantos ejercicios como filas. Queda declarado en la
 *   definicion y en `diseno/HUECOS.md` (H19).
 * · **El filtro del buscador y del chip de estado** (H02): no filtran, y la hoja lo dice arriba.
 * · **Ir al Panel y volver** (AC 7). Lo que este arnes mide es **recargar**, que es lo que la ruta
 *   sostiene hoy; conservar la ventana al salir y volver lo tiene que dar el MARCO —`irA` escribe
 *   `#/<slug>` a secas— y es H35a. Ver el docblock de esa prueba.
 */

/** Las filas del cuerpo de la tabla de ediciones, que es la primera de la hoja. */
const FILAS = 'table >> nth=0 >> tbody tr';

/** Los mandos de pagina, y el desplegable de orden. */
const PAGINACION = '[data-slot="paginacion-de-la-tabla"]';
const INDICADOR = '[data-slot="indicador-de-pagina"]';
const SIGUIENTE = '[data-mando="siguiente"]';
const ANTERIOR = '[data-mando="anterior"]';
const ORDEN = '[data-slot="orden-de-la-tabla"]';

/** El boton con que una fila abre su detalle: por su acto, no por su rotulo, que se traduce. */
const ABRIR = '[data-accion="va:nor-ediciones"]';

/** Abre Ediciones con sus dos lecturas contestadas, y espera a que la lista este dibujada. */
async function abrirEdiciones(
  pagina: Page,
  donde = 'ediciones',
  cambios: Parameters<typeof conLoDeEdiciones>[1] = {},
): Promise<{ readonly peticiones: string[] }> {
  await conLaPuertaAgotada(pagina);
  const servido = await conLoDeEdiciones(pagina, cambios);
  await abrir(pagina, donde);
  return servido;
}

/** Las URL del listado que se pidieron, en orden. */
const delListado = (peticiones: readonly string[]) =>
  peticiones.filter((url) => url.includes('/seguridad/parametros'));

/** Y las del contenido de un conjunto. */
const delContenido = (peticiones: readonly string[]) =>
  peticiones.filter((url) => url.includes('/parametros') && url.includes('/conjuntos/'));

test('la URL del listado lleva los CUATRO nombres del dialecto, y ninguno más', async ({ page }) => {
  const errores = erroresDeConsola(page);
  const { peticiones } = await abrirEdiciones(page);
  await expect(page.locator(FILAS).first()).toBeVisible();

  const pedidas = delListado(peticiones);
  expect(pedidas, 'la hoja no pidió el listado').toHaveLength(1);
  const consulta = new URL(pedidas[0] ?? '').searchParams;

  // EXACTAMENTE los cuatro. Un `?estado=SELLADO` compuesto para el chip del filtro saldría aquí
  // nombrándolo, que es el 422 «Parámetro desconocido» que el backend daría.
  expect([...consulta.keys()].sort()).toEqual(['direccion', 'ordenarPor', 'pagina', 'tamano']);
  expect(consulta.get('ordenarPor'), 'el campo por omisión es el del controlador').toBe('ejercicio');
  expect(consulta.get('direccion')).toBe('ASCENDENTE');
  expect(consulta.get('pagina')).toBe('0');

  laConsolaQuedoLimpia(errores, 'ediciones recién abierta');
});

test('la lista es una VENTANA: dice el total publicado y no el de la página', async ({ page }) => {
  await abrirEdiciones(page);
  const filas = page.locator(FILAS);
  await expect(filas).toHaveCount(20);

  // El conteo de la barra nombra las dos cifras: las de la ventana y el total que el servidor
  // publicó. Contar las filas daría «20 de 20» sobre un padrón de 54.
  const barra = await page.locator('[data-slot="tarjeta-barra-de-tabla"]').first().innerText();
  expect(barra).toContain(String(CUANTAS_EDICIONES));
  await expect(page.locator(INDICADOR)).toContainText('1');

  // Y en la primera página, «Anterior» está impedido CON SU MOTIVO —nunca `disabled`—.
  await expect(page.locator(ANTERIOR)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator(SIGUIENTE)).not.toHaveAttribute('aria-disabled', 'true');
});

test('«Siguiente» escribe la página en la ruta, y la hoja vuelve a pedir ESA página', async ({
  page,
}) => {
  const { peticiones } = await abrirEdiciones(page);
  const primera = await page.locator(FILAS).first().innerText();

  await page.locator(SIGUIENTE).click();

  // 1) La dirección lo dice, y se puede compartir.
  await expect.poll(() => page.url()).toContain('pagina=1');
  // 2) Se volvió a pedir, con la página nueva. **Ésta es la mitad que no da error al romperse**:
  //    sin la ruta en la clave de consulta, la dirección cambia y nadie vuelve a pedir.
  await expect.poll(() => delListado(peticiones).length).toBe(2);
  expect(new URL(delListado(peticiones)[1] ?? '').searchParams.get('pagina')).toBe('1');
  // 3) Y las filas son otras.
  await expect.poll(() => page.locator(FILAS).first().innerText()).not.toBe(primera);
  await expect(page.locator(INDICADOR)).toContainText('2');
});

test('cambiar de orden vuelve a la página 1 EN UN SOLO movimiento', async ({ page }) => {
  const { peticiones } = await abrirEdiciones(page, 'ediciones?pagina=2');
  await expect(page.locator(FILAS).first()).toBeVisible();
  expect(new URL(delListado(peticiones)[0] ?? '').searchParams.get('pagina')).toBe('2');

  // El botón del sentido: cambia a descendente y, con él, vuelve a la primera página.
  await page.locator(`${ORDEN} button`).last().click();

  await expect.poll(() => delListado(peticiones).length).toBe(2);
  const segunda = new URL(delListado(peticiones)[1] ?? '').searchParams;
  expect(segunda.get('direccion')).toBe('DESCENDENTE');
  // **En un solo movimiento**: no hay ninguna petición intermedia con el orden nuevo y la página
  // vieja. Con dos `moverLaRuta` seguidos el marco pasa por esa dirección y quien escucha la ruta
  // la pide — una lectura que nadie quiso, y encima la que se dibuja un instante.
  expect(
    segunda.get('pagina'),
    'Se cambió el orden y se quedó en la página 2: la fila que se estaba mirando ya no está ahí.',
  ).toBe('0');
  await expect.poll(() => page.url()).toContain('pagina=0');
});

test('y la columna que se ordena lo ANUNCIA con `aria-sort`', async ({ page }) => {
  await abrirEdiciones(page, 'ediciones?ordenarPor=version&direccion=DESCENDENTE');
  await expect(page.locator(FILAS).first()).toBeVisible();

  // La columna es la que lleva ese `campo`, y no un índice escrito en otra lista.
  const anunciadas = page.locator('th[aria-sort]');
  await expect(anunciadas).toHaveCount(1);
  await expect(anunciadas).toHaveAttribute('aria-sort', 'descending');
  await expect(anunciadas).toContainText('version');
});

test('recargar deja la MISMA página y el mismo orden: el enlace se puede compartir', async ({
  page,
}) => {
  // AC 7, la mitad que la ruta sostiene hoy. La otra —ir al Panel y volver— es del MARCO: `irA`
  // escribe `#/<slug>` a secas y no se acuerda de la ventana de la hoja de la que se sale. Es
  // H35a de `diseno/HUECOS.md`, y queda declarado en el PR.
  const { peticiones } = await abrirEdiciones(page, 'ediciones?pagina=2&ordenarPor=version');
  const antes = await page.locator(FILAS).first().innerText();

  await page.reload();
  await expect(page.locator(FILAS).first()).toBeVisible();

  const ultima = new URL(delListado(peticiones).at(-1) ?? '').searchParams;
  expect(ultima.get('pagina')).toBe('2');
  expect(ultima.get('ordenarPor')).toBe('version');
  expect(await page.locator(FILAS).first().innerText()).toBe(antes);
});

test('elegir una fila pide `/conjuntos/{id}/parametros` y NO el snapshot', async ({ page }) => {
  const errores = erroresDeConsola(page);
  const { peticiones } = await abrirEdiciones(page);

  // La primera fila del padrón es la edición 1, que está ABIERTA: el snapshot la rechazaría con un
  // 404 «no sellado», y es justo la que la hoja tiene que poder enseñar mientras se compone.
  await page.locator(FILAS).first().locator(ABRIR).click();

  // Se espera a que salga UNA petición sobre el conjunto, y sólo entonces se mira CUÁL: así el
  // rojo nombra la URL que se pidió en vez de decir que no se pidió la que se esperaba.
  await expect.poll(() => peticiones.filter((url) => url.includes('/conjuntos/')).length).toBe(1);
  expect(
    peticiones.filter((url) => url.includes('/conjuntos/')),
    'La hoja pidió el snapshot para el detalle. El snapshot sólo sirve lo SELLADO —404 «no ' +
      'sellado» para un conjunto abierto, que es justo el que se está componiendo— y viene firmado ' +
      'y cacheado un año, que no es lo que una hoja que compone necesita.',
  ).toEqual(delContenido(peticiones));
  expect(delContenido(peticiones)[0]).toContain('/conjuntos/1/parametros');

  // El sujeto viaja en el camino, y la ventana se conserva: elegir una fila no devuelve la lista
  // a la página 0.
  await expect.poll(() => page.url()).toContain('/ediciones/1');
  expect(page.url()).toContain('pagina=0');

  laConsolaQuedoLimpia(errores, 'ediciones con una fila elegida');
});

test('el detalle se dibuja con lo que llegó, y todo número suyo está en el JSON', async ({
  page,
}) => {
  await abrirEdiciones(page, 'ediciones/2');
  const bloques = page.locator('[data-slot="tarjeta"]');
  const detalle = bloques.nth(1);
  await expect(detalle).toBeVisible();

  const texto = await detalle.innerText();
  // La cifra, con sus seis decimales y sin pasar por `Number`: `5350.000000` volvería «5350».
  expect(texto).toContain('5350.000000');
  expect(texto).toContain('2026-01-01');
  expect(texto).toContain('último día hábil de febrero');

  // **Todo número del detalle está en el JSON recibido** (AC 8). Se comparan las cadenas de
  // dígitos, que es lo que delata una cifra compuesta aquí: un total sumado, un porcentaje
  // calculado, un identificador inventado.
  const delJson = new Set(
    JSON.stringify(elContenidoDelConjunto(2)).match(/\d+/g) ?? [],
  );
  const inventados = [...new Set((texto.match(/\d+/g) ?? []))].filter((cifra) => !delJson.has(cifra));
  expect(
    inventados,
    `El detalle dibuja cifras que no vinieron en la respuesta: ${inventados.join(', ')}\n` +
      '  En la hoja que enseña los valores con los que se cobra, una cifra deducida es ' +
      'indistinguible de una real.',
  ).toEqual([]);

  // Y los nulos, con su palabra y no con un cero: la UIT no lleva clave ni fecha de fin.
  await expect(detalle.locator('[data-celda-sin-dato]').first()).toBeVisible();
  const conMotivo = await detalle.locator('[data-celda-sin-dato]').first().getAttribute('title');
  expect((conMotivo ?? '').length, 'una celda nula sin motivo').toBeGreaterThan(10);
});

test('un 403 en la lista no tumba el detalle, ni al revés (AC 4)', async ({ page }) => {
  // La lista cae con un 403 —una cuenta sin el acceso `parametros`— y el detalle contesta. Los dos
  // bloques declaran su propia lectura, así que cada uno dice lo suyo en su sitio.
  await abrirEdiciones(page, 'ediciones/2', {
    listado: { estado: 403, cuerpo: { codigo: 'SIN_PRIVILEGIO', mensaje: 'Sin privilegio' } },
  });

  const detalle = page.locator('[data-slot="tarjeta"]').nth(1);
  await expect(detalle).toContainText('5350.000000');
  // Y arriba, el fallo dicho con la escalera, en su sitio y sin tapar lo de abajo.
  await expect(page.locator('[data-estado-de-la-lectura="fallo"]').first()).toBeVisible();
});

test('y sin conjunto elegido el detalle ESPERA: no pide, y dice qué hacer', async ({ page }) => {
  const { peticiones } = await abrirEdiciones(page);
  await expect(page.locator(FILAS).first()).toBeVisible();

  // Ni una petición a `/conjuntos/…`: sin sujeto no hay nada que pedir, y pedir `undefined` sería
  // un 404 de ruta dibujado como una avería.
  expect(delContenido(peticiones)).toEqual([]);
  await expect(page.locator('[data-slot="tarjeta"]').nth(1)).toContainText('Elija una edición');
});

test('la lista VACÍA dice por qué, y no se queda muda', async ({ page }) => {
  await abrirEdiciones(page, 'ediciones', {
    listado: {
      cuerpo: {
        contenido: [],
        pagina: 0,
        tamano: 20,
        totalElementos: 0,
        totalPaginas: 0,
        hayMas: false,
      },
    },
  });

  await expect(page.locator('[data-vacio]').first()).toBeVisible();
  // Y los mandos de página no se dibujan: paginar lo que no llegó no lleva a ninguna parte.
  await expect(page.locator(PAGINACION)).toHaveCount(0);
  // El aviso de «la definición no dice por qué» es lo que NO puede salir.
  await expect(page.locator('[data-tabla-sin-motivo]')).toHaveCount(0);
});

test('y las filas del padrón que no están selladas no enseñan un cero', async ({ page }) => {
  await abrirEdiciones(page);
  // La primera edición está abierta: sus dos columnas de sello llegan nulas.
  const primera = page.locator(FILAS).first();
  await expect(primera.locator('[data-celda-sin-dato]')).toHaveCount(2);
  // Y la segunda, sellada, sí trae su fecha tal como la escribió el servidor.
  await expect(page.locator(FILAS).nth(1)).toContainText(
    String(unaEdicion(2)['fechaSellado']),
  );
});
