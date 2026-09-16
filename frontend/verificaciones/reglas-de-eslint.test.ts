import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  DONDE_SE_LLAMA_A_FETCH,
  PROHIBICIONES,
  REGLAS_EXIGIDAS,
} from '../eslint.prohibiciones.mjs';

/**
 * Las reglas de `eslint.config.js` muerden.
 *
 * Es el equivalente frontend de `ReglasDeArquitecturaMuerdenTest`: cada prohibicion tiene
 * una muestra que la viola a proposito, y aqui se exige que ESLint la senale. **Una regla
 * que no puede fallar no protege nada** — el mismo argumento por el que la prueba de
 * aislamiento demuestra que el superusuario omite RLS en vez de afirmarlo.
 *
 * Tres cosas hacen que esto no sea una lista mas que alguien olvida actualizar:
 *
 *   1. La lista de prohibiciones **se importa del propio config**. No hay copia.
 *   2. El nombre del archivo de la muestra **se compone** desde el `clave`. Anadir una
 *      prohibicion sin su muestra es un archivo que no existe, y sale rojo aqui mismo.
 *   3. El mensaje esperado **es el del config**. Si alguien reescribe el mensaje y deja la
 *      regla apagada, no hay texto duplicado que lo tape.
 *
 * Lo que ninguna derivacion puede sujetar es que alguien BORRE una prohibicion: con ella
 * se iria su prueba, en verde. Eso lo sujeta `REGLAS_EXIGIDAS`, que es la unica lista
 * escrita a mano y la que nombra las reglas del producto.
 *
 * Las muestras estan en `ignores` de la configuracion para que `yarn lint` no las senale;
 * aqui se lintan como TEXTO, con una ruta sintetica dentro de `src/`, que es donde la
 * regla tiene que aplicar de verdad.
 *
 * <h2>Desde #50, el de `rentas@ac379ac` mas lo propio; y desde #62, sobre la lista DERIVADA</h2>
 *
 * La forma es la de `rentas`: el arranque en frio en `beforeAll` y la excepcion de `fetch` como
 * LISTA (`DONDE_SE_LLAMA_A_FETCH`). Lo que `rentas` no tiene y aqui se queda, cada cosa por lo
 * suyo: los casos de `cifra-tributaria-literal`, que es la decima prohibicion y que aqui se
 * ENCIENDE —la publica `@kamayuk/verificaciones` en `PROHIBICIONES_OPCIONALES` y nadie mas la
 * enciende (`kamayuk-lib`#58)—, y los ejemplos de «codigo correcto», que en `rentas` declaran
 * `alicuotaPredial = '0.006'` —aqui eso es justo lo prohibido—.
 *
 * **Lo que #62 cambia no es este archivo sino de donde sale su lista**: `PROHIBICIONES` y
 * `REGLAS_EXIGIDAS` ya no se escriben en este arbol, se derivan. Que la derivacion no haya costado
 * ni una prohibicion, ni un nombre de cifra, lo mide
 * `las-prohibiciones-son-las-de-la-libreria.test.ts`; lo que se mide aqui sigue siendo lo mismo:
 * que cada una tenga su muestra y que ESLint la senale.
 *
 * **Y la excepcion de `fetch` pasa a ser la lista VACIA** (#62): este frontend no tiene cliente de
 * API propio —lo pone `@kamayuk/api` (#55)— y no queda un solo `fetch` en `src/` (#57). Los dos
 * casos que `rentas` dedica a «el cliente de API no queda exento de TODO» no tienen aqui sujeto, y
 * en su lugar va el simetrico: que `fetch` salga rojo TAMBIEN en el directorio que en `rentas`
 * esta exceptuado.
 *
 * Salio el bloque «AC8 — las dos barreras de `Importe`»: afirmaba que el tipo de `Importe`
 * cubria el `createElement` que ESLint no ve, y ese tipo salio con `src/ds/`. Vuelve con la
 * barrera de tipos de `@kamayuk/ui` (#55).
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const MUESTRAS = join(AQUI, 'muestras');

const eslint = new ESLint({ cwd: RAIZ });

/**
 * ESLint se arranca AQUI, y no dentro del primer caso (`rentas`#36).
 *
 * Medido alli: el arranque en frio costaba 3,64 s y sus hermanas de 0,02 a 0,51, o sea que el
 * primer caso pagaba el `import` de `eslint`, de `typescript-eslint` y de `typescript` entero
 * para todos los demas, dentro de SU presupuesto de tiempo. Con un `30_000` escrito a mano —el
 * que este archivo llevaba hasta `c01fe9a`— aun asi reventaba: en una de doce corridas tardo
 * 49,80 s y salio «Test timed out in 30000ms», un rojo que habla de la maquina y no de la regla.
 *
 * Aqui el coste deja de estar dentro de una prueba que no lo mide, y si algun dia el arranque se
 * atasca, el rojo sale de este gancho y dice que fue el arranque.
 */
