// @vitest-environment node
//
// Compara dos modulos, lee archivos del disco y lintea texto. No es un DOM lo que necesita.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROHIBICIONES as DEL_PRODUCTO,
  PROHIBICIONES_OPCIONALES as OPCIONALES_DEL_PRODUCTO,
  REGLAS_EXIGIDAS as EXIGIDAS_POR_EL_PRODUCTO,
  REGLAS_OPCIONALES as OPCIONALES_DEL_PRODUCTO_REGLAS,
} from '@kamayuk/verificaciones/prohibiciones';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

import { DONDE_SE_LLAMA_A_FETCH, PROHIBICIONES, REGLAS_EXIGIDAS, SALVO_EN_ESTE_ARBOL } from '../eslint.prohibiciones.mjs';

/**
 * **Las diez prohibiciones de este frontend son las de `@kamayuk/verificaciones`, no una copia
 * suya** (#62).
 *
 * <h2>El defecto que esto cierra</h2>
 *
 * Calcada de `rentas/frontend/verificaciones/las-prohibiciones-son-las-de-la-libreria.test.ts` en
 * `ac379ac` (`rentas`#137), con lo que aqui es distinto y esta medido: alli son nueve claves y
 * ocho reglas; **aqui son DIEZ y NUEVE**, porque este sistema enciende la opcional
 * `cifra-tributaria-literal` de `PROHIBICIONES_OPCIONALES` (`kamayuk-lib`#58).
 *
 * Hasta #62 las diez estaban escritas en `frontend/eslint.prohibiciones.mjs`, y **ya habian
 * divergido**: cinco claves identicas a las de la libreria, tres con otro `selector`, una con otro
 * `salvo` y otro `message`, y la decima solo aqui. Lo peor no era la divergencia sino que **no
 * habia rojo que la dijera**: cada `reglas-de-eslint.test.ts` compara contra SU propio archivo,
 * asi que los dos repositorios estaban en verde midiendo listas distintas.
 *
 * <h2>Por que una comparacion y no «ya se importa, luego no puede divergir»</h2>
 *
 * Porque lo que impide la divergencia hoy es que `eslint.prohibiciones.mjs` DERIVE la lista, y eso
 * es una propiedad del archivo, no del sistema: se pierde con un `PROHIBICIONES = [` escrito
 * encima, que es exactamente como aparecio el fork la primera vez. Esta guarda es lo que se pone
 * rojo ese dia, y lo hace por tres caminos:
 *
 *   · comparando **clave a clave y campo a campo** contra el modulo de la libreria;
 *   · exigiendo que este archivo **no escriba ningun `selector`**, que es lo unico que caza el
 *     fork el dia que se hace, cuando la copia todavia es identica y la comparacion pasaria; y
 *   · **ejerciendo con ESLint los nombres de cifra de la V6** —los trece de `CAMPOS_DE_CIFRA` y
 *     los doce de `CIFRAS_NORMATIVAS` de `c01fe9a`—, porque derivar no puede costar ni uno. Eso
 *     es el AC 2 del issue, y es lo que distingue este issue de `rentas`#137: alli la lista comun
 *     ya era la buena; aqui la libreria tuvo que crecer primero (`kamayuk-lib`#58).
 *
 * Lo que NO se compara es `salvo`: es lo unico que este arbol pone de su parte, y se comprueba
 * contra `SALVO_EN_ESTE_ARBOL` —no contra la libreria—, porque `paquetes/api/` alla y la **lista
 * vacia** aqui son correctas cada una en su arbol.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const FUENTE_DE_LA_DERIVACION = readFileSync(join(RAIZ, 'eslint.prohibiciones.mjs'), 'utf8');

/** Los campos que son del PRODUCTO: identicos a los dos lados, sin excepcion. */
const DEL_PRODUCTO_Y_NO_DE_AQUI = ['clave', 'regla', 'selector', 'message'] as const;

/** Las diez del producto que este arbol enciende: las nueve obligatorias y la opcional. */
const LAS_DIEZ_DE_ALLA = [...DEL_PRODUCTO, ...OPCIONALES_DEL_PRODUCTO];

