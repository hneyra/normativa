import type { AccionesDelSistema } from '@kamayuk/shell';
import { avisar } from '@kamayuk/ui';

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
 * · **`exportar`, `guardar` y `limpiar`** dicen que todavia no, y **por que**. Ninguna es una
 *   funcion vacia: un boton que se pulsa y no pasa nada se lee como una averia, y eso lo vigila
 *   `verificaciones/ninguna-opcion-del-menu-se-queda-muda.test.ts`.
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
 * · **#67** la descarga del snapshot, con su `ETag` = `sha256` de los bytes comprobado en el
 *   navegador (la leccion de `c01fe9a:src/api/proxy.test.ts:342-368`): ahi `exportar` deja de
 *   avisar y descarga.
 * · **#68** abrir, agregar y sellar desde Ediciones, cada una con su observacion y su
 *   `Idempotency-Key` (`kamayuk-lib`#57): ahi `guardar` y `limpiar` dejan de avisar.
 */

/** El aviso se dice UNA vez y con la razon dentro. Sin razon, «todavia no» no se distingue de roto. */
const todaviaNo = (que: string, porQue: string): void => {
  avisar(`${que} todavía no está conectado.`, { description: porQue });
};

export const ACCIONES: AccionesDelSistema = {
  imprimir: () => {
    window.print();
  },
  exportar: () => {
    todaviaNo(
      'Exportar',
      'El conjunto sellado se descarga entero por GET /conjuntos/{id}/snapshot, y lo que se guarda ' +
        'son esos mismos bytes con su ETag comprobado. Llega con normativa#67.',
    );
  },
  guardar: () => {
    todaviaNo(
      'Guardar',
      'Abrir una versión, agregar un parámetro y sellar son tres escrituras que este backend ' +
        'todavía no publica por HTTP (ADR-0043 y normativa#59). Llegan con normativa#68.',
    );
  },
  limpiar: () => {
    todaviaNo(
      'Limpiar',
      'Vaciaría el formulario, y no se puede deshacer. Se ofrece junto a Guardar, y guardar ' +
        'todavía no escribe nada: llega con normativa#68.',
    );
  },
};
