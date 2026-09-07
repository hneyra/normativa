import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { desinstalarProxyDeDatos, instalarProxyDeDatos } from '../api/proxy.ts';
import { Ediciones } from './Ediciones.tsx';
import { ORDENES_ADMITIDOS, TAMANO_MAXIMO } from './conjuntos.ts';
import { EDICIONES_AL_EMPEZAR, type EstadoDeEdiciones } from './estadoDeNormativa.ts';
import { OBSERVACION_MINIMA } from './ediciones.ts';
import {
  problema,
  servidorQueContesta,
  unaPagina,
  type RespuestaFingida,
} from './servidorDePruebas.ts';

/**
 * «Ediciones», montada y **pidiendo los datos por HTTP** (AC3 a AC10).
 *
 * El camino de todos los dias lo atiende el proxy de #13: el listado llega por
 * `GET /seguridad/parametros`, la ficha por `GET /conjuntos/{id}/snapshot` —con su huella
 * comprobada— y las tres escrituras por las rutas que ADR-0025 §5 anticipa, con **las negativas
 * literales de `AdministrarParametros`**. Los desenlaces que el proxy no puede dar —el listado
 * que no llega, el detalle que falla, la pagina vacia, la que nunca contesta— se dibujan
 * sustituyendo el transporte por rutas (`servidorDePruebas.ts`).
 *
 * El estado de la seccion vive **fuera** de ella, porque el marco la desmonta al cambiar de
 * pestana; aqui se monta con un contenedor minimo que hace lo mismo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../../..');
const ADMINISTRAR = join(
  RAIZ,
  'backend/kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros/aplicacion',
  'AdministrarParametros.java',
);

/**
 * Une las concatenaciones que Spotless parte: `"abc" + "def"` → `"abcdef"`.
 *
 * Sin esto, un `grep` del mensaje completo sale **vacio aunque el mensaje este ahi letra por
 * letra**: el formateador del backend corta las cadenas largas y el texto vive en dos literales.
 * Es la misma trampa que `datos/formas.test.ts` documenta, y la copia es de cuatro lineas a
 * proposito: importar de un archivo de pruebas registraria sus `describe` dentro de este.
 */
function unirCadenas(java: string): string {
  let anterior = java;
  for (;;) {
    const unido = anterior.replace(/"\s*\+\s*"/g, '');
    if (unido === anterior) return unido;
    anterior = unido;
  }
}

const ensuciada = vi.fn();
const avisada = vi.fn();

beforeAll(() => {
  instalarProxyDeDatos();
});

afterAll(() => {
  desinstalarProxyDeDatos();
});

afterEach(() => {
  vi.restoreAllMocks();
  ensuciada.mockReset();
  avisada.mockReset();
});

const RUTA_DEL_EJERCICIO = '/seguridad/parametros/ejercicios/2026';
const RUTA_DEL_LISTADO = '/seguridad/parametros';

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

/** El contenedor que hace lo que hace el marco: guardar el estado de la seccion. */
function Contenedor({ inicial }: { readonly inicial?: Partial<EstadoDeEdiciones> }) {
  const [estado, fijar] = useState<EstadoDeEdiciones>({ ...EDICIONES_AL_EMPEZAR, ...inicial });
  return (
    <Ediciones
      ejercicio="2026"
      estado={estado}
      alCambiar={(cambio) => {
        fijar((actual) => ({ ...actual, ...cambio }));
      }}
      alEnsuciar={ensuciada}
      alAvisar={avisada}
    />
  );
}

function montar(inicial?: Partial<EstadoDeEdiciones>) {
  const usuario = userEvent.setup();
  render(<Contenedor inicial={inicial} />);
  return usuario;
}

/** Las filas del listado, en su orden, por su titulo. */
function listadas(): string[] {
  return screen
    .queryAllByRole('button')
    .filter((boton) => boton.className.split(' ').includes('kn-ediciones__fila'))
    .map((boton) => boton.querySelector('.kn-ediciones__titulo')?.textContent ?? '');
}

/** Espera a que el listado del proxy este servido. */
async function conLaListaServida() {
  await screen.findByText('Ejercicio 2026 · versión 2');
}

