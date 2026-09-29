import { ErrorDeLaApi, type ParametroQueFalta } from '@kamayuk/api';
import type { Ausencia } from '@kamayuk/ui';

import { cliente } from '../api/cliente.ts';
import { t } from '../i18n/i18n.ts';
import { CONJUNTO_VIGENTE, rutaDe, type ConjuntoVigenteResource } from './lecturas.ts';

/**
 * **«Ese ejercicio no esta publicado» es una RESPUESTA, y se decide aqui, una vez para las dos
 * hojas** (#97; AC 6 de #66 y AC 8 de #67).
 *
 * <h2>Dos 404 que llegan con el mismo `codigo`, y lo unico que los separa</h2>
 *
 * `GET /conjuntos?ejercicio=` contesta **404 `NO_ENCONTRADO`** en dos casos que no tienen nada que
 * ver:
 *
 * <table>
 *   <tr><td><b>el ejercicio no tiene conjunto sellado</b></td><td>`FaltaPublicar.noEncontrado`
 *     (`SnapshotController.java:97-101`). Lleva el miembro `parametroQueFalta` —`{ejercicio}`, sin
 *     `llave`, porque lo que falta es el conjunto entero (`ParametroQueFalta.comoMiembro()`)—. No
 *     es una averia ni un error de quien pregunta: el sistema contesto lo que hay, y lo que hay es
 *     nada sellado. Se arregla componiendo y sellando un conjunto, en Ediciones</td></tr>
 *   <tr><td><b>la ruta no existe</b></td><td>un 404 sin ese miembro: un despliegue que no sirve la
 *     operacion, un prefijo mal puesto. Eso SI es un fallo, y lo clasifica la escalera de
 *     `@kamayuk/sesion` como `no-encontrado`</td></tr>
 * </table>
 *
 * El backend lo dice asi y no de otro modo: «Ni el estado ni el mensaje le dicen a un programa que
 * hacer: eso lo dice el miembro» (`FaltaPublicar.java`, javadoc de `noEncontrado`). Por eso
 * {@link faltaPublicar} lee **`parametroQueFalta`** y nunca el `mensaje`: el `mensaje` es castellano
 * para una persona, y se reescribe en cuanto alguien lo lee en voz alta.
 *
 * <h2>Por que hasta el 2026-09-22 no se podia, y desde entonces si</h2>
 *
 * `ErrorDeLaApi` de `@kamayuk/api` tiraba el miembro en su constructor, y los dos 404 llegaban a la
 * pantalla indistinguibles. #66 y #67 lo dejaron escrito como criterio que esperaba. Lo conserva
 * desde `kamayuk-lib`#52 (PR `kamayuk-lib`#96, mezcla `a6ea6fa`, 2026-09-22): medido el 2026-09-29
 * sobre `kamayuk-lib@da5e3d9`, `paquetes/api/errores.ts:199-215` lo guarda tal como llego y sin
 * interpretarlo — «que hacer con el es de la pantalla (`normativa`#66 y #67)», dice su escalera.
 *
 * <h2>Por que es UNA respuesta y no un fallo con otro texto</h2>
 *
 * Porque un fallo, aunque se pinte en `atencion`, dice «esto no salio». Es la misma decision que el
 * Panel tomo con `sellado: false` (`src/datos/panel.ts`, «que "sin sellar" NO es un error»), y la
 * que la V6 tomaba aqui: lo pintaba «como vacio con salida y no como averia»
 * (`frontend/diseno/HUECOS.md`, H32a). Asi que {@link pedirElConjuntoVigente} **resuelve** con
 * {@link EjercicioSinPublicar} en vez de lanzar, la lectura queda `con-datos`, y cada conector
 * reparte ese dato: la frase de arriba en `atencion` ({@link AUSENCIA_SIN_PUBLICAR}), los huecos que
 * dicen «sin conjunto sellado» y ni una peticion de snapshot, que no tendria `conjuntoId` que llevar.
 *
 * <h2>Por que en un archivo aparte, y no dos veces</h2>
 *
 * Cuadros y Publicacion piden la misma identidad con la misma peticion. Si cada una leyera el
 * miembro por su cuenta habria dos traducciones de la misma respuesta, y dos que tienen que
 * coincidir son dos que un dia dejan de coincidir. Aqui estan la lectura del miembro, la peticion y
 * las frases; los conectores solo deciden **donde** va cada cosa en su hoja.
 *
 * Y no vive en `useDatosDeLaHoja`, que es donde se distinguen los FALLOS (#63, AC 4): esto no es un
 * fallo. Ahi sigue pasando lo de siempre —el 404 de ruta llega como `ErrorDeLaApi` y la escalera
 * lo clasifica—, sin una rama nueva sobre el estado ni sobre el codigo.
 */

