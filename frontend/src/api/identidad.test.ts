import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canjearSiVuelve,
  entrar,
  fijarToken,
  hayPuerta,
  olvidarLaParada,
  puedeIrALaPuerta,
  salir,
  token,
  ultimoFalloDeLaPuerta,
  vieneDeSalir,
} from './identidad.ts';

/**
 * La puerta de identidad: **PKCE S256, y el token en memoria**.
 *
 * <h2>Lo que estas pruebas miran de verdad</h2>
 *
 * No que el parametro `code_challenge_method` diga `S256` —eso es una cadena, y una cadena se
 * puede escribir bien con el calculo mal—, sino que el reto **sea** el SHA-256 del verificador
 * que se guardo: la prueba lo recalcula por su cuenta y compara. Un reto que no cuadre lo
 * rechaza Keycloak en el canje, o sea que el sintoma llegaria en el rebote y no aqui.
 *
 * Y no que el codigo «no use localStorage» —eso lo mira ESLint por el nombre de la clave—, sino
 * que **despues del canje ningun almacenamiento del navegador contenga el token**, mire donde
 * mire y se llame como se llame la clave. Es la mitad que la prohibicion no puede ver:
 * `localStorage.setItem('kamayuk.preferencia', elToken)` pasa la prohibicion entera, porque la
 * prohibicion mira la clave.
 */

const REALM = 'http://localhost:8181/realms/kamayuk';

/** Sustituye `location`, que en jsdom no se puede espiar de otra manera. */
function ubicacion(href = 'http://localhost:5173/') {
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

/** `BASE64URL(SHA256(verificador))`, calculado aqui y no leido del codigo que se prueba. */
async function retoEsperado(verificador: string): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  let texto = '';
  new Uint8Array(resumen).forEach((b) => (texto += String.fromCharCode(b)));
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  fijarToken(null);
  olvidarLaParada();
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
  fijarToken(null);
  olvidarLaParada();
});

