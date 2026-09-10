/**
 * El proxy de datos: la API de `normativa`, simulada en el navegador.
 *
 * <h2>Por que intercepta el TRANSPORTE y no la aplicacion</h2>
 *
 * Las pantallas necesitan datos y esta interfaz todavia no consigue un token —ver
 * `datos/servidas.ts`, donde estan los tres motivos medidos—. La salida facil habria sido que
 * cada pantalla leyera los suyos de una constante importada; la trampa de esa salida es que el
 * dia que el backend conteste habria que reescribir cada pantalla para que pida por HTTP — y
 * hasta ese dia, ninguna habria ejercido una sola vez el camino que va a usar en produccion.
 *
 * Este proxy lo evita interceptando **en la frontera del transporte**: sustituye
 * `globalThis.fetch`. **No es un adaptador que la aplicacion elija.** La aplicacion llama a
 * `solicitar()` de `src/api/cliente.ts` con la ruta real del contrato —`GET
 * /normativa/api/v1/conjuntos?ejercicio=2026`— y recibe un `Response` con su JSON, sus
 * cabeceras y su codigo de estado de verdad. Todo el camino se ejerce: la URL se compone, los
 * parametros de consulta viajan, el `ETag` sale en su cabecera y el error se convierte en
 * `ErrorDeLaApi` con su codigo del catalogo. **La aplicacion no sabe quien contesta, y esa
 * ignorancia es el objetivo.**
 *
 * <h2>Como se apaga</h2>
 *
 * No llamando a `instalarProxyDeDatos()`, que es lo que pasa por omision: `arranque.ts` solo lo
 * importa cuando `VITE_KAMAYUK_PROXY_DE_DATOS` vale `'true'`, y con la bandera apagada el
 * `import()` dinamico se cae del bundle entero — datos capturados incluidos. Un `yarn build` de
 * produccion no lleva ni una cifra del corpus dentro.
 *
 * <h2>Y se apaga tambien operacion por operacion</h2>
 *
 * `datos/servidas.ts` lista las rutas que el backend ya sirve, y esas el proxy las deja pasar al
 * `fetch` de verdad. Hoy la lista esta vacia y ahi se explica por que; el mecanismo existe
 * porque la integracion va a ser ruta a ruta y un mecanismo escrito el dia que hace falta se
 * escribe mal ese dia.
 *
 * <h2>Lo que deliberadamente NO simula</h2>
 *
 * No filtra, no ordena, no pagina y no persiste. Un proxy que fingiera la semantica de
 * `?ambito=OBLIGACION` estaria inventando un reparto que el cliente acabaria dando por bueno, y
 * ademas con **otra huella**: en este sistema fingir el filtro no es un matiz de contenido, es
 * un `sha256` distinto del que el servidor firmaria. Aqui la peticion se hace de verdad y la
 * respuesta es siempre el juego de datos del prototipo. Lo mismo con las escrituras: no guardan
 * nada, y dos `POST` iguales contestan lo mismo la primera vez y la decima.
 *
 * <h2>Lo que si reproduce, que no es lo mismo que validar</h2>
 *
 * Tres bordes del transporte que el backend **ya tiene puestos y medidos**, y que sin
 * reproducirlos el frontend aprenderia a saltarse:
 *
 * <ol>
 *   <li><b>El parametro de consulta que la operacion no declara → 422</b>
 *       (`GuardiaDeParametros`). El defecto que esa guarda cerro es de los caros: un filtro mal
 *       escrito que el servidor ignora en silencio devuelve el listado entero con `200`.</li>
 *   <li><b>El parametro obligatorio que falta → 422</b>
 *       (`ManejadorDeErrores.peticionQueNoSePuedeLeer`). Es el gemelo del anterior por el otro
 *       lado: `?ambito=` no tiene valor por omision, y una pantalla que se acostumbre a no
 *       mandarlo funciona aqui y falla contra el backend.</li>
 *   <li><b>Las negativas de las tres escrituras simuladas</b>, con el texto exacto de
 *       `AdministrarParametros` y de `Observacion`. Ver `datos/simulados.ts`.</li>
 * </ol>
 *
 * Ninguno de los tres mira un VALOR de negocio ni inventa una regla del servidor: los tres
 * copian una respuesta que el backend ya da.
 */

