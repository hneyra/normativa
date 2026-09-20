import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  EJERCICIO_DEL_ARNES,
  FUENTE_DEL_VEHICULAR,
  FUENTE_DE_LA_DEPRECIACION,
  FUENTE_DE_LOS_UNITARIOS,
  UNITARIOS_SERVIDOS,
  abrir,
  conLaPuertaAgotada,
  conLosCuadros,
  erroresDeConsola,
  laConsolaQuedoLimpia,
} from './instalacion.ts';

/**
 * **Los tres cuadros nacionales, dibujados en un navegador de verdad** (#66, AC 8).
 *
 * <h2>Por que este arnes y no solo las pruebas de jsdom</h2>
 *
 * `verificaciones/los-cuadros-son-los-del-snapshot.test.ts` mide lo que el CONECTOR decide: que
 * celda sale de que campo, que dice cada desenlace, de donde sale el documento fuente. Lo que no
 * puede medir es **lo que llega al DOM**, y ahi estan las dos afirmaciones que cuestan caro:
 *
 * · **que la tabla grande no monte sus 54 129 filas.** La V6 hacia `filas.map` sin paginar
 *   (`c01fe9a:frontend/src/secciones/Tabla.tsx:140`) y nunca se noto, porque solo se ejercio contra
 *   un proxy de datos simulados con diez filas. Contar `<tr>` es lo unico que lo dice;
 * · **que ningun numero dibujado se lo haya inventado la pantalla.** En un sistema que publica los
 *   valores con los que se cobra, una cifra que no venga del cuerpo recibido es lo peor que puede
 *   pasar, y es silencioso.
 *
 * <h2>Y el reloj se MUEVE, que es la mitad de la guarda del ejercicio</h2>
 *
 * `conLosCuadros` fija el reloj del navegador en el 1 de enero de {@link EJERCICIO_DEL_ARNES}
 * **antes de navegar**, porque `EJERCICIO_DE_TRABAJO` se lee una sola vez al cargar el modulo. Una
 * guarda que no moviera el reloj **pasaria igual con un literal dentro** —hoy el ano es el mismo—,
 * y por eso el primer caso de abajo empieza comprobando que el ano del arnes no es el de hoy: sin
 * esa linea, este archivo entero mediria el ano en que se corre.
 *
 * <h2>Las respuestas son las del contrato</h2>
 *
 * Los cuerpos los compone `e2e/instalacion.ts` **campo a campo contra
 * `docs/50-api/formas-de-la-api.json`** —uno de mas o de menos pone rojo el arnes—, y sus cifras
 * son de juguete: ninguna sale del corpus, que es lo que `sin-cifras-inventadas` y la negativa del
 * `Dockerfile` persiguen en lo que se sirve.
 */

/** Los cuerpos de las tres tablas, en el orden en que la definicion las dibuja. */
const CUERPOS = '[data-slot="tabla-cuerpo"]';

/** Las tres cabeceras, para atar cada indice a su cuadro y no a su posicion a ciegas. */
const UN_ROTULO_DE_CADA = ['Partida', 'Uso', 'Marca'] as const;

/** Los campos de solo lectura de la hoja. */
const DATOS = '[data-slot="dato"]';

/** Abre Cuadros con sus dos lecturas contestadas y el reloj movido. */
async function abrirCuadros(
  pagina: Page,
  servido: Parameters<typeof conLosCuadros>[1] = {},
): Promise<{ readonly peticiones: string[]; readonly cuerpos: Record<string, string> }> {
  await conLaPuertaAgotada(pagina);
  const servidas = await conLosCuadros(pagina, servido);
  await abrir(pagina, 'cuadros');
  // Las tres tablas no existen mientras la lectura esta «pidiendo»: medir ahi daria verde o rojo
  // segun la maquina.
  await pagina.locator(CUERPOS).nth(2).waitFor({ timeout: 30_000 });
  return servidas;
}

