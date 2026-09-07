import { RUTAS, type ConjuntoResource } from '../datos/lecturas.ts';
import { formatearFecha } from '../dominio/formato.ts';
import type { EstadoDeEdiciones } from './estadoDeNormativa.ts';

/**
 * La regla de la vigencia y el dialecto del listado, escritos UNA vez.
 *
 * Los usan las dos secciones —el Panel dice si el ejercicio esta sellado, Ediciones lista todas
 * las versiones— y una copia en cada una es una copia que un dia deja de coincidir. Y aqui eso
 * no seria un detalle de interfaz: las dos estarian contestando de forma distinta a **cual es el
 * conjunto con el que se emite**.
 *
 * <h2>Varias versiones SELLADAS del mismo ejercicio no son un error (AC3)</h2>
 *
 * No existe la restriccion de «un conjunto sellado por ejercicio». Lo que hay, medido sobre el
 * backend, es:
 *
 * <ul>
 *   <li>`conjunto_uq (municipalidad_id, ejercicio, version)` — la version forma parte de la
 *       identidad;</li>
 *   <li>`conjunto_sellado_uq` <b>no existe</b>: `V10__varias_versiones_selladas.sql` lo borro a
 *       proposito, porque ARQ-09 §3 exige lo contrario —un arancel corregido a mitad de ano abre
 *       una version nueva y se sella tambien—;</li>
 *   <li>`ParametrosRepositoryJdbc.selladoVigenteDe` <b>ordena por version y toma la ultima</b>.</li>
 * </ul>
 *
 * Por eso la lista tiene que poder ensenar dos conjuntos sellados de 2026 **marcando cual rige**.
 * Sin la marca, quien mire concluye que el sistema se contradice — y la conclusion razonable
 * seria la peor de las dos: que no se sabe con cual se emitio.
 *
 * <h2>Lo que esta regla NO puede prometer, y se dice</h2>
 *
 * Se resuelve sobre **las filas que la pagina trajo**. La autoridad es el servidor, que la
 * resuelve sobre la tabla entera; si el listado esta partido en paginas y las versiones de un
 * ejercicio caen en dos, lo que aqui se marque puede no ser lo que el servidor devuelve. Por eso
 * la seccion lo escribe al pie en vez de callarlo: `vigenteDe` contesta sobre lo que tiene, y
 * quien la llama sabe cuanto tiene.
 */

/** El estado de un conjunto. Son dos, y el paso entre ellos va en una sola direccion. */
export const SELLADO = 'SELLADO';
export const ABIERTO = 'ABIERTO';

/**
 * Los cuatro campos por los que el backend admite ordenar este listado, y ninguno mas.
 *
 * Salen de `ParametrosRepositoryJdbc.ORDEN_CONJUNTO`, que es
 * `OrdenSeguro.sobre("ejercicio", "version", "estado", "id")`. Cualquier otro contesta **422
 * `ORDEN_NO_ADMITIDO`**, asi que la pantalla no debe poder pedirlo: el desplegable se compone de
 * esta lista y `rutaDelListado` no sabe escribir otra cosa.
 *
 * Estan en `camelCase` porque asi viaja `?ordenarPor=`; la traduccion a columna la hace
 * `OrdenSeguro` en el servidor, contra su propia lista blanca.
 */
export const ORDENES_ADMITIDOS: readonly string[] = ['ejercicio', 'version', 'estado', 'id'];

/** Como se rotula cada uno en el desplegable. El valor que viaja sigue siendo la clave. */
export const ROTULO_DEL_ORDEN: Readonly<Record<string, string>> = {
  ejercicio: 'Ejercicio',
  version: 'Versión',
  estado: 'Estado',
  id: 'Identificador',
};

/** Los dos sentidos de `Paginacion.Direccion`. */
export const DIRECCIONES: readonly string[] = ['DESCENDENTE', 'ASCENDENTE'];

/**
 * El tope de `tamano`, de `Paginacion.TAMANO_MAXIMO`.
 *
 * El backend rechaza con 422 cualquier tamano fuera de 1..500 —`"El tamano de pagina va de 1 a
 * 500"`—, asi que la pantalla ofrece solo tamanos que caben y `rutaDelListado` acota el que le
 * llegue. Un desplegable no puede pedir 1000; un estado guardado de otra version de la pantalla,
 * si.
 */
export const TAMANO_MAXIMO = 500;

/** Los tamanos que el desplegable ofrece. El ultimo es el tope, para poder llegar a el. */
export const TAMANOS: readonly number[] = [20, 50, 100, TAMANO_MAXIMO];

/**
 * La ruta del listado, con los cuatro nombres del dialecto y ninguno mas.
 *
 * Los cuatro se admiten siempre —`GuardiaDeParametros.DIALECTO_DE_LA_PAGINACION`— tambien en la
 * operacion que no declara ningun `@RequestParam`, que es justo el caso de esta. Un quinto
 * nombre seria un **422 «parametro desconocido»**, que es el borde que `GuardiaDeParametros`
 * puso para que un filtro mal escrito no se ignorara en silencio devolviendo el listado entero.
 *
 * El campo de orden se acota contra `ORDENES_ADMITIDOS` y no se confia en quien llama: es lo
 * unico que separa esta pantalla de un `422 ORDEN_NO_ADMITIDO`, y ese rechazo no lo entiende
 * nadie que este mirando una lista.
 */
