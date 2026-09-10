/**
 * Las operaciones que el backend YA sirve en el entorno donde corre la aplicacion.
 *
 * <h2>Esta vacia, y no es un olvido</h2>
 *
 * La integracion no va a ser un salto. Con esta lista se enciende una ruta, se mira, y se
 * enciende la siguiente: el proxy deja pasar al `fetch` de verdad lo que este declarado aqui y
 * sigue contestando lo demas.
 *
 * <h2>Y aqui la lista vacia dice algo mas fuerte que en `rentas`</h2>
 *
 * **Las cuatro operaciones existen de verdad.** No son cuatro rutas del contrato pendientes de
 * implementar: estan publicadas, medidas sobre `src/main`, y son las cuatro que
 * `datos/operaciones.ts` declara con la forma de su `record`. Lo que falta no es el servidor:
 * es **la credencial**.
 *
 * <ol>
 *   <li><b>Las cuatro exigen token.</b> `SeguridadWeb.cadenaDeSeguridad` deja
 *       `authenticated()` todo lo que cuelga de la raiz de la API —las sondas y las metricas son
 *       lo unico con `permitAll()`, y lo demas `denyAll()`—, y `TenantContextFilter` exige
 *       ademas el claim `municipalidad_id`: sin el, **403 `SIN_MUNICIPALIDAD`** escrito por
 *       `RespuestaDeError` desde fuera del `DispatcherServlet`.</li>
 *   <li><b>Esta interfaz no consigue un token.</b> ADR-0030 §3 pone la sesion en `rentas`, y
 *       **no hay cliente OIDC de `normativa-web` en ninguno de los dos realms de Keycloak**.
 *       Comprobado en `infrastructure/despliegue/identidad/`: `realm-sgtm.json` declara
 *       `kamayuk-backoffice` y `kamayuk-verificacion`; `realm-sgtm-ciudadano.json` declara
 *       `kamayuk-portal` y `kamayuk-verificacion`. Ninguno mas. Cablearlo necesita un cliente publico
 *       con PKCE `S256`, y eso es de `infrastructure`.</li>
 *   <li><b>No hay a donde mandar la peticion.</b> `vite.config.ts` no declara `server.proxy`,
 *       asi que en desarrollo `/normativa/api/v1/...` lo atiende el propio servidor de Vite y
 *       devuelve el `index.html` de la aplicacion: un `200` con HTML donde la pantalla espera
 *       JSON, que es peor que un error porque no parece uno.</li>
 * </ol>
 *
 * Encender una ruta hoy no traeria datos: traeria un 401 o un HTML. Y el proxy, que solo
 * repliega ante 404 y 501, lo dejaria pasar tal cual a la pantalla.
 *
 * <h2>El orden para encender la primera, que es lo unico que hay que hacer</h2>
 *
 * <ol>
 *   <li><b>Token en `solicitar()`</b> (`src/api/cliente.ts`): una cabecera `Authorization` con
 *       el token en memoria — nunca en `localStorage` ni en `sessionStorage`.</li>
 *   <li><b>`server.proxy` de Vite</b> hacia el backend, para que `/normativa/api/v1` salga del
 *       servidor de desarrollo en vez de devolver el `index.html`.</li>
 *   <li><b>Mover la ruta a `servidas.ts`</b>: una entrada en `YA_SERVIDAS`, y nada mas.</li>
 * </ol>
 *
 * Y en ese orden: al reves, el paso 3 solo consigue que la pantalla ensene un 401 en vez de un
 * dato inventado, que no es progreso — es cambiar un sintoma por otro.
 *
 * <h2>El mecanismo si esta, y se prueba</h2>
 *
 * Que la lista este vacia es un DATO, no una funcion que falte: `laSirveElBackend()` existe, el
 * proxy la consulta en cada peticion y `proxy.test.ts` la ejerce pasandole su propia lista. Un
 * mecanismo que solo se escribiera el dia que hace falta se escribiria mal ese dia.
 */

/** Una operacion que el backend ya sirve. Se compara por verbo y por ruta, con sus `{...}`. */
export interface OperacionServida {
  readonly metodo: string;
  /** Ruta bajo la raiz del sistema, con sus parametros entre llaves. */
  readonly ruta: string;
}

/**
 * Ninguna, hoy. Los tres motivos, arriba.
 *
 * El tipo es `readonly OperacionServida[]` y no `never[]`: lo que cambia el dia que se encienda
 * la primera es esta linea, y nada mas.
 */
export const YA_SERVIDAS: readonly OperacionServida[] = [];

/** Una ruta del contrato compilada, con los nombres de sus `{parametros}` en orden. */
export interface RutaCompilada {
  readonly patron: RegExp;
  /** `['id']` para `/conjuntos/{id}/snapshot`. Vacio si la ruta no lleva parametros. */
  readonly nombres: readonly string[];
}

/**
 * `/conjuntos/{id}/snapshot` → `^/conjuntos/([^/]+)/snapshot$`, con `['id']`.
 *
 * Los `{parametros}` se compilan como grupos de captura y no como comodines a secas: la ruta es
 * lo unico de la peticion que el proxy tiene que poder leer —es lo que la ENCAMINA—, y de ahi
 * salen los `{id}` con los que las escrituras simuladas reproducen sus negativas. Una
 * implementacion sola, aqui, porque dos formas de compilar la misma ruta son dos que un dia
 * dejan de coincidir.
 */
export function compilar(ruta: string): RutaCompilada {
  const trozos = ruta.split(/(\{\w+\})/);
  const nombres = trozos
    .filter((trozo) => /^\{\w+\}$/.test(trozo))
    .map((trozo) => trozo.slice(1, -1));
  const escapado = trozos
    .map((trozo) =>
      /^\{\w+\}$/.test(trozo) ? '([^/]+)' : trozo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');
  return { patron: new RegExp(`^${escapado}$`), nombres };
}

/**
 * Si esa peticion la atiende el backend de verdad.
 *
 * @param servidas la lista que rige en este entorno; el proxy pasa `YA_SERVIDAS` salvo que se
 *   le diga otra cosa
 * @param metodo verbo HTTP, en cualquier caja
 * @param rutaRelativa la ruta ya sin la raiz del sistema, empezando por `/`
 */
export function laSirveElBackend(
  servidas: readonly OperacionServida[],
  metodo: string,
  rutaRelativa: string,
): boolean {
  const buscado = metodo.toUpperCase();
  return servidas.some(
    (o) => o.metodo.toUpperCase() === buscado && compilar(o.ruta).patron.test(rutaRelativa),
  );
}
