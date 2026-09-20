// @vitest-environment node
//
// Lee el contrato del disco y recorre definiciones. No hay DOM que necesitar — y no se puede
// tener: importar el CONECTOR arrastraria `src/api/cliente.ts` -> `src/sesion.ts`, que lee
// `window.location.origin` al cargarse. Por eso lo que se cruza aqui son las dos mitades que se
// pueden leer sin navegador: la DEFINICION y la declaracion de `src/datos/lecturas.ts`.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DefinicionDeTabla } from '@kamayuk/ui';
import { describe, expect, it } from 'vitest';

import { CATALOGO } from '../src/catalogo.ts';
import {
  CLAVE_DE_LAS_EDICIONES,
  EN_LA_RUTA,
  LA_RUTA_DE_CADA_HOJA,
  hayMasDe,
  paginasDe,
} from '../src/datos/lecturas.ts';
import { CLAVES_DE_HOJA, type ClaveDeHoja } from '../src/pantallas/arbol.ts';
import { pantallaDe } from '../src/pantallas/definiciones/index.ts';

/**
 * **La cadena entera de lo que la hoja lleva en su ruta, eslabon por eslabon** (#65, AC 1 y AC 7).
 *
 * Calcada de `rentas/frontend/verificaciones/la-ruta-de-la-hoja-llega-al-conector.test.ts@origin/main`
 * —la referencia que el triage del 2026-09-20 nombra— con **las dos diferencias de este arbol**
 * dichas donde tocan: el cuarto sitio se llama `direccion` y no `sentido` (ver {@link EN_LA_RUTA}),
 * y el contrato de aqui **no publica el orden por omision** de una operacion (ver el ultimo
 * describe).
 *
 * <h2>Por que hace falta una guarda y no basta con leer el diff</h2>
 *
 * Porque la cadena tiene **cinco eslabones en cuatro archivos** y romper cualquiera de ellos deja
 * la pantalla **en verde, dibujando la pagina 0 con el rotulo «Página 3»**:
 *
 * <ol>
 *   <li>la definicion declara `paginacion.enLaRuta` y el interprete escribe ahi;</li>
 *   <li>`src/datos/lecturas.ts` declara ese mismo sitio en `LA_RUTA_DE_CADA_HOJA`, que es lo que el
 *       conector lee;</li>
 *   <li>`src/catalogo.ts` lo DERIVA al `enLaRuta` del destino — y el marco <b>tira con aviso</b> lo
 *       que un destino no declara, o sea que sin esto el parametro no llega ni a la ruta;</li>
 *   <li>`useDatosDeLaHoja` lo mete en la llave de la consulta — sin eso no se vuelve a pedir;</li>
 *   <li>el contrato del backend publica ese parametro para ESA operacion — mandar uno que no
 *       publica es un 422 «Parametro desconocido» sobre un nombre que nada de este repositorio
 *       comprueba.</li>
 * </ol>
 *
 * Ninguno de los cinco produce un error al romperse. El primero y el tercero dan **una paginacion
 * que no pagina**, que es peor que ninguna: el mando existe, se pulsa, la direccion cambia y las
 * filas son las mismas.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../..');
const PARAMETROS = join(RAIZ, 'docs/50-api/parametros-de-la-api.json');

interface ParametrosDeUnaOperacion {
  readonly obligatorios?: readonly string[];
  readonly opcionales?: readonly string[];
  readonly ordenarPorAdmitidos?: readonly string[];
  readonly tamanoMaximo?: number;
}

/** El contrato, leido DENTRO de cada caso: lo produce el backend y puede faltar (`rentas`#78). */
function contrato(): Record<string, ParametrosDeUnaOperacion> {
  return JSON.parse(readFileSync(PARAMETROS, 'utf8')) as Record<string, ParametrosDeUnaOperacion>;
}

/** La operacion a la que viaja la ventana de esta hoja. */
const LA_OPERACION = 'GET /seguridad/parametros';

/** Lo que esa operacion publica, o un rojo que dice que el contrato se quedo sin regenerar. */
function loQuePublica(): ParametrosDeUnaOperacion {
  const suyos = contrato()[LA_OPERACION];
  if (suyos === undefined) {
    throw new Error(
      `El contrato no publica «${LA_OPERACION}».\n\n` +
        '  `docs/50-api/parametros-de-la-api.json` sale de la FIRMA de cada controlador: o la\n' +
        '  operacion se fue, o el archivo se quedo sin regenerar en el PR del backend.',
    );
  }
  return suyos;
}

