import { useSyncExternalStore } from 'react';

/**
 * **Si el cajon de preferencias esta abierto** (#57, AC 6).
 *
 * <h2>Por que un estado de modulo y no un `useState`</h2>
 *
 * En `rentas` los dos extremos viven en el mismo componente: `aplicacion.tsx` tiene el
 * `useState(preferencias)`, se lo pasa al `<MandoDeTema>` y la opcion «Preferencias» del menu lo
 * pone a `true` (`ac379ac:src/aplicacion.tsx:220-224, 242-247`).
 *
 * Aqui los dos extremos estan en archivos distintos **y ninguno es `aplicacion.tsx`**, que lo toca
 * solo #55 (epica #47): quien abre es una entrada de `OPCIONES_DE_SESION` —una constante de
 * modulo, no un componente— y quien dibuja es `CajonDePreferencias`, la otra costura. Un `useState`
 * no se puede compartir entre esos dos sin subirlo a `aplicacion.tsx`, que es justo lo prohibido.
 *
 * <h2>`useSyncExternalStore` y no un `setter` guardado en una variable de modulo</h2>
 *
 * Porque es la API que React publica para exactamente esto: un dato que vive fuera de React y del
 * que un componente quiere enterarse. Guardar el `setter` en una variable de modulo «funciona»
 * hasta que hay dos montajes a la vez —que es lo que hace Testing Library entre pruebas— y
 * entonces el segundo pisa al primero y el primero se queda escribiendo en un arbol desmontado,
 * con el aviso de React por toda senal.
 *
 * El nombre del gancho empieza por `use` y no por `usar`: es lo tecnico, que va en ingles, y
 * ademas es lo unico que hace que `react-hooks/rules-of-hooks` lo reconozca como gancho. Con
 * `usarLasPreferencias`, ESLint lo ve como una funcion normal que llama a un gancho y da rojo.
 */

let abierto = false;

/** Quien quiere enterarse. Un `Set` y no una lista: desuscribirse es quitar, no buscar. */
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

/** Lo abre. Es lo que hace la opcion «Preferencias» del menu de sesion. */
export function abrirLasPreferencias(): void {
  abierto = true;
  avisar();
}

/** Lo cierra. Lo llama el propio cajon: con Escape, con el velo o con su aspa. */
export function cerrarLasPreferencias(): void {
  abierto = false;
  avisar();
}

/**
 * Si esta abierto, para quien lo dibuja.
 *
 * `getServerSnapshot` —el tercer argumento— es el mismo que el del cliente: este dato no depende
 * del navegador y su valor inicial es `false` en los dos lados. Esta interfaz no se dibuja en
 * servidor, pero omitirlo seria dejar puesta la unica forma de que esto reviente al hacerlo.
 */
export function usePreferencias(): boolean {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
    () => abierto,
    () => false,
  );
}
