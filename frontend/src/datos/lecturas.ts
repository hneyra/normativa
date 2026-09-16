/**
 * **Lo que este sistema PIDE, y con que forma contesta** (#63, AC 1 y AC 3).
 *
 * <h2>Dos operaciones, y estan medidas contra lo publicado</h2>
 *
 * El backend sirve hoy **cuatro** `GET` bajo `Api.RAIZ` —las cuatro estan en
 * `docs/50-api/formas-de-la-api.json`, que genera #49 del tipo de retorno de cada controlador—. De
 * esas cuatro, este archivo declara **las dos del Panel**; las otras dos —`GET /conjuntos` y
 * `GET /conjuntos/{id}/snapshot`— son de #65, #66 y #67, y sus conectores estan puestos y vacios en
 * `src/datos/{ediciones,cuadros,publicacion}.ts`.
 *
 * <h2>Por que una peticion es un DATO y no una cadena compuesta al vuelo</h2>
 *
 * Porque el borde del backend rechaza con **422 `VALIDACION`** todo parametro que la operacion no
 * declare —`GuardiaDeParametros.java:118,146-148`, salvo los cuatro de
 * `DIALECTO_DE_LA_PAGINACION`—, y un `?estado=SELLADO` escrito dentro de una plantilla de cadena no
 * lo ve nadie hasta que el servidor lo contesta. Declarados como dato, los lee
 * `verificaciones/camino-a-la-api.test.ts` y los cruza contra
 * `docs/50-api/parametros-de-la-api.json` **sin levantar nada**: lo que sobre sale rojo nombrando el
 * nombre, que es exactamente el 422 que el backend daria.
 *
 * Lo mismo con el orden: `ordenarPor` va por **lista blanca** —`OrdenSeguro.sobre("ejercicio",
 * "version", "estado", "id")`, que #49 publica como `ordenarPorAdmitidos`— y otro campo es un 422
 * `ORDEN_NO_ADMITIDO`. Y con el tamano, cuyo tope es `tamanoMaximo`.
 *
 * <h2>Los TESTIGOS, que es la mitad que un tipo de TypeScript no puede dar</h2>
 *
 * Un `interface` se borra al compilar, asi que ninguna prueba puede preguntarle sus campos. Al lado
 * de cada uno va un objeto `CAMPOS_DE_…` declarado `satisfies Record<keyof …, unknown>`: el
 * `satisfies` sobre un literal exige **las mismas llaves en los dos sentidos** —una que falte no
 * compila, y una de mas tampoco—, y `Object.keys()` de ese objeto es la lista que la guarda compara
 * campo a campo contra la forma publicada. Es lo que convierte «leer `usuarioSellado` donde el
 * contrato dice otra cosa» en un rojo, en vez de en un `undefined` mudo.
 *
 * <h2>Y por que este archivo NO importa el cliente</h2>
 *
 * Porque lo lee `verificaciones/camino-a-la-api.test.ts`, que corre con `@vitest-environment node`
 * —lo necesita para `fileURLToPath(import.meta.url)`—, e importar `src/api/cliente.ts` arrastra
 * `src/sesion.ts`, que lee `window.location.origin` al cargarse. Medido:
 *
 *     ReferenceError: window is not defined
 *      ❯ src/sesion.ts:106:12
 *      ❯ src/api/cliente.ts:3:1
 *
 * — un rojo de CARGA que se lleva la suite entera y que no habla de la guarda. Asi que aqui vive
 * **la declaracion** —que operacion, con que parametros y con que forma— y **la peticion la hace
 * cada conector**, con `cliente.solicitar(rutaDe(...))`. Es ademas el reparto correcto: una
 * declaracion es dato, y un dato se puede medir contra el contrato sin montar nada.
 */

/** El envoltorio paginado del backend: `RespuestaPaginada<T>`. */
export interface Paginado<T> {
  readonly contenido: readonly T[];
  readonly pagina: number;
  readonly tamano: number;
  readonly totalElementos: number;
  readonly totalPaginas: number;
  readonly hayMas: boolean;
}

/** Las llaves del envoltorio, como dato. Ver «Los TESTIGOS». */
export const CAMPOS_DEL_PAGINADO = {
  contenido: [],
  pagina: 0,
  tamano: 0,
  totalElementos: 0,
  totalPaginas: 0,
  hayMas: false,
} satisfies Record<keyof Paginado<never>, unknown>;

/**
 * Un conjunto de parametros y su estado — `ParametrosController.ConjuntoResource`.
 *
 * **Tres campos pueden llegar nulos y ninguno es un cero** (AC 5): `fechaSellado` y
 * `usuarioSellado` los declara `@Nullable` el propio `record`, y son nulos mientras el conjunto no
 * se ha sellado. `id` llega `0` cuando la entidad no tiene identidad —`conjunto.id() == null ? 0L`,
 * `ParametrosController.java:146`—, que es un caso que no se publica: un conjunto listado siempre
 * esta persistido.
 *
 * `fechaSellado` es `instante` en el contrato y aqui es `string`: llega como el texto ISO que
 * escribio el servidor y **se ensena tal cual** (AC 6). No pasa por `Date`, que lo movería a la zona
 * del puesto y haría que el mismo sello se leyera con dos fechas distintas en dos ventanillas.
 */
export interface ConjuntoResource {
  readonly id: number;
  readonly ejercicio: number;
  readonly version: number;
  readonly estado: string;
  readonly fechaSellado: string | null;
  readonly usuarioSellado: string | null;
}

