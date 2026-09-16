import { coordenada, type CeldaDeLaTabla, type Coordenada, type DatosDeUnaTabla } from '@kamayuk/ui';

import { cliente } from '../api/cliente.ts';
import { t } from '../i18n/i18n.ts';
import type { Conector, Reparto } from './conectores.ts';
import { EJERCICIO_DE_TRABAJO } from './ejercicio.ts';
import {
  CLAVE_DEL_ESTADO,
  CLAVE_DE_LAS_VERSIONES,
  ESTADO_DEL_EJERCICIO,
  LISTADO_DE_CONJUNTOS,
  rutaDe,
  type ConjuntoResource,
  type EjercicioParametrizadoResource,
  type PeticionDeclarada,
  type Paginado,
} from './lecturas.ts';

/**
 * **El Panel, de punta a punta** (#63, AC 2).
 *
 * <h2>Dos lecturas, y no se sostienen entre si</h2>
 *
 * <table>
 *   <tr><td>{@link CLAVE_DEL_ESTADO}</td><td>`GET /seguridad/parametros/ejercicios/{ejercicio}`.
 *     Pasa con **`SESION_PROPIA`**: no exige el acceso `parametros`
 *     (`ParametrosController.java:91`)</td></tr>
 *   <tr><td>{@link CLAVE_DE_LAS_VERSIONES}</td><td>`GET /seguridad/parametros`. Exige el acceso
 *     **`parametros`** con privilegio de LECTURA (`ParametrosController.java:42`)</td></tr>
 * </table>
 *
 * Esa diferencia **es** el AC 2: una cuenta de ventanilla puede saber si su ejercicio esta sellado y
 * no puede ver la lista de versiones. Asi que el 403 de la segunda **no puede tumbar la hoja**: el
 * bloque declara `lectura: {clave: 'ejercicio'}` y `fallosDe: ['versiones']`, de modo que el fallo
 * del listado se dice **encima** del cuerpo y el estado del ejercicio sigue dibujado debajo. Lo
 * midio la V6 y lo escribio en su bloque: «Hace falta el acceso "parametros" para ver las
 * versiones» (`c01fe9a:src/secciones/Panel.tsx:194-203`).
 *
 * <h2>Los tres estados del ejercicio, y que «sin sellar» NO es un error</h2>
 *
 * `sellado: false` llega como **200** con `conjuntoId` y `version` nulos. Es una respuesta: el
 * ejercicio existe, esta dentro del rango, y todavia no se ha sellado. Dibujarlo como un fallo
 * mandaria a mirar un despliegue cuando lo que falta es componer un conjunto. Un 422 —ese si— es un
 * ejercicio fuera de 1990 a 2100, y llega ya distinguido por la escalera como `no-valido`.
 *
 * <h2>Un nulo no es un cero, y se dice en los dos sitios</h2>
 *
 * · **En los campos**, con `ausenciaPorCampo`: «sin conjunto sellado» ocupa el hueco de «Conjunto» y
 *   «Version», y nunca un `0`.
 * · **En las celdas**, con la forma larga `{ texto: null, nota }` de `@kamayuk/ui`: la celda se pinta
 *   con la palabra del saco y su `title` dice por que. `fechaSellado` y `usuarioSellado` son
 *   `@Nullable` en el `record` del controlador, y un conjunto abierto los trae los dos nulos.
 *
 * Que ninguna de las dos vias produzca un `0`, un `0.00` ni una cadena vacia lo comprueba
 * `verificaciones/el-nulo-no-es-un-cero.test.ts` sobre este conector.
 *
 * <h2>La fecha, tal como la escribio el servidor</h2>
 *
 * `fechaSellado` se pinta **sin pasar por `Date`** (AC 6). Es la leccion de
 * `c01fe9a:src/secciones/conjuntos.ts:150-175`: construir un `Date` con el instante del servidor lo
 * mueve a la zona del puesto, y entonces el mismo sello se lee con dos fechas distintas en dos
 * ventanillas de la misma municipalidad. El Panel no ensena ningun importe, asi que la regla de
 * `<Importe>` con su `fechaCalculo` no llega a aplicarse aqui.
 *
 * <h2>Lo que este conector NO rellena, y por que</h2>
 *
 * Los bloques 2, 3 y 4 —«Con que se sello el ejercicio», «Lo que este sello no incluye» y
 * «Decisiones que deciden que se puede sellar»— los dibuja el artboard V8 y **ninguna operacion del
 * backend los publica**: ni las 33 filas del derivado, ni los 35 detalles, ni las diez filas sin
 * archivo, ni las cuatro decisiones. Se quedan diciendo «no publicado» con el motivo de la pantalla.
 * Deducirlos de otra cosa —contar el snapshot, por ejemplo— daria numeros indistinguibles de los
 * reales sin que nadie los hubiera sellado.
 */

