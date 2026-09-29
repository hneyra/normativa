import {
  TEXTOS_DE_LA_UI,
  type TextosDeLaPantalla,
  type TextosDeLasPiezas,
  type TextosDelInterprete,
} from '@kamayuk/ui';

import { t } from './i18n.ts';

/**
 * **Las palabras que el INTERPRETE dice por su cuenta** (#60, AC 3; dos mas en #63).
 *
 * <h2>Por que este saco existe aparte del marco</h2>
 *
 * Porque son otro destinatario. Las treinta y dos de `textosDelMarco.ts` se las pasa
 * `src/aplicacion.tsx` al `<Armazon>`; estas se las pasa `src/pantallas/index.ts` a
 * `<Pantalla>`, que es quien dibuja el cuerpo. Fundirlos en un archivo obligaria a que una costura
 * importara el saco de la otra para descartarlo.
 *
 * `rentas` no tiene este archivo y no le hace falta: en `ac379ac` su interprete es **suyo**
 * (`src/pantallas/Pantalla.tsx`) y llama a `useTranslation()` por dentro. Aqui el interprete es de
 * `@kamayuk/ui`, que **no puede** depender de `i18next` —seria una `peerDependency` que obligaria a
 * los cuatro sistemas a montarlo para dibujar un campo (`kamayuk-lib`#19, AC3)—, asi que las
 * palabras entran como dato. Es el mismo reparto que el del armazon, un nivel mas abajo.
 *
 * <h2>Cuales se dibujan hoy, y por que se pasan tambien las que no</h2>
 *
 * Medido sobre las cuatro definiciones de este sistema: sus campos son de tipo `r`, `r1`, `s` y
 * `a1` y ninguno declara `opcional`. Asi que de las TRES de #60 el interprete sigue sin decir
 * ninguna —`registros` solo saldria si una tabla llegara sin conteo, y el Panel siempre da el
 * suyo—, y las dos que #63 anade SI se dibujan. `verificaciones/todo-el-texto-se-traduce.test.tsx`
 * lo comprueba en la otra direccion: con el idioma marcado, las cuatro hojas no ensenan una sola
 * cadena sin marca.
 *
 * Las que no se dibujan se pasan igualmente porque **la que falta no avisa**: el dia que una tabla
 * llegue sin conteo, el suyo sale de `registros`; el dia que una hoja gane un campo de fecha, su
 * marcador sale de `marcadorDeFecha`. Sin este saco saldrian en castellano con la guarda en verde hasta que alguien
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
  // ── Las de las PIEZAS, desde #63 ─────────────────────────────────────────────────────────────
  //
  // `@kamayuk/ui` publica ademas `TextosDeLasPiezas`, que son las palabras que el interprete dice
  // cuando una pieza depende de una LECTURA. Hasta #63 no se dibujaba ninguna —ninguna hoja pedia—
  // y por eso este saco eran tres. Ahora el Panel pide, y estas DOS llegan al DOM:
  //
  //   · `pidiendo` — bajo las barras, mientras la lectura esta en vuelo;
  //   · `reintentar` — el rotulo del boton, que sale solo donde es una averia.
  //
  // Las demas de `TextosDeLasPiezas` **no se declaran**, y es deliberado. `celdaSinDato` es una
  // raya, y traducir una raya no significa nada —lo dice `NO_ES_TEXTO` de
  // `todo-el-texto-se-traduce`, que la exime—; el POR QUE de una celda nula lo pone la celda misma
  // (`{ texto: null, nota }`), que es texto de este sistema y pasa por `t()` donde se compone. Y
  // `enEspera`, `tablaSinMotivo`, `datoAusente`, las de los actos y las de la paginacion no las
  // dibuja hoy ninguna hoja: una entrada que nadie ejercita es una traduccion que nadie comprueba.
  // La que haga falta entra con la hoja que la dibuje, que es cuando se puede medir que sale.
  pidiendo: 'Pidiendo al servidor…',
  reintentar: 'Reintentar',
  // ── Las de la TABLA y sus mandos, desde #65 ──────────────────────────────────────────────────
  //
  // Ediciones pagina y ordena en el servidor, asi que el interprete dibuja ahora los dos mandos y
  // dice sus palabras por su cuenta. Se declaran **las que se dibujan**, y se puede decir cuales
  // son sin adivinar porque `MandosDeLaTabla.tsx` no tiene otra rama: el desplegable de orden con
  // su rotulo oculto, el boton de sentido con su `title`, los dos de pagina con su motivo cuando
  // no llevan a ninguna parte, el indicador y el desplegable de tamano.
  //
  // Las DOS FLECHAS no se declaran, y es la misma decision que `celdaSinDato`: son `↑` y `↓`, y
  // traducir una flecha no significa nada. `todo-el-texto-se-traduce` las exime por eso, junto a
  // la raya.
  //
  // `enEspera` tampoco: la lectura del detalle trae su propia espera en la definicion —«Elija una
  // edicion…»—, que dice lo de esta hoja y no una frase generica. La del saco solo saldria si
  // alguna hoja declarara una lectura en espera sin decir cual, y hoy no la hay.
  ordenarLaLista: 'Ordenar la lista',
  pasarAAscendente: 'Ordenar de menor a mayor',
  pasarADescendente: 'Ordenar de mayor a menor',
  paginaAnterior: 'Anterior',
  paginaSiguiente: 'Siguiente',
  pagina: 'Página {{pagina}}',
  paginaDe: 'Página {{pagina}} de {{paginas}}',
  yaEsLaPrimeraPagina: 'Ésta es la primera página: no hay ninguna antes.',
  noHayMasPaginas: 'No hay ninguna página después de ésta.',
  filasPorPagina: 'Cuántas filas por página',
  mandosDeLaTabla: 'Mandos de «{{tabla}}»',
  accionesDeLaFila: 'Acciones de «{{fila}}»',
  // El motivo con que sale impedida una accion que nadie puede atender. Se dibujan en cuanto el
  // marco no da navegacion —una pantalla montada suelta—, y entonces el boton de cada fila lo dice.
  sinNavegacion: 'Esta pantalla no está dentro de un marco que sepa abrir otra hoja.',
  hojaNoOfrecida: 'Esa hoja no está entre las que esta cuenta puede abrir.',
  faltaElDato: 'Todavía no se sabe «{{nombre}}», y sin él no hay a dónde ir.',
  // Y el que sale cuando una tabla llega vacia y su definicion no dice por que. Las dos de esta
  // hoja lo dicen; se declara porque la que falta no avisa: saldria en castellano en un segundo
  // idioma, y en verde.
  tablaSinMotivo: 'Esta lista no tiene filas, y la definición de la pantalla no dice por qué.',
} as const satisfies Record<keyof TextosDelInterprete, string> &
  Partial<Record<keyof TextosDeLasPiezas, string>>;

/** Todo lo que este archivo aporta al inventario del locale. Ver `catalogo-de-claves.ts`. */
export function clavesDelInterprete(): readonly string[] {
  return Object.values(FRASES_DEL_INTERPRETE);
}

