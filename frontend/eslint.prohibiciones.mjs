/**
 * Las prohibiciones del frontend de `normativa`: **las del producto, encendidas como las quiere
 * este sistema** (#62).
 *
 * <h2>Aqui habia un fork, y estaba medido</h2>
 *
 * Las nueve del producto viven en `@kamayuk/verificaciones/prohibiciones` desde `kamayuk-lib`#4, y
 * `rentas` las deriva desde `rentas`#137. Aqui seguian siendo una COPIA hasta este issue, y **no
 * una copia identica**: comparando los dos modulos clave a clave —`c01fe9a:frontend/eslint.
 * prohibiciones.mjs` contra `kamayuk-lib@c61068f:paquetes/verificaciones/prohibiciones.mjs`— cinco
 * claves eran identicas, tres diferian en el `selector`, una en el `salvo` y el `message`, y la
 * decima solo existia aqui.
 *
 * Adoptar la lista de entonces habria costado nombres de cifra: `uit`, `alicuota`, `arancel` y
 * `valorUnitario` no estaban en `CAMPOS_DE_DINERO`, que era el vocabulario de una ventanilla que
 * cobra. Por eso este archivo espero a `kamayuk-lib`#58, que hizo de las dos listas **una union**
 * —nada de lo que vigilaba la V6 se ha perdido; lo mide
 * `las-prohibiciones-son-las-de-la-libreria.test.ts`— y saco `cifra-tributaria-literal` a
 * `PROHIBICIONES_OPCIONALES`, que es la lista que enciende el sistema que quiera.
 *
 * <h2>Que pone este archivo de su parte, y es todo lo que pone</h2>
 *
 *   1. **Que la opcional se enciende.** `cifra-tributaria-literal` no se le exige a nadie y aqui
 *      se exige: `normativa` es el sistema cuyo trabajo entero es que esas cifras vivan en datos
 *      versionados, firmados a dos manos (ADR-0007) y sellados por ejercicio. La misma linea
 *      —`export const alicuotaPredial = '0.006';`— es el ejemplo de codigo CORRECTO de `rentas` y
 *      aqui es roja, y esa es exactamente la diferencia entre consumir una cifra y publicarla.
 *   2. **Donde cae la excepcion de `fetch`**, que aqui es NINGUN sitio: ver
 *      {@link DONDE_SE_LLAMA_A_FETCH}.
 *
 * Ni un `selector`, ni un `message`, ni un nombre de cifra. Los nombres tampoco son un parametro:
 * `kamayuk-lib`#58 los resolvio como **union** y no por sistema, porque dos listas en verde
 * midiendo cosas distintas es el defecto que `rentas`#137 cerro un piso mas abajo.
 *
 * <h2>Lo que este arbol PIERDE respecto de su V6, dicho y no callado: `tramos`</h2>
 *
 * El `reduce` de `aritmetica-con-importes` vigilaba aqui `tramos|conceptos|valores|parametros`
 * (`c01fe9a:…:146`) y en la libreria vigila `cuotas|conceptos|valores|papeletas|parametros`. Gana
 * `parametros` —lo metio #58 porque un conjunto sellado es una lista de parametros— y **`tramos`
 * no entra**, con su falso positivo medido: `catastro:src/pantallas/piezas/codigo-por-tramos.tsx:87`
 * escribe `ajustes.tramos.reduce((suma, t) => suma + t.digitos, 0)`, que suma los digitos de los
 * ocho tramos del codigo catastral —una longitud, no un importe—.
 *
 * **Y aqui se decide NO recuperarlo como prohibicion propia**, con tres medidas y no con una
 * opinion:
 *
 *   · **Este sistema no publica ninguna coleccion llamada `tramos`.** Las cuatro del snapshot son
 *     `parametros`, `valoresUnitarios`, `depreciaciones` y `valoresReferenciales`
 *     (`backend/kamayuk-normativa-parametros/…/dominio/SnapshotDelConjunto.java`), y las cuatro
 *     caen ya en el selector derivado, que casa por PREFIJO: `parametros` y `valores` estan en la
 *     lista de colecciones, y `depreciacion` en la de campos de dinero. Una prohibicion sobre un
 *     nombre que no existe en el arbol no tiene nada que senalar.
 *   · **La forma peligrosa de verdad ya sale roja por otro lado.** Sumar un tramo es sumar su
 *     alicuota o su insoluto —`t.alicuota`, `t.insoluto`—, y eso es una `BinaryExpression` sobre
 *     un `MemberExpression` cuyo nombre SI esta en la lista de campos, que es la primera mitad del
 *     mismo selector.
 *   · **Y clavar el tramo del predial en el codigo lo caza la opcional**, que este sistema
 *     enciende y que lleva `tramo` en sus nombres de cifra.
 *
 * Recuperarlo costaria una clave nueva, su muestra, y un tercer tipo de prohibicion —«propia»—
 * que es justo la forma del fork que este issue cierra. Si algun dia este arbol publica una
 * coleccion `tramos`, entra en `kamayuk-lib` con su medida, no aqui.
 *
 * <h2>Que sigue siendo verdad de este archivo</h2>
 *
 * Que no esta escrito dentro de `eslint.config.js` a proposito. Lo leen dos consumidores y tienen
 * que leer lo mismo:
 *
 *   1. `eslint.config.js`, que las convierte en opciones de `no-restricted-syntax`, y
 *   2. `verificaciones/reglas-de-eslint.test.ts`, que exige de cada una su muestra.
 *
 * Si la prueba tuviera su propia lista, seria una copia: se anade una regla al config, la lista de
 * la prueba no se toca, y la regla nueva queda sin muestra **en verde**. Derivadas de aqui las
 * dos, una prohibicion sin muestra sale roja sola.
 *
 * El `clave` no es decorativo: **es el nombre de su muestra**. La prueba no tiene un mapa de
 * «regla -> archivo» que alguien pueda dejar desactualizado; compone la ruta.
 *
 * Y que esta derivacion siga siendo una derivacion —y no vuelva a ser un fork— lo vigila
 * `verificaciones/las-prohibiciones-son-las-de-la-libreria.test.ts`.
 */

