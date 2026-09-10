import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CODIGOS_DE_ERROR,
  ErrorDeLaApi,
  sha256,
  solicitar,
  solicitarSnapshot,
} from './cliente.ts';

/** Sustituye `fetch` por uno que contesta lo que se le diga, y devuelve el espia. */
function fetchQueContesta(respuesta: Response) {
  const espia = vi.fn<typeof fetch>(() => Promise.resolve(respuesta));
  vi.stubGlobal('fetch', espia);
  return espia;
}

/** Un cuerpo `problem+json` como el que compone `ManejadorDeErrores`. */
function problema(estado: number, codigo: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      type: `https://kamayuk.gob.pe/errores/${codigo.toLowerCase()}`,
      title: 'Un titulo cualquiera',
      status: estado,
      detail: 'El detalle',
      codigo,
      mensaje: 'El mensaje que escribio el backend',
      ...extra,
    }),
    { status: estado, headers: { 'content-type': 'application/problem+json' } },
  );
}

/** Una respuesta de snapshot con el `ETag` que se le diga. */
async function snapshotCon(cuerpo: string, etag?: string): Promise<Response> {
  return new Response(cuerpo, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      etag: `"${etag ?? (await sha256(cuerpo))}"`,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('el cliente de la API de normativa', () => {
  it('cuelga la ruta del prefijo del sistema, porque la ruta dice quien responde', async () => {
    const espia = fetchQueContesta(Response.json({ ok: true }));

    await solicitar('/conjuntos/2026');

    expect(espia.mock.calls[0]?.[0]).toBe('/normativa/api/v1/conjuntos/2026');
  });

  it('convierte una respuesta de error en ErrorDeLaApi, con su estado', async () => {
    // Un `Response` por llamada: el cuerpo se lee una sola vez, y reutilizarlo daria un
    // «Body is unusable» que no habla de lo que se esta probando.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('', { status: 409 }))),
    );

    await expect(solicitar('/conjuntos/2027')).rejects.toBeInstanceOf(ErrorDeLaApi);
    await expect(solicitar('/conjuntos/2027')).rejects.toMatchObject({ estado: 409 });
  });

  it('jamas manda una municipalidad: el backend la toma del token (regla 2)', async () => {
    const espia = fetchQueContesta(Response.json({ ok: true }));

    await solicitar('/seguridad/parametros');

    const [url, opciones] = espia.mock.calls[0] ?? [];
    expect(String(url)).not.toContain('municipalidad');
    expect(JSON.stringify(opciones ?? {})).not.toContain('municipalidad');
  });
});

describe('los errores se leen por su CODIGO, no por su texto (AC7)', () => {
  it.each([
    ['NO_AUTENTICADO', 401],
    ['SIN_MUNICIPALIDAD', 403],
    ['SIN_PRIVILEGIO', 403],
    ['VALIDACION', 422],
    ['ORDEN_NO_ADMITIDO', 422],
    ['NO_ENCONTRADO', 404],
    ['METODO_NO_ADMITIDO', 405],
    ['CONFLICTO', 409],
    ['ERROR_INTERNO', 500],
  ])('%s (%i) llega como codigo, y el mensaje es el del backend', async (codigo, estado) => {
    fetchQueContesta(problema(estado, codigo));

    await expect(solicitar('/conjuntos?ejercicio=2026')).rejects.toMatchObject({
      codigo,
      estado,
      message: 'El mensaje que escribio el backend',
    });
  });

  it('un codigo que esta interfaz no conoce NO se cuela en la union: se deduce del estado', async () => {
    fetchQueContesta(problema(409, 'CODIGO_QUE_NO_EXISTE'));

    const fallo = await solicitar('/conjuntos?ejercicio=2026').catch((e: unknown) => e);

    expect(fallo).toBeInstanceOf(ErrorDeLaApi);
    // Dejarlo pasar es peor de lo que parece: no casaria con ninguna rama, el aviso saldria con
    // el titulo por omision, y nada diria que el codigo era desconocido.
    expect((fallo as ErrorDeLaApi).codigo).toBe('CONFLICTO');
    expect(CODIGOS_DE_ERROR).not.toContain('CODIGO_QUE_NO_EXISTE');
  });

  it('un 401 de los filtros —cuatro campos, sin type ni detail— se lee igual', async () => {
    // `RespuestaDeError` escribe el JSON a mano porque ocurre ANTES del DispatcherServlet. Lo
    // unico que esta siempre es `codigo`, y es lo que se mira.
    fetchQueContesta(
      new Response(
        '{"status":401,"title":"La peticion no trae un token valido",' +
          '"codigo":"NO_AUTENTICADO","mensaje":"La peticion no trae un token valido"}',
        { status: 401, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    await expect(solicitar('/conjuntos?ejercicio=2026')).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });

  it('publica detalles y parametroQueFalta solo cuando el cuerpo los trae', async () => {
    fetchQueContesta(
      problema(422, 'VALIDACION', {
        detalles: ['Se admiten: direccion, ejercicio'],
        parametroQueFalta: { ejercicio: 2027, llave: 'UIT' },
      }),
    );

    const fallo = (await solicitar('/conjuntos?ejercicio=2027').catch(
      (e: unknown) => e,
    )) as ErrorDeLaApi;

    expect(fallo.detalles).toEqual(['Se admiten: direccion, ejercicio']);
    expect(fallo.parametroQueFalta).toEqual({ ejercicio: 2027, llave: 'UIT' });
    // Es el discriminador de dos cosas que salen con el mismo codigo y el mismo estado: esta
    // no la arregla nadie desde la pantalla.
    expect(fallo.faltaUnaCifraNormativa).toBe(true);
  });

  it('y un parametroQueFalta que no es un objeto con ejercicio se descarta entero', async () => {
    fetchQueContesta(problema(422, 'VALIDACION', { parametroQueFalta: 'UIT' }));

    const fallo = (await solicitar('/x').catch((e: unknown) => e)) as ErrorDeLaApi;

    // Inventarle un ejercicio seria peor que no tenerlo.
    expect(fallo.parametroQueFalta).toBeUndefined();
    expect(fallo.faltaUnaCifraNormativa).toBe(false);
  });

  it('«Reintentar» solo donde reintentar puede cambiar algo', async () => {
    fetchQueContesta(problema(500, 'ERROR_INTERNO', { incidencia: 'abc-123' }));
    const interno = (await solicitar('/x').catch((e: unknown) => e)) as ErrorDeLaApi;
    expect(interno.reintentable).toBe(true);
    expect(interno.incidencia).toBe('abc-123');

    fetchQueContesta(problema(405, 'METODO_NO_ADMITIDO'));
    const verbo = (await solicitar('/x').catch((e: unknown) => e)) as ErrorDeLaApi;
    // Un verbo que la ruta no admite no puede funcionar nunca.
    expect(verbo.reintentable).toBe(false);
  });

  it('una red caida no es un error del servidor: SIN_RESPUESTA, y no llego nada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(solicitar('/conjuntos?ejercicio=2026')).rejects.toMatchObject({
      codigo: 'SIN_RESPUESTA',
      estado: 0,
    });
  });

  it('una cancelacion se propaga tal cual: no es un fallo que dibujar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new DOMException('abortada', 'AbortError'))),
    );

    await expect(solicitar('/x')).rejects.toBeInstanceOf(DOMException);
  });

  it('un 200 que no es JSON no es una respuesta vacia: es OTRA COSA contestando', async () => {
    // Pasa de verdad en desarrollo: el servidor de Vite atiende `/normativa/api/v1/...` y
    // devuelve el index.html con un 200. Sin esta guarda la pantalla se dibuja EN BLANCO.
    fetchQueContesta(
      new Response('<!doctype html><html lang="es"></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(solicitar('/conjuntos?ejercicio=2026')).rejects.toMatchObject({
      codigo: 'SIN_RESPUESTA',
    });
  });
});

