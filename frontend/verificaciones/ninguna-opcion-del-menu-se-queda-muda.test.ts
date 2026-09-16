// @vitest-environment node
//
// Lee las costuras del disco y mira su texto. No es un DOM lo que necesita: que las opciones
// hagan algo AL PULSARLAS se mide en `src/sesion.test.tsx`, sobre el DOM y una a una.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **Ninguna opcion del menu se queda muda** (#57, AC 6).
 *
 * <h2>El defecto que cierra</h2>
 *
 * Una opcion cableada a `al: () => {}` se dibuja igual que las demas, se pulsa y **no pasa nada**.
 * Quien la prueba no sabe si el fallo es suyo, de la red o del backend, y no hay ningun sitio donde
 * mirarlo: no hay error, no hay traza, no hay 401. Es peor que no ofrecerla, que al menos se ve.
 *
 * Es la misma razon por la que `src/acciones.ts` NO lleva funciones que no hacen nada. Cuando #57
 * escribio esto, aquel archivo estaba **vacio** y el criterio era «lo que no se pasa, no se puede
 * pulsar». **#58 lo lleno, y por un motivo medido**: lo que no se pasa `@kamayuk/shell` lo dibuja
 * **deshabilitado** (`paquetes/shell/AccionesAlPie.tsx:48`), y deshabilitado sin motivo es tan mudo
 * como vacio — es el hueco H08 de `diseno/HUECOS.md`. Asi que hoy las cuatro estan atendidas:
 * `imprimir` imprime, y las otras tres dicen que todavia no y por que.
 *
 * <h2>Barre las COSTURAS, y no solo `src/aplicacion.tsx`</h2>
 *
 * En `rentas` el menu se escribe dentro de `aplicacion.tsx` (`ac379ac:206-226`), asi que mirar ese
 * archivo bastaba. Aqui `aplicacion.tsx` lo toca solo #55 (epica #47) y **no puede escribir ni un
 * rotulo**: el menu vive en `src/sesion.ts` y lo que #64 anada ira ahi o en otra costura. Por eso
 * la lista de abajo es de costuras y no un archivo: anadir una obliga a decir cual.
 *
 * <h2>Este archivo lo trae #57 y lo puede EXTENDER #58</h2>
 *
 * Su AC 6 lo dice: «la mitad “menu de sesion” la trae este issue, o la extiende si #58 ya la
 * creo». La otra mitad —las acciones al pie de cada hoja— es de #58 y entra aqui cuando exista.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const REPOSITORIO = join(FRONTEND, '..');

/**
 * Donde puede vivir una opcion del menu de sesion. Hoy una; #64 puede anadir otra.
 *
 * `src/aplicacion.tsx` esta en la lista **a proposito aunque no deba llevar ninguna**: si alguien
 * escribe ahi una opcion muda, esta guarda tiene que verla, no ignorarla por no estar en su sitio.
 */
const COSTURAS_CON_MENU: readonly string[] = ['src/sesion.ts', 'src/aplicacion.tsx'];

/** Las cuatro que tienen que estar, en su orden. Las de `rentas@ac379ac:206-226`. */
const LAS_CUATRO: readonly string[] = [
  'Mi perfil',
  'Cambiar la contrasena',
  'Preferencias',
  'Cerrar sesión',
];

const leer = (relativa: string): string => {
  const ruta = join(FRONTEND, relativa);
  expect(existsSync(ruta), `falta «${relativa}»: esta guarda lo lee y sin el no afirma nada`).toBe(
    true,
  );
  return readFileSync(ruta, 'utf8');
};

/** El texto sin comentarios: la prosa de estas costuras nombra los rotulos y los cuerpos vacios. */
const sinComentarios = (fuente: string): string =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/**
 * Cada `{ rotulo: '…', … al: <lo que sea> }` de un texto, ya sin comentarios.
 *
 * Se lee el TEXTO y no se importa el modulo a proposito: importarlo evaluaria `crearIdentidad`, que
 * necesita `window`, y esta guarda corre en Node porque lo que mide es una propiedad del arbol. Y
 * hay una segunda razon, que es la que importa: importando, un `al` cableado a una funcion vacia se
 * ve exactamente igual que uno que hace algo — `typeof f === 'function'` es `true` para los dos.
 */
