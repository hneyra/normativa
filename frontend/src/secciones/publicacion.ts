import type { ErrorDeLaApi } from '../api/cliente.ts';
import type { SnapshotVerificado } from '../api/cliente.ts';
import type { Ambito, SnapshotResource } from '../datos/lecturas.ts';
import type { Tono } from '../dominio/valores.ts';

/**
 * La logica de la seccion de Publicacion, aparte del dibujo.
 *
 * Es el sitio donde se decide **que se afirma** sobre una descarga: como se nombra el archivo,
 * que dice la comprobacion de la huella, que significa que las dos huellas de un mismo conjunto
 * coincidan, y quien se lleva esto. Todo eso se puede probar sin montar un componente, y se
 * prueba asi.
 */

// ── AC9: el nombre del archivo ──────────────────────────────────────────────────────────────

/**
 * Como se llama el archivo que se guarda.
 *
 * Lleva **el conjunto, el ejercicio, la version y el ambito**, y no es cosmetico: un
 * `snapshot.json` en la carpeta de descargas de un municipio es indistinguible del de otro
 * ejercicio, del de otra version del mismo ejercicio —que las hay: `conjunto_uq` lleva la
 * version— y del de la otra mitad de ADR-0024. Los cuatro datos son exactamente la identidad
 * con la que un consumidor decide si lo que tiene sirve.
 */
export function nombreDelArchivo(snapshot: SnapshotResource): string {
  return [
    'normativa-conjunto',
    String(snapshot.conjuntoId),
    String(snapshot.ejercicio),
    `v${String(snapshot.version)}`,
    snapshot.ambito,
  ].join('-')
    .concat('.json');
}

/**
 * Guarda **los bytes que se verificaron**, no una segunda serializacion del objeto (AC9).
 *
 * Y no se hace con un `<a download>` apuntando a la URL de la API: eso descargaria una respuesta
 * **que nadie ha comprobado** —el navegador vuelve a pedirla, o la saca de su cache— y el
 * archivo resultante podria no ser el que la pantalla acaba de verificar. Aqui se guarda la
 * cadena cuyo `sha256` es la huella que se comparo contra el `ETag`, y punto.
 *
 * El `<a>` se crea, se pulsa y se tira: es la unica forma que da el navegador de guardar un
 * `Blob` con un nombre elegido. El objeto de URL se revoca siempre, tambien si el clic falla,
 * porque cada uno que se quede vivo retiene el `Blob` entero en memoria —y estos pesan.
 *
 * @returns `true` si se pudo guardar; `false` si el navegador no ofrece `createObjectURL`, que
 *   es lo que pasa en un contexto sin DOM completo. No revienta: quien lo llame ensena que no se
 *   pudo, en vez de dejar la pantalla rota.
 */
export function guardarComoArchivo(nombre: string, cuerpo: string): boolean {
  if (typeof URL.createObjectURL !== 'function') return false;

  const direccion = URL.createObjectURL(new Blob([cuerpo], { type: 'application/json' }));
  try {
    const enlace = document.createElement('a');
    enlace.href = direccion;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    return true;
  } finally {
    URL.revokeObjectURL(direccion);
  }
}

// ── AC5: la respuesta, y la comprobacion de su huella ───────────────────────────────────────

/** Una linea de la ficha «La respuesta»: lo que la cabecera o el cuerpo dijeron. */
export interface LineaDeLaRespuesta {
  readonly etiqueta: string;
  readonly valor: string;
  /** De donde sale: `cabecera` si vino en una cabecera HTTP, `cuerpo` si vino dentro del JSON. */
  readonly origen: 'cabecera' | 'cuerpo';
}

/**
 * El `Cache-Control` que el backend promete para esta respuesta.
 *
 * Se declara para poder **comparar** lo que llego con lo que el contrato dice, no para
 * ensenarlo en su lugar: un intermediario que reescriba la cabecera cambia cuanto tiempo se
 * puede guardar el snapshot sin que el cuerpo cambie ni un byte, y eso solo se ve comparando.
 */
