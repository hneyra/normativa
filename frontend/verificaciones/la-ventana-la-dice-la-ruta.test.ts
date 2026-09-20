// Corre en jsdom —el entorno por omision— y NO en `node`, aunque lo que hace sea ejercer dos
// funciones: importa el conector, que arrastra `src/api/cliente.ts` -> `src/sesion.ts`, y ahi hay
// un `window.location.origin` de nivel de modulo. En `node` eso es «ReferenceError: window is not
// defined» al CARGAR, sin una sola prueba ejecutada.

import type { RutaDeLaHoja } from '@kamayuk/ui';
import { describe, expect, it } from 'vitest';

import {
  CLAVE_DEL_CONTENIDO,
  CLAVE_DE_LAS_EDICIONES,
  EN_LA_RUTA,
  LISTADO_DE_EDICIONES,
  hayMasDe,
  loPedidoEn,
  paginasDe,
  rutaDe,
  type ConjuntoResource,
  type ContenidoDelConjuntoResource,
  type Paginado,
} from '../src/datos/lecturas.ts';
import {
  EDICIONES,
  laVentanaQueSePide,
  type LaPaginaDeEdiciones,
} from '../src/datos/ediciones.ts';

/**
 * **La ventana que se pide es la que dice la ruta, y el total es el que publica la operacion**
 * (#65, AC 1 y AC 8).
 *
 * <h2>Las dos mitades, y por que hacen falta las dos</h2>
 *
 * · **De la ruta a la peticion.** La ruta la escribe el interprete… **y tambien cualquiera**:
 *   `#/ediciones?ordenarPor=;DROP` es una direccion que se puede teclear y reenviar tal cual seria
 *   un 422 `ORDEN_NO_ADMITIDO` dibujado como una averia de la pantalla. Aqui se ejerce con basura
 *   dentro y se exige que lo que salga al cable sea de la lista blanca.
 * · **De la respuesta a lo que se dibuja.** El conteo de la barra y el «hay mas» son lo que
 *   **publica el envoltorio**, nunca una cuenta sobre la pagina. Contar las filas recibidas diria
 *   que no hay pagina siguiente justo cuando el tope se alcanza exacto.
 *
 * Es la pareja de `rentas/frontend/verificaciones/el-total-es-el-que-publica-la-operacion.test.ts`
 * y de `…/la-ruta-de-la-hoja-llega-al-conector.test.ts@origin/main`, ejercida sobre el conector de
 * esta hoja en vez de sobre una lista de conectores: aqui hay uno.
 */

/** Una ruta con lo que se le ponga, y nada mas. */
const laRuta = (parametros: Readonly<Record<string, string>> = {}, sujeto: string | null = null): RutaDeLaHoja => ({
  sujeto,
  parametros,
});

/** Lo que la definicion fija hoy: se LEE de ella, no se escribe aqui. */
const laVentanaVacia = laVentanaQueSePide(laRuta());

/** Una pagina del servidor, con un conjunto abierto y uno sellado. */
function unaPagina(hayMas: boolean): Paginado<ConjuntoResource> {
  const abierto: ConjuntoResource = {
    id: 41,
    ejercicio: 2027,
    version: 2,
    estado: 'ABIERTO',
    fechaSellado: null,
    usuarioSellado: null,
  };
  const sellado: ConjuntoResource = {
    id: 12,
    ejercicio: 2026,
    version: 1,
    estado: 'SELLADO',
    fechaSellado: '2026-09-06T14:12:03.512Z',
    usuarioSellado: 'hneyra',
  };
  return {
    contenido: [abierto, sellado],
    pagina: 1,
    tamano: 20,
    // **Mas de los que hay en la pagina, a proposito**: es lo unico que distingue el total
    // publicado de un `contenido.length`.
    totalElementos: 54,
    totalPaginas: 3,
    hayMas,
  };
}

/** Lo que reparte el conector con la lista puesta y, si se le da, el detalle. */
function repartir(lista?: LaPaginaDeEdiciones, contenido?: ContenidoDelConjuntoResource) {
  const llegado = new Map<string, unknown>();
  if (lista !== undefined) llegado.set(CLAVE_DE_LAS_EDICIONES, lista);
  if (contenido !== undefined) llegado.set(CLAVE_DEL_CONTENIDO, contenido);
  return EDICIONES.repartir(llegado);
}

/** La lista tal como la devuelve la lectura: la ventana que se pidio y la pagina que llego. */
const loQueLlego = (hayMas = true): LaPaginaDeEdiciones => ({
  ventana: laVentanaVacia,
  pagina: unaPagina(hayMas),
});

/** Los nombres de consulta de una ruta compuesta, en su orden. */
function nombresDe(ruta: string): readonly string[] {
  const consulta = ruta.slice(ruta.indexOf('?') + 1);
  return [...new URLSearchParams(consulta).keys()];
}

