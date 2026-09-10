import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OPERACIONES, claveDe } from '../datos/operaciones.ts';
import { EDICIONES } from '../datos/prototipo.ts';
import { YA_SERVIDAS } from '../datos/servidas.ts';
import { PREFIJO, sha256 } from './cliente.ts';
import {
  RAIZ,
  desinstalarProxyDeDatos,
  instalarProxyDeDatos,
  proxyDeDatosInstalado,
} from './proxy.ts';

/**
 * El proxy contesta en la frontera del transporte, y contesta lo que contestaria el backend.
 *
 * Todo lo de aqui se pide **por HTTP**, con el proxy instalado y `fetch` de verdad: si el proxy
 * dejara de enrutar, estas pruebas se pondrian rojas igual. Llamar al constructor del cuerpo
 * directamente probaria el dato y no el camino, que es lo unico que este archivo existe para
 * probar.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLATAFORMA = join(
  AQUI,
  '../../../backend/kamayuk-normativa-plataforma/src/main/java/kamayuk/normativa/web',
);

/** Une lo que Spotless parte: `"abc" + "def"` → `"abcdef"`. Ver `formas.test.ts`. */
function unirCadenas(java: string): string {
  let anterior = java;
  for (;;) {
    const unido = anterior.replace(/"\s*\+\s*"/g, '');
    if (unido === anterior) return unido;
    anterior = unido;
  }
}

function java(archivo: string): string {
  return unirCadenas(readFileSync(join(PLATAFORMA, archivo), 'utf8'));
}

/** Pide por HTTP a traves del proxy. Devuelve la respuesta cruda, no su cuerpo. */
async function pedir(ruta: string, opciones: RequestInit = {}): Promise<Response> {
  return fetch(`${RAIZ}${ruta}`, opciones);
}

/** El cuerpo `problem+json` de una respuesta de error. */
async function problemaDe(respuesta: Response): Promise<Record<string, unknown>> {
  return (await respuesta.json()) as Record<string, unknown>;
}

afterEach(() => {
  desinstalarProxyDeDatos();
  vi.unstubAllGlobals();
});

describe('la instalacion', () => {
  it('sustituye globalThis.fetch y lo devuelve tal cual al desinstalar', () => {
    const antes = globalThis.fetch;
    expect(proxyDeDatosInstalado()).toBe(false);

    const desinstalar = instalarProxyDeDatos();
    expect(proxyDeDatosInstalado()).toBe(true);
    expect(globalThis.fetch).not.toBe(antes);

    desinstalar();
    // Y el MISMO, no un envoltorio equivalente: instalar y desinstalar en ciclo dejaria una
    // capa pegada en cada vuelta, y la peticion acabaria atravesando cinco proxies.
    expect(globalThis.fetch).toBe(antes);
    expect(proxyDeDatosInstalado()).toBe(false);
  });

  it('la raiz del proxy es la del cliente, que es la del backend', () => {
    expect(RAIZ).toBe(PREFIJO);
    // Y la del backend, leida de su fuente y no tecleada aqui.
    const api = readFileSync(join(PLATAFORMA, 'Api.java'), 'utf8');
    expect(api).toContain(`String RAIZ = "${RAIZ}"`);
  });

  it('deja pasar lo que no es suyo, que es todo lo que no cuelga de su raiz', async () => {
    const espia = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ ajeno: true })));
    vi.stubGlobal('fetch', espia);
    instalarProxyDeDatos();

    // Otro sistema, otro repositorio: fingir su respuesta seria inventar un contrato ajeno.
    await fetch('/rentas/api/v1/rentas/contribuyentes');
    await fetch('/normativa/assets/tipografia.woff2');

    expect(espia).toHaveBeenCalledTimes(2);
  });
});

describe('las cuatro lecturas se piden por HTTP y contestan', () => {
  it.each(OPERACIONES.filter((o) => o.origen === 'REAL').map((o) => [claveDe(o), o] as const))(
    '%s',
    async (_clave, operacion) => {
      instalarProxyDeDatos();

      const ruta = operacion.ruta.replace(/\{\w+\}/g, '2');
      const consulta = operacion.obligatorios.map(
        (n) => `${n}=${n === 'ejercicio' ? '2026' : 'VALUACION'}`,
      );
      const url = consulta.length === 0 ? ruta : `${ruta}?${consulta.join('&')}`;

      const respuesta = await pedir(url);

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get('content-type')).toBe('application/json');
      expect(await respuesta.json()).toBeTypeOf('object');
    },
  );
});

