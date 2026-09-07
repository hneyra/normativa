import { useState } from 'react';

import { Aviso, Boton, Icono, Insignia } from '../ds/index.ts';
import {
  AMBITOS,
  RUTAS,
  type Ambito,
  type ConjuntoVigenteResource,
  type SnapshotResource,
} from '../datos/lecturas.ts';
import { PREFIJO, type SnapshotVerificado } from '../api/cliente.ts';
import { useSnapshot, useUno } from '../datos/useRecurso.ts';
import { Tabla } from './Tabla.tsx';
import {
  CONSUMIDORES,
  OPERACIONES_CONSUMIDAS,
  OPERACIONES_SIN_CONSUMIDOR,
  RAZONES_DE_LA_CACHE,
  comprobacionDe,
  compararAmbitos,
  esEjercicioSinPublicar,
  guardarComoArchivo,
  lineasDeLaRespuesta,
  listasDelSnapshot,
  nombreDelArchivo,
} from './publicacion.ts';
import { ejercicioPedido } from './seccion.ts';

/**
 * «Publicación»: el snapshot descargable de ADR-0025 §1, con lo que hace que se pueda confiar en
 * el.
 *
 * <h2>Lo que esta pantalla existe para ensenar</h2>
 *
 * No es la descarga: es **la comprobacion**. El `ETag` es el `sha256` de los bytes que el
 * servidor emite, la respuesta se cachea un ano con `immutable`, y de esas dos cosas juntas sale
 * que una copia corrupta **no se volveria a pedir nunca**. Asi que lo que hay que poder ver es
 * que la huella se recalculo sobre los bytes recibidos y cuadro — y, cuando no cuadre, las dos
 * huellas y el consejo de no reintentar sin mirar por donde pasa la respuesta.
 *
 * <h2>Se piden los DOS ambitos, siempre</h2>
 *
 * Y no por comodidad: es lo unico que permite **medir** lo que ADR-0025 §Consecuencias afirma
 * —la identidad no cambia con el ambito y la huella si— en vez de repetirlo. Son dos peticiones
 * por pantalla, no por predio: un conjunto sellado se pide una vez por corrida.
 */

export interface PublicacionProps {
  /** El ejercicio de trabajo, tal como lo fija la barra global del marco. */
  readonly ejercicio: string;
  /** El toast del marco. Guardar un archivo no cambia de pantalla. */
  readonly alAvisar: (texto: string) => void;
  /** Abrir otra seccion como pestana: la salida del ejercicio sin sellar. */
  readonly alAbrir: (destino: string) => void;
}

export function Publicacion({ ejercicio, alAvisar, alAbrir }: PublicacionProps) {
  const [ambito, fijarAmbito] = useState<Ambito>('VALUACION');

  const pedido = ejercicioPedido(ejercicio);
  const vigente = useUno<ConjuntoVigenteResource>(pedido === null ? null : RUTAS.vigente(pedido));
  const conjuntoId = vigente.dato?.conjuntoId ?? null;

  // Los dos, y siempre los dos: es lo que AC6 compara. Con `conjuntoId` nulo no se pide nada.
  const deValuacion = useSnapshot(
    conjuntoId === null ? null : RUTAS.snapshot(conjuntoId, 'VALUACION'),
  );
  const deObligacion = useSnapshot(
    conjuntoId === null ? null : RUTAS.snapshot(conjuntoId, 'OBLIGACION'),
  );

  const elegido = ambito === 'VALUACION' ? deValuacion : deObligacion;
  const verificado = elegido.dato;
  const sinPublicar = vigente.fallo !== null && esEjercicioSinPublicar(vigente.fallo);

  return (
    <section className="kn-seccion kn-seccion--publicacion" aria-label="Publicación">
      <div className="kn-seccion__cuerpo">
        <QueSeDescarga
          ambito={ambito}
          alElegir={fijarAmbito}
          // La ruta ENTERA, con el prefijo del sistema: es lo que se ve en la consola del
          // navegador y lo que hay que poder comparar contra el contrato.
          ruta={
            conjuntoId === null
              ? `GET ${PREFIJO}${RUTAS.vigente(pedido ?? 0)}`
              : `GET ${PREFIJO}${RUTAS.snapshot(conjuntoId, ambito)}`
          }
          conjunto={vigente.dato}
          puedeDescargar={verificado !== null}
          alDescargar={() => {
            if (verificado === null) return;
            const nombre = nombreDelArchivo(verificado.recurso);
            const guardado = guardarComoArchivo(nombre, verificado.cuerpo);
            alAvisar(
              guardado
                ? `Guardado «${nombre}»: ${String(verificado.recurso.filas)} filas, y son los ` +
                    'bytes cuyo sha256 se comparó con el ETag.'
                : 'Este navegador no ofrece descarga de archivos, así que no se guardó nada.',
            );
          }}
        />

        {pedido === null && (
          <Aviso
            tipo="error"
            titulo="El ejercicio de trabajo no es un ejercicio"
            detalle={
              `«${ejercicio}» no es un año entre 1990 y 2100, que es lo que el constructor de ` +
              'Ejercicio admite. No se pide nada: mandarlo produciría un 422 que hablaría del ' +
              'parámetro y no de lo que pasa.'
            }
          />
        )}

        {sinPublicar && <EjercicioSinPublicar detalle={vigente.error} alAbrir={alAbrir} />}

        {vigente.error !== null && !sinPublicar && (
          <Aviso
            tipo="error"
            titulo="No se pudo resolver qué conjunto rige este ejercicio"
            detalle={vigente.error}
          />
        )}

        {elegido.error !== null && (
          <Aviso
            tipo="error"
            titulo={`No se pudo verificar el snapshot en ${ambito}`}
            detalle={elegido.error}
          />
        )}

        {verificado !== null && <LaRespuesta verificado={verificado} />}
        {verificado !== null && <QueVieneYQueNo snapshot={verificado.recurso} />}

        {deValuacion.dato !== null && deObligacion.dato !== null && (
          <LosDosAmbitos valuacion={deValuacion.dato} obligacion={deObligacion.dato} />
        )}

        {verificado !== null && <PorQueSePuedeGuardar />}

        <QuienSeLoLleva />
      </div>
    </section>
  );
}

