import { describe, expect, it } from 'vitest';

import type { ConjuntoResource } from '../datos/lecturas.ts';
import { SELLADO } from './conjuntos.ts';
import { EDICIONES_AL_EMPEZAR, type EstadoDeEdiciones } from './estadoDeNormativa.ts';
import {
  OBSERVACION,
  OBSERVACION_MAXIMA,
  OBSERVACION_MINIMA,
  PASOS,
  PASO_DE_APERTURA,
  PASO_DE_LECTURA,
  bloqueado,
  claveDeLaObservacion,
  cuerpoDe,
  esObligatorio,
  filtrar,
  motivoDe,
  pasoDe,
  pasosPara,
  pendientesDe,
  rutaDe,
  valoresServidos,
} from './ediciones.ts';

/**
 * Los tres formularios como DATO, y la compuerta que los cierra sin observacion.
 *
 * Todo lo de aqui es puro: entra lo tecleado y sale por que no se puede guardar. La pantalla
 * ensena ese motivo en tres sitios —el `title` del boton, el pie y el toast— y los tres leen esta
 * funcion, que es lo que impide que digan cosas distintas.
 */

/** Un lector de valores, como el que la pantalla compone: lo tecleado, y nada mas. */
function conLo(escrito: Readonly<Record<string, string>>) {
  return (clave: string) => escrito[clave] ?? '';
}

const SELLADO_2026: ConjuntoResource = {
  id: 2,
  ejercicio: 2026,
  version: 2,
  estado: SELLADO,
  fechaSellado: '2026-09-06T15:22:00Z',
  usuarioSellado: 'hneyra',
};

describe('los cuatro pasos: uno que lee y TRES que escriben', () => {
  it('son cuatro, y tres escriben', () => {
    expect(PASOS.map((paso) => paso.id)).toEqual([
      'parametros',
      'abrir',
      'agregar',
      'sellar',
    ]);
    expect(PASOS.filter((paso) => paso.escritura)).toHaveLength(3);
  });

  it('el que NO escribe es solo de lectura: ni un campo escribible', () => {
    const lectura = pasoDe(PASO_DE_LECTURA);

    expect(lectura.escritura).toBe(false);
    expect(lectura.campos.every((campo) => campo.tipo === 'ro')).toBe(true);
    expect(lectura.campos.some((campo) => campo.campo !== undefined)).toBe(false);
  });

  it.each(PASOS.filter((paso) => paso.escritura).map((paso) => [paso.id, paso] as const))(
    '«%s» pide observacion, y nombra el caso de uso del backend que ejecuta',
    (_id, paso) => {
      const observacion = paso.campos.find((campo) => campo.campo === OBSERVACION);

      expect(observacion, 'Regla 10: sin observacion no se guarda.').toBeDefined();
      expect(observacion?.etiqueta).toBe('Observación');
      expect(esObligatorio(observacion!)).toBe(true);
      expect(paso.casoDeUso).toMatch(/^AdministrarParametros\./);
      expect(paso.verbo).not.toBe(undefined);
    },
  );

  it('cada formulario guarda su observacion con SU clave, y todas viajan como «observacion»', () => {
    const escritura = PASOS.filter((paso) => paso.escritura);
    const claves = escritura.map(claveDeLaObservacion);

    expect(
      new Set(claves).size,
      'Una observacion escrita para abrir una version no puede convertirse en silencio en la\n' +
        'observacion con la que se sella: son dos asientos de auditoria distintos.',
    ).toBe(escritura.length);
    expect(claves).toEqual(['observacionAbrir', 'observacionAgregar', 'observacionSellar']);
  });

  it('los campos son DATOS: ninguno declara un tipo que `Campo` no dibuje', () => {
    const admitidos = ['text', 'date', 'sel', 'area', 'chk', 'ro'];

    expect(
      PASOS.flatMap((paso) => paso.campos.map((campo) => campo.tipo)).filter(
        (tipo) => !admitidos.includes(tipo),
      ),
    ).toEqual([]);
  });

  it('sin conjunto detras solo cabe ABRIR una version', () => {
    // Es lo que ve una municipalidad recien implantada: los otros tres necesitan un conjunto.
    expect(pasosPara(null).map((paso) => paso.id)).toEqual([PASO_DE_APERTURA]);
    expect(pasosPara(SELLADO_2026)).toHaveLength(4);
  });

  it('y con un identificador que no existe se cae del lado del que si funciona', () => {
    expect(pasoDe('inventado').id).toBe(PASO_DE_APERTURA);
  });
});

