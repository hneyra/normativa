import type { ClaveDeHoja } from '../arbol.ts';
import type { Pantalla } from '../tipos.ts';

/**
 * **La pantalla de **Cuadros de valuacion**: los tres cuadros nacionales (ADR-0017)** (#58, AC 2).
 *
 * Transcrita de `const PANTALLAS['nor-cuadros']` y de `const INSTRUCCIONES['nor-cuadros']` de
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
 * Y **desde #66 esta hoja SI se rellena**: su conector es `src/datos/cuadros.ts`. Lo que aqui se
 * anade es lo que el artboard no puede llevar porque no es forma sino costura —la `lectura` de cada
 * bloque, la `clave` de cada tabla, el `campo` y el `dominio` de cada columna (H23), la paginacion
 * de cliente (H21) y el `vacio` de cada tabla—, y nada de eso lo mira
 * `verificaciones/pantallas-del-artboard.test.ts`: compara titulo, nota, campos y tabla, que es la
 * FORMA.
 *
 * <h2>Las claves van como LITERALES, y es la forma que usan el Panel y Publicacion</h2>
 *
 * `lectura.clave`, `tabla.clave`, el sitio de la pagina y el dominio de cada columna se escriben
 * aqui a mano y **no se importan de `src/datos/`**. Importarlos arrastraria `src/api/cliente.ts` ->
 * `src/sesion.ts`, que lee `window.location.origin` al cargarse, y las guardas que leen estas
 * definiciones corren sin DOM: el rojo seria «ReferenceError: window is not defined» durante la
 * recoleccion, que se lleva la suite entera y no habla de la pantalla. Que los dos lados sigan
 * escribiendo lo mismo lo comprueba `verificaciones/camino-a-la-api.test.ts` — una clave mal
 * escrita no da error: da una tabla sin filas y un aviso de «lectura sin estado».
 *
 * <h2>La paginacion es de CLIENTE, y no es una eleccion de comodidad</h2>
 *
 * `GET /conjuntos/{id}/snapshot` **no pagina**: sirve el conjunto entero, y el anexo vehicular de un
 * ejercicio son decenas de miles de filas. La de servidor no cabe —esa operacion no admite `pagina`
 * ni `tamano`, y mandarselos seria el 422 que `camino-a-la-api` persigue— y sin ninguna el
 * interprete monta todas las filas en el DOM, que es lo que hacia la V6
 * (`c01fe9a:frontend/src/secciones/Tabla.tsx:140`) contra un proxy de datos simulados donde nunca se
 * noto. Cada tabla lleva **su propio** sitio de pagina: con uno solo, pasar de pagina en un cuadro
 * moveria la del de al lado, que nadie toco.
 *
 * <h2>Lo que esta hoja NO dibuja todavia, dicho aqui y no descubierto luego</h2>
 *
 * · El selector de ambito gobierna una lectura y **no deberia hacer la hoja editable** (H14a, N11):
 *   hoy `src/catalogo.ts` calcula `seEscribe` del tipo de sus campos, asi que esta hoja sale con
 *   «Limpiar» y «Guardar» al pie. Es la diferencia N11 de `diseno/HUECOS.md`, no un descuido, y lo
 *   debe `kamayuk-lib`#86 — le pasa lo mismo a Publicacion (#67). La consecuencia aqui: cambiar el
 *   desplegable **no vuelve a pedir nada**, y no tiene por que, porque el conector pide los dos
 *   ambitos.
 * · **Las pestanas con conteo (H20) no estan.** El artboard V8 pone los tres cuadros como tres
 *   bloques, uno debajo de otro; las tres pestanas eran de la V6.
 * · **El desenlace de cada cuadro va en la BARRA de su tabla y no en un aviso propio** (H29a). La
 *   gramatica V8 no tiene donde poner un aviso con su tono: seria una pieza mas en `bloques` y el
 *   artboard no la declara. Es la misma decision que tomo #67 con el veredicto de la huella.
 */