/** El cuerpo de la tabla numero `i`, comprobando antes que es la que se cree. */
async function cuerpoDeLaTabla(pagina: Page, i: number): Promise<Locator> {
  const cabeceras = pagina.locator('[data-slot="tabla-cabecera"]');
  await expect(
    cabeceras.nth(i),
    `La tabla ${String(i)} dejo de ser la que esta prueba cree: se esperaba una con la columna ` +
      `«${UN_ROTULO_DE_CADA[i] ?? ''}». El orden de las tablas es el de los bloques del artboard.`,
  ).toContainText(UN_ROTULO_DE_CADA[i] ?? '');
  return pagina.locator(CUERPOS).nth(i);
}

/**
 * Un numero escrito en la pantalla, **normalizado a como viaja**: sin separador de miles y sin los
 * ceros que el formato completa.
 *
 * `2,222,333.40` en la pantalla es `2222333.4` en el cuerpo, y las dos son la misma cifra. Sin esta
 * normalizacion la comparacion de abajo saldria roja sobre un formato correcto — y una guarda que
 * da rojos sobre codigo bueno se acaba desactivando.
 */
function comoViaja(numero: string): string {
  const sinMiles = numero.replace(/,/g, '');
  return sinMiles.includes('.') ? sinMiles.replace(/0+$/, '').replace(/\.$/, '') : sinMiles;
}

/** Todos los numeros que aparecen en un texto, ya normalizados. */
function numerosDe(texto: string): readonly string[] {
  return [...texto.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((casado) => comoViaja(casado[0]));
}

test('con el reloj en 2031, la hoja pregunta por 2031 y pide los dos ámbitos', async ({ page }) => {
  // EL CENTINELA de esta guarda entera: si el año del arnés fuera el de hoy, todo lo de abajo
  // pasaría igual con un literal escrito en `src/datos/`, que es el defecto que la V6 tenía en dos
  // sitios (`c01fe9a:src/marco/BarraGlobal.tsx:67`).
  expect(
    EJERCICIO_DEL_ARNES,
    'El año del arnés es el de hoy: esta guarda no puede fallar. Muévalo.',
  ).not.toBe(new Date().getFullYear());

  const errores = erroresDeConsola(page);
  const { peticiones } = await abrirCuadros(page);

  const identidad = peticiones.filter((url) => url.includes('/conjuntos?'));
  expect(identidad, 'la hoja no preguntó qué conjunto rige').toHaveLength(1);
  expect(identidad[0]).toContain(`ejercicio=${String(EJERCICIO_DEL_ARNES)}`);

  // Y los dos ámbitos, EN MAYÚSCULAS: el backend no los lee en minúsculas
  // (`SnapshotController.java:149-151`), y aceptarlo devolvería otro cuerpo con otra huella.
  const snapshots = peticiones.filter((url) => url.includes('/snapshot?'));
  expect(snapshots).toHaveLength(2);
  expect(snapshots.some((url) => url.includes('ambito=VALUACION'))).toBe(true);
  expect(snapshots.some((url) => url.includes('ambito=OBLIGACION'))).toBe(true);
  expect(snapshots.some((url) => /ambito=(valuacion|obligacion)/.test(url))).toBe(false);

  laConsolaQuedoLimpia(errores, 'cuadros con sus dos ámbitos');
});

test('los tres cuadros se dibujan, cada uno con el documento fuente de SUS filas', async ({
  page,
}) => {
  await abrirCuadros(page);

  // Tres tablas y no dos: el vehicular vive en el otro ámbito, y aun así se dibuja.
  await expect(page.locator(CUERPOS)).toHaveCount(3);

  // El documento fuente sale de las filas, no de una constante del código: si estuviera escrito en
  // `src/`, la imagen no se construiría (`Dockerfile`, «for cadena in …»).
  const texto = await page.locator('main, body').first().innerText();
  expect(texto).toContain(FUENTE_DE_LOS_UNITARIOS);
  expect(texto).toContain(FUENTE_DE_LA_DEPRECIACION);
  expect(texto).toContain(FUENTE_DEL_VEHICULAR);

  // Y la tabla de la base y el ámbito que lleva cada cuadro, que es lo que dice que son
  // nacionales y no de esta municipalidad.
  const datos = await page.locator(DATOS).allInnerTexts();
  expect(datos.join('\n')).toContain('valor_referencial_vehiculo');
  expect(datos.join('\n')).toContain('OBLIGACION');
});

test('TODO número del DOM de una tabla está en el JSON recibido', async ({ page }) => {
  const { cuerpos } = await abrirCuadros(page);
  const recibidos = new Set([
    ...numerosDe(cuerpos['VALUACION'] ?? ''),
    ...numerosDe(cuerpos['OBLIGACION'] ?? ''),
  ]);
  expect(recibidos.size, 'los cuerpos servidos no traen ni un número').toBeGreaterThan(5);

  const inventados: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const cuerpo = await cuerpoDeLaTabla(page, i);
    for (const numero of numerosDe(await cuerpo.innerText())) {
      if (!recibidos.has(numero)) inventados.push(`  tabla ${String(i)}: «${numero}»`);
    }
  }

  expect(
    inventados,
    'Hay números dibujados en una tabla que NO vienen del cuerpo recibido:\n' +
      `${inventados.join('\n')}\n\n` +
      '  En un sistema que publica los valores con los que se cobra, una cifra que la pantalla se\n' +
      '  inventa se lee como sellada. Las cifras viven en el conjunto sellado y se PIDEN (regla 5,\n' +
      '  ADR-0007); lo que la pantalla no sepa, se dice.',
  ).toEqual([]);
});

