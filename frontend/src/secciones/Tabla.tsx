import { Esqueleto } from '../ds/index.ts';

/**
 * La tabla de las dos secciones de #15, escrita una vez.
 *
 * Es la de `rentas/frontend/src/secciones/Cuadro.tsx` portada a lo que este modulo publica:
 * cabecera con el **nombre del campo del JSON** debajo del rotulo —como el artboard la dibuja—,
 * cifras a la derecha con `tabular-nums`, y un guion donde ninguna operacion publica nada.
 * Existe una vez y no cuatro porque las cuatro tablas de este modulo son la misma; dos copias
 * divergirian, y la que divergiera perderia el `tabular-nums` en silencio, que es justo lo que
 * hace que una columna de cifras se pueda comparar de un vistazo.
 *
 * <h2>El desplazamiento es SUYO, no de la pagina (AC8)</h2>
 *
 * La tabla va dentro de `.kn-tabla__marco`, que es quien lleva `overflow-x: auto`, y el ancho
 * minimo lo lleva la tabla. Sin ese marco, el `min-width` empuja el lienzo entero y el cuerpo de
 * la pagina se desplaza de lado: en cuanto la cabecera y las pestanas salen del campo de vision,
 * quien esta leyendo la fila 300 del cuadro vehicular deja de saber que cuadro esta mirando. Y
 * el cuadro vehicular tiene **siete** columnas: no cabe en un portatil de ventanilla, asi que
 * esto no es el caso extremo sino el caso.
 *
 * <h2>La celda no decide su alineacion</h2>
 *
 * La decide la COLUMNA. Una celda que se alineara sola dejaria una columna de cifras con una
 * fila a la izquierda el dia que a esa fila le faltara el dato, que es exactamente cuando mas se
 * nota.
 */

/** Una columna: su rotulo, el campo del JSON que la sirve y si es de cifras. */
export interface ColumnaDeTabla {
  readonly etiqueta: string;
  /**
   * El nombre del campo en el JSON, tal como el backend lo publica.
   *
   * Se dibuja bajo el rotulo, como en el artboard. No es decoracion para quien programa: es lo
   * que permite leer un contrato y una pantalla como la misma cosa, y es lo unico que no cambia
   * cuando alguien reescribe el rotulo.
   */
  readonly campo: string;
  /** A la derecha y con `tabular-nums`. */
  readonly cifra?: boolean;
  /**
   * El dominio literal del campo, cuando la base lo acota con un CHECK.
   *
   * `partida` admite tres valores y `categoria` una letra de la A a la J porque
   * `valor_unitario_edificacion_partida_check` y `valor_unitario_edificacion_categoria_check` lo
   * dicen. Escribirlo en la cabecera es lo que convierte una columna de texto en una columna con
   * dominio, y es lo que hace notar un valor que no deberia estar ahi.
   */
  readonly dominio?: string;
}

/** Una celda: su texto, o `null` cuando ninguna operacion publica el dato. */
export interface CeldaDeTabla {
  readonly texto: string | null;
  /** Lo que se lee al pasar por encima: por que la celda dice lo que dice. */
  readonly nota?: string;
}

export interface FilaDeTabla {
  /** Identidad estable de la fila. No es el indice: reordenar no puede reusar claves. */
  readonly clave: string;
  readonly celdas: readonly CeldaDeTabla[];
}

export interface TablaProps {
  readonly columnas: readonly ColumnaDeTabla[];
  readonly filas: readonly FilaDeTabla[];
  /** Lo que lee un lector de pantalla al llegar a la tabla. Obligatorio (AC8). */
  readonly rotulo: string;
  readonly cargando: boolean;
  /** Modificador de anchura minima: cuantas columnas tienen que caber sin apretarse. */
  readonly variante: string;
}

/** Lo que ninguna operacion publica. Un guion, y no una celda en blanco. */
const SIN_DATO = '—';

/** Cuantas filas de hueco se dibujan mientras el dato no llega. */
const HUECOS = [0, 1, 2, 3, 4];

function Celda({ celda, cifra }: { readonly celda: CeldaDeTabla; readonly cifra: boolean }) {
  const clase = cifra ? 'kn-tabla__td kn-tabla__td--cifra' : 'kn-tabla__td';

  if (celda.texto === null) {
    return (
      <td className={clase}>
        <span
          className="kn-tabla__sin-dato"
          title={celda.nota ?? 'Ninguna operación publica este dato'}
        >
          {SIN_DATO}
        </span>
      </td>
    );
  }

  return (
    <td className={clase} title={celda.nota}>
      {celda.texto}
    </td>
  );
}

export function Tabla({ columnas, filas, rotulo, cargando, variante }: TablaProps) {
  return (
    <div className="kn-tabla__marco">
      <table className={`kn-tabla kn-tabla--${variante}`} aria-label={rotulo} aria-busy={cargando}>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.campo}
                scope="col"
                className={
                  columna.cifra === true ? 'kn-tabla__th kn-tabla__th--cifra' : 'kn-tabla__th'
                }
              >
                <span className="kn-tabla__rotulo">{columna.etiqueta}</span>
                <span className="kn-tabla__campo">{columna.campo}</span>
                {columna.dominio !== undefined && (
                  <span className="kn-tabla__dominio">{columna.dominio}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando &&
            HUECOS.map((hueco) => (
              <tr key={hueco}>
                {columnas.map((columna) => (
                  <td key={columna.campo} className="kn-tabla__td">
                    <Esqueleto alto={12} />
                  </td>
                ))}
              </tr>
            ))}
          {!cargando &&
            filas.map((fila) => (
              <tr key={fila.clave} className="kn-tabla__tr">
                {fila.celdas.map((celda, i) => (
                  <Celda
                    key={`${fila.clave}-${columnas[i]?.campo ?? String(i)}`}
                    celda={celda}
                    cifra={columnas[i]?.cifra === true}
                  />
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
