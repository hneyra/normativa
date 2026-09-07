import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type {
  DepreciacionDelSnapshot,
  SnapshotResource,
  ValorReferencialDelSnapshot,
  ValorUnitarioDelSnapshot,
} from '../datos/lecturas.ts';
import {
  CUADROS_DE_VALUACION,
  DOMINIOS,
  antiguedadAbierta,
  cuadroPorId,
  cuantasFilasDe,
  estadoDelCuadro,
  filasDelCuadro,
  fuenteDelCuadro,
  fueraDeDominio,
} from './cuadros.ts';

/**
 * Los tres cuadros: sus campos, sus dominios, el reparto por ambito y el tramo abierto.
 *
 * <h2>Los dominios se comparan contra el BASELINE, no contra una copia</h2>
 *
 * `V1__baseline.sql` es la unica fuente de lo que la base admite. Escribir aqui «MUROS, TECHOS,
 * PUERTAS» y comprobar que la interfaz dice lo mismo probaria que dos copias coinciden entre si;
 * lo que hace falta es que coincidan con el CHECK. Asi que la prueba lee el `.sql`.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(
  AQUI,
  '../../../backend/kamayuk-normativa-esquema/src/main/resources/db/migration/V1__baseline.sql',
);

const baseline = readFileSync(BASELINE, 'utf8');

/** Una fila de valores unitarios, con lo minimo para que se pueda dibujar. */
function unitario(
  encima: Partial<ValorUnitarioDelSnapshot> = {},
): ValorUnitarioDelSnapshot {
  return {
    partida: 'MUROS',
    categoria: 'A',
    anioConstruccionDesde: 1990,
    anioConstruccionHasta: null,
    valorM2: '894.27',
    documentoFuente: 'Resolución Ministerial N.º 277-2025-VIVIENDA',
    ...encima,
  };
}

function depreciacion(encima: Partial<DepreciacionDelSnapshot> = {}): DepreciacionDelSnapshot {
  return {
    uso: '01',
    material: 'Concreto',
    estadoConservacion: 'Muy Bueno',
    antiguedadHasta: 5,
    porcentaje: '0',
    documentoFuente: 'Resolución Ministerial N.º 172-2016-VIVIENDA',
    ...encima,
  };
}

function referencial(
  encima: Partial<ValorReferencialDelSnapshot> = {},
): ValorReferencialDelSnapshot {
  return {
    ejercicio: 2026,
    categoria: 'A3',
    marca: 'ALFA ROMEO',
    modelo: '147 2.0 SSP 3P',
    anioFabricacion: 2025,
    valor: '104780.00',
    documentoFuente: 'Resolución Ministerial N.° 008-2026-EF/15',
    ...encima,
  };
}

function snapshot(encima: Partial<SnapshotResource> = {}): SnapshotResource {
  return {
    conjuntoId: 2,
    ejercicio: 2026,
    version: 2,
    ambito: 'VALUACION',
    filas: 0,
    parametros: [],
    valoresUnitarios: [],
    depreciaciones: [],
    valoresReferenciales: [],
    ...encima,
  };
}

