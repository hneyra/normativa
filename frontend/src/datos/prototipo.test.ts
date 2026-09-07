import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CUADROS,
  DEPRECIACIONES,
  EDICIONES,
  ETAGS_DE_EJEMPLO,
  PARAMETROS,
  SIN_VALOR,
  VALORES_REFERENCIALES,
  VALORES_UNITARIOS,
  edicionVigente,
} from './prototipo.ts';

/**
 * La captura esta ENTERA, y **cada cifra esta en el corpus**.
 *
 * <h2>Por que aqui se puede comprobar mas que en `rentas`</h2>
 *
 * `rentas` comprueba que su captura no se haya recortado a una muestra, y no puede hacer mas:
 * las cifras de su artboard salen de un prototipo y no hay contra que cotejarlas. **Aqui si lo
 * hay.** El corpus vive en este mismo repositorio, verificado a doble firma (ADR-0007), asi que
 * la pregunta deja de ser «esta entera la copia» y pasa a ser **«es la cifra que la norma
 * fija»** — que es la unica que importa en el sistema cuyo trabajo es exactamente esa.
 *
 * Se cotejan las tres fuentes:
 *
 *   · `publicacion/parametros-2026.csv`                        — las 33 filas
 *   · `fuentes/valores-unitarios-2026/…-costa-2026.csv`         — las 24 celdas
 *   · `fuentes/depreciacion-rnt-2016/depreciacion.csv`          — 14 de 492
 *   · `fuentes/tvr-2026/tvr-2026.csv`                           — 10 de 54 129
 *
 * <h2>Y lo que el cotejo destapo, que no se sabia antes de hacerlo</h2>
 *
 * **El artboard ABREVIA la prosa del corpus.** Las cinco columnas de identidad y de cifra
 * —tipo, clave, valor numerico y las dos vigencias— coinciden en las **33** filas, letra por
 * letra. Pero `documento_fuente` difiere en **24** de 33 —«TUO LTM (D.S. 156-2004-EF), art. 13»
 * donde el corpus dice «TUO de la Ley de Tributación Municipal (D.S. 156-2004-EF), artículo
 * 13»— y `valor_texto` en **4**. Nunca al reves: la del artboard **nunca es mas larga**, o sea
 * que es un recorte para dibujar y no otro hecho.
 *
 * Se deja como esta, y se prueba en esa forma, porque `prototipo.ts` es la captura **del
 * artboard** (AC6) y no del corpus. Lo que la prueba impide es que el recorte deje de ser un
 * recorte: si un dia el artboard dijera una fuente **mas larga** que la del corpus, o una cifra
 * distinta, esto sale rojo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(AQUI, '../../../docs/10-negocio/valores-normativos');

/** Lee un CSV del corpus: sin sus comentarios `#`, sin `\r` y con su cabecera por clave. */
function csv(ruta: string): readonly Record<string, string>[] {
  const lineas = readFileSync(join(CORPUS, ruta), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l !== '' && !l.startsWith('#'));
  const cabecera = partir(lineas[0]!);
  return lineas.slice(1).map((linea) => {
    const celdas = partir(linea);
    return Object.fromEntries(cabecera.map((nombre, i) => [nombre, celdas[i] ?? '']));
  });
}

/** Parte una linea de CSV respetando las comillas: `valor_texto` lleva comas y punto y coma. */
function partir(linea: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const letra = linea[i];
    if (letra === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
        continue;
      }
      entreComillas = !entreComillas;
      continue;
    }
    if (letra === ',' && !entreComillas) {
      celdas.push(actual);
      actual = '';
      continue;
    }
    actual += letra ?? '';
  }
  celdas.push(actual);
  return celdas;
}

