import type { AccionesDelSistema } from '@kamayuk/shell';
import { avisar } from '@kamayuk/ui';

import { guardarElSnapshot } from './datos/publicacion.ts';
import { t } from './i18n/i18n.ts';
import { FRASES_DEL_MARCO } from './i18n/textosDelMarco.ts';

/**
 * **Que hace cada accion del pie de una pantalla** — costura de #55, la llena #58 (AC 6).
 *
 * <h2>Lo minimo honesto, y por que eso es MAS que no pasarlas</h2>
 *
 * El `Armazon` declara `acciones?` como un `Partial`, y lo que no se pasa **se dibuja
 * deshabilitado** (`paquetes/shell/AccionesAlPie.tsx:48`). Deshabilitado es mudo: quien pulsa no
 * sabe si le falta un permiso, si la pantalla esta a medias o si la aplicacion esta rota. Es
 * exactamente lo que `frontend/diseno/HUECOS.md` llama H08 —«`aria-disabled` con motivo, nunca
 * `disabled`»—, y hasta que eso llegue lo que si se puede hacer es **decirlo**.
 *
 * Asi que las cuatro estan atendidas:
 *
 * · **`imprimir`** hace su trabajo entero sin backend, asi que lo hace.
 * · **`exportar`** descarga, **en la hoja de Publicacion** (#67): entrega los bytes cuyo `sha256` se
 *   comparo contra el `ETag`, con `entregarAlNavegador`. En las otras tres dice que todavia no.
 * · **`guardar` y `limpiar`** dicen que todavia no, y **por que**. Ninguna es una funcion vacia: un
 *   boton que se pulsa y no pasa nada se lee como una averia, y eso lo vigila
 *   `verificaciones/ninguna-opcion-del-menu-se-queda-muda.test.ts`.
 *
 * <h2>Y hay que decir que hoy ese `exportar` NO SE VE en la hoja que lo usa</h2>
 *
 * El armazon decide el par de acciones del pie con `seEscribe` —«Limpiar» y «Guardar» si algun campo
 * se escribe, «Exportar» e «Imprimir» si no— y **Publicacion tiene un desplegable de ambito**, asi
 * que su pie ofrece el primer par (`src/catalogo.ts`, `laHojaSeEscribe`). Es la diferencia N11 de
 * `frontend/diseno/HUECOS.md`, fundida en H14a: un selector que gobierna una lectura no deberia
 * hacer editable la hoja, y mientras no lo arregle H14a —que cambia tambien el artboard— el boton
 * «Exportar» no aparece ahi.
 *
 * Por eso #67 pone la descarga **en los dos sitios**: la accion del bloque «La respuesta», que SI se
 * ve y es la que la hoja usa, y esta del pie, que hace exactamente lo mismo y queda lista para el
 * dia que H14a la haga aparecer. No se escribe dos veces: las dos llaman a `guardarElSnapshot()`.
 *
 * <h2>Y por que no escriben, medido</h2>
 *
 * `AbrirConjuntoDeParametros.java:31-37` dice que abrir un conjunto «se resuelve como proceso
 * `batch` y no como un `POST`», y las tres escrituras por HTTP —abrir, agregar y sellar— no existen
 * hasta ADR-0043 y #59. La descarga del snapshot con su `ETag` comprobado en el navegador es #67, y
 * guardar los bytes verificados como archivo es el hueco H30a, que `kamayuk-lib`#86 todavia no
 * publica.
 *
 * <h2>Quien la vuelve a tocar</h2>
 *
 * · **#68** abrir, agregar y sellar desde Ediciones, cada una con su observacion y su
 *   `Idempotency-Key` (`kamayuk-lib`#57): ahi `guardar` y `limpiar` dejan de avisar.
 */

/**
 * **Lo que las tres dicen, en castellano, que es la clave** (#60).
 *
 * El titulo lleva el nombre del boton **dentro** y por eso es interpolacion y no concatenacion: en
 * otro idioma el nombre no cae necesariamente al principio, y partir la frase en dos cadenas lo
 * decidiria por el traductor.
 *
 * Y ese nombre sale de `FRASES_DEL_MARCO`, que es de donde sale el rotulo del boton que se acaba de
 * pulsar: escribirlo aqui otra vez seria la misma palabra en dos sitios, traducida en uno — y el dia
 * que el marco dijera «Descargar», el aviso seguiria diciendo «Exportar».
 */
export const FRASES_DE_LAS_ACCIONES = {
  titulo: '{{que}} todavía no está conectado.',
  exportar:
    'Sólo la hoja de Publicación tiene algo que exportar: el conjunto sellado entero, por ' +
    'GET /conjuntos/{{llaves}}/snapshot, con su ETag comprobado sobre los bytes. Las demás no ' +
    'piden ningún documento.',
  guardar:
    'Abrir una versión, agregar un parámetro y sellar son tres escrituras que este backend ' +
    'todavía no publica por HTTP (ADR-0043 y normativa#59). Llegan con normativa#68.',
  limpiar:
    'Vaciaría el formulario, y no se puede deshacer. Se ofrece junto a Guardar, y guardar ' +
    'todavía no escribe nada: llega con normativa#68.',
} as const;

/**
 * **La ruta lleva llaves, y las llaves son la sintaxis de la interpolacion de i18next.**
 *
 * `GET /conjuntos/{id}/snapshot` es como se escribe una ruta con sujeto, y es lo que hay que poder
 * leer. Pasada por `t()` tal cual, i18next ve `{id}` y **no** lo toca —su marca son DOS llaves—,
 * pero un traductor que escriba `{{id}}` sin querer se encontraria con un hueco vacio. Asi que el
 * trozo entra como dato, y la clave no contiene ninguna llave suelta.
 */
const LLAVES_DE_LA_RUTA = '{id}';

/**
 * La hoja cuyo `exportar` descarga de verdad.
 *
 * Es la clave del destino, que es **lo unico** que `@kamayuk/shell` le pasa a una accion del pie
 * (`AccionesAlPie.tsx:50`). Escrita aqui como literal y cruzada contra el arbol por
 * `verificaciones/ninguna-opcion-del-menu-se-queda-muda.test.ts`: una clave que no fuera de ninguna
 * hoja dejaria el `exportar` avisando en las cuatro, en silencio.
 */
const LA_HOJA_QUE_EXPORTA = 'nor-publicacion';

/** El aviso se dice UNA vez y con la razon dentro. Sin razon, «todavia no» no se distingue de roto. */
const todaviaNo = (que: string, porQue: string): void => {
  avisar(t(FRASES_DE_LAS_ACCIONES.titulo, { que: t(que) }), { description: porQue });
};

export const ACCIONES: AccionesDelSistema = {
  imprimir: () => {
    window.print();
  },
  exportar: (clave: string) => {
    // En Publicacion se entrega lo verificado —y si no hay nada verificado, `guardarElSnapshot`
    // avisa con el motivo—. En las otras tres no hay documento que pedir, y se dice.
    if (clave === LA_HOJA_QUE_EXPORTA) {
      guardarElSnapshot();
      return;
    }
    todaviaNo(
      FRASES_DEL_MARCO.exportar,
      t(FRASES_DE_LAS_ACCIONES.exportar, { llaves: LLAVES_DE_LA_RUTA }),
    );
  },
  guardar: () => {
    todaviaNo(FRASES_DEL_MARCO.guardar, t(FRASES_DE_LAS_ACCIONES.guardar));
  },
  limpiar: () => {
    todaviaNo(FRASES_DEL_MARCO.limpiar, t(FRASES_DE_LAS_ACCIONES.limpiar));
  },
};
