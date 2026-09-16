import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **Lo que tiene que pasar ANTES de que React monte, con la puerta de `@kamayuk/sesion`** (#57,
 * AC 4 y AC 7).
 *
 * Sigue a `rentas/frontend/src/arranque.test.ts@ac379ac` y recoge, a nivel de unidad y sobre la
 * configuracion de ESTE sistema, las lecciones que la V6 midio en
 * `c01fe9a:frontend/src/api/identidad.test.ts` y `c01fe9a:frontend/src/arranque.test.ts`: el
 * `redirect_uri` de la raiz de la APLICACION, el reto que **es** el SHA-256 del verificador, el
 * token que no toca ningun almacenamiento, los dos frenos del rebote, y lo servido que manda sobre
 * lo horneado. La version en navegador, sobre el paquete construido, es de #61.
 *
 * <h2>Por que cada prueba vuelve a CARGAR los modulos</h2>
 *
 * Porque la puerta es una constante de modulo: `crearIdentidad` toma el realm, el cliente, el
 * alcance y el retorno **al evaluarse** `src/sesion.ts`. Asi que lo que hay en `location` y en
 * `window.__KAMAYUK_NORMATIVA__` tiene que estar puesto ANTES de importar — que es exactamente el
 * orden que `index.html` garantiza en el navegador, con `/configuracion.js` como guion clasico
 * antes del modulo. Importando una vez arriba se mediria la puerta construida con lo que jsdom trae
 * por omision y no con lo que cada caso pone.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** El origen del servidor de desarrollo. Distinto del de jsdom a proposito: ver `ubicacion`. */
const ORIGEN = 'http://localhost:5173';

/** La raiz de la aplicacion. La misma `base` de `vite.config.ts` y de `vitest.config.ts`. */
const RAIZ_DE_LA_APLICACION = `${ORIGEN}/normativa/`;

/** El realm del escalon por omision de `src/configuracion.ts`. */
const REALM = 'http://localhost:8181/realms/kamayuk';

/** El prefijo de las claves del rebote: el de `src/sesion.ts`, con el sistema dentro. */
const CLAVES = 'kamayuk.normativa.pkce';

/**
 * Sustituye `location`, que en jsdom no se puede espiar de otra manera.
 *
 * Con un origen que NO es el de jsdom (`localhost:3000`): si la puerta leyera el origen de otro
 * sitio que `window.location`, el `redirect_uri` saldria con el de jsdom y la prueba lo diria.
 */
function ubicacion(href: string = RAIZ_DE_LA_APLICACION) {
  const url = new URL(href);
  const asignar = vi.fn();
  vi.stubGlobal('location', {
    origin: url.origin,
    href: url.href,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign: asignar,
    reload: vi.fn(),
  });
  return asignar;
}

/** El emisor contesta la sonda: el estado normal, en que `entrar()` navega. */
function elEmisorContesta() {
  const pedir = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 200 })));
  vi.stubGlobal('fetch', pedir);
  return pedir;
}

/** Y el otro camino: la navegacion no llega a ocurrir (`rentas`#112). */
function elEmisorNoContesta() {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch'))),
  );
}

/**
 * Carga el arranque y la puerta **despues** de poner lo que cada caso necesita, y del mismo
 * registro de modulos: `porQueNoSeEntro` y `identidad` tienen que ser los que usa `arrancar`.
 */
async function cargar() {
  vi.resetModules();
  const arranque = await import('./arranque.ts');
  const { identidad, DESTINO_POR_OMISION } = await import('./sesion.ts');
  const { porQueNoSeEntro } = await import('./puerta/falla.ts');
  return { ...arranque, identidad, porQueNoSeEntro, DESTINO_POR_OMISION };
}

/** La URL a la que se mando el navegador, ya descompuesta. */
function idaA(asignar: ReturnType<typeof ubicacion>): URL {
  const destino = asignar.mock.calls[0]?.[0];
  expect(destino, 'no se mando el navegador a ninguna parte').toBeDefined();
  return new URL(String(destino));
}

/** Todo lo que hay en los dos almacenamientos, claves y valores, en una sola cadena. */
function loQueHayGuardado(): string {
  const volcar = (almacen: Storage) =>
    Object.keys(almacen)
      .map((clave) => `${clave}=${almacen.getItem(clave) ?? ''}`)
      .join('\n');
  return `${volcar(localStorage)}\n${volcar(sessionStorage)}`;
}

