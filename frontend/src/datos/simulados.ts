/**
 * Lo que el proxy se INVENTA, apartado de lo que captura.
 *
 * <h2>La regla de este archivo</h2>
 *
 * El artboard no trae todos los campos que el backend publica, y **cada invencion nombra la
 * operacion que la sustituira**. Si no se puede nombrar, no pertenece aqui: un valor inventado
 * sin operacion que lo reemplace no es un hueco temporal, es una decision de producto tomada en
 * el frontend. `simulados.test.ts` comprueba que la operacion de cada entrada es una de las que
 * `operaciones.ts` declara, asi que la regla no depende de que nadie la recuerde.
 *
 * <h2>Por que no viven dentro de `prototipo.ts`</h2>
 *
 * Porque dentro serian indistinguibles de una captura. Una cifra en `prototipo.ts` se puede
 * buscar en `NormativaV6.dc.html` y encontrarla igual; una de aqui, no — y el dia que el backend
 * conecte, lo que hay que revisar es exactamente esta lista.
 *
 * <h2>Y aqui vive ademas algo que `rentas` no tiene: las TRES ESCRITURAS (AC8)</h2>
 *
 * `POST /ediciones`, `POST /ediciones/{id}/parametros` y `POST /ediciones/{id}/sellar` **no
 * existen en el backend**, y esta medido: cero `@PostMapping`, `@PutMapping`, `@PatchMapping` y
 * `@DeleteMapping` en todo `src/main`. Lo que si existe es el caso de uso —`AdministrarParametros`
 * tiene `abrirVersion`, `agregarParametroPublicado` y `sellar`, las tres `@Transactional`— y
 * ADR-0025 §5 las anticipa. O sea: la ruta esta inventada, el comportamiento no.
 *
 * Por eso viven **solo aqui**, y no mezcladas con las cuatro lecturas reales de
 * `operaciones.ts`: quien lea la tabla tiene que poder decir de un vistazo cuales son contrato y
 * cuales son un dibujo. Y por eso **reproducen las negativas reales**, con el texto exacto de
 * `AdministrarParametros` y de `Observacion`: una escritura simulada que siempre dijera que si
 * ensenaria a la pantalla un flujo que el backend no tiene, y el desajuste no aparece hasta que
 * alguien intenta sellar dos veces el mismo conjunto en produccion.
 */

import { EDICIONES, EJERCICIO_DE_CAPTURA } from './prototipo.ts';

/** Una invencion del proxy, con la operacion que se la llevara por delante. */
export interface Simulado {
  /** Identificador estable. Es como lo pide `simulado()`, y como lo busca su prueba. */
  readonly clave: string;
  /** El valor que el proxy sirve mientras no hay backend. */
  readonly valor: string | number | boolean | null | readonly unknown[];
  /** La operacion del backend que publicara este dato de verdad, como `«VERBO /ruta»`. */
  readonly operacion: string;
  /** Por que el prototipo no lo trae. Una linea, para quien venga a borrar la entrada. */
  readonly porQue: string;
}

