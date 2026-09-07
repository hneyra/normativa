import { describe, expect, it } from 'vitest';

import type { ConjuntoResource } from '../datos/lecturas.ts';
import { EDICIONES_AL_EMPEZAR, type EstadoDeEdiciones } from './estadoDeNormativa.ts';
import {
  DIRECCIONES,
  ORDENES_ADMITIDOS,
  SIN_DATO,
  TAMANO_MAXIMO,
  codigoDelError,
  ejerciciosDe,
  esVigente,
  rutaDelListado,
  selladosDe,
  selloDe,
  vigenteDe,
} from './conjuntos.ts';

/**
 * La regla de la vigencia y el dialecto del listado, sin montar nada.
 *
 * Se prueba aqui y no dentro de la pantalla porque no necesita una: son funciones puras sobre lo
 * que el backend sirve. Lo que la pantalla anade —que la marca se vea, que el desplegable no
 * ofrezca otra cosa— se prueba montandola, y ahi vale la pena el `render`.
 */

/** Un conjunto servido, con lo justo. */
function conjunto(
  id: number,
  ejercicio: number,
  version: number,
  estado: string,
  fechaSellado: string | null = null,
): ConjuntoResource {
  return {
    id,
    ejercicio,
    version,
    estado,
    fechaSellado,
    usuarioSellado: fechaSellado === null ? null : 'hneyra',
  };
}

/** Las tres ediciones del prototipo, con la forma que sirve `GET /seguridad/parametros`. */
const SERVIDOS: readonly ConjuntoResource[] = [
  conjunto(3, 2027, 1, 'ABIERTO'),
  conjunto(2, 2026, 2, 'SELLADO', '2026-09-06T15:22:00Z'),
  conjunto(1, 2026, 1, 'SELLADO', '2026-09-06T10:00:00Z'),
];

describe('la vigencia: varias versiones selladas del mismo ejercicio', () => {
  it('rige la ULTIMA version sellada, que es lo que hace «selladoVigenteDe»', () => {
    expect(vigenteDe(SERVIDOS, 2026)?.id).toBe(2);
  });

  it('y el orden en que lleguen no cambia cual rige', () => {
    // La lista puede venir ordenada por `id`, por `estado` o por lo que el usuario pida: la
    // vigencia no es «la primera fila», es la version mas alta.
    const alReves = [...SERVIDOS].reverse();

    expect(vigenteDe(alReves, 2026)?.id).toBe(2);
  });

  it('las DOS selladas de 2026 se ensenan, y solo una esta marcada', () => {
    const sellados = selladosDe(SERVIDOS, 2026);

    expect(sellados.map((uno) => uno.id)).toEqual([2, 1]);
    expect(
      sellados.map((uno) => esVigente(SERVIDOS, uno)),
      'Sin la marca, quien vea dos sellos de 2026 concluye que el sistema se contradice.',
    ).toEqual([true, false]);
  });

  it('un conjunto ABIERTO no rige nada, aunque sea el unico del ejercicio', () => {
    expect(vigenteDe(SERVIDOS, 2027)).toBeNull();
    expect(selladosDe(SERVIDOS, 2027)).toEqual([]);
  });

  it('un ejercicio sin ninguna version es una respuesta, no un error', () => {
    // Es lo que contesta hoy toda municipalidad recien implantada.
    expect(vigenteDe(SERVIDOS, 2025)).toBeNull();
  });

  it('los ejercicios servidos salen de mayor a menor y sin repetir', () => {
    expect(ejerciciosDe(SERVIDOS)).toEqual([2027, 2026]);
  });
});

