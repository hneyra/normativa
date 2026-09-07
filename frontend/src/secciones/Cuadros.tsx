import { useId, useState } from 'react';

import { Aviso, Boton, Insignia } from '../ds/index.ts';
import { AMBITOS, RUTAS, type Ambito, type ConjuntoVigenteResource } from '../datos/lecturas.ts';
import { useSnapshot, useUno } from '../datos/useRecurso.ts';
import { Tabla } from './Tabla.tsx';
import {
  CUADROS_DE_VALUACION,
  cuadroPorId,
  cuantasFilasDe,
  estadoDelCuadro,
  filasDelCuadro,
  fuenteDelCuadro,
  fueraDeDominio,
  type CuadroDeValuacion,
  type IdDeCuadro,
} from './cuadros.ts';
import { esEjercicioSinPublicar } from './publicacion.ts';
import { ejercicioPedido } from './seccion.ts';

/**
 * «Cuadros de valuación»: los tres cuadros nacionales de ADR-0017, tal como el conjunto sellado
 * los publica.
 *
 * <h2>No hay un solo control de escritura, y no es un recorte</h2>
 *
 * Los tres cuadros son **nacionales**: los aprueba el MVCS o el MEF y no los edita ninguna
 * municipalidad. En la base eso no es una convencion sino un CHECK —{@code
 * valor_unitario_nacional_ck}, {@code depreciacion_nacional_ck} y {@code
 * valor_referencial_nacional_ck}, los tres `municipalidad_id IS NULL`— y el unico rol que puede
 * escribir una fila es {@code rol_carga_parametros}, que la aplicacion no usa nunca. La pantalla
 * lo dice, porque quien ve «valores» en un sistema multi-municipal supone lo contrario.
 *
 * <h2>Lo que esta pantalla NO puede ensenar, dicho para que no parezca un olvido</h2>
 *
 * La edicion es la unidad que se publica —una fila de un cuadro no se corrige: se publica otra
 * edicion— y lleva su `sha256` del derivado, su doble firma (ADR-0007) y su **clave**, que es
 * donde viaja la region del cuadro de valores unitarios. **Ninguna de las cuatro operaciones
 * publica nada de eso**: `ValorUnitarioDelSnapshot` tiene seis campos y ninguno es la clave de
 * la edicion. Asi que esta pantalla lo nombra en vez de sacarlo de la captura del artboard, que
 * la volveria a meter en el bundle de produccion y la publicaria sin ninguna de las dos firmas.
 */

export interface CuadrosProps {
  /** El ejercicio de trabajo, tal como lo fija la barra global del marco. */
  readonly ejercicio: string;
}

/** Lo que un `ValorUnitarioDelSnapshot` publica, escrito para poder decir lo que NO publica. */
const CAMPOS_DEL_VALOR_UNITARIO =
  'partida, categoria, anioConstruccionDesde, anioConstruccionHasta, valorM2 y documentoFuente';

