import type { TipoDeCampo } from '../ds/index.ts';
import { ESCRITURAS, type ConjuntoResource } from '../datos/lecturas.ts';
import { ABIERTO, SELLADO } from './conjuntos.ts';
import type { EstadoDeEdiciones } from './estadoDeNormativa.ts';

/**
 * Los cuatro pasos de la ficha de una edicion: uno de lectura y **los tres de escritura**.
 *
 * <h2>Los campos son DATOS, no JSX (AC6)</h2>
 *
 * Un array de `{clave, etiqueta, tipo, ...}` que la pantalla recorre, portado de `const PASOS`
 * del artboard (linea 1358). No treinta `<Campo>` escritos a mano: con el formulario como dato,
 * «cuantos obligatorios quedan» es un `filter` y no una lista que alguien tiene que acordarse de
 * actualizar cuando anada el campo trece. Es la misma decision que `rentas` tomo en
 * `expediente.ts`, y el motivo por el que la compuerta de AC7 cabe en cuatro lineas.
 *
 * <h2>Los tres piden observacion, y sin ella no se guarda (regla 10)</h2>
 *
 * No es una convencion de esta pantalla: en la base es
 * `CHECK (length(btrim(observacion)) >= 5)` sobre `auditoria` —`auditoria_observacion_ck`, linea
 * 452 del baseline— y el constructor de `Observacion` lo adelanta al dominio para que el rechazo
 * no ocurra a mitad de un `INSERT`. El maximo son 500, que es el ancho de la columna.
 *
 * <h2>Y ninguno de los cuatro borra ni anula nada (AC8)</h2>
 *
 * No hay boton de borrar en toda la seccion **porque no existe esa operacion**:
 * `AdministrarParametros` publica `abrirVersion`, `agregarParametroPublicado` y `sellar`, y nada
 * mas. Un conjunto sellado no se corrige — se abre otra version, que queda al lado de la
 * anterior, y cada determinacion guarda con cual se calculo (ADR-0007, ADR-0025 §3).
 */

/** Un campo del formulario, declarado. La pantalla lo dibuja con `Campo`; aqui no hay JSX. */
export interface CampoDelFormulario {
  /** La clave con que se guarda lo tecleado, en el estado que vive en el marco. */
  readonly clave: string;
  readonly etiqueta: string;
  readonly tipo: TipoDeCampo;
  /**
   * El nombre del campo en el cuerpo JSON de la operacion.
   *
   * Se declara para poder **componer el cuerpo recorriendo los campos**: sin el, el envio seria
   * un objeto escrito a mano al lado de la definicion, y los dos se separarian en el primer
   * campo que se anadiera.
   */
  readonly campo?: string;
  readonly opciones?: readonly string[];
  /** Ocupa la fila entera de la rejilla. */
  readonly ancho?: boolean;
  readonly opcional?: boolean;
  readonly ph?: string;
  readonly ayuda?: string;
}

/** Una columna de la tabla de parametros del conjunto: rotulo y si es una cifra. */
export type ColumnaDeParametros = readonly [rotulo: string, cifra: boolean];

/** Uno de los cuatro pasos de la ficha. */
export interface PasoDeLaEdicion {
  readonly id: string;
  readonly rotulo: string;
  /** Si guarda algo. Los tres que guardan piden observacion. */
  readonly escritura: boolean;
  /** El rotulo del boton primario. Solo en los de escritura. */
  readonly verbo?: string;
  /** El caso de uso del backend que esta operacion ejecuta. */
  readonly casoDeUso?: string;
  readonly nota: string;
  readonly campos: readonly CampoDelFormulario[];
}

/** El minimo de la observacion. `auditoria_observacion_ck`, y `Observacion.LARGO_MINIMO`. */
export const OBSERVACION_MINIMA = 5;

/** El maximo: el ancho de `observacion varchar(500)`, y `Observacion.LARGO_MAXIMO`. */
export const OBSERVACION_MAXIMA = 500;

