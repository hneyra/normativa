import { Armazon, type Catalogo, type HojaDelCatalogo } from '@kamayuk/shell';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { ClaveDeHoja } from '../src/pantallas/arbol.ts';
import { crearPantalla } from '../src/pantallas/index.ts';
import type { Pantalla } from '../src/pantallas/tipos.ts';

/**
 * **Lo tecleado en una hoja no aparece en la siguiente** (#58, AC 5).
 *
 * <h2>El defecto, leido en el codigo antes de medirlo</h2>
 *
 * `<Pantalla>` de `@kamayuk/ui` guarda lo tecleado en su propio `useState`
 * (`paquetes/ui/interprete/Pantalla.tsx`). El armazon tiene **una sola ruta** —`path: '*'`— que
 * dibuja siempre el mismo componente, asi que al pasar de una hoja a otra React **reconcilia el
 * mismo arbol**: un campo de la hoja A que caiga en la misma posicion y con el mismo tipo en la
 * hoja B conserva lo escrito. Y no hay nada que lo corte: el armazon solo pide confirmacion si la
 * hoja se marco sucia, y `marcarSucia` no lo llama nadie todavia —es el hueco H38 de
 * `diseno/HUECOS.md`, que `kamayuk-lib`#86 aun no publica—.
 *
 * En un sistema que sella valores normativos eso no es cosmetico: la observacion escrita para abrir
 * una version reaparecida en el formulario de sellar es una observacion que nadie escribio para ese
 * acto, y la regla 10 dice que sin observacion no se guarda **porque la observacion es la que
 * explica el cambio**.
 *
 * <h2>Por que la prueba inyecta definiciones en vez de usar las cuatro de verdad</h2>
 *
 * Porque las cuatro hojas de `normativa` tienen formas distintas, y React desmonta igual lo que no
 * cuadra: la prueba pasaria **sin haber demostrado nada**. Para que el defecto pueda aparecer hacen
 * falta dos definiciones de la MISMA forma, y para eso existe `crearPantalla`.
 *
 * <h2>Las dos mitades, y por que las dos</h2>
 *
 * · **El arnes** monta `pantalla(hoja)` en el mismo sitio y cambia de hoja. Mide **esta costura**:
 *   quitar la `key` de `src/pantallas/index.ts` la pone roja, con el valor heredado en el mensaje.
 * · **El armazon** hace el camino de verdad, pulsando en el arbol. Mide la cadena entera. **Y aqui
 *   hay que decir lo medido**: `@kamayuk/shell` ya envuelve la llamada en
 *   `<Fragment key={hoja.destino.clave}>` desde `kamayuk-lib`#67, asi que esta segunda mitad
 *   **seguiria verde sin la `key` de aqui**. No sobra: es la que dice que la propiedad se cumple
 *   por el camino que usa una persona, y la que saldria roja el dia que `kamayuk-lib`#86 decida
 *   H35b al reves —«conservar lo tecleado al salir y volver»— y la libreria quite la suya.
 */

/** Dos hojas de la MISMA forma: un campo de texto en la misma posicion, y un titulo distinto. */
const DOS_DEFINICIONES: Readonly<Record<string, Pantalla>> = {
  'hoja-a': {
    instruccion: 'escriba algo aqui y vayase a la otra hoja.',
    bloques: [
      {
        titulo: 'El bloque de la hoja A',
        nota: '',
        campos: [{ etiqueta: 'Observación', tipo: '' }],
      },
    ],
  },
  'hoja-b': {
    instruccion: 'esta es la otra hoja, y su campo tiene que estar vacio.',
    bloques: [
      {
        titulo: 'El bloque de la hoja B',
        nota: '',
        campos: [{ etiqueta: 'Observación', tipo: '' }],
      },
    ],
  },
};

/** El catalogo de las dos, con la forma que el armazon entiende. */
const CATALOGO_DE_DOS: Catalogo = [
  {
    clave: 'pruebas',
    rotulo: 'Modulo de la prueba',
    nota: 'Dos hojas de la misma forma',
    icono: 'balanza',
    destinos: [
      { clave: 'hoja-a', rotulo: 'Hoja A', seEscribe: true, instruccion: 'la primera' },
      { clave: 'hoja-b', rotulo: 'Hoja B', seEscribe: true, instruccion: 'la segunda' },
    ],
  },
];

/**
 * La funcion de este modulo, con las dos definiciones inyectadas.
 *
 * El `as` es de la prueba y no del codigo: `crearPantalla` pide una funcion sobre `ClaveDeHoja`
 * —las cuatro del arbol— y aqui las claves son otras dos a proposito. Estrecharlo seria ensanchar
 * el tipo de produccion para que quepa una prueba.
 */
const pantalla = crearPantalla(
  ((clave: string) => DOS_DEFINICIONES[clave] ?? DOS_DEFINICIONES['hoja-a']) as (
    clave: ClaveDeHoja,
  ) => Pantalla,
);

