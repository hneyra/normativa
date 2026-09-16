import { crearIdentidad } from '@kamayuk/sesion';
import { ubicacionDe, type CuentaEnLaBarra, type OpcionDeSesion } from '@kamayuk/shell';
import { createElement, type ReactNode } from 'react';

import { configuracion } from './configuracion.ts';
import {
  abrirLasPreferencias,
  cerrarLasPreferencias,
  usePreferencias,
} from './preferencias/cajon.ts';
import { MandoDeTema } from './preferencias/MandoDeTema.tsx';
import { AvisoDeLaPuerta } from './puerta/AvisoDeLaPuerta.tsx';
import { porQueNoSeEntro } from './puerta/falla.ts';

/**
 * **La puerta de identidad y lo que la sesion pone en la barra** — costura de #55, la llena #57.
 *
 * <h2>La puerta sale de `@kamayuk/sesion`, y `normativa` no tiene PKCE propio</h2>
 *
 * Es la decision 3 de la epica #47. La V6 llevaba su propia puerta —`c01fe9a:src/api/identidad.ts`,
 * 394 lineas de codigo de autorizacion con PKCE S256— y salio con ella (#50). `rentas` todavia
 * corre su copia (`ac379ac:src/api/identidad.ts`, 537 l); `normativa` **nace sobre la libreria**,
 * como `catastro` en `catastro`#110.
 *
 * Lo que aqui se decide son los datos que atan la puerta a ESTE sistema, y nada mas: el realm, el
 * cliente, el alcance, el retorno, el destino por omision y el prefijo de las claves.
 *
 * <h2>Por que la municipalidad y la cuenta estan AQUI y no en `src/marca.ts`</h2>
 *
 * Porque no nombran al sistema: nombran a quien entro y donde. Es la decision G2 (comentario del
 * dueño en #52, 2026-09-15): «la municipalidad no es estatica, es la de la sesion y se carga por su
 * UBIGEO; nunca va como literal», y «la cuenta, la de la sesion».
 *
 * Lo que costaria escribirlas esta medido en otro repositorio: `rentas` llevo «Municipalidad
 * Distrital de Catacaos» en su marco hasta su I-1, y la habria visto cualquier municipalidad que no
 * fuera Catacaos sin que ninguna prueba sobre los valores lo notara.
 *
 * <h2>Lo que este issue SI enciende, y lo que deja para #54 y #64</h2>
 *
 * Enciende la puerta entera —la ida, el canje, los dos frenos, salir— y las cuatro opciones del
 * menu de sesion. **No** enciende el nombre de quien entro ni el de la municipalidad, y no por
 * falta de ganas: `Identidad` guarda el `id_token` y **no publica sus claims** —solo lo usa para
 * `id_token_hint` al salir—, asi que la interfaz no puede leer de el ni un nombre. Esta pedido en
 * la libreria, con la leccion citada, en
 * [`kamayuk-lib`#70](https://github.com/hneyra/kamayuk-lib/issues/70) (AC 8 de este issue), y lo
 * que lo cierra de verdad aqui es `GET /seguridad/sesion` (#54), leido por #64.
 *
 * Hasta entonces los dos marcadores de abajo, que **no son el nombre de nadie**.
 */

/** La clave del destino del Panel en el catalogo de #58. Ver {@link DESTINO_POR_OMISION}. */
export const CLAVE_DEL_PANEL = 'nor-panel';

/** El slug con que se enlaza, del artboard V8. Ver {@link DESTINO_POR_OMISION}. */
export const SLUG_DEL_PANEL = 'panel';