/**
 * El primer `cargar()` paga el `import` de `@kamayuk/ui` y `@kamayuk/shell` enteros —`sesion.ts`
 * los alcanza por el cajon de preferencias—, y en frio eso pasa de los 5 s de Vitest. Es el mismo
 * arreglo que `verificaciones/reglas-de-eslint.test.ts` hace con el arranque de ESLint, y por lo
 * mismo: el coste deja de estar dentro de una prueba que no lo mide, y si algun dia se atasca, el
 * rojo sale de este gancho y dice que fue el arranque.
 */
beforeAll(async () => {
  await import('./sesion.ts');
}, 60_000);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  ubicacion();
  elEmisorContesta();
});

afterEach(() => {
  delete window.__KAMAYUK_NORMATIVA__;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe('main.tsx monta dentro de arrancar', () => {
  it('el createRoot esta dentro del argumento de arrancar, no despues', () => {
    const fuente = readFileSync(join(AQUI, 'main.tsx'), 'utf8');
    const dentro = /arrancar\(\(\) => \{[\s\S]*createRoot\(raiz\)[\s\S]*\}\);/.test(fuente);

    expect(
      dentro,
      'main.tsx monta React fuera de «arrancar». El canje del codigo de autorizacion ocurriria\n' +
        'DESPUES del montaje, y la primera peticion de la primera pantalla saldria sin token.',
    ).toBe(true);
  });
});

describe('AC 4 — el orden del arranque', () => {
  it('sin token va a la puerta y NO monta: montar seria dibujar sobre un documento que se va', async () => {
    const asignar = ubicacion();
    const { arrancar } = await cargar();
    let monto = false;

    await arrancar(() => {
      monto = true;
    });

    expect(monto).toBe(false);
    expect(idaA(asignar).href.startsWith(`${REALM}/protocol/openid-connect/auth?`)).toBe(true);
  });

  it('con token no va a ninguna parte: monta', async () => {
    const asignar = ubicacion();
    const { arrancar, identidad } = await cargar();
    identidad.fijarToken('un-token-de-prueba');
    let monto = false;

    await arrancar(() => {
      monto = true;
    });

    expect(monto).toBe(true);
    expect(asignar).not.toHaveBeenCalled();
  });

  it('si volvemos con un codigo, lo canjea ANTES de montar', async () => {
    sessionStorage.setItem(`${CLAVES}.verificador`, 'v');
    sessionStorage.setItem(`${CLAVES}.estado`, 'e');
    ubicacion(`${RAIZ_DE_LA_APLICACION}?code=c&state=e`);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ access_token: 'el-canjeado' }))),
    );
    const { arrancar, identidad } = await cargar();
    let tokenAlMontar: string | null = null;

    await arrancar(() => {
      tokenAlMontar = identidad.token();
    });

    // La primera peticion de la primera pantalla saldria sin token si el canje ocurriera despues
    // del montaje, y contestaria 401 a quien acaba de identificarse.
    expect(tokenAlMontar).toBe('el-canjeado');
  });

  it('recien salido NO vuelve a entrar solo: monta', async () => {
    const asignar = ubicacion();
    sessionStorage.setItem(`${CLAVES}.salida`, '1');
    const { arrancar, identidad } = await cargar();
    let monto = false;

    await arrancar(() => {
      monto = true;
    });

    // `post_logout_redirect_uri` trae de vuelta sin token. Sin esta marca, quien acaba de cerrar
    // sesion se encontraria DENTRO OTRA VEZ con la misma cuenta sin haber hecho nada.
    expect(identidad.vieneDeSalir()).toBe(true);
    expect(asignar).not.toHaveBeenCalled();
    expect(monto).toBe(true);
  });

  it('y con el tope de idas agotado tampoco: monta en vez de rebotar sin fin', async () => {
    const asignar = ubicacion();
    sessionStorage.setItem(`${CLAVES}.idas`, '3');
    const { arrancar } = await cargar();
    let monto = false;

    await arrancar(() => {
      monto = true;
    });

    expect(asignar).not.toHaveBeenCalled();
    expect(monto).toBe(true);
  });

  it('un ?error= del emisor NO vuelve a la puerta: monta y se queda el motivo', async () => {
    // La leccion de `c01fe9a:src/api/identidad.test.ts:239-249` y `:281-304`. Sin esto el arranque
    // volveria a la puerta, el emisor devolveria el mismo error, y a la tercera el tope pararia
    // **sin una palabra de la causa**: tres rebotes y una pantalla en blanco.
    const asignar = ubicacion(
      `${RAIZ_DE_LA_APLICACION}?error=invalid_client&error_description=Invalid+parameter%3A+redirect_uri`,
    );
    const { arrancar, porQueNoSeEntro } = await cargar();
    let monto = false;

    await arrancar(() => {
      monto = true;
    });

    expect(monto, 'no monto: la pantalla se queda en blanco con el motivo en ninguna parte').toBe(
      true,
    );
    expect(asignar, 'volvio a la puerta: el emisor devolveria el mismo error').not.toHaveBeenCalled();
    expect(porQueNoSeEntro()).toEqual({
      tipo: 'no-dejo-entrar',
      motivo: 'El emisor no reconoce a este cliente',
      detalle: 'Invalid parameter: redirect_uri',
    });
  });

  it('y una vuelta buena no deja ningun motivo anotado', async () => {
    sessionStorage.setItem(`${CLAVES}.verificador`, 'v');
    sessionStorage.setItem(`${CLAVES}.estado`, 'e');
    ubicacion(`${RAIZ_DE_LA_APLICACION}?code=c&state=e`);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ access_token: 'el-canjeado' }))),
    );
    const { arrancar, porQueNoSeEntro } = await cargar();

    await arrancar(() => {});

    // La otra rama. Sin ella, un `anotarLaVuelta` que anotara siempre pasaria la prueba de arriba
    // y taparia la aplicacion con un aviso a quien acaba de entrar bien.
    expect(porQueNoSeEntro()).toBeNull();
  });
});

