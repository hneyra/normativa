import { solicitar, solicitarSnapshot, type SnapshotVerificado } from '../api/cliente.ts';

/**
 * Lo que las pantallas leen del backend, con la forma que el backend publica.
 *
 * <h2>Los tipos se escriben a mano y se COMPRUEBAN contra el fuente (AC2)</h2>
 *
 * `rentas` compara su proxy contra `docs/50-api/formas-de-la-api.json`, que genera una prueba
 * del backend. **Aqui ese archivo no existe**, asi que la comprobacion se hace contra lo unico
 * que hay y que no puede quedarse atras: **el `.java`**. `formas.test.ts` abre
 * `ParametrosController.java`, `SnapshotController.java`, `SnapshotDelConjunto.java` y
 * `RespuestaPaginada.java`, saca los componentes de cada `record` y los compara **campo a
 * campo** con las interfaces de este archivo, leyendo tambien este fuente.
 *
 * **Y los del snapshot se comparan tambien en ORDEN.** El `ETag` es el `sha256` de los bytes
 * que el servidor emite, y Jackson serializa un `record` en el orden de sus componentes: mover
 * un campo de sitio cambiaria la huella sin cambiar un solo valor, y **toda descarga cacheada
 * se leeria como corrupta** (ADR-0025). En los demas la comparacion es de conjunto, porque su
 * huella no la mira nadie.
 *
 * <h2>Un importe es texto (AC3, regla 1)</h2>
 *
 * `valorNumerico`, `valorM2`, `porcentaje` y `valor` viajan como cadena, y aqui se declaran
 * `string`. **Medido en los dos sitios**: los cuatro son `String` en el propio `record` de Java
 * —salen del corpus como texto y no pasan por ningun serializador—, y `ConfiguracionDeJson`
 * garantiza lo mismo para todo objeto de valor del dominio, que emite con `toPlainString()`.
 * Los dos caminos acaban en texto, que es lo que la regla 1 exige: el `number` de JavaScript es
 * binario de doble precision y `0.1 + 0.2` no es `0.3` (RNF-055).
 *
 * <h2>Lo que NO hace</h2>
 *
 * No filtra, no ordena y no compone. Filtrar y ordenar es del servidor mientras el backend no
 * los admita —el proxy ignora la cadena de consulta a proposito (AC5)—, y componer dos
 * respuestas en una es una decision de pantalla que se ve mejor donde se dibuja.
 */

// ── El envoltorio de paginacion ─────────────────────────────────────────────────────────────

/**
 * El sobre en que sale todo listado. Uno solo, el de `RespuestaPaginada.java`.
 *
 * `tamano` **sin enie**: es el nombre que viaja por el cable, no una traduccion. Y
 * `totalElementos` y `totalPaginas` son `number` a proposito —son cuentas de cosas y no cifras
 * del dominio—, que es la unica excepcion declarada de la regla del importe como texto.
 */
export interface Paginado<T> {
  readonly contenido: readonly T[];
  readonly pagina: number;
  readonly tamano: number;
  readonly totalElementos: number;
  readonly totalPaginas: number;
  readonly hayMas: boolean;
}

// ── Las cuatro operaciones que este sistema sirve ───────────────────────────────────────────

/**
 * Un conjunto y su estado, de `GET /seguridad/parametros`.
 *
 * **No lleva ningun importe**, y por eso no le aplica la regla de la fecha de calculo (regla 9):
 * lo que se publica aqui es la IDENTIDAD del juego de parametros, no sus cifras.
 *
 * `fechaSellado` y `usuarioSellado` son nulos mientras el conjunto esta ABIERTO, y no vacios:
 * un conjunto sin sellar no tiene fecha de sellado, y una cadena vacia diria que si la tiene.
 */
export interface ConjuntoResource {
  readonly id: number;
  readonly ejercicio: number;
  readonly version: number;
  /** `ABIERTO` o `SELLADO`. Son dos, y el paso entre ellos va en una sola direccion. */
  readonly estado: string;
  /** Un `Instant`: sale en ISO-8601 con zona. Nulo mientras no se ha sellado. */
  readonly fechaSellado: string | null;
  readonly usuarioSellado: string | null;
}

/**
 * Si un ejercicio esta parametrizado, de `GET /seguridad/parametros/ejercicios/{ejercicio}`.
 *
 * **«No hay conjunto sellado» es una respuesta, no un error**: `sellado` en falso con
 * `conjuntoId` y `version` nulos es un `200` diciendo que no. Lo que si sale distinto es un
 * ejercicio fuera de 1990–2100, que es un `422` nombrando el rango.
 *
 * Es la unica de las cuatro que no exige el acceso `parametros`: va con el centinela
 * `SESION_PROPIA`, para que quien calcula pueda preguntarlo antes de rellenar el formulario.
 */
