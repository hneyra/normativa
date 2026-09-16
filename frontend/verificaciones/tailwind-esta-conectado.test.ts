// @vitest-environment node
//
// En `node` y no en jsdom: importar `vite.config.ts` de verdad —en vez de leerlo como texto, que
// permitiria que la configuracion dijera una cosa y la prueba comprobara otra— arrastra a
// esbuild, que bajo jsdom muere con «Invariant violation: new TextEncoder().encode("")
// instanceof Uint8Array is incorrectly false».
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import configuracion from '../vite.config.ts';
import { ESPECIFICADOR_DE_LA_HOJA } from './especificadores.ts';
import { fuentesDeclaradas } from './tailwind.ts';

/**
 * **Tailwind procesa de verdad** (`rentas`#90, AC2).
 *
 * **Calcado de `rentas/frontend/verificaciones/` en `ac379ac`** (`normativa`#55), mas un bloque al
 * final con lo que `rentas` comprueba de `src/estilos.css` desde su `la-v6-no-esta.test.ts`: que
 * importe la hoja de la libreria, que no declare un color y que cada `@source` apunte a algo. Aqui
 * vive junto al complemento porque es la otra mitad de «Tailwind esta conectado», y porque la
 * propia hoja —en las dos copias— dice que lo comprueba este archivo.
 *
 * <h2>Lo que esto anade a lo que `rentas`#91 ya comprueba</h2>
 *
 * `rentas`#91 compila la hoja de `@kamayuk/ui` **dentro de la prueba** y mide que la paleta genera
 * sus utilidades. Eso demuestra que la paleta funciona; **no** demuestra que este frontend la
 * procese. Son dos cosas distintas y hasta `rentas`#90 solo era cierta la primera: las clases
 * estaban escritas y no las leia nadie.
 *
 * Con el complemento fuera, todo sigue compilando y todas las pruebas siguen pasando —comparan
 * `className` como texto—, y la aplicacion sale **sin un solo estilo**. Es el fallo mas silencioso
 * que puede tener una interfaz: el HTML es correcto, la consola esta limpia, y la pantalla es una
 * columna de texto negro sobre blanco.
 *
 * <h2>Por que se mira la configuracion y no el CSS emitido</h2>
 *
 * Porque emitirlo exige un `vite build` entero —9 s— en cada corrida de la suite, y lo que se
 * quiere saber aqui cabe en una linea: que el complemento esta puesto. Que lo que emite es
 * correcto es justo lo que `rentas`#91 mide, y esa prueba si compila de verdad.
 */

/** Los nombres de los complementos, sea cual sea la profundidad a la que Vite los anide. */
function aplanar(valor: unknown): { name?: string }[] {
  if (Array.isArray(valor)) return valor.flatMap((x: unknown) => aplanar(x));
  if (valor === null || valor === undefined) return [];
  return [valor as { name?: string }];
}

describe('Tailwind esta conectado a este frontend', () => {
  // Aplanado a mano y no con `flat(Infinity)`: el tipo de `plugins` de Vite es recursivo y con
  // `Infinity` el compilador se rinde —`TS2589: Type instantiation is excessively deep and
  // possibly infinite`—. Aqui solo interesan los nombres.
  const complementos = aplanar(configuracion.plugins ?? []);

  it('EL CENTINELA: la configuracion trae complementos', () => {
    // Sin esto, un `plugins` que dejara de existir —o un cambio de forma en la configuracion—
    // dejaria la lista vacia y la comprobacion de abajo fallando por el motivo equivocado, o
    // pasando si alguien la invirtiera.
    expect(complementos.length, 'vite.config.ts no declaro ni un complemento').toBeGreaterThan(1);
  });

  it('el complemento de Tailwind esta puesto', () => {
    const nombres = complementos.map((c) => c?.name ?? '').filter((n) => n !== '');
    expect(
      nombres.some((n) => n.includes('tailwind')),
      'Sin el complemento, las clases de `@kamayuk/ui` y del interprete no producen CSS: la\n' +
        'aplicacion sale sin un solo estilo y NADA se pone rojo — las pruebas comparan\n' +
        `\`className\` como texto. Complementos declarados: ${nombres.join(', ')}`,
    ).toBe(true);
  });

  it('y va ANTES que el de React', () => {
    // No es indiferente: el de Tailwind tiene que ver los archivos para saber que clases se usan.
    const nombres = complementos.map((c) => c?.name ?? '');
    const tailwind = nombres.findIndex((n) => n.includes('tailwind'));
    const react = nombres.findIndex((n) => n.includes('react'));
    expect(tailwind, 'no esta el de Tailwind').toBeGreaterThanOrEqual(0);
    expect(react, 'no esta el de React').toBeGreaterThanOrEqual(0);
    expect(tailwind).toBeLessThan(react);
  });
});

/** La hoja de ESTA aplicacion. */
const HOJA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'estilos.css');

describe('y `src/estilos.css` es la costura, y nada mas (`normativa`#55)', () => {
  const sinComentarios = readFileSync(HOJA, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('importa la hoja de la libreria, por su especificador', () => {
    // Sin esto no hay paleta, ni temas, ni `@import "tailwindcss"`: la hoja de la aplicacion
    // compilaria vacia y el complemento de arriba no tendria sobre que actuar.
    expect(sinComentarios).toContain(`@import '${ESPECIFICADOR_DE_LA_HOJA}'`);
  });

  it('no declara ni un color', () => {
    // La paleta la publica `@kamayuk/ui`. Un valor aqui seria una segunda fuente de verdad, y cual
    // gana depende del orden en que el empaquetador resuelva los modulos.
    const colores = [...sinComentarios.matchAll(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/gi)].map(
      ([c]) => c,
    );
    expect(colores, 'src/estilos.css escribe colores propios').toEqual([]);
  });

  it('declara `@source` para `ui` y `shell`, y cada uno apunta a algo que existe', () => {
    // Un `@source` a un directorio que no existe no es un error para Tailwind: no mira ahi y calla.
    // Que las clases de esos directorios LLEGUEN al CSS lo mide `tailwind-emite-las-clases`.
    const fuentes = fuentesDeclaradas(HOJA);
    expect(fuentes.map((f) => f.declarada)).toEqual([
      '../../../kamayuk-lib/paquetes/ui',
      '../../../kamayuk-lib/paquetes/shell',
    ]);
    for (const { declarada, resuelta } of fuentes) {
      expect(
        existsSync(resuelta),
        `«@source "${declarada}"» apunta a ${resuelta}, que no existe: Tailwind no mirara ahi y nadie lo dira`,
      ).toBe(true);
    }
  });
});
