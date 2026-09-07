import { useEffect, useState } from 'react';

import { ErrorDeLaApi, type SnapshotVerificado } from '../api/cliente.ts';
import {
  pedirCalculo,
  pedirLista,
  pedirSnapshotDe,
  pedirUno,
  type SnapshotResource,
} from './lecturas.ts';

/**
 * **Los tres nombres empiezan por `use` y no por `usar`, y es la excepcion declarada de la regla
 * del idioma.** «Ingles en lo tecnico»: un hook es una pieza de React, y el prefijo `use` no es
 * una convencion de estilo sino **el contrato que permite comprobar las reglas de los hooks**.
 * Con `usarUno`, `react-hooks/rules-of-hooks` no reconoce la funcion como hook y falla el lint
 * —«React Hook "useState" is called in function "usarPeticion" that is neither a React function
 * component nor a custom React Hook function»—: la regla deja de poder vigilar que no se llamen
 * dentro de una condicion, que es el defecto que existe para impedir.
 */

/**
 * Lo que una pantalla sabe de un dato que pidio: si llego, si sigue en camino, o por que no.
 *
 * **Los tres estados son obligatorios**, y por eso son un tipo y no tres `useState` sueltos en
 * cada seccion. Una pantalla que solo distingue «tengo dato» de «no tengo» ensena el vacio
 * mientras carga y ensena **ese mismo vacio** cuando el backend contesta 500. En este sistema esa
 * confusion es especialmente cara: «este ejercicio no tiene conjunto sellado» es una respuesta
 * legitima —hoy la de todas las municipalidades— y «no pude preguntarlo» es una averia, y las
 * dos se arreglan de maneras distintas.
 */
export interface Recurso<T> {
  readonly dato: T | null;
  readonly cargando: boolean;
  readonly error: string | null;
  /**
   * El fallo tal cual, cuando lo que fallo fue la API.
   *
   * `error` es lo que se ENSENA y esto es lo que se DECIDE con. Hacen falta los dos: el texto ya
   * lleva el codigo delante y sirve para dictarlo por telefono, pero no lleva el miembro
   * `parametroQueFalta`, y ese miembro es **lo unico que separa dos 404 que se arreglan de
   * maneras opuestas** — «ese ejercicio no esta publicado», que se arregla componiendo y
   * sellando el conjunto, y «esa ruta no existe», que no lo arregla nadie desde la pantalla
   * (`FaltaPublicar`, cuyo javadoc dice que esa diferencia «es lo unico que los separa»).
   *
   * Nulo cuando no hubo fallo, y tambien cuando el que hubo no vino de la API: un fallo que no
   * es un `ErrorDeLaApi` no tiene codigo del catalogo que leer.
   */
  readonly fallo: ErrorDeLaApi | null;
}

/**
 * Lo que se le dice al usuario cuando la peticion no salio.
 *
 * El **codigo** va delante del texto, no el estado a secas: es lo estable, y es lo que permite
 * que quien atiende diga cual de las averias es sin leer prosa. `SIN_PRIVILEGIO` y
 * `NO_ENCONTRADO` son los dos 403/404 que mas se parecen en pantalla y menos en el arreglo.
 */
function mensajeDe(fallo: unknown): string {
  if (fallo instanceof ErrorDeLaApi) {
    return `${fallo.codigo} (${String(fallo.estado)}): ${fallo.message}`;
  }
  return 'El sistema no pudo contestar. Reintente en unos segundos.';
}

/**
 * El estado inicial: nada, y cargando.
 *
 * `cargando` empieza en `true` cuando hay ruta porque el efecto todavia no ha corrido; con
 * `false` la pantalla parpadearia su estado vacio en el primer fotograma.
 */
function alEmpezar<T>(hayRuta: boolean): Recurso<T> {
  return { dato: null, cargando: hayRuta, error: null, fallo: null };
}