describe('las tres escrituras simuladas, por HTTP (AC8)', () => {
  const observacion = JSON.stringify({ observacion: 'Prueba del proxy de datos' });

  it('abrir una version: 201 con la forma de un conjunto ABIERTO', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/ediciones', { method: 'POST', body: observacion });
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    expect(respuesta.status).toBe(201);
    expect(cuerpo.estado).toBe('ABIERTO');
    expect(cuerpo.fechaSellado).toBeNull();
  });

  it('agregar un parametro a una edicion que existe: 201', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/ediciones/3/parametros', {
      method: 'POST',
      body: observacion,
    });

    expect(respuesta.status).toBe(201);
  });

  it('sin observacion no se guarda, ni siquiera aqui: 422 VALIDACION (regla 10)', async () => {
    instalarProxyDeDatos();

    const cuerpo = await problemaDe(
      await pedir('/ediciones', { method: 'POST', body: JSON.stringify({ observacion: 'ok' }) }),
    );

    expect(cuerpo.status).toBe(422);
    expect(cuerpo.codigo).toBe('VALIDACION');
  });

  it('una edicion que no existe: 404 NO_ENCONTRADO', async () => {
    instalarProxyDeDatos();

    const cuerpo = await problemaDe(
      await pedir('/ediciones/99/sellar', { method: 'POST', body: observacion }),
    );

    expect(cuerpo.status).toBe(404);
    expect(cuerpo.mensaje).toBe('No hay ningun conjunto de parametros con identificador 99');
  });

  it('sellar uno ya sellado: 409 CONFLICTO', async () => {
    instalarProxyDeDatos();

    const cuerpo = await problemaDe(
      await pedir('/ediciones/2/sellar', { method: 'POST', body: observacion }),
    );

    expect(cuerpo.status).toBe(409);
    expect(cuerpo.codigo).toBe('CONFLICTO');
    expect(cuerpo.mensaje).toBe(
      'El conjunto 2 ya esta sellado; corregirlo exige una version nueva (ADR-0007)',
    );
  });

  it('sellar uno vacio: 409 CONFLICTO, y NO el mismo mensaje que el anterior', async () => {
    instalarProxyDeDatos();

    const cuerpo = await problemaDe(
      await pedir('/ediciones/3/sellar', { method: 'POST', body: observacion }),
    );

    expect(cuerpo.status).toBe(409);
    // Las dos se arreglan de maneras opuestas —una abriendo una version nueva, otra agregando
    // parametros— y con el mismo texto la pantalla mandaria a hacer lo contrario.
    expect(cuerpo.mensaje).toBe(
      'El conjunto 3 no tiene ningun parametro: sellarlo vacio diria que el ejercicio esta ' +
        'parametrizado cuando no lo esta',
    );
  });

  it('y sellar NO tiene camino feliz con la captura, que es lo que el artboard dibuja', async () => {
    instalarProxyDeDatos();

    // Las tres ediciones del artboard: dos SELLADAS y una ABIERTA sin ningun parametro. O sea
    // que ninguna se puede sellar hoy, y eso es la captura y no un hueco del proxy. Fabricar
    // una cuarta edicion sellable seria inventar el estado que hace falta para que la pantalla
    // salga bonita, que es exactamente lo que `prototipo.ts` existe para impedir.
    for (const edicion of EDICIONES) {
      const respuesta = await pedir(`/ediciones/${String(edicion.id)}/sellar`, {
        method: 'POST',
        body: observacion,
      });
      expect(respuesta.status).toBe(409);
    }
  });
});

