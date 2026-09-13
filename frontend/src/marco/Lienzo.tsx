import { Aviso, Boton, Icono } from '../ds/index.ts';
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
 * Decide QUE se dibuja, y **no dibuja ningun campo propio**: lo que se escribe, se escribe
 * dentro de una seccion. Tiene **cinco estados**, en el orden en que el codigo los mira:
 *
 *   1. **sin pestanas** — no hay nada abierto, y se dice;
 *   2. **una clave que no esta en el arbol** — no puede pasar, y se contesta igual;
 *   3. **una hoja ajena** — la ficha del AC9, que explica de que sistema es esa pantalla y
 *      deja la pestana abierta para volver a ella;
 *   4. **una seccion propia** — se monta. Las cuatro lo estan: «Panel» y «Ediciones» desde
 *      #14, «Cuadros de valuación» y «Publicación» desde #15;
 *   5. **el hueco** — una seccion propia que el arbol declara y este lienzo no sabe dibujar.
 *      Hoy no llega ninguna, y el `Aviso` dice que llegar ahi es un defecto del codigo.
 *
 * <h2>Por que el hueco ya no lleva el campo «Observación» (#24)</h2>
 *
 * Lo llevo desde #12 para una sola cosa: el AC6 pedia que **editar un campo** marcara la
 * pestana con su asterisco, y un lienzo sin ninguna seccion construida no tenia otro campo con
 * el que demostrarlo. Con #14 y #15 las cuatro secciones estan cableadas, al hueco no llega
 * ningun submodulo propio, y el campo —con sus dos props, el estado `observaciones` del marco
 * y su llamada a `alEnsuciar`— se quedo sin alcanzar.
 *
 * De las tres salidas que #24 dejaba escritas se eligio **quitarlo**, y no dejarlo como
 * andamiaje ni subirlo al marco como sitio comun de las observaciones. Por tres motivos:
 *
 *   - **la mecanica que demostraba ya se ejerce donde de verdad se escribe**: los tres
 *     formularios de «Ediciones» llaman a `alEnsuciar`, y las pruebas del AC6 y del AC7 de
 *     `Marco.test.tsx` escriben ahi, se van a otra pestana y vuelven;
 *   - **este repositorio no admite ramas muertas**: una prop que solo alimenta codigo al que no
 *     llega nadie tiene la misma forma que el conmutador A/B/C que impide
 *     `verificaciones/marco-sin-selector.test.ts`, y tampoco la pone roja ninguna prueba de
 *     comportamiento — la pantalla se dibuja igual con ella que sin ella;
 *   - **y subirlo no tendria a quien servir**: la unica seccion que escribe guarda su
 *     observacion con el resto de su formulario, en `EstadoDeEdiciones` —que tambien vive en
 *     el marco, y por el mismo motivo—, y las otras tres no escriben nada. Un sitio comun para
 *     una sola seccion seria un segundo sitio donde buscar la misma observacion.
 *
 * Que no vuelva lo vigila `verificaciones/lienzo-sin-campo-propio.test.ts`, que lee el codigo
 * fuente: es la unica forma de ver una prop que no cambia nada de lo que se dibuja.
 *
 * <h2>Lo que el hueco conserva: la red</h2>
 *
 * Su `Aviso`. Un quinto submodulo anadido al arbol sin cablearlo aqui cae en el, y lo pone rojo
 * la prueba `ningun submodulo propio cae al hueco` de `Marco.test.tsx`, que busca su titulo.
 * **Sin el hueco esa prueba no protege nada**: el submodulo sin cablear dibujaria un lienzo en
 * blanco, no encontraria el titulo, y saldria verde.
 *
 * <h2>Por que «Cuadros de valuación» y «Publicación» no piden observacion</h2>
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
      </div>
    </main>
  );
}
