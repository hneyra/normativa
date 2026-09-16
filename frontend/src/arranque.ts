/**
 * **El arranque de `normativa-web`** — costura de #55, la llena #57.
 *
 * <h2>El montaje entra como ARGUMENTO, y eso es lo que hace falta hoy</h2>
 *
 * `arrancar(montar)` recibe el montaje en vez de que el montaje venga en la linea de abajo en
 * `main.tsx`, porque **hay cosas que tienen que pasar antes de que React monte** y la unica forma
 * de que no puedan colarse despues es que el montaje sea lo ultimo que esta funcion hace. Es la
 * forma de `rentas/frontend/src/arranque.ts@ac379ac`, vacia por dentro.
 *
 * Hoy no hace nada mas: monta. Y eso es correcto —no hay puerta de identidad que canjear ni una
 * sola lectura que preparar—, pero la forma se pone YA, y no cuando haga falta, por lo que dice
 * el AC 3 de #55: `src/aplicacion.tsx` **lo toca solo este issue**, y sin esta costura #57 tendria
 * que tocar `main.tsx` y `aplicacion.tsx` a la vez.
 *
 * <h2>Que pone #57 aqui, y por que va ANTES del montaje</h2>
 *
 * El canje del codigo de autorizacion. Al volver de la puerta, la URL trae un `?code=` que hay
 * que canjear antes de montar: la primera peticion de la primera pantalla seria
 * `GET /seguridad/sesion`, y sin token contesta 401 — o sea que montar primero enseñaria un error
 * de identidad **a alguien que si esta identificado**. Con el canje delante, no.
 *
 * Y con el llegan los dos frenos que `rentas` midio y que no se pueden perder (la tabla «Lo que la
 * V6 aprendio» de la epica #47):
 *
 *   · **el tope de idas a la puerta**, porque un canje que falla siempre —un `redirect_uri` mal
 *     declarado— convierte esto en un rebote infinito: pagina en blanco parpadeando, ninguna
 *     traza, y el emisor recibiendo la rafaga;
 *   · **la marca de salida**, porque `post_logout_redirect_uri` trae de vuelta sin token y sin
 *     ella el arranque volveria a entrar solo — quien acaba de cerrar sesion se encuentra DENTRO
 *     OTRA VEZ con la misma cuenta.
 *
 * <h2>Es `async`, y hoy no espera nada</h2>
 *
 * Porque lo que #57 mete es una ida a la red. Devolver `Promise<void>` desde el primer dia hace
 * que `main.tsx` ya escriba el `void arrancar(…)` que entonces hara falta, y que ese PR no tenga
 * que tocarlo.
 */
export async function arrancar(montar: () => void): Promise<void> {
  // Sin nada delante todavia. Ver el javadoc: lo que entre aqui entra ARRIBA de esta linea, nunca
  // debajo — el montaje es lo ultimo que esta funcion hace, y es lo unico que la hace util.
  await Promise.resolve();
  montar();
}
