// @vitest-environment node
//
// Mira el TEXTO de `src/`. No es un DOM lo que necesita.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * **`normativa` no tiene `fetch` ni PKCE propios** (#57, AC 1 y AC 5).
 *
 * <h2>Que protege, y de que</h2>
 *
 * La decision 3 de la epica #47: `@kamayuk/api` y `@kamayuk/sesion` se usan **directamente**. La
 * V6 tenia 394 lineas de PKCE (`c01fe9a:src/api/identidad.ts`) y 438 de cliente
 * (`c01fe9a:src/api/cliente.ts`), y salieron con ella (#50). Lo que esta guarda impide es que
 * vuelvan a entrar **por goteo**: un `fetch` suelto en la pantalla que hoy corre prisa, un
 * `sessionStorage` «solo para esto», un `switch (respuesta.status)` que traduce codigos a frases
 * —que es `peldanoDe()` escrito otra vez—.
 *
 * Ninguna de esas tres rompe nada el dia que se escribe. Lo que rompen es despues: dos puertas que
 * divergen, dos formatos de error, y un token en un sitio donde nadie lo busca.
 *
 * <h2>Por que ademas de la prohibicion de ESLint</h2>
 *
 * Porque la prohibicion `fetch-fuera-del-cliente` **exceptua `src/api/`**
 * (`DONDE_SE_LLAMA_A_FETCH`), y ahi es justo donde volveria a entrar un cliente escrito a mano. El
 * AC 1 de #57 pide vaciar esa lista; el archivo que la lleva —`eslint.prohibiciones.mjs`— lo
 * reescribe entero #62, que va en paralelo, asi que **la propiedad se sujeta aqui** y el dato se
 * vacia alli. Ver la fila de `docs/agent/HISTORY.md`.
 *
 * Esta guarda es mas ancha que la prohibicion de todas formas: mira `crypto.subtle`, los dos
 * almacenamientos y la traduccion de codigos, que ESLint no vigila.
 *
 * <h2>Se lee sin comentarios, y eso es lo que hace que sirva</h2>
 *
 * La prosa de estos archivos **nombra lo que prohibe**, y mucho: «la V6 tenia su propio `fetch`»,
 * «el token nunca en `localStorage`». Buscando sobre el texto crudo, cada explicacion seria un
 * rojo, y la salida seria borrar las explicaciones.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const SRC = join(RAIZ, 'src');

/** Todo `.ts`/`.tsx` de `src/`, con su ruta relativa a `frontend/`. */
function archivosDeProduccion(): readonly { readonly ruta: string; readonly fuente: string }[] {
  const salida: { ruta: string; fuente: string }[] = [];
  const recorrer = (directorio: string) => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const completa = join(directorio, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(completa);
        continue;
      }
      if (!/\.tsx?$/.test(entrada.name)) continue;
      // Las pruebas hablan DE las prohibiciones: una que no pudiera escribir `fetch` no podria
      // comprobar que esta prohibido. Es la misma excepcion que hace `eslint.config.js`.
      if (/\.test\.tsx?$/.test(entrada.name)) continue;
      salida.push({ ruta: relative(RAIZ, completa), fuente: readFileSync(completa, 'utf8') });
    }
  };
  recorrer(SRC);
  return salida;
}

