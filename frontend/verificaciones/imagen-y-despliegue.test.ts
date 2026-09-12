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
 *   · Un `.dockerignore` sin los `.env` **hornea lo que lleven dentro en el paquete publicado**,
 *     y aqui lo que un `.env` puede encender son la UIT de cinco ejercicios, los tramos con sus
 *     alicuotas y filas de los tres cuadros nacionales.
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
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const REPOSITORIO = join(FRONTEND, '..');

const leer = (ruta: string) => readFileSync(ruta, 'utf8');

const DOCKERFILE = leer(join(FRONTEND, 'Dockerfile'));
const NGINX = leer(join(FRONTEND, 'nginx.conf'));
const DOCKERIGNORE = leer(join(FRONTEND, '.dockerignore'));
const COMPOSE = leer(join(REPOSITORIO, 'despliegue', 'compose.yaml'));
const DESCRIPTOR = leer(join(REPOSITORIO, 'infrastructure', 'src', 'descriptor.ts'));
const PUBLICAR = leer(join(REPOSITORIO, '.github', 'workflows', 'publicar-imagenes.yml'));
const INDEX = leer(join(FRONTEND, 'index.html'));

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
      ...PUBLICAR.matchAll(/- destino: (\S+)\n\s+imagen: (\S+)\n\s+archivo: (\S+)\n\s+contexto: (\S+)/g),
    ].map((m) => ({ destino: m[1], imagen: m[2], archivo: m[3], contexto: m[4] }));

    expect(entradas).toEqual([
      { destino: 'aplicacion', imagen: 'kamayuk-normativa', archivo: 'backend/Dockerfile', contexto: '.' },
      { destino: 'migrador', imagen: 'kamayuk-normativa-migrador', archivo: 'backend/Dockerfile', contexto: '.' },
      { destino: 'interfaz', imagen: 'kamayuk-normativa-interfaz', archivo: 'frontend/Dockerfile', contexto: 'frontend' },
    ]);

    // Y el paso las TOMA de la matriz. Con `context: .` fijo, la matriz seria decorativa.
    expect(PUBLICAR).toContain('context: ${{ matrix.contexto }}');
    expect(PUBLICAR).toContain('file: ${{ matrix.archivo }}');
  });

  /**
   * El trabajo `comprobar` pregunta por las MISMAS tres.
   *
   * Son dos listas que tienen que decir lo mismo: una imagen que se publique y no se pregunte
   * aqui queda sin la unica afirmacion que decide si el pod arranca — un `build-push-action` en
   * verde solo dice que el `push` no devolvio error.
   */
  it('el registro se pregunta por las mismas tres que se publican', () => {
    const publicadas = [...PUBLICAR.matchAll(/imagen: (\S+)/g)].map((m) => m[1]);
    const preguntadas = PUBLICAR.match(/for imagen in ([^;]+); do/)?.[1]?.trim().split(/\s+/) ?? [];
    expect(preguntadas.sort()).toEqual([...publicadas].sort());
  });

  /** El objetivo que la matriz publica tiene que ser una etapa que el Dockerfile define. */
  it('la etapa «interfaz» existe en el Dockerfile', () => {
    const etapas = [...DOCKERFILE.matchAll(/^FROM .+ AS (\S+)/gm)].map((m) => m[1]);
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
    expect(sinComentarios(PUBLICAR)).not.toContain('kamayuk-normativa-web');
    expect(sinComentarios(COMPOSE)).not.toContain('kamayuk-normativa-web');
  });
});

