import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fijarToken, olvidarLaParada } from './api/identidad.ts';
import { desinstalarProxyDeDatos, proxyDeDatosInstalado } from './api/proxy.ts';
import { arrancar } from './arranque.ts';

/**
 * Primero quien contesta, despues quien pregunta — y con la bandera apagada, nadie de los dos.
 *
 * Lo que **no** puede probar este archivo es AC9, y conviene decirlo aqui: que el `import()`
 * dinamico se caiga del bundle es una afirmacion sobre **Rollup**, no sobre este modulo, y solo
 * se mide construyendo. La medida —los dos tamanos y el `grep` sobre el bundle apagado— esta en
 * la fila del registro. Lo que si se prueba aqui es lo que Rollup necesita para poder plegarlo:
 * que la bandera se lea de `import.meta.env` y en ningun otro sitio.
 *
 * <h2>Desde #39 el arranque tiene un paso mas, y va ANTES de los otros dos</h2>
 *
 * El canje del `?code=`. Y con el, la decision de ir a la puerta en vez de montar: por eso las
 * pruebas del orden **fijan un token** antes de llamar. Sin el, `arrancar()` se va al emisor y no
 * monta nada, que es lo correcto y no es lo que esas pruebas miden. El grupo de abajo mide eso.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Sustituye `location`, que en jsdom no se puede espiar de otra manera. */