describe('la ida a la puerta es codigo de autorizacion con PKCE S256', () => {
  it('manda al realm kamayuk, al cliente kamayuk-backoffice, con code y S256', async () => {
    const asignar = ubicacion();

    await entrar();

    const destino = new URL(String(asignar.mock.calls[0]?.[0]));
    expect(destino.origin + destino.pathname).toBe(`${REALM}/protocol/openid-connect/auth`);
    expect(destino.searchParams.get('response_type')).toBe('code');
    // Se REUSA el cliente de `rentas` en vez de declarar uno propio: mismo realm, mismos
    // usuarios, y la autorizacion la hace cada backend contra su copia local. El porque entero
    // esta en la cabecera de `identidad.ts`.
    expect(destino.searchParams.get('client_id')).toBe('kamayuk-backoffice');
    expect(destino.searchParams.get('code_challenge_method')).toBe('S256');
  });

  /**
   * **La leccion ya pagada de [`rentas`#71](https://github.com/hneyra/rentas/issues/71).**
   *
   * La URI de retorno es la raiz DE LA APLICACION —`/normativa/`, la misma `base` de la que
   * salen los activos— y no la del SITIO. Alli esto devolvia `origin + '/'`, quien se
   * autenticaba volvia a `https://<dominio>/` y recibia un 404 con el `code` correcto: la
   * autenticacion funcionaba y el retorno no.
   *
   * Y esta linea solo puede afirmar algo porque `vitest.config.ts` declara la misma `base` que
   * `vite.config.ts`. Sin eso, `BASE_URL` valdria `/` en pruebas, esto diria
   * `http://localhost:5173/` y seria coherente consigo mismo — que es exactamente como aquel
   * defecto llego a produccion, con su prueba en verde.
   */
  it('y el redirect_uri es la raiz de la APLICACION —/normativa/—, no la del sitio', async () => {
    const asignar = ubicacion();

    await entrar();

    const destino = new URL(String(asignar.mock.calls[0]?.[0]));
    expect(destino.searchParams.get('redirect_uri')).toBe('http://localhost:5173/normativa/');
  });

  it('el redirect_uri sale de BASE_URL y no de una cadena escrita', () => {
    // La otra mitad de la leccion: que el valor de arriba no este escrito a mano. Si lo
    // estuviera, cambiar `base` en `vite.config.ts` dejaria el retorno apuntando al sitio
    // viejo y esta suite seguiria verde.
    expect(import.meta.env.BASE_URL).toBe('/normativa/');
  });

  it('y el reto ES el SHA-256 del verificador guardado, no una cadena que lo diga', async () => {
    const asignar = ubicacion();

    await entrar();

    const verificador = sessionStorage.getItem('kamayuk.pkce.verificador');
    expect(verificador).not.toBeNull();
    const destino = new URL(String(asignar.mock.calls[0]?.[0]));
    expect(destino.searchParams.get('code_challenge')).toBe(await retoEsperado(verificador ?? ''));
  });

  it('dos idas dan dos verificadores distintos: no hay secreto fijo', async () => {
    ubicacion();
    await entrar();
    const primero = sessionStorage.getItem('kamayuk.pkce.verificador');
    await entrar();

    expect(sessionStorage.getItem('kamayuk.pkce.verificador')).not.toBe(primero);
  });

  it('el verificador se guarda con una clave que NO nombra ninguna credencial', () => {
    // Tiene que sobrevivir al rebote, asi que va en `sessionStorage` — y por eso su clave no
    // lleva «token», «acceso» ni «sesion»: llamarlo `normativa.token.verificador` obligaria a
    // quien lea esto dentro de seis meses a distinguir dos cosas que se llaman igual.
    const vigiladas = /token|jwt|bearer|credencial|contrasena|acceso|sesion/i;
    expect(vigiladas.test('kamayuk.pkce.verificador')).toBe(false);
  });

  it('hay puerta: jsdom expone crypto.subtle, que es lo que S256 necesita', () => {
    expect(hayPuerta()).toBe(true);
  });
});