beforeAll(async () => {
  await eslint.lintText('export const listo = 1;\n', {
    filePath: join(RAIZ, 'src/pantallas/calentamiento.ts'),
  });
}, 60_000);

/**
 * Ruta sintetica: la muestra se juzga como si viviera en una pantalla de la aplicacion.
 *
 * **Conserva la extension del archivo de la muestra**, y no es un detalle: una muestra con
 * JSX tiene que juzgarse como `.tsx`. Juzgada como `.ts`, el analizador de TypeScript no
 * admite JSX y el rojo habla de un error de sintaxis en vez de la regla que se venia a
 * comprobar — o peor, la prohibicion no llega a evaluarse y la muestra pasa en verde.
 */
const enUnaPantalla = (nombre: string) => join(RAIZ, 'src/pantallas', nombre);

/** El archivo de la muestra de esa clave, o `null` si no hay ninguno. */
function archivoDeLaMuestra(clave: string): string | null {
  for (const extension of ['.ts', '.tsx']) {
    const candidato = join(MUESTRAS, `${clave}${extension}`);
    if (existsSync(candidato)) {
      return candidato;
    }
  }
  return null;
}

/** Lo que ESLint dice de ese texto, juzgado en la ruta que se le da. */
async function mensajesDelTexto(codigo: string, rutaJuzgada: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: rutaJuzgada });
  return (resultado?.messages ?? []).map((m) => m.message);
}

/** Lo mismo, para una muestra: se lee del disco y se juzga en la ruta que se le da. */
const mensajesDe = (archivo: string, rutaJuzgada: string) =>
  mensajesDelTexto(readFileSync(archivo, 'utf8'), rutaJuzgada);

describe('cada prohibicion tiene su muestra, y ESLint la senala', () => {
  it.each(PROHIBICIONES.map((p) => ({ ...p })))('$clave', async ({ clave, message }) => {
    const archivo = archivoDeLaMuestra(clave);

    expect(
      archivo,
      `La prohibicion «${clave}» no tiene muestra que la viole.\n` +
        `Escribe verificaciones/muestras/${clave}.ts con codigo que la incumpla a\n` +
        `proposito. Una regla sin muestra no se ha demostrado que pueda fallar, y una\n` +
        `regla que no puede fallar no protege nada.`,
    ).not.toBeNull();

    const mensajes = await mensajesDe(archivo as string, enUnaPantalla(basename(archivo as string)));

    expect(
      mensajes,
      `ESLint no senalo la muestra de «${clave}».\n` +
        `Se esperaba el mensaje del config:\n  ${message}\n` +
        `Se obtuvo:\n${mensajes.length === 0 ? '  (ninguno)' : mensajes.map((m) => `  · ${m}`).join('\n')}`,
    ).toContain(message);
    // Sin tiempo propio: el arranque en frio lo paga `beforeAll`, asi que los casos caben en
    // los 5 s de Vitest (`rentas`#36).
  });
});

