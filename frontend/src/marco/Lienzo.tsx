import { Aviso, Boton, Campo, Icono } from '../ds/index.ts';
import { Ediciones } from '../secciones/Ediciones.tsx';
import { Panel } from '../secciones/Panel.tsx';
import type { EstadoDeEdiciones } from '../secciones/estadoDeNormativa.ts';
import { HOJAS, esPropia } from './arbol.ts';
import { Trazos } from './Trazos.tsx';

/**
 * El lienzo: lo que hay debajo de las pestanas.
 *
 * Tiene **cinco estados**, y solo dos de ellos son una pantalla:
 *
 *   1. **sin pestanas** — no hay nada abierto, y se dice;
 *   2. **una hoja ajena** — la ficha del AC9 de #12, que explica de que sistema es esa
 *      pantalla y deja la pestana abierta para volver a ella;
 *   3. **`nor-panel` y `nor-ediciones`** — las dos secciones de #14, que entran por debajo
 *      del marco sin tocarlo: esa era la promesa de #12 y aqui se cobra;
 *   4. **`nor-cuadros` y `nor-publicacion`** — el hueco que queda, con su campo
 *      «Observación», hasta que #15 las construya;
 *   5. **una clave que no esta en el arbol** — no puede pasar, y se contesta igual.
 *
 * <h2>Por que el hueco que queda lleva un campo, y por que es ESE campo</h2>
 *
 * El AC6 de #12 pide que **editar un campo** marque la pestana con su asterisco. Un lienzo
 * del todo vacio no tiene ninguno con el que demostrarlo, asi que el hueco trae uno — y el
 * que trae no es un relleno cualquiera: la regla 10 del repositorio dice que **toda
 * modificacion de datos exige observacion del usuario**, de modo que el campo que toda
 * pantalla de este sistema va a tener sí o sí es justo este. Con #14 la mecanica del estado
 * sucio ya se ejerce donde de verdad se escribe —los tres formularios de «Ediciones»—, y el
 * hueco la conserva solo para las dos secciones que faltan.
 *
 * Lo que el hueco **no** trae es una sola cifra: ni un conteo de parametros, ni un ETag, ni
 * una UIT. Este es el repositorio cuyo trabajo entero es que las cifras vivan en datos
 * versionados y firmados a dos manos (ADR-0007); una escrita aqui estaria publicada sin
 * ninguna de las dos firmas.
 */
export interface LienzoProps {
  readonly activa: string | null;
  readonly alCerrar: (destino: string) => void;
  /** Abre otra seccion: es lo que usa el Panel para llevar a «Ediciones». */
  readonly alAbrir: (destino: string) => void;
  /** Marca la pestana activa como sucia: es lo que pone el asterisco (AC6). */
  readonly alEnsuciar: () => void;
  readonly alAvisar: (texto: string) => void;
  /** El ejercicio de la barra global: decide de que ano preguntan las dos secciones. */
  readonly ejercicio: string;
  /**
   * Lo escrito en la observacion de la seccion activa. **Vive en el marco, no aqui** (AC7):
   * el marco desmonta la seccion al cambiar de pestana, y con el estado dentro, escribir e
   * irse al panel dejaria el campo en blanco **con el asterisco puesto**.
   */
  readonly observacion: string;
  readonly alEscribirObservacion: (texto: string) => void;
  /** Lo que «Ediciones» recuerda, por el mismo motivo y guardado en el mismo sitio. */
  readonly ediciones: EstadoDeEdiciones;
  readonly alCambiarEdiciones: (cambio: Partial<EstadoDeEdiciones>) => void;
}

