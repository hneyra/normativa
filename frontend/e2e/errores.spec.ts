import { expect, test, type Page } from '@playwright/test';

import {
  abrir,
  conElEstadoDelEjercicio,
  conLaPuertaAgotada,
  elEstadoDelEjercicio,
  LECTURA_DEL_ESTADO,
  LECTURA_DEL_LISTADO,
} from './instalacion.ts';

/**
 * **Los siete fallos se ven distintos, en Chromium y sobre el bundle construido** (#63, AC 4).
 *
 * <h2>Que mide esto que ninguna prueba de `vitest` mide</h2>
 *
 * Que **lo que se lee es distinto**. Una prueba de unidad puede comprobar que `peldanoDe()` devuelve
 * siete claves distintas —y lo comprueba, en `kamayuk-lib`—, y eso no dice nada sobre la pantalla:
 * entre el peldano y lo que alguien lee hay una pieza que elige que campos dibuja. Si esa pieza
 * pintara `error.message`, los siete casos llegarian con **el mismo mensaje inyectado** y se verian
 * iguales, con las siete pruebas de la escalera en verde.
 *
 * Por eso aqui se inyecta **el mismo mensaje en los siete** y se comparan las pantallas **entre
 * si**, no contra un texto esperado: comparar contra un texto esperado mide que la libreria no
 * cambio sus frases; comparar entre si mide lo que el AC pide, que es que se distingan.
 *
 * <h2>Se inyecta en la lectura del LISTADO, y la del ESTADO contesta bien</h2>
 *
 * Las dos mitades importan:
 *
 *   · **El listado** (`GET /seguridad/parametros`) es el que exige el acceso `parametros`, asi que
 *     es el que de verdad va a contestar 403 a una cuenta de ventanilla.
 *   · **El estado** (`…/ejercicios/{ejercicio}`) contesta **200**, y con eso se mide la otra mitad
 *     del AC 2: el fallo del listado se dice **encima** y el estado del ejercicio **sigue
 *     dibujado** debajo. Si no se doblara, el arnes no tiene backend y esa lectura fallaria
 *     tambien: saldrian dos averias y no se podria demostrar nada.
 *
 * <h2>El cuerpo del 200 no se escribe a mano: sale del CONTRATO</h2>
 *
 * `YA_SERVIDAS` esta vacia —nadie ha ejercido ninguna ruta de este backend con un token de esta
 * interfaz—, asi que no hay una captura de verdad que reproducir. Lo que si hay es la **forma
 * publicada**, generada del tipo de retorno del controlador, y `elEstadoDelEjercicio()` de
 * `instalacion.ts` comprueba campo a campo que el cuerpo doblado tenga exactamente esas llaves. Un
 * cuerpo con un campo de mas o de menos pone rojo este arnes, no lo pasa en silencio.
 *
 * <h2>Los dos 422 ya NO comparten peldano: `kamayuk-lib`#52 se mezclo</h2>
 *
 * Hasta `kamayuk-lib`#52, `peldanoDe()` clasificaba `VALIDACION` y `ORDEN_NO_ADMITIDO` como el
 * mismo `no-valido` —mismo titulo, mismo remedio— y con el mismo mensaje inyectado **sus dos
 * pantallas eran identicas**. Eso se afirmaba aqui en vez de rodearse, porque un `switch` sobre el
 * codigo en `normativa` seria la traduccion paralela que el propio AC 4 prohibe, y la afirmacion
 * decia que hacer el dia que la escalera aprendiera: mover el par a la lista de los distintos.
 *
 * Ese dia llego sin tocar este arbol —la CI clona `kamayuk-lib` en su rama principal—: la escalera
 * gano el peldano `orden-no-admitido` por `codigo` (`escalera.ts`, `{ estado: 422, codigo:
 * 'ORDEN_NO_ADMITIDO' }`) y la afirmacion salio roja en `kamayuk-lib@da5e3d9`, leyendo
 * «No se puede ordenar por ese campo … Ordene por otra columna y avise de esto a quien la
 * mantiene» donde el 422 `VALIDACION` lee «Lo que se mando no cumple una regla …». Asi que ahora
 * son **los siete** los que se comparan entre si.
 */