describe('la compuerta: sin observacion no se guarda (regla 10)', () => {
  const sellar = pasoDe('sellar');
  const abrir = pasoDe(PASO_DE_APERTURA);

  it('el minimo son 5 caracteres, que es `auditoria_observacion_ck`', () => {
    expect(OBSERVACION_MINIMA).toBe(5);
    expect(OBSERVACION_MAXIMA).toBe(500);
  });

  it('con la observacion vacia no se puede sellar, y el motivo lo dice', () => {
    const valor = conLo({});

    expect(bloqueado(sellar, valor)).toBe(true);
    expect(motivoDe(sellar, valor)).toBe(
      'Sin observación no se guarda: al menos 5 caracteres (regla 10).',
    );
  });

  it('con cuatro caracteres tampoco, y con cinco si', () => {
    expect(bloqueado(sellar, conLo({ observacionSellar: 'abcd' }))).toBe(true);
    expect(bloqueado(sellar, conLo({ observacionSellar: 'abcde' }))).toBe(false);
  });

  it('y con espacios no cuela: se recorta antes de contar, como hace `btrim`', () => {
    expect(bloqueado(sellar, conLo({ observacionSellar: '       ' }))).toBe(true);
  });

  it('mas de 500 tampoco: es el ancho de la columna', () => {
    const larga = 'x'.repeat(OBSERVACION_MAXIMA + 1);

    expect(motivoDe(sellar, conLo({ observacionSellar: larga }))).toContain('como mucho 500');
  });

  it('lo que falta por teclear se dice ANTES que la observacion', () => {
    // Al reves, quien no ha escrito nada leeria «falta la observacion» con el formulario entero
    // vacio, y saldria a buscar el campo equivocado.
    expect(motivoDe(abrir, conLo({}))).toBe('Queda 1 dato obligatorio sin llenar.');
    expect(motivoDe(abrir, conLo({ ejercicioNuevo: '2027' }))).toContain('Sin observación');
  });

  it('cuenta en plural cuando faltan varios', () => {
    const agregar = pasoDe('agregar');

    expect(motivoDe(agregar, conLo({}))).toBe('Quedan 2 datos obligatorios sin llenar.');
  });

  it('lo opcional no cuenta: la clave va vacia cuando el tipo tiene un solo valor', () => {
    const agregar = pasoDe('agregar');
    const completo = conLo({
      tipo: 'UIT',
      vigenciaDesde: '2026-01-01',
      observacionAgregar: 'Entra la UIT de 2026',
    });

    expect(pendientesDe(agregar, completo)).toEqual([]);
    expect(bloqueado(agregar, completo)).toBe(false);
  });

  it('el paso de lectura no tiene compuerta: no guarda nada', () => {
    expect(motivoDe(pasoDe(PASO_DE_LECTURA), conLo({}))).toBe('');
    expect(bloqueado(pasoDe(PASO_DE_LECTURA), conLo({}))).toBe(false);
  });
});

describe('el cuerpo que se manda, compuesto recorriendo los campos', () => {
  it('lleva los nombres del backend, no las claves de la pantalla', () => {
    const abrir = pasoDe(PASO_DE_APERTURA);

    expect(
      cuerpoDe(abrir, conLo({ ejercicioNuevo: '2027', observacionAbrir: 'Se abre 2027' })),
    ).toEqual({ ejercicio: '2027', observacion: 'Se abre 2027' });
  });

  it('no manda los de solo lectura: la version la calcula el servidor', () => {
    const abrir = pasoDe(PASO_DE_APERTURA);

    expect(Object.keys(cuerpoDe(abrir, conLo({})))).toEqual(['ejercicio', 'observacion']);
  });

  it('recorta lo tecleado: los espacios de los bordes no son parte de una observacion', () => {
    const sellar = pasoDe('sellar');

    expect(cuerpoDe(sellar, conLo({ observacionSellar: '  se sella  ' }))).toEqual({
      observacion: 'se sella',
    });
  });

  it('lo opcional vacio NO viaja: «sin clave» y «clave en blanco» son cosas distintas', () => {
    const agregar = pasoDe('agregar');
    const cuerpo = cuerpoDe(
      agregar,
      conLo({ tipo: 'UIT', vigenciaDesde: '2026-01-01', observacionAgregar: 'La UIT' }),
    );

    expect('clave' in cuerpo).toBe(false);
    expect(cuerpo).toEqual({
      tipo: 'UIT',
      vigenciaDesde: '2026-01-01',
      observacion: 'La UIT',
    });
  });
});