export const CUADROS = {
  'nor-cuadros': {
    instruccion:
      'consulte los tres cuadros nacionales (ADR-0017). Son de sólo lectura: ninguna municipalidad los edita.',
    bloques: [
      {
        titulo: 'Los tres cuadros',
        nota: 'Lo que esta operación no publica, y por eso no se dibuja: el sha256 del derivado, la doble firma de ADR-0007 —quién transcribió y quién verificó— y la clave de la edición. Están en el corpus de docs/10-negocio/valores-normativos/, que no tiene endpoint. Sacarlos de la captura del artboard los publicaría desde una pantalla, sin ninguna de las dos firmas.',
        // Sin `lectura`, y a proposito: este bloque no dibuja ni un dato de la respuesta. El
        // desplegable es un campo de la pantalla, y hoy lo tecleado no gobierna la lectura (H14a).
        campos: [
          {
            etiqueta: 'Ámbito del snapshot',
            tipo: 's',
            // El nombre del parametro de la consulta, bajo la etiqueta (H23, N5). No se traduce:
            // es lo que hay que escribir en `?ambito=`, y el backend no lo lee en minusculas.
            campo: 'ambito',
            opciones: ['VALUACION', 'OBLIGACION'],
          },
        ],
      },
      {
        titulo: 'Valores unitarios de edificación',
        nota: 'El anexo de valores unitarios de edificación que publica cada año el MVCS. Es una matriz de categoría por año de construcción, no sólo de categoría, y la letra que sale de aquí es lo que multiplica los metros construidos del predio.',
        lectura: { clave: 'cuadros' },
        campos: [
          // El documento fuente sale DE LAS FILAS y no de una constante: escribirlo aquí lo metería
          // en el paquete servido, que es lo que `sin-cifras-inventadas` y el `Dockerfile` impiden.
          { etiqueta: 'Documento fuente', tipo: 'r', campo: 'documentoFuente' },
          { etiqueta: 'Tabla', tipo: 'r' },
          { etiqueta: 'Ámbito que la lleva', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Valores unitarios de edificación — ámbito VALUACION',
          columnas: [
            { rotulo: 'Partida', alineadoDerecha: false, campo: 'partida', dominio: 'MUROS · TECHOS · PUERTAS' },
            { rotulo: 'Categoría', alineadoDerecha: false, campo: 'categoria', dominio: 'A … J' },
            { rotulo: 'Desde', alineadoDerecha: true, campo: 'anioConstruccionDesde' },
            { rotulo: 'Hasta', alineadoDerecha: true, campo: 'anioConstruccionHasta' },
            { rotulo: 'Valor por m² (S/)', alineadoDerecha: true, campo: 'valorM2' },
            { rotulo: 'Documento fuente', alineadoDerecha: false, campo: 'documentoFuente' },
          ],
          nota: 'La J existe sólo en el anexo de la Selva y sólo en muros; la H no tiene muros. Por eso el derivado de la Costa son 24 celdas y no 30: no es un hueco, es el cuadro.',
          clave: 'valores-unitarios',
          paginacion: { en: 'cliente', enLaRuta: 'pagina-valores-unitarios', tamano: 100 },
          vacio:
            'Este cuadro llegó sin filas. La barra de arriba dice de cuál de los dos casos se trata: el ámbito no lo lleva —es el reparto de ADR-0024— o sí lo lleva y llegó vacío, que es otra cosa y se arregla de otra manera.',
        },
      },
      {
        titulo: 'De qué región es este cuadro',
        nota: 'Esta operación no lo dice. La R.M. anual publica un cuadro por región —Lima Metropolitana y Callao, Costa, Sierra y Selva— y valor_unitario_edificacion no tiene columna de región: las cuatro chocarían celda con celda en valor_unitario_uq (publicacion_id, partida, categoria, anio_construccion_desde). Así que hay una región por edición y la región viaja en la clave de la edición —la del piloto es ANEXO-I.2-COSTA—, que GET /conjuntos/{id}/snapshot no publica: sus filas traen partida, categoria, anioConstruccionDesde, anioConstruccionHasta, valorM2 y documentoFuente. Un cuadro de valores unitarios sin su región no se puede usar: la misma letra vale otra cifra por metro cuadrado en cada una de las cuatro. Mientras la clave de la edición no viaje en el snapshot, quien calcule con estas cifras tiene que comprobar contra el corpus cuál se cargó, y eso no se puede hacer desde aquí.',
        campos: [],
      },
      {
        titulo: 'Depreciación',
        nota: 'El Anexo I del Reglamento Nacional de Tasaciones. El uso es la tabla a la que pertenece la fila, con el número que usa la propia norma: 01 vivienda, 02 tiendas y depósitos, 03 oficinas, 04 salud, industria y educación. Qué tabla le toca a un predio es criterio, y no vive aquí.',
        lectura: { clave: 'cuadros' },
        campos: [
          { etiqueta: 'Documento fuente', tipo: 'r', campo: 'documentoFuente' },
          { etiqueta: 'Tabla', tipo: 'r' },
          { etiqueta: 'Ámbito que la lleva', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Depreciación — ámbito VALUACION',
          columnas: [
            { rotulo: 'Uso', alineadoDerecha: false, campo: 'uso', dominio: '01 … 04' },
            { rotulo: 'Material', alineadoDerecha: false, campo: 'material' },
            { rotulo: 'Estado de conservación', alineadoDerecha: false, campo: 'estadoConservacion' },
            { rotulo: 'Antigüedad hasta', alineadoDerecha: true, campo: 'antiguedadHasta' },
            { rotulo: 'Depreciación %', alineadoDerecha: true, campo: 'porcentaje' },
            { rotulo: 'Documento fuente', alineadoDerecha: false, campo: 'documentoFuente' },
          ],
          nota: 'Cada tabla del Anexo I cierra con un tramo abierto, y en el JSON llega como «antiguedadHasta»: null. No es un dato que falte: es el tramo que no tiene tope, y en un padrón viejo es el que más predios cubre.',
          clave: 'depreciaciones',
          paginacion: { en: 'cliente', enLaRuta: 'pagina-depreciaciones', tamano: 100 },
          vacio:
            'Este cuadro llegó sin filas. La barra de arriba dice de cuál de los dos casos se trata: el ámbito no lo lleva —es el reparto de ADR-0024— o sí lo lleva y llegó vacío, que es otra cosa y se arregla de otra manera.',
        },
      },
      {
        titulo: 'Valores referenciales vehiculares',
        nota: 'El anexo del MEF con el valor referencial de los vehículos. Es la única de las tres tablas que no interviene en la valuación de un predio: sirve para la base imponible del patrimonio vehicular, que es obligación y no valuación (ADR-0024).',
        lectura: { clave: 'cuadros' },
        campos: [
          { etiqueta: 'Documento fuente', tipo: 'r', campo: 'documentoFuente' },
          { etiqueta: 'Tabla', tipo: 'r' },
          { etiqueta: 'Ámbito que la lleva', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Valores referenciales vehiculares — ámbito OBLIGACION',
          columnas: [
            { rotulo: 'Ejercicio', alineadoDerecha: true, campo: 'ejercicio' },
            { rotulo: 'Categoría', alineadoDerecha: false, campo: 'categoria' },
            { rotulo: 'Marca', alineadoDerecha: false, campo: 'marca' },
            { rotulo: 'Modelo', alineadoDerecha: false, campo: 'modelo' },
            { rotulo: 'Año de fabricación', alineadoDerecha: true, campo: 'anioFabricacion' },
            { rotulo: 'Valor (S/)', alineadoDerecha: true, campo: 'valor' },
            { rotulo: 'Documento fuente', alineadoDerecha: false, campo: 'documentoFuente' },
          ],
          nota: '«OTROS MODELOS» es una fila de verdad y aparece en cada categoría con un valor distinto, así que la categoría es parte de la identidad y no una etiqueta. Son siete columnas: la tabla se desplaza dentro de su marco y no arrastra la página.',
          clave: 'valores-referenciales',
          // Es la grande: el anexo de un ejercicio son decenas de miles de filas, y sin esto el
          // interprete las monta todas para enseñar las primeras cien.
          paginacion: { en: 'cliente', enLaRuta: 'pagina-valores-referenciales', tamano: 100 },
          vacio:
            'Este cuadro llegó sin filas. La barra de arriba dice de cuál de los dos casos se trata: el ámbito no lo lleva —es el reparto de ADR-0024— o sí lo lleva y llegó vacío, que es otra cosa y se arregla de otra manera.',
        },
      },
    ],
  },
} satisfies Partial<Record<ClaveDeHoja, Pantalla>>;
