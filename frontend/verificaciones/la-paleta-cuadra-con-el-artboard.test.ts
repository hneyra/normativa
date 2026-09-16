// @vitest-environment node
//
// Lee dos archivos del disco y compara texto. No es un DOM lo que necesita.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { artboardDeclarado, rutaDe, type Artboard } from './artboards.ts';
import { hojaDeUi } from './especificadores.ts';

/**
 * **La paleta que el artboard V8 pinta esta declarada, es la de `rentas` byte a byte, y es la que
 * `@kamayuk/ui` publica** (hneyra/normativa#52 AC 5, y hneyra/normativa#58 AC 7).
 *
 * <h2>El archivo estuvo partido en dos, y ya no</h2>
 *
 * `rentas/frontend/verificaciones/la-paleta-cuadra-con-el-artboard.test.ts@ac379ac` compara tres
 * cosas: los `var(--…)` que el `.dc.html` pinta, la hoja que los declara y el `@theme` de
 * `@kamayuk/ui`. Cuando #52 escribio esto, la tercera no se podia: se alcanza **por el
 * especificador** `@kamayuk/ui/estilos.css`, y ese especificador no resolvia hasta que
 * hneyra/normativa#55 enlazo `kamayuk-lib`. Asi que quedo dicho aqui que la traeria #58, y esta es.
 *
 * - **La mitad local**: todo token que el artboard pinta esta declarado en `normativa-tokens.css`,
 *   y esa hoja es la de `rentas`, comprobada por su `sha256`.
 * - **La mitad contra la libreria**: cada color y cada sombra de esa hoja es el que el `@theme`
 *   publica, en los dos sentidos, y todo radio publicado vale lo que el artboard dice.
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

/* ── La mitad contra la libreria (hneyra/normativa#58) ─────────────────────────────────── */

/** `--azul: #005284;` -> `['--azul', '#005284']`, sin comentarios de por medio. */
function declaraciones(css: string): Map<string, string> {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const salida = new Map<string, string>();
  for (const [, nombre, valor] of sinComentarios.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    salida.set(nombre ?? '', (valor ?? '').trim());
  }
  return salida;
}

/**
 * El nombre que el `@theme` le da a un token del artboard. Solo colores y sombras: ver el radio.
 *
 * El artboard escribe `--azul`; el `@theme` de Tailwind v4 escribe `--color-azul`, y ese prefijo es
 * lo que hace que se generen `bg-azul` y `text-azul`. Las sombras van a `--shadow-*`.
 */
function comoLoLlamaTailwind(nombre: string): string {
  const pelado = nombre.slice(2);
  return pelado.startsWith('sombra') ? `--shadow-${pelado}` : `--color-${pelado}`;
}

const esRadio = (nombre: string): boolean => nombre.startsWith('--radio');

/** Los tokens del artboard, y los que se comparan uno a uno: todos menos los radios. */
const delArtboard = (): Map<string, string> =>
  declaraciones(leer(artboardDeclarado('normativa-tokens.css')));
const unoAUno = (): readonly (readonly [string, string])[] =>
  [...delArtboard()].filter(([n]) => !esRadio(n));

/**
 * El `@theme` de `@kamayuk/ui`, alcanzado POR EL ESPECIFICADOR que el codigo escribe.
 *
 * Que se resuelva por `@kamayuk/ui/estilos.css` y no por `../../kamayuk-lib/…` no es un detalle de
 * estilo: es lo que hace que esta guarda compruebe la paleta **que este frontend usa de verdad**.
 * Una ruta al hermano leeria el archivo aunque el `link:` o el `exports` estuvieran rotos, que es el
 * modo de fallo entero de `rentas`#138. Se llama dentro del `it` por lo mismo que se lee el
 * artboard dentro del `it`.
 */
const deLaLibreria = (): Map<string, string> => declaraciones(readFileSync(hojaDeUi(), 'utf8'));

