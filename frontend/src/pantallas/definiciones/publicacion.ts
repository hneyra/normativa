import type { ClaveDeHoja } from '../arbol.ts';
import type { Pantalla } from '../tipos.ts';

/**
 * **La pantalla de **Publicacion**: el snapshot descargable del conjunto sellado** (#58, AC 2).
 *
 * Transcrita de `const PANTALLAS['nor-publicacion']` y de `const INSTRUCCIONES['nor-publicacion']` de
 * `frontend/diseno/NormativaV8.dc.html`, con las cadenas literales. La compara con el artboard
 * —bloque a bloque, campo a campo y tipo a tipo— `verificaciones/pantallas-del-artboard.test.ts`.
 *
 * <h2>Un archivo por hoja, y no es estetica</h2>
 *
 * Es lo que deja a #65, #66 y #67 trabajar en paralelo sobre estas mismas cuatro pantallas sin
 * pisarse: cada uno abre la suya.
 *
 * <h2>Sin cifras y sin datos</h2>
 *
 * Ni el valor de un campo de solo lectura, ni las filas de una tabla, ni su conteo: son ejemplo y
 * viven **solo** en el artboard, que no esta bajo `src/` y no lo importa una linea de produccion
 * (`rentas`#97). Lo que se conserva es la FORMA. Lo vigila `verificaciones/sin-cifras-inventadas`.
 *
 * Y **nada se rellena**: esta hoja todavia no tiene conector —su `src/datos/<hoja>.ts` esta puesto y
 * vacio, y lo llena su issue de la ola 5—, asi que cada campo y cada tabla dicen su ausencia con el
 * motivo que redacta `src/porQueNoHayDato.ts`: «publicado y sin pedir», que no es lo mismo que
 * «sin conectar».
 *
 * <h2>Lo que esta hoja NO dibuja todavia, dicho aqui y no descubierto luego</h2>
 *
 * Lo mismo que en cuadros con el selector de ambito (H14a, N11). La comprobacion de la huella
 * —`ETag` == `sha256` de los bytes— (H29a, H29b), guardar el archivo (H30a, todavia sin publicar en
 * `kamayuk-lib`#86) y comparar las dos descargas (H31) son de #67: aqui el `ETag` y las dos huellas
 * son campos de solo lectura, como en el artboard.
 */
export const PUBLICACION = {
  'nor-publicacion': {
    instruccion:
      'elija el ámbito y descargue el conjunto sellado, entero: una petición por corrida, no una por predio.',
    bloques: [
      {
        titulo: 'Qué conjunto se descarga',
        nota: 'El ámbito no tiene valor por omisión, y eso es la mitad de la decisión: un «todo» implícito sería el snapshot más grande servido a quien no lo pidió, con otra huella y con la mitad de sus filas sin consumidor. ?ambito=valuacion en minúsculas se rechaza nombrándolo, porque aceptarlo devolvería un snapshot con otra huella que el cliente creería correcto.',
        campos: [
          { etiqueta: 'Conjunto', tipo: 'r' },
          { etiqueta: 'Ejercicio · versión', tipo: 'r' },
          { etiqueta: 'Ámbito', tipo: 's', opciones: ['VALUACION', 'OBLIGACION'] },
        ],
      },
      {
        titulo: 'La respuesta',
        nota: 'El sha256 no viene dentro del cuerpo a propósito: sería pedirle a un valor que se contenga a sí mismo. Viaja en el ETag, y lo que se guarda al descargar son estos mismos bytes, no una segunda serialización del objeto.',
        campos: [
          { etiqueta: 'ETag', tipo: 'r1' },
          { etiqueta: 'Cache-Control', tipo: 'r' },
          { etiqueta: 'conjuntoId', tipo: 'r' },
          { etiqueta: 'ejercicio · version', tipo: 'r' },
          { etiqueta: 'ambito', tipo: 'r' },
          { etiqueta: 'filas', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Qué viene y qué no',
          columnas: [
            { rotulo: 'Campo', alineadoDerecha: false },
            { rotulo: 'Filas', alineadoDerecha: true },
            { rotulo: 'Por qué', alineadoDerecha: false },
          ],
          nota: 'La huella DEPENDE del ámbito, porque son bytes distintos. Lo que no cambia es la identidad —conjuntoId, ejercicio y versión—, y es lo que las dos corridas comparan para saber que calcularon con el mismo juego de valores.',
        },
      },
      {
        titulo: 'Un conjunto, dos descargas',
        nota: 'Misma identidad y huellas distintas, que es lo que hace entendible que un mismo conjunto tenga dos descargas: quien necesita las dos mitades —hoy rentas, que todavía lleva catastro dentro— pide DOS snapshots del MISMO conjunto, y la identidad es lo que las dos corridas comparan.',
        campos: [
          { etiqueta: 'Identidad', tipo: 'r1' },
          { etiqueta: 'ETag en VALUACION', tipo: 'r1' },
          { etiqueta: 'ETag en OBLIGACION', tipo: 'r1' },
          { etiqueta: 'Las dos huellas', tipo: 'r' },
        ],
      },
      {
        titulo: 'Por qué se puede guardar para siempre',
        nota: '',
        campos: [
          { etiqueta: 'Lo sellado no cambia', tipo: 'r1' },
          { etiqueta: 'La caché se indexa por contenido', tipo: 'r1' },
          { etiqueta: 'El orden de las filas es total', tipo: 'r1' },
        ],
      },
      {
        titulo: 'Quién se lo lleva',
        nota: 'Una petición por corrida, no una por predio. Una emisión de trescientos mil predios haría trescientas mil peticiones, y el día que normativa no esté arriba no habría padrón.',
        campos: [],
        tabla: {
          titulo: 'Quién consume el conjunto sellado',
          columnas: [
            { rotulo: 'Quién', alineadoDerecha: false },
            { rotulo: 'Qué ámbito pide', alineadoDerecha: false },
            { rotulo: 'Cuándo', alineadoDerecha: false },
            { rotulo: 'Qué hace con él', alineadoDerecha: false },
          ],
          nota: 'Los dos declaran su contrato y consumen dos operaciones: GET /conjuntos y GET /conjuntos/{id}/snapshot. Ninguno consume GET /seguridad/parametros y GET /seguridad/parametros/ejercicios/{ejercicio}. Es lo que convierte «publicamos un JSON» en «esto es lo que se rompe si cambia»: un campo que este sistema deje de publicar pone rojo el build de este repositorio, no el del consumidor (ADR-0030 §4).',
        },
      },
    ],
  },
} satisfies Partial<Record<ClaveDeHoja, Pantalla>>;