import { OPERACIONES, admitidosDe, type Operacion } from '../datos/operaciones.ts';
import { compilar, YA_SERVIDAS, laSirveElBackend, type OperacionServida } from '../datos/servidas.ts';
import { sha256 } from './cliente.ts';

/**
 * Raiz de todas las operaciones de este sistema.
 *
 * Es `/normativa/api/v1` y no `/api/v1`: ADR-0030 §2 pone el sistema delante de la ruta porque
 * el primer segmento enruta sin mirar mas, y el mismo Traefik sirve las cuatro interfaces. Tiene
 * que coincidir con `Api.RAIZ` del backend y con el `PREFIJO` de `cliente.ts`; que coincida lo
 * comprueba `proxy.test.ts`.
 */
export const RAIZ = '/normativa/api/v1';

/** Latencia simulada, para que los estados de carga se vean en desarrollo. */
const LATENCIA_MINIMA_MS = 120;
const LATENCIA_MAXIMA_MS = 320;

/**
 * Los titulos del catalogo, tal como los declara `CodigoDeError.java`.
 *
 * Son el `title` de RFC 9457, y van aqui porque el proxy compone el cuerpo entero: si publicara
 * otro texto, una pantalla podria acabar reaccionando a un titulo que el backend no manda. Solo
 * estan los que este proxy emite; `formas.test.ts` los compara contra el enumerado leyendo el
 * fuente, asi que un cambio de redaccion en Java sale rojo aqui.
 */
export const TITULO_DEL_CODIGO: Readonly<Record<string, string>> = {
  VALIDACION: 'La peticion no cumple una regla de validacion',
  NO_ENCONTRADO: 'No se encontro lo solicitado',
  METODO_NO_ADMITIDO: 'El verbo HTTP no se admite en esta ruta',
  CONFLICTO: 'El estado actual no admite esta operacion',
  ERROR_INTERNO: 'No se pudo completar la operacion',
};

interface RutaDeLaTabla {
  readonly metodo: string;
  readonly patron: RegExp;
  readonly nombres: readonly string[];
  readonly operacion: Operacion;
}

const TABLA: readonly RutaDeLaTabla[] = OPERACIONES.map((operacion) => {
  const { patron, nombres } = compilar(operacion.ruta);
  return { metodo: operacion.metodo, patron, nombres, operacion };
});

/** La fila que atiende esa peticion, o `null`. */
function filaDe(metodo: string, rutaRelativa: string): RutaDeLaTabla | null {
  const buscado = metodo.toUpperCase();
  return TABLA.find((r) => r.metodo === buscado && r.patron.test(rutaRelativa)) ?? null;
}

/** Los verbos que esa ruta si admite. Vacio si la ruta no existe en ninguno. */
function verbosDe(rutaRelativa: string): readonly string[] {
  return TABLA.filter((r) => r.patron.test(rutaRelativa)).map((r) => r.metodo);
}

