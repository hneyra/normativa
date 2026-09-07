import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Marco } from './Marco.tsx';

/**
 * El marco, montado. AC1 a AC10.
 *
 * Lo que se prueba aqui es lo que solo se ve con el arbol de React puesto: que abrir no
 * cierre el panel, que el hash lo escriba `replaceState`, que el asterisco aparezca al
 * escribir, que el dialogo ofrezca sus TRES salidas, que un submodulo ajeno abra su ficha y
 * que el toast se apague solo a los 3400 ms. La aritmetica de las pestanas se prueba sin
 * navegador en `pestanas.test.ts`, el filtro en `filtro.test.ts` y el arbol contra el
 * artboard en `verificaciones/arbol-del-artboard.test.ts`: montar el marco para comprobar
 * que cerrar la primera de tres activa la segunda diria menos y costaria un `render`.
 */

const limpiarElHash = () => {
  window.history.replaceState(null, '', '/');
};

beforeEach(limpiarElHash);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  limpiarElHash();
});

/** El panel de la izquierda. */
const arbol = () => screen.getByRole('complementary', { name: 'Módulos y submódulos' });

/** La cabecera de un modulo del arbol: es la unica con `aria-expanded`. */
const modulo = (rotulo: string, abierto = false) =>
  within(arbol()).getByRole('button', { name: new RegExp(`^${rotulo}`), expanded: abierto });

/**
 * Un submodulo del arbol.
 *
 * No basta con el rotulo: «Valores» es a la vez un submodulo del modulo Valores y un MODULO
 * entero, y «Panel» es el rotulo de un submodulo en los diez. Lo que los separa es el
 * atributo: una hoja lleva `aria-current` —esta o no esta activa— y una cabecera de modulo
 * lleva `aria-expanded`.
 */
function submodulo(rotulo: string): HTMLElement {
  const hojas = within(arbol())
    .getAllByRole('button', { name: new RegExp(`^${rotulo}`) })
    .filter((boton) => boton.hasAttribute('aria-current'));
  const primera = hojas[0];
  if (hojas.length !== 1 || primera === undefined) {
    throw new Error(`Se esperaba un submodulo «${rotulo}» visible, y hay ${hojas.length}.`);
  }
  return primera;
}

const barraDePestanas = () => screen.getByRole('group', { name: 'Pestañas abiertas' });

/** Los rotulos de las pestanas abiertas, en su orden, con su asterisco. */
function pestanas(): string[] {
  return within(barraDePestanas())
    .queryAllByRole('button')
    .filter((boton) => boton.getAttribute('aria-label') === null)
    .map((boton) => boton.textContent ?? '');
}

/** El rotulo de la pestana activa. */
function activa(): string | null {
  const boton = within(barraDePestanas())
    .queryAllByRole('button')
    .find((candidato) => candidato.getAttribute('aria-current') === 'true');
  return boton?.textContent ?? null;
}

const titulo = () => screen.getByRole('heading', { level: 1 }).textContent;

/**
 * Lanza un toast sin `userEvent`, para las dos pruebas que corren con reloj falso.
 *
 * Cambiar de ejercicio es el gesto mas corto que lo dispara: una sola interaccion y ninguna
 * pestana de por medio.
 */
const lanzarUnToast = () => {
  fireEvent.change(screen.getByLabelText('Ejercicio de trabajo'), { target: { value: '2025' } });
};

/** Escribe en la observacion del hueco, que es lo que ensucia la pestana (AC6). */
const ensuciar = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.click(submodulo('Ediciones'));
  await usuario.type(screen.getByLabelText('Observación'), 'Ratificada por acuerdo');
};

describe('AC1 — el arbol, con Normativa dentro y sin los tres de otro repositorio', () => {
  it('los diez modulos estan; Catastro, Tesorería y Rentas · Registro no', () => {
    render(<Marco />);

    // Nueve cerrados y «Normativa» abierto: diez cabeceras de modulo.
    expect(within(arbol()).getAllByRole('button', { expanded: false })).toHaveLength(9);
    expect(modulo('Normativa', true)).toBeInTheDocument();
    expect(within(arbol()).queryByRole('button', { name: /^Catastro/ })).toBeNull();
    expect(within(arbol()).queryByRole('button', { name: /^Tesorería/ })).toBeNull();
    expect(within(arbol()).queryByRole('button', { name: /^Rentas/ })).toBeNull();
  });

  it('Normativa arranca desplegado, con sus cuatro submodulos', () => {
    render(<Marco />);

    expect(submodulo('Panel')).toBeInTheDocument();
    expect(submodulo('Ediciones')).toBeInTheDocument();
    expect(submodulo('Cuadros de valuación')).toBeInTheDocument();
    expect(submodulo('Publicación')).toBeInTheDocument();
  });
});

