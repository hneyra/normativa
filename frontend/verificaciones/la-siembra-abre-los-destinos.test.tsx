import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { sembrarElCatalogo } from '../desarrollo/sembrarElCatalogo.ts';
import { MUNICIPALIDAD_MEDIDA } from '../desarrollo/sesionMedida.ts';
import { Aplicacion } from '../src/aplicacion.tsx';
import { arrancar } from '../src/arranque.ts';
import { CATALOGO } from '../src/catalogo.ts';
import { CONSULTAS } from '../src/datos/proveedor.tsx';
import { MODULOS_MEDIDOS } from '../src/datos/seguridadMedida.ts';
import { FRASES_DEL_CATALOGO, LLAVES } from '../src/datos/useCatalogoPermitido.ts';
import type { ClaveDeHoja } from '../src/pantallas/arbol.ts';
import { pantallaDe } from '../src/pantallas/definiciones/index.ts';
import { identidad } from '../src/sesion.ts';
import { artboardDeclarado } from './artboards.ts';
import { NADIE_CONTESTA, deSeguridad } from './la-seguridad-contestada.ts';

/**
 * **La siembra abre los cuatro destinos sin que nadie conteste** (#64, AC 6 y AC 7).
 *
 * Calcado de `rentas/frontend/verificaciones/la-siembra-abre-los-destinos.test.tsx@ac379ac`
 * (`rentas`#114), con **los cuatro destinos como dato** —todos los del catalogo, que aqui son
 * cuatro y no cuarenta— y las cinco lecturas de `/seguridad` sembradas, no tres.
 *
 * <h2>Que anade a `los-cuatro-destinos-se-recorren.test.tsx`, que ya los recorre</h2>
 *
 * Aquella **contesta las cinco de seguridad con un doble de `fetch`**: mide que la cadena
 * permisos → catalogo → ruta → pantalla funciona cuando el backend contesta. Esta mide lo otro: que
 * funcione **cuando no contesta nadie**, que es el estado de un puesto de desarrollo sin plataforma.
 *
 * La diferencia esta en el doble: aqui `fetch` **rechaza todo**. Si la siembra no pusiera el dato
 * donde las consultas lo buscan —o lo pusiera rancio, y salieran a refrescarlo—, no habria arbol y
 * no abriria ni un destino.
 *
 * <h2>Y se cuentan las peticiones, que es la mitad que no se ve mirando la pantalla</h2>
 *
 * Una siembra que dejara el dato rancio **dibujaria el arbol igual** durante un instante y despues
 * lo perderia. Contar las idas a `/seguridad/{modulos,accesos,sesion…}` distingue «sembrado» de
 * «sembrado y encima pedido». **Y solo esas cinco**: el Panel lee `/seguridad/parametros…`, que es
 * lectura de HOJA, y esa tiene que seguir saliendo.
 */

beforeAll(() => {
  // Lo que jsdom no trae y las piezas del armazon piden. Sus motivos, en `@kamayuk/shell`.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  globalThis.matchMedia ??= ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof matchMedia;
});

/** Los destinos que la siembra tiene que abrir: TODOS los del catalogo, sacados de el. */
const DESTINOS = CATALOGO.flatMap((modulo) =>
  modulo.destinos.map((destino) => ({ clave: destino.clave, slug: destino.slug ?? destino.clave })),
);

/** Las URL que se pidieron. Vacia de `/seguridad` es la mitad de lo que esta prueba afirma. */
let pedidas: string[] = [];

beforeEach(() => {
  // La cache es de MODULO y sobrevive a cada `render`: sin limpiarla, la segunda prueba leeria lo
  // que sembro la primera. Y los valores por omision de la rama TAMBIEN sobreviven a `clear()`: se
  // devuelven a nada, o el centinela de abajo dependeria del orden en que corren las pruebas.
  CONSULTAS.clear();
  CONSULTAS.setQueryDefaults(LLAVES.rama, {});
  pedidas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((entrada) => {
      pedidas.push(String(entrada));
      // **Nadie contesta**, que es el estado que esta prueba mide: sin PostgreSQL, sin Keycloak,
      // sin Traefik y sin backend, el navegador no recibe una respuesta — recibe un rechazo.
      return Promise.reject(NADIE_CONTESTA);
    }),
  );
  // La siembra lo dice por la consola, a proposito y en voz alta. Aqui se escucha, y se comprueba.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.location.hash = '';
});

/** Monta la aplicacion en un destino y espera al armazon, que no existe hasta que hay arbol. */
async function abrir(slug: string) {
  window.location.hash = `#/${slug}`;
  render(<Aplicacion />);
  await waitFor(() => {
    expect(document.querySelector('[data-slot="barra-global"]')).not.toBeNull();
  });
}