/** Los `{parametros}` de la ruta, ya leidos: `/ediciones/2/sellar` → `{ id: '2' }`. */
function parametrosDeLaRuta(fila: RutaDeLaTabla, rutaRelativa: string): Record<string, string> {
  const encontrado = fila.patron.exec(rutaRelativa);
  const valores: Record<string, string> = {};
  if (encontrado === null) return valores;
  fila.nombres.forEach((nombre, i) => {
    const valor = encontrado[i + 1];
    if (valor !== undefined) valores[nombre] = decodeURIComponent(valor);
  });
  return valores;
}

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/**
 * Un cuerpo `application/problem+json` con la forma que publica el backend.
 *
 * Los seis miembros son los de `ManejadorDeErrores.cuerpoDe`: los cuatro de RFC 9457 —`type`,
 * `title`, `status`, `detail`— mas las dos extensiones del contrato, `codigo` y `mensaje`. La
 * interfaz reacciona al **codigo**, que es estable, y no al texto en castellano, que se
 * reescribe en cuanto alguien lo lee en voz alta: si el proxy publicara otra forma, cada
 * pantalla aprenderia a leer un error que el backend no manda.
 *
 * `detalles` sale **solo cuando lo hay**, igual que en el backend: ponerlo siempre —vacio— seria
 * tan inutil como no ponerlo nunca, porque su presencia deja de significar algo.
 */
function problema(
  codigo: string,
  estado: number,
  detalle: string,
  detalles: readonly string[] = [],
): Response {
  return new Response(
    JSON.stringify({
      type: `https://kamayuk.gob.pe/errores/${codigo.toLowerCase()}`,
      title: TITULO_DEL_CODIGO[codigo] ?? codigo,
      status: estado,
      detail: detalle,
      codigo,
      mensaje: detalle,
      ...(detalles.length === 0 ? {} : { detalles }),
    }),
    { status: estado, headers: { 'content-type': 'application/problem+json' } },
  );
}

/** La ruta no la atiende ningun controlador: 404, como `ManejadorDeErrores.rutaNoEncontrada`. */
function noEncontrada(metodo: string, rutaRelativa: string): Response {
  return problema(
    'NO_ENCONTRADO',
    404,
    `El proxy de datos no simula «${metodo} ${rutaRelativa}». Simula ${String(OPERACIONES.length)} ` +
      'operaciones: las cuatro que este sistema publica de verdad y las tres escrituras que ' +
      'ADR-0025 §5 anticipa. Si necesitas otra, se anade en src/datos/operaciones.ts con la ' +
      'forma de su record de Java.',
  );
}

/**
 * La ruta existe y el verbo no: 405 con su cabecera `Allow`.
 *
 * Es un codigo propio y no un 404 porque las dos respuestas se arreglan de maneras distintas
 * —«esa operacion no esta publicada» y «esta publicada, y la pides con el verbo equivocado»—, y
 * el backend ya las distingue (`CodigoDeError.METODO_NO_ADMITIDO`). Un proxy que las juntara
 * ensenaria a la interfaz un contrato de errores mas pobre que el de verdad. Y la cabecera
 * `Allow` no es un adorno: es lo que un 405 tiene que decir por contrato HTTP, y es la mitad de
 * la respuesta que un cliente puede leer sin leer prosa.
 */
function verboNoAdmitido(metodo: string, verbos: readonly string[]): Response {
  const admitidos = [...verbos].sort().join(', ');
  const respuesta = problema(
    'METODO_NO_ADMITIDO',
    405,
    `El verbo '${metodo}' no se admite en esta ruta. Admitidos: ${admitidos}`,
  );
  const cabeceras = new Headers(respuesta.headers);
  cabeceras.set('allow', admitidos);
  return new Response(respuesta.body, { status: 405, headers: cabeceras });
}

/**
 * Un parametro de consulta que la operacion no sabe leer: 422 nombrandolo.
 *
 * El texto es el de `GuardiaDeParametros.preHandle`, con su singular y su plural y sus nombres
 * entre comillas y en orden alfabetico: quien integre contra el proxy tiene que leer lo mismo
 * que leera contra el backend.
 */
function parametroDesconocido(
  desconocidos: readonly string[],
  admitidos: readonly string[],
): Response {
  const entreComillas = [...desconocidos]
    .sort()
    .map((n) => `'${n}'`)
    .join(', ');
  return problema(
    'VALIDACION',
    422,
    (desconocidos.length === 1 ? 'Parametro desconocido: ' : 'Parametros desconocidos: ') +
      entreComillas,
    [`Se admiten: ${[...admitidos].sort().join(', ')}`],
  );
}

