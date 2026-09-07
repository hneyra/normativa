import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sha256 } from '../api/cliente.ts';
import { desinstalarProxyDeDatos, instalarProxyDeDatos } from '../api/proxy.ts';
import type { SnapshotResource } from '../datos/lecturas.ts';
import { Publicacion } from './Publicacion.tsx';

/**
 * «Publicación», montada contra el proxy y contra un backend fingido.
 *
 * Lo que hay que poder ver aqui son cosas que ninguna captura de pantalla demuestra: que el
 * `ETag` sale de la cabecera y las `filas` del cuerpo, que la huella se **recalculo**, que el 404
 * del ejercicio sin sellar no es una averia, y que lo que se guarda son los bytes verificados.
 */

/** Lo que `URL` traia antes de que un caso le parchee sus dos metodos de `Blob`. */
const URL_ORIGINAL = {
  crear: URL.createObjectURL,
  revocar: URL.revokeObjectURL,
} as const;

afterEach(() => {
  desinstalarProxyDeDatos();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  URL.createObjectURL = URL_ORIGINAL.crear;
  URL.revokeObjectURL = URL_ORIGINAL.revocar;
});

/** Dos peticiones encadenadas mas dos `sha256`: el plazo por omision se queda corto. */
const ESPERA = { timeout: 8000 } as const;

/** El plazo del propio caso: tiene que ser mayor que ESPERA, o el rojo habla de la maquina. */
const PLAZO = 20_000;

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

/**
 * Un `fetch` que contesta como el backend: el conjunto vigente, y un snapshot por ambito.
 *
 * Sirve **dos cuerpos distintos** —uno por ambito— porque es lo que `ComponerSnapshot` hace y lo
 * que el proxy de datos no puede hacer. Sin eso, AC6 no se puede ver en su caso bueno.
 */
function backendQueReparte(porAmbito: Readonly<Record<string, SnapshotResource>>) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (entrada) => {
      const ruta = String(entrada);
      if (ruta.includes('/conjuntos?')) {
        return Response.json({ conjuntoId: 2, ejercicio: 2026, version: 2 });
      }
      const ambito = ruta.endsWith('OBLIGACION') ? 'OBLIGACION' : 'VALUACION';
      const cuerpo = JSON.stringify(porAmbito[ambito]);
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

/** El `fetch` que contesta el 404 del ejercicio sin sellar, con su discriminador. */
function backendSinConjuntoSellado() {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: 404,
            title: 'No se encontro lo solicitado',
            codigo: 'NO_ENCONTRADO',
            mensaje:
              'El ejercicio 2027 no tiene un conjunto de parametros sellado. Calcular con uno ' +
              'abierto produciria una cifra que manana puede ser otra (ADR-0007)',
            parametroQueFalta: { ejercicio: 2027 },
          }),
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    ),
  );
}

const SIN_RUIDO = { alAvisar: () => undefined, alAbrir: () => undefined };

describe('AC4 — el conjunto vigente, y el 404 que no es una averia', () => {
  it('pide «GET /conjuntos?ejercicio=N» y ensena el conjunto que resuelve', async () => {
    instalarProxyDeDatos();
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    expect(
      screen.getByText('GET /normativa/api/v1/conjuntos?ejercicio=2026'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('conjuntoId').closest('div')).toHaveTextContent('2');
    }, ESPERA);
  }, PLAZO);

  it('sin conjunto sellado, se lee como respuesta y no como fallo de la interfaz', async () => {
    backendSinConjuntoSellado();
    render(<Publicacion ejercicio="2027" {...SIN_RUIDO} />);

    expect(
      await screen.findByText('Ese ejercicio no tiene un conjunto de parámetros sellado', {}, ESPERA),
    ).toBeInTheDocument();
    // El mensaje del dominio va TAL CUAL, sin reescribir.
    expect(screen.getByText(/Calcular con uno abierto produciria una cifra/)).toBeInTheDocument();
    // Y se dice por que es un 404 y no un 422, y que lo separa de un 404 de ruta.
    expect(screen.getByText(/aquí se pide un documento/)).toBeInTheDocument();
    expect(screen.getByText('parametroQueFalta')).toBeInTheDocument();
    // Dos veces: la insignia de la respuesta y el pie que explica por que no es un 422.
    expect(screen.getAllByText('404')).toHaveLength(2);
  }, PLAZO);

  it('y ofrece la salida: componer el ejercicio, sin salirse del marco', async () => {
    const usuario = userEvent.setup();
    const abiertas: string[] = [];
    backendSinConjuntoSellado();
    render(
      <Publicacion
        ejercicio="2027"
        alAvisar={() => undefined}
        alAbrir={(destino) => abiertas.push(destino)}
      />,
    );

    await usuario.click(
      await screen.findByRole('button', { name: 'Ir a componer el ejercicio' }, ESPERA),
    );

    expect(abiertas).toEqual(['nor-ediciones']);
  }, PLAZO);
});

