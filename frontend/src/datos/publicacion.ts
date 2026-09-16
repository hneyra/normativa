import type { Conector } from './conectores.ts';

/**
 * **Publicacion: su conector, puesto y vacio** (#63, AC 1 — lo llena #67).
 *
 * Existe hoy por lo mismo que los otros dos: `src/datos/conectores.ts` ya lo importa y ya lo
 * coloca, asi que #67 solo cambia el cuerpo de este archivo.
 *
 * <h2>Que pide esta hoja, y por que su lectura NO es como las demas</h2>
 *
 *   · `GET /conjuntos?ejercicio=` — para saber que conjunto publicar.
 *   · `GET /conjuntos/{id}/snapshot?ambito=` — **los bytes**. El controlador devuelve
 *     `ResponseEntity<String>` con su `ETag` y su `Cache-Control`
 *     (`SnapshotController.java:118-139`), y lo que esta hoja comprueba es que la huella de lo que
 *     llego cuadre con lo que el servidor anuncio.
 *
 * Por eso `cliente.solicitar()` **no sirve aqui**: termina en `respuesta.json()`, y volver a
 * serializar el objeto da otro texto —`1.0` vuelve `1`, un escape vuelve la letra— con otra huella.
 * Lo que #67 usa es `cliente.solicitarRespuesta()`, que `kamayuk-lib`#57 subio precisamente para
 * esto y que devuelve el estado, las cabeceras y el texto **sin interpretar**. Comprobar la huella
 * es de este sistema y no de la libreria: quien sabe que algoritmo firmo su recurso es quien lo
 * pide.
 *
 * <h2>Lo que hay que saber antes de tocarlo</h2>
 *
 * · La V6 lo tenia medido: `ETag` = sha256 de los bytes y `Cache-Control: immutable`
 *   (`c01fe9a:src/api/proxy.test.ts:342-368`). Esa leccion renace en #67.
 * · **El navegador no puede descargar por un enlace**: un `<a href>` a esa ruta sale sin
 *   `Authorization` —el token va en una cabecera— y lo que se guarda es el 401 con nombre de
 *   archivo. Lo que hay es `cliente.descargar()`, y despues `entregarAlNavegador`.
 * · `kamayuk-lib`#57 esta cerrado, asi que #67 **no espera a `kamayuk-lib`#86**: es la unica de las
 *   tres hojas de la ola 5 que ya tiene todo lo suyo.
 */
export const PUBLICACION: Conector | undefined = undefined;
