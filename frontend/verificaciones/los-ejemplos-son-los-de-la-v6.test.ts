// @vitest-environment node
//
// Lee dos artboards y el Dockerfile, y compara texto. No es un DOM lo que necesita.

import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { artboardDeclarado, cadenasQueBuscaElDockerfile, rutaDe } from './artboards.ts';
import { artboardV8, ejemplosDe, tonoDeLaInsignia } from './artboard-v8.ts';

/**
 * **Los valores de ejemplo del artboard V8 son los de la V6, y no se inventan** (hneyra/normativa#52,
 * AC 4).
 *
 * <h2>Por que importa de donde sale un ejemplo</h2>
 *
 * En `normativa` un ejemplo no es relleno: es una cifra con forma de norma —una UIT, un valor por
 * metro cuadrado, un `sha256` de un derivado firmado—. Un `9,999.99` inventado en una celda se
 * leeria como una cifra del corpus que nadie transcribio ni verifico. Los del artboard V6 si salen
 * del corpus (`NormativaV6.dc.html:1173-1406`, con el archivo de cada uno), asi que la regla es
 * simple: **cada valor de ejemplo del V8 aparece literal en el V6**, salvo los de {@link SIN_ORIGEN},
 * cada uno con su motivo.
 *
 * <h2>Y los ejemplos tienen que seguir conteniendo lo que el `Dockerfile` busca</h2>
 *
 * La negativa de la imagen (`frontend/Dockerfile`) busca cinco cadenas del corpus en lo servido.
 * Si ninguna estuviera en el artboard, esa negativa buscaria algo que ya no existe en ningun sitio
 * del que pudiera colarse — una guarda que no puede fallar. Que esten entre los ejemplos es lo que
 * la mantiene con sujeto.
 *
 * <h2>Y cada decision lleva el tono que la V6 le da (hneyra/normativa#76)</h2>
 *
 * D-02b y D-03d dicen las dos «Abierta», y la V6 las pinta distinto porque el tono va en la fila
 * (`NormativaV6.dc.html:1343-1350`, `c01fe9a:frontend/src/secciones/panel.ts:118-160`): D-03d no
 * bloquea el sello, bloquea el cierre de caja. El artboard V8 de #52 lo sacaba del texto y pintaba
 * D-03d en «mal»; G2 lo devolvio a «atención». Un tono sacado del texto se equivoca en una sola
 * fila sin que nada lo diga, asi que se compara fila a fila con la V6.
 *
 * <h2>Se retira en hneyra/normativa#69</h2>
 *
 * Con la V6: `NormativaV6.dc.html` sale del arbol en ese issue, y sin el no hay contra que comparar.
 * Lo que queda entonces es que los ejemplos del V8 ya estan comprobados, y el V8 no se regenera.
 */

/**
 * Los valores de ejemplo del V8 que NO estan literales en el V6, cada uno con su motivo.
 *
 * Se mantiene corta a proposito: cada entrada es un ejemplo que nadie puede comprobar contra el
 * corpus, asi que tiene que decir de que se compone.
 */
const SIN_ORIGEN: readonly (readonly [valor: string, motivo: string])[] = [
  [
    '2026 · 2',
    'ejercicio y version de la edicion 2 de `EDICIONES` (NormativaV6.dc.html:1318), unidos con el ' +
      '« · » de `Publicacion.tsx`; el V6 los compone en ejecucion y no los escribe juntos',
  ],
  [
    'conjunto 2 · ejercicio 2026 · versión 2',
    'la identidad de la edicion 2, compuesta como la compone `identidadDe` en `publicacion.ts`',
  ],
  [
    '549',
    'las filas del snapshot `2-VALUACION` de `SNAPSHOTS` (NormativaV6.dc.html:1402): 33 + 24 + 492, ' +
      'que el V6 suma en ejecucion',
  ],
  [
    'son distintas',
    'texto de `Publicacion.tsx` para dos huellas distintas —las de `2-VALUACION` y `2-OBLIGACION`—; ' +
      'no es una cifra',
  ],
  [
    'valor_unitario_edificacion',
    'el nombre de la tabla, constante de `cuadros.ts`; no es un dato servido ni una cifra',
  ],
  [
    'valor_referencial_vehiculo',
    'el nombre de la tabla, constante de `cuadros.ts`; no es un dato servido ni una cifra',
  ],
];