/**
 * Las tablas de una hoja que llevan `clave`, con ella.
 *
 * Mira `bloque.tabla` **y** `bloque.tablas`: hoy ninguna hoja de este sistema usa la segunda, y
 * mirar solo la primera dejaria el dia que alguien la use una tabla que escribe en la ruta y que
 * esta guarda no ve — que es exactamente el hueco que estas comprobaciones existen para cerrar.
 */
function tablasDe(clave: ClaveDeHoja): readonly (DefinicionDeTabla & { readonly clave: string })[] {
  return pantallaDe(clave).bloques.flatMap((bloque) =>
    [bloque.tabla, ...(bloque.tablas ?? [])].flatMap((tabla) =>
      tabla?.clave === undefined ? [] : [tabla as DefinicionDeTabla & { readonly clave: string }],
    ),
  );
}

/** Los sitios de la ruta que las tablas de una hoja ESCRIBEN. */
function sitiosQueEscribeLaHoja(clave: ClaveDeHoja): readonly string[] {
  return tablasDe(clave).flatMap((tabla) => [
    ...(tabla.paginacion === undefined ? [] : [tabla.paginacion.enLaRuta]),
    ...(tabla.paginacion?.tamanoEnLaRuta === undefined ? [] : [tabla.paginacion.tamanoEnLaRuta]),
    ...(tabla.orden === undefined ? [] : [tabla.orden.enLaRuta, tabla.orden.sentidoEnLaRuta]),
  ]);
}

/** La tabla paginada de Ediciones, que es el sujeto de casi todo lo de abajo. */
function laTablaDeEdiciones(): DefinicionDeTabla & { readonly clave: string } {
  const tabla = tablasDe('nor-ediciones').find((una) => una.clave === CLAVE_DE_LAS_EDICIONES);
  if (tabla === undefined) {
    throw new Error(`«nor-ediciones» dejo de declarar la tabla «${CLAVE_DE_LAS_EDICIONES}».`);
  }
  return tabla;
}

/* ── El dialecto ───────────────────────────────────────────────────────────────────────────── */

describe('los cuatro sitios de la ruta son los CUATRO PARAMETROS del contrato (#65, AC 1)', () => {
  it('EL CENTINELA: el contrato se pudo leer y publica sus once operaciones', () => {
    // Sin esto, un archivo vacio dejaria todo lo de abajo pasando sobre el conjunto vacio.
    expect(Object.keys(contrato()).length, 'el contrato llego vacio').toBeGreaterThan(10);
  });

  it('cada uno de los cuatro lo admite `GET /seguridad/parametros`, con su nombre', () => {
    const suyos = loQuePublica();
    const admite = [...(suyos.obligatorios ?? []), ...(suyos.opcionales ?? [])];
    const inventados = Object.values(EN_LA_RUTA).filter((nombre) => !admite.includes(nombre));

    expect(
      inventados,
      `Hay sitios de la ruta que «${LA_OPERACION}» no admite: ${inventados.join(', ')}\n` +
        `  Admite: ${admite.sort().join(', ')}\n\n` +
        '  El sitio de la ruta se llama COMO EL PARAMETRO del contrato, a proposito: lo que se\n' +
        '  escribe en `#/ediciones?…` es lo que viaja a la API. Un nombre que la operacion no lee\n' +
        '  es un **422 «Parametro desconocido»**, y la pantalla lo dibuja como una averia suya.',
    ).toEqual([]);
  });

  it('y el cuarto se llama `direccion` y NO `sentido`: es lo que MIDE el contrato de aqui', () => {
    // La diferencia con `rentas`, medida y no heredada. Alli el cuarto se renombro a `sentido`
    // (`rentas`#236, #250) porque `GuardiaDeParametros` admite los cuatro nombres en TODA
    // operacion y aquel sistema tiene pantallas con un filtro «Dirección» —un domicilio—, que
    // chocaba. **Este repositorio no tiene ni un domicilio**: el artboard V8 no declara ninguno.
    //
    // Si algun dia esta linea sale roja porque el backend renombro el parametro, lo que hay que
    // cambiar es `EN_LA_RUTA` —y con el, la definicion y el conector—, no esta prueba.
    const suyos = loQuePublica();
    expect([...(suyos.opcionales ?? [])], 'el contrato dejo de publicar `direccion`').toContain(
      'direccion',
    );
    expect(EN_LA_RUTA.direccion).toBe('direccion');
    expect(laTablaDeEdiciones().orden?.sentidoEnLaRuta).toBe(EN_LA_RUTA.direccion);
  });
});