describe('AC5 — el ETag, el Cache-Control, las filas y la comprobacion del sha256', () => {
  it('las cuatro se ensenan, y el ETag es el sha256 de los bytes servidos', async () => {
    instalarProxyDeDatos();
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    const etag = await screen.findByText(/^"[0-9a-f]{64}"$/, {}, ESPERA);
    expect(etag).toBeInTheDocument();
    expect(screen.getByText('public, max-age=31536000, immutable')).toBeInTheDocument();
    // El proxy sirve las cuatro listas llenas: 33 + 24 + 14 + 10.
    expect(screen.getByText('81')).toBeInTheDocument();
    expect(
      screen.getByText('sha256 recalculado sobre los bytes recibidos: coincide con el ETag'),
    ).toBeInTheDocument();
  }, PLAZO);

  it('cada linea dice si vino de una CABECERA o del cuerpo', async () => {
    instalarProxyDeDatos();
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);
    await screen.findByText(/^"[0-9a-f]{64}"$/, {}, ESPERA);

    // «ETag» aparece tambien en el pie que explica por que la huella no va dentro del cuerpo,
    // asi que se busca la ETIQUETA de la linea y no el texto suelto.
    const etiquetas = screen.getAllByText('ETag').map((nodo) => nodo.closest('dt'));
    const etiquetaDelEtag = etiquetas.find((nodo) => nodo !== null);
    expect(etiquetaDelEtag).toHaveTextContent('cabecera');
    expect(screen.getByText('filas').closest('dt')).toHaveTextContent('cuerpo');
  }, PLAZO);

  it('si la huella NO cuadra, no se dibuja la ficha: se dice, con las dos huellas', async () => {
    // Un `ETag` que no es el de los bytes: el caso que la cache de un ano vuelve irreparable.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((entrada) => {
        const ruta = String(entrada);
        if (ruta.includes('/conjuntos?')) {
          return Promise.resolve(Response.json({ conjuntoId: 2, ejercicio: 2026, version: 2 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify(snapshotDe({})), {
            status: 200,
            headers: { 'content-type': 'application/json', etag: `"${'f'.repeat(64)}"` },
          }),
        );
      }),
    );
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    const aviso = await screen.findByText(
      /No se pudo verificar el snapshot en VALUACION/,
      {},
      ESPERA,
    );
    expect(aviso).toBeInTheDocument();
    expect(screen.getByText(/HUELLA_QUE_NO_CUADRA/)).toBeInTheDocument();
    expect(screen.getByText(/el servidor anunció f{64}/)).toBeInTheDocument();
    expect(screen.queryByText(/coincide con el ETag/)).toBeNull();
  }, PLAZO);
});

