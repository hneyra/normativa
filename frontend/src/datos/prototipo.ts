/**
 * La captura del prototipo: los datos del artboard `NormativaV6.dc.html`, copiados enteros.
 *
 * <h2>Por que estan aqui y no dentro del proxy</h2>
 *
 * Es la CAPTURA, y se separa de la INVENCION a proposito. Todo lo de este archivo sale del
 * artboard tal cual —cada cifra se puede buscar en `diseno/NormativaV6.dc.html` y encontrarla
 * igual—; lo que el proxy tiene que anadir porque el prototipo no lo trae vive en
 * `simulados.ts`, con el nombre de la operacion que lo sustituira. Mezclarlos haria
 * indistinguible una cifra del corpus de una que alguien escribio para que la pantalla no
 * saliera vacia, que es justo la distincion que hay que poder hacer el dia que esto se apague.
 *
 * <h2>AVISO — los literales tributarios de este archivo NO se quedan (regla 5)</h2>
 *
 * `PARAMETROS` trae la **UIT** de cinco ejercicios, los **tres tramos** de la escala progresiva
 * con sus **alicuotas**, las dos deducciones, el minimo del predial, las alicuotas de alcabala
 * y de espectaculos y el `% actualizacion`; `VALORES_UNITARIOS`, `DEPRECIACIONES` y
 * `VALORES_REFERENCIALES` traen filas de los tres cuadros nacionales de ADR-0017. La regla 5
 * del producto prohibe que una cifra tributaria viva en el codigo: UIT, tramos, alicuotas,
 * valores unitarios, aranceles y tablas de depreciacion viven en datos versionados, porque
 * recalcular 2027 en 2037 tiene que dar el mismo centimo (RNF-053) y porque cambiarlas no puede
 * exigir un despliegue.
 *
 * **Y aqui muerde mas que en ningun otro repositorio**: este es el sistema cuyo trabajo entero
 * es que esas cifras vivan en el corpus firmado a dos manos (ADR-0007). Estan **solo mientras
 * no hay backend al que preguntarle**, y son literales de un artboard: nada de este archivo
 * calcula nada. El dia que las cuatro operaciones contesten, estas cifras **llegan de la API**
 * —`GET /conjuntos/{id}/snapshot` publica los parametros y los tres cuadros del conjunto
 * sellado— y **este archivo se borra entero**, no se actualiza. Una pantalla que lea la UIT de
 * aqui en vez de la respuesta esta escribiendo el defecto que la regla 5 existe para impedir.
 *
 * <h2>Procedencia, linea a linea</h2>
 *
 * Artboard `diseno/NormativaV6.dc.html`, bloque `<script type="text/x-dc">`:
 *
 *   · `PARAMETROS`             — :1177  (33 filas, las 33 de `publicacion/parametros-2026.csv`)
 *   · `VALORES_UNITARIOS`      — :1216  (24 celdas del Anexo I.2 Costa, enteras)
 *   · `DEPRECIACIONES`         — :1232  (14 de las 492 del Anexo I del RNT)
 *   · `VALORES_REFERENCIALES`  — :1251  (10 de las 54 129 del anexo del MEF)
 *   · `CUADROS`                — :1267  (las tres ediciones, con su sha256 y su doble firma)
 *   · `EDICIONES`              — :1314  (las tres del conjunto)
 *   · `SNAPSHOTS`              — :1401  (los cuatro ETag de EJEMPLO)
 *
 * <h2>Lo que el artboard dibuja y NO esta aqui, dicho para que no parezca un olvido</h2>
 *
 * `SIN_ARCHIVO` (las diez filas del mapa normativo sin archivo), `DECISIONES` (D-02b, D-02c,
 * D-11, D-03d) y `PASOS` (la estructura de los cuatro pasos de la ficha). **Ninguna operacion
 * del backend las sirve**: son prosa del modulo, no respuesta de una ruta, y este archivo
 * existe para alimentar los cuerpos que el proxy contesta. Las captura el issue que las dibuja
 * (#14, #15), que es quien puede decir con que forma las necesita.
 */

