import { expect, type Page } from '@playwright/test';

/**
 * **Como se monta la aplicacion en el arnes, sin plataforma y sin backend** (#61).
 *
 * <h2>Por que no se levanta la instalacion</h2>
 *
 * Porque este arnes mide **que la interfaz se vea**, y para eso no hace falta un backend: hace
 * falta un navegador. Levantar PostgreSQL, Keycloak, Traefik y las aplicaciones para comprobar
 * que una cabecera es azul seria pagar diez minutos por una medicion que no depende de ninguno.
 *
 * El arnes que SI necesita la instalacion —entrar por el formulario de Keycloak, con PKCE y
 * canje— es otro, y es #69. Queda declarado.
 *
 * <h2>Y aqui hay MENOS que interceptar que en `rentas`, porque no hay de que</h2>
 *
 * `rentas` contesta `/seguridad/modulos`, `/seguridad/accesos` y `/seguridad/sesion/permisos` con
 * respuestas medidas de su instalacion (`seguridadMedida.ts`). **Esta interfaz no pide nada**:
 * `src/datos/proveedor.tsx` no monta ni un `QueryClient` —no hay una sola lectura hasta #63— y el
 * catalogo del carril es `src/catalogo.ts`, un dato de este repositorio. Asi que lo que hay que
 * contestar es exactamente cero, y lo que se deja preparado es el 404 de abajo: el dia que #63
 * encienda la primera lectura, una peticion sin contestar tiene que verse **como el error que
 * es**, y no inventada.
 */

/**
 * Como se pasa la puerta sin hacer identidad.
 *
 * **El token no se puede sembrar**: vive EN MEMORIA a proposito —es una credencial, y la
 * prohibicion `token-en-almacenamiento` lo vigila—, asi que no hay clave de `sessionStorage` que
 * poner. Y sin token, `arrancar()` manda a Keycloak y no monta nada, que es lo correcto.
 *
 * Lo que si hay es **un camino declarado por el que el arranque monta sin token**: el tope de
 * idas. `topeDeIdas` es 3 en `@kamayuk/sesion` —la misma cifra que la V6 media,
 * `c01fe9a:src/api/identidad.test.ts:307-317`— y existe porque un canje que falla siempre —un
 * `redirect_uri` mal declarado— convertiria el arranque en un rebote infinito. Con el tope
 * agotado la aplicacion monta y deja que la pantalla se explique.
 *
 * Usarlo aqui no es un truco: es **exactamente el estado que este arnes quiere medir** — la
 * interfaz montada sin identidad, que es lo que hay que poder mirar para comprobar que se ve.
 *
 * La clave lleva el prefijo del sistema —`kamayuk.normativa`, el de `src/sesion.ts`— porque las
 * cuatro interfaces se sirven del mismo origen y comparten `sessionStorage`. Sembrar la de
 * `rentas` aqui no haria nada, en silencio.
 */
const IDAS = 'kamayuk.normativa.pkce.idas';
const TOPE_DE_IDAS = 3;

export async function conLaPuertaAgotada(pagina: Page): Promise<void> {
  await pagina.addInitScript(
    ([clave, tope]: readonly [string, string]) => {
      window.sessionStorage.setItem(clave, tope);
    },
    [IDAS, String(TOPE_DE_IDAS)] as const,
  );

  // Ver el javadoc: hoy no hay ni una lectura, y lo que llegue no se inventa.
  await pagina.route('**/normativa/api/v1/**', (ruta) =>
    ruta.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  );
}

/**
 * Abre un destino por su hash y espera a que el armazon exista.
 *
 * El hash es `#/<slug>` y no `#/<clave>`: el `Armazon` enruta con `createHashRouter` y escribe la
 * direccion de una hoja con `ubicacionDe(slug)` (ver `src/sesion.ts`). Los slugs de este sistema
 * son la clave sin el prefijo del modulo —`nor-panel` -> `panel`—, y quien los deriva es
 * `src/catalogo.ts`.
 */
export async function abrir(pagina: Page, slug: string): Promise<void> {
  await pagina.goto(`./#/${slug}`);
  await pagina.locator('[data-slot="barra-global"]').first().waitFor({ timeout: 15_000 });
}

/**
 * El emisor por omision de `src/configuracion.ts`, que es el que el bundle lleva sin `ConfigMap`.
 *
 * Se escribe aqui y no se lee de `src/`: el arnes mide **el paquete construido**, y leer del
 * fuente la misma constante contra la que se compara seria comparar un archivo consigo mismo. Que
 * el fuente y esto sigan diciendo lo mismo lo delata `la-puerta.spec.ts` en cuanto se separen.
 */
export const REALM_POR_OMISION = 'http://localhost:8181/realms/kamayuk';

/** Lo que la sonda de `@kamayuk/sesion` pide para saber si el emisor esta. */
export const DESCUBRIMIENTO = '**/realms/*/.well-known/openid-configuration';

/** Y la puerta de verdad, a la que se manda el navegador entero. */
export const AUTORIZACION = '**/realms/*/protocol/openid-connect/auth*';

/** El canje del codigo por el token. */
export const CANJE = '**/realms/*/protocol/openid-connect/token';

/**
 * Los errores de consola que la pagina produjo, recogidos desde antes de cargar nada.
 *
 * Se devuelve la lista viva y no una copia: quien la mira la mira al final, cuando ya esta llena.
 */
export function erroresDeConsola(pagina: Page): string[] {
  const errores: string[] = [];
  pagina.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  pagina.on('pageerror', (error) => errores.push(error.message));
  return errores;
}

/**
 * Que la consola quedo limpia.
 *
 * Las peticiones que este arnes no contesta salen como peticion fallida y no como error de
 * consola; lo que no puede haber es un error de la aplicacion.
 */
export function laConsolaQuedoLimpia(errores: readonly string[], donde: string): void {
  const propios = errores.filter(
    (error) => !error.includes('404') && !error.includes('Failed to load resource'),
  );
  expect(propios, `«${donde}» dejo errores en la consola`).toEqual([]);
}
