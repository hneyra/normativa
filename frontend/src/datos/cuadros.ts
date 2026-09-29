import { coordenada, type CeldaDeLaTabla, type Coordenada, type DatosDeUnaTabla } from '@kamayuk/ui';

import { cliente } from '../api/cliente.ts';
import { t } from '../i18n/i18n.ts';
import type { Conector, Reparto } from './conectores.ts';
import {
  AMBITOS,
  CLAVE_DE_LAS_DEPRECIACIONES,
  CLAVE_DE_LOS_CUADROS,
  CLAVE_DE_LOS_REFERENCIALES,
  CLAVE_DE_LOS_UNITARIOS,
  CONJUNTO_VIGENTE,
  SNAPSHOT_POR_AMBITO,
  rutaDe,
  type Ambito,
  type ConjuntoVigenteResource,
  type DepreciacionDelSnapshot,
  type SnapshotResource,
  type ValorReferencialDelSnapshot,
  type ValorUnitarioDelSnapshot,
} from './lecturas.ts';

/**
 * **Cuadros de valuacion: los tres cuadros nacionales de ADR-0017, leidos del conjunto sellado**
 * (#66).
 *
 * <h2>Es SOLO lectura, y no es un recorte</h2>
 *
 * Los tres cuadros son **nacionales**: los aprueba el MVCS o el MEF y no los edita ninguna
 * municipalidad. En la base eso no es una convencion sino un CHECK —{@link CUADROS_DE_VALUACION}
 * lleva el nombre de cada uno, los tres `municipalidad_id IS NULL`— y el unico rol que puede
 * escribir una fila es `rol_carga_parametros`, que la aplicacion no usa nunca. Por eso este
 * conector **no compone ni una escritura**: no hay accion que registrar en `alHacer`.
 *
 * <h2>Dos lecturas en orden, y una sola `lectura` para las tres peticiones</h2>
 *
 * `GET /conjuntos?ejercicio=` da la identidad —**sin filas**— y de ella sale el `conjuntoId` con el
 * que se piden los snapshots. Las tres van detras del mismo
 * `@RequiereAcceso(acceso = "parametros", privilegio = LECTURA)` (`SnapshotController.java:87,119`),
 * asi que la hoja declara **una** lectura, {@link CLAVE_DE_LOS_CUADROS}: tres estados que valen
 * siempre lo mismo son tres huecos donde hay uno. Es lo contrario del Panel, donde separar SI
 * significa algo (#63, AC 2).
 *
 * <h2>Se piden los DOS ambitos, y hay que decir por que</h2>
 *
 * Porque los tres cuadros no viven en el mismo lado de ADR-0024: los valores unitarios y la
 * depreciacion van en `VALUACION` y el anexo vehicular en `OBLIGACION` (`ComponerSnapshot:71-73`),
 * y esta hoja dibuja los tres a la vez. Con un solo ambito, uno de los tres saldria siempre vacio
 * por reparto — que es informacion, pero no es la hoja que el artboard dibuja.
 *
 * Y pedir los dos **no tapa el reparto**: se mide en los dos y se dice en los dos. La barra de cada
 * tabla lleva los dos desenlaces, el de su ambito y el del otro (ver {@link estadoDelCuadro}), de
 * modo que «no lo lleva» se lee como lo que es —el reparto funcionando— y «lo lleva y llego vacio»
 * como lo que es —una anomalia—.
 *
 * <h2>Y NO se comprueba la huella aqui</h2>
 *
 * Eso es de Publicacion (#67), que para eso usa `cliente.solicitarRespuesta()` y guarda los bytes.
 * Esta hoja dibuja filas, asi que lee con `cliente.solicitar()` y deja que `@kamayuk/api`
 * interprete el cuerpo. Repetir aqui la comprobacion seria una segunda implementacion de la misma
 * afirmacion, y dos que tienen que coincidir son dos que un dia dejan de coincidir.
 *
 * <h2>Lo que esta hoja NO hace todavia, dicho aqui y no descubierto luego</h2>
 *
 * · **El selector de ambito NO gobierna la lectura** (H14a de `frontend/diseno/HUECOS.md`, N11). En
 *   la gramatica V8 el ambito es un campo `s` del bloque, y lo tecleado en un campo vive en el
 *   estado de `<Pantalla>`: ni este conector ni la ruta lo ven. Lo debe `kamayuk-lib`#86. Es la
 *   misma limitacion que declaro #67, y aqui tiene una consecuencia mas: cambiar el desplegable no
 *   vuelve a pedir nada — y no tiene por que, porque los dos ambitos ya estan pedidos.
 * · **No hay pestanas con conteo** (H20). Los tres cuadros son tres bloques del artboard V8, uno
 *   debajo de otro, y no tres pestanas como en la V6.
 * · **«Ese ejercicio no esta publicado» no se distingue de un 404 de ruta.** El discriminador es el
 *   miembro `parametroQueFalta` del `problem+json` —lo pone `FaltaPublicar.noEncontrado` y un 404
 *   de ruta no lo lleva—, y `CuerpoDeProblema` de `@kamayuk/api` **no lo conserva**
 *   (`kamayuk-lib@origin/main:paquetes/api/errores.ts`), asi que `ErrorDeLaApi` llega con los dos
 *   404 marcados `codigo: 'NO_ENCONTRADO'`. Leerlo del `mensaje` en castellano seria exactamente lo
 *   que el catalogo de errores prohibe. Lo pide `kamayuk-lib`#52, y hasta que se mezcle ese criterio
 *   espera — igual que espero el AC 8 de #67.
 */