const ficha = () => screen.getByRole('tablist', { name: 'Pasos de la edición' });
const paso = (rotulo: string) => within(ficha()).getByRole('tab', { name: rotulo });
const observacion = () => screen.getByLabelText('Observación');

describe('AC3 — el listado, paginado de verdad', () => {
  it('las filas dicen ejercicio, versión, estado, sello y el identificador', async () => {
    montar();
    await conLaListaServida();

    const fila = screen.getByText('Ejercicio 2026 · versión 2').closest('button');

    expect(fila).toHaveTextContent('SELLADO');
    expect(fila).toHaveTextContent('06/09/2026 15:22 · hneyra');
    expect(fila).toHaveTextContent('conjunto 2');
  });

  it('el estado se pinta con su INSIGNIA y su texto, nunca sólo con color', async () => {
    montar();
    await conLaListaServida();

    const sellada = screen.getByText('Ejercicio 2026 · versión 2').closest('button');
    const abierta = screen.getByText('Ejercicio 2027 · versión 1').closest('button');

    expect(within(sellada!).getByText('SELLADO')).toHaveClass('kn-insignia--ok');
    expect(within(abierta!).getByText('ABIERTO')).toHaveClass('kn-insignia--atencion');
  });

  it('dos conjuntos SELLADOS de 2026 no son un error: se ven los dos y se marca cuál rige', async () => {
    montar();
    await conLaListaServida();

    const v2 = screen.getByText('Ejercicio 2026 · versión 2').closest('button');
    const v1 = screen.getByText('Ejercicio 2026 · versión 1').closest('button');

    expect(within(v2!).getByText('Vigente')).toBeInTheDocument();
    expect(
      within(v1!).queryByText('Vigente'),
      'La lectura ordena por version y toma la ultima; sin la marca, quien mire dos sellos de\n' +
        '2026 concluye que el sistema se contradice.',
    ).toBeNull();
  });

  it('el orden ofrece los CUATRO campos que el backend admite, y ninguno más', async () => {
    montar();
    await conLaListaServida();

    const selector = screen.getByLabelText('Ordenar por');
    const opciones = within(selector).getAllByRole('option').map((opcion) =>
      opcion.getAttribute('value'),
    );

    expect(opciones).toEqual([...ORDENES_ADMITIDOS]);
    expect(
      opciones,
      'Cualquier otro contesta 422 ORDEN_NO_ADMITIDO, y ese rechazo no lo entiende nadie\n' +
        'mirando una lista.',
    ).not.toContain('fechaSellado');
  });

  it('cambiar el orden vuelve a pedir la lista con «?ordenarPor=», y desde la página cero', async () => {
    const espia = vi.spyOn(globalThis, 'fetch');
    const usuario = montar({ pagina: 3 });
    await waitFor(() => {
      expect(espia).toHaveBeenCalled();
    });

    await usuario.selectOptions(screen.getByLabelText('Ordenar por'), 'version');

    await waitFor(() => {
      const pedidas = espia.mock.calls.map(([entrada]) => String(entrada));
      expect(pedidas.some((url) => url.includes('ordenarPor=version&'))).toBe(true);
      expect(
        pedidas.some((url) => url.includes('ordenarPor=version') && url.includes('pagina=0')),
        'Cambiar el criterio con la pagina cuatro puesta ensena la pagina cuatro de OTRO orden.',
      ).toBe(true);
    });
  });

  it('el tamaño de página no pasa de 500, que es `Paginacion.TAMANO_MAXIMO`', async () => {
    montar();
    await conLaListaServida();

    const tamanos = within(screen.getByLabelText('Por página'))
      .getAllByRole('option')
      .map((opcion) => Number(opcion.getAttribute('value')));

    expect(Math.max(...tamanos)).toBe(TAMANO_MAXIMO);
  });

  it('la paginación dice en qué página está, y no ofrece una siguiente que no hay', async () => {
    montar();
    await conLaListaServida();

    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Anterior' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('el buscador y los chips filtran sobre la página servida, y el conteo lo dice', async () => {
    const usuario = montar();
    await conLaListaServida();
    expect(listadas()).toHaveLength(3);

    await usuario.click(screen.getByRole('button', { name: 'Selladas' }));

    expect(listadas()).toEqual([
      'Ejercicio 2026 · versión 2',
      'Ejercicio 2026 · versión 1',
    ]);
    expect(screen.getByText(/2 de 3 · 3 en total/)).toBeInTheDocument();
  });
});

