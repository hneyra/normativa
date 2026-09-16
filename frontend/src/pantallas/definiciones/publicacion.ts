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
 * Y **desde #67 esta hoja SI se rellena**: su conector es `src/datos/publicacion.ts`. Lo que aqui se
 * anade es lo que el artboard no puede llevar porque no es forma sino costura —la `lectura` de cada
 * bloque, la `clave` de cada tabla, la `insignia` del `ETag` y la accion que guarda—, y ninguna de
 * esas cuatro cosas la mira `verificaciones/pantallas-del-artboard.test.ts`: compara titulo, nota,
 * campos y tabla, que es la FORMA.
 *
 * <h2>Las claves van como LITERALES, y es la forma que usa el Panel</h2>
 *
 * `lectura.clave`, `tabla.clave`, los nombres de dato y la clave de la operacion se escriben aqui a
 * mano y **no se importan de `src/datos/`**. Importarlos arrastraria `src/api/cliente.ts` ->
 * `src/sesion.ts`, que lee `window.location.origin` al cargarse, y las guardas que leen estas
 * definiciones corren sin DOM: el rojo seria «ReferenceError: window is not defined» durante la
 * recoleccion, que se lleva la suite entera y no habla de la pantalla. Que los dos lados sigan
 * escribiendo lo mismo lo comprueba `verificaciones/camino-a-la-api.test.ts`, como ya hacia con el
 * Panel — una clave mal escrita no da error: da una tabla sin filas y un aviso de «lectura sin
 * estado».
 *
 * <h2>Lo que esta hoja NO dibuja todavia, dicho aqui y no descubierto luego</h2>
 *
 * · **El selector de ambito no gobierna la lectura** (H14a, N11): sigue siendo un campo `s`, y lo
 *   tecleado en un campo vive en el estado de `<Pantalla>`. La hoja pide **los dos ambitos** y la
 *   ficha «La respuesta» es la del primero. Ver `src/datos/publicacion.ts`.
 * · **El veredicto de la huella no tiene aviso propio** (H29a). La gramatica V8 no tiene donde
 *   ponerlo: un `aviso` de `@kamayuk/ui` seria una pieza mas en `bloques` y el artboard no la
 *   declara. Lo que si cabe, y es lo que se hace, es decirlo en la **barra de la tabla** de «Que
 *   viene y que no» —que es donde se cuenta lo que trajo la respuesta— y pintar el `ETag` con el
 *   tono que le corresponde. El aviso con su tono llega con H29a.
 * · **«Guardar el snapshot» esta en el BLOQUE y no al pie** (H30a). Al pie no cabe: el armazon
 *   decide las acciones con `seEscribe` y esta hoja tiene un desplegable, asi que su pie ofrece
 *   «Limpiar» y «Guardar» y no «Exportar» —es la diferencia N11 de `HUECOS.md`, medida en
 *   `src/catalogo.ts`—. La accion del pie **tambien** esta atendida (`src/acciones.ts`), para el dia
 *   que H14a la haga aparecer.
 */
export const PUBLICACION = {
  'nor-publicacion': {
    instruccion:
      'elija el ámbito y descargue el conjunto sellado, entero: una petición por corrida, no una por predio.',
    bloques: [
      {
        titulo: 'Qué conjunto se descarga',
        nota: 'El ámbito no tiene valor por omisión, y eso es la mitad de la decisión: un «todo» implícito sería el snapshot más grande servido a quien no lo pidió, con otra huella y con la mitad de sus filas sin consumidor. ?ambito=valuacion en minúsculas se rechaza nombrándolo, porque aceptarlo devolvería un snapshot con otra huella que el cliente creería correcto.',
        // Una sola lectura para los tres bloques que dependen del servidor: las tres peticiones de
        // esta hoja van detras del mismo `@RequiereAcceso`, asi que no hay ninguna que pueda
        // contestar 403 mientras otra contesta 200. Ver `src/datos/publicacion.ts`.
        lectura: { clave: 'publicacion' },
        campos: [
          { etiqueta: 'Conjunto', tipo: 'r' },
          { etiqueta: 'Ejercicio · versión', tipo: 'r' },
          { etiqueta: 'Ámbito', tipo: 's', opciones: ['VALUACION', 'OBLIGACION'] },
        ],
      },
      {
        titulo: 'La respuesta',
        nota: 'El sha256 no viene dentro del cuerpo a propósito: sería pedirle a un valor que se contenga a sí mismo. Viaja en el ETag, y lo que se guarda al descargar son estos mismos bytes, no una segunda serialización del objeto.',
        lectura: { clave: 'publicacion' },
        // «Guardar el snapshot» entrega LOS BYTES QUE SE VERIFICARON, y sale impedida —con su
        // motivo visible— mientras no haya ninguno: sin huella comprobada no se guarda nada.
        acciones: [
          {
            rotulo: 'Guardar el snapshot',
            hace: 'guardar-el-snapshot',
            principal: true,
            impedida: [
              {
                si: { dato: 'publicacion.noSePuedeGuardar', hay: true },
                motivo: { desde: 'publicacion.noSePuedeGuardar' },
              },
            ],
          },
        ],
        campos: [
          // Las DOS primeras salen de una CABECERA y las cuatro de abajo del CUERPO. El `ETag` se
          // pinta con el tono que dice el sistema —y no deducido de su texto, que es la leccion
          // H18—: `ok` si la huella cuadra y la cache es la del contrato, `atencion` si los bytes
          // estan bien y la promesa de un año no, `mal` si no cuadra o no hay con que comparar.
          // `tonoDesde` y no `segun` + `casos`: con `segun`, un `ETag` que NO vino pintaria una
          // insignia con la palabra del tono dentro —«mal»— en lugar del hueco que dice que no
          // vino. `tonoDesde` no pinta insignia sin valor (`resolverInsignia`), que es lo correcto:
          // sin `ETag` lo que hay que leer es «sin ETag».
          { etiqueta: 'ETag', tipo: 'r1', insignia: { tonoDesde: 'publicacion.tono', siNoTrae: 'info' } },
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
          // Sus filas llegan por este nombre, y su barra lleva el veredicto de la comprobación:
          // ver el javadoc de arriba, «Lo que esta hoja NO dibuja todavia».
          clave: 'listas',
          vacio:
            'La respuesta llegó y no traía ninguna de las cuatro listas. No es el reparto de ámbitos: con cualquiera de los dos vienen al menos los parámetros.',
        },
      },
      {
        titulo: 'Un conjunto, dos descargas',
        nota: 'Misma identidad y huellas distintas, que es lo que hace entendible que un mismo conjunto tenga dos descargas: quien necesita las dos mitades —hoy rentas, que todavía lleva catastro dentro— pide DOS snapshots del MISMO conjunto, y la identidad es lo que las dos corridas comparan.',
        lectura: { clave: 'publicacion' },
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
          // Sin `lectura` en este bloque, y a proposito: quien consume esto sale del CONTRATO que
          // cada uno publica —los dos `ContratoCon*Test` del backend—, no de una respuesta. Con el
          // servidor caido esta tabla sigue diciendo que se rompe si el JSON cambia, que es
          // exactamente cuando hace falta leerla.
          clave: 'consumidores',
        },
      },
    ],
  },
} satisfies Partial<Record<ClaveDeHoja, Pantalla>>;