/* ── Los tres cuadros, como dato ───────────────────────────────────────────────────────────── */

/**
 * Los dominios literales, **leidos de los CHECK del baseline** (`V1__baseline.sql:460-506`).
 *
 * No se escriben a ojo y no se resumen: son la restriccion que la base aplica, con el nombre de la
 * restriccion al lado para que se pueda buscar. Un dominio escrito en la interfaz que no sea el de
 * la base es peor que ninguno, porque se lee como una promesa.
 */
export const DOMINIOS = {
  /** `valor_unitario_edificacion_partida_check`. Son las tres de apreciacion exterior. */
  partida: ['MUROS', 'TECHOS', 'PUERTAS'] as readonly string[],
  /** `valor_unitario_edificacion_categoria_check`: `categoria ~ '^[A-J]$'`. */
  categoria: /^[A-J]$/,
  /** `depreciacion_uso_check`: `uso ~ '^0[1-4]$'`. */
  uso: /^0[1-4]$/,
} as const;

/**
 * Lo que se escribe bajo el rotulo de una columna acotada (H23).
 *
 * Se exporta porque lo escribe la DEFINICION —que no puede importar este archivo: arrastraria
 * `src/api/cliente.ts` -> `src/sesion.ts`, que lee `window` al cargarse— y una guarda cruza los dos
 * lados. Un dominio escrito dos veces y a mano se separa sin dar error: se lee como una promesa.
 */
export const DOMINIO_DE_LA_PARTIDA = DOMINIOS.partida.join(' · ');
export const DOMINIO_DE_LA_CATEGORIA = 'A … J';
export const DOMINIO_DEL_USO = '01 … 04';

/** Cual de las cuatro listas del snapshot trae las filas de un cuadro. */
type CampoDelSnapshot = 'valoresUnitarios' | 'depreciaciones' | 'valoresReferenciales';

/** Un cuadro nacional: de donde sale, que ambito lo lleva y donde lo dibuja la definicion. */
export interface CuadroDeValuacion {
  /** La `clave` con que su tabla lo busca en `DatosDeLaPantalla.tablas`. */
  readonly clave: string;
  /** El campo del `SnapshotResource` que lo trae. */
  readonly campo: CampoDelSnapshot;
  /** La tabla de la base, con el CHECK que la hace nacional. */
  readonly tabla: string;
  readonly checkNacional: string;
  /**
   * La mitad de la frontera de ADR-0024 que lo lleva.
   *
   * No es una etiqueta: es lo que `ComponerSnapshot` mira para dejar la lista vacia o llenarla, y
   * por eso este conector razona con ella en vez de con lo que le haya llegado.
   */
  readonly ambito: Ambito;
  /** El indice de su bloque en `src/pantallas/definiciones/cuadros.ts`. */
  readonly bloque: number;
}

/**
 * Los tres, en el orden en que el artboard V8 los dibuja.
 *
 * El `bloque` va aqui y no se deduce: la definicion tiene cinco bloques y dos de ellos —el selector
 * y «De que region es este cuadro»— no son cuadros. Deducirlo contando tablas ataria este archivo
 * al orden de la definicion sin decirlo; escrito, una guarda lo cruza.
 */
