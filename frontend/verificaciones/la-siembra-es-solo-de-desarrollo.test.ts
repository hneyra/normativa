// @vitest-environment node
//
// Lee archivos del disco. No es un DOM lo que necesita.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * **La siembra del catalogo es SOLO de desarrollo, y se puede comprobar sin construir** (#64).
 *
 * Calcado de `rentas/frontend/verificaciones/la-siembra-es-solo-de-desarrollo.test.ts@ac379ac`
 * (`rentas`#114), con una comprobacion mas que alli vive en `camino-a-la-api`: que ningun archivo
 * de produccion de `src/` importe las CAPTURAS.
 *
 * <h2>Que vigila, y por que estatico</h2>
 *
 * La medicion de verdad es sobre el `dist/` —`e2e/la-siembra-no-viaja-al-bundle.spec.ts` la hace
 * sobre el bundle construido—. Esta guarda vigila **las formas conocidas de romperla**, y lo hace
 * en `yarn verificar`, que es donde se entera quien escribe el cambio:
 *
 *   · **leer la bandera en tiempo de ejecucion.** Con la condicion detras de una funcion —o de
 *     `configuracion()`, o de `globalThis`— Rollup no puede plegarla, el `import()` dinamico se
 *     queda y las capturas viajan enteras;
 *   · **importar la siembra estaticamente.** Un `import { sembrarElCatalogo } from …` en cualquier
 *     archivo de `src/` mete el modulo en el paquete pase lo que pase con la bandera;
 *   · **usar una captura como respaldo.** Un `modulos ?? MODULOS_MEDIDOS` en cualquier gancho
 *     devolveria un menu que no pregunto a nadie, y esta vez con una constante que parece medida.
 *
 * Las tres salen en verde en `yarn dev`, que es lo que las hace peligrosas.
 *
 * <h2>Y que la bandera retirada no quede nombrada como si valiera</h2>
 *
 * `VITE_KAMAYUK_PROXY_DE_DATOS` encendia el proxy de la V6 (`c01fe9a:frontend/.env.development`),
 * que salio con #50. Nombrarla en prosa se queda; lo que no puede volver es una **asignacion**.
 * Que no vuelva a ningun archivo de entorno lo mide ademas `la-v6-no-esta.test.ts`.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const REPOSITORIO = join(FRONTEND, '..');

const leer = (ruta: string) => readFileSync(join(FRONTEND, ruta), 'utf8');

/** La bandera. Escrita una vez aqui: si cambia de nombre, todo lo de abajo lo dice a la vez. */
const BANDERA = 'VITE_KAMAYUK_SIN_PLATAFORMA';

/** La que se retiro con la V6. */
const RETIRADA = 'VITE_KAMAYUK_PROXY_DE_DATOS';

/** La siembra, sus capturas, y el unico archivo de `src/` que puede alcanzarla. */
const SIEMBRA = 'desarrollo/sembrarElCatalogo.ts';
const CAPTURA_DE_LA_SESION = 'desarrollo/sesionMedida.ts';
const CAPTURA_DEL_CATALOGO = 'src/datos/seguridadMedida.ts';
const ARRANQUE = 'src/arranque.ts';

/** Todos los `.ts`/`.tsx` de produccion bajo `src/`, con su ruta relativa al frontend. */
function fuentesDeProduccion(desde = join(FRONTEND, 'src')): readonly string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return fuentesDeProduccion(ruta);
    return /\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)
      ? [relative(FRONTEND, ruta)]
      : [];
  });
}

