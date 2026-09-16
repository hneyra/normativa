import type { ClaveDeHoja } from '../arbol.ts';
import type { Pantalla } from '../tipos.ts';

/**
 * **La pantalla de **Ediciones**: las versiones del conjunto, y su sellado** (#58, AC 2).
 *
 * Transcrita de `const PANTALLAS['nor-ediciones']` y de `const INSTRUCCIONES['nor-ediciones']` de
 * `frontend/diseno/NormativaV8.dc.html`, con las cadenas literales. La compara con el artboard
 * —bloque a bloque, campo a campo y tipo a tipo— `verificaciones/pantallas-del-artboard.test.ts`.
 *
 * <h2>Un archivo por hoja, y no es estetica</h2>
 *
 * Es lo que deja a #65, #66 y #67 trabajar en paralelo sobre estas mismas cuatro pantallas sin
 * pisarse: cada uno abre la suya.
 *
 * <h2>Sin cifras y sin datos</h2>
 *
 * Ni el valor de un campo de solo lectura, ni las filas de una tabla, ni su conteo: son ejemplo y
 * viven **solo** en el artboard, que no esta bajo `src/` y no lo importa una linea de produccion
 * (`rentas`#97). Lo que se conserva es la FORMA. Lo vigila `verificaciones/sin-cifras-inventadas`.
 *
 * Y **nada se rellena**: esta hoja todavia no tiene conector —su `src/datos/<hoja>.ts` esta puesto y
 * vacio, y lo llena su issue de la ola 5—, asi que cada campo y cada tabla dicen su ausencia con el
 * motivo que redacta `src/porQueNoHayDato.ts`: «publicado y sin pedir», que no es lo mismo que
 * «sin conectar».
 *
 * <h2>Lo que esta hoja NO dibuja todavia, dicho aqui y no descubierto luego</h2>
 *
 * Es la hoja con mas huecos de las cuatro: la paginacion y el orden en el servidor (H01), el filtro
 * en el cliente con su conteo (H02), la seleccion de fila con su ficha (H03), los pasos en pestanas
 * (H04a) y los tres actos con su observacion (H04b, H05a) no caben en `{{ titulo, nota, campos,
 * tabla }}`. Aqui los tres actos —abrir, agregar y sellar— son **tres bloques de campos**, que es
 * lo que el artboard dibuja y lo que el interprete de hoy sabe leer; que se puedan pulsar es #68.
 * La ayuda de la observacion viaja como `ayuda` del campo, y que de ahi se deduzca «opcional» es
 * H05b, todavia sin publicar (`kamayuk-lib`#86).
 */
