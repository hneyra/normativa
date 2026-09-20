import type {
  Ausencia,
  Coordenada,
  DatoConNombre,
  DatosDeUnaTabla,
  RutaDeLaHoja,
} from '@kamayuk/ui';

import type { ClaveDeHoja } from '../pantallas/arbol.ts';
import { CUADROS } from './cuadros.ts';
import { EDICIONES } from './ediciones.ts';
import { PANEL } from './panel.ts';
import { PUBLICACION } from './publicacion.ts';

/**
 * **Que hoja pide que, y que de lo que llega dibuja cada campo** (#63, AC 1).
 *
 * <h2>Un archivo por hoja, y este solo los junta</h2>
 *
 * Es lo que deja a #65, #66 y #67 trabajar en paralelo sobre estas mismas cuatro hojas sin pisarse
 * —la misma regla que #58 aplico a `src/pantallas/definiciones/`—: cada uno abre el suyo. Aqui solo
 * se reunen, y **una hoja sin conector no es un hueco**: `porQueNoHayDato` dice por que, con las
 * palabras que le corresponden.
 *
 * <h2>Por que el conector NO monta el estado de sus lecturas</h2>
 *
 * Porque eso es lo mismo para las cuatro hojas y para las que vengan: un 401 es «vuelva a
 * identificarse» en todas, y un 403 `SIN_PRIVILEGIO` es «no es una averia» en todas. Lo resuelve
 * {@link useDatosDeLaHoja} con la escalera de `@kamayuk/sesion`, en **un** sitio (AC 4). Si cada
 * conector lo hiciera a su manera, las siete pantallas de error dejarian de ser siete a la tercera
 * hoja — que es exactamente el defecto que ese criterio persigue.
 *
 * El conector recibe **lo que llego** y devuelve **lo que se dibuja**. Nada mas.
 *
 * <h2>Y la regla que gobierna estos archivos</h2>
 *
 * **No se calcula un agregado que la operacion no publica.** Contar sobre la pagina que llego daria
 * un numero, y ese numero seria indistinguible de uno real. Un hueco que dice «no publicado» es
 * informacion: dice a quien mantiene el backend exactamente que le falta. Un cero calculado mal no
 * es informacion, es una mentira con formato — y en el sistema que publica los valores con los que
 * se cobra, es la peor que hay.
 */

/** Una lectura de una hoja: como se nombra, como se cachea y como se pide. */
export interface DeclaracionDeLectura {
  /**
   * El nombre por el que la DEFINICION la nombra: `bloque.lectura.clave` y `fallosDe`.
   *
   * Por nombre y no por indice de bloque, que es lo que publica `@kamayuk/ui`: un bloque puede
   * moverse dentro de la pantalla y su lectura sigue siendo la misma.
   */
  readonly clave: string;
  /** La clave de consulta de TanStack. Lleva la hoja dentro: dos hojas no comparten cache. */
  readonly consulta: readonly (string | number)[];
  /**
   * **Los sitios de la RUTA que esta lectura lee** (#65): la pagina, el orden, el sujeto.
   *
   * Lo que valgan entra en la clave de consulta, y ese es el punto: sin eso, el mando de pagina
   * mueve la direccion, `pedir` **no se vuelve a llamar** y la tabla dibuja la pagina 0 con el
   * rotulo «Página 3» — en verde y sin un solo error.
   *
   * Sin declararlos, la lectura no depende de la ruta y se pide una sola vez, que es lo que hacen
   * las cuatro lecturas de antes de #65.
   */
  readonly enLaRuta?: readonly string[];
  /**
   * **Cuando todavia no hay nada que pedir**, y por tanto no se pide (#65).
   *
   * Es el `en-espera` que `EstadoDeUnaLectura` de `@kamayuk/ui` ya nombra: «falta el sujeto para
   * poder pedir». Sin esto, una hoja de detalle sin nada elegido pediria `/conjuntos/undefined/…`
   * y dibujaria un 404 de ruta como si fuera una averia — cuando lo unico que pasa es que nadie ha
   * elegido una fila todavia.
   */
  readonly enEsperaSi?: (ruta: RutaDeLaHoja) => boolean;
  /**
   * Pide. **La ruta entra por parametro** y no se lee de ningun sitio global: es lo que decide que
   * ventana se pide y de que conjunto, y una lectura que la leyera por su cuenta no podria entrar
   * en la clave de consulta.
   */
  readonly pedir: (senal: AbortSignal, ruta: RutaDeLaHoja) => Promise<unknown>;
}

/** Lo que una hoja saca de lo que llego. */
export interface Reparto {
  /** Los campos de solo lectura que SI salen de lo que llego. */
  readonly valores?: ReadonlyMap<Coordenada, string>;
  /** Las filas de cada tabla con `clave`. */
  readonly tablas?: ReadonlyMap<string, DatosDeUnaTabla>;
  /** Los campos que se pidieron y la operacion NO publica, con la palabra que va en su hueco. */
  readonly ausenciaPorCampo?: ReadonlyMap<Coordenada, string>;
  /** Los datos que las piezas leen por su nombre. */
  readonly nombrados?: ReadonlyMap<string, DatoConNombre>;
  /** La frase de arriba. `explicacion: ''` no dibuja caja: una alerta vacia es un hueco. */
  readonly ausencia: Ausencia;
}

export interface Conector {
  readonly lecturas: readonly DeclaracionDeLectura[];
  /**
   * Lo que se dibuja con lo que llego.
   *
   * @param llegado por clave de lectura. Una clave que no esta **no llego** —se esta pidiendo, o
   *   fallo—, y su bloque ya lo dice por su cuenta: aqui no se rellena con nada.
   */
  readonly repartir: (llegado: ReadonlyMap<string, unknown>) => Reparto;
}

/**
 * Las cuatro hojas y su conector, o `undefined` mientras no lo tengan.
 *
 * `Partial` a proposito: una hoja sin conector es el estado normal hasta la ola 5, y `undefined`
 * es lo que hace que `useDatosDeLaHoja` no pida nada y llame a `porQueNoHayDato`.
 */
export const CONECTORES: Readonly<Partial<Record<ClaveDeHoja, Conector>>> = {
  'nor-panel': PANEL,
  'nor-ediciones': EDICIONES,
  'nor-cuadros': CUADROS,
  'nor-publicacion': PUBLICACION,
};
