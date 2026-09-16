/**
 * **Las operaciones que alguien ha visto contestar CON UN TOKEN DE ESTA INTERFAZ** (#63, AC 7).
 *
 * <h2>Hoy son CERO, y eso es una medida y no un olvido</h2>
 *
 * La V6 dejo `YA_SERVIDAS = []` con sus motivos escritos (`c01fe9a:src/datos/servidas.ts:35-51,73`)
 * y esta lista sigue vacia por el mismo que sigue siendo cierto: **nadie ha ejercido ninguna de las
 * cuatro rutas de este backend con un token de `normativa-web`**. No hay en este repositorio ni una
 * traza —ambiente, fecha, operacion y estado HTTP— de una corrida asi, y el ultimo apunte contra
 * `stg` es del 2026-08-29.
 *
 * Encender una entrada aqui es afirmar que el camino entero existe: que el token viajo, que Vite lo
 * encamino, que Traefik lo enruto por `PathPrefix(/normativa)`, que la cadena de identidad lo
 * acepto y que `SET LOCAL` fijo el inquilino. Eso **no se deduce del contrato**: el contrato dice la
 * forma de la respuesta, no que alguien la haya recibido.
 *
 * <h2>Y por eso el Panel SI pide, aunque esta lista este vacia</h2>
 *
 * Las dos cosas no se contradicen, y conviene decirlo aqui porque parecen contradecirse:
 *
 *   · **`PETICIONES` de `lecturas.ts`** es lo que la hoja pide: sale del contrato publicado y la
 *     guarda `camino-a-la-api` la cruza campo a campo contra el;
 *   · **esta lista** es lo que alguien ha visto CONTESTAR. Es un hecho sobre una instalacion, no
 *     sobre el codigo, y por eso se escribe a mano y cada entrada exige su traza en el PR.
 *
 * Mientras esta este vacia, lo que demuestra que la hoja pide bien es `e2e/errores.spec.ts`, que
 * responde con cuerpos cuya **forma** se comprueba campo a campo contra
 * `docs/50-api/formas-de-la-api.json` — no con cifras escritas a mano que pasarian por medidas.
 *
 * <h2>Lo que esta lista NO hace aqui, y en `rentas` si</h2>
 *
 * En `rentas` la leia ademas un proxy que decidia que peticion salia de verdad y cual contestaba
 * simulada. Aqui **no hay proxy**: la V6 se llevo el suyo en #50 y no vuelve. Asi que esto es un
 * registro, y `laSirveElBackend` existe para que `porQueNoHayDato` pueda cruzar lo que una hoja
 * declara contra lo que se ha visto contestar.
 */

/** Una operacion que el backend ya sirve, vista contestar. Se compara por verbo y por ruta. */
export interface OperacionServida {
  readonly metodo: string;
  /** Ruta bajo la raiz del sistema, con sus parametros entre llaves. */
  readonly ruta: string;
  /** La traza: ambiente, fecha y estado HTTP con que contesto. Sin ella no entra. */
  readonly traza: string;
}

/**
 * Lo ya ejercido con token. **Vacia**: ver la cabecera.
 *
 * El tipo es `readonly OperacionServida[]` y no una tupla a proposito: lo que cambia el dia que se
 * ejerza la primera es esta lista, y nada mas. `verificaciones/camino-a-la-api.test.ts` escribe la
 * lista esperada **a mano**, como en `rentas`: encender una ruta es una decision, y una decision se
 * revisa leyendo su diff.
 */
export const YA_SERVIDAS: readonly OperacionServida[] = [];

/** `/conjuntos/{id}/snapshot` → `^/conjuntos/[^/]+/snapshot$`. */
function compilar(ruta: string): RegExp {
  const escapado = ruta
    .split(/(\{\w+\})/)
    .map((trozo) =>
      /^\{\w+\}$/.test(trozo) ? '[^/]+' : trozo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${escapado}$`);
}

/**
 * Si esa peticion se ha visto contestar de verdad.
 *
 * @param servidas la lista que rige; quien llama pasa `YA_SERVIDAS` salvo que se le diga otra cosa
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
    (o) => o.metodo.toUpperCase() === buscado && compilar(o.ruta).test(rutaRelativa),
  );
}