/**
 * **Sin emisor levantado, `yarn dev` no puede dejar la pagina EN BLANCO** (AC 4.3, `rentas`#112).
 *
 * Las DOS ramas, porque con solo una un arreglo que montara siempre pasaria en verde y estropearia
 * el camino bueno, o el defecto seguiria ahi.
 */
describe('AC 4.3 — la puerta que no contesta monta y se explica; la que si, no', () => {
  it('la puerta NO contesta: monta, y dice que emisor fallo y en que URL', async () => {
    const asignar = ubicacion();
    elEmisorNoContesta();
    const { arrancar, porQueNoSeEntro } = await cargar();
    let monto = false;

    await arrancar(() => {
      monto = true;
    });

    expect(monto, 'no monto nada: la pagina se queda en blanco').toBe(true);
    expect(asignar, 'se creyo que habia navegado').not.toHaveBeenCalled();
    expect(
      porQueNoSeEntro(),
      'monto sin la falla: la aplicacion dibujaria el armazon vacio y no la averia',
    ).toEqual({
      tipo: 'no-contesto',
      falla: {
        emisor: REALM,
        url: `${REALM}/.well-known/openid-configuration`,
        motivo: 'Failed to fetch',
      },
    });
  });

  it('la puerta SI contesta: sigue sin montar, y sin falla que contar', async () => {
    const asignar = ubicacion();
    const { arrancar, porQueNoSeEntro } = await cargar();
    let monto = false;

    await arrancar(() => {
      monto = true;
    });

    expect(monto, 'dibujo sobre un documento que el navegador se va a llevar').toBe(false);
    expect(asignar).toHaveBeenCalledTimes(1);
    expect(porQueNoSeEntro()).toBeNull();
  });

  it('y la falla no sobrevive a la pasada siguiente: cada arranque la vuelve a fijar', async () => {
    elEmisorNoContesta();
    const { arrancar, porQueNoSeEntro, identidad } = await cargar();
    await arrancar(() => {});
    expect(porQueNoSeEntro()).not.toBeNull();

    identidad.fijarToken('un-token-de-prueba');
    elEmisorContesta();
    await arrancar(() => {});

    expect(porQueNoSeEntro()).toBeNull();
  });
});

/**
 * **AC 7 — la URL de autorizacion, parametro a parametro.**
 *
 * <h2>El `redirect_uri`, con una `base` que NO es `/`</h2>
 *
 * `vitest.config.ts` fija `base: '/normativa/'`, la misma que `vite.config.ts`, y el centinela de
 * abajo lo comprueba antes de nada: con `base: '/'`, `origin + BASE_URL` y `origin + '/'` son la
 * misma cadena y la prueba pasaria con el defecto que costo produccion en `rentas`#71.
 */