describe('AC2 — la variante A, y solo esa', () => {
  it('el panel esta, y no hay ningun conmutador A/B/C', () => {
    render(<Marco />);

    expect(arbol()).toBeInTheDocument();
    expect(within(arbol()).queryByRole('button', { name: /^A$/ })).toBeNull();
    expect(within(arbol()).queryByRole('button', { name: /^B$/ })).toBeNull();
    expect(within(arbol()).queryByRole('button', { name: /^C$/ })).toBeNull();
    expect(
      within(arbol())
        .getAllByRole('button')
        .filter((boton) => boton.hasAttribute('aria-pressed')),
      'El conmutador era lo unico del panel con `aria-pressed`.',
    ).toEqual([]);
  });

  it('la cola de trabajo se muestra, y con sus tres filas', () => {
    render(<Marco />);

    expect(within(arbol()).getByText('Cola de trabajo')).toBeInTheDocument();
    expect(
      within(arbol()).getByRole('button', { name: /^Ejercicios sin conjunto/ }),
    ).toBeInTheDocument();
    expect(
      within(arbol()).getByRole('button', { name: /^Ediciones abiertas/ }),
    ).toBeInTheDocument();
    expect(
      within(arbol()).getByRole('button', { name: /^Filas sin archivo del corpus/ }),
    ).toBeInTheDocument();
  });

  it('y sigue mostrandose con el filtro puesto y sin coincidencias', async () => {
    // El caso que la variante `c` no tenia: `hayCola` era `v !== 'c'`, no `sinFiltro`. Si la
    // cola colgara de algo, el sitio donde se notaria es este.
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.type(screen.getByLabelText('Filtrar módulos y submódulos'), 'zzz');

    expect(within(arbol()).getByText('Cola de trabajo')).toBeInTheDocument();
  });
});

describe('AC3 — la barra global', () => {
  it('lleva sus piezas en el orden del AC3', () => {
    render(<Marco />);

    const nombres = within(screen.getByRole('banner'))
      .getAllByRole('button')
      .map((boton) => boton.getAttribute('aria-label'));

    expect(nombres).toEqual([
      'Mostrar u ocultar las secciones de Normativa',
      'Ver todos los módulos',
      '1 aviso del sistema',
      'Buscar',
      'Sesión de H. Neyra Alama',
    ]);
  });

  it('la hamburguesa dice si el panel esta desplegado, y lo alterna', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    const alternar = screen.getByRole('button', {
      name: 'Mostrar u ocultar las secciones de Normativa',
    });

    expect(alternar).toHaveAttribute('aria-expanded', 'true');

    await usuario.click(alternar);
    expect(screen.queryByRole('complementary', { name: 'Módulos y submódulos' })).toBeNull();
    expect(alternar).toHaveAttribute('aria-expanded', 'false');

    await usuario.click(alternar);
    expect(arbol()).toBeInTheDocument();
  });

  it('el selector de ejercicio vive en la barra, no en una pantalla', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    const selector = screen.getByLabelText('Ejercicio de trabajo');
    expect(within(screen.getByRole('banner')).getByLabelText('Ejercicio de trabajo')).toBe(
      selector,
    );

    await usuario.selectOptions(selector, '2027');

    expect(screen.getByRole('status').textContent).toContain('Ejercicio 2027');
    expect(
      titulo(),
      'el ejercicio es de la sesion: cambiarlo no cambia de pestana',
    ).toBe('Panel de Normativa');
    expect(screen.getByText('Ejercicio 2027')).toBeInTheDocument();
  });

  it('el lanzador lista los diez modulos y abre el Panel del que se elige', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(screen.getByRole('button', { name: 'Ver todos los módulos' }));
    const lanzador = screen.getByRole('dialog', { name: 'Módulos del sistema' });
    expect(within(lanzador).getAllByRole('button')).toHaveLength(10);

    await usuario.click(within(lanzador).getByRole('button', { name: /Seguridad/ }));

    expect(pestanas()).toEqual(['Panel', 'Panel']);
    expect(titulo(), 'la de Seguridad, no la de Normativa').toBe('Panel');
  });

  it('el menu de sesion dice quien no puede publicar un valor normativo', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(screen.getByRole('button', { name: 'Sesión de H. Neyra Alama' }));

    const menu = screen.getByRole('menu', { name: 'Sesión' });
    expect(within(menu).getByText(/rol_carga_parametros/)).toBeInTheDocument();
  });

  it('y avisa de las pestanas con cambios sin guardar', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);

    await usuario.click(screen.getByRole('button', { name: 'Sesión de H. Neyra Alama' }));

    expect(
      within(screen.getByRole('menu', { name: 'Sesión' })).getByText(
        /Hay 1 pestaña con cambios sin guardar/,
      ),
    ).toBeInTheDocument();
  });
});