/**
 * Lo que falta publicar, si el fallo es el 404 de «ese ejercicio no esta publicado»; si no, `null`.
 *
 * **404 y el miembro, los dos.** El miembro solo tambien sale en un 422 —`FaltaPublicar.problema`,
 * el de un CALCULO que no se pudo hacer—, y eso no es «no esta publicado» sino «no se pudo
 * ejecutar», que es otra respuesta con otro remedio. Y el 404 solo es el de ruta. Es lo que la V6
 * comprobaba (`c01fe9a:frontend/src/secciones/publicacion.ts:358`, `fallo.estado === 404 &&
 * fallo.faltaUnaCifraNormativa`).
 *
 * **Nunca el `mensaje`**: ver el docblock de arriba. Pura, sin red y sin reloj.
 */
export function faltaPublicar(fallo: unknown): ParametroQueFalta | null {
  if (!(fallo instanceof ErrorDeLaApi) || fallo.estado !== 404) return null;
  return fallo.parametroQueFalta;
}

/** La respuesta de «ese ejercicio no esta publicado», con lo que el backend dijo que falta. */
export interface EjercicioSinPublicar {
  readonly sinPublicar: ParametroQueFalta;
}

/** Si lo que llego a una hoja es esta respuesta y no la identidad del conjunto. */
export function esSinPublicar(llegado: unknown): llegado is EjercicioSinPublicar {
  return typeof llegado === 'object' && llegado !== null && 'sinPublicar' in llegado;
}

/**
 * `GET /conjuntos?ejercicio=`: la identidad del conjunto que rige, **o la respuesta de que no hay
 * ninguno sellado**.
 *
 * Lo demas se lanza tal cual —el 404 de ruta, un 403, un 500—, y lo clasifica `useDatosDeLaHoja`
 * con la escalera. Aqui no se traduce ningun otro fallo: seria la traduccion paralela que #63
 * prohibe.
 */
export async function pedirElConjuntoVigente(
  senal: AbortSignal,
): Promise<ConjuntoVigenteResource | EjercicioSinPublicar> {
  try {
    return await cliente.solicitar<ConjuntoVigenteResource>(rutaDe(CONJUNTO_VIGENTE), { senal });
  } catch (fallo) {
    const falta = faltaPublicar(fallo);
    if (falta === null) throw fallo;
    return { sinPublicar: falta };
  }
}

/**
 * Lo que se dice de un ejercicio sin publicar, **las mismas palabras en las dos hojas**.
 *
 * Castellano, que es la clave (#60). `enElCampo` y `explicacion` son la AUSENCIA de la hoja, y las
 * traduce el interprete, asi que no llevan ningun dato dentro. `elEjercicio` lleva el ano **que
 * dijo el miembro** —no el del reloj de este puesto—, y por eso va en los sitios de DATO de cada
 * hoja, traducido aqui con `t()`, igual que el resto de lo que un conector compone.
 */
export const FRASES_DEL_EJERCICIO_SIN_PUBLICAR = {
  enElCampo: 'sin conjunto sellado',
  explicacion:
    'El ejercicio por el que pregunta esta hoja no tiene un conjunto de parámetros sellado, y eso es una respuesta y no una avería: el backend contestó 404 con el miembro «parametroQueFalta», que es como dice «no está publicado» y lo único que lo separa de una ruta que no existe. No hay nada que reintentar ni que corregir aquí: hace falta componer y sellar un conjunto para ese ejercicio, en Ediciones.',
  elEjercicio: 'El ejercicio {{ejercicio}} no tiene un conjunto de parámetros sellado.',
} as const;

/** Las claves de traduccion de este archivo. */
export function clavesDelEjercicioSinPublicar(): readonly string[] {
  return Object.values(FRASES_DEL_EJERCICIO_SIN_PUBLICAR);
}

/**
 * La frase de arriba de una hoja que pregunto por un ejercicio sin publicar.
 *
 * `atencion` y no `info`: alguien tiene que hacer algo —sellar un conjunto— para que esta hoja
 * ensene lo que existe para ensenar. Y no `mal`, que es el de una averia.
 */
export const AUSENCIA_SIN_PUBLICAR: Ausencia = {
  enElCampo: FRASES_DEL_EJERCICIO_SIN_PUBLICAR.enElCampo,
  explicacion: FRASES_DEL_EJERCICIO_SIN_PUBLICAR.explicacion,
  tono: 'atencion',
};

/** «El ejercicio N no tiene un conjunto de parametros sellado», con el `N` del miembro. */
export function elEjercicioSinPublicar(falta: ParametroQueFalta): string {
  return t(FRASES_DEL_EJERCICIO_SIN_PUBLICAR.elEjercicio, { ejercicio: falta.ejercicio });
}
