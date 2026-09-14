// @vitest-environment node
//
// Lee el DISCO y nada mas. Y NO importa ni una sola cosa que pueda faltar: es su unico trabajo
// poder hablar cuando algo falta.

import { existsSync, readFileSync, statSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ARTBOARDS, rutaDe } from './artboards.ts';

/**
 * **Los artboards vendorizados estan, y si falta uno el rojo lo dice** (hneyra/normativa#52).
 *
 * Calcada de `rentas/frontend/verificaciones/los-artboards-estan.test.ts@ac379ac`, que se escribio
 * por `rentas`#78: cuatro barreras leian su artboard en el cuerpo del modulo, y el dia que el
 * archivo no estuvo murieron durante la RECOLECCION con un `ENOENT` y sus 77 `it` no llegaron a
 * existir. El build salio rojo, pero hablando de un fichero y no de lo que dejo de comprobarse.
 *
 * Las guardas del artboard V8 de este directorio —`el-artboard-dice-lo-que-cuenta`,
 * `lo-que-viaja-no-lleva-cifras`, `los-ejemplos-son-los-de-la-v6` y
 * `la-paleta-cuadra-con-el-artboard`— leen dentro de sus `it`, asi que un artboard que falta las
 * pone rojas a ellas tambien. Esta es la que dice **cual** falta y **de donde se trae**.
 *
 * <h2>Por que este archivo no importa nada que pueda faltar</h2>
 *
 * Es la leccion de `rentas`#74: la guarda que avisa de que algo falta **no puede depender de ese
 * algo**, o muere con el y se calla justo cuando tiene que hablar. Aqui solo entran `node:fs` y la
 * lista de artboards, que es una constante.
 */

describe('los artboards vendorizados estan', () => {
  it('EL CENTINELA: hay artboards declarados que comprobar, y el V8 entre ellos', () => {
    // Sin esto, todo lo de abajo pasaria sobre la lista vacia el dia que alguien la vacie — que
    // es como una guarda se queda sin sujeto y sigue en verde.
    expect(ARTBOARDS.length, 'la lista de artboards esta vacia').toBeGreaterThan(0);
    expect(ARTBOARDS.map((a) => a.archivo)).toContain('diseno/NormativaV8.dc.html');
  });

  it.each(ARTBOARDS.map((a) => [a.archivo, a] as const))('%s esta, y no esta vacio', (_n, a) => {
    const ruta = rutaDe(a);

    expect(
      existsSync(ruta),
      `FALTA UN ARTBOARD VENDORIZADO: ${a.archivo}\n\n` +
        `  Que dibuja: ${a.que}\n` +
        `  De donde se trae: ${a.deDonde}\n\n` +
        '  Sin el, las barreras que lo leen se ponen rojas sin decir por que. Este mensaje es lo\n' +
        '  que dice cual falta y de donde se vuelve a sacar.',
    ).toBe(true);

    // Y que no este vacio: un archivo de cero bytes existe, pasa el `existsSync`, y deja el
    // analizador devolviendo listas vacias.
    expect(statSync(ruta).size, `${a.archivo} esta vacio`).toBeGreaterThan(1024);
  });

  it('y los `.dc.html` son artboards de verdad, no una pagina cualquiera', () => {
    // La forma minima que el lector de `artboard-v8.ts` da por hecha. Un archivo que exista, pese
    // algo y no sea un artboard lo dejaria devolviendo vacio, en verde.
    const dibujos = ARTBOARDS.filter((x) => x.archivo.endsWith('.dc.html'));
    expect(dibujos.length, 'no hay ningun `.dc.html` declarado').toBeGreaterThan(0);
    for (const a of dibujos) {
      const ruta = rutaDe(a);
      expect(existsSync(ruta), `falta ${a.archivo} (${a.deDonde})`).toBe(true);
      const html = readFileSync(ruta, 'utf8');
      expect(html, `${a.archivo} no trae el bloque <x-dc>`).toContain('<x-dc>');
      expect(html, `${a.archivo} no trae su guion`).toContain('type="text/x-dc"');
    }
  });
});
