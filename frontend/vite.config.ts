import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * El empaquetado de `normativa-web`.
 *
 * `base` es `/normativa/` y no `/`: ADR-0030 §2 pone el sistema delante de la ruta, y el
 * mismo Traefik sirve las cuatro interfaces. Con `base: '/'` el bundle pediria
 * `/assets/…`, que en el cluster es de otro sistema — y bajo el `stripPrefix` de Traefik
 * no cargaria ni uno. El fallo NO aparece en desarrollo, donde todo cuelga de la raiz:
 * aparece desplegado, que es el peor sitio donde descubrir una linea de configuracion.
 */
export default defineConfig({
  base: '/normativa/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Que el bundle sea reproducible importa mas que su tamano: la imagen se etiqueta con
    // el `sha` del repositorio (D), asi que dos construcciones del mismo `sha` tienen que
    // dar el mismo contenido.
    sourcemap: true,
  },
});