describe('AC4 — abrir un submodulo', () => {
  it('lo anade a las pestanas, y no cierra el panel', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(modulo('Coactiva'));
    await usuario.click(submodulo('Expedientes'));

    expect(pestanas()).toEqual(['Panel', 'Expedientes']);
    expect(activa()).toBe('Expedientes');
    expect(arbol(), 'el panel es persistente: no se cierra al elegir').toBeInTheDocument();
  });

  it('si ya estaba abierto, solo lo activa', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(modulo('Coactiva'));
    await usuario.click(submodulo('Expedientes'));
    await usuario.click(within(barraDePestanas()).getByRole('button', { name: 'Panel' }));
    await usuario.click(submodulo('Expedientes'));

    expect(pestanas()).toEqual(['Panel', 'Expedientes']);
    expect(activa()).toBe('Expedientes');
  });
});

describe('AC5 — el enrutado por hash', () => {
  it('abrir una seccion escribe su slug con replaceState, nunca con pushState', async () => {
    const apilar = vi.spyOn(window.history, 'pushState');
    const usuario = userEvent.setup();
    render(<Marco />);

    expect(window.location.hash, 'al montar, el hash ya dice donde se esta').toBe('#panel');

    await usuario.click(submodulo('Cuadros de valuación'));

    expect(window.location.hash).toBe('#cuadros');
    expect(
      apilar,
      'Cambiar de pestana no es navegar: con `pushState` haria falta un «atras» por cada\n' +
        'pestana abierta para salir de la aplicacion.',
    ).not.toHaveBeenCalled();
  });

  it('recargar sobre «#cuadros» reabre esa seccion, CON su pestana', () => {
    window.history.replaceState(null, '', '#cuadros');

    render(<Marco />);

    expect(titulo()).toBe('Cuadros de valuación');
    expect(pestanas()).toEqual(['Panel', 'Cuadros de valuación']);
    expect(activa()).toBe('Cuadros de valuación');
  });

  it('un hash de una hoja ajena tambien la reabre', () => {
    window.history.replaceState(null, '', '#coa-exp');

    render(<Marco />);

    expect(titulo()).toBe('Expedientes');
    expect(activa()).toBe('Expedientes');
  });

  it('«hashchange» navega', () => {
    render(<Marco />);

    act(() => {
      window.history.replaceState(null, '', '#publicacion');
      window.dispatchEvent(new Event('hashchange'));
    });

    expect(titulo()).toBe('Publicación');
    expect(activa()).toBe('Publicación');
  });

  it('un hash que no abre nada no cambia nada', () => {
    render(<Marco />);

    act(() => {
      window.history.replaceState(null, '', '#lo-que-sea');
      window.dispatchEvent(new Event('hashchange'));
    });

    expect(titulo()).toBe('Panel de Normativa');
  });
});

