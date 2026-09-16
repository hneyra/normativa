/**
 * **La huella de un cuerpo servido: el `sha256` de SUS BYTES, y el `ETag` que lo anuncia** (#67,
 * AC 2 y AC 3).
 *
 * <h2>Por que esto lo hace este sistema y no `@kamayuk/api`</h2>
 *
 * Porque `kamayuk-lib`#57 lo devolvio con ese motivo escrito: la libreria entrega **los bytes y las
 * cabeceras** —`solicitarRespuesta()`— y «quien sabe que algoritmo firmo su recurso, que forma de
 * `ETag` acepta y que hacer si no cuadra es el sistema que lo pide». Es el hueco H29b de
 * `frontend/diseno/HUECOS.md`, y sube el dia que otro sistema firme un cuerpo.
 *
 * <h2>Por que aqui SI se nombra `crypto.subtle`, que en `src/` esta prohibido</h2>
 *
 * `verificaciones/la-puerta-y-el-cliente-son-de-la-libreria.test.ts` prohibe esa cadena en todo
 * `src/` para impedir que vuelva a entrar **PKCE escrito a mano** —la V6 tenia 394 lineas de el—.
 * Esto no es PKCE: es la comprobacion de una huella que la libreria **no hace y no debe hacer**, y
 * por eso la guarda exceptua ESTE archivo y solo este, con su motivo dentro. El archivo es corto y
 * no hace nada mas, precisamente para que la excepcion se pueda leer entera.
 *
 * <h2>Sobre los BYTES, y no sobre las unidades de JavaScript</h2>
 *
 * El servidor firma `sha.digest(cuerpo.getBytes(StandardCharsets.UTF_8))`
 * (`SnapshotController.java:171-178`). Una huella calculada sobre las unidades de codigo de
 * JavaScript da otra cosa **en cuanto el cuerpo lleva una tilde**, y este cuerpo lleva «Resolución
 * Ministerial» en cada fila del derivado. Por eso el texto pasa por `TextEncoder` antes de
 * resumirse, y por eso la prueba de esto usa un cuerpo con tildes: sin tilde, las dos formas
 * coinciden y la prueba pasaria sin haber medido la diferencia.
 *
 * <h2>Y sobre el TEXTO QUE LLEGO, no sobre una reserializacion</h2>
 *
 * `JSON.parse` y `JSON.stringify` no son inversas —`1.0` vuelve `1`, un escape `ó` vuelve la
 * letra, los blancos se van— y el resultado *casi siempre* coincide, que es la peor de las
 * propiedades: la huella cuadraria en la maquina de quien lo escribio y dejaria de cuadrar el dia
 * que el conjunto sellado trajera un decimal con cero final.
 */

/**
 * Si este navegador ofrece la criptografia que la huella necesita (AC 3).
 *
 * **No lo ofrece siempre, y esta medido**: el navegador solo expone esa API en un **origen
 * seguro**. Medido en Chromium 151 (2026-09-14) sobre una pagina servida en `[::1]` y alcanzada por
 * tres nombres:
 *
 *     http://localhost          isSecureContext: true    digest: funciona
 *     http://127.0.0.1          isSecureContext: true    digest: funciona
 *     http://normativa.prueba   isSecureContext: false   TypeError: Cannot read properties of
 *       (MAP a [::1])                                    undefined (reading 'digest')
 *
 * O sea: basta con servir esta interfaz por `http://` con un nombre de maquina —lo normal en una
 * marcha blanca antes de que haya certificado— para que no se pueda comprobar nada. Sin esta
 * pregunta, lo que sale es ese `TypeError` y la hoja se queda a medias sin decir por que; con ella,
 * la hoja **no afirma nada sobre la huella** y explica que hace falta «https» o «localhost».
 *
 * Se pregunta por `globalThis` y no por `window` para que la respuesta sea la misma fuera de un
 * DOM: en una prueba de Node la huella se puede calcular, y eso es lo que deja medir el camino
 * bueno sin navegador.
 */
export function sePuedeCalcularLaHuella(): boolean {
  return laCriptografia() !== undefined;
}