export interface EjercicioParametrizadoResource {
  readonly ejercicio: number;
  readonly sellado: boolean;
  readonly conjuntoId: number | null;
  readonly version: number | null;
}

/**
 * Que conjunto sellado rige hoy el ejercicio, de `GET /conjuntos?ejercicio=N`.
 *
 * **No lleva ni una fila**, y esa ausencia es la decision: es lo unico que hace falta para saber
 * si el snapshot que ya se tiene en cache sigue siendo el bueno. Pedir el snapshot entero para
 * comprobarlo seria descargar 54 000 filas para leer un numero (ADR-0025 §1).
 *
 * Un ejercicio sin sellar contesta **404**, no 422: aqui se pide un DOCUMENTO y no se intenta
 * ejecutar ningun calculo, y en esta misma ruta el 422 ya significa otra cosa —`?ejercicio=1800`
 * lo rechaza el constructor del ejercicio—.
 */
export interface ConjuntoVigenteResource {
  readonly conjuntoId: number;
  readonly ejercicio: number;
  readonly version: number;
}

/**
 * Una fila de `parametro_tributario` tal como el conjunto la compuso.
 *
 * Lleva la **vigencia** y no el valor ya resuelto: un conjunto sellado contiene a proposito el
 * historico de una llave —`parametros-2026.csv` publica cinco filas de `UIT`— y quien resuelve
 * cual rige es el lector, contra el ejercicio del conjunto. Entregar aqui «la que rige» seria
 * mover esa decision al servidor y hacerla invisible.
 *
 * `valorNumerico` es **texto** (regla 1). `clave` es nula cuando el tipo tiene un solo valor
 * —la UIT no tiene clave— y `vigenciaHasta` es nula cuando la norma no tiene fecha de fin.
 */
export interface ParametroDelSnapshot {
  readonly tipo: string;
  readonly clave: string | null;
  readonly valorNumerico: string | null;
  readonly valorTexto: string | null;
  readonly vigenciaDesde: string | null;
  readonly vigenciaHasta: string | null;
  readonly documentoFuente: string;
}

/** Una celda del cuadro de valores unitarios de edificacion (ADR-0017). */
export interface ValorUnitarioDelSnapshot {
  readonly partida: string;
  readonly categoria: string;
  readonly anioConstruccionDesde: number;
  readonly anioConstruccionHasta: number | null;
  /** Soles por metro cuadrado, como **texto** (regla 1). */
  readonly valorM2: string;
  readonly documentoFuente: string;
}

/**
 * Una fila del cuadro de depreciacion (ADR-0017).
 *
 * `antiguedadHasta` es **nulo en el tramo abierto** —«mas de 50 anios»—, y por eso se declara
 * `number | null` y no `number`: leer ese nulo como cero convierte el tramo que todo lo cubre en
 * uno que no cubre nada, y sin ningun error de por medio.
 */
export interface DepreciacionDelSnapshot {
  readonly uso: string;
  readonly material: string;
  readonly estadoConservacion: string;
  readonly antiguedadHasta: number | null;
  /** El porcentaje de depreciacion, como **texto** (regla 1). */
  readonly porcentaje: string;
  readonly documentoFuente: string;
}

/** Una fila del anexo de valores referenciales de vehiculos del MEF (ADR-0017). */
export interface ValorReferencialDelSnapshot {
  readonly ejercicio: number;
  readonly categoria: string;
  readonly marca: string;
  readonly modelo: string;
  readonly anioFabricacion: number;
  /** El valor referencial, como **texto** (regla 1). */
  readonly valor: string;
  readonly documentoFuente: string;
}

/**
 * El conjunto entero, de `GET /conjuntos/{id}/snapshot?ambito=X`.
 *
 * **El orden de estos nueve campos es parte del contrato**, no una preferencia de lectura: la
 * huella es el `sha256` de los bytes servidos y Jackson emite un `record` en el orden de sus
 * componentes. Ver la cabecera del archivo.
 *
 * **No lleva el `sha256` dentro**, y no es un olvido: la huella es de estos mismos bytes, asi
 * que meterla aqui seria pedirle a un valor que se contenga a si mismo. Va en el `ETag`; el
 * cliente calcula `sha256(cuerpo)`, compara, y guarda el resultado con la fila de su cache.
 */
export interface SnapshotResource {
  readonly conjuntoId: number;
  readonly ejercicio: number;
  readonly version: number;
  /** `VALUACION` u `OBLIGACION`. No hay valor por omision y no se lee en minusculas. */
  readonly ambito: string;
  /** Cuantas filas lleva en total. Es una cuenta de cosas, no una cifra de dinero. */
  readonly filas: number;
  readonly parametros: readonly ParametroDelSnapshot[];
  readonly valoresUnitarios: readonly ValorUnitarioDelSnapshot[];
  readonly depreciaciones: readonly DepreciacionDelSnapshot[];
  readonly valoresReferenciales: readonly ValorReferencialDelSnapshot[];
}

