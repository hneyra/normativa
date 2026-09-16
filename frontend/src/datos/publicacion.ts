import { entregarAlNavegador } from '@kamayuk/api';
import {
  avisar,
  coordenada,
  type CeldaDeLaTabla,
  type Coordenada,
  type DatoConNombre,
  type DatosDeUnaTabla,
} from '@kamayuk/ui';

import { cliente } from '../api/cliente.ts';
import { t } from '../i18n/i18n.ts';
import type { Conector, Reparto } from './conectores.ts';
import { huellaAnunciada, sePuedeCalcularLaHuella, sha256DeLosBytes } from './huella.ts';
import {
  AMBITOS,
  CLAVE_DE_LAS_LISTAS,
  CLAVE_DE_LA_PUBLICACION,
  CLAVE_DE_LOS_CONSUMIDORES,
  CONJUNTO_VIGENTE,
  DATO_DEL_IMPEDIMENTO,
  DATO_DEL_TONO,
  SNAPSHOT_POR_AMBITO,
  rutaDe,
  type Ambito,
  type ConjuntoVigenteResource,
  type SnapshotResource,
} from './lecturas.ts';

/**
 * **Publicacion: lo que se sirve, y la comprobacion de que es lo que el servidor anuncio** (#67).
 *
 * <h2>Por que esta hoja NO lee como las otras tres</h2>
 *
 * Porque su respuesta viene **firmada**. El controlador serializa el snapshot a una cadena, calcula
 * el `sha256` de **esos bytes** y lo manda en el `ETag`, con
 * `Cache-Control: public, max-age=31536000, immutable` (`SnapshotController.java:133-143`). Asi que
 * `cliente.solicitar()` no sirve aqui: termina en `respuesta.json()`, y volver a serializar el
 * objeto da otro texto —`1.0` vuelve `1`, un escape vuelve la letra— con otra huella; y las
 * cabeceras, donde viaja la que hay que comparar, no salen de ahi. Lo que se usa es
 * `cliente.solicitarRespuesta()`, que `kamayuk-lib`#57 subio para esto.
 *
 * **Y se comprueba en vez de creersela** porque la respuesta se guarda un ano con `immutable`: una
 * copia corrupta no se volveria a pedir nunca. El error hay que darlo aqui, diciendo las dos
 * huellas, o no se da.
 *
 * <h2>Una lectura para tres peticiones, y esta medido</h2>
 *
 * `GET /conjuntos` y las dos `GET /conjuntos/{id}/snapshot` van detras del **mismo**
 * `@RequiereAcceso(acceso = "parametros", privilegio = LECTURA)`
 * (`SnapshotController.java:87,119`): no hay ninguna que pueda contestar 403 mientras otra contesta
 * 200. Y las dos ultimas no se pueden pedir sin el `conjuntoId` que devuelve la primera. Por eso la
 * hoja declara **una** lectura, `CLAVE_DE_LA_PUBLICACION`, y no tres. Es lo contrario del Panel,
 * donde separar SI significa algo (#63, AC 2).
 *
 * <h2>Una huella que no cuadra NO es un fallo de la lectura, y es deliberado</h2>
 *
 * Si se lanzara, `useDatosDeLaHoja` la pasaria por `peldanoDe()` y la dibujaria como una averia
 * **con su boton de «Reintentar»** — y reintentar es justo lo que no hay que hacer: una huella que
 * no cuadra se arregla mirando por donde pasa la respuesta —un intermediario que recomprime, un
 * proxy que reescribe, el conjunto cambiado bajo un `immutable` de un ano—, y pulsar otra vez la
 * trae igual. Asi que la comprobacion **contesta**: el veredicto es un dato de la hoja, con las dos
 * huellas dentro, y el desenlace malo no se puede dibujar como si fuera bueno.
 *
 * Lo que si se lanza es lo que la escalera de `@kamayuk/sesion` sabe clasificar: un 401, un 403, un
 * 404, un 500. Eso no se traduce aqui — seria la traduccion paralela que el AC 4 de #63 prohibe.
 *
 * <h2>Lo que esta hoja NO puede hacer todavia, dicho aqui y no descubierto luego</h2>
 *
 * · **El selector de ambito no gobierna la lectura** (H14a de `frontend/diseno/HUECOS.md`, N11). En
 *   la gramatica V8 el ambito es un campo `s` del bloque, y lo tecleado en un campo vive en el
 *   estado de `<Pantalla>`: ni este conector ni la ruta lo ven. Asi que la hoja pide **los dos
 *   ambitos siempre** —que es ademas lo que el bloque «Un conjunto, dos descargas» necesita— y la
 *   ficha «La respuesta» y la descarga son las de {@link AMBITO_DE_LA_FICHA}, que es la opcion que
 *   el interprete deja seleccionada. No se arregla aqui con un estado propio: el selector tiene que
 *   pasar a ser un parametro de la lectura, y eso cambia tambien el artboard.
 * · **«Ese ejercicio no esta publicado» no se distingue de un 404 de ruta.** El discriminador es el
 *   miembro `parametroQueFalta` del `problem+json` —lo pone `FaltaPublicar.noEncontrado` y un 404
 *   de ruta no lo lleva—, y **`CuerpoDeProblema` de `@kamayuk/api` no lo conserva**: declara seis
 *   miembros y ese no esta (`kamayuk-lib@origin/main:paquetes/api/errores.ts:38-46`), asi que
 *   `ErrorDeLaApi` llega con los dos 404 marcados `codigo: 'NO_ENCONTRADO'` y son indistinguibles
 *   desde aqui. Leerlo del `mensaje` en castellano seria exactamente lo que el catalogo de errores
 *   prohibe. Lo pide `kamayuk-lib`#86.
 */

