import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cliente } from './cliente.ts';
import { identidad } from '../sesion.ts';

/**
 * **El cliente de `normativa`: el prefijo, el token y lo que NUNCA viaja** (#57, AC 5 y AC 7).
 *
 * Recoge lo que la V6 media en `c01fe9a:frontend/src/api/cliente.test.ts` y que salio con ella
 * (#50): que el token va en `Authorization: Bearer`, que **sin token no se manda la cabecera
 * vacia**, que **se lee en cada peticion** y no al importar, y que jamas se envia la
 * municipalidad.
 *
 * <h2>Esto no prueba `@kamayuk/api`: prueba lo que ESTE sistema le dijo</h2>
 *
 * La libreria tiene sus propias pruebas del cliente. Lo que aqui se mide es el cableado de
 * `src/api/cliente.ts` —dos datos, el prefijo y de donde sale el token— sobre la peticion que de
 * verdad sale. Es la diferencia entre «la libreria sabe poner la cabecera» y «la cabecera de ESTA
 * interfaz lleva el token de ESTA puerta».
 */

/** Lo que el backend contesta cuando todo va bien y da igual que sea. */
function elBackendContesta() {
  const pedir = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ ok: true })));
  vi.stubGlobal('fetch', pedir);
  return pedir;
}

/** Las cabeceras con que se hizo la enesima peticion. */
function cabecerasDe(pedir: ReturnType<typeof elBackendContesta>, cual = 0): Record<string, string> {
  return (pedir.mock.calls[cual]?.[1]?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  identidad.fijarToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  identidad.fijarToken(null);
});

describe('AC 5 — el prefijo es el de este sistema, y el mismo que enruta Traefik', () => {
  it('toda ruta sale bajo `/normativa/api/v1`', async () => {
    const pedir = elBackendContesta();

    await cliente.solicitar('/conjuntos');

    // ADR-0030 §2: el primer segmento enruta sin mirar mas, y dice QUIEN responde. Con otro
    // prefijo, Traefik entrega la peticion al backend de otro sistema.
    expect(String(pedir.mock.calls[0]?.[0])).toBe('/normativa/api/v1/conjuntos');
  });
});

describe('AC 7 — la cabecera `Authorization`', () => {
  it('sin token NO se manda la cabecera: un «Bearer null» mentiria sobre el motivo del 401', async () => {
    const pedir = elBackendContesta();

    await cliente.solicitar('/conjuntos');

    expect(cabecerasDe(pedir)).not.toHaveProperty('Authorization');
  });

  it('con token, va el token', async () => {
    identidad.fijarToken('EL-TOKEN-DE-ESTA-PESTANA');
    const pedir = elBackendContesta();

    await cliente.solicitar('/conjuntos');

    expect(cabecerasDe(pedir).Authorization).toBe('Bearer EL-TOKEN-DE-ESTA-PESTANA');
  });

  it('y se lee EN CADA PETICION, no al importar el modulo', async () => {
    const pedir = elBackendContesta();

    // La primera sale sin token, como la de quien todavia no ha vuelto de la puerta.
    await cliente.solicitar('/conjuntos');
    identidad.fijarToken('EL-QUE-LLEGO-CON-EL-CANJE');
    await cliente.solicitar('/conjuntos');

    // Con un valor leido al construir el cliente, esta segunda saldria sin cabecera igual que la
    // primera: la interfaz entera contestaria 401 justo despues de identificarse.
    expect(cabecerasDe(pedir, 0)).not.toHaveProperty('Authorization');
    expect(cabecerasDe(pedir, 1).Authorization).toBe('Bearer EL-QUE-LLEGO-CON-EL-CANJE');
  });
});

describe('AC 7 — ninguna peticion lleva la municipalidad', () => {
  it('ni en la ruta, ni en la consulta, ni en el cuerpo, ni en una cabecera', async () => {
    identidad.fijarToken('un-token');
    const pedir = elBackendContesta();

    await cliente.solicitar('/conjuntos?ejercicio=2026', {
      metodo: 'POST',
      cuerpo: { observacion: 'una observacion de mas de cinco caracteres' },
    });

    // Regla 2 del producto (ADR-0028 §2): el backend la toma del token. Que el frontend no la
    // escriba lo vigila tambien ESLint —`municipalidad-en-el-cliente`—, pero por el NOMBRE del
    // identificador: esto mira lo que de verdad sale al cable.
    const [ruta, opciones] = pedir.mock.calls[0] ?? [];
    const alCable = [
      String(ruta),
      JSON.stringify(opciones?.headers ?? {}),
      String(opciones?.body ?? ''),
    ].join('\n');

    expect(alCable.toLowerCase()).not.toContain('municipalidad');
    expect(alCable).not.toMatch(/\bubigeo\b/i);
  });
});
