import {
  EL_SUJETO,
  coordenada,
  type CeldaDeLaTabla,
  type Coordenada,
  type DatoConNombre,
  type DatosDeUnaTabla,
  type DefinicionDeTabla,
  type FilaDeLaTabla,
  type RutaDeLaHoja,
} from '@kamayuk/ui';

import { cliente } from '../api/cliente.ts';
import { t } from '../i18n/i18n.ts';
import { pantallaDe } from '../pantallas/definiciones/index.ts';
import type { Conector, Reparto } from './conectores.ts';
import {
  CLAVE_DEL_CONTENIDO,
  CLAVE_DE_LAS_EDICIONES,
  CONTENIDO_DEL_CONJUNTO,
  EN_LA_RUTA,
  LISTADO_DE_EDICIONES,
  hayMasDe,
  loPedidoEn,
  paginasDe,
  rutaDe,
  type ConjuntoResource,
  type ContenidoDelConjuntoResource,
  type Paginado,
  type ParametroDelConjuntoResource,
  type SitioDeLaRuta,
} from './lecturas.ts';

/**
 * **Ediciones: la lista que pagina y ordena en el servidor, y el detalle del elegido** (#65).
 *
 * <h2>Dos lecturas, y ninguna sostiene a la otra</h2>
 *
 * <table>
 *   <tr><td>{@link CLAVE_DE_LAS_EDICIONES}</td><td>`GET /seguridad/parametros` — la PAGINA de
 *     conjuntos. La ventana sale de la ruta de la hoja</td></tr>
 *   <tr><td>{@link CLAVE_DEL_CONTENIDO}</td><td>`GET /conjuntos/{id}/parametros` — lo que el
 *     conjunto elegido lleva dentro, **abierto o sellado** (#56)</td></tr>
 * </table>
 *
 * Las dos exigen el mismo acceso —`parametros` con privilegio de LECTURA
 * (`ParametrosController.java:42`, `ContenidoDelConjuntoController.java:80`)—, asi que la
 * separacion **no** es por autorizacion como en el Panel: es porque **fallan por su cuenta y en
 * momentos distintos**. Un 404 del detalle —«ese conjunto no esta»— no puede vaciar la lista, y una
 * averia de la lista no puede borrar el detalle que ya se esta leyendo (AC 4). Cada bloque declara
 * su `lectura` y dibuja su estado en su sitio.
 *
 * <h2>La ventana sale de la RUTA, y el tamano de la DEFINICION</h2>
 *
 * Los mandos del interprete no piden nada: escriben `?pagina=`, `?tamano=`, `?ordenarPor=` y
 * `?direccion=` en la ruta de la hoja, y `useDatosDeLaHoja` mete esos cuatro valores en la clave de
 * consulta. Lo que este archivo hace es traducirlos a lo que se pide.
 *
 * **Y lo que es fijo se LEE de la definicion en vez de escribirse aqui**: el tamano por omision,
 * los tamanos que se ofrecen y la lista de campos que se puede ordenar. Es la leccion de
 * `rentas`#186: con el tamano escrito en los dos sitios, el dia que alguien suba uno los mandos
 * cuentan paginas de cien sobre respuestas de veinte y «Siguiente» lleva a una pagina que no
 * existe.
 *
 * <h2>Lo que llega de la ruta se VALIDA aqui, y no porque el interprete se equivoque</h2>
 *
 * El interprete solo escribe paginas enteras y campos de su lista blanca. Pero **la ruta la escribe
 * cualquiera**: `#/ediciones?ordenarPor=;DROP` es una direccion que se puede teclear, y reenviarla
 * tal cual seria un **422 `ORDEN_NO_ADMITIDO`** dibujado como una averia de la pantalla. Lo que no
 * es uno de los cuatro campos admitidos, uno de los tamanos ofrecidos o un entero, **no viaja**: se
 * cae a lo que la definicion fija, que es lo unico que se sabe cierto.
 *
 * <h2>Se manda SIEMPRE el orden y la pagina, y esto es una diferencia con `rentas`</h2>
 *
 * Alli, sin campo en la ruta no se manda `ordenarPor` y ordena el backend por el suyo; que los dos
 * coincidan lo cruza una guarda contra el `orden.porOmision` que su contrato publica. **El contrato
 * de este sistema no publica ese dato**: `docs/50-api/parametros-de-la-api.json` trae
 * `ordenarPorAdmitidos` y `tamanoMaximo`, y ni un campo por omision (medido). Asi que aqui la
 * pregunta no se contesta con una guarda: se quita. Se manda el campo que el desplegable ensena
 * —`orden.campos[0]` cuando la ruta no dice otro—, y entonces lo que la barra anuncia y lo que el
 * servidor ordena son lo mismo por construccion y no por coincidencia.
 *
 * <h2>Lo que este conector NO cuenta</h2>
 *
 * Ni `hayMas` ni `totalPaginas`: los dos salen del envoltorio de la respuesta. Contar las filas
 * recibidas —«llegaron veinte, quiza hay mas»— diria que no hay pagina siguiente justo cuando el
 * tope se alcanza exacto, que es el unico caso en que equivocarse cuesta algo.
 */