describe('AC6 — el estado sin guardar', () => {
  it('editar un campo marca la pestana activa con un asterisco', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    expect(pestanas()).toEqual(['Panel']);
    await ensuciar(usuario);

    expect(pestanas()).toEqual(['Panel', 'Ediciones *']);
  });

  it('el asterisco tambien sale en el arbol, donde se elige la seccion', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await ensuciar(usuario);

    expect(submodulo('Ediciones').textContent).toContain('*');
  });

  it('cerrarla pregunta, y ofrece las TRES salidas', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);

    await usuario.click(
      screen.getByRole('button', { name: 'Cerrar Ediciones — tiene cambios sin guardar' }),
    );

    const dialogo = screen.getByRole('dialog', { name: 'Cerrar con cambios sin guardar' });
    expect(within(dialogo).getByRole('button', { name: 'Guardar y cerrar' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Descartar y cerrar' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Seguir editando' })).toBeInTheDocument();
    expect(pestanas(), 'preguntar no cierra').toEqual(['Panel', 'Ediciones *']);
  });

  it('«Seguir editando» deja la pestana, y sigue sucia', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);
    await usuario.click(
      screen.getByRole('button', { name: 'Cerrar Ediciones — tiene cambios sin guardar' }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Seguir editando' }));

    expect(screen.queryByRole('dialog', { name: 'Cerrar con cambios sin guardar' })).toBeNull();
    expect(pestanas()).toEqual(['Panel', 'Ediciones *']);
  });

  it('«Descartar y cerrar» cierra, y no dice que guardo nada', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);
    await usuario.click(
      screen.getByRole('button', { name: 'Cerrar Ediciones — tiene cambios sin guardar' }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Descartar y cerrar' }));

    expect(pestanas()).toEqual(['Panel']);
    expect(screen.queryByText(/Cambios guardados/)).toBeNull();
  });

  it('«Guardar y cerrar» cierra y lo dice', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);
    await usuario.click(
      screen.getByRole('button', { name: 'Cerrar Ediciones — tiene cambios sin guardar' }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Guardar y cerrar' }));

    expect(pestanas()).toEqual(['Panel']);
    expect(screen.getByRole('status').textContent).toContain('Cambios guardados en Ediciones.');
  });

  it('cerrar una pestana LIMPIA no pregunta', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.click(submodulo('Publicación'));

    await usuario.click(screen.getByRole('button', { name: 'Cerrar Publicación' }));

    expect(screen.queryByRole('dialog', { name: 'Cerrar con cambios sin guardar' })).toBeNull();
    expect(pestanas()).toEqual(['Panel']);
  });

  it('cerrar la activa pasa a la vecina de la izquierda, y a la derecha si no la hay', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.click(submodulo('Ediciones'));
    await usuario.click(submodulo('Publicación'));

    await usuario.click(screen.getByRole('button', { name: 'Cerrar Publicación' }));
    expect(activa()).toBe('Ediciones');

    await usuario.click(within(barraDePestanas()).getByRole('button', { name: 'Panel' }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar Panel' }));
    expect(pestanas()).toEqual(['Ediciones']);
    expect(activa()).toBe('Ediciones');
  });

  it('cerrar la ultima deja el espacio vacio, y lo dice', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(screen.getByRole('button', { name: 'Cerrar Panel' }));

    expect(pestanas()).toEqual([]);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('No hay ningún submódulo abierto')).toBeInTheDocument();
  });
});

describe('AC7 — el estado de la seccion vive en el marco', () => {
  it('lo escrito sobrevive a irse a otra pestana y volver', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);
    expect(screen.getByLabelText('Observación')).toHaveValue('Ratificada por acuerdo');

    await usuario.click(within(barraDePestanas()).getByRole('button', { name: 'Panel' }));
    // El marco DESMONTA la seccion: el campo ya no existe mientras se mira otra pestana.
    expect(screen.getByLabelText('Observación')).not.toHaveValue('Ratificada por acuerdo');

    await usuario.click(within(barraDePestanas()).getByRole('button', { name: /^Ediciones/ }));

    expect(
      screen.getByLabelText('Observación'),
      'Con el estado dentro de la seccion, volver la encontraria en blanco y con el\n' +
        'asterisco puesto: la pestana diria que hay cambios y no habria ninguno que ver.',
    ).toHaveValue('Ratificada por acuerdo');
  });

  it('y cada seccion tiene la suya, no una compartida', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);

    // «Panel» y no «Publicación»: desde #15 la seccion de Publicacion esta CONSTRUIDA y no
    // ofrece campo de observacion, porque en ella no se escribe nada —sirve un conjunto ya
    // sellado, o sea inmutable—. Lo que este caso mide sigue siendo lo mismo: dos secciones
    // con hueco tienen dos observaciones distintas, no una compartida.
    await usuario.click(submodulo('Panel'));

    expect(screen.getByLabelText('Observación')).toHaveValue('');
  });
});