describe('AC1 — los tres cuadros, con sus campos y sus dominios literales', () => {
  it('son tres, y los tres son NACIONALES con su CHECK en el baseline', () => {
    expect(CUADROS_DE_VALUACION).toHaveLength(3);

    for (const cuadro of CUADROS_DE_VALUACION) {
      // El CHECK existe, y dice lo que la pantalla afirma: `municipalidad_id IS NULL`.
      const linea = new RegExp(
        `ADD CONSTRAINT ${cuadro.checkNacional} CHECK \\(\\(municipalidad_id IS NULL\\)\\)`,
      );
      expect(
        baseline,
        `La pantalla dice que «${cuadro.tabla}» es nacional por «${cuadro.checkNacional}».\n` +
          'Si ese CHECK ya no existe, lo que la pantalla afirma dejo de ser cierto.',
      ).toMatch(linea);
    }
  });

  it('los campos de cada columna son los que el backend publica, y en su orden', () => {
    expect(cuadroPorId('unitarios').columnas.map((c) => c.campo)).toEqual([
      'partida',
      'categoria',
      'anioConstruccionDesde',
      'anioConstruccionHasta',
      'valorM2',
      'documentoFuente',
    ]);
    expect(cuadroPorId('depreciacion').columnas.map((c) => c.campo)).toEqual([
      'uso',
      'material',
      'estadoConservacion',
      'antiguedadHasta',
      'porcentaje',
      'documentoFuente',
    ]);
    expect(cuadroPorId('referenciales').columnas.map((c) => c.campo)).toEqual([
      'ejercicio',
      'categoria',
      'marca',
      'modelo',
      'anioFabricacion',
      'valor',
      'documentoFuente',
    ]);
  });

  it('el vehicular tiene SIETE columnas: es el que no cabe (AC8)', () => {
    expect(cuadroPorId('referenciales').columnas).toHaveLength(7);
  });

  it('los dominios son los CHECK del baseline, leidos y no copiados', () => {
    expect(baseline).toContain(
      "ADD CONSTRAINT valor_unitario_edificacion_partida_check CHECK (((partida)::text = ANY " +
        "((ARRAY['MUROS'::character varying, 'TECHOS'::character varying, " +
        "'PUERTAS'::character varying])::text[])))",
    );
    expect(DOMINIOS.partida).toEqual(['MUROS', 'TECHOS', 'PUERTAS']);

    expect(baseline).toContain(
      "ADD CONSTRAINT valor_unitario_edificacion_categoria_check CHECK ((categoria ~ '^[A-J]$'::text))",
    );
    expect(DOMINIOS.categoria.source).toBe('^[A-J]$');

    expect(baseline).toContain(
      "ADD CONSTRAINT depreciacion_uso_check CHECK (((uso)::text ~ '^0[1-4]$'::text))",
    );
    expect(DOMINIOS.uso.source).toBe('^0[1-4]$');
  });

  it('y el dominio se COMPRUEBA contra lo que llego, no solo se escribe en la cabecera', () => {
    const malo = snapshot({
      valoresUnitarios: [unitario({ partida: 'MURO' }), unitario({ categoria: 'K' })],
    });

    expect(fueraDeDominio(cuadroPorId('unitarios'), malo)).toEqual([
      'partida «MURO» (valor_unitario_edificacion_partida_check)',
      'categoria «K» (valor_unitario_edificacion_categoria_check)',
    ]);
    expect(fueraDeDominio(cuadroPorId('unitarios'), snapshot({ valoresUnitarios: [unitario()] })))
      .toEqual([]);

    expect(
      fueraDeDominio(
        cuadroPorId('depreciacion'),
        snapshot({ depreciaciones: [depreciacion({ uso: '05' })] }),
      ),
    ).toEqual(['uso «05» (depreciacion_uso_check)']);
  });
});

describe('AC2 — «antiguedadHasta» nulo es «más de N años», no un dato que falta', () => {
  /** El comentario de la columna en el baseline: la fuente de la lectura. */
  it('el baseline dice que el nulo es el tramo abierto, y no un dato que falte', () => {
    expect(baseline).toContain(
      "COMMENT ON COLUMN depreciacion.antiguedad_hasta IS 'Extremo superior del tramo de " +
        'antiguedad, en anios; NULO es «mas de 50 anios»',
    );
  });

  it('la N sale del ultimo tramo cerrado de SU tabla: mismo uso, material y estado', () => {
    const filas = [
      depreciacion({ antiguedadHasta: 5 }),
      depreciacion({ antiguedadHasta: 30 }),
      depreciacion({ antiguedadHasta: 50 }),
      // Otra tabla, con un tope mas alto: no puede contaminar la de arriba.
      depreciacion({ uso: '02', antiguedadHasta: 80 }),
      depreciacion({ antiguedadHasta: null }),
    ];
    const abierta = filas[4]!;

    expect(antiguedadAbierta(filas, abierta)).toBe('Más de 50 años');
  });

  it('sin ningun tramo cerrado de esa tabla no se inventa un numero', () => {
    const filas = [depreciacion({ antiguedadHasta: null })];
    expect(antiguedadAbierta(filas, filas[0]!)).toBe('Sin tope');
  });

  it('la celda NO es un guion, y no es un cero', () => {
    const filas = [depreciacion({ antiguedadHasta: 50 }), depreciacion({ antiguedadHasta: null })];
    const dibujadas = filasDelCuadro(cuadroPorId('depreciacion'), snapshot({ depreciaciones: filas }));
    const celda = dibujadas[1]?.celdas[3];

    expect(celda?.texto, 'Un guion diria que no se sabe; un cero, que el tramo no cubre nada.')
      .toBe('Más de 50 años');
    expect(celda?.texto).not.toBe('—');
    expect(celda?.texto).not.toBe('0');
    expect(celda?.nota).toContain('no es un dato que falte');
  });

  it('y en valores unitarios el «anioConstruccionHasta» nulo se lee igual', () => {
    const dibujadas = filasDelCuadro(
      cuadroPorId('unitarios'),
      snapshot({ valoresUnitarios: [unitario({ anioConstruccionHasta: null })] }),
    );

    expect(dibujadas[0]?.celdas[3]?.texto).toBe('Sin tope');
    expect(dibujadas[0]?.celdas[3]?.nota).toContain('No es un dato que falte');
  });
});