export const EDICIONES = {
  'nor-ediciones': {
    instruccion:
      'abra una versión, agregue los parámetros por su llave y séllela. Ninguna de las tres operaciones se guarda sin observación.',
    bloques: [
      {
        titulo: 'Versiones del conjunto, y su sellado',
        nota: '',
        campos: [
          { etiqueta: 'Buscar en las ediciones', tipo: '', ayuda: 'Año, «v2» o identificador' },
          { etiqueta: 'Estado', tipo: 's', opciones: ['Todas', 'Abiertas', 'Selladas'] },
        ],
        tabla: {
          titulo: 'Ediciones',
          columnas: [
            { rotulo: 'Ejercicio', alineadoDerecha: true },
            { rotulo: 'Versión', alineadoDerecha: true },
            { rotulo: 'Estado', alineadoDerecha: false },
            { rotulo: 'Fecha de sellado', alineadoDerecha: false },
            { rotulo: 'Usuario que selló', alineadoDerecha: false },
            { rotulo: 'Identificador', alineadoDerecha: true },
          ],
          columnaDeInsignia: 2,
        },
      },
      {
        titulo: 'Parámetros del conjunto',
        nota: 'Lo que este conjunto contiene, tal como se compuso. Lleva la vigencia de cada fila y no el valor ya resuelto: un conjunto sellado guarda a propósito el histórico de una llave —la UIT aparece cinco veces— y quien resuelve cuál rige es el lector, contra el ejercicio del conjunto.',
        campos: [
          { etiqueta: 'Identificador', tipo: 'r' },
          { etiqueta: 'Ejercicio', tipo: 'r' },
          { etiqueta: 'Versión', tipo: 'r' },
          { etiqueta: 'Estado', tipo: 'r' },
          { etiqueta: 'Fecha de sellado', tipo: 'r' },
          { etiqueta: 'Usuario que selló', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Parámetros',
          columnas: [
            { rotulo: 'Tipo', alineadoDerecha: false },
            { rotulo: 'Clave', alineadoDerecha: false },
            { rotulo: 'Valor numérico', alineadoDerecha: true },
            { rotulo: 'Valor de texto', alineadoDerecha: false },
            { rotulo: 'Vigente desde', alineadoDerecha: false },
            { rotulo: 'Vigente hasta', alineadoDerecha: false },
            { rotulo: 'Documento fuente', alineadoDerecha: false },
          ],
          nota: 'La clave va vacía cuando el tipo tiene un solo valor —la UIT no lleva clave; TRAMO_PREDIAL lleva tres— y «Vigente hasta» vacío no es un olvido: es una norma sin fecha de fin. Donde no hay dato va —, no una celda en blanco. Las filas llegan del snapshot del conjunto, y su huella se comprueba antes de usarlas.',
        },
      },
      {
        titulo: 'Abrir versión',
        nota: 'Una versión nueva del ejercicio, para componerla desde cero o para corregir lo que un conjunto ya sellado no admite. La versión NO se recibe: se calcula. Quien corrige un conjunto sellado no tiene por qué saber cuántas versiones hubo antes, y dejárselo elegir es la forma de acabar con dos versiones 2.',
        campos: [
          { etiqueta: 'Ejercicio', tipo: 's', opciones: ['', '2026', '2027', '2028'] },
          { etiqueta: 'Versión que se asignará', tipo: 'r' },
          {
            etiqueta: 'Observación',
            tipo: 'a1',
            ayuda: 'Sin observación no se guarda (regla 10). Al menos 5 caracteres, y como mucho 500: es lo que admite la columna.',
          },
        ],
      },
      {
        titulo: 'Agregar parámetro',
        nota: 'Incorpora al conjunto un parámetro YA PUBLICADO, nombrándolo por lo que es y no por el identificador que le tocó en la base. El mismo valor tiene identificadores distintos en «stg» y en «prod», así que un archivo escrito con números entra en el ambiente equivocado sin fallar: sella un juego de parámetros que no es el que dice.',
        campos: [
          { etiqueta: 'Conjunto', tipo: 'r' },
          {
            etiqueta: 'Tipo',
            tipo: 's',
            opciones: ['', 'UIT', 'TRAMO_PREDIAL', 'TRAMO_PREDIAL_LIMITE', 'DEDUCCION_PENSIONISTA', 'DEDUCCION_ADULTO_MAYOR', 'PREDIAL_MINIMO', 'PLAZO', 'ALCABALA_ALICUOTA', 'ALCABALA_TRAMO_INAFECTO_UIT', 'ESPECTACULO_ALICUOTA', 'FACTOR_OFICIALIZACION', 'PORCENTAJE_DE_ACTUALIZACION'],
          },
          {
            etiqueta: 'Clave',
            tipo: '',
            ayuda: 'La UIT no lleva clave. TRAMO_PREDIAL lleva 1, 2 o 3.',
          },
          {
            etiqueta: 'Vigente desde',
            tipo: 'd',
            ayuda: 'Forma parte de la llave: la UIT de 2026 y la de 2027 comparten tipo y clave, y son filas distintas. Sin la fecha habría que elegir una, y elegirla en silencio es el modo de falla que ARQ-09 §3 describe.',
          },
          {
            etiqueta: 'Observación',
            tipo: 'a1',
            ayuda: 'Sin observación no se guarda (regla 10). Al menos 5 caracteres, y como mucho 500: es lo que admite la columna.',
          },
        ],
      },
      {
        titulo: 'Sellar',
        nota: 'A partir de aquí rige, y no se modifica: ni el conjunto ni su contenido. Lo impide un disparador de la base, no una validación de la aplicación. Es el acto administrativo del que cuelga la reproducibilidad de todo lo que se emita con él, y por eso queda con fecha y con nombre.',
        campos: [
          { etiqueta: 'Conjunto', tipo: 'r' },
          { etiqueta: 'Lo que se congela', tipo: 'r' },
          {
            etiqueta: 'Observación',
            tipo: 'a1',
            ayuda: 'Sin observación no se guarda (regla 10). Al menos 5 caracteres, y como mucho 500: es lo que admite la columna.',
          },
        ],
      },
    ],
  },
} satisfies Partial<Record<ClaveDeHoja, Pantalla>>;