/**
 * El nombre del campo de observacion **en el cuerpo JSON**. Uno solo, el de las tres operaciones.
 *
 * La CLAVE con que se guarda lo tecleado es distinta en cada formulario a proposito
 * —`observacionAbrir`, `observacionAgregar`, `observacionSellar`—: una observacion escrita para
 * abrir una version no puede convertirse en silencio en la observacion con la que se sella. Son
 * dos asientos de auditoria distintos, y la regla 10 pide la explicacion DEL cambio, no una
 * cualquiera. Lo que las une es este nombre, que es lo que viaja.
 */
export const OBSERVACION = 'observacion';

const AYUDA_DE_LA_OBSERVACION =
  `Sin observación no se guarda (regla 10). Al menos ${String(OBSERVACION_MINIMA)} caracteres, ` +
  `y como mucho ${String(OBSERVACION_MAXIMA)}: es lo que admite la columna.`;

/**
 * El campo de observacion, escrito una vez y usado por los tres formularios.
 *
 * Cada uno con **su** clave, por lo que dice el javadoc de `OBSERVACION`. Que la compuerta sepa
 * cual mirar no cuesta un `if` por paso: lo busca por su `campo`, que es el mismo en los tres.
 */
function observacionDe(clave: string, ph: string): CampoDelFormulario {
  return {
    clave,
    campo: OBSERVACION,
    etiqueta: 'Observación',
    tipo: 'area',
    ancho: true,
    ph,
    ayuda: AYUDA_DE_LA_OBSERVACION,
  };
}

/**
 * Los tipos de parametro que el desplegable ofrece, de `const PASOS` del artboard.
 *
 * Son **nombres de tipo**, no cifras: `UIT` es la etiqueta de una llave, y su valor —la cifra
 * que fija el decreto supremo— vive en el corpus y llega por HTTP. Que esta lista este aqui es
 * lo contrario de escribir la cifra: nombra la llave para poder **pedirla**.
 */
const TIPOS_DE_PARAMETRO: readonly string[] = [
  '',
  'UIT',
  'TRAMO_PREDIAL',
  'TRAMO_PREDIAL_LIMITE',
  'DEDUCCION_PENSIONISTA',
  'DEDUCCION_ADULTO_MAYOR',
  'PREDIAL_MINIMO',
  'PLAZO',
  'ALCABALA_ALICUOTA',
  'ALCABALA_TRAMO_INAFECTO_UIT',
  'ESPECTACULO_ALICUOTA',
  'FACTOR_OFICIALIZACION',
  'PORCENTAJE_DE_ACTUALIZACION',
];

/** Los ejercicios que el desplegable de «Abrir versión» ofrece. Del artboard. */
const EJERCICIOS = ['', '2026', '2027', '2028'];

/** El identificador del paso que ensena lo que el conjunto contiene. */
export const PASO_DE_LECTURA = 'parametros';

/** El identificador del unico paso que **no** necesita un conjunto detras. */
export const PASO_DE_APERTURA = 'abrir';

