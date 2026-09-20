import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Hasta #63 `src/datos/proveedor.tsx` no montaba ni un `QueryClient` —no habia una sola lectura— y el
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

/** La lectura del LISTADO de conjuntos. Expresion y no globo: lleva consulta, y `?` es un comodin. */
export const LECTURA_DEL_LISTADO = /\/normativa\/api\/v1\/seguridad\/parametros\?/;

/** La lectura del ESTADO de un ejercicio. */
export const LECTURA_DEL_ESTADO = /\/normativa\/api\/v1\/seguridad\/parametros\/ejercicios\//;

/**
 * **El 200 del estado del ejercicio, con los campos que el CONTRATO publica y ninguno mas** (#63).
 *
 * `YA_SERVIDAS` esta vacia —nadie ha ejercido ninguna ruta de este backend con un token de esta
 * interfaz—, asi que no hay una captura de verdad que reproducir. Lo que si hay es la **forma
 * publicada**, que `FormasDeLaApiTest` genera del tipo de retorno del controlador, y este cuerpo se
 * comprueba **campo a campo** contra ella: uno de mas o de menos pone rojo el arnes en vez de
 * pasar en silencio. Es lo mas cerca de «capturado del backend» que se puede estar sin backend, y
 * se dice asi en vez de escribir un cuerpo a mano y llamarlo medido.
 *
 * `sellado: false` a proposito: es el caso que el AC 2 obliga a no confundir con un error. Llega
 * como **200** con los dos nulos dentro.
 */
export function elEstadoDelEjercicio(): Record<string, unknown> {
  const formas = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../docs/50-api/formas-de-la-api.json'), 'utf8'),
  ) as Record<string, unknown>;
  const forma = formas['GET /seguridad/parametros/ejercicios/{ejercicio}'];
  if (typeof forma !== 'object' || forma === null) {
    throw new Error(
      'El contrato no publica una forma para `GET /seguridad/parametros/ejercicios/{ejercicio}`. ' +
        'Sin ella, el cuerpo que este arnes dobla no lo comprueba nada.',
    );
  }
  const cuerpo = {
    ejercicio: new Date().getFullYear(),
    sellado: false,
    conjuntoId: null,
    version: null,
  };
  expect(
    Object.keys(cuerpo).sort(),
    'El cuerpo doblado dejo de cuadrar con la forma publicada de la operacion.',
  ).toEqual(Object.keys(forma).sort());
  return cuerpo;
}

/**
 * Deja contestada la lectura del ESTADO del ejercicio, con un 200 y sin sellar.
 *
 * Hace falta en toda prueba que mire el PRIMER bloque del Panel: desde #63 ese bloque declara
 * `lectura`, asi que sin respuesta su cuerpo —los cinco campos y la tabla— lo sustituye el estado
 * de la lectura, y lo que se mediria seria un aviso de fallo. Se registra DESPUES de
 * {@link conLaPuertaAgotada}: en Playwright gana la ruta declarada mas tarde.
 */
export async function conElEstadoDelEjercicio(pagina: Page): Promise<void> {
  await pagina.route(LECTURA_DEL_ESTADO, (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(elEstadoDelEjercicio()),
    }),
  );
}

/* ── Lo que Publicacion pide (#67) ─────────────────────────────────────────────────────────── */

/** La lectura que resuelve QUE conjunto rige. Lleva consulta, asi que es expresion y no globo. */
export const LECTURA_DEL_CONJUNTO = /\/normativa\/api\/v1\/conjuntos\?/;

/** Y la del snapshot, que es la que viene firmada con su `ETag`. */
export const LECTURA_DEL_SNAPSHOT = /\/normativa\/api\/v1\/conjuntos\/\d+\/snapshot\?/;

/** El `Cache-Control` que el controlador manda, y contra el que la hoja compara. */
export const CACHE_DEL_CONTRATO = 'public, max-age=31536000, immutable';

/** La identidad del conjunto que este arnes sirve. */
export const CONJUNTO_SERVIDO = { conjuntoId: 2, ejercicio: 2026, version: 3 };

/** La forma publicada de una operacion, o un rojo que nombra la que falta. */
function formaDe(operacion: string): Record<string, unknown> {
  const formas = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../docs/50-api/formas-de-la-api.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const forma = formas[operacion];
  if (typeof forma !== 'object' || forma === null) {
    throw new Error(
      `El contrato no publica una forma para «${operacion}». Sin ella, el cuerpo que este arnes ` +
        'dobla no lo comprueba nada.',
    );
  }
  return forma as Record<string, unknown>;
}

