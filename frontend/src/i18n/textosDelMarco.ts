import type { TextosDelArmazon } from '@kamayuk/shell';
import { TEXTOS_DE_LA_UI } from '@kamayuk/ui';

import { AVISOS_DEL_PIE } from '../pantallas/avisos.ts';
import { t } from './i18n.ts';

/**
 * **Las palabras que el MARCO dice por su cuenta, traducidas por este sistema** (#60, AC 3).
 *
 * Calcado de `rentas/frontend/src/i18n/textosDelMarco.ts@ac379ac` (`rentas`#133), con **una sola
 * diferencia de forma** y **dos de contenido**, las tres dichas abajo.
 *
 * <h2>El defecto que esto cierra, y por que no se veia</h2>
 *
 * `@kamayuk/shell` dibuja el marco —la barra, el carril, la paleta, la cabecera, el pie y el aviso
 * de cambios sin guardar— y **dice treinta y dos cosas por su cuenta**: «Volver», «Guardar»,
 * «Buscar», «Seguir editando», el nombre accesible de la miga… Hasta este issue este sistema pasaba
 * **dos** (#58, los avisos del pie) y las otras treinta salian con el castellano de la libreria.
 *
 * El sintoma no es «el marco no esta traducido»: es que un segundo idioma dejaria la pantalla **a
 * medias** —el cuerpo traducido y el marco en castellano—, que no se lee como un marco sin traducir
 * sino como una traduccion rota. Y la mitad que falta es la que sale en las cuatro hojas.
 *
 * <h2>Por que las treinta y dos se escriben aqui, si #58 decia que no</h2>
 *
 * El docblock de `src/i18n/armazon.ts` decia —con razon, para #58— que copiar las treinta y una
 * restantes seria «una segunda fuente de verdad que se queda vieja en silencio la primera vez que
 * la libreria corrija una». Eso vale mientras nadie las traduzca: entonces copiarlas no aporta nada
 * y solo puede divergir.
 *
 * Desde este issue **si aporta**, porque son las claves del locale, y la divergencia deja de ser
 * silenciosa: el `satisfies Record<keyof TextosDelArmazon, string>` de abajo **no compila** con una
 * de menos, y `todo-el-texto-se-traduce` compara el saco entero contra `TEXTOS_DEL_ARMAZON` de la
 * libreria y sale rojo **nombrando** la que falte o la que sobre. Lo que antes era una copia muda es
 * hoy una copia vigilada por dos sitios.
 *
 * <h2>Por que las frases viven en un DATO y no escritas dentro de cada `t()`</h2>
 *
 * Porque el locale de este repositorio **se deriva del dato y no se escribe** —ver
 * `catalogo-de-claves.ts`—, y esa es la unica forma de que no pueda quedarse corto. Con las treinta
 * y dos escritas dentro de las llamadas, el dia que la libreria publique la treinta y tres habria
 * que acordarse de anadirla **a mano** al inventario del locale; y el olvido no produce ningun rojo,
 * porque lo que nadie lista tampoco nadie lo echa de menos.
 *
 * Derivadas de aqui, la cadena es: la libreria anade un texto -> `TextosDelArmazon` crece ->
 * {@link FRASES_DEL_MARCO} **deja de compilar** diciendo cual falta -> al escribirla entra sola en
 * el catalogo de claves -> `el-locale-esta-completo` se pone roja hasta que se regenera el locale.
 *
 * <h2>Y por que el saco entero y no «las que se ven»</h2>
 *
 * Ocho de las treinta y dos **no se dibujan**: seis son nombres accesibles —el boton del carril, el
 * menu de sesion, la miga, el dialogo de la paleta, su lista y la region viva de los avisos— y dos
 * son marcadores de una caja de texto. Un inventario hecho mirando la pantalla se los deja, y son
 * justo los que ya habian llegado **en ingles** desde `sonner` y desde `cmdk` sin que nadie lo
 * notara (`kamayuk-lib`#13 y #19). Aqui entran las treinta y dos o no compila.
 *
 * <h2>Las cuatro funciones llevan un dato dentro, y por eso son interpolacion y no concatenacion</h2>
 *
 * Un numero, un filtro o el rotulo de una hoja caen en distinto sitio en cada idioma. Partir la
 * frase en dos cadenas decide por el traductor donde va el dato; con `{{…}}` lo decide el idioma. Y
 * los dos que llevan una cuenta van con `{{count}}`, que es lo que hace que i18next elija la forma
 * plural — con un ternario en el codigo, los idiomas con mas de dos formas se quedan fuera para
 * siempre.
 *
 * <h2>LA DIFERENCIA DE FORMA con `rentas`: esto no es un gancho</h2>
 *
 * Alli es `useTextosDelMarco()`, un `useMemo` sobre el `t` de `useTranslation()`, llamado dentro de
 * `aplicacion.tsx`. **Aqui `aplicacion.tsx` no se toca** —es de #55 por la epica #47, y
 * `verificaciones/la-costura-es-la-que-es.test.ts` da rojo si importa `react-i18next`—, asi que el
 * saco es un objeto de modulo cuyas cadenas se traducen **al leerlas**, con captadores. Es lo mismo
 * que hace el `useMemo` de alla —resolver en la pintada y no al importar— sin necesitar componente,
 * y de regalo la identidad del objeto es estable sin memorizar nada.
 */