/**
 * El saco que `<Pantalla>` recibe, con las cinco ya pasadas por `t()`.
 *
 * Captadores por lo mismo que en `textosDelMarco.ts`: `t()` corre cuando el interprete lee la
 * propiedad. `registros` ya es una funcion y se evalua al llamarla.
 *
 * `Partial<TextosDeLaPantalla>` y no `TextosDelInterprete` desde #63: el saco cubre ahora tambien
 * dos palabras de `TextosDeLasPiezas`, y `<Pantalla textos>` acepta justo eso. Las que no se
 * declaran las pone la libreria con su castellano por omision — que es lo correcto mientras no se
 * dibujen, y lo que la guarda del DOM diria en cuanto alguna se dibujara.
 */
export const TEXTOS_DEL_INTERPRETE: Partial<TextosDeLaPantalla> = {
  get opcional() {
    return t(FRASES_DEL_INTERPRETE.opcional);
  },
  get marcadorDeFecha() {
    return t(FRASES_DEL_INTERPRETE.marcadorDeFecha);
  },
  registros: (cuantos: number) => t(FRASES_DEL_INTERPRETE.registros, { count: cuantos }),
  get pidiendo() {
    return t(FRASES_DEL_INTERPRETE.pidiendo);
  },
  get reintentar() {
    return t(FRASES_DEL_INTERPRETE.reintentar);
  },
  // Las de la tabla (#65). Las que llevan un dato dentro entran por INTERPOLACION y no
  // concatenando: con `Pagina ${n} de ${m}` la clave seria distinta en cada pagina y no habria
  // locale que pudiera tenerlas todas — es el defecto que `rentas`#246 midio.
  get ordenarLaLista() {
    return t(FRASES_DEL_INTERPRETE.ordenarLaLista);
  },
  get pasarAAscendente() {
    return t(FRASES_DEL_INTERPRETE.pasarAAscendente);
  },
  get pasarADescendente() {
    return t(FRASES_DEL_INTERPRETE.pasarADescendente);
  },
  get paginaAnterior() {
    return t(FRASES_DEL_INTERPRETE.paginaAnterior);
  },
  get paginaSiguiente() {
    return t(FRASES_DEL_INTERPRETE.paginaSiguiente);
  },
  pagina: (pagina: number) => t(FRASES_DEL_INTERPRETE.pagina, { pagina }),
  paginaDe: (pagina: number, paginas: number) =>
    t(FRASES_DEL_INTERPRETE.paginaDe, { pagina, paginas }),
  get yaEsLaPrimeraPagina() {
    return t(FRASES_DEL_INTERPRETE.yaEsLaPrimeraPagina);
  },
  get noHayMasPaginas() {
    return t(FRASES_DEL_INTERPRETE.noHayMasPaginas);
  },
  get filasPorPagina() {
    return t(FRASES_DEL_INTERPRETE.filasPorPagina);
  },
  mandosDeLaTabla: (tabla: string) => t(FRASES_DEL_INTERPRETE.mandosDeLaTabla, { tabla }),
  accionesDeLaFila: (fila: string) => t(FRASES_DEL_INTERPRETE.accionesDeLaFila, { fila }),
  get sinNavegacion() {
    return t(FRASES_DEL_INTERPRETE.sinNavegacion);
  },
  get hojaNoOfrecida() {
    return t(FRASES_DEL_INTERPRETE.hojaNoOfrecida);
  },
  faltaElDato: (nombre: string) => t(FRASES_DEL_INTERPRETE.faltaElDato, { nombre }),
  get tablaSinMotivo() {
    return t(FRASES_DEL_INTERPRETE.tablaSinMotivo);
  },
};