/** Un cuerpo doblado, comprobado CAMPO A CAMPO contra la forma que el contrato publica. */
function comoElContrato<T extends Record<string, unknown>>(operacion: string, cuerpo: T): T {
  expect(
    Object.keys(cuerpo).sort(),
    `El cuerpo doblado de «${operacion}» dejo de cuadrar con la forma publicada.`,
  ).toEqual(Object.keys(formaDe(operacion)).sort());
  return cuerpo;
}

/** El 200 de `GET /conjuntos`: la identidad, sin una sola fila. */
export function elConjuntoVigente(): Record<string, unknown> {
  return comoElContrato('GET /conjuntos', { ...CONJUNTO_SERVIDO });
}

/**
 * El 200 de `GET /conjuntos/{id}/snapshot`, **con tildes dentro**.
 *
 * «Resolución Ministerial» va en cada fila del derivado del corpus, y es donde la huella de los
 * bytes y la de las unidades de codigo de JavaScript divergen: sobre un cuerpo ASCII las dos formas
 * coinciden y este arnes pasaria con la implementacion equivocada.
 *
 * Las cifras son de juguete y no salen de ningun corpus: lo que se mide es la huella de unos bytes.
 */
export function elSnapshot(ambito: 'VALUACION' | 'OBLIGACION'): Record<string, unknown> {
  const laValuacion = ambito === 'VALUACION';
  const fuente = 'Resolución Ministerial';
  return comoElContrato('GET /conjuntos/{id}/snapshot', {
    ...CONJUNTO_SERVIDO,
    ambito,
    filas: 2,
    parametros: [{ tipo: 'UIT', clave: 'UIT:2026', documentoFuente: fuente }],
    valoresUnitarios: laValuacion ? [{ partida: 'MUROS', documentoFuente: fuente }] : [],
    depreciaciones: laValuacion ? [{ uso: 'CASA_HABITACION', documentoFuente: fuente }] : [],
    valoresReferenciales: laValuacion ? [] : [{ categoria: 'A1', documentoFuente: fuente }],
  });
}

/** El `sha256` de unos bytes en UTF-8, en hexadecimal minusculo: lo mismo que hace el backend. */
export function sha256(cuerpo: string): string {
  return createHash('sha256').update(cuerpo, 'utf8').digest('hex');
}

/**
 * **Los BYTES del snapshot, que no son los que `JSON.stringify` daria** (#67).
 *
 * Se sirven con sangrado a proposito, y no es estetica: lo que el servidor firma son SUS bytes, y
 * nada obliga a que coincidan con los que la interfaz produciria al volver a serializar el objeto
 * —`JSON.parse` y `JSON.stringify` no son inversas—. Con un cuerpo compacto las dos formas de
 * calcular la huella dan lo mismo y **este arnes pasaria con la implementacion equivocada**: la
 * que resume sobre `JSON.stringify(JSON.parse(texto))`. Con el sangrado, no.
 *
 * Es la misma clase de precaucion que la tilde de «Resolución Ministerial»: se elige el cuerpo que
 * hace visible la diferencia, en vez de uno que la esconde.
 */
export function cuerpoDelSnapshot(ambito: 'VALUACION' | 'OBLIGACION'): string {
  return JSON.stringify(elSnapshot(ambito), null, 2);
}

/** Como se sirve una descarga: su cuerpo, su `ETag` y su `Cache-Control`. */
export interface SnapshotServido {
  readonly cuerpo?: string;
  /** Ya con sus comillas, o `null` para no mandar la cabecera. Por omision, el de verdad. */
  readonly etag?: string | null;
  readonly cacheControl?: string | null;
}

/**
 * Deja contestadas las dos lecturas de Publicacion, y cuenta lo que se pidio.
 *
 * El conteo es la mitad del criterio de la descarga: lo que se guarda son **los bytes que ya se
 * verificaron**, asi que guardar no puede emitir una segunda peticion al snapshot.
 */
