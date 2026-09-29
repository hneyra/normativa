import { expect, test, type Page } from '@playwright/test';

import { LECTURA_DEL_CONJUNTO, abrir, conLaPuertaAgotada } from './instalacion.ts';

/**
 * **«Ese ejercicio no esta publicado» se ve como respuesta, y un 404 de ruta como fallo** (#97; AC 6
 * de #66 y AC 8 de #67), en Chromium y sobre el bundle construido.
 *
 * <h2>Los DOS 404, con el MISMO mensaje, en las DOS hojas</h2>
 *
 * `GET /conjuntos?ejercicio=` contesta 404 `NO_ENCONTRADO` en los dos casos, y lo unico que los
 * separa es el miembro `parametroQueFalta` —lo pone `FaltaPublicar.noEncontrado`; una ruta que no
 * existe no lo lleva—. Asi que aqui se sirven **con el mismo `codigo`, el mismo `title` y el mismo
 * `mensaje`**, el que el backend escribe para el primero: si la pantalla decidiera por el texto en
 * castellano —lo que el catalogo de errores prohibe—, los dos casos se verian igual y este arnes lo
 * diria. Y en las dos hojas que preguntan que conjunto rige, porque la decision es UNA
 * (`src/datos/sinPublicar.ts`) y una segunda traduccion en una sola hoja se veria aqui.
 *
 * <h2>Que es «verse como respuesta»</h2>
 *
 * Que **ningun bloque dibuje un fallo** —ni rojo ni en `atencion`—, que no se ofrezca «Reintentar»,
 * que la frase de arriba diga que no esta publicado y que la hoja nombre el ejercicio. Y que no
 * salga **ni una peticion de snapshot**: sin conjunto no hay `conjuntoId` que llevar, y pedirlo
 * seria un 404 de ruta fabricado por la propia pantalla.
 *
 * Los textos se escriben aqui y no se importan de `src/`: el arnes mide el paquete construido, y
 * compararlo con la constante del fuente seria comparar un archivo consigo mismo (`instalacion.ts`).
 */

/** Lo que el backend escribe en `mensaje` para el primero. Va en LOS DOS, a proposito. */
const mensajeDe = (ejercicio: string): string =>
  `El ejercicio ${ejercicio} no tiene un conjunto de parametros sellado. Calcular con uno abierto ` +
  'produciria una cifra que manana puede ser otra, y el contribuyente ya tendria el recibo (ADR-0007)';

/** Lo distintivo de la frase de arriba cuando la hoja contesta «sin publicar». */
const ES_UNA_RESPUESTA = 'es una respuesta y no una avería';

/** Y lo que la hoja escribe con el ejercicio que dijo el miembro. */
const conElEjercicio = (ejercicio: string): string =>
  `El ejercicio ${ejercicio} no tiene un conjunto de parámetros sellado.`;

/** Las dos hojas que preguntan que conjunto rige. */
const HOJAS = ['cuadros', 'publicacion'] as const;

/** Lo que se leyo en la hoja, y lo que salio de ella. */
interface LoVisto {
  readonly ejercicio: string;
  readonly fallos: number;
  readonly reintentar: number;
  readonly texto: string;
  readonly snapshots: readonly string[];
}

/**
 * Abre la hoja con `GET /conjuntos` contestando un 404 —con el miembro o sin el— y espera a que la
 * lectura deje de estar «pidiendo».
 *
 * Se espera a la RESPUESTA y despues a que no quede ninguna barra de «pidiendo»: esperar a un texto
 * concreto convertiria el rojo en un `TimeoutError` que no dice que se dibujo en su lugar.
 */
async function abrirConElCuatrocientosCuatro(
  pagina: Page,
  hoja: (typeof HOJAS)[number],
  conElMiembro: boolean,
): Promise<LoVisto> {
  await conLaPuertaAgotada(pagina);
  const salidas: string[] = [];
  pagina.on('request', (peticion) => {
    if (peticion.url().includes('/normativa/api/v1/')) salidas.push(peticion.url());
  });
  let ejercicio = '';
  await pagina.route(LECTURA_DEL_CONJUNTO, (ruta) => {
    // El que se pregunto, como hace el backend: el miembro devuelve el ejercicio de la consulta.
    ejercicio = new URL(ruta.request().url()).searchParams.get('ejercicio') ?? '';
    const mensaje = mensajeDe(ejercicio);
    return ruta.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'https://kamayuk.gob.pe/errores/no_encontrado',
        title: 'No se encontro lo solicitado',
        status: 404,
        detail: mensaje,
        codigo: 'NO_ENCONTRADO',
        mensaje,
        ...(conElMiembro ? { parametroQueFalta: { ejercicio: Number(ejercicio) } } : {}),
      }),
    });
  });

  const contesto = pagina.waitForResponse(LECTURA_DEL_CONJUNTO);
  await abrir(pagina, hoja);
  await contesto;
  await expect(pagina.locator('[data-estado-de-la-lectura="pidiendo"]')).toHaveCount(0, {
    timeout: 15_000,
  });

  return {
    ejercicio,
    fallos: await pagina.locator('[data-estado-de-la-lectura="fallo"]').count(),
    reintentar: await pagina.getByRole('button', { name: 'Reintentar' }).count(),
    texto: (await pagina.locator('main, body').first().innerText()).replace(/\s+/g, ' '),
    snapshots: salidas.filter((url) => url.includes('/snapshot')),
  };
}

for (const hoja of HOJAS) {
  test.describe(`${hoja}: los dos 404 de «GET /conjuntos» no se ven igual`, () => {
    test('CON «parametroQueFalta» es una respuesta: ni fallo, ni «Reintentar», ni snapshot', async ({
      page,
    }) => {
      const visto = await abrirConElCuatrocientosCuatro(page, hoja, true);

      expect(
        visto.fallos,
        `«${hoja}» dibujo «ese ejercicio no esta publicado» como un FALLO. Es una respuesta: el\n` +
          '  backend contesto lo que hay, y lo que hay es ningun conjunto sellado. Lo que lo separa\n' +
          '  del 404 de ruta es el miembro `parametroQueFalta`, no el estado ni el mensaje.',
      ).toBe(0);
      expect(visto.reintentar, 'se ofrecio «Reintentar» sobre algo que reintentar no cambia').toBe(0);
      expect(visto.texto, 'la frase de arriba no dice que es una respuesta').toContain(
        ES_UNA_RESPUESTA,
      );
      expect(visto.texto, 'la hoja no nombra el ejercicio que dijo el miembro').toContain(
        conElEjercicio(visto.ejercicio),
      );
      expect(
        visto.snapshots,
        'sin conjunto sellado se pidio un snapshot: no hay `conjuntoId` que llevar',
      ).toEqual([]);
    });

    test('SIN el miembro —el 404 de ruta— es un FALLO, con el MISMO mensaje dentro', async ({
      page,
    }) => {
      const visto = await abrirConElCuatrocientosCuatro(page, hoja, false);

      expect(
        visto.fallos,
        `«${hoja}» NO dibujo el 404 de ruta como fallo. Lleva el MISMO mensaje que el de «no esta\n` +
          '  publicado»: si se leyo como respuesta, la pantalla decidio por el texto en castellano.',
      ).toBeGreaterThan(0);
      expect(visto.texto, 'un 404 de ruta se dijo como «no esta publicado»').not.toContain(
        ES_UNA_RESPUESTA,
      );
      expect(visto.texto).not.toContain(conElEjercicio(visto.ejercicio));
      expect(visto.snapshots).toEqual([]);
    });
  });
}
