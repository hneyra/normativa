import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi, type SnapshotVerificado } from '../api/cliente.ts';
import { OPERACIONES, claveDe } from '../datos/operaciones.ts';
import type { SnapshotResource } from '../datos/lecturas.ts';
import {
  CACHE_CONTROL_DEL_CONTRATO,
  CONSUMIDORES,
  OPERACIONES_CONSUMIDAS,
  OPERACIONES_SIN_CONSUMIDOR,
  comprobacionDe,
  compararAmbitos,
  esEjercicioSinPublicar,
  guardarComoArchivo,
  identidadDe,
  lineasDeLaRespuesta,
  listasDelSnapshot,
  nombreDelArchivo,
} from './publicacion.ts';

/**
 * Lo que la seccion de Publicacion AFIRMA, probado sin montar nada.
 *
 * Las afirmaciones que esta pantalla hace son de las caras: que el `sha256` cuadra, que se puede
 * guardar un ano, que la identidad no cambia con el ambito. Ninguna de las tres se puede
 * comprobar mirando el dibujo, y las tres se pueden comprobar aqui.
 */

function snapshot(encima: Partial<SnapshotResource> = {}): SnapshotResource {
  return {
    conjuntoId: 2,
    ejercicio: 2026,
    version: 2,
    ambito: 'VALUACION',
    filas: 71,
    parametros: [],
    valoresUnitarios: [],
    depreciaciones: [],
    valoresReferenciales: [],
    ...encima,
  };
}

function verificado(
  recurso: SnapshotResource,
  huella: string,
  cacheControl: string | null = CACHE_CONTROL_DEL_CONTRATO,
): SnapshotVerificado<SnapshotResource> {
  return { recurso, huella, cuerpo: JSON.stringify(recurso), cacheControl };
}

/** El texto de un `Blob`, con `FileReader`: el `Blob` de jsdom no trae `text()`. */
function leer(dato: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      resolver(String(lector.result));
    };
    lector.onerror = () => {
      rechazar(new Error('No se pudo leer el Blob'));
    };
    lector.readAsText(dato);
  });
}

/** Filas de mentira, solo para contar: lo que se prueba aqui es la CUENTA y su motivo. */
function tantas<T>(cuantas: number, hacer: () => T): readonly T[] {
  return Array.from({ length: cuantas }, hacer);
}

const HUELLA_A = 'a'.repeat(64);
const HUELLA_B = 'b'.repeat(64);

describe('AC9 — el nombre del archivo lleva conjunto, ejercicio y ambito', () => {
  it('los cuatro datos de la identidad estan en el nombre', () => {
    expect(nombreDelArchivo(snapshot())).toBe('normativa-conjunto-2-2026-v2-VALUACION.json');
  });

  it('dos ambitos del mismo conjunto NO comparten nombre de archivo', () => {
    const uno = nombreDelArchivo(snapshot({ ambito: 'VALUACION' }));
    const otro = nombreDelArchivo(snapshot({ ambito: 'OBLIGACION' }));

    expect(uno).not.toBe(otro);
  });

  it('ni dos versiones del mismo ejercicio, que es el caso que existe de verdad', () => {
    // `conjunto_uq (municipalidad_id, ejercicio, version)`: puede haber varias selladas.
    expect(nombreDelArchivo(snapshot({ conjuntoId: 1, version: 1 }))).not.toBe(
      nombreDelArchivo(snapshot({ conjuntoId: 2, version: 2 })),
    );
  });

  it('y nunca se llama «snapshot.json»', () => {
    expect(nombreDelArchivo(snapshot())).not.toBe('snapshot.json');
  });
});