export const PASOS: readonly PasoDeLaEdicion[] = [
  {
    id: PASO_DE_LECTURA,
    rotulo: 'Parámetros del conjunto',
    escritura: false,
    nota:
      'Lo que este conjunto contiene, tal como se compuso. Lleva la vigencia de cada fila y no ' +
      'el valor ya resuelto: un conjunto sellado guarda a propósito el histórico de una llave ' +
      '—la UIT aparece cinco veces— y quien resuelve cuál rige es el lector, contra el ' +
      'ejercicio del conjunto.',
    campos: [
      { clave: 'id', etiqueta: 'Identificador', tipo: 'ro' },
      { clave: 'ejercicio', etiqueta: 'Ejercicio', tipo: 'ro' },
      { clave: 'version', etiqueta: 'Versión', tipo: 'ro' },
      {
        clave: 'estado',
        etiqueta: 'Estado',
        tipo: 'ro',
        ayuda: 'ABIERTO o SELLADO. Son dos y el paso entre ellos va en una sola dirección.',
      },
      { clave: 'fechaSellado', etiqueta: 'Fecha de sellado', tipo: 'ro' },
      {
        clave: 'usuarioSellado',
        etiqueta: 'Usuario que selló',
        tipo: 'ro',
        ayuda:
          'El acto administrativo del que cuelga la reproducibilidad del ejercicio queda con ' +
          'fecha y con nombre.',
      },
    ],
  },
  {
    id: PASO_DE_APERTURA,
    rotulo: 'Abrir versión',
    escritura: true,
    verbo: 'Abrir la versión',
    casoDeUso: 'AdministrarParametros.abrirVersion',
    nota:
      'Una versión nueva del ejercicio, para componerla desde cero o para corregir lo que un ' +
      'conjunto ya sellado no admite. La versión NO se recibe: se calcula. Quien corrige un ' +
      'conjunto sellado no tiene por qué saber cuántas versiones hubo antes, y dejárselo elegir ' +
      'es la forma de acabar con dos versiones 2.',
    campos: [
      {
        clave: 'ejercicioNuevo',
        campo: 'ejercicio',
        etiqueta: 'Ejercicio',
        tipo: 'sel',
        opciones: EJERCICIOS,
        ayuda:
          'Entre 1990 y 2100. Fuera de rango lo rechaza el constructor del ejercicio, y eso es ' +
          'un 422 que nombra el rango: no es lo mismo que «ese ejercicio no está sellado».',
      },
      {
        clave: 'versionQueSeAsignara',
        etiqueta: 'Versión que se asignará',
        tipo: 'ro',
        ayuda: 'La última del ejercicio más uno. La calcula el servidor.',
      },
      observacionDe('observacionAbrir', 'Por qué se abre esta versión'),
    ],
  },
  {
    id: 'agregar',
    rotulo: 'Agregar parámetro',
    escritura: true,
    verbo: 'Agregar el parámetro',
    casoDeUso: 'AdministrarParametros.agregarParametroPublicado',
    nota:
      'Incorpora al conjunto un parámetro YA PUBLICADO, nombrándolo por lo que es y no por el ' +
      'identificador que le tocó en la base. El mismo valor tiene identificadores distintos en ' +
      '«stg» y en «prod», así que un archivo escrito con números entra en el ambiente ' +
      'equivocado sin fallar: sella un juego de parámetros que no es el que dice.',
    campos: [
      { clave: 'conjunto', etiqueta: 'Conjunto', tipo: 'ro' },
      {
        clave: 'tipo',
        campo: 'tipo',
        etiqueta: 'Tipo',
        tipo: 'sel',
        opciones: TIPOS_DE_PARAMETRO,
      },
      {
        clave: 'clave',
        campo: 'clave',
        etiqueta: 'Clave',
        tipo: 'text',
        opcional: true,
        ph: 'Vacía si el tipo tiene un solo valor',
        ayuda: 'La UIT no lleva clave. TRAMO_PREDIAL lleva 1, 2 o 3.',
      },
      {
        clave: 'vigenciaDesde',
        campo: 'vigenciaDesde',
        etiqueta: 'Vigente desde',
        tipo: 'date',
        ayuda:
          'Forma parte de la llave: la UIT de 2026 y la de 2027 comparten tipo y clave, y son ' +
          'filas distintas. Sin la fecha habría que elegir una, y elegirla en silencio es el ' +
          'modo de falla que ARQ-09 §3 describe.',
      },
      observacionDe('observacionAgregar', 'Por qué entra este parámetro en el conjunto'),
    ],
  },
  {
    id: 'sellar',
    rotulo: 'Sellar',
    escritura: true,
    verbo: 'Sellar el conjunto',
    casoDeUso: 'AdministrarParametros.sellar',
    nota:
      'A partir de aquí rige, y no se modifica: ni el conjunto ni su contenido. Lo impide un ' +
      'disparador de la base, no una validación de la aplicación. Es el acto administrativo del ' +
      'que cuelga la reproducibilidad de todo lo que se emita con él, y por eso queda con fecha ' +
      'y con nombre.',
    campos: [
      { clave: 'conjunto', etiqueta: 'Conjunto', tipo: 'ro' },
      { clave: 'loQueSeCongela', etiqueta: 'Lo que se congela', tipo: 'ro' },
      observacionDe('observacionSellar', 'Qué se sella y por qué'),
    ],
  },
];

