import process from 'node:process';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * El empaquetado de `normativa-web`.
 *
 * `base` es `/normativa/` y no `/`: ADR-0030 §2 pone el sistema delante de la ruta, y el
 * mismo Traefik sirve las interfaces de los cinco. Con `base: '/'` el bundle pediria
 * `/assets/…`, que en el cluster es de otro sistema — y bajo el `stripPrefix` de Traefik
 * no cargaria ni uno. El fallo NO aparece en desarrollo, donde todo cuelga de la raiz:
 * aparece desplegado, que es el peor sitio donde descubrir una linea de configuracion.
 *
 * Y de esa misma `base` sale el `redirect_uri` de `api/identidad.ts`, que es lo que hace que
 * `vitest.config.ts` tenga que declararla tambien.
 */

/**
 * A donde van las peticiones de la API en desarrollo.
 *
 * Por variable de entorno, con Traefik en el puerto 8082 por omision: la instalacion local es
 * la que es, pero quien levante el ingreso en otro sitio no tiene que editar este archivo para
 * probar —y un archivo de configuracion editado a mano acaba en un commit que nadie queria—.
 */
const BACKEND = process.env.KAMAYUK_BACKEND ?? 'http://localhost:8082';

/**
 * La raiz de la API de este sistema. Es el mismo `PREFIJO` de `api/cliente.ts` y la misma
 * `RAIZ` de `api/proxy.ts`, y que lo sea lo comprueba `proxy.test.ts`.
 */
const RAIZ_DE_LA_API = '/normativa/api/v1';

export default defineConfig({
  base: '/normativa/',
  plugins: [react()],
  /**
   * El camino a la API en desarrollo, y **por que hace falta uno**.
   *
   * <h2>No es comodidad: es la unica via</h2>
   *
   * El backend **no publica ninguna cabecera `Access-Control-Allow-Origin`** —cero
   * `CorsConfiguration` y cero `@CrossOrigin` en todo `backend/`—, asi que una peticion de
   * `http://localhost:5173` a `http://localhost:8082` la bloquea el navegador antes de que
   * nadie la lea. La unica salida sin tocar el backend es que todo salga del **mismo origen**:
   * la pagina y la API por el puerto de Vite, y Vite reenviando al ingreso.
   *
   * <h2>Y sin esto el fallo no parece un fallo</h2>
   *
   * Sin `server.proxy`, `/normativa/api/v1/...` lo atiende el propio servidor de Vite, que para
   * cualquier ruta desconocida devuelve el `index.html` de la aplicacion con un **200**. La
   * pantalla pide JSON y recibe HTML con un codigo de exito: no un error, una pagina. Es el
   * tercero de los tres motivos que `datos/servidas.ts` llevaba escritos para no encender
   * ninguna ruta, y el unico que se cierra desde este archivo.
   *
   * `rewrite` no hace falta y por eso no esta: Traefik enruta por `PathPrefix(/normativa/api/v1)`,
   * o sea que la ruta que sale de aqui es exactamente la que el backend espera. Reescribirla
   * seria quitarle el prefijo por el que se enruta.
   */
  server: {
    proxy: {
      [RAIZ_DE_LA_API]: {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Que el bundle sea reproducible importa mas que su tamano: la imagen se etiqueta con
    // el `sha` del repositorio (D), asi que dos construcciones del mismo `sha` tienen que
    // dar el mismo contenido.
    sourcemap: true,
  },
});
