import { Icono } from '../ds/index.ts';
import { ARBOL, MODULO_PROPIO } from './arbol.ts';
import { Trazos } from './Trazos.tsx';

/**
 * La barra global de V6 (AC3): 52 px de alto sobre `--azul-oscuro`.
 *
 * El orden es el que el AC3 fija, y **no es exactamente el del artboard**: a la izquierda
 * van el control de hamburguesa, el lanzador de nueve puntos y la entidad; desde el borde
 * derecho, el usuario, el buscador y el ejercicio. El artboard dibuja el lanzador a la
 * derecha, pegado al usuario; el AC3 lo manda junto a la hamburguesa, y se dice aqui en vez
 * de dejar que la diferencia se lea como un descuido del port. El aviso de servicio no
 * aparece en esa lista porque **va y viene**: se descarta y no vuelve, asi que no puede
 * fijar el sitio de nada; queda donde el artboard lo pone, detras de la entidad.
 *
 * **El escudo no se porta**: el artboard dibuja `escudo-catacaos.png` y ese archivo no
 * existe en el repositorio. Un `<img>` a un archivo que no esta deja un icono roto en la
 * barra de todas las pantallas, asi que hasta que llegue el archivo va el nombre solo. El
 * hueco esta escrito aqui y no en un tablero aparte.
 *
 * **El selector de ejercicio es global a la sesion**, no de una pantalla: en este sistema el
 * ejercicio es la clave de casi todo lo que se lee —de que ano se compone y se sella el
 * conjunto—, asi que ponerlo dentro de una seccion obligaria a repetirlo en las cuatro y a
 * que dos de ellas pudieran discrepar.
 *
 * **El lanzador abre el Panel del modulo elegido**, y no un aviso flotante. El artboard
 * contestaba con «Abriría el módulo X» porque en el prototipo cada modulo era otro archivo;
 * aqui los diez estan en el arbol, sus destinos existen y abrirlos es lo que el gesto
 * promete.
 */

/** Las opciones del menu de sesion, con sus trazos tal como el artboard los escribe. */
const OPCIONES_DE_SESION = [
  {
    rotulo: 'Mi perfil',
    trazos: ['M12 7.4a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M3.6 20c0-3 2.4-4.6 5.4-4.6s5.4 1.6 5.4 4.6'],
    salida: false,
  },
  {
    rotulo: 'Cambiar contraseña',
    trazos: ['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13v9.5h-13z'],
    salida: false,
  },
  {
    rotulo: 'Cerrar sesión',
    trazos: [
      'M9.5 20H6A1.5 1.5 0 0 1 4.5 18.5v-13A1.5 1.5 0 0 1 6 4h3.5',
      'M14 8l4 4-4 4',
      'M18 12H9',
    ],
    salida: true,
  },
] as const;

/** Los nueve puntos del lanzador: tres filas por tres columnas. */
const PUNTOS = [0, 1, 2].flatMap((fila) =>
  [0, 1, 2].map((columna) => ({ x: 6 + columna * 6, y: 6 + fila * 6 })),
);

/**
 * Los ejercicios que la sesion puede tomar, en el orden del artboard.
 *
 * **2027 va el segundo y no el ultimo**, que es lo que el artboard escribe: en este sistema
 * el ano que viene se compone ANTES de que empiece, asi que el ejercicio siguiente esta mas
 * a mano que los dos anteriores.
 */
export const EJERCICIOS = ['2026', '2027', '2025', '2024'] as const;

/** Quien esta en la sesion, tal como el artboard la dibuja. */
const SESION = {
  iniciales: 'HN',
  nombre: 'H. Neyra Alama',
  papel: 'Normativa · parámetros',
  acceso: 'hneyra · acceso «parametros»',
  usuario: 'hneyra',
} as const;

