import { EJERCICIO_DE_TRABAJO } from './ejercicio.ts';

/**
 * **Lo que este sistema PIDE, y con que forma contesta** (#63, AC 1 y AC 3).
 *
 * <h2>Dos operaciones, y estan medidas contra lo publicado</h2>
 *
 * El backend sirve hoy **cuatro** `GET` bajo `Api.RAIZ` —las cuatro estan en
 * `docs/50-api/formas-de-la-api.json`, que genera #49 del tipo de retorno de cada controlador—. De
 * esas cuatro, este archivo declaraba **las dos del Panel** (#63); desde #67 declara tambien las
 * **dos de Publicacion** —`GET /conjuntos` y `GET /conjuntos/{id}/snapshot`—, y esta ultima **dos
 * veces**, una por ambito, porque el ambito decide que viene dentro y con ello la huella.
 *
 * Asi que las cuatro operaciones publicadas estan declaradas. Lo que queda por conectar es una hoja
 * —Ediciones (#65)— y una forma de dibujar —las tablas de los cuadros (#66)—, no una operacion.
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
 *
 * Lo unico que SI se importa es `./ejercicio.ts` (#67), y se puede: es una funcion pura y una
 * constante leida del reloj, sin `window`, sin red y sin Spring. Lo que no se puede importar es lo
 * que toca el navegador al cargarse.
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
 * Los dos ambitos del snapshot, en el vocabulario del backend (`kamayuk.normativa.reglas.Ambito`).
 *
 * **No hay un tercero que signifique «todo», y eso es una decision del backend** que esta hoja
 * hereda: `?ambito=` es obligatorio y no tiene valor por omision
 * (`SnapshotController.java:108-117`). Un «todo» implicito seria el snapshot mas grande servido a
 * quien no lo pidio, con otra huella y con la mitad de sus filas sin consumidor.
 *
 * Y se escriben en MAYUSCULAS porque el backend no lee en minusculas: `?ambito=valuacion` se
 * rechaza nombrandolo (`SnapshotController.java:149-151`), y aceptarlo devolveria un snapshot con
 * otra huella que el cliente creeria correcto.
 */
export const AMBITOS = ['VALUACION', 'OBLIGACION'] as const;

/** Uno de los dos ambitos. */
export type Ambito = (typeof AMBITOS)[number];

/**
 * Que conjunto sellado rige el ejercicio — `SnapshotController.ConjuntoVigenteResource`.
 *
 * **No lleva ni una fila, y es el punto**: es la IDENTIDAD, que es lo unico que hace falta para
 * saber si el snapshot que ya se tiene en cache sigue siendo el bueno. Y no depende del ambito: el
 * controlador pide `OBLIGACION` para componerla y dice por que —«da igual cual, porque de esta
 * llamada solo se lee la identidad»— (`SnapshotController.java:90-96`).
 */
export interface ConjuntoVigenteResource {
  readonly conjuntoId: number;
  readonly ejercicio: number;
  readonly version: number;
}

/** Las llaves de la identidad del conjunto vigente, como dato. */
export const CAMPOS_DEL_CONJUNTO_VIGENTE = {
  conjuntoId: 0,
  ejercicio: 0,
  version: 0,
} satisfies Record<keyof ConjuntoVigenteResource, unknown>;

/* ── Las filas de los tres cuadros nacionales (#66) ────────────────────────────────────────── */

/**
 * **Una celda del cuadro de valores unitarios de edificacion** —
 * `SnapshotDelConjunto.ValorUnitarioDelSnapshot` (ADR-0017).
 *
 * <h2>`anioConstruccionHasta` es nulable, y ese nulo NO es un dato que falte</h2>
 *
 * Es el tramo que no tiene tope —la construccion mas reciente—, y el `record` del backend lo
 * declara `@Nullable Integer` (`SnapshotDelConjunto.java:97-103`) por lo mismo que la
 * depreciacion: un `int` lo leeria como cero y convertiria el tramo abierto en uno que no cubre
 * nada, sin ningun error de por medio. Quien lo dibuja es {@link module:datos/cuadros}, y lo
 * dibuja como «Sin tope».
 *
 * <h2>Y `valorM2` es una CADENA</h2>
 *
 * Porque es una cifra sellada y en coma flotante pierde decimales antes de llegar a la pantalla
 * (regla 1, RNF-055). El backend la sirve como texto, aqui se lee como texto y **no se opera**:
 * solo se formatea.
 */