export const CUADROS_DE_VALUACION: readonly CuadroDeValuacion[] = [
  {
    clave: CLAVE_DE_LOS_UNITARIOS,
    campo: 'valoresUnitarios',
    tabla: 'valor_unitario_edificacion',
    checkNacional: 'valor_unitario_nacional_ck',
    ambito: 'VALUACION',
    bloque: 1,
  },
  {
    clave: CLAVE_DE_LAS_DEPRECIACIONES,
    campo: 'depreciaciones',
    tabla: 'depreciacion',
    checkNacional: 'depreciacion_nacional_ck',
    ambito: 'VALUACION',
    bloque: 3,
  },
  {
    clave: CLAVE_DE_LOS_REFERENCIALES,
    campo: 'valoresReferenciales',
    tabla: 'valor_referencial_vehiculo',
    checkNacional: 'valor_referencial_nacional_ck',
    ambito: 'OBLIGACION',
    bloque: 4,
  },
];

/** Los campos de cada bloque de cuadro, en el orden en que el artboard los escribe. */
const DOCUMENTO_FUENTE = 0;
const TABLA_DE_LA_BASE = 1;
const AMBITO_QUE_LA_LLEVA = 2;

/* ── Los cuatro desenlaces de un cuadro (AC 5) ─────────────────────────────────────────────── */

/**
 * Los cuatro desenlaces de un cuadro dentro de un snapshot.
 *
 * **Un cuadro vacio por ambito no es un cuadro sin datos**, y pintar los dos igual haria que un
 * error de carga pasara por normal. Los cuatro se distinguen mirando **dos** cosas: si el ambito
 * pedido lleva ese cuadro (`ComponerSnapshot:71-73`) y cuantas filas llegaron.
 *
 * <ul>
 *   <li>`CON_FILAS` — el ambito lo lleva y llego. Es el caso normal.</li>
 *   <li>`FUERA_DEL_AMBITO` — el ambito no lo lleva y llego vacio. **No es un vacio**: es el reparto
 *       de ADR-0024 funcionando, y se lee como tal.</li>
 *   <li>`SIN_FILAS` — el ambito SI lo lleva y llego vacio. Eso es una anomalia: o el conjunto se
 *       sello sin esa edicion —la version 1 de 2026 se sello sin la vehicular— o algo no compuso.
 *       Se dice, no se disimula.</li>
 *   <li>`DE_MAS` — el ambito no lo lleva y llego lleno. Contra `ComponerSnapshot` no puede pasar,
 *       asi que nombrarlo es lo que impide que la pantalla se acostumbre a un reparto que el
 *       servidor no hace — un intermediario que sirva la respuesta del otro ambito, por ejemplo.</li>
 * </ul>
 *
 * Es la funcion de la V6 (`c01fe9a:frontend/src/secciones/cuadros.ts:196-206`), tal cual: pura, dos
 * argumentos y una cuenta.
 */
export type EstadoDelCuadro = 'CON_FILAS' | 'FUERA_DEL_AMBITO' | 'SIN_FILAS' | 'DE_MAS';

export function estadoDelCuadro(
  ambitoPedido: Ambito,
  cuadro: CuadroDeValuacion,
  cuantasFilas: number,
): EstadoDelCuadro {
  const loLleva = cuadro.ambito === ambitoPedido;
  if (loLleva) return cuantasFilas > 0 ? 'CON_FILAS' : 'SIN_FILAS';
  return cuantasFilas > 0 ? 'DE_MAS' : 'FUERA_DEL_AMBITO';
}

/** Cuantas filas de ese cuadro trae un snapshot. */
export function cuantasFilasDe(cuadro: CuadroDeValuacion, snapshot: SnapshotResource): number {
  return snapshot[cuadro.campo].length;
}

/** El otro ambito, que es donde se mide la otra mitad del reparto. */
export function elOtro(ambito: Ambito): Ambito {
  return ambito === AMBITOS[0] ? AMBITOS[1] : AMBITOS[0];
}

/* ── Las frases de este conector ───────────────────────────────────────────────────────────── */

/**
 * Lo que este conector escribe, en castellano, que es la clave (#60).
 *
 * Pasan por `t()` **aqui** y no por el `traducir` del interprete: lo que el interprete traduce son
 * las palabras de la DEFINICION; los `valores`, las celdas y los `nombrados` son datos y no los
 * toca. Una frase que este conector compone es de las primeras aunque viaje por el segundo camino.
 *
 * **Y ni una cifra dentro**: las cifras de estos tres cuadros son norma nacional y viven en el
 * conjunto sellado (regla 5, ADR-0007). Lo que hay aqui son huecos —`{{cuantas}}`, `{{tope}}`— que
 * se rellenan con lo que llego.
 */
