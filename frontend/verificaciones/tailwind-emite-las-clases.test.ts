// @vitest-environment node
//
// Compila CSS de verdad y lee archivos del disco. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  RAIZ_DE_UI,
  clasesDe,
  clasesEmitidas,
  compilar,
  compilarLaHojaDeLaAplicacion,
  fuentesDe,
  paletaDelTema,
  reglasDe,
  resolver,
  utilidadDesnuda,
} from './tailwind.ts';

/**
 * **Una clase de Tailwind produce una REGLA, y no solo esta escrita** (`rentas`#91, `normativa`#55).
 *
 * **Calcado de `rentas/frontend/verificaciones/tailwind-emite-las-clases.test.ts` en `ac379ac`**, con
 * dos cambios que no son de nombre y que por eso se dicen.
 *
 * <h2>1. La hoja que se compila es la de ESTA aplicacion, con sus `@source`</h2>
 *
 * En `rentas` las clases se sacan de las fuentes con `clasesDe` y se le dan a Tailwind ya hechas.
 * Eso mide que la paleta genera cada utilidad; **no** mide que `src/estilos.css` le diga a Tailwind
 * donde buscarlas. Y ese es el defecto que `rentas` tardo en ver (`rentas`#107): Tailwind v4 omite
 * `node_modules`, la libreria llega por `link:` y vive ahi, y sin `@source` sus clases no generan
 * regla. Alli lo cazo el arnes de navegador. Aqui no hay arnes todavia (`normativa`#61) y este
 * repositorio **no escribe ni una clase propia** —el `Armazon` entero es de `@kamayuk/shell`—, asi
 * que lo que sale sin esas dos lineas es una pagina sin las utilidades de la libreria.
 *
 * Por eso aqui se compila `src/estilos.css` como lo compila `vite build` —sus `@import` por el
 * `exports` de la libreria y sus clases descubiertas por el `Scanner` de `@tailwindcss/oxide`— y se
 * pregunta si cada clase que la libreria escribe tiene su regla en ESE CSS. Quitar un `@source`
 * pone esto rojo nombrando las clases que se quedan sin regla.
 *
 * <h2>2. No hay artboard contra el que medir la paleta</h2>
 *
 * `rentas` comprueba ademas que los 38 colores de `diseno/rentas-tokens.css` salen con su valor. Ese
 * artboard es de `rentas`, y `normativa` no tiene artboard V8 (epica `normativa`#114): la paleta es de
 * `@kamayuk/ui` y la mide `rentas` contra el suyo. Lo que se queda es lo que no depende de un
 * artboard: el lector de reglas (`rentas`#139), el radio que no es el de shadcn y que toda clase que
 * las piezas usan produzca una regla.
 */

const requerir = createRequire(import.meta.url);
const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/** La hoja que el navegador recibe: la de `src/`, que importa la de la libreria. */
const HOJA_DE_LA_APLICACION = join(FRONTEND, 'src', 'estilos.css');

/** `@kamayuk/shell`, alcanzado POR EL ENLACE, como `RAIZ_DE_UI`. */
const RAIZ_DE_SHELL = dirname(requerir.resolve('@kamayuk/shell'));

/**
 * Las piezas que dibujan: las de `@kamayuk/ui`, las del `Armazon` y las de `src/`.
 *
 * Las dos primeras son las que esta aplicacion pinta hoy; `src/` entra para que la primera clase
 * propia que alguien escriba —con #119— se vigile desde el primer dia.
 */
const FUENTES = [
  ...fuentesDe(RAIZ_DE_UI),
  ...fuentesDe(RAIZ_DE_SHELL),
  ...fuentesDe(join(FRONTEND, 'src')),
];
const CLASES = [...new Set(FUENTES.flatMap((f) => clasesDe(readFileSync(f, 'utf8'))))].sort();

