import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { desinstalarProxyDeDatos, instalarProxyDeDatos } from '../api/proxy.ts';
import { Panel } from './Panel.tsx';
import { DECISIONES, SELLO_DE_2026, SIN_ARCHIVO } from './panel.ts';
import {
  problema,
  servidorQueContesta,
  unaPagina,
  type RespuestaFingida,
} from './servidorDePruebas.ts';

/**
 * El Panel, montado y **pidiendo los datos por HTTP** (AC1, AC1bis, AC2).
 *
 * El camino de todos los dias lo atiende el proxy de #13: la tarjeta que se ve aqui llego por
 * `GET /seguridad/parametros/ejercicios/{ejercicio}` y las versiones por
 * `GET /seguridad/parametros`. Si el proxy dejara de enrutar cualquiera de las dos, esto se
 * pondria rojo — que es lo que separa esta prueba de una que leyera las ediciones de un `import`.
 *
 * Los otros dos estados —la municipalidad sin ningun conjunto y la sesion sin el acceso
 * `parametros`— **no los puede dar el proxy**, que sirve un cuerpo fijo y no mira la peticion. Se
 * sustituye el transporte por rutas: ver `servidorDePruebas.ts`.
 */

const abierta = vi.fn();

beforeAll(() => {
  instalarProxyDeDatos();
});

afterAll(() => {
  desinstalarProxyDeDatos();
});

afterEach(() => {
  vi.restoreAllMocks();
  abierta.mockReset();
});

const RUTA_DEL_EJERCICIO = '/seguridad/parametros/ejercicios/2026';
const RUTA_DEL_LISTADO = '/seguridad/parametros';

/** El conjunto vigente de 2026, tal como lo publica `ConjuntoResource`. */
const VIGENTE = {
  id: 2,
  ejercicio: 2026,
  version: 2,
  estado: 'SELLADO',
  fechaSellado: '2026-09-06T15:22:00Z',
  usuarioSellado: 'hneyra',
};

const PRIMERA = {
  id: 1,
  ejercicio: 2026,
  version: 1,
  estado: 'SELLADO',
  fechaSellado: '2026-09-06T10:00:00Z',
  usuarioSellado: 'hneyra',
};

function conServidor(porRuta: Readonly<Record<string, RespuestaFingida>>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(servidorQueContesta(porRuta));
}

function montar(ejercicio = '2026') {
  const usuario = userEvent.setup();
  render(<Panel ejercicio={ejercicio} alAbrirEdicion={abierta} />);
  return usuario;
}

/** La tarjeta de estado del ejercicio, buscada por su encabezado. */
const tarjetaDeEstado = () =>
  screen.getByRole('region', { name: /El ejercicio 2026/ });

