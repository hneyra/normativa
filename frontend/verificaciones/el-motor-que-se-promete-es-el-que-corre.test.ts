// @vitest-environment node
//
// Lee cuatro archivos del disco y el `package.json` de cada paquete enlazado. No es un DOM.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { destinoDelEnlace, enlacesDeclarados } from './enlace.ts';
import { cumple, desacuerdos, laImagenDeNode, mayorDe, type Motores } from './motor.ts';
import { raizDelClon, remedioDelEnlace } from './remedio.mjs';

/**
 * **El motor que se promete es el que corre** (#90).
 *
 * El issue lo dice en su titulo: `engines` decia `>=22`, la CI corria 22.14.0 y la libreria que
 * se enlaza pide `>=24`. **El dueno decidio el 2026-09-20 que este arbol se alinea a Node 24**, y
 * lo que sigue es lo que se midio antes de tocar nada, porque lo que sostiene la subida es la
 * medicion y no la decision.
 *
 * <h2>Lo medido con los dos motores, antes de subir</h2>
 *
 * Con **Node 22.14.0** —el `.nvmrc` de entonces—: `yarn verificar` **RC=0**, `Test Files 46
 * passed (46)`, `Tests 576 passed (576)`, 111 s; `yarn build` RC=0, 873.38 kB.
 *
 * Con **Node 24.14.1**: `yarn build` da **el mismo bundle**, con las mismas huellas en los
 * nombres (`index-H1uJnSmT.js`), y `yarn verificar` salia **RC=1**: `Test Files 2 failed | 44
 * passed (46)`, `Tests 2 failed | 574 passed (576)`, **213 errores**, todos
 * `TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal`
 * desde `createClientSideRequest` de `react-router`. Y no era de esta maquina: el trabajo
 * `consumidores` de la libreria —que corre ESTA suite con Node 24— saco ese mismo dia las mismas
 * cifras exactas, con el aviso «ya estaba rojo con la libreria en main […] alguien tiene que
 * mirarlo alli».
 *
 * O sea que subir el numero, a secas, habria dejado la CI roja. Lo que lo hace posible es
 * `request-del-arnes.ts`, que es del arnes y no del motor: con el puesto, los dos motores dan lo
 * mismo, y esa es la unica razon por la que este archivo puede decir «24» sin mentir.
 *
 * <h2>Lo que la subida NO es</h2>
 *
 * No es que la libreria ejerza hoy algo que solo exista en 24: medido, ninguno de los seis
 * paquetes que entran por `link:` declara `engines` —el `>=24` esta en la RAIZ de su repositorio,
 * que gobierna SU `yarn verificar`— y en su codigo de produccion no hay una sola API posterior a
 * Node 22 (barrido de `URLPattern`, `RegExp.escape`, `Float16Array`, `Error.isError`,
 * `Promise.try`, `node:sqlite`, `import.meta.dirname` y compania: cero). Es exactamente lo que el
 * issue dice: **hoy sale verde por suerte y no por diseno**, y el dia que deje de salir, el rojo
 * no hablaria de motores. La tercera regla de `motor.ts` es la que convierte esa suerte en aviso.
 *
 * <h2>Y el precio, declarado: esto DIVERGE del stack de `rentas`</h2>
 *
 * `rentas` declara `>=22` en el `ac379ac` que `el-stack-es-el-de-rentas.test.ts` fija y tambien
 * hoy en su `origin/main` (111 commits despues, comprobado el 2026-09-20), igual que `catastro` y
 * `ciudadano`; en `>=24` estan `kamayuk-lib` y `caja`. Alinearse con la libreria es apartarse de
 * la referencia del stack **a proposito**, y ese apartamiento esta escrito en la guarda que lo
 * vigila, con su motivo y su medida, sin aflojarle nada mas.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/**
 * **Lo que la RAIZ del clon hermano pedia cuando se midio esto**: `kamayuk-lib@0dbc197`, del
 * 2026-09-16 (`kamayuk-lib`#90, PR #91), releido el 2026-09-20 en su `main`.
 *
 * No es un numero que se sube: es la fecha de una medicion. Cuando la libreria lo mueva, esta
 * guarda sale roja pidiendo que alguien vuelva a correr los dos motores aqui —que es lo unico
 * que decide— y no que alguien copie el numero nuevo.
 */
