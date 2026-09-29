// @vitest-environment node
//
// Lee `lecturas.ts` y el conector del disco y los parsea con el compilador de TypeScript, y lee el
// contrato. No hay DOM que necesitar — y bajo jsdom `fileURLToPath` revienta.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **Una lectura declara TODO lo que su operacion publica, y nada que no publique** (#66).
 *
 * Calcada de `rentas/frontend/verificaciones/la-lectura-declara-lo-que-la-operacion-publica.test.ts`
 * (`rentas`#239, en su `origin/main`), con **el sujeto de este sistema**: alli son veinticinco
 * tipos de fila de veinticinco operaciones; aqui son las **tres listas de cuadros** de una sola,
 * `GET /conjuntos/{id}/snapshot`.
 *
 * <h2>El defecto que cierra, con el nombre del que lo sufrio</h2>
 *
 * En `rentas`, `GET /fiscalizacion/actas` publicaba cinco campos que `ActaDeFiscalizacion` no
 * declaraba, y la pantalla dibujaba la raya con la nota «Ninguna operacion del contrato publica
 * este dato» — que **ya no era verdad**. Ese defecto no rompe nada: la pantalla se pinta, las
 * pruebas pasan, y lo que se lee es una mentira con formato que manda a arreglar un backend que ya
 * lo arreglo. Solo se ve comparando las dos listas.
 *
 * Aqui el mismo defecto costaria mas caro y seria mas mudo: un campo que falte en el tipo **no se
 * puede leer** —no compila—, y la celda que lo ensenaria no existe; uno que sobre llega como
 * `undefined` y sale como celda vacia **en una tabla de cifras normativas**, donde una celda en
 * blanco no distingue «no lo sabemos» de «vale cero».
 *
 * <h2>Las dos direcciones, y las dos hacen falta</h2>
 *
 * · **Ninguna llave publicada se queda sin declarar.** Es la de `rentas`.
 * · **Ninguna declarada la deja de publicar el contrato.** Esta la anade este sistema, y la anade
 *   porque aqui hay UNA operacion y sus filas se dibujan **enteras**: cada llave declarada es una
 *   columna, y una columna que lee una llave que no llega no da error, da una columna de vacios.
 *
 * <h2>Y `parametros` sigue sin tipo, con su motivo</h2>
 *
 * Es la cuarta lista del mismo cuerpo, y el contrato publica su forma. **Ninguna de las cuatro
 * hojas dibuja una fila de parametros**: Publicacion las cuenta y Cuadros no las mira. Declarar
 * aqui la forma de una fila que nadie lee seria escribir un contrato sin lector — y un contrato sin
 * lector no se entera de quedarse viejo. Mientras siga siendo `readonly unknown[]`, **el compilador
 * es la guarda**: no hay forma de leerle un campo. Se comprueba las dos cosas, para que la
 * excepcion no se quede tapando algo que ya se lee.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const FORMAS = join(FRONTEND, '../docs/50-api/formas-de-la-api.json');
const LECTURAS = join(FRONTEND, 'src/datos/lecturas.ts');
const CONECTOR = join(FRONTEND, 'src/datos/cuadros.ts');

/** La operacion cuyas filas dibuja Cuadros. */
const OPERACION = 'GET /conjuntos/{id}/snapshot';

/**
 * **Que tipo de `lecturas.ts` es la forma de que lista del cuerpo.**
 *
 * Se escribe a mano, como en `rentas`, y por el mismo motivo: derivarla del conector la haria pasar
 * diga lo que diga. Lo que impide que se quede corta es el centinela de abajo, que exige que cubra
 * **todas** las listas que el conector dibuja.
 */
const LA_FORMA_DE: Readonly<Record<string, string>> = {
  ValorUnitarioDelSnapshot: 'valoresUnitarios',
  DepreciacionDelSnapshot: 'depreciaciones',
  ValorReferencialDelSnapshot: 'valoresReferenciales',
};

/**
 * **Lo que el cuerpo publica y NINGUN tipo declara, con su motivo.**
 *
 * Una sola entrada, y es «lo que ninguna pantalla lee», nunca «lo que se nos paso». Una excepcion
 * sin motivo escrito es como esta guarda se acaba vaciando.
 */
const PUBLICADO_QUE_NO_SE_DECLARA: Readonly<Record<string, string>> = {
  parametros:
    'Ninguna de las cuatro hojas dibuja una fila de parametros: Publicacion las CUENTA y Cuadros ' +
    'no las mira. Sigue como `readonly unknown[]`, asi que el compilador impide leerle un campo.',
};

/** El cuerpo publicado de la operacion. */
function cuerpoPublicado(): Record<string, unknown> {
  const contrato = JSON.parse(readFileSync(FORMAS, 'utf8')) as Record<string, unknown>;
  const suya = contrato[OPERACION];
  if (typeof suya !== 'object' || suya === null) {
    throw new Error(
      `El contrato no publica una forma de objeto para «${OPERACION}». La genera ` +
        '`FormasDeLaApiTest` del tipo de retorno del controlador; sin ella no hay nada que cruzar.',
    );
  }
  return suya as Record<string, unknown>;
}

/** La forma de UNA fila de una de las listas del cuerpo. */
function filaPublicada(lista: string): Readonly<Record<string, unknown>> {
  const valor = cuerpoPublicado()[lista];
  if (!Array.isArray(valor)) throw new Error(`«${OPERACION}» no publica «${lista}» como lista`);
  return (valor[0] ?? {}) as Record<string, unknown>;
}

/** Las propiedades declaradas por cada `export interface` de `lecturas.ts`. */
function camposDeclarados(): ReadonlyMap<string, readonly string[]> {
  const fuente = readFileSync(LECTURAS, 'utf8');
  const arbol = ts.createSourceFile('lecturas.ts', fuente, ts.ScriptTarget.Latest, true);
  const salida = new Map<string, readonly string[]>();
  for (const sentencia of arbol.statements) {
    if (!ts.isInterfaceDeclaration(sentencia)) continue;
    salida.set(
      sentencia.name.text,
      sentencia.members.filter(ts.isPropertySignature).map((uno) => uno.name.getText(arbol)),
    );
  }
  return salida;
}

/** Las listas que el conector de Cuadros dibuja, leidas de su propio dato. */
function listasQueSeDibujan(): readonly string[] {
  const fuente = readFileSync(CONECTOR, 'utf8');
  return [...fuente.matchAll(/^\s*campo: '(\w+)',$/gm)].map((casado) => casado[1] ?? '').sort();
}

describe('una lectura declara lo que su operacion publica (#66)', () => {
  it('EL CENTINELA: el contrato publica las cuatro listas, y cada una con su fila', () => {
    // Sin esto, un contrato que publicara `"texto"` —que es lo que un generador ve de un
    // `ResponseEntity<String>`— dejaria todo lo de abajo comparando el conjunto vacio, en verde.
    const cuerpo = cuerpoPublicado();
    const listas = [...Object.values(LA_FORMA_DE), ...Object.keys(PUBLICADO_QUE_NO_SE_DECLARA)];
    expect(listas.sort()).toEqual(
      Object.entries(cuerpo)
        .filter(([, valor]) => Array.isArray(valor))
        .map(([clave]) => clave)
        .sort(),
    );
    for (const lista of listas) {
      expect(
        Object.keys(filaPublicada(lista)).length,
        `«${lista}» se publica como lista VACIA: no hay fila que cruzar`,
      ).toBeGreaterThan(0);
    }
  });

  it('EL CENTINELA: la tabla cubre TODAS las listas que el conector dibuja', () => {
    // Sin esto, una cuarta lista que alguien empezara a dibujar se quedaria sin comparar para
    // siempre — que es como una barrera se apaga sin que nadie la borre (`rentas`#78, #80).
    expect(listasQueSeDibujan()).toEqual([...Object.values(LA_FORMA_DE)].sort());
  });

  it('EL CENTINELA: y cada entrada resuelve a una interfaz de `lecturas.ts`', () => {
    const declarados = camposDeclarados();
    for (const tipo of Object.keys(LA_FORMA_DE)) {
      expect(declarados.get(tipo), `«${tipo}» no es una interfaz de lecturas.ts`).toBeDefined();
      expect(declarados.get(tipo)?.length, `«${tipo}» no declara ni un campo`).toBeGreaterThan(0);
    }
  });

  it('LA IGUALDAD: ningun campo publicado se queda sin declarar', () => {
    const declarados = camposDeclarados();
    const desfases: string[] = [];
    for (const [tipo, lista] of Object.entries(LA_FORMA_DE)) {
      const mios = new Set(declarados.get(tipo) ?? []);
      const faltan = Object.keys(filaPublicada(lista)).filter((campo) => !mios.has(campo));
      if (faltan.length > 0) desfases.push(`  ${tipo} (${lista}): ${faltan.join(', ')}`);
    }
    expect(
      desfases,
      'El backend publica campos de una fila que la lectura de la interfaz no declara:\n' +
        `${desfases.join('\n')}\n\n` +
        '  Mientras no esten declarados, ningun conector puede leerlos —no compila— y la columna\n' +
        '  que los ensenaria no existe. Eso no rompe nada: se lee como un cuadro con una columna\n' +
        '  menos, y nadie sabe que falta. Fue el defecto de `ActaDeFiscalizacion` en `rentas`\n' +
        '  entre su #191 y su #239.',
    ).toEqual([]);
  });

  it('LA OTRA DIRECCION: ningun campo declarado lo deja de publicar el contrato', () => {
    const declarados = camposDeclarados();
    const sobran: string[] = [];
    for (const [tipo, lista] of Object.entries(LA_FORMA_DE)) {
      const publicados = new Set(Object.keys(filaPublicada(lista)));
      for (const campo of declarados.get(tipo) ?? []) {
        if (!publicados.has(campo)) sobran.push(`  ${tipo}.${campo} (${lista})`);
      }
    }
    expect(
      sobran,
      'La interfaz declara campos que la operacion ya no publica:\n' +
        `${sobran.join('\n')}\n\n` +
        '  Una llave que no llega no da error: llega `undefined`, y su columna sale VACIA en una\n' +
        '  tabla de cifras normativas — donde una celda en blanco no distingue «no lo sabemos» de\n' +
        '  «vale cero». Se corrige quitando la columna y el campo, en el mismo PR.',
    ).toEqual([]);
  });

  it('la excepcion de `parametros` sigue siendo cierta: se publica, y NO se tipa', () => {
    // Las dos mitades. Si el contrato dejara de publicarla, la excepcion estaria eximiendo algo que
    // no existe; si alguien le pusiera la forma de su fila, estaria tapando un tipo que SI se lee.
    for (const [lista, motivo] of Object.entries(PUBLICADO_QUE_NO_SE_DECLARA)) {
      expect(motivo.trim().length, `la excepcion de «${lista}» no dice por que`).toBeGreaterThan(40);
      expect(Object.keys(filaPublicada(lista)).length).toBeGreaterThan(0);
      expect(
        readFileSync(LECTURAS, 'utf8'),
        `«${lista}» dejo de ser \`readonly unknown[]\`. Si ya hay quien la dibuje, sale de la ` +
          'excepcion y entra en `LA_FORMA_DE` con su interfaz; si no, vuelve a `unknown[]`.',
      ).toContain(`readonly ${lista}: readonly unknown[];`);
    }
  });
});