/* ── El catalogo deriva del dato ───────────────────────────────────────────────────────────── */

describe('el catalogo DERIVA lo que la hoja lleva en la ruta (#65, AC 1)', () => {
  it('el destino declara exactamente lo que `LA_RUTA_DE_CADA_HOJA` dice, ni mas ni menos', () => {
    // Derivarlo es lo que impide el fallo mudo: con una lista paralela, el marco ignoraria con
    // aviso el `?pagina=` que el mando acaba de escribir y la tabla dibujaria la pagina 0.
    const descuadres: string[] = [];
    for (const modulo of CATALOGO) {
      for (const destino of modulo.destinos) {
        const declarada = LA_RUTA_DE_CADA_HOJA[destino.clave];
        const suyo = JSON.stringify({
          sujeto: destino.enLaRuta?.sujeto ?? false,
          parametros: [...(destino.enLaRuta?.parametros ?? [])],
        });
        const dato = JSON.stringify({
          sujeto: declarada?.sujeto ?? false,
          parametros: [...(declarada?.parametros ?? [])],
        });
        if (suyo !== dato) descuadres.push(`  ${destino.clave}: catalogo ${suyo} vs dato ${dato}`);
      }
    }
    expect(descuadres, `El catalogo y el dato no dicen lo mismo:\n${descuadres.join('\n')}`).toEqual(
      [],
    );
  });

  it('y Ediciones declara su SUJETO: sin el, elegir una fila no abriria nada', () => {
    // El conjunto elegido va en el camino —`#/ediciones/12`—, y el marco tira lo que el destino no
    // declare. Sin esta linea la accion de la fila escribiria la direccion, el marco se quedaria
    // con `#/ediciones` y el detalle seguiria diciendo «elija una edicion» para siempre.
    const ediciones = CATALOGO.flatMap((modulo) => modulo.destinos).find(
      (destino) => destino.clave === 'nor-ediciones',
    );
    expect(ediciones?.enLaRuta?.sujeto, '«nor-ediciones» no declara sujeto').toBe(true);
  });
});

/* ── La tabla que mueve la ruta tiene quien la lea ─────────────────────────────────────────── */