function opcionesDe(fuente: string): { readonly rotulo: string; readonly cuerpo: string }[] {
  const texto = sinComentarios(fuente);
  const salida: { rotulo: string; cuerpo: string }[] = [];
  for (const casa of texto.matchAll(/rotulo:\s*'([^']+)'/g)) {
    const objeto = objetoQueContiene(texto, casa.index);
    const conAl = /\bal:\s*([\s\S]*)$/.exec(objeto);
    salida.push({ rotulo: casa[1] ?? '', cuerpo: conAl?.[1] ?? '' });
  }
  return salida;
}

/**
 * El objeto literal que envuelve a esa posicion, contando llaves.
 *
 * Con una expresion regular no se puede: el `al` de una opcion **lleva llaves dentro**, asi que
 * cualquier `[\s\S]*?\}` cierra en la primera de la flecha y se lleva por delante justo el cuerpo
 * que hay que mirar.
 */
function objetoQueContiene(texto: string, posicion: number): string {
  const inicio = texto.lastIndexOf('{', posicion);
  if (inicio < 0) return '';
  let nivel = 0;
  for (let i = inicio; i < texto.length; i += 1) {
    if (texto[i] === '{') nivel += 1;
    else if (texto[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

describe('las cuatro opciones del menu de sesion estan, y ninguna esta muda', () => {
  it('EL CENTINELA: el extractor encuentra opciones, y distingue un cuerpo vacio de uno que hace algo', () => {
    const muestra = [
      'export const X = [',
      "  {",
      "    rotulo: 'Hace algo',",
      '    al: () => {',
      '      identidad.salir();',
      '    },',
      '  },',
      "  { rotulo: 'No hace nada', al: () => {} },",
      '];',
    ].join('\n');

    const sacadas = opcionesDe(muestra);
    expect(sacadas.map((o) => o.rotulo)).toEqual(['Hace algo', 'No hace nada']);
    expect(esMuda(sacadas[1] as { rotulo: string; cuerpo: string })).toBe(true);
    expect(esMuda(sacadas[0] as { rotulo: string; cuerpo: string })).toBe(false);
  });

  it('las cuatro estan, y en el orden de `rentas`', () => {
    const encontradas = COSTURAS_CON_MENU.flatMap((costura) => opcionesDe(leer(costura))).map(
      (o) => o.rotulo,
    );

    expect(
      encontradas,
      'El menu de sesion no ofrece las cuatro opciones. Las dos primeras llevan a la consola de\n' +
        'la cuenta del emisor, «Preferencias» abre el cajon del tema y «Cerrar sesion» sale.',
    ).toEqual([...LAS_CUATRO]);
  });

  it('y ninguna tiene un `al` que no haga nada', () => {
    const mudas = COSTURAS_CON_MENU.flatMap((costura) =>
      opcionesDe(leer(costura))
        .filter(esMuda)
        .map((o) => `  ${costura}: «${o.rotulo}»`),
    );

    expect(
      mudas,
      `Hay opciones del menu cableadas a una funcion vacia:\n${mudas.join('\n')}\n\n` +
        '  Una opcion muda se dibuja, se pulsa y no pasa nada: quien la prueba no sabe si el\n' +
        '  fallo es suyo, de la red o del backend. Si todavia no hay a que llamar, la opcion NO\n' +
        '  se ofrece — que es lo que hace `src/acciones.ts` con las acciones al pie.',
    ).toEqual([]);
  });
});

/** Un `al` que no hace nada: el cuerpo entre llaves esta vacio, o es un `undefined` a secas. */
function esMuda(opcion: { readonly rotulo: string; readonly cuerpo: string }): boolean {
  const cuerpo = opcion.cuerpo.trim();
  if (cuerpo === '') return true;
  return /^\(\s*\)\s*=>\s*\{\s*\}/.test(cuerpo) || /^\(\s*\)\s*=>\s*undefined/.test(cuerpo);
}

/**
 * **El contrato no publica perfil ni contrasena, y por eso esas dos opciones salen del sistema.**
 *
 * Es la mitad que justifica el AC 6: «Mi perfil» y «Cambiar la contrasena» **no se resuelven aqui**,
 * y no por falta de ganas. La autorizacion es de `identidad` desde ADR-0039 y la contrasena la
 * guarda Keycloak; dibujar aqui esos dos formularios seria prometer una escritura que ningun
 * backend de este repositorio puede atender.
 *
 * Eso no es una opinion: se lee en `docs/50-api/formas-de-la-api.json`, que es lo que el backend
 * publica (#49). El dia que alguna de esas dos operaciones exista, esta prueba sale roja y hay que
 * decidir de nuevo — que es exactamente lo que se quiere.
 */
describe('las dos primeras opciones van al emisor porque el backend no las publica', () => {
  const CONTRATO = 'docs/50-api/formas-de-la-api.json';

  it('el contrato existe y tiene operaciones', () => {
    const ruta = join(REPOSITORIO, CONTRATO);
    expect(
      existsSync(ruta),
      `Falta «${CONTRATO}», que lo publica #49 y es contra lo que la interfaz mide sus rutas.\n` +
        'Sin el no se puede afirmar que el backend NO publique perfil ni contrasena: se estaria\n' +
        'suponiendo. Esta prueba NO se omite — se pone roja, que es lo que dice el AC 6 de #57.',
    ).toBe(true);

    const contrato = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>;
    // `_` es la nota de «archivo generado». Todo lo demas es una operacion.
    expect(Object.keys(contrato).filter((clave) => clave !== '_').length).toBeGreaterThan(0);
  });

  it('y no publica ninguna operacion de perfil ni de contrasena', () => {
    const contrato = JSON.parse(
      readFileSync(join(REPOSITORIO, CONTRATO), 'utf8'),
    ) as Record<string, unknown>;
    const sospechosas = Object.keys(contrato).filter((operacion) =>
      /perfil|contrasena|password|credencial/i.test(operacion),
    );

    expect(
      sospechosas,
      'El backend publica una operacion de perfil o de contrasena. Si de verdad existe, el menu\n' +
        'de sesion tiene que dejar de mandar a la consola de Keycloak; si no, sobra del contrato.',
    ).toEqual([]);
  });
});

/* ── La otra mitad, la de las acciones al pie (#58, AC 7) ──────────────────────────────── */

/**
 * **Ninguna funcion de la costura se queda muda** (#58).
 *
 * Es la mitad que el AC 6 de #57 dejaba escrita —«la otra mitad, las acciones al pie de cada hoja,
 * es de #58 y entra aqui cuando exista»—, y esta es.
 *
 * <h2>Que barre, y por que no lo puede ver el extractor de arriba</h2>
 *
 * El de arriba busca `{ rotulo: '…', al: … }`, que es la forma de una opcion del menu. Una accion
 * del pie no tiene rotulo: es `imprimir: () => {…}` dentro de `AccionesDelSistema`, y lo mismo pasa
 * con cualquier otra devolucion de llamada que las costuras le pasen al armazon. Asi que esta mitad
 * mira el ARBOL DE SINTAXIS de los cuatro archivos y busca **cualquier funcion de cuerpo vacio**.
 *
 * `() => undefined` y `() => null` **no** cuentan, por lo mismo que arriba: tampoco hacen nada, pero
 * nadie las escribe por descuido, y `PuertaCaida` y `CajonDePreferencias` de `src/sesion.ts` —que
 * devuelven `null`— son legitimas.
 */

/** Las cuatro costuras cuyas funciones acaban pulsandose. `src/sesion.ts` ya lo mira la mitad de #57. */
const LAS_CUATRO_COSTURAS = [
  'src/aplicacion.tsx',
  'src/acciones.ts',
  'src/marca.ts',
  'src/pantallas/index.ts',
] as const;

function arbolDe(ruta: string, fuente: string): ts.SourceFile {
  return ts.createSourceFile(ruta, fuente, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
}

function recorrer(nodo: ts.Node, visita: (n: ts.Node) => void): void {
  visita(nodo);
  nodo.forEachChild((hijo) => {
    recorrer(hijo, visita);
  });
}

/** Una funcion que no hace nada: `() => {}`, `function () {}` y sus parientes con cuerpo vacio. */
function noHaceNada(nodo: ts.Node): boolean {
  if (!ts.isArrowFunction(nodo) && !ts.isFunctionExpression(nodo)) return false;
  return ts.isBlock(nodo.body) && nodo.body.statements.length === 0;
}

/** Las funciones de cuerpo vacio de un archivo, con su linea y su texto. */
function vaciasDe(ruta: string): readonly string[] {
  const arbol = arbolDe(ruta, leer(ruta));
  const vacias: string[] = [];
  recorrer(arbol, (nodo) => {
    if (!noHaceNada(nodo)) return;
    const { line } = arbol.getLineAndCharacterOfPosition(nodo.getStart());
    vacias.push(`  ${ruta}:${String(line + 1)} — ${nodo.getText()}`);
  });
  return vacias;
}

describe('ninguna funcion de la costura se queda muda', () => {
  it('EL CENTINELA: los cuatro archivos se leen AQUI DENTRO, y el lector discrimina', () => {
    // 1) `leer` ya pone rojo nombrando el archivo que falte, y se llama dentro del `it`: con un
    //    archivo movido de sitio, leerlo en el cuerpo del modulo reventaria la RECOLECCION y este
    //    archivo saldria como «Failed Suites» sin una sola prueba — o sea, la guarda se callaria
    //    justo cuando hay que mirarla.
    for (const ruta of LAS_CUATRO_COSTURAS) {
      expect(leer(ruta).length, `«${ruta}» esta vacio`).toBeGreaterThan(200);
    }

    // 2) Y LA MUESTRA: el lector tiene que ver lo que se prohibe y dejar pasar lo que no.
    const mala = [
      'export const ACCIONES = {',
      '  imprimir: () => {},',
      '  exportar: () => { avisar("no todavia"); },',
      '  limpiar: () => null,',
      '};',
    ].join('\n');
    const arbol = arbolDe('muestra.ts', mala);
    const halladas: string[] = [];
    recorrer(arbol, (nodo) => {
      if (noHaceNada(nodo)) halladas.push(nodo.getText());
    });
    expect(halladas, 'el lector no vio la funcion vacia, o vio de mas').toEqual(['() => {}']);
  });

  it.each(LAS_CUATRO_COSTURAS.map((ruta) => [ruta] as const))(
    '«%s» no tiene ni una funcion vacia',
    (ruta) => {
      const vacias = vaciasDe(ruta);
      expect(
        vacias,
        'Hay funciones vacias en la costura del armazon:\n' +
          `${vacias.join('\n')}\n\n` +
          '  Lo que se le pasa al armazon se PULSA. Una devolucion de llamada vacia es un control\n' +
          '  que no responde, y eso no se ve como «todavia no»: se ve como una averia. O hace lo\n' +
          '  suyo, o dice que todavia no y por que — como `exportar` en `src/acciones.ts`.',
      ).toEqual([]);
    },
  );

  it('y las cuatro acciones del pie estan atendidas: deshabilitado tambien es mudo', () => {
    // La otra mitad de la decision, y la que este barrido no podria ver mirando solo cuerpos
    // vacios: `@kamayuk/shell` dibuja **deshabilitada** la accion que el sistema no atiende
    // (`AccionesAlPie.tsx:48`), y deshabilitado sin motivo es igual de mudo que vacio. Es el hueco
    // H08 de `diseno/HUECOS.md`; mientras no llegue, lo que se puede hacer es atenderlas todas.
    const fuente = leer('src/acciones.ts');
    for (const acto of ['imprimir', 'exportar', 'guardar', 'limpiar']) {
      expect(fuente, `«${acto}» no esta atendida en \`src/acciones.ts\``).toMatch(
        new RegExp(`\\b${acto}:`),
      );
    }
  });
});