/** Un parametro que la operacion exige y no llego: 422, como `ManejadorDeErrores.motivoDe`. */
function parametroQueFalta(nombre: string): Response {
  return problema('VALIDACION', 422, `Falta el parametro obligatorio '${nombre}'`);
}

/** La ruta esta declarada como servida y el backend dice que no la conoce. */
function declaradaYNoServida(metodo: string, rutaRelativa: string, estado: number): Response {
  return problema(
    'ERROR_INTERNO',
    502,
    `«${metodo} ${rutaRelativa}» esta en la lista de operaciones que el backend ya sirve, y el ` +
      `backend respondio ${String(estado)}. Quita la ruta de src/datos/servidas.ts o implementa ` +
      'la operacion: caer al proxy en silencio esconderia justo el desajuste que se quiere ver.',
  );
}

/** El `fetch` que habia antes de instalar. Se devuelve tal cual al desinstalar. */
let original: typeof fetch | null = null;

export interface OpcionesDelProxy {
  /**
   * Latencia simulada. Encendida en desarrollo, para que los estados de carga se vean; apagada
   * por omision, porque en las pruebas medio segundo por peticion no prueba nada.
   */
  readonly latencia?: boolean;
  /**
   * Las que ya sirve el backend. Por omision, las de `servidas.ts`, que hoy son ninguna.
   *
   * Se puede pasar otra lista, y es lo que hace `proxy.test.ts`: probar el mecanismo —que la
   * lista deja pasar, que un desajuste suena— sin depender de que la lista real tenga algo.
   */
  readonly yaServidas?: readonly OperacionServida[];
}

