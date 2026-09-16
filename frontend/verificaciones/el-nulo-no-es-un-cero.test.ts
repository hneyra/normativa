// Corre en jsdom —el entorno por omision— y NO en `node`, aunque lo que hace sea ejercer una
// funcion y leer un archivo: importa el conector, que arrastra `src/api/cliente.ts` ->
// `src/sesion.ts`, y ahi hay un `window.location.origin` de nivel de modulo. En `node` eso es
// «ReferenceError: window is not defined» al CARGAR, sin una sola prueba ejecutada.
//
// Y `fileURLToPath(import.meta.url)` si funciona aqui: lo hace tambien
// `el-locale-esta-completo.test.ts`, que corre en jsdom y lee el disco por ese camino.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CLAVE_DEL_ESTADO, CLAVE_DE_LAS_VERSIONES } from '../src/datos/lecturas.ts';
import type { ConjuntoResource, EjercicioParametrizadoResource, Paginado } from '../src/datos/lecturas.ts';
import { EJERCICIO_DE_TRABAJO } from '../src/datos/ejercicio.ts';
import { FRASES_DEL_PANEL, PANEL } from '../src/datos/panel.ts';

/**
 * **Un nulo no es un cero, y una fecha se ensena como la escribio el servidor** (#63, AC 5 y AC 6).
 *
 * <h2>La leccion de la V6, y por que es una guarda y no una costumbre</h2>
 *
 * El «—» de una captura de la V6 **era un `null`, nunca un cero** — asi lo escribe el registro de la
 * epica #47 («Lo que la V6 aprendio y no se puede perder»). En una interfaz que publica los valores
 * con los que se cobra, la diferencia es la unica que importa: un «0» en «Conjunto» es un
 * identificador que no existe; un «0.00» en un importe es una deuda pagada que nadie pago; una
 * celda en blanco no distingue «no lo sabemos» de «vale cero».
 *
 * <h2>Se ejerce el CONECTOR, no la pantalla</h2>
 *
 * Porque el conector es quien decide, y porque asi el rojo nombra el campo y no un nodo del DOM. Lo
 * que se le pasa son dos respuestas con nulos dentro **de las que el contrato declara nulables**:
 * `conjuntoId`, `version`, `fechaSellado` y `usuarioSellado` — los cuatro `@Nullable` en los
 * `record` de `ParametrosController`.
 *
 * <h2>Y el centinela de la otra direccion</h2>
 *
 * Con los mismos datos SIN nulos, los cuatro campos tienen que salir **con su valor**. Sin esa
 * mitad, un conector que no devolviera nada pasaria esta guarda entera: no habria ningun cero
 * porque no habria nada.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Lo que nunca puede ocupar el sitio de un dato que no llego. */
const LO_QUE_NO_PUEDE_SER = ['0', '0.00', '0,00', '', '-', '—'];

/** Un ejercicio SIN sellar: los dos nulos que el contrato declara. */
const SIN_SELLAR: EjercicioParametrizadoResource = {
  ejercicio: EJERCICIO_DE_TRABAJO,
  sellado: false,
  conjuntoId: null,
  version: null,
};

/** Y uno sellado, con sus dos identificadores. */
const SELLADO: EjercicioParametrizadoResource = {
  ejercicio: EJERCICIO_DE_TRABAJO,
  sellado: true,
  conjuntoId: 12,
  version: 3,
};

/** La fecha tal como la escribe el servidor: un instante ISO, con su zona dentro. */
const FECHA_DEL_SERVIDOR = '2026-09-06T14:12:03.512Z';

/** Un conjunto abierto —sin sellar— y uno sellado, en la misma pagina. */
function pagina(): Paginado<ConjuntoResource> {
  const abierto: ConjuntoResource = {
    id: 41,
    ejercicio: EJERCICIO_DE_TRABAJO,
    version: 2,
    estado: 'ABIERTO',
    fechaSellado: null,
    usuarioSellado: null,
  };
  const sellado: ConjuntoResource = {
    id: 12,
    ejercicio: EJERCICIO_DE_TRABAJO,
    version: 1,
    estado: 'SELLADO',
    fechaSellado: FECHA_DEL_SERVIDOR,
    usuarioSellado: 'hneyra',
  };
  return {
    contenido: [abierto, sellado],
    pagina: 0,
    tamano: 500,
    totalElementos: 2,
    totalPaginas: 1,
    hayMas: false,
  };
}

/** Lo que el Panel reparte con las dos respuestas puestas. */
function repartir(estado: EjercicioParametrizadoResource) {
  return PANEL.repartir(
    new Map<string, unknown>([
      [CLAVE_DEL_ESTADO, estado],
      [CLAVE_DE_LAS_VERSIONES, pagina()],
    ]),
  );
}

/** Lo que se lee de una celda, en las dos formas que `@kamayuk/ui` admite. */
function textoDe(celda: unknown): string | null {
  return typeof celda === 'string' ? celda : ((celda as { texto: string | null }).texto ?? null);
}

