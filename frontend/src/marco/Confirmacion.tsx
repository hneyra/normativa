import { Boton } from '../ds/index.ts';

/**
 * Cerrar una pestana con cambios los descarta: se pregunta antes (AC6).
 *
 * **Las tres salidas estan las tres**, y en el orden del artboard: descartar a la izquierda,
 * separada; seguir editando y guardar a la derecha, con guardar de primaria. La salida por
 * omision es guardar, no perder — quien pulsa Enter sin leer no puede acabar tirando lo que
 * escribio.
 *
 * «Descartar y cerrar» no se puede deshacer, y el texto lo dice con esas palabras en vez de
 * con un «¿Está seguro?», que no informa de nada. Y nombra la observacion: en este sistema
 * toda modificacion la exige (regla 10), asi que lo que se pierde al descartar no es solo el
 * dato, es tambien el motivo por el que se tocaba.
 */
export interface ConfirmacionProps {
  readonly rotulo: string;
  readonly alDescartar: () => void;
  readonly alSeguirEditando: () => void;
  readonly alGuardar: () => void;
}

export function Confirmacion({
  rotulo,
  alDescartar,
  alSeguirEditando,
  alGuardar,
}: ConfirmacionProps) {
  return (
    <>
      {/* Pulsar fuera del dialogo es «seguir editando», la salida que no pierde nada. Su
          rotulo NO puede ser «Seguir editando» a secas: seria el mismo nombre accesible que
          el boton de dentro, y quien navega por lista de botones oiria dos veces la misma
          opcion sin poder distinguirlas. */}
      <button
        type="button"
        onClick={alSeguirEditando}
        aria-label="Cerrar el diálogo y seguir editando"
        className="kn-marco__velo"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cerrar con cambios sin guardar"
        className="kn-marco__dialogo"
      >
        <div className="kn-marco__dialogo-cuerpo">
          <span className="kn-marco__dialogo-icono">
            {/* El circulo va como `<circle>` y no como un arco dibujado a mano: es lo que el
                artboard escribe, y un arco «equivalente» no lo es —se nota en el remate del
                trazo—. `Trazos` solo sabe de `<path>`. */}
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.1}
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.6V13M12 16.4h.02" />
            </svg>
          </span>
          <span className="kn-marco__dialogo-texto">
            <p className="kn-marco__dialogo-titulo">{rotulo} tiene cambios sin guardar</p>
            <p className="kn-marco__dialogo-detalle">
              Si cierra la pestaña se pierden, y con ellos la observación que ya escribió.
              Guárdelos primero o ciérrela descartándolos: eso no se puede deshacer.
            </p>
          </span>
        </div>
        <div className="kn-marco__dialogo-acciones">
          <Boton onClick={alDescartar} className="kn-marco__descartar">
            Descartar y cerrar
          </Boton>
          <span className="kn-marco__separador" />
          <Boton onClick={alSeguirEditando}>Seguir editando</Boton>
          <Boton variante="primario" onClick={alGuardar}>
            Guardar y cerrar
          </Boton>
        </div>
      </div>
    </>
  );
}
