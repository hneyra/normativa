/**
 * **De donde sale el ejercicio que el Panel pregunta** (#63, AC 2).
 *
 * <h2>El defecto que esto cierra, medido en la V6</h2>
 *
 * La V6 lo escribia como literal en dos sitios: `EJERCICIOS = ['2026', '2027', '2025', '2024']`
 * (`c01fe9a:src/marco/BarraGlobal.tsx:67`) y `useState('2026')`
 * (`c01fe9a:src/marco/Marco.tsx:120`). Es el defecto que `catastro` midio en su #48, y lo peor que
 * tiene es **que no se ve**: el 1 de enero de 2027 esa lista sigue pareciendo correcta, y la
 * pantalla pregunta por un ejercicio que ya no es el de trabajo sin que nada lo diga. El sintoma no
 * es un error: es una respuesta correcta a la pregunta equivocada.
 *
 * <h2>Una funcion pura y una lectura, y las dos mitades hacen falta</h2>
 *
 *   · **{@link ejercicioDe}** es pura: entra un instante, sale un ano. Sin reloj dentro, se puede
 *     probar con el reloj movido —`vi.setSystemTime`— y contestar por lo que hace y no por el dia
 *     en que se corre la prueba. Es la regla 6 del producto aplicada aqui: la fecha entra como
 *     argumento.
 *   · **{@link EJERCICIO_DE_TRABAJO}** se lee **una vez**, al cargar el modulo. No en cada pintada:
 *     un `new Date()` dentro del render cambiaria la clave de consulta de TanStack a medianoche y la
 *     hoja volveria a pedir sola, sin que nadie lo hubiera pedido.
 *
 * <h2>Y por que vive en la hoja y no en el marco</h2>
 *
 * Porque **el `Armazon` no tiene selector de ejercicio** y este sistema no publica ninguna sesion de
 * la que sacarlo: `GET /seguridad/sesion` es de #54 y no existe todavia. Cuando exista, el ejercicio
 * de trabajo saldra de ahi y este archivo se quedara como el valor por omision del que se parte —que
 * es exactamente lo que `rentas` tiene, con su `ejercicioDeTrabajo` llegando `null` medido—.
 */

/**
 * El ejercicio al que corresponde un instante: su ano, en la zona del puesto.
 *
 * En la zona del puesto y no en UTC a proposito: el ejercicio tributario es una fecha civil de la
 * municipalidad, y el 1 de enero a las 00:30 de Piura es 2027 aunque en UTC todavia sea 2026.
 *
 * @param instante el momento desde el que se mira. Entra como argumento: sin reloj dentro, esta
 *   funcion se puede probar con el reloj movido
 */
export function ejercicioDe(instante: Date): number {
  return instante.getFullYear();
}

/**
 * El ejercicio de trabajo, leido **una sola vez** al cargar el modulo.
 *
 * Es el que el Panel pregunta. No es un literal y no puede serlo: sale de {@link ejercicioDe}, y lo
 * comprueba `verificaciones/el-ejercicio-sale-del-reloj.test.ts` con el reloj movido a 2031.
 */
export const EJERCICIO_DE_TRABAJO: number = ejercicioDe(new Date());
