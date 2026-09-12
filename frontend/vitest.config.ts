import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  /**
   * La MISMA base que `vite.config.ts`, y no por simetria: de aqui sale
   * `import.meta.env.BASE_URL`, que es la raiz de la aplicacion y de donde
   * `api/identidad.ts` compone el `redirect_uri`.
   *
   * Con la base por omision —`/`— el entorno de pruebas no se parece al real **justo en lo
   * que falla**: el `redirect_uri` volveria a la raiz del SITIO en vez de a la de la
   * aplicacion, la prueba que lo fija afirmaria `http://localhost:5173/`, y las dos cosas
   * serian ciertas a la vez. Asi llego a produccion el defecto de
   * [`rentas`#71](https://github.com/hneyra/rentas/issues/71): con su prueba en verde.
   */
  base: '/normativa/',
  plugins: [react()],
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