describe('AC 1 — la ventana sale de la ruta, y lo fijo de la definicion', () => {
  it('EL CENTINELA: con la ruta vacia viajan los CUATRO, con lo que la definicion fija', () => {
    // Sin esta mitad, un `laVentanaQueSePide` que devolviera `{}` pasaria todo lo de abajo: no
    // habria ningun valor malo porque no habria ningun valor.
    expect(Object.keys(laVentanaVacia).sort()).toEqual(
      [...Object.values(EN_LA_RUTA)].sort(),
    );
    expect(laVentanaVacia[EN_LA_RUTA.pagina]).toBe('0');
    expect(laVentanaVacia[EN_LA_RUTA.ordenarPor]).toBe('ejercicio');
    expect(laVentanaVacia[EN_LA_RUTA.direccion]).toBe('ASCENDENTE');
    // El tamano NO se compara contra un literal escrito aqui: sale de la definicion, que es el
    // unico sitio donde vive. Lo que se exige es que sea uno entero y positivo.
    expect(Number(laVentanaVacia[EN_LA_RUTA.tamano])).toBeGreaterThan(0);
  });

  it('lo que la ruta dice y la definicion admite, viaja tal cual', () => {
    const ventana = laVentanaQueSePide(
      laRuta({ pagina: '3', tamano: '100', ordenarPor: 'version', direccion: 'DESCENDENTE' }),
    );
    expect(ventana).toEqual({
      pagina: '3',
      tamano: '100',
      ordenarPor: 'version',
      direccion: 'DESCENDENTE',
    });
  });

  it('y lo que NO admite se cae a lo que la definicion fija, en vez de salir al cable', () => {
    // Las cuatro formas de basura que una barra de direcciones puede traer. Ninguna se corrige a
    // medias: cada una se cae a lo que se sabe cierto.
    const ventana = laVentanaQueSePide(
      laRuta({
        // Un campo que la lista blanca del backend no admite: **422 ORDEN_NO_ADMITIDO**.
        ordenarPor: 'fechaSellado',
        // Un tamano por encima del tope de `Paginacion`: 422.
        tamano: '600',
        // Una pagina que no es un entero no negativo.
        pagina: '-1',
        // Y un sentido que no es ninguno de los dos del enumerado del backend.
        direccion: 'hacia-arriba',
      }),
    );
    expect(ventana).toEqual(laVentanaVacia);
  });

  it('un `ordenarPor` con una inyeccion dentro tampoco sale: se cae al primero', () => {
    const ventana = laVentanaQueSePide(laRuta({ ordenarPor: 'ejercicio; DROP TABLE conjunto' }));
    expect(ventana[EN_LA_RUTA.ordenarPor]).toBe('ejercicio');
  });

  it('la ruta compuesta lleva EXACTAMENTE los cuatro nombres, y ninguno mas (AC 8)', () => {
    // El criterio, dicho sin levantar nada. Un `?estado=SELLADO` compuesto para el chip del filtro
    // saldria aqui **nombrando el nombre**, que es el 422 «Parametro desconocido» que el backend
    // daria.
    const compuesta = rutaDe({ ...LISTADO_DE_EDICIONES, parametros: laVentanaVacia });

    expect(compuesta.startsWith('/seguridad/parametros?')).toBe(true);
    expect(nombresDe(compuesta)).toEqual([
      EN_LA_RUTA.pagina,
      EN_LA_RUTA.tamano,
      EN_LA_RUTA.ordenarPor,
      EN_LA_RUTA.direccion,
    ]);
    expect(compuesta, 'la ruta del listado no puede pedir el snapshot').not.toContain('snapshot');
  });
});

describe('AC 1 — el total y el «hay mas» los dice el SERVIDOR', () => {
  it('el conteo de la barra lleva el total publicado, y no el de la pagina', () => {
    const tabla = repartir(loQueLlego()).tablas?.get(CLAVE_DE_LAS_EDICIONES);
    const pagina = unaPagina(true);

    expect(tabla?.filas).toHaveLength(pagina.contenido.length);
    expect(
      tabla?.conteo,
      'El conteo no dice el total que publica la operacion. Contar la pagina daria el tamano de\n' +
        '  la ventana con aspecto de tamano del padron: «2 de 2» sobre un padron de 54.',
    ).toContain(String(pagina.totalElementos));
    expect(tabla?.conteo).toContain(String(pagina.contenido.length));
  });

  it('`hayMas` es el del envoltorio, y no una cuenta de las filas recibidas', () => {
    // Las dos direcciones sobre la MISMA pagina: mismas filas, distinto `hayMas`. Una cuenta sobre
    // las filas daria lo mismo en los dos casos, y con el tope alcanzado exacto diria que no hay
    // siguiente justo cuando la hay.
    const conMas = repartir(loQueLlego(true)).nombrados?.get(hayMasDe(CLAVE_DE_LAS_EDICIONES));
    const sinMas = repartir(loQueLlego(false)).nombrados?.get(hayMasDe(CLAVE_DE_LAS_EDICIONES));

    expect(conMas).toBe(true);
    expect(sinMas).toBe(false);
  });

  it('y `paginas` es `totalPaginas`, no una division hecha aqui', () => {
    const paginas = repartir(loQueLlego()).nombrados?.get(paginasDe(CLAVE_DE_LAS_EDICIONES));
    expect(paginas).toBe(String(unaPagina(true).totalPaginas));
  });

  it('lo que se PIDIO viaja con nombre, para que elegir una fila no pierda el sitio', () => {
    // Es lo que la accion de cada fila se lleva consigo: `ir` del marco escribe la direccion
    // entera, asi que sin estos cuatro elegir una fila de la pagina 3 devolveria la lista a la 0.
    const nombrados = repartir(loQueLlego()).nombrados;
    for (const sitio of Object.values(EN_LA_RUTA)) {
      expect(
        nombrados?.get(loPedidoEn(CLAVE_DE_LAS_EDICIONES, sitio)),
        `no se publico lo pedido en «${sitio}»`,
      ).toBe(laVentanaVacia[sitio]);
    }
  });
});

