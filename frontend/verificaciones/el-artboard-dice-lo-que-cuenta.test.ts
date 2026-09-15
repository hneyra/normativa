// @vitest-environment node
//
// Lee el artboard V8 y cuenta. No es un DOM lo que necesita.

import { describe, expect, it } from 'vitest';

import {
  DECIDIDO_EN_G2,
  artboardDeclarado,
  type Artboard,
  type CuentasDelArtboardV8,
} from './artboards.ts';
import {
  artboardV8,
  bloquesDelArtboard,
  esDeSoloLectura,
  hojasDelArtboard,
} from './artboard-v8.ts';

/**
 * **`NormativaV8.dc.html` dice exactamente lo que `artboards.ts` cuenta de el** (hneyra/normativa#52).
 *
 * <h2>Por que cuentas EXACTAS, y no «mas de cero»</h2>
 *
 * Porque el artboard es contra lo que hneyra/normativa#58 reconstruye las pantallas, y un bloque
 * que aparece o desaparece sin que nadie lo diga es una pantalla que cambia sin decision. «Mas de
 * cero» no veria perder la mitad. Las cuentas viven en `artboards.ts` como dato —no aqui, que es
 * lo que no se podia calcar de `rentas`, donde van escritas en la prueba con los numeros de
 * `rentas`—, y el rojo dice **cual** se movio y **los dos numeros**.
 *
 * <h2>Y lo que no puede seguir en el archivo</h2>
 *
 * El artboard se derivo de `RentasV8.dc.html@ac379ac`, y el texto de `rentas` fuera de las
 * constantes —el escudo, el titulo de la barra, la cuenta, los avisos, «de 40 destinos», la regex
 * de tono…— es justo lo que se cuela sin que nadie lo vea: no rompe ninguna cuenta y el lienzo se
 * sigue pintando. Se busca literal, frase a frase, y cada una se comprobo presente en
 * `RentasV8.dc.html@ac379ac` al escribir esta lista: una frase que el original no tuviera seria
 * una busqueda que no puede fallar.
 *
 * <h2>Y lo que decidio G2 (hneyra/normativa#76)</h2>
 *
 * El titulo de la barra y el icono del modulo eran propuestas en #52 y hoy son decisiones. Una
 * decision que el artboard puede perder sin que nada lo diga no esta tomada: se compara contra
 * `DECIDIDO_EN_G2`, que dice de donde sale cada cosa. Los marcadores de sesion los vigila
 * `lo-que-viaja-no-lleva-cifras`, que es la guarda de lo que viaja; el tono de D-03d,
 * `los-ejemplos-son-los-de-la-v6`, que es la que compara con la V6.
 */

/** El artboard que se comprueba. Se busca dentro de cada `it`: si no esta declarado, rojo alli. */
const v8 = (): Artboard => artboardDeclarado('NormativaV8.dc.html');

/** Las cuentas declaradas. Sin ellas no hay contra que comparar. */
function cuentasDeclaradas(): CuentasDelArtboardV8 {
  const cuentas = v8().cuentas;
  if (cuentas === undefined) {
    throw new Error(
      '`NormativaV8.dc.html` no lleva `cuentas` en `artboards.ts`: son el unico sitio donde viven.',
    );
  }
  return cuentas;
}

/** Lo que el artboard declara hoy, contado sobre el. */
function contar(artboard: Artboard): Omit<CuentasDelArtboardV8, 'bytesAlMenos'> {
  const { arbol, pantallas, instrucciones } = artboardV8(artboard);
  const bloques = bloquesDelArtboard(artboard);
  const campos = bloques.flatMap((b) => b[2]);
  return {
    modulos: arbol.length,
    hojas: hojasDelArtboard(artboard).length,
    pantallas: Object.keys(pantallas).length,
    instrucciones: Object.keys(instrucciones).length,
    bloques: bloques.length,
    campos: campos.length,
    camposDeSoloLectura: campos.filter(esDeSoloLectura).length,
    tablas: bloques.filter((b) => b.length === 4).length,
  };
}

