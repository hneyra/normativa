// Corre en jsdom —el entorno por omision— y NO en `node`, por lo mismo que
// `el-nulo-no-es-un-cero.test.ts`: importa el conector, que arrastra `src/api/cliente.ts` ->
// `src/sesion.ts`, y ahi hay un `window.location.origin` de nivel de modulo. En `node` eso es
// «ReferenceError: window is not defined» al CARGAR, sin una sola prueba ejecutada.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { coordenada, paginaDeLaTabla, type CeldaDeLaTabla, type DatosDeUnaTabla } from '@kamayuk/ui';
import { describe, expect, it } from 'vitest';

import {
  CUADROS,
  CUADROS_DE_VALUACION,
  DOMINIOS,
  DOMINIO_DE_LA_CATEGORIA,
  DOMINIO_DE_LA_PARTIDA,
  DOMINIO_DEL_USO,
  FRASES_DE_LOS_CUADROS,
  antiguedadAbierta,
  cifraDelCuadro,
  estadoDelCuadro,
  fueraDeDominio,
  fuenteDelCuadro,
  type CuadroDeValuacion,
  type LoDeLosCuadros,
} from '../src/datos/cuadros.ts';
import {
  CLAVES_DE_LOS_CUADROS,
  CLAVE_DE_LOS_CUADROS,
  FILAS_POR_PAGINA,
  paginaDe,
  type Ambito,
  type DepreciacionDelSnapshot,
  type SnapshotResource,
  type ValorReferencialDelSnapshot,
  type ValorUnitarioDelSnapshot,
} from '../src/datos/lecturas.ts';
import { PANTALLAS } from '../src/pantallas/definiciones/index.ts';

/**
 * **Los tres cuadros son los del snapshot: sus filas, su tramo abierto y sus cuatro desenlaces**
 * (#66, AC 3, AC 4 y AC 5).
 *
 * <h2>Que renace aqui, de la V6</h2>
 *
 * `c01fe9a:frontend/src/secciones/cuadros.ts` tenia las cuatro cosas que la epica #47 manda no
 * perder: los tres cuadros con sus columnas, «Sin tope» y «Mas de N anios», los cuatro desenlaces
 * —`CON_FILAS`, `FUERA_DEL_AMBITO`, `SIN_FILAS` y `DE_MAS`— y la comprobacion de los dominios
 * contra lo recibido. Salieron con la V6 en #50 y vuelven aqui, sobre el interprete.
 *
 * <h2>Se ejerce el CONECTOR y no la pantalla</h2>
 *
 * Porque el conector es quien decide, y porque asi el rojo nombra la celda y el desenlace y no un
 * nodo del DOM. Que lo dibujado sea esto —y que las tablas no pinten mas filas que su pagina— lo
 * mide `e2e/cuadros.spec.ts` en un navegador de verdad.
 *
 * <h2>Las cifras de estos datos son de JUGUETE, y hace falta decirlo</h2>
 *
 * Ninguna sale del corpus. Lo que estas pruebas miden es **como se lee una fila**, no cuanto vale
 * un metro cuadrado: un valor unitario de verdad escrito aqui se leeria como real y viajaria en el
 * arbol sin ninguna de las dos firmas de ADR-0007. Viven en `verificaciones/`, que
 * `sin-cifras-inventadas` no barre —barre `src/`— precisamente porque una prueba necesita datos y
 * el codigo que se sirve no.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** La identidad que devuelve `GET /conjuntos`. */
const VIGENTE = { conjuntoId: 7, ejercicio: 2031, version: 2 };

const FUENTE_UNITARIOS = 'Documento fuente de prueba · valores unitarios';
const FUENTE_DEPRECIACION = 'Documento fuente de prueba · depreciación';
const FUENTE_VEHICULAR = 'Documento fuente de prueba · anexo vehicular';

/** Dos celdas del cuadro de valores unitarios: una con tope y otra **sin** (AC 4). */
const UNITARIOS: readonly ValorUnitarioDelSnapshot[] = [
  {
    partida: 'MUROS',
    categoria: 'A',
    anioConstruccionDesde: 1990,
    anioConstruccionHasta: 1999,
    valorM2: '11.5',
    documentoFuente: FUENTE_UNITARIOS,
  },
  {
    partida: 'TECHOS',
    categoria: 'B',
    anioConstruccionDesde: 2000,
    anioConstruccionHasta: null,
    valorM2: '2222333.4',
    documentoFuente: FUENTE_UNITARIOS,
  },
];

