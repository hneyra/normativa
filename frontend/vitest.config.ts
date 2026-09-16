import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { LO_QUE_PONE_EL_CONSUMIDOR } from './resolucion.ts';

export default defineConfig({
  /**
   * La MISMA base que `vite.config.ts`, y no por simetria: de aqui sale
   * `import.meta.env.BASE_URL`, que es la raiz de la aplicacion y de donde la puerta de
   * identidad compone el `redirect_uri` (`c01fe9a:src/api/identidad.test.ts`; vuelve en #57).
   *
   * Con la base por omision —`/`— el entorno de pruebas no se parece al real **justo en lo
   * que falla**: el `redirect_uri` volveria a la raiz del SITIO en vez de a la de la
   * aplicacion, la prueba que lo fija afirmaria `http://localhost:5173/`, y las dos cosas
   * serian ciertas a la vez. Asi llego a produccion el defecto de
   * [`rentas`#71](https://github.com/hneyra/rentas/issues/71): con su prueba en verde.
   */
  base: '/normativa/',
  plugins: [react()],
  /**
   * **UNA sola copia de lo que los paquetes enlazados dan por puesto** (#55).
   *
   * Y aqui hace tanta falta como en `vite.config.ts`, porque es aqui donde se EJECUTAN las piezas
   * de la libreria: `src/aplicacion.test.tsx` monta el `Armazon` y el `ProveedorDeTema`. Sin el
   * `dedupe`, esas piezas cargan React desde el arbol del clon hermano y salen dos copias en la
   * misma pagina —«Cannot read properties of null (reading 'useState')»— o ninguna, si el hermano
   * no tiene `node_modules`, que es como esta en la CI. El motivo entero, en `resolucion.ts`.
   */
  resolve: {
    dedupe: [...LO_QUE_PONE_EL_CONSUMIDOR],
  },
  test: {
    environment: 'jsdom',
    // Sin globales: un `describe` que aparece de la nada no dice de donde sale, y el
    // compilador tampoco. Aqui cada cosa se importa.
    globals: false,
    // Las pruebas del codigo viven JUNTO al codigo; las de las barreras, en
    // `verificaciones/`, porque no prueban una unidad sino una propiedad del arbol.
    include: ['{src,verificaciones}/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'verificaciones/muestras/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
