import type { Catalogo } from '@kamayuk/shell';

/**
 * **El catalogo de modulos y destinos** — costura de #55, la llenan #58 y #64.
 *
 * <h2>Vacio, y lo que eso dibuja</h2>
 *
 * Con el catalogo vacio el `Armazon` dibuja su carril sin un modulo y su «sin destino abierto», y
 * un hash cualquiera cae en su «destino no ofrecido». `pantalla` no se llama nunca. Eso no es un
 * fallo a medias: es lo que #55 promete, porque las cuatro hojas son de #58.
 *
 * <h2>Por que una constante de modulo y no un `[]` en el JSX</h2>
 *
 * Un `[]` nuevo en cada pintada es un catalogo distinto para el armazon, que recalcula su indice
 * cada vez. Es la misma razon por la que `catastro` lo saco a una constante en su #118.
 *
 * <h2>Lo que llega despues, y por que son dos issues</h2>
 *
 * · **#58** pone el arbol del artboard V8: un modulo `Normativa` con el icono `balanza` que eligio
 *   G2 y sus cuatro hojas —Panel, Ediciones, Cuadros de valuacion y Publicacion—.
 * · **#64** lo FILTRA por lo que la cuenta puede abrir, cruzando `GET /seguridad/modulos` y
 *   `GET /seguridad/accesos` (#54) por el campo `codigo`. El armazon recibe el catalogo **ya
 *   filtrado**: no sabe de permisos y no puede saberlo (ADR-0030 §4).
 */
export const CATALOGO: Catalogo = [];