/** El mismo mensaje en los siete: si la pantalla pintara esto, las siete se verian iguales. */
const EL_MISMO_MENSAJE = 'No se pudo completar la lectura del listado';

/** Los siete casos, con lo que cada uno contesta al listado. */
interface Caso {
  readonly nombre: string;
  readonly esAveria: boolean;
  readonly contestar: (ruta: {
    fulfill: (opciones: {
      status: number;
      contentType: string;
      body: string;
    }) => Promise<void>;
    abort: (motivo: string) => Promise<void>;
  }) => Promise<void>;
}

/** Un `problem+json` como el que escribe `ManejadorDeErrores`, con su `codigo` y su `mensaje`. */
const problema = (status: number, codigo: string, titulo: string) => ({
  status,
  contentType: 'application/problem+json',
  body: JSON.stringify({ status, title: titulo, codigo, mensaje: EL_MISMO_MENSAJE }),
});

const CASOS: readonly Caso[] = [
  {
    nombre: '401 NO_AUTENTICADO',
    esAveria: false,
    contestar: (ruta) =>
      ruta.fulfill(problema(401, 'NO_AUTENTICADO', 'La peticion no trae un token valido')),
  },
  {
    nombre: '403 SIN_PRIVILEGIO',
    esAveria: false,
    contestar: (ruta) =>
      ruta.fulfill(
        problema(403, 'SIN_PRIVILEGIO', 'No tiene el privilegio necesario para esta operacion'),
      ),
  },
  {
    nombre: '403 SIN_MUNICIPALIDAD',
    esAveria: false,
    contestar: (ruta) =>
      ruta.fulfill(
        problema(403, 'SIN_MUNICIPALIDAD', 'El token no identifica una municipalidad'),
      ),
  },
  {
    nombre: '422 VALIDACION',
    esAveria: false,
    contestar: (ruta) =>
      ruta.fulfill(
        problema(422, 'VALIDACION', 'La peticion no cumple una regla de validacion'),
      ),
  },
  {
    nombre: '422 ORDEN_NO_ADMITIDO',
    esAveria: false,
    contestar: (ruta) =>
      ruta.fulfill(problema(422, 'ORDEN_NO_ADMITIDO', 'No se puede ordenar por ese campo')),
  },
  {
    nombre: '500 ERROR_INTERNO',
    esAveria: true,
    contestar: (ruta) =>
      ruta.fulfill(problema(500, 'ERROR_INTERNO', 'No se pudo completar la operacion')),
  },
  {
    nombre: 'la red caida',
    esAveria: true,
    // El mismo verbo que usa `la-puerta-caida.spec.ts`: el navegador no llega, y `fetch` lanza un
    // `TypeError` que NO es un `ErrorDeLaApi` — el primer peldano de la escalera.
    contestar: (ruta) => ruta.abort('connectionrefused'),
  },
];

/** Deja el Panel abierto con el listado contestando lo que diga el caso. */
async function elPanelCon(pagina: Page, caso: Caso): Promise<void> {
  await conLaPuertaAgotada(pagina);
  // DESPUES del helper: en Playwright gana la ruta registrada mas tarde, y el helper deja un 404
  // generico sobre todo `/normativa/api/v1/**`.
  await conElEstadoDelEjercicio(pagina);
  await pagina.route(LECTURA_DEL_LISTADO, (ruta) => caso.contestar(ruta));
  await abrir(pagina, 'panel');
}

/** Lo que se lee en el aviso del fallo: el peldano ya dibujado. */
async function loQueSeLee(pagina: Page): Promise<string> {
  const fallo = pagina.locator('[data-estado-de-la-lectura="fallo"]').first();
  await fallo.waitFor({ timeout: 15_000 });
  return (await fallo.innerText()).trim().replace(/\s+/g, ' ');
}