/** La cabecera: que conjunto, que ambito y el boton de guardar. */
function QueSeDescarga({
  ambito,
  alElegir,
  ruta,
  conjunto,
  puedeDescargar,
  alDescargar,
}: {
  readonly ambito: Ambito;
  readonly alElegir: (elegido: Ambito) => void;
  readonly ruta: string;
  readonly conjunto: ConjuntoVigenteResource | null;
  readonly puedeDescargar: boolean;
  readonly alDescargar: () => void;
}) {
  return (
    <div className="kn-seccion__panel">
      <div className="kn-seccion__panel-cabecera">
        <h2 className="kn-seccion__titulo">Qué conjunto se descarga</h2>
        <code className="kn-seccion__ruta">{ruta}</code>
      </div>

      <div className="kn-seccion__panel-cuerpo">
        <dl className="kn-seccion__campos">
          <div className="kn-seccion__campo">
            <dt>
              Conjunto <code>conjuntoId</code>
            </dt>
            <dd>{conjunto === null ? '—' : String(conjunto.conjuntoId)}</dd>
          </div>
          <div className="kn-seccion__campo">
            <dt>Ejercicio · versión</dt>
            <dd>
              {conjunto === null
                ? '—'
                : `${String(conjunto.ejercicio)} · ${String(conjunto.version)}`}
            </dd>
          </div>
        </dl>

        <div className="kn-seccion__ambito">
          <span className="kn-seccion__ambito-rotulo">
            Ámbito <code>ambito</code>
          </span>
          <span className="kn-seccion__ambito-botones">
            {AMBITOS.map((uno) => (
              <button
                key={uno}
                type="button"
                aria-pressed={uno === ambito}
                className={`kn-seccion__ambito-boton${
                  uno === ambito ? ' kn-seccion__ambito-boton--actual' : ''
                }`}
                onClick={() => {
                  alElegir(uno);
                }}
              >
                {uno}
              </button>
            ))}
          </span>
        </div>

        <Boton
          variante="primario"
          aria-disabled={!puedeDescargar}
          title={
            puedeDescargar
              ? 'Guarda los bytes que se verificaron'
              : 'Todavía no hay un snapshot verificado que guardar'
          }
          onClick={alDescargar}
        >
          <Icono nombre="descarga" tamano={15} />
          Guardar el snapshot
        </Boton>
      </div>

      <p className="kn-seccion__pie">
        El <strong>ámbito no tiene valor por omisión</strong>, y eso es la mitad de la decisión: un
        «todo» implícito sería el snapshot más grande servido a quien no lo pidió, con otra huella
        y con la mitad de sus filas sin consumidor. <code>?ambito=valuacion</code> en minúsculas se
        rechaza nombrándolo, porque aceptarlo devolvería un snapshot con otra huella que el cliente
        creería correcto.
      </p>
    </div>
  );
}

