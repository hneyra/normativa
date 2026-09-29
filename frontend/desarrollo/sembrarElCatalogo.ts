/**
 * **Las cuatro hojas sin levantar la plataforma** (#64, AC 6).
 *
 * Calcado de `rentas/frontend/desarrollo/sembrarElCatalogo.ts@ac379ac` (`rentas`#114).
 *
 * <h2>El hueco que esto cierra</h2>
 *
 * Desde #64 el menu llega de la red —`useCatalogoPermitido` pide `GET /seguridad/{modulos,accesos}`
 * y `/seguridad/sesion/permisos`— y sin las tres no hay ni un destino que abrir: lo unico que se lee
 * es «No se pudo saber que modulos puede abrir esta cuenta…». Ese mensaje es correcto y la decision
 * tambien; lo que costaba era mirar la interfaz — PostgreSQL, Keycloak, Traefik y el backend para
 * comprobar el color de una cabecera.
 *
 * <h2>Se siembra lo que la SESION dice de si misma, y nada mas</h2>
 *
 * Las cinco lecturas de `/seguridad`, que son las cinco con `SESION_PROPIA` (ADR-0043 §3): las tres
 * del catalogo —**que hojas existen** para esta cuenta— y las dos de la barra —quien entro y de que
 * municipalidad—. **Una diferencia con `rentas`, y se dice**: alli se siembran tres porque la barra
 * era un literal; aqui la barra tambien se pide (G2, #52), y sin sembrarla `yarn dev` pintaria la
 * escalera de errores en el sitio del nombre, que es verdad pero no es lo que se viene a mirar.
 *
 * **No se siembra ni un dato de hoja**: el Panel, Ediciones, Cuadros y Publicacion salen a la red,
 * no encuentran a nadie y **ensenan su estado de error**, que es la verdad y es un estado que hay
 * que poder mirar. Contestarles algo inventado seria devolver el proxy de datos de la V6, y ese se
 * fue con su motivo (#50).
 *
 * <h2>Y lo que se siembra son BYTES MEDIDOS</h2>
 *
 * `src/datos/seguridadMedida.ts` y `desarrollo/sesionMedida.ts` los GENERA
 * `verificaciones/capturas-de-seguridad.ts` de `docs/50-api/seguridad/`, que produce
 * `LecturasDeSeguridadDePuntaAPuntaTest` de HTTP a PostgreSQL (#54). Inventarlos aqui haria que lo
 * que se mira fuese una fantasia, y la primera vez que el backend cambiara de forma esto seguiria
 * ensenando el arbol de siempre.
 *
 * <h2>Por que vive FUERA de `src/`</h2>
 *
 * Porque `src/` es lo que se sirve, y esto no se sirve nunca: lo unico que lo alcanza es un
 * `import()` dinamico detras de dos condiciones constantes al construir (`src/arranque.ts`), que
 * Rollup pliega en `yarn build`. Y porque lleva el nombre de una municipalidad —el de la captura—,
 * que G2 no deja escribir en `src/`. Es donde ya vive `e2e/instalacion.ts`, que contesta las mismas
 * capturas en el arnes por el mismo motivo.
 */

import { CONSULTAS } from '../src/datos/proveedor.tsx';
import {
  ACCESOS_MEDIDOS,
  MODULOS_MEDIDOS,
  PERMISOS_MEDIDOS,
} from '../src/datos/seguridadMedida.ts';
import { LLAVES } from '../src/datos/useCatalogoPermitido.ts';
import { MEDIDA_EL, MUNICIPALIDAD_MEDIDA, SESION_MEDIDA } from './sesionMedida.ts';

/**
 * Pone las cinco respuestas de `/seguridad` en la cache, ya contestadas.
 *
 * <h2>Por que hace falta `staleTime` y no basta con `setQueryData`</h2>
 *
 * Porque una consulta sembrada **sigue teniendo su `queryFn`**, y con el `staleTime` por omision
 * —cero— el dato nace rancio: TanStack Query lo ensena y sale a refrescarlo al montar. Sin backend
 * ese refresco falla, y una consulta que falla pasa a `status: 'error'` **aunque conserve el dato**;
 * `useCatalogoPermitido` mira el fallo antes que nada, asi que la pantalla acabaria ensenando el
 * mismo «No se pudo saber…» que esto viene a quitar — despues de haber dibujado el arbol un instante.
 *
 * Con el dato fresco para siempre, la `queryFn` no llega a correr: **ninguna peticion a
 * `/seguridad/{modulos,accesos,sesion…}`**, que es lo que «sin backend» significa. Se acota a la
 * rama `seguridad` y no se toca el cliente entero: las lecturas de las hojas —`/seguridad/parametros`
 * del Panel incluida, que es otra rama— tienen que seguir pidiendo y fallando de verdad.
 */
export function sembrarElCatalogo(): void {
  CONSULTAS.setQueryDefaults(LLAVES.rama, { staleTime: Infinity, gcTime: Infinity });
  CONSULTAS.setQueryData(LLAVES.modulos, MODULOS_MEDIDOS);
  CONSULTAS.setQueryData(LLAVES.accesos, ACCESOS_MEDIDOS);
  CONSULTAS.setQueryData(LLAVES.permisos, PERMISOS_MEDIDOS);
  CONSULTAS.setQueryData(LLAVES.sesion, SESION_MEDIDA);
  CONSULTAS.setQueryData(LLAVES.municipalidad, MUNICIPALIDAD_MEDIDA);

  // Y se dice, porque una interfaz que se ve entera sin que nada este levantado es exactamente lo
  // que alguien puede confundir con «el backend contesto». Va por `warn` y no por `log`: la consola
  // de desarrollo tiene ruido, y esto tiene que leerse.
  console.warn(
    'normativa-web: EL CATALOGO ESTA SEMBRADO, no pedido (VITE_KAMAYUK_SIN_PLATAFORMA=true).\n' +
      `Los modulos, los accesos, la matriz, la cuenta y la municipalidad salen de las capturas de\n` +
      `docs/50-api/seguridad/ tomadas el ${MEDIDA_EL}, y no se fue a Keycloak. Las cuatro hojas\n` +
      'piden sus datos y van a fallar, que es la verdad cuando no hay backend.\n' +
      'Para trabajar contra la plataforma levantada: `yarn dev:con-plataforma`.',
  );
}