describe('la ruta del listado: los cuatro nombres del dialecto, y ninguno mas', () => {
  it('lleva los cuatro y nada mas', () => {
    const ruta = rutaDelListado(EDICIONES_AL_EMPEZAR);
    const consulta = new URLSearchParams(ruta.slice(ruta.indexOf('?') + 1));

    expect(ruta.startsWith('/seguridad/parametros?')).toBe(true);
    expect(
      [...consulta.keys()].sort(),
      'Un quinto nombre seria un 422 «parametro desconocido» de GuardiaDeParametros.',
    ).toEqual(['direccion', 'ordenarPor', 'pagina', 'tamano']);
  });

  it('el orden por omision es por ejercicio y descendente: el ano en curso arriba', () => {
    expect(rutaDelListado(EDICIONES_AL_EMPEZAR)).toContain('ordenarPor=ejercicio');
    expect(rutaDelListado(EDICIONES_AL_EMPEZAR)).toContain('direccion=DESCENDENTE');
  });

  it.each(ORDENES_ADMITIDOS)('«%s» se admite y viaja tal cual', (orden) => {
    const estado: EstadoDeEdiciones = { ...EDICIONES_AL_EMPEZAR, ordenarPor: orden };

    expect(rutaDelListado(estado)).toContain(`ordenarPor=${orden}`);
  });

  it('un campo que el backend NO admite no se pide: seria un 422 ORDEN_NO_ADMITIDO', () => {
    // `ParametrosRepositoryJdbc.ORDEN_CONJUNTO` es
    // `OrdenSeguro.sobre("ejercicio", "version", "estado", "id")`, y nada mas.
    const estado: EstadoDeEdiciones = { ...EDICIONES_AL_EMPEZAR, ordenarPor: 'fechaSellado' };

    expect(rutaDelListado(estado)).not.toContain('fechaSellado');
    expect(rutaDelListado(estado)).toContain('ordenarPor=ejercicio');
  });

  it('un sentido que no existe tampoco', () => {
    const estado: EstadoDeEdiciones = { ...EDICIONES_AL_EMPEZAR, direccion: 'ARRIBA' };

    expect(rutaDelListado(estado)).toContain('direccion=DESCENDENTE');
    expect(DIRECCIONES).toEqual(['DESCENDENTE', 'ASCENDENTE']);
  });

  it('el tamano se acota a 500, que es `Paginacion.TAMANO_MAXIMO`', () => {
    const enorme: EstadoDeEdiciones = { ...EDICIONES_AL_EMPEZAR, tamano: 5000 };
    const cero: EstadoDeEdiciones = { ...EDICIONES_AL_EMPEZAR, tamano: 0 };

    expect(rutaDelListado(enorme)).toContain(`tamano=${String(TAMANO_MAXIMO)}`);
    expect(
      rutaDelListado(cero),
      'El backend rechaza con 422 «El tamano de pagina va de 1 a 500».',
    ).toContain('tamano=1');
  });

  it('la pagina no baja de cero: se cuenta desde 0, como en SQL', () => {
    const negativa: EstadoDeEdiciones = { ...EDICIONES_AL_EMPEZAR, pagina: -3 };

    expect(rutaDelListado(negativa)).toContain('pagina=0');
  });
});

describe('el sello, escrito sin construir un Date', () => {
  it('«2026-09-06T15:22:00Z» sale como «06/09/2026 15:22 · hneyra»', () => {
    // Con `new Date(...)` ese instante se imprimiria en la zona del puesto: en Lima, el 6 a las
    // 10:22. Un sello que cambia de hora segun donde este el navegador no es un detalle de
    // formato en el acto del que cuelga la reproducibilidad de un ejercicio.
    expect(selloDe(conjunto(2, 2026, 2, 'SELLADO', '2026-09-06T15:22:00Z'))).toBe(
      '06/09/2026 15:22 · hneyra',
    );
  });

  it('un conjunto sin sellar sale con guion, no en blanco', () => {
    expect(selloDe(conjunto(3, 2027, 1, 'ABIERTO'))).toBe(SIN_DATO);
  });
});

describe('el codigo del catalogo, leido del mensaje del recurso', () => {
  it('lo saca de delante, que es donde `useRecurso` lo pone a proposito', () => {
    expect(codigoDelError('SIN_PRIVILEGIO (403): No tiene el acceso')).toBe('SIN_PRIVILEGIO');
    expect(codigoDelError('ERROR_INTERNO (500): vaya')).toBe('ERROR_INTERNO');
  });

  it('sin error, o con un mensaje que no lo trae, no inventa ninguno', () => {
    expect(codigoDelError(null)).toBe('');
    expect(codigoDelError('El sistema no pudo contestar. Reintente en unos segundos.')).toBe('');
  });
});