/* ── La tabla de la definicion, que es de donde salen el tamano y el orden ─────────────────── */

/** La tabla `clave` de esta hoja, con lo que declara. Revienta si la definicion no la tiene. */
function tablaDeclarada(clave: string): DefinicionDeTabla {
  const tabla = pantallaDe('nor-ediciones')
    .bloques.map((bloque) => bloque.tabla)
    .find((una): una is DefinicionDeTabla => una?.clave === clave);
  if (tabla === undefined) {
    throw new Error(
      `«nor-ediciones» no tiene ninguna tabla con la clave «${clave}».\n\n` +
        '  El conector reparte filas a una tabla que su definicion no declara: o la clave esta mal\n' +
        '  escrita en uno de los dos, o la tabla perdio su `clave` y sus filas ya no llegan a\n' +
        '  ninguna parte — que no da error, da una tabla vacia diciendo su `vacio`.',
    );
  }
  return tabla;
}

/** La paginacion EN SERVIDOR de la lista. Revienta si la definicion no la declara. */
function laPaginacion() {
  const paginacion = tablaDeclarada(CLAVE_DE_LAS_EDICIONES).paginacion;
  if (paginacion === undefined || paginacion.en !== 'servidor') {
    throw new Error(
      'La tabla «ediciones» no declara «paginacion: { en: \'servidor\' }».\n\n' +
        '  Este conector pide una VENTANA —manda `?pagina=` y `?tamano=`— y la tabla no dibujaria\n' +
        '  ningun mando con que moverla: la hoja ensenaria veinte filas de un padron entero sin\n' +
        '  decir que son veinte de cuantas.',
    );
  }
  return paginacion;
}

/** El orden que la lista ofrece. Revienta si la definicion no declara ninguno. */
function elOrden() {
  const orden = tablaDeclarada(CLAVE_DE_LAS_EDICIONES).orden;
  if (orden === undefined) {
    throw new Error(
      'La tabla «ediciones» no declara `orden`, y este conector manda `?ordenarPor=`.\n\n' +
        '  Sin la lista blanca de la definicion no hay contra que validar lo que traiga la ruta, y\n' +
        '  un `?ordenarPor=` tecleado saldria al cable: **422 ORDEN_NO_ADMITIDO**, dibujado como\n' +
        '  una averia de la pantalla.',
    );
  }
  return orden;
}

/* ── La ventana que se pide ────────────────────────────────────────────────────────────────── */

/** Un entero no negativo escrito en una ruta, o `undefined` si eso no es lo que hay. */
function enteroNoNegativo(texto: string | null): string | undefined {
  return texto !== null && /^\d+$/.test(texto) ? texto : undefined;
}

/**
 * **Los cuatro parametros que se mandan**, de la ruta lo elegido y de la definicion lo fijo.
 *
 * Los cuatro viajan SIEMPRE, incluida la pagina cero: la peticion dice entonces exactamente lo que
 * los mandos ensenan, y no hay que saberse los valores por omision del backend para leer una traza.
 */