export const CACHE_CONTROL_DEL_CONTRATO = 'public, max-age=31536000, immutable';

/**
 * Las lineas de la ficha de la respuesta, con el origen de cada una.
 *
 * El `ETag` y el `Cache-Control` salen de las **cabeceras**; `conjuntoId`, `ejercicio`,
 * `version`, `ambito` y `filas`, del **cuerpo**. La distincion no es de pedantes: la huella que
 * viaja fuera del cuerpo es lo que permite comprobarlo sin pedirle a un valor que se contenga a
 * si mismo, y quien lea la ficha tiene que poder decir cual de las dos cosas esta mirando.
 */
export function lineasDeLaRespuesta(
  verificado: SnapshotVerificado<SnapshotResource>,
): readonly LineaDeLaRespuesta[] {
  const snapshot = verificado.recurso;
  return [
    { etiqueta: 'ETag', valor: `"${verificado.huella}"`, origen: 'cabecera' },
    {
      etiqueta: 'Cache-Control',
      valor: verificado.cacheControl ?? 'sin Cache-Control',
      origen: 'cabecera',
    },
    { etiqueta: 'conjuntoId', valor: String(snapshot.conjuntoId), origen: 'cuerpo' },
    {
      etiqueta: 'ejercicio · version',
      valor: `${String(snapshot.ejercicio)} · ${String(snapshot.version)}`,
      origen: 'cuerpo',
    },
    { etiqueta: 'ambito', valor: snapshot.ambito, origen: 'cuerpo' },
    { etiqueta: 'filas', valor: String(snapshot.filas), origen: 'cuerpo' },
  ];
}

/** Lo que se afirma tras recalcular el `sha256` del cuerpo y compararlo con el `ETag`. */
export interface Comprobacion {
  readonly tono: Tono;
  readonly titulo: string;
  readonly detalle: string;
}

/**
 * El resultado de la comprobacion de la huella, ya redactado.
 *
 * **Se llega aqui solo cuando cuadro**: `solicitarSnapshot` no devuelve un snapshot cuya huella
 * no coincida — lanza `HUELLA_QUE_NO_CUADRA` con las dos huellas dentro del mensaje, y la
 * pantalla ensena ese error en vez de esta ficha. Que el desenlace malo sea imposible de dibujar
 * **como si fuera bueno** es la mitad del valor de haber puesto la comprobacion en el cliente.
 *
 * Lo que si puede fallar aqui es la promesa de cache: la respuesta trajo un `Cache-Control`
 * distinto del que el contrato declara, o no trajo ninguno. Eso no invalida los bytes —el
 * `sha256` cuadra— pero si invalida «guardalo un ano y no vuelvas a pedirlo», que es de lo que
 * vive ADR-0025 §1.
 */
export function comprobacionDe(verificado: SnapshotVerificado<SnapshotResource>): Comprobacion {
  if (verificado.cacheControl !== CACHE_CONTROL_DEL_CONTRATO) {
    return {
      tono: 'atencion',
      titulo: 'El sha256 cuadra con el ETag; el Cache-Control no es el del contrato',
      detalle:
        `Los bytes son los que el ETag anuncia —${verificado.huella}—, así que el contenido no ` +
        'está en duda. Lo que está en duda es cuánto se puede guardar: el contrato declara ' +
        `«${CACHE_CONTROL_DEL_CONTRATO}» y esta respuesta trajo ` +
        `«${verificado.cacheControl ?? 'ninguno'}». Algo en el camino la reescribió, y quien ` +
        'guarde esta copia un año lo hará sin que nadie se lo haya autorizado.',
    };
  }
  return {
    tono: 'ok',
    titulo: 'sha256 recalculado sobre los bytes recibidos: coincide con el ETag',
    detalle:
      'La huella es de los bytes que se sirven, no de una serialización canónica aparte: una ' +
      'canónica exigiría dos implementaciones que tienen que coincidir —una en el servidor y ' +
      'otra en cada consumidor—, y dos algoritmos que deben dar lo mismo son dos que un día ' +
      'dejan de darlo. Aquí el cliente hace sha256(cuerpo) y compara; no hay nada que mantener ' +
      'sincronizado. Y se comprueba en vez de creérsela porque la respuesta se guarda un año ' +
      'con «immutable»: una copia corrupta no se volvería a pedir nunca.',
  };
}

