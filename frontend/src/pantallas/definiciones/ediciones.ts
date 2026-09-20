import type { ClaveDeHoja } from '../arbol.ts';
import type { Pantalla } from '../tipos.ts';

/**
 * **La pantalla de **Ediciones**: las versiones del conjunto, y su sellado** (#58, AC 2; conectada
 * en lectura por #65).
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
 * <h2>Lo que #65 anade, y por que nada de ello cambia la FORMA del artboard</h2>
 *
 * La comparacion anti-deriva mira `[titulo, nota, campos, {t, c, f, n?, i?, a?}]`: el titulo de la
 * tabla, sus columnas con su alineacion, su nota y su columna de insignia. Todo lo de abajo
 * —`clave`, `campo`, `dominio`, `paginacion`, `orden`, `vacio`, `insignia`, `accionesPorFila`,
 * `lectura`— vive **fuera** de esa forma: la pantalla dice lo mismo que el artboard y ademas dice
 * de donde salen sus filas. Por eso el artboard no se toca.
 *
 *   · **`clave`** — el nombre por el que la tabla y el conector se encuentran. Se escribe como
 *     literal en los dos lados y lo cruza `camino-a-la-api`: esta definicion **no importa
 *     `src/datos/`**, porque lo leen dos guardas que corren sin DOM y ese camino arrastra
 *     `src/sesion.ts`, que toca `window` al cargarse.
 *   · **`paginacion` y `orden` en SERVIDOR** (H01) — los mandos no ordenan ni piden: escriben en la
 *     ruta, y el conector lee la ruta. `hayMas` y `paginas` son NOMBRES de datos que pone el
 *     conector con lo que el servidor dijo.
 *   · **`campo` y `dominio`** (H23) — el nombre del campo del contrato bajo el rotulo. Es ademas lo
 *     que ata una columna a `orden`: la que lleva el campo que se esta ordenando anuncia
 *     `aria-sort`, sin una segunda lista que se quede vieja.
 *   · **`insignia`** (H18) — el tono como DATO y no deducido del texto de la celda.
 *   · **`accionesPorFila`** (H03, H46) — elegir una fila abre su detalle.
 *
 * <h2>Lo que esta hoja sigue SIN dibujar, dicho aqui y no descubierto luego</h2>
 *
 *   · **El filtro en el cliente con su conteo** (H02). Los dos campos del primer bloque —«Buscar en
 *     las ediciones» y «Estado»— se dibujan porque el artboard los dibuja, y **no filtran nada**:
 *     lo tecleado en un campo vive en el estado de `<Pantalla>` y ni el conector ni la ruta lo ven.
 *     Y **no se filtra en el servidor en su lugar**: `GET /seguridad/parametros` no declara
 *     `?estado=`, asi que mandarlo seria un 422 «Parametro desconocido» (#48). Lo debe
 *     `kamayuk-lib`#86.
 *   · **Las insignias fijas de la cabecera** (H42) y **el texto con marcas** (H43), tambien de
 *     `kamayuk-lib`#86.
 *   · **Los pasos en pestanas** (H04a) y **los tres actos con su observacion** (H04b, H05a): aqui
 *     —abrir, agregar y sellar— siguen siendo **tres bloques de campos**, que es lo que el artboard
 *     dibuja. Que se puedan pulsar es #68, y las tres escrituras son #59.
 *   · **La marca «rige»** (H19): la decide `GET /seguridad/parametros/ejercicios/{e}`, una lectura
 *     **por ejercicio**, y una pagina de este listado trae tantos ejercicios como filas. Pedir uno
 *     por fila son N peticiones por pagina; deducirla de la pagina dice que rige el sellado mas
 *     alto **de esta pagina**, que con dos versiones partidas en dos paginas es falso. Se declara y
 *     no se inventa.
 */
