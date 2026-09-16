// @vitest-environment node
//
// Mira el arbol del disco. No es un DOM lo que necesita.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * **La V6 no esta** (#50, decision 6 de la epica #47: borrar primero).
 *
 * Sigue el patron de `rentas/frontend/verificaciones/la-v6-no-esta.test.ts` en `ac379ac`
 * (`rentas`#90), como `catastro`#115.
 *
 * <h2>Por que una guarda, si basta con mirar</h2>
 *
 * Porque un borrado se deshace sin querer. Un `git revert` mal acotado, una rama vieja que se
 * mezcla, un `git checkout c01fe9a -- frontend/src/...` para «ver como era»: las tres formas
 * devuelven parte de la V6 al arbol, y **ninguna rompe nada** — nadie importa lo devuelto, asi que
 * la suite sigue en verde. Lo unico que pasa es que el repositorio vuelve a tener dos interfaces,
 * una de ellas muerta, y quien llegue despues no sabe cual mirar. Y aqui es peor que en `rentas`:
 * mientras la nueva no llegue (#55 y #58), **la muerta seria la unica que dibuja algo** — y lo
 * que dibujaba eran cifras del corpus capturadas de un artboard, servidas por un proxy que
 * sustituia `fetch`.
 *
 * Consultar la V6 es legitimo y tiene sitio: `git show c01fe9a:frontend/<ruta>`.
 *
 * <h2>Y por que por RUTA y no por recuento</h2>
 *
 * Un recuento —«hay menos de N archivos en `src/`»— pasa en verde con `src/marco/` entero de
 * vuelta si a la vez se borro otra cosa. Las rutas dicen exactamente que no puede estar.
 *
 * <h2>Las seis guardas que salieron con la V6, y por que ninguna se pierde</h2>
 *
 * Una guarda borrada es una leccion olvidada salvo que diga donde renace. Estas seis estan en
 * {@link SE_FUE}, asi que tampoco pueden volver sin que alguien borre su linea de aqui:
 *
 * | Guarda (`verificaciones/`) | Que vigilaba | Por que sale |
 * |---|---|---|
 * | `lienzo-sin-campo-propio` | que el hueco del Lienzo no tuviera campo propio (#24) | Vigilaba codigo de `src/marco/`, que ya no existe. `@kamayuk/shell` no tiene hueco con campo |
 * | `marco-sin-selector` | que el marco no tuviera selector A/B/C | Lo mismo: `src/marco/` salio, y `@kamayuk/shell` no tiene selector |
 * | `arbol-del-artboard` | el arbol de la V6 contra `NormativaV6.dc.html` | La comparacion nueva es contra `NormativaV8.dc.html` (#52, #58) |
 * | `tokens-del-artboard` (y su `tokens.ts`) | los tokens de la V6 contra su artboard | Lo mismo: la paleta nueva se compara con el artboard V8 (#52, #58) |
 * | `secciones` | que ninguna seccion importara `datos/prototipo.ts` | Su leccion —ninguna cifra del corpus en lo servido— sigue viva en la negativa del `Dockerfile` (`imagen-y-despliegue`) y renace en `sin-cifras-inventadas` (#58) |
 * | `contraste` | el contraste de `src/estilos/tokens/colors.css` | La paleta pasa a ser la de `@kamayuk/ui`, cuyo contraste mide la libreria |
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

/** La fuente congelada de todo lo que se fue. */
const FUENTE_DE_LA_V6 = 'c01fe9a';

const SE_FUE: readonly { readonly ruta: string; readonly que: string }[] = [
  { ruta: 'src/marco', que: 'el marco escrito a mano, con su enrutado por hash; lo pone el `Armazon` de `@kamayuk/shell` (#55)' },
  { ruta: 'src/ds', que: 'los componentes y las fuentes propios; los publica `@kamayuk/ui`' },
  { ruta: 'src/estilos', que: 'el CSS escrito a mano y sus tokens; la paleta la publica `@kamayuk/ui`' },
  { ruta: 'src/secciones', que: 'Panel, Ediciones, Cuadros y Publicacion en JSX a mano; vuelven como hojas del interprete (#58)' },
  { ruta: 'src/datos/prototipo.ts', que: 'las cifras del corpus capturadas del artboard V6' },
  { ruta: 'src/datos/simulados.ts', que: 'las tres escrituras que solo existian aqui; las de verdad son de #59 y #68' },
  { ruta: 'src/datos/operaciones.ts', que: 'las operaciones que contestaba el proxy' },
  { ruta: 'src/api/proxy.ts', que: 'el proxy que sustituia `fetch` con datos simulados' },
  { ruta: 'src/api/identidad.ts', que: 'la puerta PKCE escrita a mano; la nueva sale de `@kamayuk/sesion` (#57)' },
  // Las seis guardas del AC 2, con su motivo en la cabecera de este archivo.
  ...[
    'lienzo-sin-campo-propio.test.ts',
    'marco-sin-selector.test.ts',
    'arbol-del-artboard.test.ts',
    'tokens-del-artboard.test.ts',
    'tokens.ts',
    'secciones.test.ts',
    'contraste.test.ts',
  ].map((guarda) => ({
    ruta: `verificaciones/${guarda}`,
    que: 'una guarda de la V6; la cabecera de `la-v6-no-esta.test.ts` dice por que salio y donde renace',
  })),
];

/**
 * La bandera con la que `yarn dev` encendia el proxy. Salio con `.env.development`, que no hacia
 * otra cosa, y con la linea `ENV … =false` del `Dockerfile`.
 *
 * No se guarda por ruta porque `.env.development` es un nombre legitimo —`rentas` tiene uno, con
 * otra variable—: lo que no puede volver es la bandera, en cualquier archivo de entorno.
 */
const BANDERA_DEL_PROXY = 'VITE_KAMAYUK_PROXY_DE_DATOS';

/**
 * Lo que sustituyo a la V6 y tiene que estar. La otra direccion de la misma guarda: cada issue
 * de la epica #47 que anada una pieza la anade aqui.
 *
 * `diseno/NormativaV6.dc.html` esta AQUI y no en {@link SE_FUE}: es la fuente de la que #52
 * deriva el artboard V8, y sale en #69, que invierte esta linea.
 */
const ESTA: readonly string[] = [
  'src/main.tsx',
  'index.html',
  'public/configuracion.js',
  'diseno/NormativaV6.dc.html',
  // Lo que #55 puso en su sitio: el `Armazon` montado y vacio, su hoja de estilos y las OCHO
  // costuras. Cada costura tiene dueño en la epica #47, y ninguna se puede borrar «porque no hace
  // nada»: la que no este obliga a su issue a tocar `src/aplicacion.tsx`, que es de #55 y de nadie
  // mas. Quien la llene cambia su cuerpo, no esta lista.
  'src/aplicacion.tsx',
  'src/estilos.css',
  'src/acciones.ts',
  'src/arranque.ts',
  'src/catalogo.ts',
  'src/datos/proveedor.tsx',
  'src/i18n/armazon.ts',
  'src/marca.ts',
  'src/pantallas/index.ts',
  'src/sesion.ts',
  // Lo que #57 puso en su sitio: la puerta y el cliente, los dos de `kamayuk-lib`. Ninguno se
  // llama como el de la V6 —`src/api/identidad.ts` esta arriba, en `SE_FUE`— y ninguno lleva
  // `fetch` ni PKCE dentro, que es lo que vigila
  // `verificaciones/la-puerta-y-el-cliente-son-de-la-libreria.test.ts`.
  'src/configuracion.ts',
  'src/api/cliente.ts',
  'src/puerta/falla.ts',
  'src/puerta/AvisoDeLaPuerta.tsx',
  'src/preferencias/cajon.ts',
  'src/preferencias/MandoDeTema.tsx',
];

/**
 * La hoja propia de esta aplicacion. Los dos casos que `rentas` tiene en ESTE archivo (#55, AC 4).
 *
 * Aqui no comprueban lo mismo que en `tailwind-esta-conectado.test.ts`, que mira que los `@source`
 * apunten a algo y que la hoja importe la de la libreria: lo que se exige aqui es lo que la V6
 * hacia y ya no se puede hacer — declarar la paleta. `src/estilos/tokens/colors.css` salio con la
 * V6, y su contraste lo mide ahora la libreria.
 */
const HOJA_PROPIA = 'src/estilos.css';

describe('la hoja de la aplicacion no vuelve a declarar la paleta', () => {
  const sinComentarios = () =>
    readFileSync(join(RAIZ, HOJA_PROPIA), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('no declara ni un color', () => {
    // La paleta la publica `@kamayuk/ui` y la vendoriza el artboard. Un valor escrito aqui seria
    // una segunda fuente de verdad, y cual gana depende del orden en que el empaquetador resuelva
    // los modulos — o sea que el sintoma no es un color mal: es un color mal A VECES.
    const colores = [...sinComentarios().matchAll(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/gi)].map(
      ([c]) => c,
    );
    expect(colores, `«${HOJA_PROPIA}» escribe colores propios`).toEqual([]);
  });

  it('y cada `@source` apunta a algo que existe', () => {
    // Un `@source` a un directorio que no existe NO es un error para Tailwind: no mira ahi y calla.
    // Que las clases de esos directorios lleguen al CSS lo mide `tailwind-emite-las-clases`; que el
    // camino exista, esto.
    const fuentes = [...sinComentarios().matchAll(/@source\s+["']([^"']+)["']/g)].map(
      ([, ruta]) => ruta ?? '',
    );
    expect(fuentes.length, 'la hoja ya no declara ningun `@source`').toBeGreaterThan(0);
    for (const declarada of fuentes) {
      expect(
        existsSync(join(RAIZ, 'src', declarada)),
        `«@source "${declarada}"» no apunta a nada: Tailwind no mirara ahi y nadie lo dira`,
      ).toBe(true);
    }
  });
});

describe('la V6 no esta', () => {
  it('EL CENTINELA: la lista dice algo y el arbol se puede leer', () => {
    // Sin esto, una `RAIZ` mal calculada haria que `existsSync` diera false para todo y la guarda
    // pasara en verde afirmando que no esta nada — incluido lo que la sustituyo.
    expect(SE_FUE.length, 'SE_FUE esta vacia: la guarda no buscaria nada').toBeGreaterThan(0);
    expect(readdirSync(join(RAIZ, 'src')), 'no se pudo leer `src/`').toContain('main.tsx');
  });

  it('ninguna pieza de la V6 volvio al arbol', () => {
    const vueltas = SE_FUE.filter((x) => existsSync(join(RAIZ, x.ruta))).map(
      (x) => `  ${x.ruta} — ${x.que}`,
    );
    expect(
      vueltas,
      'Parte de la V6 esta otra vez en el arbol:\n' +
        `${vueltas.join('\n')}\n\n` +
        '  El repositorio vuelve a tener dos interfaces, una de ellas muerta, y quien llegue\n' +
        `  despues no sabe cual mirar. Si hace falta consultar como era: git show ${FUENTE_DE_LA_V6}:frontend/<ruta>.`,
    ).toEqual([]);
  });

  it('ni la bandera del proxy, en ningun archivo de entorno', () => {
    const conBandera = readdirSync(RAIZ)
      .filter((nombre) => nombre.startsWith('.env'))
      .filter((nombre) => readFileSync(join(RAIZ, nombre), 'utf8').includes(BANDERA_DEL_PROXY));
    expect(
      conBandera,
      `«${BANDERA_DEL_PROXY}» esta otra vez en un archivo de entorno. Sin proxy no hay nada que\n` +
        'encender, asi que esa bandera solo puede ser el proxy volviendo por partes.',
    ).toEqual([]);
  });

  it('y lo que la sustituyo SI esta: sin esto, borrarlo todo tambien pasaria', () => {
    const ausentes = ESTA.filter((ruta) => !existsSync(join(RAIZ, ruta)));
    expect(ausentes, `Falta lo que sustituyo a la V6:\n  ${ausentes.join('\n  ')}`).toEqual([]);
  });
});
