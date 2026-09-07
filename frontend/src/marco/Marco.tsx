import { useCallback, useEffect, useReducer, useState } from 'react';

import { Icono } from '../ds/index.ts';
import {
  EDICIONES_AL_EMPEZAR,
  type EstadoDeEdiciones,
} from '../secciones/estadoDeNormativa.ts';
import { BarraGlobal } from './BarraGlobal.tsx';
import { Confirmacion } from './Confirmacion.tsx';
import { Lienzo } from './Lienzo.tsx';
import { PaletaDeComandos } from './PaletaDeComandos.tsx';
import { PanelDeModulos } from './PanelDeModulos.tsx';
import { Trazos } from './Trazos.tsx';
import { HOJAS, MODULO_PROPIO, esPropia } from './arbol.ts';
import { destinoDelHash, marcarHash } from './hash.ts';
import { estadoInicial, reducir } from './pestanas.ts';

/**
 * El marco V6: **se construye una vez y lo usan las cuatro secciones** (F-3).
 *
 * Es la barra global, el arbol de la izquierda, las pestanas, el enrutado por hash y el
 * estado sin guardar. **No es ninguna pantalla**: el lienzo puede estar vacio, y eso es
 * justamente lo que este issue prueba. Las cuatro secciones de Normativa llegan en #14 y
 * #15, y entran por debajo del marco sin tocarlo.
 *
 * <h2>Solo la variante A</h2>
 *
 * De los tres marcos que el artboard conmuta se porta **uno**, el `a`. El conmutador A/B/C
 * no existe en el codigo: el artboard lo declara control del prototipo. Lo que eso implica
 * —252 px, la cola siempre visible, y ni rastro del estado que elegia marco ni de sus tres
 * ramas— lo vigila `verificaciones/marco-sin-selector.test.ts`, que lee el codigo fuente.
 * Una rama muerta no se ve en una revision y no la pone roja ninguna prueba de
 * comportamiento: solo la caza quien la busque por su nombre.
 *
 * <h2>Los tres efectos, y sus tres bajas</h2>
 *
 * Este es el unico archivo del marco con `useEffect`, y son tres: el que sigue el hash a la
 * pestana activa, el que escucha `hashchange` y `keydown`, y el reloj del toast. **Los tres
 * quitan lo que pusieron al desmontar.** El del toast es el que mas duele si falta: un
 * `setTimeout` vivo despues de que React tire el arbol escribe estado sobre un componente
 * que ya no esta, y en las pruebas eso sale como un aviso suelto varias pruebas mas tarde,
 * lejos de la que lo causo.
 */

/** La municipalidad piloto. La pone el marco, no cada pantalla. */
const ENTIDAD = 'Municipalidad Distrital de Catacaos';

/** Cuanto vive un aviso flotante, en milisegundos. Del artboard. */
const VIDA_DEL_TOAST = 3400;

/**
 * El aviso de servicio, del artboard.
 *
 * De los dos que el prototipo trae —uno por cada estado de su conmutador de datos— se porta
 * el de la municipalidad **recien implantada**, y el motivo es el mismo que en
 * `PanelDeModulos`: el conjunto es por municipalidad, y la que acaba de implantarse no tiene
 * ninguno. Que el ejercicio 2026 este sellado —lo esta, desde el 2026-09-06— no le da uno:
 * `conjunto_parametros` lleva `municipalidad_id` con RLS estricta. El otro aviso habla de un
 * 2027 sin conjunto, que es un estado posterior y de otra municipalidad.
 */
const AVISO_DE_SERVICIO =
  'Esta municipalidad no tiene ningún conjunto de parámetros. Hasta que se componga y se ' +
  'selle uno, toda operación que calcule contestará que el ejercicio no está parametrizado, ' +
  'y lo dirá nombrando el año.';

