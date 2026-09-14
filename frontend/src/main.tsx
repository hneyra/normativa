import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * **Una raiz vacia, y a proposito** (#50).
 *
 * La V6 salio entera y la interfaz nueva se monta sobre el `Armazon` de `@kamayuk/shell`
 * (#55) con las cuatro hojas de #58. Hasta entonces esto monta React sobre `#raiz` y no dibuja
 * nada: lo justo para que `yarn build` produzca un `dist/` de verdad —con `index.html`, el
 * guion de las senias y un paquete que arranca— y la imagen tenga algo que servir.
 *
 * Que falte `#raiz` es un error y no un silencio: `createRoot(null)` revienta igual, pero con un
 * mensaje de React que no dice que archivo hay que mirar.
 */
const raiz = document.getElementById('raiz');

if (raiz === null) {
  throw new Error('index.html no tiene un elemento #raiz donde montar la interfaz');
}

createRoot(raiz).render(<StrictMode />);