/** Una fila de `parametro_tributario` tal como el corpus la publica. */
export type FilaDeParametro = readonly [
  tipo: string,
  clave: string,
  valorNumerico: string,
  valorTexto: string,
  vigenciaDesde: string,
  vigenciaHasta: string,
  documentoFuente: string,
];

/** Una celda del cuadro de valores unitarios: partida, categoria, desde, hasta, valor por m². */
export type FilaDeValorUnitario = readonly [
  partida: string,
  categoria: string,
  desde: string,
  hasta: string,
  porM2: string,
];

/** Una fila del cuadro de depreciacion. `hasta` vale `'—'` en el tramo abierto. */
export type FilaDeDepreciacion = readonly [
  uso: string,
  material: string,
  estadoConservacion: string,
  hasta: string,
  porcentaje: string,
];

/** Una fila del anexo de valores referenciales del MEF. */
export type FilaDeValorReferencial = readonly [
  ejercicio: string,
  categoria: string,
  marca: string,
  modelo: string,
  anioFabricacion: string,
  importe: string,
];

/** El ejercicio del que el artboard ensena el conjunto sellado. */
export const EJERCICIO_DE_CAPTURA = 2026;

/**
 * El marcador de «no hay valor» del artboard.
 *
 * Se declara en vez de escribirse suelto porque es lo que separa un tramo abierto de un cero:
 * `antiguedadHasta` con este marcador es «mas de 50 anios» y viaja como `null`, y leerlo como
 * cero convierte el tramo que todo lo cubre en uno que no cubre nada, sin ningun error de por
 * medio (`DepreciacionDelSnapshot`).
 */
export const SIN_VALOR = '—';

/**
 * Las 33 filas de `docs/10-negocio/valores-normativos/publicacion/parametros-2026.csv`.
 *
 * `valorTexto` es la transcripcion verbatim de la norma, asi que se recorta al dibujarla, no al
 * guardarla. La clave va vacia cuando el tipo tiene un solo valor —la UIT no tiene clave;
 * `TRAMO_PREDIAL` tiene tres—, y `vigenciaHasta` vacio no es un olvido: es una norma sin fecha
 * de fin.
 */
