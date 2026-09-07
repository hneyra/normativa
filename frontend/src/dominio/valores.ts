/**
 * Los tipos que el sistema de diseno necesita del dominio.
 *
 * Son tres, y ninguno es una clase: lo que llega del backend es JSON, y envolverlo aqui
 * obligaria a desenvolverlo antes de cada peticion. Lo que si hacen es **nombrar** lo que
 * un `string` suelto no nombra.
 *
 * Viven en `src/dominio/` y no dentro de `src/ds/` porque no son del sistema de diseno:
 * son del sistema, y el proxy de datos (#13) va a servirlos igual. Un tipo que nace en la
 * carpeta de los componentes acaba importandose desde la capa de datos, que es como una
 * dependencia se invierte sin que nadie lo decida.
 */

/**
 * Una cifra decimal, tal como el backend la sirve: **texto, jamas `number`**.
 *
 * Regla 1 (RNF-055). En coma flotante `0.1 + 0.2` no es `0.30`, y el centimo se pierde
 * antes de llegar a la pantalla. Lo vigilan dos prohibiciones de ESLint
 * —`importe-declarado-number` y `importe-convertido-a-number`— con sus muestras.
 *
 * En ESTE sistema la cifra casi nunca es una deuda: es una UIT, una alicuota, un valor
 * unitario por metro cuadrado o un valor referencial de vehiculo. Todas son `NUMERIC` en la
 * base y `BigDecimal` en el backend, y el ultimo tramo tiene que respetarlas igual.
 *
 * El punto es el separador decimal y no hay separador de miles: `"104740.00"`. Lo que lleva
 * comas es lo que se MUESTRA, y de eso se encarga `formatearImporte`.
 */
export type Importe = string;

/**
 * Una fecha, en ISO 8601 y sin hora: `"2026-09-06"`.
 *
 * Sin hora a proposito. Una fecha de calculo con hora invita a construir un `Date`, y un
 * `Date` en el navegador arrastra la zona horaria del puesto: el mismo
 * `"2026-09-06T00:00:00Z"` es el 5 de septiembre en Lima. Como texto no hay nada que
 * interpretar mal.
 */
export type Fecha = string;

/**
 * El tono de una insignia: los cuatro de `const INS` del artboard.
 *
 * En castellano, que en el artboard estaban en ingles (`warn`, `bad`). Un tono **nunca**
 * viaja solo: `Insignia` exige tambien el texto, porque un estado que se comunica solo por
 * color no se comunica a quien no distingue ese color.
 */
export type Tono = 'ok' | 'atencion' | 'mal' | 'info';
