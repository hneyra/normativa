/**
 * El unico sitio del frontend donde se llama a `fetch`.
 *
 * No es una preferencia de estilo: es lo que sostiene todo lo que vendra encima. El token
 * (ADR-0030 §3), el `ETag` del snapshot —que en este sistema no es un detalle de cache
 * sino la huella con la que un consumidor decide si lo que tiene sigue siendo el conjunto
 * sellado que pidio (ADR-0025)— y el formato de error del backend —`problem+json`— se
 * enchufan en un sitio o en veinte. Un `fetch` suelto en una pantalla no se salta una
 * convencion: se salta las tres, y sobrevive a la integracion como un caso aparte que
 * nadie recuerda. Por eso la excepcion de la regla es este directorio y solo este, y la
 * prueba comprueba que es exactamente uno.
 *
 * <h2>Lo que #13 anade a lo que F-1 dejo</h2>
 *
 * <ul>
 *   <li><b>El catalogo de errores tipado.</b> La interfaz reacciona al `codigo` —que es
 *       estable— y no al texto en castellano, que se reescribe en cuanto alguien lo lee en voz
 *       alta. Y el codigo que llega por el cable **no se cuela en la union**: si no es de la
 *       lista, se deduce del estado.</li>
 *   <li><b>La verificacion de la huella del snapshot</b> (AC10). Se recalcula el `sha256` del
 *       cuerpo con `crypto.subtle.digest` y se compara con el `ETag`.</li>
 * </ul>
 *
 * <h2>Y lo que sigue sin estar: el token</h2>
 *
 * `solicitar()` no manda `Authorization`, y eso **no es un olvido sino el motivo de que
 * `datos/servidas.ts` este vacio**: esta interfaz no consigue un token porque no hay cliente
 * OIDC de `normativa-web` en ninguno de los dos realms —`realm-sgtm.json` declara
 * `kamayuk-backoffice` y `kamayuk-verificacion`; `realm-sgtm-ciudadano.json`, `kamayuk-portal` y
 * `kamayuk-verificacion`—, y eso es de `infrastructure`. Cuando lo haya, el token vive **en
 * memoria**: nunca en `localStorage` ni en `sessionStorage`, porque en una PC de ventanilla
 * compartida entre turnos un token persistido sobrevive al cierre del navegador. Lo vigila la
 * prohibicion `token-en-almacenamiento` de `eslint.prohibiciones.mjs`.
 */

/**
 * Todo lo de este sistema cuelga de `normativa/` (ADR-0030 §2): la ruta dice quien
 * responde. Es el mismo prefijo que `vite.config.ts` declara como `base`, y por el mismo
 * motivo: bajo el `stripPrefix` de Traefik, el primer segmento es lo unico que enruta.
 *
 * Tiene que coincidir con `Api.RAIZ` del backend y con la `RAIZ` del proxy; que coincidan lo
 * comprueba `proxy.test.ts`.
 */
export const PREFIJO = '/normativa/api/v1';

/**
 * El catalogo de errores del backend, tal como lo declara su `CodigoDeError`.
 *
 * Es una **lista en tiempo de ejecucion**, y el tipo se deriva de ella y no al reves. El motivo
 * no es de estilo: lo que llega por el cable es una cadena cualquiera —el `codigo` lo escribe el
 * servidor— y sin una lista a la que preguntar, la unica manera de meterla en la union seria un
 * `as`. Eso compila, y a partir de ahi **el tipo miente**: la union afirma que solo puede valer
 * una de estas cosas, por ahi entra cualquier cadena, ningun `switch` tiene su rama y `tsc` no
 * dice nada.
 *
 * Son los **once de `CodigoDeError.java`, en su orden**. `formas.test.ts` los compara contra el
 * enumerado leyendo el fuente, asi que uno nuevo en el backend sale rojo aqui.
 */
export const CODIGOS_DEL_BACKEND = [
  'NO_AUTENTICADO',
  'SIN_MUNICIPALIDAD',
  'SIN_DOCUMENTO',
  'SIN_PRIVILEGIO',
  'VALIDACION',
  'ORDEN_NO_ADMITIDO',
  'MARCO_CON_DEMASIADOS_LOTES',
  'NO_ENCONTRADO',
  'METODO_NO_ADMITIDO',
  'CONFLICTO',
  'ERROR_INTERNO',
] as const;