/** El texto sin comentarios. Ver la cabecera: la prosa nombra lo que prohibe. */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * **La UNICA excepcion, y su motivo** (#67).
 *
 * `src/datos/huella.ts` nombra `crypto.subtle`, y tiene que nombrarlo: la hoja de Publicacion
 * recalcula el `sha256` de los bytes del snapshot y lo compara con el `ETag` que el servidor
 * anuncio. **Eso no es PKCE**, que es de lo que esta guarda defiende: `kamayuk-lib`#57 subio
 * `solicitarRespuesta()` —las cabeceras y el texto sin interpretar— y **devolvio la comprobacion**
 * con ese motivo escrito, «quien sabe que algoritmo firmo su recurso es el sistema que lo pide»
 * (H29b de `frontend/diseno/HUECOS.md`).
 *
 * Es **un archivo y solo uno**, corto y sin nada mas dentro, precisamente para que la excepcion se
 * pueda leer entera. Y no se apaga la regla: se exceptua **esta prohibicion en este archivo**, y las
 * otras cinco le siguen aplicando —ahi no hay `fetch`, ni almacenamiento, ni `code_verifier`—.
 *
 * El centinela de mas abajo comprueba que el archivo exceptuado **existe y de verdad la contiene**:
 * una excepcion sobre un archivo que ya no dice `crypto.subtle` es una puerta que se queda abierta
 * sin que nadie la vea.
 */
const DONDE_SE_RESUME = 'src/datos/huella.ts';

/** Lo que no puede aparecer en `src/`, con lo que hay que usar en su lugar. */
const PROHIBIDO: readonly {
  readonly que: string;
  readonly patron: RegExp;
  readonly enVezDe: string;
  /** Las rutas —relativas a `frontend/`— donde esta prohibicion NO aplica. Ver arriba. */
  readonly salvo?: readonly string[];
}[] =
  [
    {
      que: 'una llamada a `fetch`',
      patron: /\bfetch\s*\(/,
      enVezDe: '`cliente.solicitar()` de `src/api/cliente.ts`, que es `crearCliente` de `@kamayuk/api`',
    },
    {
      que: '`crypto.subtle`',
      patron: /crypto\s*\.\s*subtle/,
      enVezDe: '`crearIdentidad` de `@kamayuk/sesion`: el reto S256 lo calcula la libreria',
      salvo: [DONDE_SE_RESUME],
    },
    {
      que: '`localStorage` o `sessionStorage`',
      patron: /\b(localStorage|sessionStorage)\b/,
      enVezDe:
        'la libreria: el verificador PKCE lo guarda `@kamayuk/sesion` y el tema `@kamayuk/ui`, ' +
        'los dos con el prefijo del sistema. El token no se guarda en ninguna parte',
    },
    {
      que: 'un `code_verifier` o un `code_challenge`',
      patron: /code_(verifier|challenge)/,
      enVezDe: '`crearIdentidad` de `@kamayuk/sesion`',
    },
    {
      que: 'una cabecera `Authorization` compuesta a mano',
      patron: /['"`]Authorization['"`]|Bearer \$\{/,
      enVezDe: '`crearCliente`, que la pone leyendo el token en CADA peticion',
    },
    {
      que: 'un codigo HTTP traducido a mano a un mensaje',
      patron: /\b(status|estado)\s*===\s*(401|403|404|409|422|500)\b/,
      enVezDe: '`peldanoDe()` de `@kamayuk/sesion`, que es la unica escalera del producto',
    },
  ];

describe('en `src/` no hay ni puerta ni cliente escritos a mano', () => {
  it('EL CENTINELA: hay archivos que mirar, y el extractor de comentarios discrimina', () => {
    const archivos = archivosDeProduccion();
    expect(
      archivos.length,
      'no se encontro ni un archivo de produccion: esta guarda no afirmaria nada',
    ).toBeGreaterThan(5);

    // Sin esto, un extractor que devolviera cadena vacia dejaria las seis comprobaciones de abajo
    // pasando sobre la nada.
    expect(sinComentarios("// fetch('/x')\nconst a = 1;\n")).not.toMatch(/fetch\s*\(/);
    expect(sinComentarios("/* fetch('/x') */\nconst a = 1;\n")).not.toMatch(/fetch\s*\(/);
    expect(sinComentarios("const b = fetch('/x');\n")).toMatch(/fetch\s*\(/);
  });

  it('EL CENTINELA: el archivo exceptuado existe y DE VERDAD dice lo que se le exceptua', () => {
    // Una excepcion sobre un archivo que ya no contiene lo exceptuado —renombrado, borrado, o
    // reescrito para esquivar el patron— no da error: **deja la puerta abierta en silencio**. Aqui
    // se exige que ese archivo exista, que la cadena este dentro, y que el patron la vea.
    const exceptuado = archivosDeProduccion().find(({ ruta }) => ruta === DONDE_SE_RESUME);
    expect(
      exceptuado,
      `«${DONDE_SE_RESUME}» esta exceptuado de «crypto.subtle» y no existe.\n` +
        '  O vuelve a su sitio, o la excepcion sobra: una excepcion sin sujeto es una prohibicion\n' +
        '  apagada que nadie ve.',
    ).toBeDefined();
    expect(
      sinComentarios(exceptuado?.fuente ?? ''),
      `«${DONDE_SE_RESUME}» ya no dice «crypto.subtle» FUERA de sus comentarios. Si la comprobacion\n` +
        '  de la huella subio a la libreria, quitese la excepcion; si se escribio de otra forma para\n' +
        '  esquivar el patron, eso es lo que esta guarda existe para impedir.',
    ).toMatch(/crypto\s*\.\s*subtle/);
  });

  it.each(PROHIBIDO.map((p) => ({ ...p })))('no aparece $que', ({ que, patron, enVezDe, salvo }) => {
    const exentos = new Set(salvo ?? []);
    const culpables = archivosDeProduccion()
      .filter(({ ruta }) => !exentos.has(ruta))
      .filter(({ fuente }) => patron.test(sinComentarios(fuente)))
      .map(({ ruta }) => `  ${ruta}`);

    expect(
      culpables,
      `Hay ${que} en codigo de produccion:\n${culpables.join('\n')}\n\n` +
        `  Se usa ${enVezDe}.\n` +
        '  Es la decision 3 de la epica #47: `normativa` nace sobre la libreria y no tiene\n' +
        '  puerta ni cliente propios. Si a la libreria le falta algo, se le pide (AC 8 de #57):\n' +
        '  NO se copia aqui.' +
        (exentos.size === 0
          ? ''
          : `\n\n  Exentos, con su motivo en esta guarda: ${[...exentos].join(', ')}.`),
    ).toEqual([]);
  });

  it('y la exencion es de UNA prohibicion en UN archivo: las otras cinco le siguen aplicando', () => {
    // Lo que se exceptua es `crypto.subtle` en `src/datos/huella.ts`, y nada mas. Si ese archivo
    // ganara un `fetch`, un `sessionStorage` o un `switch` sobre codigos HTTP, seguiria saliendo
    // rojo — que es la diferencia entre exceptuar una regla y apagarlas todas en un directorio.
    const exceptuado = archivosDeProduccion().find(({ ruta }) => ruta === DONDE_SE_RESUME);
    const otras = PROHIBIDO.filter((p) => !(p.salvo ?? []).includes(DONDE_SE_RESUME));

    expect(otras.length, 'la excepcion cubre TODAS las prohibiciones: eso no es una excepcion').toBe(
      PROHIBIDO.length - 1,
    );
    const rotas = otras
      .filter((p) => p.patron.test(sinComentarios(exceptuado?.fuente ?? '')))
      .map((p) => `  ${p.que}`);
    expect(rotas, `«${DONDE_SE_RESUME}» rompe prohibiciones que NO se le exceptuan:\n${rotas.join('\n')}`).toEqual(
      [],
    );
  });
});

describe('la puerta se construye UNA vez, y el cliente es una sola sentencia', () => {
  const puerta = () => sinComentarios(readFileSync(join(SRC, 'sesion.ts'), 'utf8'));
  const cliente = () => sinComentarios(readFileSync(join(SRC, 'api/cliente.ts'), 'utf8'));

  it('hay exactamente una llamada a `crearIdentidad`, y esta en `src/sesion.ts`', () => {
    const enElArbol = archivosDeProduccion().filter(({ fuente }) =>
      /crearIdentidad\s*\(/.test(sinComentarios(fuente)),
    );

    // Dos instancias son dos `sessionStorage` con las mismas claves y dos tokens en memoria: la
    // pantalla que use la segunda contesta 401 mientras la primera va identificada.
    expect(enElArbol.map(({ ruta }) => ruta)).toEqual(['src/sesion.ts']);
    expect(puerta().match(/crearIdentidad\s*\(/g)).toHaveLength(1);
  });

  it('el `retorno` sale de `BASE_URL`, no de una cadena escrita', () => {
    // La otra mitad de `rentas`#71, y la que una prueba de la URL no puede ver: con el valor
    // escrito a mano, cambiar `base` en `vite.config.ts` dejaria el retorno apuntando al sitio
    // viejo y la suite seguiria verde.
    expect(puerta()).toContain('window.location.origin + import.meta.env.BASE_URL');
  });

  it('el prefijo de las claves lleva el sistema dentro', () => {
    // Las cinco interfaces se sirven del MISMO origen y comparten `sessionStorage`: sin el
    // sistema en el prefijo, dos de ellas se pisan el verificador PKCE a media entrada.
    expect(puerta()).toMatch(/prefijoDeClaves:\s*'kamayuk\.normativa'/);
  });

  it('el cliente es `crearCliente` con el prefijo de este sistema y el token de la puerta', () => {
    expect(cliente()).toMatch(/crearCliente\s*\(\s*\{/);
    expect(cliente()).toMatch(/prefijo:\s*'\/normativa\/api\/v1'/);
    // Como FUNCION y no como valor: el token cambia dentro de la vida de la pagina, y uno leido al
    // construir el cliente seria `null` para siempre.
    expect(cliente()).toMatch(/token:\s*identidad\.token\b/);
    expect(cliente()).not.toMatch(/token:\s*identidad\.token\(\)/);
  });

  it('y ese prefijo es EL MISMO que `vite.config.ts` reenvia en desarrollo', () => {
    // Dos copias de la raiz de la API se separan, y el sintoma es que `yarn dev` deja de llegar al
    // backend —el servidor de Vite contesta el `index.html` con un 200— sin un solo error.
    const vite = readFileSync(join(RAIZ, 'vite.config.ts'), 'utf8');
    expect(vite).toContain("'/normativa/api/v1'");
  });
});