describe('AC4 — los cuatro estados de la lista, en este orden', () => {
  it('1) error TOTAL: sin listado no hay nada que enseñar, y se ofrece reintentar', async () => {
    conServidor({
      [RUTA_DEL_LISTADO]: problema('ERROR_INTERNO', 500, 'No se pudo completar la operacion'),
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: true, conjuntoId: 2, version: 2 },
      },
    });
    montar();

    expect(await screen.findByText('No se pudieron leer las ediciones')).toBeInTheDocument();
    expect(screen.getByText(/ERROR_INTERNO \(500\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('2) error PARCIAL: la lista llega y el detalle que dice cuál rige, no', async () => {
    conServidor({
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([VIGENTE, PRIMERA]) },
      [RUTA_DEL_EJERCICIO]: problema('ERROR_INTERNO', 500, 'No se pudo completar la operacion'),
    });
    montar();

    expect(await screen.findByText('No se pudo resolver cuál conjunto rige')).toBeInTheDocument();
    expect(
      listadas(),
      'Callar el fallo del detalle seria peor que no tener el dato: la lista se dibuja igual.',
    ).toHaveLength(2);
    expect(screen.queryByText('No se pudieron leer las ediciones')).toBeNull();
  });

  it('3) cargando: filas de esqueleto, y la región lo anuncia con `aria-busy`', async () => {
    conServidor({
      [RUTA_DEL_LISTADO]: 'nunca-contesta',
      [RUTA_DEL_EJERCICIO]: 'nunca-contesta',
    });
    const { container } = render(<Contenedor />);

    await waitFor(() => {
      expect(container.querySelector('.kn-ediciones__filas')).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });
    expect(container.querySelectorAll('.kn-esqueleto').length).toBeGreaterThan(0);
    expect(screen.getByText('Cargando las ediciones…')).toBeInTheDocument();
  });

  it('4) vacío, con su acción DENTRO', async () => {
    conServidor({
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([]) },
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: false, conjuntoId: null, version: null },
      },
    });
    montar();

    const vacio = await screen.findByText('Ninguna edición todavía');
    const aviso = vacio.closest<HTMLElement>('.kn-aviso');

    expect(within(aviso!).getByRole('button', { name: 'Abrir una versión' })).toBeInTheDocument();
  });

  it('y el vacío del filtro NO dice lo mismo que el vacío de la municipalidad', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.type(screen.getByLabelText('Buscar en las ediciones'), 'v9');

    expect(screen.getByText('Ninguna edición coincide')).toBeInTheDocument();
    expect(screen.queryByText('Ninguna edición todavía')).toBeNull();
  });
});

