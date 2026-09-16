import { TEXTOS_DEL_ARMAZON } from '@kamayuk/shell';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Aplicacion } from './aplicacion.tsx';
import { TITULO } from './marca.ts';
import { CUENTA, ENTIDAD } from './sesion.ts';

/**
 * **El `Armazon` vacio se monta, y con UN solo React** (#55).
 *
 * <h2>Lo que esto mide que ninguna otra prueba mide</h2>
 *
 * Que la costura de `aplicacion.tsx` llega a dibujarse con las piezas de la libreria. Las guardas
 * del enlace dicen que el `link:` esta y que resuelve; esta **ejecuta** un gancho de `@kamayuk/ui`
 * —`ProveedorDeTema`— y el enrutado de `@kamayuk/shell` dentro del React de ESTE frontend. Sin el
 * `resolve.dedupe` de `vitest.config.ts`, las piezas de la libreria cargan React desde el clon
 * hermano y el primer gancho revienta con «Cannot read properties of null (reading 'useState')»,
 * o no lo encuentran en absoluto —«Failed to resolve import "react/jsx-dev-runtime"»— si el
 * hermano no tiene `node_modules`, que es como esta en la CI (`rentas`#88).
 *
 * <h2>Y que lo dibujado sale de las costuras, no de aqui</h2>
 *
 * Los valores se importan de `marca.ts` y de `sesion.ts` en vez de escribirse otra vez: una prueba
 * que repitiera el titulo comprobaria que dos literales coinciden, y seguiria en verde con los dos
 * cambiados a la vez. Lo que se afirma es que **lo que la costura dice es lo que la barra dibuja**.
 *
 * Lo unico que SI se escribe aqui es la negativa: que la barra no lleva el nombre de ninguna
 * municipalidad. Esa no se puede derivar de la costura —seria preguntarle a la costura si la
 * costura esta bien— y es la decision G2 (#52) puesta a prueba sobre el DOM.
 */

beforeAll(() => {
  // Lo que jsdom no trae y las piezas del armazon piden —`sonner`, bajo los avisos del marco,
  // pide `matchMedia` al montarse—. El mismo relleno que usan las pruebas del armazon en `rentas`.
  Element.prototype.scrollIntoView = () => {};
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

afterEach(() => {
  // El tema se estampa en `<html>`, que Testing Library no limpia entre pruebas.
  document.documentElement.removeAttribute('data-tema');
  document.documentElement.removeAttribute('data-modo');
  window.location.hash = '';
});

describe('la aplicacion monta el Armazon vacio', () => {
  it('dibuja el titulo que decidio G2, y lo toma de `src/marca.ts`', () => {
    render(<Aplicacion />);

    expect(screen.getByText(TITULO)).toBeInTheDocument();
  });

  it('y la entidad y la cuenta salen de `src/sesion.ts`, que no nombra ninguna municipalidad', () => {
    render(<Aplicacion />);

    expect(screen.getAllByText(ENTIDAD).length).toBeGreaterThan(0);
    expect(screen.getAllByText(CUENTA.iniciales).length).toBeGreaterThan(0);

    // La negativa de G2, medida sobre el DOM y no sobre un archivo: la barra de una instalacion
    // cualquiera no puede nombrar la municipalidad de otra. «Catacaos» es la que la V6 llevaba
    // escrita a mano (`c01fe9a:src/marco/Marco.tsx:43`), y la que `rentas` tuvo hasta su I-1.
    expect(document.body.textContent ?? '').not.toContain('Municipalidad');
    expect(document.body.textContent ?? '').not.toContain('Catacaos');
  });

  it('con el tema institucional estampado por la libreria', () => {
    render(<Aplicacion />);

    expect(document.documentElement.getAttribute('data-tema')).toBe('institucional');
  });

  it('sin un solo destino: el marco dice que no hay nada abierto, con sus palabras', () => {
    render(<Aplicacion />);

    // Con `textos` sin pasar, el marco habla con su castellano por omision. Se compara contra la
    // constante de la libreria y no contra una copia: si #60 cambia la frase, lo que tiene que
    // salir rojo es la traduccion, no esto.
    expect(screen.getByText(TEXTOS_DEL_ARMAZON.sinDestinoAbierto)).toBeInTheDocument();
  });

  it('y un hash cualquiera no abre nada: el catalogo vacio no ofrece ni un destino', async () => {
    window.location.hash = '#/normativa-ediciones';
    render(<Aplicacion />);

    expect(await screen.findByText(TEXTOS_DEL_ARMAZON.destinoNoOfrecido)).toBeInTheDocument();
  });
});
