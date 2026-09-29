/**
 * **Quien es la sesion y de que municipalidad, tal como lo contesta el backend** (#64).
 *
 * Tomada de `docs/50-api/seguridad/` el 2026-09-29.
 *
 * ARCHIVO GENERADO — no se edita a mano. Sale de
 * `docs/50-api/seguridad/{sesion,sesion-municipalidad}.json`,
 * que produce `LecturasDeSeguridadDePuntaAPuntaTest` de HTTP a PostgreSQL (#54). Lo escribe
 * `verificaciones/capturas-de-seguridad.ts` y lo compara `las-capturas-son-las-de-docs.test.ts`
 * en cada `yarn verificar`. Se regenera con `yarn capturas:regenerar`.
 *
 * **No lo importa ningun modulo de produccion de `src/`**, y se comprueba
 * (`la-siembra-es-solo-de-desarrollo.test.ts`): una captura usada como respaldo —`modulos ??
 * MODULOS_MEDIDOS`— devolveria un menu que no pregunto a nadie, y esta vez con una constante que
 * ademas parece medida. Lo leen las pruebas, el arnes y la siembra de `yarn dev`.
 */

import type { MunicipalidadResource, SesionResource } from '../src/datos/lecturas.ts';

/** El dia en que se tomaron las cinco de `docs/50-api/seguridad/`. La siembra lo dice. */
export const MEDIDA_EL = '2026-09-29';

/** `GET /seguridad/sesion`: la cuenta de la captura, resuelta a su fila de `usuario`. */
export const SESION_MEDIDA: SesionResource = {
  "usuarioId": 1,
  "cuenta": "jperez",
  "nombre": "Juan Perez Castillo",
  "ejercicioDeTrabajo": null
};

/** `GET /seguridad/sesion/municipalidad`: la municipalidad de la captura, por su UBIGEO. */
export const MUNICIPALIDAD_MEDIDA: MunicipalidadResource = {
  "id": 1,
  "ubigeo": "200601",
  "nombre": "Municipalidad Provincial de Sullana",
  "tipo": "PROVINCIAL"
};