describe('AC5 — la ficha del conjunto, con sus siete campos literales', () => {
  it('las siete columnas están, y la del valor va alineada a la derecha', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));
    await screen.findByRole('columnheader', { name: 'Documento fuente' });

    const cabeceras = screen
      .getAllByRole('columnheader')
      .map((celda) => celda.textContent ?? '');

    expect(cabeceras).toEqual([
      'Tipo',
      'Clave',
      'Valor numérico',
      'Valor de texto',
      'Vigente desde',
      'Vigente hasta',
      'Documento fuente',
    ]);
    expect(screen.getByRole('columnheader', { name: 'Valor numérico' })).toHaveClass(
      'kn-tabla__th--cifra',
    );
  });

  it('las filas llegan del snapshot, con su huella comprobada, y se cuentan', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));

    expect(await screen.findByText('33 filas')).toBeInTheDocument();
    // La UIT de 2026, del corpus. Llega por HTTP: no la escribe esta pantalla.
    expect(screen.getByText('5500.00')).toBeInTheDocument();
  });

  it('una celda sin dato lleva guion, no una celda en blanco', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));
    await screen.findByText('33 filas');

    // La UIT no lleva clave, y su vigencia si tiene fin. `TRAMO_PREDIAL` es al reves.
    const fila = screen.getByText('5500.00').closest('tr');
    const celdas = within(fila!).getAllByRole('cell').map((celda) => celda.textContent);

    expect(celdas[1], 'La UIT no tiene clave: eso se dice con un guion.').toBe('—');
    expect(celdas[3]).toBe('—');
  });

  it('el documento fuente NO se recorta: es lo que hace auditable cada cifra', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));
    await screen.findByText('33 filas');

    const fuente = screen.getByText('D.S. N.° 301-2025-EF');

    expect(fuente.textContent).not.toContain('…');
    expect(fuente).toHaveClass('kn-tabla__td--fuente');
  });

  it('un conjunto ABIERTO no tiene documento que leer, y lo dice sin pedirlo', async () => {
    const espia = vi.spyOn(globalThis, 'fetch');
    const usuario = montar();
    await conLaListaServida();

    await usuario.click(screen.getByText('Ejercicio 2027 · versión 1'));

    expect(
      await screen.findByText(/todavía no tiene documento sellado que leer/),
    ).toBeInTheDocument();
    expect(
      espia.mock.calls.map(([entrada]) => String(entrada)).filter((url) => url.includes('/snapshot')),
      'SnapshotController contesta 404 sobre un conjunto sin sellar: pedirlo seria fabricar\n' +
        'un error que no lo es.',
    ).toEqual([]);
  });
});

describe('AC6 — los tres formularios, con la observación obligatoria', () => {
  it('la ficha de un conjunto ofrece los cuatro pasos; sin conjunto, sólo el que abre', async () => {
    const usuario = montar();
    await conLaListaServida();
    expect(within(ficha()).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Abrir versión',
    ]);

    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));

    expect(within(ficha()).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Parámetros del conjunto',
      'Abrir versión',
      'Agregar parámetro',
      'Sellar',
    ]);
  });

  // «Clave» va como expresion regular y no como cadena: es el unico campo OPCIONAL de los
  // tres formularios, y `Campo` mete la palabra «opcional» DENTRO de su `<label>` —que es lo
  // que hace que un lector de pantalla la anuncie—, asi que su rotulo accesible es
  // «Claveopcional» y una comparacion exacta no lo encuentra.
  it.each<readonly [string, readonly (string | RegExp)[]]>([
    ['Abrir versión', ['Ejercicio', 'Versión que se asignará', 'Observación']],
    ['Agregar parámetro', ['Conjunto', 'Tipo', /^Clave/, 'Vigente desde', 'Observación']],
    ['Sellar', ['Conjunto', 'Lo que se congela', 'Observación']],
  ])('«%s» dibuja sus campos, y uno de ellos es la observación', async (rotulo, etiquetas) => {
    const usuario = montar();
    await conLaListaServida();
    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));

    await usuario.click(paso(rotulo));

    for (const etiqueta of etiquetas) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
    }
    expect(observacion()).toBeInTheDocument();
  });

  it('la ayuda de la observación dice el mínimo, que es el CHECK de la base', async () => {
    montar();
    await conLaListaServida();

    expect(screen.getByText(/Sin observación no se guarda \(regla 10\)/)).toHaveTextContent(
      `Al menos ${String(OBSERVACION_MINIMA)} caracteres`,
    );
  });

  it('escribir en un campo ensucia la pestaña', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.type(observacion(), 'Se abre 2027');

    expect(ensuciada).toHaveBeenCalled();
  });
});

