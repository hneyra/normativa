// @vitest-environment node
//
// Lee dos archivos del disco y compara texto. No es un DOM lo que necesita.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { artboardDeclarado, rutaDe, type Artboard } from './artboards.ts';

/**
 * **La paleta que el artboard V8 pinta esta declarada, y es la de `rentas` byte a byte**
 * (hneyra/normativa#52, AC 5).
 *
 * <h2>Esta es la MITAD LOCAL, y la otra mitad tiene dueño</h2>
 *
 * `rentas/frontend/verificaciones/la-paleta-cuadra-con-el-artboard.test.ts@ac379ac` compara tres
 * cosas: los `var(--…)` que el `.dc.html` pinta, la hoja que los declara y el `@theme` de
 * `@kamayuk/ui`. La tercera se alcanza **por el especificador** `@kamayuk/ui/estilos.css`, y aqui
 * ese especificador no resuelve todavia: el `link:` a `kamayuk-lib` llega con hneyra/normativa#55.
 * Asi que el archivo se parte en dos:
 *
 * - **aqui**, lo que no necesita la libreria: todo token que el artboard pinta esta declarado en
 *   `normativa-tokens.css`, y esa hoja es la de `rentas`, comprobada por su `sha256`;
 * - **en hneyra/normativa#58**, que depende de #55 y de este issue, la comparacion contra el
 *   `@theme` de `@kamayuk/ui`, calcada de la de `rentas`.
 *
 * <h2>Por que el sha256 y no una comparacion token a token</h2>
 *
 * Porque la hoja no es de `normativa`: es la paleta de la libreria, que `rentas` vendorizo primero.
 * Si alguien la «ajusta» aqui, `normativa` pinta con colores que ningun otro sistema tiene, y la
 * comparacion contra `@kamayuk/ui` de #58 lo diria tarde. El `sha256` lo dice ya, y el cambio
 * deliberado entra primero en el artboard de la libreria y de ahi se vuelve a copiar.
 *
 * <h2>Las lecturas, dentro de los `it`</h2>
 *
 * La de `rentas` lee sus dos archivos en el cuerpo del modulo (`:121,132`). Aqui no: un artboard
 * que falta pone roja esta prueba nombrandolo, en vez de matarla durante la recoleccion.
 */

/** El texto de un archivo declarado, o un rojo que lo nombra. */
function leer(artboard: Artboard): string {
  const ruta = rutaDe(artboard);
  if (!existsSync(ruta)) {
    throw new Error(`FALTA ${artboard.archivo}\n  De donde se trae: ${artboard.deDonde}`);
  }
  return readFileSync(ruta, 'utf8');
}

/** `var(--azul)` -> `'--azul'`. Se leen USOS, no declaraciones. */
function usados(texto: string): readonly string[] {
  return [...new Set([...texto.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(([, n]) => n ?? ''))].sort();
}

/** `--azul: #005284;` -> `'--azul'`, sin comentarios de por medio. */
function declarados(css: string): ReadonlySet<string> {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return new Set([...sinComentarios.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(([, n]) => n ?? ''));
}

describe('la paleta del artboard V8 (la mitad que no necesita la libreria)', () => {
  it('EL CENTINELA: el artboard pinta tokens y la hoja declara tokens', () => {
    // Sin esto, un cambio de formato dejaria cualquiera de las dos listas vacia y la comprobacion
    // de abajo pasaria sobre el conjunto vacio.
    expect(
      usados(leer(artboardDeclarado('NormativaV8.dc.html'))).length,
      'el `.dc.html` no pinta ni un `var(--…)`',
    ).toBeGreaterThan(0);
    expect(
      declarados(leer(artboardDeclarado('normativa-tokens.css'))).size,
      '`normativa-tokens.css` no declara ni un token',
    ).toBeGreaterThan(0);
  });

  it('todo `var(--…)` que pinta el artboard esta declarado en normativa-tokens.css', () => {
    const hoja = declarados(leer(artboardDeclarado('normativa-tokens.css')));
    const sinDeclarar = usados(leer(artboardDeclarado('NormativaV8.dc.html'))).filter(
      (token) => !hoja.has(token),
    );
    expect(
      sinDeclarar,
      'El artboard pinta tokens que su hoja no declara:\n' +
        `${sinDeclarar.map((n) => `  ${n}`).join('\n')}\n\n` +
        '  En el lienzo salen sin color, y en hneyra/normativa#58 no habria contra que comparar el\n' +
        '  `@theme` de la libreria.',
    ).toEqual([]);
  });

  it('y normativa-tokens.css es la hoja de rentas, byte a byte', () => {
    const hoja = artboardDeclarado('normativa-tokens.css');
    expect(hoja.sha256, '`artboards.ts` no declara el sha256 de la hoja').toBeDefined();
    leer(hoja); // si falta, rojo nombrandola antes de hashear nada
    const bytes = readFileSync(rutaDe(hoja));
    const huella = createHash('sha256').update(bytes).digest('hex');
    expect(
      huella,
      `normativa-tokens.css ya no es ${hoja.deDonde}.\n` +
        `  Declarado: ${hoja.sha256 ?? '—'}\n  Medido:    ${huella}\n\n` +
        '  La paleta es de @kamayuk/ui, no de este sistema. Un cambio deliberado entra primero en\n' +
        '  el artboard de la libreria y de ahi se vuelve a copiar; no se ajusta aqui.',
    ).toBe(hoja.sha256);
  });
});
