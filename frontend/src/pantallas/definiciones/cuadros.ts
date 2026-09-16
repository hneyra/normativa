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
 * Y **nada se rellena**: mientras ninguna operacion este conectada (#63), cada campo y cada tabla
 * dicen su ausencia con el motivo de `AUSENCIA_SIN_CONECTAR` (`src/pantallas/index.ts`).
 *
 * <h2>Lo que esta hoja NO dibuja todavia, dicho aqui y no descubierto luego</h2>
 *
 * El selector de ambito gobierna una lectura y **no deberia hacer la hoja editable** (H14a, N11):
 * hoy `src/catalogo.ts` calcula `seEscribe` del tipo de sus campos, asi que esta hoja sale con
 * «Limpiar» y «Guardar» al pie. Es la diferencia N11 de `diseno/HUECOS.md`, no un descuido. El
 * tramo abierto de la depreciacion (H22b), las pestanas con conteo (H20) y las decenas de miles de
 * filas del cuadro vehicular (H21) tampoco estan aqui.
 */
export const CUADROS = {
  'nor-cuadros': {
    instruccion:
      'consulte los tres cuadros nacionales (ADR-0017). Son de sólo lectura: ninguna municipalidad los edita.',
    bloques: [
      {
        titulo: 'Los tres cuadros',
        nota: 'Lo que esta operación no publica, y por eso no se dibuja: el sha256 del derivado, la doble firma de ADR-0007 —quién transcribió y quién verificó— y la clave de la edición. Están en el corpus de docs/10-negocio/valores-normativos/, que no tiene endpoint. Sacarlos de la captura del artboard los publicaría desde una pantalla, sin ninguna de las dos firmas.',
        campos: [
          { etiqueta: 'Ámbito del snapshot', tipo: 's', opciones: ['VALUACION', 'OBLIGACION'] },
        ],
      },
      {
        titulo: 'Valores unitarios de edificación',
        nota: 'El anexo de valores unitarios de edificación que publica cada año el MVCS. Es una matriz de categoría por año de construcción, no sólo de categoría, y la letra que sale de aquí es lo que multiplica los metros construidos del predio.',
        campos: [
          { etiqueta: 'Documento fuente', tipo: 'r' },
          { etiqueta: 'Tabla', tipo: 'r' },
          { etiqueta: 'Ámbito que la lleva', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Valores unitarios de edificación — ámbito VALUACION',
          columnas: [
            { rotulo: 'Partida', alineadoDerecha: false },
            { rotulo: 'Categoría', alineadoDerecha: false },
            { rotulo: 'Desde', alineadoDerecha: true },
            { rotulo: 'Hasta', alineadoDerecha: true },
            { rotulo: 'Valor por m² (S/)', alineadoDerecha: true },
            { rotulo: 'Documento fuente', alineadoDerecha: false },
          ],
          nota: 'La J existe sólo en el anexo de la Selva y sólo en muros; la H no tiene muros. Por eso el derivado de la Costa son 24 celdas y no 30: no es un hueco, es el cuadro.',
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
        campos: [
          { etiqueta: 'Documento fuente', tipo: 'r' },
          { etiqueta: 'Tabla', tipo: 'r' },
          { etiqueta: 'Ámbito que la lleva', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Depreciación — ámbito VALUACION',
          columnas: [
            { rotulo: 'Uso', alineadoDerecha: false },
            { rotulo: 'Material', alineadoDerecha: false },
            { rotulo: 'Estado de conservación', alineadoDerecha: false },
            { rotulo: 'Antigüedad hasta', alineadoDerecha: true },
            { rotulo: 'Depreciación %', alineadoDerecha: true },
            { rotulo: 'Documento fuente', alineadoDerecha: false },
          ],
          nota: 'Cada tabla del Anexo I cierra con un tramo abierto, y en el JSON llega como «antiguedadHasta»: null. No es un dato que falte: es el tramo que no tiene tope, y en un padrón viejo es el que más predios cubre.',
        },
      },
      {
        titulo: 'Valores referenciales vehiculares',
        nota: 'El anexo del MEF con el valor referencial de los vehículos. Es la única de las tres tablas que no interviene en la valuación de un predio: sirve para la base imponible del patrimonio vehicular, que es obligación y no valuación (ADR-0024).',
        campos: [
          { etiqueta: 'Documento fuente', tipo: 'r' },
          { etiqueta: 'Tabla', tipo: 'r' },
          { etiqueta: 'Ámbito que la lleva', tipo: 'r' },
        ],
        tabla: {
          titulo: 'Valores referenciales vehiculares — ámbito OBLIGACION',
          columnas: [
            { rotulo: 'Ejercicio', alineadoDerecha: true },
            { rotulo: 'Categoría', alineadoDerecha: false },
            { rotulo: 'Marca', alineadoDerecha: false },
            { rotulo: 'Modelo', alineadoDerecha: false },
            { rotulo: 'Año de fabricación', alineadoDerecha: true },
            { rotulo: 'Valor (S/)', alineadoDerecha: true },
            { rotulo: 'Documento fuente', alineadoDerecha: false },
          ],
          nota: '«OTROS MODELOS» es una fila de verdad y aparece en cada categoría con un valor distinto, así que la categoría es parte de la identidad y no una etiqueta. Son siete columnas: la tabla se desplaza dentro de su marco y no arrastra la página.',
        },
      },
    ],
  },
} satisfies Partial<Record<ClaveDeHoja, Pantalla>>;