/**
 * **A donde volver cuando la vuelta no dice a donde: el Panel.**
 *
 * El ejemplo del docblock de la libreria pone `'#nor-panel'` (`paquetes/sesion/identidad.ts:101`) y
 * **eso no es el hash de esta aplicacion**: es el de la V6, que enrutaba con su propio hash sin
 * barra (`c01fe9a:src/marco/`). El `Armazon` de `@kamayuk/shell` enruta con `createHashRouter` y
 * escribe la direccion de una hoja con `ubicacionDe(slug)`, o sea `#/<slug>`.
 *
 * Asi que el valor **no se escribe**: se compone con la misma funcion con la que el armazon la
 * escribe. Lo que sigue escrito es el slug, que es dato del catalogo (#58) y hoy no existe en
 * `src/catalogo.ts`: sale del artboard V8 —`const SLUGS` de `diseno/NormativaV8.dc.html`, heredado
 * de `NormativaV6.dc.html:1450-1455`—, donde el destino `nor-panel` se enlaza como `panel`.
 *
 * Que sea EL MISMO hash con que el armazon abre `nor-panel` no se afirma aqui: se mide **montando
 * el armazon**, en `verificaciones/el-destino-por-omision-es-el-del-armazon.test.ts`. Y esa guarda
 * mira tambien `src/catalogo.ts`, asi que el dia que #58 lo llene con otro slug, sale roja.
 */
export const DESTINO_POR_OMISION = `#${ubicacionDe(SLUG_DEL_PANEL)}`;

/**
 * **La puerta de ESTE sistema.**
 *
 * `realm`, `cliente` y `alcance` salen de `configuracion()` —servida, horneada, por omision— y se
 * leen AQUI, al construir la instancia, no al importar cada uno: `index.html` carga
 * `/configuracion.js` como guion clasico antes del modulo, asi que cuando este archivo se evalua
 * las senias ya estan puestas.
 *
 * `retorno` es `window.location.origin + import.meta.env.BASE_URL`, y es la linea que costo el
 * acceso a produccion en [`rentas`#71](https://github.com/hneyra/rentas/issues/71): valia
 * `origin + '/'`, que es correcto para una aplicacion servida en la raiz, pero estas se sirven bajo
 * `/<sistema>/` porque ADR-0030 §2 pone el sistema delante de la ruta. Quien se autenticaba volvia
 * a `https://<dominio>/` y recibia un **404**, con el `code` y el `iss` correctos: la autenticacion
 * funcionaba y el retorno no. De `BASE_URL` salen tambien los activos, asi que no hay un segundo
 * sitio que mantener.
 *
 * `prefijoDeClaves` es `kamayuk.normativa`, **el mismo que el tema** (`aplicacion.tsx`): las cinco
 * interfaces del producto se sirven del mismo origen —`/rentas/`, `/caja/`, `/catastro/`,
 * `/normativa/`— y comparten el almacenamiento del navegador. Sin prefijo propio, dos de ellas se
 * pisan el verificador PKCE. La V6 usaba `kamayuk.pkce.*`, **sin el sistema**
 * (`c01fe9a:src/api/identidad.test.ts:124`), y por eso la libreria lo exige.
 *
 * `topeDeIdas` no se pasa: la omision de la libreria son tres, que es la cifra que la V6 media
 * (`c01fe9a:src/api/identidad.test.ts:307-317`). Escribirla aqui seria una copia que se separa.
 */
export const identidad = crearIdentidad({
  realm: configuracion('oidcRealm'),
  cliente: configuracion('oidcCliente'),
  alcance: configuracion('oidcAlcance'),
  retorno: window.location.origin + import.meta.env.BASE_URL,
  destinoPorOmision: DESTINO_POR_OMISION,
  prefijoDeClaves: 'kamayuk.normativa',
});

/**
 * La entidad de la barra: la municipalidad de la sesion.
 *
 * Hoy no hay de donde sacarla —`GET /seguridad/sesion/municipalidad` es de #54 y leerlo es de
 * #64—, asi que dice que no la hay. **No es el nombre de ninguna municipalidad**, y ese es el
 * punto: el dia que alguien escriba uno aqui, la interfaz de las veinte instalaciones dira el de
 * la primera.
 */
export const ENTIDAD = 'Sin sesión';