export interface ValorUnitarioDelSnapshot {
  readonly partida: string;
  readonly categoria: string;
  readonly anioConstruccionDesde: number;
  readonly anioConstruccionHasta: number | null;
  readonly valorM2: string;
  readonly documentoFuente: string;
}

/** Las llaves de una celda de valores unitarios, como dato. Ver «Los TESTIGOS». */
export const CAMPOS_DEL_VALOR_UNITARIO = {
  partida: '',
  categoria: '',
  anioConstruccionDesde: 0,
  anioConstruccionHasta: null,
  valorM2: '',
  documentoFuente: '',
} satisfies Record<keyof ValorUnitarioDelSnapshot, unknown>;

/**
 * **Una fila del cuadro de depreciacion** — `SnapshotDelConjunto.DepreciacionDelSnapshot`.
 *
 * `antiguedadHasta` llega nulo en el **tramo abierto** con que cierra cada tabla del Anexo I del
 * RNT, y el propio `record` lo dice: va como `Integer` y no como `int` «justamente por eso: leer
 * ese nulo como cero convierte el tramo abierto en uno que no cubre nada, sin ningun error de por
 * medio» (`SnapshotDelConjunto.java:105-118`). En un padron viejo es el tramo que mas predios
 * alcanza.
 */
export interface DepreciacionDelSnapshot {
  readonly uso: string;
  readonly material: string;
  readonly estadoConservacion: string;
  readonly antiguedadHasta: number | null;
  readonly porcentaje: string;
  readonly documentoFuente: string;
}

/** Las llaves de una fila de depreciacion, como dato. */
export const CAMPOS_DE_LA_DEPRECIACION = {
  uso: '',
  material: '',
  estadoConservacion: '',
  antiguedadHasta: null,
  porcentaje: '',
  documentoFuente: '',
} satisfies Record<keyof DepreciacionDelSnapshot, unknown>;

/**
 * **Una fila del anexo vehicular del MEF** — `SnapshotDelConjunto.ValorReferencialDelSnapshot`.
 *
 * Es la lista grande: el anexo de un ejercicio son **decenas de miles de filas**, y llega entera
 * en una sola respuesta porque el snapshot no pagina. Por eso su tabla pagina **en el cliente**.
 *
 * Lleva su propio `ejercicio` y no es el del conjunto: el anexo se publica por ejercicio y esa
 * columna es parte de la identidad de la fila, como la categoria.
 */
export interface ValorReferencialDelSnapshot {
  readonly ejercicio: number;
  readonly categoria: string;
  readonly marca: string;
  readonly modelo: string;
  readonly anioFabricacion: number;
  readonly valor: string;
  readonly documentoFuente: string;
}

/** Las llaves de una fila del anexo vehicular, como dato. */
export const CAMPOS_DEL_VALOR_REFERENCIAL = {
  ejercicio: 0,
  categoria: '',
  marca: '',
  modelo: '',
  anioFabricacion: 0,
  valor: '',
  documentoFuente: '',
} satisfies Record<keyof ValorReferencialDelSnapshot, unknown>;

/**
 * El cuerpo del snapshot — `SnapshotController.SnapshotResource`.
 *
 * <h2>Tres listas con la forma de su fila, y una que sigue siendo `unknown[]`</h2>
 *
 * Hasta #66 las cuatro eran `unknown[]`: Publicacion lee **cuantas filas traen y nada mas**, y
 * declarar aqui la forma de una fila que ninguna hoja dibujaba habria sido escribir un contrato sin
 * lector. Desde #66 hay quien las dibuja —los tres cuadros nacionales de ADR-0017—, asi que las
 * tres bajan a su forma y **una guarda las cruza campo a campo** contra
 * `docs/50-api/formas-de-la-api.json`
 * (`verificaciones/la-lectura-declara-lo-que-la-operacion-publica.test.ts`).
 *
 * `parametros` se queda en `unknown[]` **a proposito y con su motivo escrito**: ninguna de las
 * cuatro hojas dibuja una fila de parametros —Publicacion las cuenta, Cuadros no las mira— y una
 * forma declarada que nadie lee no se entera de quedarse vieja. La misma guarda lo declara como
 * excepcion con este motivo, y sale roja el dia que alguien la lea sin declararla.
 *
 * <h2>El `sha256` NO esta aqui, y tampoco es un olvido</h2>
 *
 * La huella es de **estos mismos bytes**, asi que meterla dentro seria pedirle a un valor que se
 * contenga a si mismo. Viaja en el `ETag` (`SnapshotController.java:183-190`), y por eso Publicacion
 * la lee de una cabecera y la recalcula sobre el texto recibido.
 */