export function laVentanaQueSePide(ruta: RutaDeLaHoja): Readonly<Record<SitioDeLaRuta, string>> {
  const paginacion = laPaginacion();
  const orden = elOrden();
  const deLaRuta = (sitio: SitioDeLaRuta): string | null => ruta.parametros[sitio] ?? null;

  // El tamano tiene que ser uno de los OFRECIDOS. No cualquiera: el backend topa en 500
  // (`Paginacion.TAMANO_MAXIMO`) y un `?tamano=600` tecleado seria un 422 dicho como averia.
  const pedido = deLaRuta(EN_LA_RUTA.tamano);
  const tamano =
    pedido !== null && (paginacion.tamanos ?? []).some((uno) => String(uno) === pedido)
      ? pedido
      : String(paginacion.tamano);

  const campo = deLaRuta(EN_LA_RUTA.ordenarPor);
  const ordenarPor =
    campo !== null && orden.campos.some((uno) => uno.valor === campo)
      ? campo
      : (orden.campos[0]?.valor ?? '');

  // El sentido, solo si es uno de los dos que la definicion escribe. Son los del backend
  // —`Paginacion.Direccion`— y por eso son dato y no una constante de la libreria.
  const sentido = deLaRuta(EN_LA_RUTA.direccion);
  const direccion =
    sentido === orden.ascendente || sentido === orden.descendente ? sentido : orden.ascendente;

  return {
    [EN_LA_RUTA.pagina]: enteroNoNegativo(deLaRuta(EN_LA_RUTA.pagina)) ?? '0',
    [EN_LA_RUTA.tamano]: tamano,
    [EN_LA_RUTA.ordenarPor]: ordenarPor,
    [EN_LA_RUTA.direccion]: direccion,
  };
}

/** Lo que la lectura del listado devuelve: la pagina que llego **y la ventana que se pidio**. */
export interface LaPaginaDeEdiciones {
  readonly ventana: Readonly<Record<SitioDeLaRuta, string>>;
  readonly pagina: Paginado<ConjuntoResource>;
}

/**
 * Pide la pagina, y devuelve **tambien lo que pidio**.
 *
 * La ventana viaja con la respuesta y no se vuelve a leer de la ruta en `repartir` por dos motivos:
 * `repartir` no recibe la ruta —su trabajo es lo que llego—, y ademas lo que hay que publicar es
 * **lo que se pidio**, que con una peticion en vuelo no es lo mismo que lo que la ruta dice ahora.
 */
async function pedirLasEdiciones(senal: AbortSignal, ruta: RutaDeLaHoja): Promise<LaPaginaDeEdiciones> {
  const ventana = laVentanaQueSePide(ruta);
  const pagina = await cliente.solicitar<Paginado<ConjuntoResource>>(
    rutaDe({ ...LISTADO_DE_EDICIONES, parametros: ventana }),
    { senal },
  );
  return { ventana, pagina };
}

/** Y el contenido del conjunto elegido. El sujeto de la ruta es el `{id}` del camino. */
async function pedirElContenido(
  senal: AbortSignal,
  ruta: RutaDeLaHoja,
): Promise<ContenidoDelConjuntoResource> {
  return cliente.solicitar<ContenidoDelConjuntoResource>(
    rutaDe(CONTENIDO_DEL_CONJUNTO, { id: ruta.sujeto ?? '' }),
    { senal },
  );
}

/* ── Las frases de este conector ───────────────────────────────────────────────────────────── */

/**
 * Lo que este conector escribe, en castellano, que es la clave (#60).
 *
 * Pasan por `t()` **aqui** y no por el `traducir` del interprete: lo que el interprete traduce son
 * las palabras de la DEFINICION; los `valores`, las celdas y los `nombrados` son datos y no los
 * toca. Una frase que este conector compone es de las primeras aunque viaje por el segundo camino.
 */
export const FRASES_DE_EDICIONES = {
  sinSellar: 'Este conjunto no está sellado: no tiene ni fecha ni usuario de sello.',
  sinClave: 'Este tipo de parámetro no lleva clave: tiene un solo valor.',
  sinValorNumerico: 'Este parámetro no es una cifra: su valor va en «Valor de texto».',
  sinValorTexto: 'Este parámetro es una cifra: su valor va en «Valor numérico».',
  sinVigenciaDesde: 'El servidor no publicó desde cuándo rige esta fila.',
  sinVigenciaHasta: 'Sin fecha de fin: la norma sigue vigente mientras no se derogue.',
  deQueVentana: '{{cuantas}} de {{total}}, página {{pagina}}',
  cuantosParametros: '{{cuantos}} en este conjunto',
  sinPedir: 'sin pedir',
  laHojaLee:
    'Esta hoja lee dos cosas: la página de ediciones que dice la dirección —el orden y la página viajan en ella, así que este enlace se puede compartir— y, de la que se elija, lo que lleva dentro. El buscador y el desplegable de estado todavía NO filtran: la operación no admite filtrar por estado y el filtro en el cliente lo debe kamayuk-lib#86. Abrir una versión, agregar un parámetro y sellar son de normativa#68.',
} as const;

/** Las claves de traduccion de este conector. */
export function clavesDeEdiciones(): readonly string[] {
  return Object.values(FRASES_DE_EDICIONES);
}