/** La hoja que el armazon le pasaria a `pantalla`. */
const hojaDelCatalogo = (clave: string): HojaDelCatalogo => {
  const modulo = CATALOGO_DE_DOS[0];
  if (modulo === undefined) throw new Error('el catalogo de la prueba vino vacio');
  const destino = modulo.destinos.find((d) => d.clave === clave);
  if (destino === undefined) throw new Error(`«${clave}» no esta en el catalogo de la prueba`);
  return { modulo, destino };
};

/** El arnes: dibuja la hoja que se le pase, SIEMPRE en el mismo sitio. */
function Arnes({ clave }: { readonly clave: string }) {
  return <div>{pantalla(hojaDelCatalogo(clave))}</div>;
}

const LO_TECLEADO = 'Corrige la vigencia de la UIT del ejercicio';

beforeAll(() => {
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
  window.location.hash = '';
});

/**
 * El campo de la pantalla, **por su etiqueta**.
 *
 * Por la etiqueta y no «el primer `textbox`», y es una correccion medida: el carril del armazon
 * dibuja su propio campo de texto —el filtro de modulos— **antes** en el DOM, asi que «el primero»
 * tecleaba en el filtro. El sintoma no era un rojo claro: el arbol se quedaba sin modulos que
 * ensenar y la prueba fallaba al buscar el boton de la otra hoja.
 */
function elCampo(): HTMLInputElement {
  return screen.getByLabelText('Observación') as HTMLInputElement;
}

describe('la hoja no hereda lo tecleado en la anterior', () => {
  it('EL CENTINELA: las dos definiciones son de la misma forma, y la primera dibuja su campo', () => {
    // Sin esto, dos definiciones que se dibujaran distinto harian que React desmontara igual, y la
    // prueba de abajo pasaria **sin haber demostrado nada**: es justo el caso de las cuatro hojas
    // de verdad, y por eso aqui se inyectan dos.
    const a = DOS_DEFINICIONES['hoja-a'];
    const b = DOS_DEFINICIONES['hoja-b'];
    expect(a?.bloques.map((bloque) => bloque.campos)).toStrictEqual(
      b?.bloques.map((bloque) => bloque.campos),
    );
    expect(a?.bloques[0]?.titulo).not.toBe(b?.bloques[0]?.titulo);

    render(<Arnes clave="hoja-a" />);
    expect(screen.getByRole('heading', { level: 2, name: 'El bloque de la hoja A' })).toBeTruthy();
    expect(elCampo().value, 'el campo no empieza vacio').toBe('');
  });

  it('en el ARNES: se teclea en la hoja A, se cambia a la B y el campo esta vacio', () => {
    const { rerender } = render(<Arnes clave="hoja-a" />);

    fireEvent.change(elCampo(), { target: { value: LO_TECLEADO } });
    // CENTINELA: de verdad se tecleo. Sin esto, la prueba pasaria sin haber escrito nada.
    expect(elCampo().value, 'no se llego a teclear nada en la hoja A').toBe(LO_TECLEADO);

    rerender(<Arnes clave="hoja-b" />);

    // CENTINELA: de verdad se cambio de hoja. Sin esto, la prueba pasaria mirando la hoja A vacia.
    expect(
      screen.getByRole('heading', { level: 2, name: 'El bloque de la hoja B' }),
      'no se llego a cambiar de hoja',
    ).toBeTruthy();

    expect(
      elCampo().value,
      'La hoja B heredo lo tecleado en la A: «' +
        elCampo().value +
        '».\n\n' +
        '  `<Pantalla>` guarda lo tecleado en su propio estado, y sin una `key` por destino React\n' +
        '  reconcilia el mismo componente en el mismo sitio. La observacion escrita para abrir una\n' +
        '  version reaparece en el formulario de sellar, y la regla 10 existe porque la observacion\n' +
        '  es la que explica el cambio. La `key` esta en `src/pantallas/index.ts`.',
    ).toBe('');
  });

  it('y en el ARMAZON montado, cambiando de hoja por el arbol', () => {
    window.location.hash = '#/hoja-a';
    render(
      <Armazon
        titulo="Titulo de la prueba"
        entidad="Sin sesión"
        catalogo={CATALOGO_DE_DOS}
        cuenta={{ nombre: 'Sin sesión', iniciales: '··' }}
        opcionesDeSesion={[]}
        pantalla={pantalla}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Hoja A' }), 'no abrio la hoja A').toBeTruthy();
    fireEvent.change(elCampo(), { target: { value: LO_TECLEADO } });
    expect(elCampo().value, 'no se llego a teclear nada en la hoja A').toBe(LO_TECLEADO);

    fireEvent.click(screen.getByRole('button', { name: 'Hoja B' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Hoja B' }),
      'no se llego a cambiar de hoja',
    ).toBeTruthy();
    expect(
      elCampo().value,
      'La hoja B heredo lo tecleado en la A por el camino que usa una persona: «' +
        elCampo().value +
        '».',
    ).toBe('');
  });
});
