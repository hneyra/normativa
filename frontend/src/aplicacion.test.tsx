import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fijarToken, olvidarLaParada } from './api/identidad.ts';
import { Aplicacion } from './aplicacion.tsx';

/**
 * La prueba vive JUNTO al codigo (F-1, AC6). No comprueba una pantalla —eso es de
 * `marco/Marco.test.tsx` y de las secciones—: prueba que el andamiaje esta enchufado de
 * verdad, jsdom incluido. Sin ella, `vitest run` en un proyecto sin ninguna prueba sale en
 * verde y `yarn verificar` no verificaria nada.
 *
 * Hasta F-3 miraba el `<h1>Normativa</h1>` del casco de relleno; hasta #39, que el casco montara
 * el marco sin mas. **Desde #39 el casco tiene una decision**, y es la que se prueba: con token,
 * el marco; sin token, la puerta. Lo que hace cara esa decision es la salida equivocada — un
 * marco dibujado sin token ensena un panel sin ediciones, unos cuadros vacios y una publicacion
 * sin conjuntos, que se ven exactamente igual que «no hay nada», en el sistema cuyo trabajo
 * entero es decir que cifra rige.
 */

beforeEach(() => {
  sessionStorage.clear();
  fijarToken(null);
  olvidarLaParada();
});

afterEach(() => {
  sessionStorage.clear();
  fijarToken(null);
  olvidarLaParada();
});

describe('el casco de normativa-web', () => {
  it('con token monta el marco V6: su barra, su arbol y su barra de pestañas', () => {
    fijarToken('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbmlzdHJhZG9yIn0.firma');

    render(<Aplicacion />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Módulos y submódulos' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Pestañas abiertas' })).toBeInTheDocument();
  });

  it('sin token NO monta el marco: monta la puerta, y dice por que', () => {
    render(<Aplicacion />);

    // Ni barra, ni arbol, ni pestanas: no se dibuja un sistema vacio que se lea como «no hay
    // nada publicado».
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pestañas abiertas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a identificarse' })).toBeInTheDocument();
  });
});
