import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi, solicitar } from './cliente.ts';

/** Sustituye `fetch` por uno que contesta lo que se le diga, y devuelve el espia. */
function fetchQueContesta(respuesta: Response) {
  const espia = vi.fn<typeof fetch>(() => Promise.resolve(respuesta));
  vi.stubGlobal('fetch', espia);
  return espia;
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
    fetchQueContesta(new Response('', { status: 409 }));

    await expect(solicitar('/conjuntos/2027')).rejects.toBeInstanceOf(ErrorDeLaApi);
    await expect(solicitar('/conjuntos/2027')).rejects.toMatchObject({ estado: 409 });
  });
});