export interface SnapshotResource {
  readonly conjuntoId: number;
  readonly ejercicio: number;
  readonly version: number;
  readonly ambito: string;
  readonly filas: number;
  readonly parametros: readonly unknown[];
  readonly valoresUnitarios: readonly ValorUnitarioDelSnapshot[];
  readonly depreciaciones: readonly DepreciacionDelSnapshot[];
  readonly valoresReferenciales: readonly ValorReferencialDelSnapshot[];
}

/** Las llaves del snapshot, como dato. Ver «Los TESTIGOS». */
export const CAMPOS_DEL_SNAPSHOT = {
  conjuntoId: 0,
  ejercicio: 0,
  version: 0,
  ambito: '',
  filas: 0,
  parametros: [],
  valoresUnitarios: [],
  depreciaciones: [],
  valoresReferenciales: [],
} satisfies Record<keyof SnapshotResource, unknown>;

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

/**
 * El nombre de la lectura de Publicacion. Lo nombran `bloque.lectura` y `tabla.clave` de su hoja.
 *
 * **Es UNA sola para las tres peticiones de esa hoja** —la identidad y los dos snapshots— y eso
 * esta medido, no supuesto: las tres van detras del MISMO `@RequiereAcceso(acceso = "parametros",
 * privilegio = LECTURA)` (`SnapshotController.java:87,119`), asi que no hay ninguna que pueda
 * contestar 403 mientras otra contesta 200. Partirlas en tres lecturas dibujaria tres estados que
 * en la practica valen siempre lo mismo, y ademas pediria la identidad tres veces: los dos
 * snapshots no se pueden pedir sin el `conjuntoId` que devuelve la primera.
 *
 * Es justo lo contrario del Panel, donde la separacion SI significa algo (#63, AC 2).
 */
export const CLAVE_DE_LA_PUBLICACION = 'publicacion';

/**
 * Los otros cinco nombres con que la definicion de Publicacion y su conector se encuentran (#67).
 *
 * Viven aqui por lo mismo que {@link CLAVE_DEL_ESTADO}: son **el nombre por el que la DEFINICION y
 * los DATOS se encuentran**, y tenerlo en un solo sitio es lo que impide que uno de los dos lo
 * escriba mal — que no da error, da una tabla sin filas y un boton impedido con «nadie atiende
 * esto». Y viven aqui **y no en `src/datos/publicacion.ts`** porque este archivo es el unico de los
 * dos que se puede leer sin DOM: el conector importa el cliente, el cliente importa la sesion y la
 * sesion lee `window.location.origin` al cargarse.
 */

/** La tabla «Que viene y que no», dentro del bloque «La respuesta». */
export const CLAVE_DE_LAS_LISTAS = 'listas';

/** La tabla «Quien consume el conjunto sellado». No depende de ninguna lectura. */
export const CLAVE_DE_LOS_CONSUMIDORES = 'consumidores';

/** El tono del `ETag`: `ok`, `atencion` o `mal`. Lo lee la `insignia` de ese campo. */
export const DATO_DEL_TONO = 'publicacion.tono';

/** Por que no se puede guardar, o `null` si se puede. Lo lee el `impedida` de la accion. */
export const DATO_DEL_IMPEDIMENTO = 'publicacion.noSePuedeGuardar';

/** La operacion que la accion `hace`, y que `src/pantallas/index.ts` registra en `alHacer`. */
export const OPERACION_DE_GUARDAR = 'guardar-el-snapshot';

/* ── Los nombres con que la definicion de Cuadros y su conector se encuentran (#66) ────────── */

