/**
 * Lo que las dos secciones de #15 comparten y no es ni dato ni dibujo.
 *
 * Hoy es una sola funcion, y esta aqui y no repetida en las dos porque las dos leen **el mismo**
 * ejercicio —el de la barra global— y una lectura distinta en cada una significaria que Cuadros
 * y Publicacion pueden acabar hablando de anos distintos sin que nada lo diga.
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