export const FRASES_DE_LOS_CUADROS = {
  // ── El tramo abierto (H22b) ────────────────────────────────────────────────────────────────
  sinTope: 'Sin tope',
  masDeNAnios: 'Más de {{tope}} años',
  notaDeLaAntiguedad:
    'Tramo abierto: «antiguedadHasta» llega como null, y eso no es un dato que falte sino que no hay tope. El tope que se enseña es el del último tramo cerrado de su misma tabla —mismo uso, mismo material y mismo estado—, que son las tres columnas con las que depreciacion_uq identifica la fila. Leerlo como cero convertiría el tramo que todo lo cubre en uno que no cubre nada, y en un padrón viejo es el que más predios alcanza.',
  notaDelAnio:
    'Tramo abierto: «anioConstruccionHasta» llega como null cuando la tabla no le pone tope —la construcción más reciente—. No es un dato que falte, y la base lo admite a propósito: valor_unitario_anio_ck sólo exige que el tope, si lo hay, no sea menor que el inicio.',
  // ── Los cuatro desenlaces (AC 5) ───────────────────────────────────────────────────────────
  conteo: '{{cuantas}} filas, que son las que trajo la lista recibida.',
  conFilas: 'El ámbito {{ambito}} lleva este cuadro, y vino.',
  sinFilas:
    'El ámbito {{ambito}} SÍ lleva este cuadro y llegó vacío: o el conjunto se selló sin esa edición, o algo no compuso. No es el reparto, y las dos se arreglan de manera distinta.',
  fueraDelAmbito: 'Y el ámbito {{ambito}} no lo lleva: es el reparto de ADR-0024, no una ausencia.',
  deMas:
    'Y el ámbito {{ambito}} no lo lleva, y aun así llegó lleno: contra este backend no puede pasar, así que esta respuesta no la compuso ComponerSnapshot.',
  // ── El documento fuente, sacado de las filas (AC 5) ────────────────────────────────────────
  sinFuente: 'sin filas de las que leerlo',
  fuentesDistintas:
    'Las filas dicen documentos fuente distintos: {{cuales}}. Este conjunto compuso dos ediciones del mismo cuadro, y eso no se puede resumir en una línea de cabecera sin mentir.',
  // ── Los dominios, comprobados contra lo recibido (AC 5) ────────────────────────────────────
  fueraDeDominio:
    'Hay valores fuera del dominio que la base declara: {{cuales}}. La base no los puede haber escrito —tiene su CHECK—, así que este cuerpo no viene de donde se cree, y eso hay que verlo antes de usar la cifra que va al lado.',
  // ── Una cifra que no tiene la forma que el contrato sirve ──────────────────────────────────
  cifraQueNoLoEs:
    'Esta cifra no tiene la forma que el contrato sirve —texto decimal con dos decimales como mucho—, así que se enseña tal cual llegó y sin formatear. Redondearla aquí sería aritmética sobre una cifra sellada (regla 1, ADR-0018), y recortarla la perdería en silencio.',
  // ── La ausencia de la hoja ─────────────────────────────────────────────────────────────────
  sinPedir: 'sin pedir',
  laHojaPide:
    'Esta hoja pide el conjunto sellado que rige el ejercicio y dibuja sus tres cuadros nacionales. Son de sólo lectura: escribir una fila es del rol rol_carga_parametros, que esta aplicación no usa nunca.',
} as const;

/** Las claves de traduccion de este conector. */
export function clavesDeLosCuadros(): readonly string[] {
  return Object.values(FRASES_DE_LOS_CUADROS);
}

/* ── El tramo abierto, que no es un dato que falte (AC 4) ──────────────────────────────────── */

/**
 * El texto de un `antiguedadHasta` nulo: **«Más de N años»**, nunca un guion y nunca un cero.
 *
 * El nulo es el tramo con que cierra cada tabla del Anexo I —lo dice el propio comentario de la
 * columna en el baseline: «NULO es "mas de 50 anios"»—, y `N` es el tope del ultimo tramo cerrado
 * de **su misma tabla**: mismo uso, mismo material y mismo estado de conservacion, que son las tres
 * columnas con las que `depreciacion_uq` identifica la fila.
 *
 * Pintarlo como guion diria que no se sabe; pintarlo como cero convertiria el tramo que todo lo
 * cubre en uno que no cubre nada, y sin ningun error de por medio.
 *
 * Cuando el snapshot no trae ningun tramo cerrado de esa tabla —pasa si el cuadro llega recortado—
 * **no se inventa un numero**: se dice «Sin tope», que es lo unico cierto.
 */