export const SIMULADOS: readonly Simulado[] = [
  // ── Lo que el constructor del cuerpo no puede saber, porque no ve la peticion (AC5) ──────
  //
  // Los constructores de `operaciones.ts` no reciben ni la consulta ni el cuerpo: no PUEDEN
  // mirarlos, que es mas fuerte que no mirarlos. Eso deja dos datos que en el backend salen de
  // la peticion y aqui hay que fijar, y los dos se declaran en vez de escribirse sueltos.
  {
    clave: 'conjuntoDelSnapshot',
    valor: 2,
    operacion: 'GET /conjuntos/{id}/snapshot',
    porQue:
      'El `{id}` va en la ruta y el constructor no la recibe. El snapshot que sirve el proxy es siempre el del conjunto vigente de la captura; el backend sirve el que se le pida.',
  },
  {
    clave: 'ambitoDelSnapshot',
    valor: 'VALUACION',
    operacion: 'GET /conjuntos/{id}/snapshot',
    porQue:
      'El `?ambito=` es obligatorio en el backend y el proxy no mira la consulta (AC5). Sirve un ambito fijo y las cuatro listas llenas; el backend reparte los cuadros por ambito y deja las otras vacias.',
  },

  // ── Lo que el artboard dibuja de otra forma ──────────────────────────────────────────────
  {
    clave: 'zonaDelSellado',
    valor: ':00Z',
    operacion: 'GET /seguridad/parametros',
    porQue:
      'El artboard escribe la fecha de sellado como la dibuja —«2026-09-06 15:22», sin segundos y sin zona— y el backend publica un `Instant`. Esto es lo que le falta para serlo.',
  },

  // ── Las tres escrituras que ADR-0025 §5 anticipa y `src/main` no tiene ───────────────────
  {
    clave: 'conjuntoAbierto',
    valor: 4,
    operacion: 'POST /ediciones',
    porQue:
      'El identificador que la base le asignaria a la version nueva. El artboard dibuja tres ediciones y no una cuarta; la siguiente libre es esta.',
  },
  {
    clave: 'versionAbierta',
    valor: 2,
    operacion: 'POST /ediciones',
    porQue:
      'La version NO se recibe: la calcula el servidor como «la ultima del ejercicio mas uno». Sin base a la que preguntar, se fija.',
  },
  {
    clave: 'ejercicioAbierto',
    valor: 2027,
    operacion: 'POST /ediciones',
    porQue:
      'El ejercicio va en el cuerpo y el constructor no lo recibe (AC5). Se responde con el unico que la captura tiene abierto.',
  },
  {
    clave: 'parametroAgregado',
    valor: ['UIT', null, '5500.00'],
    operacion: 'POST /ediciones/{id}/parametros',
    porQue:
      'La respuesta publica el parametro que se incorporo, resuelto por su llave. Cual sea depende del cuerpo, que el constructor no recibe: se responde con la fila que el artboard pone primera.',
  },
  {
    clave: 'usuarioQueSella',
    valor: 'hneyra',
    operacion: 'POST /ediciones/{id}/sellar',
    porQue:
      'El backend lo toma de `OrigenContext.actual().usuario()`, o sea del token. Esta interfaz no consigue token (ver `servidas.ts`), asi que se responde con el que el artboard nombra.',
  },
  {
    clave: 'instanteDelSello',
    valor: '2026-09-06T15:22:00Z',
    operacion: 'POST /ediciones/{id}/sellar',
    porQue:
      'El backend lo toma de su reloj. Un `new Date()` aqui haria que dos corridas de la misma prueba dieran cuerpos distintos, y entonces la huella del snapshot dejaria de poder compararse.',
  },
];

/** Indice por clave, para que `simulado()` no recorra la lista en cada llamada. */
const POR_CLAVE = new Map(SIMULADOS.map((s) => [s.clave, s]));

/**
 * El valor inventado de esa clave.
 *
 * Revienta si la clave no esta declarada: un valor inventado que no pasa por esta lista es
 * exactamente lo que el archivo existe para impedir, y fallar aqui es mas barato que
 * descubrirlo cuando el backend conecte y nadie sepa de donde salio la cifra.
 */
export function simulado<T>(clave: string): T {
  const entrada = POR_CLAVE.get(clave);
  if (entrada === undefined) {
    throw new Error(
      `El proxy pidio el simulado «${clave}», que no esta declarado en simulados.ts.\n` +
        'Todo lo que el proxy se inventa se declara ahi, con la operacion que lo sustituira.\n' +
        'Si no puedes nombrar esa operacion, el valor no pertenece al proxy.',
    );
  }
  return entrada.valor as T;
}

// ── Las tres escrituras simuladas, con sus negativas reales ─────────────────────────────────

/**
 * Lo unico de la peticion que una escritura simulada llega a ver.
 *
 * **No es la peticion**: son los dos datos que las negativas de `AdministrarParametros` miran, y
 * nada mas. Sin la consulta y sin el resto del cuerpo no hay forma de fingir un filtro, que es
 * lo que AC5 prohibe; y sin ellos tampoco habria forma de reproducir las negativas, que es lo
 * que AC8 exige. Esta es la frontera entre las dos cosas, escrita como un tipo.
 */