/**
 * La API de resumen de este origen, o `undefined` si no la hay.
 *
 * Se escribe `crypto.subtle` **tal cual, y a la vista**: la guarda que prohibe esa cadena en `src/`
 * exceptua este archivo por su nombre, asi que escribirla de otra forma —guardando `globalThis` en
 * una variable con otro nombre, por ejemplo— seria esquivar la guarda en vez de declarar la
 * excepcion. Si algun dia esto no hace falta, la excepcion se quita y la guarda vuelve a barrer el
 * arbol entero.
 *
 * El `typeof` es obligatorio y no es defensivo de mas: en un origen inseguro `crypto` existe —lo que
 * falta es `subtle`—, pero fuera de un navegador puede no existir ninguno de los dos.
 */
function laCriptografia(): SubtleCrypto | undefined {
  if (typeof crypto === 'undefined') return undefined;
  // `crypto.subtle` esta tipado como presente SIEMPRE, y por eso el tipo miente en el unico caso
  // que este archivo existe para tratar: fuera de un origen seguro vale `undefined`.
  return crypto.subtle as SubtleCrypto | undefined;
}

/**
 * El `sha256` de un texto, en hexadecimal minusculo y **sobre sus bytes en UTF-8**.
 *
 * @throws si este origen no ofrece la criptografia. Quien llama pregunta antes con
 *   {@link sePuedeCalcularLaHuella}: el `TypeError` de la API no nombra ni el origen ni el
 *   certificado que falta, y esta excepcion si.
 */
export async function sha256DeLosBytes(texto: string): Promise<string> {
  const subtle = laCriptografia();
  if (subtle === undefined) {
    throw new Error(
      'Este origen no ofrece la criptografia que el sha256 necesita: el navegador solo la expone ' +
        'bajo «https://», en «localhost» o en «127.0.0.1». Pregunte antes con ' +
        '`sePuedeCalcularLaHuella()`: la hoja no puede afirmar nada sobre la huella aqui.',
    );
  }
  const resumen = await subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(resumen))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lo que dice el `ETag` de una respuesta: una huella comparable, o por que no lo es.
 *
 * Son **tres** negativas distintas y no una, porque se arreglan en sitios distintos: sin cabecera,
 * lo que falta es que el servidor la mande; con `W/`, lo que hay que cambiar es que la mande
 * FUERTE; y con una cabecera que no es un sha256 hexadecimal, lo que cambio es el algoritmo con el
 * que firma. Un solo «no vale» las juntaria y mandaria a mirar donde no es.
 */
export type HuellaAnunciada =
  | { readonly clase: 'huella'; readonly huella: string }
  /** No vino `ETag`. Y el snapshot se cachea un ano: sin huella no hay nada que comparar al releer. */
  | { readonly clase: 'sin-etag' }
  /** Vino `W/"..."`. Un `ETag` debil dice «equivalente», y aqui la pregunta es si son los MISMOS bytes. */
  | { readonly clase: 'etag-debil'; readonly etag: string }
  /** Vino algo que no es un sha256 en hexadecimal: no hay con que comparar lo que se calcula. */
  | { readonly clase: 'etag-que-no-es-sha256'; readonly etag: string };

/** Un sha256 en hexadecimal: 64 digitos, con o sin las comillas del `ETag`. */
const SHA256_ENTRE_COMILLAS = /^"?([0-9a-fA-F]{64})"?$/;

/**
 * La huella que la respuesta anuncia, sin comillas y en minusculas.
 *
 * **Un `ETag` debil no se normaliza quitandole la `W/`**: se rechaza nombrandolo. `W/` significa
 * «equivalente para el uso», que es exactamente lo que aqui no vale — un intermediario que
 * recomprima puede seguir sirviendo un `ETag` debil correcto sobre unos bytes distintos, y esta
 * hoja pregunta por los bytes.
 *
 * @param etag lo que devolvio `cabeceras.get('ETag')`, tal cual
 */
export function huellaAnunciada(etag: string | null): HuellaAnunciada {
  if (etag === null) return { clase: 'sin-etag' };
  const limpio = etag.trim();
  if (limpio.startsWith('W/')) return { clase: 'etag-debil', etag: limpio };
  const encontrado = SHA256_ENTRE_COMILLAS.exec(limpio);
  if (encontrado?.[1] === undefined) return { clase: 'etag-que-no-es-sha256', etag: limpio };
  return { clase: 'huella', huella: encontrado[1].toLowerCase() };
}
