import { FRASES_DE_LAS_ACCIONES } from '../acciones.ts';
import { FRASES_DE_LA_MARCA } from '../marca.ts';
import { ARBOL } from '../pantallas/arbol.ts';
import { PANTALLAS } from '../pantallas/definiciones/index.ts';
import { AUSENCIA_SIN_CONECTAR } from '../pantallas/index.ts';
import type { Modulo, Pantalla } from '../pantallas/tipos.ts';
import { clavesDelMando } from '../preferencias/MandoDeTema.tsx';
import { clavesDeLaPuerta } from '../puerta/AvisoDeLaPuerta.tsx';
import { FRASES_DE_LA_SESION } from '../sesion.ts';
import { clavesDelInterprete } from './textosDelInterprete.ts';
import { clavesDelMarco } from './textosDelMarco.ts';

/**
 * **Todas las cadenas traducibles del sistema, sacadas de donde estan** (#60, AC 1).
 *
 * Calcado de `rentas/frontend/src/i18n/catalogo-de-claves.ts@ac379ac`, con las fuentes de ESTE
 * sistema: alli son cuarenta pantallas y diez modulos, aqui cuatro hojas y uno.
 *
 * <h2>Por que esto existe, y por que `i18next-cli` no basta</h2>
 *
 * `i18next-cli` extrae lo que encuentra escrito como una llamada con la frase dentro. Las cadenas de
 * este sistema **no estan escritas asi y no pueden estarlo**: viven en las definiciones de las
 * cuatro pantallas, en el arbol, en el catalogo y en los rotulos de los dos ejes del mando de temas,
 * y quien las traduce lo hace **por variable** —`traducir(campo.etiqueta)`, `t(opcion.rotulo)`—, que
 * es algo que ninguna extraccion estatica puede seguir.
 *
 * **Y ojo con los ejemplos en los comentarios.** En `rentas` un parrafo de este mismo archivo puso
 * la llamada con una frase literal dentro, a modo de ejemplo, y el extractor **la cogio como clave
 * de verdad**: `status` salio rojo con «✗ una frase (absent)» sobre un codigo perfecto. No distingue
 * un ejemplo de una llamada, asi que aqui no se escriben ejemplos con la frase dentro.
 *
 * No es un defecto de la herramienta ni de la forma: es la consecuencia de que **las pantallas sean
 * dato**, que es justo lo que hace posible la guarda anti-deriva contra el artboard. Se paga aqui.
 *
 * Asi que el catalogo se DERIVA del dato en vez de extraerse del codigo. La ventaja es que no puede
 * quedarse corto por olvido: una hoja nueva trae sus cadenas sin que nadie se acuerde de nada, y una
 * identidad visual nueva en `@kamayuk/ui` trae su rotulo por el mismo camino.
 *
 * <h2>Lo que NO entra</h2>
 *
 * · **Los datos.** Un importe, una fecha, un `conjuntoId`. No hay ninguno todavia —las cuatro hojas
 *   se dibujan sin conectar (#63)— y cuando los haya no se traduciran: «S/ 9 418 204,60» no tiene
 *   traduccion, y el interprete ya los deja fuera de `traducir` por su cuenta.
 * · **Los identificadores.** `clave`, `slug`, `codigo`, `tipo`, el verbo y la ruta de una operacion.
 *   El slug viaja al hash: traducirlo cambiaria la direccion de cada hoja.
 * · **Lo que dice el emisor de identidad.** `error` y `error_description` de una vuelta fallida son
 *   suyos, no de este sistema. Ver `src/puerta/AvisoDeLaPuerta.tsx`.
 */

/** Todo lo que dicen las cuatro pantallas. */
function deLasPantallas(): readonly string[] {
  const salida: string[] = [];
  // Anotado: `PANTALLAS` es un `satisfies` de cuatro formas distintas, y sin la anotacion el
  // compilador intenta unificarlas. La forma comun la da el `satisfies`, que es lo que garantiza
  // que la anotacion no miente.
  for (const pantalla of Object.values(PANTALLAS) as readonly Pantalla[]) {
    salida.push(pantalla.instruccion);
    for (const bloque of pantalla.bloques) {
      salida.push(bloque.titulo, bloque.nota);
      for (const campo of bloque.campos) {
        salida.push(campo.etiqueta);
        if ('opciones' in campo) salida.push(...campo.opciones);
        if ('casilla' in campo) salida.push(campo.casilla);
        if ('ayuda' in campo && campo.ayuda !== undefined) salida.push(campo.ayuda);
        if ('marcador' in campo && campo.marcador !== undefined) salida.push(campo.marcador);
      }
      const tabla = bloque.tabla;
      if (tabla === undefined) continue;
      salida.push(tabla.titulo, ...tabla.columnas.map((c) => c.rotulo));
      if (tabla.nota !== undefined) salida.push(tabla.nota);
      if (tabla.accion !== undefined) salida.push(tabla.accion);
    }
  }
  return salida;
}

/** Los rotulos del arbol: un modulo con su nota, y cuatro hojas. */
function delArbol(): readonly string[] {
  return (ARBOL as readonly Modulo[]).flatMap((modulo) => [
    modulo.rotulo,
    modulo.nota,
    ...modulo.hojas.map((hoja) => hoja.rotulo),
  ]);
}

/**
 * Las frases con que el sistema explica que no hay dato.
 *
 * Hoy hay **una** y no tres como en `rentas`: aqui ninguna operacion esta conectada, asi que todas
 * las hojas dicen lo mismo. Sale de `src/pantallas/index.ts` y no de una copia, que es lo que hace
 * que el dia que #63 anada las otras dos entren solas.
 */
function deLasAusencias(): readonly string[] {
  return [AUSENCIA_SIN_CONECTAR.enElCampo, AUSENCIA_SIN_CONECTAR.explicacion];
}

/** El catalogo entero, sin repetidos y en orden. */
export function catalogoDeClaves(): readonly string[] {
  const todas = new Set([
    ...deLasPantallas(),
    ...delArbol(),
    ...deLasAusencias(),
    ...clavesDelMarco(),
    ...clavesDelInterprete(),
    ...clavesDelMando(),
    ...clavesDeLaPuerta(),
    ...Object.values(FRASES_DE_LA_MARCA),
    ...Object.values(FRASES_DE_LA_SESION),
    ...Object.values(FRASES_DE_LAS_ACCIONES),
  ]);
  return [...todas].filter((c) => c.trim() !== '').sort((a, b) => a.localeCompare(b, 'es'));
}