const LA_LIBRERIA_PEDIA = '>=24';

const leer = (ruta: string) => readFileSync(ruta, 'utf8');

/** Los cuatro sitios, leidos CUANDO SE LLAMA: un archivo que falte no mata la recoleccion. */
function loQueDiceElDisco(): Motores {
  const manifiesto = JSON.parse(leer(join(FRONTEND, 'package.json'))) as {
    engines?: { node?: string };
  };
  const enlaces = enlacesDeclarados(leer(join(FRONTEND, 'package.json')));
  return {
    promete: manifiesto.engines?.node ?? '(no declara)',
    elige: leer(join(FRONTEND, '.nvmrc')).trim(),
    imagen: laImagenDeNode(leer(join(FRONTEND, 'Dockerfile'))),
    enlazados: enlaces.map(({ paquete, declarada }) => ({
      paquete,
      pide: engineDelPaquete(destinoDelEnlace(declarada, FRONTEND)),
    })),
    libreria: engineDeLaLibreria(enlaces[0]?.declarada),
  };
}

/** El `engines.node` de un paquete enlazado, o `undefined` si no declara ninguno. */
function engineDelPaquete(destino: string): string | undefined {
  const suyo = join(destino, 'package.json');
  if (!existsSync(suyo)) return undefined;
  return (JSON.parse(leer(suyo)) as { engines?: { node?: string } }).engines?.node;
}

/**
 * Y el de la RAIZ del clon hermano, que es donde vive el `>=24`.
 *
 * La ruta se DERIVA del `link:` —`../../kamayuk-lib/paquetes/api` -> `../../kamayuk-lib`— y no se
 * escribe: escrita, nombraria el clon de ayer el dia que la ruta cambie, y `enlace.ts` ya vigila
 * que los seis apunten al mismo sitio.
 */
function engineDeLaLibreria(declarada: string | undefined): string | undefined {
  if (declarada === undefined) return undefined;
  const raiz = raizDelClon(declarada);
  if (raiz === null) return undefined;
  const suyo = join(destinoDelEnlace(raiz, FRONTEND), 'package.json');
  if (!existsSync(suyo)) return undefined;
  return (JSON.parse(leer(suyo)) as { engines?: { node?: string } }).engines?.node;
}

describe('el motor que se promete es el que corre', () => {
  it('EL CENTINELA: los cuatro sitios se leyeron de verdad, y hay seis paquetes que mirar', () => {
    // Sin esto, la comparacion de abajo pasaria sobre campos vacios: un `Dockerfile` que dejara
    // de tener `FROM node:` o un clon hermano ausente darian `undefined` en todas partes, y una
    // lista vacia de enlazados no tiene nada que desmentir.
    const motores = loQueDiceElDisco();
    expect(motores.promete, 'este package.json declara `engines.node`').toMatch(/^>=\d/);
    expect(motores.elige, '`.nvmrc` dice una version entera').toMatch(/^\d+\.\d+\.\d+$/);
    expect(motores.imagen, 'el Dockerfile construye sobre una imagen de node').toBeDefined();
    expect(motores.enlazados.map((e) => e.paquete).sort(), 'los seis `@kamayuk/*`').toEqual([
      '@kamayuk/api',
      '@kamayuk/formato',
      '@kamayuk/sesion',
      '@kamayuk/shell',
      '@kamayuk/ui',
      '@kamayuk/verificaciones',
    ]);
    // Y la raiz del hermano se leyo: si no estuviera, la regla 4 saldria roja por «nada» y el
    // remedio hablaria del motor cuando lo que falta es un `git clone`.
    expect(
      motores.libreria,
      remedioDelEnlace('kamayuk-lib', '../../kamayuk-lib/paquetes/api'),
    ).toBeDefined();
  });

  it('LO MEDIDO, y por que los seis enlazados no obligan a nada: ninguno declara `engines`', () => {
    // Es la mitad del issue que hay que poder VOLVER a medir, no recordar. El `>=24` de la
    // libreria esta en su raiz —su propio `yarn verificar`—, y lo que entra por `link:` son los
    // paquetes, que no piden nada. El dia que uno pida, la regla 3 lo dice con su nombre.
    const conMotor = loQueDiceElDisco()
      .enlazados.filter((e) => e.pide !== undefined)
      .map((e) => `  ${e.paquete} pide «${e.pide ?? ''}»`);
    expect(
      conMotor,
      'Un paquete enlazado declaro `engines` por primera vez:\n' +
        `${conMotor.join('\n')}\n\n` +
        '  No es motivo automatico para subir este arbol, y tampoco se ignora: hay que medir los\n' +
        '  dos motores como hizo #90 y decidirlo con el stack de `rentas` delante.',
    ).toEqual([]);
  });

  it('y no hay ni un desacuerdo en el arbol de verdad', () => {
    const todos = desacuerdos(loQueDiceElDisco(), LA_LIBRERIA_PEDIA);
    const detalle = todos.map((d) => `  ${d.donde}: ${d.que}\n  ${d.remedio}`).join('\n\n');
    expect(todos, detalle).toEqual([]);
  });
});

