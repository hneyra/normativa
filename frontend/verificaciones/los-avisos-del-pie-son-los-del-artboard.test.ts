// @vitest-environment node
//
// Lee el artboard del disco. No es un DOM lo que necesita.

import { TEXTOS_DEL_ARMAZON } from '@kamayuk/shell';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { AVISOS_DEL_PIE, TEXTOS_DEL_PIE } from '../src/pantallas/avisos.ts';
import { TEXTOS_DEL_MARCO } from '../src/i18n/armazon.ts';
import { artboardDeclarado, rutaDe, type Artboard } from './artboards.ts';

/**
 * **Los dos avisos del pie son los que V8 escribe** (#58, AC 7).
 *
 * <h2>Por que esto merece una guarda propia</h2>
 *
 * Porque son las dos frases que dicen **lo que el boton de al lado implica** —«nada se escribe hasta
 * que pulse Guardar»— y son las mas faciles de reescribir «para que suene mejor». Una vez
 * reescritas, la pantalla sigue funcionando y el contrato que el usuario leyo ya no es el que la
 * pantalla cumple.
 *
 * Y hay un motivo mas, de estructura: `@kamayuk/shell` trae unos avisos **neutros**, porque esta
 * destinado a los cuatro sistemas y alli no puede decir «conjunto sellado». Los de V8 viven en
 * `normativa`. Ese reparto solo se sostiene si alguien comprueba que los de aqui siguen siendo los
 * del artboard — si no, la separacion se convierte en dos textos que divergen.
 *
 * <h2>Y por que se comprueba ademas que llegan al marco</h2>
 *
 * Porque el pie **no lo dibuja el interprete**: lo dibuja `avisoDelPie(destino, textos)` de
 * `@kamayuk/shell`, con lo que el sistema le pase en `textos`. Un `AVISOS_DEL_PIE` perfecto que no
 * estuviera enchufado dejaria la pantalla diciendo el de la libreria —«Los datos son los que
 * figuran a la fecha de hoy», que aqui es falso: lo sellado no cambia con la fecha— y esta guarda
 * seguiria en verde mirando una constante que no dibuja nadie.
 *
 * <h2>El artboard se lee dentro del `it`</h2>
 *
 * La de `rentas` lo lee en el cuerpo del modulo (`:36`). Aqui no: un artboard que falta pone roja
 * esta prueba nombrandolo, en vez de matarla durante la recoleccion (`rentas`#78).
 */

const NORMATIVA_V8 = (): Artboard => artboardDeclarado('NormativaV8.dc.html');

const fuente = (): string => readFileSync(rutaDe(NORMATIVA_V8()), 'utf8');

describe('los avisos del pie son los del artboard', () => {
  it('EL CENTINELA: el artboard se leyo entero, y es el artboard', () => {
    // Sin esto, un archivo vacio o truncado dejaria los `toContain` de abajo fallando por el motivo
    // equivocado —o pasando, si alguien los invirtiera—. El suelo sale de `artboards.ts` y no de un
    // numero escrito aqui.
    const suelo = NORMATIVA_V8().cuentas?.bytesAlMenos ?? 0;
    expect(suelo, '`artboards.ts` no declara el suelo de bytes').toBeGreaterThan(0);
    expect(fuente().length, 'el artboard vino vacio').toBeGreaterThan(suelo);
    expect(fuente(), 'no parece el artboard').toContain('const PANTALLAS');
    expect(Object.values(AVISOS_DEL_PIE).length, 'no hay avisos que comprobar').toBe(2);
  });

  it('el de consulta y el de escritura estan escritos IGUAL que en V8', () => {
    for (const aviso of Object.values(AVISOS_DEL_PIE)) {
      expect(
        fuente().includes(aviso),
        `El artboard no dice «${aviso}».\n` +
          '  Estas dos frases dicen lo que el boton de al lado implica. Si el cambio es deliberado,\n' +
          '  entra primero en el artboard y de ahi se copia — no al reves.',
      ).toBe(true);
    }
  });

  it('y llegan al marco: son los `textos` que el `Armazon` recibe', () => {
    // La mitad que la de `rentas` no tiene, y la que impide que esto vigile una constante muerta.
    expect(
      TEXTOS_DEL_MARCO?.nadaSeEscribeTodavia,
      '`src/i18n/armazon.ts` no le pasa al marco el aviso de escritura del artboard',
    ).toBe(AVISOS_DEL_PIE.escritura);
    expect(
      TEXTOS_DEL_MARCO?.datosDeHoy,
      '`src/i18n/armazon.ts` no le pasa al marco el aviso de consulta del artboard',
    ).toBe(AVISOS_DEL_PIE.consulta);
    // Y solo esas dos: copiar aqui las treinta y una del marco seria una segunda fuente de verdad
    // que se queda vieja en silencio la primera vez que la libreria corrija una.
    expect(Object.keys(TEXTOS_DEL_PIE)).toEqual(['nadaSeEscribeTodavia', 'datosDeHoy']);
  });

  it('y el de consulta NO es el de la libreria: es la diferencia que justifica el archivo', () => {
    // Medido, no supuesto. El de escritura coincide byte a byte con el de `@kamayuk/shell`; el de
    // consulta no, y ese es el motivo por el que `src/pantallas/avisos.ts` existe. El dia que la
    // libreria adopte esta frase, esta prueba sale roja y hay que venir a decidir si el archivo
    // sigue haciendo falta — en vez de dejarlo como una copia que nadie sabe por que esta.
    expect(TEXTOS_DEL_ARMAZON.nadaSeEscribeTodavia).toBe(AVISOS_DEL_PIE.escritura);
    expect(
      TEXTOS_DEL_ARMAZON.datosDeHoy,
      'La libreria ya dice lo mismo que el artboard para una hoja de consulta. Si es asi, este\n' +
        'archivo dejo de aportar y la costura puede volver a no pasar nada.',
    ).not.toBe(AVISOS_DEL_PIE.consulta);
  });
});