import { remedioDelEnlace } from './verificaciones/remedio.mjs';

/**
 * La lista del producto, o un rojo que nombra el `git clone`.
 *
 * **El `import` va dinamico y envuelto, y es el hallazgo de `rentas`#113 otra vez.** Este archivo
 * lo carga `eslint.config.js`, o sea el PRIMER paso de `yarn verificar`, antes que `tsc` y antes
 * que `enlace-con-kamayuk-lib.test.ts` —que es la guarda que sabe explicar que falta el clon
 * hermano y que vive dos pasos mas tarde—. Con un `import` estatico, lo que se lee al clonar
 * `normativa` a secas es
 *
 *     Error: Cannot find package '@kamayuk/verificaciones' imported from …/eslint.prohibiciones.mjs
 *
 * que habla de un modulo y no de un repositorio que falta. Envuelto, dice el `git clone`.
 */
async function delProducto() {
  const declarada = '../../kamayuk-lib/paquetes/verificaciones';
  try {
    return await import('@kamayuk/verificaciones/prohibiciones');
  } catch (causa) {
    throw new Error(
      'No se pudo cargar «@kamayuk/verificaciones/prohibiciones», de donde salen las nueve\n' +
        'prohibiciones de ESLint de todo el producto y la opcional que enciende este sistema\n' +
        `(kamayuk-lib#4, kamayuk-lib#58, normativa#62).\n  ${remedioDelEnlace('@kamayuk/verificaciones', declarada)}`,
      { cause: causa },
    );
  }
}

const {
  PROHIBICIONES: DEL_PRODUCTO,
  PROHIBICIONES_OPCIONALES: OPCIONALES_DEL_PRODUCTO,
  REGLAS_EXIGIDAS: EXIGIDAS,
  REGLAS_OPCIONALES: OPCIONALES,
} = await delProducto();

/**
 * **Donde `fetch` es legitimo AQUI: en ningun sitio.**
 *
 * Es la lista VACIA, y es un dato medido, no una omision. Este frontend **no tiene cliente de API
 * propio**: lo pone `@kamayuk/api`, enlazado desde el clon hermano (#55), y la excepcion la lleva
 * la libreria en su propio arbol —`paquetes/api/` y `paquetes/sesion/`—. Medido sobre `src/` en el
 * dia de #62: **cero llamadas a `fetch`**, y `src/api/` ni existe como directorio. #57 lo deja asi
 * por contrato —toda peticion pasa por `solicitar()` de `@kamayuk/api`—, y
 * `las-prohibiciones-son-las-de-la-libreria.test.ts` vuelve a medirlo en cada corrida.
 *
 * El dia que aparezca un `fetch` en `src/`, sale rojo por los dos lados: la guarda que lo mide, y
 * `yarn lint`, que ya no exceptua ningun directorio. La lista vacia es ademas la salida que el
 * propio mensaje de `rentas` nombra: «o la lista vacia, si aqui no hay ninguno».
 *
 * @type {readonly string[]}
 */