/* ── Lo que se afirma de una descarga ──────────────────────────────────────────────────────── */

/**
 * El `Cache-Control` que el contrato declara para esta respuesta.
 *
 * Se declara para poder **comparar** lo que llego con lo que el contrato dice, no para ensenarlo en
 * su lugar: un intermediario que reescriba la cabecera cambia cuanto tiempo se puede guardar el
 * snapshot **sin que el cuerpo cambie ni un byte**, y eso solo se ve comparando. Es la del
 * controlador (`SnapshotController.java:141`): un ano es el maximo que la especificacion admite, e
 * `immutable` es lo que dice que no hace falta revalidar nunca.
 */
export const CACHE_CONTROL_DEL_CONTRATO = 'public, max-age=31536000, immutable';

/**
 * El ambito cuya descarga ensena la ficha «La respuesta» y entrega la accion de guardar.
 *
 * Es `AMBITOS[0]`, que es **la opcion que el interprete deja seleccionada** en el desplegable —«La
 * primera es la que el interprete deja seleccionada», `CampoDeLista` de `@kamayuk/ui`—, de modo que
 * lo que la ficha dice y lo que el selector ensena son lo mismo. Que deje de ser una constante y
 * pase a salir del selector es H14a; ver el javadoc de arriba.
 */
export const AMBITO_DE_LA_FICHA: Ambito = AMBITOS[0];

/** Lo que se concluyo de la huella de una descarga. */
export type Veredicto =
  /** El `sha256` de los bytes es el que el `ETag` anuncio. */
  | { readonly clase: 'verificada'; readonly huella: string }
  /** Llego y NO es. Lleva las dos huellas: es lo unico con lo que se puede empezar a mirar. */
  | { readonly clase: 'no-cuadra'; readonly anunciada: string; readonly calculada: string }
  | { readonly clase: 'sin-etag' }
  | { readonly clase: 'etag-debil'; readonly etag: string }
  | { readonly clase: 'etag-que-no-es-sha256'; readonly etag: string }
  /** Este origen no ofrece la criptografia: **no se afirma nada**, ni bien ni mal. */
  | { readonly clase: 'sin-origen-seguro'; readonly anunciada: string };

/** Una descarga del snapshot, con lo que llego y lo que se concluyo de ello. */
export interface Descarga {
  readonly ambito: Ambito;
  /** El cuerpo interpretado. Se lee para dibujarlo; **la huella no se calcula de aqui**. */
  readonly snapshot: SnapshotResource;
  /** Los bytes tal cual llegaron. Es lo que se guarda al exportar, y de lo que sale la huella. */
  readonly texto: string;
  readonly cacheControl: string | null;
  /** El `ETag` tal cual llego, o `null`. Se ensena aunque no sirva: es lo que el servidor mando. */
  readonly etag: string | null;
  readonly veredicto: Veredicto;
}

/** Lo que la lectura de esta hoja devuelve: la identidad y las dos descargas. */
export interface LoDeLaPublicacion {
  readonly vigente: ConjuntoVigenteResource;
  readonly porAmbito: ReadonlyMap<Ambito, Descarga>;
}

/* ── La lectura ────────────────────────────────────────────────────────────────────────────── */

/**
 * Pide una descarga y **comprueba su huella**, sin lanzar por el desenlace malo.
 *
 * El orden importa y es el del criterio: primero el `ETag` —sin uno fuerte no hay nada que comparar
 * y se dice—, despues si este origen puede calcular —si no, no se afirma nada—, y solo entonces el
 * `sha256` sobre el texto recibido.
 */
async function descargar(id: number, ambito: Ambito, senal: AbortSignal): Promise<Descarga> {
  const respuesta = await cliente.solicitarRespuesta(
    rutaDe(SNAPSHOT_POR_AMBITO[ambito], { id: String(id) }),
    { senal },
  );
  const etag = respuesta.cabeceras.get('ETag');
  const comun = {
    ambito,
    snapshot: interpretar(respuesta.texto, ambito),
    texto: respuesta.texto,
    cacheControl: respuesta.cabeceras.get('Cache-Control'),
    etag,
  };

  const anunciada = huellaAnunciada(etag);
  if (anunciada.clase !== 'huella') return { ...comun, veredicto: anunciada };
  if (!sePuedeCalcularLaHuella()) {
    return { ...comun, veredicto: { clase: 'sin-origen-seguro', anunciada: anunciada.huella } };
  }

  const calculada = await sha256DeLosBytes(respuesta.texto);
  return {
    ...comun,
    veredicto:
      calculada === anunciada.huella
        ? { clase: 'verificada', huella: calculada }
        : { clase: 'no-cuadra', anunciada: anunciada.huella, calculada },
  };
}

/**
 * El cuerpo, interpretado para DIBUJARLO.
 *
 * Se interpreta aparte de la huella y despues de guardarse el texto: lo que se firma son los bytes,
 * y este objeto no vuelve a salir de aqui hacia ningun sitio donde se reserialice.
 */
function interpretar(texto: string, ambito: Ambito): SnapshotResource {
  try {
    return JSON.parse(texto) as SnapshotResource;
  } catch (noEsJson) {
    throw new Error(
      `El snapshot de «${ambito}» llego con un cuerpo que no es JSON. Antes de mirar la huella hay ` +
        'que mirar quien contesto: un 200 con HTML es un reenvio que apunta a la interfaz y no a la ' +
        'API.',
      { cause: noEsJson },
    );
  }
}

