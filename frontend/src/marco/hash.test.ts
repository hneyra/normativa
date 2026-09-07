import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARBOL, SECCIONES } from './arbol.ts';
import { destinoDeSlug, destinoDelHash, marcarHash, slugDe } from './hash.ts';

/**
 * AC5 — el enrutado por hash, por la parte que se puede razonar sola.
 *
 * Lo que se prueba aqui es la traduccion en las dos direcciones y **el verbo del
 * historial**. Que la pantalla reaccione al `hashchange` y que recargar sobre `#cuadros`
 * reabra la seccion se prueba en `Marco.test.tsx`, montando el marco: son afirmaciones
 * sobre el componente, no sobre la funcion.
 */

const limpiarElHash = () => {
  window.history.replaceState(null, '', '/');
};

beforeEach(limpiarElHash);
afterEach(() => {
  vi.restoreAllMocks();
  limpiarElHash();
});

describe('los cuarenta destinos tienen slug, y solo uno', () => {
  const destinos = ARBOL.flatMap((modulo) => modulo.submodulos.map((hoja) => hoja.clave));

  it.each(destinos)('«%s» va y vuelve', (destino) => {
    const slug = slugDe(destino);

    expect(slug).not.toBeNull();
    expect(destinoDeSlug(slug as string)).toBe(destino);
  });

  it('ningun slug se repite: dos destinos con el mismo hash serian uno solo', () => {
    const slugs = destinos.map((destino) => slugDe(destino));

    expect(new Set(slugs).size).toBe(40);
  });

  it('las cuatro secciones propias llevan el suyo, que no es su clave', () => {
    expect(SECCIONES.map((seccion) => [seccion.clave, slugDe(seccion.clave)])).toEqual([
      ['nor-panel', 'panel'],
      ['nor-ediciones', 'ediciones'],
      ['nor-cuadros', 'cuadros'],
      ['nor-publicacion', 'publicacion'],
    ]);
  });

  it('lo que no es un destino no tiene slug, y un slug inventado no abre nada', () => {
    expect(slugDe('lo-que-sea')).toBeNull();
    expect(destinoDeSlug('lo-que-sea')).toBeNull();
    // `normativa` es la clave de un MODULO, no de un submodulo: no se abre.
    expect(destinoDeSlug('normativa')).toBeNull();
  });
});

describe('AC5 — se escribe con replaceState, jamas con pushState', () => {
  it('marcar el hash reemplaza la entrada del historial', () => {
    const reemplazar = vi.spyOn(window.history, 'replaceState');
    const apilar = vi.spyOn(window.history, 'pushState');

    marcarHash('nor-cuadros');

    expect(reemplazar).toHaveBeenCalledWith(null, '', '#cuadros');
    expect(
      apilar,
      'Con `pushState`, el «atras» del navegador tendria que pulsarse una vez por cada\n' +
        'pestana abierta para salir de la aplicacion, y ademas el salto de desplazamiento\n' +
        'que provoca asignar `location.hash` volveria a aparecer.',
    ).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#cuadros');
  });

  it('marcar el hash que ya esta puesto no toca el historial', () => {
    window.history.replaceState(null, '', '#cuadros');
    const reemplazar = vi.spyOn(window.history, 'replaceState');

    marcarHash('nor-cuadros');

    expect(reemplazar).not.toHaveBeenCalled();
  });

  it('un destino que no existe no escribe nada', () => {
    const reemplazar = vi.spyOn(window.history, 'replaceState');

    marcarHash('lo-que-sea');

    expect(reemplazar).not.toHaveBeenCalled();
  });

  it('si el navegador no deja escribir el historial, la pantalla sigue', () => {
    // Pasa de verdad: un `iframe` de otro origen lanza `SecurityError`. El hash es una
    // comodidad —la URL deja de ser enlazable— y no la fuente de verdad del estado, asi que
    // no puede tumbar nada.
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => {
      marcarHash('nor-panel');
    }).not.toThrow();
  });
});

describe('AC5 — el hash de partida', () => {
  it('«#cuadros» pide la seccion de los tres cuadros', () => {
    window.history.replaceState(null, '', '#cuadros');

    expect(destinoDelHash()).toBe('nor-cuadros');
  });

  it('el de una hoja ajena tambien', () => {
    window.history.replaceState(null, '', '#coa-exp');

    expect(destinoDelHash()).toBe('coa-exp');
  });

  it('sin hash, y con un hash que no abre nada, no se pide ningun destino', () => {
    expect(destinoDelHash()).toBeNull();

    window.history.replaceState(null, '', '#lo-que-sea');
    expect(destinoDelHash()).toBeNull();
  });
});