/**
 * Los dos que **no** puede emitir ningun servidor, y por eso no estan en el enumerado.
 *
 * <ul>
 *   <li>`SIN_RESPUESTA` nombra que **no hubo ninguna respuesta que clasificar** —red caida,
 *       servidor apagado, o un `200` con HTML donde la pantalla espera JSON—. Se distingue de
 *       `ERROR_INTERNO` porque ese si llego y trae incidencia con la que preguntar.</li>
 *   <li>`HUELLA_QUE_NO_CUADRA` nombra que el snapshot llego y **el `sha256` de sus bytes no es
 *       el del `ETag`**. Es un codigo propio y no `SIN_RESPUESTA` porque las dos se arreglan de
 *       maneras opuestas: una se reintenta, y esta **no se reintenta sin mirar por donde pasa la
 *       respuesta** — un intermediario que recomprime, un proxy que reescribe, o el conjunto
 *       cambiado bajo un `Cache-Control: immutable` de un ano.</li>
 * </ul>
 */
export const CODIGOS_DE_ESTA_INTERFAZ = ['SIN_RESPUESTA', 'HUELLA_QUE_NO_CUADRA'] as const;

export const CODIGOS_DE_ERROR = [...CODIGOS_DEL_BACKEND, ...CODIGOS_DE_ESTA_INTERFAZ] as const;

export type CodigoDeError = (typeof CODIGOS_DE_ERROR)[number];

/**
 * El miembro `parametroQueFalta` de un cuerpo `problem+json`.
 *
 * `ejercicio` va siempre; `llave` **solo cuando el backend sabe cual es** —`TIPO:CLAVE` si falta
 * una fila, el `TIPO` solo si falta el bloque entero— y desaparece del cuerpo cuando lo que
 * falta es el conjunto sellado del ano. No llega como `null`: no llega.
 */
export interface ParametroQueFalta {
  readonly ejercicio: number;
  readonly llave?: string;
}

/**
 * Lo que el backend contesta cuando algo va mal, en `problem+json` (RFC 9457).
 *
 * El cuerpo trae `status`, `title`, `codigo` y `mensaje` siempre, y `detalles`,
 * `parametroQueFalta` e `incidencia` solo cuando el problema los trae. **Lo unico que esta
 * siempre es `codigo`**, y es a lo que se reacciona: los 401 y 403 que emiten los filtros salen
 * de `RespuestaDeError`, que escribe el JSON a mano con cuatro campos y **sin `type` ni
 * `detail`**, porque ocurren antes del `DispatcherServlet` y no pasan por el
 * `@RestControllerAdvice`.
 */
export class ErrorDeLaApi extends Error {
  readonly codigo: CodigoDeError;
  readonly estado: number;
  /** Solo en los 500. Es lo que se le da a quien atiende para preguntar. */
  readonly incidencia: string | undefined;
  /**
   * Las cifras del rechazo, como dato y no dentro de la frase.
   *
   * `ManejadorDeErrores` no escribe el campo cuando la lista esta vacia, asi que su ausencia es
   * «este rechazo no publica cifras», nunca un cero.
   */
  readonly detalles: readonly string[] | undefined;
  /**
   * Lo que hay que publicar, cuando lo que falta es una cifra normativa.
   *
   * Es el discriminador de dos cosas que salen con el mismo `codigo` y el mismo `estado`:
   * «falta un campo de la peticion» lo arregla quien atiende, en la misma pantalla; «el
   * ejercicio no tiene un conjunto sellado» **no lo arregla nadie desde la pantalla**.
   */
  readonly parametroQueFalta: ParametroQueFalta | undefined;

