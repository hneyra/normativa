import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sha256 } from '../api/cliente.ts';
import { desinstalarProxyDeDatos, instalarProxyDeDatos } from '../api/proxy.ts';
import type { SnapshotResource } from '../datos/lecturas.ts';
import { Cuadros } from './Cuadros.tsx';

/**
 * «Cuadros de valuación», montada contra el proxy de datos y contra un backend fingido.
 *
 * <h2>Las dos formas de servir, y por que hacen falta las dos</h2>
 *
 * El **proxy** es el camino real: la peticion sale, la URL se compone, el `ETag` viaja y el
 * cliente recalcula la huella. Es con lo que se prueba lo que la pantalla dibuja de verdad.
 *
 * Pero el proxy **no reparte por ambito** —no mira la cadena de consulta, a proposito (#13 AC5)—
 * asi que con el nunca se ve un cuadro vacio POR AMBITO, que es la mitad del AC3. Ese caso se
 * sirve con un backend fingido que si reparte, como hace `ComponerSnapshot`.
 */

afterEach(() => {
  desinstalarProxyDeDatos();
  vi.unstubAllGlobals();
});

/** Un `fetch` que contesta como el backend: el conjunto vigente y el snapshot con su `ETag`. */
function backendQueReparte(snapshot: SnapshotResource) {
  const cuerpo = JSON.stringify(snapshot);
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (entrada) => {
      const ruta = String(entrada);
      if (ruta.includes('/conjuntos?')) {
        return Response.json({ conjuntoId: 2, ejercicio: 2026, version: 2 });
      }
      return new Response(cuerpo, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          etag: `"${await sha256(cuerpo)}"`,
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    }),
  );
}

function snapshotDe(encima: Partial<SnapshotResource>): SnapshotResource {
  return {
    conjuntoId: 2,
    ejercicio: 2026,
    version: 2,
    ambito: 'VALUACION',
    filas: 0,
    parametros: [],
    valoresUnitarios: [],
    depreciaciones: [],
    valoresReferenciales: [],
    ...encima,
  };
}

/** La pestana de un cuadro, por su rotulo. */
const pestana = (rotulo: string | RegExp) => screen.getByRole('tab', { name: rotulo });

/**
 * Cuanto se espera a que llegue el dato.
 *
 * Dos peticiones encadenadas —el conjunto vigente y su snapshot— mas el `sha256` del cuerpo con
 * `crypto.subtle` rondan el segundo en jsdom, que es justo el plazo por omision de
 * `waitFor`. Con el plazo por omision el rojo hablaria de la maquina y no de la pantalla.
 */
const ESPERA = { timeout: 8000 } as const;

/** El plazo del propio caso: mayor que ESPERA, o el rojo hablaria de la maquina y no de la pantalla. */
const PLAZO = 20_000;