/**
 * El nombre de la lectura de Cuadros. Lo nombran `bloque.lectura` y `bloque.fallosDe` de su hoja.
 *
 * **Es UNA sola para las tres peticiones de esa hoja**, por el mismo motivo medido que en
 * Publicacion: la identidad y los dos snapshots van detras del MISMO
 * `@RequiereAcceso(acceso = "parametros", privilegio = LECTURA)`
 * (`SnapshotController.java:87,119`), asi que no hay ninguna que pueda contestar 403 mientras otra
 * contesta 200 — y los dos snapshots no se pueden pedir sin el `conjuntoId` que devuelve la
 * primera. Tres estados que valen siempre lo mismo son tres huecos donde hay uno.
 *
 * Es una lectura distinta de la de Publicacion **y tiene que serlo**: la clave de consulta lleva la
 * hoja dentro, y dos hojas que compartieran entrada de cache compartirian tambien lo que una de
 * ellas invalidara.
 */
export const CLAVE_DE_LOS_CUADROS = 'cuadros';

/**
 * Las claves de las tres tablas de Cuadros: `tabla.clave` en la definicion, y por donde el conector
 * entrega sus filas.
 *
 * Son tres y no una porque son **tres cuadros distintos de dos ambitos distintos** (ADR-0017 y el
 * reparto de ADR-0024), cada uno con sus columnas. Una sola tabla con una columna «cuadro» mezclaria
 * un valor por metro cuadrado con un porcentaje de depreciacion en la misma columna de cifras.
 */
export const CLAVE_DE_LOS_UNITARIOS = 'valores-unitarios';
export const CLAVE_DE_LAS_DEPRECIACIONES = 'depreciaciones';
export const CLAVE_DE_LOS_REFERENCIALES = 'valores-referenciales';

/** Las tres, en el orden en que la hoja las dibuja. La guarda las recorre. */
export const CLAVES_DE_LOS_CUADROS: readonly string[] = [
  CLAVE_DE_LOS_UNITARIOS,
  CLAVE_DE_LAS_DEPRECIACIONES,
  CLAVE_DE_LOS_REFERENCIALES,
];

/**
 * **Donde vive la pagina abierta de cada tabla de Cuadros**, y por que son tres sitios y no uno.
 *
 * `paginacion.enLaRuta` es el nombre del sitio donde la tabla guarda su pagina. Las tres tablas
 * estan en la MISMA hoja: con un solo nombre, pasar de pagina en el cuadro vehicular moveria
 * tambien la del cuadro de depreciacion, que no se toco. Son tres nombres, uno por tabla, y se
 * derivan de su clave para que no se puedan escribir mal por separado.
 */
export const paginaDe = (clave: string): string => `pagina-${clave}`;

/**
 * **Cuantas filas se montan de una vez en una tabla de Cuadros** (#66, AC 3).
 *
 * El anexo vehicular de un ejercicio son **decenas de miles de filas** y el snapshot no pagina: la
 * respuesta las trae todas. Sin esto, `filas.map` las pinta todas —que es lo que hacia la V6
 * (`c01fe9a:frontend/src/secciones/Tabla.tsx:140`), y nunca se ejercio contra el cuadro de verdad—
 * y el navegador monta decenas de miles de `<tr>` para ensenar los primeros veinte.
 *
 * La paginacion es **de cliente** y no de servidor: las filas ya estan todas delante, asi que
 * cuantas paginas hay es una cuenta y no una suposicion (`paginaDeLaTabla` de `@kamayuk/ui`). No es
 * el `tamano` de una peticion: esta operacion no admite `tamano` —no esta en sus parametros
 * declarados— y mandarselo seria el 422 que `camino-a-la-api` persigue.
 */
export const FILAS_POR_PAGINA = 100;

/**
 * `GET /conjuntos?ejercicio=` — que conjunto sellado rige. Acceso `parametros`.
 *
 * El ejercicio sale del RELOJ y no de un literal, por lo que dice `src/datos/ejercicio.ts`: una
 * lista escrita a mano sigue pareciendo correcta el 1 de enero siguiente, y la pantalla pregunta por
 * el ejercicio equivocado sin que nada lo diga.
 */
export const CONJUNTO_VIGENTE: PeticionDeclarada = {
  operacion: 'GET /conjuntos',
  parametros: { ejercicio: String(EJERCICIO_DE_TRABAJO) },
};

