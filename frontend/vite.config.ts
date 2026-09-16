import process from 'node:process';

import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { LO_QUE_PONE_EL_CONSUMIDOR } from './resolucion.ts';

/**
 * El empaquetado de `normativa-web`.
 *
 * `base` es `/normativa/` y no `/`: ADR-0030 §2 pone el sistema delante de la ruta, y el
 * mismo Traefik sirve las interfaces de los cinco. Con `base: '/'` el bundle pediria
 * `/assets/…`, que en el cluster es de otro sistema — y bajo el `stripPrefix` de Traefik
 * no cargaria ni uno. El fallo NO aparece en desarrollo, donde todo cuelga de la raiz:
 * aparece desplegado, que es el peor sitio donde descubrir una linea de configuracion.
 *
 * Y de esa misma `base` sale el `redirect_uri` de la puerta de identidad —la escrita a mano
 * salio con la V6; la nueva llega de `@kamayuk/sesion` en #57—, que es lo que hace que
 * `vitest.config.ts` tenga que declararla tambien.
 *
 * Desde #55 es el `vite.config.ts` de `rentas@ac379ac` con el nombre de este sistema, **entero**:
 * #50 lo dejo sin Tailwind y sin `resolucion.ts`, y los dos llegan con el `link:` a `kamayuk-lib`.
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
 * La raiz de la API de este sistema: `Api.RAIZ` en el backend. Hasta `c01fe9a` la repetian
 * `api/cliente.ts` y `api/proxy.ts`, y lo comprobaba `proxy.test.ts`; los tres salieron con la V6
 * y el cliente que la vuelva a nombrar llega en #57.
 */
const RAIZ_DE_LA_API = '/normativa/api/v1';

export default defineConfig({
  base: '/normativa/',
  /**
   * Tailwind v4, **desde #55**.
   *
   * No estaba antes y no podia estar: su *preflight* normaliza margenes, tipografia y filos de
   * todo el documento, y la V6 —CSS escrito a mano en `src/estilos/` y `src/ds/`— se apoyaba en
   * los valores por omision del navegador. La V6 salio en #50, asi que encenderlo aqui ya no le
   * cambia la cara a nada: lo que dibuja desde hoy es el `Armazon` de `@kamayuk/shell`, cuyas
   * clases **solo generan CSS con el complemento puesto y con los `@source` de `src/estilos.css`**.
   *
   * Va ANTES que el de React, como en `rentas`: el de Tailwind tiene que ver los archivos para
   * saber que clases se usan. Lo comprueba `verificaciones/tailwind-esta-conectado.test.ts`.
   */
  plugins: [tailwind(), react()],
  /**
   * **UNA sola copia de lo que los paquetes enlazados dan por puesto.**
   *
   * La lista NO se escribe: se deriva de las `peerDependencies` de cada `@kamayuk/*` enlazado.
   * El porque entero —con los dos rojos que costo en `rentas`, `Cannot read properties of null
   * (reading 'useId')` en local y `Cannot find module 'react'` en CI— esta en `resolucion.ts`.
   */
  resolve: {
    dedupe: [...LO_QUE_PONE_EL_CONSUMIDOR],
  },
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
   * pantalla pide JSON y recibe HTML con un codigo de exito: no un error, una pagina. Era el
   * tercero de los tres motivos que `c01fe9a:frontend/src/datos/servidas.ts` llevaba escritos
   * para no encender ninguna ruta, y el unico que se cierra desde este archivo.
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
  /**
   * **El nombre con que el arnes comprueba que sin origen seguro no hay puerta** (#61, AC 3).
   *
   * <h2>Que hace esta linea, y sobre todo que NO hace</h2>
   *
   * `vite preview` es el servidor con que se mira el `dist` en local y el que levanta
   * `playwright.config.ts`. **No sirve nada en el cluster**: ahi el `dist` lo entrega el `nginx`
   * de `frontend/Dockerfile`. Asi que esta llave no toca ni un byte del paquete ni del despliegue:
   * solo le dice al servidor de mirar que acepte una peticion cuyo `Host` sea ese nombre.
   *
   * <h2>Por que hace falta, medido</h2>
   *
   * `sin-origen-seguro.spec.ts` comprueba que la interfaz servida por un nombre que **no** es
   * `localhost` diga que no hay puerta —el navegador no expone `crypto.subtle` fuera de un origen
   * seguro— en vez de quedarse muda. Para eso Chromium arranca con
   * `--host-resolver-rules=MAP normativa.prueba [::1]` y pide `http://normativa.prueba:<puerto>/`.
   * Sin esta llave, lo que contesta Vite es **403** y esto:
   *
   *     Blocked request. This host ("normativa.prueba") is not allowed.
   *     To allow this host, add "normativa.prueba" to `preview.allowedHosts` in vite.config.js
   *
   * O sea: la aplicacion ni se carga, y la prueba mediria la pagina de bloqueo de Vite en lugar de
   * la interfaz. El `[::1]` tampoco es decorativo: medido con `ss -ltnp`, `vite preview` escucha
   * en `[::1]` y **no** en `127.0.0.1`, asi que un `MAP` a la cara IPv4 no llega a nadie.
   *
   * Y el nombre no puede ser cualquiera: `*.localhost` lo aceptaria Vite sin declararlo, pero
   * Chromium trata `*.localhost` como origen **seguro**, que es justo lo contrario de lo que hay
   * que medir.
   */
  preview: {
    allowedHosts: ['normativa.prueba'],
  },
  build: {
    outDir: 'dist',
    // Que el bundle sea reproducible importa mas que su tamano: la imagen se etiqueta con
    // el `sha` del repositorio (D), asi que dos construcciones del mismo `sha` tienen que
    // dar el mismo contenido.
    sourcemap: true,
  },
});
