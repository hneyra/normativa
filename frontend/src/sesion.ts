import { crearIdentidad, peldanoDe } from '@kamayuk/sesion';
import { ubicacionDe, type CuentaEnLaBarra, type OpcionDeSesion } from '@kamayuk/shell';
import { createElement, type ReactNode } from 'react';

import { configuracion } from './configuracion.ts';
import type { MunicipalidadResource, SesionResource } from './datos/lecturas.ts';
import { t } from './i18n/i18n.ts';
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
 * <h2>De donde sale cada una desde #64: de `/seguridad`, y no de los claims</h2>
 *
 * #57 encendio la puerta entera —la ida, el canje, los dos frenos, salir— y las cuatro opciones del
 * menu, y dejo la cuenta y la entidad como dos marcadores porque `Identidad` no publicaba los claims
 * del `id_token`. **Eso ya no es asi**: [`kamayuk-lib`#70](https://github.com/hneyra/kamayuk-lib/issues/70)
 * se cerro y `identidad.quienEntro()` devuelve `{ nombre, usuario, municipalidad }` leidos de ese
 * token. #64 lee las dos de la API igualmente, por dos motivos medidos:
 *
 *   · **la entidad no esta en el token**: el claim `municipalidad_id` es un IDENTIFICADOR, y el
 *     nombre de la municipalidad solo lo publica `GET /seguridad/sesion/municipalidad`, que lo
 *     resuelve por su UBIGEO (G2). Esa lectura hace falta de todos modos;
 *   · **la cuenta, la del backend y no la del emisor**: `GET /seguridad/sesion` resuelve la cuenta
 *     del token a SU fila de `usuario` en esta municipalidad —la misma cuenta son dos filas en dos
 *     municipalidades, medido en `LecturasDeSeguridadDePuntaAPuntaTest`— y contesta 404 si no es
 *     usuario de aqui. El claim `name` diria un nombre aunque la cuenta no tuviera alta.
 *
 * Aqui vive COMO se dicen —{@link cuentaDe} y {@link entidadDe}, funciones puras— y no QUIEN las
 * pide: lo que las pide usa el cliente de la API, y el cliente lee `identidad` de este archivo al
 * cargarse. El ciclo, y lo que costaba, esta medido en `src/datos/useCatalogoPermitido.ts`, que es
 * la costura por donde entran.
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
 * **Lo que este archivo dice, en castellano, que es la clave** (#60).
 *
 * Los rotulos ya no se escriben dentro de cada sitio donde se usan: viven aqui para que entren
 * solos en el inventario del locale (`src/i18n/catalogo-de-claves.ts`). Un rotulo escrito dentro de
 * su `t()` obligaria a acordarse de listarlo a mano, y el olvido no produce ningun rojo.
 *
 * **Ninguna nombra a una municipalidad ni a una persona**, que es la decision G2 (#52): eso es dato
 * de la sesion y se PIDE. Lo que hay son las dos frases de mientras se pide, que dicen eso mismo.
 */
export const FRASES_DE_LA_SESION = {
  /**
   * La entidad de la barra **mientras se pide** la municipalidad de la sesion.
   *
   * **No es el nombre de ninguna municipalidad**, y ese es el punto: el dia que alguien escriba uno
   * aqui, la interfaz de las veinte instalaciones dira el de la primera.
   */
  averiguandoLaEntidad: 'Averiguando la municipalidad de la sesión…',
  /** Y quien entro, mientras se pide. Por el mismo motivo. */
  averiguandoLaCuenta: 'Averiguando quién entró…',
  miPerfil: 'Mi perfil',
  cambiarLaContrasena: 'Cambiar la contrasena',
  preferencias: 'Preferencias',
  cerrarSesion: 'Cerrar sesión',
} as const;

/**
 * **Como esta una de las dos lecturas de la barra**: pidiendo, fallo o lista.
 *
 * Es la forma minima de lo que TanStack Query sabe de una consulta, y se declara aqui y no se
 * importa de alli: {@link cuentaDe} y {@link entidadDe} son funciones puras, se prueban sin montar
 * nada, y no tienen por que saber quien pide.
 */
export type LecturaDeLaSesion<T> =
  | { readonly estado: 'pidiendo' }
  | { readonly estado: 'fallo'; readonly error: unknown }
  | { readonly estado: 'lista'; readonly dato: T };

/**
 * El circulo de la cuenta cuando **no hay de quien** dibujar iniciales: mientras se pide, o si fallo.
 *
 * Dos puntos medios y no dos letras: cualquier par de letras seria las iniciales de alguien, y el
 * circulo las dibuja como si fueran las suyas. La V6 escribia «H. Neyra Alama»
 * (`c01fe9a:src/marco/BarraGlobal.tsx:70-76`), y eso no vuelve. No pasa por `t()` y no debe: dos
 * puntos medios no son una palabra.
 */
export const SIN_INICIALES = '··';

/**
 * Las dos letras del circulo: la primera de las dos primeras palabras del nombre, en mayuscula.
 *
 * Nombre y primer apellido, que es como `rentas` hacia `JC` de «J. Cardenas Vega». Un nombre de una
 * sola palabra da una letra, y uno vacio, {@link SIN_INICIALES}. (El ejemplo no es el de la captura
 * a proposito: lo que viaja en el `.map` lleva los comentarios, y la captura no viaja.)
 * `Array.from` y no `[0]`: una letra con tilde puede llegar descompuesta en dos unidades de codigo.
 */
export function inicialesDe(nombre: string): string {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra !== '')
    .slice(0, 2)
    .map((palabra) => (Array.from(palabra)[0] ?? '').toLocaleUpperCase('es'));
  return letras.join('') === '' ? SIN_INICIALES : letras.join('');
}

/**
 * **Quien entro, como lo dibuja la barra**, a partir de `GET /seguridad/sesion` (#64, AC 5).
 *
 *   · **pidiendo** — la frase de mientras se pide, como CAPTADOR: quien lee la propiedad es el
 *     marco al pintar, y resolverla aqui la congelaria en el idioma del arranque;
 *   · **fallo** — lo que dice la escalera de `@kamayuk/sesion`, su titulo y su detalle, **sin
 *     traduccion paralela** (la misma regla que las hojas, #63). Nunca un nombre de ejemplo;
 *   · **lista** — el nombre de la fila de `usuario` y, debajo, la cuenta con que se entro. Los dos
 *     son DATO y no pasan por `t()`: un nombre de persona no se traduce.
 */
export function cuentaDe(quien: LecturaDeLaSesion<SesionResource>): CuentaEnLaBarra {
  switch (quien.estado) {
    case 'pidiendo':
      return {
        get nombre() {
          return t(FRASES_DE_LA_SESION.averiguandoLaCuenta);
        },
        iniciales: SIN_INICIALES,
      };
    case 'fallo': {
      const peldano = peldanoDe(quien.error);
      return { nombre: peldano.titulo, iniciales: SIN_INICIALES, nota: peldano.detalle };
    }
    case 'lista': {
      // Un nombre en blanco no es un nombre: se dice la cuenta, que el token siempre trae.
      const nombre = quien.dato.nombre.trim() === '' ? quien.dato.cuenta : quien.dato.nombre;
      return { nombre, iniciales: inicialesDe(nombre), nota: quien.dato.cuenta };
    }
  }
}

/**
 * **La entidad de la barra**: la municipalidad de la sesion, de `GET /seguridad/sesion/municipalidad`
 * (#64, AC 5, y G2 de #52). Nunca un literal.
 *
 * Mientras se pide, la frase que lo dice; si fallo, el titulo del peldano de la escalera —«si la
 * ruta falla, la barra lo dice con la escalera de errores y no pone un nombre de ejemplo», que es
 * lo que G2 fija—; y lista, el nombre que el backend resolvio por su UBIGEO.
 */
export function entidadDe(donde: LecturaDeLaSesion<MunicipalidadResource>): string {
  switch (donde.estado) {
    case 'pidiendo':
      return t(FRASES_DE_LA_SESION.averiguandoLaEntidad);
    case 'fallo':
      return peldanoDe(donde.error).titulo;
    case 'lista':
      return donde.dato.nombre;
  }
}

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
 * **Los rotulos pasan por `t()` desde #60**, y como captadores: el castellano de
 * {@link FRASES_DE_LA_SESION} es la clave, y quien lee la propiedad es el marco al pintar el menu.
 * Resolverlos al importar los congelaria en el idioma del arranque.
 */
export const OPCIONES_DE_SESION: readonly OpcionDeSesion[] = [
  {
    get rotulo() {
      return t(FRASES_DE_LA_SESION.miPerfil);
    },
    al: () => {
      identidad.abrirLaCuenta('perfil');
    },
  },
  {
    get rotulo() {
      return t(FRASES_DE_LA_SESION.cambiarLaContrasena);
    },
    al: () => {
      identidad.abrirLaCuenta('contrasena');
    },
  },
  {
    get rotulo() {
      return t(FRASES_DE_LA_SESION.preferencias);
    },
    al: () => {
      abrirLasPreferencias();
    },
  },
  // `peligrosa`: la que no se deshace. El armazon la pinta en la tinta del error.
  {
    get rotulo() {
      return t(FRASES_DE_LA_SESION.cerrarSesion);
    },
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
