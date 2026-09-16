// @vitest-environment node
//
// Lee el artboard del DISCO. Bajo jsdom `import.meta.url` no es una URL `file:` y
// `fileURLToPath` revienta con `TypeError: The URL must be of scheme file`.

import { tipoDe } from '@kamayuk/ui';
import type {
  CampoDeCasilla,
  CampoDeLista,
  CampoDeSoloLectura,
  DefinicionDeCampo,
  DefinicionDeTabla,
} from '@kamayuk/ui';
import { describe, expect, it } from 'vitest';

import { CLAVES_DE_HOJA, ARBOL } from '../src/pantallas/arbol.ts';
import { CATALOGO } from '../src/catalogo.ts';
import { PANTALLAS } from '../src/pantallas/definiciones/index.ts';
import { tonoDeLaInsignia } from '../src/pantallas/index.ts';
import type { Modulo, Pantalla } from '../src/pantallas/tipos.ts';
import { artboardDeclarado, type Artboard } from './artboards.ts';
import {
  artboardV8,
  bloquesDelArtboard,
  constanteDelArtboard,
  esDeSoloLectura,
  hojasDelArtboard,
  tonoDeLaInsignia as tonoDelArtboard,
  type BloqueDelArtboard,
  type CampoDelArtboard,
  type ModuloDelArtboard,
  type TablaDelArtboard,
} from './artboard-v8.ts';

/**
 * **La guarda anti-deriva: el codigo dice lo que el artboard dice** (#58, AC 7).
 *
 * Calcada de `rentas/frontend/verificaciones/pantallas-del-artboard.test.ts@ac379ac`, con **una
 * diferencia que no es de nombre**: alli las cuentas —10 modulos, 40 hojas, 45 bloques, 302
 * campos, 31 tablas— van escritas en el cuerpo de la prueba, y copiadas aqui afirmarian los numeros
 * de OTRO sistema. Aqui salen de `verificaciones/artboards.ts`, donde #52 las declaro **como dato,
 * junto al archivo que cuentan**.
 *
 * No cuenta pantallas: las **compara**, hoja por hoja, bloque por bloque, campo por campo y tipo por
 * tipo, contra `frontend/diseno/NormativaV8.dc.html` — el archivo vendorizado, no una copia de sus
 * datos escrita aqui. Si la lista viviera en esta prueba, cambiar el dato y cambiar la prueba serian
 * el mismo commit y nadie se enteraria.
 *
 * <h2>Que NO comprueba esta guarda, porque lo comprueba el compilador</h2>
 *
 * Que haya **una pantalla por hoja y ninguna de mas** no se afirma aqui con un `expect`:
 * `PANTALLAS` esta declarado `satisfies Record<ClaveDeHoja, Pantalla>` y `ClaveDeHoja` sale del
 * propio `ARBOL`, asi que una hoja sin pantalla no compila. Lo que si se afirma aqui es que el arbol
 * del que sale `ClaveDeHoja` **sea el del artboard**, que es la mitad que el compilador no sabe.
 *
 * <h2>Por que el disco se toca dentro de cada `it`</h2>
 *
 * Es la leccion de `rentas`#78, y `artboard-v8.ts` la escribe entera: una guarda que lee su artboard
 * en el cuerpo del modulo muere durante la RECOLECCION con un `ENOENT` el dia que el archivo no
 * esta, y sus `it` no llegan a existir. Aqui la lista de casos sale de `CLAVES_DE_HOJA` —que es
 * codigo importado y no puede faltar— y el artboard se lee dentro del caso: si falta, salen cuatro
 * rojos que **nombran el archivo** con su procedencia.
 */

/** El artboard contra el que se compara, declarado en `artboards.ts`. */
const NORMATIVA_V8 = (): Artboard => artboardDeclarado('NormativaV8.dc.html');

