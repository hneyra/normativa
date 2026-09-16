import { TEXTOS_DE_LA_UI, type TextosDelInterprete } from '@kamayuk/ui';

import { t } from './i18n.ts';

/**
 * **Las tres palabras que el INTERPRETE dice por su cuenta** (#60, AC 3).
 *
 * <h2>Por que este saco existe aparte del marco</h2>
 *
 * Porque son otro destinatario. Las treinta y dos de `textosDelMarco.ts` se las pasa
 * `src/aplicacion.tsx` al `<Armazon>`; estas tres se las pasa `src/pantallas/index.ts` a
 * `<Pantalla>`, que es quien dibuja el cuerpo. Fundirlos en un archivo obligaria a que una costura
 * importara el saco de la otra para descartarlo.
 *
 * `rentas` no tiene este archivo y no le hace falta: en `ac379ac` su interprete es **suyo**
 * (`src/pantallas/Pantalla.tsx`) y llama a `useTranslation()` por dentro. Aqui el interprete es de
 * `@kamayuk/ui`, que **no puede** depender de `i18next` —seria una `peerDependency` que obligaria a
 * los cuatro sistemas a montarlo para dibujar un campo (`kamayuk-lib`#19, AC3)—, asi que las
 * palabras entran como dato. Es el mismo reparto que el del armazon, un nivel mas abajo.
 *
 * <h2>Las tres, y por que se pasan aunque hoy no se dibuje NINGUNA</h2>
 *
 * Medido sobre las cuatro definiciones de este sistema: sus campos son de tipo `r`, `r1`, `s` y
 * `a1`, ninguno declara `opcional` y ninguna tabla trae filas todavia (#63). O sea que hoy el
 * interprete no dice ninguna de las tres, y `verificaciones/todo-el-texto-se-traduce.test.tsx` lo
 * comprueba en la otra direccion — con el idioma marcado, las cuatro hojas no ensenan una sola
 * cadena sin marca.
 *
 * Se pasan igualmente porque **la que falta no avisa**: el dia que #63 llene una tabla, el conteo
 * sale de `registros`; el dia que una hoja gane un campo de fecha, su marcador sale de
 * `marcadorDeFecha`. Sin este saco saldrian en castellano con la guarda en verde hasta que alguien
 * pidiera un segundo idioma — que es exactamente como llegaron en INGLES `Notifications alt+T` de
 * `sonner` y `Suggestions` de `cmdk` (`kamayuk-lib`#13 y #19).
 */

/**
 * **Las frases, en castellano, que es la clave.**
 *
 * Son las de `TEXTOS_DEL_INTERPRETE` de `@kamayuk/ui`, con una sola diferencia de forma: `registros`
 * alli es una funcion con un ternario y aqui es `{{count}} registro`, una clave con plural. El
 * ternario deja fuera para siempre a los idiomas con mas de dos formas; i18next las sabe. Las dos
 * formas de esta clave —`_one` y `_other`— son la unica excepcion al «cada valor es igual a su
 * clave» del locale, y `el-locale-esta-completo` la declara.
 *
 * `opcional` NO se reescribe: se toma de `TEXTOS_DE_LA_UI`, que es quien la dice. Copiarla seria una
 * palabra escrita en dos sitios y traducida en uno.
 *
 * El `satisfies` es lo que hace que una entrada de menos no compile.
 */
export const FRASES_DEL_INTERPRETE = {
  opcional: TEXTOS_DE_LA_UI.opcional,
  marcadorDeFecha: 'dd/mm/aaaa',
  registros: '{{count}} registro',
} as const satisfies Record<keyof TextosDelInterprete, string>;

/** Todo lo que este archivo aporta al inventario del locale. Ver `catalogo-de-claves.ts`. */
export function clavesDelInterprete(): readonly string[] {
  return Object.values(FRASES_DEL_INTERPRETE);
}

/**
 * El saco que `<Pantalla>` recibe, con las tres ya pasadas por `t()`.
 *
 * Captadores por lo mismo que en `textosDelMarco.ts`: `t()` corre cuando el interprete lee la
 * propiedad. `registros` ya es una funcion y se evalua al llamarla.
 */
export const TEXTOS_DEL_INTERPRETE: TextosDelInterprete = {
  get opcional() {
    return t(FRASES_DEL_INTERPRETE.opcional);
  },
  get marcadorDeFecha() {
    return t(FRASES_DEL_INTERPRETE.marcadorDeFecha);
  },
  registros: (cuantos: number) => t(FRASES_DEL_INTERPRETE.registros, { count: cuantos }),
};
