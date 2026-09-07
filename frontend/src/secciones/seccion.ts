import type { ErrorDeLaApi } from '../api/cliente.ts';

/**
 * Lo que las dos secciones de #15 comparten y no es ni dato ni dibujo.
 *
 * Son dos funciones, y las dos estan aqui y no repetidas en cada seccion por el mismo motivo:
 * las dos leen **el mismo** ejercicio —el de la barra global— y las dos tienen que leer **igual**
 * el 404 del ejercicio sin sellar. Una lectura distinta en cada una significaria que Cuadros y
 * Publicacion pueden acabar hablando de anos distintos, o pintando la misma respuesta una como
 * estado normal y la otra como averia.
 */

/** El rango que el constructor de `Ejercicio` admite en el backend. Fuera de el, un 422. */
const PRIMER_EJERCICIO = 1990;
const ULTIMO_EJERCICIO = 2100;

/**
 * El ejercicio que se le pide al backend, o `null` si lo que hay no es un ejercicio.
 *
 * La barra global lo lleva como texto, y el backend lo recibe como entero. **No se manda lo que
 * no es un entero del rango**: `?ejercicio=NaN` no es una pregunta que el servidor pueda
 * contestar, y la respuesta —un 422 leyendo el parametro— no diria nada de lo que pasa, que es
 * que la interfaz mando basura. Con `null` no se pide nada, que es lo que los hooks entienden.
 *
 * El rango es el del constructor de `Ejercicio`: fuera de 1990–2100 el backend contesta 422
 * **nombrando el rango**, y eso es otra cosa que «ese ejercicio no esta sellado» — la primera la
 * corrige quien teclea, la segunda quien sella.
 */
export function ejercicioPedido(ejercicio: string): number | null {
  if (!/^\d{4}$/.test(ejercicio.trim())) return null;
  const anio = Number(ejercicio.trim());
  return anio >= PRIMER_EJERCICIO && anio <= ULTIMO_EJERCICIO ? anio : null;
}

/**
 * Si ese fallo es «ese ejercicio no está publicado» y no «esa ruta no existe».
 *
 * Los dos son **404** y por el numero no se distinguen; **y tampoco por el codigo**, que en los
 * dos es `NO_ENCONTRADO`. Lo que los distingue es el miembro `parametroQueFalta` del cuerpo:
 * `FaltaPublicar.noEncontrado` lo pone —lleva el ejercicio, y la llave cuando el backend sabe
 * cual es— y un 404 de ruta inexistente no lo lleva. Lo dice su propio javadoc: «el 404 de aqui
 * lo lleva y el 404 de "ese contribuyente no esta en el padron" no —y esa diferencia es lo unico
 * que los separa—».
 *
 * La diferencia no es documental: uno lo arregla quien atiende —componiendo y sellando el
 * conjunto de ese ejercicio— y el otro no lo arregla nadie desde una pantalla. Por eso el
 * primero se dibuja como **respuesta** y el segundo como **averia**.
 */
export function esEjercicioSinPublicar(fallo: ErrorDeLaApi): boolean {
  return fallo.estado === 404 && fallo.faltaUnaCifraNormativa;
}
