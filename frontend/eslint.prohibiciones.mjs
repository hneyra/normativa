/**
 * Las prohibiciones del frontend de `normativa`, como DATO.
 *
 * No estan escritas dentro de `eslint.config.js` a proposito. Este archivo lo leen dos
 * consumidores y tienen que leer lo mismo:
 *
 *   1. `eslint.config.js`, que las convierte en opciones de `no-restricted-syntax`, y
 *   2. `verificaciones/reglas-de-eslint.test.ts`, que exige de cada una su muestra.
 *
 * Si la prueba tuviera su propia lista, seria una copia: se anade una regla al config, la
 * lista de la prueba no se toca, y la regla nueva queda sin muestra **en verde**. Que es
 * exactamente el modo de fallo que la prueba existe para impedir. Derivadas de aqui las
 * dos, una prohibicion sin muestra sale roja sola.
 *
 * El `clave` no es decorativo: **es el nombre de su muestra**. La prueba no tiene un mapa
 * de «regla -> archivo» que alguien pueda dejar desactualizado; compone la ruta.
 */

/**
 * @typedef {object} Prohibicion
 * @property {string} clave     Identificador estable. Tambien el nombre del archivo de su
 *                              muestra en `verificaciones/muestras/`, sin extension.
 * @property {string} regla     La fila de la tabla de reglas del producto a la que sirve.
 *                              Varias prohibiciones pueden servir a la misma regla.
 * @property {string} selector  Selector ESQuery que la detecta. Admite varios separados
 *                              por coma, que es como una regla se hace de varias formas.
 * @property {string} message   Lo que se le dice a quien la incumple. La prueba compara
 *                              contra ESTE texto, no contra una copia suya.
 * @property {string} [salvo]   Prefijo de ruta donde la prohibicion NO aplica. Una sola,
 *                              porque una excepcion que se puede repetir deja de serlo.
 */

/**
 * Nombres de campo que llevan una cifra decimal del dominio. Sobre ellos no se hace
 * aritmetica ni se declara un `number`.
 *
 * La lista es la de `rentas` **adaptada a lo que este sistema publica**: aqui no hay
 * saldos ni vueltos —no se cobra nada— y si hay UIT, alicuotas, aranceles y los valores
 * de los tres cuadros de valuacion. Todas son `NUMERIC` en la base y `BigDecimal` en el
 * backend, y el ultimo tramo tiene que respetarlas igual (regla 1, RNF-055).
 *
 * **`total` lleva una excepcion, y es de verdad la unica.** `totalElementos` y
 * `totalPaginas` son los dos contadores del envoltorio de paginacion del backend, y son
 * cuentas de cosas, no cifras del dominio: llegan como entero y tienen que declararse
 * `number`. Sin la excepcion, toda pantalla con una tabla paginada arrancaria con dos
 * `eslint-disable`, y una regla que se desactiva por costumbre deja de proteger a la
 * tercera vez.
 *
 * Y `valor` no entra a secas sino con su apellido —`valorUnitario`, `valorArancelario`,
 * `valorReferencial`—: los tres cuadros de ADR-0017 se llaman asi, mientras que `valor` a
 * secas es el nombre generico de cualquier campo de un formulario.
 */
const CAMPOS_DE_CIFRA =
  'monto|importe|uit|alicuota|arancel|valorUnitario|valorArancelario|valorReferencial|insoluto|interes|deduccion|depreciacion|total(?!Elementos|Paginas)';

/**
 * Tildes y enie: prohibidas en identificadores (idioma del repositorio).
 * Copiada de `infrastructure/infra/eslint.config.mjs`, donde ya estaba escrita: la misma
 * regla en dos sitios distintos es dos reglas que divergen.
 */
const LETRAS_ACENTUADAS = 'áéíóúÁÉÍÓÚñÑüÜ';

/**
 * El unico directorio que puede llamar a `fetch`.
 *
 * Es la excepcion que da sentido a la regla: mientras toda peticion pase por `solicitar()`,
 * enchufar el token, el `ETag` del snapshot y el formato de error se hace en un sitio. Un
 * `fetch` suelto en una pantalla no se salta una convencion: se salta las tres.
 */
export const CLIENTE_DE_API = 'src/api/';