export function Cuadros({ ejercicio }: CuadrosProps) {
  const [id, fijarId] = useState<IdDeCuadro>('unitarios');
  const [ambito, fijarAmbito] = useState<Ambito>('VALUACION');

  const pedido = ejercicioPedido(ejercicio);
  const vigente = useUno<ConjuntoVigenteResource>(pedido === null ? null : RUTAS.vigente(pedido));
  const conjuntoId = vigente.dato?.conjuntoId ?? null;
  const snapshot = useSnapshot(
    conjuntoId === null ? null : RUTAS.snapshot(conjuntoId, ambito),
  );

  const cuadro = cuadroPorId(id);
  const recurso = snapshot.dato?.recurso ?? null;
  const cargando = vigente.cargando || snapshot.cargando;
  const filas = recurso === null ? [] : filasDelCuadro(cuadro, recurso);
  const estado =
    recurso === null ? null : estadoDelCuadro(ambito, cuadro, cuantasFilasDe(cuadro, recurso));
  const fuente = fuenteDelCuadro(filas);
  const fallosDeDominio = recurso === null ? [] : fueraDeDominio(cuadro, recurso);
  // «Ese ejercicio no esta publicado» es una RESPUESTA, no una averia, y se lee distinto: lo
  // arregla quien componga y selle el conjunto, no quien mire esta pantalla (AC4).
  const sinPublicar = vigente.fallo !== null && esEjercicioSinPublicar(vigente.fallo);

  return (
    <section className="kn-seccion kn-seccion--cuadros" aria-label="Cuadros de valuación">
      <div className="kn-seccion__pestanas" role="tablist" aria-label="Los tres cuadros">
        {CUADROS_DE_VALUACION.map((uno) => (
          <button
            key={uno.id}
            type="button"
            role="tab"
            aria-selected={uno.id === id}
            className={`kn-seccion__pestana${uno.id === id ? ' kn-seccion__pestana--actual' : ''}`}
            onClick={() => {
              fijarId(uno.id);
            }}
          >
            <span>{uno.rotulo}</span>
            <span className="kn-seccion__conteo">
              {recurso === null ? '—' : String(cuantasFilasDe(uno, recurso))}
            </span>
          </button>
        ))}
      </div>

      <div className="kn-seccion__cuerpo">
        <div className="kn-seccion__banda">
          <p className="kn-seccion__nota">{cuadro.nota}</p>
          <span className="kn-seccion__marcas">
            <Insignia tono="info">Sólo lectura</Insignia>
            <Insignia tono="info">Nacional (ADR-0017)</Insignia>
          </span>
        </div>

        <p className="kn-seccion__prosa">
          Es nacional y no de esta municipalidad: en la base lo impide{' '}
          <code>{cuadro.checkNacional}</code> sobre <code>{cuadro.tabla}</code>, un{' '}
          <code>municipalidad_id IS NULL</code>. Escribirlo es del rol{' '}
          <code>rol_carga_parametros</code>, que esta aplicación no usa nunca; aquí no hay ningún
          control que guarde nada.
        </p>

        <SelectorDeAmbito
          ambito={ambito}
          alElegir={fijarAmbito}
          cuadro={cuadro}
        />

        <FichaDeLaEdicion cuadro={cuadro} documento={fuente.documento} distintos={fuente.distintos} />

        {cuadro.id === 'unitarios' && <LaRegion />}

        {sinPublicar && (
          <Aviso
            tipo="vacio"
            titulo="Ese ejercicio no tiene un conjunto de parámetros sellado"
            detalle={vigente.error ?? undefined}
          />
        )}

        {vigente.error !== null && !sinPublicar && (
          <Aviso
            tipo="error"
            titulo="No se pudo resolver qué conjunto rige este ejercicio"
            detalle={vigente.error}
          />
        )}

        {vigente.error === null && snapshot.error !== null && (
          <Aviso tipo="error" titulo="No se pudo leer el conjunto" detalle={snapshot.error} />
        )}

        {fallosDeDominio.length > 0 && (
          <Aviso
            tipo="error"
            titulo="Hay valores fuera del dominio que la base declara"
            detalle={
              `La base no los puede haber escrito —tiene su CHECK—, así que este cuerpo no viene ` +
              `de donde se cree: ${fallosDeDominio.join('; ')}.`
            }
          />
        )}

        {(cargando || estado === 'CON_FILAS' || estado === 'DE_MAS') && (
          <>
            {estado === 'DE_MAS' && <ElCuadroDeMas cuadro={cuadro} ambito={ambito} />}
            <Tabla
              columnas={cuadro.columnas}
              filas={filas}
              rotulo={`${cuadro.rotulo} — ámbito ${ambito}`}
              cargando={cargando}
              variante={cuadro.variante}
            />
            <p className="kn-seccion__pie">{cuadro.pie}</p>
          </>
        )}

        {estado === 'FUERA_DEL_AMBITO' && (
          <Aviso
            tipo="vacio"
            titulo={`El ámbito ${ambito} no lleva este cuadro`}
            detalle={
              `No es un cuadro sin datos: es el reparto de ADR-0024. «${cuadro.rotulo}» viaja en ` +
              `el ámbito ${cuadro.ambito}, y ComponerSnapshot deja la lista vacía en el otro para ` +
              'no servirle a nadie la mitad que no pidió —con otra huella y con la mitad de sus ' +
              'filas sin consumidor.'
            }
          >
            <Boton
              variante="primario"
              onClick={() => {
                fijarAmbito(cuadro.ambito);
              }}
            >
              Pedir el snapshot en {cuadro.ambito}
            </Boton>
          </Aviso>
        )}

        {estado === 'SIN_FILAS' && (
          <Aviso
            tipo="error"
            titulo="Este ámbito sí lleva el cuadro, y llegó vacío"
            detalle={
              `El ámbito ${ambito} lleva «${cuadro.rotulo}», así que el vacío no lo explica el ` +
              'reparto: o este conjunto se selló sin esa edición —la versión 1 de 2026 se selló ' +
              'sin la vehicular, y sigue sirviendo— o algo no compuso. Las dos se arreglan de ' +
              'manera distinta, así que no se dicen igual.'
            }
          />
        )}
      </div>
    </section>
  );
}

/** El selector de ambito: dos botones, sin valor por omision escondido. */
function SelectorDeAmbito({
  ambito,
  alElegir,
  cuadro,
}: {
  readonly ambito: Ambito;
  readonly alElegir: (elegido: Ambito) => void;
  readonly cuadro: CuadroDeValuacion;
}) {
  return (
    <div className="kn-seccion__ambito">
      <span className="kn-seccion__ambito-rotulo">
        Ámbito del snapshot <code>ambito</code>
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
      <span className="kn-seccion__ambito-nota">
        «{cuadro.rotulo}» viaja en <strong>{cuadro.ambito}</strong>. El ámbito no tiene valor por
        omisión y no se lee en minúsculas: <code>?ambito=valuacion</code> lo rechaza el backend
        nombrándolo.
      </span>
    </div>
  );
}

