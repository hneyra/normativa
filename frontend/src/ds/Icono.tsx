/**
 * Iconografia: SVG de linea, sin libreria y sin emoji.
 *
 * Los trazos **estan copiados de `frontend/diseno/NormativaV6.dc.html`**, uno a uno y con
 * la linea donde vive cada uno. No se redibujaron y no se trajeron de otro repositorio: un
 * icono redibujado a ojo se nota al lado de los que no lo estan.
 *
 * La reja del artboard: `viewBox` 24x24, `stroke` de 1.7, extremos y uniones redondeados, y
 * el color heredado con `currentColor`. Que herede el color es lo que hace que un icono
 * dentro de un boton primario salga blanco y el mismo icono dentro de un aviso salga
 * desvaido, sin que nadie le pase un color — y es tambien lo que impide que un componente
 * escriba un hexadecimal.
 *
 * **Un icono es decorativo por definicion.** Lleva `aria-hidden` y NO admite etiqueta: el
 * significado lo pone el texto que va al lado, y si no hay texto al lado es que falta el
 * texto, no que falte un `aria-label`. Anadirle una prop de etiqueta seria dar por buena la
 * pantalla que no lo tiene.
 */

/**
 * Los trazos, tal como el artboard los escribe, con su linea.
 *
 * Cada entrada del array es un `<path>`; cuando el artboard mete dos subtrazos en una misma
 * `d` —`'M6 6l12 12M18 6L6 18'`— se conserva asi, porque separarlos cambiaria el SVG que se
 * pinta.
 */
const TRAZOS = {
  /** El modulo «Consultas» (`MODULOS`, linea 1159). Es el icono de un vacio de busqueda. */
  lupa: ['M17.4 11a6.4 6.4 0 1 1-12.8 0 6.4 6.4 0 0 1 12.8 0', 'M15.8 15.8 20.6 20.6'],
  /** El expediente del estado vacio de pagina entera (linea 405). */
  expediente: ['M6.5 3.5h7.5l4 4v13h-11.5z', 'M14 3.5v4h4', 'M9.5 12.5h5'],
  /** Las capas de «Ediciones» (`ICO_SEC['nor-ediciones']`, linea 1168; el vacio, 652). */
  ediciones: ['M12 3.6 20.4 8 12 12.4 3.6 8z', 'M3.6 12 12 16.4 20.4 12', 'M3.6 16 12 20.4 20.4 16'],
  /** El triangulo de «Infracciones administrativas» (linea 1157). El icono de un error. */
  alerta: ['M12 4.2 20.8 19.6H3.2z', 'M12 9.8v4.4', 'M12 17.1h.02'],
  /** El candado (linea 847, y `MODULOS` de sesion en 1957). El icono de «sin permiso». */
  candado: ['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13v9.5h-13z'],
  /** El visto de una comprobacion en verde (linea 948). */
  visto: ['M5 12.5l4.5 4.5L19 7'],
  /** La descarga del snapshot (`ICO_SEC['nor-publicacion']`, linea 1170). */
  descarga: ['M12 4.5v10', 'M8 11l4 4 4-4', 'M4.5 18.5h15'],
  /** La cruz de descartar (linea 202). */
  cerrar: ['M6 6l12 12M18 6L6 18'],
} as const;

export type NombreDeIcono = keyof typeof TRAZOS;

export interface IconoProps {
  readonly nombre: NombreDeIcono;
  /** El lado de la caja, en pixeles. El artboard usa 13, 15, 16, 17, 18, 19, 26 y 30. */
  readonly tamano?: number;
  /** El grosor del trazo. El artboard lo afina a 1.5 en los iconos grandes. */
  readonly grosor?: number;
}

export function Icono({ nombre, tamano = 16, grosor = 1.7 }: IconoProps) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre].map((trazo) => (
        <path key={trazo} d={trazo} />
      ))}
    </svg>
  );
}