describe('los ejemplos del artboard V8 son los de la V6', () => {
  it('EL CENTINELA: hay ejemplos que comprobar, y el V6 se leyo', () => {
    // Las dos lecturas, aqui dentro: si falta un artboard, rojo nombrandolo, no una suite muerta.
    const v6 = artboardDeclarado('NormativaV6.dc.html');
    expect(existsSync(rutaDe(v6)), `falta ${v6.archivo} (${v6.deDonde})`).toBe(true);
    expect(readFileSync(rutaDe(v6), 'utf8'), 'el V6 no trae sus datos').toContain(
      'const PARAMETROS = [',
    );
    expect(ejemplosDe(artboardDeclarado('NormativaV8.dc.html')).length).toBeGreaterThan(0);
  });

  it('cada valor de ejemplo aparece literal en NormativaV6.dc.html', () => {
    const v6 = artboardDeclarado('NormativaV6.dc.html');
    expect(existsSync(rutaDe(v6)), `falta ${v6.archivo} (${v6.deDonde})`).toBe(true);
    const texto = readFileSync(rutaDe(v6), 'utf8');
    const permitidos = new Set(SIN_ORIGEN.map(([valor]) => valor));

    const inventados = ejemplosDe(artboardDeclarado('NormativaV8.dc.html'))
      .filter(({ texto: valor }) => !permitidos.has(valor) && !texto.includes(valor))
      .map(({ donde, texto: valor }) => `  ${donde}: «${valor}»`);

    expect(
      inventados,
      'El artboard V8 lleva valores de ejemplo que no estan en el artboard V6:\n' +
        `${inventados.join('\n')}\n\n` +
        '  Un ejemplo con forma de cifra normativa se lee como del corpus. Se toma del V6\n' +
        '  (PARAMETROS, VALORES_UNITARIOS, DEPRECIACIONES, VALORES_REFERENCIALES, EDICIONES,\n' +
        '  SNAPSHOTS o las cifras del panel), o entra en SIN_ORIGEN diciendo de que se compone.',
    ).toEqual([]);
  });

  it('y SIN_ORIGEN no excusa nada que ya no haga falta excusar', () => {
    // Una entrada que el V8 ya no usa, o que ya esta literal en el V6, es una excepcion muerta: el
    // dia que alguien vuelva a escribir ese valor, entraria sin que nadie lo mire.
    const v6 = artboardDeclarado('NormativaV6.dc.html');
    expect(existsSync(rutaDe(v6)), `falta ${v6.archivo} (${v6.deDonde})`).toBe(true);
    const texto = readFileSync(rutaDe(v6), 'utf8');
    const usados = new Set(ejemplosDe(artboardDeclarado('NormativaV8.dc.html')).map((e) => e.texto));
    const muertas = SIN_ORIGEN.filter(([valor]) => !usados.has(valor) || texto.includes(valor)).map(
      ([valor]) => `  «${valor}»`,
    );
    expect(muertas, `Entradas de SIN_ORIGEN que ya no excusan nada:\n${muertas.join('\n')}`).toEqual(
      [],
    );
  });

  it('y cada decision del Panel lleva en su insignia el tono que le da la V6', () => {
    const v6 = artboardDeclarado('NormativaV6.dc.html');
    expect(existsSync(rutaDe(v6)), `falta ${v6.archivo} (${v6.deDonde})`).toBe(true);
    // Los nombres del V6 son los de su paleta; la V8 los dice en castellano (panel.ts:118).
    const castellano: Readonly<Record<string, string>> = {
      bad: 'mal',
      warn: 'atencion',
      ok: 'ok',
      info: 'info',
    };
    const deLaV6 = new Map(
      [
        ...readFileSync(rutaDe(v6), 'utf8').matchAll(
          /\{ id: '(D-[^']+)', estado: '[^']*', tono: '(\w+)'/g,
        ),
      ].map(([, id = '', tono = '']) => [id, castellano[tono] ?? `«${tono}» sin traducir`]),
    );

    const v8 = artboardDeclarado('NormativaV8.dc.html');
    const pintadas = Object.values(artboardV8(v8).pantallas)
      .flat()
      .flatMap((bloque) => {
        const tabla = bloque[3];
        const columna = tabla?.i;
        if (tabla === undefined || columna === undefined) return [];
        return tabla.f
          .filter((fila) => deLaV6.has(fila[0] ?? ''))
          .map((fila) => [fila[0] ?? '', tonoDeLaInsignia(v8, fila[columna] ?? '', fila)] as const);
      });

    // EL CENTINELA: las cuatro de la V6, y las cuatro pintadas. Sin esto, un cambio de forma en
    // cualquiera de los dos dejaria la comparacion sobre la lista vacia.
    expect(deLaV6.size, 'no se leyo `const DECISIONES` del V6').toBe(4);
    expect(
      pintadas.map(([id]) => id),
      'la tabla de decisiones del V8 no trae las cuatro de la V6 con su insignia',
    ).toEqual([...deLaV6.keys()]);

    const distintas = pintadas
      .filter(([id, tono]) => deLaV6.get(id) !== tono)
      .map(
        ([id, tono]) =>
          `  ${id}: el V8 la pinta en «${tono}» y la V6 en «${deLaV6.get(id) ?? ''}»`,
      );
    expect(
      distintas,
      'Una decision del Panel lleva otro tono que en la V6:\n' +
        `${distintas.join('\n')}\n\n` +
        '  El tono va EN LA FILA (TONOS.porFila del artboard), no en el texto: D-02b y D-03d dicen\n' +
        '  las dos «Abierta». G2 (hneyra/normativa#52) devolvio D-03d a «atención».',
    ).toEqual([]);
  });

  it('y entre ellos estan las cadenas que el Dockerfile busca en lo servido', () => {
    const buscadas = cadenasQueBuscaElDockerfile();
    expect(buscadas.length, 'el Dockerfile no busca ninguna cadena').toBeGreaterThan(0);
    const ejemplos = ejemplosDe(artboardDeclarado('NormativaV8.dc.html')).map((e) => e.texto);
    const ausentes = buscadas
      .filter((cadena) => !ejemplos.some((valor) => valor.includes(cadena)))
      .map((cadena) => `  «${cadena}»`);
    expect(
      ausentes,
      'El Dockerfile busca en lo servido cadenas que ya no estan entre los ejemplos del artboard V8:\n' +
        `${ausentes.join('\n')}\n\n` +
        '  Sin ellas, la negativa de la imagen busca algo que no existe en ningun sitio del que\n' +
        '  pudiera colarse: una guarda que no puede fallar.',
    ).toEqual([]);
  });
});
