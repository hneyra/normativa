import type { CuentaEnLaBarra, OpcionDeSesion } from '@kamayuk/shell';
import type { ReactNode } from 'react';

/**
 * **Lo que la sesion pone en la barra** — costura de #55, la llenan #57 y #64.
 *
 * <h2>Por que la municipalidad y la cuenta estan AQUI y no en `src/marca.ts`</h2>
 *
 * Porque no nombran al sistema: nombran a quien entro y donde. Es la decision G2 (comentario del
 * dueño en #52, 2026-09-15): «la municipalidad no es estatica, es la de la sesion y se carga por
 * su UBIGEO; nunca va como literal», y «la cuenta, la de la sesion». El artboard V8 las escribe
 * como marcadores —`{municipalidad de la sesión}`, `{cuenta de la sesión}`— justamente para que
 * nadie las transcriba.
 *
 * Lo que costaria escribirlas esta medido en otro repositorio: `rentas` llevo
 * «Municipalidad Distrital de Catacaos» en su marco hasta su I-1, y la habria visto cualquier
 * municipalidad que no fuera Catacaos sin que ninguna prueba sobre los valores lo notara.
 *
 * <h2>Lo que hay hoy: marcadores, y ninguna opcion</h2>
 *
 * El `Armazon` exige `cuenta` y `opcionesDeSesion`: no son opcionales. Asi que se ponen los dos,
 * con lo unico que se puede afirmar sin identidad —que no hay sesion— y con la lista vacia. Una
 * opcion que no hiciera nada al pulsarla se lee como una pantalla rota, que es peor que no
 * ofrecerla.
 *
 * <h2>Quien las llena</h2>
 *
 * · **#57** trae `@kamayuk/sesion` y `@kamayuk/api`: la puerta PKCE, el canje del codigo y
 *   `GET /seguridad/sesion`, de donde salen el nombre, las iniciales y el cargo. Con ella llegan
 *   tambien la puerta caida —el peldaño que se dibuja cuando la identidad no contesta— y las
 *   opciones de cerrar sesion.
 * · **#64** filtra el catalogo por permisos y trae el resto del menu de sesion.
 * · La municipalidad por su UBIGEO la sirve `GET /seguridad/sesion/municipalidad`, que es de #54.
 */

/**
 * La entidad de la barra: la municipalidad de la sesion.
 *
 * Hoy no hay sesion, asi que dice que no la hay. **No es el nombre de ninguna municipalidad**, y
 * ese es el punto: el dia que alguien escriba uno aqui, la interfaz de las veinte instalaciones
 * dira el de la primera.
 */
export const ENTIDAD = 'Sin sesión';

/**
 * Quien entro. Hoy, nadie.
 *
 * `iniciales` son dos puntos medios y no dos letras: cualquier par de letras seria las iniciales
 * de alguien, y el circulo de la barra las dibuja como si fueran las suyas. `nota` se deja fuera
 * —es opcional— porque el cargo tambien sale del token y no hay nada que decir de el.
 */
export const CUENTA: CuentaEnLaBarra = {
  nombre: 'Sin sesión',
  iniciales: '··',
};

/** Ninguna, hasta #57. Ver el javadoc del archivo: una opcion muda se lee como un fallo. */
export const OPCIONES_DE_SESION: readonly OpcionDeSesion[] = [];

/**
 * **La puerta caida**: lo que se dibuja EN LUGAR de la aplicacion cuando la identidad no contesta.
 *
 * Hoy no dibuja nada y devuelve `null`, porque no hay puerta: `src/arranque.ts` no canjea ningun
 * codigo todavia. Existe como costura para que #57 no tenga que tocar `aplicacion.tsx`, que es lo
 * unico que este issue se reserva.
 *
 * Es una funcion de componente y no un elemento: `aplicacion.tsx` decide DONDE se dibuja, y quien
 * decide SI se dibuja es #57, desde aqui.
 */
export function PuertaCaida(): ReactNode {
  return null;
}

/**
 * **El cajon de preferencias**: el mando que cambia la identidad visual y el modo del tema.
 *
 * Hoy no dibuja nada. `@kamayuk/ui` ya publica `ProveedorDeTema` y `useTema` —el tema se aplica
 * igual—, pero el mando que lo cambia es una opcion del menu de sesion, o sea #57 y #64. Sin
 * sesion no hay menu donde colgarlo.
 */
export function CajonDePreferencias(): ReactNode {
  return null;
}
