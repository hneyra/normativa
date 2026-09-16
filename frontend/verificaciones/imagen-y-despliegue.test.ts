import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Que `normativa-web` se pueda desplegar, y que llegue a alguien (#39).
 *
 * <h2>Lo que este archivo vigila, y por que cada cosa</h2>
 *
 * Ninguna de estas propiedades falla haciendo ruido. Es la lista entera de las que, rotas, dejan
 * un despliegue que arranca:
 *
 *   · Un `USER` no numerico deja el pod en `CreateContainerConfigError`, y solo al desplegar.
 *   · Un `.dockerignore` sin los `.env` **hornea lo que lleven dentro en el paquete publicado**.
 *   · Una negativa del `Dockerfile` que deja de buscar una cifra del corpus deja publicar una
 *     imagen que la sirve. La V6 salio (#50); esa leccion no era de la V6 y se queda.
 *   · Las cabeceras de seguridad escritas a nivel `server` se apagan en cada `location` que
 *     declare una cabecera propia, porque `add_header` no se hereda. La pagina sigue saliendo.
 *   · Las dos prioridades del ingreso al reves hacen que la API la conteste el nginx, con un
 *     **200** y el `index.html` dentro.
 *   · Y el compose y el descriptor separandose es la trampa que ADR-0011 anoto.
 *
 * <h2>Lo que NO puede vigilar, y por eso no se finge aqui</h2>
 *
 * Que la imagen levante y sirva. Eso es `docker build` + `docker run` + pedirle una pagina, y
 * esta suite corre sin demonio de Docker. Las mediciones estan en el PR de #39 y en la fila del
 * registro; aqui se sujeta que los archivos que las producen no se deshagan.
 *
 * <h2>Lo que cambio con #55</h2>
 *
 * Entra el CUARTO sitio que tiene que decir lo mismo: el clon hermano `kamayuk-lib`. Son cuatro
 * archivos que se escriben por separado y que, si dejan de coincidir, no rompen nada donde se
 * miran:
 *
 *   · el `link:` de `frontend/package.json` fija la PROFUNDIDAD —`../../`— y de ahi sale el
 *     `WORKDIR` de la imagen. Acortarlo no da un error de rutas: da
 *     «Your lockfile needs to be updated», que manda a mirar el candado.
 *   · el `COPY --from=kamayuk-lib` del `Dockerfile` no es una etapa: sin un contexto declarado,
 *     BuildKit lo resuelve como NOMBRE DE IMAGEN y se va a Docker Hub.
 *   · quien declara ese contexto son tres: `frontend.yml` (el PR), `publicar-imagenes.yml` (`main`)
 *     y el compose. Los tres tienen que decir el mismo nombre, y ninguno de los tres se ejecuta
 *     cuando se edita otro.
 *
 * <h2>Lo que cambio con #50</h2>
 *
 * Salio el `describe` del proxy de datos —su bandera ya no existe—, la negativa de las cinco
 * cadenas se quedo con su nombre de verdad, salio la mitad del cliente OIDC que leia
 * `src/api/configuracion.ts` (la del descriptor se queda; la otra vuelve en #57), y **ningun
 * archivo se lee en el cuerpo del modulo**.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const REPOSITORIO = join(FRONTEND, '..');

/**
 * Lee un archivo del repositorio **dentro de la prueba que lo necesita**, y si no esta, lo dice.
 *
 * Hasta `c01fe9a` los siete se leian en el cuerpo del modulo. Con uno movido de sitio —medido en
 * #50 moviendo `despliegue/compose.yaml`— el `ENOENT` reventaba la RECOLECCION: el archivo entero
 * salia como «Failed Suites» sin una sola prueba, y el rojo hablaba de `readFileSync` y no de que
 * contrato se habia quedado sin comprobar. Asi, sale roja cada prueba que lo necesita, nombrandolo.
 */
function leer(relativa: string): string {
  const ruta = join(REPOSITORIO, relativa);
  expect(
    existsSync(ruta),
    `falta «${relativa}»: esta prueba compara contra ese archivo y sin el no afirma nada`,
  ).toBe(true);
  return readFileSync(ruta, 'utf8');
}

const DOCKERFILE = () => leer('frontend/Dockerfile');
const NGINX = () => leer('frontend/nginx.conf');
const DOCKERIGNORE = () => leer('frontend/.dockerignore');
const COMPOSE = () => leer('despliegue/compose.yaml');
const DESCRIPTOR = () => leer('infrastructure/src/descriptor.ts');
const PUBLICAR = () => leer('.github/workflows/publicar-imagenes.yml');
const INDEX = () => leer('frontend/index.html');
const FRONTEND_YML = () => leer('.github/workflows/frontend.yml');
const PAQUETE = () => leer('frontend/package.json');

/** Las lineas de una configuracion, sin comentarios: `#` a final de linea no es una directiva. */
const sinComentarios = (texto: string) =>
  texto
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n');

describe('la imagen existe, y quien la publica sabe de donde sale', () => {
  it('estan los tres archivos que la definen', () => {
    for (const archivo of ['Dockerfile', 'nginx.conf', '.dockerignore']) {
      expect(existsSync(join(FRONTEND, archivo)), `falta frontend/${archivo}`).toBe(true);
    }
  });

  /**
   * La tercera entrada de la matriz, **con su contexto y su archivo propios**.
   *
   * Los dos tienen que ir en la matriz y no fijos en el paso: un `.dockerignore` solo cuenta
   * desde la raiz de SU contexto, asi que construir `frontend/Dockerfile` con el contexto en la
   * raiz del repositorio se llevaria dentro `node_modules`, los `.env` y el artboard entero.
   */
  it('la matriz declara las TRES imagenes, cada una con su contexto y su archivo', () => {
    const entradas = [
      ...PUBLICAR().matchAll(/- destino: (\S+)\n\s+imagen: (\S+)\n\s+archivo: (\S+)\n\s+contexto: (\S+)/g),
    ].map((m) => ({ destino: m[1], imagen: m[2], archivo: m[3], contexto: m[4] }));

    // Las tres con `normativa/` delante desde #55: el anfitrion se clona en `path: normativa`
    // para que `kamayuk-lib` quepa a su lado, y las rutas de la matriz siguen al anfitrion. El
    // `.dockerignore` que aplica a cada imagen no cambia por eso —`normativa` es lo que era `.`—.
    expect(entradas).toEqual([
      { destino: 'aplicacion', imagen: 'kamayuk-normativa', archivo: 'normativa/backend/Dockerfile', contexto: 'normativa' },
      { destino: 'migrador', imagen: 'kamayuk-normativa-migrador', archivo: 'normativa/backend/Dockerfile', contexto: 'normativa' },
      { destino: 'interfaz', imagen: 'kamayuk-normativa-interfaz', archivo: 'normativa/frontend/Dockerfile', contexto: 'normativa/frontend' },
    ]);

    // Y el paso las TOMA de la matriz. Con `context: .` fijo, la matriz seria decorativa.
    expect(PUBLICAR()).toContain('context: ${{ matrix.contexto }}');
    expect(PUBLICAR()).toContain('file: ${{ matrix.archivo }}');
    // Y el anfitrion baja de verdad: si el checkout siguiera en la raiz, el prefijo de arriba
    // apuntaria a un directorio que no existe y las tres imagenes fallarian a la vez.
    expect(PUBLICAR()).toContain('path: normativa');
  });

  /**
   * El trabajo `comprobar` pregunta por las MISMAS tres.
   *
   * Son dos listas que tienen que decir lo mismo: una imagen que se publique y no se pregunte
   * aqui queda sin la unica afirmacion que decide si el pod arranca — un `build-push-action` en
   * verde solo dice que el `push` no devolvio error.
   */
  it('el registro se pregunta por las mismas tres que se publican', () => {
    const publicadas = [...PUBLICAR().matchAll(/imagen: (\S+)/g)].map((m) => m[1]);
    const preguntadas = PUBLICAR().match(/for imagen in ([^;]+); do/)?.[1]?.trim().split(/\s+/) ?? [];
    expect(preguntadas.sort()).toEqual([...publicadas].sort());
  });

  /** El objetivo que la matriz publica tiene que ser una etapa que el Dockerfile define. */
  it('la etapa «interfaz» existe en el Dockerfile', () => {
    const etapas = [...DOCKERFILE().matchAll(/^FROM .+ AS (\S+)/gm)].map((m) => m[1]);
    expect(etapas).toContain('interfaz');
  });

  /**
   * La imagen NO se llama `kamayuk-normativa-web`.
   *
   * Ese nombre ya es el del `Deployment` y el `Service` del BACKEND con el perfil `web` de Spring
   * en el descriptor. Un `Service` de Kubernetes y una imagen de un registro son espacios de
   * nombres distintos, asi que la colision no seria un error: seria peor — dos artefactos del
   * producto llamados igual, uno sirviendo la API y otro archivos estaticos.
   */
  it('y no se llama «-web», que es el nombre del backend', () => {
    // Sin los comentarios de los dos archivos: la prosa de los dos EXPLICA que ese nombre no se
    // usa, y para explicarlo lo escribe. Una guarda que se dispara con el texto que la justifica
    // es una guarda que alguien acaba apagando borrando el comentario en vez del defecto.
    expect(sinComentarios(PUBLICAR())).not.toContain('kamayuk-normativa-web');
    expect(sinComentarios(COMPOSE())).not.toContain('kamayuk-normativa-web');
  });
});

/**
 * **Los cuatro sitios que tienen que decir «kamayuk-lib»** (#55).
 *
 * Lo que los ata no es un nombre elegido: es el `link:` de `frontend/package.json`, que es lo
 * unico que yarn obedece. De ahi sale la PROFUNDIDAD del `WORKDIR` y de ahi sale que haga falta
 * un contexto con nombre, porque el destino del `link:` vive dos niveles por encima del contexto
 * de esta imagen.
 */
describe('el clon hermano llega a la imagen, y los cuatro sitios dicen lo mismo (#55)', () => {
  /** El nombre del contexto de BuildKit. Uno solo, y lo tienen que escribir los cuatro. */
  const CONTEXTO = 'kamayuk-lib';

  /** La ruta que el `link:` declara, leida del manifiesto y no escrita aqui. */
  const declaradaEnElLink = (): string => {
    const manifiesto = JSON.parse(PAQUETE()) as { dependencies?: Record<string, string> };
    const enlaces = Object.values(manifiesto.dependencies ?? {}).filter((v) =>
      v.startsWith('link:'),
    );
    return enlaces[0]?.slice('link:'.length) ?? '';
  };

  it('EL CENTINELA: hay un `link:` del que derivar todo lo demas', () => {
    // Sin esto, un `package.json` sin enlaces dejaria `declaradaEnElLink()` en la cadena vacia y
    // las comprobaciones de abajo pasarian sobre la nada — que es como una guarda se queda sin
    // sujeto sin que nadie la borre.
    const declarada = declaradaEnElLink();
    expect(declarada, 'ningun `link:` en `dependencies`').not.toBe('');
    expect(declarada).toContain(CONTEXTO);
    expect(declarada.startsWith('../../'), `el link: ya no sube dos niveles: «${declarada}»`).toBe(
      true,
    );
  });

  it('el `WORKDIR` reproduce la profundidad que el `link:` exige', () => {
    // La profundidad NO se escribe aqui: se cuenta de la ruta declarada. Un `WORKDIR /origen`
    // —el de antes de #55— deja `../../kamayuk-lib` aplastado contra `/`, yarn reescribe la ruta y
    // el rojo es «Your lockfile needs to be updated», que manda a mirar el candado.
    const sube = (declaradaEnElLink().match(/\.\.\//g) ?? []).length;
    const workdir = DOCKERFILE().match(/^WORKDIR\s+(\S+)/m)?.[1] ?? '';
    const niveles = workdir.replace(/^\/|\/$/g, '').split('/').filter((x) => x !== '');

    expect(
      niveles.length,
      `«WORKDIR ${workdir}» tiene ${String(niveles.length)} niveles y el link: sube ${String(sube)}:\n` +
        '  con menos, `../../kamayuk-lib` se aplasta contra la raiz y `yarn install` falla\n' +
        '  diciendo que el candado esta viejo — que no habla de rutas ni de clones hermanos.',
    ).toBeGreaterThanOrEqual(sube + 1);
    // Y el nombre de este repositorio esta dentro, que es lo que hace que el hermano caiga AL LADO
    // y no encima.
    expect(workdir).toContain('/normativa/');
  });

  it('el Dockerfile copia el hermano por un contexto con nombre, y solo `paquetes/`', () => {
    const copia = DOCKERFILE().match(/^COPY --from=(\S+)\s+(\S+)\s+(\S+)/m);
    expect(copia?.[1], `el Dockerfile ya no copia del contexto «${CONTEXTO}»`).toBe(CONTEXTO);
    // `paquetes/` y no `.`: un contexto con nombre entra por su propia raiz y NINGUN
    // `.dockerignore` lo acota — el de `frontend/` solo filtra el contexto principal. Con `.` se
    // llevaria dentro el `node_modules` del hermano, su `.git` y cualquier `.env`.
    expect(copia?.[2], 'un `COPY --from=kamayuk-lib .` se lleva el node_modules y el .git del hermano').toBe(
      'paquetes/',
    );
    // Y va ANTES del `yarn install`, o el enlace no existe cuando yarn lo busca.
    expect(DOCKERFILE().indexOf('--from=kamayuk-lib')).toBeLessThan(
      DOCKERFILE().indexOf('yarn install'),
    );
  });

  it('y lo copiado se sirve desde ESA profundidad: el COPY de la ultima etapa la repite', () => {
    // Si el `WORKDIR` cambia y este `COPY` no, la etapa `interfaz` copia de un directorio que no
    // existe — y `COPY` de un directorio vacio NO falla: deja la imagen sirviendo nada, `healthy`.
    const workdir = DOCKERFILE().match(/^WORKDIR\s+(\S+)/m)?.[1] ?? '';
    expect(DOCKERFILE()).toContain(`COPY --from=construccion ${workdir}/dist/`);
  });

  it('los TRES que declaran el contexto lo nombran igual: PR, publicacion y compose', () => {
    // Ninguno de los tres se ejecuta cuando se edita otro, asi que la unica forma de que digan lo
    // mismo es esta.
    expect(
      FRONTEND_YML(),
      'el flujo del PR no construye la imagen con el contexto con nombre: un Dockerfile roto se\n' +
        'descubriria despues del merge, porque `publicar-imagenes.yml` solo corre en `main`',
    ).toContain(`--build-context ${CONTEXTO}=`);
    expect(
      PUBLICAR(),
      `«${CONTEXTO}» no lo declara la matriz de publicar-imagenes.yml`,
    ).toContain(`${CONTEXTO}=`);
    expect(
      PUBLICAR(),
      'la matriz lo declara y el paso no lo pasa: `build-contexts` falta',
    ).toContain('build-contexts: ${{ matrix.contextos }}');
    expect(
      sinComentarios(COMPOSE()),
      'sin `additional_contexts`, `docker compose build` se va a buscar\n' +
        '`docker.io/library/kamayuk-lib:latest` y el rojo habla de un registro',
    ).toMatch(new RegExp(`additional_contexts:\\s*\\n\\s*${CONTEXTO}:\\s*\\.\\./\\.\\./${CONTEXTO}`));
  });

  it('y los tres apuntan a la MISMA ruta que el `link:` declara', () => {
    // El compose y el `docker build` del flujo resuelven la ruta desde sitios distintos
    // —`despliegue/` y `frontend/`— y dan el mismo directorio: `despliegue/../../kamayuk-lib` y
    // `frontend/../../kamayuk-lib`. Que coincida con el `link:` es lo que hace que la imagen
    // instale lo mismo que instala quien construye en su maquina.
    const declarada = declaradaEnElLink().split('/paquetes/')[0] ?? '';
    expect(sinComentarios(COMPOSE())).toContain(`${CONTEXTO}: ${declarada}`);
    expect(FRONTEND_YML()).toContain(`--build-context ${CONTEXTO}=${declarada}`);
  });
});

describe('la imagen no lleva dentro nada que no deba', () => {
  /**
   * El uid EN NUMERO. `runAsNonRoot: true` no puede comprobar un nombre: el kubelet se niega a
   * arrancar el contenedor con un `CreateContainerConfigError`, y eso solo aparece al desplegar.
   */
  it('el USER es numerico', () => {
    const usuarios = [...DOCKERFILE().matchAll(/^USER\s+(\S+)/gm)].map((m) => m[1]);
    expect(usuarios, 'sin USER, nginx corre como root').not.toHaveLength(0);
    for (const u of usuarios) {
      expect(u, `«USER ${u}» no es numerico: runAsNonRoot no lo puede comprobar`).toMatch(/^\d+$/);
    }
  });

  it('declara su HEALTHCHECK, y pide un archivo por su nombre', () => {
    expect(DOCKERFILE()).toMatch(/^HEALTHCHECK /m);
    // `/` cae al `index.html` por el `try_files` pase lo que pase, asi que no distingue «nginx
    // levantado» de «nginx levantado sobre el dist que se copio».
    expect(DOCKERFILE()).toContain('/index.html');
  });

  /**
   * **Todos** los archivos de entorno que Vite lee, y no solo los que `.gitignore` nombra.
   *
   * `vite build` no carga `.env.development`, pero SI carga `.env`, `.env.local`,
   * `.env.production` y `.env.production.local`, y hornea en el paquete toda `VITE_*` que lleven.
   * En la V6 una sola bandera en cualquiera de ellos devolvia al paquete cifras del corpus. Es el
   * hallazgo de `caja`#47: `*.local.*` NO casa con `.env.local`, porque exige algo detras.
   */
  it('el .dockerignore deja fuera node_modules y TODOS los archivos de entorno de Vite', () => {
    const reglas = sinComentarios(DOCKERIGNORE())
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');

    expect(reglas).toContain('node_modules');

    const queViteLee = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.production.local',
      '.env.development',
    ];
    const cubierto = (archivo: string) =>
      reglas.some((r) => r === archivo || (r.endsWith('*') && archivo.startsWith(r.slice(0, -1))));
    for (const archivo of queViteLee) {
      expect(cubierto(archivo), `«${archivo}» entraria en el contexto y Vite lo hornearia`).toBe(
        true,
      );
    }
  });

  /**
   * Y el artboard, que lleva dentro las cifras del corpus.
   *
   * `diseno/NormativaV6.dc.html` no entra en ningun `import` del paquete, asi que en el contexto
   * no hace mas que aumentar la huella de la capa con un archivo que lleva justo lo que esta
   * imagen no puede llevar.
   */
  it('el .dockerignore deja fuera el artboard', () => {
    const reglas = sinComentarios(DOCKERIGNORE())
      .split('\n')
      .map((l) => l.trim());
    expect(reglas).toContain('diseno');
  });

  /**
   * Y **`verificaciones/` NO se excluye**, que es lo contrario de lo que decia hasta #55.
   *
   * `vite.config.ts` carga `resolucion.ts`, y `resolucion.ts` importa `./verificaciones/enlace.ts`.
   * Con el directorio fuera del contexto, el `docker build` muere al cargar la configuracion de
   * Vite —«Could not resolve "./verificaciones/enlace.ts"»— y ningun flujo de PR lo veia antes de
   * #55, porque `publicar-imagenes.yml` solo corre en `main`. Es el hallazgo de `catastro`#118.
   */
  it('el .dockerignore NO deja fuera `verificaciones`, de donde `resolucion.ts` importa', () => {
    const reglas = sinComentarios(DOCKERIGNORE())
      .split('\n')
      .map((l) => l.trim());
    expect(
      reglas,
      'Excluir `verificaciones/` rompe el `docker build`: `vite.config.ts` carga `resolucion.ts`,\n' +
        'que importa `./verificaciones/enlace.ts`. No entra en el paquete — Vite solo la lee al\n' +
        'cargar su configuracion.',
    ).not.toContain('verificaciones');
  });

  /** Que no quede fuente dentro del `dist/`, comprobado por la propia imagen al construirse. */
  it('la imagen comprueba que su dist no lleva codigo fuente', () => {
    expect(DOCKERFILE()).toMatch(/-name '\*\.ts'/);
    expect(DOCKERFILE()).toMatch(/-name '\*\.tsx'/);
  });
});

describe('lo servido no lleva una cifra del corpus', () => {
  /**
   * Las cinco cadenas, comprobadas **dentro** de la construccion de la imagen.
   *
   * Medirlo fuera tambien vale, y esta en el PR; tenerlo aqui es lo que hace que una imagen con
   * cifras del corpus **no se pueda publicar**: el `docker build` sale en rojo.
   *
   * Salen de medir los `dist/` de la V6 (`c01fe9a`): las cuatro primeras aparecian solo en su
   * `proxy-*.js`, y `5500.00` es la UIT de 2026, la que demostro por que los mapas se retiran. El
   * proxy salio con la V6; la leccion —ninguna cifra del corpus en lo servido— no, y renace como
   * `sin-cifras-inventadas` en #58. Hasta entonces, esto es lo que la sujeta.
   */
  it('la imagen se niega a construirse si lo servido lleva una cifra del corpus', () => {
    // Se leen las cadenas del BUCLE, sin comentarios, y no del archivo entero. Hasta `c01fe9a`
    // bastaba con que el `Dockerfile` CONTUVIERA cada cadena, y la prosa que explica la negativa
    // nombra `5500.00` dos veces: medido en #50, quitar `'5500.00'` del bucle dejaba esta prueba
    // en VERDE (27 de 27) con la imagen dispuesta a servir la UIT de 2026.
    const bucle = sinComentarios(DOCKERFILE()).match(/for cadena in ([^;]*); do/)?.[1] ?? '';
    const buscadas = [...bucle.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(bucle, 'el Dockerfile ya no tiene el bucle `for cadena in …; do` de la negativa').not.toBe('');
    for (const cadena of ['AGYA 1.0L E AT', 'FO COMFORT', 'AUTOCRAFT', 'Carreras de caballos', '5500.00']) {
      expect(buscadas, `la negativa del Dockerfile no busca «${cadena}»`).toContain(cadena);
    }
    // Y que el bucle de verdad corte la construccion: un `echo` sin `exit 1` avisaria y publicaria.
    expect(sinComentarios(DOCKERFILE())).toMatch(/grep -rqF "\$cadena" "\$servido"; then[^]*?exit 1/);
  });

  /**
   * Los mapas de fuente no se publican.
   *
   * `vite.config.ts` declara `build.sourcemap: true`, asi que `dist/` sale con un `.map` por
   * trozo — y esta medido que ahi dentro SI aparece `5500.00`, la UIT de 2026, aunque en el `.js`
   * sea cero (medido en la V6). Sin retirarlos, la negativa de arriba se cumpliria sobre el codigo
   * que se ejecuta y la cifra saldria por los mapas. Y ademas un `.map` lleva el fuente entero.
   */
  it('los mapas de fuente se retiran antes de servir', () => {
    expect(DOCKERFILE()).toMatch(/find dist -name '\*\.map' -delete/);
  });
});

describe('lo que nginx sirve, y con que cabeceras', () => {
  /** Los bloques `location` de la configuracion, con su cuerpo. Se llama DENTRO de cada prueba. */
  const bloquesDe = () => {
    const texto = sinComentarios(NGINX());
    const salida: { cabecera: string; cuerpo: string }[] = [];
    const patron = /location\s+([^{]+)\{/g;
    let m: RegExpExecArray | null;
    while ((m = patron.exec(texto)) !== null) {
      let profundidad = 1;
      let i = patron.lastIndex;
      while (i < texto.length && profundidad > 0) {
        if (texto[i] === '{') profundidad += 1;
        if (texto[i] === '}') profundidad -= 1;
        i += 1;
      }
      salida.push({ cabecera: m[1]!.trim(), cuerpo: texto.slice(patron.lastIndex, i - 1) });
    }
    return salida;
  };

  const LAS_TRES = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy'];

  it('el analizador encuentra los bloques de verdad', () => {
    const bloques = bloquesDe();
    // Si esto se rompe, todas las de abajo pasarian en verde sobre una lista vacia.
    expect(bloques.length).toBeGreaterThanOrEqual(4);
    expect(bloques.map((b) => b.cabecera)).toContain('/assets/');
  });

  /**
   * `add_header` **no se hereda**: un bloque que declara una cabecera propia descarta TODAS las
   * del nivel de arriba. Escribirlas una vez a nivel `server` las apagaria justo en los bloques
   * que ponen `Cache-Control`, o sea en casi todo lo que se sirve, y la pagina seguiria saliendo
   * igual.
   */
  it('CADA location declara las tres cabeceras de seguridad, con «always»', () => {
    const bloques = bloquesDe();
    for (const bloque of bloques) {
      for (const cabecera of LAS_TRES) {
        const linea = new RegExp(`add_header\\s+${cabecera}\\s+[^;]+always\\s*;`);
        expect(
          bloque.cuerpo,
          `el bloque «location ${bloque.cabecera}» no declara «${cabecera} … always»`,
        ).toMatch(linea);
      }
    }
  });

  /**
   * `always`, y no por gusto: sin el, `add_header` **solo se aplica a 2xx, 204, 301, 302, 303,
   * 304, 307 y 308**. O sea que se caerian precisamente en las respuestas de error, que es donde
   * mas importan — un 404 tambien se puede enmarcar en un `iframe`.
   */
  it('ninguna cabecera de seguridad se declara sin «always»', () => {
    for (const cabecera of LAS_TRES) {
      const sinAlways = new RegExp(`add_header\\s+${cabecera}\\s+[^;]*;`, 'g');
      for (const encontrada of sinComentarios(NGINX()).match(sinAlways) ?? []) {
        expect(encontrada, 'sin «always» la cabecera no sale en los errores').toContain('always');
      }
    }
  });

  /**
   * Y la cabecera de cache es el caso CONTRARIO: va **sin** `always`, a proposito.
   *
   * Lo encontro `rentas` midiendo la imagen de verdad. Con `always`, un activo que no existe
   * contestaba `404` **con `max-age=31536000, immutable` dentro**: un navegador que cachee esa
   * respuesta se queda un ano sin volver a pedir ese archivo, y el remedio normal —recargar— no
   * lo arregla, porque lo que tiene guardado es el 404.
   *
   * Es la unica cabecera del archivo que NO lleva `always`, y por eso se comprueba: alguien que
   * «uniformara» el archivo poniendoselo a todas devolveria el defecto en silencio.
   */
  it('el cache de un ano NO se aplica a los errores', () => {
    const bloques = bloquesDe();
    const activos = bloques.find((b) => b.cabecera === '/assets/');
    const linea = activos?.cuerpo.match(/add_header\s+Cache-Control[^;]+;/)?.[0] ?? '';
    expect(linea).toContain('immutable');
    expect(linea, 'con «always» un 404 de un activo se cachearia un ano').not.toContain('always');
  });

  /**
   * El «200 que miente». `try_files $uri /index.html` es lo que hace que recargar en
   * `#publicacion` funcione, y tambien lo que convierte un `.js` que falta en HTML con codigo de
   * exito. En `/assets/` no se admite ese repliegue: un activo que falta da 404.
   */
  it('un activo que falta da 404 y no el index.html', () => {
    const bloques = bloquesDe();
    const activos = bloques.find((b) => b.cabecera === '/assets/');
    expect(activos?.cuerpo).toMatch(/try_files\s+\$uri\s+=404\s*;/);
    expect(activos?.cuerpo).not.toContain('index.html');
  });

  /**
   * Y la averia del prefijo, dicha en voz alta.
   *
   * A este nginx nunca le puede llegar una ruta que empiece por `/normativa/`: el ingreso lo
   * quita antes de reenviar. Si llega, el `stripPrefix` no esta haciendo su trabajo — y sin este
   * bloque esa averia entraria por `location /` y saldria como el 200 de arriba.
   */
  it('una ruta con el prefijo puesto da 404 nombrando la causa', () => {
    const bloques = bloquesDe();
    const guarda = bloques.find((b) => b.cabecera === '/normativa/');
    expect(
      guarda,
      'sin este bloque, un stripPrefix ausente sale como un 200 con HTML',
    ).toBeDefined();
    expect(guarda?.cuerpo).toMatch(/return\s+404/);
    expect(guarda?.cuerpo).toContain('stripPrefix');
  });

  /**
   * Este nginx NO reenvia a ningun sitio, y esa ausencia es una afirmacion.
   *
   * El mismo origen se consigue un piso mas arriba —el ingreso parte `/normativa` en dos—, asi
   * que un reenvio aqui seria un SEGUNDO camino a la API que nadie revisa, y obligaria a este
   * contenedor a alcanzar el backend por la red, que es justo lo que su `NetworkPolicy` le niega.
   *
   * La cuenta se hace sobre el archivo entero a proposito, lo que obliga a que ni la prosa de
   * `nginx.conf` ni la de aqui escriban el nombre de la directiva: nombrarla daria un positivo
   * que no es un reenvio, y una comprobacion que se dispara con el texto que la explica es una
   * comprobacion que alguien acaba apagando.
   */
  it('no hay ni un reenvio en toda la configuracion', () => {
    const directiva = ['proxy', 'pass'].join('_');
    expect(NGINX().split(directiva).length - 1).toBe(0);
  });

  /**
   * Y las senias del ambiente se sirven, con su cabecera de no guardar nada.
   *
   * Este archivo lo reemplaza el `ConfigMap` al desplegar, y un navegador que se quedara con el
   * anterior mandaria al usuario al emisor OIDC del ambiente que fuera.
   */
  it('configuracion.js se sirve con «no-store», y el index lo carga antes que el paquete', () => {
    const bloques = bloquesDe();
    const senias = bloques.find((b) => b.cabecera === '= /configuracion.js');
    expect(senias?.cuerpo).toContain('no-store');

    // Guion CLASICO y no modulo, y ANTES del paquete: un `type="module"` se difiere hasta
    // despues del analisis del documento, asi que llegaria tarde — cuando la puerta de identidad
    // ya hubiera leido las senias.
    expect(INDEX()).toContain('<script src="/configuracion.js"></script>');
    expect(INDEX().indexOf('/configuracion.js')).toBeLessThan(INDEX().indexOf('/src/main.tsx'));
  });
});

describe('el compose y el descriptor dicen lo mismo (ADR-0011)', () => {
  /**
   * El compose SIN sus comentarios, y hace falta de verdad.
   *
   * La prosa del servicio explica que la variable NO puede llamarse `KAMAYUK_PUERTO_INTERFAZ` —y
   * para explicarlo la escribe— y que la imagen NUNCA es `kamayuk-normativa-web` —y para
   * explicarlo la escribe—. O sea que las guardas se dispararian con la prosa que las justifica,
   * que es la forma mas segura de que alguien acabe borrando el comentario en vez del defecto.
   */
  const sinProsa = () => sinComentarios(COMPOSE());

  /** Las etiquetas de Traefik del compose, como pares. */
  const etiquetasDe = (sinProsaDelCompose: string): Record<string, string> =>
    Object.fromEntries(
      [...sinProsaDelCompose.matchAll(/^\s+- (traefik\.[^=]+)=(.+)$/gm)].map((m) => [m[1]!, m[2]!]),
    );

  it('el compose declara el servicio de la interfaz, con la imagen y la etapa del Dockerfile', () => {
    const SIN_PROSA = sinProsa();
    expect(SIN_PROSA).toMatch(/^ {2}normativa-interfaz:$/m);
    expect(SIN_PROSA).toContain('image: kamayuk-normativa-interfaz:compose');
    expect(SIN_PROSA).toContain('context: ../frontend');
    expect(SIN_PROSA).toContain('target: interfaz');
  });

  /**
   * **Sin `depends_on`**, y es una afirmacion: esta interfaz no necesita el backend ni para
   * dibujarse ni para hablar con el, porque no reenvia nada. Declarar una dependencia que no
   * existe haria que el compose mintiera sobre el grafo —que es lo que la guarda de
   * `infrastructure` compara contra el descriptor— y obligaria a `up -d normativa-interfaz` a
   * levantar la base, el migrador y la implantacion para servir unos archivos que no los usan.
   */
  it('la interfaz no declara depends_on', () => {
    const SIN_PROSA = sinProsa();
    const servicio = SIN_PROSA.slice(SIN_PROSA.indexOf('  normativa-interfaz:'));
    expect(servicio).not.toContain('depends_on');
  });

  /**
   * El puerto. `KAMAYUK_PUERTO_INTERFAZ` a secas YA lo usa la interfaz del monolito, y el `.env`
   * es el mismo para todo esto: reusar el nombre haria que el valor por omision de aqui no se
   * aplicara nunca y que las dos interfaces pidieran el mismo puerto del anfitrion. Es lo que
   * `caja`#39 midio.
   */
  it('el puerto se pide por una variable con el sufijo del sistema', () => {
    const SIN_PROSA = sinProsa();
    const puertos = [...SIN_PROSA.matchAll(/\$\{(KAMAYUK_PUERTO_[A-Z_]+)/g)].map((m) => m[1]);
    expect(puertos).toContain('KAMAYUK_PUERTO_INTERFAZ_NORMATIVA');
    expect(puertos, 'ese nombre ya es el de la interfaz del monolito').not.toContain(
      'KAMAYUK_PUERTO_INTERFAZ',
    );
  });

  /**
   * La ruta partida en dos, con las prioridades escritas.
   *
   * Traefik v3 ordena por longitud de la regla cuando nadie declara `priority`, asi que hoy
   * saldria bien **por accidente**. Y al reves el fallo no grita: la API la contestaria el nginx
   * con un 200 y el `index.html` dentro.
   */
  it('las dos reglas de Traefik llevan prioridad, y la de la API es la mayor', () => {
    const SIN_PROSA = sinProsa();
    const etiquetas = etiquetasDe(SIN_PROSA);
    expect(etiquetas['traefik.http.routers.normativa.rule']).toBe(
      'PathPrefix(`/normativa/api/v1`)',
    );
    expect(etiquetas['traefik.http.routers.normativa-interfaz.rule']).toBe(
      'PathPrefix(`/normativa`)',
    );

    const api = Number(etiquetas['traefik.http.routers.normativa.priority']);
    const interfaz = Number(etiquetas['traefik.http.routers.normativa-interfaz.priority']);
    expect(
      api,
      'sin prioridad explicita la precedencia la decide la longitud del texto',
    ).not.toBeNaN();
    expect(interfaz).not.toBeNaN();
    expect(api).toBeGreaterThan(interfaz);
  });

  /**
   * Y el prefijo se quita SOLO en la de la interfaz: `Api.RAIZ` del backend es
   * `/normativa/api/v1` entera, asi que quitarselo lo dejaria buscando `/api/v1/...` y
   * contestando 404 a todo.
   */
  it('el stripprefix va solo en el enrutador de la interfaz', () => {
    const SIN_PROSA = sinProsa();
    const etiquetas = etiquetasDe(SIN_PROSA);
    expect(etiquetas['traefik.http.routers.normativa-interfaz.middlewares']).toBe(
      'normativa-quitar-prefijo',
    );
    expect(
      etiquetas['traefik.http.middlewares.normativa-quitar-prefijo.stripprefix.prefixes'],
    ).toBe('/normativa');
    expect(etiquetas['traefik.http.routers.normativa.middlewares']).toBeUndefined();
  });

  /**
   * Las dos mitades de ADR-0011, comparadas de verdad: el reparto del compose tiene que ser el
   * mismo que el del descriptor.
   *
   * Se compara contra el TEXTO del descriptor y no importandolo, porque este paquete no depende
   * de aquel; lo que se busca son las cuatro decisiones que tendrian que moverse a la vez.
   */
  it('el descriptor declara el mismo reparto que el compose', () => {
    expect(DESCRIPTOR()).toContain('PathPrefix(\\`/${SISTEMA}/api/v1\\`)');
    expect(DESCRIPTOR()).toContain('stripPrefix: { prefixes: [`/${SISTEMA}`] }');
    expect(DESCRIPTOR()).toContain('imagenes: [SISTEMA, MIGRADOR, INTERFAZ]');
  });

  /**
   * El cliente OIDC que las senias del ambiente declaran.
   *
   * Hasta `c01fe9a` esta prueba lo comparaba tambien con el escalon por omision de
   * `src/api/configuracion.ts`, que salio con la V6. La mitad del descriptor se queda —es lo que
   * `infrastructure` pone en el `ConfigMap`— y la otra vuelve en #57, con la puerta de identidad:
   * si se separaran, `yarn dev` entraria por un cliente y el despliegue por otro, y el sintoma
   * es «Invalid parameter: redirect_uri» en una maquina donde nadie puede reproducirlo.
   */
  it('el descriptor sigue declarando el cliente OIDC de la interfaz', () => {
    expect(DESCRIPTOR()).toContain('const CLIENTE_OIDC_DE_LA_INTERFAZ = "kamayuk-backoffice"');
  });
});