/** La identidad y las dos descargas, en ese orden: sin el `conjuntoId` no hay que pedir. */
async function pedirLaPublicacion(senal: AbortSignal): Promise<LoDeLaPublicacion> {
  const vigente = await cliente.solicitar<ConjuntoVigenteResource>(rutaDe(CONJUNTO_VIGENTE), {
    senal,
  });
  const descargas = await Promise.all(
    AMBITOS.map((ambito) => descargar(vigente.conjuntoId, ambito, senal)),
  );
  const porAmbito = new Map<Ambito, Descarga>(descargas.map((descarga) => [descarga.ambito, descarga]));
  loUltimoDescargado = porAmbito;
  return { vigente, porAmbito };
}

/* ── Guardar los bytes que se verificaron ──────────────────────────────────────────────────── */

/**
 * Lo ultimo que se descargo, para que la accion lo pueda entregar.
 *
 * <h2>Por que hay una variable de modulo, y por que se escribe en la PETICION</h2>
 *
 * Porque la accion del pie la llama `@kamayuk/shell` desde fuera del arbol de la pantalla y solo
 * recibe **la clave del destino** (`AccionesAlPie.tsx:50`): no hay por donde pasarle los bytes. Se
 * escribe en la peticion —y no en `repartir`, que corre en cada pintada— para que esto sea un
 * efecto de haber pedido y no de haber dibujado.
 *
 * Y guarda **la descarga entera**, con su veredicto: quien entregue tiene que poder negarse cuando
 * lo que hay no esta verificado.
 */
let loUltimoDescargado: ReadonlyMap<Ambito, Descarga> = new Map();

/** La ultima descarga de un ambito, o `undefined` si todavia no se ha pedido ninguna. */
export function loUltimoDe(ambito: Ambito): Descarga | undefined {
  return loUltimoDescargado.get(ambito);
}

/** Olvida lo descargado. Para una prueba que quiera el estado de antes de pedir nada. */
export function olvidarLoDescargado(): void {
  loUltimoDescargado = new Map();
}

/**
 * Como se llama el archivo que se guarda.
 *
 * Lleva **el conjunto, el ejercicio, la version y el ambito**, y no es cosmetico: un
 * `snapshot.json` en la carpeta de descargas es indistinguible del de otro ejercicio, del de otra
 * version del mismo ejercicio —que las hay: `conjunto_uq` lleva la version— y del de la otra mitad
 * de ADR-0024. Los cuatro datos son exactamente la identidad con la que un consumidor decide si lo
 * que tiene sirve.
 */
export function nombreDelArchivo(snapshot: SnapshotResource): string {
  return `${[
    'normativa-conjunto',
    String(snapshot.conjuntoId),
    String(snapshot.ejercicio),
    `v${String(snapshot.version)}`,
    snapshot.ambito,
  ].join('-')}.json`;
}

/**
 * Entrega **los bytes que se verificaron**, o dice por que no se entrega nada.
 *
 * <h2>Lo que NO se hace, y es la mitad del criterio</h2>
 *
 * · **No se vuelve a pedir la ruta.** Lo que se guarda es el texto cuyo `sha256` se comparo contra
 *   el `ETag`; volver a pedirlo descargaria una respuesta **que nadie ha comprobado** —o la copia
 *   de la cache del navegador, que bajo `immutable` puede ser de hace un ano—.
 * · **No se cuelga un `<a download>` de la ruta de la API.** Ese enlace sale sin `Authorization`
 *   —el token viaja en una cabecera— y lo que se guarda es el 401 con nombre de archivo.
 * · **No se usa `cliente.descargar()`.** Lanza `NoEsUnDocumento` ante un 200 con JSON, que es
 *   exactamente el tipo de medio del snapshot — y esta bien que lo lance.
 *
 * Lo que si se usa es `entregarAlNavegador` de `@kamayuk/api`, que recibe un `DocumentoDescargado`
 * ya bajado, crea el enlace, lo pulsa y revoca la URL del `Blob`.
 *
 * @returns si se entrego algo. `false` con el motivo ya avisado.
 */
export function guardarElSnapshot(): boolean {
  const descarga = loUltimoDe(AMBITO_DE_LA_FICHA);
  const motivo = porQueNoSePuedeGuardar(descarga);
  if (motivo !== null || descarga === undefined) {
    avisar(t(FRASES_DE_LA_PUBLICACION.noSeGuardo), {
      description: motivo ?? t(FRASES_DE_LA_PUBLICACION.todaviaNoLlego),
    });
    return false;
  }
  entregarAlNavegador({
    nombre: nombreDelArchivo(descarga.snapshot),
    tipoDeMedio: 'application/json',
    contenido: new Blob([descarga.texto], { type: 'application/json' }),
  });
  return true;
}

/**
 * Por que no se puede guardar esta descarga, o `null` si se puede. Ya traducido.
 *
 * Lleva **el veredicto entero, con su detalle**: es el unico sitio de la hoja donde el desenlace
 * malo se explica largo, y quien lee el boton impedido es quien tiene que poder arreglarlo. Con la
 * huella mal, ahi salen las dos huellas.
 */