describe('AC6 — la identidad no cambia con el ambito; la huella si', () => {
  it('con un backend que reparte: misma identidad, huellas distintas', async () => {
    backendQueReparte({
      VALUACION: snapshotDe({ ambito: 'VALUACION', filas: 24 }),
      OBLIGACION: snapshotDe({ ambito: 'OBLIGACION', filas: 10 }),
    });
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    const panel = await screen.findByText('Un conjunto, dos descargas', {}, ESPERA);
    const seccion = panel.closest('.kn-seccion__panel');

    expect(seccion).toHaveTextContent('conjunto 2 · ejercicio 2026 · versión 2');
    expect(seccion).toHaveTextContent('son distintas');
    expect(within(seccion as HTMLElement).getByText('Misma identidad')).toBeInTheDocument();
    expect(seccion).toHaveTextContent('DOS snapshots del MISMO conjunto');
  }, PLAZO);

  it('con el proxy, que NO reparte, la pantalla dice que las dos huellas coinciden', async () => {
    instalarProxyDeDatos();
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    const panel = await screen.findByText('Un conjunto, dos descargas', {}, ESPERA);
    const seccion = panel.closest('.kn-seccion__panel');

    await waitFor(() => {
      expect(seccion).toHaveTextContent('son la misma');
    }, ESPERA);
    expect(
      seccion,
      'Medir y decir lo medido, en vez de repetir la frase del ADR sobre unos bytes que\n' +
        'nadie comparo.',
    ).toHaveTextContent('no la compuso ComponerSnapshot');
  }, PLAZO);
});

describe('AC7 — quien se lo lleva', () => {
  it('la tabla nombra a catastro y a rentas, con el ambito de cada uno', async () => {
    instalarProxyDeDatos();
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    const tabla = screen.getByRole('table', { name: 'Quién consume el conjunto sellado' });
    expect(within(tabla).getAllByRole('row')).toHaveLength(4);
    expect(within(tabla).getAllByRole('cell', { name: 'rentas' })).toHaveLength(2);
    expect(within(tabla).getByRole('cell', { name: 'catastro' })).toBeInTheDocument();
    expect(screen.getByText(/consumen/)).toBeInTheDocument();
  }, PLAZO);

  it('y dice que ninguno consume «/seguridad/parametros»', () => {
    instalarProxyDeDatos();
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    expect(screen.getByText('GET /conjuntos')).toBeInTheDocument();
    expect(screen.getByText('GET /conjuntos/{id}/snapshot')).toBeInTheDocument();
    expect(screen.getByText('GET /seguridad/parametros')).toBeInTheDocument();
    expect(screen.getByText(/Ninguno consume/)).toBeInTheDocument();
  });
});