/** AC5: el `ETag`, el `Cache-Control`, las `filas`, y el resultado de recalcular el `sha256`. */
function LaRespuesta({
  verificado,
}: {
  readonly verificado: SnapshotVerificado<SnapshotResource>;
}) {
  const comprobacion = comprobacionDe(verificado);

  return (
    <div className="kn-seccion__panel">
      <div className="kn-seccion__panel-cabecera">
        <h2 className="kn-seccion__titulo">La respuesta</h2>
        <Insignia tono="ok">200</Insignia>
      </div>

      <dl className="kn-seccion__lineas">
        {lineasDeLaRespuesta(verificado).map((linea) => (
          <div key={linea.etiqueta} className="kn-seccion__linea">
            <dt>
              {linea.etiqueta}
              <span className="kn-seccion__origen">{linea.origen}</span>
            </dt>
            <dd className="kn-seccion__valor">{linea.valor}</dd>
          </div>
        ))}
      </dl>

      <div className={`kn-seccion__comprobacion kn-seccion__comprobacion--${comprobacion.tono}`}>
        <span className="kn-seccion__comprobacion-icono">
          <Icono nombre="visto" tamano={13} grosor={2.6} />
        </span>
        <span>
          <strong className="kn-seccion__comprobacion-titulo">{comprobacion.titulo}</strong>
          <span className="kn-seccion__prosa">{comprobacion.detalle}</span>
        </span>
      </div>

      <p className="kn-seccion__pie">
        El <code>sha256</code> no viene dentro del cuerpo a propósito: sería pedirle a un valor que
        se contenga a sí mismo. Viaja en el <code>ETag</code>, y lo que se guarda al descargar son
        estos mismos bytes, no una segunda serialización del objeto.
      </p>
    </div>
  );
}

