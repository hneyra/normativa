import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { RAIZ, leer, sinComentarios } from './tokens.ts';

/**
 * #24 — el hueco del `Lienzo` ya no lleva el campo «Observación», y **no puede volver**.
 *
 * <h2>Lo que se quito, y por que</h2>
 *
 * Desde #12 el hueco del lienzo traia un campo «Observación» para demostrar la mecanica de la
 * pestana sucia (AC6) cuando no habia ninguna seccion construida. Colgaban de el dos props de
 * `LienzoProps` —`observacion` y `alEscribirObservacion`— y un estado del marco
 * —`observaciones`, con su `fijarObservaciones`, uno por clave—. Con #14 y #15 las cuatro
 * secciones estan cableadas, al hueco no llega ningun submodulo propio, y todo eso se quedo sin
 * alcanzar. #24 eligio quitarlo; el motivo entero esta en el javadoc de `Lienzo`.
 *
 * <h2>Por que esto no lo puede probar una prueba de comportamiento</h2>
 *
 * Por lo mismo que `marco-sin-selector.test.ts`: **una rama a la que no llega nadie no se ve**.
 * Con el campo repuesto en el hueco, la pantalla se dibuja exactamente igual —al hueco no se
 * llega—, todas las pruebas del marco siguen verdes, y `tsc` y ESLint tambien: una prop opcional
 * que nadie pasa no es un error de tipos, y un componente que se importa y se usa en una rama
 * inalcanzable no es una variable sin usar. Lo unico que cambia es que vuelve a haber codigo que
 * ninguna prueba puede poner en rojo. Asi que se lee el codigo fuente.
 *
 * <h2>Y lo que el hueco CONSERVA</h2>
 *
 * Su `Aviso`, que es la red de AC4: la prueba `ningun submodulo propio cae al hueco` de
 * `Marco.test.tsx` busca su titulo. Si el hueco desapareciera, un submodulo sin cablear
 * dibujaria un lienzo en blanco, esa prueba no encontraria el titulo **y saldria verde**. Quitar
 * el campo no puede llevarse por delante la red, y por eso se comprueba aqui tambien.
 */

/** El directorio del marco. */
const MARCO = join(RAIZ, 'src/marco');

/** Sus archivos de codigo, sin las pruebas: es donde vivian la prop y el estado. */
const archivosDelMarco = readdirSync(MARCO).filter(
  (nombre) =>
    /\.tsx?$/.test(nombre) && !nombre.endsWith('.test.ts') && !nombre.endsWith('.test.tsx'),
);

/**
 * El codigo sin comentarios Y sin cadenas entre comillas.
 *
 * Sin comentarios, porque el javadoc de `Lienzo` y el comentario de `Marco` NOMBRAN la prop y el
 * estado para explicar por que no estan: sin quitarlos, la prosa que documenta la decision
 * pondria rojo justo lo que documenta.
 *
 * Y sin cadenas, porque la palabra tambien es prosa de pantalla: medido, `BarraGlobal.tsx`
 * avisa de que al cerrar sesion «se pierden, y con ellas las observaciones», y ese texto es
 * cierto —se pierden las de «Ediciones»— y no es ningun identificador. Se quitan las cadenas de
 * comilla simple y doble **de una sola linea**: una comilla suelta en un texto JSX no puede
 * tragarse mas que su propia linea. Las plantillas con acento grave NO se quitan, porque llevan
 * codigo dentro de sus `${…}`.
 *
 * Es un recorte y se dice: el orden es bloques, lineas y cadenas, asi que un `//` dentro de una
 * cadena corta esa linea. En `src/marco/` no hay ninguno, y si lo hubiera el efecto seria un
 * falso VERDE de esa linea, nunca un rojo. Lo que impide que el recorte se coma el archivo entero
 * en silencio es el caso «lo que se lee es codigo» de abajo.
 */
const soloCodigo = (fuente: string): string =>
  sinComentarios(fuente)
    .replace(/\/\/.*$/gm, '')
    .replace(/'[^'\n]*'|"[^"\n]*"/g, '');

/** Solo sin comentarios: las clases CSS y los textos de pantalla viven en cadenas. */
const sinNingunComentario = (fuente: string): string =>
  sinComentarios(fuente).replace(/\/\/.*$/gm, '');

const lienzo = leer(join(MARCO, 'Lienzo.tsx'));
const marco = leer(join(MARCO, 'Marco.tsx'));

/** Lo que colgaba del campo del hueco, con lo que era cada cosa. */
const RASTROS: ReadonlyArray<readonly [string, string]> = [
  ['observacion', 'la prop de `LienzoProps` que llevaba lo escrito en el campo del hueco'],
  ['alEscribirObservacion', 'la prop con la que el hueco lo devolvia al marco'],
  ['observaciones', 'el estado del marco, uno por clave, que solo servia al hueco'],
  ['fijarObservaciones', 'su `set`'],
];