describe('AC9 — guardar el snapshot guarda lo que se verifico', () => {
  it('el archivo lleva conjunto, ejercicio y ambito, y sus bytes son los verificados', async () => {
    const usuario = userEvent.setup();
    const avisos: string[] = [];
    const blobs: Blob[] = [];
    instalarProxyDeDatos();
    // Se parchean los DOS METODOS, no el objeto `URL` entero: el proxy de datos construye un
    // `new URL(...)` en cada peticion, asi que sustituir el global lo deja sin constructor y la
    // pantalla no recibe ni un dato — un rojo que hablaria del arnes y no de la descarga.
    URL.createObjectURL = (dato: Blob) => {
      blobs.push(dato);
      return 'blob:prueba';
    };
    URL.revokeObjectURL = () => undefined;
    let nombre = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nombre = this.download;
    });

    render(
      <Publicacion
        ejercicio="2026"
        alAvisar={(texto) => avisos.push(texto)}
        alAbrir={() => undefined}
      />,
    );
    await screen.findByText(/^"[0-9a-f]{64}"$/, {}, ESPERA);

    await usuario.click(screen.getByRole('button', { name: /Guardar el snapshot/ }));

    expect(nombre).toBe('normativa-conjunto-2-2026-v2-VALUACION.json');
    expect(blobs).toHaveLength(1);
    // Los bytes guardados son EXACTAMENTE aquellos cuyo sha256 se comparo con el ETag.
    const etag = screen.getByText(/^"[0-9a-f]{64}"$/).textContent ?? '';
    const guardado = await leer(blobs[0]!);
    expect(`"${await sha256(guardado)}"`).toBe(etag);
    expect(avisos[0]).toContain('normativa-conjunto-2-2026-v2-VALUACION.json');
    expect(avisos[0]).toContain('sha256');
  }, PLAZO);

  it('los bytes guardados son los SERVIDOS, no una segunda serializacion del objeto', async () => {
    const usuario = userEvent.setup();
    const blobs: Blob[] = [];
    // Un cuerpo con la MISMA informacion y OTROS BYTES: sangrado, y con la tilde escapada como
    // `\u00f3`. Las dos cosas las hace un serializador de verdad y `JSON.stringify` de
    // JavaScript no, asi que re-serializar el objeto da un texto distinto —y otro `sha256`—
    // aunque no cambie ni un valor. Es exactamente lo que separa «guardo lo que verifique» de
    // «guardo algo equivalente».
    const objeto = snapshotDe({ ambito: 'VALUACION', filas: 0 });
    const servido = JSON.stringify(objeto, null, 2).replace(/ó/g, '\\u00f3');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (entrada) => {
        if (String(entrada).includes('/conjuntos?')) {
          return Response.json({ conjuntoId: 2, ejercicio: 2026, version: 2 });
        }
        return new Response(servido, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            etag: `"${await sha256(servido)}"`,
            'cache-control': 'public, max-age=31536000, immutable',
          },
        });
      }),
    );
    URL.createObjectURL = (dato: Blob) => {
      blobs.push(dato);
      return 'blob:prueba';
    };
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);
    await screen.findByText(/^"[0-9a-f]{64}"$/, {}, ESPERA);
    await usuario.click(screen.getByRole('button', { name: /Guardar el snapshot/ }));

    const guardado = await leer(blobs[0]!);
    expect(
      guardado,
      'Se guardo una segunda serializacion: el archivo dice lo mismo y NO es el que se\n' +
        'verifico, asi que su sha256 no es el ETag que lo acompana y quien lo relea concluira\n' +
        'que su copia esta corrupta.',
    ).toBe(servido);
    expect(guardado).not.toBe(JSON.stringify(objeto));
    expect(`"${await sha256(guardado)}"`).toBe(
      screen.getByText(/^"[0-9a-f]{64}"$/).textContent,
    );
  }, PLAZO);

  it('sin snapshot verificado el boton se anuncia deshabilitado, y no sale del tabulador', async () => {
    backendSinConjuntoSellado();
    render(<Publicacion ejercicio="2027" {...SIN_RUIDO} />);

    const boton = await screen.findByRole('button', { name: /Guardar el snapshot/ }, ESPERA);
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(
      boton,
      'Un control «disabled» sale del recorrido del tabulador, y en ventanilla se trabaja con\n' +
        'teclado.',
    ).not.toBeDisabled();
  }, PLAZO);
});

describe('el ambito no tiene valor por omision, y se elige', () => {
  it('los dos botones estan, y cambiar de ambito cambia la ruta que se pide', async () => {
    const usuario = userEvent.setup();
    instalarProxyDeDatos();
    render(<Publicacion ejercicio="2026" {...SIN_RUIDO} />);

    await waitFor(() => {
      expect(
        screen.getByText('GET /normativa/api/v1/conjuntos/2/snapshot?ambito=VALUACION'),
      ).toBeInTheDocument();
    }, ESPERA);

    await usuario.click(screen.getByRole('button', { name: 'OBLIGACION' }));

    expect(
      screen.getByText('GET /normativa/api/v1/conjuntos/2/snapshot?ambito=OBLIGACION'),
    ).toBeInTheDocument();
    expect(screen.getByText(/no tiene valor por omisión/)).toBeInTheDocument();
  }, PLAZO);
});

/** El texto de un `Blob`, con `FileReader`: el `Blob` de jsdom no trae `text()`. */
function leer(dato: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      resolver(String(lector.result));
    };
    lector.onerror = () => {
      rechazar(new Error('No se pudo leer el Blob'));
    };
    lector.readAsText(dato);
  });
}