/**
 * **Las frases, en castellano, que es la clave** (#60).
 *
 * Son **exactamente** las de `TEXTOS_DEL_ARMAZON` de `@kamayuk/shell`, palabra por palabra, salvo
 * las dos del pie, que son **las del artboard V8** y llegan de `src/pantallas/avisos.ts` — que es
 * donde `los-avisos-del-pie-son-los-del-artboard` las compara literales contra el artboard. Las
 * cuatro que llevan dato dentro se escriben con sus llaves, que es lo unico que cambia de forma.
 *
 * El `satisfies` no es decoracion: es lo que hace que una entrada de menos aqui no compile.
 */
export const FRASES_DEL_MARCO = {
  // ── La barra global ──────────────────────────────────────────────────────────────────────────
  alternarElCarril: 'Mostrar u ocultar el menu',
  buscar: 'Buscar',
  atajoDeLaPaleta: 'Ctrl K',
  avisosSinLeer: '{{count}} aviso sin leer',
  opcionesDeLaSesion: 'Opciones de la sesion',
  avisos: TEXTOS_DE_LA_UI.avisos,

  // ── El carril de modulos ─────────────────────────────────────────────────────────────────────
  filtrarElCarril: 'Filtrar modulos y destinos',
  modulos: 'Modulos',
  elijaUnDestino: 'Elija el destino que quiere abrir.',
  nadaCasaEnElArbol: 'Ningun modulo ni destino coincide con «{{filtro}}».',
  sinGuardar: 'sin guardar',

  // ── La paleta de mando ───────────────────────────────────────────────────────────────────────
  buscarUnDestino: 'Buscar un destino',
  sugerenciasDeLaPaleta: TEXTOS_DE_LA_UI.sugerencias,
  marcadorDeLaPaleta: 'Un modulo o un destino…',
  cerrarLaPaleta: 'Esc',
  nadaCasaEnLaPaleta: 'Ningun destino coincide con lo que escribio.',
  cuantosDestinos: '{{casan}} de {{count}} destino',

  // ── El cuerpo ────────────────────────────────────────────────────────────────────────────────
  sinDestinoAbierto: 'No hay ningun destino abierto. Elija uno en el arbol de la izquierda.',
  destinoNoOfrecido:
    'Esa direccion no corresponde a ningun destino disponible para esta cuenta. Elija uno en el ' +
    'arbol de la izquierda.',
  ruta: TEXTOS_DE_LA_UI.ruta,

  // ── Las acciones al pie ──────────────────────────────────────────────────────────────────────
  volver: 'Volver',
  limpiar: 'Limpiar',
  guardar: 'Guardar',
  exportar: 'Exportar',
  imprimir: 'Imprimir',
  // LAS DOS DE CONTENIDO que no son las de la libreria: salen del artboard V8 (#58). El de consulta
  // dice lo que este sistema ensena —un conjunto SELLADO, que no cambia con la fecha— y no lo que
  // ensena un padron. Ver `src/pantallas/avisos.ts`.
  nadaSeEscribeTodavia: AVISOS_DEL_PIE.escritura,
  datosDeHoy: AVISOS_DEL_PIE.consulta,

  // ── El aviso de cambios sin guardar ──────────────────────────────────────────────────────────
  hayCambiosSinGuardar: '{{rotulo}} tiene cambios sin guardar',
  losCambiosSePierden:
    'Si cierra la pantalla se pierden. Guardelos primero o cierrela descartandolos: eso no se ' +
    'puede deshacer.',
  salirYPerderLosCambios: 'Salir y perder los cambios',
  seguirEditando: 'Seguir editando',
  guardarYCerrar: 'Guardar y cerrar',
} as const satisfies Record<keyof TextosDelArmazon, string>;