describe('#24 — hay codigo que leer, y lo que se lee es codigo', () => {
  it('el marco tiene sus archivos, y entre ellos el Lienzo y el Marco', () => {
    // Sin esta comprobacion, un directorio renombrado dejaria la lista vacia y los casos de
    // abajo pasarian sin haber leido un solo archivo.
    expect(archivosDelMarco.length).toBeGreaterThanOrEqual(8);
    expect(archivosDelMarco).toContain('Lienzo.tsx');
    expect(archivosDelMarco).toContain('Marco.tsx');
  });

  it('el recorte deja ver las props que SI estan, y el Marco montando el Lienzo', () => {
    // Si `soloCodigo` se tragara el archivo —una comilla que empareja con otra lejana, un
    // comentario sin cerrar—, los rastros de abajo saldrian verdes por no haber nada que mirar.
    // Estas son las piezas vivas del mismo sitio donde vivian las que se quitaron.
    const delLienzo = soloCodigo(lienzo);
    expect(delLienzo).toMatch(/export interface LienzoProps\s*\{/);
    expect(delLienzo).toMatch(/readonly alEnsuciar\s*:/);
    expect(delLienzo).toMatch(/readonly ediciones\s*:/);
    expect(delLienzo).toMatch(/export function Lienzo\s*\(/);

    const delMarco = soloCodigo(marco);
    expect(delMarco).toMatch(/export function Marco\s*\(/);
    expect(delMarco).toMatch(/\[ediciones, fijarEdiciones\]\s*=\s*useState/);
    expect(delMarco).toMatch(/<Lienzo\b/);
  });
});

describe('#24 AC2 — no queda una prop ni un estado del campo del hueco', () => {
  it.each(RASTROS)('no queda ni un «%s» (%s)', (identificador) => {
    const patron = new RegExp(`\\b${identificador}\\b`);
    const donde = archivosDelMarco.filter((nombre) =>
      patron.test(soloCodigo(leer(join(MARCO, nombre)))),
    );

    expect(
      donde,
      `«${identificador}» vuelve a estar en el codigo del marco. Servia al campo «Observación»\n` +
        'del hueco del Lienzo, al que no llega ningun submodulo propio desde #14 y #15: es\n' +
        'codigo que ninguna prueba de comportamiento puede poner en rojo. Lo que se escribe,\n' +
        'se escribe en una seccion, y la seccion guarda su observacion en su estado (#24).',
    ).toEqual([]);
  });

  it('la caja «.kn-marco__observacion» no vuelve, ni en la hoja ni en el marco', () => {
    const hoja = sinComentarios(leer(join(RAIZ, 'src/estilos/marco.css')));
    const enElMarco = archivosDelMarco.filter((nombre) =>
      sinNingunComentario(leer(join(MARCO, nombre))).includes('kn-marco__observacion'),
    );

    expect(
      hoja.includes('kn-marco__observacion'),
      'La hoja vuelve a declarar la caja del campo del hueco, que no usa nadie desde #24.',
    ).toBe(false);
    expect(enElMarco).toEqual([]);
  });
});

describe('#24 — el Lienzo no dibuja ningun campo propio', () => {
  const delLienzo = soloCodigo(lienzo);

  it('no importa ni monta un «Campo», ni escribe un control de formulario a mano', () => {
    expect(
      delLienzo.match(/\bCampo\b|<(?:input|textarea|select)\b/g) ?? [],
      'El Lienzo vuelve a dibujar un campo. El lienzo decide QUE seccion se monta; los campos\n' +
        'son de las secciones, que son las que guardan lo escrito. En los estados propios del\n' +
        'lienzo —sin pestanas, la ficha ajena, el hueco— no se guarda nada (#24).',
    ).toEqual([]);
  });

  it('no ensucia la pestana por su cuenta: «alEnsuciar» lo pasa, no lo llama', () => {
    // Pasarlo a «Ediciones» es `alEnsuciar={alEnsuciar}`. LLAMARLO desde el lienzo es lo que
    // hacia el campo del hueco, y es la firma de que el lienzo vuelve a tener algo editable.
    expect(
      delLienzo.match(/\balEnsuciar\s*\(/g) ?? [],
      'El Lienzo llama a alEnsuciar: vuelve a tener algo que se escribe fuera de una seccion.',
    ).toEqual([]);
    expect(delLienzo).toMatch(/alEnsuciar=\{alEnsuciar\}/);
  });
});

describe('#24 AC4 — el hueco conserva su red', () => {
  it('sigue habiendo un hueco, con su Aviso y el titulo que busca Marco.test.tsx', () => {
    const conCadenas = sinNingunComentario(lienzo);
    const hueco = conCadenas.slice(conCadenas.indexOf('kn-marco__hueco'));
    const prueba = leer(join(MARCO, 'Marco.test.tsx'));

    expect(conCadenas.indexOf('kn-marco__hueco'), 'el hueco tiene que existir').toBeGreaterThan(-1);
    expect(
      hueco,
      'Sin el Aviso del hueco, un submodulo que el arbol declara y el Lienzo no sabe dibujar\n' +
        'saldria como un lienzo en blanco, y «ningun submodulo propio cae al hueco» no\n' +
        'encontraria su titulo: saldria VERDE justo en el defecto que existe para cazar.',
    ).toMatch(/<Aviso[\s\S]*todavía no está construida/);
    // Las dos mitades de la red tienen que hablar del mismo texto: si el titulo cambia aqui y no
    // alli, la prueba de comportamiento busca una frase que ya no se dibuja y sale verde.
    expect(prueba).toContain('/todavía no está construida/');
  });
});