/**
 * Dos tablas del Anexo I, y **cada una con su tramo abierto**.
 *
 * Es la mitad del AC 4 que una sola tabla no puede medir: el `N` de «Mas de N anios» es el del
 * ultimo tramo cerrado de **su misma tabla**, asi que con una sola tabla una implementacion que
 * mirara el maximo de TODO el cuadro pasaria igual. Aqui la segunda tabla no tiene ningun tramo
 * cerrado: si se mirara el cuadro entero, diria el `N` de la primera en vez de «Sin tope».
 */
const DEPRECIACIONES: readonly DepreciacionDelSnapshot[] = [
  {
    uso: '01',
    material: 'Concreto',
    estadoConservacion: 'Muy Bueno',
    antiguedadHasta: 5,
    porcentaje: '0',
    documentoFuente: FUENTE_DEPRECIACION,
  },
  {
    uso: '01',
    material: 'Concreto',
    estadoConservacion: 'Muy Bueno',
    antiguedadHasta: 30,
    porcentaje: '12',
    documentoFuente: FUENTE_DEPRECIACION,
  },
  {
    uso: '01',
    material: 'Concreto',
    estadoConservacion: 'Muy Bueno',
    antiguedadHasta: null,
    porcentaje: '27',
    documentoFuente: FUENTE_DEPRECIACION,
  },
  {
    uso: '02',
    material: 'Ladrillo',
    estadoConservacion: 'Malo',
    antiguedadHasta: null,
    porcentaje: '60',
    documentoFuente: FUENTE_DEPRECIACION,
  },
];

const REFERENCIALES: readonly ValorReferencialDelSnapshot[] = [
  {
    ejercicio: 2031,
    categoria: 'A1',
    marca: 'MARCA DE PRUEBA',
    modelo: 'MODELO DE PRUEBA',
    anioFabricacion: 2030,
    valor: '1234.5',
    documentoFuente: FUENTE_VEHICULAR,
  },
  {
    ejercicio: 2031,
    categoria: 'A1',
    marca: 'MARCA DE PRUEBA',
    modelo: 'OTROS MODELOS',
    anioFabricacion: 2029,
    valor: '999.99',
    documentoFuente: FUENTE_VEHICULAR,
  },
];

/** Un snapshot con lo que se le ponga; lo que no, vacio. */
function snapshot(ambito: Ambito, dentro: Partial<SnapshotResource> = {}): SnapshotResource {
  return {
    ...VIGENTE,
    ambito,
    filas: 0,
    parametros: [],
    valoresUnitarios: [],
    depreciaciones: [],
    valoresReferenciales: [],
    ...dentro,
  };
}

/** El reparto de la hoja con los dos snapshots puestos. */
function repartir(
  valuacion: SnapshotResource,
  obligacion: SnapshotResource,
): ReturnType<typeof CUADROS.repartir> {
  const lo: LoDeLosCuadros = {
    vigente: VIGENTE,
    porAmbito: new Map<Ambito, SnapshotResource>([
      ['VALUACION', valuacion],
      ['OBLIGACION', obligacion],
    ]),
  };
  return CUADROS.repartir(new Map<string, unknown>([[CLAVE_DE_LOS_CUADROS, lo]]));
}

/** El reparto normal: cada cuadro en el ambito que lo lleva. */
function repartoNormal(): ReturnType<typeof CUADROS.repartir> {
  return repartir(
    snapshot('VALUACION', { valoresUnitarios: UNITARIOS, depreciaciones: DEPRECIACIONES }),
    snapshot('OBLIGACION', { valoresReferenciales: REFERENCIALES }),
  );
}

/** Lo que se lee de una celda, en las dos formas que `@kamayuk/ui` admite. */
function textoDe(celda: CeldaDeLaTabla | undefined): string | null {
  if (celda === undefined) return null;
  return typeof celda === 'string' ? celda : celda.texto;
}

/** La nota de una celda, o `''`. */
function notaDe(celda: CeldaDeLaTabla | undefined): string {
  return typeof celda === 'object' && celda !== null ? (celda.nota ?? '') : '';
}