describe('AC 7 — a donde se manda el navegador', () => {
  it('EL CENTINELA: la base de las pruebas es la de la aplicacion, y no la raiz del sitio', () => {
    expect(import.meta.env.BASE_URL).toBe('/normativa/');
  });

  it('`redirect_uri` es la raiz de la APLICACION —`<origin>/normativa/`— y no la del sitio', async () => {
    const asignar = ubicacion(`${RAIZ_DE_LA_APLICACION}#/ediciones`);
    const { arrancar } = await cargar();

    await arrancar(() => {});

    const redirect = idaA(asignar).searchParams.get('redirect_uri');
    expect(
      redirect,
      'El retorno no es la raiz de la aplicacion. Con `origin + "/"` quien se autentica vuelve a\n' +
        '`https://<dominio>/` —de otro sistema, o un 404— con el `code` correcto (`rentas`#71).',
    ).toBe(RAIZ_DE_LA_APLICACION);
  });

  it('pide un codigo con PKCE S256, y el reto ES el SHA-256 del verificador guardado', async () => {
    const asignar = ubicacion();
    const { arrancar } = await cargar();

    await arrancar(() => {});

    const ida = idaA(asignar).searchParams;
    expect(ida.get('response_type')).toBe('code');
    expect(ida.get('code_challenge_method')).toBe('S256');

    // Calculado aqui, no leido de la libreria: un reto escrito a mano, o `plain`, pasaria una
    // comprobacion de «hay un `code_challenge`».
    const verificador = sessionStorage.getItem(`${CLAVES}.verificador`);
    expect(verificador, 'no se guardo el verificador con el prefijo de este sistema').not.toBeNull();
    const resumen = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verificador ?? ''),
    );
    const esperado = btoa(String.fromCharCode(...new Uint8Array(resumen)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(ida.get('code_challenge')).toBe(esperado);
  });

  it('con el cliente y el alcance de la configuracion de ESTE sistema', async () => {
    const asignar = ubicacion();
    const { arrancar } = await cargar();

    await arrancar(() => {});

    const ida = idaA(asignar).searchParams;
    expect(ida.get('client_id')).toBe('kamayuk-backoffice');
    // Sin `offline_access`: un `refresh_token` es una credencial de vida larga, y el token de esta
    // interfaz muere con la pestana a proposito (ADR-0030 §3).
    expect(ida.get('scope')).toBe('openid profile');
  });

  it('y la clave del verificador NO nombra ninguna credencial', async () => {
    const asignar = ubicacion();
    const { arrancar } = await cargar();

    await arrancar(() => {});
    expect(asignar).toHaveBeenCalled();

    // Lo que se guarda para sobrevivir al rebote no es una credencial: es el secreto de un solo uso
    // que demuestra que quien canja es quien pidio. Llamarlo `…token.verificador` obligaria a
    // distinguir dos cosas que se llaman igual.
    const vigiladas = /token|jwt|bearer|credencial|contrasena|acceso|sesion/i;
    const claves = Object.keys(sessionStorage);
    expect(claves.length).toBeGreaterThan(0);
    expect(claves.filter((clave) => vigiladas.test(clave))).toEqual([]);
  });

  it('dos idas dan dos verificadores distintos: no hay secreto fijo', async () => {
    ubicacion();
    const { identidad } = await cargar();

    await identidad.entrar();
    const primero = sessionStorage.getItem(`${CLAVES}.verificador`);
    await identidad.entrar();

    expect(primero).not.toBeNull();
    expect(sessionStorage.getItem(`${CLAVES}.verificador`)).not.toBe(primero);
  });
});

/**
 * **El token vive en memoria y en ningun almacenamiento** — la mitad que la prohibicion de ESLint
 * NO puede ver.
 *
 * Aquella mira el NOMBRE de la clave, asi que `sessionStorage.setItem('kamayuk.normativa.x', token)`
 * la pasaria entera. Esto recorre los VALORES.
 */