describe('la lista es la de `@kamayuk/verificaciones`, no una copia suya', () => {
  it('EL CENTINELA: la libreria publica las nueve y la opcional', () => {
    // Sin esto, una libreria que exportara una lista VACIA dejaria todo lo de abajo recorriendo
    // cero elementos y pasando en verde — con ESLint sin una sola prohibicion encendida.
    expect(
      DEL_PRODUCTO.length,
      '`@kamayuk/verificaciones` no publico ninguna prohibicion.',
    ).toBeGreaterThanOrEqual(9);
    expect(EXIGIDAS_POR_EL_PRODUCTO.length).toBeGreaterThanOrEqual(8);
    // Y la opcional, que es la que este sistema enciende y `rentas` no. Sin ella, derivar
    // costaria la decima prohibicion — que es justo lo que este issue no permite.
    expect(
      OPCIONALES_DEL_PRODUCTO.length,
      '`@kamayuk/verificaciones` dejo de publicar `PROHIBICIONES_OPCIONALES`. Sin ella este\n' +
        'frontend pierde `cifra-tributaria-literal`, que es la regla 5 aplicada al sistema que\n' +
        'PUBLICA las cifras. Se corrige en `kamayuk-lib`, no aqui.',
    ).toBeGreaterThanOrEqual(1);
    expect(OPCIONALES_DEL_PRODUCTO_REGLAS.length).toBeGreaterThanOrEqual(1);
  });

  it('y aqui salen DIEZ claves y NUEVE reglas, que es lo que distingue este frontend', () => {
    // **Las dos cifras escritas, y a proposito.** `rentas` cuenta nueve y ocho; aqui son diez y
    // nueve porque este sistema enciende la opcional. Si alguien deja de encenderla —o si la
    // libreria la mueve— esto es lo que lo dice, y lo dice nombrando la cifra que salio.
    expect(
      PROHIBICIONES.map((p) => p.clave),
      'Este frontend enciende DIEZ prohibiciones: las nueve del producto y la opcional\n' +
        '`cifra-tributaria-literal`. Con nueve, la cifra normativa literal vuelve a pasar en\n' +
        'verde en el unico repositorio donde escribirla la publica sin las dos firmas de ADR-0007.',
    ).toHaveLength(10);
    expect(REGLAS_EXIGIDAS).toHaveLength(9);
    expect(REGLAS_EXIGIDAS).toContain('ninguna cifra tributaria literal en el codigo');
  });

  it('y cada una trae sus cuatro campos con algo dentro', () => {
    // La forma la declara `@kamayuk/verificaciones/prohibiciones.d.mts` (`kamayuk-lib`#46), y por
    // eso este arbol NO escribe su propio `.d.ts` —`rentas` tuvo que escribirlo y ya no hace
    // falta—. Una declaracion sin nadie que la ejerza es una promesa: si la libreria renombrara
    // un campo, el `.d.mts` seguiria compilando y la comparacion de abajo pasaria comparando
    // `undefined` con `undefined`. Aqui se mide el dato, no la declaracion.
    const mancos = LAS_DIEZ_DE_ALLA.filter((p) =>
      DEL_PRODUCTO_Y_NO_DE_AQUI.some((campo) => typeof p[campo] !== 'string' || p[campo] === ''),
    ).map((p) => p.clave ?? '(sin clave)');

    expect(
      mancos,
      'La forma que `@kamayuk/verificaciones/prohibiciones.d.mts` declara ya no es la que publica\n' +
        'el paquete. Corrige la declaracion — o el paquete, si lo que cambio no tenia que cambiar.',
    ).toEqual([]);
  });

  it('ninguna prohibicion esta a un lado y no al otro', () => {
    const aqui = PROHIBICIONES.map((p) => p.clave);
    const alla = LAS_DIEZ_DE_ALLA.map((p) => p.clave);

    const soloAlla = alla.filter((clave) => !aqui.includes(clave));
    const soloAqui = aqui.filter((clave) => !alla.includes(clave));

    expect(
      { soloAlla, soloAqui },
      'Las dos listas se separaron, que es el fork que #62 cerro:\n' +
        `  solo en @kamayuk/verificaciones: ${soloAlla.join(', ') || '(ninguna)'}\n` +
        `  solo en normativa:               ${soloAqui.join(', ') || '(ninguna)'}\n` +
        'Las diez son del PRODUCTO —nueve obligatorias y una opcional—. Una que solo exista aqui\n' +
        'es un fork empezando; una que solo exista alla es una regla que este frontend dejo de\n' +
        'aplicar.',
    ).toEqual({ soloAlla: [], soloAqui: [] });
  });

  it.each(LAS_DIEZ_DE_ALLA.map((p) => ({ clave: p.clave })))(
    '«$clave» llega con el mismo selector y el mismo mensaje',
    ({ clave }) => {
      const alla = LAS_DIEZ_DE_ALLA.find((p) => p.clave === clave);
      const aqui = PROHIBICIONES.find((p) => p.clave === clave);

      for (const campo of DEL_PRODUCTO_Y_NO_DE_AQUI) {
        expect(
          aqui?.[campo],
          `«${clave}» tiene otro «${campo}» aqui que en la libreria. Ese campo es del producto:\n` +
            'reescribirlo de un lado deja las dos verificaciones en verde midiendo cosas\n' +
            'distintas. Si el texto esta mal, se corrige en `kamayuk-lib`.',
        ).toBe(alla?.[campo]);
      }
    },
  );

  it('y las reglas se reexportan tal cual, en sus dos trozos y sin mezclarlos', () => {
    // `REGLAS_EXIGIDAS` y `REGLAS_OPCIONALES` son las dos unicas listas escritas a mano del
    // producto, y las que impiden que borrar una prohibicion se lleve su prueba por delante.
    // Escritas otra vez aqui, serian lo mismo que la lista de prohibiciones: dos verdes sobre
    // dos listas. La CONCATENACION si es de aqui: es la decision de encender la opcional.
    expect(REGLAS_EXIGIDAS).toEqual([
      ...EXIGIDAS_POR_EL_PRODUCTO,
      ...OPCIONALES_DEL_PRODUCTO_REGLAS,
    ]);
  });
});