describe('AC9 — se guarda lo mismo que se verifico, y no una segunda serializacion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('el Blob lleva los BYTES que se verificaron, y el <a> el nombre elegido', async () => {
    // Los bytes de un snapshot de verdad, con su tilde: si se guardara una segunda
    // serializacion, bastaria un escape distinto para que el sha256 del archivo dejara de ser
    // el del ETag que lo acompana.
    const cuerpo = '{"conjuntoId":2,"documentoFuente":"Resolución Ministerial N.º 277-2025-VIVIENDA"}';
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: (dato: Blob) => {
        blobs.push(dato);
        return 'blob:prueba';
      },
      revokeObjectURL: vi.fn(),
    });
    // `click()` sobre un `<a href>` navega, y jsdom no implementa navegacion. Se espia, que
    // ademas es como se lee lo que el enlace llevaba puesto.
    const clic = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('normativa-conjunto-2-2026-v2-VALUACION.json');
        expect(this.href).toBe('blob:prueba');
        expect(this.isConnected, 'Firefox no dispara la descarga de un <a> suelto.').toBe(true);
      });

    expect(guardarComoArchivo('normativa-conjunto-2-2026-v2-VALUACION.json', cuerpo)).toBe(true);

    expect(clic).toHaveBeenCalledTimes(1);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]?.type).toBe('application/json');
    expect(await leer(blobs[0]!)).toBe(cuerpo);
    // Y el `<a>` no se queda pegado al documento.
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('el objeto de URL se revoca SIEMPRE, tambien si el clic revienta', () => {
    const revocar = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:prueba', revokeObjectURL: revocar });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('el navegador dijo que no');
    });

    expect(() => guardarComoArchivo('archivo.json', '{}')).toThrowError('el navegador dijo que no');
    expect(revocar, 'Cada URL viva retiene su Blob entero en memoria.').toHaveBeenCalledWith(
      'blob:prueba',
    );
  });

  it('sin «createObjectURL» no revienta: dice que no se pudo', () => {
    vi.stubGlobal('URL', {});
    expect(guardarComoArchivo('archivo.json', '{}')).toBe(false);
  });
});

describe('AC5 — el ETag, el Cache-Control, las filas y el resultado de la comprobacion', () => {
  it('las lineas dicen las cuatro cosas, y de donde sale cada una', () => {
    const lineas = lineasDeLaRespuesta(verificado(snapshot(), HUELLA_A));
    const porEtiqueta = new Map(lineas.map((l) => [l.etiqueta, l]));

    expect(porEtiqueta.get('ETag')?.valor).toBe(`"${HUELLA_A}"`);
    expect(porEtiqueta.get('ETag')?.origen).toBe('cabecera');
    expect(porEtiqueta.get('Cache-Control')?.valor).toBe(CACHE_CONTROL_DEL_CONTRATO);
    expect(porEtiqueta.get('Cache-Control')?.origen).toBe('cabecera');
    expect(porEtiqueta.get('filas')?.valor).toBe('71');
    expect(porEtiqueta.get('filas')?.origen, 'Las filas vienen DENTRO del cuerpo.').toBe('cuerpo');
    expect(porEtiqueta.get('ambito')?.valor).toBe('VALUACION');
  });

  it('el «Cache-Control» que se ensena es el que LLEGO, no el del contrato', () => {
    const otro = lineasDeLaRespuesta(verificado(snapshot(), HUELLA_A, 'no-store'));
    expect(otro.find((l) => l.etiqueta === 'Cache-Control')?.valor).toBe('no-store');

    const ninguno = lineasDeLaRespuesta(verificado(snapshot(), HUELLA_A, null));
    expect(ninguno.find((l) => l.etiqueta === 'Cache-Control')?.valor).toBe('sin Cache-Control');
  });

  it('con la cabecera del contrato, la comprobacion sale en verde y nombra el sha256', () => {
    const comprobacion = comprobacionDe(verificado(snapshot(), HUELLA_A));

    expect(comprobacion.tono).toBe('ok');
    expect(comprobacion.titulo).toContain('coincide con el ETag');
    expect(comprobacion.detalle).toContain('sha256(cuerpo)');
  });

  it('con otra cabecera, los bytes siguen buenos y lo que se pone en duda es la CACHE', () => {
    const comprobacion = comprobacionDe(verificado(snapshot(), HUELLA_A, 'no-store'));

    expect(comprobacion.tono).toBe('atencion');
    expect(comprobacion.titulo).toContain('El sha256 cuadra');
    expect(comprobacion.detalle).toContain('no-store');
    expect(comprobacion.detalle).toContain(HUELLA_A);
  });

  it('y el «Cache-Control» del contrato es el que el backend escribe', () => {
    // `SnapshotController`: un ano es el maximo que admite la especificacion, e `immutable`
    // dice que no hace falta revalidar nunca.
    expect(CACHE_CONTROL_DEL_CONTRATO).toBe('public, max-age=31536000, immutable');
  });
});

