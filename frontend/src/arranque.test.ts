import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  desinstalarProxyDeDatos();
  vi.unstubAllEnvs();
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