/** El cuadro de esa clave. Revienta si no esta: los tres son fijos. */
function cuadroDe(clave: string): CuadroDeValuacion {
  const uno = CUADROS_DE_VALUACION.find((cuadro) => cuadro.clave === clave);
  if (uno === undefined) throw new Error(`No hay cuadro «${clave}»`);
  return uno;
}

/** La tabla de esa clave en un reparto. */
function tabla(
  reparto: ReturnType<typeof CUADROS.repartir>,
  clave: string,
): DatosDeUnaTabla | undefined {
  return reparto.tablas?.get(clave);
}

/** Lo que nunca puede ocupar el sitio de un tramo abierto. */
const LO_QUE_NO_PUEDE_SER = ['0', '0.00', '0,00', '', '-', '—', 'null', 'undefined'];

/* ── AC 3 — las tres tablas, con su conteo ─────────────────────────────────────────────────── */

describe('AC 3 — los tres cuadros llegan a sus tres tablas', () => {
  it('EL CENTINELA: la hoja declara UNA lectura, y son tres cuadros de dos ambitos', () => {
    // Sin esto, un conector que no entregara ninguna tabla dejaria todo lo de abajo pasando sobre
    // `undefined` con un `?.` de por medio.
    expect(CUADROS.lecturas.map((una) => una.clave)).toEqual([CLAVE_DE_LOS_CUADROS]);
    expect(CUADROS_DE_VALUACION.map((cuadro) => cuadro.clave)).toEqual([...CLAVES_DE_LOS_CUADROS]);
    expect(new Set(CUADROS_DE_VALUACION.map((cuadro) => cuadro.ambito))).toEqual(
      new Set(['VALUACION', 'OBLIGACION']),
    );
  });

  it('cada cuadro trae sus filas, del ambito que lo lleva', () => {
    const reparto = repartoNormal();

    expect(tabla(reparto, 'valores-unitarios')?.filas).toHaveLength(UNITARIOS.length);
    expect(tabla(reparto, 'depreciaciones')?.filas).toHaveLength(DEPRECIACIONES.length);
    expect(tabla(reparto, 'valores-referenciales')?.filas).toHaveLength(REFERENCIALES.length);
  });

  it('y cada fila lleva sus columnas en el orden de la definicion', () => {
    const reparto = repartoNormal();
    const primera = tabla(reparto, 'valores-referenciales')?.filas[0];

    expect(primera?.celdas.map(textoDe)).toEqual([
      '2031',
      'A1',
      'MARCA DE PRUEBA',
      'MODELO DE PRUEBA',
      '2030',
      '1,234.50',
      FUENTE_VEHICULAR,
    ]);
    // Tantas celdas como columnas declara su tabla: una de mas o de menos desplaza el cuadro
    // entero una columna, y eso se lee como una cifra bajo el rotulo equivocado.
    for (const cuadro of CUADROS_DE_VALUACION) {
      const columnas = columnasDe(cuadro.clave).length;
      for (const fila of tabla(reparto, cuadro.clave)?.filas ?? []) {
        expect(fila.celdas, `«${cuadro.clave}» pinta ${String(fila.celdas.length)} celdas`).toHaveLength(
          columnas,
        );
      }
    }
  });

  it('el conteo de la barra sale de la LONGITUD de la lista recibida, y no de un literal', () => {
    // La mitad del AC 3 que se puede medir sin navegador: con doscientas cincuenta filas dice
    // doscientas cincuenta, no el tamano de la pagina y no `snapshot.filas` —que es la suma de las
    // cuatro listas y diria otra cosa—.
    const muchas = Array.from({ length: 250 }, (_, i) => ({
      ...(REFERENCIALES[0] as ValorReferencialDelSnapshot),
      modelo: `MODELO ${String(i)}`,
    }));
    const reparto = repartir(
      snapshot('VALUACION'),
      snapshot('OBLIGACION', { valoresReferenciales: muchas, filas: 9999 }),
    );

    expect(tabla(reparto, 'valores-referenciales')?.conteo).toContain('250 filas');
    expect(tabla(reparto, 'valores-referenciales')?.conteo).not.toContain('9999');
  });
});

/* ── AC 4 — el tramo abierto no es un dato que falte ───────────────────────────────────────── */