/**
 * El subtitulo de cada seccion propia.
 *
 * El de «Ediciones» era en el artboard un conteo —«1 edición»—. **Esa cifra es un dato**, y
 * los datos no se escriben aqui: escribirla la convertiria en una afirmacion del producto
 * que nada respalda, y ademas el conteo lo dice ya la propia seccion, que lo ha pedido. Los
 * otros tres no son datos sino descripciones, y se copian tal cual.
 */
const SUBTITULOS: Readonly<Record<string, string>> = {
  'nor-ediciones': 'Versiones del conjunto, y su sellado',
  'nor-cuadros': 'Tres cuadros nacionales (ADR-0017)',
  'nor-publicacion': 'El conjunto sellado, entero y descargable',
};

function tituloDe(activa: string | null): string {
  if (activa === null) {
    return 'Sin pestañas abiertas';
  }
  const hoja = HOJAS.get(activa);
  if (hoja === undefined) {
    return MODULO_PROPIO;
  }
  // «Panel» a secas es el rotulo de un submodulo en los diez modulos, asi que el propio
  // dice de quien es. El artboard hace lo mismo.
  if (activa === 'nor-panel') {
    return `Panel de ${MODULO_PROPIO}`;
  }
  return hoja.rotulo;
}

function subtituloDe(activa: string | null, ejercicio: string): string {
  if (activa === null) {
    return '';
  }
  const hoja = HOJAS.get(activa);
  if (hoja === undefined) {
    return '';
  }
  if (!esPropia(activa)) {
    return hoja.modulo;
  }
  if (activa === 'nor-panel') {
    return `Ejercicio ${ejercicio}`;
  }
  return SUBTITULOS[activa] ?? '';
}