/** El paso con ese identificador, o el de apertura si no lo hay. */
export function pasoDe(id: string): PasoDeLaEdicion {
  const encontrado = PASOS.find((paso) => paso.id === id);
  if (encontrado === undefined) {
    // No puede pasar: `id` sale siempre de `PASOS`. Se cae del lado del unico paso que funciona
    // sin conjunto detras, en vez de devolver `undefined` a la pantalla.
    const apertura = PASOS.find((paso) => paso.id === PASO_DE_APERTURA);
    if (apertura === undefined) {
      throw new Error('La ficha de una edicion no tiene ningun paso: la definicion esta vacia.');
    }
    return apertura;
  }
  return encontrado;
}

/**
 * Los pasos que se pueden ofrecer con ese conjunto delante.
 *
 * Sin conjunto solo cabe **abrir una version**: los otros tres necesitan uno. Es lo que ve una
 * municipalidad recien implantada, y lo que hace que su primera pantalla tenga una salida en vez
 * de ser un vacio con un boton que lleva a otro vacio.
 */
export function pasosPara(conjunto: ConjuntoResource | null): readonly PasoDeLaEdicion[] {
  return conjunto === null ? PASOS.filter((paso) => paso.id === PASO_DE_APERTURA) : PASOS;
}

/**
 * Lo que el servidor ya sabe de esa edicion, por clave de campo.
 *
 * Solo alimenta los campos de **solo lectura**: son valores que el sistema tiene y que nadie
 * teclea. Lo tecleado manda sobre esto —`valor()` mira primero el estado— porque si no, escribir
 * en un campo que tambien esta aqui no se veria.
 *
 * `versionQueSeAsignara` no esta, y no es un olvido: **la calcula el servidor** como «la ultima
 * del ejercicio mas uno», y el ejercicio lo elige quien abre la version, que puede no ser el del
 * conjunto que tenga abierto. Adivinarla aqui ensenaria un numero que el servidor no va a
 * asignar. Lo mismo con `loQueSeCongela`: ninguna operacion publica cuantos parametros lleva un
 * conjunto **sin sellar**, y por eso la negativa de «sellarlo vacio» llega del servidor en vez
 * de predecirse aqui (AC8).
 */
export function valoresServidos(
  conjunto: ConjuntoResource | null,
): Readonly<Record<string, string>> {
  if (conjunto === null) {
    return {};
  }
  return {
    id: String(conjunto.id),
    conjunto: String(conjunto.id),
    ejercicio: String(conjunto.ejercicio),
    version: String(conjunto.version),
    estado: conjunto.estado,
    fechaSellado: conjunto.fechaSellado ?? '',
    usuarioSellado: conjunto.usuarioSellado ?? '',
  };
}

/** Si ese campo es obligatorio: cuenta para la compuerta y puede salir en rojo. */
export function esObligatorio(campo: CampoDelFormulario): boolean {
  return campo.opcional !== true && campo.tipo !== 'ro' && campo.tipo !== 'chk';
}

/** Cuantos obligatorios del paso siguen vacios. */
export function pendientesDe(
  paso: PasoDeLaEdicion,
  valor: (clave: string) => string,
): readonly CampoDelFormulario[] {
  return paso.campos.filter((campo) => esObligatorio(campo) && valor(campo.clave).trim() === '');
}

/** La clave con que ese paso guarda su observacion. Cadena vacia si el paso no escribe. */
export function claveDeLaObservacion(paso: PasoDeLaEdicion): string {
  return paso.campos.find((campo) => campo.campo === OBSERVACION)?.clave ?? '';
}

// ── La compuerta (AC7) ──────────────────────────────────────────────────────────────────────

/**
 * Por que no se puede guardar todavia, en una linea, o cadena vacia si se puede.
 *
 * Es **un solo motivo y lo escribe un solo sitio**, porque va a tres: el `title` del boton
 * primario, el pie del formulario y el toast del intento. Tres redacciones del mismo rechazo son
 * tres que divergen, y quien atiende leeria una cosa al pasar el puntero y otra al pulsar.
 *
 * El orden es el del borde: primero lo que falta por teclear —que es lo que la persona puede
 * arreglar sin salir del campo— y despues la observacion. Al reves, quien no ha escrito nada
 * leeria «falta la observacion» teniendo el formulario entero vacio.
 */