describe('lo que el proxy NO hace (AC5)', () => {
  it('no filtra: la consulta no llega al constructor, y la respuesta es la misma', async () => {
    instalarProxyDeDatos();

    const valuacion = await (await pedir('/conjuntos/2/snapshot?ambito=VALUACION')).text();
    const obligacion = await (await pedir('/conjuntos/2/snapshot?ambito=OBLIGACION')).text();

    // Byte a byte. Si el proxy fingiera el reparto por ambito, ademas del contenido cambiaria
    // la HUELLA, que es lo que el cliente compara.
    expect(valuacion).toBe(obligacion);
  });

  it('no pagina: sirve el conjunto entero en la pagina cero y lo dice', async () => {
    instalarProxyDeDatos();

    const pagina = (await (await pedir('/seguridad/parametros?pagina=3')).json()) as {
      contenido: unknown[];
      pagina: number;
      totalPaginas: number;
      hayMas: boolean;
    };

    expect(pagina.contenido).toHaveLength(EDICIONES.length);
    expect(pagina.pagina).toBe(0);
    expect(pagina.totalPaginas).toBe(1);
    expect(pagina.hayMas).toBe(false);
  });

  it('no persiste: dos escrituras iguales contestan lo mismo', async () => {
    instalarProxyDeDatos();

    const cuerpo = JSON.stringify({ observacion: 'Abrir la version de 2027' });
    const una = await (await pedir('/ediciones', { method: 'POST', body: cuerpo })).text();
    const otra = await (await pedir('/ediciones', { method: 'POST', body: cuerpo })).text();

    expect(una).toBe(otra);
  });
});

describe('los errores tienen la forma del backend (AC7)', () => {
  it('una ruta que nadie atiende: 404 NO_ENCONTRADO en problem+json', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/no/existe');
    const cuerpo = await problemaDe(respuesta);

    expect(respuesta.status).toBe(404);
    expect(respuesta.headers.get('content-type')).toBe('application/problem+json');
    expect(cuerpo.codigo).toBe('NO_ENCONTRADO');
    expect(cuerpo.status).toBe(404);
    expect(cuerpo.title).toBe('No se encontro lo solicitado');
    expect(cuerpo.type).toBe('https://kamayuk.gob.pe/errores/no_encontrado');
    expect(cuerpo.mensaje).toBe(cuerpo.detail);
  });

  it('la ruta existe y el verbo no: 405 con su cabecera Allow', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/conjuntos?ejercicio=2026', { method: 'DELETE' });
    const cuerpo = await problemaDe(respuesta);

    expect(respuesta.status).toBe(405);
    expect(cuerpo.codigo).toBe('METODO_NO_ADMITIDO');
    // La cabecera es la mitad de la respuesta que un cliente puede leer sin leer prosa.
    expect(respuesta.headers.get('allow')).toBe('GET');
    expect(cuerpo.mensaje).toBe("El verbo 'DELETE' no se admite en esta ruta. Admitidos: GET");
  });

  it('y el texto del 405 es el de ManejadorDeErrores, no una redaccion parecida', () => {
    const manejador = java('ManejadorDeErrores.java');
    expect(manejador).toContain('"El verbo \'"');
    expect(manejador).toContain('"\' no se admite en esta ruta"');
    expect(manejador).toContain('". Admitidos: "');
  });
});

describe('el borde de la consulta, que es el de GuardiaDeParametros', () => {
  it('un parametro que la operacion no declara: 422 nombrandolo', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/conjuntos?ejercicio=2026&dni=29614026');
    const cuerpo = await problemaDe(respuesta);

    expect(respuesta.status).toBe(422);
    expect(cuerpo.codigo).toBe('VALIDACION');
    expect(cuerpo.mensaje).toBe("Parametro desconocido: 'dni'");
    expect(cuerpo.detalles).toEqual([
      'Se admiten: direccion, ejercicio, ordenarPor, pagina, tamano',
    ]);
  });

  it('dos, en plural y en orden alfabetico', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/conjuntos?ejercicio=2026&zeta=1&alfa=2');
    const cuerpo = await problemaDe(respuesta);

    expect(cuerpo.mensaje).toBe("Parametros desconocidos: 'alfa', 'zeta'");
  });

  it('los cuatro de la paginacion se admiten SIEMPRE, tambien donde no se pagina', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir(
      '/conjuntos/2/snapshot?ambito=VALUACION&pagina=0&tamano=20&ordenarPor=tipo&direccion=ASCENDENTE',
    );

    expect(respuesta.status).toBe(200);
  });

  it('el parametro que la operacion exige y no llego: 422', async () => {
    instalarProxyDeDatos();

    const sinAmbito = await problemaDe(await pedir('/conjuntos/2/snapshot'));
    expect(sinAmbito.codigo).toBe('VALIDACION');
    expect(sinAmbito.mensaje).toBe("Falta el parametro obligatorio 'ambito'");

    const sinEjercicio = await problemaDe(await pedir('/conjuntos'));
    expect(sinEjercicio.mensaje).toBe("Falta el parametro obligatorio 'ejercicio'");
  });

  it('y los cuatro textos son los del backend, leidos de su fuente', () => {
    const guardia = java('GuardiaDeParametros.java');
    expect(guardia).toContain('"Parametro desconocido: "');
    expect(guardia).toContain('"Parametros desconocidos: "');
    expect(guardia).toContain('"Se admiten: "');
    expect(java('ManejadorDeErrores.java')).toContain('"Falta el parametro obligatorio \'"');
  });
});