  constructor(
    codigo: CodigoDeError,
    mensaje: string,
    estado: number,
    extras: {
      readonly incidencia?: string;
      readonly detalles?: readonly string[];
      readonly parametroQueFalta?: ParametroQueFalta;
    } = {},
  ) {
    super(mensaje);
    this.name = 'ErrorDeLaApi';
    this.codigo = codigo;
    this.estado = estado;
    this.incidencia = extras.incidencia;
    this.detalles = extras.detalles;
    this.parametroQueFalta = extras.parametroQueFalta;
  }

  /** Si lo que falta es una cifra normativa y no un dato de la peticion. */
  get faltaUnaCifraNormativa(): boolean {
    return this.parametroQueFalta !== undefined;
  }

  /**
   * Si tiene sentido volver a intentarlo tal cual, sin cambiar nada.
   *
   * «Reintentar» solo se ofrece donde reintentar puede cambiar algo. Un privilegio que falta
   * sale igual las veces que se pulse; un verbo que la ruta no admite no puede funcionar nunca;
   * y una huella que no cuadra volveria a no cuadrar, porque el conjunto es inmutable.
   */
  get reintentable(): boolean {
    return this.codigo === 'SIN_RESPUESTA' || this.codigo === 'ERROR_INTERNO';
  }
}

export interface OpcionesDeSolicitud {
  readonly metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly cuerpo?: unknown;
  readonly senal?: AbortSignal;
}

/** El snapshot con la huella que se comprobo, para guardarla con la fila de la cache. */
export interface SnapshotVerificado<T> {
  readonly recurso: T;
  /** El `sha256` de los bytes servidos, en minusculas y sin comillas. */
  readonly huella: string;
  /**
   * **Los bytes que se verificaron**, tal como llegaron y sin volver a serializar.
   *
   * Se devuelven porque quien ofrezca guardar el snapshot tiene que guardar **lo mismo que se
   * comprobo** (#15 AC9). Volver a escribir el objeto con `JSON.stringify` produce un texto que
   * *casi siempre* coincide y que **nadie ha comprobado**: bastan un escape distinto o un cero
   * de mas para que el archivo guardado tenga otro `sha256` que el `ETag` que lo acompana, y
   * entonces el consumidor que lo relea concluira que su copia esta corrupta. Aqui no hay
   * segunda serializacion: se guarda la cadena cuyo `sha256` es `huella`.
   */
  readonly cuerpo: string;
  /**
   * El `Cache-Control` que la respuesta trajo, o `null` si no trajo ninguno.
   *
   * No es una constante escrita a mano: es lo que **esta** respuesta dijo. La diferencia
   * importa, porque lo que autoriza a guardar el snapshot un ano —y a no volver a pedirlo
   * nunca— es esa cabecera y no una linea de documentacion, y un intermediario que la reescriba
   * cambia esa autorizacion sin que el cuerpo cambie.
   */
  readonly cacheControl: string | null;
}

/** Las cabeceras de una peticion, con `Content-Type` solo cuando hay cuerpo que tipar. */
function cabecerasDe(opciones: OpcionesDeSolicitud): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(opciones.cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
  };
}

/** La peticion, tal como sale al transporte. Un solo sitio, para que las dos salgan igual. */
function peticionDe(opciones: OpcionesDeSolicitud): RequestInit {
  return {
    method: opciones.metodo ?? 'GET',
    headers: cabecerasDe(opciones),
    ...(opciones.cuerpo === undefined ? {} : { body: JSON.stringify(opciones.cuerpo) }),
    ...(opciones.senal === undefined ? {} : { signal: opciones.senal }),
  };
}

/** Lanza la peticion y traduce la caida de red; una cancelacion se propaga tal cual. */
async function lanzar(ruta: string, opciones: OpcionesDeSolicitud): Promise<Response> {
  try {
    return await fetch(`${PREFIJO}${ruta}`, peticionDe(opciones));
  } catch (fallo) {
    // Una cancelacion no es un fallo: se propaga para que quien la pidio la distinga y no
    // dibuje un error por haber cambiado de pantalla.
    if (fallo instanceof DOMException && fallo.name === 'AbortError') throw fallo;
    throw new ErrorDeLaApi('SIN_RESPUESTA', 'No se pudo contactar con el servidor', 0);
  }
}