describe('las 33 filas de parametros son las del corpus', () => {
  const corpus = csv('publicacion/parametros-2026.csv');

  it('son 33 aqui y 33 alli', () => {
    expect(PARAMETROS).toHaveLength(33);
    expect(corpus).toHaveLength(33);
  });

  it('tipo, clave, valor numerico y las dos vigencias coinciden fila a fila y en orden', () => {
    const aqui = PARAMETROS.map((f) => [f[0], f[1], f[2], f[4], f[5]]);
    const alli = corpus.map((f) => [
      f.tipo!,
      f.clave!,
      f.valor_numerico!,
      f.vigencia_desde!,
      f.vigencia_hasta!,
    ]);
    // Esto es lo que hace que el proxy no publique una cifra normativa inventada: las cinco
    // columnas que identifican la fila y la cifra que lleva salen del derivado firmado.
    expect(aqui).toEqual(alli);
  });

  it('y la UIT vigente en 2026 es la del D.S. que la fija, no una parecida', () => {
    const uit = PARAMETROS.filter((f) => f[0] === 'UIT');
    expect(uit).toHaveLength(5);
    const deDosMilVeintiseis = uit.find((f) => f[4] === '2026-01-01');
    expect(deDosMilVeintiseis?.[2]).toBe(corpus.find((f) => f.vigencia_desde === '2026-01-01' && f.tipo === 'UIT')?.valor_numerico);
    expect(deDosMilVeintiseis?.[6]).toContain('301-2025-EF');
  });

  it('la prosa del artboard es un RECORTE del corpus, y nunca otra cosa', () => {
    let fuentesDistintas = 0;
    let textosDistintos = 0;
    PARAMETROS.forEach((fila, i) => {
      const delCorpus = corpus[i]!;
      if (fila[6] !== delCorpus.documento_fuente) fuentesDistintas += 1;
      if (fila[3] !== delCorpus.valor_texto) textosDistintos += 1;
      // Lo que no puede pasar nunca: que el artboard diga MAS que el corpus. Eso ya no seria
      // un recorte para dibujar, seria una afirmacion sobre la norma que nadie firmo.
      expect(fila[6].length).toBeLessThanOrEqual((delCorpus.documento_fuente ?? '').length);
      expect(fila[3].length).toBeLessThanOrEqual((delCorpus.valor_texto ?? '').length);
    });
    expect(fuentesDistintas).toBe(24);
    expect(textosDistintos).toBe(4);
  });
});

describe('los tres cuadros nacionales son los del corpus', () => {
  it('las 24 celdas del Anexo I.2 (Costa), enteras y en orden', () => {
    const corpus = csv('fuentes/valores-unitarios-2026/valores-unitarios-costa-2026.csv');
    expect(VALORES_UNITARIOS).toHaveLength(24);
    expect(corpus).toHaveLength(24);

    const aqui = VALORES_UNITARIOS.map((f) => [f[0], f[1], f[2], f[3] === SIN_VALOR ? '' : f[3], f[4]]);
    const alli = corpus.map((f) => [
      f.partida!,
      f.categoria!,
      f.anio_construccion_desde!,
      f.anio_construccion_hasta!,
      f.valor_m2!,
    ]);
    expect(aqui).toEqual(alli);
  });

  it('las 14 filas de depreciacion existen en las 492 del RNT, con su porcentaje', () => {
    const corpus = csv('fuentes/depreciacion-rnt-2016/depreciacion.csv');
    expect(corpus).toHaveLength(492);
    expect(DEPRECIACIONES).toHaveLength(14);

    const porLlave = new Map(
      corpus.map((f) => [
        `${f.tabla!}|${f.material!}|${f.estado_conservacion!}|${f.antiguedad_hasta!}`,
        f.porcentaje!,
      ]),
    );
    for (const fila of DEPRECIACIONES) {
      const hasta = fila[3] === SIN_VALOR ? '' : fila[3];
      expect(
        porLlave.get(`${fila[0]}|${fila[1]}|${fila[2]}|${hasta}`),
        `La fila ${fila.join(', ')} no esta en depreciacion.csv.`,
      ).toBe(fila[4]);
    }
  });

  it('y el TRAMO ABIERTO esta entre las catorce, que es la que hace falta probar', () => {
    // «Mas de 50 anios»: `antiguedadHasta` nulo. Leerlo como cero convierte el tramo que todo
    // lo cubre en uno que no cubre nada, y sin ningun error de por medio.
    const abierto = DEPRECIACIONES.filter((f) => f[3] === SIN_VALOR);
    expect(abierto).toHaveLength(1);
    expect(abierto[0]?.[4]).toBe('27');
  });

  it('las 10 filas del anexo del MEF existen en sus 18 043 lineas', () => {
    const corpus = csv('fuentes/tvr-2026/tvr-2026.csv');
    expect(corpus).toHaveLength(18043);
    // 18 043 lineas por tres anios de fabricacion: las 54 129 filas que el artboard declara.
    expect(corpus.length * 3).toBe(CUADROS.find((c) => c.id === 'referenciales')?.filasDelCorpus);
    expect(VALORES_REFERENCIALES).toHaveLength(10);

    for (const fila of VALORES_REFERENCIALES) {
      const [, categoria, marca, modelo, anio, importe] = fila;
      const delCorpus = corpus.find(
        (f) => f.categoria === categoria && f.marca === marca && f.modelo_2026 === modelo,
      );
      expect(delCorpus, `«${categoria} ${marca} ${modelo}» no esta en tvr-2026.csv.`).toBeDefined();
      // El anexo publica el valor sin decimales —«18,000»— y el artboard los dibuja. Es la
      // unica transformacion, y se comprueba en vez de darla por buena.
      expect(`${delCorpus?.[`valor_${anio}`] ?? ''}.00`).toBe(importe);
    }
  });
});

