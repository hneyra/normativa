import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **Las capturas de `/seguridad`, del JSON del backend al TypeScript de la interfaz** (#64, AC 6).
 *
 * <h2>Por que se GENERAN y no se escriben</h2>
 *
 * Las cinco respuestas las deja #54 en `docs/50-api/seguridad/`, y no las escribe nadie: las produce
 * `LecturasDeSeguridadDePuntaAPuntaTest` de HTTP a PostgreSQL —el filtro del inquilino, el guardia
 * y la transaccion de verdad— y las compara en cada corrida de `verificarAislamiento`. Son lo que el
 * backend CONTESTA. Copiarlas a mano aqui abriria una segunda verdad que se queda vieja el dia que
 * el backend regenere la suya, y `yarn dev` seguiria ensenando la de antes sin un solo error.
 *
 * Asi que el TypeScript es una SALIDA: lo escribe {@link generar} y lo compara
 * `las-capturas-son-las-de-docs.test.ts` byte a byte en cada `yarn verificar`. Se regenera con
 *
 *     yarn capturas:regenerar
 *
 * <h2>Por que TypeScript y no el JSON importado directamente</h2>
 *
 * Porque la siembra de desarrollo llega por un `import()` de `src/arranque.ts`, y lo que alcanza un
 * `import()` tiene que resolverse dentro del arbol del frontend: el contexto de la imagen
 * (`frontend/Dockerfile`) no lleva `docs/`. Un `.ts` generado vive dentro, se tipa contra los
 * testigos de `src/datos/lecturas.ts` y el compilador lo mira.
 *
 * <h2>Y por que son DOS archivos, en dos sitios</h2>
 *
 * · **`src/datos/seguridadMedida.ts`** — los modulos, los accesos y la matriz: el catalogo. Es el
 *   que nombra el AC 6 de #64, y el mismo sitio que en `rentas`.
 * · **`desarrollo/sesionMedida.ts`** — quien es la sesion y de que municipalidad. **Fuera de
 *   `src/`**, y a proposito: lleva el nombre de una municipalidad dentro, y G2 (#52) no deja que
 *   ninguno aparezca en `src/` — lo vigila `la-entidad-no-se-escribe.test.ts`, sin excepciones que
 *   tallar. `rentas` separa igual su `sesionMedida.ts`.
 *
 * <h2>Y con fecha</h2>
 *
 * Cada archivo dice en su cabecera el dia en que se tomo de `docs/`. La comparacion la ignora —si
 * no, `yarn verificar` saldria rojo cada manana—, y regenerar la reescribe. Como regenerar solo
 * hace falta cuando el JSON cambio, la fecha es la de la ultima vez que el backend cambio de forma.
 *
 * **En `src/datos/` va SOLO en el comentario**, y no es estetica: `el-ejercicio-sale-del-reloj`
 * prohibe un ano escrito como literal en la capa de datos, y una constante con la fecha lo es —
 * medido, salio rojo con «src/datos/seguridadMedida.ts: «2026»»—. La siembra, que la dice por la
 * consola, la lee de `desarrollo/sesionMedida.ts` (`MEDIDA_EL`), que esta fuera.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
export const FRONTEND = join(AQUI, '..');
export const CAPTURAS = join(FRONTEND, '../docs/50-api/seguridad');

/** Las cinco capturas, por el archivo de `docs/50-api/seguridad/` que las guarda. */
export const ARCHIVOS = {
  modulos: 'modulos.json',
  accesos: 'accesos.json',
  permisos: 'sesion-permisos.json',
  sesion: 'sesion.json',
  municipalidad: 'sesion-municipalidad.json',
} as const;

/** Donde se escribe cada salida, relativo a `frontend/`. */
export const DEL_CATALOGO = 'src/datos/seguridadMedida.ts';
export const DE_LA_SESION = 'desarrollo/sesionMedida.ts';

/** La linea de la cabecera con la fecha, que es lo unico que la comparacion no mira. */
export const LA_FECHA = /^ \* Tomada de `docs\/50-api\/seguridad\/` el (\d{4}-\d{2}-\d{2})\.$/m;

/** Una captura, leida de `docs/`. Se lee al llamar, nunca al importar. */
export function captura(nombre: keyof typeof ARCHIVOS): unknown {
  return JSON.parse(readFileSync(join(CAPTURAS, ARCHIVOS[nombre]), 'utf8')) as unknown;
}

/** El valor como literal de TypeScript: el JSON tal cual, sangrado a dos. */
const literal = (valor: unknown): string => JSON.stringify(valor, null, 2);

/** El dia de hoy, en la zona del puesto: `2026-09-29`. */
export function hoy(): string {
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${String(ahora.getFullYear())}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** La cabecera comun, con lo que hay que saber antes de tocar nada, y la fecha. */
function cabecera(que: string, deDonde: string, fecha: string): string {
  return [
    '/**',
    ` * **${que}** (#64).`,
    ' *',
    ` * Tomada de \`docs/50-api/seguridad/\` el ${fecha}.`,
    ' *',
    ' * ARCHIVO GENERADO — no se edita a mano. Sale de',
    ` * ${deDonde},`,
    ' * que produce `LecturasDeSeguridadDePuntaAPuntaTest` de HTTP a PostgreSQL (#54). Lo escribe',
    ' * `verificaciones/capturas-de-seguridad.ts` y lo compara `las-capturas-son-las-de-docs.test.ts`',
    ' * en cada `yarn verificar`. Se regenera con `yarn capturas:regenerar`.',
    ' *',
    ' * **No lo importa ningun modulo de produccion de `src/`**, y se comprueba',
    ' * (`la-siembra-es-solo-de-desarrollo.test.ts`): una captura usada como respaldo —`modulos ??',
    ' * MODULOS_MEDIDOS`— devolveria un menu que no pregunto a nadie, y esta vez con una constante que',
    ' * ademas parece medida. Lo leen las pruebas, el arnes y la siembra de `yarn dev`.',
    ' */',
  ].join('\n');
}

/**
 * Los dos archivos, tal como tienen que estar en el disco.
 *
 * @param fecha el dia que se escribe en `MEDIDA_EL`. Para comparar se pasa el del archivo que ya
 *   esta, y para regenerar, el de hoy.
 */
export function generar(fecha: string): Readonly<Record<string, string>> {
  const delCatalogo = [
    cabecera(
      'Las tres lecturas del catalogo de seguridad, tal como las contesta el backend',
      '`docs/50-api/seguridad/{modulos,accesos,sesion-permisos}.json`',
      fecha,
    ),
    '',
    'import type {',
    '  AccesoDelSistema,',
    '  ModuloDelSistema,',
    '  Paginado,',
    '  PermisosDeLaSesion,',
    "} from './lecturas.ts';",
    '',
    '/** `GET /seguridad/modulos`, entera: el envoltorio paginado tal como llego. */',
    `export const MODULOS_MEDIDOS: Paginado<ModuloDelSistema> = ${literal(captura('modulos'))};`,
    '',
    '/** `GET /seguridad/accesos`, entera: cada acceso con el `moduloId` que lo ata a su modulo. */',
    `export const ACCESOS_MEDIDOS: Paginado<AccesoDelSistema> = ${literal(captura('accesos'))};`,
    '',
    '/** `GET /seguridad/sesion/permisos`: la matriz de la cuenta de la captura. */',
    `export const PERMISOS_MEDIDOS: PermisosDeLaSesion = ${literal(captura('permisos'))};`,
    '',
  ].join('\n');

  const deLaSesion = [
    cabecera(
      'Quien es la sesion y de que municipalidad, tal como lo contesta el backend',
      '`docs/50-api/seguridad/{sesion,sesion-municipalidad}.json`',
      fecha,
    ),
    '',
    "import type { MunicipalidadResource, SesionResource } from '../src/datos/lecturas.ts';",
    '',
    '/** El dia en que se tomaron las cinco de `docs/50-api/seguridad/`. La siembra lo dice. */',
    `export const MEDIDA_EL = '${fecha}';`,
    '',
    '/** `GET /seguridad/sesion`: la cuenta de la captura, resuelta a su fila de `usuario`. */',
    `export const SESION_MEDIDA: SesionResource = ${literal(captura('sesion'))};`,
    '',
    '/** `GET /seguridad/sesion/municipalidad`: la municipalidad de la captura, por su UBIGEO. */',
    `export const MUNICIPALIDAD_MEDIDA: MunicipalidadResource = ${literal(captura('municipalidad'))};`,
    '',
  ].join('\n');

  return { [DEL_CATALOGO]: delCatalogo, [DE_LA_SESION]: deLaSesion };
}
