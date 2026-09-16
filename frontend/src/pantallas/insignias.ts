import type { TonoDeInsignia } from '@kamayuk/ui';

/**
 * **El tono de una celda de situacion, aparte de la costura** (#58; se mudo aqui en #63).
 *
 * <h2>Por que vive en su propio archivo desde #63, y no es cosmetica</h2>
 *
 * Porque `verificaciones/pantallas-del-artboard.test.ts` lo importa, y esa guarda corre con
 * `@vitest-environment node` —lo necesita: bajo jsdom, `fileURLToPath(import.meta.url)` revienta con
 * «The URL must be of scheme file»—. Desde que `src/pantallas/index.ts` pide datos, importarlo
 * arrastra `src/datos/…` -> `src/api/cliente.ts` -> `src/sesion.ts`, y ahi hay un
 * `window.location.origin` de nivel de modulo. Medido:
 *
 *     ReferenceError: window is not defined
 *      ❯ src/sesion.ts:106:12
 *      ❯ src/api/cliente.ts:3:1
 *
 * — un rojo de CARGA del modulo que se lleva la suite entera por delante («Failed Suites 1», cero
 * pruebas), y que no habla ni de la guarda ni de lo que vigila. Sacar la funcion corta la cadena en
 * el sitio correcto: es una funcion pura sobre una cadena, y no tiene por que saber que la hoja de
 * al lado pide datos.
 */

/**
 * **El tono de una celda de situacion**, deducido de lo que dice.
 *
 * El interprete lo exige y **no tiene valor por omision**, a proposito: uno que pintara todo de
 * `ok` dibujaria «Abierta» en verde sin que nada lo delatara. Es vocabulario de cada sistema, asi
 * que vive aqui y no en la libreria.
 *
 * La tabla es la de `const TONOS` del artboard V8 —su `porTexto` y su `resto`—, y que lo siga
 * siendo lo comprueba `verificaciones/pantallas-del-artboard.test.ts` contra esa constante.
 *
 * <h2>Lo que esta funcion NO puede decir, y su hueco</h2>
 *
 * El artboard tiene ademas un `porFila`: `D-03d` dice «Abierta» y se pinta en `atencion`, porque no
 * bloquea el sello sino el cierre de caja. **Aqui no cabe**: el interprete pasa el TEXTO de la
 * celda y nada mas, asi que las dos filas que dicen «Abierta» salen del mismo color. Es el hueco
 * H18 de `frontend/diseno/HUECOS.md` —el tono como dato de la fila—, que `kamayuk-lib`#65 ya
 * publica como `ReglaDeLaInsignia` y que usara la definicion de #65.
 */
export function tonoDeLaInsignia(texto: string): TonoDeInsignia {
  switch (texto.toLowerCase()) {
    case 'abierta':
      return 'mal';
    case 'abierto':
      return 'atencion';
    case 'vigente':
      return 'info';
    default:
      return 'ok';
  }
}
