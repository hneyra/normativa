import { expect, test } from '@playwright/test';

import { ARBOL } from '../src/pantallas/arbol.ts';
import { abrir, conLaPuertaAgotada } from './instalacion.ts';

/**
 * **La paleta de mando se opera SOLO con el teclado** (#61, AC 3).
 *
 * <h2>De donde viene</h2>
 *
 * La V6 tenia su propia paleta —`c01fe9a:frontend/src/marco/PaletaDeComandos.tsx`— y salio con
 * ella en #50. Hoy la pone `@kamayuk/shell` (`PaletaDelArmazon.tsx`, sobre `cmdk`), y el atajo lo
 * escucha el `Armazon` (`Armazon.tsx:354`: `(ctrlKey || metaKey) && key === 'k'`). Lo que este
 * arnes recupera no es la pieza sino **la propiedad**: que se pueda llegar a cualquier destino sin
 * tocar el raton.
 *
 * <h2>Por que esto NO lo puede decir jsdom</h2>
 *
 * Porque lo que se mide es la cadena entera de teclado, y cada eslabon vive en una capa distinta:
 * el atajo es un `keydown` sobre `window`, el filtro es el `cmdk` puntuando cada opcion, el
 * recorrido es `aria-activedescendant` moviendose con las flechas, y la eleccion es un `Enter` que
 * acaba en `createHashRouter`. `fireEvent.keyDown` dispara el primero y **da por buenos los otros
 * tres**: en jsdom no hay foco de verdad, ni orden de tabulador, ni navegacion.
 *
 * Y es la ruta que usa quien no puede usar el raton. Un atajo que abre una lista por la que luego
 * no se puede bajar es peor que no tener atajo: parece que funciona.
 */

/** Los cuatro destinos del arbol, que es contra lo que se compara la lista de la paleta. */
const ROTULOS = ARBOL.flatMap((modulo) => modulo.hojas.map((hoja) => hoja.rotulo));

test.beforeEach(async ({ page }) => {
  await conLaPuertaAgotada(page);
});

test('EL CENTINELA: Ctrl-K abre la paleta y trae los cuatro destinos', async ({ page }) => {
  // Sin esto, una paleta que no abriera dejaria los caminos de abajo fallando por el sitio
  // equivocado, y una paleta vacia los dejaria pasando sin haber elegido nada.
  await abrir(page, 'panel');
  await page.keyboard.press('Control+k');

  await expect(page.locator('[data-slot="paleta-de-mando"]')).toBeVisible();
  const opciones = page.locator('[data-slot="opcion-de-la-paleta"]');
  await expect(opciones).toHaveCount(ROTULOS.length);

  // Y cada una lleva su rotulo. El modulo va detras —`PaletaDelArmazon` lo pinta para desambiguar—
  // asi que se compara por contenido y no por igualdad.
  for (const rotulo of ROTULOS) {
    await expect(
      opciones.filter({ hasText: rotulo }),
      `la paleta no ofrece «${rotulo}»`,
    ).toHaveCount(1);
  }
});

test('se filtra, se elige y se navega SIN tocar el raton', async ({ page }) => {
  await abrir(page, 'panel');
  await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible();

  // Todo lo que sigue es teclado. Ni un `click`.
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-slot="buscador-de-la-paleta"]')).toBeFocused();

  await page.keyboard.type('Public');
  await expect(
    page.locator('[data-slot="opcion-de-la-paleta"]'),
    'escribir no filtro nada: la paleta ofrece lo mismo con y sin consulta',
  ).toHaveCount(1);

  await page.keyboard.press('Enter');

  // Se navego de verdad: la pantalla es otra y la barra de direcciones tambien.
  await expect(page.getByRole('heading', { level: 1, name: 'Publicación' })).toBeVisible();
  expect(page.url()).toContain('#/publicacion');
  await expect(page.locator('[data-slot="paleta-de-mando"]')).toBeHidden();
});

test('y se baja por la lista con las flechas, que es como se elige sin escribir', async ({
  page,
}) => {
  await abrir(page, 'panel');
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-slot="paleta-de-mando"]')).toBeVisible();

  // Sin escribir nada: dos flechas abajo desde la primera opcion llevan a la tercera, que es
  // «Cuadros de valuacion». Un atajo que abre una lista por la que no se puede bajar no sirve.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { level: 1, name: 'Cuadros de valuación' })).toBeVisible();
  expect(page.url()).toContain('#/cuadros');
});

test('Escape la cierra y deja la pantalla donde estaba', async ({ page }) => {
  await abrir(page, 'panel');
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-slot="paleta-de-mando"]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-slot="paleta-de-mando"]')).toBeHidden();
  // Y el velo, quitado: mientras siga montado intercepta el puntero y la pantalla de debajo queda
  // inservible sin que nada se vea raro.
  await expect(page.locator('[data-slot="velo-del-cajon"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible();
});
