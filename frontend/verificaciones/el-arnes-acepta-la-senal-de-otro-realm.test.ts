import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { requestQueAceptaLaSenalDeOtroRealm } from './request-del-arnes.ts';

/**
 * **El arnes acepta la senal del documento, y con Node 24 eso no es gratis** (#90).
 *
 * El motivo entero —los dos realms, `undici`, `createClientSideRequest` y las cifras de los dos
 * motores— esta en `request-del-arnes.ts`. Aqui se comprueba que muerde, y en los DOS motores:
 *
 *   1. **La muestra** le da un `Request` de mentira que rechaza cualquier senal, o sea un Node 24
 *      de bolsillo. Sale rojo con el motor que sea, incluido el 22 que este arbol declara, que es
 *      lo unico que impide que esta pieza se quede sin probar hasta el dia que el producto suba.
 *   2. **Y el motor de verdad**: el `Request` global —ya envuelto por `vitest.setup.ts`— recibe la
 *      senal que fabrica el documento y no se cae. Con Node 22 eso ya pasaba; con Node 24, sin el
 *      envoltorio, esta prueba y las dos de navegacion salen rojas.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Un `Request` de mentira que se queda con lo que le dan. La base de las muestras. */
class RequestFingido {
  readonly entrada: RequestInfo | URL;
  readonly init: RequestInit | undefined;
  readonly signal: AbortSignal | null = null;

  constructor(entrada: RequestInfo | URL, init?: RequestInit) {
    this.entrada = entrada;
    this.init = init;
  }
}

/** El mismo, pero con la comprobacion de `undici` desde Node 24: la senal ajena no pasa. */
class RequestComoElDeNode24 extends RequestFingido {
  constructor(entrada: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal) {
      throw new TypeError(
        'RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.',
      );
    }
    super(entrada, init);
  }
}

const envolviendo = (Base: unknown) =>
  requestQueAceptaLaSenalDeOtroRealm(Base as unknown as typeof Request);

describe('LA MUESTRA: con un `Request` que rechaza la senal —un Node 24—, el arnes la deja pasar', () => {
  const senal = new AbortController().signal;

  it('sin el envoltorio, construir con senal revienta: es el defecto, reproducido', () => {
    expect(() => new RequestComoElDeNode24('http://arnes.invalid/x', { signal: senal })).toThrow(
      /Expected signal .* to be an instance of AbortSignal/,
    );
  });

  it('con el envoltorio, construye — y `signal` es LA MISMA, no una parecida', () => {
    // Que sea la misma es lo que importa: `react-router` lee `request.signal` para cortar sus
    // cargadores, asi que una copia dejaria la navegacion viva y los cargadores sin cortar.
    const peticion = new (envolviendo(RequestComoElDeNode24))('http://arnes.invalid/x', {
      signal: senal,
    });

    expect(peticion.signal).toBe(senal);
  });

  it('y lo demas del `init` llega intacto: solo se aparta la senal', () => {
    const peticion = new (envolviendo(RequestComoElDeNode24))('http://arnes.invalid/x', {
      method: 'POST',
      signal: senal,
    });

    expect((peticion as unknown as RequestFingido).init).toEqual({ method: 'POST' });
  });

  it('cuando la base SI acepta la senal, el envoltorio no toca nada — el caso de Node 22', () => {
    // La otra mitad, y la que justifica que esto no sea el `globalThis.Request = …` de la
    // libreria: con el motor que este arbol declara, el arnes no cambia lo que se mide.
    const peticion = new (envolviendo(RequestFingido))('http://arnes.invalid/x', { signal: senal });

    expect((peticion as unknown as RequestFingido).init).toEqual({ signal: senal });
  });
});

describe('LA GUARDA DE LA GUARDA: el repliegue no se traga otros fallos', () => {
  it('un `TypeError` que no habla de la senal sube tal cual', () => {
    class RequestQueNoLeGustaLaUrl extends RequestFingido {
      constructor(entrada: RequestInfo | URL, init?: RequestInit) {
        super(entrada, init);
        throw new TypeError('Failed to parse URL from …');
      }
    }

    expect(
      () =>
        new (envolviendo(RequestQueNoLeGustaLaUrl))('no-es-una-url', {
          signal: new AbortController().signal,
        }),
    ).toThrow(/Failed to parse URL/);
  });

  it('y un fallo que no es `TypeError`, tampoco se reintenta', () => {
    class RequestQueRevienta extends RequestFingido {
      constructor(entrada: RequestInfo | URL, init?: RequestInit) {
        super(entrada, init);
        throw new RangeError('lo que sea');
      }
    }

    expect(
      () =>
        new (envolviendo(RequestQueRevienta))('http://arnes.invalid/x', {
          signal: new AbortController().signal,
        }),
    ).toThrow(RangeError);
  });
});

describe('EL MOTOR DE VERDAD: el `Request` global de esta corrida', () => {
  it('acepta la senal que fabrica el documento, y la senal sigue viva', () => {
    // Esta es la prueba que cambia de color con el motor: con Node 24 y sin el envoltorio de
    // `vitest.setup.ts` sale `TypeError: RequestInit: Expected signal … to be an instance of
    // AbortSignal`, que es exactamente lo que mata las dos pruebas de navegacion.
    const mando = new AbortController();

    const peticion = new Request('http://arnes.invalid/x', { signal: mando.signal });

    expect(peticion.signal.aborted).toBe(false);
    mando.abort();
    expect(peticion.signal.aborted, 'cortar la senal tiene que cortar la peticion').toBe(true);
  });

  it('y el arnes lo instala: sin esa linea, lo de arriba solo vale en Node 22', () => {
    // El envoltorio esta en un modulo aparte para que las muestras lo ejerzan; la unica linea que
    // lo pone en produccion del arnes es esa, y borrarla no rompe ninguna de las de arriba con el
    // motor declarado. Por eso se lee el archivo.
    const arnes = readFileSync(join(AQUI, '..', 'vitest.setup.ts'), 'utf8');

    expect(arnes).toContain('requestQueAceptaLaSenalDeOtroRealm');
    expect(arnes).toMatch(/globalThis\.Request = requestQueAceptaLaSenalDeOtroRealm\(/);
  });
});