describe('el snapshot sale con su huella y su cache (AC10)', () => {
  it('el ETag es el sha256 de los bytes servidos, y no un valor copiado', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/conjuntos/2/snapshot?ambito=VALUACION');
    const cuerpo = await respuesta.text();

    expect(respuesta.headers.get('etag')).toBe(`"${await sha256(cuerpo)}"`);
  });

  it('y con Cache-Control immutable, que es lo que dice el disparador de V9', async () => {
    instalarProxyDeDatos();

    const respuesta = await pedir('/conjuntos/2/snapshot?ambito=VALUACION');

    expect(respuesta.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('las otras tres operaciones NO llevan ETag: su huella no la mira nadie', async () => {
    instalarProxyDeDatos();

    for (const ruta of ['/seguridad/parametros', '/seguridad/parametros/ejercicios/2026']) {
      expect((await pedir(ruta)).headers.get('etag')).toBeNull();
    }
    expect((await pedir('/conjuntos?ejercicio=2026')).headers.get('etag')).toBeNull();
  });
});

describe('lo que el backend ya sirve pasa de largo (AC6)', () => {
  it('la lista de hoy esta vacia, y eso es un dato', () => {
    expect(YA_SERVIDAS).toEqual([]);
  });

  it('lo declarado como servido sale al fetch de verdad', async () => {
    const espia = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ delBackend: true })));
    vi.stubGlobal('fetch', espia);
    instalarProxyDeDatos({ yaServidas: [{ metodo: 'GET', ruta: '/conjuntos' }] });

    const cuerpo = (await (await pedir('/conjuntos?ejercicio=2026')).json()) as {
      delBackend?: boolean;
    };

    expect(espia).toHaveBeenCalledTimes(1);
    expect(cuerpo.delBackend).toBe(true);
  });

  it.each([404, 501])(
    'y si el backend contesta %i, es un 502 explicito y no un repliegue callado',
    async (estado) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(() => Promise.resolve(new Response('', { status: estado }))),
      );
      instalarProxyDeDatos({ yaServidas: [{ metodo: 'GET', ruta: '/conjuntos' }] });

      const respuesta = await pedir('/conjuntos?ejercicio=2026');
      const cuerpo = await problemaDe(respuesta);

      expect(respuesta.status).toBe(502);
      expect(cuerpo.mensaje).toContain('esta en la lista de operaciones que el backend ya sirve');
      // Un repliegue callado convierte «el backend no esta» en «el backend dice esto», y son
      // dos averias con arreglos distintos.
      expect(cuerpo.mensaje).toContain(String(estado));
    },
  );

  it('pero un 401 del backend NO se toca: es su respuesta, y hay que verla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('', { status: 401 }))),
    );
    instalarProxyDeDatos({ yaServidas: [{ metodo: 'GET', ruta: '/conjuntos' }] });

    // Es el caso que hoy pasaria de verdad si se encendiera una ruta: sin token, 401. Que
    // llegue tal cual a la pantalla es lo correcto — y es la mitad del motivo de `servidas.ts`.
    expect((await pedir('/conjuntos?ejercicio=2026')).status).toBe(401);
  });
});