export async function conLoDePublicacion(
  pagina: Page,
  cambios: Partial<Record<'VALUACION' | 'OBLIGACION', SnapshotServido>> = {},
): Promise<{ readonly peticiones: string[] }> {
  const peticiones: string[] = [];
  await pagina.route(LECTURA_DEL_CONJUNTO, (ruta) => {
    peticiones.push(ruta.request().url());
    return ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(elConjuntoVigente()),
    });
  });
  await pagina.route(LECTURA_DEL_SNAPSHOT, (ruta) => {
    const url = ruta.request().url();
    peticiones.push(url);
    const ambito = url.includes('ambito=OBLIGACION') ? 'OBLIGACION' : 'VALUACION';
    const suyo = cambios[ambito] ?? {};
    const cuerpo = suyo.cuerpo ?? cuerpoDelSnapshot(ambito);
    const cabeceras: Record<string, string> = {};
    const etag = suyo.etag === undefined ? `"${sha256(cuerpo)}"` : suyo.etag;
    if (etag !== null) cabeceras['ETag'] = etag;
    const cache = suyo.cacheControl === undefined ? CACHE_DEL_CONTRATO : suyo.cacheControl;
    if (cache !== null) cabeceras['Cache-Control'] = cache;
    return ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cabeceras,
      body: cuerpo,
    });
  });
  return { peticiones };
}

/* ── Lo que Cuadros pide (#66) ─────────────────────────────────────────────────────────────── */

/**
 * **El ejercicio al que este arnes mueve el reloj del navegador.**
 *
 * `2031` y no el de hoy, y a proposito: una guarda del ejercicio que **no mueva el reloj** pasa
 * igual con un literal dentro, porque hoy el ano es el mismo. Mover el reloj es lo unico que la
 * hace poder fallar.
 *
 * El instante es **mediodia UTC**, no medianoche: `ejercicioDe` lee el ano en la zona del puesto
 * —el ejercicio tributario es una fecha civil de la municipalidad—, y a mediodia UTC el 1 de enero
 * sigue siendo 2031 en cualquier zona del planeta. A medianoche no: en Lima seria todavia el 31 de
 * diciembre de 2030, y este arnes saldria rojo o verde segun donde se corra.
 */
export const EJERCICIO_DEL_ARNES = 2031;
export const RELOJ_DEL_ARNES = '2031-01-01T12:00:00Z';

/** El documento fuente que traen las filas de cada cuadro. Es de prueba: no sale de ningun corpus. */
export const FUENTE_DE_LOS_UNITARIOS = 'Documento de prueba · valores unitarios';
export const FUENTE_DE_LA_DEPRECIACION = 'Documento de prueba · depreciación';
export const FUENTE_DEL_VEHICULAR = 'Documento de prueba · anexo vehicular';

/**
 * **Las filas que este arnes sirve, y por que son las que son.**
 *
 * Ninguna cifra sale del corpus: lo que se mide es **como se lee una fila**, no cuanto vale un
 * metro cuadrado. Lo que si esta elegido es la FORMA:
 *
 * · **dos tablas de depreciacion**, cada una con su tramo abierto, y **con topes distintos**. Con
 *   una sola, una implementacion que buscara el maximo del cuadro entero pasaria igual; con dos, la
 *   segunda tiene que decir el suyo y no el de la primera;
 * · **un `anioConstruccionHasta: null`**, que es «Sin tope»;
 * · **cifras con un decimal** —`11.5`—, para que se vea que se completan a dos y que lo que se
 *   pinta no es lo que llego tal cual;
 * · y **una cifra de siete digitos**, para que el separador de miles tenga algo que agrupar.
 */
export const UNITARIOS_SERVIDOS: readonly Record<string, unknown>[] = [
  {
    partida: 'MUROS',
    categoria: 'A',
    anioConstruccionDesde: 1990,
    anioConstruccionHasta: 1999,
    valorM2: '11.5',
    documentoFuente: FUENTE_DE_LOS_UNITARIOS,
  },
  {
    partida: 'TECHOS',
    categoria: 'B',
    anioConstruccionDesde: 2000,
    anioConstruccionHasta: null,
    valorM2: '2222333.4',
    documentoFuente: FUENTE_DE_LOS_UNITARIOS,
  },
];

export const DEPRECIACIONES_SERVIDAS: readonly Record<string, unknown>[] = [
  {
    uso: '01',
    material: 'Concreto',
    estadoConservacion: 'Muy Bueno',
    antiguedadHasta: 5,
    porcentaje: '0',
    documentoFuente: FUENTE_DE_LA_DEPRECIACION,
  },
  {
    uso: '01',
    material: 'Concreto',
    estadoConservacion: 'Muy Bueno',
    antiguedadHasta: 30,
    porcentaje: '12',
    documentoFuente: FUENTE_DE_LA_DEPRECIACION,
  },
  {
    uso: '01',
    material: 'Concreto',
    estadoConservacion: 'Muy Bueno',
    antiguedadHasta: null,
    porcentaje: '27',
    documentoFuente: FUENTE_DE_LA_DEPRECIACION,
  },
  {
    uso: '02',
    material: 'Ladrillo',
    estadoConservacion: 'Malo',
    antiguedadHasta: null,
    porcentaje: '60',
    documentoFuente: FUENTE_DE_LA_DEPRECIACION,
  },
];