/** Las cuentas que #52 midio sobre el. Sin ellas no hay centinela que valga. */
function cuentas() {
  const declaradas = NORMATIVA_V8().cuentas;
  if (declaradas === undefined) {
    throw new Error(
      '`NormativaV8.dc.html` esta declarado en `artboards.ts` SIN sus cuentas. Son el centinela de ' +
        'esta guarda: sin ellas, una extraccion vacia compararia nada con nada, en verde.',
    );
  }
  return declaradas;
}

/* ── De nuestro dato a la forma del artboard ───────────────────────────────────────────── */
//
// Un solo adaptador, y no dos descriptores. Convertir nuestro lado a la forma posicional del
// artboard y describir las dos desde ahi deja una sola pieza que pueda equivocarse; con un
// descriptor por lado, el dia que uno derive el otro le seguiria la corriente.

/**
 * Las tres ramas de la union que llevan un tercer elemento, reconocidas **por su `tipo`**.
 *
 * Por el literal y no por `tipoDe(campo.tipo)`, aunque aquella sea la funcion que el interprete usa
 * para elegir la pieza: `tipoDe` devuelve un `TipoDeCampo` y **no estrecha la union**, asi que
 * `campo.opciones` no compila detras de ella. Que las dos formas de mirar coincidan lo comprueba el
 * centinela de mas abajo, con lo cual esto no es una segunda tabla que pueda divergir.
 */
const esLista = (campo: DefinicionDeCampo): campo is CampoDeLista =>
  campo.tipo === 's' || campo.tipo === 's1';
const esSoloLectura = (campo: DefinicionDeCampo): campo is CampoDeSoloLectura =>
  campo.tipo === 'r' || campo.tipo === 'r1';
const esCasilla = (campo: DefinicionDeCampo): campo is CampoDeCasilla =>
  campo.tipo === 'c' || campo.tipo === 'c1';

/** Un campo nuestro, en la forma `[etiqueta, tipo, opciones | casilla | ayuda]` del artboard. */
function campoComoElArtboard(campo: DefinicionDeCampo): CampoDelArtboard {
  if (esLista(campo)) return [campo.etiqueta, campo.tipo, campo.opciones];
  // Un campo de solo lectura NO trae su valor (`rentas`#97): las cifras viven solo en el artboard.
  // Se devuelven dos elementos, y `soloLaForma` omite el tercero **en el otro lado** — si solo se
  // omitiera aqui, la comparacion diria que falta y estaria diciendo la verdad sobre algo que ya no
  // es un defecto.
  if (esSoloLectura(campo)) return [campo.etiqueta, campo.tipo];
  if (esCasilla(campo)) return [campo.etiqueta, campo.tipo, campo.casilla];
  if (campo.ayuda === undefined) return [campo.etiqueta, campo.tipo];
  return [campo.etiqueta, campo.tipo, campo.ayuda];
}

/** Una tabla nuestra, en la forma `{ t, c, f, n?, i?, a? }` del artboard. */
function tablaComoElArtboard(tabla: DefinicionDeTabla): TablaDelArtboard {
  // Las claves opcionales se OMITEN cuando no estan, en vez de ponerlas a `undefined`: lo que
  // compara abajo es `toStrictEqual`, que distingue las dos cosas. Es deliberado — con `toEqual`,
  // una nota perdida en la transcripcion pasaria por «no habia nota».
  // Sin `f` ni `cn`: las filas y el conteo del artboard son ejemplo y no viajan en la definicion.
  return {
    t: tabla.titulo,
    ...(tabla.accion === undefined ? {} : { a: tabla.accion }),
    c: tabla.columnas.map((columna) => [columna.rotulo, columna.alineadoDerecha ? 1 : 0] as const),
    f: [],
    ...(tabla.columnaDeInsignia === undefined ? {} : { i: tabla.columnaDeInsignia }),
    ...(tabla.nota === undefined ? {} : { n: tabla.nota }),
  };
}

