// Lee y escribe un archivo del disco, pero corre en jsdom —el entorno por omision— y NO en el de
// Node, que es lo que pediria su trabajo. El motivo, medido: el catalogo de claves se DERIVA del
// dato, y una de sus fuentes es `src/sesion.ts`, que construye la puerta de identidad al importarse
// y lee `window.location.origin` (`:106`). Con el entorno de Node este archivo ni siquiera se
// recoge: «ReferenceError: window is not defined», un rojo que no habla de traducciones.
//
// Se deja asi y no se parte el archivo de la sesion: derivar del sitio donde la frase vive es lo que
// impide que el inventario se quede corto, y pagar un entorno de jsdom por ello es barato.
//
// Y una advertencia que costo una vuelta: **la anotacion del entorno no se puede NOMBRAR aqui**.
// Vitest la busca con una expresion regular sobre el primer bloque de comentarios, asi que escribirla
// para explicar por que no se usa la ACTIVA. Es el mismo defecto que `catalogo-de-claves.ts` cuenta
// de `i18next-cli`: una herramienta que lee comentarios no distingue un ejemplo de una declaracion.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { catalogoDeClaves } from '../src/i18n/catalogo-de-claves.ts';
import { RAIZ } from './artboards.ts';

/**
 * **El locale `es` tiene todas las claves, y ninguna se aparta de la suya** (#60, AC 5).
 *
 * Calcado de `rentas/frontend/verificaciones/el-locale-esta-completo.test.ts@ac379ac`, con **las
 * cuentas de `normativa` como dato y no las de `rentas`** — ver {@link CLAVES_AL_MEDIRLO}.
 *
 * <h2>Las dos direcciones, y por que hacen falta las dos</h2>
 *
 * · **Ninguna clave usada falta del locale.** Sin esto, un segundo idioma se haria copiando un
 *   archivo incompleto y la pantalla saldria **a medias**: unas frases traducidas y otras en
 *   castellano, que es peor que no traducir nada — parece un defecto de la traduccion y es del
 *   inventario.
 * · **Ninguna sobra.** Una clave que ya no dice nadie es una frase que un traductor traduce para
 *   nada, y —peor— es la senal de que alguien cambio el castellano de una pantalla: la clave vieja
 *   se queda y la nueva falta, y las dos salen aqui a la vez diciendo cual por cual.
 * · **Ningun valor se aparta de su clave.** El castellano esta ahora en dos sitios —la definicion y
 *   el locale— y eso es exactamente lo que la guarda anti-deriva contra el artboard existe para
 *   impedir. Aqui se cierra: cada valor **tiene que ser igual a su clave**, asi que el locale no
 *   puede decir algo distinto del artboard sin ponerse rojo.
 *
 * <h2>La excepcion son los plurales, y es de verdad</h2>
 *
 * `{{count}} registro_one` no puede valer lo que su clave: tiene que valer «{{count}} registro» y su
 * hermana «{{count}} registros». Una clave sola no expresa dos formas, y un ternario en el codigo
 * dejaria fuera los idiomas con mas de dos.
 *
 * <h2>Y por que el locale se REGENERA en vez de escribirse</h2>
 *
 * Porque son cientos de entradas derivadas de las definiciones: a mano se quedan viejas a la primera
 * pantalla nueva. `yarn i18n:regenerar` lo vuelve a escribir, que es el mismo trato que
 * `kamayuk-lib` da a su archivo de temas. Y desde la ola 3 de la epica #47, **un conflicto en
 * `es.json` al rebasar se regenera, no se resuelve a mano** (`frontend/README.md`).
 */

const LOCALE = join(RAIZ, 'src/i18n/locales/es.json');

/**
 * Las claves que el catalogo derivado no puede traer: las formas PLURALES.
 *
 * `rentas` mete aqui ademas dos docenas de cadenas escritas como `t('…')` en su `aplicacion.tsx` y
 * en sus piezas. **Aqui no hay ninguna**, y es una consecuencia de la forma de este repositorio y no
 * una casualidad: `src/aplicacion.tsx` no puede escribir ni un texto visible (#55) y las piezas
 * propias —la puerta caida y el mando de temas— llevan sus frases en una constante exportada, que
 * `catalogo-de-claves.ts` recoge. Lo que queda son las formas plurales, que no son derivables de
 * ninguna clave: son la clave MAS un sufijo que elige i18next.
 *
 * Que la lista sea corta no la hace inutil: sin ella, las tres formas de `{{count}} registro`
 * saldrian como «sobran» y el locale no las llevaria.
 */