/* ── Las coordenadas de la definicion ──────────────────────────────────────────────────────── */

/** Bloque 1 — «Parametros del conjunto»: los seis campos de la ficha del elegido. */
const IDENTIFICADOR = coordenada(1, 0);
const EJERCICIO = coordenada(1, 1);
const VERSION = coordenada(1, 2);
const ESTADO = coordenada(1, 3);
const FECHA_DE_SELLADO = coordenada(1, 4);
const USUARIO_QUE_SELLO = coordenada(1, 5);

/* ── De lo que llego a lo que se dibuja ────────────────────────────────────────────────────── */

/** Una celda con su texto, o el hueco con su motivo. Nunca `''` y nunca `0` (AC 5). */
function celda(valor: string | null, porQue: string): CeldaDeLaTabla {
  return valor === null ? { texto: null, nota: t(porQue) } : valor;
}

/** Las filas de la lista, con la que se esta mirando realzada. */
function lasEdiciones(
  lo: LaPaginaDeEdiciones,
  elegido: number | undefined,
): DatosDeUnaTabla {
  const filas: readonly FilaDeLaTabla[] = lo.pagina.contenido.map((conjunto) => ({
    clave: String(conjunto.id),
    // La fila se realza cuando es la que el detalle esta ensenando, y se sabe por lo que el
    // detalle CONTESTO y no por lo que la ruta pide: asi lo realzado y lo dibujado abajo son lo
    // mismo aunque la peticion siga en vuelo o haya fallado.
    ...(elegido === conjunto.id ? { realzada: true } : {}),
    celdas: [
      String(conjunto.ejercicio),
      String(conjunto.version),
      conjunto.estado,
      // Tal cual la escribio el servidor: sin `Date` y sin la zona del puesto.
      celda(conjunto.fechaSellado, FRASES_DE_EDICIONES.sinSellar),
      celda(conjunto.usuarioSellado, FRASES_DE_EDICIONES.sinSellar),
      String(conjunto.id),
    ] as readonly CeldaDeLaTabla[],
    // Lo que las reglas de la fila leen: el identificador con que se abre su detalle.
    datos: new Map<string, DatoConNombre>([['id', String(conjunto.id)]]),
  }));
  return {
    filas,
    // El total es el que PUBLICA la operacion —`totalElementos`—, nunca uno contado sobre la
    // pagina: contar aqui daria el tamano de la ventana con aspecto de tamano del padron.
    conteo: t(FRASES_DE_EDICIONES.deQueVentana, {
      cuantas: filas.length,
      total: lo.pagina.totalElementos,
      pagina: lo.pagina.pagina + 1,
    }),
  };
}

/** Las filas del contenido del conjunto elegido. Siete columnas, cinco de ellas nulables. */
function losParametros(
  parametros: readonly ParametroDelConjuntoResource[],
): DatosDeUnaTabla {
  return {
    filas: parametros.map((parametro) => ({
      clave: String(parametro.id),
      celdas: [
        parametro.tipo,
        celda(parametro.clave, FRASES_DE_EDICIONES.sinClave),
        // **Cadena, y no se convierte ni se opera** (regla 1): llega con todos sus decimales y se
        // dibuja tal cual. Pasarla por `Number` le quitaria el centimo antes de pintarla.
        celda(parametro.valorNumerico, FRASES_DE_EDICIONES.sinValorNumerico),
        celda(parametro.valorTexto, FRASES_DE_EDICIONES.sinValorTexto),
        celda(parametro.vigenciaDesde, FRASES_DE_EDICIONES.sinVigenciaDesde),
        celda(parametro.vigenciaHasta, FRASES_DE_EDICIONES.sinVigenciaHasta),
        parametro.documentoFuente,
      ] as readonly CeldaDeLaTabla[],
    })),
    conteo: t(FRASES_DE_EDICIONES.cuantosParametros, { cuantos: parametros.length }),
  };
}