/** Un bloque nuestro, en la forma `[titulo, nota, campos, tabla?]` del artboard. */
function bloqueComoElArtboard(bloque: Pantalla['bloques'][number]): BloqueDelArtboard {
  const campos = bloque.campos.map(campoComoElArtboard);
  if (bloque.tabla === undefined) return [bloque.titulo, bloque.nota, campos];
  return [bloque.titulo, bloque.nota, campos, tablaComoElArtboard(bloque.tabla)];
}

/** Una pantalla nuestra, en la forma del artboard. */
function pantallaComoElArtboard(pantalla: Pantalla): readonly BloqueDelArtboard[] {
  return pantalla.bloques.map(bloqueComoElArtboard);
}

/**
 * **La FORMA de una pantalla del artboard, sin sus cifras de ejemplo** (`rentas`#97).
 *
 * Las definiciones no llevan ni el valor de un campo de solo lectura ni las filas de una tabla:
 * eran cifras que viajaban en el paquete servido, y en un sistema que publica valores normativos se
 * leen como reales. Siguen en el artboard, que es donde siempre estuvieron y que **no viaja**.
 *
 * Asi que la comparacion baja a la forma. Y baja **en los dos lados**: recortar solo el nuestro
 * diria que falta algo, y estaria diciendo la verdad sobre lo que ya no es un defecto.
 */
function soloLaForma(bloques: readonly BloqueDelArtboard[]): readonly BloqueDelArtboard[] {
  return bloques.map((bloque) => {
    const campos = bloque[2].map((campo) =>
      esDeSoloLectura(campo) ? ([campo[0], campo[1]] as const) : campo,
    ) as BloqueDelArtboard[2];
    if (bloque[3] === undefined) return [bloque[0], bloque[1], campos] as BloqueDelArtboard;
    const { f: _filas, cn: _conteo, ...resto } = bloque[3];
    return [bloque[0], bloque[1], campos, { ...resto, f: [] }] as BloqueDelArtboard;
  });
}

/** Un modulo nuestro, en la forma `[rotulo, nota, clave, codigo, trazos, hojas]`. */
function moduloComoElArtboard(modulo: Modulo): ModuloDelArtboard {
  return [
    modulo.rotulo,
    modulo.nota,
    modulo.slug,
    modulo.codigo,
    modulo.trazos,
    modulo.hojas.map((hoja) => [
      hoja.clave,
      hoja.rotulo,
      hoja.operaciones.map((o) => [o.verbo, o.ruta, o.nota] as const),
      hoja.piezasDeclaradas.map((p) => [p.pieza, p.uso] as const),
    ]),
  ];
}

/* ── El descriptor, que es el que da un rojo legible ───────────────────────────────────── */

/** Un campo, en una linea con su coordenada. */
function describirCampo(campo: CampoDelArtboard, bloque: number, indice: number): string {
  const tercero = esDeSoloLectura(campo)
    ? ''
    : campo.length === 2
      ? ''
      : Array.isArray(campo[2])
        ? ` opciones «${(campo[2] as readonly string[]).join(' | ')}»`
        : ` tercero «${String(campo[2])}»`;
  return `bloque ${String(bloque)} · campo ${String(indice)}: «${campo[0]}» tipo «${campo[1]}»${tercero}`;
}

/** Una tabla, en tantas lineas como columnas tenga. */
function describirTabla(tabla: TablaDelArtboard, bloque: number): readonly string[] {
  const donde = `bloque ${String(bloque)} · tabla`;
  return [
    `${donde} titulo: «${tabla.t}»`,
    `${donde} accion: «${tabla.a ?? '—'}»`,
    `${donde} insignia en columna: ${tabla.i === undefined ? '—' : String(tabla.i)}`,
    `${donde} nota: «${tabla.n ?? '—'}»`,
    ...tabla.c.map(
      (columna, i) =>
        `${donde} columna ${String(i)}: «${columna[0]}» ${columna[1] === 1 ? 'derecha' : 'izquierda'}`,
    ),
  ];
}

