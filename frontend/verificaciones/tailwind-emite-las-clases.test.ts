// @vitest-environment node
//
// Compila CSS de verdad y lee archivos del disco. No es un DOM lo que necesita.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { artboardDeclarado, rutaDe } from './artboards.ts';
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
 * <h2>2. Los dos casos que medían contra el artboard, y que ya se pueden medir (`normativa`#58)</h2>
 *
 * `rentas` comprueba ademas dos cosas contra `diseno/rentas-tokens.css`: que **cada** color declarado
 * genera su utilidad con su valor, y que el radio emitido es el del artboard. Cuando `normativa`#55
 * escribio este archivo, aqui ponia que `normativa` no tenia artboard V8 y que esos dos casos no
 * tenian contra que medir. **Ya lo tiene**: `diseno/normativa-tokens.css` llego con `normativa`#52
 * —la hoja de `rentas` byte a byte, comprobada por su `sha256` en
 * `la-paleta-cuadra-con-el-artboard`—, asi que los dos casos entran, calcados.
 *
 * Que la hoja sea la misma que la de `rentas` no los hace redundantes: lo que miden no es la hoja
 * sino **el camino** —que de `--x` salga `bg-x` con el valor de `--x`—, y ese camino pasa por el
 * `@theme` de `@kamayuk/ui` y por la compilacion de ESTE frontend, que son otros.
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

/**
 * `--azul: #005284;` -> `{ azul, #005284 }`. Los VALORES, que es lo que tiene que salir en el CSS.
 *
 * Se cogen los opacos y los translucidos —hexadecimales y `rgba()`—: buscar solo `#rrggbb` deja
 * fuera los velos y los realces de la barra, y pareceria que faltan cinco.
 *
 * Se lee **al llamar** y no en el cuerpo del modulo: la hoja del artboard puede faltar, y entonces
 * lo que tiene que salir es un rojo que la nombre y no una recoleccion muerta (`rentas`#78).
 */
function coloresDelArtboard(): readonly { readonly nombre: string; readonly valor: string }[] {
  const hoja = artboardDeclarado('normativa-tokens.css');
  const ruta = rutaDe(hoja);
  if (!existsSync(ruta)) {
    throw new Error(`FALTA ${hoja.archivo}\n  De donde se trae: ${hoja.deDonde}`);
  }
  return [
    ...readFileSync(ruta, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6}|rgba\([^)]*\))\s*;/gi),
  ].map(([, nombre, valor]) => ({
    nombre: nombre ?? '',
    valor: (valor ?? '').replace(/\s+/g, ' '),
  }));
}

