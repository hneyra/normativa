import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Aplicacion } from '../src/aplicacion.tsx';
import { CATALOGO } from '../src/catalogo.ts';
import { pantallaDe } from '../src/pantallas/definiciones/index.ts';
import type { ClaveDeHoja } from '../src/pantallas/arbol.ts';
import { artboardDeclarado } from './artboards.ts';

/**
 * **Los cuatro destinos se abren, en la aplicacion de verdad** (#58, AC 7).
 *
 * <h2>Que mide esto que ninguna otra prueba mide</h2>
 *
 * Monta **la aplicacion entera** y llega a cada destino **por su hash**, que es como se llega de
 * verdad. Montar la pantalla suelta no comprueba que el destino este en el catalogo, ni que el
 * armazon sepa enrutarlo, ni que la hoja y su definicion sigan emparejadas. Las tres cosas pueden
 * romperse sin tocar una sola definicion — y las tres dejan la aplicacion sin ese destino mientras
 * las pruebas de las definiciones siguen en verde.
 *
 * Y de cada uno se exige algo que **solo aparece con su definicion puesta**: su `h1`, su instruccion
 * y el `h2` de **todos** sus bloques. Un armazon que enrutara bien y dibujara un marco vacio pasaria
 * un «no reventó»; no pasa esto.
 *
 * <h2>Lo que NO entra, y de quien es</h2>
 *
 * **Los permisos.** La de `rentas` contesta a las tres de seguridad con `seguridadMedida.ts` y mide
 * que lo que la cuenta no puede abrir no se abre ni por su hash. Aqui el catalogo **no se filtra
 * todavia**: es #64, y `src/sesion.ts` no tiene sesion que consultar. Cuando llegue, esa mitad se
 * anade aqui.
 *
 * Tampoco se dobla ningun `fetch`: ninguna hoja pide nada hasta #63, asi que no hay respuesta que
 * dar y montar la aplicacion no hace ni una peticion.
 */

const DESTINOS = CATALOGO.flatMap((modulo) =>
  modulo.destinos.map((destino) => ({ modulo: modulo.rotulo, destino })),
);

beforeAll(() => {
  // Lo que jsdom no trae y las piezas del armazon piden. Sus motivos, en `@kamayuk/shell`; es el
  // mismo relleno que ya usa `src/aplicacion.test.tsx`.
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

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-tema');
  document.documentElement.removeAttribute('data-modo');
  window.location.hash = '';
});

/** Monta la aplicacion con el hash ya puesto, que es como se llega por un enlace. */
function abrir(slug: string): void {
  window.location.hash = `#/${slug}`;
  render(<Aplicacion />);
}

/**
 * Si el armazon esta diciendo que ahi no hay destino, de cualquiera de sus dos formas.
 *
 * Por `data-slot` y no por texto: las frases viven en `@kamayuk/shell` y #60 va a traducirlas. Una
 * prueba de este repositorio atada a las palabras de otro se rompe cada vez que aquel las toque, y
 * el rojo hablaria de una cadena en vez de de la propiedad — que es «no se queda mudo».
 */
function elArmazonLoDice(): boolean {
  return (
    document.querySelector('[data-slot="sin-destino"]') !== null ||
    document.querySelector('[data-slot="destino-no-ofrecido"]') !== null
  );
}