const LITERALES = [
  '{{count}} registro_one',
  '{{count}} registro_many',
  '{{count}} registro_other',
  // Las dos del marco que llevan una cuenta dentro. Sus claves base llegan DERIVADAS de
  // `textosDelMarco.ts`; lo que no se puede derivar son sus formas plurales.
  '{{count}} aviso sin leer_one',
  '{{count}} aviso sin leer_many',
  '{{count}} aviso sin leer_other',
  '{{casan}} de {{count}} destino_one',
  '{{casan}} de {{count}} destino_many',
  '{{casan}} de {{count}} destino_other',
] as const;

/** Lo que el plural tiene que decir, que es lo unico que no puede ser su clave. */
const PLURALES: Readonly<Record<string, string>> = {
  '{{count}} registro_one': '{{count}} registro',
  '{{count}} registro_many': '{{count}} registros',
  '{{count}} registro_other': '{{count}} registros',
  '{{count}} aviso sin leer_one': '{{count}} aviso sin leer',
  '{{count}} aviso sin leer_many': '{{count}} avisos sin leer',
  '{{count}} aviso sin leer_other': '{{count}} avisos sin leer',
  // El plural lo decide CUANTOS HAY y no cuantos casan: «1 de 4 destinos», nunca «1 de 4 destino».
  '{{casan}} de {{count}} destino_one': '{{casan}} de {{count}} destino',
  '{{casan}} de {{count}} destino_many': '{{casan}} de {{count}} destinos',
  '{{casan}} de {{count}} destino_other': '{{casan}} de {{count}} destinos',
};

/**
 * **EL CENTINELA, con la cuenta de ESTE sistema, medida y fechada.**
 *
 * El de `rentas` exige «mas de 700», que es su cuenta con cuarenta hojas y diez modulos. Copiarlo
 * aqui seria afirmar el numero de otro sistema, y ademas **no podria pasar nunca**: `normativa`
 * tiene cuatro hojas. Y bajarlo a «mas de 0» no mide nada, que es el otro modo de que un centinela
 * deje de serlo.
 *
 * Asi que se escribe la cuenta **medida el dia que se midio**, y se exige que no se desplome. El
 * margen es a la baja y no a la alta: una hoja nueva o una frase nueva SUBEN la cuenta, y eso no
 * tiene que poner nada rojo; lo que este centinela vigila es que el catalogo no venga **corto** —una
 * importacion rota, un cambio de forma en las definiciones, un `catalogoDeClaves` que devuelva `[]`—,
 * porque entonces «no falta ninguna» pasaria en verde sobre la nada.
 *
 * El suelo es el 80 % de lo medido: por debajo de eso no es una frase que se quito, es una fuente
 * entera que dejo de leerse. Con 10 fuentes derivadas, la mas pequena —las dos ausencias— ya son mas
 * del 1 %, y las dos mayores —las definiciones y el marco— pasan del 20 % cada una.
 */
const CLAVES_AL_MEDIRLO = { cuantas: 227, el: '2026-09-16' } as const;

/** El suelo del centinela. Ver {@link CLAVES_AL_MEDIRLO}. */
const AL_MENOS = Math.floor(CLAVES_AL_MEDIRLO.cuantas * 0.8);

function elQueDeberiaSer(): Readonly<Record<string, string>> {
  const claves = [...new Set([...catalogoDeClaves(), ...LITERALES])].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  return Object.fromEntries(claves.map((c) => [c, PLURALES[c] ?? c]));
}