describe('con el catalogo sembrado, la interfaz se recorre sin backend', () => {
  it('EL CENTINELA: sin sembrar NO abre nada, y ese es el hueco que la siembra cierra', async () => {
    // Sin esta mitad, la prueba de abajo pasaria igual con una siembra que no hiciera nada: con el
    // catalogo llegando de otro sitio, el verde no diria de donde salio el arbol.
    render(<Aplicacion />);

    await waitFor(() => {
      expect(screen.getByText(FRASES_DEL_CATALOGO.error)).toBeTruthy();
    });
    expect(document.querySelector('[data-slot="barra-global"]')).toBeNull();
    // Y hay cuatro destinos que recorrer: con un catalogo vacio el `it.each` no tendria casos.
    expect(DESTINOS).toHaveLength(artboardDeclarado('NormativaV8.dc.html').cuentas?.hojas ?? 0);
  });

  it.each(DESTINOS)('sembrado, «$clave» abre con su titulo y sus bloques', async (destino) => {
    sembrarElCatalogo();
    await abrir(destino.slug);
    const definicion = pantallaDe(destino.clave as ClaveDeHoja);
    const rotulo = CATALOGO.flatMap((m) => m.destinos).find((d) => d.clave === destino.clave)?.rotulo;

    expect(
      screen.getByRole('heading', { level: 1, name: rotulo }),
      `«${destino.clave}» no abrio por su hash`,
    ).toBeTruthy();
    for (const bloque of definicion.bloques) {
      expect(
        screen.getByRole('heading', { level: 2, name: bloque.titulo }),
        `«${destino.clave}» no pinto el bloque «${bloque.titulo}»`,
      ).toBeTruthy();
    }
  });

  it('y el carril ofrece el modulo con el rotulo que trae la captura, y la barra su municipalidad', async () => {
    sembrarElCatalogo();
    await abrir('panel');

    const normativa = MODULOS_MEDIDOS.contenido.find((m) => m.codigo === 'NORMATIVA');
    expect(normativa, 'la captura ya no publica NORMATIVA').toBeDefined();
    expect(screen.getAllByRole('button', { name: new RegExp(normativa?.nombre ?? '$^') }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(MUNICIPALIDAD_MEDIDA.nombre).length).toBeGreaterThan(0);
  });

  it('NO se pide ni una de las cinco de `/seguridad`: sembrado es sembrado', async () => {
    sembrarElCatalogo();
    await abrir('panel');

    expect(
      deSeguridad(pedidas),
      'La siembra dejo el dato rancio: las consultas salieron a refrescarlo, y sin backend eso las\n' +
        'pone en error aunque conserven el dato — o sea el mensaje que la siembra vino a quitar.',
    ).toEqual([]);
  });

  it('pero las hojas que SI piden siguen pidiendo, y fallando de verdad', async () => {
    // Lo que NO entra: sembrar datos de hoja. El Panel sale a la red —`/seguridad/parametros…`, que
    // NO es una de las cinco—, no encuentra a nadie y ensena su estado de error. Si esto dejara de
    // pedir, la siembra habria pasado de sembrar el catalogo a sembrar la interfaz entera, que es el
    // proxy de datos de la V6 otra vez.
    sembrarElCatalogo();
    await abrir('panel');

    await waitFor(() => {
      expect(pedidas.some((url) => url.includes('/seguridad/parametros'))).toBe(true);
    });
  });

  it('y lo dice por la consola, en voz alta: una interfaz entera sin backend se confunde facil', () => {
    sembrarElCatalogo();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('EL CATALOGO ESTA SEMBRADO'));
  });
});

describe('`arrancar` con la bandera: siembra, esquiva la puerta y monta', () => {
  it('con `VITE_KAMAYUK_SIN_PLATAFORMA=true` en desarrollo, no va a Keycloak', async () => {
    // Es `yarn dev` a secas: sin esto la bandera podria sembrar y la puerta seguir mandando a un
    // Keycloak que no esta — y lo que se veria es la puerta caida, no las hojas.
    vi.stubEnv('VITE_KAMAYUK_SIN_PLATAFORMA', 'true');
    const entrar = vi.spyOn(identidad, 'entrar');
    const montar = vi.fn();

    await arrancar(montar);

    expect(montar).toHaveBeenCalledTimes(1);
    expect(entrar).not.toHaveBeenCalled();
    expect(CONSULTAS.getQueryData(LLAVES.modulos)).toEqual(MODULOS_MEDIDOS);
  });
});
