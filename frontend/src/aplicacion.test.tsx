import { TEXTOS_DEL_ARMAZON } from '@kamayuk/shell';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MUNICIPALIDAD_MEDIDA, SESION_MEDIDA } from '../desarrollo/sesionMedida.ts';
import { LITERALES_DE_SESION } from '../verificaciones/artboards.ts';
import { contestarLaSeguridad } from '../verificaciones/la-seguridad-contestada.ts';
import { Aplicacion } from './aplicacion.tsx';
import { CONSULTAS } from './datos/proveedor.tsx';
import { FRASES_DEL_CATALOGO } from './datos/useCatalogoPermitido.ts';
import { TITULO } from './marca.ts';
import { inicialesDe } from './sesion.ts';

/**
 * **El `Armazon` se monta, y con UN solo React** (#55) — **cuando la cuenta ya puede abrir algo** (#64).
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
 * <h2>Desde #64 el armazon ESPERA, y se mide</h2>
 *
 * Las cinco de `/seguridad` las contesta `la-seguridad-contestada.ts` con las capturas del backend;
 * las hojas no reciben respuesta, como antes. Y lo que se dibuja en la barra —la entidad y la
 * cuenta— se compara con **lo que contesto la sesion**, no con un literal de aqui.
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

beforeEach(() => {
  // La cache es de MODULO: sin limpiarla, cada prueba leeria lo que contesto la anterior.
  CONSULTAS.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  // El tema se estampa en `<html>`, que Testing Library no limpia entre pruebas.
  document.documentElement.removeAttribute('data-tema');
  document.documentElement.removeAttribute('data-modo');
  window.location.hash = '';
});

/** Cada nodo de texto del arbol, recortado. */
function textosDe(raiz: HTMLElement): readonly string[] {
  const paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const trozos: string[] = [];
  for (let nodo = paseo.nextNode(); nodo !== null; nodo = paseo.nextNode()) {
    const texto = (nodo.textContent ?? '').trim();
    if (texto !== '') trozos.push(texto);
  }
  return trozos;
}

/** Monta la aplicacion con la seguridad contestada y espera a la barra, que no existe antes. */
async function montar(hash = ''): Promise<void> {
  window.location.hash = hash;
  contestarLaSeguridad();
  render(<Aplicacion />);
  await screen.findByText(MUNICIPALIDAD_MEDIDA.nombre);
}

describe('la aplicacion monta el Armazon con lo que la sesion contesta', () => {
  it('dibuja el titulo que decidio G2, y lo toma de `src/marca.ts`', async () => {
    await montar();

    expect(screen.getByText(TITULO)).toBeInTheDocument();
  });

  it('la entidad es la municipalidad que CONTESTO la sesion, y ninguna otra (G2)', async () => {
    await montar();

    // La negativa de G2, medida sobre el DOM: todo nombre de municipalidad que se lea en la pagina
    // es el de la sesion. «Catacaos» es la que la V6 llevaba escrita a mano
    // (`c01fe9a:src/marco/Marco.tsx:43`), y la que `rentas` tuvo hasta su I-1.
    //
    // Nodo de texto a nodo de texto, y no sobre `textContent`: ahi el titulo y la entidad salen
    // pegados —«…MunicipalesMunicipalidad…»— y la forma, que empieza en un limite de palabra, no
    // encontraria nada. Medido: con `textContent`, cero hallazgos y la prueba en rojo por su arnes.
    const forma = LITERALES_DE_SESION[0]?.[0];
    if (forma === undefined) throw new Error('`LITERALES_DE_SESION` ya no trae la forma de un nombre');
    const nombrados = textosDe(document.body).filter((texto) => forma.test(texto));
    expect(nombrados.length, 'la barra no nombra ninguna municipalidad').toBeGreaterThan(0);
    expect(new Set(nombrados)).toEqual(new Set([MUNICIPALIDAD_MEDIDA.nombre]));
    expect(document.body.textContent ?? '').not.toContain('Catacaos');
  });

  it('y la cuenta, la de la sesion: sus iniciales en el circulo', async () => {
    await montar();

    expect(screen.getAllByText(inicialesDe(SESION_MEDIDA.nombre)).length).toBeGreaterThan(0);
  });

  it('con el tema institucional estampado por la libreria', async () => {
    await montar();

    expect(document.documentElement.getAttribute('data-tema')).toBe('institucional');
  });

  it('sin hash: el marco dice que no hay nada abierto, con sus palabras', async () => {
    await montar();

    // Con `textos` sin pasar, el marco habla con su castellano por omision. Se compara contra la
    // constante de la libreria y no contra una copia: si #60 cambia la frase, lo que tiene que
    // salir rojo es la traduccion, no esto.
    expect(screen.getByText(TEXTOS_DEL_ARMAZON.sinDestinoAbierto)).toBeInTheDocument();
  });

  it('y un hash que no es de ningun destino no abre nada', async () => {
    await montar('#/normativa-ediciones');

    expect(await screen.findByText(TEXTOS_DEL_ARMAZON.destinoNoOfrecido)).toBeInTheDocument();
  });
});

describe('sin las lecturas de `/seguridad` NO hay armazon, y se dice por que (#64, AC 4)', () => {
  it('con nadie contestando, se lee el motivo y no se monta la barra', async () => {
    contestarLaSeguridad({
      'GET /seguridad/modulos': { sinRed: true },
      'GET /seguridad/accesos': { sinRed: true },
      'GET /seguridad/sesion/permisos': { sinRed: true },
    });
    render(<Aplicacion />);

    expect(await screen.findByText(FRASES_DEL_CATALOGO.error)).toBeInTheDocument();
    expect(document.querySelector('[data-slot="barra-global"]')).toBeNull();
    expect(screen.getByRole('alert').getAttribute('data-estado')).toBe('error');
  });

  it('y con una cuenta que no puede nada, lo dice con el motivo: no deja un menu vacio', async () => {
    contestarLaSeguridad({ 'GET /seguridad/sesion/permisos': { estado: 200, cuerpo: {} } });
    render(<Aplicacion />);

    expect(await screen.findByText(FRASES_DEL_CATALOGO.sinPermiso)).toBeInTheDocument();
    expect(document.querySelector('[data-slot="barra-global"]')).toBeNull();
    expect(
      document.querySelector('[data-slot="espera-del-catalogo"]')?.getAttribute('data-estado'),
    ).toBe('sin-permiso');
  });
});