describe('el locale `es` esta completo y no se aparta', () => {
  const esperado = elQueDeberiaSer();

  if (process.env['KAMAYUK_REGENERAR'] === '1') {
    writeFileSync(LOCALE, `${JSON.stringify(esperado, null, 2)}\n`, 'utf8');
  }

  it('EL CENTINELA: el archivo esta y el catalogo derivado trae las claves que se midieron', () => {
    expect(existsSync(LOCALE), `falta «${LOCALE}». Se escribe con: yarn i18n:regenerar`).toBe(true);
    expect(
      Object.keys(esperado).length,
      `El catalogo vino corto: se midieron ${String(CLAVES_AL_MEDIRLO.cuantas)} claves el ` +
        `${CLAVES_AL_MEDIRLO.el} y ahora hay muchas menos.\n` +
        '  Eso no es una frase que se quito: es una fuente entera que dejo de leerse en\n' +
        '  `src/i18n/catalogo-de-claves.ts`. Con el catalogo vacio, «no falta ninguna» pasaria en\n' +
        '  verde sobre la nada.',
    ).toBeGreaterThan(AL_MENOS);
  });

  it('no falta ninguna clave, y no sobra ninguna', () => {
    const enDisco = JSON.parse(readFileSync(LOCALE, 'utf8')) as Record<string, string>;
    const faltan = Object.keys(esperado).filter((c) => !(c in enDisco));
    const sobran = Object.keys(enDisco).filter((c) => !(c in esperado));
    expect(
      { faltan: faltan.slice(0, 8), sobran: sobran.slice(0, 8) },
      'El locale `es` dejo de cuadrar con lo que el sistema dice.\n' +
        '  Se regenera con:  yarn i18n:regenerar\n' +
        '  Nunca a mano: son cientos de entradas derivadas de las definiciones.',
    ).toEqual({ faltan: [], sobran: [] });
  });

  it('y NINGUN valor se aparta de su clave, salvo los plurales', () => {
    const enDisco = JSON.parse(readFileSync(LOCALE, 'utf8')) as Record<string, string>;
    const apartados = Object.entries(enDisco)
      .filter(([clave, valor]) => valor !== (PLURALES[clave] ?? clave))
      .map(([clave, valor]) => `  «${clave}» dice «${valor}»`);
    expect(
      apartados,
      'Hay entradas del locale que dicen algo distinto de su clave:\n' +
        `${apartados.join('\n')}\n\n` +
        '  El castellano esta en dos sitios —la definicion y el locale— y el artboard manda sobre\n' +
        '  el primero. Si el locale puede decir otra cosa, la pantalla se aparta del artboard sin\n' +
        '  que `pantallas-del-artboard` lo vea.',
    ).toEqual([]);
  });

  /**
   * **Y el locale no hereda una sola palabra de `rentas`** (#60, AC 5).
   *
   * Las piezas de este repositorio se calcan de `rentas`, y con ellas viajarian sus listas. La de
   * `LITERALES` de alli trae `'Rentas'`, `'Municipalidad Distrital de Catacaos'` y «Diez modulos y
   * cuarenta submodulos. Catastro y Tesoreria son de otros sistemas.», que son de aquel sistema y de
   * ninguno mas: copiadas aqui entrarian en el locale, se traducirian, y **no las dibujaria nadie** —
   * un traductor traduciendo el nombre de otro producto y el de una municipalidad que no es esta.
   *
   * Y hay una que es peor que inutil: el nombre de una municipalidad escrito en cualquier sitio de
   * este arbol es justo lo que G2 prohibio (#52), porque la interfaz de las veinte instalaciones
   * diria el de la primera.
   *
   * <h2>«Rentas» se mide como CLAVE ENTERA y no como subcadena, y hay que decir por que</h2>
   *
   * El AC 5 pide comprobar que `es.json` no contiene «Rentas», «Catacaos», «cuarenta» ni
   * «Tesoreria». Tres de las cuatro se pueden mirar como subcadena; **la primera no**, y no por
   * comodidad: el titulo que **G2 decidio para este sistema** (#52, aplicado en #76) es «Sistema de
   * Gestión de Rentas y Tributos Municipales» —`src/marca.ts`—, asi que la palabra «Rentas» esta
   * dentro de una frase que es de `normativa` y que el artboard V8 fija. Medido: con la subcadena,
   * esta prueba sale roja sobre el titulo del propio sistema.
   *
   * Lo que el AC quiere impedir es que entre **la entrada de `rentas`**, que es la clave `Rentas` a
   * secas —el nombre de su sistema en su barra—. Eso es lo que se mide, y ademas se miden enteras
   * las otras dos frases suyas: asi la comprobacion sigue mordiendo donde tiene que morder sin dar
   * rojo sobre una decision de este repositorio.
   */
  it('y NO hereda nada de `rentas`: ni su nombre, ni su municipalidad, ni sus cuentas', () => {
    const enDisco = JSON.parse(readFileSync(LOCALE, 'utf8')) as Record<string, string>;
    const todo = `${Object.keys(enDisco).join('\n')}\n${Object.values(enDisco).join('\n')}`;

    /** Las de `LITERALES` de `rentas@ac379ac:39-58` que nombran a aquel sistema, enteras. */
    const SUYAS = [
      'Rentas',
      'Municipalidad Distrital de Catacaos',
      'Diez modulos y cuarenta submodulos. Catastro y Tesoreria son de otros sistemas.',
    ];
    const comoClave = SUYAS.filter((p) => p in enDisco);
    // Y las tres palabras que no pueden aparecer ni dentro de una frase: ninguna decision de este
    // repositorio las contiene, a diferencia de «Rentas». Ver el javadoc.
    const comoSubcadena = ['Catacaos', 'cuarenta', 'Tesoreria'].filter((p) => todo.includes(p));
    const ajenas = [...comoClave, ...comoSubcadena];

    expect(
      ajenas,
      'El locale de `normativa` trae palabras que son de `rentas`:\n' +
        `${ajenas.map((p) => `  «${p}»`).join('\n')}\n\n` +
        '  Las piezas de i18n se calcan de `rentas`, pero sus LISTAS no: `LITERALES` de alli trae\n' +
        '  el nombre de aquel sistema y el de su municipalidad. Aqui no los dibuja nadie, y el de\n' +
        '  una municipalidad no va escrito en ningun sitio (G2, #52).',
    ).toEqual([]);
  });
});