export interface PeticionDeEscritura {
  /** El `{id}` de la ruta, ya leido. Nulo en la ruta que no lo lleva. */
  readonly conjuntoId: number | null;
  /** El campo `observacion` del cuerpo, tal como llego. Nulo si no vino. */
  readonly observacion: string | null;
}

/** Una negativa del backend, con su codigo del catalogo y su texto exacto. */
export interface NegativaSimulada {
  readonly codigo: 'VALIDACION' | 'NO_ENCONTRADO' | 'CONFLICTO';
  readonly estado: number;
  readonly mensaje: string;
}

/** Una escritura que ADR-0025 §5 anticipa y que `src/main` todavia no publica. */
export interface EscrituraSimulada {
  readonly metodo: 'POST';
  /** Ruta bajo la raiz del sistema, con sus parametros entre llaves. */
  readonly ruta: string;
  /** El caso de uso que ya existe en el backend y que esta ruta publicaria. */
  readonly casoDeUso: string;
  /** Por que esta inventada y que la sustituira. */
  readonly porQue: string;
  /** El cuerpo del exito. Como el de una lectura: sin argumentos, no puede mirar nada. */
  readonly cuerpo: () => unknown;
  /** La negativa que corresponde, o `null` si la escritura procede. */
  readonly negativa: (peticion: PeticionDeEscritura) => NegativaSimulada | null;
}

/**
 * El minimo de la observacion, y de donde sale.
 *
 * `CHECK (length(btrim(observacion)) >= 5)` en la tabla `auditoria` —`auditoria_observacion_ck`,
 * linea 452 del baseline— y el constructor de `Observacion` lo adelanta al dominio para que el
 * rechazo no ocurra a mitad de un `INSERT`.
 */
const OBSERVACION_MINIMA = 5;

/**
 * El texto exacto de `Observacion`, con su `LARGO_MINIMO` ya sustituido.
 *
 * Sale como `422 VALIDACION` porque es una `IllegalArgumentException` y
 * `ManejadorDeErrores.validacion` devuelve el mensaje tal cual: lo escribimos nosotros y habla
 * del dato, no del esquema.
 */
const OBSERVACION_CORTA: NegativaSimulada = {
  codigo: 'VALIDACION',
  estado: 422,
  mensaje:
    `La observacion debe explicar el cambio: al menos ${String(OBSERVACION_MINIMA)} ` +
    'caracteres, y no espacios en blanco (ADR-0008)',
};

/** Regla 10: sin observacion no se guarda. Es la primera que mira el borde. */
function observacionQueNoVale(peticion: PeticionDeEscritura): NegativaSimulada | null {
  const texto = (peticion.observacion ?? '').trim();
  return texto.length < OBSERVACION_MINIMA ? OBSERVACION_CORTA : null;
}

/** `AdministrarParametros.conjunto(id)`: el conjunto que no existe sale 404. */
function conjuntoQueNoExiste(conjuntoId: number | null): NegativaSimulada | null {
  if (conjuntoId !== null && EDICIONES.some((e) => e.id === conjuntoId)) return null;
  return {
    codigo: 'NO_ENCONTRADO',
    estado: 404,
    mensaje: `No hay ningun conjunto de parametros con identificador ${String(conjuntoId)}`,
  };
}

/**
 * Las tres escrituras, en el orden en que la ficha de una edicion las ofrece.
 *
 * <h2>Las negativas que SI se reproducen, y por que exactamente esas</h2>
 *
 * Las tres que un usuario encuentra sin salirse del camino feliz: dejarse la observacion, sellar
 * un conjunto que ya esta sellado, y sellar uno vacio. Las dos ultimas son las de
 * `AdministrarParametros.sellar` y **se arreglan de maneras opuestas** —una abriendo una version
 * nueva, otra agregando parametros—, asi que una pantalla que las juntara mandaria a quien
 * atiende a hacer lo contrario de lo que hace falta.
 *
 * <h2>Y las que NO, dicho para que no parezca un olvido</h2>
 *
 * `agregarParametroPublicado` tiene otras dos —«no hay ningun parametro publicado con la llave»
 * (404) y «hay N publicados con la llave» (409)— y el constructor de `Ejercicio` rechaza fuera
 * de 1990–2100 (422). Las tres dependen de datos que el proxy no tiene: **el contenido de
 * `parametro_tributario`**, que es lo que publica `rol_carga_parametros` y que esta interfaz no
 * ve nunca. Fingirlas seria inventarse que hay publicado, que es una decision del servidor.
 */