export const EDICIONES = {
  'nor-ediciones': {
    instruccion:
      'abra una versión, agregue los parámetros por su llave y séllela. Ninguna de las tres operaciones se guarda sin observación.',
    bloques: [
      {
        titulo: 'Versiones del conjunto, y su sellado',
        nota: '',
        // La lectura de ESTE bloque, y solo de este: un 403 aquí deja el detalle intacto, y al
        // revés (AC 4). Por eso no se declara `fallosDe`: el fallo de una no se dice encima de la
        // otra, porque las dos tienen su propio sitio donde decirlo.
        lectura: { clave: 'ediciones' },
        campos: [
          { etiqueta: 'Buscar en las ediciones', tipo: '', ayuda: 'Año, «v2» o identificador' },
          { etiqueta: 'Estado', tipo: 's', opciones: ['Todas', 'Abiertas', 'Selladas'] },
        ],
        tabla: {
          titulo: 'Ediciones',
          clave: 'ediciones',
          columnas: [
            { rotulo: 'Ejercicio', campo: 'ejercicio', alineadoDerecha: true },
            { rotulo: 'Versión', campo: 'version', alineadoDerecha: true },
            {
              rotulo: 'Estado',
              campo: 'estado',
              dominio: 'ABIERTO · SELLADO',
              alineadoDerecha: false,
              // El tono es DATO y no se deduce del texto (H18). Son los mismos dos colores que la
              // tabla del artboard pinta —`ABIERTO` en atención, lo sellado en ok—, con la
              // diferencia de que ahora lo dice la definición y no una tabla de cadenas: el día
              // que el backend añada un tercer estado, sale en `info` y no en verde.
              insignia: {
                casos: { ABIERTO: { tono: 'atencion' }, SELLADO: { tono: 'ok' } },
                otro: { tono: 'info' },
              },
            },
            { rotulo: 'Fecha de sellado', campo: 'fechaSellado', alineadoDerecha: false },
            { rotulo: 'Usuario que selló', campo: 'usuarioSellado', alineadoDerecha: false },
            { rotulo: 'Identificador', campo: 'id', alineadoDerecha: true },
          ],
          columnaDeInsignia: 2,
          // La página y el tamaño viven en la RUTA, con el nombre del parámetro del contrato. El
          // tope de 500 es `Paginacion.TAMANO_MAXIMO`, y que ninguno de los ofrecidos lo pase lo
          // cruza la guarda contra `tamanoMaximo` del contrato.
          paginacion: {
            en: 'servidor',
            enLaRuta: 'pagina',
            tamano: 20,
            tamanos: [20, 50, 100, 500],
            tamanoEnLaRuta: 'tamano',
            hayMas: 'ediciones.hayMas',
            paginas: 'ediciones.paginas',
          },
          // Los CUATRO de la lista blanca del backend —`OrdenSeguro.sobre("ejercicio", "version",
          // "estado", "id")`, publicada como `ordenarPorAdmitidos`— y ni uno más: otro campo es un
          // 422 `ORDEN_NO_ADMITIDO`, que la escalera de hoy no distingue del otro 422. El primero
          // es `ejercicio` porque es el orden por omisión del controlador
          // (`ParametrosController:45`, `aPaginacion("ejercicio")`).
          orden: {
            campos: [
              { valor: 'ejercicio', rotulo: 'Ejercicio' },
              { valor: 'version', rotulo: 'Versión' },
              { valor: 'estado', rotulo: 'Estado' },
              { valor: 'id', rotulo: 'Identificador' },
            ],
            enLaRuta: 'ordenarPor',
            sentidoEnLaRuta: 'direccion',
            ascendente: 'ASCENDENTE',
            descendente: 'DESCENDENTE',
          },
          vacio: 'Esta municipalidad no tiene ninguna edición del conjunto de parámetros. Hasta que se abra la primera no hay nada que sellar, y sin conjunto sellado no se puede calcular ningún ejercicio.',
          accionesPorFila: {
            columna: 'Contenido',
            acciones: [
              {
                clave: 'abrir',
                rotulo: 'Ver sus parámetros',
                // A ESTA misma hoja, con el conjunto en el camino: `#/ediciones/12`. Y con la
                // ventana puesta, que no es adorno: `ir` del marco escribe la dirección entera, así
                // que sin los cuatro parámetros elegir una fila de la página 3 devolvería la lista
                // a la 0. Los cuatro los publica el conector con lo que PIDIÓ, no con lo que la
                // ruta traía: así también están cuando la ruta está vacía.
                va: {
                  hoja: 'nor-ediciones',
                  sujeto: { desde: 'id' },
                  parametros: {
                    pagina: { desde: 'ediciones.pagina' },
                    tamano: { desde: 'ediciones.tamano' },
                    ordenarPor: { desde: 'ediciones.ordenarPor' },
                    direccion: { desde: 'ediciones.direccion' },
                  },
                },
              },
            ],
            sinAcciones: 'Sin acciones',
          },
        },
      },
      {
        titulo: 'Parámetros del conjunto',
        nota: 'Lo que este conjunto contiene, tal como se compuso. Lleva la vigencia de cada fila y no el valor ya resuelto: un conjunto sellado guarda a propósito el histórico de una llave —la UIT aparece cinco veces— y quien resuelve cuál rige es el lector, contra el ejercicio del conjunto.',
        // La segunda lectura, y su espera: sin conjunto elegido no se pide nada, y lo que se dice
        // no es un fallo ni un vacío — es que todavía no hay a qué preguntar.
        lectura: {
          clave: 'contenido',
          espera:
            'Elija una edición de la lista de arriba y aquí saldrá lo que ese conjunto lleva dentro. Se lee igual abierto que sellado, por la misma ruta.',
        },
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
          clave: 'contenido',
          columnas: [
            { rotulo: 'Tipo', campo: 'tipo', alineadoDerecha: false },
            { rotulo: 'Clave', campo: 'clave', alineadoDerecha: false },
            { rotulo: 'Valor numérico', campo: 'valorNumerico', alineadoDerecha: true },
            { rotulo: 'Valor de texto', campo: 'valorTexto', alineadoDerecha: false },
            { rotulo: 'Vigente desde', campo: 'vigenciaDesde', alineadoDerecha: false },
            { rotulo: 'Vigente hasta', campo: 'vigenciaHasta', alineadoDerecha: false },
            { rotulo: 'Documento fuente', campo: 'documentoFuente', alineadoDerecha: false },
          ],
          // La última frase cambió en #65, y el cambio entró primero EN EL ARTBOARD: hasta #56 este
          // detalle sólo se podía leer del snapshot —que se niega a servir un conjunto abierto, que
          // es justo el que se está componiendo— y ahora se lee de `GET /conjuntos/{id}/parametros`,
          // que sirve los dos estados y no viene firmada. Dejar la frase vieja habría dicho en
          // pantalla que se comprueba una huella que aquí no se comprueba.
          nota: 'La clave va vacía cuando el tipo tiene un solo valor —la UIT no lleva clave; TRAMO_PREDIAL lleva tres— y «Vigente hasta» vacío no es un olvido: es una norma sin fecha de fin. Donde no hay dato va —, no una celda en blanco. Las filas son el contenido del conjunto y se leen por la misma ruta esté abierto o sellado.',
          vacio: 'Este conjunto no tiene ni un parámetro. Es una respuesta y no un fallo: un conjunto recién abierto está vacío hasta que se le agrega el primero, y sellarlo así sellaría un ejercicio sin una sola cifra.',
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