export const PARAMETROS: readonly FilaDeParametro[] = [
  ['UIT', '', '4600.00', '', '2022-01-01', '2022-12-31', 'D.S. N.° 398-2021-EF'],
  ['UIT', '', '4950.00', '', '2023-01-01', '2023-12-31', 'D.S. N.° 309-2022-EF'],
  ['UIT', '', '5150.00', '', '2024-01-01', '2024-12-31', 'D.S. N.° 309-2023-EF'],
  ['UIT', '', '5350.00', '', '2025-01-01', '2025-12-31', 'D.S. N.° 260-2024-EF'],
  ['UIT', '', '5500.00', '', '2026-01-01', '2026-12-31', 'D.S. N.° 301-2025-EF'],
  [
    'TRAMO_PREDIAL',
    '1',
    '0.2',
    'Hasta 15 UIT; 0.2%',
    '2004-11-15',
    '',
    'TUO LTM (D.S. 156-2004-EF), art. 13',
  ],
  [
    'TRAMO_PREDIAL',
    '2',
    '0.6',
    'Más de 15 UIT y hasta 60 UIT; 0.6%',
    '2004-11-15',
    '',
    'TUO LTM (D.S. 156-2004-EF), art. 13',
  ],
  [
    'TRAMO_PREDIAL',
    '3',
    '1.0',
    'Más de 60 UIT; 1.0%',
    '2004-11-15',
    '',
    'TUO LTM (D.S. 156-2004-EF), art. 13',
  ],
  [
    'TRAMO_PREDIAL_LIMITE',
    '1',
    '15',
    'Hasta 15 UIT',
    '2004-11-15',
    '',
    'TUO LTM (D.S. 156-2004-EF), art. 13',
  ],
  [
    'TRAMO_PREDIAL_LIMITE',
    '2',
    '60',
    'Más de 15 UIT y hasta 60 UIT',
    '2004-11-15',
    '',
    'TUO LTM (D.S. 156-2004-EF), art. 13',
  ],
  ['DEDUCCION_PENSIONISTA', '', '50', '50 UIT', '2004-11-15', '', 'TUO LTM art. 19'],
  [
    'DEDUCCION_ADULTO_MAYOR',
    '',
    '50',
    '50 UIT',
    '2016-07-21',
    '',
    'Ley N.° 30490, Ley de la Persona Adulta Mayor',
  ],
  [
    'PREDIAL_MINIMO',
    '',
    '0.6',
    '0.6% de la UIT vigente al 1 de enero del año al que corresponde el impuesto',
    '2004-11-15',
    '',
    'TUO LTM (D.S. 156-2004-EF), art. 13, último párrafo',
  ],
  [
    'PLAZO',
    'PRESCRIPCION-DECLARACION_PRESENTADA',
    '4',
    'prescribe a los cuatro (4) años; deudor que presentó la declaración respectiva',
    '2013-06-22',
    '',
    'TUO del Código Tributario (D.S. N.º 133-2013-EF)',
  ],
  [
    'PLAZO',
    'PRESCRIPCION-SIN_DECLARACION',
    '6',
    'seis (6) años para quienes no hayan presentado la declaración respectiva',
    '2013-06-22',
    '',
    'TUO del Código Tributario (D.S. N.º 133-2013-EF)',
  ],
  [
    'PLAZO',
    'PRESCRIPCION-AGENTE_RETENCION',
    '10',
    'prescriben a los diez (10) años cuando el Agente de retención o percepción',
    '2013-06-22',
    '',
    'TUO del Código Tributario (D.S. N.º 133-2013-EF)',
  ],
  [
    'PLAZO',
    'REC1_CUMPLIMIENTO',
    '7',
    'dentro del plazo de siete (7) días hábiles de notificado',
    '2004-01-10',
    '',
    'Ley N.º 26979, Ley de Procedimiento de Ejecución Coactiva',
  ],
  [
    'PLAZO',
    'NOTIFICACION_VALOR-RD',
    '20',
    'término improrrogable de veinte (20) días hábiles',
    '2013-06-22',
    '',
    'TUO del Código Tributario (D.S. N.º 133-2013-EF)',
  ],
  [
    'PLAZO',
    'NOTIFICACION_VALOR-RM',
    '20',
    'término improrrogable de veinte (20) días hábiles',
    '2013-06-22',
    '',
    'TUO del Código Tributario (D.S. N.º 133-2013-EF)',
  ],
  [
    'PLAZO',
    'NOTIFICACION_VALOR-OP',
    '0',
    'el desfase publicado es de cero (0) días hábiles',
    '2008-12-06',
    '',
    'TUO de la Ley N.º 26979',
  ],
  [
    'PLAZO',
    'PRESCRIPCION_INICIO-PREDIAL',
    '1',
    'Desde el uno (1) de enero del año siguiente; desfase de un año respecto del ejercicio',
    '2013-06-22',
    '',
    'TUO del Código Tributario (D.S. N.º 133-2013-EF)',
  ],
  [
    'PLAZO',
    'PRESCRIPCION_INICIO-VEHICULAR',
    '1',
    'Desde el uno (1) de enero del año siguiente; desfase de un año respecto del ejercicio',
    '2013-06-22',
    '',
    'TUO del Código Tributario (D.S. N.º 133-2013-EF)',
  ],
  [
    'ALCABALA_ALICUOTA',
    '',
    '3',
    'La tasa del impuesto es de 3%',
    '2004-11-15',
    '',
    'TUO LTM (D.S. N.° 156-2004-EF)',
  ],
  [
    'ALCABALA_TRAMO_INAFECTO_UIT',
    '',
    '10',
    'el tramo comprendido por las primeras 10 UIT del valor del inmueble',
    '2004-11-15',
    '',
    'TUO LTM (D.S. N.° 156-2004-EF)',
  ],
  [
    'ESPECTACULO_ALICUOTA',
    'TAURINO-SUPERIOR-0.5-UIT',
    '10',
    'Espectáculos taurinos, valor promedio ponderado de la entrada superior al 0.5% de la UIT; 10%',
    '2007-12-20',
    '',
    'TUO LTM art. 57 (Ley N.° 29168)',
  ],
  [
    'ESPECTACULO_ALICUOTA',
    'TAURINO-RESTO',
    '5',
    'Espectáculos taurinos, en los demás casos; 5%',
    '2007-12-20',
    '',
    'TUO LTM art. 57 (Ley N.° 29168)',
  ],
  [
    'ESPECTACULO_ALICUOTA',
    'CARRERAS-CABALLOS',
    '15',
    'Carreras de caballos; 15%',
    '2007-12-20',
    '',
    'TUO LTM art. 57 (Ley N.° 29168)',
  ],
  [
    'ESPECTACULO_ALICUOTA',
    'CINEMATOGRAFICO',
    '10',
    'Espectáculos cinematográficos; 10%',
    '2007-12-20',
    '',
    'TUO LTM art. 57 (Ley N.° 29168)',
  ],
  [
    'ESPECTACULO_ALICUOTA',
    'MUSICA-GENERAL',
    '0',
    'Conciertos de música en general; 0%',
    '2007-12-20',
    '',
    'TUO LTM art. 57 (Ley N.° 29168)',
  ],
  [
    'ESPECTACULO_ALICUOTA',
    'FOLCLOR-TEATRO-ZARZUELA-OPERA-BALLET-CIRCO',
    '0',
    'Espectáculos de folclor nacional, teatro, zarzuela, música clásica, ópera, opereta, ballet y circo; 0%',
    '2007-12-20',
    '',
    'TUO LTM art. 57 (Ley N.° 29168)',
  ],
  [
    'ESPECTACULO_ALICUOTA',
    'OTROS',
    '10',
    'Otros espectáculos públicos; 10%',
    '2007-12-20',
    '',
    'TUO LTM art. 57 (Ley N.° 29168)',
  ],
  [
    'FACTOR_OFICIALIZACION',
    '',
    '0.68',
    'FACTOR DE OFICIALIZACIÓN Fo = 0,68',
    '2026-01-01',
    '2026-12-31',
    'Resolución Ministerial N.° 277-2025-VIVIENDA',
  ],
  [
    'PORCENTAJE_DE_ACTUALIZACION',
    '',
    '0',
    'En el ejercicio 2026 se publicaron los aranceles de terrenos y los precios unitarios oficiales de construcción; el supuesto del art. 12 no se cumple y no hay actualización que aplicar: 0',
    '2026-01-01',
    '2026-12-31',
    'TUO LTM (D.S. N.° 156-2004-EF), art. 12',
  ],
];

