// @vitest-environment node
//
// Lee las costuras del disco y mira su texto. No es un DOM lo que necesita: que las opciones
// hagan algo AL PULSARLAS se mide en `src/sesion.test.tsx`, sobre el DOM y una a una.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Es la misma razon por la que `src/acciones.ts` esta vacio y no lleno de funciones que no hacen
 * nada: «lo que no se pasa, no se puede pulsar».
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