describe('el canje deja el token EN MEMORIA y en ningun almacenamiento', () => {
  const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbmlzdHJhZG9yIn0.firma';
  const IDENTIDAD = 'eyJhbGciOiJSUzI1NiJ9.eyJpZCI6MX0.firma';

  /** Deja el navegador como si acabara de volver de Keycloak con un codigo bueno. */
  function vueltaBuena() {
    sessionStorage.setItem('kamayuk.pkce.verificador', 'el-verificador');
    sessionStorage.setItem('kamayuk.pkce.estado', 'el-estado');
    ubicacion('http://localhost:5173/normativa/?code=un-codigo&state=el-estado');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          Response.json({ access_token: TOKEN, id_token: IDENTIDAD, refresh_token: 'refresco' }),
        ),
      ),
    );
  }

  it('canjea y el token queda disponible', async () => {
    vueltaBuena();

    await expect(canjearSiVuelve()).resolves.toEqual({ estado: 'canjeado' });
    expect(token()).toBe(TOKEN);
    expect(ultimoFalloDeLaPuerta()).toBeNull();
  });

  it('manda al canje el verificador, el cliente y el grant que toca', async () => {
    vueltaBuena();

    await canjearSiVuelve();

    const espia = vi.mocked(globalThis.fetch);
    expect(String(espia.mock.calls[0]?.[0])).toBe(`${REALM}/protocol/openid-connect/token`);
    const enviado = new URLSearchParams(String(espia.mock.calls[0]?.[1]?.body));
    expect(enviado.get('grant_type')).toBe('authorization_code');
    expect(enviado.get('client_id')).toBe('kamayuk-backoffice');
    expect(enviado.get('code_verifier')).toBe('el-verificador');
    // El `redirect_uri` del canje tiene que ser EL MISMO de la ida, o Keycloak rechaza el
    // canje con un `invalid_grant` que no dice cual de los dos esta mal.
    expect(enviado.get('redirect_uri')).toBe('http://localhost:5173/normativa/');
    // Sin secreto: el cliente es publico, y un secreto dentro de un bundle no es un secreto.
    expect(enviado.get('client_secret')).toBeNull();
  });

  it('NADA de lo que se canjeo acaba en localStorage ni en sessionStorage', async () => {
    vueltaBuena();

    await canjearSiVuelve();

    // Se recorre el contenido y no las claves: la prohibicion de ESLint mira el NOMBRE de la
    // clave, asi que `localStorage.setItem('kamayuk.preferencia', elToken)` la pasaria entera.
    // Esta es la mitad que la prohibicion no puede ver.
    const guardado = [localStorage, sessionStorage].flatMap((donde) =>
      Object.keys(donde).map((clave) => donde.getItem(clave) ?? ''),
    );
    expect(guardado.some((valor) => valor.includes(TOKEN))).toBe(false);
    expect(guardado.some((valor) => valor.includes(IDENTIDAD))).toBe(false);
    expect(guardado.some((valor) => valor.includes('refresco'))).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('el verificador y el estado se borran: un codigo no se canjea dos veces', async () => {
    vueltaBuena();

    await canjearSiVuelve();

    expect(sessionStorage.getItem('kamayuk.pkce.verificador')).toBeNull();
    expect(sessionStorage.getItem('kamayuk.pkce.estado')).toBeNull();
  });

  it('si el estado no cuadra con la ida, no canjea nada', async () => {
    sessionStorage.setItem('kamayuk.pkce.verificador', 'el-verificador');
    sessionStorage.setItem('kamayuk.pkce.estado', 'el-estado');
    ubicacion('http://localhost:5173/normativa/?code=un-codigo&state=OTRO');
    const espia = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', espia);

    const vuelta = await canjearSiVuelve();

    // El estado es lo unico que distingue nuestra vuelta de un codigo que alguien nos hizo
    // llegar. Sin comprobarlo, la puerta acepta cualquier codigo.
    expect(vuelta).toMatchObject({ estado: 'fallo', motivo: 'La vuelta no cuadra con la ida' });
    expect(espia).not.toHaveBeenCalled();
    expect(token()).toBeNull();
  });

  it('un ?error= del emisor se explica con su motivo, y no se vuelve a la puerta', async () => {
    ubicacion('http://localhost:5173/normativa/?error=access_denied&error_description=lo+cancelo');

    const vuelta = await canjearSiVuelve();

    expect(vuelta).toMatchObject({
      estado: 'fallo',
      motivo: 'No se completo la entrada',
      detalle: 'lo cancelo',
    });
  });

  it('sin code y sin error no ha pasado nada: «sin-vuelta»', async () => {
    ubicacion('http://localhost:5173/normativa/#panel');

    await expect(canjearSiVuelve()).resolves.toEqual({ estado: 'sin-vuelta' });
  });

  it('si el emisor no contesta, lo dice en vez de dejar la pagina en blanco', async () => {
    sessionStorage.setItem('kamayuk.pkce.verificador', 'v');
    sessionStorage.setItem('kamayuk.pkce.estado', 'e');
    ubicacion('http://localhost:5173/normativa/?code=c&state=e');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('sin red'))),
    );

    await expect(canjearSiVuelve()).resolves.toMatchObject({
      estado: 'fallo',
      motivo: 'El emisor no contesto',
    });
  });
});

/**
 * **Lo que este archivo tiene y el de `rentas` no**, y es lo que hace falta aqui.
 *
 * Alli el casco pide `GET /seguridad/sesion` al montar y un canje fallido acaba saliendo como un
 * 401 que `Puerta` explica. Esta interfaz no tiene ninguna lectura obligatoria al arrancar, asi
 * que un canje fallido se quedaria mudo: el arranque volveria a la puerta, el emisor devolveria
 * el mismo error, y a la tercera vuelta el tope pararia **sin una palabra de la causa**.
 */