/** AC3 visto desde la publicacion: cuantas filas trae cada lista, y por que. */
function QueVieneYQueNo({ snapshot }: { readonly snapshot: SnapshotResource }) {
  return (
    <div className="kn-seccion__panel">
      <div className="kn-seccion__panel-cabecera">
        <h2 className="kn-seccion__titulo">Qué viene y qué no</h2>
        <span className="kn-seccion__ruta">{String(snapshot.filas)} filas</span>
      </div>
      {listasDelSnapshot(snapshot).map((lista) => (
        <div key={lista.campo} className="kn-seccion__lista">
          <Insignia tono={lista.tono}>{String(lista.cuantas)}</Insignia>
          <span>
            <code className="kn-seccion__campo-json">{lista.campo}</code>
            <span className="kn-seccion__prosa">{lista.porQue}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** AC6: la identidad no cambia con el ambito; la huella si. Medido, no declarado. */
function LosDosAmbitos({
  valuacion,
  obligacion,
}: {
  readonly valuacion: SnapshotVerificado<SnapshotResource>;
  readonly obligacion: SnapshotVerificado<SnapshotResource>;
}) {
  const comparacion = compararAmbitos(valuacion, obligacion);

  return (
    <div className="kn-seccion__panel">
      <div className="kn-seccion__panel-cabecera">
        <h2 className="kn-seccion__titulo">Un conjunto, dos descargas</h2>
        <Insignia tono={comparacion.tono}>
          {comparacion.identidadCoincide ? 'Misma identidad' : 'Identidades distintas'}
        </Insignia>
      </div>

      <dl className="kn-seccion__lineas">
        <div className="kn-seccion__linea">
          <dt>Identidad</dt>
          <dd className="kn-seccion__valor">{comparacion.identidad}</dd>
        </div>
        <div className="kn-seccion__linea">
          <dt>ETag en VALUACION</dt>
          <dd className="kn-seccion__valor">{comparacion.huellaDeValuacion}</dd>
        </div>
        <div className="kn-seccion__linea">
          <dt>ETag en OBLIGACION</dt>
          <dd className="kn-seccion__valor">{comparacion.huellaDeObligacion}</dd>
        </div>
        <div className="kn-seccion__linea">
          <dt>Las dos huellas</dt>
          <dd className="kn-seccion__valor">
            {comparacion.huellaCambia ? 'son distintas' : 'son la misma'}
          </dd>
        </div>
      </dl>

      <p className="kn-seccion__prosa kn-seccion__prosa--pie">{comparacion.veredicto}</p>
    </div>
  );
}

/** Por que la descarga se puede cachear un ano con `immutable`. */
function PorQueSePuedeGuardar() {
  return (
    <div className="kn-seccion__panel">
      <div className="kn-seccion__panel-cabecera">
        <h2 className="kn-seccion__titulo">Por qué se puede guardar para siempre</h2>
      </div>
      {RAZONES_DE_LA_CACHE.map((razon) => (
        <div key={razon.titulo} className="kn-seccion__lista">
          <span className="kn-seccion__comprobacion-icono">
            <Icono nombre="visto" tamano={13} grosor={2.4} />
          </span>
          <span>
            <strong className="kn-seccion__comprobacion-titulo">{razon.titulo}</strong>
            <span className="kn-seccion__prosa">{razon.detalle}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** AC7: quien consume esto, y con que dos operaciones. */
function QuienSeLoLleva() {
  return (
    <div className="kn-seccion__panel">
      <div className="kn-seccion__panel-cabecera">
        <h2 className="kn-seccion__titulo">Quién se lo lleva</h2>
      </div>
      <p className="kn-seccion__prosa">
        Una petición por corrida, no una por predio. Una emisión de trescientos mil predios haría
        trescientas mil peticiones, y el día que <code>normativa</code> no esté arriba no habría
        padrón.
      </p>

      <Tabla
        rotulo="Quién consume el conjunto sellado"
        cargando={false}
        variante="consumidores"
        columnas={[
          { etiqueta: 'Quién', campo: 'consumidor' },
          { etiqueta: 'Qué ámbito pide', campo: 'ambito' },
          { etiqueta: 'Cuándo', campo: 'cuando' },
          { etiqueta: 'Qué hace con él', campo: 'queHace' },
        ]}
        filas={CONSUMIDORES.map((quien) => ({
          clave: `${quien.sistema}-${quien.ambito}`,
          celdas: [
            { texto: quien.sistema },
            { texto: quien.ambito },
            { texto: quien.cuando },
            { texto: quien.queHace },
          ],
        }))}
      />

      <p className="kn-seccion__prosa">
        Los dos declaran su contrato y consumen <strong>dos</strong> operaciones:{' '}
        <Operaciones cuales={OPERACIONES_CONSUMIDAS} />. Ninguno consume{' '}
        <Operaciones cuales={OPERACIONES_SIN_CONSUMIDOR} />. Es lo que convierte «publicamos un
        JSON» en «esto es lo que se rompe si cambia»: un campo que este sistema deje de publicar
        pone rojo el build de <strong>este</strong> repositorio, no el del consumidor (ADR-0030 §4).
      </p>
    </div>
  );
}

/** Una lista de operaciones dentro de la prosa, separadas y no pegadas una a otra. */
function Operaciones({ cuales }: { readonly cuales: readonly string[] }) {
  return (
    <>
      {cuales.map((operacion, i) => (
        <span key={operacion}>
          {i > 0 && ' y '}
          <code className="kn-seccion__campo-json">{operacion}</code>
        </span>
      ))}
    </>
  );
}

/** AC4: el 404 que no es una averia, con el mensaje del dominio tal como llega. */
function EjercicioSinPublicar({
  detalle,
  alAbrir,
}: {
  readonly detalle: string | null;
  readonly alAbrir: (destino: string) => void;
}) {
  return (
    <div className="kn-seccion__panel">
      <div className="kn-seccion__panel-cabecera">
        <h2 className="kn-seccion__titulo">La respuesta</h2>
        <Insignia tono="atencion">404</Insignia>
      </div>

      <Aviso
        tipo="vacio"
        titulo="Ese ejercicio no tiene un conjunto de parámetros sellado"
        detalle={detalle ?? undefined}
      >
        <Boton
          variante="primario"
          onClick={() => {
            alAbrir('nor-ediciones');
          }}
        >
          Ir a componer el ejercicio
        </Boton>
      </Aviso>

      <p className="kn-seccion__pie">
        Es el mensaje del dominio, tal como llega: no dice «error del servicio» ni «inténtelo más
        tarde», dice qué falta y quién lo arregla. Y es un <strong>404</strong> y no un 422 porque
        aquí se pide un documento —el conjunto sellado de ese ejercicio— y no se intenta ejecutar
        ningún cálculo; en esta misma ruta el 422 ya significa otra cosa, que es{' '}
        <code>?ejercicio=1800</code>. Del 404 de una ruta que no existe lo separa el miembro{' '}
        <code>parametroQueFalta</code> del cuerpo, que este lleva y aquél no: el número es el
        mismo en los dos.
      </p>
    </div>
  );
}