/** Una pantalla entera, linea a linea. Es lo que se compara cuando algo no cuadra. */
function describirPantalla(bloques: readonly BloqueDelArtboard[]): readonly string[] {
  return bloques.flatMap((bloque, i) => [
    `bloque ${String(i)} · titulo: «${bloque[0]}»`,
    `bloque ${String(i)} · nota: «${bloque[1]}»`,
    ...bloque[2].map((campo, j) => describirCampo(campo, i, j)),
    ...(bloque[3] === undefined
      ? [`bloque ${String(i)} · sin tabla`]
      : describirTabla(bloque[3], i)),
  ]);
}

/* ── El centinela ──────────────────────────────────────────────────────────────────────── */

describe('el artboard V8 sigue diciendo lo que esta guarda cree que dice', () => {
  it('EL CENTINELA: la extraccion trae EXACTAMENTE las cuentas declaradas', () => {
    // Sin esto, un cambio de formato en el artboard dejaria los literales vacios y las cuatro
    // comparaciones de abajo pasarian en VERDE comparando nada con nada — que es como una guarda se
    // queda sin sujeto sin que nadie la borre. Es la forma que `rentas` pago dos veces (#78, #80).
    const { arbol, pantallas, instrucciones } = artboardV8(NORMATIVA_V8());
    const esperadas = cuentas();

    expect(arbol.length, 'el artboard no declaro ni un modulo').toBe(esperadas.modulos);
    expect(hojasDelArtboard(NORMATIVA_V8()).length, 'ni una hoja').toBe(esperadas.hojas);
    expect(Object.keys(pantallas).length, 'ni una pantalla').toBe(esperadas.pantallas);
    expect(Object.keys(instrucciones).length, 'ni una instruccion').toBe(esperadas.instrucciones);
  });

  it('EL CENTINELA: y las pantallas traen contenido, no cascarones', () => {
    // Cuatro claves con una lista vacia detras tambien pasarian el centinela de arriba.
    const planos = bloquesDelArtboard(NORMATIVA_V8());
    const esperadas = cuentas();

    expect(planos.length, 'el artboard no declaro ni un bloque').toBe(esperadas.bloques);
    expect(planos.reduce((total, bloque) => total + bloque[2].length, 0)).toBe(esperadas.campos);
    expect(planos.filter((bloque) => bloque[3] !== undefined).length).toBe(esperadas.tablas);
  });

  it('EL CENTINELA: el adaptador mira el tipo como lo mira el interprete', () => {
    // `esLista`, `esSoloLectura` y `esCasilla` van por el literal porque `tipoDe` no estrecha la
    // union. Esta linea comprueba que las dos formas de mirar coinciden **sobre los campos de
    // verdad**, de modo que no son dos tablas que puedan divergir: si la libreria anadiera un
    // octavo tipo, o cambiara la letra de uno, esto sale rojo aqui y no en una comparacion de texto.
    const torcidos = CLAVES_DE_HOJA.flatMap((clave): readonly DefinicionDeCampo[] => {
      const pantalla: Pantalla = PANTALLAS[clave];
      return pantalla.bloques.flatMap((bloque) => bloque.campos);
    })
      .filter(
        (campo) =>
          esLista(campo) !== (tipoDe(campo.tipo) === 's') ||
          esSoloLectura(campo) !== (tipoDe(campo.tipo) === 'r') ||
          esCasilla(campo) !== (tipoDe(campo.tipo) === 'c'),
      )
      .map((campo) => `  «${campo.etiqueta}» tipo «${campo.tipo}»`);
    expect(torcidos, `El adaptador y \`tipoDe\` ya no dicen lo mismo:\n${torcidos.join('\n')}`).toEqual(
      [],
    );
  });

  it('EL CENTINELA: y las claves del artboard son las mismas que las del codigo', () => {
    // La premisa de las cuatro comparaciones de abajo: cada una busca su pantalla por la clave del
    // arbol NUESTRO. Si el artboard cambiara una clave, cada `it` lo diria por su lado; esta linea
    // lo dice una vez y en orden.
    const { pantallas, instrucciones } = artboardV8(NORMATIVA_V8());
    expect(Object.keys(pantallas)).toEqual([...CLAVES_DE_HOJA]);
    expect(Object.keys(instrucciones)).toEqual([...CLAVES_DE_HOJA]);
  });
});