function porQueNoSePuedeGuardar(descarga: Descarga | undefined): string | null {
  if (descarga === undefined) return t(FRASES_DE_LA_PUBLICACION.todaviaNoLlego);
  if (descarga.veredicto.clase === 'verificada') return null;
  return `${t(FRASES_DE_LA_PUBLICACION.soloLoVerificado, {
    ambito: descarga.ambito,
    porQue: tituloDelVeredicto(descarga.veredicto),
  })} ${detalleDelVeredicto(descarga.veredicto)}`;
}

/* ── Las frases de este conector ───────────────────────────────────────────────────────────── */

/**
 * Lo que este conector escribe, en castellano, que es la clave (#60).
 *
 * Pasan por `t()` **aqui** y no por el `traducir` del interprete: lo que el interprete traduce son
 * las palabras de la DEFINICION; los `valores`, las celdas y los `nombrados` son datos y no los
 * toca. Una frase que este conector compone es de las primeras aunque viaje por el segundo camino.
 */
export const FRASES_DE_LA_PUBLICACION = {
  // ── El veredicto de la huella ──────────────────────────────────────────────────────────────
  cuadra: 'El sha256 de los bytes recibidos es el que el ETag anunció.',
  cuadraDetalle:
    'La huella es de los bytes que se sirven, no de una serialización canónica aparte: una canónica exigiría dos implementaciones que tienen que coincidir —una en el servidor y otra en cada consumidor—, y dos algoritmos que deben dar lo mismo son dos que un día dejan de darlo.',
  noCuadra:
    'El sha256 de los bytes NO es el del ETag: anunciado {{anunciada}}, calculado {{calculada}}.',
  noCuadraDetalle:
    'No se usa y no se reintenta: reintentar lo trae igual. Lo que hay que mirar es por dónde pasa la respuesta —un intermediario que recomprime, un proxy que reescribe, o el conjunto cambiado bajo un «immutable» de un año—, porque una copia corrupta guardada un año no se vuelve a pedir nunca.',
  sinEtag: 'La respuesta no trae ETag, así que no hay huella que comparar.',
  sinEtagDetalle:
    'No se acepta: el snapshot se guarda un año, y al releerlo no habría con qué decidir que es el mismo. Lo manda el servidor, y este lo manda, así que si falta hay que mirar qué hay en el camino.',
  etagDebil: 'El ETag llegó débil ({{etag}}), y un ETag débil no vale aquí.',
  etagDebilDetalle:
    'W/ significa «equivalente para el uso»; la pregunta de esta pantalla es si son los MISMOS bytes. No se le quita la W/ para comparar igual: se dice, porque un intermediario que recomprima puede servir un ETag débil correcto sobre bytes distintos.',
  etagRaro: 'El ETag llegó como {{etag}}, que no es un sha256 en hexadecimal.',
  etagRaroDetalle:
    'No hay con qué comparar lo que esta pantalla calcula. Lo que cambió no es la respuesta: es con qué algoritmo se firma.',
  sinOrigenSeguro: 'Aquí no se puede comprobar la huella: esta dirección no es un origen seguro.',
  sinOrigenSeguroDetalle:
    'El navegador sólo ofrece la criptografía que el sha256 necesita bajo «https://», en «localhost» o en «127.0.0.1». Así que esta pantalla no afirma nada sobre la huella: ni que cuadra ni que no. El ETag que el servidor anunció sí se enseña, porque llegó.',
  // ── El Cache-Control ───────────────────────────────────────────────────────────────────────
  cacheEsLaDelContrato: 'Y el Cache-Control es el que el contrato declara.',
  cacheNoEsLaDelContrato:
    'Los bytes no están en duda; lo que está en duda es cuánto se pueden guardar: el contrato declara «{{contrato}}» y llegó «{{llego}}». Algo en el camino la reescribió, y quien guarde esta copia un año lo hará sin que nadie se lo haya autorizado.',
  sinCacheControl: 'sin Cache-Control',
  // ── Los dos ámbitos ────────────────────────────────────────────────────────────────────────
  identidad: 'conjunto {{conjunto}} · ejercicio {{ejercicio}} · versión {{version}}',
  huellasDistintas:
    'Misma identidad y huellas distintas, que es lo que hace entendible que un mismo conjunto tenga dos descargas: quien necesita las dos mitades pide DOS snapshots del MISMO conjunto, y la identidad es lo que las dos corridas comparan.',
  mismaHuella:
    'Misma identidad y MISMA huella: las dos descargas son byte a byte el mismo archivo. Contra este backend no puede ser —los cuadros que lleva cada ámbito son distintos—, así que esta respuesta no la compuso ComponerSnapshot.',
  identidadDistinta:
    'Las dos descargas dicen ser de conjuntos distintos. No son dos mitades del mismo juego de valores, así que una determinación hecha con una y una valuación hecha con la otra no se pueden comparar.',
  sinLasDos: 'No se pudieron comparar: falta la huella de al menos uno de los dos ámbitos.',
  // ── Qué viene y qué no ─────────────────────────────────────────────────────────────────────
  vanEnLosDos:
    'Van en los DOS ámbitos: una valuación que necesitara el «% actualización» tendría que pedir otro snapshot para una sola cifra.',
  vacioEnLosDos:
    'Van en los dos ámbitos, así que vacío no lo explica el ámbito: este conjunto se selló sin un solo parámetro, o algo no compuso.',
  loLlevaYVino: 'Este ámbito lo lleva, y vino.',
  loLlevaYVacio:
    'Este ámbito SÍ lo lleva y llegó vacío: o el conjunto se selló sin esa edición, o algo no compuso. No es el reparto.',
  noLoLleva: 'El ámbito {{ambito}} no lo lleva: es el reparto de ADR-0024, no una ausencia.',
  noLoLlevaYVino:
    'El ámbito {{ambito}} no lo lleva, y aun así llegó lleno: contra este backend no puede pasar, así que esta respuesta no la compuso ComponerSnapshot.',
  // ── Por qué se puede guardar para siempre ──────────────────────────────────────────────────
  loSelladoNoCambia:
    'Un disparador de la base vuelve inmutable el conjunto y su contenido en cuanto se sella. No hay invalidación que diseñar, ni ventana de inconsistencia, ni TTL que ajustar.',
  cachePorContenido:
    'Por el conjunto y su huella, no por tiempo. Y por eso el recálculo no pasa por la red: parte del conjunto que la determinación guardó, y ese conjunto ya está en la caché.',
  ordenTotal:
    'Las tres consultas de los cuadros llevan ORDER BY completo: si el orden dependiera del plan, el ETag cambiaría sin que cambiara el conjunto, y todo snapshot guardado se leería como corrupto.',
  // ── Guardar ────────────────────────────────────────────────────────────────────────────────
  noSeGuardo: 'No se guardó nada.',
  todaviaNoLlego:
    'Todavía no ha llegado ninguna descarga verificada: la hoja la está pidiendo, o la petición falló y el motivo está arriba.',
  soloLoVerificado:
    'Sólo se guarda lo que se verificó, y la descarga de {{ambito}} no lo está: {{porQue}}',
  // ── La ausencia de la hoja ─────────────────────────────────────────────────────────────────
  sinPedir: 'sin pedir',
  laHojaPide:
    'Esta hoja pide el conjunto sellado entero y comprueba en el navegador que sus bytes son los que el ETag anuncia. Lo que diga de la huella sale de recalcularla aquí, no de creerse la cabecera.',
} as const;