/** Una instruccion lleva parentesis y puntos: sin escapar, la expresion regular no casa. */
function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('los cuatro destinos se recorren, en la aplicacion montada', () => {
  it('EL CENTINELA: el catalogo trae los modulos y destinos que declara el artboard', () => {
    // Sin esto, un catalogo vacio dejaria el `it.each` de abajo sin casos y el archivo en verde
    // habiendo recorrido cero pantallas. Es la forma en que `rentas` se quedo sin guarda dos veces
    // (#78, #80). Las cuentas salen de `artboards.ts` y no de dos numeros escritos aqui.
    const cuentas = artboardDeclarado('NormativaV8.dc.html').cuentas;
    expect(cuentas, '`artboards.ts` no declara las cuentas del artboard').toBeDefined();
    expect(CATALOGO).toHaveLength(cuentas?.modulos ?? 0);
    expect(DESTINOS).toHaveLength(cuentas?.hojas ?? 0);
  });

  it.each(DESTINOS)('«$destino.clave» — $destino.rotulo', ({ destino }) => {
    abrir(destino.slug ?? destino.clave);
    const definicion = pantallaDe(destino.clave as ClaveDeHoja);

    expect(
      screen.getByRole('heading', { level: 1, name: destino.rotulo }),
      `«${destino.clave}» no abrio por su hash`,
    ).toBeTruthy();
    expect(
      screen.getByText(new RegExp(escapar(definicion.instruccion))),
      `«${destino.clave}» no dibujo su instruccion`,
    ).toBeTruthy();
    for (const bloque of definicion.bloques) {
      expect(
        screen.getByRole('heading', { level: 2, name: bloque.titulo }),
        `«${destino.clave}» no pinto el bloque «${bloque.titulo}»`,
      ).toBeTruthy();
    }
  });

  it('un hash que no es de ningun destino NO abre una pantalla, y el armazon LO DICE', () => {
    // La otra direccion. Un enrutador que cayera en la primera pantalla ante cualquier hash
    // desconocido pasaria las cuatro de arriba y ofreceria pantallas que nadie pidio.
    abrir('no-existe-este-destino');
    // Se mira el titulo de un bloque de VERDAD y no «cualquier h2»: el armazon usa un h2 para su
    // propio estado vacio, y prohibirlos todos mediria el marco en vez de la pantalla.
    expect(screen.queryByRole('heading', { level: 2, name: 'Estado del ejercicio' })).toBeNull();
    expect(elArmazonLoDice()).toBe(true);
  });

  it('y la clave con el prefijo del modulo tampoco abre: el slug es el del artboard', () => {
    // `#/nor-panel` es la CLAVE, no el slug. Sin esta prueba, un catalogo que no declarara `slug`
    // pasaria el recorrido de arriba —`destino.slug ?? destino.clave` caeria en la clave— y los
    // enlaces de la barra de direcciones serian otros.
    abrir('nor-panel');
    expect(screen.queryByRole('heading', { level: 1, name: 'Panel' })).toBeNull();
    expect(elArmazonLoDice()).toBe(true);
  });

  it('el modulo del destino abierto viene YA desplegado, con sus cuatro hojas', () => {
    // Abrir por hash tiene que desplegar su modulo: si no, quien llega por un enlace ve su pantalla
    // y **el arbol cerrado**, sin pista de donde esta. Y por eso no se pulsa nada aqui — pulsar el
    // modulo lo CERRARIA.
    abrir('panel');
    const modulo = CATALOGO[0];
    if (modulo === undefined) throw new Error('el catalogo vino vacio');
    expect(
      screen.getAllByRole('button', { name: new RegExp(escapar(modulo.rotulo)) }).length,
      `el carril no ofrece «${modulo.rotulo}»`,
    ).toBeGreaterThan(0);
    for (const destino of modulo.destinos) {
      expect(
        screen.getAllByRole('button', { name: destino.rotulo }).length,
        `el carril no ofrece «${destino.rotulo}»`,
      ).toBeGreaterThan(0);
    }
  });

  it('y desde una hoja se llega a otra pulsando en el arbol', () => {
    // El recorrido de arriba llega por el hash, que es como se llega desde fuera. Esta mide el
    // camino de dentro, que es el que usa quien ya esta trabajando — y es ademas el que hace que
    // una hoja se sustituya por otra en el mismo sitio, que es de lo que habla
    // `la-hoja-no-hereda-lo-tecleado`.
    abrir('panel');
    fireEvent.click(screen.getByRole('button', { name: 'Ediciones' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Ediciones' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Panel' })).toBeNull();
  });
});
