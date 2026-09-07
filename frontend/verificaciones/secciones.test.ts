import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Las barreras de las secciones (#15). Leen el CODIGO, no lo ejecutan.
 *
 * Lo que aqui se vigila no se puede ver montando un componente:
 *
 * <ol>
 *   <li><b>Que ninguna pantalla importe la captura del artboard.</b> Es lo que sostiene la
 *       medida del bundle de F-1 (AC9): `prototipo.ts` y `simulados.ts` entran en el paquete
 *       **solo** por el `import()` dinamico de `arranque.ts`, y con la bandera apagada Rollup se
 *       los lleva por delante. Una seccion que los importara estaticamente los devolveria al
 *       bundle de produccion —la UIT de cinco ejercicios, los tramos con sus alicuotas y filas de
 *       los tres cuadros nacionales— publicadas por el repositorio que existe para que las cifras
 *       vivan en el corpus firmado a dos manos, y **por un camino que no pasa por ninguna
 *       firma**. Un `yarn build` en verde no dice nada de esto: sigue construyendo.</li>
 *   <li><b>Que el desplazamiento horizontal sea de la tabla</b> (#15 AC8). jsdom no maqueta, asi
 *       que ninguna prueba de comportamiento puede ver un `overflow-x`. Lo que si se puede leer
 *       es quien lleva cada declaracion.</li>
 *   <li><b>Que la hoja de las secciones no escriba un color</b>: los colores son tokens, o el
 *       tema oscuro se queda a medias sin que nada lo diga.</li>
 * </ol>
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const SECCIONES = join(RAIZ, 'src/secciones');

/** Los fuentes de las secciones, sin sus pruebas. */
function fuentesDeSeccion(): readonly { readonly nombre: string; readonly texto: string }[] {
  return readdirSync(SECCIONES)
    .filter((nombre) => /\.tsx?$/.test(nombre) && !nombre.includes('.test.'))
    .map((nombre) => ({ nombre, texto: readFileSync(join(SECCIONES, nombre), 'utf8') }));
}

/** Un CSS sin comentarios: la hoja CITA lo que no usa, y una cita no es una declaracion. */
function sinComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** El cuerpo de la regla de ese selector, o `null`. */
function reglaDe(css: string, selector: string): string | null {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const encontrada = new RegExp(`(^|\\})\\s*${escapado}\\s*\\{([^}]*)\\}`, 'm').exec(
    sinComentarios(css),
  );
  return encontrada === null ? null : (encontrada[2] ?? null);
}

const hoja = readFileSync(join(RAIZ, 'src/estilos/secciones.css'), 'utf8');

describe('ninguna seccion importa la captura del artboard', () => {
  const fuentes = fuentesDeSeccion();

  it('hay secciones que mirar: la lista no esta vacia', () => {
    // Sin esto, borrar el directorio dejaria las tres comprobaciones de abajo en verde.
    expect(fuentes.map((f) => f.nombre)).toContain('Cuadros.tsx');
    expect(fuentes.map((f) => f.nombre)).toContain('Publicacion.tsx');
  });

  it.each(['datos/prototipo', 'datos/simulados'])(
    'ninguna importa «%s»: las cifras llegan por la API, siempre',
    (prohibido) => {
      // Se busca el IMPORT y no la mencion: los javadoc de este directorio nombran los dos
      // archivos justamente para decir que no se importan, y una prueba que cazara la mencion
      // obligaria a borrar la explicacion para pasar.
      const importa = new RegExp(`from\\s+'[^']*${prohibido}`);
      const culpables = fuentes
        .filter((fuente) => importa.test(fuente.texto))
        .map((fuente) => fuente.nombre);

      expect(
        culpables,
        `«${prohibido}» es la captura que el proxy usa para componer los cuerpos, y entra en el\n` +
          'bundle SOLO por el import() dinamico de arranque.ts. Una pantalla que lo importe lo\n' +
          'devuelve al paquete de produccion: la UIT, los tramos con sus alicuotas y filas de los\n' +
          'tres cuadros nacionales, publicadas sin ninguna de las dos firmas de ADR-0007.\n' +
          'La cifra se PIDE; no se importa.',
      ).toEqual([]);
    },
  );

  it('y tampoco el artboard, que es lo mismo por otro camino', () => {
    for (const fuente of fuentes) {
      expect(fuente.texto, `${fuente.nombre} lee el artboard.`).not.toMatch(
        /from\s+'[^']*NormativaV6/,
      );
    }
  });
});

describe('AC8 — el desplazamiento horizontal es de la tabla, no de la pagina', () => {
  it('el marco de la tabla lleva «overflow-x: auto»', () => {
    const marco = reglaDe(hoja, '.kn-tabla__marco');

    expect(marco, 'Falta la regla «.kn-tabla__marco» en secciones.css.').not.toBeNull();
    expect(marco).toMatch(/overflow-x:\s*auto/);
  });

  it('el marco NO lleva ancho minimo, y las tablas SI', () => {
    const marco = reglaDe(hoja, '.kn-tabla__marco') ?? '';

    // Un `min-width` en el marco es un `overflow` que nunca se activa: el marco crece con la
    // tabla y quien se desplaza es la pagina.
    expect(marco).toContain('min-width: 0');
    expect(marco).not.toMatch(/min-width:\s*[1-9]/);

    for (const variante of ['unitarios', 'depreciacion', 'referenciales', 'consumidores']) {
      const regla = reglaDe(hoja, `.kn-tabla--${variante}`);
      expect(regla, `Falta el ancho minimo de «.kn-tabla--${variante}».`).toMatch(
        /min-width:\s*\d+px/,
      );
    }
  });

  it('y la seccion no puede estirarse: sin «min-width: 0» el overflow no llega a activarse', () => {
    expect(reglaDe(hoja, '.kn-seccion')).toContain('min-width: 0');
    expect(reglaDe(hoja, '.kn-seccion__cuerpo')).toContain('min-width: 0');
  });

  it('la cabecera es pegajosa, que es lo que hace util una tabla larga', () => {
    expect(reglaDe(hoja, '.kn-tabla__th')).toMatch(/position:\s*sticky/);
  });

  it('las cifras van a la derecha y con «tabular-nums»', () => {
    const celda = reglaDe(hoja, '.kn-tabla__td--cifra');

    expect(celda).toMatch(/text-align:\s*right/);
    expect(celda).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(reglaDe(hoja, '.kn-tabla__th--cifra')).toMatch(/text-align:\s*right/);
  });

  it('la tabla se anuncia y dice si esta cargando', () => {
    const tabla = readFileSync(join(SECCIONES, 'Tabla.tsx'), 'utf8');

    expect(tabla).toContain('aria-label={rotulo}');
    expect(tabla).toContain('aria-busy={cargando}');
  });
});

describe('la hoja de las secciones no escribe un color', () => {
  it('ni un hexadecimal, ni un «rgb(»: todo sale de un token', () => {
    const declaraciones = sinComentarios(hoja);
    const colores = [...declaraciones.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((c) => c[0]);

    expect(
      colores,
      'Un hexadecimal escrito aqui no cambia con el tema: se queda claro sobre papel oscuro,\n' +
        'y ninguna prueba de contraste lo mira porque el catalogo mide TOKENS.',
    ).toEqual([]);
    expect(declaraciones).not.toMatch(/rgba?\(/);
  });

  it('y no usa «--tinta-4» como texto, que es la unica que no llega a 4.5:1', () => {
    expect(
      sinComentarios(hoja),
      '#93A3AF sobre papel blanco da 2.59:1 y WCAG 1.4.3 pide 4.5:1. Es el trazo de un icono\n' +
        'decorativo y nada mas; para texto va «--tinta-3», que da 5.51:1.',
    ).not.toContain('--tinta-4');
  });
});

describe('la hoja se encadena la ultima', () => {
  it('«estilos.css» la importa, y detras de la del marco', () => {
    const entrada = sinComentarios(readFileSync(join(RAIZ, 'src/estilos/estilos.css'), 'utf8'));

    expect(entrada).toContain("@import './secciones.css';");
    expect(
      entrada.indexOf('./secciones.css'),
      'Una seccion coloca Aviso, Boton, Insignia y Esqueleto dentro de sus paneles, y a\n' +
        'igualdad de especificidad gana el ultimo que llega.',
    ).toBeGreaterThan(entrada.indexOf('./marco.css'));
  });
});