/**
 * Pide `ruta` al backend de normativa y devuelve su cuerpo ya interpretado.
 *
 * @param ruta relativa al prefijo del sistema, empezando por `/`
 */
export async function solicitar<T>(ruta: string, opciones: OpcionesDeSolicitud = {}): Promise<T> {
  const respuesta = await lanzar(ruta, opciones);
  const texto = await respuesta.text();
  const datos: unknown = texto === '' ? null : intentarLeer(texto);

  if (!respuesta.ok) throw errorDe(respuesta.status, datos);

  // Un 200 cuyo cuerpo no es JSON no es una respuesta vacia: es OTRA COSA contestando. Pasa de
  // verdad en desarrollo, donde el servidor de Vite atiende `/normativa/api/v1/...` y devuelve
  // el `index.html` con un `200`. Sin esta guarda la pantalla se queda sin datos y sin error, y
  // se dibuja EN BLANCO: el peor de los tres desenlaces, porque no hay nada que leer ni nada
  // que reintentar.
  if (texto !== '' && datos === null) {
    throw new ErrorDeLaApi(
      'SIN_RESPUESTA',
      'El servidor contesto algo que no es la API. Revisa a donde apunta el reenvio de /normativa.',
      respuesta.status,
    );
  }
  return datos as T;
}

/**
 * Pide el snapshot y **comprueba que sus bytes son los que el `ETag` dice** (AC10, ADR-0025).
 *
 * La huella es el `sha256` **de los bytes que se sirven**, y no de una serializacion canonica
 * aparte: una canonica exigiria dos implementaciones que tienen que coincidir —una en el
 * servidor y otra en cada consumidor—, y dos algoritmos que deben dar lo mismo son dos que un
 * dia dejan de darlo. Con los bytes, el cliente hace `sha256(cuerpo)` y compara; no hay nada que
 * mantener sincronizado.
 *
 * **Y por eso se comprueba en vez de creersela.** La respuesta se cachea un ano con `immutable`,
 * asi que una copia corrupta no se vuelve a pedir nunca: el error hay que darlo aqui, diciendo
 * las dos huellas, o no se da.
 */
export async function solicitarSnapshot<T>(
  ruta: string,
  opciones: OpcionesDeSolicitud = {},
): Promise<SnapshotVerificado<T>> {
  const respuesta = await lanzar(ruta, opciones);
  const texto = await respuesta.text();
  const datos: unknown = texto === '' ? null : intentarLeer(texto);

  if (!respuesta.ok) throw errorDe(respuesta.status, datos);
  if (datos === null) {
    throw new ErrorDeLaApi(
      'SIN_RESPUESTA',
      'El servidor contesto algo que no es la API. Revisa a donde apunta el reenvio de /normativa.',
      respuesta.status,
    );
  }

  const anunciada = huellaAnunciada(respuesta);
  if (anunciada === null) {
    throw new ErrorDeLaApi(
      'HUELLA_QUE_NO_CUADRA',
      `La respuesta de «${ruta}» no trae ETag, y el snapshot se cachea un año: sin huella no hay ` +
        'nada que comparar cuando se relea, así que no se acepta.',
      respuesta.status,
    );
  }

  const calculada = await sha256(texto);
  if (calculada !== anunciada) {
    throw new ErrorDeLaApi(
      'HUELLA_QUE_NO_CUADRA',
      `El snapshot de «${ruta}» no cuadra con su ETag: el servidor anunció ${anunciada} y sus ` +
        `bytes dan ${calculada}. No se usa: se cachea un año con «immutable», así que una copia ` +
        'corrupta no se volvería a pedir nunca.',
      respuesta.status,
    );
  }

  return {
    recurso: datos as T,
    huella: calculada,
    cuerpo: texto,
    cacheControl: respuesta.headers.get('Cache-Control'),
  };
}

/**
 * El `sha256` del cuerpo, en hexadecimal minusculo.
 *
 * Sobre los **bytes en UTF-8**, que es lo que el servidor firma:
 * `sha.digest(cuerpo.getBytes(StandardCharsets.UTF_8))`. Comparar sobre las unidades de codigo
 * de JavaScript daria otra huella en cuanto el cuerpo llevara una tilde — y este cuerpo lleva
 * «Resolución Ministerial» en cada fila.
 */
