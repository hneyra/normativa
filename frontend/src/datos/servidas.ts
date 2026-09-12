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
 * `datos/operaciones.ts` declara con la forma de su `record`.
 *
 * <h2>Los TRES motivos de F-4, y cuales quedan (#39)</h2>
 *
 * <ol>
 *   <li><b>Las cuatro exigen token.</b> Sigue siendo cierto y no va a cambiar:
 *       `SeguridadWeb.cadenaDeSeguridad` deja `authenticated()` todo lo que cuelga de la raiz de
 *       la API —las sondas y las metricas son lo unico con `permitAll()`, y lo demas
 *       `denyAll()`—, y `TenantContextFilter` exige ademas el claim `municipalidad_id`: sin el,
 *       **403 `SIN_MUNICIPALIDAD`** escrito por `RespuestaDeError` desde fuera del
 *       `DispatcherServlet`.</li>
 *   <li><s><b>Esta interfaz no consigue un token.</b></s> <b>CERRADO en #39.</b> Decia que no
 *       habia cliente OIDC de `normativa-web` en ningun realm; la decision fue **no crear uno** y
 *       reusar `kamayuk-backoffice` —mismo realm, mismos usuarios, y la autorizacion la hace este
 *       backend contra su copia local—. `api/identidad.ts` hace el codigo de autorizacion con
 *       PKCE S256 y `api/cliente.ts` manda la cabecera.</li>
 *   <li><s><b>No hay a donde mandar la peticion.</b></s> <b>CERRADO en #39.</b> `vite.config.ts`
 *       declara `server.proxy` hacia el ingreso, asi que `/normativa/api/v1/...` deja de
 *       atenderlo el servidor de Vite con el `index.html` y un `200`.</li>
 * </ol>
 *
 * <h2>Por que sigue vacia, entonces</h2>
 *
 * Porque **nadie ha visto contestar a ninguna de las cuatro con un token de esta interfaz**, y
 * encender una ruta que no se ha ejercido es exactamente lo que este repositorio no hace. Lo que
 * #39 SI midio, con la plataforma levantada y el backend en pie, es que la peticion **llega**:
 * `GET http://localhost:8082/normativa/api/v1/conjuntos` por el mismo origen que sirve la
 * pantalla contesta `401 NO_AUTENTICADO` en `application/problem+json`, y no el `index.html` con
 * un 200 — o sea que el reparto de la ruta funciona y lo unico que falta es la credencial. Lo que
 * no se pudo medir en esa maquina fue el rebote entero: la clave del `administrador` la imprime
 * `preparar-identidades.sh` al crearlo y no queda escrita en ningun sitio.
 *
 * <h2>Lo que hay que hacer para encender la primera</h2>
 *
 * Una entrada en `YA_SERVIDAS`, **y haberla ejercido antes**: `yarn dev` con la plataforma y el
 * backend levantados, entrar por la puerta, y ver la pantalla dibujar lo que contesto la API.
 * Al reves —la entrada primero— lo unico que se consigue es cambiar un dato inventado por un 401
 * en la pantalla, que no es progreso: es cambiar un sintoma por otro.
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
 * Ninguna, hoy. El motivo que queda, arriba.
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