/**
 * Las 24 celdas del Anexo I.2 (Costa) de `fuentes/valores-unitarios-2026/`, enteras.
 *
 * Que la J no aparezca y que la H no tenga muros **no es un hueco del derivado: es el cuadro**.
 * La J existe solo en el Anexo I.4 (Selva) y solo en muros. Por eso son 24 y no 30.
 */
export const VALORES_UNITARIOS: readonly FilaDeValorUnitario[] = [
  ['MUROS', 'A', '1990', SIN_VALOR, '894.27'],
  ['TECHOS', 'A', '1990', SIN_VALOR, '543.16'],
  ['PUERTAS', 'A', '1990', SIN_VALOR, '485.33'],
  ['MUROS', 'B', '1990', SIN_VALOR, '576.57'],
  ['TECHOS', 'B', '1990', SIN_VALOR, '354.37'],
  ['PUERTAS', 'B', '1990', SIN_VALOR, '255.81'],
  ['MUROS', 'C', '1990', SIN_VALOR, '387.43'],
  ['TECHOS', 'C', '1990', SIN_VALOR, '285.80'],
  ['PUERTAS', 'C', '1990', SIN_VALOR, '161.41'],
  ['MUROS', 'D', '1990', SIN_VALOR, '374.68'],
  ['TECHOS', 'D', '1990', SIN_VALOR, '181.40'],
  ['PUERTAS', 'D', '1990', SIN_VALOR, '141.39'],
  ['MUROS', 'E', '1990', SIN_VALOR, '263.77'],
  ['TECHOS', 'E', '1990', SIN_VALOR, '67.63'],
  ['PUERTAS', 'E', '1990', SIN_VALOR, '120.98'],
  ['MUROS', 'F', '1990', SIN_VALOR, '198.64'],
  ['TECHOS', 'F', '1990', SIN_VALOR, '37.19'],
  ['PUERTAS', 'F', '1990', SIN_VALOR, '90.81'],
  ['MUROS', 'G', '1990', SIN_VALOR, '117.05'],
  ['TECHOS', 'G', '1990', SIN_VALOR, '25.57'],
  ['PUERTAS', 'G', '1990', SIN_VALOR, '49.05'],
  ['TECHOS', 'H', '1990', SIN_VALOR, '0.00'],
  ['PUERTAS', 'H', '1990', SIN_VALOR, '24.53'],
  ['PUERTAS', 'I', '1990', SIN_VALOR, '0.00'],
];