/**
 * Las claves de traduccion de este conector.
 *
 * Con **lo que dice cada fila de la tabla de consumidores**, que son frases de este sistema aunque
 * vivan en {@link CONSUMIDORES}: «Una vez por emision» se traduce, y el nombre del sistema y su
 * ambito no —son identificadores, y traducirlos renombraria un sistema en una celda—.
 */
export function clavesDeLaPublicacion(): readonly string[] {
  return [
    ...Object.values(FRASES_DE_LA_PUBLICACION),
    ...CONSUMIDORES.flatMap((consumidor) => [consumidor.cuando, consumidor.queHace]),
  ];
}

/* ── Quien se lleva esto ───────────────────────────────────────────────────────────────────── */

/** Un consumidor declarado, con el ambito que pide y lo que hace con el. */
export interface Consumidor {
  /** El sistema. **Sale de los `ContratoCon*Test` del backend**, y una guarda lo cruza. */
  readonly sistema: string;
  readonly ambito: Ambito;
  readonly cuando: string;
  readonly queHace: string;
}

/**
 * Quien consume el conjunto sellado, **segun el contrato que cada uno publica**.
 *
 * Los sistemas no se escriben a ojo: son los que declaran los dos
 * `backend/kamayuk-normativa-aplicacion/.../ContratoCon{Rentas,Catastro}Test.java`, y
 * `verificaciones/los-consumidores-tienen-procedencia.test.ts` los lee de ahi y los cruza con esta
 * tabla. Un consumidor nuevo en el backend sin fila aqui sale rojo, y una fila aqui sin contrato
 * detras tambien.
 *
 * La tabla existe porque es lo que convierte «publicamos un JSON» en «esto es lo que se rompe si
 * cambia»: un campo que este sistema deje de publicar pone rojo el build de ESTE repositorio, no el
 * del consumidor (ADR-0030 §4).
 *
 * `rentas` aparece dos veces a proposito: hoy pide los DOS ambitos del MISMO conjunto porque
 * todavia lleva `catastro` dentro, y es el caso que hace util que la identidad no dependa del
 * ambito.
 */
export const CONSUMIDORES: readonly Consumidor[] = [
  {
    sistema: 'catastro',
    ambito: 'VALUACION',
    cuando: 'Una vez por corrida de valuación',
    queHace: 'Dice cuánto vale un predio',
  },
  {
    sistema: 'rentas',
    ambito: 'OBLIGACION',
    cuando: 'Una vez por emisión',
    queHace: 'Dice cuánto se debe por él',
  },
  {
    sistema: 'rentas',
    ambito: 'VALUACION',
    cuando: 'Mientras siga llevando catastro dentro',
    queHace: 'Pide DOS snapshots del MISMO conjunto: la identidad es la misma',
  },
];

/** Las dos operaciones que los dos contratos declaran, y las unicas. */
export const OPERACIONES_CONSUMIDAS: readonly string[] = [
  'GET /conjuntos',
  'GET /conjuntos/{id}/snapshot',
];

/* ── Del veredicto a lo que se lee ─────────────────────────────────────────────────────────── */

/** El titulo de un veredicto, ya traducido y con sus datos dentro. */
export function tituloDelVeredicto(veredicto: Veredicto): string {
  switch (veredicto.clase) {
    case 'verificada':
      return t(FRASES_DE_LA_PUBLICACION.cuadra);
    case 'no-cuadra':
      return t(FRASES_DE_LA_PUBLICACION.noCuadra, {
        anunciada: veredicto.anunciada,
        calculada: veredicto.calculada,
      });
    case 'sin-etag':
      return t(FRASES_DE_LA_PUBLICACION.sinEtag);
    case 'etag-debil':
      return t(FRASES_DE_LA_PUBLICACION.etagDebil, { etag: veredicto.etag });
    case 'etag-que-no-es-sha256':
      return t(FRASES_DE_LA_PUBLICACION.etagRaro, { etag: veredicto.etag });
    case 'sin-origen-seguro':
      return t(FRASES_DE_LA_PUBLICACION.sinOrigenSeguro);
  }
}