/* ── El arbol ──────────────────────────────────────────────────────────────────────────── */

describe('AC 1 — el arbol es el del artboard, modulo a modulo', () => {
  it('es UN modulo de cuatro hojas, y cuatro claves distintas', () => {
    const esperadas = cuentas();
    expect(ARBOL).toHaveLength(esperadas.modulos);
    expect(ARBOL.map((modulo) => modulo.hojas.length)).toEqual([esperadas.hojas]);
    expect(CLAVES_DE_HOJA).toHaveLength(esperadas.hojas);
    expect(new Set(CLAVES_DE_HOJA).size, 'dos hojas con la misma clave').toBe(esperadas.hojas);
  });

  it.each(ARBOL.map((modulo, i) => [modulo.rotulo, i] as const))(
    '«%s»: rotulo, nota, slug, codigo, trazos, hojas, operaciones y piezas',
    (_rotulo, i) => {
      const delArtboard = artboardV8(NORMATIVA_V8()).arbol[i];

      expect(
        delArtboard,
        `El artboard ya no trae un modulo en la posicion ${String(i)}. El orden del arbol es el que\n` +
          'se dibuja: no se reordena aqui, se reordena en el artboard.',
      ).toBeDefined();
      expect(
        moduloComoElArtboard(ARBOL[i] as unknown as Modulo),
        'Este modulo dejo de decir lo que el artboard dice de el. El artboard manda: si el cambio\n' +
          'es deliberado, entra primero ahi y de ahi se transcribe.',
      ).toStrictEqual(delArtboard);
    },
  );
});

/* ── Las cuatro pantallas ──────────────────────────────────────────────────────────────── */

/**
 * **El artboard SIGUE trayendo las cifras, y esta guarda lo exige** (`rentas`#97).
 *
 * La comparacion de arriba baja a la forma: las cifras de ejemplo salieron de las definiciones y
 * viven **solo** en el artboard. Eso tiene un precio que hay que pagar aqui: si alguien vaciara el
 * artboard de valores, la comparacion de forma **seguiria pasando** —la forma no cambia— y se habria
 * perdido, sin un solo rojo, lo unico que dice como se ve una pantalla con datos puestos.
 *
 * Asi que se cuentan. No se comparan contra nada —no hay con que— pero tienen que estar, y cuantos
 * lo dicen las `cuentas` de `artboards.ts` y no un numero escrito aqui.
 */
describe('el artboard conserva las cifras que las definiciones ya no llevan', () => {
  it('cada campo de solo lectura trae su valor', () => {
    const soloLectura = bloquesDelArtboard(NORMATIVA_V8())
      .flatMap((bloque) => bloque[2])
      .filter(esDeSoloLectura);
    // Se afirma el numero declarado y no «mas de cero»: perder la mitad seria igual de grave que
    // perderlas todas, y «mas de cero» no lo veria.
    expect(soloLectura.length, 'el artboard perdio campos de solo lectura').toBe(
      cuentas().camposDeSoloLectura,
    );
    const sinValor = soloLectura
      .filter((campo) => campo[2] === undefined || campo[2] === '')
      .map((campo) => `  «${campo[0]}»`);
    expect(
      sinValor,
      'Hay campos de solo lectura en el artboard SIN valor. El artboard es el unico sitio donde\n' +
        'esas cifras existen: sin ellas no queda como se ve una pantalla con datos.',
    ).toEqual([]);
  });

  it('y cada tabla trae sus filas', () => {
    const tablas = bloquesDelArtboard(NORMATIVA_V8())
      .map((bloque) => bloque[3])
      .filter((tabla) => tabla !== undefined);
    expect(tablas.length, 'el artboard perdio tablas').toBe(cuentas().tablas);
    const vacias = tablas.filter((tabla) => tabla.f.length === 0).map((tabla) => `  «${tabla.t}»`);
    expect(vacias, `Hay tablas del artboard sin filas:\n${vacias.join('\n')}`).toEqual([]);
  });
});

