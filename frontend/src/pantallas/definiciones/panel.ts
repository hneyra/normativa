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
 * <h2>Y desde #63 esta hoja SI pide, que es lo unico que esta definicion gano</h2>
 *
 * Tres cosas, y ninguna es texto nuevo salvo el `vacio`:
 *
 *   · `lectura: { clave: 'ejercicio' }` en el primer bloque — su cuerpo es lo que contesta
 *     `GET /seguridad/parametros/ejercicios/{ejercicio}`;
 *   · `fallosDe: ['versiones']` — el fallo de `GET /seguridad/parametros` se dice **encima** y no
 *     tapa el estado del ejercicio, porque son dos autorizaciones distintas;
 *   · `clave` y `vacio` en su tabla — sus filas llegan por nombre, y una lista vacia es una
 *     respuesta.
 *
 * Los bloques 2, 3 y 4 **siguen sin dato y es correcto**: ninguna operacion del backend publica ni
 * las 33 filas del derivado, ni los 35 detalles, ni las diez filas sin archivo, ni las cuatro
 * decisiones. Dicen «no publicado» con el motivo que redacta `src/datos/panel.ts`, y no se deducen
 * de otra cosa — un numero deducido seria indistinguible de uno sellado.
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
        // El cuerpo de este bloque es lo que contesta la lectura del ESTADO. El fallo de la del
        // LISTADO va encima y NO lo tapa: son dos autorizaciones distintas, y con un 403 en la
        // segunda el estado del ejercicio sigue dibujado (#63, AC 2). Las dos claves son las de
        // `src/datos/panel.ts`, y que sigan cuadrando lo comprueba `camino-a-la-api`.
        lectura: { clave: 'ejercicio' },
        fallosDe: ['versiones'],
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
          // Sus filas salen de `DatosDeLaPantalla.tablas` por este nombre, y no del indice del
          // bloque: por indice solo caben `string[]`, y una celda nula tiene que poder decir
          // `{ texto: null, nota }` — que es el AC 5 (#63).
          clave: 'versiones',
          // La lista CONTESTO y no habia ninguna de este ejercicio. Es una respuesta y no la
          // ausencia: sin esto, una tabla vacia saldria con el aviso «sin motivo» del saco.
          vacio:
            'El listado contestó y ninguno de los conjuntos que devolvió es de este ejercicio. No es un fallo: es que todavía no se ha compuesto ninguno.',
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
