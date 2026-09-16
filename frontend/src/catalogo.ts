import type { Catalogo, ModuloDelCatalogo } from '@kamayuk/shell';
import { ICONOS, seEscribe, tipoDe, type NombreDeIcono } from '@kamayuk/ui';

import { t } from './i18n/i18n.ts';
import { ARBOL, type ClaveDeHoja } from './pantallas/arbol.ts';
import { pantallaDe } from './pantallas/definiciones/index.ts';

/**
 * **El catalogo de ESTE sistema**, en la forma que `@kamayuk/shell` entiende (#58, AC 3).
 *
 * <h2>Por que esta pieza existe</h2>
 *
 * Porque el armazon **no sabe que existe `normativa`**, y no puede: ADR-0030 §4 lo prohibe —«una
 * libreria comun no puede contener logica de negocio de un contexto»— y una guarda lo vigila del
 * otro lado. Asi que alguien tiene que traducir el modulo y las cuatro hojas de este sistema a la
 * forma generica, y ese alguien vive aqui. Es literalmente la costura del reparto.
 *
 * <h2>`seEscribe` sale del DATO, y por eso se calcula aqui</h2>
 *
 * El armazon decide las acciones del pie —«Limpiar» y «Guardar», o «Exportar» e «Imprimir»— segun
 * si la pantalla tiene algun campo que se escriba (`paquetes/shell/acciones.ts`). Esa pregunta solo
 * la puede contestar quien tiene las definiciones, o sea este sistema. Pasarla como bandera a mano
 * seria dejar la puerta abierta a una pantalla de solo lectura con un boton de guardar que no
 * guarda nada.
 *
 * **Y hay una consecuencia medida que hay que decir aqui**: `nor-cuadros` y `nor-publicacion` no
 * tienen mas campo que su desplegable de ambito, y un desplegable **se escribe**
 * —`seEscribe(tipo)` es `tipo !== 'r'`—, asi que las dos salen con «Limpiar» y «Guardar» al pie. Es
 * exactamente lo que hace el artboard —`editable = campos.some((c) => !c.esRo)`— y es la diferencia
 * N11 de `frontend/diseno/HUECOS.md`, fundida en H14a: un selector que gobierna una lectura no
 * deberia hacer editable la hoja. No se arregla aqui con una excepcion escrita a mano, porque una
 * excepcion asi no la veria ninguna guarda; se arregla cuando H14a llegue.
 *
 * <h2>Lo que este archivo NO hace</h2>
 *
 * **Filtrar por permisos** (#64) — traducir sus rotulos ya lo hace, desde #60. El armazon recibe el catalogo YA
 * filtrado —lo dice su javadoc— y quien lo filtra es quien sabe que puede abrir la cuenta, que es
 * quien tiene la sesion.
 *
 * <h2>El icono se DEDUCE del trazo, y no se escribe</h2>
 *
 * El arbol de este sistema guarda los trazos del artboard; el armazon quiere el NOMBRE de un icono
 * del catalogo de `@kamayuk/ui`. Un mapa a mano —`normativa: 'balanza'`, una linea— parece mas
 * simple y tiene el defecto de siempre: el dia que el artboard le cambie el icono al modulo, el
 * mapa sigue compilando y la pantalla dibuja el dibujo anterior. **En verde.**
 *
 * Deduciendolo del trazo no puede: si el dibujo del artboard deja de estar en el catalogo de la
 * libreria, esto **revienta al arrancar** diciendo que modulo y que trazo. G2 eligio `balanza`, que
 * ya esta en `ICONOS` —por eso `kamayuk-lib`#59 se cerro como no planeado—; nunca un trazo copiado
 * a mano en `normativa`.
 */

/** El nombre del icono cuyo dibujo es exactamente el del modulo. Revienta si no hay ninguno. */
function iconoDelTrazo(rotulo: string, trazos: readonly string[]): NombreDeIcono {
  const nombres = Object.keys(ICONOS) as NombreDeIcono[];
  const casa = nombres.find(
    (n) => ICONOS[n].length === trazos.length && ICONOS[n].every((d, i) => d === trazos[i]),
  );
  if (casa === undefined) {
    throw new Error(
      `El modulo «${rotulo}» dibuja un icono que «@kamayuk/ui» no publica.\n` +
        `  Trazos: ${trazos.join(' | ')}\n\n` +
        '  El dibujo entra primero en el catalogo de la libreria y de ahi se usa aqui — no al\n' +
        '  reves: un trazo suelto en un sistema es un icono que los otros tres no tienen.',
    );
  }
  return casa;
}

