import { crearCliente } from '@kamayuk/api';

import { identidad } from '../sesion.ts';

/**
 * **El cliente de la API de `normativa`** (#57, AC 5).
 *
 * <h2>Una sola sentencia, y eso es el issue</h2>
 *
 * La V6 tenia 438 lineas aqui (`c01fe9a:src/api/cliente.ts`) y salieron con ella (#50). Lo que
 * hacian —el token en `Authorization`, el `Accept`, el cuerpo JSON, la traduccion de un fallo a un
 * mensaje, el «200 que miente» cuando `nginx` contesta el `index.html` a una ruta de API— lo hace
 * `@kamayuk/api`, y lo hace para los cinco sistemas.
 *
 * Lo unico que este sistema tiene que decir son dos datos:
 *
 *   · **el prefijo**, que es `Api.RAIZ` del backend y el mismo `PathPrefix` por el que Traefik
 *     enruta (ADR-0030 §2). Es el mismo que `vite.config.ts` reenvia en desarrollo, y lo compara
 *     `verificaciones/la-puerta-y-el-cliente-son-de-la-libreria.test.ts` para que no se separen;
 *   · **de donde sale el token**, que entra como FUNCION y no como valor: el token cambia dentro de
 *     la vida de la pagina —al principio no hay, y despues del canje si—, asi que un valor leido al
 *     construir el cliente seria `null` para siempre y la primera peticion despues del canje
 *     saldria sin cabecera. Es la leccion de `c01fe9a:src/api/cliente.test.ts:297-352`: «se lee en
 *     cada peticion, no al importar».
 *
 * <h2>Lo que NO se escribe aqui, y nunca</h2>
 *
 * La municipalidad. El backend la toma del token (regla 2 del producto, ADR-0028 §2), y por eso la
 * prohibicion `municipalidad-en-el-cliente` de `eslint.prohibiciones.mjs` no deja ni nombrarla.
 *
 * <h2>Quien lo usa</h2>
 *
 * Nadie todavia: la primera lectura es de #63, y las cuatro hojas de #65, #66 y #67. Existe desde
 * ya porque es la mitad del AC de este issue —que el cliente **nazca** de la libreria— y porque
 * tenerlo puesto es lo que hace que la primera pantalla no traiga su propio `fetch` con ella.
 */
export const cliente = crearCliente({
  prefijo: '/normativa/api/v1',
  token: identidad.token,
});
