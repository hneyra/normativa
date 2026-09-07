import { Icono } from '../ds/index.ts';
import { Trazos } from './Trazos.tsx';
import { conteoDelFiltro, modulosQueCasan } from './filtro.ts';

/**
 * El panel de la izquierda: **la variante A del artboard, y ninguna otra** (AC2).
 *
 * El artboard dibuja tres marcos conmutables (`panelOpciones`, linea 1808 de
 * `NormativaV6.dc.html`): `a` acordeon con chevron hacia abajo, `b` sin control de
 * despliegue y `c` riel de modulos. **Aqui solo existe la `a`**, que ademas era el valor
 * inicial del prototipo, y el conmutador A/B/C **no se porta**: el propio artboard lo
 * declara control del prototipo y lo esconde antes que cualquier elemento de la aplicacion
 * cuando la barra se estrecha.
 *
 * De quedarse solo con la `a` salen tres consecuencias que no son cosmeticas, y las tres
 * estan aqui:
 *
 *   · el `aside` mide **252 px** —los 292 eran de la `c`, que necesitaba sitio para el riel
 *     de iconos mas la lista—;
 *   · la cola de trabajo **se muestra siempre**, porque `hayCola` era `v !== 'c'` y ya no
 *     hay `c` de la que distinguirse;
 *   · el estado que elegia marco, sus tres ramas y el conmutador **no existen**. Portarlos
 *     habria dejado un `if` que ninguna prueba puede poner en rojo.
 *
 * El chevron apunta abajo cuando el modulo esta cerrado y arriba cuando esta abierto, que es
 * el gesto convencional del desplegable.
 */
export interface PanelDeModulosProps {
  readonly filtro: string;
  readonly alFiltrar: (filtro: string) => void;
  /** El modulo desplegado. Uno a la vez, para que la lista quepa sin desplazar. */
  readonly desplegado: string | null;
  readonly alDesplegar: (modulo: string) => void;
  readonly activa: string | null;
  readonly abiertas: readonly string[];
  readonly sucias: Readonly<Record<string, true>>;
  readonly alAbrir: (destino: string) => void;
}

/**
 * La cola de trabajo del artboard, con sus tres filas y sus cifras.
 *
 * **Son conteos de expedientes y de archivos, no cifras normativas**: ni una UIT, ni una
 * alicuota, ni un valor unitario, asi que la regla 5 no las alcanza —lo que esa regla
 * prohibe es escribir en el codigo una cifra que fija una norma— y ninguna necesita fecha de
 * calculo.
 *
 * El artboard trae DOS juegos, uno por cada estado del conmutador de datos, y se porta el de
 * la municipalidad **recien implantada**. No es una preferencia estetica: hoy, y lo dice el
 * repositorio en su propio `CLAUDE.md`, **ningun ejercicio esta sellado**, asi que ensenar
 * «Ejercicios sin sellar: 1» seria afirmar que hay uno que si lo esta. El dia que la cola
 * venga del backend (#13), viene con su operacion; hasta entonces es lo que el artboard
 * dibuja para el estado en el que este sistema esta.
 */
const COLA = [
  { rotulo: 'Ejercicios sin conjunto', n: '4', tono: 'mal' },
  { rotulo: 'Ediciones abiertas', n: '0', tono: 'atencion' },
  { rotulo: 'Filas sin archivo del corpus', n: '10', tono: 'atencion' },
] as const;

/** A donde lleva una fila de la cola. Las tres hablan de ediciones, como en el artboard. */
const DESTINO_DE_LA_COLA = 'nor-ediciones';

export function PanelDeModulos({
  filtro,
  alFiltrar,
  desplegado,
  alDesplegar,
  activa,
  abiertas,
  sucias,
  alAbrir,
}: PanelDeModulosProps) {
  const hayFiltro = filtro.trim() !== '';
  const visibles = modulosQueCasan(filtro);

  return (
    <aside aria-label="Módulos y submódulos" className="kn-marco__panel">
      <div className="kn-marco__filtro">
        <div className="kn-marco__buscador">
          <Icono nombre="lupa" tamano={14} grosor={1.8} />
          <input
            type="search"
            value={filtro}
            onChange={(evento) => {
              alFiltrar(evento.target.value);
            }}
            placeholder="Filtrar módulos y submódulos"
            aria-label="Filtrar módulos y submódulos"
            className="kn-marco__entrada"
          />
          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                alFiltrar('');
              }}
              aria-label="Quitar el filtro"
              className="kn-marco__quitar"
            >
              <Icono nombre="cerrar" tamano={13} grosor={2.2} />
            </button>
          )}
        </div>
        {hayFiltro && <p className="kn-marco__conteo">{conteoDelFiltro(filtro)}</p>}
      </div>

      <div className="kn-marco__arbol">
        {visibles.map(({ modulo, submodulos }) => {
          // Con filtro se despliega solo el que casa; sin filtro manda la eleccion de quien
          // pulso.
          const abierto = hayFiltro || desplegado === modulo.rotulo;
          const cuantasAbiertas = modulo.submodulos.filter((submodulo) =>
            abiertas.includes(submodulo.clave),
          ).length;

          return (
            <div key={modulo.clave}>
              <button
                type="button"
                onClick={() => {
                  alDesplegar(modulo.rotulo);
                }}
                aria-expanded={abierto}
                className={`kn-marco__modulo${abierto ? ' kn-marco__modulo--abierto' : ''}`}
              >
                <span className="kn-marco__icono-modulo">
                  <Trazos trazos={modulo.trazos} tamano={14} />
                </span>
                <span className="kn-marco__rotulo-modulo">{modulo.rotulo}</span>
                {cuantasAbiertas > 0 && (
                  <span className="kn-marco__pastilla">{String(cuantasAbiertas)}</span>
                )}
                <span className={`kn-marco__chevron${abierto ? ' kn-marco__chevron--arriba' : ''}`}>
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

              {abierto && (
                <div className="kn-marco__hojas">
                  {submodulos.map((submodulo) => {
                    const esLaActiva = activa === submodulo.clave;
                    const yaAbierta = abiertas.includes(submodulo.clave);
                    return (
                      <button
                        key={submodulo.clave}
                        type="button"
                        onClick={() => {
                          alAbrir(submodulo.clave);
                        }}
                        aria-current={esLaActiva}
                        className={`kn-marco__hoja${esLaActiva ? ' kn-marco__hoja--actual' : ''}`}
                      >
                        <span className="kn-marco__rotulo-hoja">
                          {submodulo.rotulo}
                          {sucias[submodulo.clave] === true ? ' *' : ''}
                        </span>
                        {yaAbierta && !esLaActiva && (
                          <span className="kn-marco__marca">abierta</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hayFiltro && visibles.length === 0 && (
        <div className="kn-marco__sin-coincidencias">
          <p>
            Ningún módulo ni submódulo se llama así. Pruebe con «ediciones», «cuadros»,
            «publicación» o «panel».
          </p>
        </div>
      )}

      {/* Siempre, sin condicion: `hayCola` era `v !== 'c'` y la `c` no se porta. */}
      <div className="kn-marco__cola">
        <p className="kn-marco__cola-titulo">Cola de trabajo</p>
        {COLA.map((fila) => (
          <button
            key={fila.rotulo}
            type="button"
            onClick={() => {
              alAbrir(DESTINO_DE_LA_COLA);
            }}
            className="kn-marco__cola-fila"
          >
            <span className={`kn-marco__punto kn-marco__punto--${fila.tono}`} />
            <span className="kn-marco__cola-rotulo">{fila.rotulo}</span>
            <span className="kn-marco__cola-n">{fila.n}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
