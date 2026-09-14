import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * El andamiaje no se afloja solo.
 *
 * Las cosas que este archivo vigila no son gustos: son las que hacen que TODO lo demas
 * verifique algo.
 *
 *   · Sin `strict` y sus dos companeras, el compilador deja pasar el `undefined` que
 *     luego se muestra como «NaN» — en un sistema cuyo unico producto son cifras.
 *   · Si `verificar` deja de encadenar una de las tres, el PR sigue saliendo verde y ya no
 *     dice lo mismo. Es un cambio de una linea y nadie lo revisa dos veces.
 *   · Si `base` deja de ser `/normativa/`, el bundle pide sus assets a la raiz y bajo el
 *     `stripPrefix` de Traefik no carga ninguno. **Eso no se ve en desarrollo**, donde
 *     todo cuelga de la raiz: se ve desplegado.
 *   · Si el workflow pierde su filtro o su comando, la CI del frontend deja de existir sin
 *     que ningun archivo se borre.
 *
 * Todas se caen en silencio, que es el motivo por el que se comprueban.
 *
 * **Desde #50 sigue a `rentas/frontend/verificaciones/andamiaje.test.ts` en `ac379ac`**, con lo
 * que aqui es propio y dicho: `.nvmrc` y `.npmrc`, que `rentas` no tiene (su CI fija
 * `node-version: "22"` como literal), la `base` de `vitest.config.ts` y los scripts que todavia
 * no tienen de que colgar. `preserveSymlinks`, que `rentas` exige, entra con el `link:` en #55.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const REPOSITORIO = join(RAIZ, '..');

const leer = (ruta: string) => readFileSync(ruta, 'utf8');

/**
 * Un `tsconfig` es **JSONC**, no JSON: admite comentarios (`rentas`, `andamiaje.test.ts`).
 *
 * `JSON.parse` a secas revienta con `Expected double-quoted property name in JSON` en cuanto
 * alguien anade uno —`tsconfig.base.json` los gana en #55, con el motivo de `preserveSymlinks`—,
 * que es un mensaje sobre comillas para un archivo sin ningun problema de comillas.
 *
 * Se recorre caracter a caracter y no con expresiones regulares, porque hay que saber si se esta
 * DENTRO de una cadena: una ruta con `https://` dentro se comeria el resto de la linea.
 */
function comoJsonc(texto: string): unknown {
  let salida = '';
  let enCadena = false;
  let escapado = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i] ?? '';
    if (enCadena) {
      salida += c;
      if (escapado) escapado = false;
      else if (c === '\\') escapado = true;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') {
      enCadena = true;
      salida += c;
      continue;
    }
    if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      salida += '\n';
      continue;
    }
    if (c === '/' && texto[i + 1] === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) i += 1;
      i += 1;
      salida += ' ';
      continue;
    }
    salida += c;
  }
  return JSON.parse(salida);
}

describe('el compilador es tan estricto como el issue pide', () => {
  const opciones = (comoJsonc(leer(join(RAIZ, 'tsconfig.base.json'))) as {
    compilerOptions: Record<string, unknown>;
  }).compilerOptions;

  it.each([
    ['strict', 'sin el, el resto de banderas no significan nada'],
    [
      'noUncheckedIndexedAccess',
      'sin el, `filas[0].valorUnitario` compila y revienta con el cuadro vacio',
    ],
    ['verbatimModuleSyntax', 'sin el, un `import type` se cuela en el bundle y arrastra el modulo'],
    ['noUnusedLocals', 'sin el, el codigo muerto se acumula sin que nadie lo vea'],
    ['noUnusedParameters', 'sin el, un parametro que dejo de usarse sigue en la firma'],
  ])('%s esta encendido — %s', (bandera) => {
    expect(opciones[bandera]).toBe(true);
  });
});