describe('AC 2 — cada pantalla cuadra con el artboard, campo por campo', () => {
  it.each(CLAVES_DE_HOJA.map((clave) => [clave] as const))('«%s»', (clave) => {
    const delArtboard = artboardV8(NORMATIVA_V8()).pantallas[clave];

    expect(
      delArtboard,
      `El artboard ya no declara la pantalla «${clave}». Es una hoja del arbol sin pantalla que\n` +
        'dibujar: o vuelve al artboard, o sale del arbol.',
    ).toBeDefined();

    const nuestra = pantallaComoElArtboard(PANTALLAS[clave]);
    const suya = soloLaForma(delArtboard as readonly BloqueDelArtboard[]);

    // Primero las lineas, que es lo que da un rojo que se lee: dice la coordenada exacta —hoja,
    // bloque, campo— y las dos versiones del texto.
    expect(
      describirPantalla(nuestra),
      `«${clave}» dejo de decir lo que el artboard dice. El artboard manda.`,
    ).toEqual(describirPantalla(suya));

    // Y luego la comparacion exhaustiva, que no depende de que el descriptor sepa mirar. Es
    // `toStrictEqual` y no `toEqual` a proposito: una clave opcional puesta a `undefined` no es lo
    // mismo que una clave que no esta.
    expect(nuestra).toStrictEqual(suya);
  });

  it.each(CLAVES_DE_HOJA.map((clave) => [clave] as const))(
    'la instruccion de «%s» es la del artboard, literal',
    (clave) => {
      // Las cadenas se trasladan literales. Es una frase escrita para ensenar el procedimiento
      // —«abra una versión, agregue los parámetros por su llave y séllela»—, no relleno, y se
      // compara caracter a caracter.
      expect(PANTALLAS[clave].instruccion).toBe(artboardV8(NORMATIVA_V8()).instrucciones[clave]);
    },
  );
});

/* ── Lo que el catalogo deriva del arbol ───────────────────────────────────────────────── */

describe('AC 3 — el catalogo deriva del arbol lo que el artboard dice', () => {
  it('EL CENTINELA: el catalogo trae los modulos y los destinos de las cuentas', () => {
    const esperadas = cuentas();
    expect(CATALOGO, 'el catalogo vino vacio').toHaveLength(esperadas.modulos);
    expect(CATALOGO.flatMap((modulo) => modulo.destinos)).toHaveLength(esperadas.hojas);
  });

  it('el slug de cada destino es el que el artboard escribe en `const SLUGS`', () => {
    // El slug se DERIVA de la clave en `src/catalogo.ts` —la forma posicional del arbol no tiene
    // donde llevarlo—, asi que lo que se compara es la derivacion contra el dato del artboard. Sin
    // esto, `#/panel` podria dejar de abrir nada y solo lo diria el recorrido de los destinos.
    const { html } = artboardV8(NORMATIVA_V8());
    const slugs = constanteDelArtboard(html, 'SLUGS') as Readonly<Record<string, string>>;
    const nuestros = Object.fromEntries(
      CATALOGO.flatMap((modulo) => modulo.destinos).map((destino) => [
        destino.clave,
        destino.slug ?? destino.clave,
      ]),
    );

    expect(
      nuestros,
      'Los slugs del catalogo dejaron de ser los del artboard. Son lo que se lee en la barra de\n' +
        'direcciones y lo que un enlace guardado nombra: cambiarlos rompe los enlaces de fuera.',
    ).toStrictEqual(slugs);
  });

  it('y la instruccion de cada destino es la de su pantalla, no una segunda copia', () => {
    const torcidas = CATALOGO.flatMap((modulo) => modulo.destinos)
      .filter(
        (destino) =>
          destino.instruccion !== PANTALLAS[destino.clave as keyof typeof PANTALLAS].instruccion,
      )
      .map((destino) => `  «${destino.clave}»`);
    expect(
      torcidas,
      'Hay destinos cuya instruccion no es la de su pantalla:\n' +
        `${torcidas.join('\n')}\n\n` +
        '  La instruccion vive en la definicion y llega al marco por el catalogo. Dos registros\n' +
        '  paralelos por clave se desincronizan, y una pantalla nueva sin instruccion no daria\n' +
        '  ningun error.',
    ).toEqual([]);
  });
});