describe('AC6 — la identidad no cambia con el ambito; la huella si', () => {
  it('la identidad son los tres campos que no dependen del ambito', () => {
    expect(identidadDe(snapshot({ ambito: 'VALUACION' }))).toBe(
      identidadDe(snapshot({ ambito: 'OBLIGACION' })),
    );
    expect(identidadDe(snapshot())).toBe('conjunto 2 · ejercicio 2026 · versión 2');
  });

  it('misma identidad y huellas distintas: es lo que ADR-0025 afirma', () => {
    const comparacion = compararAmbitos(
      verificado(snapshot({ ambito: 'VALUACION' }), HUELLA_A),
      verificado(snapshot({ ambito: 'OBLIGACION' }), HUELLA_B),
    );

    expect(comparacion.identidadCoincide).toBe(true);
    expect(comparacion.huellaCambia).toBe(true);
    expect(comparacion.tono).toBe('ok');
    expect(comparacion.veredicto).toContain('DOS snapshots del MISMO conjunto');
  });

  it('misma identidad y MISMA huella: se dice, no se repite la frase del ADR', () => {
    const comparacion = compararAmbitos(
      verificado(snapshot({ ambito: 'VALUACION' }), HUELLA_A),
      verificado(snapshot({ ambito: 'OBLIGACION' }), HUELLA_A),
    );

    expect(comparacion.huellaCambia).toBe(false);
    expect(comparacion.tono).toBe('atencion');
    expect(
      comparacion.veredicto,
      'Es lo que pasa contra el proxy, que no mira la consulta. Decirlo es la mitad del valor\n' +
        'de medir en vez de declarar.',
    ).toContain('no la compuso ComponerSnapshot');
  });

  it('identidades distintas: no son dos mitades del mismo juego de valores', () => {
    const comparacion = compararAmbitos(
      verificado(snapshot({ conjuntoId: 1, version: 1 }), HUELLA_A),
      verificado(snapshot({ conjuntoId: 2, version: 2 }), HUELLA_B),
    );

    expect(comparacion.identidadCoincide).toBe(false);
    expect(comparacion.tono).toBe('atencion');
    expect(comparacion.veredicto).toContain('conjuntos distintos');
  });
});

describe('AC3 en la publicacion — un cuadro vacio por ambito no es un cuadro sin datos', () => {
  it('en VALUACION faltan los referenciales, y eso se explica por el ambito', () => {
    const listas = listasDelSnapshot(
      snapshot({
        ambito: 'VALUACION',
        parametros: tantas(33, () => ({
          tipo: 'UIT',
          clave: null,
          valorNumerico: '5500.00',
          valorTexto: null,
          vigenciaDesde: '2026-01-01',
          vigenciaHasta: '2026-12-31',
          documentoFuente: 'D.S. N.° 301-2025-EF',
        })),
        valoresUnitarios: tantas(24, () => ({
          partida: 'MUROS',
          categoria: 'A',
          anioConstruccionDesde: 1990,
          anioConstruccionHasta: null,
          valorM2: '894.27',
          documentoFuente: 'R.M. 277-2025-VIVIENDA',
        })),
        depreciaciones: tantas(14, () => ({
          uso: '01',
          material: 'Concreto',
          estadoConservacion: 'Muy Bueno',
          antiguedadHasta: 5,
          porcentaje: '0',
          documentoFuente: 'R.M. 172-2016-VIVIENDA',
        })),
      }),
    );
    const porCampo = new Map(listas.map((l) => [l.campo, l]));

    expect(porCampo.get('valoresUnitarios')?.cuantas).toBe(24);
    expect(porCampo.get('valoresUnitarios')?.tono).toBe('ok');
    expect(porCampo.get('valoresReferenciales')?.cuantas).toBe(0);
    expect(porCampo.get('valoresReferenciales')?.tono).toBe('ok');
    expect(porCampo.get('valoresReferenciales')?.porQue).toContain('El ámbito VALUACION no los lleva');
  });

  it('en OBLIGACION, un vehicular vacio SI es una anomalia y se dice distinto', () => {
    const listas = listasDelSnapshot(snapshot({ ambito: 'OBLIGACION' }));
    const porCampo = new Map(listas.map((l) => [l.campo, l]));

    expect(porCampo.get('valoresReferenciales')?.tono).toBe('atencion');
    expect(porCampo.get('valoresReferenciales')?.porQue).toContain('Este ámbito SÍ lo lleva');
    // Y los dos de la valuacion se explican por el ambito, no por una averia.
    expect(porCampo.get('valoresUnitarios')?.tono).toBe('ok');
    expect(porCampo.get('depreciaciones')?.porQue).toContain('El ámbito OBLIGACION no las lleva');
  });

  it('los parametros vacios no los explica el ambito: van en los dos', () => {
    const listas = listasDelSnapshot(snapshot({ ambito: 'VALUACION' }));
    const parametros = listas.find((l) => l.campo === 'parametros');

    expect(parametros?.tono).toBe('mal');
    expect(parametros?.porQue).toContain('vacío no lo explica el ámbito');
  });

  it('un cuadro que llega donde el ambito no lo lleva se nombra, no se dibuja como normal', () => {
    const listas = listasDelSnapshot(
      snapshot({
        ambito: 'OBLIGACION',
        valoresUnitarios: tantas(24, () => ({
          partida: 'MUROS',
          categoria: 'A',
          anioConstruccionDesde: 1990,
          anioConstruccionHasta: null,
          valorM2: '894.27',
          documentoFuente: 'R.M. 277-2025-VIVIENDA',
        })),
      }),
    );

    expect(listas.find((l) => l.campo === 'valoresUnitarios')?.porQue).toContain(
      'no la compuso ComponerSnapshot',
    );
  });
});

