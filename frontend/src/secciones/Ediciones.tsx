import { useState } from 'react';

import { Aviso, Boton, Campo, Esqueleto, Icono, Insignia } from '../ds/index.ts';
import {
  AMBITOS,
  RUTAS,
  enviar,
  type ConjuntoResource,
  type EjercicioParametrizadoResource,
  type Paginado,
  type ParametroDelSnapshot,
} from '../datos/lecturas.ts';
import { useSnapshot, useUno } from '../datos/useRecurso.ts';
import {
  ABIERTO,
  DIRECCIONES,
  ORDENES_ADMITIDOS,
  ROTULO_DEL_ORDEN,
  SELLADO,
  SIN_DATO,
  TAMANOS,
  rutaDelListado,
  selloDe,
  vigenteDe,
} from './conjuntos.ts';
import { CHIPS, type EstadoDeEdiciones } from './estadoDeNormativa.ts';
import {
  OBSERVACION,
  PASO_DE_APERTURA,
  PASO_DE_LECTURA,
  bloqueado as noSePuede,
  cuerpoDe,
  esObligatorio,
  filtrar,
  motivoDe,
  pasoDe,
  pasosPara,
  rutaDe,
  valoresServidos,
  type CampoDelFormulario,
} from './ediciones.ts';

/**
 * La seccion «Ediciones» (`nor-ediciones`): **las versiones del conjunto, y su sellado**.
 *
 * A la izquierda el listado —paginado por el servidor— y a la derecha la ficha de la edicion
 * elegida, con sus cuatro pasos: uno que ensena lo que el conjunto contiene y **los tres que
 * escriben**. No se sale de la lista para operar, que es lo que permite abrir una version,
 * agregarle un parametro y sellarla mirando siempre las demas.
 *
 * <h2>El listado es del SERVIDOR; el filtro, del cliente, y se dice cual es cual (AC3)</h2>
 *
 * `?pagina`, `?tamano`, `?ordenarPor` y `?direccion` viajan en la ruta: son los cuatro nombres
 * del dialecto que `GuardiaDeParametros` admite siempre. El buscador y los chips **no** viajan,
 * y no por comodidad: la operacion no declara ningun otro parametro, asi que pedir
 * `?estado=SELLADO` seria un **422 «parametro desconocido»**. Filtran sobre la pagina servida, y
 * el conteo dice «N de M» para que la diferencia no se lea como que faltan filas.
 *
 * El orden se elige **de los cuatro que el backend admite** —`ejercicio`, `version`, `estado`,
 * `id`, que son los de `ORDEN_CONJUNTO`— y de ninguno mas: cualquier otro es un `422
 * ORDEN_NO_ADMITIDO`, y un desplegable que pudiera pedirlo seria un rechazo que nadie entiende
 * mirando una lista.
 *
 * <h2>Dos conjuntos SELLADOS del mismo ejercicio no son un error (AC3)</h2>
 *
 * Se marcan, y el que rige lleva su insignia. Sin la marca, quien mire dos sellos de 2026
 * concluye que el sistema se contradice — y la conclusion razonable seria la peor: que no se sabe
 * con cual se emitio. La regla es la de `selladoVigenteDe`: la ultima version sellada.
 *
 * <h2>Las dos negativas del sellado las redacta el BACKEND (AC8)</h2>
 *
 * Esta pantalla **no las predice y no las reescribe**. Cuando se pulsa el boton, la escritura
 * sale, y lo que el servidor conteste se ensena **tal cual**, con su codigo del catalogo delante.
 * Las dos que salen de `AdministrarParametros.sellar` —«ya esta sellado; corregirlo exige una
 * version nueva (ADR-0007)» y «no tiene ningun parametro: sellarlo vacio diria que el ejercicio
 * esta parametrizado cuando no lo esta»— **se arreglan de maneras opuestas**: una abriendo una
 * version, la otra agregando parametros. Reescribirlas «para que se lean mejor» mandaria a quien
 * atiende a hacer lo contrario de lo que hace falta, y ademas el desajuste no aparece hasta que
 * alguien intenta sellar dos veces en produccion.
 *
 * Y **no hay ningun boton de borrar ni de anular en toda la seccion**, porque no existe esa
 * operacion: un conjunto sellado no se corrige, se abre otra version.
 *
 * <h2>Ninguna cifra tributaria se escribe aqui (AC10, regla 5)</h2>
 *
 * Los valores de los parametros —la UIT, las alicuotas, los valores unitarios— llegan del
 * snapshot del conjunto, verificado por su huella. Lo unico que este archivo escribe son rotulos.
 */