export function Marco() {
  const [pestanas, despachar] = useReducer(reducir, destinoDelHash(), estadoInicial);

  const [panelAbierto, fijarPanelAbierto] = useState(true);
  const [filtro, fijarFiltro] = useState('');
  const [desplegado, fijarDesplegado] = useState<string | null>(MODULO_PROPIO);
  const [lanzador, fijarLanzador] = useState(false);
  const [paleta, fijarPaleta] = useState(false);
  const [sesion, fijarSesion] = useState(false);
  const [avisoDescartado, fijarAvisoDescartado] = useState(false);
  const [avisoAbierto, fijarAvisoAbierto] = useState(false);
  const [ejercicio, fijarEjercicio] = useState('2026');
  const [toast, fijarToast] = useState('');
  // AC7 — el estado de la seccion vive AQUI y no dentro de la seccion: el marco la desmonta
  // al cambiar de pestana, y con el estado dentro, escribir la observacion e irse al panel
  // dejaria el campo en blanco **con el asterisco puesto**. Una por seccion, indexada por su
  // clave: dos pestanas abiertas son dos observaciones distintas.
  const [observaciones, fijarObservaciones] = useState<Readonly<Record<string, string>>>({});
  // Lo mismo, para «Ediciones»: el buscador, el chip, el orden, la pagina, la edicion abierta,
  // el paso, lo tecleado y si ya se intento guardar. Es UNA y no una por clave porque la
  // seccion es una sola; lo que la separa de las demas es que aqui vive el formulario.
  const [ediciones, fijarEdiciones] = useState<EstadoDeEdiciones>(EDICIONES_AL_EMPEZAR);

  const abrir = useCallback((destino: string) => {
    despachar({ tipo: 'abrir', destino });
    fijarPaleta(false);
    fijarLanzador(false);
  }, []);

  // El hash sigue a la pestana activa, con `replaceState`: abrir una seccion no es navegar,
  // y con `pushState` el «atras» del navegador haria falta cuarenta veces para salir de la
  // aplicacion (AC5).
  useEffect(() => {
    if (pestanas.activa !== null) {
      marcarHash(pestanas.activa);
    }
  }, [pestanas.activa]);

  useEffect(() => {
    const alCambiarElHash = () => {
      const destino = destinoDelHash();
      if (destino !== null) {
        despachar({ tipo: 'abrir', destino });
      }
    };
    window.addEventListener('hashchange', alCambiarElHash);
    return () => {
      window.removeEventListener('hashchange', alCambiarElHash);
    };
  }, []);

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        // `preventDefault` porque `Ctrl+K` es el atajo del buscador de la barra de
        // direcciones en varios navegadores: sin el, la paleta se abre y el foco se va fuera
        // de la pagina.
        evento.preventDefault();
        fijarPaleta((abierta) => !abierta);
        fijarLanzador(false);
      } else if (evento.key === 'Escape') {
        fijarPaleta(false);
        fijarLanzador(false);
        fijarSesion(false);
        despachar({ tipo: 'cancelar-cierre' });
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => {
      window.removeEventListener('keydown', alPulsar);
    };
  }, []);

  // AC10 — el toast vive 3400 ms y **se cancela al desmontar**. Sin el `clearTimeout`, un
  // toast pendiente llamaria a `setState` sobre un componente que ya no existe.
  useEffect(() => {
    if (toast === '') {
      return;
    }
    const reloj = setTimeout(() => {
      fijarToast('');
    }, VIDA_DEL_TOAST);
    return () => {
      clearTimeout(reloj);
    };
  }, [toast]);

  const cuantasSucias = Object.keys(pestanas.sucias).length;
  const porCerrar = pestanas.porCerrar;
  const hojaPorCerrar = porCerrar === null ? undefined : HOJAS.get(porCerrar);
  const activa = pestanas.activa;

  return (
    <div className="kn-marco">
      {paleta && (
        <PaletaDeComandos
          alAbrir={abrir}
          alCerrar={() => {
            fijarPaleta(false);
          }}
        />
      )}

      <BarraGlobal
        entidad={ENTIDAD}
        ejercicio={ejercicio}
        alCambiarEjercicio={(elegido) => {
          fijarEjercicio(elegido);
          fijarToast(
            `Ejercicio ${elegido}: cambia de qué año se compone y se sella el conjunto.`,
          );
        }}
        panelAbierto={panelAbierto}
        alAlternarPanel={() => {
          fijarPanelAbierto((abierto) => !abierto);
          fijarLanzador(false);
          fijarPaleta(false);
        }}
        lanzadorAbierto={lanzador}
        alAlternarLanzador={() => {
          fijarLanzador((abierto) => !abierto);
          fijarPaleta(false);
          fijarSesion(false);
        }}
        alAbrirPaleta={() => {
          fijarPaleta(true);
          fijarLanzador(false);
          fijarSesion(false);
        }}
        sesionAbierta={sesion}
        alAlternarSesion={() => {
          fijarSesion((abierta) => !abierta);
          fijarLanzador(false);
          fijarPaleta(false);
        }}
        alCerrarSesion={() => {
          fijarSesion(false);
        }}
        hayAviso={!avisoDescartado && !avisoAbierto}
        alVerAviso={() => {
          fijarAvisoAbierto(true);
        }}
        cuantasSucias={cuantasSucias}
        alAbrir={abrir}
        alAvisar={fijarToast}
      />

      <div className="kn-marco__cuerpo">
        {panelAbierto && (
          <PanelDeModulos
            filtro={filtro}
            alFiltrar={fijarFiltro}
            desplegado={desplegado}
            alDesplegar={(modulo) => {
              fijarDesplegado((actual) => (actual === modulo ? null : modulo));
            }}
            activa={activa}
            abiertas={pestanas.abiertas}
            sucias={pestanas.sucias}
            alAbrir={abrir}
          />
        )}

        <div className="kn-marco__area">
          <div className="kn-marco__pestanas" aria-label="Pestañas abiertas" role="group">
            {pestanas.abiertas.map((clave) => {
              // `abiertas` solo lleva claves del arbol —el hash se valida contra el antes de
              // aceptarse—, asi que `hoja` esta siempre. Se cae del lado de ensenar la clave
              // y ningun icono en vez de reventar: una pestana es cromo, y el cromo no tumba
              // la pantalla que envuelve.
              const hoja = HOJAS.get(clave);
              const rotulo = hoja?.rotulo ?? clave;
              const trazos = hoja?.trazos ?? [];
              const esLaActiva = activa === clave;
              const sucia = pestanas.sucias[clave] === true;
              const cerrarAria = sucia
                ? `Cerrar ${rotulo} — tiene cambios sin guardar`
                : `Cerrar ${rotulo}`;

              return (
                <span
                  key={clave}
                  className={`kn-marco__pestana${esLaActiva ? ' kn-marco__pestana--actual' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      abrir(clave);
                    }}
                    aria-current={esLaActiva}
                    className="kn-marco__pestana-boton"
                  >
                    <span className="kn-marco__pestana-icono">
                      <Trazos trazos={trazos} tamano={13} />
                    </span>
                    <span className="kn-marco__pestana-rotulo">
                      {rotulo}
                      {sucia ? ' *' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      despachar({ tipo: 'pedir-cierre', destino: clave });
                    }}
                    aria-label={cerrarAria}
                    title={cerrarAria}
                    className="kn-marco__pestana-cerrar"
                  >
                    <Icono nombre="cerrar" tamano={13} grosor={2.2} />
                  </button>
                </span>
              );
            })}
            <span className="kn-marco__pestanas-resto" />
          </div>

          {activa !== null && (
            <div className="kn-marco__cabecera">
              <h1 className="kn-marco__titulo">{tituloDe(activa)}</h1>
              <span className="kn-marco__subtitulo">{subtituloDe(activa, ejercicio)}</span>
            </div>
          )}

          {!avisoDescartado && avisoAbierto && (
            <div role="status" className="kn-marco__aviso">
              <span className="kn-marco__aviso-icono">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.6V13M12 16.4h.02" />
                </svg>
              </span>
              <p className="kn-marco__aviso-texto">{AVISO_DE_SERVICIO}</p>
              <button
                type="button"
                onClick={() => {
                  fijarAvisoDescartado(true);
                  fijarAvisoAbierto(false);
                }}
                aria-label="Descartar el aviso"
                className="kn-marco__aviso-cerrar"
              >
                <Icono nombre="cerrar" tamano={16} grosor={2.1} />
              </button>
            </div>
          )}

          <Lienzo
            activa={activa}
            alCerrar={(destino) => {
              despachar({ tipo: 'pedir-cierre', destino });
            }}
            alAbrir={abrir}
            alEnsuciar={() => {
              despachar({ tipo: 'ensuciar' });
            }}
            alAvisar={fijarToast}
            ejercicio={ejercicio}
            observacion={activa === null ? '' : (observaciones[activa] ?? '')}
            alEscribirObservacion={(texto) => {
              if (activa !== null) {
                fijarObservaciones((actuales) => ({ ...actuales, [activa]: texto }));
              }
            }}
            ediciones={ediciones}
            alCambiarEdiciones={(cambio) => {
              fijarEdiciones((actual) => ({ ...actual, ...cambio }));
            }}
          />
        </div>
      </div>

      {porCerrar !== null && (
        <Confirmacion
          rotulo={hojaPorCerrar === undefined ? porCerrar : hojaPorCerrar.rotulo}
          alDescartar={() => {
            despachar({ tipo: 'cerrar', destino: porCerrar });
          }}
          alSeguirEditando={() => {
            despachar({ tipo: 'cancelar-cierre' });
          }}
          alGuardar={() => {
            despachar({ tipo: 'cerrar', destino: porCerrar });
            fijarToast(
              `Cambios guardados en ${
                hojaPorCerrar === undefined ? porCerrar : hojaPorCerrar.rotulo
              }.`,
            );
          }}
        />
      )}

      {toast !== '' && (
        <div role="status" className="kn-marco__toast">
          <Icono nombre="visto" tamano={16} grosor={2.6} />
          {toast}
        </div>
      )}
    </div>
  );
}