/** Lo que la edicion es, con lo que esta operacion publica y lo que no. */
function FichaDeLaEdicion({
  cuadro,
  documento,
  distintos,
}: {
  readonly cuadro: CuadroDeValuacion;
  readonly documento: string | null;
  readonly distintos: readonly string[];
}) {
  return (
    <div className="kn-seccion__edicion">
      <h3 className="kn-seccion__titulo">La edición que publica estas filas</h3>
      <dl className="kn-seccion__campos">
        <div className="kn-seccion__campo">
          <dt>Documento fuente</dt>
          <dd>
            {documento ?? (distintos.length === 0 ? '—' : distintos.join(' · '))}
            {distintos.length > 1 && (
              <span className="kn-seccion__alarma">
                {' '}
                Las filas dicen {distintos.length} documentos distintos: este cuadro mezcla dos
                ediciones, y eso no se puede resumir en una línea sin mentir.
              </span>
            )}
          </dd>
        </div>
        <div className="kn-seccion__campo">
          <dt>Tabla</dt>
          <dd>
            <code>{cuadro.tabla}</code>
          </dd>
        </div>
        <div className="kn-seccion__campo">
          <dt>Ámbito que la lleva</dt>
          <dd>{cuadro.ambito}</dd>
        </div>
      </dl>
      <p className="kn-seccion__prosa">
        Lo que esta operación <strong>no</strong> publica, y por eso no se dibuja: el{' '}
        <code>sha256</code> del derivado, la doble firma de ADR-0007 —quién transcribió y quién
        verificó— y la <strong>clave de la edición</strong>. Están en el corpus de{' '}
        <code>docs/10-negocio/valores-normativos/</code>, que no tiene endpoint. Sacarlos de la
        captura del artboard los publicaría desde una pantalla, sin ninguna de las dos firmas.
      </p>
    </div>
  );
}

/**
 * La region del cuadro de valores unitarios, que es lo que hace usable el cuadro.
 *
 * La R.M. anual del MVCS publica **un cuadro por region** —Lima Metropolitana y Callao, Costa,
 * Sierra y Selva— y `valor_unitario_edificacion` **no tiene columna de region**: con las cuatro
 * cargadas, `valor_unitario_uq (publicacion_id, partida, categoria, anio_construccion_desde)`
 * las haria chocar celda con celda. Por eso hay **una region por edicion** y la region viaja en
 * la CLAVE de la edicion.
 *
 * Y por eso este bloque existe: la clave **no viaja en el snapshot**, asi que la pantalla no
 * puede decir de que region es lo que se esta viendo. Decirlo es peor que callarlo solo si se
 * dice a medias; aqui se dice entero, con lo que haria falta para arreglarlo.
 */
function LaRegion() {
  const id = useId();
  return (
    <section className="kn-seccion__alerta" aria-labelledby={id}>
      <h3 className="kn-seccion__titulo" id={id}>
        De qué región es este cuadro
      </h3>
      <p className="kn-seccion__prosa">
        <strong>Esta operación no lo dice.</strong> La R.M. anual publica un cuadro por región
        —Lima Metropolitana y Callao, Costa, Sierra y Selva— y <code>valor_unitario_edificacion</code>{' '}
        no tiene columna de región: las cuatro chocarían celda con celda en{' '}
        <code>valor_unitario_uq (publicacion_id, partida, categoria, anio_construccion_desde)</code>.
        Así que hay <strong>una región por edición</strong> y la región viaja en la{' '}
        <strong>clave</strong> de la edición —la del piloto es <code>ANEXO-I.2-COSTA</code>—, que{' '}
        <code>GET /conjuntos/&#123;id&#125;/snapshot</code> no publica: sus filas traen{' '}
        {CAMPOS_DEL_VALOR_UNITARIO}.
      </p>
      <p className="kn-seccion__prosa">
        Un cuadro de valores unitarios sin su región no se puede usar: la misma letra vale otra
        cifra por metro cuadrado en cada una de las cuatro. Mientras la clave de la edición no
        viaje en el snapshot, quien calcule con estas cifras tiene que comprobar contra el corpus
        cuál se cargó, y eso no se puede hacer desde aquí.
      </p>
    </section>
  );
}

/** El aviso de un cuadro que llego aunque su ambito no lo lleve. */
function ElCuadroDeMas({
  cuadro,
  ambito,
}: {
  readonly cuadro: CuadroDeValuacion;
  readonly ambito: Ambito;
}) {
  const id = useId();
  return (
    <section className="kn-seccion__alerta" aria-labelledby={id}>
      <h3 className="kn-seccion__titulo" id={id}>
        Este cuadro llegó, y el ámbito {ambito} no lo lleva
      </h3>
      <p className="kn-seccion__prosa">
        «{cuadro.rotulo}» viaja en {cuadro.ambito}, y <code>ComponerSnapshot</code> deja la lista
        vacía en el otro ámbito. Que haya llegado llena significa que esta respuesta no la compuso
        él: es el <strong>proxy de datos</strong>, que no mira la cadena de consulta y sirve las
        cuatro listas llenas para los dos ámbitos. Se dice en vez de dibujarlo como normal, porque
        una pantalla que se acostumbre a este reparto funciona aquí y falla contra el backend.
      </p>
    </section>
  );
}