describe('la lista de prohibiciones y la de muestras no se separan', () => {
  it('cada regla del producto tiene al menos una prohibicion que la sirve', () => {
    const servidas = new Set(PROHIBICIONES.map((p) => p.regla));
    const huerfanas = REGLAS_EXIGIDAS.filter((regla) => !servidas.has(regla));

    expect(
      huerfanas,
      'Hay reglas del producto que ninguna prohibicion de ESLint expresa. Una regla que\n' +
        'solo vive en un documento se incumple en seis meses.',
    ).toEqual([]);
  });

  it('ninguna prohibicion sirve a una regla que nadie declaro', () => {
    const noDeclaradas = PROHIBICIONES.filter((p) => !REGLAS_EXIGIDAS.includes(p.regla)).map(
      (p) => `${p.clave} -> ${p.regla}`,
    );

    expect(
      noDeclaradas,
      'Una prohibicion nueva se declara tambien en REGLAS_EXIGIDAS: si no, borrarla se\n' +
        'llevaria su prueba por delante y nadie lo notaria.',
    ).toEqual([]);
  });

  it('no hay muestras sin prohibicion que las reclame', () => {
    const claves = new Set(PROHIBICIONES.map((p) => p.clave));
    const sobrantes = readdirSync(MUESTRAS)
      .map((archivo) => archivo.replace(/\.tsx?$/, ''))
      .filter((clave) => !claves.has(clave));

    expect(
      sobrantes,
      'Sobra una muestra: viola una regla que ya no existe, asi que nadie la lee y nada\n' +
        'la mantiene cierta.',
    ).toEqual([]);
  });

  it('las nueve reglas que el issue nombra estan las nueve', () => {
    // El numero escrito, y a proposito. Desde #62 `REGLAS_EXIGIDAS` se deriva —son las ocho del
    // producto mas la opcional que este sistema enciende—, asi que esta cifra ya no sujeta una
    // lista escrita aqui: sujeta la DECISION de encender la opcional. Si alguien deja de
    // encenderla, o si la libreria mueve una regla de sitio, esto es lo que se pone rojo.
    expect(REGLAS_EXIGIDAS).toHaveLength(9);
    expect(PROHIBICIONES).toHaveLength(10);
  });
});

