import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { desinstalarProxyDeDatos, instalarProxyDeDatos } from '../api/proxy.ts';
import { RUTAS, type ConjuntoResource, type ConjuntoVigenteResource } from './lecturas.ts';
import { useCalculo, useLista, useUno } from './useRecurso.ts';

/**
 * Los tres estados son un tipo, no tres `useState` sueltos (AC4).
 *
 * Lo que se prueba aqui no es que el hook devuelva el dato: es que **distinga los tres
 * desenlaces**. Una pantalla que solo distingue «tengo dato» de «no tengo» ensena el vacio
 * mientras carga y ensena ese mismo vacio cuando el backend contesta 500 — y en este sistema esa
 * confusion es cara: «este ejercicio no tiene conjunto sellado» es una RESPUESTA legitima y «no
 * pude preguntarlo» es una averia.
 */

afterEach(() => {
  desinstalarProxyDeDatos();
  vi.unstubAllGlobals();
});

describe('los tres estados', () => {
  it('empieza cargando y acaba con el dato, sin pasar por «vacio»', async () => {
    instalarProxyDeDatos();

    const { result } = renderHook(() => useUno<ConjuntoVigenteResource>(RUTAS.vigente(2026)));

    // El primer fotograma dice «cargando», no «no hay nada».
    expect(result.current).toEqual({ dato: null, cargando: true, error: null, fallo: null });

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });
    expect(result.current.dato?.ejercicio).toBe(2026);
    expect(result.current.error).toBeNull();
  });

  it('un error del backend llega como error, con su CODIGO delante', async () => {
    instalarProxyDeDatos();

    const { result } = renderHook(() => useUno(RUTAS.vigente(2026) + '&dni=29614026'));

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });
    expect(result.current.dato).toBeNull();
    // El codigo es lo estable; el texto en castellano se reescribe en cuanto alguien lo lee en
    // voz alta, y entonces la pantalla deja de poder reaccionar.
    expect(result.current.error).toContain('VALIDACION (422)');
  });

  it('y una caida de red no se confunde con una respuesta vacia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    const { result } = renderHook(() => useUno(RUTAS.conjuntos));

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });
    expect(result.current.error).toContain('SIN_RESPUESTA');
  });
});

describe('la ruta nula', () => {
  it('no pide nada, y no dice que este cargando', async () => {
    const espia = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({})));
    vi.stubGlobal('fetch', espia);

    const { result } = renderHook(() => useUno(null));

    await waitFor(() => {
      expect(result.current).toEqual({ dato: null, cargando: false, error: null, fallo: null });
    });
    expect(espia).not.toHaveBeenCalled();
  });

  it('es como se encadenan dos peticiones sin romper la regla de los hooks', async () => {
    instalarProxyDeDatos();

    // El snapshot necesita el `conjuntoId` que resuelve la otra ruta: hasta que llega, la
    // segunda peticion tiene ruta nula. El hook se llama SIEMPRE, que es lo que la regla exige.
    const { result, rerender } = renderHook(
      ({ conjuntoId }: { conjuntoId: number | null }) =>
        useUno<ConjuntoResource>(conjuntoId === null ? null : RUTAS.conjuntos),
      { initialProps: { conjuntoId: null as number | null } },
    );

    expect(result.current.cargando).toBe(false);

    rerender({ conjuntoId: 2 });
    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });
    expect(result.current.dato).not.toBeNull();
  });
});

describe('el efecto aborta la peticion anterior', () => {
  it('cambiar de ruta cancela la que estaba en camino', async () => {
    const senales: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((_entrada, opciones) => {
        if (opciones?.signal) senales.push(opciones.signal);
        return new Promise(() => {
          /* nunca contesta: es la peticion que se queda en camino */
        });
      }),
    );

    const { rerender } = renderHook(({ ruta }: { ruta: string }) => useUno(ruta), {
      initialProps: { ruta: '/seguridad/parametros/ejercicios/2026' },
    });
    rerender({ ruta: '/seguridad/parametros/ejercicios/2027' });

    await waitFor(() => {
      expect(senales).toHaveLength(2);
    });
    // Sin esto, elegir tres ediciones seguidas deja tres peticiones vivas y la que pinta la
    // ficha es la que conteste ultima, que no tiene por que ser la de la edicion elegida.
    expect(senales[0]?.aborted).toBe(true);
    expect(senales[1]?.aborted).toBe(false);
  });

  it('y abortar no dibuja un error: la pantalla ya no queria esa respuesta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        (_entrada, opciones) =>
          new Promise((_listo, falla) => {
            opciones?.signal?.addEventListener('abort', () => {
              falla(new DOMException('abortada', 'AbortError'));
            });
          }),
      ),
    );

    const { result, rerender } = renderHook(({ ruta }: { ruta: string }) => useUno(ruta), {
      initialProps: { ruta: '/seguridad/parametros/ejercicios/2026' },
    });
    rerender({ ruta: '/seguridad/parametros/ejercicios/2027' });

    await waitFor(() => {
      expect(result.current.cargando).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });
});

describe('useLista y useCalculo devuelven el mismo tipo', () => {
  it('useLista saca el contenido del envoltorio de paginacion', async () => {
    instalarProxyDeDatos();

    const { result } = renderHook(() => useLista<ConjuntoResource>(RUTAS.conjuntos));

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });
    expect(result.current.dato).toHaveLength(3);
    expect(result.current.dato?.[0]?.estado).toBe('ABIERTO');
  });

  it('useCalculo pide por POST, que es como viajan las tres escrituras simuladas', async () => {
    instalarProxyDeDatos();

    // Sin cuerpo: `pedirCalculo` no manda ninguno, asi que la escritura contesta la negativa de
    // la regla 10. Que sea justo esa es la comprobacion: el verbo llego.
    const { result } = renderHook(() => useCalculo('/ediciones'));

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });
    expect(result.current.error).toContain('VALIDACION (422)');
  });
});