describe('AC1 — el estado del ejercicio, con 2026 sellado', () => {
  it('lo dice, con el conjunto y la version que el servidor resolvio', async () => {
    montar();

    expect(
      await screen.findByRole('heading', { name: 'El ejercicio 2026 está sellado' }),
    ).toBeInTheDocument();
    expect(within(tarjetaDeEstado()).getByText('Se puede emitir')).toBeInTheDocument();
    expect(within(tarjetaDeEstado()).getByText(/Rige el conjunto 2, versión 2/)).toBeInTheDocument();
  });

  it('y dice CON QUE se selló: 33 filas, 2 cuadros y 35 detalles', async () => {
    montar();
    await screen.findByRole('heading', { name: 'El ejercicio 2026 está sellado' });

    const sello = screen.getByRole('region', { name: 'Con qué se selló 2026' });

    expect(within(sello).getByText('Filas del derivado del corpus').nextElementSibling)
      .toHaveTextContent(String(SELLO_DE_2026.filasDelCorpus));
    expect(within(sello).getByText('Ediciones de cuadro nacional').nextElementSibling)
      .toHaveTextContent(String(SELLO_DE_2026.cuadros));
    expect(within(sello).getByText('Detalles compuestos').nextElementSibling)
      .toHaveTextContent(String(SELLO_DE_2026.detalles));
  });

  it('las DOS versiones selladas de 2026 se ven, y sólo una está marcada como vigente', async () => {
    montar();

    const versiones = await screen.findByRole('region', {
      name: 'Versiones selladas del ejercicio 2026',
    });
    const filas = within(versiones).getAllByRole('listitem');

    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Versión 2');
    expect(filas[0]).toHaveTextContent('06/09/2026 15:22 · hneyra');
    expect(within(filas[0]!).getByText('Vigente')).toBeInTheDocument();
    expect(
      within(filas[1]!).queryByText('Vigente'),
      'La lectura ordena por version y toma la ultima: marcar las dos diria que rigen dos.',
    ).toBeNull();
  });

  it('las DIEZ filas sin archivo van nombradas una a una, no como «faltan cosas»', async () => {
    montar();
    await screen.findByRole('heading', { name: 'El ejercicio 2026 está sellado' });

    const bloque = screen.getByRole('region', {
      name: /Lo que ese sello no incluye: 10 filas sin archivo del corpus/,
    });

    for (const fila of SIN_ARCHIVO) {
      expect(
        within(bloque).getByText(fila.que),
        `La fila ${fila.fila} del mapa normativo no se nombra: quien selle el conjunto de SU ` +
          'municipalidad no puede ver si es suya.',
      ).toBeInTheDocument();
    }
    expect(within(bloque).getAllByRole('row')).toHaveLength(SIN_ARCHIVO.length + 1);
    expect(within(bloque).getByText(/8 de D-02b y 2 de D-02c/)).toBeInTheDocument();
  });

  it('las cuatro decisiones se pintan con su estado real, y D-11 dice para qué ejercicio', async () => {
    montar();
    await screen.findByRole('heading', { name: 'El ejercicio 2026 está sellado' });

    const bloque = screen.getByRole('region', { name: /Decisiones del registro: 3 abiertas/ });

    for (const decision of DECISIONES) {
      const fila = within(bloque).getByText(decision.id).closest('li');
      expect(fila).not.toBeNull();
      expect(within(fila!).getByText(decision.estado)).toBeInTheDocument();
    }
    expect(within(bloque).getByText('Cerrada para 2026')).toBeInTheDocument();
    expect(within(bloque).getAllByText('Abierta')).toHaveLength(3);
    expect(within(bloque).getAllByText(/no se hereda/).length).toBeGreaterThan(0);
  });
});

describe('AC1bis — el vacío también se dibuja, y no como un fallo de carga', () => {
  it('una municipalidad recién implantada no tiene ningún conjunto, y se lee así', async () => {
    conServidor({
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: false, conjuntoId: null, version: null },
      },
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([]) },
    });
    montar();

    expect(
      await screen.findByRole('heading', {
        name: 'El ejercicio 2026 no tiene ningún conjunto sellado',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('No se puede emitir')).toBeInTheDocument();
    expect(screen.getByText(/es el estado de quien empieza/)).toBeInTheDocument();
    expect(
      screen.getByText(/El conjunto es POR MUNICIPALIDAD/),
      'Que 2026 este sellado en el corpus no le da un conjunto a esta municipalidad.',
    ).toBeInTheDocument();
  });

  it('«sellado: false» es un 200 y NO se pinta como error', async () => {
    conServidor({
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: false, conjuntoId: null, version: null },
      },
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([]) },
    });
    montar();
    await screen.findByRole('heading', {
      name: 'El ejercicio 2026 no tiene ningún conjunto sellado',
    });

    expect(
      screen.queryByText('No se pudo preguntar por el ejercicio'),
      '«No hay conjunto sellado» se arregla sellando uno; «no pude preguntarlo», levantando\n' +
        'algo. Pintarlos igual manda a la persona equivocada a mirar.',
    ).toBeNull();
  });

  it('y lleva su salida DENTRO: abrir la primera versión', async () => {
    conServidor({
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: false, conjuntoId: null, version: null },
      },
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([]) },
    });
    const usuario = montar();
    await screen.findByRole('heading', {
      name: 'El ejercicio 2026 no tiene ningún conjunto sellado',
    });

    await usuario.click(
      within(tarjetaDeEstado()).getByRole('button', { name: 'Abrir la primera versión' }),
    );

    expect(abierta).toHaveBeenCalledWith(null);
  });

  it('la lista de versiones también dice que no hay ninguna, con su acción', async () => {
    conServidor({
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: false, conjuntoId: null, version: null },
      },
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([]) },
    });
    montar();

    const versiones = await screen.findByRole('region', {
      name: 'Versiones selladas del ejercicio 2026',
    });

    expect(within(versiones).getByText('Ninguna versión sellada de 2026')).toBeInTheDocument();
    expect(
      within(versiones).getByRole('button', { name: 'Abrir la primera versión' }),
    ).toBeInTheDocument();
  });
});