/** Los seis campos de la ficha, y los dos que un conjunto abierto no tiene. */
function laFicha(
  conjunto: ConjuntoResource,
): {
  readonly valores: ReadonlyMap<Coordenada, string>;
  readonly ausencias: ReadonlyMap<Coordenada, string>;
} {
  const valores = new Map<Coordenada, string>([
    [IDENTIFICADOR, String(conjunto.id)],
    [EJERCICIO, String(conjunto.ejercicio)],
    [VERSION, String(conjunto.version)],
    [ESTADO, conjunto.estado],
  ]);
  const ausencias = new Map<Coordenada, string>();
  // Los dos nulos van por `ausenciaPorCampo` y NO por `valores`: una cadena vacia seria un hueco
  // sin motivo, y un guion escrito aqui seria un dato inventado.
  if (conjunto.fechaSellado === null) ausencias.set(FECHA_DE_SELLADO, FRASES_DE_EDICIONES.sinSellar);
  else valores.set(FECHA_DE_SELLADO, conjunto.fechaSellado);
  if (conjunto.usuarioSellado === null) {
    ausencias.set(USUARIO_QUE_SELLO, FRASES_DE_EDICIONES.sinSellar);
  } else valores.set(USUARIO_QUE_SELLO, conjunto.usuarioSellado);
  return { valores, ausencias };
}

/* ── El conector ───────────────────────────────────────────────────────────────────────────── */

export const EDICIONES: Conector = {
  lecturas: [
    {
      clave: CLAVE_DE_LAS_EDICIONES,
      consulta: ['nor-ediciones', CLAVE_DE_LAS_EDICIONES],
      // Los CUATRO sitios de la ventana entran en la clave de consulta. El sujeto NO: elegir una
      // fila no cambia la pagina, y meterlo aqui volveria a pedir la lista entera en cada
      // seleccion.
      enLaRuta: [
        EN_LA_RUTA.pagina,
        EN_LA_RUTA.tamano,
        EN_LA_RUTA.ordenarPor,
        EN_LA_RUTA.direccion,
      ],
      pedir: (senal, ruta) => pedirLasEdiciones(senal, ruta),
    },
    {
      clave: CLAVE_DEL_CONTENIDO,
      consulta: ['nor-ediciones', CLAVE_DEL_CONTENIDO],
      // Y el detalle depende del SUJETO y de nada mas: cambiar de pagina no cambia lo que se esta
      // mirando.
      enLaRuta: [EL_SUJETO],
      // Sin conjunto elegido no hay nada que pedir, y se dice con la espera de la definicion en vez
      // de con un 404 de ruta que pareceria una averia.
      enEsperaSi: (ruta) => ruta.sujeto === null || ruta.sujeto === '',
      pedir: (senal, ruta) => pedirElContenido(senal, ruta),
    },
  ],

  repartir: (llegado): Reparto => {
    const lista = llegado.get(CLAVE_DE_LAS_EDICIONES) as LaPaginaDeEdiciones | undefined;
    const contenido = llegado.get(CLAVE_DEL_CONTENIDO) as ContenidoDelConjuntoResource | undefined;

    const valores = new Map<Coordenada, string>();
    const ausenciaPorCampo = new Map<Coordenada, string>();
    const tablas = new Map<string, DatosDeUnaTabla>();
    const nombrados = new Map<string, DatoConNombre>();

    if (lista !== undefined) {
      tablas.set(CLAVE_DE_LAS_EDICIONES, lasEdiciones(lista, contenido?.conjunto.id));
      // Lo que el SERVIDOR dijo de la ventana. Los dos por su nombre derivado de la clave de la
      // tabla, que es donde el interprete los busca.
      nombrados.set(hayMasDe(CLAVE_DE_LAS_EDICIONES), lista.pagina.hayMas);
      nombrados.set(paginasDe(CLAVE_DE_LAS_EDICIONES), String(lista.pagina.totalPaginas));
      // Y lo que se PIDIO, que es lo que la accion de cada fila se lleva consigo al abrir el
      // detalle: sin esto, `ir` escribiria la direccion entera sin la ventana y elegir una fila de
      // la pagina 3 devolveria la lista a la 0.
      for (const [sitio, valor] of Object.entries(lista.ventana)) {
        nombrados.set(loPedidoEn(CLAVE_DE_LAS_EDICIONES, sitio as SitioDeLaRuta), valor);
      }
    }

    if (contenido !== undefined) {
      const ficha = laFicha(contenido.conjunto);
      for (const [donde, valor] of ficha.valores) valores.set(donde, valor);
      for (const [donde, porQue] of ficha.ausencias) ausenciaPorCampo.set(donde, porQue);
      tablas.set(CLAVE_DEL_CONTENIDO, losParametros(contenido.parametros));
    }

    return {
      valores,
      tablas,
      ausenciaPorCampo,
      nombrados,
      ausencia: {
        enElCampo: FRASES_DE_EDICIONES.sinPedir,
        explicacion: FRASES_DE_EDICIONES.laHojaLee,
        tono: 'info',
      },
    };
  },
};