describe('a donde va cada escritura', () => {
  it('abrir una version NO necesita conjunto, y las otras dos si', () => {
    expect(rutaDe(pasoDe(PASO_DE_APERTURA), null)).toBe('/ediciones');
    expect(rutaDe(pasoDe('agregar'), null)).toBeNull();
    expect(rutaDe(pasoDe('sellar'), null)).toBeNull();
  });

  it('con conjunto, el identificador va en la ruta', () => {
    expect(rutaDe(pasoDe('agregar'), SELLADO_2026)).toBe('/ediciones/2/parametros');
    expect(rutaDe(pasoDe('sellar'), SELLADO_2026)).toBe('/ediciones/2/sellar');
  });

  it('el paso de lectura no manda nada', () => {
    expect(rutaDe(pasoDe(PASO_DE_LECTURA), SELLADO_2026)).toBeNull();
  });
});

describe('lo que el servidor ya sabe, y lo que no publica nadie', () => {
  it('los campos de solo lectura salen del conjunto servido', () => {
    expect(valoresServidos(SELLADO_2026)).toEqual({
      id: '2',
      conjunto: '2',
      ejercicio: '2026',
      version: '2',
      estado: 'SELLADO',
      fechaSellado: '2026-09-06T15:22:00Z',
      usuarioSellado: 'hneyra',
    });
  });

  it('«la version que se asignara» y «lo que se congela» NO estan, y por eso salen con guion', () => {
    // La version la calcula el servidor —«la ultima del ejercicio mas uno»— y el ejercicio lo
    // elige quien abre la version, que puede no ser el del conjunto abierto. Y ninguna
    // operacion publica cuantos parametros lleva un conjunto SIN sellar: por eso la negativa
    // de «sellarlo vacio» llega del servidor en vez de predecirse aqui.
    const servidos = valoresServidos(SELLADO_2026);

    expect('versionQueSeAsignara' in servidos).toBe(false);
    expect('loQueSeCongela' in servidos).toBe(false);
  });

  it('sin conjunto no hay nada servido', () => {
    expect(valoresServidos(null)).toEqual({});
  });
});

describe('el filtro, que corre sobre la pagina servida', () => {
  const servidos: readonly ConjuntoResource[] = [
    { id: 3, ejercicio: 2027, version: 1, estado: 'ABIERTO', fechaSellado: null, usuarioSellado: null },
    SELLADO_2026,
    { id: 1, ejercicio: 2026, version: 1, estado: SELLADO, fechaSellado: '2026-09-06T10:00:00Z', usuarioSellado: 'hneyra' },
  ];

  const con = (cambio: Partial<EstadoDeEdiciones>): EstadoDeEdiciones => ({
    ...EDICIONES_AL_EMPEZAR,
    ...cambio,
  });

  it('sin filtro pasan todas', () => {
    expect(filtrar(servidos, EDICIONES_AL_EMPEZAR)).toHaveLength(3);
  });

  it('el chip separa abiertas de selladas', () => {
    expect(filtrar(servidos, con({ chip: 'Abiertas' })).map((uno) => uno.id)).toEqual([3]);
    expect(filtrar(servidos, con({ chip: 'Selladas' })).map((uno) => uno.id)).toEqual([2, 1]);
  });

  it('el buscador entiende el ano, la «v2» y el identificador', () => {
    expect(filtrar(servidos, con({ q: '2027' })).map((uno) => uno.id)).toEqual([3]);
    expect(filtrar(servidos, con({ q: 'v2' })).map((uno) => uno.id)).toEqual([2]);
    expect(filtrar(servidos, con({ q: 'SELLADO' })).map((uno) => uno.id)).toEqual([2, 1]);
  });

  it('y no distingue mayusculas', () => {
    expect(filtrar(servidos, con({ q: 'abierto' })).map((uno) => uno.id)).toEqual([3]);
  });
});
