import { Aviso, Boton, Esqueleto, Icono, Insignia } from '../ds/index.ts';
import {
  RUTAS,
  type ConjuntoResource,
  type EjercicioParametrizadoResource,
} from '../datos/lecturas.ts';
import { useLista, useUno } from '../datos/useRecurso.ts';
import { formatearFecha } from '../dominio/formato.ts';
import { SIN_DATO, codigoDelError, esVigente, selladosDe, selloDe } from './conjuntos.ts';
import { DECISIONES, SELLO_DE_2026, SIN_ARCHIVO, cuantasAbiertas, filasSinArchivoDe } from './panel.ts';

/**
 * El Panel de Normativa (`nor-panel`): **en que estado esta el ejercicio, y que le falta**.
 *
 * <h2>Funciona con menos privilegio que Ediciones, y se nota (AC2)</h2>
 *
 * Sus dos lecturas no exigen lo mismo:
 *
 * <ul>
 *   <li>`GET /seguridad/parametros/ejercicios/{ejercicio}` va con el centinela
 *       {@code SESION_PROPIA}: **la ve cualquier autenticado**. Es la unica de las cuatro que no
 *       exige el acceso `parametros`, y su motivo esta escrito en `ParametrosController`: quien
 *       fracciona o quien determina necesita saber si el ejercicio esta parametrizado **antes**
 *       de rellenar el formulario, y no tiene por que administrar los parametros del sistema.</li>
 *   <li>`GET /seguridad/parametros` si exige `parametros`, que es una opcion del modulo
 *       Seguridad.</li>
 * </ul>
 *
 * Asi que el Panel se dibuja entero con la primera y **degrada la segunda**: sin el acceso, el
 * bloque de las versiones dice que hace falta el permiso —no «no se pudo leer», que mandaria a
 * reintentar algo que va a salir igual— y el resto de la pantalla sigue contestando. Fallar
 * entero por una lectura que no todo el mundo puede hacer seria dejar sin panel justo a quien lo
 * necesita.
 *
 * <h2>Un ejercicio sin sellar es un 200, no un 404 (AC2)</h2>
 *
 * `sellado: false` con `conjuntoId` y `version` nulos **es una respuesta**. No se pinta como
 * error, y esa distincion no es cosmetica: «este ejercicio no tiene conjunto sellado» se arregla
 * componiendo y sellando uno, y «no pude preguntarlo» se arregla levantando algo. Lo que si sale
 * distinto es un ejercicio fuera de 1990-2100, que es un 422 nombrando el rango.
 *
 * <h2>Y el vacio no es el mismo vacio (AC1bis)</h2>
 *
 * El conjunto es **por municipalidad**: `conjunto_parametros` lleva `municipalidad_id` con RLS
 * estricta. Que el ejercicio 2026 este sellado en este repositorio —lo esta, desde el
 * 2026-09-06— **no le da uno a una municipalidad recien implantada**, y esa es la primera
 * pantalla que va a ver. Tiene que leerse como el estado de quien empieza y no como un fallo de
 * carga: por eso lleva su salida dentro, y por eso el texto dice que lo que la ley fija ya esta
 * publicado y lo que falta es el acto de ESTA municipalidad.
 *
 * <h2>Ninguna cifra tributaria se escribe aqui (AC10, regla 5)</h2>
 *
 * Ni una. Los conteos que se dibujan salen de la respuesta o de `panel.ts`, que declara de donde
 * se midio cada uno; las cifras del dominio —la UIT, las alicuotas, los valores unitarios— viven
 * en el conjunto sellado y se piden. Este es el repositorio que existe para que sea asi.
 */
export interface PanelProps {
  /** El ejercicio de la barra global. Decide de que ano se pregunta el estado. */
  readonly ejercicio: string;
  /** Abre «Ediciones» en ese conjunto, o en el formulario de apertura con `null`. */
  readonly alAbrirEdicion: (conjuntoId: number | null) => void;
}

/** Cuantas filas de esqueleto ocupan el sitio de una lista mientras llega. */
const HUECOS = [0, 1, 2];