export const ESCRITURAS_SIMULADAS: readonly EscrituraSimulada[] = [
  {
    metodo: 'POST',
    ruta: '/ediciones',
    casoDeUso: 'AdministrarParametros.abrirVersion',
    porQue:
      'ADR-0025 §5 la anticipa y `src/main` no la tiene. La version se calcula y no se recibe: quien corrige un conjunto sellado no tiene por que saber cuantas versiones hubo antes, y dejarselo elegir es la forma de acabar con dos versiones 2.',
    cuerpo: () => ({
      id: simulado<number>('conjuntoAbierto'),
      ejercicio: simulado<number>('ejercicioAbierto'),
      version: simulado<number>('versionAbierta'),
      estado: 'ABIERTO',
      fechaSellado: null,
      usuarioSellado: null,
    }),
    negativa: (peticion) => observacionQueNoVale(peticion),
  },
  {
    metodo: 'POST',
    ruta: '/ediciones/{id}/parametros',
    casoDeUso: 'AdministrarParametros.agregarParametroPublicado',
    porQue:
      'ADR-0025 §5 la anticipa y `src/main` no la tiene. Incorpora un parametro YA PUBLICADO nombrandolo por su llave —tipo, clave y desde cuando rige— y no por el identificador que le toco en la base: el mismo valor tiene identificadores distintos en «stg» y en «prod».',
    cuerpo: () => {
      const fila = simulado<readonly [string, string | null, string]>('parametroAgregado');
      return {
        tipo: fila[0],
        clave: fila[1],
        valorNumerico: fila[2],
        conjuntoId: simulado<number>('conjuntoDelSnapshot'),
      };
    },
    negativa: (peticion) =>
      observacionQueNoVale(peticion) ?? conjuntoQueNoExiste(peticion.conjuntoId),
  },
  {
    metodo: 'POST',
    ruta: '/ediciones/{id}/sellar',
    casoDeUso: 'AdministrarParametros.sellar',
    porQue:
      'ADR-0025 §5 la anticipa y `src/main` no la tiene. Es el acto administrativo del que cuelga la reproducibilidad del ejercicio, y por eso queda con fecha y con nombre.',
    cuerpo: () => ({
      id: simulado<number>('conjuntoDelSnapshot'),
      ejercicio: EJERCICIO_DE_CAPTURA,
      version: simulado<number>('versionAbierta'),
      estado: 'SELLADO',
      fechaSellado: simulado<string>('instanteDelSello'),
      usuarioSellado: simulado<string>('usuarioQueSella'),
    }),
    negativa: (peticion) => {
      // El mismo orden en que lo produce el borde: un cuerpo que no se puede leer no llega
      // nunca al caso de uso, y el caso de uso busca el conjunto antes de mirar su estado.
      const antes = observacionQueNoVale(peticion) ?? conjuntoQueNoExiste(peticion.conjuntoId);
      if (antes !== null) return antes;

      const conjunto = EDICIONES.find((e) => e.id === peticion.conjuntoId);
      if (conjunto === undefined) return null;
      if (conjunto.estado === 'SELLADO') {
        return {
          codigo: 'CONFLICTO',
          estado: 409,
          mensaje:
            `El conjunto ${String(conjunto.id)} ya esta sellado; corregirlo exige una version` +
            ' nueva (ADR-0007)',
        };
      }
      if (conjunto.parametros === 0) {
        // Un conjunto vacio sellado es peor que ninguno: la pantalla diria que el ejercicio
        // esta parametrizado y el calculo no encontraria ni la UIT.
        return {
          codigo: 'CONFLICTO',
          estado: 409,
          mensaje:
            `El conjunto ${String(conjunto.id)} no tiene ningun parametro: sellarlo vacio diria` +
            ' que el ejercicio esta parametrizado cuando no lo esta',
        };
      }
      return null;
    },
  },
];
