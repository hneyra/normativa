import { Aviso, Boton, Campo, Icono } from '../ds/index.ts';
import { Cuadros, Publicacion } from '../secciones/index.ts';
import { Ediciones } from '../secciones/Ediciones.tsx';
import { Panel } from '../secciones/Panel.tsx';
import { PASO_DE_APERTURA, PASO_DE_LECTURA } from '../secciones/ediciones.ts';
import type { EstadoDeEdiciones } from '../secciones/estadoDeNormativa.ts';
import { HOJAS, esPropia } from './arbol.ts';
import { Trazos } from './Trazos.tsx';

/**
 * El lienzo: lo que hay debajo de las pestanas.
 *
 * Tiene **cuatro estados**, y ninguno de ellos es una pantalla:
 *
 *   1. **sin pestanas** — no hay nada abierto, y se dice;
 *   2. **una hoja ajena** — la ficha del AC9, que explica de que sistema es esa pantalla y
 *      deja la pestana abierta para volver a ella;
 *   3. **una seccion propia CONSTRUIDA** — se monta. Desde #15 lo estan «Cuadros de
 *      valuación» y «Publicación»;
 *   4. **una seccion propia todavia sin construir** — el hueco: se declara en que issue
 *      llega la pantalla, y se ofrece el campo «Observación»;
 *   5. **una clave que no esta en el arbol** — no puede pasar, y se contesta igual.
 *
 * <h2>Por que el hueco lleva un campo, y por que es ESE campo</h2>
 *
 * El AC6 pide que **editar un campo** marque la pestana con su asterisco. Un lienzo del todo
 * vacio no tiene ninguno con el que demostrarlo, asi que el hueco trae uno — y el que trae
 * no es un relleno cualquiera: la regla 10 del repositorio dice que **toda modificacion de
 * datos exige observacion del usuario**, de modo que el campo que toda pantalla de este
 * sistema va a tener sí o sí es justo este. Cuando #14 construya las dos que faltan, el
 * hueco baja con su campo y la mecanica del estado sucio se queda donde de verdad se
 * escribe.
 *
 * <h2>Y por que las dos de #15 NO lo traen</h2>
 *
 * Porque en ninguna de las dos se escribe nada. Los tres cuadros son NACIONALES —en la base
 * lo impide un CHECK de `municipalidad_id IS NULL`, y escribirlos es del rol
 * `rol_carga_parametros`, que la aplicacion no usa nunca— y la publicacion sirve un conjunto
 * ya sellado, o sea inmutable. Un campo de observacion en una pantalla que no guarda nada
 * seria ofrecer el gesto de guardar donde no hay nada que guardar.
 *
 * Lo que el hueco **no** trae es una sola cifra: ni un conteo de parametros, ni un ETag, ni
 * una UIT. Este es el repositorio cuyo trabajo entero es que las cifras vivan en datos
 * versionados y firmados a dos manos (ADR-0007); una escrita aqui estaria publicada sin
 * ninguna de las dos firmas.
 */
export interface LienzoProps {
  readonly activa: string | null;
  readonly alCerrar: (destino: string) => void;
  /** Abrir otra seccion como pestana, sin salirse del marco. */
  readonly alAbrir: (destino: string) => void;
  /** El ejercicio de trabajo de la barra global: es de que ano hablan las secciones. */
  readonly ejercicio: string;
  /** El toast del marco. Una seccion no cambia de pantalla para decir que algo salio. */
  readonly alAvisar: (texto: string) => void;
  /** Marca la pestana activa como sucia: es lo que pone el asterisco (AC6). */
  readonly alEnsuciar: () => void;
  /**
   * Lo escrito en la observacion de la seccion activa. **Vive en el marco, no aqui** (AC7):
   * el marco desmonta la seccion al cambiar de pestana, y con el estado dentro, escribir e
   * irse al panel dejaria el campo en blanco **con el asterisco puesto**.
   */
  readonly observacion: string;
  readonly alEscribirObservacion: (texto: string) => void;
  /** Lo escrito en «Ediciones». Vive en el marco porque el marco desmonta la seccion. */
  readonly ediciones: EstadoDeEdiciones;
  /** Y como se cambia, que es lo que el Panel usa para abrir una edicion concreta. */
  readonly alCambiarEdiciones: (cambio: Partial<EstadoDeEdiciones>) => void;
}

export function Lienzo({
  activa,
  alCerrar,
  alAbrir,
  ejercicio,
  alAvisar,
  alEnsuciar,
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
            // Sin conjunto solo cabe abrir una version; con uno, se empieza mirando lo que
            // contiene. Los dos identificadores se importan y no se escriben: son los mismos
            // que `pasosPara` usa para decidir que pestanas ofrece.
            paso: conjuntoId === null ? PASO_DE_APERTURA : PASO_DE_LECTURA,
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

  if (activa === 'nor-cuadros') {
    return (
      <main className="kn-marco__lienzo">
        <Cuadros ejercicio={ejercicio} />
      </main>
    );
  }

  if (activa === 'nor-publicacion') {
    return (
      <main className="kn-marco__lienzo">
        <Publicacion ejercicio={ejercicio} alAvisar={alAvisar} alAbrir={alAbrir} />
      </main>
    );
  }

  return (
    <main className="kn-marco__lienzo">
      <div className="kn-marco__hueco">
        <Aviso
          tipo="vacio"
          titulo={`«${hoja.rotulo}» todavía no está construida`}
          detalle={
            'Las cuatro secciones de este módulo están construidas —«Panel» y «Ediciones» en ' +
            '#14, «Cuadros de valuación» y «Publicación» en #15—, así que llegar aquí ' +
            'significa que el árbol declara un submódulo que este lienzo no sabe dibujar. Es ' +
            'un defecto del código, no un issue pendiente.'
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
