import { expect, test, type Page } from '@playwright/test';

import { ARBOL } from '../src/pantallas/arbol.ts';
import { abrir, conLaPuertaAgotada } from './instalacion.ts';

/**
 * **Ningun control deshabilitado sin motivo, y ninguno cortado a 1 440 px** (#61, AC 3).
 *
 * <h2>La regla, y por que no es de estilo</h2>
 *
 * Un `disabled` es **mudo y ademas invisible al teclado**: saca el boton del orden del tabulador,
 * asi que quien navega sin raton no llega nunca a el y no puede ni leer que hay ahi. Lo que este
 * producto usa en su lugar es `BotonConMotivo` —`aria-disabled="true"`, sigue enfocable, el clic y
 * Enter no llaman a nada, y **hay una frase que dice por que**—
 * (`kamayuk-lib/paquetes/ui/shadcn/boton-con-motivo.tsx`).
 *
 * <h2>Lo que hay HOY en el arbol, medido y no supuesto</h2>
 *
 * Barriendo `paquetes/{ui,shell}` de `kamayuk-lib@origin/main`, el unico `disabled` de codigo de
 * produccion que se pinta sobre un control **de verdad** es
 * `paquetes/shell/AccionesAlPie.tsx:48` —`disabled={atendida === undefined}`—; los demas son
 * clases de estilo (`disabled:opacity-50`). Y ese no se enciende aqui:
 *
 *   · `accionesDelPie` ofrece **dos** actos por hoja segun `seEscribe` —«Limpiar/Guardar» o
 *     «Exportar/Imprimir»—, o sea cuatro actos en total;
 *   · `src/acciones.ts` atiende **los cuatro**, cada uno con su `al` que hace algo: `imprimir`
 *     imprime, y los otros tres avisan diciendo **por que** todavia no escriben y con que issue
 *     llegan.
 *
 * Medido sobre el bundle construido, en las cuatro hojas: **cero** elementos con `[disabled]` y
 * cero con `[aria-disabled="true"]`. Asi que esta guarda no describe un defecto: **defiende esa
 * cuenta**. El dia que alguien quite una de las cuatro entradas de `src/acciones.ts`, o que una
 * hoja nueva ofrezca un acto que nadie atiende, sale rojo aqui nombrando el boton.
 *
 * <h2>Lo que esta prueba NO puede exigir, y se dice</h2>
 *
 * Que `AccionesAlPie` use `aria-disabled` con motivo en lugar de `disabled`. Eso es de la libreria
 * —es el hueco **H08** de `frontend/diseno/HUECOS.md`, «`aria-disabled` con motivo, nunca
 * `disabled`»— y `src/acciones.ts` ya lo dice en su cabecera. Mientras las cuatro esten atendidas,
 * el `disabled` de aquella linea no llega a pintarse nunca desde aqui.
 *
 * <h2>Y la segunda mitad: a 1 440 px nada se corta</h2>
 *
 * 1 440 px es el ancho del artboard V8. Un control que se sale de su contenedor a ese ancho se lee
 * como una pantalla rota, y es lo que pasa con un pie que no envuelve o una tabla que desborda a
 * su tarjeta. Se mide comparando cajas, no clases.
 */

/** El ancho del artboard V8: el que se dibujo y el que hay que poder mirar entero. */
const ANCHO_DEL_ARTBOARD = 1_440;

const SLUGS = ARBOL.flatMap((modulo) =>
  modulo.hojas.map((hoja) => ({ rotulo: hoja.rotulo, slug: hoja.clave.replace(/^nor-/, '') })),
);