/**
 * Catorce de las 492 filas de `fuentes/depreciacion-rnt-2016/depreciacion.csv`.
 *
 * El **tramo abierto** —`hasta` con `SIN_VALOR`, «mas de 50 anios»— esta entre ellas a
 * proposito: es la fila que el artboard dibuja como «—» y que viaja como `null`, y la unica que
 * demuestra que la lectura no lo confunde con un cero.
 *
 * El uso es la tabla a la que pertenece la fila, con el numero que usa la propia norma: 01
 * vivienda, 02 tiendas y depositos, 03 oficinas, 04 salud, industria y educacion.
 */
export const DEPRECIACIONES: readonly FilaDeDepreciacion[] = [
  ['01', 'Concreto', 'Muy Bueno', '5', '0'],
  ['01', 'Concreto', 'Muy Bueno', '10', '0'],
  ['01', 'Concreto', 'Muy Bueno', '15', '3'],
  ['01', 'Concreto', 'Muy Bueno', '30', '12'],
  ['01', 'Concreto', 'Muy Bueno', '50', '24'],
  ['01', 'Concreto', 'Muy Bueno', SIN_VALOR, '27'],
  ['01', 'Ladrillo', 'Regular', '5', '20'],
  ['01', 'Ladrillo', 'Regular', '10', '23'],
  ['01', 'Ladrillo', 'Regular', '15', '26'],
  ['02', 'Concreto', 'Bueno', '5', '5'],
  ['02', 'Ladrillo', 'Malo', '5', '60'],
  ['02', 'Liviano/Adobe', 'Regular', '5', '32'],
  ['03', 'Concreto', 'Muy Bueno', '5', '0'],
  ['04', 'Concreto', 'Muy Bueno', '15', '6'],
];

/**
 * Diez de las 54 129 filas de `fuentes/tvr-2026/tvr-2026.csv`.
 *
 * 18 043 lineas del anexo por tres anios de fabricacion cada una. «OTROS MODELOS» es una fila de
 * verdad y aparece en cada categoria con un valor distinto, asi que la categoria es parte de la
 * identidad y no una etiqueta.
 *
 * El importe se captura **como lo escribe el artboard** —con separador de millar— y se convierte
 * a decimal al servirlo, sin pasar por `Number` en ningun punto (regla 1).
 */