export function rutaDelListado(estado: EstadoDeEdiciones): string {
  const ordenarPor = ORDENES_ADMITIDOS.includes(estado.ordenarPor)
    ? estado.ordenarPor
    : (ORDENES_ADMITIDOS[0] ?? 'ejercicio');
  const direccion = DIRECCIONES.includes(estado.direccion) ? estado.direccion : 'DESCENDENTE';
  const tamano = Math.min(Math.max(estado.tamano, 1), TAMANO_MAXIMO);
  const pagina = Math.max(estado.pagina, 0);

  const consulta = new URLSearchParams({
    pagina: String(pagina),
    tamano: String(tamano),
    ordenarPor,
    direccion,
  });
  return `${RUTAS.conjuntos}?${consulta.toString()}`;
}

/** Las versiones SELLADAS de ese ejercicio, entre las que la pagina trajo. */
export function selladosDe(
  conjuntos: readonly ConjuntoResource[],
  ejercicio: number,
): readonly ConjuntoResource[] {
  return conjuntos.filter((uno) => uno.ejercicio === ejercicio && uno.estado === SELLADO);
}

/**
 * El conjunto que rige ese ejercicio: **la ultima version sellada**, no una cualquiera.
 *
 * Es la regla de `selladoVigenteDe`, escrita aqui igual. Devuelve `null` cuando el ejercicio no
 * tiene ninguna version sellada entre las servidas — que es una respuesta, no un error: es lo
 * que contesta hoy toda municipalidad recien implantada.
 */
export function vigenteDe(
  conjuntos: readonly ConjuntoResource[],
  ejercicio: number,
): ConjuntoResource | null {
  return (
    selladosDe(conjuntos, ejercicio).reduce<ConjuntoResource | null>(
      (mayor, uno) => (mayor === null || uno.version > mayor.version ? uno : mayor),
      null,
    ) ?? null
  );
}

/** Si ese conjunto es el que rige su ejercicio, entre los servidos. */
export function esVigente(
  conjuntos: readonly ConjuntoResource[],
  conjunto: ConjuntoResource,
): boolean {
  return vigenteDe(conjuntos, conjunto.ejercicio)?.id === conjunto.id;
}

/** Los ejercicios que la pagina trajo, de mayor a menor y sin repetir. */
export function ejerciciosDe(conjuntos: readonly ConjuntoResource[]): readonly number[] {
  return [...new Set(conjuntos.map((uno) => uno.ejercicio))].sort((a, b) => b - a);
}

/** Lo que se ensena donde no hay dato. Un guion, y no una celda en blanco. */
export const SIN_DATO = '—';

/**
 * `'2026-09-06T15:22:00Z'` + `'hneyra'` → `'06/09/2026 15:22 · hneyra'`.
 *
 * **Sobre texto, sin construir un `Date`.** `new Date('2026-09-06T15:22:00Z')` se imprime en la
 * zona del puesto: en Lima ese instante es el **6 a las 10:22**, y un sello que cambia de hora
 * —y a veces de dia— segun donde este el navegador no es un detalle de formato en el acto
 * administrativo del que cuelga la reproducibilidad de un ejercicio. Lo que se ensena es lo que
 * el servidor escribio, con su `Z` implicita, y por eso el minuto va tal cual.
 *
 * Un conjunto sin sellar no tiene fecha ni usuario, y eso se dice con un guion: la cadena vacia
 * diria que si los tiene y estan en blanco.
 */
export function selloDe(conjunto: ConjuntoResource): string {
  if (conjunto.fechaSellado === null) {
    return SIN_DATO;
  }
  const partes = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(conjunto.fechaSellado);
  const cuando =
    partes === null
      ? conjunto.fechaSellado
      : `${formatearFecha(partes[1] ?? '')} ${String(partes[2])}`;
  return conjunto.usuarioSellado === null ? cuando : `${cuando} · ${conjunto.usuarioSellado}`;
}

/**
 * El codigo del catalogo con que empieza el mensaje de un `Recurso` fallido, o cadena vacia.
 *
 * `useRecurso.mensajeDe` escribe `«CODIGO (estado): texto»` **poniendo el codigo delante a
 * proposito**: es lo estable, y es lo que permite reaccionar sin leer prosa en castellano que se
 * reescribe en cuanto alguien la lee en voz alta. Aqui se usa para una sola distincion, y es
 * cara: `SIN_PRIVILEGIO` en el listado de conjuntos no es una averia —el Panel funciona con
 * menos privilegio que Ediciones, porque su lectura del ejercicio va con `SESION_PROPIA` y esta
 * no (AC2)— y ensenarla como «no se pudo leer» mandaria a reintentar algo que va a salir igual
 * las veces que se pulse.
 */
export function codigoDelError(error: string | null): string {
  return /^([A-Z_]+) \(/.exec(error ?? '')?.[1] ?? '';
}