/** El detalle de un veredicto: por que importa y que se hace con ello. */
function detalleDelVeredicto(veredicto: Veredicto): string {
  switch (veredicto.clase) {
    case 'verificada':
      return t(FRASES_DE_LA_PUBLICACION.cuadraDetalle);
    case 'no-cuadra':
      return t(FRASES_DE_LA_PUBLICACION.noCuadraDetalle);
    case 'sin-etag':
      return t(FRASES_DE_LA_PUBLICACION.sinEtagDetalle);
    case 'etag-debil':
      return t(FRASES_DE_LA_PUBLICACION.etagDebilDetalle);
    case 'etag-que-no-es-sha256':
      return t(FRASES_DE_LA_PUBLICACION.etagRaroDetalle);
    case 'sin-origen-seguro':
      return t(FRASES_DE_LA_PUBLICACION.sinOrigenSeguroDetalle);
  }
}

/**
 * Lo que se dice de la CACHE de una descarga, que es una afirmacion distinta de la de los bytes.
 *
 * Con la huella bien y el `Cache-Control` cambiado, el desenlace **no es «ok»**: los bytes son los
 * que el `ETag` anuncia, y lo que esta en duda es «guárdalo un año y no vuelvas a pedirlo», que es
 * de lo que vive ADR-0025 §1. Por eso son dos frases y no una.
 */
function loDeLaCache(cacheControl: string | null): string {
  if (cacheControl === CACHE_CONTROL_DEL_CONTRATO) {
    return t(FRASES_DE_LA_PUBLICACION.cacheEsLaDelContrato);
  }
  return t(FRASES_DE_LA_PUBLICACION.cacheNoEsLaDelContrato, {
    contrato: CACHE_CONTROL_DEL_CONTRATO,
    llego: cacheControl ?? t(FRASES_DE_LA_PUBLICACION.sinCacheControl),
  });
}

/**
 * El tono de la comprobacion, con los TRES desenlaces separados.
 *
 * · `ok` — la huella cuadra **y** el `Cache-Control` es el del contrato.
 * · `atencion` — la huella cuadra y la cache no es la prometida, o este origen no puede comprobar.
 *   Los bytes no estan en duda, y decir «ok» afirmaria algo que no se midio.
 * · `mal` — la huella no cuadra, o no hay `ETag` fuerte con el que compararla.
 */
export function tonoDeLaComprobacion(descarga: Descarga): 'ok' | 'atencion' | 'mal' {
  const clase = descarga.veredicto.clase;
  if (clase === 'sin-origen-seguro') return 'atencion';
  if (clase !== 'verificada') return 'mal';
  return descarga.cacheControl === CACHE_CONTROL_DEL_CONTRATO ? 'ok' : 'atencion';
}

/** La huella que se puede ensenar de una descarga: la comparada, la calculada, o ninguna. */
function huellaQueSeEnsena(descarga: Descarga | undefined): string | null {
  if (descarga === undefined) return null;
  const veredicto = descarga.veredicto;
  if (veredicto.clase === 'verificada') return veredicto.huella;
  if (veredicto.clase === 'no-cuadra') return veredicto.calculada;
  if (veredicto.clase === 'sin-origen-seguro') return veredicto.anunciada;
  return null;
}

/* ── Que viene y que no, por ambito ────────────────────────────────────────────────────────── */

/** Las cuatro listas del cuerpo, con el ambito que las lleva (`ComponerSnapshot:71-73`). */
const LISTAS_DEL_SNAPSHOT: readonly {
  readonly campo: 'parametros' | 'valoresUnitarios' | 'depreciaciones' | 'valoresReferenciales';
  readonly deQuienEs: Ambito;
}[] = [
  { campo: 'parametros', deQuienEs: 'VALUACION' },
  { campo: 'valoresUnitarios', deQuienEs: 'VALUACION' },
  { campo: 'depreciaciones', deQuienEs: 'VALUACION' },
  { campo: 'valoresReferenciales', deQuienEs: 'OBLIGACION' },
];

/**
 * Las filas de «Que viene y que no»: cada lista, cuantas trae y **por que**.
 *
 * `loLleva` sale del **ambito**, no de lo que llego: ensenar un vacio por reparto y un vacio por
 * averia con el mismo texto haria que el segundo pasara por normal. Los parametros son la
 * excepcion —van en los DOS—, y por eso su motivo no se compone igual.
 */
function queVieneYQueNo(descarga: Descarga): DatosDeUnaTabla {
  const ambito = descarga.ambito;
  return {
    // La barra de esta tabla lleva EL VEREDICTO de la comprobacion, y no un conteo de filas. Es el
    // sitio que la gramatica V8 deja: un aviso con su tono seria una pieza mas en `bloques` y el
    // artboard no la declara (H29a). Va aqui y no en un campo porque los seis de este bloque son lo
    // que llego —dos cabeceras y cuatro del cuerpo— y ninguno es una conclusion.
    conteo: `${tituloDelVeredicto(descarga.veredicto)} ${loDeLaCache(descarga.cacheControl)}`,
    filas: LISTAS_DEL_SNAPSHOT.map(({ campo, deQuienEs }) => {
      const cuantas = descarga.snapshot[campo].length;
      const enLosDos = campo === 'parametros';
      const loLleva = enLosDos || deQuienEs === ambito;
      return {
        clave: campo,
        celdas: [
          campo,
          String(cuantas),
          motivoDeLaLista(enLosDos, loLleva, cuantas, ambito),
        ] as readonly CeldaDeLaTabla[],
      };
    }),
  };
}

