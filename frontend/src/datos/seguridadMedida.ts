/**
 * **Las tres lecturas del catalogo de seguridad, tal como las contesta el backend** (#64).
 *
 * Tomada de `docs/50-api/seguridad/` el 2026-09-29.
 *
 * ARCHIVO GENERADO — no se edita a mano. Sale de
 * `docs/50-api/seguridad/{modulos,accesos,sesion-permisos}.json`,
 * que produce `LecturasDeSeguridadDePuntaAPuntaTest` de HTTP a PostgreSQL (#54). Lo escribe
 * `verificaciones/capturas-de-seguridad.ts` y lo compara `las-capturas-son-las-de-docs.test.ts`
 * en cada `yarn verificar`. Se regenera con `yarn capturas:regenerar`.
 *
 * **No lo importa ningun modulo de produccion de `src/`**, y se comprueba
 * (`la-siembra-es-solo-de-desarrollo.test.ts`): una captura usada como respaldo —`modulos ??
 * MODULOS_MEDIDOS`— devolveria un menu que no pregunto a nadie, y esta vez con una constante que
 * ademas parece medida. Lo leen las pruebas, el arnes y la siembra de `yarn dev`.
 */

import type {
  AccesoDelSistema,
  ModuloDelSistema,
  Paginado,
  PermisosDeLaSesion,
} from './lecturas.ts';

/** `GET /seguridad/modulos`, entera: el envoltorio paginado tal como llego. */
export const MODULOS_MEDIDOS: Paginado<ModuloDelSistema> = {
  "contenido": [
    {
      "id": 1,
      "codigo": "SEGURIDAD",
      "nombre": "Seguridad",
      "orden": 0,
      "activo": true
    },
    {
      "id": 2,
      "codigo": "NORMATIVA",
      "nombre": "Normativa",
      "orden": 0,
      "activo": true
    }
  ],
  "pagina": 0,
  "tamano": 20,
  "totalElementos": 2,
  "totalPaginas": 1,
  "hayMas": false
};

/** `GET /seguridad/accesos`, entera: cada acceso con el `moduloId` que lo ata a su modulo. */
export const ACCESOS_MEDIDOS: Paginado<AccesoDelSistema> = {
  "contenido": [
    {
      "id": 2,
      "moduloId": 2,
      "tipo": "OPCION_MENU",
      "codigo": "conjuntos",
      "nombre": "Conjuntos de parametros",
      "activo": true
    },
    {
      "id": 1,
      "moduloId": 1,
      "tipo": "OPCION_MENU",
      "codigo": "parametros",
      "nombre": "Parametros del sistema",
      "activo": true
    }
  ],
  "pagina": 0,
  "tamano": 20,
  "totalElementos": 2,
  "totalPaginas": 1,
  "hayMas": false
};

/** `GET /seguridad/sesion/permisos`: la matriz de la cuenta de la captura. */
export const PERMISOS_MEDIDOS: PermisosDeLaSesion = {
  "conjuntos": [
    "lectura"
  ],
  "parametros": [
    "lectura"
  ]
};