test.describe('los siete fallos del listado se ven distintos', () => {
  for (const caso of CASOS) {
    test(`«${caso.nombre}» se dice, y el estado del ejercicio sigue dibujado`, async ({ page }) => {
      await elPanelCon(page, caso);

      const leido = await loQueSeLee(page);
      expect(leido.length, `«${caso.nombre}» dibujo un aviso vacio`).toBeGreaterThan(20);

      // **La otra mitad del AC 2**: el fallo del listado va ENCIMA y no sustituye al cuerpo, asi
      // que la rejilla de campos del bloque sigue ahi. Con un 403 de `parametros`, una cuenta de
      // ventanilla tiene que seguir viendo si su ejercicio esta sellado.
      await expect(
        page.locator('[data-slot="tarjeta-campos"]').first(),
        `«${caso.nombre}» se llevo por delante el estado del ejercicio`,
      ).toBeVisible();

      // Y «Reintentar» solo donde reintentar puede cambiar algo. Un privilegio que falta sale igual
      // las veces que se pulse, y ofrecer el boton ahi manda a insistir sobre algo ya imposible.
      const botones = page.getByRole('button', { name: 'Reintentar' });
      await expect(
        botones,
        caso.esAveria
          ? `«${caso.nombre}» es una averia y no ofrecio reintentar`
          : `«${caso.nombre}» NO es una averia y ofrecio reintentar`,
      ).toHaveCount(caso.esAveria ? 1 : 0);
    });
  }

  test('y los siete textos son distintos entre si', async ({ page }) => {
    const leidos = new Map<string, string>();
    for (const caso of CASOS) {
      const pagina = await page.context().newPage();
      await elPanelCon(pagina, caso);
      leidos.set(caso.nombre, await loQueSeLee(pagina));
      await pagina.close();
    }

    // Los SIETE, desde `kamayuk-lib`#52 (ver la cabecera): se comparan entre si, y no contra un
    // texto escrito aqui.
    const distintos = CASOS.map((c) => c.nombre);
    const textos = distintos.map((nombre) => leidos.get(nombre) ?? '');
    expect(
      new Set(textos).size,
      'Dos de estas pantallas se leen igual:\n' +
        distintos.map((n, i) => `  ${n}: «${textos[i] ?? ''}»`).join('\n') +
        '\n\n  Los siete casos llevan EL MISMO mensaje dentro, asi que si dos coinciden es que la\n' +
        '  pantalla esta pintando el mensaje del servidor en vez del peldano de la escalera.',
    ).toBe(distintos.length);
  });

  test('reintentar vuelve a pedir LAS DOS lecturas, y no solo la que fallo', async ({ page }) => {
    let listados = 0;
    let estados = 0;

    await conLaPuertaAgotada(page);
    await page.route(LECTURA_DEL_ESTADO, (ruta) => {
      estados += 1;
      return ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(elEstadoDelEjercicio()),
      });
    });
    await page.route(LECTURA_DEL_LISTADO, (ruta) => {
      listados += 1;
      return ruta.fulfill(problema(500, 'ERROR_INTERNO', 'No se pudo completar la operacion'));
    });
    await abrir(page, 'panel');
    await loQueSeLee(page);

    expect(listados, 'el listado no se pidio').toBe(1);
    expect(estados, 'el estado del ejercicio no se pidio').toBe(1);

    await page.getByRole('button', { name: 'Reintentar' }).click();

    // Las DOS. Lo que fallo puede haber dejado obsoleto lo que no: si el listado cayo por una
    // averia del backend, el estado que se leyo antes es de antes de la averia, y quedarse con el
    // deja media pantalla vieja y media nueva.
    await expect
      .poll(() => listados, { timeout: 15_000, message: 'el listado no se volvio a pedir' })
      .toBe(2);
    await expect
      .poll(() => estados, {
        timeout: 15_000,
        message:
          'el estado del ejercicio NO se volvio a pedir: reintentar solo pidio la lectura que fallo',
      })
      .toBe(2);
  });
});