/**
 * Quien entro. Hoy, nadie que la interfaz pueda nombrar.
 *
 * No es que no haya sesion —con la puerta encendida la hay— sino que **no hay de donde leer el
 * nombre**: `Identidad` no publica los claims del `id_token` (`kamayuk-lib`#70) y
 * `GET /seguridad/sesion` es de #54.
 *
 * `iniciales` son dos puntos medios y no dos letras: cualquier par de letras seria las iniciales de
 * alguien, y el circulo de la barra las dibuja como si fueran las suyas. La V6 escribia
 * «H. Neyra Alama» (`c01fe9a:src/marco/BarraGlobal.tsx:70-76`), y eso no vuelve.
 */
export const CUENTA: CuentaEnLaBarra = {
  nombre: 'Sin sesión',
  iniciales: '··',
};

/**
 * **Las cuatro opciones del menu de sesion**, las mismas y en el mismo orden que
 * `rentas/frontend/src/aplicacion.tsx@ac379ac:206-226`.
 *
 * Las dos primeras **no se resuelven aqui a proposito**, y no por falta de backend: la autorizacion
 * es de `identidad` desde ADR-0039 y la contrasena la guarda Keycloak, que ya publica su propia
 * pagina de cuenta. Dibujar aqui esos dos formularios seria prometer una escritura que ningun
 * backend de este repositorio puede atender — y `docs/50-api/formas-de-la-api.json` no publica
 * ninguna operacion de perfil ni de contrasena, que es como se comprueba.
 *
 * A donde llevan, y con que se midio contra el Keycloak que fija el compose, esta en
 * `paquetes/sesion/identidad.ts` de la libreria.
 *
 * **Ninguna es muda**: las cuatro llevan un `al` que hace algo, y lo exige
 * `verificaciones/ninguna-opcion-del-menu-se-queda-muda.test.ts`. Una opcion cableada a una funcion
 * vacia se dibuja, se pulsa y no pasa nada, y quien la pruebe no sabe si el fallo es suyo, de la
 * red o del backend.
 *
 * Los rotulos van en castellano y sin `t()`: el i18n es #60, y el castellano es la clave.
 */
export const OPCIONES_DE_SESION: readonly OpcionDeSesion[] = [
  {
    rotulo: 'Mi perfil',
    al: () => {
      identidad.abrirLaCuenta('perfil');
    },
  },
  {
    rotulo: 'Cambiar la contrasena',
    al: () => {
      identidad.abrirLaCuenta('contrasena');
    },
  },
  {
    rotulo: 'Preferencias',
    al: () => {
      abrirLasPreferencias();
    },
  },
  // `peligrosa`: la que no se deshace. El armazon la pinta en la tinta del error.
  {
    rotulo: 'Cerrar sesión',
    peligrosa: true,
    al: () => {
      identidad.salir();
    },
  },
];

/**
 * **La puerta caida**: lo que se dibuja ENCIMA de la aplicacion cuando no se pudo entrar.
 *
 * Los dos casos —el emisor que no contesta y el emisor que no deja entrar— y por que ninguno puede
 * quedarse mudo, en `puerta/falla.ts`. El motivo de que sea una capa y no la pantalla entera, en
 * `puerta/AvisoDeLaPuerta.tsx`.
 *
 * Devuelve `null` en todo lo demas, incluido el caso normal de ir a la puerta: ese no monta nada,
 * asi que nadie llega a preguntar.
 *
 * Es una funcion de componente y no un elemento: `aplicacion.tsx` decide DONDE se dibuja, y quien
 * decide SI se dibuja es esto.
 */
export function PuertaCaida(): ReactNode {
  const porQue = porQueNoSeEntro();
  if (porQue === null) return null;
  return createElement(AvisoDeLaPuerta, { porQue });
}

/**
 * **El cajon de preferencias**: el mando que cambia la identidad visual y el modo del tema.
 *
 * Lo abre la opcion «Preferencias» de arriba. El estado vive fuera de React
 * —`preferencias/cajon.ts`, que dice por que— porque quien abre es una constante de modulo y quien
 * dibuja es esto, y no hay componente comun donde poner un `useState` sin tocar `aplicacion.tsx`.
 */
export function CajonDePreferencias(): ReactNode {
  const abierto = usePreferencias();
  return createElement(MandoDeTema, { abierto, alCerrar: cerrarLasPreferencias });
}