/**
 * Los nombres que en ESTE sistema nombran una cifra que fija una norma.
 *
 * No es la misma lista que `CAMPOS_DE_CIFRA` aunque se solapen, y la diferencia importa:
 * alli se prohibe el TIPO —un importe es texto—, aqui se prohibe el LITERAL —la cifra no
 * se escribe, se pide—. `monto` esta en la primera y no en la segunda porque un monto lo
 * calcula alguien; `uit` esta en las dos porque la UIT es texto decimal *y* la fija un
 * decreto supremo.
 *
 * **Ni `tim` ni `tope` estan, y se probo por que**: con coincidencia por prefijo, `tim`
 * caza `timeout` y `timer`, y `tope` caza cualquier limite de la interfaz. Una prohibicion
 * que senala codigo correcto se desactiva, y una regla desactivada no protege nada.
 */
const CIFRAS_NORMATIVAS =
  'uit|alicuota|tramo|arancel|valorUnitario|valorArancelario|valorReferencial|depreciacion|deduccion|minimoImponible|factorDeActualizacion|porcentajeDeActualizacion';

/**
 * Un literal que es una cifra, la escriba quien la escriba como numero o como texto.
 *
 * Las dos formas, y hacen falta las dos: en esta interfaz **un importe es `string`**
 * (regla 1), asi que quien clave la alicuota predial no escribira `0.006` sino
 * `'0.006'` — y una prohibicion que solo mirase los numeros dejaria pasar precisamente
 * la forma que las otras reglas de este mismo archivo obligan a usar.
 */
const LITERAL_DE_CIFRA =
  ':matches(Literal[value=type(number)], Literal[value=/^-?[0-9]+([.][0-9]+)?$/])';

/** Los sitios donde un literal queda ATADO a un nombre, que es lo que lo hace una cifra. */
const ATADURAS_DE_CIFRA = [
  `VariableDeclarator[id.name=/^(${CIFRAS_NORMATIVAS})/i]`,
  `Property[key.name=/^(${CIFRAS_NORMATIVAS})/i]`,
  `PropertyDefinition[key.name=/^(${CIFRAS_NORMATIVAS})/i]`,
  `AssignmentPattern[left.name=/^(${CIFRAS_NORMATIVAS})/i]`,
];