describe('el snapshot se verifica, no se cree (AC10)', () => {
  const cuerpo = '{"conjuntoId":2,"documentoFuente":"Resolución Ministerial N.º 277-2025-VIVIENDA"}';

  it('recalcula el sha256 del cuerpo y lo compara con el ETag', async () => {
    fetchQueContesta(await snapshotCon(cuerpo));

    const { recurso, huella } = await solicitarSnapshot<{ conjuntoId: number }>(
      '/conjuntos/2/snapshot?ambito=VALUACION',
    );

    expect(recurso.conjuntoId).toBe(2);
    expect(huella).toBe(await sha256(cuerpo));
  });

  it('el sha256 es de los BYTES en UTF-8, que es lo que el servidor firma', async () => {
    // El cuerpo lleva «Resolución Ministerial» en cada fila, asi que esto no es teorico. El
    // servidor firma `cuerpo.getBytes(StandardCharsets.UTF_8)`; sobre otra codificacion la
    // huella seria otra y toda descarga cacheada se leeria como corrupta.
    expect(await sha256('ó')).toBe(
      'aa2f86f8e3c3e2237b6c42bcb824f41402eed1c9b9a16bb80576c2002c4c01e3',
    );
    // Y no es la de latin-1 ni la de UTF-16, que son las dos que saldrian de leerlo mal.
    expect(await sha256('ó')).not.toBe(
      '782e02029374527bd2a5fe7b9545df6c2911078e337a62573970b178d93db481',
    );
    expect(await sha256('ó')).not.toBe(
      'ad8c54a8c8b5b4429e0ada7bea8d7c3e95de008f5b29c2a21a272581f91ac869',
    );
  });

  it('si no cuadra es un error, y dice las dos huellas', async () => {
    const mentira = 'a'.repeat(64);
    fetchQueContesta(await snapshotCon(cuerpo, mentira));

    const fallo = (await solicitarSnapshot('/conjuntos/2/snapshot?ambito=VALUACION').catch(
      (e: unknown) => e,
    )) as ErrorDeLaApi;

    expect(fallo.codigo).toBe('HUELLA_QUE_NO_CUADRA');
    expect(fallo.message).toContain(mentira);
    expect(fallo.message).toContain(await sha256(cuerpo));
    // No se reintenta: el conjunto es inmutable, asi que volveria a no cuadrar.
    expect(fallo.reintentable).toBe(false);
  });

  it('sin ETag tampoco se acepta: sin huella no hay nada que comparar al releerlo', async () => {
    fetchQueContesta(
      new Response(cuerpo, { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await expect(solicitarSnapshot('/conjuntos/2/snapshot?ambito=VALUACION')).rejects.toMatchObject(
      { codigo: 'HUELLA_QUE_NO_CUADRA' },
    );
  });

  it('y un ETag DEBIL tampoco: «equivalente» no es «los mismos bytes»', async () => {
    fetchQueContesta(
      new Response(cuerpo, {
        status: 200,
        headers: { 'content-type': 'application/json', etag: `W/"${await sha256(cuerpo)}"` },
      }),
    );

    await expect(solicitarSnapshot('/conjuntos/2/snapshot?ambito=VALUACION')).rejects.toMatchObject(
      { codigo: 'HUELLA_QUE_NO_CUADRA' },
    );
  });

  it('un error del backend en esta ruta sigue siendo un error del backend', async () => {
    fetchQueContesta(problema(404, 'NO_ENCONTRADO'));

    await expect(solicitarSnapshot('/conjuntos/9/snapshot?ambito=VALUACION')).rejects.toMatchObject(
      { codigo: 'NO_ENCONTRADO', estado: 404 },
    );
  });
});