/**
 * `GET /conjuntos/{id}/snapshot?ambito=` — el conjunto entero, **una peticion por ambito**.
 *
 * Son dos peticiones declaradas y no una con el ambito por argumento porque el ambito **no es un
 * detalle de la llamada**: es lo que decide que cuadros vienen dentro y, con ellos, la huella. Como
 * dato, `verificaciones/camino-a-la-api.test.ts` recorre las dos y cruza cada una contra los
 * parametros que el contrato declara para esa operacion.
 */
export const SNAPSHOT_POR_AMBITO: Readonly<Record<Ambito, PeticionDeclarada>> = {
  VALUACION: { operacion: 'GET /conjuntos/{id}/snapshot', parametros: { ambito: 'VALUACION' } },
  OBLIGACION: { operacion: 'GET /conjuntos/{id}/snapshot', parametros: { ambito: 'OBLIGACION' } },
};

/* ── Lo que Ediciones pide, y donde vive lo que se elige en ella (#65) ─────────────────────── */

/**
 * **Los cuatro sitios de la ruta que una tabla paginada y ordenada usa** (#65).
 *
 * <h2>Se llaman COMO EL PARAMETRO del contrato, y el cuarto esta MEDIDO</h2>
 *
 * `#/ediciones?pagina=2&ordenarPor=version` viaja a
 * `GET /seguridad/parametros?pagina=2&ordenarPor=version`. Un segundo vocabulario —`?p=2`—
 * obligaria a una tabla de equivalencias que no protege de nada y que hay que leer dos veces para
 * seguir una peticion desde la barra de direcciones hasta la red.
 *
 * **El cuarto se llama `direccion` aqui, y no `sentido`.** `rentas` lo renombro a `sentido`
 * (`rentas`#236 y #250) porque `GuardiaDeParametros` admite los cuatro nombres en TODA operacion y
 * aquel sistema tiene pantallas con un filtro «Dirección» —un domicilio—, asi que toda una familia
 * de hojas nacia rota. **El contrato de `normativa` es el suyo**, y se mide en vez de heredarse:
 * `docs/50-api/parametros-de-la-api.json` publica `direccion` entre los `opcionales` de
 * `GET /seguridad/parametros`, y en este arbol no hay ninguna pantalla con un campo «Dirección» —el
 * artboard V8 no tiene ni un domicilio—. Asi que el choque que obligo a `rentas` no existe aqui, y
 * copiar su nombre haria que el sitio de la ruta y el parametro de la API se llamaran distinto sin
 * ningun motivo. Lo cruza `la-ruta-de-la-hoja-llega-al-conector.test.ts` contra el contrato.
 */
export const EN_LA_RUTA = {
  pagina: 'pagina',
  tamano: 'tamano',
  ordenarPor: 'ordenarPor',
  direccion: 'direccion',
} as const;

/** Uno de los cuatro sitios. */
export type SitioDeLaRuta = (typeof EN_LA_RUTA)[keyof typeof EN_LA_RUTA];

/**
 * **Lo que cada hoja guarda en la ruta**, para que `src/catalogo.ts` lo declare en su destino.
 *
 * Vive aqui y no en `catalogo.ts` por un motivo medido: lo que esto describe es **lo que la lectura
 * lee**, y quien lo lee es el conector. Pero `catalogo.ts` lo importa, y a `catalogo.ts` lo importan
 * dos guardas que corren **sin DOM** —`camino-a-la-api` y `pantallas-del-artboard`—, asi que no
 * puede colgar de `src/datos/ediciones.ts`: ese archivo importa el cliente, el cliente importa la
 * sesion y la sesion lee `window.location.origin` al cargarse. Este archivo es el unico de los dos
 * que se puede leer sin navegador, y por eso la declaracion vive aqui.
 *
 * **Y esto es la mitad que no da error al romperse**: el marco **tira con aviso** lo que un destino
 * no declara (`rutaDeLaHoja` de `@kamayuk/shell`), asi que sin la entrada de una hoja el mando de
 * pagina se dibuja, se pulsa, la direccion no cambia y la tabla sigue en la pagina 0. Una paginacion
 * que no pagina es peor que ninguna, porque parece que funciona.
 */
export const LA_RUTA_DE_CADA_HOJA: Readonly<
  Record<string, { readonly sujeto?: boolean; readonly parametros?: readonly string[] }>
