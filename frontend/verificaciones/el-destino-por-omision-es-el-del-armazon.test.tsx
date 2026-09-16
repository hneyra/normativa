import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Armazon,
  TEXTOS_DEL_ARMAZON,
  slugDe,
  type Catalogo,
  type HojaDelCatalogo,
} from '@kamayuk/shell';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { CATALOGO } from '../src/catalogo.ts';
import { CLAVE_DEL_PANEL, CUENTA, DESTINO_POR_OMISION, SLUG_DEL_PANEL } from '../src/sesion.ts';

/**
 * **El `destinoPorOmision` de la puerta ES el hash con que el armazon abre el Panel** (#57, AC 3).
 *
 * <h2>Por que hace falta medirlo, y no basta con escribirlo</h2>
 *
 * El docblock de `ConfiguracionDeIdentidad.destinoPorOmision` pone de ejemplo `'#nor-panel'`
 * (`kamayuk-lib:paquetes/sesion/identidad.ts:101`) — **el hash de la V6**, que enrutaba con su
 * propio marco. El `Armazon` de `@kamayuk/shell` enruta con `createHashRouter` y escribe `#/<slug>`.
 * Los dos son cadenas parecidas y solo una abre algo.
 *
 * Y el sintoma de equivocarse es de los que no se ven: `destinoPorOmision` es a donde se vuelve
 * **cuando la vuelta no dice a donde**, o sea despues de identificarse entrando por la raiz. Con el
 * valor malo, quien entra aterriza en «ese destino no se ofrece» en vez de en el Panel — una vez, y
 * solo la primera vez, que es la que nadie repite mientras depura.
 *
 * <h2>Como se mide: montando el armazon, no comparando cadenas</h2>
 *
 * Se le da un catalogo con el destino del Panel, se pone el hash en `DESTINO_POR_OMISION` y se mira
 * **que hoja abre**. Comparar `'#/' + slug` contra la constante seria escribir dos veces la misma
 * suposicion.
 *
 * Y con las dos ramas: el hash bueno abre el Panel, y el del ejemplo de la libreria no abre nada.
 * Sin la segunda, una guarda que diera por bueno cualquier hash pasaria igual.
 *
 * <h2>Y que pasa cuando #58 traiga el catalogo de verdad</h2>
 *
 * Que este archivo lo mira: en cuanto `src/catalogo.ts` deje de estar vacio, el ultimo caso compara
 * contra el destino REAL. Si #58 elige otro slug para el Panel, sale rojo aqui — que es donde tiene
 * que salir, porque la puerta se quedaria apuntando a una hoja que ya no existe.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/**
 * Un catalogo con UN destino: el Panel, con la clave y el slug que declara `src/sesion.ts`.
 *
 * Es sintetico a proposito. El de verdad es de #58 y hoy esta vacio; lo que se mide aqui no es el
 * catalogo sino **como el armazon convierte un slug en un hash**, que es lo que la puerta tiene que
 * saber por adelantado.
 */
const CATALOGO_DE_PRUEBA: Catalogo = [
  {
    clave: 'normativa',
    rotulo: 'Normativa',
    nota: 'Parametros sellados y corpus',
    icono: 'balanza',
    destinos: [
      {
        clave: CLAVE_DEL_PANEL,
        slug: SLUG_DEL_PANEL,
        rotulo: 'Panel',
        seEscribe: false,
      },
    ],
  },
];

beforeAll(() => {
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
  window.location.hash = '';
});

/** Monta el armazon con el catalogo de prueba y dice que hoja abrio, si abrio alguna. */
function montarEn(hash: string) {
  window.location.hash = hash;
  let abierta: HojaDelCatalogo | null = null;
  render(
    <Armazon
      titulo="Normativa"
      entidad="Sin sesión"
      catalogo={CATALOGO_DE_PRUEBA}
      cuenta={CUENTA}
      opcionesDeSesion={[]}
      pantalla={(hoja) => {
        abierta = hoja;
        return <div data-slot="hoja-abierta">{hoja.destino.clave}</div>;
      }}
    />,
  );
  return () => abierta;
}

describe('el hash por omision abre el Panel, y el del ejemplo de la libreria no', () => {
  it('con `DESTINO_POR_OMISION` el armazon abre el Panel', async () => {
    const hoja = montarEn(DESTINO_POR_OMISION);

    expect(await screen.findByText(CLAVE_DEL_PANEL)).toBeInTheDocument();
    expect(hoja()?.destino.clave).toBe(CLAVE_DEL_PANEL);
  });

  it('EL CONTRASTE: con `#nor-panel` —el ejemplo de la libreria— no se abre nada', async () => {
    // Es la cadena que el docblock de `@kamayuk/sesion` propone, heredada del enrutado de la V6.
    // Sin esta prueba, una guarda que diera por bueno cualquier hash pasaria en verde con ella.
    montarEn(`#${CLAVE_DEL_PANEL}`);

    expect(await screen.findByText(TEXTOS_DEL_ARMAZON.destinoNoOfrecido)).toBeInTheDocument();
  });

  it('y el hash es el que el armazon escribe para ese slug, no una cadena parecida', () => {
    // La forma canonica de `@kamayuk/shell`: `#/<slug>`, con la barra. `#panel` no es lo mismo.
    expect(DESTINO_POR_OMISION).toBe(`#/${SLUG_DEL_PANEL}`);
    expect(DESTINO_POR_OMISION.startsWith('#/')).toBe(true);
  });
});

describe('el slug del Panel es el del artboard V8, que es donde vive la decision', () => {
  it('`NormativaV8.dc.html` enlaza `nor-panel` como `panel`', () => {
    const artboard = readFileSync(join(FRONTEND, 'diseno/NormativaV8.dc.html'), 'utf8');
    const slugs = /const SLUGS = \{([^}]*)\}/.exec(artboard)?.[1] ?? '';

    expect(slugs, 'no se encontro `const SLUGS` en el artboard V8').not.toBe('');
    expect(slugs).toContain(`'${CLAVE_DEL_PANEL}': '${SLUG_DEL_PANEL}'`);
  });
});

describe('y cuando #58 traiga el catalogo de verdad, tiene que decir lo mismo', () => {
  it('el catalogo o esta vacio —hasta #58— o declara el Panel con este slug', () => {
    if (CATALOGO.length === 0) {
      // Es el estado de #55: el armazon dibuja su carril sin modulos. No se omite la prueba —una
      // que se salta a si misma deja el build en verde sin haber verificado nada—: se afirma el
      // estado que de verdad hay.
      expect(CATALOGO).toEqual([]);
      return;
    }

    const panel = CATALOGO.flatMap((modulo) => modulo.destinos).find(
      (destino) => destino.clave === CLAVE_DEL_PANEL,
    );

    expect(
      panel,
      `El catalogo ya no esta vacio y no declara «${CLAVE_DEL_PANEL}». La puerta vuelve a\n` +
        `«${DESTINO_POR_OMISION}» cuando la vuelta no dice a donde, asi que esa hoja tiene que\n` +
        'existir: si no, quien se identifica entrando por la raiz aterriza en «destino no ofrecido».',
    ).toBeDefined();

    expect(
      panel === undefined ? '' : `#/${slugDe(panel)}`,
      'El slug del Panel cambio y `src/sesion.ts` no se entero: `SLUG_DEL_PANEL` y el catalogo\n' +
        'tienen que decir lo mismo, o la puerta apunta a una hoja que no existe.',
    ).toBe(DESTINO_POR_OMISION);
  });
});