export interface BarraGlobalProps {
  readonly entidad: string;
  readonly ejercicio: string;
  readonly alCambiarEjercicio: (ejercicio: string) => void;
  readonly panelAbierto: boolean;
  readonly alAlternarPanel: () => void;
  readonly lanzadorAbierto: boolean;
  readonly alAlternarLanzador: () => void;
  readonly alAbrirPaleta: () => void;
  readonly sesionAbierta: boolean;
  readonly alAlternarSesion: () => void;
  readonly alCerrarSesion: () => void;
  readonly hayAviso: boolean;
  readonly alVerAviso: () => void;
  readonly cuantasSucias: number;
  readonly alAbrir: (destino: string) => void;
  readonly alAvisar: (mensaje: string) => void;
}

export function BarraGlobal({
  entidad,
  ejercicio,
  alCambiarEjercicio,
  panelAbierto,
  alAlternarPanel,
  lanzadorAbierto,
  alAlternarLanzador,
  alAbrirPaleta,
  sesionAbierta,
  alAlternarSesion,
  alCerrarSesion,
  hayAviso,
  alVerAviso,
  cuantasSucias,
  alAbrir,
  alAvisar,
}: BarraGlobalProps) {
  return (
    <header className="kn-marco__barra">
      <button
        type="button"
        onClick={alAlternarPanel}
        aria-label="Mostrar u ocultar las secciones de Normativa"
        aria-expanded={panelAbierto}
        title={panelAbierto ? 'Ocultar las secciones' : 'Mostrar las secciones'}
        className={`kn-marco__control${panelAbierto ? ' kn-marco__control--activo' : ''}`}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="kn-marco__relativo">
        <button
          type="button"
          onClick={alAlternarLanzador}
          aria-label="Ver todos los módulos"
          aria-expanded={lanzadorAbierto}
          title="Todos los módulos"
          className={`kn-marco__control${lanzadorAbierto ? ' kn-marco__control--activo' : ''}`}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            {PUNTOS.map((punto) => (
              <circle
                key={`${String(punto.x)}-${String(punto.y)}`}
                cx={punto.x}
                cy={punto.y}
                r={1.9}
              />
            ))}
          </svg>
        </button>

        {lanzadorAbierto && (
          <>
            <button
              type="button"
              onClick={alAlternarLanzador}
              aria-label="Cerrar la lista de módulos"
              className="kn-marco__velo kn-marco__velo--claro"
            />
            <div
              role="dialog"
              aria-label="Módulos del sistema"
              className="kn-marco__lanzador kn-marco__lanzador--izquierda"
            >
              <div className="kn-marco__lanzador-cabecera">
                <p className="kn-marco__lanzador-titulo">Módulos</p>
                <p className="kn-marco__lanzador-nota">Los diez comparten este marco</p>
              </div>
              <div className="kn-marco__lanzador-rejilla">
                {ARBOL.map((modulo) => {
                  const propio = modulo.rotulo === MODULO_PROPIO;
                  const primero = modulo.submodulos[0];
                  return (
                    <button
                      key={modulo.clave}
                      type="button"
                      onClick={() => {
                        if (primero !== undefined) {
                          alAbrir(primero.clave);
                        }
                      }}
                      aria-current={propio}
                      className={`kn-marco__lanzador-modulo${
                        propio ? ' kn-marco__lanzador-modulo--actual' : ''
                      }`}
                    >
                      <span
                        className={`kn-marco__lanzador-icono${
                          propio ? ' kn-marco__lanzador-icono--actual' : ''
                        }`}
                      >
                        <Trazos trazos={modulo.trazos} tamano={17} />
                      </span>
                      <span className="kn-marco__lanzador-rotulo">{modulo.rotulo}</span>
                    </button>
                  );
                })}
              </div>
              <p className="kn-marco__lanzador-pie">
                El ejercicio de trabajo es global a la sesión. Aquí decide qué conjunto se
                compone; en los demás módulos, con qué cifras se calcula.
              </p>
            </div>
          </>
        )}
      </div>

      <span className="kn-marco__entidad">
        <span className="kn-marco__entidad-nombre">{entidad}</span>
        <span className="kn-marco__entidad-nota">Sistema de gestión tributaria municipal</span>
      </span>

      {hayAviso && (
        <button
          type="button"
          onClick={alVerAviso}
          aria-label="1 aviso del sistema"
          title="1 aviso del sistema"
          className="kn-marco__control kn-marco__control--filo"
        >
          <Trazos
            trazos={[
              'M18 15.6V10.5a6 6 0 0 0-12 0v5.1L4.4 18h15.2z',
              'M9.8 18a2.2 2.2 0 0 0 4.4 0',
            ]}
            tamano={17}
          />
          <span className="kn-marco__globo">1</span>
        </button>
      )}

      <div className="kn-marco__ejercicio">
        <span className="kn-marco__ejercicio-rotulo">Ejercicio</span>
        <select
          value={ejercicio}
          onChange={(evento) => {
            alCambiarEjercicio(evento.target.value);
          }}
          aria-label="Ejercicio de trabajo"
          className="kn-marco__ejercicio-selector"
        >
          {EJERCICIOS.map((anio) => (
            <option key={anio} value={anio}>
              {anio}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={alAbrirPaleta}
        aria-label="Buscar"
        title="Buscar — Ctrl K"
        className="kn-marco__control kn-marco__control--filo"
      >
        <Icono nombre="lupa" tamano={16} grosor={1.8} />
      </button>

      <div className="kn-marco__sesion">
        <button
          type="button"
          onClick={alAlternarSesion}
          aria-expanded={sesionAbierta}
          aria-label={`Sesión de ${SESION.nombre}`}
          className={`kn-marco__sesion-boton${
            sesionAbierta ? ' kn-marco__sesion-boton--activo' : ''
          }`}
        >
          <span className="kn-marco__avatar">{SESION.iniciales}</span>
          <span className="kn-marco__sesion-quien">
            <span className="kn-marco__sesion-nombre">{SESION.nombre}</span>
            <span className="kn-marco__sesion-papel">{SESION.papel}</span>
          </span>
          <span className={`kn-marco__caret${sesionAbierta ? ' kn-marco__caret--arriba' : ''}`}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.1}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 9.5l6 6 6-6" />
            </svg>
          </span>
        </button>

        {sesionAbierta && (
          <>
            <button
              type="button"
              onClick={alCerrarSesion}
              aria-label="Cerrar el menú de sesión"
              className="kn-marco__velo kn-marco__velo--claro"
            />
            <div role="menu" aria-label="Sesión" className="kn-marco__menu">
              <div className="kn-marco__menu-cabecera">
                <span className="kn-marco__avatar kn-marco__avatar--grande">
                  {SESION.iniciales}
                </span>
                <span className="kn-marco__menu-quien">
                  <span className="kn-marco__menu-nombre">{SESION.nombre}</span>
                  <span className="kn-marco__menu-papel">{SESION.acceso}</span>
                </span>
              </div>
              {/* Del artboard, y es la frase que mas dice de este sistema: la sesion compone
                  y sella; publicar un valor normativo lo hace `rol_carga_parametros`, que la
                  aplicacion no usa nunca. */}
              <p className="kn-marco__menu-nota">
                Componer y sellar es de esta sesión. <b>Publicar un valor normativo no</b>:
                eso lo hace <code>rol_carga_parametros</code>, que la aplicación no usa nunca
                (REQ-03).
              </p>
              <div className="kn-marco__menu-opciones">
                {OPCIONES_DE_SESION.map((opcion) => (
                  <button
                    key={opcion.rotulo}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      alCerrarSesion();
                      alAvisar(
                        opcion.salida
                          ? `Cerraría la sesión de ${SESION.usuario}.`
                          : `Abriría ${opcion.rotulo.toLowerCase()}.`,
                      );
                    }}
                    className={`kn-marco__menu-opcion${
                      opcion.salida ? ' kn-marco__menu-opcion--salida' : ''
                    }`}
                  >
                    <Trazos trazos={opcion.trazos} tamano={15} />
                    <span className="kn-marco__menu-rotulo">{opcion.rotulo}</span>
                  </button>
                ))}
              </div>
              {cuantasSucias > 0 && (
                <p className="kn-marco__menu-aviso">
                  Hay {cuantasSucias}{' '}
                  {cuantasSucias === 1
                    ? 'pestaña con cambios sin guardar. Al cerrar sesión se pierden, y con ellos la observación.'
                    : 'pestañas con cambios sin guardar. Al cerrar sesión se pierden, y con ellas las observaciones.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