> = {
  'nor-ediciones': {
    // El conjunto elegido va en el CAMINO —`#/ediciones/12`— y no en un parametro: es de lo que
    // habla la hoja, no algo que se haya elegido dentro de ella.
    sujeto: true,
    parametros: [EN_LA_RUTA.pagina, EN_LA_RUTA.tamano, EN_LA_RUTA.ordenarPor, EN_LA_RUTA.direccion],
  },
  /**
   * **Cuadros no pide nada de la ruta, y aun asi la declara** (#66 + #65).
   *
   * Sus tres tablas paginan **en el CLIENTE** —llegan las 54 129 filas y la pagina se corta
   * aqui—, asi que ningun conector lee estos tres nombres: no viajan a ninguna operacion. Lo que
   * los necesita es el INTERPRETE, que desde #65 recibe la `hoja` y escribe la pagina en la ruta
   * en vez de guardarla en el estado de la tabla.
   *
   * **Y sin esta entrada, esa paginacion se rompe en silencio**: el marco **tira con aviso** lo
   * que un destino no declara (`rutaDeLaHoja` de `@kamayuk/shell`), asi que el mando escribiria
   * `?pagina-depreciaciones=1`, la direccion se quedaria igual y la tabla seguiria en la primera
   * pagina. Lo caza `la-ruta-de-la-hoja-llega-al-conector`, que cruza los sitios que cada tabla
   * ESCRIBE contra lo que su hoja declara.
   *
   * Cada tabla lleva **su propio nombre** —`pagina-<clave>`— y no el `pagina` del dialecto: son
   * tres en la misma hoja, y con un solo nombre las tres se moverian juntas.
   */
  'nor-cuadros': {
    parametros: [
      'pagina-valores-unitarios',
      'pagina-depreciaciones',
      'pagina-valores-referenciales',
    ],
  },
};

/** El nombre de la lectura del listado de Ediciones. Lo nombran `bloque.lectura` y `tabla.clave`. */
export const CLAVE_DE_LAS_EDICIONES = 'ediciones';

/** Y el del contenido del conjunto elegido: el detalle. */
export const CLAVE_DEL_CONTENIDO = 'contenido';

/**
 * **El nombre con que viaja el `hayMas` que el SERVIDOR dijo**, para la tabla `clave`.
 *
 * `DefinicionDeTabla.paginacion.hayMas` es el NOMBRE de un dato de `DatosDeLaPantalla.nombrados`, no
 * el dato: el interprete lo busca ahi. Quien lo pone es el conector, con el `hayMas` del envoltorio
 * de la respuesta — **nunca contando las filas recibidas**: con el tope alcanzado exacto, contarlas
 * diria que no hay mas justo cuando las hay.
 *
 * Derivado del nombre de la tabla y no escrito dos veces: un nombre que no case deja `hayMas` sin
 * valor, el interprete lee eso como «no hay pagina siguiente» y el boton sale impedido para
 * siempre, sin un solo error.
 */
export const hayMasDe = (tabla: string): string => `${tabla}.hayMas`;

/** Y el de cuantas paginas dijo que hay (`totalPaginas`). Mismo trato: lo dice el servidor. */
export const paginasDe = (tabla: string): string => `${tabla}.paginas`;

/** Lo que se pidio, publicado con nombre para que la fila elegida no pierda el sitio (#65). */
export const loPedidoEn = (tabla: string, sitio: SitioDeLaRuta): string => `${tabla}.${sitio}`;

/**
 * `GET /seguridad/parametros` — **el listado que pagina y ordena DESDE LA RUTA** (#65).
 *
 * Es la misma operacion que {@link LISTADO_DE_CONJUNTOS} y es otra peticion, a proposito: aquella
 * es la del Panel —500 filas de un tiron, ordenadas por ejercicio descendente, para filtrar por el
 * ejercicio de trabajo— y esta es una **ventana** que se mueve. Fundirlas obligaria a que el Panel
 * cambiara de pagina cuando alguien pagina en Ediciones.
 *
 * `parametros` va **vacio** y no con los cuatro escritos: sus valores salen de la DEFINICION de la
 * hoja —`paginacion.tamano`, `orden.campos[0]`— y de lo que la ruta diga, y escribirlos aqui seria
 * el tamano en dos sitios que `rentas` midio divergir (`rentas`#186, AC3). Que los cuatro nombres
 * sean de los que esta operacion admite lo cruza la guarda contra el contrato, uno a uno.
 */