describe('Tailwind emite lo que las piezas piden', () => {
  it('EL CENTINELA: hay fuentes y clases que comprobar', async () => {
    // Sin esto, un cambio de ruta o de extension dejaria la lista vacia y todo lo de abajo pasando
    // en verde sobre la nada.
    expect(FUENTES.length, 'no se leyo ni una pieza').toBeGreaterThanOrEqual(15);
    expect(CLASES.length, 'no se extrajo ni una clase').toBeGreaterThanOrEqual(60);

    const css = await compilar(['bg-azul']);
    expect(css.length, 'Tailwind no emitio CSS: la hoja no compila').toBeGreaterThan(500);

    // Y que el lector de `rentas`#139 encuentra sus dos sujetos en el CSS DE VERDAD.
    const reglas = reglasDe(css);
    expect(
      utilidadDesnuda(reglas, 'bg-azul'),
      'el lector no encontro la regla `.bg-azul` en el CSS emitido',
    ).toBeDefined();
    expect(
      paletaDelTema(reglas).size,
      'el `@theme` no se leyo: Tailwind ya no lo emite como `@layer theme { :root, :host { … } }`',
    ).toBeGreaterThan(0);
  });

  it('EL CENTINELA: el lector del CSS distingue lo que `includes` confundia', () => {
    // El defecto de `rentas`#139 en miniatura, escrito a mano para que se pueda mirar.
    const muestra = [
      '@layer theme {',
      '  :root, :host { --color-sup: #f7fbfe; --color-superficie: #ffffff; }',
      '}',
      '@layer utilities {',
      '  .bg-superficie { background-color: var(--color-superficie); }',
      '}',
      ":root, [data-tema='institucional'] { --color-sup: #f7fbfe; --color-superficie: #0000ff; }",
    ].join('\n');
    const reglas = reglasDe(muestra);

    const emitidas = clasesEmitidas(reglas);
    expect(emitidas.has('bg-superficie'), 'el lector no vio la clase que si esta').toBe(true);
    expect(
      emitidas.has('bg-sup'),
      'el lector contesta por subcadena: `.bg-superficie` no genera la utilidad `bg-sup`',
    ).toBe(false);
    expect(utilidadDesnuda(reglas, 'bg-sup'), 'la utilidad desnuda tambien va por prefijo').toBe(
      undefined,
    );
    expect(paletaDelTema(reglas).get('--color-superficie')).toBe('#ffffff');

    const utilidad = utilidadDesnuda(reglas, 'bg-superficie');
    expect(utilidad, 'no se encontro la regla de la utilidad').toBeDefined();
    expect(
      resolver(utilidad?.declaraciones.get('background-color') ?? '', paletaDelTema(reglas)),
    ).toBe('#ffffff');
  });

  it('el RADIO emitido es el de la libreria, y no el `0.625rem` de shadcn', async () => {
    const css = await compilar(['rounded-sm', 'rounded-md', 'rounded-lg']);
    // Es la mitad que falta de `kamayuk-lib`#8: alli se comprobo que el token se declara.
    expect(css).not.toContain('0.625rem');
    for (const clase of ['rounded-sm', 'rounded-md', 'rounded-lg']) {
      expect(css, `no se emitio .${clase}`).toContain(`.${clase}`);
    }
    expect(css).toMatch(/border-radius:\s*(?:var\(--radius-(?:sm|md|lg)\)|3px)/);
  });

  it('TODA clase que las piezas usan produce una regla EN LA HOJA DE LA APLICACION', async () => {
    // La pregunta de `rentas`, pero contra el CSS que recibe el navegador y no contra uno compilado
    // con la lista dada: aqui las clases las descubre el escaner por los `@source` de
    // `src/estilos.css`, que es lo unico que las hace llegar desde `node_modules`.
    //
    // La pertenencia es EXACTA y no por subcadena (`rentas`#139).
    const emitidas = clasesEmitidas(
      reglasDe(await compilarLaHojaDeLaAplicacion(HOJA_DE_LA_APLICACION, FRONTEND)),
    );
    const mudas = CLASES.filter((c) => !emitidas.has(c));
    expect(
      mudas,
      `Hay ${String(mudas.length)} de ${String(CLASES.length)} clases escritas que la hoja de la ` +
        'aplicacion NO genera. El elemento que las lleva\n' +
        'se queda sin estilo, y eso no se ve en ninguna prueba que compare `className` como texto.\n' +
        'Si son de la libreria, lo primero que hay que mirar son los `@source` de `src/estilos.css`:\n' +
        'Tailwind omite `node_modules`, y `@kamayuk/*` vive ahi por el `link:`.\n' +
        `${mudas.map((c) => `  ${c}`).join('\n')}`,
    ).toEqual([]);
  });
});