describe('AC 5 — un nulo nunca es un cero', () => {
  it('EL CENTINELA: con los datos completos, los cuatro campos SI salen con su valor', () => {
    // Sin esto, un conector que devolviera mapas vacios pasaria toda esta guarda: no habria ningun
    // cero porque no habria nada que mirar.
    const reparto = repartir(SELLADO);

    expect(reparto.valores?.get('0|0')).toBe(String(EJERCICIO_DE_TRABAJO));
    expect(reparto.valores?.get('0|2')).toBe('12');
    expect(reparto.valores?.get('0|3')).toBe('3');
    expect(reparto.ausenciaPorCampo?.has('0|2')).toBe(false);
    expect(reparto.ausenciaPorCampo?.has('0|3')).toBe(false);
  });

  it('`conjuntoId: null` y `version: null` se dicen como ausencia, y no se dibujan', () => {
    const reparto = repartir(SIN_SELLAR);

    // No estan entre los valores: el hueco lo ocupa la palabra de la ausencia, no un numero.
    expect(reparto.valores?.has('0|2'), '«Conjunto» no puede tener valor sin conjunto').toBe(false);
    expect(reparto.valores?.has('0|3'), '«Version» no puede tener valor sin conjunto').toBe(false);

    expect(reparto.ausenciaPorCampo?.get('0|2')).toBe(FRASES_DEL_PANEL.sinConjuntoSellado);
    expect(reparto.ausenciaPorCampo?.get('0|3')).toBe(FRASES_DEL_PANEL.sinConjuntoSellado);
    // Y la palabra dice algo: una ausencia en blanco es el hueco sin motivo que esto evita.
    expect(FRASES_DEL_PANEL.sinConjuntoSellado.trim().length).toBeGreaterThan(3);
  });

  it('ningun valor del Panel es un cero, una raya ni una cadena vacia', () => {
    for (const estado of [SIN_SELLAR, SELLADO]) {
      const reparto = repartir(estado);
      const sospechosos = [...(reparto.valores ?? new Map<string, string>())]
        .filter(([, valor]) => LO_QUE_NO_PUEDE_SER.includes(valor.trim()))
        .map(([donde, valor]) => `  ${donde} = «${valor}»`);

      expect(
        sospechosos,
        `Con «sellado: ${String(estado.sellado)}» hay campos dibujados con un cero o una raya:\n` +
          `${sospechosos.join('\n')}\n\n` +
          '  Un cero no es la ausencia de un dato: es un dato. En una interfaz que publica los\n' +
          '  valores con los que se cobra, esa diferencia es la unica que importa.',
      ).toEqual([]);
    }
  });

  it('y las celdas nulas van con `texto: null` y su nota, nunca con un cero', () => {
    const tabla = repartir(SELLADO).tablas?.get(CLAVE_DE_LAS_VERSIONES);
    const abierto = tabla?.filas[0];

    expect(tabla?.filas, 'la tabla de versiones vino sin filas').toHaveLength(2);
    // Columnas 2 y 3: «Fecha de sellado» y «Usuario que sello». El conjunto abierto no tiene ni una.
    expect(textoDe(abierto?.celdas[2])).toBeNull();
    expect(textoDe(abierto?.celdas[3])).toBeNull();
    // Y el POR QUE va con la celda: una raya sola no distingue «no hay» de «esta roto».
    const nota = (abierto?.celdas[2] as { nota?: string }).nota ?? '';
    expect(nota.trim().length, 'la celda nula no dice por que').toBeGreaterThan(10);

    // Ninguna celda de ninguna fila se dibuja como cero o cadena vacia.
    const sospechosas = (tabla?.filas ?? []).flatMap((fila, i) =>
      fila.celdas
        .map((celda, j) => ({ j, texto: textoDe(celda) }))
        .filter(({ texto }) => texto !== null && LO_QUE_NO_PUEDE_SER.includes(texto.trim()))
        .map(({ j, texto }) => `  fila ${String(i)}, columna ${String(j)} = «${String(texto)}»`),
    );

    expect(sospechosas, `Hay celdas con un cero o una raya escrita:\n${sospechosas.join('\n')}`).toEqual(
      [],
    );
  });
});

describe('AC 6 — la fecha se ensena como la escribio el servidor', () => {
  it('la celda de «Fecha de sellado» es el instante tal cual, sin pasar por `Date`', () => {
    const tabla = repartir(SELLADO).tablas?.get(CLAVE_DE_LAS_VERSIONES);
    const sellado = tabla?.filas[1];

    expect(
      textoDe(sellado?.celdas[2]),
      'La fecha se movio. Construir un `Date` con el instante del servidor lo lleva a la zona del\n' +
        '  puesto, y entonces el mismo sello se lee con dos fechas distintas en dos ventanillas de\n' +
        '  la misma municipalidad (`c01fe9a:src/secciones/conjuntos.ts:150-175`).',
    ).toBe(FECHA_DEL_SERVIDOR);
  });

  it('y el conector no toca `Date` ni ningun formateador de zona', () => {
    // La otra direccion, sobre la fuente: la de arriba pasaria con un `Date` que diera la vuelta
    // exacta en la zona de quien corre las pruebas. Se omiten los comentarios, que citan el defecto.
    const fuente = readFileSync(join(AQUI, '../src/datos/panel.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');
    const culpables = [...fuente.matchAll(/\b(new Date|toLocale\w*|Intl\.DateTimeFormat)\b/g)].map(
      (hallazgo) => `  «${hallazgo[0]}»`,
    );

    expect(
      culpables,
      `El conector del Panel toca el reloj o la zona:\n${culpables.join('\n')}\n\n` +
        '  Lo que llega es un instante escrito por el servidor, y se ensena tal cual (AC 6).',
    ).toEqual([]);
  });
});