/** El motivo de una lista, con los cuatro desenlaces separados. */
function motivoDeLaLista(
  enLosDos: boolean,
  loLleva: boolean,
  cuantas: number,
  ambito: Ambito,
): string {
  if (enLosDos) {
    return cuantas > 0
      ? t(FRASES_DE_LA_PUBLICACION.vanEnLosDos)
      : t(FRASES_DE_LA_PUBLICACION.vacioEnLosDos);
  }
  if (loLleva) {
    return cuantas > 0
      ? t(FRASES_DE_LA_PUBLICACION.loLlevaYVino)
      : t(FRASES_DE_LA_PUBLICACION.loLlevaYVacio);
  }
  return cuantas > 0
    ? t(FRASES_DE_LA_PUBLICACION.noLoLlevaYVino, { ambito })
    : t(FRASES_DE_LA_PUBLICACION.noLoLleva, { ambito });
}

/* ── Las coordenadas de la definicion ──────────────────────────────────────────────────────── */

/** Bloque 0 — «Que conjunto se descarga». El tercer campo es el selector, que no se rellena. */
const CONJUNTO = coordenada(0, 0);
const EJERCICIO_Y_VERSION = coordenada(0, 1);

/** Bloque 1 — «La respuesta»: dos de CABECERA y cuatro de CUERPO. */
const ETAG = coordenada(1, 0);
const CACHE_CONTROL = coordenada(1, 1);
const CUERPO_CONJUNTO = coordenada(1, 2);
const CUERPO_EJERCICIO_Y_VERSION = coordenada(1, 3);
const CUERPO_AMBITO = coordenada(1, 4);
const CUERPO_FILAS = coordenada(1, 5);

/** Bloque 2 — «Un conjunto, dos descargas». */
const IDENTIDAD = coordenada(2, 0);
const ETAG_EN_VALUACION = coordenada(2, 1);
const ETAG_EN_OBLIGACION = coordenada(2, 2);
const LAS_DOS_HUELLAS = coordenada(2, 3);

/** Bloque 3 — «Por que se puede guardar para siempre»: las tres razones de ADR-0025 §1. */
const RAZONES: readonly (readonly [Coordenada, string])[] = [
  [coordenada(3, 0), FRASES_DE_LA_PUBLICACION.loSelladoNoCambia],
  [coordenada(3, 1), FRASES_DE_LA_PUBLICACION.cachePorContenido],
  [coordenada(3, 2), FRASES_DE_LA_PUBLICACION.ordenTotal],
];

/**
 * La frase de arriba de la hoja.
 *
 * `enElCampo` es «sin pedir» y no «no publicado»: los huecos de esta hoja son de algo que SI se
 * pide y todavia no ha llegado —o que llego sin lo que hacia falta para afirmar nada—, no de un
 * campo que ninguna operacion publique.
 */
const AUSENCIA_DE_LA_HOJA = {
  enElCampo: FRASES_DE_LA_PUBLICACION.sinPedir,
  explicacion: FRASES_DE_LA_PUBLICACION.laHojaPide,
  tono: 'info',
} as const;

/** La huella de un ambito en su campo, o el hueco con el motivo corto. */
function ponerLaHuella(
  valores: Map<Coordenada, string>,
  ausencias: Map<Coordenada, string>,
  donde: Coordenada,
  descarga: Descarga | undefined,
): void {
  const huella = huellaQueSeEnsena(descarga);
  if (huella === null) ausencias.set(donde, FRASES_DE_LA_PUBLICACION.sinPedir);
  else valores.set(donde, huella);
}

/**
 * Lo que se MIDIO al pedir el mismo conjunto en los dos ambitos, y no lo que el ADR afirma.
 *
 * ADR-0025 §Consecuencias dice que la identidad es la misma y que los `ETag` son distintos porque
 * son bytes distintos. Las dos mitades hacen falta: sin la primera, quien pide los dos snapshots no
 * puede afirmar que calculo con el mismo juego de valores; sin la segunda, dos descargas distintas
 * compartirian huella y una cache indexada por contenido serviria una por la otra.
 *
 * Y se **mide**: si las dos huellas salen iguales, esto lo dice en vez de repetir la frase del ADR.
 */
export function veredictoDeLosDosAmbitos(
  valuacion: Descarga | undefined,
  obligacion: Descarga | undefined,
): string {
  const unaHuella = huellaQueSeEnsena(valuacion);
  const otraHuella = huellaQueSeEnsena(obligacion);
  if (
    valuacion === undefined ||
    obligacion === undefined ||
    unaHuella === null ||
    otraHuella === null
  ) {
    return t(FRASES_DE_LA_PUBLICACION.sinLasDos);
  }
  if (!laMismaIdentidad(valuacion.snapshot, obligacion.snapshot)) {
    return t(FRASES_DE_LA_PUBLICACION.identidadDistinta);
  }
  return unaHuella === otraHuella
    ? t(FRASES_DE_LA_PUBLICACION.mismaHuella)
    : t(FRASES_DE_LA_PUBLICACION.huellasDistintas);
}

