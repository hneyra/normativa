import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { Aplicacion } from './aplicacion.tsx';
import { arrancar } from './arranque.ts';
import i18n from './i18n/i18n.ts';
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
 * Calcado de `rentas/frontend/src/main.tsx@ac379ac`, **y desde #60 tambien en el `I18nextProvider`**.
 * Lo que SI se calca desde el principio es que el montaje va DENTRO de `arrancar`.
 *
 * <h2>Por que el proveedor esta AQUI y no en `src/aplicacion.tsx`</h2>
 *
 * Porque `aplicacion.tsx` lo toca solo #55 (epica #47) y
 * `verificaciones/la-costura-es-la-que-es.test.ts` da rojo si importa `react-i18next` — nombrando a
 * #60 por su numero, que es la senal de que ese archivo no es el sitio. Este si lo es: es el
 * montaje, es lo que `rentas` hace, y envolver desde fuera vale igual porque el proveedor solo pone
 * la instancia en el contexto.
 *
 * Y no es estrictamente necesario —sin proveedor, `react-i18next` usa la instancia global, que
 * `i18n.ts` inicializa al importarse—, pero se pone igual: una instancia implicita es la que un dia
 * alguien deja de inicializar sin que nada lo diga.
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
      <I18nextProvider i18n={i18n}>
        <Aplicacion />
      </I18nextProvider>
    </StrictMode>,
  );
});