/** Un disco de mentira: lo que hoy dice el de verdad, con lo que se le cambie encima. */
function comoSiFuera(cambios: Partial<Motores>): Motores {
  return {
    promete: '>=24',
    elige: '24.14.1',
    imagen: '24-alpine',
    enlazados: [
      { paquete: '@kamayuk/api', pide: undefined },
      { paquete: '@kamayuk/ui', pide: undefined },
    ],
    libreria: LA_LIBRERIA_PEDIA,
    ...cambios,
  };
}

describe('LA MUESTRA: la guarda muerde, sitio por sitio', () => {
  it('con todo en su sitio no dice nada — y eso incluye la distancia de hoy', () => {
    // La linea base de las cuatro de abajo: sin ella, una regla siempre roja pareceria que
    // muerde y lo que estaria es rota.
    expect(desacuerdos(comoSiFuera({}), LA_LIBRERIA_PEDIA)).toEqual([]);
  });

  it('1. si `engines` sube y `.nvmrc` se queda, lo dice — antes que `yarn install`', () => {
    // Es la mitad que #90 tuvo que hacer a mano: subir el manifiesto y olvidar el `.nvmrc` deja
    // la CI corriendo el motor viejo contra una promesa nueva, y con `engine-strict` eso revienta
    // en `yarn install` hablando de versiones.
    const [primero, ...resto] = desacuerdos(comoSiFuera({ promete: '>=26' }), LA_LIBRERIA_PEDIA);

    expect(resto).toEqual([]);
    expect(primero?.donde).toBe('.nvmrc');
    expect(primero?.que).toBe('elige Node 24.14.1, y este package.json promete «>=26».');
  });

  it('2. si la imagen construye con otra mayor, tambien — y es la que se publica', () => {
    // La otra mitad, y la que nadie mira: el `Dockerfile` se quedo en `node:22-alpine` mientras
    // el resto subia. Hasta #90 lo unico que lo ataba a `.nvmrc` era un comentario.
    const [primero, ...resto] = desacuerdos(comoSiFuera({ imagen: '22-alpine' }), LA_LIBRERIA_PEDIA);

    expect(resto).toEqual([]);
    expect(primero?.donde).toBe('Dockerfile');
    expect(primero?.que).toBe('construye sobre «node:22-alpine» y «.nvmrc» elige «24.14.1».');
  });

  it('3. Y LA QUE IMPORTA: un paquete ENLAZADO que pide mas de lo que aqui se corre', () => {
    // El dia que `kamayuk-lib/paquetes/ui/package.json` gane su propio `engines`, esta guarda es
    // la que lo dice — y lo dice NOMBRANDO el paquete, porque el remedio no es el mismo que si lo
    // pidiera la raiz. Es el aviso que en septiembre no existio: la libreria subio el 16, este
    // arbol se entero el 20, y entre medias «salia verde por suerte».
    const todos = desacuerdos(
      comoSiFuera({
        enlazados: [
          { paquete: '@kamayuk/api', pide: undefined },
          { paquete: '@kamayuk/ui', pide: '>=26' },
        ],
      }),
      LA_LIBRERIA_PEDIA,
    );

    expect(todos).toHaveLength(1);
    expect(todos[0]?.donde).toBe('@kamayuk/ui');
    expect(todos[0]?.que).toBe('pide «>=26» y aqui se corre Node 24.14.1.');
    expect(todos[0]?.remedio).toContain('lo que este frontend ENLAZA pide un motor');
  });

  it('4. y si la libreria mueve su raiz, sale roja pidiendo MEDIR, no subir un numero', () => {
    const [primero, ...resto] = desacuerdos(comoSiFuera({ libreria: '>=26' }), LA_LIBRERIA_PEDIA);

    expect(resto).toEqual([]);
    expect(primero?.donde).toBe('kamayuk-lib (la raiz del clon hermano)');
    expect(primero?.que).toBe('pide «>=26», y aqui esta escrito «>=24».');
    expect(primero?.remedio).toContain('se mide la suite con ella');
  });

  it('y si el clon hermano no esta, la distancia sale como «nada» y no como un verde', () => {
    // El caso que de verdad da miedo: una guarda que compara contra `undefined` y se calla.
    const [primero] = desacuerdos(comoSiFuera({ libreria: undefined }), LA_LIBRERIA_PEDIA);

    expect(primero?.que).toBe('pide «nada», y aqui esta escrito «>=24».');
  });

  it('un rango que esta guarda no sabe leer NO se interpreta: sale rojo y lo lee una persona', () => {
    // `^24 || >=22.5 <23` no se adivina. Lo que se juega es autorizar un motor que nadie midio.
    expect(cumple('24.14.1', '^24 || >=22.5')).toBeNull();

    const [primero] = desacuerdos(comoSiFuera({ promete: '^24' }), LA_LIBRERIA_PEDIA);
    expect(primero?.donde).toBe('.nvmrc contra engines.node');
    expect(primero?.que).toBe('no se sabe leer «24.14.1» contra «^24».');
  });

  it('y el Dockerfile sin `FROM node:` no pasa por alto: se queda sin sujeto y lo dice', () => {
    const [primero] = desacuerdos(comoSiFuera({ imagen: undefined }), LA_LIBRERIA_PEDIA);

    expect(primero?.donde).toBe('Dockerfile');
    expect(primero?.que).toBe('no hay ningun `FROM node:…`.');
  });
});

describe('las tres piezas puras, una a una', () => {
  it.each([
    ['22.14.0', '>=22', true],
    ['22.14.0', '>=22.14.0', true],
    ['22.14.0', '>=22.14.1', false],
    ['22.14.0', '>=24', false],
    ['24.14.1', '>=24', true],
    ['24.14.1', '>=22', true],
    ['22', '>=22', true],
  ])('«%s» contra «%s» da %s', (version, rango, esperado) => {
    expect(cumple(version, rango)).toBe(esperado);
  });

  it('la mayor sale igual de una version y de una etiqueta de imagen', () => {
    expect(mayorDe('22.14.0')).toBe(22);
    expect(mayorDe('22-alpine')).toBe(22);
    expect(mayorDe('alpine')).toBeNull();
  });

  it('del Dockerfile se toma la PRIMERA etapa, que es la que corre `yarn build`', () => {
    const dockerfile = 'FROM node:22-alpine AS construccion\nRUN yarn build\nFROM nginx:1.31.5-alpine AS interfaz\n';

    expect(laImagenDeNode(dockerfile)).toBe('22-alpine');
    expect(laImagenDeNode('FROM nginx:1.31.5-alpine AS interfaz\n')).toBeUndefined();
  });
});