describe('AC8 — el teclado', () => {
  it('Ctrl+K abre la paleta y Ctrl+K la cierra', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: 'Buscar' })).toBeInTheDocument();

    await usuario.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).toBeNull();
  });

  it('Cmd+K hace lo mismo, que es el atajo del mismo gesto en otro teclado', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.keyboard('{Meta>}k{/Meta}');

    expect(screen.getByRole('dialog', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('y llama a preventDefault, porque Ctrl+K es atajo del navegador', () => {
    render(<Marco />);
    const evento = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });

    act(() => {
      window.dispatchEvent(evento);
    });

    expect(
      evento.defaultPrevented,
      'Sin `preventDefault`, la paleta se abre y el foco se va a la barra de direcciones.',
    ).toBe(true);
  });

  it('se opera con flechas y Enter', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.keyboard('{Control>}k{/Control}');

    await usuario.type(screen.getByLabelText('Buscar un destino'), 'cartera');
    const paleta = screen.getByRole('dialog', { name: 'Buscar' });
    expect(within(paleta).getByText('2 resultados')).toBeInTheDocument();

    // El primero es «Cartera y lotes», de Valores; el segundo, «Cartera y medidas», de
    // Coactiva, que es el orden del arbol. Una flecha abajo elige el segundo.
    await usuario.keyboard('{ArrowDown}');
    await usuario.keyboard('{Enter}');

    expect(screen.queryByRole('dialog', { name: 'Buscar' })).toBeNull();
    expect(activa()).toBe('Cartera y medidas');
  });

  // Sobre CUATRO resultados y acabando en el tercero, no en el primero. Con dos resultados y
  // acabando arriba, esta prueba pasaria tambien con un `Enter` que abriera siempre el
  // primero —o sea, con las flechas rotas—. `plazos` casa en Tránsito, Infracciones,
  // Coactiva y Autorizaciones, en ese orden, que es el del arbol.
  it('la flecha arriba retrocede, y no vuelve al primero', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.keyboard('{Control>}k{/Control}');
    await usuario.type(screen.getByLabelText('Buscar un destino'), 'plazos');
    expect(within(screen.getByRole('dialog', { name: 'Buscar' })).getByText('4 resultados'));

    await usuario.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}');
    await usuario.keyboard('{Enter}');

    expect(activa()).toBe('Costas y plazos');
  });

  it('el indice se acota: ni por arriba ni por abajo se sale de la lista', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.keyboard('{Control>}k{/Control}');
    await usuario.type(screen.getByLabelText('Buscar un destino'), 'plazos');

    // Nueve abajo sobre cuatro resultados: se queda en el ultimo, no se sale ni da la
    // vuelta. Y tres arriba desde el primero, en el primero.
    await usuario.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    await usuario.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    await usuario.keyboard('{Enter}');
    expect(activa()).toBe('Trámites y plazos');

    await usuario.keyboard('{Control>}k{/Control}');
    await usuario.type(screen.getByLabelText('Buscar un destino'), 'plazos');
    await usuario.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await usuario.keyboard('{Enter}');
    expect(activa()).toBe('Cuadros y plazos');
  });

  it('la paleta lista destinos y NADA de datos', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.keyboard('{Control>}k{/Control}');

    await usuario.type(screen.getByLabelText('Buscar un destino'), 'uit');

    expect(
      within(screen.getByRole('dialog', { name: 'Buscar' })).getByText('0 resultados'),
      'Buscar parametros son datos, y los datos son de #13. Una paleta que contestara con\n' +
        'una UIT estaria publicando una cifra normativa desde el codigo.',
    ).toBeInTheDocument();
  });

  it('Escape cierra la paleta', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.keyboard('{Control>}k{/Control}');

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Buscar' })).toBeNull();
  });

  it('Escape cierra el lanzador de modulos', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.click(screen.getByRole('button', { name: 'Ver todos los módulos' }));
    expect(screen.getByRole('dialog', { name: 'Módulos del sistema' })).toBeInTheDocument();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Módulos del sistema' })).toBeNull();
  });

  it('Escape cierra el menu de sesion', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.click(screen.getByRole('button', { name: 'Sesión de H. Neyra Alama' }));
    expect(screen.getByRole('menu', { name: 'Sesión' })).toBeInTheDocument();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: 'Sesión' })).toBeNull();
  });

  it('Escape cierra el dialogo de confirmacion, y no cierra la pestana', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await ensuciar(usuario);
    await usuario.click(
      screen.getByRole('button', { name: 'Cerrar Ediciones — tiene cambios sin guardar' }),
    );

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Cerrar con cambios sin guardar' })).toBeNull();
    expect(pestanas(), 'Escape es «seguir editando», no «descartar»').toEqual([
      'Panel',
      'Ediciones *',
    ]);
  });
});