/** Los especificadores de los `import` —estaticos y dinamicos— de un modulo, sin comentarios. */
function importesDe(fuente: string): readonly string[] {
  const texto = fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  return [
    ...[...texto.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map(([, e]) => e ?? ''),
    ...[...texto.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(([, e]) => e ?? ''),
  ];
}

describe('AC 6 — la siembra existe, y vive fuera de `src/`', () => {
  it('EL CENTINELA: los archivos estan donde se dice, y `src/` se puede leer', () => {
    // Sin esto, un archivo movido dejaria a las comprobaciones de abajo mirando cadenas que no
    // estan en ninguna parte, y todas saldrian verdes afirmando que no hay nada que reprochar.
    for (const ruta of [SIEMBRA, CAPTURA_DE_LA_SESION, CAPTURA_DEL_CATALOGO, '.env.development']) {
      expect(existsSync(join(FRONTEND, ruta)), `falta «${ruta}»`).toBe(true);
    }
    expect(fuentesDeProduccion().length).toBeGreaterThan(20);
    // Y el extractor ve los dos tipos de `import`: si no, «nadie la importa» seria verdad siempre.
    expect(importesDe("import { a } from './b.ts';\nconst c = await import('../d.ts');")).toEqual([
      './b.ts',
      '../d.ts',
    ]);
  });

  it('y NO esta bajo `src/`, que es lo que se sirve', () => {
    expect(existsSync(join(FRONTEND, 'src/desarrollo'))).toBe(false);
  });
});

describe('AC 6 — nada de `src/` alcanza la siembra si no es por el `import()` plegable', () => {
  it('solo `arranque.ts` la nombra, y ningun otro archivo de produccion', () => {
    const culpables = fuentesDeProduccion().filter(
      (ruta) => ruta !== ARRANQUE && /desarrollo\/sembrarElCatalogo/.test(leer(ruta)),
    );

    expect(
      culpables,
      'Estos archivos de produccion alcanzan la siembra de desarrollo:\n' +
        `  ${culpables.join('\n  ')}\n\n` +
        '  Solo `src/arranque.ts` puede, y solo por el `import()` dinamico detras de las dos\n' +
        '  condiciones constantes. Desde cualquier otro sitio, las capturas viajan al paquete.',
    ).toEqual([]);
  });

  it('y la nombra UNA vez, en un `import()` dinamico y no en un `import … from`', () => {
    const arranque = leer(ARRANQUE);

    expect(
      /from\s+'[^']*desarrollo\/sembrarElCatalogo/.test(arranque),
      '`arranque.ts` importa la siembra ESTATICAMENTE: entonces viaja al paquete siempre.',
    ).toBe(false);
    expect(arranque.match(/import\('\.\.\/desarrollo\/sembrarElCatalogo\.ts'\)/g)).toHaveLength(1);
  });

  it('LAS DOS CONDICIONES SE LEEN AL CONSTRUIR, y van delante del `import()`', () => {
    // Es la propiedad entera, y la unica forma conocida de romperla sin que nada mas se entere.
    // Medido en `rentas` con el proxy de la V6: leida en tiempo de ejecucion, la bandera deja el
    // modulo dentro —227 205 bytes y las cifras del artboard dentro— y `yarn dev` sigue igual de
    // verde. Por eso se comprueba el TEXTO: lo que importa no es que la condicion sea cierta, sino
    // que el empaquetador pueda evaluarla.
    const esperado = new RegExp(
      String.raw`if \(!import\.meta\.env\.DEV\) return false;` +
        String.raw`[\s\S]{0,200}?` +
        String.raw`if \(import\.meta\.env\.${BANDERA} !== 'true'\) return false;` +
        String.raw`[\s\S]{0,400}?` +
        String.raw`await import\('\.\./desarrollo/sembrarElCatalogo\.ts'\)`,
    );

    expect(
      esperado.test(leer(ARRANQUE)),
      'Las dos condiciones que guardan el `import()` de la siembra ya no se leen al CONSTRUIR.\n' +
        'Se esperaba, en este orden y antes del import:\n' +
        '  if (!import.meta.env.DEV) return false;\n' +
        `  if (import.meta.env.${BANDERA} !== 'true') return false;\n\n` +
        '  Vite sustituye las dos por su literal al construir y Rollup pliega la condicion, que\n' +
        '  es lo que se lleva por delante el `import()` con las capturas dentro. Detras de una\n' +
        '  funcion, de `configuracion()` o de `globalThis`, el modulo VIAJA — y en desarrollo no\n' +
        '  se nota: la pantalla se ve igual.',
    ).toBe(true);
  });

  it('ningun archivo de produccion de `src/` importa las CAPTURAS: no son un respaldo', () => {
    // `src/datos/seguridadMedida.ts` vive en `src/` —es donde lo pone el AC 6 de #64, como en
    // `rentas`— y por eso lo que hay que vigilar es quien lo importa. Solo las pruebas, el arnes y
    // la siembra; un gancho que lo importara tendria a mano un `modulos ?? MODULOS_MEDIDOS`.
    const culpables = fuentesDeProduccion().filter(
      (ruta) =>
        ruta !== CAPTURA_DEL_CATALOGO &&
        importesDe(leer(ruta)).some(
          (e) =>
            /seguridadMedida|sesionMedida/.test(e) ||
            // La unica puerta a `desarrollo/` es la de arriba, y ya se mide aparte.
            (/\/desarrollo\//.test(e) && !(ruta === ARRANQUE && e === `../${SIEMBRA}`)),
        ),
    );
    expect(
      culpables,
      'Estos archivos de produccion importan una captura de `/seguridad`:\n' +
        `  ${culpables.join('\n  ')}\n\n` +
        '  Las capturas son para mirar la interfaz sin plataforma y para las pruebas. En produccion\n' +
        '  el menu sale de lo que el backend contesta, o no sale.',
    ).toEqual([]);
  });

  it('y el `Dockerfile` apaga la bandera antes de construir: la primera de las tres vallas', () => {
    const dockerfile = leer('Dockerfile');

    expect(dockerfile).toContain(`ENV ${BANDERA}=false`);
    expect(dockerfile.indexOf(`ENV ${BANDERA}=false`)).toBeLessThan(
      dockerfile.indexOf('RUN yarn build'),
    );
    // Y la segunda: `.env.development` ni entra en el contexto de la imagen.
    expect(leer('.dockerignore')).toMatch(/^\.env\.\*$/m);
  });
});

describe('la bandera retirada ya no se asigna en ninguna parte', () => {
  it('`.env.development` declara la de hoy y no la de la V6', () => {
    const entorno = leer('.env.development');

    expect(entorno).toContain(`${BANDERA}=true`);
    expect(
      entorno.includes(RETIRADA),
      `\`.env.development\` nombra ${RETIRADA}, que encendia el proxy de la V6 (#50).`,
    ).toBe(false);
  });

  it('y ningun archivo del frontend le da valor: nombrarla en prosa si, asignarla no', () => {
    const sospechosos = ['.env.development', '.dockerignore', 'Dockerfile', ARRANQUE, SIEMBRA];
    const culpables = sospechosos.filter((ruta) =>
      new RegExp(`${RETIRADA}\\s*=`).test(leer(ruta)),
    );

    expect(culpables).toEqual([]);
  });
});

describe('como se mira la interfaz en local queda escrito, y nombra la bandera', () => {
  it('D0 lo explica, y nombra la bandera y `yarn dev:con-plataforma` por su nombre', () => {
    // Atarlo al nombre es lo que impide que un renombrado deje la documentacion huerfana: el dia
    // que la bandera se llame de otra forma, esto se pone rojo en vez de mandar a quien llegue a
    // escribir una variable que ya no existe.
    const d0 = readFileSync(join(REPOSITORIO, 'docs/D0-desarrollo/entorno-local.md'), 'utf8');

    expect(d0).toContain(BANDERA);
    expect(d0).toContain('yarn dev:con-plataforma');
  });

  it('y `dev:con-plataforma` existe de verdad en el manifiesto', () => {
    const manifiesto = JSON.parse(leer('package.json')) as {
      scripts: Record<string, string | undefined>;
    };

    expect(manifiesto.scripts['dev:con-plataforma']).toBe(`${BANDERA}=false vite`);
  });
});