describe('AC 3 y AC 4 — el detalle: su sujeto, su realce y su espera', () => {
  const contenido: ContenidoDelConjuntoResource = {
    conjunto: {
      id: 12,
      ejercicio: 2026,
      version: 1,
      estado: 'SELLADO',
      fechaSellado: '2026-09-06T14:12:03.512Z',
      usuarioSellado: 'hneyra',
    },
    parametros: [],
  };

  it('sin conjunto elegido, la lectura del detalle NO pide: espera', () => {
    const detalle = EDICIONES.lecturas.find((lectura) => lectura.clave === CLAVE_DEL_CONTENIDO);
    expect(detalle?.enEsperaSi?.(laRuta())).toBe(true);
    expect(detalle?.enEsperaSi?.(laRuta({}, '12'))).toBe(false);
  });

  it('la lista se pide por la VENTANA y el detalle por el SUJETO, y no al reves', () => {
    // Si la lista leyera el sujeto, elegir una fila volveria a pedir la pagina entera; si el
    // detalle leyera la ventana, cambiar de pagina volveria a pedir el conjunto que ya se tenia.
    const lista = EDICIONES.lecturas.find((lectura) => lectura.clave === CLAVE_DE_LAS_EDICIONES);
    const detalle = EDICIONES.lecturas.find((lectura) => lectura.clave === CLAVE_DEL_CONTENIDO);

    expect([...(lista?.enLaRuta ?? [])].sort()).toEqual([...Object.values(EN_LA_RUTA)].sort());
    expect(detalle?.enLaRuta).toEqual(['sujeto']);
  });

  it('la fila realzada es la que el DETALLE contesto, y solo esa', () => {
    const tabla = repartir(loQueLlego(), contenido).tablas?.get(CLAVE_DE_LAS_EDICIONES);
    const realzadas = (tabla?.filas ?? []).filter((fila) => fila.realzada === true);

    expect(realzadas).toHaveLength(1);
    expect(realzadas[0]?.clave).toBe('12');
    // Y sin detalle, ninguna: realzar la primera «por si acaso» diria que se esta mirando algo que
    // nadie pidio.
    const sinDetalle = repartir(loQueLlego()).tablas?.get(CLAVE_DE_LAS_EDICIONES);
    expect((sinDetalle?.filas ?? []).filter((fila) => fila.realzada === true)).toEqual([]);
  });

  it('cada fila lleva su `id`, que es lo que la accion se lleva a la ruta', () => {
    // Sin el, la accion de la fila sale IMPEDIDA con «todavia no se sabe id»: el interprete no
    // deja viajar un hueco a la direccion. Se veria, pero no se podria pulsar.
    const tabla = repartir(loQueLlego()).tablas?.get(CLAVE_DE_LAS_EDICIONES);
    expect(tabla?.filas.map((fila) => fila.datos?.get('id'))).toEqual(['41', '12']);
  });

  it('un 403 en la lista no deja al detalle sin datos, ni al reves (AC 4)', () => {
    // Las dos mitades por separado: lo que llega se reparte, y lo que no llego no borra nada. El
    // ESTADO de cada lectura lo pone `useDatosDeLaHoja` y lo dibuja el bloque que la declara; lo
    // que esto mide es que el reparto no las ata.
    const soloElDetalle = repartir(undefined, contenido);
    expect(soloElDetalle.tablas?.has(CLAVE_DEL_CONTENIDO)).toBe(true);
    expect(soloElDetalle.tablas?.has(CLAVE_DE_LAS_EDICIONES)).toBe(false);
    expect(soloElDetalle.valores?.get('1|0'), 'el detalle no dibujo su identificador').toBe('12');

    const soloLaLista = repartir(loQueLlego());
    expect(soloLaLista.tablas?.has(CLAVE_DE_LAS_EDICIONES)).toBe(true);
    expect(soloLaLista.tablas?.has(CLAVE_DEL_CONTENIDO)).toBe(false);
  });

  it('un conjunto SIN parametros dibuja una tabla vacia, que no es lo mismo que sin datos', () => {
    // `filas: []` es «contesto y no hay ninguno» —la tabla dice su `vacio`—; la clave ausente es
    // «no se pudo pedir». El interprete los dibuja distinto, y por eso el conector no puede
    // devolver lo mismo en los dos casos.
    const tabla = repartir(undefined, contenido).tablas?.get(CLAVE_DEL_CONTENIDO);
    expect(tabla?.filas).toEqual([]);
  });
});
