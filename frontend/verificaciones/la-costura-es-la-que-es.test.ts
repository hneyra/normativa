// @vitest-environment node
//
// Lee un archivo del disco y mira su texto. No es un DOM lo que necesita.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * **`src/aplicacion.tsx` es una costura, y nada mas** (#55, AC 3).
 *
 * <h2>Que protege, y de que</h2>
 *
 * De lo unico que puede hacer que la ola 1 y la ola 2 de la epica #47 se pisen: que dos issues
 * editen el mismo archivo. `src/aplicacion.tsx` **lo toca solo #55**; #57, #58, #60, #63 y #64
 * escriben cada uno en su costura. Eso no se sostiene con un acuerdo, porque el acuerdo se rompe
 * con la mejor intencion: quien tenga que poner un titulo lo escribe donde se dibuja, que es aqui.
 *
 * Y el precio de que se rompa no es un conflicto de `git`, que se ve: es un conflicto de `git`
 * **en un archivo que las cinco ramas tocaron por motivos distintos**, resuelto a mano por quien
 * mezcle el ultimo, sin que nada diga cual de las cinco versiones era la buena.
 *
 * <h2>Las tres cosas que se exigen, y por que cada una</h2>
 *
 * 1. **Solo importa de `@kamayuk/*`, de `react` y de las ocho costuras.** Un `import` de
 *    cualquier otro sitio es codigo de un issue posterior que entro por aqui: el cliente de la
 *    API (#57), una definicion de pantalla (#58), el `i18next` (#60).
 * 2. **Exporta `Aplicacion`.** Es lo que `main.tsx` monta. Sin esto, las otras dos se cumplirian
 *    en un archivo vacio.
 * 3. **No declara ni un literal de texto visible.** Es la que muerde de verdad: un titulo, una
 *    entidad o el rotulo de una opcion escritos aqui son exactamente lo que #58, #57 y #64 tienen
 *    que poder cambiar **sin abrir este archivo**. Y hay un segundo motivo, que es de G2 (#52):
 *    la municipalidad y la cuenta salen de la sesion y **nunca van como literal**; escritas aqui
 *    las veria cualquier municipalidad que no fuera esa.
 *
 * <h2>Que cuenta como «texto visible», y por que asi</h2>
 *
 * Una cadena que lleve un espacio —o sea una frase— o una letra con tilde o eñe. Es una regla
 * corta y se puede decir en una linea: **lo que una persona lee tiene espacios o acentos; una
 * clave de configuracion, no**. Deja pasar `'institucional'` y `'kamayuk.normativa'`, que son las
 * dos decisiones que este archivo SI toma, y no deja pasar «Sistema de Gestión de Rentas y
 * Tributos Municipales» ni «Municipalidad Distrital de Catacaos».
 *
 * Los especificadores de `import` se descartan antes: `'./marca.ts'` es una cadena y no es texto.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/** El archivo que este issue se reserva. */
const LA_COSTURA = 'src/aplicacion.tsx';

/**
 * Las ocho costuras, con el issue que llena cada una. La tabla del AC 3 de #55, como dato.
 *
 * La lista se escribe entera y no se cuenta: anadir una costura exige decir cual y de quien es, y
 * este rojo es la unica senal de que la superficie que `aplicacion.tsx` toca acaba de crecer.
 */
const COSTURAS: readonly { readonly modulo: string; readonly duenio: string }[] = [
  { modulo: './acciones.ts', duenio: '#58, #67, #68' },
  { modulo: './arranque.ts', duenio: '#57 — lo importa `main.tsx`, no este archivo' },
  { modulo: './catalogo.ts', duenio: '#58, #64' },
  { modulo: './datos/proveedor.tsx', duenio: '#63' },
  { modulo: './i18n/armazon.ts', duenio: '#60' },
  { modulo: './marca.ts', duenio: '#58, tras G2' },
  { modulo: './pantallas/index.ts', duenio: '#58' },
  { modulo: './sesion.ts', duenio: '#57, #64' },
];

/** De donde mas puede importar: la libreria y React. Nada mas. */
const ADEMAS = (especificador: string): boolean =>
  especificador.startsWith('@kamayuk/') || especificador === 'react' || especificador === 'react-dom';

/** El texto sin comentarios: la prosa de este archivo NOMBRA lo que prohibe, y lo nombra mucho. */
export function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/** Los especificadores de los `import` de un modulo, en orden. */
export function importesDe(fuente: string): string[] {
  const texto = sinComentarios(fuente);
  return [...texto.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s*['"]([^'"]+)['"]/g)].map(
    ([, especificador]) => especificador ?? '',
  );
}

/**
 * Las cadenas que un modulo escribe SIN contar las de sus `import`.
 *
 * Se quitan las lineas de `import` enteras antes de buscar: su especificador es una cadena y no es
 * texto de interfaz, y distinguirlo despues obligaria a comparar contra la lista de importes —que
 * es justo lo que haria que un `import './Titulo bonito.ts'` se colara—.
 */
export function cadenasDe(fuente: string): string[] {
  const texto = sinComentarios(fuente).replace(/(?:^|\n)\s*import\s[^;]*?;/g, '\n');
  return [
    ...[...texto.matchAll(/'([^'\n\\]*)'/g)].map(([, c]) => c ?? ''),
    ...[...texto.matchAll(/"([^"\n\\]*)"/g)].map(([, c]) => c ?? ''),
    ...[...texto.matchAll(/`([^`\\$]*)`/g)].map(([, c]) => c ?? ''),
  ];
}

/** Lo que una persona lee: lleva un espacio, o una letra con tilde o eñe. Ver el javadoc. */
export const esTextoVisible = (cadena: string): boolean =>
  /\s/.test(cadena) || /[áéíóúüñÁÉÍÓÚÜÑ]/.test(cadena);

describe('src/aplicacion.tsx es la costura, y la lista de costuras es la del issue', () => {
  it('EL CENTINELA: el archivo esta, se lee AQUI DENTRO, y el extractor discrimina', () => {
    // 1) Leerlo dentro del `it` y no en el cuerpo del modulo: con el archivo movido de sitio, un
    //    `readFileSync` arriba reventaria la RECOLECCION y este archivo saldria como «Failed
    //    Suites» sin una sola prueba — o sea, la guarda se callaria justo cuando hay que mirarla.
    const ruta = join(FRONTEND, LA_COSTURA);
    expect(existsSync(ruta), `falta «${LA_COSTURA}», que es lo que esta guarda vigila`).toBe(true);
    const fuente = readFileSync(ruta, 'utf8');
    expect(fuente.length, 'el archivo esta vacio').toBeGreaterThan(200);

    // 2) La lista de costuras dice algo. Sin esto, todo lo de abajo pasaria sobre el conjunto
    //    vacio el dia que alguien la vaciara, que es como una guarda se queda sin sujeto.
    expect(COSTURAS.length, 'COSTURAS esta vacia: la guarda no permitiria ningun import').toBe(8);

    // 3) Y LAS MUESTRAS: el extractor tiene que ver lo que se prohibe y dejar pasar lo que no.
    //    Escritas a mano aqui y no en `muestras/`, porque lo que se ejercita no es una regla de
    //    ESLint sobre un archivo sino dos funciones sobre un texto.
    const mala = [
      "import { Armazon } from '@kamayuk/shell';",
      "// import { X } from './esto-es-un-comentario.ts';",
      "const TITULO = 'Sistema de Gestión de Rentas y Tributos Municipales';",
      "const TEMA = { identidadPorOmision: 'institucional' };",
    ].join('\n');
    expect(importesDe(mala)).toEqual(['@kamayuk/shell']);
    expect(cadenasDe(mala).filter(esTextoVisible)).toEqual([
      'Sistema de Gestión de Rentas y Tributos Municipales',
    ]);
    // Y la clave de configuracion NO cuenta como texto: una guarda que diera rojo sobre
    // `institucional` se acabaria desactivando.
    expect(esTextoVisible('institucional')).toBe(false);
    expect(esTextoVisible('kamayuk.normativa')).toBe(false);
  });

  it('solo importa de `@kamayuk/*`, de react y de las ocho costuras', () => {
    const fuente = readFileSync(join(FRONTEND, LA_COSTURA), 'utf8');
    const permitidas = new Set(COSTURAS.map((c) => c.modulo));
    const ajenos = importesDe(fuente).filter((e) => !permitidas.has(e) && !ADEMAS(e));

    expect(
      ajenos,
      `«${LA_COSTURA}» importa de fuera de sus costuras:\n` +
        `${ajenos.map((e) => `  ${e}`).join('\n')}\n\n` +
        '  Este archivo lo toca SOLO #55 (epica #47). Lo que haga falta entra por su costura, y\n' +
        '  cada una tiene duenio:\n' +
        `${COSTURAS.map((c) => `    ${c.modulo} — ${c.duenio}`).join('\n')}`,
    ).toEqual([]);
  });

  it('y ninguna costura se queda sin usar: la lista y el archivo dicen lo mismo', () => {
    // La otra direccion. Sin esto, la lista podria crecer con costuras que nadie enchufa —y
    // entonces no serian costuras: serian archivos muertos con un javadoc prometiendo algo.
    //
    // `./arranque.ts` es la excepcion declarada, y esta en la lista a proposito: lo importa
    // `main.tsx`, porque el montaje va DENTRO de `arrancar`. Si se exigiera aqui, la unica forma
    // de cumplirlo seria mover el montaje, que es justo lo que no se quiere.
    const fuente = readFileSync(join(FRONTEND, LA_COSTURA), 'utf8');
    const importados = new Set(importesDe(fuente));
    const enMain = new Set(importesDe(readFileSync(join(FRONTEND, 'src/main.tsx'), 'utf8')));
    const sueltas = COSTURAS.filter((c) => !importados.has(c.modulo) && !enMain.has(c.modulo));

    expect(
      sueltas.map((c) => `  ${c.modulo} (${c.duenio})`),
      'Hay costuras que no las enchufa nadie: un archivo que no se importa no es una costura,\n' +
        'es codigo muerto con un javadoc prometiendo algo.',
    ).toEqual([]);
  });

  it('exporta `Aplicacion`, que es lo que monta `main.tsx`', () => {
    const fuente = sinComentarios(readFileSync(join(FRONTEND, LA_COSTURA), 'utf8'));
    expect(
      fuente,
      'Sin esto, las otras dos comprobaciones se cumplirian en un archivo vacio.',
    ).toMatch(/export\s+function\s+Aplicacion\s*\(/);
  });

  it('y NO declara ni un literal de texto visible', () => {
    const fuente = readFileSync(join(FRONTEND, LA_COSTURA), 'utf8');
    const visibles = cadenasDe(fuente).filter(esTextoVisible);

    expect(
      visibles.map((c) => `  «${c}»`),
      `«${LA_COSTURA}» escribe texto que una persona lee:\n` +
        `${visibles.map((c) => `  «${c}»`).join('\n')}\n\n` +
        '  Un titulo, una entidad o el rotulo de una opcion escritos aqui son lo que #58, #57 y\n' +
        '  #64 tienen que poder cambiar sin abrir este archivo. Y la municipalidad y la cuenta\n' +
        '  NUNCA van como literal en ningun sitio: son de la sesion (G2, #52).\n' +
        '  El sitio es `src/marca.ts` para lo que nombra al sistema y `src/sesion.ts` para lo que\n' +
        '  nombra a quien entro.',
    ).toEqual([]);
  });
});