describe('«yarn verificar» encadena las tres comprobaciones', () => {
  const scripts = JSON.parse(leer(join(RAIZ, 'package.json'))).scripts as Record<string, string>;

  it.each(['lint', 'typecheck', 'test'])('llama a «yarn %s»', (comprobacion) => {
    expect(
      scripts['verificar'],
      `«verificar» dejo de llamar a «${comprobacion}». Una cadena a la que le falta un\n` +
        'eslabon sigue saliendo verde, y eso es peor que no tenerla.',
    ).toContain(`yarn ${comprobacion}`);
  });

  it('«build» produce un bundle de verdad, no un alias del typecheck', () => {
    expect(scripts['build']).toBe('vite build');
  });

  it('los guiones son los de rentas que ya tienen de que colgar, y ninguno mas', () => {
    // `rentas@ac379ac` declara trece. Los cinco que faltan aqui llaman a piezas que todavia no
    // existen, y cada uno entra con la suya: `i18n` e `i18n:regenerar` con i18next (#60) —y con
    // el, el `yarn i18n` de `verificar`—, `e2e` y `e2e:navegador` con el arnes de Playwright
    // (#61), y `dev:con-plataforma` con la puerta de identidad (#57). Un guion que llama a algo
    // que no esta sale rojo al usarlo, no al escribirlo.
    expect(Object.keys(scripts).sort()).toEqual(
      ['build', 'dev', 'lint', 'preview', 'test', 'test:watch', 'typecheck', 'verificar'].sort(),
    );
  });
});

describe('el paquete se identifica y fija con que Node se instala', () => {
  const paquete = JSON.parse(leer(join(RAIZ, 'package.json'))) as {
    name: string;
    engines?: Record<string, string>;
  };

  it('se llama «@kamayuk/normativa-web»', () => {
    expect(paquete.name).toBe('@kamayuk/normativa-web');
  });

  it('declara la version de Node que necesita', () => {
    expect(paquete.engines?.['node']).toBe('>=22');
  });

  it('y `.nvmrc` dice CUAL, que es de donde la toma la CI', () => {
    // **Diferencia declarada con `rentas`** (#50): alli no hay `.nvmrc` y su CI escribe
    // `node-version: "22"`. Aqui se conserva, porque sin el la CI y quien clona son dos numeros.
    // Dos mitades de la misma afirmacion: `engines` acota, `.nvmrc` elige. Si la CI
    // llevara el numero escrito a mano, serian dos que pueden separarse sin que nada
    // lo diga.
    expect(leer(join(RAIZ, '.nvmrc')).trim()).toMatch(/^2[2-9]\.\d+\.\d+$/);
  });

  it('y `.npmrc` hace de `engines` una guarda y no una nota', () => {
    // La otra diferencia declarada con `rentas`, que tampoco lo tiene. Sin `engine-strict`, una
    // version de Node fuera del rango solo AVISA al instalar, y el aviso se pierde entre otros.
    expect(leer(join(RAIZ, '.npmrc'))).toMatch(/^engine-strict=true$/m);
  });
});

describe('el bundle se sirve bajo el prefijo de su sistema', () => {
  const config = leer(join(RAIZ, 'vite.config.ts'));

  it('«base» es «/normativa/», porque la ruta dice quien responde (ADR-0030 §2)', () => {
    expect(
      config,
      'Sin `base: "/normativa/"` el bundle pide `/assets/…`, que en el cluster es de otro\n' +
        'sistema, y bajo el `stripPrefix` de Traefik no carga ni uno. El fallo NO aparece\n' +
        'en desarrollo —alli todo cuelga de la raiz—: aparece desplegado.',
    ).toMatch(/base:\s*'\/normativa\/'/);
  });

  it('y las pruebas corren bajo la MISMA base', () => {
    // De `vitest.config.ts` sale `import.meta.env.BASE_URL` en las pruebas. Con la base por
    // omision —`/`— el `redirect_uri` se prueba contra un valor que no es el real, y la leccion
    // de `c01fe9a:src/api/identidad.test.ts` deja de poder afirmarse en #57 (`rentas`#71: el
    // defecto llego a produccion con su prueba en verde).
    expect(leer(join(RAIZ, 'vitest.config.ts'))).toMatch(/base:\s*'\/normativa\/'/);
  });
});