describe('AC9 — la pestana ajena', () => {
  it('un submodulo de otro modulo abre su ficha, y dice de que sistema es', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(modulo('Valores'));
    await usuario.click(submodulo('Cartera y lotes'));

    expect(titulo()).toBe('Cartera y lotes');
    expect(
      screen.getByText(/está diseñada en el archivo de Valores/),
      'Sin ningun modulo ajeno en el arbol este caso no existe: es lo que el AC1 sostiene.',
    ).toBeInTheDocument();
    expect(screen.getByText('Valores · Emisión y notificación')).toBeInTheDocument();
  });

  it('se puede tener abierta a la vez que una propia, y volver a ella', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.click(modulo('Valores'));
    await usuario.click(submodulo('Cartera y lotes'));

    await usuario.click(within(barraDePestanas()).getByRole('button', { name: 'Panel' }));
    expect(titulo()).toBe('Panel de Normativa');

    await usuario.click(within(barraDePestanas()).getByRole('button', { name: 'Cartera y lotes' }));

    expect(titulo()).toBe('Cartera y lotes');
    expect(pestanas()).toEqual(['Panel', 'Cartera y lotes']);
  });

  it('una ficha ajena no ofrece el campo de observacion: aqui no se edita nada', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(modulo('Valores'));
    await usuario.click(submodulo('Cartera y lotes'));

    expect(screen.queryByLabelText('Observación')).toBeNull();
  });

  it('«Cerrar la pestaña» de la ficha la cierra', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);
    await usuario.click(modulo('Valores'));
    await usuario.click(submodulo('Cartera y lotes'));

    await usuario.click(screen.getByRole('button', { name: 'Cerrar la pestaña' }));

    expect(pestanas()).toEqual(['Panel']);
  });
});

describe('AC10 — el aviso de servicio y el toast son dos cosas distintas', () => {
  it('el aviso se abre desde la campana, se anuncia y se descarta a mano', async () => {
    const usuario = userEvent.setup();
    render(<Marco />);

    await usuario.click(screen.getByRole('button', { name: '1 aviso del sistema' }));

    const aviso = screen.getByRole('status');
    expect(aviso.textContent).toContain('no tiene ningún conjunto de parámetros');

    await usuario.click(screen.getByRole('button', { name: 'Descartar el aviso' }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(
      screen.queryByRole('button', { name: '1 aviso del sistema' }),
      'descartado es descartado: la campana no vuelve',
    ).toBeNull();
  });

  it('el toast vive 3400 ms y se apaga solo', () => {
    // Con reloj falso el gesto NO se hace con `userEvent`: su `delay` por omision espera a
    // un temporizador que solo avanza si alguien lo avanza, y la prueba se cuelga —medido:
    // 5 000 ms de timeout—. `fireEvent` dispara el mismo `change` que React escucha, sin
    // temporizador de por medio.
    vi.useFakeTimers();
    render(<Marco />);

    lanzarUnToast();
    expect(screen.getByRole('status').textContent).toContain('Ejercicio 2025');

    act(() => {
      vi.advanceTimersByTime(3399);
    });
    expect(screen.queryByRole('status'), 'a los 3399 ms todavia esta').not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('y su reloj se cancela al desmontar', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Marco />);

    lanzarUnToast();
    expect(vi.getTimerCount(), 'el reloj del toast esta corriendo').toBeGreaterThan(0);

    unmount();

    expect(
      vi.getTimerCount(),
      'Sin el `return () => clearTimeout(reloj)`, el reloj sobrevive al arbol y a los\n' +
        '3400 ms llama a `setState` sobre un componente que ya no existe.',
    ).toBe(0);
  });
});