describe('AC7 — la validación no grita antes de tiempo', () => {
  it('mientras se escribe no hay ningún rojo', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.type(observacion(), 'ab');

    expect(screen.queryByText('Este dato es obligatorio.')).toBeNull();
    expect(screen.queryByText('Sin observación no se guarda (regla 10).')).toBeNull();
  });

  it('el rojo aparece AL PRIMER INTENTO, y nombra los dos que faltan', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.click(screen.getByRole('button', { name: 'Abrir la versión' }));

    expect(screen.getByText('Este dato es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('Sin observación no se guarda (regla 10).')).toBeInTheDocument();
  });

  it('el motivo se dice en el pie, en el `title` del botón y en el toast, y es EL MISMO', async () => {
    const usuario = montar();
    await conLaListaServida();
    const boton = screen.getByRole('button', { name: 'Abrir la versión' });
    const motivo = 'Queda 1 dato obligatorio sin llenar.';

    expect(boton).toHaveAttribute('title', motivo);
    expect(screen.getByText(motivo)).toBeInTheDocument();

    await usuario.click(boton);

    expect(avisada).toHaveBeenCalledWith(motivo);
  });

  it('el botón usa `aria-disabled` y NO `disabled`: sigue en el recorrido del tabulador', async () => {
    montar();
    await conLaListaServida();
    const boton = screen.getByRole('button', { name: 'Abrir la versión' });

    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(
      boton,
      'Un control deshabilitado sale del recorrido del tabulador, y en ventanilla se trabaja\n' +
        'con teclado: quien lo recorre se saltaria el boton que explica por que no puede.',
    ).not.toBeDisabled();
  });

  it('con todo escrito la compuerta se abre y el pie deja de reprochar', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.selectOptions(screen.getByLabelText('Ejercicio'), '2027');
    await usuario.type(observacion(), 'Se abre la version de 2027');

    const boton = screen.getByRole('button', { name: 'Abrir la versión' });
    expect(boton).toHaveAttribute('aria-disabled', 'false');
    expect(boton).not.toHaveAttribute('title');
    expect(screen.getByText(/Queda en la bitácora con su observación/)).toBeInTheDocument();
  });
});

describe('AC8 — las dos negativas del sellado, con su texto real', () => {
  const java = unirCadenas(readFileSync(ADMINISTRAR, 'utf8'));

  it('sellar un conjunto ya sellado dice lo que dice el backend, sin reescribirlo', async () => {
    const usuario = montar();
    await conLaListaServida();
    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));
    await usuario.click(paso('Sellar'));

    await usuario.type(observacion(), 'Se intenta sellar otra vez');
    await usuario.click(screen.getByRole('button', { name: 'Sellar el conjunto' }));

    const negativa = await screen.findByRole('alert');
    const texto =
      'El conjunto 2 ya esta sellado; corregirlo exige una version nueva (ADR-0007)';

    expect(negativa).toHaveTextContent(texto);
    expect(
      java,
      'El backend redacta este mensaje. Reescribirlo «para que se lea mejor» ensena a la\n' +
        'pantalla un error que el backend no manda, y el desajuste no aparece hasta que\n' +
        'alguien intenta sellar dos veces en produccion.',
    ).toContain(' ya esta sellado; corregirlo exige una version nueva (ADR-0007)');
  });

  it('sellar uno vacío dice la otra, que se arregla al revés', async () => {
    const usuario = montar();
    await conLaListaServida();
    await usuario.click(screen.getByText('Ejercicio 2027 · versión 1'));
    await usuario.click(paso('Sellar'));

    await usuario.type(observacion(), 'Se sella el ejercicio 2027');
    await usuario.click(screen.getByRole('button', { name: 'Sellar el conjunto' }));

    const negativa = await screen.findByRole('alert');
    const texto =
      'El conjunto 3 no tiene ningun parametro: sellarlo vacio diria que el ejercicio esta ' +
      'parametrizado cuando no lo esta';

    expect(negativa).toHaveTextContent(texto);
    expect(java).toContain(
      ' no tiene ningun parametro: sellarlo vacio diria que el ejercicio esta parametrizado ' +
        'cuando no lo esta',
    );
  });

  it('y las dos son distintas: se arreglan de maneras opuestas', () => {
    // Una abriendo una version y la otra agregando parametros. Juntarlas mandaria a quien
    // atiende a hacer lo contrario de lo que hace falta.
    expect(java).toContain('corregirlo exige una version nueva');
    expect(java).toContain('sellarlo vacio diria');
  });

  it('no hay ningún botón de borrar ni de anular en toda la sección', async () => {
    const usuario = montar();
    await conLaListaServida();
    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));

    for (const rotulo of ['Parámetros del conjunto', 'Abrir versión', 'Agregar parámetro', 'Sellar']) {
      await usuario.click(paso(rotulo));
      const botones = screen.getAllByRole('button').map((boton) => boton.textContent ?? '');
      expect(
        botones.filter((texto) => /borrar|eliminar|anular/i.test(texto)),
        'No existe esa operacion: AdministrarParametros publica abrirVersion, ' +
          'agregarParametroPublicado y sellar, y nada mas.',
      ).toEqual([]);
    }
  });
});

