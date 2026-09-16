import type { ClaveDeHoja } from '../arbol.ts';
import type { Pantalla } from '../tipos.ts';

/**
 * **La pantalla de **Panel**: con que se puede emitir el ejercicio, y que le falta** (#58, AC 2).
 *
 * Transcrita de `const PANTALLAS['nor-panel']` y de `const INSTRUCCIONES['nor-panel']` de
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
 * El tono de la fila de `D-03d` —«atencion» aunque diga «Abierta», porque no bloquea el sello sino
 * el cierre de caja— es el hueco H18 de `diseno/HUECOS.md`: la gramatica de un bloque no tiene
 * donde decir el tono de UNA fila, y `src/pantallas/index.ts` solo puede deducirlo del texto. La
 * accion en cada fila (H46) y las filas de contenido que viajan (H34) tampoco estan aqui.
 */
export const PANEL = {
  'nor-panel': {
    instruccion:
      'revise con qué se puede emitir el ejercicio y qué le falta: lo que falta ocupa tanto sitio como lo que hay.',
    bloques: [
      {
        titulo: 'Estado del ejercicio',
        nota: 'Es lo que contesta GET /seguridad/parametros/ejercicios/{ejercicio}, la única de las cuatro operaciones que no exige el acceso «parametros». «No hay conjunto sellado» es una respuesta y llega como 200, no como 404.',
        campos: [
          { etiqueta: 'Ejercicio', tipo: 'r' },
          { etiqueta: '¿Sellado?', tipo: 'r' },
          { etiqueta: 'Conjunto', tipo: 'r' },
          { etiqueta: 'Versión', tipo: 'r' },
          { etiqueta: 'Qué se puede hacer', tipo: 'r1' },
        ],
        tabla: {
          titulo: 'Versiones selladas del ejercicio',
          columnas: [
            { rotulo: 'Versión', alineadoDerecha: true },
            { rotulo: 'Identificador', alineadoDerecha: true },
            { rotulo: 'Fecha de sellado', alineadoDerecha: false },
            { rotulo: 'Usuario que selló', alineadoDerecha: false },
            { rotulo: 'Estado', alineadoDerecha: false },
          ],
          nota: 'Puede haber varias del mismo año y no es un error: conjunto_uq lleva la versión, y la lectura ordena por versión y toma la última. La marcada es la que rige.',
          columnaDeInsignia: 4,
        },
      },
      {
        titulo: 'Con qué se selló el ejercicio',
        nota: 'Medido sobre PostgreSQL real, componiendo y sellando la versión. Es de norma nacional y común a todas las municipalidades: publicarlo no es componerlo.',
        campos: [
          { etiqueta: 'Filas del derivado del corpus', tipo: 'r' },
          { etiqueta: 'Ediciones de cuadro nacional', tipo: 'r' },
          { etiqueta: 'Detalles compuestos', tipo: 'r' },
          { etiqueta: 'Filas del mapa sin archivo', tipo: 'r' },
        ],
      },
      {
        titulo: 'Lo que este sello no incluye',
        nota: 'Diez filas del mapa normativo sin archivo del corpus. Las diez son de acto propio de la municipalidad —ordenanza de arbitrios, TIM, CUIS, fraccionamiento…—, así que normativa no las publica: las pone cada municipalidad en su propio conjunto.',
        campos: [],
        tabla: {
          titulo: 'Filas sin archivo',
          columnas: [
            { rotulo: 'Fila', alineadoDerecha: false },
            { rotulo: 'Qué', alineadoDerecha: false },
            { rotulo: 'Parte de', alineadoDerecha: false },
          ],
        },
      },
      {
        titulo: 'Decisiones que deciden qué se puede sellar',
        nota: '',
        campos: [],
        tabla: {
          titulo: 'Decisiones del registro',
          columnas: [
            { rotulo: 'Decisión', alineadoDerecha: false },
            { rotulo: 'Qué', alineadoDerecha: false },
            { rotulo: 'Estado', alineadoDerecha: false },
            { rotulo: 'Detalle', alineadoDerecha: false },
          ],
          nota: 'Sellar no cierra ninguna puerta: no existe «un solo conjunto sellado por ejercicio». Lo que cuesta un sello prematuro es que cada valuación guarda con qué conjuntoId se calculó, así que converger es recalcular el padrón.',
          columnaDeInsignia: 2,
        },
      },
    ],
  },
} satisfies Partial<Record<ClaveDeHoja, Pantalla>>;