describe('las tres ediciones del conjunto, y lo que el artboard dice de ellas', () => {
  it('son tres: 2027 abierta, y las dos versiones selladas de 2026', () => {
    expect(EDICIONES.map((e) => `${String(e.ejercicio)}v${String(e.version)} ${e.estado}`)).toEqual([
      '2027v1 ABIERTO',
      '2026v2 SELLADO',
      '2026v1 SELLADO',
    ]);
  });

  it('la vigente es la ultima version sellada, como hace selladoVigenteDe', () => {
    expect(edicionVigente().id).toBe(2);
    expect(edicionVigente().version).toBe(2);
  });

  it('la abierta no tiene ni un parametro, que es lo que impide sellarla', () => {
    const abierta = EDICIONES.find((e) => e.estado === 'ABIERTO');
    expect(abierta?.parametros).toBe(0);
  });

  it('las tres ediciones de cuadro llevan su sha256 de 64 hexadecimales y su doble firma', () => {
    expect(CUADROS).toHaveLength(3);
    for (const cuadro of CUADROS) {
      expect(cuadro.sha256).toMatch(/^[0-9a-f]{64}$/);
      const [transcribio, verifico] = cuadro.firmas.split(' · ');
      // ADR-0007: dos personas distintas responden por una cifra normativa.
      expect(transcribio).not.toBe(verifico);
    }
  });
});

describe('los ETag capturados son de EJEMPLO, y el proxy no los sirve', () => {
  it('son cuatro, con la forma correcta', () => {
    const valores = Object.values(ETAGS_DE_EJEMPLO);
    expect(valores).toHaveLength(4);
    for (const etag of valores) expect(etag).toMatch(/^[0-9a-f]{64}$/);
  });

  it('y ninguno aparece en lo que sirve el proxy: la huella se calcula', async () => {
    // Si el proxy los sirviera, el cliente los recalcularia y ninguno cuadraria — que es
    // exactamente el error que AC10 existe para dar, pero por el motivo equivocado.
    const { OPERACIONES } = await import('./operaciones.ts');
    const servido = JSON.stringify(OPERACIONES.map((o) => o.cuerpo()));
    for (const etag of Object.values(ETAGS_DE_EJEMPLO)) {
      expect(servido).not.toContain(etag);
    }
  });
});

describe('el aviso sobre los literales tributarios sigue escrito (regla 5)', () => {
  const fuente = readFileSync(join(AQUI, 'prototipo.ts'), 'utf8');

  it.each([
    ['la regla que los prohibe', 'regla 5'],
    ['las tres clases de cifra que trae la captura', 'UIT'],
    ['que llegan de la API el dia que conecte', 'llegan de la API'],
    ['y que este archivo se borra, no se actualiza', 'se borra entero'],
  ])('dice %s', (_que, texto) => {
    expect(
      fuente,
      'Se borro el aviso de la regla 5 del encabezado de prototipo.ts.\n' +
        'Es lo unico que dice que la UIT, los tramos y las alicuotas de este archivo NO se\n' +
        'quedan. Sin el, en seis meses son una tabla de constantes tributarias en el codigo —\n' +
        'y publicada por el repositorio que existe para que no las haya.',
    ).toContain(texto);
  });
});