export function antiguedadAbierta(
  filas: readonly DepreciacionDelSnapshot[],
  fila: DepreciacionDelSnapshot,
): string {
  let mayor: number | null = null;
  for (const otra of filas) {
    if (
      otra.uso === fila.uso &&
      otra.material === fila.material &&
      otra.estadoConservacion === fila.estadoConservacion &&
      otra.antiguedadHasta !== null &&
      (mayor === null || otra.antiguedadHasta > mayor)
    ) {
      mayor = otra.antiguedadHasta;
    }
  }
  return mayor === null
    ? t(FRASES_DE_LOS_CUADROS.sinTope)
    : t(FRASES_DE_LOS_CUADROS.masDeNAnios, { tope: mayor });
}

/* ── Las celdas ────────────────────────────────────────────────────────────────────────────── */

/** Una cifra servida por el backend: opcionalmente negativa, con 0..2 decimales. */
const CIFRA_SERVIDA = /^-?\d+(\.\d{1,2})?$/;

/**
 * `"104740.5"` -> `"104,740.50"`. Agrupa de tres en tres y completa a dos decimales, **con texto**.
 *
 * <h2>Sin simbolo de moneda, y es una decision del artboard</h2>
 *
 * El artboard V8 pone la moneda en la CABECERA de la columna —«Valor por m² (S/)», «Valor (S/)»— y
 * deja las celdas con la cifra sola. `formatearImporte` de `@kamayuk/formato` **antepone `S/`**
 * (`kamayuk-lib@origin/main:paquetes/formato/formato.ts:70`) y no admite apagarlo, asi que no sirve
 * aqui: repetir «S/» en decenas de miles de filas es ruido, y ademas la columna «Depreciación %»
 * **no es dinero** — un simbolo puesto por omision la convertiria en dinero. Que la libreria admita
 * una cifra sin moneda es lo que habria que pedirle, y queda dicho.
 *
 * <h2>Y no construye un `Number`</h2>
 *
 * Convertir y volver a escribir ya redondea, y aqui lo que se pinta son cifras SELLADAS: pintar una
 * distinta de la sellada es el peor fallo posible y es silencioso (regla 1, ADR-0018).
 *
 * <h2>Lo que hace con una cifra que no tiene esa forma, y por que NO lanza</h2>
 *
 * La V6 lanzaba (`c01fe9a:frontend/src/dominio/formato.ts:61-66`). Aqui no se puede: esto corre
 * dentro de `repartir()`, que `useDatosDeLaHoja` llama **en cada pintada**, y una excepcion ahi no
 * la recoge ninguna lectura — se lleva la hoja entera y deja una pantalla en blanco que no nombra
 * la cifra. Asi que se ensena **tal cual llego**, con la nota que dice que no se formateo y por
 * que: los digitos no se pierden, nadie lee una cifra recortada, y el defecto se ve.
 */