describe('la paleta de @kamayuk/ui es la del artboard V8', () => {
  it('EL CENTINELA: las dos lecturas traen los tokens que el artboard pinta', () => {
    // Sin esto, un cambio de formato en cualquiera de los dos archivos dejaria su mapa VACIO, y las
    // comparaciones de abajo pasarian en verde comparando nada.
    //
    // Lo que exige NO es una cifra —publicar un token de mas no lo mueve— sino un suelo tomado de
    // una TERCERA fuente: los `var(--…)` que el propio `.dc.html` pinta. Asi el rojo NOMBRA lo que
    // falta, que es la leccion de `rentas`#118: «expected 45 to be 44» no dice cual.
    const pintados = usados(leer(artboardDeclarado('NormativaV8.dc.html')));
    expect(pintados.length, 'el `.dc.html` no pinta ni un `var(--…)`').toBeGreaterThan(0);

    const hoja = delArtboard();
    const sinDeclarar = pintados.filter((n) => !hoja.has(n));
    expect(
      sinDeclarar,
      'El artboard pinta tokens que su hoja no declara:\n' +
        `${sinDeclarar.map((n) => `  ${n}`).join('\n')}\n\n` +
        '  O `normativa-tokens.css` se vendorizo a medias, o dejo de leerse — y entonces lo que se\n' +
        '  compara contra la libreria es menos paleta de la que el artboard dibuja.',
    ).toEqual([]);

    const publicados = deLaLibreria();
    const sinPublicar = [
      // El knob que shadcn lee: si no esta, no hay radio que comprobar.
      '--radius',
      ...pintados.filter((n) => !esRadio(n)).map(comoLoLlamaTailwind),
    ].filter((n) => !publicados.has(n));
    expect(
      sinPublicar,
      'La libreria dejo de publicar tokens que el artboard pinta:\n' +
        `${sinPublicar.map((n) => `  ${n}`).join('\n')}\n\n` +
        '  Si el `@theme` de `@kamayuk/ui` se leyo vacio, aqui sale la paleta entera. Si solo son\n' +
        '  algunos, o se renombraron sin avisar al consumidor (`kamayuk-lib`#8) o se fueron con la\n' +
        '  hoja que los traia (`kamayuk-lib`#23) — y en ese caso el artboard los sigue pintando.',
    ).toEqual([]);
  });

  it('los colores y las sombras son los mismos, uno a uno', () => {
    const publicados = deLaLibreria();
    const discrepancias: string[] = [];
    for (const [nombre, valor] of unoAUno()) {
      const enTailwind = comoLoLlamaTailwind(nombre);
      const publicado = publicados.get(enTailwind);
      if (publicado === undefined) {
        discrepancias.push(
          `  ${nombre}: el artboard lo declara y la libreria no publica ${enTailwind}`,
        );
      } else if (publicado !== valor) {
        discrepancias.push(`  ${nombre}: el artboard dice «${valor}» y la libreria «${publicado}»`);
      }
    }

    expect(
      discrepancias,
      'La paleta que `@kamayuk/ui` publica dejo de ser la que el artboard dibuja:\n' +
        `${discrepancias.join('\n')}\n\n` +
        '  El artboard manda. Si el cambio es deliberado, entra primero en el artboard de la\n' +
        '  libreria y de ahi se deriva el `@theme` — no al reves, y no ajustando la hoja de aqui.',
    ).toEqual([]);
  });

  it('y la libreria no publica ninguno que el artboard no tenga', () => {
    // La otra direccion, que es la que nadie mira: un token inventado en la libreria se usa en una
    // pantalla, se ve bien, y no esta en ningun artboard — asi es como una paleta empieza a tener
    // colores que nadie decidio.
    const esperados = new Set(unoAUno().map(([n]) => comoLoLlamaTailwind(n)));
    const sobrantes = [...deLaLibreria().keys()].filter(
      (n) => !esperados.has(n) && !n.startsWith('--radius'),
    );

    expect(
      sobrantes,
      'La libreria publica tokens que el artboard no declara:\n' +
        `${sobrantes.map((n) => `  ${n}`).join('\n')}\n\n` +
        '  Un color que nadie dibujo es un color que nadie decidio.',
    ).toEqual([]);
  });

  it('TODO radio que la libreria publica vale lo que el artboard dice', () => {
    // La regla, y no un mapa de nombres: el artboard declara `--radio` y `--radio-sm`, los dos del
    // mismo valor, y la libreria publica `--radius` mas los tres tamanos de shadcn. Lo que importa
    // no es como se llaman sino que ninguno se aparte del valor del artboard — que es lo que haria
    // que los componentes de shadcn cayeran en su `0.625rem`.
    const valores = [...new Set([...delArtboard()].filter(([n]) => esRadio(n)).map(([, v]) => v))];
    expect(valores, 'el artboard declara mas de un radio distinto').toHaveLength(1);
    const esperado = valores[0] ?? '';

    const publicados = deLaLibreria();
    // Los cuatro que shadcn lee, POR NOMBRE y no por cuenta: contarlos saldria rojo —sin que nada
    // estuviera mal— el dia que shadcn anadiera un tamano. Nombrarlos dice CUAL falto.
    const faltan = ['--radius', '--radius-sm', '--radius-md', '--radius-lg'].filter(
      (n) => !publicados.has(n),
    );
    expect(
      faltan,
      'La libreria dejo de publicar radios que shadcn lee:\n' +
        `${faltan.map((n) => `  ${n}`).join('\n')}\n\n` +
        '  Sin `--radius` los componentes de shadcn caen en su `0.625rem` por omision, que no es el\n' +
        '  radio del artboard.',
    ).toEqual([]);

    const distintos = [...publicados]
      .filter(([n, v]) => n.startsWith('--radius') && v !== esperado)
      .map(([n, v]) => `  ${n}: «${v}», y el artboard dice «${esperado}»`);
    expect(
      distintos,
      `Un radio publicado se aparto del que dibuja el artboard:\n${distintos.join('\n')}`,
    ).toEqual([]);
  });
});