describe('AC 4 — el tramo abierto se dice, y nunca es un cero', () => {
  it('`antiguedadHasta: null` es «Mas de N anios», con el N de SU tabla', () => {
    const reparto = repartoNormal();
    const filas = tabla(reparto, 'depreciaciones')?.filas ?? [];

    // Tercera fila: uso 01, Concreto, Muy Bueno. Su ultimo tramo cerrado es 30.
    expect(textoDe(filas[2]?.celdas[3])).toBe('Más de 30 años');
    // Cuarta: uso 02, Ladrillo, Malo. **No tiene ningun tramo cerrado**, asi que no se inventa un
    // numero. Con una implementacion que mirara el maximo del cuadro entero, esto diria «Mas de 30
    // anios» sobre una tabla que no tiene ningun 30.
    expect(textoDe(filas[3]?.celdas[3])).toBe('Sin tope');
  });

  it('y lleva su nota, porque una palabra sola no dice que el nulo no es un dato que falte', () => {
    const filas = tabla(repartoNormal(), 'depreciaciones')?.filas ?? [];
    expect(notaDe(filas[2]?.celdas[3])).toBe(FRASES_DE_LOS_CUADROS.notaDeLaAntiguedad);
    expect(FRASES_DE_LOS_CUADROS.notaDeLaAntiguedad).toContain('null');
  });

  it('`anioConstruccionHasta: null` es «Sin tope», con la suya', () => {
    const filas = tabla(repartoNormal(), 'valores-unitarios')?.filas ?? [];
    expect(textoDe(filas[1]?.celdas[3])).toBe('Sin tope');
    expect(notaDe(filas[1]?.celdas[3])).toBe(FRASES_DE_LOS_CUADROS.notaDelAnio);
    // Y el tope que SI viene se ensena tal cual: no se convierte en «Sin tope» por descuido.
    expect(textoDe(filas[0]?.celdas[3])).toBe('1999');
  });

  it('NINGUNA celda de los tres cuadros es un cero, una raya, un vacio ni un `null`', () => {
    const reparto = repartoNormal();
    const sospechosas = CUADROS_DE_VALUACION.flatMap((cuadro) =>
      (tabla(reparto, cuadro.clave)?.filas ?? []).flatMap((fila, i) =>
        fila.celdas
          .map((celda, j) => ({ j, texto: textoDe(celda) }))
          .filter(({ j, texto }) => j === 3 && (texto === null || LO_QUE_NO_PUEDE_SER.includes(texto)))
          .map(({ j, texto }) => `  ${cuadro.clave} fila ${String(i)} columna ${String(j)} = «${String(texto)}»`),
      ),
    );
    expect(
      sospechosas,
      'Hay un tramo abierto dibujado como cero, raya o hueco:\n' +
        `${sospechosas.join('\n')}\n\n` +
        '  Leer ese nulo como cero convierte el tramo que todo lo cubre en uno que no cubre nada,\n' +
        '  y sin ningun error de por medio. En un padron viejo es el que mas predios alcanza.',
    ).toEqual([]);
  });

  it('EL CENTINELA de la otra direccion: `antiguedadAbierta` es PURA y se puede probar sola', () => {
    // Sin esto, lo de arriba pasaria igual con una funcion que devolviera siempre «Sin tope».
    const deOtraTabla: DepreciacionDelSnapshot = {
      uso: '03',
      material: 'Concreto',
      estadoConservacion: 'Bueno',
      antiguedadHasta: null,
      porcentaje: '5',
      documentoFuente: FUENTE_DEPRECIACION,
    };
    expect(antiguedadAbierta(DEPRECIACIONES, DEPRECIACIONES[2] as DepreciacionDelSnapshot)).toBe(
      'Más de 30 años',
    );
    expect(antiguedadAbierta([...DEPRECIACIONES, deOtraTabla], deOtraTabla)).toBe('Sin tope');
  });

  it('las cifras son CADENAS: se formatean con texto, no se operan y no se redondean', () => {
    // Sin simbolo de moneda —lo pone la cabecera de la columna— y sin pasar por `Number`, que
    // pierde el decimal antes de llegar a la pantalla (regla 1, ADR-0018).
    expect(cifraDelCuadro('2222333.4')).toBe('2,222,333.40');
    expect(cifraDelCuadro('0')).toBe('0.00');
    expect(cifraDelCuadro('-12.5')).toBe('-12.50');
    expect(String(cifraDelCuadro('1234.5'))).not.toContain('S/');

    // Y una cifra que NO tiene la forma que el contrato sirve no se recorta y NO lanza: lanzar
    // dentro de `repartir()` —que corre en cada pintada— se lleva la hoja entera y deja una
    // pantalla en blanco que no nombra la cifra.
    const rara = cifraDelCuadro('412880.005');
    expect(textoDe(rara)).toBe('412880.005');
    expect(notaDe(rara)).toBe(FRASES_DE_LOS_CUADROS.cifraQueNoLoEs);
    expect(() =>
      repartir(
        snapshot('VALUACION', {
          valoresUnitarios: [{ ...(UNITARIOS[0] as ValorUnitarioDelSnapshot), valorM2: 'x' }],
        }),
        snapshot('OBLIGACION'),
      ),
    ).not.toThrow();
  });
});

