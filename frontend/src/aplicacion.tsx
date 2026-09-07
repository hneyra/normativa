import { Marco } from './marco/Marco.tsx';

/**
 * El casco de `normativa-web`.
 *
 * Desde F-3 monta **el marco V6**: la barra global, el arbol de los diez modulos, las
 * pestanas, el enrutado por hash y el estado sin guardar. **Y ninguna pantalla**: el lienzo
 * declara su hueco y dice en que issue llega cada seccion, en vez de aparentar que ya esta.
 *
 * Esta linea no vuelve a tocarse cuando lleguen #14 y #15, que es lo que el reparto
 * pretendia: una seccion entra por debajo del marco, no por encima del casco.
 */
export function Aplicacion() {
  return <Marco />;
}