// ── AC3 en la publicacion: que viene y que no, por ambito ───────────────────────────────────

/** Una de las cuatro listas del snapshot, con cuantas filas trae y por que. */
export interface ListaDelSnapshot {
  readonly campo: string;
  readonly cuantas: number;
  readonly tono: Tono;
  readonly porQue: string;
}

/**
 * Las cuatro listas del cuerpo, con el motivo de que vengan llenas o vacias.
 *
 * Los parametros van en **los dos** ambitos —son 33 filas, y una valuacion que necesitara el
 * «% actualizacion» tendria que pedir otro snapshot para una cifra—; los tres cuadros se
 * reparten (`ComponerSnapshot:71-73`). Una lista vacia **por ambito** se explica; una vacia
 * dentro de su ambito se senala.
 */
export function listasDelSnapshot(snapshot: SnapshotResource): readonly ListaDelSnapshot[] {
  const ambito = snapshot.ambito;
  const laValuacion = ambito === 'VALUACION';

  return [
    {
      campo: 'parametros',
      cuantas: snapshot.parametros.length,
      tono: snapshot.parametros.length > 0 ? 'ok' : 'mal',
      porQue:
        snapshot.parametros.length > 0
          ? 'Van en los DOS ámbitos: una valuación que necesitara el «% actualización» tendría ' +
            'que pedir otro snapshot para una sola cifra.'
          : 'Van en los dos ámbitos, así que vacío no lo explica el ámbito: este conjunto se ' +
            'selló sin un solo parámetro, o algo no compuso.',
    },
    {
      campo: 'valoresUnitarios',
      cuantas: snapshot.valoresUnitarios.length,
      tono: laValuacion && snapshot.valoresUnitarios.length === 0 ? 'atencion' : 'ok',
      porQue: motivoDeCuadro(
        laValuacion,
        snapshot.valoresUnitarios.length,
        'El anexo de valores unitarios de edificación del MVCS.',
        'El ámbito OBLIGACION no los lleva: quien dice cuánto se debe no valúa el predio.',
      ),
    },
    {
      campo: 'depreciaciones',
      cuantas: snapshot.depreciaciones.length,
      tono: laValuacion && snapshot.depreciaciones.length === 0 ? 'atencion' : 'ok',
      porQue: motivoDeCuadro(
        laValuacion,
        snapshot.depreciaciones.length,
        'El anexo de depreciación del Reglamento Nacional de Tasaciones.',
        'El ámbito OBLIGACION no las lleva, por lo mismo.',
      ),
    },
    {
      campo: 'valoresReferenciales',
      cuantas: snapshot.valoresReferenciales.length,
      tono: !laValuacion && snapshot.valoresReferenciales.length === 0 ? 'atencion' : 'ok',
      porQue: motivoDeCuadro(
        !laValuacion,
        snapshot.valoresReferenciales.length,
        'El anexo vehicular del MEF.',
        'El ámbito VALUACION no los lleva: el vehicular es obligación, no valuación (ADR-0024).',
      ),
    },
  ];
}

/**
 * El motivo de una lista de cuadro, con los cuatro desenlaces separados.
 *
 * `loLleva` sale del **ámbito**, no de lo que llegó. Es la misma distinción que
 * `cuadros.ts#estadoDelCuadro` hace para la pantalla de Cuadros, y por el mismo motivo: enseñar
 * un vacío por reparto y un vacío por avería con el mismo texto haría que el segundo pasara por
 * normal.
 */