describe('AC2 — el Panel funciona con MENOS privilegio que Ediciones', () => {
  it('sin el acceso «parametros» sigue diciendo si el ejercicio está sellado', async () => {
    // `GET /seguridad/parametros/ejercicios/{ejercicio}` va con el centinela SESION_PROPIA: la
    // ve cualquier autenticado. El listado si exige `parametros`, que es del modulo Seguridad.
    conServidor({
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: true, conjuntoId: 2, version: 2 },
      },
      [RUTA_DEL_LISTADO]: problema(
        'SIN_PRIVILEGIO',
        403,
        'No tiene el acceso «parametros» con privilegio LECTURA',
      ),
    });
    montar();

    expect(
      await screen.findByRole('heading', { name: 'El ejercicio 2026 está sellado' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Hace falta el acceso «parametros» para ver las versiones'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No se pudieron leer las versiones'),
      'Un privilegio que falta sale igual las veces que se pulse: ofrecer «reintentar»\n' +
        'manda a repetir algo que no puede cambiar.',
    ).toBeNull();
  });

  it('y una avería de verdad en el listado sí se dice como avería', async () => {
    conServidor({
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: true, conjuntoId: 2, version: 2 },
      },
      [RUTA_DEL_LISTADO]: problema('ERROR_INTERNO', 500, 'No se pudo completar la operacion'),
    });
    montar();

    expect(await screen.findByText('No se pudieron leer las versiones')).toBeInTheDocument();
    expect(
      screen.queryByText('Hace falta el acceso «parametros» para ver las versiones'),
    ).toBeNull();
  });

  it('si la lectura de sesión falla, ESO sí es un error y se dice', async () => {
    conServidor({
      [RUTA_DEL_EJERCICIO]: problema('ERROR_INTERNO', 500, 'No se pudo completar la operacion'),
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([VIGENTE, PRIMERA]) },
    });
    montar();

    expect(await screen.findByText('No se pudo preguntar por el ejercicio')).toBeInTheDocument();
  });

  it('mientras el ejercicio no ha llegado, la región lo anuncia con `aria-busy`', async () => {
    conServidor({
      [RUTA_DEL_EJERCICIO]: 'nunca-contesta',
      [RUTA_DEL_LISTADO]: 'nunca-contesta',
    });
    montar();

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'Versiones selladas del ejercicio 2026' }),
      ).toHaveAttribute('aria-busy', 'true');
    });
  });

  it('la tarjeta ofrece ir al conjunto que rige, y no a otro', async () => {
    const usuario = montar();
    await screen.findByRole('heading', { name: 'El ejercicio 2026 está sellado' });

    await usuario.click(
      within(tarjetaDeEstado()).getByRole('button', { name: 'Ver el conjunto 2' }),
    );

    expect(abierta).toHaveBeenCalledWith(2);
  });
});

describe('AC10 — ninguna cifra tributaria se escribe en la pantalla', () => {
  it('el Panel no enseña ninguna: los conteos no son cifras del dominio', async () => {
    montar();
    await screen.findByRole('heading', { name: 'El ejercicio 2026 está sellado' });

    // Las cinco marcas del corpus que el proxy sirve en el snapshot. Ninguna pertenece a esta
    // pantalla: aqui se dice CUANTAS hay, no CUANTO valen.
    for (const cifra of ['5500.00', '894.27', '104,780.00', '0.006', '0.68']) {
      expect(screen.queryByText(cifra, { exact: false })).toBeNull();
    }
  });
});
