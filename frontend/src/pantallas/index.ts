import type { HojaDelCatalogo } from '@kamayuk/shell';
import { Pantalla, type Ausencia, type TonoDeInsignia } from '@kamayuk/ui';
import { createElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { TEXTOS_DEL_INTERPRETE } from '../i18n/textosDelInterprete.ts';
import type { ClaveDeHoja } from './arbol.ts';
import { pantallaDe as definicionDe } from './definiciones/index.ts';
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
 * <h2>Lo que NO hace, dicho aqui y no descubierto luego</h2>
 *
 * · **No pide nada.** El interprete no puede pedir datos, y este sistema todavia no los pide: es
 *   #63. Lo unico que se le pasa es la ausencia, que es lo que se dibuja en cada hueco.
 * · **Ya traduce, desde #60.** `traducir` y `textos` se le pasan desde {@link CuerpoDeLaHoja}, y
 *   entraron por aqui sin tocar `aplicacion.tsx`, que es lo que este archivo prometia.
 * · **No atiende ningun acto.** `actos`, `alHacer` y `navegacion` son de #66, #67 y #68: hasta
 *   entonces ninguna definicion declara uno, y un boton que nadie atiende sale impedido con su
 *   motivo — nunca mudo.
 */

/**
 * **Por que no hay dato**, y en las dos formas que el interprete necesita.
 *
 * Se declaro en #55 como la mitad de la costura que este issue no debia inventar, y ahora la usan
 * las cuatro hojas. El texto se calca de `rentas/frontend/src/porQueNoHayDato.ts@ac379ac`
 * —`NADA_SERVIDO`—, que es donde se redacto: una pantalla sin conectar dice que lo que se ve es su
 * FORMA, no sus datos.
 *
 * Tono `info` y no `atencion` porque no es una averia: es el estado esperado hasta la ola 5.
 */
export const AUSENCIA_SIN_CONECTAR: Ausencia = {
  enElCampo: 'sin conectar',
  explicacion:
    'Esta pantalla todavia no esta conectada: ninguna de las operaciones que declara la sirve el ' +
    'backend. Lo que se ve es su forma —que campos tiene y que columnas llevan sus listas—, no ' +
    'sus datos.',
  tono: 'info',
};

/**
 * **El tono de una celda de situacion**, deducido de lo que dice.
 *
 * El interprete lo exige y **no tiene valor por omision**, a proposito: uno que pintara todo de
 * `ok` dibujaria «Abierta» en verde sin que nada lo delatara. Es vocabulario de cada sistema, asi
 * que vive aqui y no en la libreria.
 *
 * La tabla es la de `const TONOS` del artboard V8 —su `porTexto` y su `resto`—, y que lo siga
 * siendo lo comprueba `verificaciones/pantallas-del-artboard.test.ts` contra esa constante.
 *
 * <h2>Lo que esta funcion NO puede decir, y su hueco</h2>
 *
 * El artboard tiene ademas un `porFila`: `D-03d` dice «Abierta» y se pinta en `atencion`, porque no
 * bloquea el sello sino el cierre de caja. **Aqui no cabe**: el interprete pasa el TEXTO de la
 * celda y nada mas, asi que las dos filas que dicen «Abierta» salen del mismo color. Es el hueco
 * H18 de `frontend/diseno/HUECOS.md` —el tono como dato de la fila—, que `kamayuk-lib`#65 ya
 * publica como `ReglaDeLaInsignia` y que usara la definicion de #65.
 */
export function tonoDeLaInsignia(texto: string): TonoDeInsignia {
  switch (texto.toLowerCase()) {
    case 'abierta':
      return 'mal';
    case 'abierto':
      return 'atencion';
    case 'vigente':
      return 'info';
    default:
      return 'ok';
  }
}

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
): (hoja: HojaDelCatalogo) => ReactNode {
  return function pantalla(hoja: HojaDelCatalogo): ReactNode {
    return createElement(CuerpoDeLaHoja, {
      key: hoja.destino.clave,
      definicion: definicion(hoja.destino.clave as ClaveDeHoja),
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
 */
function CuerpoDeLaHoja({ definicion }: { readonly definicion: DefinicionDeUnaPantalla }) {
  const { t } = useTranslation();

  return createElement(Pantalla, {
    definicion,
    datos: { ausencia: AUSENCIA_SIN_CONECTAR },
    tonoDeLaInsignia,
    traducir: (texto: string) => t(texto),
    textos: TEXTOS_DEL_INTERPRETE,
  });
}

/**
 * Lo que se dibuja para un destino: su definicion, interpretada.
 *
 * El nombre es el de la costura de #55 —lo importa `src/aplicacion.tsx`, que este issue no toca— y
 * por eso la definicion entra con alias: el `pantallaDe` de `definiciones/index.ts` devuelve el
 * DATO, y este devuelve lo dibujado.
 */
export const pantallaDe: (hoja: HojaDelCatalogo) => ReactNode = crearPantalla(definicionDe);