export const DONDE_SE_LLAMA_A_FETCH = [];

/**
 * Lo UNICO que este arbol pone de su parte: donde cae cada excepcion.
 *
 * Va por **clave de prohibicion** y no por ruta de la libreria. Traducir `paquetes/api/` a un
 * directorio de aqui seria un mapa de directorios de otro repositorio, que se queda viejo el dia
 * que alla muevan uno; la clave, en cambio, es el identificador estable de la regla y es lo que la
 * libreria promete no cambiar.
 *
 * Una prohibicion con `salvo` que no este aqui **para el proceso**: dejarla pasar tendria dos
 * salidas y las dos malas —aplicarle la ruta de otra, o quitarle la excepcion y llenar de falsos
 * positivos un directorio entero—.
 *
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const SALVO_EN_ESTE_ARBOL = {
  'fetch-fuera-del-cliente': DONDE_SE_LLAMA_A_FETCH,
};

/** Las nueve del producto y la opcional que este sistema enciende, antes de situarles las rutas. */
const TODAS_LAS_DEL_PRODUCTO = [...DEL_PRODUCTO, ...OPCIONALES_DEL_PRODUCTO];

const sinTraducir = TODAS_LAS_DEL_PRODUCTO.filter(
  (p) => p.salvo !== undefined && SALVO_EN_ESTE_ARBOL[p.clave] === undefined,
).map((p) => `  · ${p.clave}, exceptuada en la libreria de: ${[...(p.salvo ?? [])].join(', ')}`);

if (sinTraducir.length > 0) {
  throw new Error(
    '`@kamayuk/verificaciones` trae prohibiciones con excepcion que este arbol no ha situado:\n' +
      `${sinTraducir.join('\n')}\n` +
      'Anade su entrada a SALVO_EN_ESTE_ARBOL en `frontend/eslint.prohibiciones.mjs`, diciendo\n' +
      'que directorio de ESTE arbol hace lo que alli hace el suyo — o la lista vacia, si aqui no\n' +
      'hay ninguno.',
  );
}

const huerfanas = Object.keys(SALVO_EN_ESTE_ARBOL).filter(
  (clave) => !TODAS_LAS_DEL_PRODUCTO.some((p) => p.clave === clave && p.salvo !== undefined),
);

if (huerfanas.length > 0) {
  throw new Error(
    `SALVO_EN_ESTE_ARBOL situa excepciones que ya nadie pide: ${huerfanas.join(', ')}.\n` +
      'O la prohibicion dejo de exceptuar nada, o cambio de clave. Una excepcion que no cuelga de\n' +
      'ninguna regla no exceptua: solo se queda ahi pareciendo que si.',
  );
}

/**
 * **Las DIEZ que este frontend enciende**: las nueve del producto y la opcional de este sistema,
 * cada una con la ruta que le toca en este arbol.
 *
 * Que sean diez y no nueve es lo unico que distingue este lint del de `rentas`, y no es un extra:
 * es la regla 5 del producto —«ningun literal numerico tributario en el codigo»— aplicada al
 * repositorio que PUBLICA esas cifras.
 *
 * @type {readonly {
 *   clave: string;
 *   regla: string;
 *   selector: string;
 *   message: string;
 *   salvo?: readonly string[];
 * }[]}
 */
export const PROHIBICIONES = TODAS_LAS_DEL_PRODUCTO.map((prohibicion) =>
  prohibicion.salvo === undefined
    ? prohibicion
    : { ...prohibicion, salvo: SALVO_EN_ESTE_ARBOL[prohibicion.clave] },
);

/**
 * Las reglas que ESTE frontend expresa como verificacion: las ocho que el producto exige y la
 * novena que este sistema se exige a si mismo. **Nueve, y las nueve escritas alla.**
 *
 * ES LA LISTA ESCRITA A MANO —en `kamayuk-lib`, en dos trozos—, y es deliberado que sea la unica.
 * `PROHIBICIONES` se deriva hacia la prueba, asi que **borrar una prohibicion borraria tambien su
 * prueba**, en silencio. Esta lista es lo que se pone rojo cuando eso pasa.
 *
 * Los dos trozos van separados alla y eso importa: `REGLAS_EXIGIDAS` de la libreria es lo que se
 * le exige a los CINCO sistemas, y meter la opcional ahi pondria rojo a `rentas` sin tocar nada
 * suyo. Aqui, en cambio, la suma es la lista correcta: son las nueve que este frontend aplica.
 *
 * @type {readonly string[]}
 */
export const REGLAS_EXIGIDAS = [...EXIGIDAS, ...OPCIONALES];
