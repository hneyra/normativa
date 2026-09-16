import type { AccionesDelSistema } from '@kamayuk/shell';

/**
 * **Que hace cada accion del pie de una pantalla** — costura de #55, la llenan #58, #67 y #68.
 *
 * <h2>Vacio significa «no se puede pulsar», y eso es lo correcto hoy</h2>
 *
 * El `Armazon` declara `acciones?` como un `Partial`: **lo que no se pasa, no se puede pulsar**.
 * Con el objeto vacio no hay ni una accion habilitada, que es exactamente lo que este sistema
 * puede afirmar hoy — `AbrirConjuntoDeParametros.java:31-37` dice que abrir un conjunto «se
 * resuelve como proceso `batch` y no como un `POST`», y las tres escrituras por HTTP no existen
 * hasta ADR-0043 y #59.
 *
 * Una accion cableada a una funcion vacia seria peor que ninguna: el boton se dibuja, se pulsa y
 * no pasa nada, y quien lo pruebe no sabe si el fallo es suyo, de la red o del backend.
 *
 * <h2>Quien la llena</h2>
 *
 * · **#58** conecta lo que las cuatro hojas ofrecen al pie.
 * · **#67** la descarga del snapshot, con su `ETag` = `sha256` de los bytes comprobado en el
 *   navegador (la leccion de `c01fe9a:src/api/proxy.test.ts:342-368`).
 * · **#68** abrir, agregar y sellar desde Ediciones, cada una con su observacion y su
 *   `Idempotency-Key` (kamayuk-lib#57).
 */
export const ACCIONES: AccionesDelSistema = {};
