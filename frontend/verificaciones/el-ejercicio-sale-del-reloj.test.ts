// @vitest-environment node
//
// Lee el disco y mueve el reloj. No es un DOM lo que necesita, y bajo jsdom `fileURLToPath` revienta.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { EJERCICIO_DE_TRABAJO, ejercicioDe } from '../src/datos/ejercicio.ts';

/**
 * **El ejercicio sale del reloj, y nunca de un literal** (#63, AC 2).
 *
 * <h2>El defecto que cierra, y por que no se ve</h2>
 *
 * La V6 lo escribia dos veces: `EJERCICIOS = ['2026', '2027', '2025', '2024']`
 * (`c01fe9a:src/marco/BarraGlobal.tsx:67`) y `useState('2026')`
 * (`c01fe9a:src/marco/Marco.tsx:120`). Lo malo de un literal asi no es que este mal: es que **el 1
 * de enero de 2027 sigue pareciendo bien**. La pantalla pregunta por un ejercicio que ya no es el de
 * trabajo y contesta correctamente a la pregunta equivocada, sin un error en ningun sitio.
 *
 * `catastro` lo midio en su #48 y aqui se cierra con dos mitades:
 *
 *   · una **funcion pura** —la fecha entra como argumento, que es la regla 6 del producto— para
 *     poder probarla con el reloj movido;
 *   · una **lectura unica al arranque**, que es lo que el Panel pregunta.
 *
 * <h2>Y por que el reloj se mueve a 2031</h2>
 *
 * Porque una prueba que no lo mueva **pasa igual con el literal dentro**: hoy el ano es el mismo. Es
 * la unica forma de que esta guarda pueda fallar, y por eso se anota su rojo con el reloj movido y
 * su verde sin moverlo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const DATOS = join(AQUI, '../src/datos');

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('AC 2 — el ejercicio sale del reloj', () => {
  it('EL CENTINELA: la funcion es PURA — el mismo instante da siempre lo mismo', () => {
    // Sin esto, una funcion que leyera el reloj por dentro pasaria las de abajo por casualidad el
    // dia que se corrieran, y dejaria de pasarlas en otro. Dos instantes escritos, dos respuestas.
    expect(ejercicioDe(new Date(2026, 8, 16, 12, 0, 0))).toBe(2026);
    expect(ejercicioDe(new Date(2031, 0, 1, 0, 30, 0))).toBe(2031);
    expect(ejercicioDe(new Date(2030, 11, 31, 23, 30, 0))).toBe(2030);
  });

  it('con el reloj en 2031, el ejercicio de trabajo es 2031 y no el de este ano', async () => {
    // El caso que muerde. `vi.resetModules()` mas un `import` dinamico vuelven a evaluar el modulo
    // con el reloj ya movido, que es lo que hace de verdad `EJERCICIO_DE_TRABAJO`: leerlo una vez al
    // cargar. Con un literal dentro, esta prueba sale roja diciendo que esperaba 2031.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 5, 30, 10, 0, 0));
    vi.resetModules();

    const modulo = await import('../src/datos/ejercicio.ts');

    expect(
      modulo.EJERCICIO_DE_TRABAJO,
      'Con el reloj en 2031 el ejercicio de trabajo tiene que ser 2031.\n' +
        '  Si esto sale con otro numero, el ejercicio esta escrito como literal en algun sitio — y\n' +
        '  ese literal parece correcto hasta el 1 de enero siguiente, que es lo que lo hace peor que\n' +
        '  un error.',
    ).toBe(2031);
    expect(modulo.ejercicioDe(new Date())).toBe(2031);
  });

  it('y con el reloj de verdad, es el ano de hoy: se lee, no se supone', () => {
    expect(EJERCICIO_DE_TRABAJO).toBe(new Date().getFullYear());
  });

  it('ninguna fuente de `src/datos/` escribe un ano como literal', () => {
    // La otra direccion: que no vuelva a entrar por otra puerta. Se omiten los comentarios, porque
    // un docblock TIENE que poder citar el rango 1990-2100 del backend y las lineas de la V6 que
    // este archivo explica — es la misma decision que toma `sin-cifras-inventadas` en este arbol.
    const sinComentarios = (fuente: string): string =>
      fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');

    const culpables = readdirSync(DATOS)
      .filter((nombre) => /\.tsx?$/.test(nombre) && !nombre.includes('.test.'))
      .flatMap((nombre) => {
        const codigo = sinComentarios(readFileSync(join(DATOS, nombre), 'utf8'));
        return [...codigo.matchAll(/(?<![\w.])(?:19|20)\d{2}(?![\w.])/g)].map(
          (hallazgo) => `  src/datos/${nombre}: «${hallazgo[0]}»`,
        );
      });

    expect(
      culpables,
      'Hay un ano escrito como literal en la capa de datos:\n' +
        `${culpables.join('\n')}\n\n` +
        '  El ejercicio sale de `src/datos/ejercicio.ts`, que lo lee del reloj una vez al arrancar.\n' +
        '  Un literal aqui sigue pareciendo correcto hasta el 1 de enero siguiente.',
    ).toEqual([]);
  });
});