/* ── AC 5 — los cuatro desenlaces, el documento fuente y los dominios ──────────────────────── */

describe('AC 5 — los cuatro desenlaces se dicen distinto', () => {
  it('EL CENTINELA: la funcion es pura y da los CUATRO', () => {
    const unitarios = cuadroDe('valores-unitarios');
    const vehicular = cuadroDe('valores-referenciales');
    expect(estadoDelCuadro('VALUACION', unitarios, 1)).toBe('CON_FILAS');
    expect(estadoDelCuadro('VALUACION', unitarios, 0)).toBe('SIN_FILAS');
    expect(estadoDelCuadro('VALUACION', vehicular, 0)).toBe('FUERA_DEL_AMBITO');
    expect(estadoDelCuadro('VALUACION', vehicular, 1)).toBe('DE_MAS');
    // Y las cuatro frases son distintas: cuatro desenlaces con el mismo texto son uno.
    const frases = [
      FRASES_DE_LOS_CUADROS.conFilas,
      FRASES_DE_LOS_CUADROS.sinFilas,
      FRASES_DE_LOS_CUADROS.fueraDelAmbito,
      FRASES_DE_LOS_CUADROS.deMas,
    ];
    expect(new Set(frases).size).toBe(4);
  });

  it('CON_FILAS y FUERA_DEL_AMBITO: el normal, con el reparto de ADR-0024 dicho', () => {
    const barra = tabla(repartoNormal(), 'valores-unitarios')?.conteo ?? '';
    expect(barra).toContain('El ámbito VALUACION lleva este cuadro, y vino.');
    expect(barra).toContain('el ámbito OBLIGACION no lo lleva');
    expect(barra).toContain('ADR-0024');
  });

  it('SIN_FILAS: el ambito lo lleva y llego vacio, que NO es el reparto', () => {
    const reparto = repartir(
      snapshot('VALUACION', { depreciaciones: DEPRECIACIONES }),
      snapshot('OBLIGACION', { valoresReferenciales: REFERENCIALES }),
    );
    const barra = tabla(reparto, 'valores-unitarios')?.conteo ?? '';

    expect(barra).toContain('0 filas');
    expect(barra).toContain('SÍ lleva este cuadro y llegó vacío');
    expect(
      barra,
      'Un vacio por anomalia se esta diciendo con las palabras del reparto: entonces un error de\n' +
        '  carga pasa por normal, que es justo lo que los cuatro desenlaces existen para impedir.',
    ).not.toContain('El ámbito VALUACION no lo lleva');
    // Lo que SI dice de OBLIGACION es el reparto, y esa es la otra mitad de la frase: las dos
    // afirmaciones son de ambitos distintos y no se pueden confundir.
    expect(barra).toContain('Y el ámbito OBLIGACION no lo lleva');
  });

  it('DE_MAS: el otro ambito no lo lleva y aun asi llego lleno', () => {
    // Contra `ComponerSnapshot` no puede pasar; contra un intermediario que sirva la respuesta del
    // otro ambito, si. Nombrarlo es lo que impide que la pantalla se acostumbre.
    const reparto = repartir(
      snapshot('VALUACION', { valoresUnitarios: UNITARIOS }),
      snapshot('OBLIGACION', { valoresUnitarios: UNITARIOS, valoresReferenciales: REFERENCIALES }),
    );
    const barra = tabla(reparto, 'valores-unitarios')?.conteo ?? '';

    expect(barra).toContain('no lo lleva, y aun así llegó lleno');
    expect(barra).toContain('ComponerSnapshot');
  });

  it('el documento fuente sale DE LAS FILAS, y con dos distintos se dicen los dos', () => {
    const unitarios = cuadroDe('valores-unitarios');
    const conUno = repartoNormal();
    expect(conUno.valores?.get(coordenada(unitarios.bloque, 0))).toBe(FUENTE_UNITARIOS);

    const mezclado = repartir(
      snapshot('VALUACION', {
        valoresUnitarios: [
          UNITARIOS[0] as ValorUnitarioDelSnapshot,
          { ...(UNITARIOS[1] as ValorUnitarioDelSnapshot), documentoFuente: 'Otra edición' },
        ],
      }),
      snapshot('OBLIGACION'),
    );
    const dicho = mezclado.valores?.get(coordenada(unitarios.bloque, 0)) ?? '';
    expect(dicho).toContain(FUENTE_UNITARIOS);
    expect(dicho).toContain('Otra edición');

    // Y sin filas no se inventa: se dice que no hay de donde leerlo.
    const vacio = repartir(snapshot('VALUACION'), snapshot('OBLIGACION'));
    expect(vacio.valores?.has(coordenada(unitarios.bloque, 0))).toBe(false);
    expect(vacio.ausenciaPorCampo?.get(coordenada(unitarios.bloque, 0))).toBe(
      FRASES_DE_LOS_CUADROS.sinFuente,
    );

    // La funcion, sola: es pura y se puede probar sin conector.
    expect(fuenteDelCuadro([]).documento).toBeNull();
    expect(fuenteDelCuadro(UNITARIOS).distintos).toEqual([FUENTE_UNITARIOS]);
  });

  it('los dominios se COMPRUEBAN contra lo recibido, no solo se escriben en la cabecera', () => {
    const unitarios = cuadroDe('valores-unitarios');
    const sucio = snapshot('VALUACION', {
      valoresUnitarios: [
        { ...(UNITARIOS[0] as ValorUnitarioDelSnapshot), partida: 'MURO', categoria: 'Z' },
      ],
    });

    expect(fueraDeDominio(unitarios, sucio)).toEqual([
      'partida «MURO» (valor_unitario_edificacion_partida_check)',
      'categoria «Z» (valor_unitario_edificacion_categoria_check)',
    ]);
    const barra = tabla(repartir(sucio, snapshot('OBLIGACION')), 'valores-unitarios')?.conteo ?? '';
    expect(barra).toContain('fuera del dominio que la base declara');
    expect(barra).toContain('valor_unitario_edificacion_partida_check');

    // El uso de la depreciacion, por su cuenta: son dos CHECK distintos de dos tablas distintas.
    const depreciacion = cuadroDe('depreciaciones');
    expect(
      fueraDeDominio(
        depreciacion,
        snapshot('VALUACION', {
          depreciaciones: [{ ...(DEPRECIACIONES[0] as DepreciacionDelSnapshot), uso: '05' }],
        }),
      ),
    ).toEqual(['uso «05» (depreciacion_uso_check)']);

    // Y con los datos buenos NO dice nada: sin esta mitad, una funcion que devolviera siempre algo
    // pasaria lo de arriba y ensuciaria la barra de todos los cuadros.
    for (const cuadro of CUADROS_DE_VALUACION) {
      expect(
        fueraDeDominio(
          cuadro,
          snapshot(cuadro.ambito, {
            valoresUnitarios: UNITARIOS,
            depreciaciones: DEPRECIACIONES,
            valoresReferenciales: REFERENCIALES,
          }),
        ),
      ).toEqual([]);
    }
  });

  it('y los dominios que la cabecera escribe son los CHECK del baseline, leidos del propio SQL', () => {
    // La otra mitad: un dominio escrito en la interfaz que no sea el de la base se lee como una
    // promesa. Se cruza contra `V1__baseline.sql`, que es donde la restriccion existe.
    const baseline = readFileSync(
      join(AQUI, '../../backend/kamayuk-normativa-esquema/src/main/resources/db/migration/V1__baseline.sql'),
      'utf8',
    );
    expect(baseline.length, 'no se leyo el baseline: el cruce no miraria nada').toBeGreaterThan(
      1000,
    );
    for (const partida of DOMINIOS.partida) {
      expect(baseline, `el CHECK de la partida ya no admite «${partida}»`).toContain(
        `'${partida}'::character varying`,
      );
    }
    expect(baseline).toContain("categoria ~ '^[A-J]$'");
    expect(baseline).toContain("(uso)::text ~ '^0[1-4]$'");
    for (const cuadro of CUADROS_DE_VALUACION) {
      expect(baseline, `«${cuadro.checkNacional}» ya no esta en el baseline`).toContain(
        cuadro.checkNacional,
      );
      expect(baseline, `la tabla «${cuadro.tabla}» ya no esta en el baseline`).toContain(
        cuadro.tabla,
      );
    }
  });
});