/** Los tres campos que NO cambian con el ambito. */
function laMismaIdentidad(uno: SnapshotResource, otro: SnapshotResource): boolean {
  return (
    uno.conjuntoId === otro.conjuntoId &&
    uno.ejercicio === otro.ejercicio &&
    uno.version === otro.version
  );
}

/* ── El conector ───────────────────────────────────────────────────────────────────────────── */

export const PUBLICACION: Conector = {
  lecturas: [
    {
      clave: CLAVE_DE_LA_PUBLICACION,
      // El ejercicio va en la clave de consulta: es lo que decide QUE conjunto se pide, y sin el
      // dos ejercicios compartirian la misma entrada de cache.
      consulta: [
        'nor-publicacion',
        CLAVE_DE_LA_PUBLICACION,
        CONJUNTO_VIGENTE.parametros['ejercicio'] ?? '',
      ],
      pedir: (senal) => pedirLaPublicacion(senal),
    },
  ],

  repartir: (llegado): Reparto => {
    const lo = llegado.get(CLAVE_DE_LA_PUBLICACION) as LoDeLaPublicacion | undefined;

    const valores = new Map<Coordenada, string>();
    const ausenciaPorCampo = new Map<Coordenada, string>();
    const tablas = new Map<string, DatosDeUnaTabla>();
    const nombrados = new Map<string, DatoConNombre>();

    // Las tres razones de la cache son PROSA de ADR-0025 §1 y no un dato del backend: ninguna
    // operacion las publica y ninguna se deduce de lo que llego. Se escriben, traducidas, y por eso
    // se siguen viendo con la lectura caida — que es cuando explican por que el archivo que ya se
    // guardo sigue valiendo.
    for (const [donde, frase] of RAZONES) valores.set(donde, t(frase));

    // La tabla de consumidores tampoco depende de la lectura: sale del contrato que cada uno
    // publica, y su procedencia son los dos `ContratoCon*Test` del backend.
    tablas.set(CLAVE_DE_LOS_CONSUMIDORES, {
      filas: CONSUMIDORES.map((consumidor) => ({
        clave: `${consumidor.sistema}-${consumidor.ambito}`,
        celdas: [
          consumidor.sistema,
          consumidor.ambito,
          t(consumidor.cuando),
          t(consumidor.queHace),
        ] as readonly CeldaDeLaTabla[],
      })),
    });

    if (lo === undefined) {
      nombrados.set(DATO_DEL_IMPEDIMENTO, t(FRASES_DE_LA_PUBLICACION.todaviaNoLlego));
      return { valores, tablas, ausenciaPorCampo, nombrados, ausencia: AUSENCIA_DE_LA_HOJA };
    }

    valores.set(CONJUNTO, String(lo.vigente.conjuntoId));
    valores.set(
      EJERCICIO_Y_VERSION,
      `${String(lo.vigente.ejercicio)} · ${String(lo.vigente.version)}`,
    );
    valores.set(
      IDENTIDAD,
      t(FRASES_DE_LA_PUBLICACION.identidad, {
        conjunto: lo.vigente.conjuntoId,
        ejercicio: lo.vigente.ejercicio,
        version: lo.vigente.version,
      }),
    );

    const laFicha = lo.porAmbito.get(AMBITO_DE_LA_FICHA);
    if (laFicha !== undefined) {
      // CABECERA: lo que el servidor anuncio, tal cual llego. Un `ETag` que no sirve se ensena
      // igual —es el dato con el que se empieza a mirar—, y lo que no vino dice que no vino.
      if (laFicha.etag === null) ausenciaPorCampo.set(ETAG, FRASES_DE_LA_PUBLICACION.sinEtag);
      else valores.set(ETAG, laFicha.etag);
      if (laFicha.cacheControl === null) {
        ausenciaPorCampo.set(CACHE_CONTROL, FRASES_DE_LA_PUBLICACION.sinCacheControl);
      } else valores.set(CACHE_CONTROL, laFicha.cacheControl);

      // CUERPO: lo que venia dentro del JSON.
      valores.set(CUERPO_CONJUNTO, String(laFicha.snapshot.conjuntoId));
      valores.set(
        CUERPO_EJERCICIO_Y_VERSION,
        `${String(laFicha.snapshot.ejercicio)} · ${String(laFicha.snapshot.version)}`,
      );
      valores.set(CUERPO_AMBITO, laFicha.snapshot.ambito);
      valores.set(CUERPO_FILAS, String(laFicha.snapshot.filas));

      tablas.set(CLAVE_DE_LAS_LISTAS, queVieneYQueNo(laFicha));
      nombrados.set(DATO_DEL_TONO, tonoDeLaComprobacion(laFicha));
    }

    const deValuacion = lo.porAmbito.get('VALUACION');
    const deObligacion = lo.porAmbito.get('OBLIGACION');
    ponerLaHuella(valores, ausenciaPorCampo, ETAG_EN_VALUACION, deValuacion);
    ponerLaHuella(valores, ausenciaPorCampo, ETAG_EN_OBLIGACION, deObligacion);
    valores.set(LAS_DOS_HUELLAS, veredictoDeLosDosAmbitos(deValuacion, deObligacion));

    nombrados.set(DATO_DEL_IMPEDIMENTO, porQueNoSePuedeGuardar(laFicha));

    return { valores, tablas, ausenciaPorCampo, nombrados, ausencia: AUSENCIA_DE_LA_HOJA };
  },
};
