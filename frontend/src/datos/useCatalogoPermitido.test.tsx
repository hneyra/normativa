import { TEXTOS_DE_LA_ESCALERA, peldanoDe } from '@kamayuk/sesion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NADIE_CONTESTA,
  contestarLaSeguridad,
  type LecturaDeSeguridad,
} from '../../verificaciones/la-seguridad-contestada.ts';
import { MODULOS_MEDIDOS } from './seguridadMedida.ts';
import { FRASES_DEL_CATALOGO, useCatalogoPermitido, useLaSesion } from './useCatalogoPermitido.ts';

/**
 * **Ante cualquier fallo de las tres lecturas, no se ofrece NADA** (#64, AC 3 y AC 4).
 *
 * `permisos.test.ts` prueba la composicion con respuestas ya llegadas. Esto prueba lo que
 * `componer` no puede ver: que una de las tres **no llegue**. Es donde vive el agujero que este
 * issue cierra —ofrecer el catalogo entero porque la matriz no contesto convierte un problema de red
 * en uno de autorizacion—, y por eso se prueba **cada una de las tres por separado**, con las otras
 * dos contestando bien: con las tres cayendo a la vez, un gancho que solo mirase una pasaria.
 *
 * Las respuestas buenas son las capturas de `docs/50-api/seguridad/` (`la-seguridad-contestada.ts`);
 * los fallos, un corte de red y un 500.
 */

/** Un proveedor con una cache NUEVA por prueba: la de la aplicacion es de modulo y se heredaria. */
function conUnaCacheNueva() {
  const consultas = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={consultas}>{children}</QueryClientProvider>
  );
}