describe('AC1 — los tres cuadros, y que son NACIONALES', () => {
  it('las tres pestanas estan, con cuantas filas trae cada una', async () => {
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);

    await waitFor(() => {
      expect(pestana(/^Valores unitarios de edificación/)).toHaveTextContent('24');
    }, ESPERA);
    expect(pestana(/^Depreciación/)).toHaveTextContent('14');
    expect(pestana(/^Valores referenciales vehiculares/)).toHaveTextContent('10');
  }, PLAZO);

  it('dice que es nacional, y nombra el CHECK que lo impide', async () => {
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);

    await waitFor(() => {
      expect(screen.getByText(/Es nacional y no de esta municipalidad/)).toBeInTheDocument();
    }, ESPERA);
    expect(screen.getByText('valor_unitario_nacional_ck')).toBeInTheDocument();
    expect(screen.getByText('rol_carga_parametros')).toBeInTheDocument();
  }, PLAZO);

  it('la tabla lleva sus seis columnas con el campo del JSON y su dominio', async () => {
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);

    const tabla = await screen.findByRole(
      'table',
      { name: 'Valores unitarios de edificación — ámbito VALUACION' },
      ESPERA,
    );
    const cabeceras = within(tabla).getAllByRole('columnheader');

    expect(cabeceras).toHaveLength(6);
    expect(cabeceras[0]).toHaveTextContent('partida');
    expect(cabeceras[0]).toHaveTextContent('MUROS · TECHOS · PUERTAS');
    expect(cabeceras[1]).toHaveTextContent('A … J');
  }, PLAZO);

  it('y las 24 celdas del Anexo I.2 se dibujan, con su valor por m²', async () => {
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);

    // La cuenta de la pestana es lo primero que deja de ser «—»: con ella dentro, la tabla ya
    // tiene sus filas y no sus huecos.
    await waitFor(() => {
      expect(pestana(/^Valores unitarios de edificación/)).toHaveTextContent('24');
    }, ESPERA);

    const tabla = screen.getByRole('table', {
      name: 'Valores unitarios de edificación — ámbito VALUACION',
    });
    // 24 filas de datos, mas la de la cabecera.
    expect(within(tabla).getAllByRole('row')).toHaveLength(25);
    expect(tabla).toHaveAttribute('aria-busy', 'false');
    expect(within(tabla).getByRole('cell', { name: '894.27' })).toBeInTheDocument();
  }, PLAZO);
});

describe('«una región por edición»: la pantalla dice que esta operacion no la publica', () => {
  it('lo dice en el cuadro de valores unitarios, con el motivo entero', async () => {
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);

    const bloque = await screen.findByRole('region', { name: 'De qué región es este cuadro' }, ESPERA);

    expect(bloque).toHaveTextContent('Esta operación no lo dice');
    expect(bloque).toHaveTextContent('valor_unitario_edificacion');
    expect(bloque).toHaveTextContent('valor_unitario_uq');
    expect(bloque).toHaveTextContent('ANEXO-I.2-COSTA');
    expect(
      bloque,
      'Sin esto, la afirmacion se queda en «no lo sabemos» y no dice que hay que hacer.',
    ).toHaveTextContent('sin su región no se puede usar');
  }, PLAZO);

  it('y NO lo dice en los otros dos, que no tienen region', async () => {
    const usuario = userEvent.setup();
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);
    await screen.findByRole('region', { name: /De qué región/ }, ESPERA);

    await usuario.click(pestana(/^Depreciación/));

    expect(screen.queryByRole('region', { name: /De qué región/ })).toBeNull();
  }, PLAZO);
});

describe('AC2 — el tramo abierto se dibuja como «más de N años»', () => {
  it('en la celda, y con su nota', async () => {
    const usuario = userEvent.setup();
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);
    await screen.findByRole('table', { name: /Valores unitarios/ }, ESPERA);

    await usuario.click(pestana(/^Depreciación/));

    const tabla = await screen.findByRole('table', { name: /^Depreciación/ }, ESPERA);
    const celda = within(tabla).getByRole('cell', { name: 'Más de 50 años' });

    expect(celda).toBeInTheDocument();
    expect(celda).toHaveAttribute('title', expect.stringContaining('no hay tope'));
  }, PLAZO);
});