test('el tramo abierto enseña «Más de N años», con el N de SU tabla', async ({ page }) => {
  await abrirCuadros(page);
  const depreciacion = await cuerpoDeLaTabla(page, 1);
  const texto = await depreciacion.innerText();

  // La tabla 01/Concreto/Muy Bueno cierra en 30; la 02/Ladrillo/Malo no tiene ningún tramo
  // cerrado, así que no se le inventa un tope.
  expect(texto).toContain('Más de 30 años');
  expect(texto).toContain('Sin tope');
  // Y NUNCA un cero ni una raya en esa columna: leer el nulo como cero convierte el tramo que todo
  // lo cubre en uno que no cubre nada, sin ningún error de por medio.
  const antiguedades = await depreciacion.locator('tr td:nth-child(4)').allInnerTexts();
  expect(antiguedades).toEqual(['5', '30', 'Más de 30 años', 'Sin tope']);

  // El de los valores unitarios es «Sin tope» y lleva su nota: una palabra sola no dice que el
  // nulo no sea un dato que falte.
  const unitarios = await cuerpoDeLaTabla(page, 0);
  expect(await unitarios.locator('tr td:nth-child(4)').allInnerTexts()).toEqual([
    String(UNITARIOS_SERVIDOS[0]?.['anioConstruccionHasta']),
    'Sin tope',
  ]);
  await expect(unitarios.locator('tr td:nth-child(4)').nth(1)).toHaveAttribute(
    'title',
    /anioConstruccionHasta/,
  );
});

test('la cabecera dice el campo del contrato y su dominio (H23)', async ({ page }) => {
  await abrirCuadros(page);
  const cabecera = page.locator('[data-slot="tabla-cabecera"]').first();

  await expect(cabecera.locator('[data-slot="campo-de-la-columna"]')).toHaveCount(6);
  expect(await cabecera.innerText()).toContain('anioConstruccionHasta');
  // El dominio es el CHECK de la base, escrito bajo el rótulo: `valor_unitario_edificacion_partida_check`.
  expect(await cabecera.innerText()).toContain('MUROS · TECHOS · PUERTAS');
});