describe('la excepcion de `fetch` existe, y en ESTE arbol no cae en ningun sitio', () => {
  const conExcepcion = PROHIBICIONES.filter((p) => p.salvo !== undefined);

  it('solo `fetch` la lleva, y aqui su lista de sitios es la VACIA', () => {
    // Se comprueba la LISTA ENTERA, no su tamano: anadir un prefijo exige decir cual.
    expect(conExcepcion.map((p) => p.clave)).toEqual(['fetch-fuera-del-cliente']);
    expect(new Set(conExcepcion.flatMap((p) => p.salvo ?? []))).toEqual(
      new Set(DONDE_SE_LLAMA_A_FETCH),
    );
    // Vacia desde #62, y no es una omision: el cliente HTTP lo pone `@kamayuk/api` desde el clon
    // hermano (#55) y aqui no queda un solo `fetch` (#57). Que eso siga siendo cierto lo mide
    // `las-prohibiciones-son-las-de-la-libreria.test.ts`, leyendo `src/`.
    expect(DONDE_SE_LLAMA_A_FETCH).toEqual([]);
  });

  it('y cada `salvo` es una LISTA, no una cadena que funciona por accidente', () => {
    // **Las tres lineas de arriba no lo ven, y se midio (#50).** Con `salvo: CLIENTE_DE_API`
    // —la cadena de `c01fe9a`—, `flatMap` no aplana una cadena: la devuelve entera como
    // elemento, el conjunto sale `{'src/api/'}` y la comparacion pasa en VERDE. Y el
    // `eslint.config.js` tambien «funciona» —`yarn lint` sale limpio—, porque
    // `'src/api/'.includes('src/api/')` es una busqueda de subcadena. Lo que si sale rojo es el
    // `it.each` de abajo, pero por un motivo que despista: `[...'src/api/']` son OCHO letras, y
    // pregunta si `fetch` se exceptua «dentro de 's'», «de 'r'»… Y `tsc`, por el `@typedef`. Esta
    // prueba es la que dice lo que pasa.
    const noListas = conExcepcion
      .filter((p) => !Array.isArray(p.salvo))
      .map((p) => `${p.clave}: ${JSON.stringify(p.salvo)}`);
    expect(
      noListas,
      'Un `salvo` que no es lista hace que `eslint.config.js` compare por SUBCADENA: el dia que\n' +
        'otra prohibicion exceptue `src/`, `fetch` deja de estar prohibido en `src/` entero.',
    ).toEqual([]);
  });

  it('en una pantalla, `fetch` sale rojo', async () => {
    const mensajes = await mensajesDe(
      archivoDeLaMuestra('fetch-fuera-del-cliente') as string,
      enUnaPantalla('cualquiera.ts'),
    );

    expect(mensajes.join('\n')).toMatch(/Las peticiones pasan por «solicitar»/);
  });

  it.each(['src/api/', 'src/datos/', 'src/'])(
    'y tambien dentro de «%s», que es el simetrico de la excepcion de `rentas`',
    async (directorio) => {
      // **Este es el caso que sustituye a los dos de `rentas`**, y es el que de verdad ejerce la
      // lista vacia. `src/api/` es el prefijo que `rentas` exceptua y que este arbol NO: si
      // alguien lo reintrodujera en `SALVO_EN_ESTE_ARBOL` «por simetria», esto es lo que lo dice.
      // Con la lista vacia no hay bloque de excepcion en `eslint.config.js` y la prohibicion vale
      // en todo el arbol, que es justo lo que se quiere comprobar.
      const mensajes = await mensajesDe(
        archivoDeLaMuestra('fetch-fuera-del-cliente') as string,
        join(RAIZ, directorio, 'x.ts'),
      );

      expect(
        mensajes.join('\n'),
        `«${directorio}» dejo de prohibir \`fetch\`. Aqui no hay ningun sitio donde sea legitimo:\n` +
          'toda peticion pasa por `solicitar()` de `@kamayuk/api`, y ahi viven el token, la clave\n' +
          'de idempotencia y el formato de error.',
      ).toMatch(/Las peticiones pasan por «solicitar»/);
    },
  );

  it('y la regla propia tampoco se exceptua en ningun sitio', async () => {
    // Importa mas todavia: el sitio por donde la cifra llega del conjunto sellado es donde mas
    // tienta escribir «mientras tanto» un valor por omision. Un valor por omision no cobra de
    // mas, perdona de mas o autoriza de mas: eso lo hace una cifra que nadie sello.
    const mensajes = await mensajesDe(
      archivoDeLaMuestra('cifra-tributaria-literal') as string,
      join(RAIZ, 'src/api/', 'x.ts'),
    );

    expect(mensajes.join('\n')).toMatch(/Ninguna cifra tributaria literal/);
  });
});

describe('la regla propia de «normativa»: ninguna cifra literal', () => {
  it('la linea que en «rentas» pasa limpia, aqui es roja', async () => {
    // Literalmente la misma linea que `rentas` usa como ejemplo de codigo CORRECTO en su
    // propia prueba de reglas. Alli lo es: `rentas` consume la alicuota y puede tenerla a
    // mano. Aqui no, y esa es toda la diferencia entre los dos repositorios: este es el
    // que la PUBLICA, y una cifra publicada sin las dos firmas de ADR-0007 no es la cifra.
    const mensajes = await mensajesDelTexto(
      "export const alicuotaPredial = '0.006';\n",
      enUnaPantalla('alicuota.ts'),
    );

    expect(mensajes.join('\n')).toMatch(/Ninguna cifra tributaria literal/);
  });

  it('caza tambien el numero, no solo el texto', async () => {
    const mensajes = await mensajesDelTexto('export const uit = 5500;\n', enUnaPantalla('uit.ts'));

    expect(mensajes.join('\n')).toMatch(/Ninguna cifra tributaria literal/);
  });

  it('pero NO senala un numero que no es una cifra normativa', async () => {
    // **Es la mitad que hace util a la otra.** Una prohibicion sobre literales numericos
    // que senalara todos los literales numericos se desactivaria el primer dia, y una
    // regla desactivada no protege nada. Lo que la hace aplicable es que mire el NOMBRE
    // al que la cifra queda atada.
    const mensajes = await mensajesDelTexto(
      'export const filasPorPagina = 50;\nexport const ejercicioPorOmision = 2026;\n',
      enUnaPantalla('paginacion.ts'),
    );

    expect(
      mensajes,
      'Si un contador de filas queda senalado, la regla ya no distingue una cifra\n' +
        'normativa de cualquier numero — que es indistinguible de no distinguir nada.',
    ).toEqual([]);
  });

  it('y no senala la cifra que se PIDE, que es la forma correcta de tenerla', async () => {
    const correcto = `
      export function uitDelEjercicio(conjunto: { uit: string }) {
        return conjunto.uit;
      }
    `;

    expect(await mensajesDelTexto(correcto, enUnaPantalla('conjunto.ts'))).toEqual([]);
  });
});

