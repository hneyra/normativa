import type { Conector } from './conectores.ts';

/**
 * **Ediciones: su conector, puesto y vacio** (#63, AC 1 — lo llena #65).
 *
 * <h2>Por que existe hoy, vacio</h2>
 *
 * Por lo mismo que `src/datos/proveedor.tsx` existia vacio desde #55: para que #65 **no tenga que
 * tocar ningun archivo compartido**. `src/datos/conectores.ts` ya lo importa y ya lo coloca en
 * `CONECTORES['nor-ediciones']`, asi que lo unico que #65 cambia es el cuerpo de este archivo. Sin
 * esto, #65, #66 y #67 editarian los tres el mismo registro y se pisarian — la regla de la epica
 * #47, «Para que los issues de una ola no se pisen».
 *
 * <h2>Que pide esta hoja, medido contra lo publicado</h2>
 *
 * El arbol le declara tres operaciones (`src/pantallas/arbol.ts`), y las tres son claves de
 * `docs/50-api/formas-de-la-api.json` —lo comprueba `verificaciones/camino-a-la-api.test.ts`—:
 *
 *   · `GET /seguridad/parametros` — el listado paginado de conjuntos, con `ordenarPor` de lista
 *     blanca (`ejercicio`, `version`, `estado`, `id`) y `tamano` hasta 500. Ya declarado en
 *     `lecturas.ts` como `LISTADO_DE_CONJUNTOS`: #65 lo reusa, no lo reescribe.
 *   · `GET /seguridad/parametros/ejercicios/{ejercicio}` — el estado de un ejercicio. Tambien
 *     declarado ya.
 *   · `GET /conjuntos/{id}/snapshot?ambito=` — el snapshot descargable. `ambito` es
 *     **obligatorio**, y su forma publicada tiene cuatro colecciones dentro.
 *
 * <h2>Y lo que le falta, dicho aqui para que #65 no lo descubra tarde</h2>
 *
 * · **Ninguna lectura de un conjunto ABIERTO.** Es #56, que depende de #53 y de la revision G1
 *   (#75). Sin ella, «Ediciones» solo puede listar lo sellado.
 * · **Ninguna escritura.** Abrir, agregar y sellar son #59 —tres `POST` con `Idempotency-Key`— y la
 *   hoja que los usa es #68. Hasta entonces un boton que nadie atienda sale impedido con su motivo,
 *   nunca mudo.
 * · **Los campos, actos y prosa de `kamayuk-lib`#86**, que es lo que bloquea a #65 ademas de esto.
 */
export const EDICIONES: Conector | undefined = undefined;