function ubicacion(href = 'http://localhost:5173/normativa/') {
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

beforeEach(() => {
  sessionStorage.clear();
  olvidarLaParada();
  // Con token: estas pruebas miden el ORDEN entre el proxy y el montaje, y sin token no hay
  // montaje que ordenar — el arranque se va al emisor. La ida a la puerta se mide abajo.
  fijarToken('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbmlzdHJhZG9yIn0.firma');
  ubicacion();
});

afterEach(() => {
  desinstalarProxyDeDatos();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  fijarToken(null);
  olvidarLaParada();
});

describe('el orden del arranque', () => {
  it('con la bandera encendida instala el proxy ANTES de montar', async () => {
    vi.stubEnv('VITE_KAMAYUK_PROXY_DE_DATOS', 'true');
    const orden: string[] = [];

    await arrancar(() => {
      // Si el montaje ocurriera primero, la primera peticion de la primera pantalla saldria al
      // `fetch` de verdad — y en desarrollo la atenderia Vite, devolviendo el index.html con un
      // 200: no un error, una pagina HTML donde la pantalla espera JSON.
      orden.push(proxyDeDatosInstalado() ? 'proxy, y despues montar' : 'montar sin proxy');
    });

    expect(orden).toEqual(['proxy, y despues montar']);
  });

  it('con la bandera apagada monta igual, y no instala nada', async () => {
    vi.stubEnv('VITE_KAMAYUK_PROXY_DE_DATOS', 'false');
    const montado = vi.fn();

    await arrancar(montado);

    expect(montado).toHaveBeenCalledTimes(1);
    expect(proxyDeDatosInstalado()).toBe(false);
  });

  it('y sin bandera tampoco: es opt-in, no opt-out', async () => {
    // Es lo que pasa en `yarn build`: `.env.development` solo se lee en modo desarrollo. Lo que
    // decide si un despliegue lleva datos inventados no puede ser que alguien se acuerde de
    // apagarlos — y aqui esos datos son cifras normativas (regla 5).
    vi.stubEnv('VITE_KAMAYUK_PROXY_DE_DATOS', undefined);
    const montado = vi.fn();

    await arrancar(montado);

    expect(montado).toHaveBeenCalledTimes(1);
    expect(proxyDeDatosInstalado()).toBe(false);
  });

  it('cualquier otro valor no la enciende: solo la cadena «true»', async () => {
    vi.stubEnv('VITE_KAMAYUK_PROXY_DE_DATOS', '1');

    await arrancar(() => undefined);

    expect(proxyDeDatosInstalado()).toBe(false);
  });
});

describe('lo que Rollup necesita para poder plegar la condicion (AC9)', () => {
  const fuente = readFileSync(join(AQUI, 'arranque.ts'), 'utf8');

  it('la bandera se lee de import.meta.env, y el proxy entra por import() dinamico', () => {
    expect(fuente).toContain("import.meta.env.VITE_KAMAYUK_PROXY_DE_DATOS === 'true'");
    expect(fuente).toContain("await import('./api/proxy.ts')");
  });

  it('y no hay ningun import estatico del proxy en todo el arranque', () => {
    // Un `import { instalarProxyDeDatos } from './api/proxy.ts'` arriba dejaria el trozo dentro
    // del bundle aunque la condicion se plegara: lo que se cae es lo que solo se alcanza por
    // el `import()`.
    expect(fuente).not.toMatch(/^import .*proxy\.ts';$/m);
  });

  it('main.tsx monta DENTRO de arrancar, no despues', () => {
    const main = readFileSync(join(AQUI, 'main.tsx'), 'utf8');
    expect(main).toContain('void arrancar(() => {');
    expect(main).toContain('createRoot(raiz).render(');
    // Y el orden en el archivo: `createRoot` esta dentro de la llamada, no en una linea
    // posterior. Si se sacara, esta prueba seguiria en verde — por eso la de arriba mira el
    // ORDEN de los efectos y esta solo la forma.
    expect(main.indexOf('void arrancar(')).toBeLessThan(main.indexOf('createRoot(raiz).render('));
  });

  it('y .env.development la enciende, que es lo unico que la enciende', () => {
    const env = readFileSync(join(AQUI, '../.env.development'), 'utf8');
    expect(env).toContain('VITE_KAMAYUK_PROXY_DE_DATOS=true');
  });
});


/**
 * La ida a la puerta, que es lo que #39 anade al arranque.
 *
 * Lo que se mide es la decision, no el rebote: **si monta o si se va**. Que la ida al emisor
 * lleve PKCE S256 y vuelva a `/normativa/` lo mide `api/identidad.test.ts`.
 */
describe('sin token, el arranque va a la puerta antes de dibujar nada', () => {
  beforeEach(() => {
    fijarToken(null);
  });

  it('no monta: se va al emisor', async () => {
    const asignar = ubicacion();
    const montado = vi.fn();

    await arrancar(montado);

    // Sin montar, y a proposito: `entrar()` navega fuera de la pagina, asi que dibujar algo
    // despues seria dibujar sobre un documento que el navegador esta a punto de tirar.
    expect(montado).not.toHaveBeenCalled();
    expect(String(asignar.mock.calls[0]?.[0])).toContain('/protocol/openid-connect/auth');
  });

  it('tampoco instala el proxy: no llega a leer la bandera', async () => {
    vi.stubEnv('VITE_KAMAYUK_PROXY_DE_DATOS', 'true');
    ubicacion();

    await arrancar(() => undefined);

    expect(proxyDeDatosInstalado()).toBe(false);
  });

  it('pero con el tope de idas gastado MONTA, para que la puerta pueda explicarse', async () => {
    // Es la diferencia entre una pantalla que dice por que se paro y una pagina en blanco
    // parpadeando con el motivo escrito solo en la consola.
    const asignar = ubicacion();
    sessionStorage.setItem('kamayuk.pkce.idas', '3');
    const montado = vi.fn();

    await arrancar(montado);

    expect(montado).toHaveBeenCalledTimes(1);
    expect(asignar).not.toHaveBeenCalled();
  });

  it('y despues de salir tampoco vuelve a entrar solo', async () => {
    // `post_logout_redirect_uri` trae de vuelta sin token. Sin esta marca, quien acaba de
    // cerrar sesion se encuentra DENTRO OTRA VEZ con la misma cuenta sin haber tecleado nada.
    const asignar = ubicacion();
    sessionStorage.setItem('kamayuk.pkce.salida', '1');
    const montado = vi.fn();

    await arrancar(montado);

    expect(montado).toHaveBeenCalledTimes(1);
    expect(asignar).not.toHaveBeenCalled();
  });

  it('el canje ocurre ANTES de decidir: una vuelta buena entra sin pasar por la puerta', async () => {
    sessionStorage.setItem('kamayuk.pkce.verificador', 'v');
    sessionStorage.setItem('kamayuk.pkce.estado', 'e');
    const asignar = ubicacion('http://localhost:5173/normativa/?code=c&state=e');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ access_token: 'un-token' }))),
    );
    const montado = vi.fn();

    await arrancar(montado);

    // Si el canje fuera despues, esto seria un rebote al emisor con el codigo bueno en la mano.
    expect(montado).toHaveBeenCalledTimes(1);
    expect(asignar).not.toHaveBeenCalled();
  });
});