describe('AC9 — se guarda con toast, y la pantalla se queda donde estaba', () => {
  it('abrir una versión avisa y no mueve de sitio', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.selectOptions(screen.getByLabelText('Ejercicio'), '2027');
    await usuario.type(observacion(), 'Se abre la version de 2027');
    await usuario.click(screen.getByRole('button', { name: 'Abrir la versión' }));

    await waitFor(() => {
      expect(avisada).toHaveBeenCalledWith('Abrir la versión: registrado con su observación.');
    });
    expect(
      screen.getByRole('button', { name: 'Abrir la versión' }),
      'En un alta de tres pasos, saltar de sitio pierde el contexto de quien la hizo.',
    ).toBeInTheDocument();
    expect(listadas()).toHaveLength(3);
  });

  it('y lo escrito se limpia, para que el siguiente no herede la observación del anterior', async () => {
    const usuario = montar();
    await conLaListaServida();

    await usuario.selectOptions(screen.getByLabelText('Ejercicio'), '2027');
    await usuario.type(observacion(), 'Se abre la version de 2027');
    await usuario.click(screen.getByRole('button', { name: 'Abrir la versión' }));

    await waitFor(() => {
      expect(observacion()).toHaveValue('');
    });
  });

  it('descartar lo escrito también avisa, y no borra nada del servidor', async () => {
    const usuario = montar();
    await conLaListaServida();
    await usuario.type(observacion(), 'algo escrito');

    await usuario.click(screen.getByRole('button', { name: 'Descartar lo escrito' }));

    expect(observacion()).toHaveValue('');
    expect(avisada).toHaveBeenCalledWith('Se descartó lo escrito.');
    expect(listadas()).toHaveLength(3);
  });
});

describe('AC10 — ninguna cifra tributaria literal en el código de estas pantallas', () => {
  it.each(['Ediciones.tsx', 'Panel.tsx', 'ediciones.ts', 'panel.ts', 'conjuntos.ts'])(
    '«%s» no escribe ni una',
    (archivo) => {
      const fuente = readFileSync(join(AQUI, archivo), 'utf8');

      // Las marcas del corpus que el proxy sirve. Que ninguna este aqui es lo que separa una
      // pantalla que PIDE la cifra de una que la publica sin las dos firmas de ADR-0007.
      for (const marca of ['5500.00', '894.27', '104,780.00', '0.006', '0.68', '0540c3af']) {
        expect(fuente, `«${marca}» es una cifra del corpus y esta escrita en el codigo.`).not.toContain(
          marca,
        );
      }
    },
  );

  it('y las que se ven salen de la API: apagando el servidor, la tabla se queda sin ellas', async () => {
    conServidor({
      [RUTA_DEL_LISTADO]: { cuerpo: unaPagina([VIGENTE, PRIMERA]) },
      [RUTA_DEL_EJERCICIO]: {
        cuerpo: { ejercicio: 2026, sellado: true, conjuntoId: 2, version: 2 },
      },
    });
    const usuario = montar();
    await screen.findByText('Ejercicio 2026 · versión 2');

    await usuario.click(screen.getByText('Ejercicio 2026 · versión 2'));

    expect(await screen.findByText('No se pudo leer el contenido del conjunto')).toBeInTheDocument();
    expect(
      screen.queryByText('5500.00'),
      'Si la UIT siguiera en pantalla con el servidor apagado, es que la escribe la pantalla.',
    ).toBeNull();
  });
});