describe('lo unico que este arbol pone es la ruta, y aqui la ruta es NINGUNA', () => {
  it('las que exceptuan algo son las mismas, exceptuen donde exceptuen', () => {
    const alla = LAS_DIEZ_DE_ALLA.filter((p) => p.salvo !== undefined).map((p) => p.clave);
    const aqui = PROHIBICIONES.filter((p) => p.salvo !== undefined).map((p) => p.clave);

    expect(
      aqui,
      'Una excepcion que existe a un lado y no al otro no es una ruta distinta: es otra regla.',
    ).toEqual(alla);
  });

  it('y cae donde `SALVO_EN_ESTE_ARBOL` dice, que es lo unico propio', () => {
    // Por clave y no por posicion: el orden de la lista lo pone la libreria y el del objeto,
    // quien lo escribe.
    const situadas = Object.fromEntries(
      PROHIBICIONES.filter((p) => p.salvo !== undefined).map((p) => [p.clave, [...(p.salvo ?? [])]]),
    );

    expect(situadas).toEqual(
      Object.fromEntries(Object.entries(SALVO_EN_ESTE_ARBOL).map(([c, rutas]) => [c, [...rutas]])),
    );
  });

  it('LA LISTA VACIA ES UN DATO MEDIDO: cero `fetch` en `src/`', () => {
    // **Aqui `rentas` compara sus rutas con las de la libreria y exige que no coincidan.** Ese
    // centinela con la lista VACIA no diria nada —ninguna ruta coincide con ninguna—, asi que se
    // sustituye por lo que de verdad justifica el vacio: que en este arbol NO HAY ningun sitio
    // donde `fetch` sea legitimo, porque el cliente HTTP lo pone `@kamayuk/api` desde el clon
    // hermano (#55) y aqui no queda ninguna llamada (#57).
    //
    // Se mide el arbol, no se afirma. El dia que alguien escriba un `fetch` en `src/`, esto sale
    // rojo diciendo el archivo — y `yarn lint` tambien, porque ya no se exceptua ningun
    // directorio. Si ese `fetch` fuera legitimo, lo que hay que cambiar es esta lista, y este
    // rojo es lo que obliga a decirlo.
    expect(DONDE_SE_LLAMA_A_FETCH).toEqual([]);

    const conFetch = archivosDeCodigo(join(RAIZ, 'src')).filter((archivo) =>
      /\bfetch\s*\(/.test(readFileSync(archivo, 'utf8')),
    );

    expect(
      conFetch.map((a) => a.slice(RAIZ.length + 1)),
      'Hay un `fetch` en `src/`, y `DONDE_SE_LLAMA_A_FETCH` es la lista vacia: o sobra la\n' +
        'llamada —toda peticion pasa por `solicitar()` de `@kamayuk/api`— o este arbol acaba de\n' +
        'ganar un sitio donde `fetch` es legitimo, y entonces se declara aqui con su motivo.',
    ).toEqual([]);
  });
});

describe('LA GUARDA DEL FORK: este archivo deriva, no escribe', () => {
  it('no declara ni un `selector`', () => {
    // El dia que alguien vuelva a pegar la lista aqui, la comparacion de arriba PASARIA —la copia
    // recien hecha es identica— y el fork empezaria en verde, que es exactamente como empezo el
    // que #62 cierra. Esto es lo que lo caza en el momento de hacerlo.
    const declarados = FUENTE_DE_LA_DERIVACION.split('\n').filter((linea) =>
      /^\s*selector:/.test(linea),
    );

    expect(
      declarados,
      '`eslint.prohibiciones.mjs` esta escribiendo prohibiciones otra vez. Las diez son del\n' +
        'producto y viven en `@kamayuk/verificaciones`; aqui solo se enciende la opcional y se\n' +
        'situan las excepciones.',
    ).toEqual([]);
  });

  it('ni un `message`, que es la otra mitad del dato', () => {
    const declarados = FUENTE_DE_LA_DERIVACION.split('\n').filter((linea) =>
      /^\s*message:/.test(linea),
    );

    expect(
      declarados,
      'Un `message` escrito aqui es media prohibicion forkeada: el texto que lee quien la\n' +
        'incumple deja de ser el del producto, y `reglas-de-eslint` sigue en verde porque compara\n' +
        'contra este mismo archivo.',
    ).toEqual([]);
  });

  it('y lo que importa es el paquete, no una ruta al clon hermano', () => {
    // Un `import '../../kamayuk-lib/paquetes/verificaciones/prohibiciones.mjs'` tambien
    // «derivaria»... saltandose el `link:`, o sea sin `package.json` que lo declare, sin
    // `enlace-con-kamayuk-lib.test.ts` que lo vigile y con un `ENOENT` por todo rojo el dia que
    // el hermano no este.
    expect(FUENTE_DE_LA_DERIVACION).toContain("import('@kamayuk/verificaciones/prohibiciones')");

    const porRuta = FUENTE_DE_LA_DERIVACION.split('\n').filter((linea) =>
      /(?:^import .* from|\bimport\()\s*'[^']*kamayuk-lib\//.test(linea),
    );
    expect(porRuta, 'la libreria se alcanza por su nombre de paquete, no por el disco').toEqual([]);
  });
});

/**
 * **AC 2 DEL ISSUE: derivar no cuesta ni un nombre de cifra.**
 *
 * `rentas`#137 no tenia este problema —la lista comun ya era la suya—. Aqui si: la V6 vigilaba
 * trece nombres de campo y doce nombres de cifra normativa que la libreria **no tenia** hasta
 * `kamayuk-lib`#58, que los metio como UNION. Las dos listas de abajo son la fotografia de
 * `c01fe9a:frontend/eslint.prohibiciones.mjs:53-54,85-86`, guardadas como dato con su procedencia,
 * y cada nombre se ejerce con ESLint DE VERDAD sobre el lint de este arbol.
 *
 * Lo que la V6 cazaba y el lint derivado no, sale **rojo nombrando el identificador**. Lo que el
 * derivado caza de mas —`saldo`, `deuda`, `vuelto`…— se acepta: sumar no debilita.
 */
describe('AC 2: ningun nombre de cifra de la V6 se ha perdido', () => {
  const eslint = new ESLint({ cwd: RAIZ });

  /**
   * ESLint se arranca aqui y no dentro del primer caso: el arranque en frio —el `import` de
   * `eslint`, `typescript-eslint` y `typescript` entero— costaba 3,64 s medido en `rentas`#36, y
   * dentro del presupuesto de 5 s de un caso revienta con un rojo que habla de la maquina.
   */
  beforeAll(async () => {
    await eslint.lintText('export const listo = 1;\n', {
      filePath: join(RAIZ, 'src/pantallas/calentamiento.ts'),
    });
  }, 60_000);

  const mensajes = async (codigo: string, nombre: string): Promise<string> => {
    const [resultado] = await eslint.lintText(codigo, {
      filePath: join(RAIZ, 'src/pantallas', nombre),
    });
    return (resultado?.messages ?? []).map((m) => m.message).join('\n');
  };

  /**
   * `CAMPOS_DE_CIFRA` de `c01fe9a:frontend/eslint.prohibiciones.mjs:53-54`, nombre a nombre.
   * `total` va aparte, con su excepcion de paginacion, y lo ejerce `reglas-de-eslint.test.ts`.
   */
  const CAMPOS_DE_CIFRA_DE_LA_V6 = [
    'monto',
    'importe',
    'uit',
    'alicuota',
    'arancel',
    'valorUnitario',
    'valorArancelario',
    'valorReferencial',
    'insoluto',
    'interes',
    'deduccion',
    'depreciacion',
  ];

  it.each(CAMPOS_DE_CIFRA_DE_LA_V6)('«%s» declarado number sigue rojo', async (nombre) => {
    expect(
      await mensajes(`export interface Fila { readonly ${nombre}: number }\n`, `${nombre}.ts`),
      `«${nombre}» estaba en CAMPOS_DE_CIFRA de la V6 y el lint derivado ya no lo senala:\n` +
        'derivar acaba de costar un campo de cifra sin vigilar, y no hay rojo en ningun otro\n' +
        'sitio que lo diga. Se anade a la union de `CAMPOS_DE_DINERO` en `kamayuk-lib`.',
    ).toMatch(/Un importe se declara «string»/);
  });

  it.each(CAMPOS_DE_CIFRA_DE_LA_V6)('«%s» convertido a number sigue rojo', async (nombre) => {
    expect(
      await mensajes(`export const x = (f: { ${nombre}: string }) => Number(f.${nombre});\n`, `c-${nombre}.ts`),
      `«${nombre}» dejo de senalarse al convertirlo: la segunda mitad de la regla 1 se perdio.`,
    ).toMatch(/Un importe es texto y pierde centimos/);
  });

  it.each(CAMPOS_DE_CIFRA_DE_LA_V6)('la aritmetica con «%s» sigue roja', async (nombre) => {
    expect(
      await mensajes(`export const x = (f: { ${nombre}: string }) => f.${nombre} + f.${nombre};\n`, `a-${nombre}.ts`),
      `«${nombre}» dejo de senalarse en una operacion: se perdio la tercera mitad de la regla 1.`,
    ).toMatch(/Aritmetica con un importe/);
  });

  /** `CIFRAS_NORMATIVAS` de `c01fe9a:frontend/eslint.prohibiciones.mjs:85-86`, nombre a nombre. */
  const CIFRAS_NORMATIVAS_DE_LA_V6 = [
    'uit',
    'alicuota',
    'tramo',
    'arancel',
    'valorUnitario',
    'valorArancelario',
    'valorReferencial',
    'depreciacion',
    'deduccion',
    'minimoImponible',
    'factorDeActualizacion',
    'porcentajeDeActualizacion',
  ];

  it.each(CIFRAS_NORMATIVAS_DE_LA_V6)('«%s» clavado como literal sigue rojo', async (nombre) => {
    expect(
      await mensajes(`export const ${nombre}Predial = '0.006';\n`, `n-${nombre}.ts`),
      `«${nombre}» estaba en CIFRAS_NORMATIVAS de la V6 y la opcional ya no lo senala: una cifra\n` +
        'normativa mas que se puede clavar en el bundle del repositorio que existe para que no las\n' +
        'haya. Se anade a `CIFRAS_NORMATIVAS` en `kamayuk-lib`.',
    ).toMatch(/Ninguna cifra tributaria literal/);
  });

  /**
   * **LAS CUATRO COLECCIONES DEL SNAPSHOT** (AC 4, y la decision sobre `tramos`).
   *
   * Son las cuatro listas que `SnapshotDelConjunto` publica, y el `reduce` de la V6 vigilaba
   * `tramos|conceptos|valores|parametros`. El derivado no lleva `tramos` —falso positivo medido en
   * `catastro`— y aqui se comprueba que eso **no deja ninguna sin vigilar**: las cuatro caen por
   * prefijo, `parametros` y `valores` por la lista de colecciones y `depreciaciones` por
   * `depreciacion` de la lista de campos. Este sistema no publica ninguna coleccion `tramos`, y el
   * motivo entero esta en la cabecera de `eslint.prohibiciones.mjs`.
   */
  const COLECCIONES_DEL_SNAPSHOT = [
    'parametros',
    'valoresUnitarios',
    'depreciaciones',
    'valoresReferenciales',
  ];

  it.each(COLECCIONES_DEL_SNAPSHOT)('un `reduce` sobre «%s» sale rojo', async (coleccion) => {
    const mal = `export const junta = (s: { ${coleccion}: readonly { clave: string }[] }) =>\n  s.${coleccion}.reduce((a, p) => a + p.clave, '');\n`;

    expect(
      await mensajes(mal, `r-${coleccion}.ts`),
      `«${coleccion}» es una de las cuatro colecciones del snapshot y sumarla en la pantalla\n` +
        'compone una cifra que nadie sello. Si dejo de senalarse, la lista de colecciones de\n' +
        '`kamayuk-lib` ya no cubre lo que este sistema publica.',
    ).toMatch(/Aritmetica con un importe/);
  });

  /**
   * **LOS CUATRO CAMPOS DECIMALES DEL SNAPSHOT**, repartidos como decidio `kamayuk-lib`#58.
   *
   * `valorNumerico` y `valorM2` los vigila ESLint; `porcentaje` y `valor` a secas **no**, porque
   * en `catastro` son indices y numeros de columna —`avance-por-fila.tsx:37`,
   * `columnas-de-la-respuesta.tsx:42`— y una prohibicion que senala codigo correcto se desactiva.
   * A esos dos no los deja sin barrera: los cuatro llegan como `"texto"` en
   * `docs/50-api/formas-de-la-api.json`, y quien lo comprueba campo a campo contra el `record` del
   * backend es `FormasDeLaApiTest`, no ESLint. Las dos mitades se ejercen aqui para que el reparto
   * no se pueda cambiar en silencio por ninguno de los dos lados.
   */
  it.each(['valorNumerico', 'valorM2'])('«%s» lo vigila ESLint', async (nombre) => {
    expect(
      await mensajes(`export interface Fila { readonly ${nombre}: number }\n`, `s-${nombre}.ts`),
      `«${nombre}» es uno de los cuatro campos decimales del snapshot y lo vigila ESLint\n` +
        '(decidido en `kamayuk-lib`#58). Si deja de hacerlo, un valor del cuadro de ADR-0017\n' +
        'puede declararse `number` y perder centimos antes de mostrarse.',
    ).toMatch(/Un importe se declara «string»/);
  });

  it.each(['porcentaje', 'valor'])('«%s» a secas NO lo vigila ESLint, y es deliberado', async (nombre) => {
    expect(
      await mensajes(`export interface Columnas { readonly ${nombre}: number }\n`, `col-${nombre}.ts`),
      `«${nombre}» a secas entro en la lista de campos y pone rojo a \`catastro\` por un indice de\n` +
        'columna. Entra CON APELLIDO —`valorUnitario`, `porcentajeDeActualizacion`—. Los dos\n' +
        'campos del snapshot que se llaman asi los cubre la guarda de formas de la API, que los\n' +
        'mide como «texto» contra el `record` del backend.',
    ).toBe('');
  });
});

/** Los `.ts`/`.tsx` de un directorio, recursivamente. Sin dependencias: es un `readdir`. */
function archivosDeCodigo(raiz: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(raiz)) {
    const ruta = join(raiz, entrada);
    if (statSync(ruta).isDirectory()) {
      salida.push(...archivosDeCodigo(ruta));
    } else if (/\.tsx?$/.test(entrada)) {
      salida.push(ruta);
    }
  }
  return salida;
}