export function cifraDelCuadro(valor: string): CeldaDeLaTabla {
  const limpio = valor.trim();
  if (!CIFRA_SERVIDA.test(limpio)) {
    return { texto: valor, nota: t(FRASES_DE_LOS_CUADROS.cifraQueNoLoEs) };
  }
  const negativo = limpio.startsWith('-');
  const sinSigno = negativo ? limpio.slice(1) : limpio;
  const [enteraCruda, decimalesCrudos] = sinSigno.split('.');
  const entera = (enteraCruda ?? '').replace(/^0+(?=\d)/, '');
  const decimales = `${decimalesCrudos ?? ''}00`.slice(0, 2);
  const agrupada = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '-' : ''}${agrupada}.${decimales}`;
}

/** Un entero del dominio: un anio, o una cuenta de anios. Jamas dinero, y por eso no se agrupa. */
const entero = (valor: number): CeldaDeLaTabla => String(valor);

function filasDeUnitarios(filas: readonly ValorUnitarioDelSnapshot[]): DatosDeUnaTabla['filas'] {
  return filas.map((fila) => ({
    clave: `${fila.partida}-${fila.categoria}-${String(fila.anioConstruccionDesde)}`,
    celdas: [
      fila.partida,
      fila.categoria,
      entero(fila.anioConstruccionDesde),
      fila.anioConstruccionHasta === null
        ? { texto: t(FRASES_DE_LOS_CUADROS.sinTope), nota: t(FRASES_DE_LOS_CUADROS.notaDelAnio) }
        : entero(fila.anioConstruccionHasta),
      cifraDelCuadro(fila.valorM2),
      fila.documentoFuente,
    ] as readonly CeldaDeLaTabla[],
  }));
}

function filasDeDepreciacion(filas: readonly DepreciacionDelSnapshot[]): DatosDeUnaTabla['filas'] {
  return filas.map((fila) => ({
    clave: `${fila.uso}-${fila.material}-${fila.estadoConservacion}-${String(fila.antiguedadHasta)}`,
    celdas: [
      fila.uso,
      fila.material,
      fila.estadoConservacion,
      fila.antiguedadHasta === null
        ? {
            texto: antiguedadAbierta(filas, fila),
            nota: t(FRASES_DE_LOS_CUADROS.notaDeLaAntiguedad),
          }
        : entero(fila.antiguedadHasta),
      cifraDelCuadro(fila.porcentaje),
      fila.documentoFuente,
    ] as readonly CeldaDeLaTabla[],
  }));
}

function filasDeReferenciales(
  filas: readonly ValorReferencialDelSnapshot[],
): DatosDeUnaTabla['filas'] {
  return filas.map((fila) => ({
    clave: `${String(fila.ejercicio)}-${fila.categoria}-${fila.marca}-${fila.modelo}-${String(fila.anioFabricacion)}`,
    celdas: [
      entero(fila.ejercicio),
      fila.categoria,
      fila.marca,
      fila.modelo,
      entero(fila.anioFabricacion),
      cifraDelCuadro(fila.valor),
      fila.documentoFuente,
    ] as readonly CeldaDeLaTabla[],
  }));
}

/** Las filas de ese cuadro, **en el orden en que el snapshot las trae**. */
export function filasDelCuadro(
  cuadro: CuadroDeValuacion,
  snapshot: SnapshotResource,
): DatosDeUnaTabla['filas'] {
  if (cuadro.campo === 'valoresUnitarios') return filasDeUnitarios(snapshot.valoresUnitarios);
  if (cuadro.campo === 'depreciaciones') return filasDeDepreciacion(snapshot.depreciaciones);
  return filasDeReferenciales(snapshot.valoresReferenciales);
}

/* ── El documento fuente, que es lo que hace auditable cada cifra (AC 5) ───────────────────── */

/** Lo que se sabe del documento fuente de un cuadro mirando sus filas. */
export interface FuenteDelCuadro {
  /** El documento, si las filas dicen todas el mismo. */
  readonly documento: string | null;
  /** Los distintos que llegaron. Mas de uno es una edicion mezclada con otra. */
  readonly distintos: readonly string[];
}

/**
 * El documento fuente del cuadro, sacado **de sus filas** y no de una constante.
 *
 * Cada fila lo lleva, asi que la pantalla no tiene que creerselo: lo lee y comprueba que todas
 * dicen lo mismo. Que digan dos cosas distintas significa que el conjunto compuso dos ediciones del
 * mismo cuadro, y eso no se puede resumir en una linea de cabecera sin mentir.
 *
 * Y es lo que impide lo otro: escribir el documento en el codigo lo meteria en el paquete servido,
 * que es justo lo que `sin-cifras-inventadas` y la negativa del `Dockerfile` persiguen.
 */
export function fuenteDelCuadro(
  filas: readonly { readonly documentoFuente: string }[],
): FuenteDelCuadro {
  const distintos: string[] = [];
  for (const fila of filas) {
    if (!distintos.includes(fila.documentoFuente)) distintos.push(fila.documentoFuente);
  }
  return { documento: distintos.length === 1 ? (distintos[0] ?? null) : null, distintos };
}

/** Las filas de ese cuadro tal como llegaron, para leerles el documento fuente. */
function filasCrudas(
  cuadro: CuadroDeValuacion,
  snapshot: SnapshotResource,
): readonly { readonly documentoFuente: string }[] {
  return snapshot[cuadro.campo];
}

/* ── Los dominios, comprobados contra lo que llego (AC 5) ──────────────────────────────────── */

/**
 * Los valores servidos que se salen del dominio que la base declara.
 *
 * La pantalla no se limita a escribir el dominio en la cabecera: lo **comprueba** contra lo que
 * llego. Un `partida: 'MURO'` o un `uso: '05'` no los puede haber escrito la base —tiene su CHECK—,
 * asi que si aparecen es que el cuerpo no viene de donde se cree, y eso hay que verlo antes de usar
 * la cifra que va al lado.
 *
 * Devuelve una descripcion por valor infractor, sin repetir. El anexo vehicular no tiene ningun
 * CHECK de dominio en el baseline —solo `valor >= 0` y el de nacionalidad—, asi que de el no se
 * afirma nada: inventarle un dominio seria escribir una promesa que la base no hace.
 */
export function fueraDeDominio(
  cuadro: CuadroDeValuacion,
  snapshot: SnapshotResource,
): readonly string[] {
  const fallos: string[] = [];
  const anotar = (mensaje: string) => {
    if (!fallos.includes(mensaje)) fallos.push(mensaje);
  };

  if (cuadro.campo === 'valoresUnitarios') {
    for (const fila of snapshot.valoresUnitarios) {
      if (!DOMINIOS.partida.includes(fila.partida)) {
        anotar(`partida «${fila.partida}» (valor_unitario_edificacion_partida_check)`);
      }
      if (!DOMINIOS.categoria.test(fila.categoria)) {
        anotar(`categoria «${fila.categoria}» (valor_unitario_edificacion_categoria_check)`);
      }
    }
  }
  if (cuadro.campo === 'depreciaciones') {
    for (const fila of snapshot.depreciaciones) {
      if (!DOMINIOS.uso.test(fila.uso)) anotar(`uso «${fila.uso}» (depreciacion_uso_check)`);
    }
  }
  return fallos;
}

/* ── La lectura ────────────────────────────────────────────────────────────────────────────── */

/** Lo que la lectura de esta hoja devuelve: la identidad y los dos snapshots. */
export interface LoDeLosCuadros {
  readonly vigente: ConjuntoVigenteResource;
  readonly porAmbito: ReadonlyMap<Ambito, SnapshotResource>;
}

/** La identidad y los dos snapshots, en ese orden: sin el `conjuntoId` no hay que pedir. */
async function pedirLosCuadros(senal: AbortSignal): Promise<LoDeLosCuadros> {
  const vigente = await cliente.solicitar<ConjuntoVigenteResource>(rutaDe(CONJUNTO_VIGENTE), {
    senal,
  });
  const snapshots = await Promise.all(
    AMBITOS.map((ambito) =>
      cliente.solicitar<SnapshotResource>(
        rutaDe(SNAPSHOT_POR_AMBITO[ambito], { id: String(vigente.conjuntoId) }),
        { senal },
      ),
    ),
  );
  const porAmbito = new Map<Ambito, SnapshotResource>();
  AMBITOS.forEach((ambito, i) => {
    const suyo = snapshots[i];
    if (suyo !== undefined) porAmbito.set(ambito, suyo);
  });
  return { vigente, porAmbito };
}

/* ── Lo que se dibuja ──────────────────────────────────────────────────────────────────────── */

/**
 * La barra de la tabla de un cuadro: **cuantas filas y los DOS desenlaces**.
 *
 * Va en la barra y no en un aviso propio por lo mismo que el veredicto de la huella en #67: la
 * gramatica V8 no tiene donde poner un aviso con su tono —seria una pieza mas en `bloques` y el
 * artboard no la declara (H29a)—, y la barra es el sitio donde se cuenta lo que trajo la respuesta.
 *
 * El conteo sale de **la longitud de la lista recibida** y no de un literal ni de `snapshot.filas`,
 * que es la suma de las cuatro listas. Se puede contar porque en este cuadro estan **todas** las
 * filas delante: la paginacion es de cliente. Es justo lo contrario de la regla hermana de
 * `conectores.ts` —no se calcula un agregado que la operacion no publica—: aqui la operacion las
 * publica todas, y contarlas es leer lo que mando.
 */
export function barraDelCuadro(
  cuadro: CuadroDeValuacion,
  suyo: SnapshotResource,
  ajeno: SnapshotResource,
): string {
  const cuantas = cuantasFilasDe(cuadro, suyo);
  const estadoPropio = estadoDelCuadro(cuadro.ambito, cuadro, cuantas);
  const otro = elOtro(cuadro.ambito);
  const estadoAjeno = estadoDelCuadro(otro, cuadro, cuantasFilasDe(cuadro, ajeno));
  const roto = fueraDeDominio(cuadro, suyo);

  const partes = [
    t(FRASES_DE_LOS_CUADROS.conteo, { cuantas }),
    estadoPropio === 'CON_FILAS'
      ? t(FRASES_DE_LOS_CUADROS.conFilas, { ambito: cuadro.ambito })
      : t(FRASES_DE_LOS_CUADROS.sinFilas, { ambito: cuadro.ambito }),
    estadoAjeno === 'DE_MAS'
      ? t(FRASES_DE_LOS_CUADROS.deMas, { ambito: otro })
      : t(FRASES_DE_LOS_CUADROS.fueraDelAmbito, { ambito: otro }),
  ];
  if (roto.length > 0) {
    partes.push(t(FRASES_DE_LOS_CUADROS.fueraDeDominio, { cuales: roto.join('; ') }));
  }
  return partes.join(' ');
}

/**
 * La frase de arriba de la hoja.
 *
 * `enElCampo` es «sin pedir» y no «no publicado»: los huecos de esta hoja son de algo que SI se
 * pide y todavia no ha llegado, no de un campo que ninguna operacion publique.
 */
const AUSENCIA_DE_LA_HOJA = {
  enElCampo: FRASES_DE_LOS_CUADROS.sinPedir,
  explicacion: FRASES_DE_LOS_CUADROS.laHojaPide,
  tono: 'info',
} as const;

export const CUADROS: Conector = {
  lecturas: [
    {
      clave: CLAVE_DE_LOS_CUADROS,
      // El ejercicio va en la clave de consulta: es lo que decide QUE conjunto se pide, y sin el
      // dos ejercicios compartirian la misma entrada de cache. Y la hoja va delante: dos hojas no
      // comparten cache aunque pidan lo mismo.
      consulta: [
        'nor-cuadros',
        CLAVE_DE_LOS_CUADROS,
        CONJUNTO_VIGENTE.parametros['ejercicio'] ?? '',
      ],
      pedir: (senal) => pedirLosCuadros(senal),
    },
  ],

  repartir: (llegado): Reparto => {
    const lo = llegado.get(CLAVE_DE_LOS_CUADROS) as LoDeLosCuadros | undefined;

    const valores = new Map<Coordenada, string>();
    const ausenciaPorCampo = new Map<Coordenada, string>();
    const tablas = new Map<string, DatosDeUnaTabla>();

    // La tabla de la base y el ambito que lleva cada cuadro NO dependen de la lectura: son el CHECK
    // del baseline y el reparto de ADR-0024, y se siguen viendo con la lectura caida — que es
    // cuando explican por que un cuadro que no vino no es de esta municipalidad.
    for (const cuadro of CUADROS_DE_VALUACION) {
      valores.set(coordenada(cuadro.bloque, TABLA_DE_LA_BASE), cuadro.tabla);
      valores.set(coordenada(cuadro.bloque, AMBITO_QUE_LA_LLEVA), cuadro.ambito);
    }

    if (lo === undefined) {
      for (const cuadro of CUADROS_DE_VALUACION) {
        ausenciaPorCampo.set(
          coordenada(cuadro.bloque, DOCUMENTO_FUENTE),
          FRASES_DE_LOS_CUADROS.sinPedir,
        );
      }
      return { valores, tablas, ausenciaPorCampo, ausencia: AUSENCIA_DE_LA_HOJA };
    }

    for (const cuadro of CUADROS_DE_VALUACION) {
      const suyo = lo.porAmbito.get(cuadro.ambito);
      const ajeno = lo.porAmbito.get(elOtro(cuadro.ambito));
      if (suyo === undefined || ajeno === undefined) continue;

      tablas.set(cuadro.clave, {
        filas: filasDelCuadro(cuadro, suyo),
        conteo: barraDelCuadro(cuadro, suyo, ajeno),
      });

      // El documento fuente sale DE LAS FILAS. Sin filas no hay de donde sacarlo y se dice; con dos
      // distintos no se elige uno, se dicen los dos.
      const fuente = fuenteDelCuadro(filasCrudas(cuadro, suyo));
      const donde = coordenada(cuadro.bloque, DOCUMENTO_FUENTE);
      if (fuente.documento !== null) valores.set(donde, fuente.documento);
      else if (fuente.distintos.length === 0) {
        ausenciaPorCampo.set(donde, FRASES_DE_LOS_CUADROS.sinFuente);
      } else {
        valores.set(
          donde,
          t(FRASES_DE_LOS_CUADROS.fuentesDistintas, { cuales: fuente.distintos.join(', ') }),
        );
      }
    }

    return { valores, tablas, ausenciaPorCampo, ausencia: AUSENCIA_DE_LA_HOJA };
  },
};