describe('AC 7 — nada de lo canjeado acaba en localStorage ni en sessionStorage', () => {
  const TOKEN = 'ACCESO-QUE-NO-SE-GUARDA';
  const IDENTIDAD = 'IDENTIDAD-QUE-TAMPOCO';

  it('tras un canje bueno, ni el token ni el id_token estan en ningun almacen', async () => {
    sessionStorage.setItem(`${CLAVES}.verificador`, 'v');
    sessionStorage.setItem(`${CLAVES}.estado`, 'e');
    ubicacion(`${RAIZ_DE_LA_APLICACION}?code=c&state=e`);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          Response.json({ access_token: TOKEN, id_token: IDENTIDAD, refresh_token: 'refresco' }),
        ),
      ),
    );
    const { arrancar, identidad } = await cargar();

    await arrancar(() => {});

    expect(identidad.token()).toBe(TOKEN);
    const guardado = loQueHayGuardado();
    expect(guardado).not.toContain(TOKEN);
    expect(guardado).not.toContain(IDENTIDAD);
    expect(guardado).not.toContain('refresco');
    expect(localStorage.length, 'localStorage no se toca en absoluto').toBe(0);
  });

  it('y el verificador y el estado se borran: un codigo no se canjea dos veces', async () => {
    sessionStorage.setItem(`${CLAVES}.verificador`, 'v');
    sessionStorage.setItem(`${CLAVES}.estado`, 'e');
    ubicacion(`${RAIZ_DE_LA_APLICACION}?code=c&state=e`);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ access_token: TOKEN }))),
    );
    const { arrancar } = await cargar();

    await arrancar(() => {});

    expect(sessionStorage.getItem(`${CLAVES}.verificador`)).toBeNull();
    expect(sessionStorage.getItem(`${CLAVES}.estado`)).toBeNull();
  });
});

/**
 * **La cadena de la configuracion, medida DONDE se nota**: en la URL a la que se navega de verdad.
 *
 * `src/configuracion.test.ts` mide la funcion; esto mide que la puerta la use.
 */
describe('AC 2 — lo servido manda sobre lo horneado, y llega hasta la ida', () => {
  it('con `__KAMAYUK_NORMATIVA__` puesto, se va a ESE emisor y con ESE cliente', async () => {
    const asignar = ubicacion();
    window.__KAMAYUK_NORMATIVA__ = {
      oidcRealm: 'https://identidad.munisullana.gob.pe/realms/kamayuk',
      oidcCliente: 'otro-cliente',
    };
    const { arrancar } = await cargar();

    await arrancar(() => {});

    const ida = idaA(asignar);
    expect(ida.origin + ida.pathname).toBe(
      'https://identidad.munisullana.gob.pe/realms/kamayuk/protocol/openid-connect/auth',
    );
    expect(ida.searchParams.get('client_id')).toBe('otro-cliente');
    // Lo que no se sirvio cae al escalon siguiente, no se queda vacio.
    expect(ida.searchParams.get('scope')).toBe('openid profile');
  });

  it('y una cadena en blanco NO cuenta: cae al escalon de abajo', async () => {
    const asignar = ubicacion();
    window.__KAMAYUK_NORMATIVA__ = { oidcRealm: '   ' };
    const { arrancar } = await cargar();

    await arrancar(() => {});

    // Un `ConfigMap` con la llave puesta y el valor en blanco es un error de despliegue. Heredar de
    // el daria un rebote a `/protocol/openid-connect/auth` —una ruta de la propia interfaz— que
    // `nginx` contesta con el `index.html` y un 200: el «200 que miente».
    expect(idaA(asignar).href.startsWith(`${REALM}/protocol/openid-connect/auth?`)).toBe(true);
  });
});

describe('AC 6 — salir cierra en el emisor y deja la marca', () => {
  it('manda `id_token_hint` y vuelve a la raiz de la aplicacion', async () => {
    const asignar = ubicacion();
    const { identidad } = await cargar();
    identidad.fijarToken('un-token', 'una-identidad');

    identidad.salir();

    expect(identidad.token()).toBeNull();
    expect(identidad.vieneDeSalir()).toBe(true);
    const fin = idaA(asignar);
    expect(fin.origin + fin.pathname).toBe(`${REALM}/protocol/openid-connect/logout`);
    // Sin `id_token_hint` el emisor no cierra SU sesion, y el siguiente arranque entraria solo con
    // la misma cuenta sin que nadie teclee nada.
    expect(fin.searchParams.get('id_token_hint')).toBe('una-identidad');
    // Y vuelve a la raiz de la aplicacion, no a la del sitio: es `rentas`#71 por el otro extremo.
    expect(fin.searchParams.get('post_logout_redirect_uri')).toBe(RAIZ_DE_LA_APLICACION);
  });
});