/**
 * Pide una peticion declarada y devuelve su cuerpo.
 *
 * El cliente es el de `@kamayuk/api` que dejo #57 —este sistema no tiene `fetch` propio, y la
 * prohibicion `fetch-fuera-del-cliente` no deja escribir uno—. La llamada esta en el CONECTOR y no
 * en `lecturas.ts` por lo que ese archivo explica: `cliente.ts` arrastra `sesion.ts`, que lee
 * `window` al cargarse, y la guarda que mide las declaraciones corre sin DOM.
 */
async function pedir<T>(
  peticion: PeticionDeclarada,
  senal: AbortSignal,
  sujetos: Readonly<Record<string, string>> = {},
): Promise<T> {
  return cliente.solicitar<T>(rutaDe(peticion, sujetos), { senal });
}

/**
 * Las frases que este conector escribe, para el inventario de claves.
 *
 * Son texto de este sistema y **pasan por `t()` aqui**, no por el `traducir` del interprete: lo que
 * el interprete traduce son las palabras de la DEFINICION; los `valores` y las celdas son datos y no
 * los toca. Una frase que este conector compone es de las primeras, aunque viaje por el segundo
 * camino, asi que se traduce donde se compone.
 */
export const FRASES_DEL_PANEL = {
  si: 'Sí',
  no: 'No',
  sePuedeCalcular: 'El ejercicio está sellado: se puede calcular con su conjunto.',
  noSePuedeCalcular:
    'Todavía no se puede calcular: hay que componer y sellar un conjunto para este ejercicio, en Ediciones.',
  sinConjuntoSellado: 'sin conjunto sellado',
  noPublicado: 'no publicado',
  sinSellar: 'El conjunto no está sellado: no tiene ni fecha ni usuario de sello.',
  cuantas: '{{cuantas}} de {{total}}',
  cuantasDeLasLeidas: '{{cuantas}} de las {{leidas}} primeras, de {{total}}',
  nadaQuePedir:
    'Esta hoja lee del sistema. Los bloques marcados «no publicado» los pide y ninguna operación del backend los sirve: no se deducen aquí, porque una cifra deducida sería indistinguible de una real.',
} as const;

/** Las claves de traduccion de este conector. */
export function clavesDelPanel(): readonly string[] {
  return Object.values(FRASES_DEL_PANEL);
}

/** Los cinco campos del bloque «Estado del ejercicio», por su sitio en la definicion. */
const EJERCICIO = coordenada(0, 0);
const SELLADO = coordenada(0, 1);
const CONJUNTO = coordenada(0, 2);
const VERSION = coordenada(0, 3);
const QUE_SE_PUEDE_HACER = coordenada(0, 4);

/** Los cuatro campos del bloque «Con que se sello el ejercicio»: ninguno se publica. */
const SIN_PUBLICAR: readonly Coordenada[] = [
  coordenada(1, 0),
  coordenada(1, 1),
  coordenada(1, 2),
  coordenada(1, 3),
];

/** Una celda que llego nula: la palabra la pone el saco, y el `title` dice por que. */
function sinDato(): CeldaDeLaTabla {
  return { texto: null, nota: t(FRASES_DEL_PANEL.sinSellar) };
}

/** Una celda con su texto, o la de arriba si llego nula. Nunca `''` y nunca `0`. */
function celda(valor: string | null): CeldaDeLaTabla {
  return valor === null ? sinDato() : valor;
}

/** Lo que el bloque «Estado del ejercicio» sabe decir con lo que contesto su lectura. */
function delEstado(estado: EjercicioParametrizadoResource): {
  readonly valores: ReadonlyMap<Coordenada, string>;
  readonly ausencias: ReadonlyMap<Coordenada, string>;
} {
  const valores = new Map<Coordenada, string>([
    // El ejercicio se devuelve tal cual, y es el que se pregunto: el aviso nombra ESTE numero.
    [EJERCICIO, String(estado.ejercicio)],
    [SELLADO, estado.sellado ? t(FRASES_DEL_PANEL.si) : t(FRASES_DEL_PANEL.no)],
    [
      QUE_SE_PUEDE_HACER,
      estado.sellado
        ? t(FRASES_DEL_PANEL.sePuedeCalcular)
        : t(FRASES_DEL_PANEL.noSePuedeCalcular),
    ],
  ]);
  const ausencias = new Map<Coordenada, string>();
  // Los dos nulos van por `ausenciaPorCampo` y NO por `valores`: un `0` en «Conjunto» seria un
  // identificador que no existe, y una cadena vacia seria un hueco sin motivo.
  if (estado.conjuntoId === null) ausencias.set(CONJUNTO, FRASES_DEL_PANEL.sinConjuntoSellado);
  else valores.set(CONJUNTO, String(estado.conjuntoId));
  if (estado.version === null) ausencias.set(VERSION, FRASES_DEL_PANEL.sinConjuntoSellado);
  else valores.set(VERSION, String(estado.version));
  return { valores, ausencias };
}