describe('el motivo del fallo sobrevive al canje, para que la pantalla pueda decirlo', () => {
  it('un ?error= del emisor queda anotado, con lo que el emisor dijo', async () => {
    ubicacion(
      'http://localhost:5173/normativa/?error=invalid_client&error_description=Invalid+parameter%3A+redirect_uri',
    );

    await canjearSiVuelve();

    expect(ultimoFalloDeLaPuerta()).toEqual({
      motivo: 'El emisor no reconoce a este cliente',
      detalle: 'Invalid parameter: redirect_uri',
    });
  });

  it('y «olvidarLaParada» lo borra: el boton de la puerta empieza de cero', async () => {
    ubicacion('http://localhost:5173/normativa/?error=server_error');
    await canjearSiVuelve();
    expect(ultimoFalloDeLaPuerta()).not.toBeNull();

    olvidarLaParada();

    expect(ultimoFalloDeLaPuerta()).toBeNull();
  });
});

describe('los dos frenos del rebote', () => {
  it('tres idas y para: un canje que falla siempre seria un bucle infinito', async () => {
    ubicacion();

    expect(puedeIrALaPuerta()).toBe(true);
    await entrar();
    await entrar();
    expect(puedeIrALaPuerta()).toBe(true);
    await entrar();

    expect(puedeIrALaPuerta()).toBe(false);
  });

  it('un canje bueno pone la cuenta a cero: el tope es para una racha, no para el dia', async () => {
    ubicacion();
    await entrar();
    await entrar();
    await entrar();
    expect(puedeIrALaPuerta()).toBe(false);

    sessionStorage.setItem('kamayuk.pkce.verificador', 'v');
    sessionStorage.setItem('kamayuk.pkce.estado', 'e');
    ubicacion('http://localhost:5173/normativa/?code=c&state=e');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ access_token: 'un-token' }))),
    );
    await canjearSiVuelve();

    expect(puedeIrALaPuerta()).toBe(true);
  });

  it('salir deja la marca que impide volver a entrar solo al instante', () => {
    const asignar = ubicacion();
    fijarToken('un-token', 'una-identidad');

    salir();

    expect(token()).toBeNull();
    expect(vieneDeSalir()).toBe(true);
    const destino = new URL(String(asignar.mock.calls[0]?.[0]));
    expect(destino.origin + destino.pathname).toBe(`${REALM}/protocol/openid-connect/logout`);
    // Sin `id_token_hint` el emisor no cierra SU sesion, y el siguiente arranque entraria solo
    // con la misma cuenta sin que nadie teclee nada.
    expect(destino.searchParams.get('id_token_hint')).toBe('una-identidad');
    // Y vuelve a la raiz de la aplicacion, no a la del sitio: es el mismo defecto de
    // `rentas`#71 por el otro extremo del rebote.
    expect(destino.searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:5173/normativa/',
    );
  });

  it('y «olvidarLaParada» levanta los dos frenos, que es el boton de la puerta', async () => {
    ubicacion();
    await entrar();
    await entrar();
    await entrar();
    expect(puedeIrALaPuerta()).toBe(false);

    olvidarLaParada();

    expect(puedeIrALaPuerta()).toBe(true);
    expect(vieneDeSalir()).toBe(false);
  });

  it('salir borra la cuenta de idas, y deja SOLO la marca de salida frenando', () => {
    ubicacion();
    sessionStorage.setItem('kamayuk.pkce.idas', '3');
    fijarToken('un-token');

    salir();

    // Salir no es una racha de fallos: es un gesto deliberado. Dejar el contador a tres haria
    // que la siguiente entrada del turno siguiente se encontrara la puerta cerrada por algo
    // que paso antes de cerrar sesion.
    expect(puedeIrALaPuerta()).toBe(true);
    expect(vieneDeSalir()).toBe(true);
  });
});