describe('una tabla que mueve la ruta tiene quien la lea (#65, AC 1)', () => {
  it('EL CENTINELA: hay una tabla que declara `paginacion` en servidor', () => {
    const paginadas = CLAVES_DE_HOJA.flatMap((clave) =>
      tablasDe(clave).filter((tabla) => tabla.paginacion?.en === 'servidor'),
    );
    expect(paginadas.length, 'ninguna tabla pagina en el servidor').toBeGreaterThan(0);
  });

  it('todo sitio que una tabla ESCRIBE lo declara su hoja, o nadie lo lee', () => {
    const huerfanos: string[] = [];
    for (const clave of CLAVES_DE_HOJA) {
      const declarados = new Set(LA_RUTA_DE_CADA_HOJA[clave]?.parametros ?? []);
      for (const sitio of sitiosQueEscribeLaHoja(clave)) {
        if (!declarados.has(sitio)) huerfanos.push(`  ${clave} escribe «${sitio}» y no lo declara`);
      }
    }
    expect(
      huerfanos,
      'Una tabla escribe un sitio de la ruta que su hoja no declara:\n' +
        `${huerfanos.join('\n')}\n\n` +
        '  El mando se dibuja, se pulsa, la direccion cambia —o ni eso, si el marco lo tira— y\n' +
        '  **nadie vuelve a pedir**: la tabla sigue dibujando la pagina 0 con el rotulo de la 3.',
    ).toEqual([]);
  });

  it('y al reves: una hoja que declara la ventana tiene una tabla que la dibuja', () => {
    // Sin esto, una hoja podria mandar `?pagina=` que nadie puede mover: una ventana fija sin
    // mandos, que es lo que hace hoy el Panel —y por eso el Panel NO declara nada en la ruta—.
    const sinMandos: string[] = [];
    for (const clave of CLAVES_DE_HOJA) {
      const declara = (LA_RUTA_DE_CADA_HOJA[clave]?.parametros ?? []).includes(EN_LA_RUTA.pagina);
      const dibuja = tablasDe(clave).some((tabla) => tabla.paginacion !== undefined);
      if (declara && !dibuja) sinMandos.push(`  ${clave}`);
    }
    expect(sinMandos, `Hojas que piden una pagina que nadie puede mover:\n${sinMandos.join('\n')}`).toEqual(
      [],
    );
  });

  it('dos tablas de la misma hoja no comparten un sitio: se moverian juntas', () => {
    // **La regla NO es «una tabla paginada por hoja»**, y la diferencia es de #66: Cuadros pagina
    // TRES —los tres cuadros, en el cliente— y cada una escribe el suyo, `pagina-<clave>`. Lo que
    // no puede pasar es que dos escriban el MISMO: pulsar «Siguiente» en una movería las dos, y
    // eso no da ningun error — las dos tablas obedecen.
    const repetidos: string[] = [];
    for (const clave of CLAVES_DE_HOJA) {
      const sitios = sitiosQueEscribeLaHoja(clave);
      for (const sitio of new Set(sitios)) {
        const cuantas = sitios.filter((uno) => uno === sitio).length;
        if (cuantas > 1) repetidos.push(`  ${clave}: «${sitio}», en ${String(cuantas)} tablas`);
      }
    }
    expect(
      repetidos,
      'Dos tablas de la misma hoja escriben el mismo sitio de la ruta:\n' +
        `${repetidos.join('\n')}\n\n` +
        '  Pulsar «Siguiente» en una moveria las dos. Lo que hay que decidir es como se llama el\n' +
        '  sitio de la segunda, no descubrirlo en la pantalla.',
    ).toEqual([]);
  });

  it('`hayMas` y `paginas` se nombran DERIVADOS de la tabla', () => {
    // Son nombres de `DatosDeLaPantalla.nombrados` y no datos: escritos a mano en la definicion y
    // en el conector, un nombre que no case deja `hayMas` sin valor y el interprete lee eso como
    // «no hay pagina siguiente». El boton sale impedido para siempre, sin un solo error.
    const malNombrados: string[] = [];
    for (const clave of CLAVES_DE_HOJA) {
      for (const tabla of tablasDe(clave)) {
        const paginacion = tabla.paginacion;
        if (paginacion === undefined || paginacion.en !== 'servidor') continue;
        if (paginacion.hayMas !== hayMasDe(tabla.clave)) {
          malNombrados.push(`  ${clave}/${tabla.clave}: hayMas «${paginacion.hayMas}»`);
        }
        if (paginacion.paginas !== paginasDe(tabla.clave)) {
          malNombrados.push(`  ${clave}/${tabla.clave}: paginas «${String(paginacion.paginas)}»`);
        }
      }
    }
    expect(malNombrados, `Nombres que no salen de la clave de la tabla:\n${malNombrados.join('\n')}`).toEqual(
      [],
    );
  });
});

/* ── El orden y el tamano que se ofrecen ───────────────────────────────────────────────────── */

