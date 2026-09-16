import type { HojaDelCatalogo } from '@kamayuk/shell';
import { Pantalla, type DatosDeLaPantalla } from '@kamayuk/ui';
import { createElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { OPERACION_DE_GUARDAR } from '../datos/lecturas.ts';
import { guardarElSnapshot } from '../datos/publicacion.ts';
import { useDatosDeLaHoja } from '../datos/useDatosDeLaHoja.ts';
import { TEXTOS_DEL_INTERPRETE } from '../i18n/textosDelInterprete.ts';
import type { ClaveDeHoja } from './arbol.ts';
import { pantallaDe as definicionDe } from './definiciones/index.ts';
import { tonoDeLaInsignia } from './insignias.ts';
import type { Pantalla as DefinicionDeUnaPantalla } from './tipos.ts';

/**
 * **La pantalla de un destino, dibujada por el interprete de `@kamayuk/ui`** (#58, AC 5).
 *
 * El `Armazon` no sabe dibujar ninguna pantalla y no puede saberlo (ADR-0030 §4): recibe esta
 * funcion y la llama con la hoja abierta. Lo que devuelve es `<Pantalla>` —el interprete que
 * `kamayuk-lib`#27 subio de `rentas`— con la definicion de la hoja y **sin un solo dato**.
 *
 * <h2>Por que `createElement` y no JSX</h2>
 *
 * Porque este archivo es `index.ts` y no `index.tsx`, y eso no es una preferencia: `aplicacion.tsx`
 * lo importa por el especificador `'./pantallas/index.ts'` —la costura de #55, que este issue no
 * toca y que `verificaciones/la-costura-es-la-que-es.test.ts` exige literal—. Renombrarlo a `.tsx`
 * dejaria ese `import` sin resolver. Es **una** llamada, y partir el archivo en dos para escribir
 * `<Pantalla …>` dejaria la costura repartida en dos sitios por una cuestion de sintaxis.
 *
 * <h2>Lo que hace desde #63, y lo que sigue sin hacer</h2>
 *
 * · **Ya pide.** `useDatosDeLaHoja(clave)` es el unico sitio de este sistema desde el que sale una
 *   peticion de una pantalla; el interprete no puede pedir y no debe. La `AUSENCIA_SIN_CONECTAR`
 *   que este archivo declaraba —una sola frase para las cuatro hojas— se fue con ella: la redacta
 *   ahora `src/porQueNoHayDato.ts`, que distingue **tres** casos que no son el mismo.
 * · **Ya traduce, desde #60.** `traducir` y `textos` se le pasan desde {@link CuerpoDeLaHoja}, y
 *   entraron por aqui sin tocar `aplicacion.tsx`, que es lo que este archivo prometia.
 * · **No atiende ningun acto.** `actos`, `alHacer` y `navegacion` son de #66, #67 y #68: hasta
 *   entonces ninguna definicion declara uno, y un boton que nadie atiende sale impedido con su
 *   motivo — nunca mudo.
 */

/**
 * **La funcion que el `Armazon` llama, hecha con las definiciones que se le den** (#58, AC 5).
 *
 * Existe para que una prueba pueda inyectar dos definiciones **de la misma forma** y medir lo que
 * pasa al pasar de una hoja a otra, que es lo que hace
 * `verificaciones/la-hoja-no-hereda-lo-tecleado.test.tsx`. Con las definiciones de verdad no se
 * podria: las cuatro hojas de `normativa` tienen formas distintas, y React desmonta igual lo que no
 * cuadra — o sea que la prueba pasaria sin haber demostrado nada.
 *
 * <h2>La `key`, que es lo unico que impide que lo tecleado pase de una hoja a la siguiente</h2>
 *
 * Desde #60 la `key` va en {@link CuerpoDeLaHoja} y no en `<Pantalla>` directamente, y da lo mismo:
 * React desmonta el subarbol entero, y `<Pantalla>` es su unico hijo.
 *
 * `<Pantalla>` guarda lo tecleado en su propio `useState` (`paquetes/ui/interprete/Pantalla.tsx`).
 * Dos destinos cuya pantalla es **el mismo componente en el mismo sitio** comparten la instancia,
 * asi que un campo de la hoja A que caiga en la misma posicion y con el mismo tipo en la hoja B
 * conserva lo escrito. La `key` por destino desmonta y vuelve a montar, y con ello el estado se va.
 *
 * **Y esto es cinturon y tirantes, medido**: `@kamayuk/shell` ya envuelve la llamada en
 * `<Fragment key={hoja.destino.clave}>` desde `kamayuk-lib`#67 (`paquetes/shell/Armazon.tsx`,
 * `function Pantalla()`). Cuando #58 se escribio no lo hacia —el issue cita esas lineas sin `key`—,
 * y hoy si. La de aqui se queda por dos motivos: **(1)** `pantalla()` es publica de este modulo, y
 * quien la monte fuera del armazon —una prueba, un arnes— no hereda esa proteccion; **(2)** la
 * propiedad es de esta costura y no de la libreria, y atarla a que un paquete ajeno siga haciendo
 * lo mismo es exactamente el choque que `kamayuk-lib`#61 llama H35b y que sigue sin decidirse
 * (`kamayuk-lib`#86, AC-3): si esa decision fuera «conservar lo tecleado al salir y volver», la
 * libreria quitaria su `key` y esta seguiria diciendo lo que estas hojas necesitan.
 */
export function crearPantalla(
  definicion: (clave: ClaveDeHoja) => DefinicionDeUnaPantalla,
  usarLosDatos: (clave: ClaveDeHoja) => DatosDeLaPantalla = useDatosDeLaHoja,
): (hoja: HojaDelCatalogo) => ReactNode {
  return function pantalla(hoja: HojaDelCatalogo): ReactNode {
    const clave = hoja.destino.clave as ClaveDeHoja;
    return createElement(CuerpoDeLaHoja, {
      key: clave,
      clave,
      definicion: definicion(clave),
      usarLosDatos,
    });
  };
}

/**
 * **El cuerpo de una hoja, traducido** (#60, AC 3).
 *
 * <h2>Por que hay un componente en medio, y no una llamada suelta</h2>
 *
 * Porque el interprete traduce **por variable** —`traducir(campo.etiqueta)`— y ese `traducir` tiene
 * que ser el `t` de la sesion. Aqui SI hay donde poner un gancho: esto lo dibuja React, a diferencia
 * de `src/marca.ts` o `src/catalogo.ts`, que `src/aplicacion.tsx` consume como constantes. Asi que
 * el cuerpo de las cuatro hojas es lo unico de este sistema que se entera de un cambio de idioma
 * **sin esperar a la siguiente pintada**: `useTranslation()` se suscribe.
 *
 * <h2>Lo que se le pasa, y lo que no</h2>
 *
 * · **`traducir`** — las palabras de la definicion y de la ausencia. Envuelto y no pasado tal cual:
 *   `TFunction` acepta mas formas que `(texto: string) => string`, y atar la firma del interprete a
 *   la de i18next haria que una version nueva de i18next rompiera esta costura.
 * · **`textos`** — las palabras que el interprete dice por su cuenta. Ver `i18n/textosDelInterprete.ts`.
 * · **Los datos no pasan por `traducir`**, y eso lo garantiza el interprete y no esto: traducir un
 *   importe seria absurdo.
 *
 * <h2>Y desde #63, los DATOS: aqui es donde la hoja pide</h2>
 *
 * `useDatosDeLaHoja(clave)` es el unico sitio de este sistema desde el que sale una peticion de una
 * pantalla. Esta aqui y no en el interprete porque el interprete **no puede pedir** —no sabe que
 * sistema lo monta, y `@kamayuk/ui` no nombra ninguno—, y no esta en `src/aplicacion.tsx` porque ese
 * archivo es la costura de #55.
 *
 * La `clave` entra como `prop` y no se deduce de la definicion: dos hojas pueden tener la misma
 * forma —eso es justo lo que ejercita `la-hoja-no-hereda-lo-tecleado`— y lo que decide que se pide
 * es de que hoja se trata, no como esta dibujada.
 *
 * Y el gancho entra por `crearPantalla` **con su valor por omision**, por el mismo motivo por el
 * que las definiciones entran por ahi: el arnes de esa prueba inyecta dos hojas que NO estan en el
 * arbol, y `useDatosDeLaHoja` las cruzaria contra `hojaDe()`, que revienta a proposito con una
 * clave que no existe. Lo que esa prueba mide es la `key`, no de donde salen los datos.
 */
function CuerpoDeLaHoja({
  clave,
  definicion,
  usarLosDatos,
}: {
  readonly clave: ClaveDeHoja;
  readonly definicion: DefinicionDeUnaPantalla;
  readonly usarLosDatos: (clave: ClaveDeHoja) => DatosDeLaPantalla;
}) {
  const { t } = useTranslation();
  // Se llama incondicionalmente y en el mismo sitio de cada pintada: es un gancho, y la `key` por
  // destino hace que cambiar de hoja desmonte en vez de reconciliar.
  const datos = usarLosDatos(clave);

  return createElement(Pantalla, {
    definicion,
    datos,
    tonoDeLaInsignia,
    traducir: (texto: string) => t(texto),
    textos: TEXTOS_DEL_INTERPRETE,
    alHacer: LO_QUE_LAS_HOJAS_HACEN,
  });
}

/**
 * **Las operaciones que una accion de un bloque `hace`** (#67).
 *
 * Es el registro que `<Pantalla alHacer>` consulta por la clave que declara la definicion. Una
 * accion cuya clave no este aqui **no sale muda**: el interprete la dibuja impedida con «nadie
 * atiende esto» (`motivoDeLaAccion` de `@kamayuk/ui`), que es lo que hace que registrar mal una
 * clave se vea en la pantalla y no haya que descubrirlo pulsando.
 *
 * Hoy hay **una**, la de Publicacion: guardar como archivo los bytes cuyo `sha256` se comparo contra
 * el `ETag`. Va aqui y no en `src/acciones.ts` porque aquello es el pie del ARMAZON —cuatro actos
 * fijos para todas las hojas— y esto es una accion de un bloque de UNA hoja.
 */
const LO_QUE_LAS_HOJAS_HACEN = {
  [OPERACION_DE_GUARDAR]: () => {
    guardarElSnapshot();
  },
};

/**
 * Lo que se dibuja para un destino: su definicion, interpretada.
 *
 * El nombre es el de la costura de #55 —lo importa `src/aplicacion.tsx`, que este issue no toca— y
 * por eso la definicion entra con alias: el `pantallaDe` de `definiciones/index.ts` devuelve el
 * DATO, y este devuelve lo dibujado.
 */
export const pantallaDe: (hoja: HojaDelCatalogo) => ReactNode = crearPantalla(definicionDe);