/**
 * Todo lo que este archivo aporta al inventario del locale. Ver `catalogo-de-claves.ts`.
 *
 * Lo que dice el INTERPRETE por su cuenta no esta aqui: es otro saco y otro destinatario, y vive en
 * `textosDelInterprete.ts`.
 */
export function clavesDelMarco(): readonly string[] {
  return Object.values(FRASES_DEL_MARCO);
}

/**
 * **El saco que `<Armazon>` recibe, con las treinta y dos ya pasadas por `t()`.**
 *
 * Un objeto de CAPTADORES y no de valores: lo que se guarda es la clave, y `t()` corre cuando el
 * marco lee la propiedad —o sea, en la pintada—. Con valores, el idioma quedaria congelado en el
 * del arranque, que es exactamente el defecto que `alCambiarElIdioma` describe en `i18n.ts`.
 *
 * Las cuatro que llevan un dato dentro ya son funciones, y una funcion se evalua al llamarla: no
 * necesitan captador.
 *
 * `enumerable` va puesto —es lo que `Object.keys` y `Object.entries` miran— porque de eso viven el
 * inventario de `todo-el-texto-se-traduce` y el propio `<Armazon>`, que esparce el saco sobre sus
 * valores por omision.
 */
function saco(): TextosDelArmazon {
  const conCaptadores = {
    avisosSinLeer: (cuantos: number) => t(FRASES_DEL_MARCO.avisosSinLeer, { count: cuantos }),
    nadaCasaEnElArbol: (filtro: string) => t(FRASES_DEL_MARCO.nadaCasaEnElArbol, { filtro }),
    // `casan` va como interpolacion normal y `ofrecidos` como `count`: el plural lo decide CUANTOS
    // HAY, no cuantos casan — «1 de 4 destinos», no «1 de 4 destino».
    cuantosDestinos: (casan: number, ofrecidos: number) =>
      t(FRASES_DEL_MARCO.cuantosDestinos, { casan, count: ofrecidos }),
    hayCambiosSinGuardar: (rotulo: string) => t(FRASES_DEL_MARCO.hayCambiosSinGuardar, { rotulo }),
  } as Record<string, unknown>;

  for (const [clave, frase] of Object.entries(FRASES_DEL_MARCO)) {
    if (clave in conCaptadores) continue;
    Object.defineProperty(conCaptadores, clave, { get: () => t(frase), enumerable: true });
  }

  return conCaptadores as unknown as TextosDelArmazon;
}

/** El saco, una vez. Su identidad es estable; lo que cambia con el idioma es lo que devuelve. */
export const TEXTOS_DEL_MARCO_TRADUCIDOS: TextosDelArmazon = saco();