describe('el orden y el tamano que se OFRECEN los admite el backend (#65, AC 1)', () => {
  it('EL CENTINELA: el contrato publica la lista blanca y el tope, y no vienen vacios', () => {
    // Una lista vacia no contiene ningun campo… ni lo contradice: sin esto, «todos los campos que
    // se ofrecen estan admitidos» pasaria en verde sobre la nada.
    const suyos = loQuePublica();
    expect(suyos.ordenarPorAdmitidos ?? [], 'el contrato no publica `ordenarPorAdmitidos`')
      .toHaveLength(4);
    expect(typeof suyos.tamanoMaximo, 'el contrato no publica `tamanoMaximo`').toBe('number');
    // Del lado de la tabla se exige que ofrezca MAS DE UNO y no una cuenta exacta: con uno solo el
    // desplegable no tendria entre que elegir, y fijar el numero pondria rojo el dia que el backend
    // admita un quinto campo y la hoja lo ofrezca —que es un cambio bueno—.
    expect(
      (laTablaDeEdiciones().orden?.campos ?? []).length,
      'la tabla no ofrece ordenar por mas de un campo',
    ).toBeGreaterThan(1);
  });

  it('cada campo que se ofrece esta en la lista blanca que publica el contrato', () => {
    const admitidos = loQuePublica().ordenarPorAdmitidos ?? [];
    const rechazados = (laTablaDeEdiciones().orden?.campos ?? [])
      .filter((campo) => !admitidos.includes(campo.valor))
      .map((campo) => `  se ofrece «${campo.valor}» y ${LA_OPERACION} no lo admite`);

    expect(
      rechazados,
      'La tabla ofrece ordenar por un campo que el backend rechaza:\n' +
        `${rechazados.join('\n')}\n\n` +
        '  `OrdenSeguro` contesta **422 ORDEN_NO_ADMITIDO**, y la escalera de hoy no lo distingue\n' +
        '  del otro 422: la pantalla lo dibuja como una averia suya. El desplegable se mueve y la\n' +
        '  tabla se rompe.',
    ).toEqual([]);
  });

  it('y la columna que lleva ese campo existe: sin ella no habria `aria-sort` que poner', () => {
    // `aria-sort` lo pone la columna cuyo `campo` es el que se esta ordenando. Un campo ofrecido
    // sin columna que lo lleve ordena las filas **sin que nada lo anuncie**, que es la mitad del
    // criterio que no se ve mirando la pantalla.
    const tabla = laTablaDeEdiciones();
    const campos = new Set(tabla.columnas.flatMap((columna) => (columna.campo === undefined ? [] : [columna.campo])));
    const sinColumna = (tabla.orden?.campos ?? [])
      .filter((campo) => !campos.has(campo.valor))
      .map((campo) => `  «${campo.valor}»`);

    expect(sinColumna, `Campos que se ordenan y ninguna columna anuncia:\n${sinColumna.join('\n')}`).toEqual(
      [],
    );
  });

  it('ninguno de los tamanos ofrecidos pasa del tope, y el de por omision tampoco', () => {
    const tope = loQuePublica().tamanoMaximo ?? 0;
    const paginacion = laTablaDeEdiciones().paginacion;
    const tamanos = [
      ...(paginacion === undefined ? [] : [paginacion.tamano]),
      ...(paginacion?.tamanos ?? []),
    ];
    const pasados = tamanos.filter((tamano) => tamano > tope).map((tamano) => `  ${String(tamano)}`);

    expect(tamanos.length, 'la tabla no ofrece ningun tamano').toBeGreaterThan(1);
    expect(
      pasados,
      `Hay tamanos por encima del tope de ${String(tope)}:\n${pasados.join('\n')}\n\n` +
        '  `Paginacion` rechaza con 422 todo tamano fuera de 1 a 500, asi que elegirlo en el\n' +
        '  desplegable romperia la tabla.',
    ).toEqual([]);
  });

  it('los dos sentidos son los del backend: `ASCENDENTE` y `DESCENDENTE`', () => {
    // Son dato y no una constante de la libreria porque un sistema escribe `asc` y otro
    // `ASCENDENTE`. El de aqui es el de `Paginacion.Direccion`, y mandar el otro es un 422.
    const orden = laTablaDeEdiciones().orden;
    expect(orden?.ascendente).toBe('ASCENDENTE');
    expect(orden?.descendente).toBe('DESCENDENTE');
  });

  it('y el PRIMERO es el orden por omision del controlador — que el contrato NO publica', () => {
    // **La diferencia medida con `rentas`.** Alli el contrato publica
    // `orden: { porOmision, admitidos }` y una guarda cruza `campos[0]` contra `porOmision`; aqui
    // `parametros-de-la-api.json` trae `ordenarPorAdmitidos` y `tamanoMaximo` **y ni un campo por
    // omision** (medido sobre las once operaciones). Asi que esa comparacion no se puede hacer
    // contra el contrato, y hay dos salidas: copiar aqui el literal del controlador —una tercera
    // copia que se queda vieja en verde— o **quitar la pregunta**.
    //
    // Se quita: el conector manda SIEMPRE `?ordenarPor=`, con el campo que el desplegable ensena.
    // Entonces lo que la barra anuncia y lo que el servidor ordena son lo mismo por construccion,
    // y `campos[0]` solo tiene que ser un campo admitido —lo de arriba—. Que ademas coincida con
    // el `aPaginacion("ejercicio")` del controlador es una comodidad, no un requisito.
    expect(loQuePublica()).not.toHaveProperty('orden');
    expect(laTablaDeEdiciones().orden?.campos[0]?.valor).toBe('ejercicio');
  });
});