// ── Las rutas, escritas una vez ─────────────────────────────────────────────────────────────

/**
 * Los dos ambitos de ADR-0024, como lista en tiempo de ejecucion.
 *
 * `SnapshotController.ambitoDe` hace `Ambito.valueOf(ambito)` **sin lectura tolerante**:
 * `?ambito=valuacion` en minusculas se rechaza nombrandolo. Asi que la interfaz elige de esta
 * lista y no compone la cadena.
 */
export const AMBITOS = ['VALUACION', 'OBLIGACION'] as const;

export type Ambito = (typeof AMBITOS)[number];

/**
 * Las rutas que este sistema publica, con sus `{parametros}` ya puestos.
 *
 * Escritas aqui y no en cada `solicitar()`: una ruta repetida en dos pantallas se corrige en una
 * sola el dia que cambie, y la otra se queda pidiendo la vieja hasta que alguien abra esa
 * pantalla. Las que llevan parametro son funciones, para que el parametro no se olvide.
 *
 * **Ninguna manda `municipalidad`**: sale del token (regla 2, ADR-0028 §2).
 */
export const RUTAS = {
  conjuntos: '/seguridad/parametros',
  ejercicio: (ejercicio: number) => `/seguridad/parametros/ejercicios/${String(ejercicio)}`,
  vigente: (ejercicio: number) => `/conjuntos?ejercicio=${String(ejercicio)}`,
  snapshot: (conjuntoId: number, ambito: Ambito) =>
    `/conjuntos/${String(conjuntoId)}/snapshot?ambito=${ambito}`,
} as const;

/** Pide una operacion paginada y devuelve solo su contenido. */
export async function pedirLista<T>(ruta: string, senal?: AbortSignal): Promise<readonly T[]> {
  const pagina = await solicitar<Paginado<T>>(ruta, senal === undefined ? {} : { senal });
  return pagina.contenido;
}

/** Pide una operacion que contesta un objeto. */
export async function pedirUno<T>(ruta: string, senal?: AbortSignal): Promise<T> {
  return solicitar<T>(ruta, senal === undefined ? {} : { senal });
}

/**
 * Pide una operacion que el contrato publica como `POST`.
 *
 * **Hoy este sistema no tiene ninguna**, y esta medido: cero `@PostMapping`, `@PutMapping`,
 * `@PatchMapping` y `@DeleteMapping` en todo `src/main`, y las cuatro rutas publicadas son
 * `GET`. Existe porque los tres estados de una lectura tienen que ser el mismo tipo la pida
 * quien la pida (AC4), y porque las **tres escrituras simuladas** de `simulados.ts` —que
 * ADR-0025 §5 anticipa y `src/main` no tiene— si son `POST` y contestan JSON: por aqui pasan,
 * que es como una pantalla puede ejercerlas antes de que existan.
 */
export async function pedirCalculo<T>(ruta: string, senal?: AbortSignal): Promise<T> {
  return solicitar<T>(ruta, {
    metodo: 'POST',
    ...(senal === undefined ? {} : { senal }),
  });
}

/**
 * Pide el snapshot y **comprueba su huella antes de devolverlo** (AC10).
 *
 * No es una lectura mas, y por eso no pasa por `pedirUno`: el snapshot es inmutable y se cachea
 * un ano (`Cache-Control: public, max-age=31536000, immutable`), asi que un byte de diferencia
 * no es un detalle — es una copia corrupta que nadie volveria a pedir. Quien lo llame recibe la
 * huella junto al recurso, que es lo que se guarda con la fila de la cache.
 */
export async function pedirSnapshot(
  conjuntoId: number,
  ambito: Ambito,
  senal?: AbortSignal,
): Promise<SnapshotVerificado<SnapshotResource>> {
  return pedirSnapshotDe(RUTAS.snapshot(conjuntoId, ambito), senal);
}

/**
 * La misma lectura, pedida por su ruta ya compuesta.
 *
 * Existe porque los hooks de `useRecurso.ts` se rehacen **cuando cambia la ruta** —es su unica
 * dependencia, y es lo que aborta la peticion anterior al cambiar de conjunto o de ambito—, asi
 * que lo que necesitan es una funcion de ruta y no de argumentos sueltos. `pedirSnapshot`
 * delega aqui para que la ruta se componga en un solo sitio: dos formas de escribir
 * `/conjuntos/{id}/snapshot?ambito=X` son dos que un dia dejan de coincidir, y en esta
 * operacion una ruta distinta es **otra huella**.
 */
export async function pedirSnapshotDe(
  ruta: string,
  senal?: AbortSignal,
): Promise<SnapshotVerificado<SnapshotResource>> {
  return solicitarSnapshot<SnapshotResource>(ruta, senal === undefined ? {} : { senal });
}