function motivoDeCuadro(
  loLleva: boolean,
  cuantas: number,
  cuandoViene: string,
  cuandoNoLoLleva: string,
): string {
  if (loLleva && cuantas > 0) return cuandoViene;
  if (loLleva) {
    return (
      'Este ámbito SÍ lo lleva y llegó vacío: o el conjunto se selló sin esa edición —la ' +
      'versión 1 de 2026 se selló sin la vehicular— o algo no compuso. No es el reparto.'
    );
  }
  if (cuantas > 0) {
    return (
      cuandoNoLoLleva +
      ' Y aun así llegó lleno: contra el backend no puede pasar, así que esta respuesta no la ' +
      'compuso ComponerSnapshot.'
    );
  }
  return cuandoNoLoLleva;
}

// ── AC6: la identidad no cambia con el ambito; la huella si ─────────────────────────────────

/** Lo que se ve al pedir el MISMO conjunto en los dos ambitos. */
export interface ComparacionDeAmbitos {
  /** `conjunto 2 · ejercicio 2026 · versión 2`, si las dos coinciden. */
  readonly identidad: string;
  readonly identidadCoincide: boolean;
  readonly huellaDeValuacion: string;
  readonly huellaDeObligacion: string;
  readonly huellaCambia: boolean;
  readonly tono: Tono;
  readonly veredicto: string;
}

/** Como se escribe la identidad de un snapshot: los tres campos que no cambian con el ambito. */
export function identidadDe(snapshot: SnapshotResource): string {
  return (
    `conjunto ${String(snapshot.conjuntoId)} · ejercicio ${String(snapshot.ejercicio)}` +
    ` · versión ${String(snapshot.version)}`
  );
}

/**
 * Compara las dos descargas del mismo conjunto, y **dice lo que midio**.
 *
 * Lo que ADR-0025 §Consecuencias afirma es exactamente esto: la identidad —`conjuntoId`,
 * `ejercicio` y `version`— es la misma en los dos ambitos, y los `ETag` son distintos porque son
 * bytes distintos. Las dos mitades hacen falta: sin la primera, quien pide los dos snapshots no
 * puede afirmar que calculo con el mismo juego de valores; sin la segunda, dos descargas
 * distintas compartirian huella y una cache indexada por contenido serviria una por la otra.
 *
 * Y se **mide**, no se declara: si las dos huellas salen iguales, esto lo dice en vez de
 * repetir la frase del ADR. Pasa contra el proxy de datos, que no mira la consulta y sirve el
 * mismo cuerpo para los dos ambitos.
 */
export function compararAmbitos(
  valuacion: SnapshotVerificado<SnapshotResource>,
  obligacion: SnapshotVerificado<SnapshotResource>,
): ComparacionDeAmbitos {
  const identidadCoincide = identidadDe(valuacion.recurso) === identidadDe(obligacion.recurso);
  const huellaCambia = valuacion.huella !== obligacion.huella;

  return {
    identidad: identidadDe(valuacion.recurso),
    identidadCoincide,
    huellaDeValuacion: valuacion.huella,
    huellaDeObligacion: obligacion.huella,
    huellaCambia,
    tono: identidadCoincide && huellaCambia ? 'ok' : 'atencion',
    veredicto: veredictoDe(identidadCoincide, huellaCambia),
  };
}

function veredictoDe(identidadCoincide: boolean, huellaCambia: boolean): string {
  if (!identidadCoincide) {
    return (
      'Las dos descargas dicen ser de conjuntos distintos. No son dos mitades del mismo juego ' +
      'de valores, así que una determinación hecha con una y una valuación hecha con la otra no ' +
      'se pueden comparar: son dos ejercicios de cosas distintas.'
    );
  }
  if (!huellaCambia) {
    return (
      'Misma identidad y MISMA huella: las dos descargas son byte a byte el mismo archivo. ' +
      'Contra el backend no puede ser —los cuadros que lleva cada ámbito son distintos—, así ' +
      'que esta respuesta no la compuso ComponerSnapshot: el proxy de datos no mira la consulta ' +
      'y sirve el mismo cuerpo para los dos ámbitos (simulados.ts, «ambitoDelSnapshot»).'
    );
  }
  return (
    'Misma identidad y huellas distintas, que es lo que hace entendible que un mismo conjunto ' +
    'tenga dos descargas: quien necesita las dos mitades —hoy rentas, que todavía lleva ' +
    'catastro dentro— pide DOS snapshots del MISMO conjunto, y la identidad es lo que las dos ' +
    'corridas comparan.'
  );
}

