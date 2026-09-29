import { vi } from 'vitest';

import { MUNICIPALIDAD_MEDIDA, SESION_MEDIDA } from '../desarrollo/sesionMedida.ts';
import {
  ACCESOS_MEDIDOS,
  MODULOS_MEDIDOS,
  PERMISOS_MEDIDOS,
} from '../src/datos/seguridadMedida.ts';

/**
 * **Las cinco lecturas de `/seguridad` contestadas con las capturas, en jsdom** (#64).
 *
 * Es el `e2e/instalacion.ts` de las pruebas que montan la aplicacion sin navegador. Desde #64 el
 * armazon no se monta hasta que las tres lecturas del catalogo digan que puede abrir la cuenta, asi
 * que toda prueba que mire una hoja tiene que contestarlas — y contestarlas con lo que el backend
 * CONTESTA, no con un doble inventado: un doble inventado probaria que la aplicacion hace lo que el
 * doble dice, y esto prueba que hace lo correcto con lo que llega de verdad.
 *
 * Lo que no es de `/seguridad` **se rechaza como un corte de red**, igual que lo hacian estas mismas
 * pruebas antes de #64 —«el arnes no deja salir ninguna peticion»—: las hojas siguen pidiendo y
 * fallando, que es lo que dibujan cuando no hay backend.
 *
 * Se pone con `vi.stubGlobal` y se quita con `vi.unstubAllGlobals()` en el `afterEach` de quien lo
 * use. Y la cache de consultas es de MODULO: quien monte la aplicacion dos veces tiene que llamar a
 * `CONSULTAS.clear()` entre medias, o la segunda leera lo que contesto la primera.
 */

/** Lo que el arnes contesta cuando la peticion no es de `/seguridad`. Un corte, no un 404. */
export const NADIE_CONTESTA = new TypeError('el arnes no deja salir ninguna peticion');

/** La raiz de la API, que el cliente de `@kamayuk/api` pone delante de cada ruta. */
const RAIZ = '/normativa/api/v1';

/** Las cinco, por su operacion en el contrato, con lo que contestan por omision. */
export const LAS_CINCO = {
  'GET /seguridad/modulos': MODULOS_MEDIDOS,
  'GET /seguridad/accesos': ACCESOS_MEDIDOS,
  'GET /seguridad/sesion/permisos': PERMISOS_MEDIDOS,
  'GET /seguridad/sesion': SESION_MEDIDA,
  'GET /seguridad/sesion/municipalidad': MUNICIPALIDAD_MEDIDA,
} as const;

export type LecturaDeSeguridad = keyof typeof LAS_CINCO;

/** Como se contesta una de las cinco en vez de con su captura. */
export type Contestacion =
  | { readonly estado: number; readonly cuerpo?: unknown }
  | { readonly sinRed: true };

/** La operacion de una URL que salio, o `undefined` si no es de `/seguridad`. */
function operacionDe(url: string): LecturaDeSeguridad | undefined {
  const camino = new URL(url, 'http://localhost').pathname;
  if (!camino.startsWith(RAIZ)) return undefined;
  const operacion = `GET ${camino.slice(RAIZ.length)}`;
  return operacion in LAS_CINCO ? (operacion as LecturaDeSeguridad) : undefined;
}

/** Un `problem+json` como el que manda el backend, con su `codigo`. */
function problema(estado: number, codigo: string): Response {
  return new Response(
    JSON.stringify({ status: estado, title: codigo, codigo, mensaje: `El arnes contesto ${codigo}` }),
    { status: estado, headers: { 'content-type': 'application/problem+json' } },
  );
}

/**
 * Sustituye `fetch` por el arnes y devuelve la lista viva de URL que se pidieron.
 *
 * @param cambios lo que contesta alguna de las cinco en vez de su captura: otro cuerpo, otro estado
 *   o un corte de red.
 */
export function contestarLaSeguridad(
  cambios: Partial<Record<LecturaDeSeguridad, Contestacion>> = {},
): { readonly pedidas: string[] } {
  const pedidas: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((entrada) => {
      const url = entrada instanceof Request ? entrada.url : String(entrada);
      pedidas.push(url);
      const operacion = operacionDe(url);
      if (operacion === undefined) return Promise.reject(NADIE_CONTESTA);

      const cambio = cambios[operacion];
      if (cambio !== undefined && 'sinRed' in cambio) return Promise.reject(NADIE_CONTESTA);
      if (cambio !== undefined && cambio.estado >= 400) {
        return Promise.resolve(problema(cambio.estado, cambio.estado === 403 ? 'SIN_PRIVILEGIO' : 'ERROR'));
      }
      const cuerpo = cambio?.cuerpo ?? LAS_CINCO[operacion];
      return Promise.resolve(
        new Response(JSON.stringify(cuerpo), {
          status: cambio?.estado ?? 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
  return { pedidas };
}

/** Las de `/seguridad` que se pidieron, de una lista de URL. */
export function deSeguridad(pedidas: readonly string[]): readonly string[] {
  return pedidas.filter((url) => operacionDe(url) !== undefined);
}