/**
 * Las frases propias de `rentas` que el artboard derivado ya no puede llevar.
 *
 * Una por sitio de `RentasV8.dc.html@ac379ac` que el issue nombra en «Lo medido», con su linea alli.
 */
const DE_RENTAS: readonly (readonly [frase: string, dondeEnRentas: string])[] = [
  ['rentas-tokens.css', ':12, la hoja de tokens enlazada'],
  ['escudo-catacaos.png', ':40, el escudo de la barra'],
  ['Sistema de Rentas y Tributos', ':42, el titulo de la barra'],
  ['J. Cárdenas Vega', ':67, la cuenta de la barra'],
  ['Rentas · ventanilla', ':68, el papel de la cuenta'],
  ['10 módulos × 4 submódulos', ':122, el comentario del arbol'],
  ['frontend/src/estilos/tokens/colors.css', ':334, de donde salen los tokens'],
  ['frontend/src/marco/arbol.ts', ':374 y :396, el arbol de la V6 de rentas'],
  ['RentasV8 — el marco de V6/V7', ':392, la cabecera'],
  ['EndpointsPublicados', ':413, el prefijo de rentas'],
  ['Rentas · Registro', ':410, PROPIO'],
  ['/rentas/api/v1', ':415, RAIZ'],
  ['Las cuarenta pantallas', ':647, el comentario de PANTALLAS'],
  ['src/api/proxy.ts', ':1135, el REPARTO de la V6 de rentas'],
  ["dest: 'panel'", ':1141, el estado inicial'],
  ['coactiva|observado|vencida|denegado', ':1267, la regex de tono'],
  ['con deuda|por vencer|en trámite', ':1268, la regex de tono'],
  ['3 avisos: emisión observada', ':1420, el aviso de la campana'],
  ['de 40 destinos', ':1439, el pie de la paleta'],
  ['Diez módulos y cuarenta submódulos', ':1457, el pie del arbol'],
  ['Catastro y Tesorería', ':398 y :1457, los modulos de otros sistemas'],
  ['en el padrón a la fecha de hoy', ':1516, el aviso de una pantalla de solo lectura'],
  ['Exportaría esta pantalla a Excel', ':1530, el toast de exportar'],
  ['su pantalla vive en src/secciones', ':1550, la nota de la vista'],
  ['Api.RAIZ medido en las verificaciones', ':1566, la nota de las operaciones'],
];