export function Lienzo({
  activa,
  alCerrar,
  alAbrir,
  alEnsuciar,
  alAvisar,
  ejercicio,
  observacion,
  alEscribirObservacion,
  ediciones,
  alCambiarEdiciones,
}: LienzoProps) {
  if (activa === null) {
    return (
      <main className="kn-marco__lienzo kn-marco__lienzo--vacio">
        <div className="kn-marco__sin-pestanas">
          <Icono nombre="expediente" tamano={30} grosor={1.5} />
          <p className="kn-marco__sin-pestanas-titulo">No hay ningún submódulo abierto</p>
          <p className="kn-marco__sin-pestanas-detalle">
            Elija uno en el menú de la izquierda y se abrirá como pestaña. Puede tener varios
            abiertos y moverse entre ellos.
          </p>
        </div>
      </main>
    );
  }

  const hoja = HOJAS.get(activa);
  if (hoja === undefined) {
    // No puede pasar: `activa` sale siempre del arbol o del hash, y el hash se valida contra
    // el arbol antes de aceptarse. Se contesta igual en vez de dejar la pantalla en blanco
    // sin una linea en la consola.
    return (
      <main className="kn-marco__lienzo">
        <Aviso
          tipo="error"
          titulo="Ese submódulo no existe"
          detalle={`El marco no conoce ningún submódulo con la clave «${activa}».`}
        />
      </main>
    );
  }

  if (!esPropia(activa)) {
    return (
      <main className="kn-marco__lienzo">
        <div className="kn-marco__ficha">
          <div className="kn-marco__ficha-cabecera">
            <span className="kn-marco__ficha-icono">
              <Trazos trazos={hoja.trazos} tamano={16} />
            </span>
            <span className="kn-marco__ficha-quien">
              <span className="kn-marco__ficha-rotulo">{hoja.rotulo}</span>
              <span className="kn-marco__ficha-modulo">
                {hoja.modulo} · {hoja.nota}
              </span>
            </span>
          </div>
          <p className="kn-marco__ficha-texto">
            Este marco abre cada submódulo como pestaña, de cualquier módulo. La pantalla de «
            {hoja.rotulo}» está diseñada en el archivo de {hoja.modulo}: lo que se prueba aquí
            es la navegación entre varias cosas abiertas a la vez.
          </p>
          <div className="kn-marco__ficha-pie">
            <p className="kn-marco__ficha-nota">
              Puede dejarla abierta y volver a ella desde la barra de pestañas.
            </p>
            <Boton
              onClick={() => {
                alCerrar(activa);
              }}
            >
              Cerrar la pestaña
            </Boton>
          </div>
        </div>
      </main>
    );
  }

  if (activa === 'nor-panel') {
    return (
      <Panel
        ejercicio={ejercicio}
        alAbrirEdicion={(conjuntoId) => {
          alCambiarEdiciones({
            elegida: conjuntoId,
            paso: conjuntoId === null ? 'abrir' : 'parametros',
            vals: {},
            intento: false,
            negativa: null,
          });
          alAbrir('nor-ediciones');
        }}
      />
    );
  }

  if (activa === 'nor-ediciones') {
    return (
      <Ediciones
        ejercicio={ejercicio}
        estado={ediciones}
        alCambiar={alCambiarEdiciones}
        alEnsuciar={alEnsuciar}
        alAvisar={alAvisar}
      />
    );
  }

  return (
    <main className="kn-marco__lienzo">
      <div className="kn-marco__hueco">
        <Aviso
          tipo="vacio"
          titulo={`«${hoja.rotulo}» todavía no está construida`}
          detalle={
            'El marco y las dos primeras secciones ya están: «Panel» y «Ediciones» entraron ' +
            'por debajo de este lienzo sin tocarlo, que era la promesa del reparto. Los tres ' +
            'cuadros de valuación y la publicación del snapshot llegan en #15, y entrarán ' +
            'igual.'
          }
        />
        <div className="kn-marco__observacion">
          <Campo
            etiqueta="Observación"
            tipo="area"
            valor={observacion}
            ph="Por qué se toca lo que se toca"
            ayuda="Regla 10: toda modificación de datos exige observación del usuario. Escribir aquí marca la pestaña con su asterisco."
            alCambiar={(texto) => {
              alEscribirObservacion(texto);
              alEnsuciar();
            }}
          />
        </div>
      </div>
    </main>
  );
}