/** Si alguno de los campos de una hoja se escribe. Ver el javadoc: gobierna las acciones del pie. */
function laHojaSeEscribe(clave: ClaveDeHoja): boolean {
  return pantallaDe(clave).bloques.some((bloque) =>
    bloque.campos.some((campo) => seEscribe(tipoDe(campo.tipo))),
  );
}

/**
 * El slug con que se enlaza una hoja: su clave sin el prefijo del modulo.
 *
 * Es lo que el artboard escribe en su `const SLUGS` —`'nor-panel' -> 'panel'`—, y viene de la V6
 * (`NormativaV6.dc.html:1450-1455`). Se DERIVA en vez de transcribirse porque la forma posicional
 * del arbol no tiene donde llevarlo, y que la derivacion siga dando lo que el artboard dice lo
 * comprueba `verificaciones/pantallas-del-artboard.test.ts` contra esa misma constante.
 *
 * Que la clave valga igual —hay un solo modulo, asi que ninguna choca— no lo hace innecesario:
 * quien lee la barra de direcciones lee `#/panel` y no `#/nor-panel`, que es para lo que existe
 * `Destino.slug`.
 */
const slugDeLaHoja = (clave: string): string => clave.replace(/^nor-/, '');

export const CATALOGO: Catalogo = ARBOL.map(
  (modulo): ModuloDelCatalogo => ({
    clave: modulo.slug,
    // **Las tres cadenas que una persona LEE van por `t()` desde #60**, y como captadores: lo que
    // `src/aplicacion.tsx` pasa al armazon es este objeto, y quien lee sus propiedades es el marco
    // al pintar el carril, la paleta y la miga. Resolverlas al importar las congelaria en el idioma
    // del arranque. `clave`, `slug` e `icono` NO pasan por `t()` y no deben: son identificadores
    // —el slug viaja al hash— y traducirlos cambiaria la direccion de cada hoja.
    //
    // **Diferencia declarada con `rentas`**: alli los rotulos de los modulos los pisa
    // `GET /seguridad/modulos` y por eso NO se traducen (`traducirCatalogo`, `rentas`#105). Aqui el
    // catalogo sale entero del artboard V8 y no hay backend que lo pise —eso es #64—, asi que el
    // rotulo es texto de este sistema y se traduce como el resto.
    get rotulo() {
      return t(modulo.rotulo);
    },
    get nota() {
      return t(modulo.nota);
    },
    icono: iconoDelTrazo(modulo.rotulo, modulo.trazos),
    destinos: modulo.hojas.map((hoja) => ({
      clave: hoja.clave,
      get rotulo() {
        return t(hoja.rotulo);
      },
      slug: slugDeLaHoja(hoja.clave),
      seEscribe: laHojaSeEscribe(hoja.clave),
      // La barra gris de V8: que hay que HACER aqui. Vive en la definicion de la pantalla y no en
      // el arbol —dos registros paralelos por clave se desincronizan— y llega al marco por aqui
      // porque el marco no puede saberla.
      get instruccion() {
        return t(pantallaDe(hoja.clave).instruccion);
      },
    })),
  }),
);

/**
 * El **codigo de modulo** de cada entrada del catalogo, por su clave.
 *
 * El catalogo generico lleva `clave` —el slug, que es lo que viaja al hash— y el backend habla de
 * `codigo` —`NORMATIVA`—. Son dos identificadores del mismo modulo y ninguno de los dos sobra: el
 * slug es para la barra de direcciones y el codigo es el que el catalogo de seguridad del cluster
 * usa. La traduccion vive aqui porque es de este sistema, y es por donde #64 cruzara
 * `GET /seguridad/modulos` con el arbol.
 */
export const CODIGO_POR_CLAVE: ReadonlyMap<string, string> = new Map(
  ARBOL.map((modulo) => [modulo.slug, modulo.codigo]),
);