/**
 * Donde vive el workflow del frontend.
 *
 * Se comprueba que EXISTA y lo que DICE. Si alguien lo borra, sale rojo aqui antes de que
 * nadie note que los PR del frontend dejaron de verificarse.
 */
const SITIO_DEL_WORKFLOW = '.github/workflows/frontend.yml';

describe('el frontend tiene su propia CI', () => {
  const ruta = join(REPOSITORIO, SITIO_DEL_WORKFLOW);
  const encontrado = existsSync(ruta) ? ruta : undefined;

  it('el workflow esta instalado', () => {
    expect(
      encontrado,
      `No hay workflow del frontend en «${SITIO_DEL_WORKFLOW}».\n` +
        'Sin el, «yarn verificar» solo se ejecuta en la maquina de quien lo escribe.',
    ).toBeDefined();
  });

  // Sin el archivo, `workflow` es la cadena vacia y NO una excepcion. Leerlo a secas
  // reventaria el modulo entero con un `ENOENT` durante la recoleccion: todos los casos de
  // este archivo desapareceran y el rojo hablaria de `readFileSync`, no de la CI que falta.
  // Es un defecto que `rentas` descubrio rompiendo su propia guarda, y no se repite aqui.
  const workflow = encontrado === undefined ? '' : leer(encontrado);

  it('se dispara solo con lo suyo', () => {
    // El filtro `paths` es lo contrario del criterio de `publicar-imagenes.yml`, y a
    // proposito: alli todo commit de `main` tiene que tener sus dos imagenes, asi que no
    // hay filtro. Aqui no se despliega nada, y un cambio del backend no tiene por que
    // gastar una instalacion de npm.
    expect(workflow).toMatch(/paths:\s*\[?"?frontend\/\*\*/);
  });

  it('el workflow es tambien lo suyo: un cambio en el se verifica a si mismo', () => {
    expect(
      workflow,
      'Romper la CI del frontend es el unico cambio que la CI del frontend no revisaria.',
    ).toContain(SITIO_DEL_WORKFLOW);
  });

  it('ejecuta la misma orden que se ejecuta en local', () => {
    // Si la CI corriera `yarn lint && yarn test` por su cuenta, «verde en CI» y «verde en
    // mi maquina» dejarian de ser la misma afirmacion en cuanto una de las dos cambie.
    expect(workflow).toContain('yarn verificar');
  });

  it('y ademas construye: un «tsc» en verde no demuestra que Vite empaquete', () => {
    expect(workflow).toContain('yarn build');
  });

  it('instala con el candado, no con lo que haya hoy en el registro', () => {
    expect(workflow).toContain('--frozen-lockfile');
  });

  it('toma la version de Node del archivo, no de un literal', () => {
    expect(
      workflow,
      'Con el numero escrito aqui, la CI y quien clona el repositorio son dos versiones\n' +
        'que pueden separarse sin que nada lo diga.',
    ).toContain('node-version-file: frontend/.nvmrc');
  });

  it('no pide permisos de escritura: lee y verifica, no publica', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });

  it('un colgado no consume cuota sin limite', () => {
    expect(workflow).toContain('timeout-minutes: 10');
  });

  it('un push nuevo cancela la corrida anterior, pero solo en PR', () => {
    // En `main` no se cancela: cada commit de `main` tiene que dejar su propio veredicto,
    // y una corrida cancelada no es un veredicto.
    expect(workflow).toContain('concurrency:');
    expect(workflow).toMatch(/cancel-in-progress:.*pull_request/);
  });
});