describe('el artboard V8 dice lo que artboards.ts cuenta de el', () => {
  it('EL CENTINELA: la extraccion trae modulos, hojas, pantallas y bloques', () => {
    // Sin esto, un cambio de formato dejaria los literales vacios y las comparaciones de abajo
    // compararian cero con cero. Las cuentas exactas lo verian igual, pero este rojo dice QUE paso
    // en vez de dar ocho discrepancias.
    const contado = contar(v8());
    expect(contado.modulos, 'el artboard no declaro ni un modulo').toBeGreaterThan(0);
    expect(contado.hojas, 'el artboard no declaro ni una hoja').toBeGreaterThan(0);
    expect(contado.pantallas, 'el artboard no declaro ni una pantalla').toBeGreaterThan(0);
    expect(contado.bloques, 'las pantallas no traen ni un bloque').toBeGreaterThan(0);
  });

  it('la extraccion trae EXACTAMENTE las cuentas declaradas', () => {
    const declaradas = cuentasDeclaradas();
    const contado = contar(v8());
    const discrepancias = (Object.keys(contado) as (keyof typeof contado)[])
      .filter((cuenta) => contado[cuenta] !== declaradas[cuenta])
      .map(
        (cuenta) =>
          `  ${cuenta}: artboards.ts dice ${String(declaradas[cuenta])} y el artboard trae ${String(contado[cuenta])}`,
      );

    expect(
      discrepancias,
      'El artboard V8 dejo de decir lo que `artboards.ts` cuenta de el:\n' +
        `${discrepancias.join('\n')}\n\n` +
        '  Si el cambio es deliberado, las cuentas se actualizan en el MISMO PR que el artboard, y\n' +
        '  el PR dice por que. Si no lo es, el artboard perdio o gano algo sin decision.',
    ).toEqual([]);
  });

  it('y pesa al menos lo que declara: un artboard truncado no pasa', () => {
    const { html } = artboardV8(v8());
    expect(
      Buffer.byteLength(html, 'utf8'),
      `NormativaV8.dc.html pesa menos que el suelo de ${String(cuentasDeclaradas().bytesAlMenos)} bytes`,
    ).toBeGreaterThanOrEqual(cuentasDeclaradas().bytesAlMenos);
  });

  it('las claves de PANTALLAS e INSTRUCCIONES son las hojas del ARBOL, en su orden', () => {
    const artboard = v8();
    const claves = hojasDelArtboard(artboard).map((h) => h[0]);
    expect(claves.length, 'el arbol no trae hojas').toBeGreaterThan(0);
    expect(Object.keys(artboardV8(artboard).pantallas), 'PANTALLAS no son las hojas').toEqual(claves);
    expect(
      Object.keys(artboardV8(artboard).instrucciones),
      'INSTRUCCIONES no son las hojas',
    ).toEqual(claves);
  });

  it('PROPIO es «Normativa», RAIZ es «/normativa/api/v1», y el modulo se llama PROPIO', () => {
    const { propio, raiz, arbol } = artboardV8(v8());
    expect(propio).toBe('Normativa');
    expect(raiz).toBe('/normativa/api/v1');
    expect(arbol.map((m) => m[0])).toEqual(['Normativa']);
  });

  it('la barra lleva el titulo que decidio G2', () => {
    expect(
      artboardV8(v8()).barra.titulo,
      'El titulo de la barra no es el decidido en G2 (hneyra/normativa#52). Si se cambia por\n' +
        '  «SGRTM» porque dejo de caber, se cambia DECIDIDO_EN_G2 con la medida nueva.',
    ).toBe(DECIDIDO_EN_G2.titulo);
  });

  it('y el modulo se dibuja con los trazos de ICONOS.balanza, exactamente', () => {
    const { arbol } = artboardV8(v8());
    expect(arbol.length, 'el arbol no trae modulos').toBeGreaterThan(0);
    expect(
      arbol.map((m) => m[4]),
      'Los trazos del modulo no son los de `ICONOS.balanza` (G2). El catalogo de `rentas`\n' +
        '  (`rentas@ac379ac:frontend/src/catalogo.ts:51-56`) busca el icono por sus trazos exactos y\n' +
        '  lanza si no esta en ICONOS: un trazo que no es el de la libreria no se puede portar.',
    ).toEqual([DECIDIDO_EN_G2.trazosDelModulo]);
  });

  it('EL CENTINELA de la lista: el archivo se leyo y hay frases de rentas que buscar', () => {
    // Sin esto la busqueda de abajo pasaria sobre un texto vacio —ninguna frase esta en ''— o
    // sobre una lista vacia.
    const { html } = artboardV8(v8());
    expect(html, 'no se leyo el artboard: no trae su `const PROPIO`').toContain("const PROPIO = '");
    expect(DE_RENTAS.length).toBeGreaterThan(0);
  });

  it('y ninguna frase propia de rentas sigue en el archivo', () => {
    const { html } = artboardV8(v8());
    const siguen = DE_RENTAS.filter(([frase]) => html.includes(frase)).map(
      ([frase, donde]) => `  «${frase}» — RentasV8.dc.html${donde}`,
    );
    expect(
      siguen,
      'El artboard derivado sigue llevando texto de `rentas` fuera de las constantes:\n' +
        `${siguen.join('\n')}\n\n` +
        '  Se sustituye con el texto de la V6 (c01fe9a:frontend/src/, NormativaV6.dc.html) o se\n' +
        '  deja para G2 marcado como propuesta. No se deja el de otro sistema.',
    ).toEqual([]);
  });
});