// ── AC4: el 404 que no es una averia ────────────────────────────────────────────────────────

/**
 * Si ese fallo es «ese ejercicio no está publicado» y no «esa ruta no existe».
 *
 * Los dos son **404** y por el numero no se distinguen. Lo que los distingue es el miembro
 * `parametroQueFalta` del cuerpo: `FaltaPublicar.noEncontrado` lo pone —lleva el ejercicio, y la
 * llave cuando el backend sabe cual es— y un 404 de ruta inexistente no lo lleva. Es lo mismo
 * que ya hacia el 422 de la misma familia, y es lo unico que un programa puede leer.
 *
 * La diferencia no es documental: uno lo arregla quien atiende —componiendo y sellando el
 * conjunto de ese ejercicio— y el otro no lo arregla nadie desde esta pantalla.
 */
export function esEjercicioSinPublicar(fallo: ErrorDeLaApi): boolean {
  return fallo.estado === 404 && fallo.faltaUnaCifraNormativa;
}

// ── AC7: quien se lleva esto ────────────────────────────────────────────────────────────────

/** Un consumidor declarado, con el ambito que pide y lo que hace con el. */
export interface Consumidor {
  readonly sistema: string;
  readonly ambito: Ambito;
  readonly cuando: string;
  readonly queHace: string;
}

/**
 * Quien consume esto, segun el contrato que cada uno publica.
 *
 * Sale de `rentas/docs/50-api/contratos-que-consume/normativa.json` y del mismo archivo de
 * `catastro`: los dos declaran **dos** operaciones y ninguna mas. La tabla existe porque es lo
 * que convierte «publicamos un JSON» en «esto es lo que se rompe si cambia»: un campo que este
 * sistema deje de publicar pone rojo el build de ESTE repositorio, no el del consumidor
 * (ADR-0030 §4).
 *
 * `rentas` aparece dos veces a proposito: hoy pide los DOS ambitos del MISMO conjunto porque
 * todavia lleva catastro dentro, y es el caso que hace util que la identidad no dependa del
 * ambito (AC6).
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

/**
 * Las que este sistema publica y **nadie consume**.
 *
 * Se nombran porque una operacion publicada y sin consumidor no es lo mismo que una que se puede
 * romper sin consecuencias: lo que dice el contrato es que hoy no la pide nadie de los dos que
 * han declarado, no que no la pida nadie.
 */
export const OPERACIONES_SIN_CONSUMIDOR: readonly string[] = [
  'GET /seguridad/parametros',
  'GET /seguridad/parametros/ejercicios/{ejercicio}',
];

// ── Por que se puede guardar para siempre ───────────────────────────────────────────────────

/** Una razon por la que la descarga se puede cachear un ano. */
export interface RazonDeLaCache {
  readonly titulo: string;
  readonly detalle: string;
}

export const RAZONES_DE_LA_CACHE: readonly RazonDeLaCache[] = [
  {
    titulo: 'Lo sellado no cambia',
    detalle:
      'Un disparador de la base vuelve inmutable el conjunto y su contenido en cuanto se sella. ' +
      'No hay invalidación que diseñar, ni ventana de inconsistencia, ni TTL que ajustar.',
  },
  {
    titulo: 'La caché se indexa por contenido',
    detalle:
      'Por el conjuntoId y su huella, no por tiempo. Y por eso el recálculo no pasa por la red: ' +
      'parte del conjuntoId que la determinación guardó, y ese conjunto ya está en la caché.',
  },
  {
    titulo: 'El orden de las filas es total',
    detalle:
      'Las tres consultas de los cuadros llevan ORDER BY completo: si el orden dependiera del ' +
      'plan, el ETag cambiaría sin que cambiara el conjunto, y todo snapshot cacheado se leería ' +
      'como corrupto.',
  },
];