export const VALORES_REFERENCIALES: readonly FilaDeValorReferencial[] = [
  ['2026', 'A1', 'BAJAJ', 'QUTE', '2025', '18,000.00'],
  ['2026', 'A1', 'BAJAJ', 'QUTE', '2024', '16,200.00'],
  ['2026', 'A1', 'BAJAJ', 'QUTE', '2023', '14,400.00'],
  ['2026', 'A1', 'BYD', 'FO COMFORT', '2025', '32,440.00'],
  ['2026', 'A2', 'TOYOTA', 'AGYA 1.0L E AT', '2025', '30,310.00'],
  ['2026', 'A3', 'ALFA ROMEO', '145 16 V', '2025', '86,430.00'],
  ['2026', 'A3', 'ALFA ROMEO', '147 2.0 SSP 3P', '2025', '104,780.00'],
  ['2026', 'CAMIONES', 'AUTOCRAFT', 'EXOR', '2025', '45,850.00'],
  ['2026', 'CAMIONETAS', 'ASIA', 'COMBI AM825 25', '2025', '104,740.00'],
  ['2026', 'BUSES Y OMNIBUSES', 'AGRALE', 'MA 8.5', '2025', '135,890.00'],
];

/** Una de las tres ediciones de cuadro que `publicacion/cuadros-2026.csv` publica. */
export interface EdicionDeCuadro {
  readonly id: string;
  readonly label: string;
  /** Cuantas filas tiene la edicion COMPLETA en el corpus, no cuantas se dibujan. */
  readonly filasDelCorpus: number;
  /** La mitad de la frontera de ADR-0024 a la que pertenece. */
  readonly ambito: 'VALUACION' | 'OBLIGACION';
  /** El documento fuente, verbatim, tal como la edicion lo declara. */
  readonly documentoFuente: string;
  /** El sha256 del derivado, verbatim: es lo que las dos firmas cubren (ADR-0007). */
  readonly sha256: string;
  /** Quien transcribio y quien verifico. Dos personas distintas, siempre. */
  readonly firmas: string;
}

/**
 * Las tres ediciones de `publicacion/cuadros-2026.csv`, con su huella y su doble firma.
 *
 * La edicion es la unidad que se publica: **una fila del cuadro no se corrige, se publica otra
 * edicion**. Y una region por edicion: la R.M. anual publica un cuadro por region y la tabla no
 * tiene columna de region, asi que la region viaja en la CLAVE de la edicion.
 */
export const CUADROS: readonly EdicionDeCuadro[] = [
  {
    id: 'unitarios',
    label: 'Valores unitarios',
    filasDelCorpus: 24,
    ambito: 'VALUACION',
    documentoFuente: 'Resolución Ministerial N.º 277-2025-VIVIENDA',
    sha256: '0540c3af64fd015b905135d0274c07ffec2f52dbfe4764ff27823e6e7c775261',
    firmas: 'JNA · HNA',
  },
  {
    id: 'depreciacion',
    label: 'Depreciación',
    filasDelCorpus: 492,
    ambito: 'VALUACION',
    documentoFuente: 'Resolución Ministerial N.º 172-2016-VIVIENDA',
    sha256: '5e919b370b10473570187c33edefd15a6dd372653db5d77b25fc51e31deb6be6',
    firmas: 'JNA · HNA',
  },
  {
    id: 'referenciales',
    label: 'Valores referenciales',
    filasDelCorpus: 54129,
    ambito: 'OBLIGACION',
    documentoFuente: 'Resolución Ministerial N.° 008-2026-EF/15',
    sha256: '239a75a03ef76550018e844c990f4c1bb1a35390cab1b0163e05bd1a0121098a',
    firmas: 'JNA · HNA',
  },
];