export interface EdicionesProps {
  /** El ejercicio de la barra global: decide de cual se pregunta que conjunto rige. */
  readonly ejercicio: string;
  readonly estado: EstadoDeEdiciones;
  readonly alCambiar: (cambio: Partial<EstadoDeEdiciones>) => void;
  /** Marca la pestana como sucia: es lo que pone el asterisco. */
  readonly alEnsuciar: () => void;
  readonly alAvisar: (texto: string) => void;
}

/** Cuantas filas de esqueleto ocupan el sitio de la lista mientras llega. */
const HUECOS = [0, 1, 2, 3, 4];

/**
 * Las siete columnas de la tabla de parametros, con su alineacion (AC5).
 *
 * Son los siete campos de `ParametroDelSnapshot`, literales y sin componer: el conjunto guarda a
 * proposito el historico de una llave, y quien resuelve cual rige es el lector.
 */
const COLUMNAS: readonly (readonly [string, boolean])[] = [
  ['Tipo', false],
  ['Clave', false],
  ['Valor numérico', true],
  ['Valor de texto', false],
  ['Vigente desde', false],
  ['Vigente hasta', false],
  ['Documento fuente', false],
];

export function Ediciones({
  ejercicio,
  estado,
  alCambiar,
  alEnsuciar,
  alAvisar,
}: EdicionesProps) {
  const anio = Number(ejercicio);
  const [enviando, fijarEnviando] = useState(false);

  const listado = useUno<Paginado<ConjuntoResource>>(rutaDelListado(estado));
  // La lectura que dice **cual rige** el ejercicio de la barra. Va con `SESION_PROPIA` y por eso
  // puede llegar cuando el listado no, y al reves: son las dos mitades del error parcial (AC4).
  const rige = useUno<EjercicioParametrizadoResource>(
    Number.isFinite(anio) ? RUTAS.ejercicio(anio) : null,
  );

  const pagina = listado.dato;
  const servidos = pagina?.contenido ?? [];
  const visibles = filtrar(servidos, estado);

  const elegida = servidos.find((uno) => uno.id === estado.elegida) ?? null;
  const paso = pasoDe(elegida === null ? PASO_DE_APERTURA : estado.paso);
  const disponibles = pasosPara(elegida);

  // Un conjunto sin sellar **no tiene snapshot**: `SnapshotController` contesta 404 nombrandolo,
  // porque lo que se pide es un documento que todavia no existe. Asi que no se pide.
  const snapshot = useSnapshot(
    elegida !== null && elegida.estado === SELLADO
      ? RUTAS.snapshot(elegida.id, AMBITOS[0])
      : null,
  );
  const parametros = snapshot.dato?.recurso.parametros ?? [];

  const servidosDelPaso = valoresServidos(elegida);
  const valor = (clave: string) => estado.vals[clave] ?? servidosDelPaso[clave] ?? '';
  const escribir = (clave: string, texto: string) => {
    alCambiar({ vals: { ...estado.vals, [clave]: texto } });
    alEnsuciar();
  };

  const motivo = motivoDe(paso, valor);
  const bloqueado = noSePuede(paso, valor);

  /** Marca de vigencia: la del servidor cuando la sabe, y la regla sobre lo servido si no. */
  const rigeEste = (conjunto: ConjuntoResource) => {
    if (conjunto.ejercicio === anio && rige.dato !== null) {
      return rige.dato.conjuntoId === conjunto.id;
    }
    return vigenteDe(servidos, conjunto.ejercicio)?.id === conjunto.id;
  };

  const elegir = (conjunto: ConjuntoResource) => {
    alCambiar({
      elegida: conjunto.id,
      paso: PASO_DE_LECTURA,
      vals: {},
      intento: false,
      negativa: null,
    });
  };

  const abrirLaPrimera = () => {
    alCambiar({
      elegida: null,
      paso: PASO_DE_APERTURA,
      vals: {},
      intento: false,
      negativa: null,
    });
    alAvisar('Abrir una versión: escriba el ejercicio y por qué la abre.');
  };

  const guardar = () => {
    if (bloqueado) {
      // El rojo de los obligatorios aparece **al intentar**, no mientras se escribe (AC7).
      alCambiar({ intento: true });
      alAvisar(motivo);
      return;
    }
    const ruta = rutaDe(paso, elegida);
    if (ruta === null) {
      alAvisar('Esa operación necesita un conjunto abierto en la ficha.');
      return;
    }
    fijarEnviando(true);
    void enviar<unknown>(ruta, cuerpoDe(paso, valor)).then(
      () => {
        fijarEnviando(false);
        alCambiar({ vals: {}, intento: false, negativa: null });
        alAvisar(`${paso.verbo ?? 'Guardado'}: registrado con su observación.`);
      },
      (fallo: unknown) => {
        fijarEnviando(false);
        // El texto del servidor, **tal cual**. Ver el javadoc de la seccion (AC8).
        alCambiar({ negativa: mensajeDelServidor(fallo) });
        alAvisar('El servidor rechazó la operación. El motivo está en la ficha.');
      },
    );
  };

  return (
    <main className="kn-marco__lienzo kn-seccion kn-ediciones">
      <div className="kn-ediciones__lista">
        <div className="kn-ediciones__buscador">
          <div className="kn-busqueda">
            <Icono nombre="lupa" tamano={15} grosor={1.8} />
            <input
              className="kn-busqueda__campo"
              value={estado.q}
              placeholder="Año, «v2» o identificador"
              aria-label="Buscar en las ediciones"
              onChange={(evento) => {
                alCambiar({ q: evento.target.value });
              }}
            />
            {estado.q !== '' && (
              <button
                type="button"
                aria-label="Limpiar la búsqueda"
                className="kn-busqueda__limpiar"
                onClick={() => {
                  alCambiar({ q: '' });
                }}
              >
                <Icono nombre="cerrar" tamano={14} grosor={2.2} />
              </button>
            )}
          </div>
          <div className="kn-ediciones__chips">
            {CHIPS.map((chip) => (
              <button
                type="button"
                key={chip}
                aria-pressed={estado.chip === chip}
                className={`kn-chip${estado.chip === chip ? ' kn-chip--on' : ''}`}
                onClick={() => {
                  alCambiar({ chip });
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="kn-ediciones__mandos">
          <span className="kn-ediciones__conteo">
            {pagina === null
              ? 'Cargando las ediciones…'
              : `${String(visibles.length)} de ${String(servidos.length)} · ${String(
                  pagina.totalElementos,
                )} en total`}
          </span>
          <label className="kn-ediciones__mando">
            <span className="kn-ediciones__mando-rotulo">Ordenar por</span>
            <select
              value={estado.ordenarPor}
              onChange={(evento) => {
                alCambiar({ ordenarPor: evento.target.value, pagina: 0 });
              }}
            >
              {ORDENES_ADMITIDOS.map((orden) => (
                <option key={orden} value={orden}>
                  {ROTULO_DEL_ORDEN[orden] ?? orden}
                </option>
              ))}
            </select>
          </label>
          <label className="kn-ediciones__mando">
            <span className="kn-ediciones__mando-rotulo">Sentido</span>
            <select
              value={estado.direccion}
              onChange={(evento) => {
                alCambiar({ direccion: evento.target.value, pagina: 0 });
              }}
            >
              {DIRECCIONES.map((sentido) => (
                <option key={sentido} value={sentido}>
                  {sentido}
                </option>
              ))}
            </select>
          </label>
          <label className="kn-ediciones__mando">
            <span className="kn-ediciones__mando-rotulo">Por página</span>
            <select
              value={String(estado.tamano)}
              onChange={(evento) => {
                alCambiar({ tamano: Number(evento.target.value), pagina: 0 });
              }}
            >
              {TAMANOS.map((cuantas) => (
                <option key={cuantas} value={String(cuantas)}>
                  {String(cuantas)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="kn-ediciones__filas" aria-busy={listado.cargando}>
          {/* 1 — El error TOTAL: sin listado no hay nada que ensenar. */}
          {listado.error !== null && (
            <Aviso tipo="error" titulo="No se pudieron leer las ediciones" detalle={listado.error}>
              <Boton
                variante="primario"
                onClick={() => {
                  // Reintentar es volver a componer la ruta: el hook rehace la peticion cuando
                  // cambia, asi que se pide la misma pagina otra vez.
                  alCambiar({ pagina: estado.pagina });
                  alAvisar('Reintentando la lectura de las ediciones.');
                }}
              >
                Reintentar
              </Boton>
            </Aviso>
          )}

          {/* 2 — El error PARCIAL: la lista llego y el detalle que dice cual rige, no. */}
          {listado.error === null && rige.error !== null && (
            <Aviso
              tipo="error"
              titulo="No se pudo resolver cuál conjunto rige"
              detalle={
                `La lista está, pero no se pudo preguntar por el ejercicio ${ejercicio}. ` +
                'Lo que se marca abajo se resuelve sobre las filas de esta página, y la ' +
                'autoridad es el servidor: callarlo sería peor que no tener el dato.'
              }
            />
          )}

          {/* 3 — Cargando: el sitio que ocupara el dato, ocupado. */}
          {listado.error === null && listado.cargando && (
            <div className="kn-ediciones__cargando">
              {HUECOS.map((hueco) => (
                <div className="kn-ediciones__fila kn-ediciones__fila--esqueleto" key={hueco}>
                  <Esqueleto alto={14} ancho="62%" />
                  <Esqueleto alto={12} ancho="48%" />
                </div>
              ))}
            </div>
          )}

          {/* 4 — El vacio, con su accion DENTRO. */}
          {listado.error === null && !listado.cargando && visibles.length === 0 && (
            <Aviso
              tipo="vacio"
              titulo={
                servidos.length === 0 ? 'Ninguna edición todavía' : 'Ninguna edición coincide'
              }
              detalle={
                servidos.length === 0
                  ? 'Esta municipalidad no ha compuesto ningún conjunto. Los parámetros y los cuadros nacionales ya están publicados: lo que falta es abrir una versión, incorporarlos y sellarla.'
                  : 'Pruebe con el año, con «v2» o con el identificador del conjunto. También puede quitar el filtro de estado.'
              }
            >
              <Boton variante="primario" onClick={abrirLaPrimera}>
                Abrir una versión
              </Boton>
            </Aviso>
          )}

          {visibles.map((conjunto) => (
            <button
              type="button"
              key={conjunto.id}
              aria-current={estado.elegida === conjunto.id}
              className={`kn-ediciones__fila${
                estado.elegida === conjunto.id ? ' kn-ediciones__fila--actual' : ''
              }`}
              onClick={() => {
                elegir(conjunto);
              }}
            >
              <span className="kn-ediciones__linea">
                <span className="kn-ediciones__titulo">
                  Ejercicio {String(conjunto.ejercicio)} · versión {String(conjunto.version)}
                </span>
                <Insignia tono={conjunto.estado === SELLADO ? 'ok' : 'atencion'}>
                  {conjunto.estado}
                </Insignia>
                {rigeEste(conjunto) && <Insignia tono="info">Vigente</Insignia>}
              </span>
              <span className="kn-ediciones__detalle">{selloDe(conjunto)}</span>
              <span className="kn-ediciones__pie">conjunto {String(conjunto.id)}</span>
            </button>
          ))}
        </div>

        <div className="kn-ediciones__paginacion">
          <Boton
            menudo
            aria-disabled={estado.pagina === 0}
            onClick={() => {
              if (estado.pagina > 0) {
                alCambiar({ pagina: estado.pagina - 1 });
              }
            }}
          >
            Anterior
          </Boton>
          <span className="kn-ediciones__pagina">
            {pagina === null
              ? SIN_DATO
              : `Página ${String(pagina.pagina + 1)} de ${String(pagina.totalPaginas)}`}
          </span>
          <Boton
            menudo
            aria-disabled={pagina === null || !pagina.hayMas}
            onClick={() => {
              if (pagina !== null && pagina.hayMas) {
                alCambiar({ pagina: estado.pagina + 1 });
              }
            }}
          >
            Siguiente
          </Boton>
        </div>
      </div>

      <div className="kn-ediciones__ficha">
        <div className="kn-ficha__cabecera">
          <span className="kn-ficha__identidad">
            <span className="kn-ficha__codigo">
              {elegida === null ? 'Sin conjunto' : `conjunto ${String(elegida.id)}`}
            </span>
            <Insignia
              tono={elegida === null ? 'atencion' : elegida.estado === SELLADO ? 'ok' : 'atencion'}
            >
              {elegida === null ? 'Versión nueva' : elegida.estado}
            </Insignia>
            {elegida !== null && rigeEste(elegida) && <Insignia tono="info">Vigente</Insignia>}
          </span>
          <p className="kn-ficha__titulo">
            {elegida === null
              ? 'Abrir una versión'
              : `Ejercicio ${String(elegida.ejercicio)} · versión ${String(elegida.version)}`}
          </p>
          <p className="kn-ficha__contexto">
            {elegida === null
              ? 'Nada se registra hasta que la observación esté escrita: la versión la asigna el sistema, y el identificador del conjunto sale al guardar.'
              : `Sellado: ${selloDe(elegida)}. Corregir un conjunto sellado exige una versión nueva, no una corrección (ADR-0007).`}
          </p>
        </div>

        <div className="kn-ficha__pestanas" role="tablist" aria-label="Pasos de la edición">
          {disponibles.map((uno) => (
            <button
              type="button"
              key={uno.id}
              role="tab"
              aria-selected={paso.id === uno.id}
              className={`kn-ficha__pestana${paso.id === uno.id ? ' kn-ficha__pestana--actual' : ''}`}
              onClick={() => {
                alCambiar({ paso: uno.id, intento: false, negativa: null });
              }}
            >
              {uno.rotulo}
            </button>
          ))}
        </div>

        <div className="kn-ficha__cuerpo">
          <p className="kn-ficha__nota">{paso.nota}</p>

          {estado.negativa !== null && (
            <div className="kn-negativa" role="alert">
              <p className="kn-negativa__titulo">El servidor rechazó la operación</p>
              <p className="kn-negativa__mensaje">{estado.negativa}</p>
              <p className="kn-negativa__nota">
                Es el texto del backend, sin reescribir. Un sellado no se deshace: se abre otra
                versión, que queda al lado de la anterior, y cada determinación guarda con qué
                conjunto se calculó (ADR-0025 §3).
              </p>
            </div>
          )}

          <div className="kn-rejilla">
            {paso.campos.map((campo) => (
              <Campo
                key={campo.clave}
                etiqueta={campo.etiqueta}
                tipo={campo.tipo}
                opciones={campo.opciones}
                ancho={campo.ancho}
                opcional={campo.opcional}
                ph={campo.ph}
                ayuda={campo.ayuda}
                cargando={paso.id === PASO_DE_LECTURA && listado.cargando}
                valor={valor(campo.clave)}
                error={errorDe(campo, estado.intento, valor(campo.clave))}
                alCambiar={(texto) => {
                  escribir(campo.clave, texto);
                }}
              />
            ))}
          </div>

          {paso.id === PASO_DE_LECTURA && (
            <TablaDeParametros
              parametros={parametros}
              cargando={snapshot.cargando}
              error={snapshot.error}
              abierto={elegida?.estado === ABIERTO}
            />
          )}

          {paso.escritura && (
            <div className="kn-ficha__pie">
              <p className="kn-ficha__pie-nota">
                {motivo === ''
                  ? 'Queda en la bitácora con su observación, su usuario y su hora (regla 10).'
                  : motivo}
              </p>
              <Boton
                onClick={() => {
                  alCambiar({ vals: {}, intento: false, negativa: null });
                  alAvisar('Se descartó lo escrito.');
                }}
              >
                Descartar lo escrito
              </Boton>
              {/* `aria-disabled` y NO `disabled`: un control deshabilitado sale del recorrido
                  del tabulador, y en ventanilla se trabaja con teclado — quien recorre el
                  formulario con Tab se saltaria justo el boton que explica por que no puede
                  guardar. Pulsarlo con la compuerta cerrada enciende el rojo y lo dice (AC7). */}
              <Boton
                variante="primario"
                aria-disabled={bloqueado || enviando}
                title={bloqueado ? motivo : undefined}
                onClick={guardar}
              >
                {enviando ? 'Enviando…' : (paso.verbo ?? 'Guardar')}
              </Boton>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * El rojo de un campo, **al primer intento y no antes** (AC7).
 *
 * Mientras se escribe no hay error: quien esta rellenando el tercer campo no ha hecho nada mal
 * por no haber llegado al cuarto, y un formulario que se pone rojo solo se lee como roto. El
 * realce aparece cuando se intenta guardar, que es cuando el dato falta de verdad.
 */
function errorDe(
  campo: CampoDelFormulario,
  intento: boolean,
  escrito: string,
): string | undefined {
  if (!intento || !esObligatorio(campo) || escrito.trim() !== '') {
    return undefined;
  }
  return campo.campo === OBSERVACION
    ? 'Sin observación no se guarda (regla 10).'
    : 'Este dato es obligatorio.';
}

/** El mensaje que escribio el servidor, con su codigo delante. Nunca una reescritura. */
function mensajeDelServidor(fallo: unknown): string {
  return fallo instanceof Error ? fallo.message : 'El sistema no pudo contestar.';
}

/**
 * Los parametros del conjunto, con **sus siete campos literales** (AC5).
 *
 * <h2>Por que no se usa `Importe` en la columna de la cifra</h2>
 *
 * `Importe` exige `fechaCalculo` porque no existe «la deuda», existe la deuda **a una fecha**
 * (regla 9). Un parametro normativo no es eso: no esta calculado a ninguna fecha, **rige desde**
 * una — y la fila ya publica las dos vigencias en sus propias columnas. Pasarle `vigenciaDesde`
 * como fecha de calculo escribiria en pantalla una frase que significa otra cosa. La cifra se
 * ensena tal como el backend la sirve, alineada a la derecha y con `tabular-nums`, que es lo que
 * hace que una columna de cifras se pueda comparar de un vistazo.
 *
 * <h2>Y `documentoFuente` no se recorta</h2>
 *
 * Es lo que hace **auditable** cada cifra: es la norma que la fija. Un recorte con puntos
 * suspensivos deja al que audita sin poder leer cual es, asi que la celda ajusta el texto
 * entero en varias lineas en vez de cortarlo.
 */
function TablaDeParametros({
  parametros,
  cargando,
  error,
  abierto,
}: {
  readonly parametros: readonly ParametroDelSnapshot[];
  readonly cargando: boolean;
  readonly error: string | null;
  readonly abierto: boolean;
}) {
  return (
    <section className="kn-tarjeta kn-tarjeta--tabla">
      <div className="kn-tarjeta__cabecera">
        <h3 className="kn-tarjeta__titulo">Parámetros</h3>
        <span className="kn-tarjeta__conteo">
          {cargando ? SIN_DATO : `${String(parametros.length)} filas`}
        </span>
      </div>

      {error !== null && (
        <Aviso tipo="error" titulo="No se pudo leer el contenido del conjunto" detalle={error} />
      )}

      {abierto && (
        <p className="kn-tabla__vacio">
          Este conjunto está ABIERTO y todavía no tiene documento sellado que leer. Agregue los
          parámetros por su llave —tipo, clave y desde cuándo rige— y sólo entonces se podrá
          sellar: sellarlo vacío diría que el ejercicio está parametrizado.
        </p>
      )}

      {!abierto && (
        <div className="kn-tabla__marco">
          <table className="kn-tabla kn-tabla--parametros" aria-busy={cargando}>
            <thead>
              <tr>
                {COLUMNAS.map(([rotulo, cifra]) => (
                  <th key={rotulo} scope="col" className={cifra ? 'kn-tabla__th--cifra' : undefined}>
                    {rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando &&
                HUECOS.map((hueco) => (
                  <tr key={hueco}>
                    {COLUMNAS.map(([rotulo]) => (
                      <td key={rotulo}>
                        <Esqueleto alto={12} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!cargando &&
                parametros.map((fila) => (
                  <tr key={`${fila.tipo}-${fila.clave ?? ''}-${fila.vigenciaDesde ?? ''}`}>
                    <td className="kn-tabla__td--clave">{fila.tipo}</td>
                    <td>{fila.clave ?? SIN_DATO}</td>
                    <td className="kn-tabla__td--cifra">{fila.valorNumerico ?? SIN_DATO}</td>
                    <td>{fila.valorTexto ?? SIN_DATO}</td>
                    <td>{fila.vigenciaDesde ?? SIN_DATO}</td>
                    <td>{fila.vigenciaHasta ?? SIN_DATO}</td>
                    <td className="kn-tabla__td--fuente">{fila.documentoFuente}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="kn-tarjeta__pie">
        La clave va vacía cuando el tipo tiene un solo valor —la UIT no lleva clave;
        TRAMO_PREDIAL lleva tres— y «Vigente hasta» vacío no es un olvido: es una norma sin fecha
        de fin. Donde no hay dato va {SIN_DATO}, no una celda en blanco. Las filas llegan del
        snapshot del conjunto, y su huella se comprueba antes de usarlas.
      </p>
    </section>
  );
}
