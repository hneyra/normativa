// Corre en jsdom —el entorno por omision— y no en `node`, por lo mismo que
// `el-nulo-no-es-un-cero.test.ts`: importa el conector, que arrastra `src/api/cliente.ts` ->
// `src/sesion.ts`, y ahi hay un `window.location.origin` de nivel de modulo.
//
// Y `fileURLToPath(import.meta.url)` funciona aqui, como en `el-locale-esta-completo.test.ts`.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AMBITOS } from '../src/datos/lecturas.ts';
import { CONSUMIDORES, OPERACIONES_CONSUMIDAS } from '../src/datos/publicacion.ts';
import { ARBOL } from '../src/pantallas/arbol.ts';

/**
 * **La tabla «Quien se lo lleva» es DATO CON PROCEDENCIA, no una lista escrita a ojo** (#67, AC 9).
 *
 * <h2>Que problema resuelve</h2>
 *
 * Esa tabla es lo que convierte «publicamos un JSON» en «esto es lo que se rompe si cambia». Escrita
 * a mano, su modo de fallo es silencioso en las dos direcciones:
 *
 * · un sistema que **empieza** a consumir el snapshot —y que por tanto ya tiene su
 *   `ContratoCon*Test` en este backend— no sale en la pantalla, y quien decide cambiar un campo no
 *   lo ve;
 * · un sistema que **deja** de consumirlo se queda en la tabla para siempre, y al reves: se
 *   protege un campo por un consumidor que ya no existe.
 *
 * Ninguna de las dos da error. Esta guarda las convierte en rojo.
 *
 * <h2>La procedencia, y por que es ESA</h2>
 *
 * Los `ContratoCon{Rentas,Catastro}Test` de `kamayuk-normativa-aplicacion` son la **comprobacion de
 * verdad**: cada uno declara su `consumidor()` y cruza lo que este backend publica contra el
 * `contratos-que-consume/normativa.json` que ese sistema mantiene (ADR-0030 §4). Un consumidor sin
 * su prueba aqui no esta protegido por nada, y una prueba aqui es exactamente la evidencia de que
 * ese sistema consume esto.
 *
 * No se lee el JSON del otro repositorio a proposito: no esta en este arbol, y una guarda que
 * dependa de que el clon hermano este clonado se apaga sola el dia que no lo esta — que es todos los
 * dias en la CI de este repositorio.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../..');
const VERIFICACIONES_DEL_BACKEND = join(
  RAIZ,
  'backend/kamayuk-normativa-aplicacion/src/test/java/kamayuk/normativa/verificaciones',
);

/** Lo que cada `ContratoCon*Test.java` declara como consumidor, leido de su `return`. */
function consumidoresDelBackend(): readonly string[] {
  const nombres = readdirSync(VERIFICACIONES_DEL_BACKEND).filter(
    (nombre) => /^ContratoCon\w+Test\.java$/.test(nombre),
  );
  return nombres
    .flatMap((nombre) => {
      const texto = readFileSync(join(VERIFICACIONES_DEL_BACKEND, nombre), 'utf8');
      // `protected String consumidor() { return "rentas"; }`, con el formato que da Spotless.
      const encontrado = /String consumidor\(\)\s*\{\s*return\s+"([^"]+)"/.exec(texto);
      return encontrado?.[1] === undefined ? [] : [encontrado[1]];
    })
    .sort();
}

describe('los consumidores que la hoja dibuja son los que el backend protege', () => {
  it('EL CENTINELA: los `ContratoCon*Test` se leen y declaran su consumidor', () => {
    // Sin esto, un directorio movido o un formato distinto dejarian la lista vacia y la comparacion
    // de abajo pasaria comparando nada con nada — en verde, que es como una guarda se queda sin
    // sujeto sin que nadie la borre.
    const delBackend = consumidoresDelBackend();
    expect(
      delBackend.length,
      `No se leyo ni un «ContratoCon*Test.java» en ${VERIFICACIONES_DEL_BACKEND}.\n` +
        '  O el directorio se movio, o esas pruebas dejaron de declarar su `consumidor()`. En los\n' +
        '  dos casos la tabla de la hoja se queda sin procedencia.',
    ).toBeGreaterThan(0);
    expect(CONSUMIDORES.length, '`CONSUMIDORES` esta vacia').toBeGreaterThan(0);
  });

  it('los sistemas de la tabla son EXACTAMENTE los que declaran un contrato', () => {
    const delBackend = consumidoresDelBackend();
    const deLaTabla = [...new Set(CONSUMIDORES.map((consumidor) => consumidor.sistema))].sort();

    expect(
      deLaTabla,
      'La tabla «Quien se lo lleva» dejo de cuadrar con los `ContratoCon*Test` del backend.\n' +
        `  El backend protege: ${delBackend.join(', ')}\n` +
        `  La tabla dibuja:    ${deLaTabla.join(', ')}\n\n` +
        '  Un consumidor de mas protege un campo por alguien que ya no lo pide; uno de menos deja a\n' +
        '  quien cambia el JSON sin saber a quien rompe. Ninguna de las dos da error sola.',
    ).toEqual(delBackend);
  });

  it('y cada fila pide un ambito DE LOS QUE EXISTEN, con su cuando y su que hace', () => {
    // Un ambito inventado en una celda seria una instruccion falsa: dice que poner en `?ambito=`.
    const malas = CONSUMIDORES.filter(
      (consumidor) =>
        !AMBITOS.includes(consumidor.ambito) ||
        consumidor.cuando.trim() === '' ||
        consumidor.queHace.trim() === '',
    ).map((consumidor) => `  ${consumidor.sistema} · ${consumidor.ambito}`);

    expect(malas, `Hay filas de consumidor incompletas o con un ambito que no existe:\n${malas.join('\n')}`).toEqual(
      [],
    );
    // Y no hay dos filas iguales: la clave de React de esa tabla es `sistema-ambito`, y dos filas
    // con la misma clave se dibujan como una.
    const claves = CONSUMIDORES.map((c) => `${c.sistema}-${c.ambito}`);
    expect(new Set(claves).size, 'hay dos filas de consumidor con la misma clave').toBe(claves.length);
  });

  it('las dos operaciones consumidas son las que la HOJA declara en el arbol', () => {
    // La otra mitad: lo que los consumidores piden tiene que ser lo que esta hoja dice servir. Si
    // divergieran, la nota de la tabla estaria nombrando operaciones que esta pantalla no toca.
    const deLaHoja = ARBOL.flatMap((modulo) =>
      modulo.hojas
        .filter((hoja) => hoja.clave === 'nor-publicacion')
        .flatMap((hoja) => hoja.operaciones.map((o) => `${o.verbo} ${o.ruta}`)),
    ).sort();

    expect(deLaHoja, 'la hoja de Publicacion dejo de declarar sus dos operaciones').toHaveLength(2);
    expect([...OPERACIONES_CONSUMIDAS].sort()).toEqual(deLaHoja);
  });
});