/**
 * Pide `ruta` y devuelve su estado. Con `ruta` nula no pide nada.
 *
 * La ruta nula no es un caso raro: es como se encadenan dos peticiones —el snapshot necesita el
 * `conjuntoId` que resuelve `GET /conjuntos?ejercicio=`— **sin romper la regla de los hooks**.
 * El efecto se rehace cuando cambia la ruta y **aborta la anterior**: sin eso, pasar por tres
 * ediciones seguidas deja tres peticiones vivas y la que pinta la ficha es la que conteste
 * ultima, que no tiene por que ser la de la edicion elegida.
 */
function usePeticion<T>(
  ruta: string | null,
  pedir: (ruta: string, senal: AbortSignal) => Promise<T>,
): Recurso<T> {
  const [estado, fijar] = useState<Recurso<T>>(() => alEmpezar<T>(ruta !== null));

  useEffect(() => {
    if (ruta === null) {
      fijar({ dato: null, cargando: false, error: null, fallo: null });
      return;
    }

    const control = new AbortController();
    let vivo = true;
    fijar({ dato: null, cargando: true, error: null, fallo: null });

    pedir(ruta, control.signal).then(
      (dato) => {
        if (vivo) {
          fijar({ dato, cargando: false, error: null, fallo: null });
        }
      },
      (fallo: unknown) => {
        // Abortar no es fallar: es que la pantalla ya no quiere esa respuesta.
        if (vivo && !control.signal.aborted) {
          fijar({
            dato: null,
            cargando: false,
            error: mensajeDe(fallo),
            fallo: fallo instanceof ErrorDeLaApi ? fallo : null,
          });
        }
      },
    );

    return () => {
      vivo = false;
      control.abort();
    };
    // `pedir` es una de las tres funciones de modulo de abajo y no cambia nunca; meterla en las
    // dependencias obligaria a envolverla en `useCallback` en cada llamada sin cambiar nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  return estado;
}

/** Pide una operacion que contesta un objeto. */
export function useUno<T>(ruta: string | null): Recurso<T> {
  return usePeticion<T>(ruta, (donde, senal) => pedirUno<T>(donde, senal));
}

/** Pide una operacion paginada y devuelve su contenido. */
export function useLista<T>(ruta: string | null): Recurso<readonly T[]> {
  return usePeticion<readonly T[]>(ruta, (donde, senal) => pedirLista<T>(donde, senal));
}

/**
 * Pide una operacion que el contrato publica como `POST`. Ver `pedirCalculo`.
 *
 * **Hoy este sistema no tiene ninguna lectura por `POST`**, y esta medido: cero `@PostMapping`
 * en todo `src/main`. Las tres que existen son las **escrituras simuladas** de `simulados.ts`, y
 * por aqui se ejercen: con `ruta` nula no piden nada, y elegir otra edicion aborta la anterior.
 */
export function useCalculo<T>(ruta: string | null): Recurso<T> {
  return usePeticion<T>(ruta, (donde, senal) => pedirCalculo<T>(donde, senal));
}

/**
 * Pide el snapshot de un conjunto **con su huella ya comprobada**. Con `ruta` nula no pide nada.
 *
 * No es `useUno` con otro tipo, y por eso es un hook aparte: lo que devuelve no es el recurso
 * sino el `SnapshotVerificado` entero —el objeto, los bytes que se verificaron, el `sha256` que
 * se recalculo y el `Cache-Control` que llego—, porque la pantalla de Publicacion tiene que
 * poder ensenar la COMPROBACION y no solo su resultado (#15 AC5). Y la ruta nula es como se
 * encadena con la lectura que resuelve el `conjuntoId`: hasta que `GET /conjuntos?ejercicio=`
 * no contesta no hay snapshot que pedir, y una peticion a `/conjuntos/null/snapshot` seria un
 * 404 que no dice nada.
 */
export function useSnapshot(ruta: string | null): Recurso<SnapshotVerificado<SnapshotResource>> {
  return usePeticion<SnapshotVerificado<SnapshotResource>>(ruta, (donde, senal) =>
    pedirSnapshotDe(donde, senal),
  );
}
