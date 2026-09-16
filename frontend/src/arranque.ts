import { anotarLaVuelta, fijarElPorQue } from './puerta/falla.ts';
import { identidad } from './sesion.ts';

/**
 * **El arranque de `normativa-web`: primero quien pregunta, y solo entonces quien dibuja** (#57).
 *
 * Sobre `rentas/frontend/src/arranque.ts@ac379ac` (168 l), con `@kamayuk/sesion` en lugar de su
 * copia y **sin la siembra del catalogo**, que alli existe porque `rentas` tiene cuarenta pantallas
 * que mirar sin plataforma; aqui no hay ninguna hasta #58.
 *
 * <h2>El montaje entra como ARGUMENTO, y eso es lo que lo hace util</h2>
 *
 * `arrancar(montar)` recibe el montaje en vez de que el montaje venga en la linea de abajo en
 * `main.tsx`, porque **hay cosas que tienen que pasar antes de que React monte** y la unica forma
 * de que no puedan colarse despues es que el montaje sea lo ultimo que esta funcion hace. La forma
 * la puso #55 vacia; esto la llena.
 *
 * <h2>Los tres pasos, y por que en este orden</h2>
 *
 * 1. **`canjearSiVuelve()`**, lo primero. Al volver de Keycloak la URL trae un `?code=` que hay que
 *    canjear antes de montar: la primera peticion de la primera pantalla seria
 *    `GET /seguridad/sesion`, y sin token contesta 401 — o sea que montar primero enseñaria un
 *    error de identidad **a alguien que si esta identificado**. Ademas deja la barra de direcciones
 *    limpia, salga bien o mal.
 * 2. **La ida a la puerta**, si no hay token. Sin token no hay nada que enseñar, asi que se va a la
 *    puerta en vez de montar la aplicacion para que ella descubra el 401. Con la sesion de Keycloak
 *    viva, ir a la puerta va y vuelve sin dibujar nada.
 * 3. **`montar()`**, siempre que no nos hayamos ido.
 *
 * <h2>Los dos frenos del rebote, y hacen falta los dos</h2>
 *
 *   · **el tope de idas** (`puedeIrALaPuerta`), porque un canje que falla siempre —un
 *     `redirect_uri` mal declarado— convierte esto en un rebote infinito: pagina en blanco
 *     parpadeando, ninguna traza, y el emisor recibiendo la rafaga. Con el tope gastado **se
 *     monta**, para que la puerta pueda explicarse;
 *   · **la marca de salida** (`vieneDeSalir`), porque `post_logout_redirect_uri` trae de vuelta sin
 *     token y sin ella el arranque volveria a entrar solo — con la sesion del emisor viva, quien
 *     acaba de cerrar sesion se encuentra DENTRO OTRA VEZ con la misma cuenta.
 *
 * <h2>Y un TERCER freno, que es de este sistema: el emisor que no dejo entrar</h2>
 *
 * Si la vuelta trae un `?error=`, no se va a la puerta. Volver seria pedir otra vez lo que el
 * emisor acaba de negar —«el alcance que se pide no existe», «el emisor no reconoce a este
 * cliente»—, y con el tope de tres eso termina en una pantalla en blanco sin una palabra de la
 * causa. `rentas` no lo necesita porque su casco pide `GET /seguridad/sesion` al montar y el 401 lo
 * explica; **esta interfaz no tiene ninguna lectura obligatoria al arrancar**, asi que el motivo se
 * anota aqui y lo dibuja `PuertaCaida`. El porque entero, en `puerta/falla.ts`.
 *
 * Y un cuarto que no es un freno sino una ausencia: **sin `crypto.subtle` no hay puerta**
 * (`hayPuerta()`), porque S256 no se puede calcular. El navegador no lo expone fuera de un origen
 * seguro, asi que esto pasa de verdad: `http://` con un nombre que no sea `localhost`.
 *
 * **Y desde #61 ese cuarto caso se ANOTA, no solo se para.** Hasta aqui vivia dentro del mismo
 * `&&` que los otros dos frenos, asi que sin `crypto.subtle` la aplicacion montaba sin sesion **y
 * sin una palabra**: lo unico visible era que las pantallas no traian datos. Por eso la condicion
 * esta partida en dos —hacen falta las dos ramas, y con un solo `&&` solo hay una—: ahora se fija
 * el porque y `PuertaCaida` lo dice, nombrando el origen desde el que se sirvio. La medicion de
 * Chromium que lo sostiene esta en `puerta/falla.ts`, y lo mide `e2e/sin-origen-seguro.spec.ts`.
 *
 * <h2>Y hay un QUINTO caso en que se monta: cuando la ida no llega a ocurrir</h2>
 *
 * No montar es correcto **cuando la puerta contesta**. Cuando no —el emisor apagado, un DNS que no
 * resuelve, una espera agotada— la navegacion se rechaza y no queda ni documento nuevo ni
 * aplicacion: la pagina de antes, vacia. Medido en `rentas`#112 con `yarn dev` y nada mas
 * levantado: `body.innerText` vacio y la consola con dos lineas de Vite, ni un error.
 *
 * Por eso `entrar()` de `@kamayuk/sesion` pregunta primero si el emisor esta y devuelve la falla
 * cuando no. Con ella se monta y `PuertaCaida` explica **quien** no contesto y **en que URL** — que
 * es lo que hace falta para arreglarlo. El camino bueno no cambia: si el emisor contesta, sigue sin
 * montarse nada.
 *
 * **La condicion se lee al reves de lo que parece**: `null` es que todo fue bien y la pagina se va.
 */
export async function arrancar(montar: () => void): Promise<void> {
  fijarElPorQue(null);

  // **Lo que dijo el emisor gana, y por eso esto va antes que nada.** Un `?error=` no se contesta
  // volviendo a la puerta: el emisor devolveria el mismo error, y a la tercera el tope pararia sin
  // una palabra de la causa. Se anota el motivo, se monta, y la puerta caida lo dice.
  const noDejoEntrar = anotarLaVuelta(await identidad.canjearSiVuelve());

  if (
    !noDejoEntrar &&
    identidad.token() === null &&
    identidad.puedeIrALaPuerta() &&
    !identidad.vieneDeSalir()
  ) {
    // Sin `crypto.subtle` no hay S256 y por tanto no hay puerta. No se va a ninguna parte —ir
    // reventaria con `Cannot read properties of undefined (reading 'digest')`— y **se dice**.
    if (!identidad.hayPuerta()) {
      fijarElPorQue({ tipo: 'sin-origen-seguro' });
    } else {
      const falla = await identidad.entrar();
      if (falla !== null) fijarElPorQue({ tipo: 'no-contesto', falla });
      // Solo se deja de montar cuando la navegacion SI ocurrio.
      if (falla === null) return;
    }
  }

  montar();
}