/* ── La costura con la definicion ──────────────────────────────────────────────────────────── */

/** Las columnas de la tabla de ese cuadro, tal como la definicion las escribe. */
function columnasDe(clave: string) {
  const bloque = PANTALLAS['nor-cuadros'].bloques.find((uno) => uno.tabla?.clave === clave);
  if (bloque?.tabla === undefined) throw new Error(`Ningun bloque declara la tabla «${clave}»`);
  return bloque.tabla.columnas;
}

describe('la definicion y el conector dicen lo mismo (#66, AC 3 y AC 5)', () => {
  it('cada cuadro apunta al bloque cuya tabla lleva SU clave', () => {
    // El `bloque` del conector es un indice escrito a mano: es lo que decide en que campos se
    // escribe el documento fuente. Mal escrito no da error — escribe el documento del cuadro
    // vehicular en la ficha de la depreciacion.
    for (const cuadro of CUADROS_DE_VALUACION) {
      const bloque = PANTALLAS['nor-cuadros'].bloques[cuadro.bloque];
      expect(bloque?.tabla?.clave, `el bloque ${String(cuadro.bloque)} no es el de «${cuadro.clave}»`).toBe(
        cuadro.clave,
      );
      expect(bloque?.lectura?.clave, `el bloque de «${cuadro.clave}» no nombra su lectura`).toBe(
        CLAVE_DE_LOS_CUADROS,
      );
      // Y su primer campo es el documento fuente, que es donde el conector lo escribe.
      expect(bloque?.campos[0]?.etiqueta).toBe('Documento fuente');
    }
  });

  it('el DOMINIO de cada columna acotada es el que el conector deriva de los CHECK (H23)', () => {
    // Los dos lados lo escriben —la definicion no puede importar `src/datos/`, que arrastra
    // `window`—, asi que esto es lo que impide que se separen. Separados, la cabecera promete un
    // dominio y `fueraDeDominio` comprueba otro, y nadie lo nota.
    const dominioDe = (clave: string, campo: string) =>
      columnasDe(clave).find((columna) => columna.campo === campo)?.dominio;

    expect(dominioDe('valores-unitarios', 'partida')).toBe(DOMINIO_DE_LA_PARTIDA);
    expect(dominioDe('valores-unitarios', 'categoria')).toBe(DOMINIO_DE_LA_CATEGORIA);
    expect(dominioDe('depreciaciones', 'uso')).toBe(DOMINIO_DEL_USO);

    // Y ninguna columna del anexo vehicular promete un dominio: el baseline no le pone ningun
    // CHECK de dominio, y escribir uno seria una promesa que la base no hace.
    expect(columnasDe('valores-referenciales').filter((c) => c.dominio !== undefined)).toEqual([]);
  });

  it('todas las columnas de los tres cuadros nombran su campo del contrato (H23)', () => {
    const mudas = CLAVES_DE_LOS_CUADROS.flatMap((clave) =>
      columnasDe(clave)
        .filter((columna) => columna.campo === undefined)
        .map((columna) => `  ${clave}: «${columna.rotulo}»`),
    );
    expect(
      mudas,
      'Hay columnas sin el nombre de su campo del contrato:\n' +
        `${mudas.join('\n')}\n\n` +
        '  Es la N5 de #52 y la H23 de HUECOS.md: un rotulo en castellano no dice que llave del\n' +
        '  JSON se esta leyendo, y quien compare esta pantalla con el snapshot descargado no tiene\n' +
        '  con que emparejarlas.',
    ).toEqual([]);
  });
});