/**
 * Las versiones de ESTE ejercicio, de la pagina que contesto el listado.
 *
 * <h2>Se filtra aqui porque la operacion no admite filtrar</h2>
 *
 * `GET /seguridad/parametros` publica cuatro parametros —`pagina`, `tamano`, `ordenarPor` y
 * `direccion`— y **ninguno acota por ejercicio** (`docs/50-api/parametros-de-la-api.json`). Mandar
 * `?ejercicio=` seria un **422 «Parametro desconocido»**, asi que se piden las 500 primeras
 * ordenadas por ejercicio descendente y se filtra aqui.
 *
 * Y se dice cuantas se miraron: el conteo de la barra nombra las dos cifras que el servidor dio
 * —`totalElementos` y, si dijo que hay mas, cuantas se leyeron—, en vez de escribir un total que
 * seria el de la pagina y se leeria como el del padron.
 */
function deLasVersiones(
  pagina: Paginado<ConjuntoResource>,
  ejercicio: number,
): DatosDeUnaTabla {
  const suyas = pagina.contenido.filter((conjunto) => conjunto.ejercicio === ejercicio);
  const filas = suyas.map((conjunto) => ({
    clave: String(conjunto.id),
    celdas: [
      String(conjunto.version),
      String(conjunto.id),
      // Tal cual la escribio el servidor: sin `Date` y sin la zona del puesto (AC 6).
      celda(conjunto.fechaSellado),
      celda(conjunto.usuarioSellado),
      conjunto.estado,
    ] as readonly CeldaDeLaTabla[],
  }));
  const conteo = pagina.hayMas
    ? t(FRASES_DEL_PANEL.cuantasDeLasLeidas, {
        cuantas: suyas.length,
        leidas: pagina.contenido.length,
        total: pagina.totalElementos,
      })
    : t(FRASES_DEL_PANEL.cuantas, { cuantas: suyas.length, total: pagina.totalElementos });
  return { filas, conteo };
}

export const PANEL: Conector = {
  lecturas: [
    {
      clave: CLAVE_DEL_ESTADO,
      consulta: ['nor-panel', CLAVE_DEL_ESTADO, EJERCICIO_DE_TRABAJO],
      pedir: (senal) =>
        pedir<EjercicioParametrizadoResource>(ESTADO_DEL_EJERCICIO, senal, {
          ejercicio: String(EJERCICIO_DE_TRABAJO),
        }),
    },
    {
      clave: CLAVE_DE_LAS_VERSIONES,
      consulta: ['nor-panel', CLAVE_DE_LAS_VERSIONES],
      pedir: (senal) => pedir<Paginado<ConjuntoResource>>(LISTADO_DE_CONJUNTOS, senal),
    },
  ],

  repartir: (llegado): Reparto => {
    const estado = llegado.get(CLAVE_DEL_ESTADO) as EjercicioParametrizadoResource | undefined;
    const pagina = llegado.get(CLAVE_DE_LAS_VERSIONES) as
      | Paginado<ConjuntoResource>
      | undefined;

    const delSuyo = estado === undefined ? undefined : delEstado(estado);
    const ausenciaPorCampo = new Map<Coordenada, string>(delSuyo?.ausencias ?? []);
    // Los cuatro campos del bloque 2 no los publica nadie, y no es lo mismo que «no llego».
    for (const donde of SIN_PUBLICAR) ausenciaPorCampo.set(donde, FRASES_DEL_PANEL.noPublicado);

    const tablas = new Map<string, DatosDeUnaTabla>();
    // Se filtra por el ejercicio del RELOJ y no por el que devolvio la otra lectura: las dos
    // lecturas no se sostienen entre si, y con el estado caido la lista de versiones sigue
    // sabiendo de que ejercicio es.
    if (pagina !== undefined) {
      tablas.set(CLAVE_DE_LAS_VERSIONES, deLasVersiones(pagina, EJERCICIO_DE_TRABAJO));
    }

    return {
      valores: delSuyo?.valores ?? new Map<Coordenada, string>(),
      tablas,
      ausenciaPorCampo,
      ausencia: {
        enElCampo: FRASES_DEL_PANEL.noPublicado,
        explicacion: FRASES_DEL_PANEL.nadaQuePedir,
        tono: 'info',
      },
    };
  },
};
