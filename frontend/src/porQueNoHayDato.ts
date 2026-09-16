import type { Ausencia } from '@kamayuk/ui';

import { laSirveElBackend, YA_SERVIDAS, type OperacionServida } from './datos/servidas.ts';
import type { Hoja, Operacion } from './pantallas/tipos.ts';

/**
 * **Por que una pantalla no tiene datos**, dicho con las palabras que corresponden a cada caso
 * (#63, AC 1).
 *
 * Calcado de `rentas/frontend/src/porQueNoHayDato.ts@ac379ac`, con **los casos de este sistema**,
 * que no son los mismos y estan medidos.
 *
 * <h2>Por que vive aqui y no en el interprete</h2>
 *
 * Porque cruza dos cosas que son de ESTE sistema: las operaciones que cada hoja declara y lo que su
 * backend publica y sirve. El interprete esta en `@kamayuk/ui` y no puede nombrar ninguna de las dos
 * —lo vigila `sin-suponer-un-sistema.test.ts` alli—; recibe el resultado ya redactado.
 *
 * <h2>Los tres casos NO son uno, y la diferencia esta medida sobre estas cuatro hojas</h2>
 *
 * <table>
 *   <tr><td><b>publicado y sin pedir</b></td><td>la hoja declara alguna lectura y el contrato la
 *     publica —lo comprueba `camino-a-la-api`, ruta a ruta—; lo que falta es el conector, y llega en
 *     su issue. <b>Son tres de las cuatro</b>: Ediciones (#65), Cuadros (#66) y Publicacion
 *     (#67)</td></tr>
 *   <tr><td><b>ejercido y sin pedir</b></td><td>ademas, alguien la ha visto contestar con un token
 *     (`YA_SERVIDAS`). <b>Hoy no le pasa a ninguna</b>, porque esa lista esta vacia — y por eso el
 *     caso se escribe y se prueba inyectando la lista, en vez de darse por supuesto</td></tr>
 *   <tr><td><b>nada que pedir</b></td><td>la hoja no declara ninguna operacion de lectura. No hay a
 *     quien preguntar, y decir «todavia no se pide» seria falso</td></tr>
 * </table>
 *
 * Meterlos en un «no hay datos» unico seria mentir por omision: «esta pantalla no tiene a quien
 * preguntar» y «esta pantalla tiene a quien preguntar y su conector llega en el issue siguiente»
 * son cosas distintas para quien tenga que arreglarlas.
 *
 * <h2>Y el cuarto caso —pedido y vacio— no lo produce este archivo</h2>
 *
 * Lo produce `useDatosDeLaHoja`, que es quien sabe que contesto. Aqui solo se contesta a las hojas
 * que **no piden**.
 */

/** Los verbos con los que se puede pedir algo para dibujarlo. */
const DE_LECTURA = new Set(['GET', 'BASE']);

/** Las operaciones de lectura que una hoja declara. */
export function lecturasDe(hoja: Hoja): readonly Operacion[] {
  return hoja.operaciones.filter((o) => DE_LECTURA.has(o.verbo));
}

/** Las lecturas de una hoja que ademas se han visto contestar con un token. */
export function lecturasEjercidas(
  hoja: Hoja,
  servidas: readonly OperacionServida[] = YA_SERVIDAS,
): readonly Operacion[] {
  return lecturasDe(hoja).filter((o) => laSirveElBackend(servidas, o.verbo, o.ruta));
}

/**
 * Las frases de este archivo, para el inventario de claves de traduccion.
 *
 * Aparte de las `Ausencia` porque `catalogo-de-claves.ts` necesita **cadenas**, y una `Ausencia`
 * lleva ademas su tono. Separarlas es lo que evita una segunda lista que se quede vieja: las tres
 * `Ausencia` de abajo se componen de aqui.
 */
export const FRASES_DE_LAS_AUSENCIAS = {
  publicadoEnElCampo: 'sin pedir',
  publicado:
    'Esta pantalla SI tiene operaciones publicadas por el backend, y todavia no las pide: su ' +
    'conector llega en su propio issue. Hasta entonces no se ensena una cifra de ejemplo, porque ' +
    'en un sistema que publica valores normativos una cifra se lee como real.',
  ejercidoEnElCampo: 'sin pedir',
  ejercido:
    'Alguien ya ha visto contestar a alguna de las operaciones de esta pantalla con un token de ' +
    'esta interfaz, y la pantalla todavia no las pide. Lo que se ve es su forma, no sus datos.',
  nadaEnElCampo: 'sin conectar',
  nada:
    'Esta pantalla no declara ninguna operacion de lectura: no hay a quien preguntar. Lo que se ' +
    've es su forma —que campos tiene y que columnas llevan sus listas—, no sus datos.',
} as const;

/** Las claves de traduccion de este archivo. */
export function clavesDeLasAusencias(): readonly string[] {
  return Object.values(FRASES_DE_LAS_AUSENCIAS);
}

const PUBLICADO_Y_SIN_PEDIR: Ausencia = {
  enElCampo: FRASES_DE_LAS_AUSENCIAS.publicadoEnElCampo,
  explicacion: FRASES_DE_LAS_AUSENCIAS.publicado,
  tono: 'atencion',
};

const EJERCIDO_Y_SIN_PEDIR: Ausencia = {
  enElCampo: FRASES_DE_LAS_AUSENCIAS.ejercidoEnElCampo,
  explicacion: FRASES_DE_LAS_AUSENCIAS.ejercido,
  tono: 'atencion',
};

const NADA_QUE_PEDIR: Ausencia = {
  enElCampo: FRASES_DE_LAS_AUSENCIAS.nadaEnElCampo,
  explicacion: FRASES_DE_LAS_AUSENCIAS.nada,
  tono: 'info',
};

/**
 * Que decir en una pantalla que no pide nada.
 *
 * @param hoja la del arbol, con sus operaciones declaradas
 * @param servidas la lista que rige; se puede inyectar para ejercer el caso que hoy no ocurre
 */
export function porQueNoHayDato(
  hoja: Hoja,
  servidas: readonly OperacionServida[] = YA_SERVIDAS,
): Ausencia {
  if (lecturasEjercidas(hoja, servidas).length > 0) return EJERCIDO_Y_SIN_PEDIR;
  if (lecturasDe(hoja).length > 0) return PUBLICADO_Y_SIN_PEDIR;
  return NADA_QUE_PEDIR;
}

export { PUBLICADO_Y_SIN_PEDIR, EJERCIDO_Y_SIN_PEDIR, NADA_QUE_PEDIR };
