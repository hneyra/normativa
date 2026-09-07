/**
 * Un servidor de mentira **para las pruebas de las dos secciones**, y por que existe.
 *
 * El proxy de #13 sirve un juego de datos y **uno solo**: el del artboard, con su ejercicio
 * sellado. Es lo que hace falta para el camino que se recorre todos los dias, y por eso las
 * pruebas del camino feliz lo usan a el —piden por HTTP las rutas del contrato y las atiende el
 * mismo mecanismo que atendera en desarrollo—.
 *
 * Lo que el proxy **no puede** dar son los otros tres desenlaces de una lectura, y los tres hay
 * que dibujarlos (AC4): que el listado no llegue, que llegue el listado y no el detalle, y que
 * llegue vacio. No los puede dar porque no es su trabajo: `operaciones.ts` sirve un cuerpo fijo y
 * **no mira la peticion**, que es la propiedad de la que depende todo lo demas. Fingir alli un
 * `500` seria darle al proxy una forma de mentir.
 *
 * Asi que se sustituye el transporte, igual que hace el proxy, pero por rutas y con la respuesta
 * que la prueba quiera. Sigue siendo el camino entero: la URL se compone en `cliente.ts`, el
 * cuerpo `problem+json` se traduce a `ErrorDeLaApi` con su codigo del catalogo, y `useRecurso`
 * decide entre dato, carga y error. Lo unico simulado es quien contesta.
 *
 * **No es codigo de produccion y no viaja en el bundle**: solo lo importan archivos `.test.tsx`.
 */

import { PREFIJO } from '../api/cliente.ts';

/** Lo que se contesta a una ruta: un cuerpo, o la promesa que nunca se resuelve. */
export type RespuestaFingida =
  | { readonly estado?: number; readonly cuerpo: unknown }
  | 'nunca-contesta';

/** El sobre de paginacion del backend, con la pagina entera dentro. */
export function unaPagina<T>(contenido: readonly T[]): unknown {
  return {
    contenido,
    pagina: 0,
    tamano: contenido.length === 0 ? 20 : contenido.length,
    totalElementos: contenido.length,
    totalPaginas: contenido.length === 0 ? 0 : 1,
    hayMas: false,
  };
}

/** Un cuerpo `problem+json` como el que escribe `ManejadorDeErrores`. */
export function problema(codigo: string, estado: number, mensaje: string): RespuestaFingida {
  return {
    estado,
    cuerpo: {
      type: `https://sgtm.gob.pe/errores/${codigo.toLowerCase()}`,
      title: codigo,
      status: estado,
      codigo,
      mensaje,
      detail: mensaje,
    },
  };
}

/**
 * Compone el `fetch` que contesta esas rutas, **indexadas por su camino exacto**.
 *
 * Exacto y no por prefijo a proposito: `/seguridad/parametros/ejercicios/2026` empieza por
 * `/seguridad/parametros`, y con una comparacion por prefijo la lectura de sesion se comeria la
 * del listado — que son justamente las dos que el error parcial tiene que poder separar.
 *
 * Una ruta que no este declarada contesta 404 nombrandola, en vez de devolver `undefined`: una
 * prueba a la que se le olvido declarar una ruta tiene que verlo, no quedarse en blanco.
 */
export function servidorQueContesta(
  porRuta: Readonly<Record<string, RespuestaFingida>>,
): typeof fetch {
  return (entrada: RequestInfo | URL): Promise<Response> => {
    const url = new URL(
      typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url,
      'http://localhost',
    );
    const ruta = url.pathname.startsWith(PREFIJO)
      ? url.pathname.slice(PREFIJO.length)
      : url.pathname;
    const respuesta = porRuta[ruta];

    if (respuesta === undefined) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            codigo: 'NO_ENCONTRADO',
            status: 404,
            mensaje: `La prueba no declaro ninguna respuesta para «${ruta}».`,
          }),
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      );
    }

    if (respuesta === 'nunca-contesta') {
      return new Promise<Response>(() => {
        // A proposito: es como se mira el estado de carga sin depender de un temporizador.
      });
    }

    return Promise.resolve(
      new Response(JSON.stringify(respuesta.cuerpo), {
        status: respuesta.estado ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
}
