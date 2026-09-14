// @vitest-environment node
//
// Lee el artboard V8 y el Dockerfile, y compara texto. No es un DOM lo que necesita.

import { describe, expect, it } from 'vitest';

import {
  FORMAS_DE_CIFRA,
  artboardDeclarado,
  cadenasQueBuscaElDockerfile,
  type Artboard,
} from './artboards.ts';
import { artboardV8, ejemplosDe, loQueViaja, type CadenaDelArtboard } from './artboard-v8.ts';

/**
 * **Ninguna cifra del corpus en lo que el artboard V8 manda a `src/`** (hneyra/normativa#52, AC 3).
 *
 * <h2>Por que aqui y antes que en `src/`</h2>
 *
 * `normativa` existe para que las cifras normativas vivan en el corpus firmado a dos manos y se
 * PIDAN (regla 5, ADR-0007). La V6 lo cumplia con un proxy detras de una bandera y una negativa en
 * el `Dockerfile`; la reconstruccion lo cumple como `rentas` desde su #97: la definicion de una
 * pantalla lleva la FORMA, y los ejemplos se quedan en el artboard, que no se importa ni entra en
 * la imagen. Eso solo funciona si **el texto que se transcribe no lleva ya la cifra dentro**: una
 * nota que dijera «la UIT de 2026 es 5500.00» viajaria a `src/` como texto de interfaz y ninguna
 * guarda sobre los valores la veria. Esta es la que la ve, antes de que haya un `src/` que barrer
 * (hneyra/normativa#58 trae `sin-cifras-inventadas` sobre el codigo).
 *
 * <h2>Que ejemplos cuentan como inconfundibles, y cuales no</h2>
 *
 * Buscar TODOS los valores de ejemplo en el texto daria rojos sobre texto legitimo: el artboard
 * trae «—», «2», «5», «SELLADO», «VALUACION», «rentas», y la ayuda de la observacion dice «Al menos
 * 5 caracteres». Una guarda que da rojos sobre texto bueno se acaba desactivando. Se buscan los que
 * **no pueden ser otra cosa**: los que llevan un digito y al menos cuatro caracteres —una fecha, un
 * `sha256`, un documento fuente, `18,000.00`—, **salvo un año solo**, porque el ejercicio es una
 * opcion legitima de un desplegable (`ediciones.ts:134` de la V6) y no una cifra del corpus. Que el
 * ejercicio no se escriba como literal en `src/` es otra leccion, con otro dueño (hneyra/normativa#63,
 * #66 y #68).
 */

/** El artboard que se comprueba. Se busca dentro de cada `it`. */
const v8 = (): Artboard => artboardDeclarado('NormativaV8.dc.html');

/** Un año solo: `2026`. Ver el javadoc. */
const ANIO = /^\d{4}$/;

/** Un valor de ejemplo que no puede ser texto de interfaz. Ver el javadoc. */
const esInconfundible = (valor: string): boolean =>
  /\d/.test(valor) && valor.length >= 4 && !ANIO.test(valor);

/** Las palabras de un texto, sin la puntuacion que las rodea: «5500.00», → `5500.00`. */
const palabras = (texto: string): readonly string[] =>
  texto
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((p) => p !== '');

const enUnaLinea = (hallazgos: readonly string[]): string => hallazgos.join('\n');

describe('lo que el artboard V8 manda a src/ no lleva cifras del corpus', () => {
  it('EL CENTINELA: la extraccion trae las pantallas, texto que viaja y valores de ejemplo', () => {
    // Sin esto, un cambio de formato dejaria las dos listas vacias y las tres comprobaciones de
    // abajo pasarian en verde buscando en la nada.
    const artboard = v8();
    const pantallas = Object.keys(artboardV8(artboard).pantallas).length;
    expect(pantallas, 'la extraccion no trae las pantallas que artboards.ts cuenta').toBe(
      artboard.cuentas?.pantallas,
    );
    expect(loQueViaja(artboard).length, 'no se extrajo ni una cadena que viaje').toBeGreaterThan(0);
    expect(ejemplosDe(artboard).length, 'no se extrajo ni un valor de ejemplo').toBeGreaterThan(0);
    expect(
      ejemplosDe(artboard).filter((e) => esInconfundible(e.texto)).length,
      'ningun valor de ejemplo es inconfundible: la ultima comprobacion no buscaria nada',
    ).toBeGreaterThan(0);
  });

  it('ninguna cadena que viaja contiene una cifra con la forma del corpus', () => {
    const hallazgos = loQueViaja(v8()).flatMap(({ donde, texto }: CadenaDelArtboard) =>
      palabras(texto)
        .filter((palabra) => FORMAS_DE_CIFRA.some((forma) => forma.test(palabra)))
        .map((palabra) => `  ${donde}: «${palabra}» en «${texto}»`),
    );
    expect(
      hallazgos,
      'El texto que el artboard V8 manda a src/ lleva cifras con la forma del corpus:\n' +
        `${enUnaLinea(hallazgos)}\n\n` +
        '  Una cifra normativa vive en el conjunto sellado y se PIDE (regla 5, ADR-0007). En el\n' +
        '  artboard puede ir como EJEMPLO —el valor de un campo de solo lectura, una celda—, que no\n' +
        '  viaja; en un titulo, una nota, una etiqueta o una instruccion, no.',
    ).toEqual([]);
  });

  it('ni una de las cadenas que el Dockerfile busca en lo servido', () => {
    const buscadas = cadenasQueBuscaElDockerfile();
    expect(buscadas.length, 'el Dockerfile no busca ninguna cadena').toBeGreaterThan(0);
    const hallazgos = loQueViaja(v8()).flatMap(({ donde, texto }) =>
      buscadas.filter((cadena) => texto.includes(cadena)).map((cadena) => `  ${donde}: «${cadena}»`),
    );
    expect(
      hallazgos,
      'El texto que viaja lleva una cadena que el Dockerfile rechaza en lo servido:\n' +
        `${enUnaLinea(hallazgos)}\n\n` +
        '  Transcrita a src/, la imagen no se construiria. Es la misma propiedad, dicha antes.',
    ).toEqual([]);
  });

  it('ni un valor de ejemplo inconfundible del propio artboard', () => {
    const artboard = v8();
    const inconfundibles = [
      ...new Set(ejemplosDe(artboard).map((e) => e.texto).filter(esInconfundible)),
    ];
    const hallazgos = loQueViaja(artboard).flatMap(({ donde, texto }) =>
      inconfundibles
        .filter((valor) => texto.includes(valor))
        .map((valor) => `  ${donde}: «${valor}»`),
    );
    expect(
      hallazgos,
      'El texto que viaja repite un valor de ejemplo del artboard:\n' +
        `${enUnaLinea(hallazgos)}\n\n` +
        '  Un ejemplo que se escribe tambien en el texto deja de ser ejemplo: viaja a src/ y se\n' +
        '  lee como real. En un sistema de parametros eso es publicar una cifra sin firmas.',
    ).toEqual([]);
  });
});
