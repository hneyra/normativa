/**
 * Lo que las secciones de Normativa recuerdan, y **por que lo recuerda el marco y no ellas**.
 *
 * El marco desmonta la seccion al cambiar de pestana (AC7 de #12). Si este estado viviera
 * dentro, escribir media observacion, mirar el panel y volver dejaria el formulario en blanco
 * **con el asterisco puesto**: la pestana diria que hay cambios sin guardar y no habria ninguno
 * que guardar, y el dialogo de «Descartar y cerrar» preguntaria por algo que ya no existe.
 *
 * Vive donde vive el asterisco. Es la misma decision que #12 tomo con la observacion del hueco,
 * y la misma que `rentas` tomo en `estadoDelPadron.ts`.
 *
 * <h2>El paginado tambien vive aqui, y no es un detalle</h2>
 *
 * `pagina`, `tamano`, `ordenarPor` y `direccion` son los cuatro nombres del dialecto del backend
 * (`GuardiaDeParametros.DIALECTO_DE_LA_PAGINACION`), y componen la ruta que se pide. Si vivieran
 * dentro de la seccion, ir al Panel y volver **relanzaria la peticion de la pagina cero**: quien
 * estaba mirando la pagina cuatro de las ediciones perderia el sitio sin haber tocado nada.
 */

/** Los tres chips de estado del artboard, en su orden. */
export const CHIPS: readonly string[] = ['Todas', 'Abiertas', 'Selladas'];

/**
 * Lo que la seccion «Ediciones» recuerda.
 *
 * `elegida` es el identificador del conjunto abierto en la ficha, o `null`. Con `null` la ficha
 * ensena el unico formulario que **no necesita un conjunto detras**: abrir una version. Es lo
 * que ve una municipalidad recien implantada, que no tiene ninguno (AC1bis).
 */
export interface EstadoDeEdiciones {
  /** Lo tecleado en el buscador. Filtra en el cliente, sobre la pagina servida. */
  readonly q: string;
  /** El chip activo, de `CHIPS`. */
  readonly chip: string;
  /** El campo de orden, de los cuatro que el backend admite. Viaja como `?ordenarPor=`. */
  readonly ordenarPor: string;
  /** `ASCENDENTE` o `DESCENDENTE`. Viaja como `?direccion=`. */
  readonly direccion: string;
  /** Contada desde 0, como en SQL y como la cuenta el backend. */
  readonly pagina: number;
  /** Filas por pagina. Tope 500, que es `Paginacion.TAMANO_MAXIMO`. */
  readonly tamano: number;
  /** El conjunto abierto en la ficha, o `null`. */
  readonly elegida: number | null;
  /** El paso de la ficha que se ve, por su identificador. */
  readonly paso: string;
  /** Lo tecleado en el formulario, por clave de campo. */
  readonly vals: Readonly<Record<string, string>>;
  /** Si ya se intento guardar: es lo que enciende el rojo de los obligatorios vacios (AC7). */
  readonly intento: boolean;
  /**
   * La negativa que contesto el servidor en el ultimo intento, tal como llego.
   *
   * Se guarda **con el estado de la seccion** y no dentro del formulario por el mismo motivo que
   * todo lo demas: quien recibe «el conjunto ya esta sellado», se va al panel a comprobarlo y
   * vuelve, tiene que seguir viendo por que no pudo sellar.
   */
  readonly negativa: string | null;
}

/**
 * Como empieza la seccion.
 *
 * El orden por omision es **por ejercicio y descendente**, que es el orden en que se lee «cual
 * rige»: el ejercicio en curso arriba. El backend ordena por `ejercicio` cuando no se le dice
 * otra cosa (`ParametrosController.conjuntos` pasa `"ejercicio"` como orden por omision), asi
 * que esto no inventa un criterio: lo hace explicito en la ruta.
 */
export const EDICIONES_AL_EMPEZAR: EstadoDeEdiciones = {
  q: '',
  chip: 'Todas',
  ordenarPor: 'ejercicio',
  direccion: 'DESCENDENTE',
  pagina: 0,
  tamano: 20,
  elegida: null,
  // El identificador de `PASO_DE_APERTURA`, escrito y no importado: `ediciones.ts` ya importa
  // el tipo de este archivo, y traerse de alla una constante cerraria el circulo. Que los dos
  // digan lo mismo lo comprueba `ediciones.test.ts`, que si puede mirar los dos lados.
  paso: 'abrir',
  vals: {},
  intento: false,
  negativa: null,
};