export const LISTADO_DE_EDICIONES: PeticionDeclarada = {
  operacion: 'GET /seguridad/parametros',
  parametros: {},
};

/**
 * `GET /conjuntos/{id}/parametros` — **lo que un conjunto lleva dentro, abierto o sellado** (#56).
 *
 * Sin un solo parametro de consulta: el contrato no declara ninguno, y mandar uno seria un **422
 * «Parametro desconocido»**. Lo que decide de que conjunto se habla es el `{id}` del camino, que
 * sale del sujeto de la ruta.
 *
 * **Y es la ruta por la que se lee un sellado tambien** (AC 3): el snapshot sirve solo lo sellado
 * —404 «no sellado» para un conjunto abierto— y ademas viene firmado y cacheado un ano, que no es
 * lo que una hoja que compone necesita. Esta sirve los dos estados con la misma forma.
 */
export const CONTENIDO_DEL_CONJUNTO: PeticionDeclarada = {
  operacion: 'GET /conjuntos/{id}/parametros',
  parametros: {},
};

/**
 * Una fila de `parametro_tributario` tal como sale por HTTP —
 * `ContenidoDelConjuntoController.ParametroResource`.
 *
 * **`valorNumerico` es una CADENA y no se convierte ni se opera** (AC 5, regla 1): el backend la
 * serializa con `toPlainString()` a proposito, porque `{"valor": 5350.000000}` lo lee el navegador
 * como `double` y lo redondea. Pasarla por `Number` aqui desharia esa decision en el ultimo paso.
 *
 * **Cinco de los ocho campos pueden llegar nulos**, y ninguno es un cero: `clave` —la UIT no lleva—,
 * `valorNumerico` y `valorTexto` —uno u otro—, y las dos fechas de la vigencia. «Vigente hasta»
 * vacio no es un olvido: es una norma sin fecha de fin.
 */
export interface ParametroDelConjuntoResource {
  readonly id: number;
  readonly tipo: string;
  readonly clave: string | null;
  readonly valorNumerico: string | null;
  readonly valorTexto: string | null;
  readonly vigenciaDesde: string | null;
  readonly vigenciaHasta: string | null;
  readonly documentoFuente: string;
}

/** Las llaves de un parametro, como dato. Ver «Los TESTIGOS». */
export const CAMPOS_DEL_PARAMETRO = {
  id: 0,
  tipo: '',
  clave: null,
  valorNumerico: null,
  valorTexto: null,
  vigenciaDesde: null,
  vigenciaHasta: null,
  documentoFuente: '',
} satisfies Record<keyof ParametroDelConjuntoResource, unknown>;

/**
 * El conjunto y lo que lleva dentro — `ContenidoDelConjuntoController.ContenidoDelConjuntoResource`.
 *
 * Lleva el conjunto **ademas** de la lista porque la hoja tiene que poder decir de que habla
 * —ejercicio, version y estado— sin una segunda peticion. Y el conjunto es el MISMO
 * {@link ConjuntoResource} del listado, no una forma propia: dos formas del mismo recurso acaban
 * divergiendo justo en el campo que una pantalla lee (ADR-0043 §1).
 */
export interface ContenidoDelConjuntoResource {
  readonly conjunto: ConjuntoResource;
  readonly parametros: readonly ParametroDelConjuntoResource[];
}

/** Las llaves del contenido, como dato. */
export const CAMPOS_DEL_CONTENIDO = {
  conjunto: {},
  parametros: [],
} satisfies Record<keyof ContenidoDelConjuntoResource, unknown>;

/** Las peticiones que este sistema compone hoy. La guarda las recorre una a una. */
export const PETICIONES: readonly PeticionDeclarada[] = [
  LISTADO_DE_CONJUNTOS,
  ESTADO_DEL_EJERCICIO,
  CONJUNTO_VIGENTE,
  ...AMBITOS.map((ambito) => SNAPSHOT_POR_AMBITO[ambito]),
  LISTADO_DE_EDICIONES,
  CONTENIDO_DEL_CONJUNTO,
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