/** Las llaves de un conjunto, como dato. */
export const CAMPOS_DEL_CONJUNTO = {
  id: 0,
  ejercicio: 0,
  version: 0,
  estado: '',
  fechaSellado: null,
  usuarioSellado: null,
} satisfies Record<keyof ConjuntoResource, unknown>;

/**
 * Si un ejercicio esta parametrizado — `ParametrosController.EjercicioParametrizadoResource`.
 *
 * **`sellado: false` es una RESPUESTA y llega como 200**, con los dos nulos dentro. No es un 404 y
 * no es un error: es el estado normal de un ejercicio que todavia no se ha sellado, y la hoja tiene
 * que decirlo como tal. Un 422 —ese si— es un ejercicio fuera de 1990 a 2100
 * (`ParametrosController.java:59-61`).
 */
export interface EjercicioParametrizadoResource {
  readonly ejercicio: number;
  readonly sellado: boolean;
  readonly conjuntoId: number | null;
  readonly version: number | null;
}

/** Las llaves del estado del ejercicio, como dato. */
export const CAMPOS_DEL_ESTADO = {
  ejercicio: 0,
  sellado: false,
  conjuntoId: null,
  version: null,
} satisfies Record<keyof EjercicioParametrizadoResource, unknown>;

/**
 * Una peticion declarada: la operacion tal como la nombra el contrato, la ruta que se compone y los
 * parametros de consulta que se le ponen.
 *
 * `operacion` lleva el verbo dentro —`GET /seguridad/parametros`— porque asi es como el contrato
 * nombra sus claves, y comparar sin el dejaria pasar un `POST` sobre una ruta que solo sirve `GET`.
 */
export interface PeticionDeclarada {
  /** `VERBO /ruta`, con sus `{parametros}` de camino: la clave del contrato. */
  readonly operacion: string;
  /** Los nombres de consulta que se componen. Lo que no este aqui, no viaja. */
  readonly parametros: Readonly<Record<string, string>>;
}

/**
 * El nombre de la lectura del estado del ejercicio: lo nombra `bloque.lectura` en la definicion.
 *
 * Vive aqui, junto a su peticion, y no en el conector: es el nombre por el que la DEFINICION y los
 * DATOS se encuentran, y tenerlo en un solo sitio es lo que impide que uno de los dos lo escriba
 * mal — que no da error, da una tabla sin filas y un aviso de «lectura sin estado».
 */
export const CLAVE_DEL_ESTADO = 'ejercicio';

/** El nombre de la lectura del listado. Lo nombran `bloque.fallosDe` y `tabla.clave`. */
export const CLAVE_DE_LAS_VERSIONES = 'versiones';

/** El tope de `Paginacion`, publicado como `tamanoMaximo`. La guarda lo cruza contra el contrato. */
export const TAMANO_DEL_LISTADO = 500;

/** El campo de orden, de la lista blanca publicada como `ordenarPorAdmitidos`. */
export const ORDEN_DEL_LISTADO = 'ejercicio';

/** El sentido, en el vocabulario del backend (`Paginacion.Direccion`). */
export const DIRECCION_DEL_LISTADO = 'DESCENDENTE';

/** `GET /seguridad/parametros` — los conjuntos y su estado, paginados. Acceso `parametros`. */
export const LISTADO_DE_CONJUNTOS: PeticionDeclarada = {
  operacion: 'GET /seguridad/parametros',
  parametros: {
    ordenarPor: ORDEN_DEL_LISTADO,
    direccion: DIRECCION_DEL_LISTADO,
    tamano: String(TAMANO_DEL_LISTADO),
  },
};

/** `GET /seguridad/parametros/ejercicios/{ejercicio}` — el estado de UN ejercicio. `SESION_PROPIA`. */
export const ESTADO_DEL_EJERCICIO: PeticionDeclarada = {
  operacion: 'GET /seguridad/parametros/ejercicios/{ejercicio}',
  parametros: {},
};

/** Las peticiones que este sistema compone hoy. La guarda las recorre una a una. */
export const PETICIONES: readonly PeticionDeclarada[] = [
  LISTADO_DE_CONJUNTOS,
  ESTADO_DEL_EJERCICIO,
];

/** La consulta de una peticion, o `''`. En el orden en que se declaro: un diff se lee mejor. */
function consulta(peticion: PeticionDeclarada): string {
  const pares = Object.entries(peticion.parametros);
  if (pares.length === 0) return '';
  const partes = pares.map(
    ([nombre, valor]) => `${encodeURIComponent(nombre)}=${encodeURIComponent(valor)}`,
  );
  return `?${partes.join('&')}`;
}

/**
 * La ruta que se pide, compuesta de la peticion declarada y de sus sujetos.
 *
 * Los `{sujeto}` del camino se sustituyen por su valor, ya codificado. Uno que falte revienta aqui
 * y no en el cable: una ruta con `{ejercicio}` dentro se pediria literalmente y el backend
 * contestaria un 404 que se confundiria con los 404 de negocio.
 */
export function rutaDe(
  peticion: PeticionDeclarada,
  sujetos: Readonly<Record<string, string>> = {},
): string {
  const camino = peticion.operacion.slice(peticion.operacion.indexOf(' ') + 1);
  const compuesto = camino.replace(/\{(\w+)\}/g, (_, nombre: string) => {
    const valor = sujetos[nombre];
    if (valor === undefined) {
      throw new Error(
        `«${peticion.operacion}» necesita el sujeto «${nombre}» y no se le paso: la ruta saldria ` +
          'al cable con las llaves dentro y el 404 que volviera pareceria un 404 de negocio.',
      );
    }
    return encodeURIComponent(valor);
  });
  return `${compuesto}${consulta(peticion)}`;
}