export async function sha256(cuerpo: string): Promise<string> {
  const bytes = new TextEncoder().encode(cuerpo);
  const resumen = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * El `ETag` de la respuesta, sin comillas y en minusculas.
 *
 * Un `ETag` debil —`W/"..."`— **no vale**: dice «equivalente», y aqui la pregunta es si son los
 * mismos bytes. Se descarta nombrandolo en vez de quitarle la `W/` y comparar igual.
 */
function huellaAnunciada(respuesta: Response): string | null {
  const cabecera = respuesta.headers.get('ETag');
  if (cabecera === null || cabecera.startsWith('W/')) return null;
  const encontrado = /^"?([0-9a-fA-F]{64})"?$/.exec(cabecera.trim());
  return encontrado === null ? null : encontrado[1]!.toLowerCase();
}

function intentarLeer(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

/**
 * Traduce la respuesta de error a un `ErrorDeLaApi`.
 *
 * **No se confia ni en `type` ni en `detail`**: los 401 y 403 de los filtros no los traen. Si el
 * cuerpo no trae `codigo` —una pagina de error de nginx, un 502 de un reenvio— se deduce del
 * estado. Lo que no se hace nunca es ensenar el cuerpo crudo: puede traer una traza.
 */
function errorDe(estado: number, datos: unknown): ErrorDeLaApi {
  const cuerpo = (datos ?? {}) as Record<string, unknown>;
  const codigo = esCodigoConocido(cuerpo.codigo) ? cuerpo.codigo : porEstado(estado);
  const mensaje =
    typeof cuerpo.mensaje === 'string'
      ? cuerpo.mensaje
      : typeof cuerpo.title === 'string'
        ? cuerpo.title
        : 'No se pudo completar la operacion';
  return new ErrorDeLaApi(codigo, mensaje, estado, {
    ...(typeof cuerpo.incidencia === 'string' ? { incidencia: cuerpo.incidencia } : {}),
    ...(Array.isArray(cuerpo.detalles) ? { detalles: cuerpo.detalles as readonly string[] } : {}),
    ...leerParametroQueFalta(cuerpo.parametroQueFalta),
  });
}

/**
 * El miembro `parametroQueFalta`, leido como el OBJETO que el backend emite.
 *
 * Un miembro que no sea un objeto con `ejercicio` numerico se descarta entero: inventarle un
 * ejercicio seria peor que no tenerlo.
 */
function leerParametroQueFalta(valor: unknown): { parametroQueFalta?: ParametroQueFalta } {
  if (valor === null || typeof valor !== 'object') return {};
  const miembro = valor as Record<string, unknown>;
  if (typeof miembro.ejercicio !== 'number') return {};
  return {
    parametroQueFalta:
      typeof miembro.llave === 'string'
        ? { ejercicio: miembro.ejercicio, llave: miembro.llave }
        : { ejercicio: miembro.ejercicio },
  };
}

/**
 * Si el `codigo` del cuerpo es uno de los que esta interfaz conoce.
 *
 * Un codigo que no conozca **no se cuela en la union**: se deduce del estado. Dejarlo pasar es
 * peor de lo que parece, porque el desenlace no se distingue de uno correcto — no casaria con
 * ninguna rama, el aviso saldria con el titulo por omision, y `reintentable` diria que no aunque
 * el estado fuese un 500.
 */
function esCodigoConocido(valor: unknown): valor is CodigoDeError {
  return typeof valor === 'string' && (CODIGOS_DE_ERROR as readonly string[]).includes(valor);
}

function porEstado(estado: number): CodigoDeError {
  if (estado === 401) return 'NO_AUTENTICADO';
  if (estado === 403) return 'SIN_PRIVILEGIO';
  if (estado === 404) return 'NO_ENCONTRADO';
  if (estado === 405) return 'METODO_NO_ADMITIDO';
  if (estado === 409) return 'CONFLICTO';
  if (estado === 422) return 'VALIDACION';
  return 'ERROR_INTERNO';
}