/** Una edicion del conjunto de parametros, tal como el artboard la dibuja. */
export interface EdicionDelConjunto {
  readonly id: number;
  readonly ejercicio: number;
  readonly version: number;
  readonly estado: 'ABIERTO' | 'SELLADO';
  /** Si es la que rige hoy ese ejercicio. */
  readonly vigente: boolean;
  /** Como el artboard la escribe: sin segundos y sin zona. Vacia si no esta sellada. */
  readonly fechaSellado: string;
  readonly usuarioSellado: string;
  /** Cuantos parametros lleva el conjunto. Cero es lo que impide sellarlo. */
  readonly parametros: number;
  readonly cuadros: number;
  readonly detalles: number;
}

/**
 * Las tres ediciones del conjunto, en el orden en que el artboard las lista.
 *
 * **La v1 de 2026 es la que el repositorio sella de verdad** —`ElEjercicio2026SeSellaTest`, 33
 * parametros y los dos cuadros de la valuacion—. La v2 y la edicion abierta de 2027 estan
 * dibujadas porque la pantalla tiene que poder ensenarlas: dos conjuntos SELLADOS del mismo
 * ejercicio **no son un error** —`conjunto_uq` lleva la version y `selladoVigenteDe` toma la
 * ultima—, y sin una edicion abierta no hay donde ensenar las tres escrituras.
 */
export const EDICIONES: readonly EdicionDelConjunto[] = [
  {
    id: 3,
    ejercicio: 2027,
    version: 1,
    estado: 'ABIERTO',
    vigente: false,
    fechaSellado: '',
    usuarioSellado: '',
    parametros: 0,
    cuadros: 0,
    detalles: 0,
  },
  {
    id: 2,
    ejercicio: 2026,
    version: 2,
    estado: 'SELLADO',
    vigente: true,
    fechaSellado: '2026-09-06 15:22',
    usuarioSellado: 'hneyra',
    parametros: 33,
    cuadros: 3,
    detalles: 36,
  },
  {
    id: 1,
    ejercicio: 2026,
    version: 1,
    estado: 'SELLADO',
    vigente: false,
    fechaSellado: '2026-09-06 10:00',
    usuarioSellado: 'hneyra',
    parametros: 33,
    cuadros: 2,
    detalles: 35,
  },
];

/**
 * Los cuatro `ETag` que la pantalla de Publicacion dibuja, por `conjunto-ambito`.
 *
 * **Son valores de EJEMPLO con la forma correcta —64 hexadecimales— y el artboard lo dice.** La
 * huella real la calcula el servidor sobre los bytes que emite, y por eso el cliente la
 * recalcula y la compara en vez de creersela (AC10, ADR-0025).
 *
 * Estan capturados para poder afirmar exactamente eso en una prueba: **el proxy NO los sirve**.
 * Sirve el `sha256` de los bytes que el mismo acaba de componer, que es lo que hace el backend
 * y lo unico que un cliente puede comprobar.
 */
export const ETAGS_DE_EJEMPLO: Readonly<Record<string, string>> = {
  '2-VALUACION': '3a63fce3a3660cb28b9b7aa6e16818cc3b6c08e1deeb4414b7ca2172521e325a',
  '2-OBLIGACION': 'eebbf72d0b9bdefa0a2f3a1ca226268d3ebc38d3a2e3120b236d87adddd2d96b',
  '1-VALUACION': 'a63415cf9f95e1a6d8079caecb152bee5824ace8d72460a1133da972d8c36a49',
  '1-OBLIGACION': 'cd13f3ef7c22837113295862b4d798111fe44be17fe50477c4621000b34b81b5',
};

/** La edicion vigente del ejercicio capturado: la que resuelve `GET /conjuntos?ejercicio=`. */
export function edicionVigente(): EdicionDelConjunto {
  const encontrada = EDICIONES.find(
    (e) => e.ejercicio === EJERCICIO_DE_CAPTURA && e.vigente && e.estado === 'SELLADO',
  );
  if (encontrada === undefined) {
    throw new Error(
      'La captura del artboard no tiene ninguna edicion sellada y vigente del ejercicio ' +
        String(EJERCICIO_DE_CAPTURA) +
        '. Sin ella, GET /conjuntos no tiene nada que resolver.',
    );
  }
  return encontrada;
}