/**
 * El anexo vehicular, **de la medida que se le pida**.
 *
 * `54 129` es lo que mide el de 2026 (`ElEjercicio2026SeSellaTest.java:246`), y es la cifra con la
 * que hay que medir la paginacion: con diez filas, una tabla sin paginar y una paginada se ven
 * igual.
 */
export function vehicularesServidos(cuantos: number): readonly Record<string, unknown>[] {
  return Array.from({ length: cuantos }, (_, i) => ({
    ejercicio: EJERCICIO_DEL_ARNES,
    categoria: i % 2 === 0 ? 'A1' : 'A2',
    marca: 'MARCA DE PRUEBA',
    modelo: i === 0 ? 'OTROS MODELOS' : `MODELO ${String(i)}`,
    anioFabricacion: 2030 - (i % 20),
    valor: `${String(1000 + i)}.5`,
    documentoFuente: FUENTE_DEL_VEHICULAR,
  }));
}

/** Lo que se le puede cambiar a lo que este arnes sirve. */
export interface CuadrosServidos {
  /** Cuantas filas trae el anexo vehicular. Por omision, dos. */
  readonly vehiculares?: number;
  /** Las celdas de valores unitarios que van en VALUACION. Por omision, las dos de arriba. */
  readonly unitarios?: readonly Record<string, unknown>[];
  /** Las de depreciacion. */
  readonly depreciaciones?: readonly Record<string, unknown>[];
}

/** El cuerpo de un snapshot para Cuadros, comprobado campo a campo contra la forma publicada. */
export function elSnapshotDeLosCuadros(
  ambito: 'VALUACION' | 'OBLIGACION',
  servido: CuadrosServidos = {},
): Record<string, unknown> {
  const laValuacion = ambito === 'VALUACION';
  const unitarios = laValuacion ? (servido.unitarios ?? UNITARIOS_SERVIDOS) : [];
  const depreciaciones = laValuacion ? (servido.depreciaciones ?? DEPRECIACIONES_SERVIDAS) : [];
  const vehiculares = laValuacion ? [] : vehicularesServidos(servido.vehiculares ?? 2);
  return comoElContrato('GET /conjuntos/{id}/snapshot', {
    ...CONJUNTO_SERVIDO,
    ejercicio: EJERCICIO_DEL_ARNES,
    ambito,
    filas: unitarios.length + depreciaciones.length + vehiculares.length,
    parametros: [],
    valoresUnitarios: unitarios,
    depreciaciones,
    valoresReferenciales: vehiculares,
  });
}

/**
 * Deja contestadas las dos lecturas de Cuadros, **con el reloj del navegador movido**, y cuenta lo
 * que se pidio.
 *
 * El reloj se instala antes de navegar: `EJERCICIO_DE_TRABAJO` se lee **una vez al cargar el
 * modulo**, asi que moverlo despues no cambiaria nada y esta guarda mediria el ano de hoy.
 */
export async function conLosCuadros(
  pagina: Page,
  servido: CuadrosServidos = {},
): Promise<{ readonly peticiones: string[]; readonly cuerpos: Record<string, string> }> {
  // `setFixedTime` y no `install()`: lo unico que hay que mover es lo que `new Date()` contesta.
  // `install()` ademas **para los temporizadores**, y con ellos parados el planificador de React y
  // los reintentos de TanStack se quedan esperando algo que nunca llega — un arnes colgado que no
  // habla del ejercicio.
  await pagina.clock.setFixedTime(RELOJ_DEL_ARNES);
  const peticiones: string[] = [];
  const cuerpos: Record<string, string> = {
    VALUACION: JSON.stringify(elSnapshotDeLosCuadros('VALUACION', servido)),
    OBLIGACION: JSON.stringify(elSnapshotDeLosCuadros('OBLIGACION', servido)),
  };

  await pagina.route(LECTURA_DEL_CONJUNTO, (ruta) => {
    peticiones.push(ruta.request().url());
    return ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...elConjuntoVigente(), ejercicio: EJERCICIO_DEL_ARNES }),
    });
  });
  await pagina.route(LECTURA_DEL_SNAPSHOT, (ruta) => {
    const url = ruta.request().url();
    peticiones.push(url);
    const ambito = url.includes('ambito=OBLIGACION') ? 'OBLIGACION' : 'VALUACION';
    return ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: cuerpos[ambito] ?? '{}',
    });
  });
  return { peticiones, cuerpos };
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