describe('la imagen no lleva dentro nada que no deba', () => {
  /**
   * El uid EN NUMERO. `runAsNonRoot: true` no puede comprobar un nombre: el kubelet se niega a
   * arrancar el contenedor con un `CreateContainerConfigError`, y eso solo aparece al desplegar.
   */
  it('el USER es numerico', () => {
    const usuarios = [...DOCKERFILE.matchAll(/^USER\s+(\S+)/gm)].map((m) => m[1]);
    expect(usuarios, 'sin USER, nginx corre como root').not.toHaveLength(0);
    for (const u of usuarios) {
      expect(u, `«USER ${u}» no es numerico: runAsNonRoot no lo puede comprobar`).toMatch(/^\d+$/);
    }
  });

  it('declara su HEALTHCHECK, y pide un archivo por su nombre', () => {
    expect(DOCKERFILE).toMatch(/^HEALTHCHECK /m);
    // `/` cae al `index.html` por el `try_files` pase lo que pase, asi que no distingue «nginx
    // levantado» de «nginx levantado sobre el dist que se copio».
    expect(DOCKERFILE).toContain('/index.html');
  });

  /**
   * **Todos** los archivos de entorno que Vite lee, y no solo los que `.gitignore` nombra.
   *
   * Es la segunda valla del proxy de datos. `vite build` no carga `.env.development`, pero SI
   * carga `.env`, `.env.local`, `.env.production` y `.env.production.local`: cualquiera con
   * `VITE_KAMAYUK_PROXY_DE_DATOS=true` dentro devolveria al paquete la UIT de cinco ejercicios,
   * los tramos con sus alicuotas y filas de los tres cuadros nacionales. Es el hallazgo de
   * `caja`#47: `*.local.*` NO casa con `.env.local`, porque exige algo detras del `.local`.
   */
  it('el .dockerignore deja fuera node_modules y TODOS los archivos de entorno de Vite', () => {
    const reglas = sinComentarios(DOCKERIGNORE)
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
   * `diseno/NormativaV6.dc.html` no entra en ningun `import` del paquete —lo comprueba
   * `arbol-del-artboard.test.ts`— asi que en el contexto no hace mas que aumentar la huella de la
   * capa con un archivo que lleva justo lo que esta imagen no puede llevar.
   */
  it('el .dockerignore deja fuera el artboard', () => {
    const reglas = sinComentarios(DOCKERIGNORE)
      .split('\n')
      .map((l) => l.trim());
    expect(reglas).toContain('diseno');
  });

  /** Que no quede fuente dentro del `dist/`, comprobado por la propia imagen al construirse. */
  it('la imagen comprueba que su dist no lleva codigo fuente', () => {
    expect(DOCKERFILE).toMatch(/-name '\*\.ts'/);
    expect(DOCKERFILE).toMatch(/-name '\*\.tsx'/);
  });
});

describe('el proxy de datos NO viaja en la imagen (AC9)', () => {
  it('se construye con la bandera apagada, escrito y no supuesto', () => {
    expect(DOCKERFILE).toMatch(/ENV VITE_KAMAYUK_PROXY_DE_DATOS=false/);
    // Y antes del build, o no serviria de nada.
    expect(DOCKERFILE.indexOf('VITE_KAMAYUK_PROXY_DE_DATOS=false')).toBeLessThan(
      DOCKERFILE.indexOf('RUN yarn build'),
    );
  });

  /**
   * Las cinco cadenas, comprobadas **dentro** de la construccion de la imagen.
   *
   * Medirlo fuera tambien vale, y esta en el PR; tenerlo aqui es lo que hace que una imagen con
   * cifras del corpus **no se pueda publicar**: el `docker build` sale en rojo.
   *
   * Las cuatro primeras salen de medir los dos `dist/`: aparecen solo en `proxy-*.js` con la
   * bandera encendida y en ningun archivo con ella apagada. `5500.00` es la UIT de 2026, y es la
   * que demuestra por que los mapas se retiran.
   */
  it('la imagen se niega a construirse si el dist lleva una cifra del corpus', () => {
    for (const cadena of ['AGYA 1.0L E AT', 'FO COMFORT', 'AUTOCRAFT', 'Carreras de caballos', '5500.00']) {
      expect(DOCKERFILE, `la comprobacion del dist no busca «${cadena}»`).toContain(cadena);
    }
  });

  /**
   * Los mapas de fuente no se publican.
   *
   * `vite.config.ts` declara `build.sourcemap: true`, asi que `dist/` sale con un `.map` por
   * trozo — y esta medido que ahi dentro SI aparece `5500.00`, la UIT de 2026, aunque en el `.js`
   * sea cero. Sin retirarlos, la propiedad que la bandera compra seria falsa por los mapas, con
   * el codigo que se ejecuta perfectamente limpio. Y ademas un `.map` lleva el fuente entero.
   */
  it('los mapas de fuente se retiran antes de servir', () => {
    expect(DOCKERFILE).toMatch(/find dist -name '\*\.map' -delete/);
  });
});

describe('lo que nginx sirve, y con que cabeceras', () => {
  /** Los bloques `location` de la configuracion, con su cuerpo. */
  const bloques = (() => {
    const texto = sinComentarios(NGINX);
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
  })();

  const LAS_TRES = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy'];

  it('el analizador encuentra los bloques de verdad', () => {
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
      for (const encontrada of sinComentarios(NGINX).match(sinAlways) ?? []) {
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
    expect(NGINX.split(directiva).length - 1).toBe(0);
  });

  /**
   * Y las senias del ambiente se sirven, con su cabecera de no guardar nada.
   *
   * Este archivo lo reemplaza el `ConfigMap` al desplegar, y un navegador que se quedara con el
   * anterior mandaria al usuario al emisor OIDC del ambiente que fuera.
   */
  it('configuracion.js se sirve con «no-store», y el index lo carga antes que el paquete', () => {
    const senias = bloques.find((b) => b.cabecera === '= /configuracion.js');
    expect(senias?.cuerpo).toContain('no-store');

    // Guion CLASICO y no modulo, y ANTES del paquete: un `type="module"` se difiere hasta
    // despues del analisis del documento, asi que llegaria tarde — cuando la puerta de identidad
    // ya hubiera leido las senias.
    expect(INDEX).toContain('<script src="/configuracion.js"></script>');
    expect(INDEX.indexOf('/configuracion.js')).toBeLessThan(INDEX.indexOf('/src/main.tsx'));
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
  const SIN_PROSA = sinComentarios(COMPOSE);

  /** Las etiquetas de Traefik del compose, como pares. */
  const etiquetas = Object.fromEntries(
    [...SIN_PROSA.matchAll(/^\s+- (traefik\.[^=]+)=(.+)$/gm)].map((m) => [m[1]!, m[2]!]),
  );

  it('el compose declara el servicio de la interfaz, con la imagen y la etapa del Dockerfile', () => {
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
    expect(DESCRIPTOR).toContain('PathPrefix(\\`/${SISTEMA}/api/v1\\`)');
    expect(DESCRIPTOR).toContain('stripPrefix: { prefixes: [`/${SISTEMA}`] }');
    expect(DESCRIPTOR).toContain('imagenes: [SISTEMA, MIGRADOR, INTERFAZ]');
  });

  /**
   * Y el cliente OIDC que las senias del ambiente declaran es el que la interfaz usa por omision.
   *
   * Son dos sitios: `infrastructure/src/descriptor.ts` lo pone en el `ConfigMap` que se monta
   * sobre `configuracion.js`, y `src/api/configuracion.ts` lo trae como tercer escalon para
   * `yarn dev` y para las pruebas. Si se separaran, `yarn dev` entraria por un cliente y el
   * despliegue por otro — y el sintoma del segundo es «Invalid parameter: redirect_uri» en una
   * maquina donde nadie puede reproducirlo.
   */
  it('el cliente OIDC es el mismo en el descriptor y en el escalon por omision', () => {
    const CONFIGURACION = leer(join(FRONTEND, 'src', 'api', 'configuracion.ts'));
    expect(DESCRIPTOR).toContain('const CLIENTE_OIDC_DE_LA_INTERFAZ = "kamayuk-backoffice"');
    expect(CONFIGURACION).toContain("oidcCliente: 'kamayuk-backoffice'");
  });
});
