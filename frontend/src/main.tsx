import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Aplicacion } from './aplicacion.tsx';
import { arrancar } from './arranque.ts';
// El UNICO sitio donde se importa una hoja de estilos. `src/estilos.css` no define ni un color:
// importa la de `@kamayuk/ui` —que publica la paleta y los temas— y le dice a Tailwind donde
// mirar, porque por omision omite `node_modules` y la libreria vive ahi por el `link:`. El motivo
// entero, con lo que costo descubrirlo en `rentas`, esta dentro de ese archivo.
import './estilos.css';

/**
 * **El montaje** (#55).
 *
 * Hasta #50 aqui se montaba un `<StrictMode />` vacio y la imagen servia una raiz sin nada. Ahora
 * se monta el `Armazon` de `@kamayuk/shell`, todavia sin una sola hoja: ver `aplicacion.tsx`.
 *
 * Calcado de `rentas/frontend/src/main.tsx@ac379ac` menos una pieza que aqui no ha llegado: el
 * `I18nextProvider`, que es de #60. Lo que SI se calca es que el montaje va DENTRO de `arrancar`.
 *
 * Que falte `#raiz` es un error y no un silencio: `createRoot(null)` revienta igual, pero con un
 * mensaje de React que no dice que archivo hay que mirar.
 */
const raiz = document.getElementById('raiz');

if (raiz === null) {
  throw new Error('index.html no tiene un elemento #raiz donde montar la interfaz');
}

// El montaje va DENTRO de `arrancar`, no despues: lo que #57 mete ahi —el canje del codigo de
// autorizacion— tiene que ocurrir antes de que la primera pantalla pida nada. Ver `arranque.ts`.
void arrancar(() => {
  createRoot(raiz).render(
    <StrictMode>
      <Aplicacion />
    </StrictMode>,
  );
});