function elCatalogo() {
  return renderHook(() => useCatalogoPermitido(), {
    wrapper: conUnaCacheNueva(),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('el catalogo de la sesion: cuatro estados, y solo uno ofrece algo', () => {
  it('EL CENTINELA: con las tres contestadas, se compone NORMATIVA', async () => {
    // Sin esta mitad, las de abajo pasarian con un gancho que no ofreciera nada nunca.
    contestarLaSeguridad();
    const { result } = elCatalogo();

    await waitFor(() => {
      expect(result.current.estado).toBe('compuesto');
    });
    expect(result.current.catalogo.map((m) => m.clave)).toEqual(['normativa']);
    expect(result.current.porQue).toBe('');
  });

  it('mientras se pide NO se ofrece nada: ni el catalogo entero «mientras llega»', () => {
    contestarLaSeguridad();
    const { result } = elCatalogo();

    expect(result.current.estado).toBe('pidiendo');
    expect(result.current.catalogo).toEqual([]);
    expect(result.current.porQue).toBe(FRASES_DEL_CATALOGO.pidiendo);
  });
});

describe('ante cualquier fallo de las tres lecturas, NO se ofrece nada', () => {
  const LAS_TRES: readonly LecturaDeSeguridad[] = [
    'GET /seguridad/modulos',
    'GET /seguridad/accesos',
    'GET /seguridad/sesion/permisos',
  ];
  const casos = LAS_TRES.flatMap((operacion) => [
    { operacion, como: 'sin red', contestacion: { sinRed: true } as const },
    { operacion, como: 'un 500', contestacion: { estado: 500 } },
  ]);

  it.each(casos)('«$operacion» con $como, y las otras dos bien', async ({ operacion, contestacion }) => {
    contestarLaSeguridad({ [operacion]: contestacion });
    const { result } = elCatalogo();

    await waitFor(() => {
      expect(result.current.estado).not.toBe('pidiendo');
    });
    expect(
      result.current.catalogo,
      `con «${operacion}» caida se ofrecio el catalogo: un problema de red convertido en un agujero ` +
        'de autorizacion.',
    ).toEqual([]);
    expect(result.current.estado).toBe('error');
    expect(result.current.porQue).toBe(FRASES_DEL_CATALOGO.error);
  });

  it('y el porque lleva DEBAJO lo que dice la escalera, sin traduccion paralela', async () => {
    contestarLaSeguridad({ 'GET /seguridad/sesion/permisos': { sinRed: true } });
    const { result } = elCatalogo();

    await waitFor(() => {
      expect(result.current.estado).toBe('error');
    });
    const peldano = peldanoDe(NADIE_CONTESTA);
    expect(result.current.detalle).toEqual([peldano.titulo, peldano.detalle, peldano.remedio]);
  });

  it('un 403 de la matriz es «falta un permiso», no una averia', async () => {
    contestarLaSeguridad({ 'GET /seguridad/sesion/permisos': { estado: 403 } });
    const { result } = elCatalogo();

    await waitFor(() => {
      expect(result.current.estado).toBe('error');
    });
    expect(result.current.catalogo).toEqual([]);
    // El arnes contesta el 403 con `codigo: SIN_PRIVILEGIO`, como el guardia del backend.
    expect(result.current.detalle[0]).toBe(TEXTOS_DE_LA_ESCALERA.faltaUnPermiso);
  });

  it('y una respuesta de modulos ROTA tampoco ofrece nada, y dice cual', async () => {
    // Un `[]` pelado donde el contrato promete una pagina: lo que devolveria un proxy mal puesto.
    contestarLaSeguridad({ 'GET /seguridad/modulos': { estado: 200, cuerpo: MODULOS_MEDIDOS.contenido } });
    const { result } = elCatalogo();

    await waitFor(() => {
      expect(result.current.estado).toBe('error');
    });
    expect(result.current.catalogo).toEqual([]);
    expect(result.current.rotas).toEqual(['GET /seguridad/modulos']);
    expect(result.current.porQue).toContain('GET /seguridad/modulos');
  });
});

describe('una cuenta que no puede nada NO es un error: se dice, con lo que le falta', () => {
  it('con la matriz vacia, `sin-permiso`, y el modulo que no puede abrir por su nombre', async () => {
    contestarLaSeguridad({ 'GET /seguridad/sesion/permisos': { estado: 200, cuerpo: {} } });
    const { result } = elCatalogo();

    await waitFor(() => {
      expect(result.current.estado).toBe('sin-permiso');
    });
    expect(result.current.catalogo).toEqual([]);
    expect(result.current.porQue).toBe(FRASES_DEL_CATALOGO.sinPermiso);
    expect(result.current.detalle).toEqual([
      FRASES_DEL_CATALOGO.loQueFalta.replace('{{modulos}}', 'Normativa'),
    ]);
  });

  it('y con la que solo lee `parametros`, lo mismo', async () => {
    contestarLaSeguridad({
      'GET /seguridad/sesion/permisos': { estado: 200, cuerpo: { parametros: ['lectura'] } },
    });
    const { result } = elCatalogo();

    await waitFor(() => {
      expect(result.current.estado).toBe('sin-permiso');
    });
    expect(result.current.sinPermiso).toEqual(['NORMATIVA']);
  });
});

describe('las dos lecturas de la barra van por su cuenta', () => {
  it('contestadas, dicen quien es y de donde', async () => {
    contestarLaSeguridad();
    const { result } = renderHook(() => useLaSesion(), { wrapper: conUnaCacheNueva() });

    await waitFor(() => {
      expect(result.current.quien.estado).toBe('lista');
      expect(result.current.donde.estado).toBe('lista');
    });
  });

  it('y si una cae, cae sola: el catalogo se compone igual', async () => {
    // La barra dice el peldano en el sitio del nombre; lo que la cuenta puede abrir lo decide la
    // matriz, no quien es.
    contestarLaSeguridad({ 'GET /seguridad/sesion': { estado: 500 } });
    const envoltorio = conUnaCacheNueva();
    const { result } = renderHook(
      () => ({ sesion: useLaSesion(), catalogo: useCatalogoPermitido() }),
      { wrapper: envoltorio },
    );

    await waitFor(() => {
      expect(result.current.sesion.quien.estado).toBe('fallo');
      expect(result.current.catalogo.estado).toBe('compuesto');
    });
    expect(result.current.sesion.donde.estado).toBe('lista');
  });
});