export function motivoDe(paso: PasoDeLaEdicion, valor: (clave: string) => string): string {
  if (!paso.escritura) {
    return '';
  }
  const pendientes = pendientesDe(paso, valor).filter((campo) => campo.campo !== OBSERVACION);
  if (pendientes.length > 0) {
    return pendientes.length === 1
      ? 'Queda 1 dato obligatorio sin llenar.'
      : `Quedan ${String(pendientes.length)} datos obligatorios sin llenar.`;
  }
  const observacion = valor(claveDeLaObservacion(paso)).trim();
  if (observacion.length < OBSERVACION_MINIMA) {
    return `Sin observación no se guarda: al menos ${String(OBSERVACION_MINIMA)} caracteres (regla 10).`;
  }
  if (observacion.length > OBSERVACION_MAXIMA) {
    return `La observación no cabe: como mucho ${String(OBSERVACION_MAXIMA)} caracteres.`;
  }
  return '';
}

/** Si el boton primario no puede guardar. Se pinta con `aria-disabled`, nunca con `disabled`. */
export function bloqueado(paso: PasoDeLaEdicion, valor: (clave: string) => string): boolean {
  return motivoDe(paso, valor) !== '';
}

// ── Lo que se manda, y a donde ──────────────────────────────────────────────────────────────

/**
 * La ruta de la escritura de ese paso, o `null` si el paso no escribe.
 *
 * Las tres rutas viven en `datos/lecturas.ts` con las otras cuatro, no aqui: una ruta repetida
 * en dos pantallas se corrige en una sola el dia que cambie.
 */
export function rutaDe(paso: PasoDeLaEdicion, conjunto: ConjuntoResource | null): string | null {
  if (paso.id === PASO_DE_APERTURA) {
    return ESCRITURAS.abrirVersion;
  }
  if (conjunto === null) {
    return null;
  }
  if (paso.id === 'agregar') {
    return ESCRITURAS.agregarParametro(conjunto.id);
  }
  if (paso.id === 'sellar') {
    return ESCRITURAS.sellar(conjunto.id);
  }
  return null;
}

/**
 * El cuerpo JSON, **compuesto recorriendo los campos que declaran su nombre**.
 *
 * No es un objeto escrito a mano al lado de la definicion: con esto, un campo anadido a `PASOS`
 * viaja solo, y uno que se quite deja de viajar. Se recorta lo tecleado —los espacios de los
 * bordes no son parte de una observacion— y se omite lo opcional vacio: `clave: ''` y «esta
 * llave no tiene clave» son cosas distintas, y la segunda se dice con la ausencia.
 */
export function cuerpoDe(
  paso: PasoDeLaEdicion,
  valor: (clave: string) => string,
): Record<string, string> {
  const cuerpo: Record<string, string> = {};
  for (const campo of paso.campos) {
    if (campo.campo === undefined) {
      continue;
    }
    const escrito = valor(campo.clave).trim();
    if (escrito === '' && campo.opcional === true) {
      continue;
    }
    cuerpo[campo.campo] = escrito;
  }
  return cuerpo;
}

// ── El filtro y los chips, que corren sobre la pagina servida ───────────────────────────────

/**
 * Las filas que el buscador y el chip dejan ver.
 *
 * **Filtra en el cliente y sobre la pagina que el servidor mando**, y no compone un
 * `?estado=SELLADO`: la operacion no declara ese parametro, asi que pedirlo seria un **422
 * «parametro desconocido»** de `GuardiaDeParametros`. Ordenar y paginar si son del servidor, y
 * por eso van en la ruta. La pantalla dice cuantas ve de cuantas trajo, para que la diferencia
 * no se lea como que faltan filas.
 */
export function filtrar(
  conjuntos: readonly ConjuntoResource[],
  estado: EstadoDeEdiciones,
): readonly ConjuntoResource[] {
  const buscado = estado.q.trim().toLowerCase();
  return conjuntos.filter((uno) => {
    const texto =
      `${String(uno.ejercicio)} v${String(uno.version)} ${String(uno.id)} ${uno.estado}`.toLowerCase();
    const coincide = buscado === '' || texto.includes(buscado);
    const porEstado =
      estado.chip === 'Todas' ||
      (estado.chip === 'Abiertas' && uno.estado === ABIERTO) ||
      (estado.chip === 'Selladas' && uno.estado === SELLADO);
    return coincide && porEstado;
  });
}