/* ── El tono de una insignia ───────────────────────────────────────────────────────────── */

describe('AC 5 — el tono de una insignia es el que el artboard pinta', () => {
  it('EL CENTINELA: el artboard declara una tabla de tonos con casos', () => {
    // Sin esto, un `TONOS` vaciado dejaria la comparacion de abajo exigiendo `resto` para todo y
    // pasando en verde sobre una funcion que devolviera siempre lo mismo.
    const { tonos } = artboardV8(NORMATIVA_V8());
    expect(tonos.porTexto.length, 'el artboard no declara ni un tono por texto').toBeGreaterThan(0);
    expect(tonos.resto, 'el artboard no declara el tono del resto').not.toBe('');
  });

  it('cada caso de `TONOS.porTexto` da el mismo tono aqui, y lo demas cae en `resto`', () => {
    const { tonos } = artboardV8(NORMATIVA_V8());
    // Los textos del artboard, mas dos que no estan en ningun caso: sin ellos, una funcion que
    // devolviera el tono correcto para los tres casos y cualquier cosa para el resto pasaria.
    const textos = [...tonos.porTexto.map(([texto]) => texto), 'SELLADO', 'Vigente', 'lo que sea'];
    const torcidos = textos
      .filter((texto) => tonoDeLaInsignia(texto) !== tonoDelArtboard(NORMATIVA_V8(), texto, []))
      .map(
        (texto) =>
          `  «${texto}»: aqui «${tonoDeLaInsignia(texto)}» y el artboard «${tonoDelArtboard(NORMATIVA_V8(), texto, [])}»`,
      );

    expect(
      torcidos,
      'El tono de una insignia dejo de ser el del artboard:\n' +
        `${torcidos.join('\n')}\n\n` +
        '  «Abierta» en verde se lee como una decision resuelta. El artboard manda: la tabla es su\n' +
        '  `const TONOS`, y lo que no case con ningun caso cae en su `resto`.',
    ).toEqual([]);
  });

  it('y el `porFila` del artboard NO se puede decir aqui: es el hueco H18, y se dice', () => {
    // La diferencia declarada, medida y no supuesta. El artboard pinta `D-03d` en `atencion` aunque
    // su celda diga «Abierta», porque no bloquea el sello sino el cierre de caja; el interprete de
    // hoy pasa el TEXTO de la celda y nada mas. Esta prueba fija la diferencia para que el dia que
    // #65 traiga `ReglaDeLaInsignia` salga ROJA y haya que venir a quitarla — en vez de quedarse
    // como una divergencia que nadie recuerda.
    const { tonos } = artboardV8(NORMATIVA_V8());
    expect(tonos.porFila.length, 'el artboard ya no declara ninguna excepcion por fila').toBe(1);
    const [primeraCelda, tono] = tonos.porFila[0] ?? ['', ''];

    expect(tonoDelArtboard(NORMATIVA_V8(), 'Abierta', [primeraCelda])).toBe(tono);
    expect(
      tonoDeLaInsignia('Abierta'),
      `La fila «${primeraCelda}» sigue saliendo con el tono del texto, y el artboard la pinta ` +
        `«${tono}». Si esto salio rojo porque ya se puede decir, es que H18 llego: quitese esta ` +
        'prueba y pongase la regla en la definicion.',
    ).not.toBe(tono);
  });
});