/** El cuerpo de la peticion, leido sin consumir el original. Vacio si no lo hay. */
async function cuerpoDeLaPeticion(
  entrada: RequestInfo | URL,
  opciones?: RequestInit,
): Promise<Record<string, unknown>> {
  let texto: string | null = null;
  if (typeof opciones?.body === 'string') {
    texto = opciones.body;
  } else if (entrada instanceof Request) {
    texto = await entrada.clone().text();
  }
  if (texto === null || texto === '') return {};
  try {
    const leido: unknown = JSON.parse(texto);
    return leido !== null && typeof leido === 'object' ? (leido as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Sustituye `globalThis.fetch` por el proxy. Devuelve la funcion que lo desinstala.
 *
 * Solo intercepta lo que cuelga de `/normativa/api/v1`; cualquier otra peticion —una fuente
 * tipografica, una imagen, el propio `index.html`— sigue su camino sin tocarse. Y lo que cuelga
 * de `/rentas/api/v1`, `/catastro/api/v1` o `/caja/api/v1` tampoco es suyo: son otros sistemas y
 * otros repositorios, y fingir sus respuestas seria inventar contratos ajenos.
 */
export function instalarProxyDeDatos({
  latencia = false,
  yaServidas = YA_SERVIDAS,
}: OpcionesDelProxy = {}): () => void {
  if (original !== null) return desinstalarProxyDeDatos;
  original = globalThis.fetch;
  // Para delegar hace falta ligarlo; para restaurar, no: devolver el envoltorio ligado en vez
  // de la funcion original dejaria una capa pegada en cada ciclo de instalar y desinstalar.
  const anterior = original.bind(globalThis);

  globalThis.fetch = async (
    entrada: RequestInfo | URL,
    opciones?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(
      typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url,
      globalThis.location?.origin ?? 'http://localhost',
    );
    if (!url.pathname.startsWith(RAIZ)) return anterior(entrada, opciones);

    const metodo = (
      opciones?.method ??
      (entrada instanceof Request ? entrada.method : 'GET')
    ).toUpperCase();
    const rutaRelativa = url.pathname.slice(RAIZ.length);

    // Lo que el backend ya sirve, sale de verdad. Si contesta que no la conoce, se dice en voz
    // alta: caer al proxy en silencio esconderia justo lo que se quiere ver —que la ruta de la
    // lista y la del backend no cuadran—.
    if (laSirveElBackend(yaServidas, metodo, rutaRelativa)) {
      const respuesta = await anterior(entrada, opciones);
      return respuesta.status === 404 || respuesta.status === 501
        ? declaradaYNoServida(metodo, rutaRelativa, respuesta.status)
        : respuesta;
    }

    if (latencia) {
      await esperar(LATENCIA_MINIMA_MS + Math.random() * (LATENCIA_MAXIMA_MS - LATENCIA_MINIMA_MS));
    }

    const fila = filaDe(metodo, rutaRelativa);
    if (fila === null) {
      const verbos = verbosDe(rutaRelativa);
      return verbos.length === 0
        ? noEncontrada(metodo, rutaRelativa)
        : verboNoAdmitido(metodo, verbos);
    }

    // El borde del transporte, en el orden en que lo aplica el backend: el guardia de
    // parametros es un `preHandle`, o sea que corre con el handler YA resuelto.
    const rechazo = deLaConsulta(fila.operacion, url.searchParams);
    if (rechazo !== null) return rechazo;

    // La negativa solo la tienen las tres escrituras simuladas, y solo ve dos datos: el `{id}`
    // de la ruta y la observacion del cuerpo. Ver `datos/simulados.ts`.
    if (fila.operacion.negativa !== undefined) {
      const cuerpo = await cuerpoDeLaPeticion(entrada, opciones);
      const ruta = parametrosDeLaRuta(fila, rutaRelativa);
      const negativa = fila.operacion.negativa({
        conjuntoId: ruta.id === undefined ? null : Number(ruta.id),
        observacion: typeof cuerpo.observacion === 'string' ? cuerpo.observacion : null,
      });
      if (negativa !== null) {
        return problema(negativa.codigo, negativa.estado, negativa.mensaje);
      }
    }

    // Ni la cadena de consulta ni el cuerpo llegan al constructor: no se le pasan. Una
    // escritura responde 201 con la forma que el backend publicaria, y no guarda nada.
    const cuerpo = JSON.stringify(fila.operacion.cuerpo());
    const cabeceras = new Headers({ 'content-type': 'application/json' });
    if (fila.operacion.huella === true) {
      // La huella es de los bytes que se sirven, como en `SnapshotController`. No se copia del
      // artboard —sus ETag son de ejemplo—: se calcula, que es lo unico que el cliente puede
      // comprobar. Y con ella, `Cache-Control: immutable`: lo sellado no cambia.
      cabeceras.set('etag', `"${await sha256(cuerpo)}"`);
      cabeceras.set('cache-control', 'public, max-age=31536000, immutable');
    }
    return new Response(cuerpo, {
      status: metodo === 'GET' ? 200 : 201,
      headers: cabeceras,
    });
  };

  return desinstalarProxyDeDatos;
}

/**
 * Lo que la operacion no sabe leer de la consulta, o lo que exige y no llego.
 *
 * Devuelve la respuesta de rechazo, o `null` si la consulta esta bien. Los cuatro nombres de la
 * paginacion se admiten siempre, tambien en la operacion que no pagina.
 */
function deLaConsulta(operacion: Operacion, consulta: URLSearchParams): Response | null {
  const admitidos = admitidosDe(operacion);
  const llegaron = [...new Set(consulta.keys())];
  const desconocidos = llegaron.filter((n) => !admitidos.includes(n));
  if (desconocidos.length > 0) return parametroDesconocido(desconocidos, admitidos);

  const falta = operacion.obligatorios.find((n) => !consulta.has(n));
  return falta === undefined ? null : parametroQueFalta(falta);
}

export function desinstalarProxyDeDatos(): void {
  if (original === null) return;
  globalThis.fetch = original;
  original = null;
}

export function proxyDeDatosInstalado(): boolean {
  return original !== null;
}