describe('AC3 — el ambito decide que cuadros hay, y los cuatro casos se distinguen', () => {
  const unitarios = cuadroPorId('unitarios');
  const referenciales = cuadroPorId('referenciales');

  it('el ambito lo lleva y llego: CON_FILAS', () => {
    expect(estadoDelCuadro('VALUACION', unitarios, 24)).toBe('CON_FILAS');
  });

  it('el ambito NO lo lleva y llego vacio: FUERA_DEL_AMBITO, que no es un vacio', () => {
    expect(estadoDelCuadro('OBLIGACION', unitarios, 0)).toBe('FUERA_DEL_AMBITO');
    expect(estadoDelCuadro('VALUACION', referenciales, 0)).toBe('FUERA_DEL_AMBITO');
  });

  it('el ambito SI lo lleva y llego vacio: SIN_FILAS, que es otra cosa', () => {
    expect(
      estadoDelCuadro('OBLIGACION', referenciales, 0),
      'Es el caso de la version 1 de 2026, sellada sin la edicion vehicular.',
    ).toBe('SIN_FILAS');
  });

  it('el ambito NO lo lleva y llego lleno: DE_MAS, que contra el backend no puede pasar', () => {
    expect(estadoDelCuadro('OBLIGACION', unitarios, 24)).toBe('DE_MAS');
  });

  it('el reparto es el de ComponerSnapshot: dos en VALUACION y uno en OBLIGACION', () => {
    const deValuacion = CUADROS_DE_VALUACION.filter((c) => c.ambito === 'VALUACION');
    expect(deValuacion.map((c) => c.id)).toEqual(['unitarios', 'depreciacion']);
    expect(CUADROS_DE_VALUACION.filter((c) => c.ambito === 'OBLIGACION').map((c) => c.id)).toEqual([
      'referenciales',
    ]);
  });

  it('cuantasFilasDe lee el campo del snapshot que le toca a cada cuadro', () => {
    const lleno = snapshot({
      valoresUnitarios: [unitario()],
      depreciaciones: [depreciacion(), depreciacion({ antiguedadHasta: 10 })],
      valoresReferenciales: [referencial(), referencial({ marca: 'BAJAJ' }), referencial({ marca: 'BYD' })],
    });

    expect(cuantasFilasDe(cuadroPorId('unitarios'), lleno)).toBe(1);
    expect(cuantasFilasDe(cuadroPorId('depreciacion'), lleno)).toBe(2);
    expect(cuantasFilasDe(cuadroPorId('referenciales'), lleno)).toBe(3);
  });
});

describe('las cifras se formatean, y no se opera con ellas', () => {
  it('el valor por m² y el valor vehicular salen con separador de miles', () => {
    const unitarias = filasDelCuadro(
      cuadroPorId('unitarios'),
      snapshot({ valoresUnitarios: [unitario({ valorM2: '894.27' })] }),
    );
    expect(unitarias[0]?.celdas[4]?.texto).toBe('894.27');

    const vehiculares = filasDelCuadro(
      cuadroPorId('referenciales'),
      snapshot({ valoresReferenciales: [referencial({ valor: '104780.00' })] }),
    );
    expect(vehiculares[0]?.celdas[5]?.texto).toBe('104,780.00');
  });

  it('un anio NO lleva separador de miles: no es dinero', () => {
    const filas = filasDelCuadro(
      cuadroPorId('referenciales'),
      snapshot({ valoresReferenciales: [referencial()] }),
    );
    expect(filas[0]?.celdas[0]?.texto).toBe('2026');
    expect(filas[0]?.celdas[4]?.texto).toBe('2025');
  });

  it('y una cifra con una forma que el backend no sirve REVIENTA, no se recorta', () => {
    expect(() =>
      filasDelCuadro(
        cuadroPorId('unitarios'),
        snapshot({ valoresUnitarios: [unitario({ valorM2: '894.275' })] }),
      ),
    ).toThrowError(/Redondear aqui seria aritmetica sobre una cifra sellada/);
  });
});

describe('el documento fuente sale de las FILAS, y se comprueba que todas digan lo mismo', () => {
  it('una edicion sola: el documento es el suyo', () => {
    const filas = filasDelCuadro(
      cuadroPorId('unitarios'),
      snapshot({ valoresUnitarios: [unitario(), unitario({ categoria: 'B' })] }),
    );

    expect(fuenteDelCuadro(filas)).toEqual({
      documento: 'Resolución Ministerial N.º 277-2025-VIVIENDA',
      distintos: ['Resolución Ministerial N.º 277-2025-VIVIENDA'],
    });
  });

  it('dos ediciones mezcladas: no se resume en una linea, se dicen las dos', () => {
    const filas = filasDelCuadro(
      cuadroPorId('unitarios'),
      snapshot({
        valoresUnitarios: [unitario(), unitario({ categoria: 'B', documentoFuente: 'R.M. de otro año' })],
      }),
    );

    const fuente = fuenteDelCuadro(filas);
    expect(fuente.documento).toBeNull();
    expect(fuente.distintos).toHaveLength(2);
  });

  it('sin filas no hay documento que afirmar', () => {
    expect(fuenteDelCuadro([])).toEqual({ documento: null, distintos: [] });
  });
});