export function Panel({ ejercicio, alAbrirEdicion }: PanelProps) {
  const anio = Number(ejercicio);
  const estado = useUno<EjercicioParametrizadoResource>(
    Number.isFinite(anio) ? RUTAS.ejercicio(anio) : null,
  );
  const conjuntos = useLista<ConjuntoResource>(RUTAS.conjuntos);

  const servidos = conjuntos.dato ?? [];
  const sellados = selladosDe(servidos, anio);
  const sinAcceso = codigoDelError(conjuntos.error) === 'SIN_PRIVILEGIO';
  const hayConjunto = estado.dato?.sellado === true;

  return (
    <main className="kn-marco__lienzo kn-seccion kn-panel">
      <section
        className={`kn-tarjeta kn-panel__estado kn-panel__estado--${hayConjunto ? 'sellado' : 'sin-sellar'}`}
        aria-busy={estado.cargando}
        aria-labelledby="kn-panel-estado"
      >
        {estado.error !== null && (
          <Aviso
            tipo="error"
            titulo="No se pudo preguntar por el ejercicio"
            detalle={estado.error}
          />
        )}

        {estado.error === null && estado.cargando && (
          <div className="kn-panel__cargando">
            <Esqueleto alto={22} ancho="42%" />
            <Esqueleto alto={14} ancho="90%" />
            <Esqueleto alto={14} ancho="76%" />
          </div>
        )}

        {estado.error === null && !estado.cargando && (
          <>
            <div className="kn-panel__estado-cabecera">
              <span className="kn-panel__estado-icono">
                <Icono nombre={hayConjunto ? 'visto' : 'alerta'} tamano={19} grosor={2.2} />
              </span>
              <h2 className="kn-panel__estado-titulo" id="kn-panel-estado">
                {hayConjunto
                  ? `El ejercicio ${ejercicio} está sellado`
                  : `El ejercicio ${ejercicio} no tiene ningún conjunto sellado`}
              </h2>
              <Insignia tono={hayConjunto ? 'ok' : 'atencion'}>
                {hayConjunto ? 'Se puede emitir' : 'No se puede emitir'}
              </Insignia>
            </div>

            <p className="kn-panel__estado-texto">
              {hayConjunto
                ? `Rige el conjunto ${String(estado.dato?.conjuntoId ?? '')}, versión ${String(
                    estado.dato?.version ?? '',
                  )}. A partir del sello, toda cifra emitida con él se puede volver a producir: hoy y dentro de diez años, con el mismo céntimo.`
                : 'Y no es un fallo de carga: es el estado de quien empieza. El conjunto es POR MUNICIPALIDAD —`conjunto_parametros` lleva `municipalidad_id` con RLS estricta—, así que un ejercicio sellado en el corpus no le da uno a esta municipalidad. Lo que la ley fija ya está publicado y es común a todas; lo que falta es el acto de ESTA municipalidad: abrir una versión, componerla con las llaves que necesita y sellarla. Hasta entonces ninguna operación que calcule puede correr, y lo dirá nombrando el ejercicio en vez de devolver una cifra por omisión.'}
            </p>

            <div className="kn-panel__estado-pie">
              <p className="kn-panel__estado-nota">
                Es lo que contesta <code>GET /seguridad/parametros/ejercicios/{ejercicio}</code>,
                la única de las cuatro operaciones que no exige el acceso «parametros». «No hay
                conjunto sellado» es una respuesta y llega como 200, no como 404.
              </p>
              <Boton
                variante="primario"
                onClick={() => {
                  alAbrirEdicion(hayConjunto ? (estado.dato?.conjuntoId ?? null) : null);
                }}
              >
                {hayConjunto
                  ? `Ver el conjunto ${String(estado.dato?.conjuntoId ?? '')}`
                  : 'Abrir la primera versión'}
              </Boton>
            </div>
          </>
        )}
      </section>

      {SELLO_DE_2026.ejercicio === anio && (
        <section className="kn-tarjeta kn-panel__sello" aria-labelledby="kn-panel-sello">
          <h2 className="kn-tarjeta__titulo" id="kn-panel-sello">
            Con qué se selló {String(SELLO_DE_2026.ejercicio)}
          </h2>
          <p className="kn-tarjeta__nota">
            Medido el {formatearFecha(SELLO_DE_2026.fecha)} sobre PostgreSQL real, componiendo y
            sellando la versión {String(SELLO_DE_2026.version)}. Es de norma nacional y común a
            todas las municipalidades: publicarlo no es componerlo.
          </p>
          <dl className="kn-panel__cifras">
            <div className="kn-panel__cifra">
              <dt>Filas del derivado del corpus</dt>
              <dd>{String(SELLO_DE_2026.filasDelCorpus)}</dd>
            </div>
            <div className="kn-panel__cifra">
              <dt>Ediciones de cuadro nacional</dt>
              <dd>{String(SELLO_DE_2026.cuadros)}</dd>
            </div>
            <div className="kn-panel__cifra">
              <dt>Detalles compuestos</dt>
              <dd>{String(SELLO_DE_2026.detalles)}</dd>
            </div>
            <div className="kn-panel__cifra">
              <dt>Filas del mapa sin archivo</dt>
              <dd>{String(SIN_ARCHIVO.length)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section
        className="kn-tarjeta kn-panel__versiones"
        aria-busy={conjuntos.cargando}
        aria-labelledby="kn-panel-versiones"
      >
        <h2 className="kn-tarjeta__titulo" id="kn-panel-versiones">
          Versiones selladas del ejercicio {ejercicio}
        </h2>
        <p className="kn-tarjeta__nota">
          Puede haber varias del mismo año y no es un error: <code>conjunto_uq</code> lleva la
          versión, y la lectura ordena por versión y toma la última. La marcada es la que rige.
        </p>

        {sinAcceso && (
          <Aviso
            tipo="sin-permiso"
            titulo="Hace falta el acceso «parametros» para ver las versiones"
            detalle={
              'El estado del ejercicio se lee con la sesión propia y por eso está arriba. Este ' +
              'listado no: lo publica una opción del módulo Seguridad, y quien no la tiene ve el ' +
              'panel igual, sin las versiones.'
            }
          />
        )}

        {!sinAcceso && conjuntos.error !== null && (
          <Aviso
            tipo="error"
            titulo="No se pudieron leer las versiones"
            detalle={conjuntos.error}
          />
        )}

        {conjuntos.error === null && conjuntos.cargando && (
          <div className="kn-panel__cargando">
            {HUECOS.map((hueco) => (
              <Esqueleto key={hueco} alto={14} ancho="70%" />
            ))}
          </div>
        )}

        {conjuntos.error === null && !conjuntos.cargando && sellados.length === 0 && (
          <Aviso
            tipo="vacio"
            titulo={`Ninguna versión sellada de ${ejercicio}`}
            detalle="Componer una versión y sellarla es lo siguiente, y se hace en «Ediciones»."
          >
            <Boton
              variante="primario"
              onClick={() => {
                alAbrirEdicion(null);
              }}
            >
              Abrir la primera versión
            </Boton>
          </Aviso>
        )}

        {conjuntos.error === null && !conjuntos.cargando && sellados.length > 0 && (
          <ul className="kn-panel__lista">
            {sellados.map((conjunto) => (
              <li className="kn-panel__version" key={conjunto.id}>
                <span className="kn-panel__version-rotulo">
                  Versión {String(conjunto.version)}
                  <span className="kn-panel__version-id">conjunto {String(conjunto.id)}</span>
                </span>
                <span className="kn-panel__version-sello">{selloDe(conjunto)}</span>
                {esVigente(servidos, conjunto) ? (
                  <Insignia tono="info">Vigente</Insignia>
                ) : (
                  <Insignia tono="ok">Sellado</Insignia>
                )}
                <Boton
                  menudo
                  onClick={() => {
                    alAbrirEdicion(conjunto.id);
                  }}
                >
                  Abrir
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="kn-tarjeta kn-panel__sin-archivo" aria-labelledby="kn-panel-sin-archivo">
        <h2 className="kn-tarjeta__titulo" id="kn-panel-sin-archivo">
          Lo que ese sello no incluye: {String(SIN_ARCHIVO.length)} filas sin archivo del corpus
        </h2>
        <p className="kn-tarjeta__nota">
          Las {String(SIN_ARCHIVO.length)} son de acto propio de la municipalidad
          —{String(filasSinArchivoDe('D-02b'))} de D-02b y {String(filasSinArchivoDe('D-02c'))} de
          D-02c—, así que este repositorio no las puede publicar. Van nombradas una a una porque
          «faltan cosas» no es una lista: quien selle el conjunto de SU municipalidad tiene que
          poder ver si alguna es suya.
        </p>
        <div className="kn-tabla__marco">
          <table className="kn-tabla kn-tabla--sin-archivo">
            <thead>
              <tr>
                <th scope="col">Fila</th>
                <th scope="col">Qué</th>
                <th scope="col">Parte de</th>
              </tr>
            </thead>
            <tbody>
              {SIN_ARCHIVO.map((fila) => (
                <tr key={fila.fila}>
                  <td className="kn-tabla__td--clave">{fila.fila}</td>
                  <td>{fila.que}</td>
                  <td>{fila.parte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kn-tarjeta kn-panel__decisiones" aria-labelledby="kn-panel-decisiones">
        <h2 className="kn-tarjeta__titulo" id="kn-panel-decisiones">
          Decisiones del registro: {String(cuantasAbiertas())} abiertas ·{' '}
          {String(DECISIONES.length - cuantasAbiertas())} cerrada para{' '}
          {String(SELLO_DE_2026.ejercicio)}
        </h2>
        <ul className="kn-panel__lista">
          {DECISIONES.map((decision) => (
            <li
              className={`kn-panel__decision kn-panel__decision--${decision.abierta ? 'abierta' : 'cerrada'}`}
              key={decision.id}
            >
              <span className="kn-panel__decision-cabecera">
                <span className="kn-panel__decision-id">{decision.id}</span>
                <span className="kn-panel__decision-titulo">{decision.titulo}</span>
                <Insignia tono={decision.tono}>{decision.estado}</Insignia>
              </span>
              <span className="kn-panel__decision-detalle">{decision.detalle}</span>
            </li>
          ))}
        </ul>
        <p className="kn-tarjeta__pie">
          D-11 está cerrada <strong>y sólo para {String(SELLO_DE_2026.ejercicio)}</strong>: no se
          hereda. Sellar {String(SELLO_DE_2026.ejercicio + 1)} dando por bueno ese fundamento
          escribiría un «% actualización» que nadie ha comprobado para{' '}
          {String(SELLO_DE_2026.ejercicio + 1)}, y su valor neutro es cero, no uno.
        </p>
      </section>

      <p className="kn-seccion__pie">
        Lo que no está aquí no está en ninguna respuesta: ni los conteos por conjunto ni la
        composición de un sello los publica operación alguna, así que salen de donde se midieron
        y no de una cifra escrita a ojo. Lo que sí llega del backend son las dos lecturas de
        arriba. {SIN_DATO} donde no hay dato.
      </p>
    </main>
  );
}