describe('AC3 — el ambito decide, y los cuatro casos se dibujan distinto', () => {
  it('vacio POR AMBITO: se explica el reparto y se ofrece pedir el otro ambito', async () => {
    const usuario = userEvent.setup();
    // El backend de verdad reparte: en VALUACION, los referenciales llegan vacios.
    backendQueReparte(
      snapshotDe({
        ambito: 'VALUACION',
        filas: 24,
        valoresUnitarios: [
          {
            partida: 'MUROS',
            categoria: 'A',
            anioConstruccionDesde: 1990,
            anioConstruccionHasta: null,
            valorM2: '894.27',
            documentoFuente: 'R.M. 277-2025-VIVIENDA',
          },
        ],
      }),
    );
    render(<Cuadros ejercicio="2026" />);
    await screen.findByRole('table', { name: /Valores unitarios/ }, ESPERA);

    await usuario.click(pestana(/^Valores referenciales/));

    expect(
      await screen.findByText('El ámbito VALUACION no lleva este cuadro', {}, ESPERA),
    ).toBeInTheDocument();
    expect(screen.getByText(/No es un cuadro sin datos: es el reparto de ADR-0024/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pedir el snapshot en OBLIGACION' }),
    ).toBeInTheDocument();
    // Y NO se dibuja una tabla vacia, que es lo que haria pasar una averia por normal.
    expect(screen.queryByRole('table', { name: /Valores referenciales/ })).toBeNull();
  }, PLAZO);

  it('vacio DENTRO de su ambito: se dice que eso no lo explica el reparto', async () => {
    const usuario = userEvent.setup();
    // Un conjunto sellado sin la edicion vehicular: es la version 1 de 2026, que existe.
    backendQueReparte(snapshotDe({ ambito: 'OBLIGACION', filas: 0 }));
    render(<Cuadros ejercicio="2026" />);

    await usuario.click(await screen.findByRole('button', { name: 'OBLIGACION' }, ESPERA));
    await usuario.click(pestana(/^Valores referenciales/));

    expect(
      await screen.findByText('Este ámbito sí lleva el cuadro, y llegó vacío', {}, ESPERA),
    ).toBeInTheDocument();
    expect(screen.getByText(/o algo no compuso/)).toBeInTheDocument();
  }, PLAZO);

  it('DE MAS: lo que sirve el proxy se nombra, no se dibuja como normal', async () => {
    const usuario = userEvent.setup();
    // El proxy sirve las cuatro listas llenas para los dos ambitos: no mira la consulta.
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);
    await screen.findByRole('table', { name: /Valores unitarios/ }, ESPERA);

    await usuario.click(pestana(/^Valores referenciales/));

    const aviso = await screen.findByRole(
      'region',
      { name: 'Este cuadro llegó, y el ámbito VALUACION no lo lleva' },
      ESPERA,
    );
    expect(aviso).toHaveTextContent('proxy de datos');
    // Y la tabla se dibuja igual, porque las filas estan: lo que se anade es el aviso.
    expect(screen.getByRole('table', { name: /Valores referenciales/ })).toBeInTheDocument();
  }, PLAZO);

  it('el selector de ambito dice cual lleva el cuadro que se esta viendo', async () => {
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'VALUACION' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }, ESPERA);
    expect(screen.getByRole('button', { name: 'OBLIGACION' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText(/no se lee en minúsculas/)).toBeInTheDocument();
  }, PLAZO);
});

describe('lo que la edicion tiene y esta operacion no publica', () => {
  it('el documento fuente sale de las filas; el sha256 y las firmas se nombran como ausentes', async () => {
    instalarProxyDeDatos();
    render(<Cuadros ejercicio="2026" />);

    // El documento sale de las 24 filas, no de una constante: la ficha lo repite porque lo
    // LEYO de ellas y comprobo que las 24 dicen lo mismo.
    await waitFor(() => {
      expect(
        screen.getAllByText('Resolución Ministerial N.º 277-2025-VIVIENDA').length,
      ).toBeGreaterThan(1);
    }, ESPERA);

    expect(screen.getByText(/Lo que esta operación/)).toHaveTextContent(
      'no publica, y por eso no se dibuja',
    );
  }, PLAZO);
});

describe('cuando la lectura falla, se dice cual fallo', () => {
  it('un ejercicio que no es un ejercicio no pide nada', async () => {
    const espia = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({})));
    vi.stubGlobal('fetch', espia);

    render(<Cuadros ejercicio="no es un año" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^Valores unitarios/ })).toBeInTheDocument();
    }, ESPERA);
    expect(espia).not.toHaveBeenCalled();
  }, PLAZO);
});