/** El valor de `--radio` del artboard: el que shadcn tiene que acabar leyendo en `--radius`. */
function radioDelArtboard(): string {
  const ruta = rutaDe(artboardDeclarado('normativa-tokens.css'));
  const valores = [
    ...new Set(
      [
        ...readFileSync(ruta, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .matchAll(/--radio[a-z0-9-]*\s*:\s*([^;]+);/gi),
      ].map(([, valor]) => (valor ?? '').trim()),
    ),
  ];
  if (valores.length !== 1) {
    throw new Error(
      `El artboard declara ${String(valores.length)} radios distintos —${valores.join(', ')}—, y ` +
        'esta guarda compara contra UNO. Si el cambio es deliberado, aqui hay que decir cual manda.',
    );
  }
  return valores[0] ?? '';
}

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

  it('CADA color del artboard genera su utilidad, con su valor', async () => {
    // Se pide `bg-<token>` de TODOS a proposito. Tailwind v4 **solo emite lo que se usa**, asi que
    // preguntar por las clases que hoy se escriben mediria que tokens estan en uso, no que la paleta
    // funcione. Pidiendolos todos se mide el CAMINO: que de `--color-x` salga `bg-x` y que lleve el
    // valor que el artboard dibuja.
    //
    // Es el modo de fallo de `kamayuk-lib`#8 en su forma general: un token bien escrito con el
    // prefijo equivocado deja la paleta «puesta» y las utilidades sin generar.
    const colores = coloresDelArtboard();
    expect(colores.length, 'el artboard no declaro ni un color').toBeGreaterThan(30);

    const reglas = reglasDe(await compilar(colores.map((c) => `bg-${c.nombre}`)));
    // La paleta del `@theme`, que es la que la utilidad apunta con su `var(--color-x)`. Las de
    // `temas.css` quedan fuera a proposito: ver `paletaDelTema` y `rentas`#139.
    const paleta = paletaDelTema(reglas);

    const mudos = colores
      .filter((c) => utilidadDesnuda(reglas, `bg-${c.nombre}`) === undefined)
      .map((c) => `  --${c.nombre}: no genera «bg-${c.nombre}»`);

    const torcidos = colores.flatMap((c) => {
      const utilidad = utilidadDesnuda(reglas, `bg-${c.nombre}`);
      if (utilidad === undefined) return [];
      // Lo que la REGLA declara, con su `var(--color-x)` resuelto. Una utilidad de color no lleva el
      // hexadecimal dentro: lleva el token, y sin seguirlo no hay valor que comparar.
      const declarado = utilidad.declaraciones.get('background-color') ?? '(sin background-color)';
      const emitido = resolver(declarado, paleta);
      if (emitido === c.valor.toLowerCase()) return [];
      return [`  --${c.nombre}: «bg-${c.nombre}» pinta «${emitido}» y el artboard dice «${c.valor}»`];
    });

    expect(
      [...mudos, ...torcidos],
      'La paleta del artboard no llega entera al CSS:\n' +
        `${[...mudos, ...torcidos].join('\n')}\n\n` +
        '  Un token declarado cuya utilidad no se genera deja al elemento sin estilo, y eso no lo\n' +
        '  ve ninguna prueba que compare `className` como texto. Y una utilidad que se genera con\n' +
        '  otro valor pinta la pantalla de un color que nadie dibujo: lo que se compara es lo que\n' +
        '  declara la REGLA `.bg-<nombre>`, no que el hexadecimal ande suelto por el CSS.',
    ).toEqual([]);
  });

  it('el RADIO emitido es el del ARTBOARD, y no el `0.625rem` de shadcn', async () => {
    const css = await compilar(['rounded-sm', 'rounded-md', 'rounded-lg']);
    // Es la mitad que falta de `kamayuk-lib`#8: alli se comprobo que el token se declara.
    expect(css).not.toContain('0.625rem');
    for (const clase of ['rounded-sm', 'rounded-md', 'rounded-lg']) {
      expect(css, `no se emitio .${clase}`).toContain(`.${clase}`);
    }

    // Y el valor sale del artboard y no de un literal escrito aqui: lo que se compara es la regla
    // `.rounded-*` con su `var(--radius-*)` resuelto contra el `@theme`.
    const esperado = radioDelArtboard();
    expect(esperado, 'el artboard no declara ningun radio').not.toBe('');
    const reglas = reglasDe(css);
    const paleta = paletaDelTema(reglas);
    const torcidos = ['rounded-sm', 'rounded-md', 'rounded-lg'].flatMap((clase) => {
      const utilidad = utilidadDesnuda(reglas, clase);
      if (utilidad === undefined) return [`  .${clase}: no se emitio su regla`];
      const emitido = resolver(utilidad.declaraciones.get('border-radius') ?? '', paleta);
      return emitido === esperado
        ? []
        : [`  .${clase}: emite «${emitido}» y el artboard dice «${esperado}»`];
    });
    expect(
      torcidos,
      'El radio emitido se aparto del que dibuja el artboard:\n' +
        `${torcidos.join('\n')}\n\n` +
        '  Sin `--radius` los componentes de shadcn caen en su `0.625rem` por omision, y la pantalla\n' +
        '  sale con las esquinas de otro sistema de diseño sin que nada falle.',
    ).toEqual([]);
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