test('con el anexo vehicular ENTERO, el DOM no pinta más filas que una página', async ({ page }) => {
  // 54 129 es lo que mide el anexo de 2026 (`ElEjercicio2026SeSellaTest.java:246`). Sin paginación
  // de cliente el interprete monta las 54 129 en el DOM para enseñar las primeras cien.
  test.setTimeout(180_000);
  const cuantas = 54_129;
  await abrirCuadros(page, { vehiculares: cuantas });

  const vehicular = await cuerpoDeLaTabla(page, 2);
  const pintadas = await vehicular.locator('tr').count();
  expect(
    pintadas,
    `El cuadro vehicular pintó ${String(pintadas)} filas de ${String(cuantas)}. La paginación de\n` +
      '  cliente existe para que el navegador no monte decenas de miles de nodos por enseñar cien.',
  ).toBeLessThanOrEqual(100);
  expect(pintadas, 'el cuadro vehicular no pintó ni una fila').toBe(100);

  // Y la barra cuenta TODAS las que llegaron, no las que se ven: una tabla de 54 129 filas no
  // tiene 100.
  const barra = page.locator('[data-slot="tarjeta-barra-de-tabla"]').nth(2);
  expect(await barra.innerText()).toContain('54129 filas');
  // El indicador dice de cuántas páginas, que es una cuenta y no una suposición: están todas
  // delante.
  await expect(page.locator('[data-slot="indicador-de-pagina"]').nth(2)).toContainText(
    String(Math.ceil(cuantas / 100)),
  );
});

test('pasar de página NO emite una petición: la paginación es de cliente', async ({ page }) => {
  const { peticiones } = await abrirCuadros(page, { vehiculares: 250 });
  const antes = peticiones.length;
  expect(antes, 'la hoja no pidió nada: no hay nada que comparar').toBe(3);

  const vehicular = await cuerpoDeLaTabla(page, 2);
  const primera = await vehicular.locator('tr').allInnerTexts();

  await page.locator('[data-mando="siguiente"]').nth(2).click();
  await expect(vehicular.locator('tr').first()).not.toHaveText(primera[0] ?? '');

  expect(
    peticiones.length,
    'Pasar de página emitió una petición. El snapshot llega ENTERO en una sola respuesta: la\n' +
      '  página se corta aquí, y `GET /conjuntos/{id}/snapshot` ni siquiera admite `pagina` —se lo\n' +
      '  contestaría con un 422 «Parámetro desconocido».',
  ).toBe(antes);
});

/**
 * **Cambiar el ámbito NO vuelve a pedir, y eso es un HUECO declarado y no una propiedad** (H14a).
 *
 * El AC 2 de #66 pide que cambiar de ámbito vuelva a pedir el snapshot. Hoy no puede: en la
 * gramática V8 el ámbito es un campo `s` del bloque y lo tecleado en un campo vive en el estado de
 * `<Pantalla>` — ni el conector ni la ruta lo ven. Lo debe `kamayuk-lib`#86, y hasta entonces la
 * hoja pide **los dos ámbitos** y cada cuadro se dibuja con el que lo lleva.
 *
 * Esta prueba fija la diferencia **para que caduque sola**: el día que el selector gobierne la
 * lectura, cambiarlo emitirá una petición y esto saldrá rojo diciendo que H14a llegó.
 */
test('cambiar el ámbito no emite ninguna petición: el selector no gobierna la lectura (H14a)', async ({
  page,
}) => {
  const { peticiones } = await abrirCuadros(page);
  const antes = peticiones.length;

  const selector = page.getByRole('combobox').filter({ hasText: /VALUACION|OBLIGACION/ }).first();
  await selector.click();
  await page.getByRole('option', { name: 'OBLIGACION' }).click();

  // Se espera un momento a que cualquier petición que fuera a salir salga: sin esto, «no salió
  // ninguna» sería cierto por llegar antes que ella.
  await page.waitForTimeout(500);
  expect(
    peticiones.length,
    'Cambiar el ámbito emitió una petición. Si es porque el selector YA gobierna la lectura,\n' +
      '  H14a (`kamayuk-lib`#86) llegó: quítese esta prueba y mídase lo que el AC 2 pide —que\n' +
      '  cambiar de ámbito vuelva a pedir el snapshot, y que cambiar de cuadro no—.',
  ).toBe(antes);
});
