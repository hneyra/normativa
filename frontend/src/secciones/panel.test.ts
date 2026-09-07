import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { desinstalarProxyDeDatos, instalarProxyDeDatos } from '../api/proxy.ts';
import { AMBITOS, pedirSnapshot } from '../datos/lecturas.ts';
import {
  DECISIONES,
  SELLO_DE_2026,
  SIN_ARCHIVO,
  cuantasAbiertas,
  filasSinArchivoDe,
} from './panel.ts';

/**
 * Lo que el Panel afirma sin que ninguna operacion lo publique, y **de donde salio cada cifra**.
 *
 * La prueba mas util de este archivo no es ninguna de las que cuentan filas: es la ultima, que
 * **pide el snapshot al proxy y cuenta sus parametros**. Una cuenta escrita a mano se queda atras
 * el dia que el corpus crezca, y no hay forma de que nadie se entere — salvo comparandola con lo
 * que el sistema sirve de verdad.
 */

beforeAll(() => {
  instalarProxyDeDatos();
});

afterAll(() => {
  desinstalarProxyDeDatos();
});

describe('las diez filas del mapa normativo sin archivo del corpus', () => {
  it('son diez, y ocho de D-02b y dos de D-02c', () => {
    // De `docs/10-negocio/valores-normativos/publicacion/README.md`, lineas 224-246.
    expect(SIN_ARCHIVO).toHaveLength(10);
    expect(filasSinArchivoDe('D-02b')).toBe(8);
    expect(filasSinArchivoDe('D-02c')).toBe(2);
  });

  it('cada una lleva SU numero de fila del mapa, y no un indice de esta lista', () => {
    // Es como se la nombra en el README, y es lo que permite ir a buscarla. Con un indice
    // —1..10— quien lea «faltan cosas» seguiria sin poder ver si alguna es suya.
    expect(SIN_ARCHIVO.map((una) => una.fila)).toEqual([
      '11',
      '12',
      '13',
      '14',
      '18',
      '19',
      '23',
      '25',
      '26',
      '28',
    ]);
  });

  it('las diez son de acto propio de la municipalidad: D-02b o D-02c, ninguna otra', () => {
    expect([...new Set(SIN_ARCHIVO.map((una) => una.parte))].sort()).toEqual(['D-02b', 'D-02c']);
  });

  it('ninguna esta sin describir', () => {
    expect(SIN_ARCHIVO.filter((una) => una.que.trim() === '')).toEqual([]);
  });
});

describe('las cuatro decisiones, y que NO estan todas igual', () => {
  it('tres abiertas y una cerrada', () => {
    expect(DECISIONES).toHaveLength(4);
    expect(cuantasAbiertas()).toBe(3);
  });

  it('D-02b, D-02c y D-03d siguen abiertas', () => {
    const abiertas = DECISIONES.filter((una) => una.abierta).map((una) => una.id);

    expect(abiertas).toEqual(['D-02b', 'D-02c', 'D-03d']);
  });

  it('D-11 es la unica cerrada, y su estado dice PARA QUE ejercicio', () => {
    const d11 = DECISIONES.find((una) => una.id === 'D-11');

    expect(d11?.abierta).toBe(false);
    expect(
      d11?.estado,
      'Con «Cerrada» a secas, quien selle 2027 dara por bueno un fundamento que nadie ha\n' +
        'comprobado para 2027 — y el valor neutro del «% actualizacion» es cero, no uno, asi\n' +
        'que equivocarse ahi no deja una cifra rara: deja una cifra creible y equivocada.',
    ).toBe(`Cerrada para ${String(SELLO_DE_2026.ejercicio)}`);
    expect(d11?.detalle).toContain('no se hereda');
  });

  it('y los tonos no son todos el mismo: D-03d no bloquea el sello', () => {
    // `bad` -> `mal` y `warn` -> `atencion`, los de `const DECISIONES` del artboard.
    expect(DECISIONES.map((una) => una.tono)).toEqual(['mal', 'mal', 'ok', 'atencion']);
  });

  it('las dos que bloquean el sello son las mismas que dejan filas sin archivo', () => {
    const conFilas = [...new Set(SIN_ARCHIVO.map((una) => una.parte))].sort();
    const bloquean = DECISIONES.filter(
      (una) => una.abierta && filasSinArchivoDe(una.id) > 0,
    ).map((una) => una.id);

    expect(bloquean).toEqual(conFilas);
  });
});

describe('la composicion del sello de 2026', () => {
  it('los detalles son las filas mas los cuadros: 33 + 2 = 35', () => {
    // `ElEjercicio2026SeSellaTest` afirma `isEqualTo(35)` sobre los detalles compuestos, y es
    // la misma cifra de `CLAUDE.md:24`. Aqui se comprueba que las tres cuadran entre si.
    expect(SELLO_DE_2026.detalles).toBe(SELLO_DE_2026.filasDelCorpus + SELLO_DE_2026.cuadros);
    expect(SELLO_DE_2026.detalles).toBe(35);
  });

  it('y las filas declaradas son las que el conjunto sellado PUBLICA, no una cuenta a mano', () => {
    // Esta es la que impide que la cifra se quede atras: si el corpus creciera y la declaracion
    // no, aqui sale rojo. Se pide por HTTP, con el cliente de verdad y la ruta del contrato.
    return pedirSnapshot(2, AMBITOS[0]).then((servido) => {
      expect(servido.recurso.parametros).toHaveLength(SELLO_DE_2026.filasDelCorpus);
    });
  });
});
