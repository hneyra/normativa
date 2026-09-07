import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tabla, type ColumnaDeTabla, type FilaDeTabla } from './Tabla.tsx';

/**
 * AC8 — la tabla se anuncia, dice cuando esta cargando, y se desplaza en su propio marco.
 *
 * Lo que aqui NO se puede medir es el desplazamiento en si: jsdom no maqueta, asi que
 * `overflow-x` no produce ninguna diferencia observable. Lo que si se puede medir —y es lo que
 * decide el caso— es **quien lleva cada cosa**: que la tabla este dentro de su marco y que el
 * ancho minimo lo lleve la tabla y no el marco. La regla de CSS la comprueba
 * `verificaciones/secciones.test.ts` leyendo la hoja.
 */

const COLUMNAS: readonly ColumnaDeTabla[] = [
  { etiqueta: 'Partida', campo: 'partida', dominio: 'MUROS · TECHOS · PUERTAS' },
  { etiqueta: 'Valor por m² (S/)', campo: 'valorM2', cifra: true },
  { etiqueta: 'Documento fuente', campo: 'documentoFuente' },
];

const FILAS: readonly FilaDeTabla[] = [
  {
    clave: 'MUROS-A',
    celdas: [
      { texto: 'MUROS' },
      { texto: '894.27' },
      { texto: null, nota: 'Ninguna operación publica este dato' },
    ],
  },
];

describe('la tabla se anuncia y dice si esta cargando', () => {
  it('lleva «aria-label» y «aria-busy» en falso cuando el dato ya esta', () => {
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={FILAS}
        rotulo="Valores unitarios — ámbito VALUACION"
        cargando={false}
        variante="unitarios"
      />,
    );

    const tabla = screen.getByRole('table', { name: 'Valores unitarios — ámbito VALUACION' });
    expect(tabla).toHaveAttribute('aria-busy', 'false');
  });

  it('y en cierto mientras carga, con huecos en vez de filas', () => {
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={FILAS}
        rotulo="Valores unitarios"
        cargando
        variante="unitarios"
      />,
    );

    const tabla = screen.getByRole('table', { name: 'Valores unitarios' });
    expect(tabla).toHaveAttribute('aria-busy', 'true');
    // La fila con dato no se dibuja mientras carga: ensenar un dato viejo bajo `aria-busy`
    // seria decir dos cosas contrarias a la vez.
    expect(within(tabla).queryByText('894.27')).toBeNull();
  });
});

describe('la cabecera dice el rotulo, el campo del JSON y el dominio', () => {
  it('los tres, y el dominio solo donde la base lo acota', () => {
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={FILAS}
        rotulo="Valores unitarios"
        cargando={false}
        variante="unitarios"
      />,
    );

    const cabecera = screen.getByRole('columnheader', { name: /Partida/ });
    expect(cabecera).toHaveTextContent('Partida');
    expect(cabecera).toHaveTextContent('partida');
    expect(cabecera).toHaveTextContent('MUROS · TECHOS · PUERTAS');

    expect(screen.getByRole('columnheader', { name: /Documento fuente/ })).toHaveTextContent(
      'documentoFuente',
    );
  });
});

describe('las celdas', () => {
  it('la cifra va a la derecha con «tabular-nums»; el texto, no', () => {
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={FILAS}
        rotulo="Valores unitarios"
        cargando={false}
        variante="unitarios"
      />,
    );

    expect(screen.getByRole('cell', { name: '894.27' })).toHaveClass('kn-tabla__td--cifra');
    expect(screen.getByRole('cell', { name: 'MUROS' })).not.toHaveClass('kn-tabla__td--cifra');
  });

  it('la alineacion la decide la COLUMNA y no la celda', () => {
    // Una celda de cifra sin dato sigue a la derecha: si se alineara sola, la columna se
    // rompería justo en la fila a la que le falta el dato, que es cuando mas se nota.
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={[{ clave: 'sola', celdas: [{ texto: 'MUROS' }, { texto: null }, { texto: 'R.M.' }] }]}
        rotulo="Valores unitarios"
        cargando={false}
        variante="unitarios"
      />,
    );

    expect(screen.getByRole('cell', { name: '—' })).toHaveClass('kn-tabla__td--cifra');
  });

  it('lo que ninguna operacion publica es un GUION, no una celda en blanco', () => {
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={FILAS}
        rotulo="Valores unitarios"
        cargando={false}
        variante="unitarios"
      />,
    );

    const guion = screen.getByText('—');
    expect(guion).toHaveAttribute('title', 'Ninguna operación publica este dato');
  });
});

describe('el desplazamiento es de la tabla, no de la pagina', () => {
  it('la tabla vive DENTRO de «.kn-tabla__marco», y el ancho minimo lo lleva ella', () => {
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={FILAS}
        rotulo="Valores referenciales"
        cargando={false}
        variante="referenciales"
      />,
    );

    const tabla = screen.getByRole('table', { name: 'Valores referenciales' });
    expect(
      tabla.parentElement,
      'Sin el marco, el `min-width` de la tabla empuja el lienzo entero y la pagina se\n' +
        'desplaza de lado: la cabecera y las pestanas salen del campo de vision, y quien lee\n' +
        'la fila 300 deja de saber que cuadro esta mirando.',
    ).toHaveClass('kn-tabla__marco');
    expect(tabla).toHaveClass('kn-tabla--referenciales');
  });
});