/** @type {readonly Prohibicion[]} */
export const PROHIBICIONES = [
  {
    clave: 'identificador-con-tilde',
    regla: 'sin tildes ni enie en identificadores',
    selector: `Identifier[name=/[${LETRAS_ACENTUADAS}]/]`,
    message: 'Sin tildes ni enie en identificadores. El texto con tildes va en las cadenas.',
  },
  {
    clave: 'fetch-fuera-del-cliente',
    regla: 'fetch prohibido fuera del cliente de API',
    selector: "CallExpression[callee.name='fetch']",
    message:
      'Las peticiones pasan por «solicitar» de src/api: ahi viven el token, el ETag del snapshot y el formato de error (ADR-0030 §3).',
    salvo: CLIENTE_DE_API,
  },
  {
    clave: 'importe-declarado-number',
    regla: 'un importe es string, nunca number',
    selector:
      `TSPropertySignature[key.name=/^(${CAMPOS_DE_CIFRA})/i] > TSTypeAnnotation > TSNumberKeyword, ` +
      `Identifier[name=/^(${CAMPOS_DE_CIFRA})/i] > TSTypeAnnotation > TSNumberKeyword`,
    message:
      'Un importe se declara «string», nunca «number»: en coma flotante 0.1 + 0.2 no es 0.30 y el centimo se pierde antes de mostrarse (regla 1, RNF-055).',
  },
  {
    clave: 'importe-convertido-a-number',
    regla: 'un importe es string, nunca number',
    selector:
      `CallExpression[callee.name=/^(Number|parseFloat|parseInt)$/] > MemberExpression[property.name=/^(${CAMPOS_DE_CIFRA})/i], ` +
      `CallExpression[callee.name=/^(Number|parseFloat|parseInt)$/] > Identifier[name=/^(${CAMPOS_DE_CIFRA})/i]`,
    message:
      'Un importe es texto y pierde centimos como number. No lo conviertas: formatealo (regla 1, RNF-055).',
  },
  {
    clave: 'aritmetica-con-importes',
    regla: 'sin aritmetica sobre importes',
    selector:
      `BinaryExpression[operator=/^[-+*/%]$/] > MemberExpression[property.name=/^(${CAMPOS_DE_CIFRA})/i], ` +
      `CallExpression[callee.property.name='reduce'][callee.object.property.name=/^(${CAMPOS_DE_CIFRA}|tramos|conceptos|valores|parametros)/i]`,
    message:
      'Aritmetica con una cifra del dominio. Este sistema PUBLICA cifras selladas y no las opera: quien calcula es el motor de reglas, con su redondeo sellado (regla 1, ADR-0018).',
  },
  {
    clave: 'importe-sin-fecha',
    regla: 'un importe se muestra con su fecha de calculo',
    // `:not(:has(...))`: el elemento de apertura que NO tiene entre sus atributos
    // uno llamado `fechaCalculo`. Un `<Importe {...props} />` tambien cae, y esta
    // bien que caiga: desde el JSX no hay forma de saber si ese objeto la trae.
    selector:
      "JSXOpeningElement[name.name='Importe']:not(:has(JSXAttribute[name.name='fechaCalculo']))",
    message:
      'Un importe se muestra con la fecha a la que esta calculado: no existe «la deuda», existe la deuda a una fecha (regla 9, RNF-075).',
  },
  {
    clave: 'municipalidad-en-el-cliente',
    regla: 'municipalidadId no se manda nunca',
    selector: "Identifier[name='municipalidadId']",
    message:
      'El frontend jamas envia municipalidadId: el backend lo toma del token (regla 2, ADR-0028 §2).',
  },
  {
    clave: 'token-en-almacenamiento',
    regla: 'el token no toca localStorage ni sessionStorage',
    // La prohibicion es guardar CREDENCIALES en el navegador, no usar el almacenamiento:
    // una preferencia de la ventanilla ahi esta en su sitio. Por eso mira la clave.
    selector:
      'CallExpression[callee.object.name=/^(localStorage|sessionStorage)$/][callee.property.name=/^(setItem|getItem|removeItem)$/][arguments.0.value=/token|jwt|bearer|credencial|contrasena|acceso|sesion/i]',
    message:
      'El token vive en memoria, nunca en localStorage ni sessionStorage: en una PC de ventanilla compartida entre turnos, un token persistido sobrevive al cierre del navegador (ADR-0030 §3).',
  },
  {
    clave: 'tasa-en-vez-de-alicuota',
    regla: 'alicuota, nunca tasa',
    selector: 'Identifier[name=/^tasa(De)?(Interes|Descuento|Porcentaje|Depreciacion|Moratori)/i]',
    message: 'Un porcentaje se llama «alicuota» (regla 8). «tasa» es un tipo de tributo del manual.',
  },
  {
    // LA NOVENA, Y ES DE ESTE REPOSITORIO. No esta en `rentas`, ni en `caja`, ni en
    // `catastro`, y aqui muerde mas que en ninguno de los tres: `normativa` es el sistema
    // cuyo trabajo entero es que las cifras vivan en datos versionados y firmados a dos
    // manos. Un `0.006` escrito en una pantalla de ESTE sistema es una cifra normativa
    // fuera del corpus, publicada por el repositorio que existe para que no las haya, y
    // sin las dos firmas de ADR-0007 que toda cifra del corpus lleva.
    clave: 'cifra-tributaria-literal',
    regla: 'ninguna cifra tributaria literal en el codigo',
    selector: ATADURAS_DE_CIFRA.map((atadura) => `${atadura} > ${LITERAL_DE_CIFRA}`).join(', '),
    message:
      'Ninguna cifra tributaria literal en el codigo: la UIT, los tramos, las alicuotas, los valores unitarios y los aranceles viven en el conjunto sellado del ejercicio y se PIDEN (regla 5, RNF-053). Escribirla aqui la publica sin las dos firmas de ADR-0007.',
  },
];

/**
 * Las reglas del producto que el frontend expresa como verificacion, tal como las nombra
 * el issue F-1. La prueba exige que cada una tenga al menos una prohibicion que la sirva.
 *
 * ES LA LISTA ESCRITA A MANO, y es deliberado que sea la unica. `PROHIBICIONES` se deriva
 * hacia la prueba, asi que **borrar una prohibicion borraria tambien su prueba**, en
 * silencio. Esta lista es lo que se pone rojo cuando eso pasa.
 *
 * @type {readonly string[]}
 */
export const REGLAS_EXIGIDAS = [
  'sin tildes ni enie en identificadores',
  'fetch prohibido fuera del cliente de API',
  'un importe es string, nunca number',
  'un importe se muestra con su fecha de calculo',
  'sin aritmetica sobre importes',
  'municipalidadId no se manda nunca',
  'el token no toca localStorage ni sessionStorage',
  'alicuota, nunca tasa',
  'ninguna cifra tributaria literal en el codigo',
];