/* ── AC 3 — la paginacion, en el cliente ───────────────────────────────────────────────────── */

describe('AC 3 — las tablas grandes paginan en el CLIENTE (H21)', () => {
  it('las tres declaran paginacion de cliente, cada una con SU sitio', () => {
    const sitios: string[] = [];
    for (const clave of CLAVES_DE_LOS_CUADROS) {
      const bloque = PANTALLAS['nor-cuadros'].bloques.find((uno) => uno.tabla?.clave === clave);
      const paginacion = bloque?.tabla?.paginacion;
      expect(paginacion?.en, `«${clave}» no pagina en el cliente`).toBe('cliente');
      expect(paginacion?.tamano, `«${clave}» pagina con otro tamano`).toBe(FILAS_POR_PAGINA);
      expect(paginacion?.enLaRuta).toBe(paginaDe(clave));
      sitios.push(paginacion?.enLaRuta ?? '');
    }
    // Tres sitios distintos: con uno solo, pasar de pagina en un cuadro moveria la del de al lado.
    expect(new Set(sitios).size).toBe(CLAVES_DE_LOS_CUADROS.length);
  });

  it('con el anexo vehicular entero, la pagina recorta a `FILAS_POR_PAGINA`', () => {
    // 54 129 filas es lo que mide el anexo de 2026 (`ElEjercicio2026SeSellaTest.java:246`). La
    // cuenta se hace sobre la funcion pura de `@kamayuk/ui`, sin montar una sola fila: en un DOM
    // tardaria minutos, que es justo el defecto que la paginacion viene a cerrar.
    const cuantas = 54_129;
    const paginacion = { en: 'cliente', enLaRuta: paginaDe('valores-referenciales'), tamano: FILAS_POR_PAGINA } as const;

    const primera = paginaDeLaTabla(paginacion, { pagina: null, tamano: null }, {}, cuantas);
    expect(primera.recorte).toEqual({ desde: 0, hasta: FILAS_POR_PAGINA });
    expect(primera.hayMas).toBe(true);
    expect(primera.paginas).toBe(Math.ceil(cuantas / FILAS_POR_PAGINA));

    // Y la ultima no se pasa del final ni deja la tabla en blanco.
    const ultima = paginaDeLaTabla(paginacion, { pagina: '99999', tamano: null }, {}, cuantas);
    expect(ultima.pagina).toBe(Math.ceil(cuantas / FILAS_POR_PAGINA) - 1);
    expect(ultima.hayMas).toBe(false);
  });

  it('y el conector NO recorta: entrega todas las filas, que es lo que la cuenta necesita', () => {
    // Recortar aqui daria un conteo de cien sobre un anexo de decenas de miles, y la barra diria
    // «100 filas» de un cuadro que tiene muchas mas. El recorte es del interprete.
    const muchas = Array.from({ length: FILAS_POR_PAGINA + 7 }, (_, i) => ({
      ...(REFERENCIALES[0] as ValorReferencialDelSnapshot),
      modelo: `MODELO ${String(i)}`,
    }));
    const reparto = repartir(
      snapshot('VALUACION'),
      snapshot('OBLIGACION', { valoresReferenciales: muchas }),
    );
    expect(tabla(reparto, 'valores-referenciales')?.filas).toHaveLength(FILAS_POR_PAGINA + 7);
  });
});