describe('AC4 — el 404 que no es una averia', () => {
  it('lo distingue el miembro «parametroQueFalta», no el numero ni el codigo', () => {
    const sinPublicar = new ErrorDeLaApi(
      'NO_ENCONTRADO',
      'El ejercicio 2027 no tiene un conjunto de parametros sellado',
      404,
      { parametroQueFalta: { ejercicio: 2027 } },
    );
    const rutaQueNoExiste = new ErrorDeLaApi('NO_ENCONTRADO', 'No se encontro lo solicitado', 404);

    expect(esEjercicioSinPublicar(sinPublicar)).toBe(true);
    expect(
      esEjercicioSinPublicar(rutaQueNoExiste),
      'Los dos son 404 y los dos son NO_ENCONTRADO. El miembro es lo unico que los separa,\n' +
        'y lo dice el javadoc de FaltaPublicar.',
    ).toBe(false);
    expect(sinPublicar.codigo).toBe(rutaQueNoExiste.codigo);
    expect(sinPublicar.estado).toBe(rutaQueNoExiste.estado);
  });

  it('un 422 con el mismo miembro NO es este caso: ese es un calculo que no se pudo hacer', () => {
    const deUnCalculo = new ErrorDeLaApi('VALIDACION', 'Falta publicar la UIT', 422, {
      parametroQueFalta: { ejercicio: 2027, llave: 'UIT' },
    });

    expect(esEjercicioSinPublicar(deUnCalculo)).toBe(false);
  });

  it('y ninguno de los dos 404 se reintenta solo', () => {
    const sinPublicar = new ErrorDeLaApi('NO_ENCONTRADO', 'no esta', 404, {
      parametroQueFalta: { ejercicio: 2027 },
    });
    expect(sinPublicar.reintentable).toBe(false);
  });
});

describe('AC7 — se nombra quien consume esto, y con que dos operaciones', () => {
  it('los consumidores son rentas y catastro, y rentas pide los DOS ambitos', () => {
    expect(CONSUMIDORES.map((c) => c.sistema)).toEqual(['catastro', 'rentas', 'rentas']);
    expect(new Set(CONSUMIDORES.map((c) => c.sistema))).toEqual(new Set(['catastro', 'rentas']));
    expect(CONSUMIDORES.filter((c) => c.sistema === 'rentas').map((c) => c.ambito)).toEqual([
      'OBLIGACION',
      'VALUACION',
    ]);
  });

  it('son DOS operaciones, y las dos existen de verdad en este sistema', () => {
    expect(OPERACIONES_CONSUMIDAS).toHaveLength(2);

    const reales = OPERACIONES.filter((o) => o.origen === 'REAL').map(claveDe);
    for (const consumida of OPERACIONES_CONSUMIDAS) {
      expect(
        reales,
        `El contrato de rentas y el de catastro declaran «${consumida}».\n` +
          'Si esa operacion deja de existir aqui, lo que se rompe es su build, no el nuestro.',
      ).toContain(consumida);
    }
  });

  it('y las dos que nadie consume tambien existen: la lista no es una excusa', () => {
    const reales = OPERACIONES.filter((o) => o.origen === 'REAL').map(claveDe);

    for (const sinConsumidor of OPERACIONES_SIN_CONSUMIDOR) {
      expect(reales).toContain(sinConsumidor);
    }
    // Las cuatro reales estan repartidas entre las dos listas, sin solaparse y sin sobrar.
    expect([...OPERACIONES_CONSUMIDAS, ...OPERACIONES_SIN_CONSUMIDOR].sort()).toEqual(
      [...reales].sort(),
    );
  });

  it('ninguno consume «/seguridad/parametros», que es lo que el issue subraya', () => {
    expect(OPERACIONES_CONSUMIDAS.join(' ')).not.toContain('/seguridad/parametros');
    expect(OPERACIONES_SIN_CONSUMIDOR).toContain('GET /seguridad/parametros');
  });
});
