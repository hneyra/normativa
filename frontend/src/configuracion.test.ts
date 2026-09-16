import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { SENAS_POR_OMISION, configuracion, procedencia } from './configuracion.ts';

const AQUI = dirname(fileURLToPath(import.meta.url));

/**
 * **La cadena de las senias del ambiente: servida -> horneada -> por omision** (#57, AC 2).
 *
 * Calcada de `rentas/frontend/src/api/configuracion.test.ts@ac379ac`, con lo que la V6 de este
 * sistema tenia escrito en `c01fe9a:frontend/src/api/configuracion.ts`.
 *
 * <h2>Lo que esto mide y no se puede medir mirando el codigo</h2>
 *
 * Que la lectura ocurre **en tiempo de ejecucion**. Si `configuracion()` resolviera en una
 * constante de modulo, el valor quedaria congelado en el orden de carga de los modulos: quien la
 * importara antes de que `/configuracion.js` hubiera corrido se llevaria la omision, y en el
 * cluster eso es entrar por el emisor de `localhost` sin un solo error. Aqui se nota porque el
 * mismo modulo, ya importado, cambia de respuesta cuando cambia el global.
 */

afterEach(() => {
  delete window.__KAMAYUK_NORMATIVA__;
});

describe('el tercer escalon: la instalacion local', () => {
  it('sin nada servido ni horneado, las tres senias son las de `yarn dev`', () => {
    expect(configuracion('oidcRealm')).toBe('http://localhost:8181/realms/kamayuk');
    expect(configuracion('oidcCliente')).toBe('kamayuk-backoffice');
    expect(configuracion('oidcAlcance')).toBe('openid profile');
    expect(procedencia('oidcRealm')).toBe('omision');
  });

  it('y lo que se afirma arriba sale de la constante, no de una copia de sus valores', () => {
    // Sin esto, cambiar `SENAS_POR_OMISION` y las tres lineas de arriba a la vez seguiria en verde,
    // que es como una prueba deja de medir lo que dice medir.
    expect(configuracion('oidcRealm')).toBe(SENAS_POR_OMISION.oidcRealm);
    expect(configuracion('oidcCliente')).toBe(SENAS_POR_OMISION.oidcCliente);
    expect(configuracion('oidcAlcance')).toBe(SENAS_POR_OMISION.oidcAlcance);
  });
});

describe('el primer escalon: lo que sirve el contenedor manda', () => {
  it('lo servido gana a la omision', () => {
    window.__KAMAYUK_NORMATIVA__ = { oidcRealm: 'https://identidad.ejemplo.gob.pe/realms/kamayuk' };

    expect(configuracion('oidcRealm')).toBe('https://identidad.ejemplo.gob.pe/realms/kamayuk');
    expect(procedencia('oidcRealm')).toBe('servida');
  });

  it('y se lee EN EJECUCION: el mismo modulo, ya importado, cambia de respuesta', () => {
    expect(configuracion('oidcCliente')).toBe('kamayuk-backoffice');

    window.__KAMAYUK_NORMATIVA__ = { oidcCliente: 'otro-cliente' };

    expect(configuracion('oidcCliente')).toBe('otro-cliente');
  });

  it('una senia servida no arrastra a las otras dos', () => {
    window.__KAMAYUK_NORMATIVA__ = { oidcRealm: 'https://identidad.ejemplo.gob.pe/realms/kamayuk' };

    expect(configuracion('oidcAlcance')).toBe('openid profile');
    expect(procedencia('oidcAlcance')).toBe('omision');
  });
});

describe('una cadena en blanco es una llave sin rellenar, no un valor', () => {
  it.each(['', '   ', '\n\t'])('«%s» cuenta como ausente y cae al escalon de abajo', (blanco) => {
    window.__KAMAYUK_NORMATIVA__ = { oidcRealm: blanco };

    // Heredar una URL vacia daria un rebote a `"/protocol/openid-connect/auth"` —una ruta de la
    // propia interfaz— que `nginx` contesta con el `index.html` y un 200: el «200 que miente».
    expect(configuracion('oidcRealm')).toBe('http://localhost:8181/realms/kamayuk');
    expect(procedencia('oidcRealm')).toBe('omision');
  });

  it('y lo que si tiene algo se recorta: un valor con espacios alrededor no es otro valor', () => {
    window.__KAMAYUK_NORMATIVA__ = { oidcCliente: '  kamayuk-backoffice  ' };

    expect(configuracion('oidcCliente')).toBe('kamayuk-backoffice');
  });
});

/**
 * **El segundo escalon se mide sobre el TEXTO, y aqui se dice por que.**
 *
 * `DE_LA_CONSTRUCCION` se evalua **al cargar el modulo**, que es lo que hace Vite al sustituir cada
 * `import.meta.env.VITE_*` por su literal. Asi que un `vi.stubEnv` despues del `import` no lo
 * cambia: una prueba que pusiera la variable y esperara verla salir estaria midiendo el escalon de
 * abajo y diciendo que mide el de en medio.
 *
 * Lo que si se puede afirmar, y es lo que de verdad se rompe en silencio, es **como estan escritas
 * las tres lecturas**.
 */
describe('el segundo escalon: lo que Vite horneo', () => {
  it('las tres lecturas de `import.meta.env` estan escritas LITERALES, una por linea', () => {
    // Vite sustituye `import.meta.env.VITE_ALGO` reconociendolo en el TEXTO. Con un indice
    // calculado —`import.meta.env[clave]`— no sustituiria nada, las tres saldrian `undefined` en el
    // paquete, y no lo notaria nadie: la cadena tiene un escalon mas debajo.
    // Sin comentarios: el docblock de `DE_LA_CONSTRUCCION` **nombra** la forma prohibida
    // —`import.meta.env[clave]`— para explicar por que no se usa. Sobre el texto crudo, la
    // explicacion seria el rojo, y la salida seria borrar la explicacion.
    const fuente = readFileSync(join(AQUI, 'configuracion.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ');

    for (const variable of [
      'VITE_KAMAYUK_OIDC_REALM',
      'VITE_KAMAYUK_OIDC_CLIENTE',
      'VITE_KAMAYUK_OIDC_ALCANCE',
    ]) {
      expect(fuente, `falta la lectura literal de ${variable}`).toContain(
        `import.meta.env.${variable}`,
      );
    }
    expect(
      fuente,
      'hay una lectura de `import.meta.env` con indice calculado: Vite no la sustituye',
    ).not.toMatch(/import\.meta\.env\[/);
  });
});