/** Los controles impedidos de la pantalla, con lo que se sabe de cada uno. */
async function losImpedidos(pagina: Page): Promise<readonly string[]> {
  return pagina.evaluate(() => {
    const comoSeLee = (elemento: Element): string => {
      const rotulo = (elemento.textContent ?? '').trim() || elemento.getAttribute('aria-label') || '';
      const ranura = elemento.getAttribute('data-slot') ?? elemento.tagName.toLowerCase();
      return `${ranura} «${rotulo.slice(0, 40)}»`;
    };

    const salida: string[] = [];
    // `[disabled]` a secas: mudo y fuera del tabulador. Ninguno es aceptable.
    for (const control of document.querySelectorAll('[disabled]')) {
      salida.push(`  disabled, sin motivo posible: ${comoSeLee(control)}`);
    }
    // Y un `aria-disabled` SIN su motivo: el mecanismo correcto, usado a medias. La frase cuelga
    // de `aria-describedby`, que es lo que un lector de pantalla lee tras el rotulo.
    for (const control of document.querySelectorAll('[aria-disabled="true"]')) {
      const senalado = control.getAttribute('aria-describedby');
      const motivo =
        senalado === null ? null : (document.getElementById(senalado)?.textContent ?? '').trim();
      if (motivo === null || motivo === '') {
        salida.push(`  aria-disabled sin motivo que leer: ${comoSeLee(control)}`);
      }
    }
    return salida;
  });
}

test.use({ viewport: { width: ANCHO_DEL_ARTBOARD, height: 900 } });

test.beforeEach(async ({ page }) => {
  await conLaPuertaAgotada(page);
});

for (const { rotulo, slug } of SLUGS) {
  test(`«${slug}» — ningun control impedido se queda mudo`, async ({ page }) => {
    await abrir(page, slug);
    await expect(page.getByRole('heading', { level: 1, name: rotulo })).toBeVisible();

    // EL CENTINELA de esta pantalla: que haya controles que mirar. Sin esto, una pantalla que no
    // pintara ni un boton pasaria en verde por no tener nada impedido.
    const pie = page.locator('[data-slot="acciones-al-pie"] button');
    await expect(pie, 'la pantalla no pinto el pie de acciones: no hay nada que comprobar').not
      .toHaveCount(0);

    const impedidos = await losImpedidos(page);
    expect(
      impedidos,
      `«${slug}» tiene controles impedidos sin motivo:\n${impedidos.join('\n')}\n\n` +
        '  Un `disabled` no dice por que ni se puede enfocar: quien pulsa no sabe si le falta un\n' +
        '  permiso, si la pantalla esta a medias o si la aplicacion esta rota. Lo que este\n' +
        '  producto usa es `BotonConMotivo` —`aria-disabled` con su frase—, y lo que evita que\n' +
        '  el pie del armazon llegue a impedirse es que `src/acciones.ts` atienda los cuatro\n' +
        '  actos.',
    ).toEqual([]);
  });
}

test(`a ${String(ANCHO_DEL_ARTBOARD)} px ningun control se sale de la pagina`, async ({ page }) => {
  for (const { slug } of SLUGS) {
    await abrir(page, slug);
    await expect(page.locator('[data-slot="acciones-al-pie"]').first()).toBeVisible();

    const cortados = await page.evaluate(() => {
      const ancho = document.documentElement.clientWidth;
      const fuera: string[] = [];
      for (const control of document.querySelectorAll('button, input, select, textarea, a[href]')) {
        const caja = control.getBoundingClientRect();
        // Los que no se pintan —dentro de un menu cerrado, por ejemplo— no se miden.
        if (caja.width === 0 && caja.height === 0) continue;
        if (caja.right > ancho + 1 || caja.left < -1) {
          fuera.push(
            `  ${control.tagName.toLowerCase()} «${(control.textContent ?? '').trim().slice(0, 40)}» ` +
              `de ${String(Math.round(caja.left))} a ${String(Math.round(caja.right))}, y la pagina mide ${String(ancho)}`,
          );
        }
      }
      return fuera;
    });

    expect(
      cortados,
      `«${slug}» corta controles al ancho del artboard:\n${cortados.join('\n')}`,
    ).toEqual([]);
  }
});