describe('las reglas no senalan codigo correcto', () => {
  it('los dos contadores del envoltorio de paginacion se declaran «number», y pasan', async () => {
    // `totalElementos` y `totalPaginas` son cuentas de cosas, no cifras del dominio: el
    // backend los publica como entero. Si la prohibicion los senalara, toda pantalla con
    // una tabla arrancaria con dos `eslint-disable` — y una regla que se desactiva por
    // costumbre deja de proteger a la tercera vez.
    const envoltorio = `
      export interface Pagina<T> {
        readonly contenido: readonly T[];
        readonly pagina: number;
        readonly tamano: number;
        readonly totalElementos: number;
        readonly totalPaginas: number;
        readonly hayMas: boolean;
      }
    `;

    expect(await mensajesDelTexto(envoltorio, enUnaPantalla('paginacion.ts'))).toEqual([]);
  });

  it('pero el resto de «total…» sigue prohibido: la excepcion no se derrama', async () => {
    const conCifra = `
      export interface Cuadro {
        readonly totalDelCuadro: number;
      }
    `;

    expect((await mensajesDelTexto(conCifra, enUnaPantalla('cuadro.ts'))).join('\n')).toMatch(
      /Un importe se declara «string»/,
    );
  });

  it('el codigo que las respeta pasa limpio', async () => {
    const correcto = `
      import { solicitar } from '../api/cliente.ts';

      export interface ConjuntoSellado {
        readonly ejercicio: number;
        readonly uit: string;
        readonly fechaDeSellado: string;
      }

      export function conjuntoDe(ejercicio: number) {
        // La UIT no se escribe aqui: se pide al conjunto sellado del ejercicio, que es
        // quien la trae con su edicion, su firma y su fecha.
        return solicitar<ConjuntoSellado>(\`/conjuntos/\${ejercicio}\`);
      }
    `;

    expect(await mensajesDelTexto(correcto, enUnaPantalla('correcto.ts'))).toEqual([]);
  });

  it('un «Importe» CON su fecha de calculo pasa limpio', async () => {
    // **Esta es la mitad que faltaba, y hace falta.** La muestra de `importe-sin-fecha`
    // escribe `<Importe valor="…" />` SIN un solo atributo, asi que un selector que
    // buscara cualquier otro nombre —`fechaDeCalculo` en vez de `fechaCalculo`— la
    // seguiria senalando igual, y la prohibicion pasaria en VERDE habiendo dejado de
    // proteger nada. Lo que lo caza es el caso positivo.
    const correcto = `
      function Importe(_props: { valor: string; fechaCalculo: string }) {
        return null;
      }

      export function FilaDelCuadro() {
        return <Importe valor="412.88" fechaCalculo="2026-09-06" />;
      }
    `;

    expect(
      await mensajesDelTexto(correcto, enUnaPantalla('correcto.tsx')),
      'Un `<Importe>` que SI declara su fecha no puede estar senalado: si lo esta, el\n' +
        'selector ya no busca el atributo que dice buscar, y entonces la prohibicion\n' +
        'senala a todo el mundo — que es indistinguible de no senalar a nadie.',
    ).toEqual([]);
  });
});