/* ── Lo que se ve sin respuesta ────────────────────────────────────────────────────────────── */

describe('sin respuesta, la hoja dice lo que SI sabe y no inventa lo que no', () => {
  it('la tabla de la base y el ambito que lleva cada cuadro se siguen viendo', () => {
    // No dependen de la lectura: son el CHECK del baseline y el reparto de ADR-0024. Con la
    // lectura caida son justo lo que explica por que un cuadro que no vino no es de esta
    // municipalidad.
    const reparto = CUADROS.repartir(new Map<string, unknown>());
    for (const cuadro of CUADROS_DE_VALUACION) {
      expect(reparto.valores?.get(coordenada(cuadro.bloque, 1))).toBe(cuadro.tabla);
      expect(reparto.valores?.get(coordenada(cuadro.bloque, 2))).toBe(cuadro.ambito);
      // Y el documento fuente NO se inventa: no hay filas de las que leerlo.
      expect(reparto.valores?.has(coordenada(cuadro.bloque, 0))).toBe(false);
      expect(reparto.ausenciaPorCampo?.get(coordenada(cuadro.bloque, 0))).toBe(
        FRASES_DE_LOS_CUADROS.sinPedir,
      );
    }
    expect(reparto.tablas?.size ?? 0).toBe(0);
    expect(reparto.ausencia.enElCampo).toBe(FRASES_DE_LOS_CUADROS.sinPedir);
  });
});
