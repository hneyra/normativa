import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Campo } from './Campo.tsx';

/** AC7 — `Campo` cubre los seis tipos del artboard, con sus ocho propiedades. */

describe('todo control lleva su etiqueta asociada', () => {
  it.each(['text', 'date', 'sel', 'area', 'chk', 'ro'] as const)(
    'el tipo «%s» se encuentra por su etiqueta',
    (tipo) => {
      // `getByLabelText` falla si la etiqueta no apunta al control. Es la forma de
      // comprobar la asociacion sin mirar el `id`, que es un detalle.
      render(<Campo etiqueta="Ambito" tipo={tipo} opciones={['', 'OBLIGACION']} />);

      expect(screen.getByLabelText('Ambito')).toBeInTheDocument();
    },
  );

  it('dos campos con la MISMA etiqueta no comparten id', () => {
    // Sin `useId`, una rejilla que repite el mismo campo —una lista de parametros del
    // conjunto— dejaria la etiqueta de todos apuntando al primero.
    render(
      <>
        <Campo etiqueta="Llave" tipo="text" />
        <Campo etiqueta="Llave" tipo="text" />
      </>,
    );

    const [uno, otro] = screen.getAllByLabelText('Llave');

    expect(uno?.id).not.toBe(otro?.id);
    expect(uno?.id).toBeTruthy();
  });
});

describe('el error del backend', () => {
  it('se ve, y el control queda marcado como invalido', () => {
    render(
      <Campo
        etiqueta="Vigencia desde"
        tipo="date"
        error="La vigencia se solapa con la edicion 2025 de la misma llave."
      />,
    );

    expect(
      screen.getByText('La vigencia se solapa con la edicion 2025 de la misma llave.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Vigencia desde')).toHaveAttribute('aria-invalid', 'true');
  });

  it('se anuncia ANTES que la ayuda: primero lo que hay que corregir', () => {
    render(
      <Campo
        etiqueta="Vigencia desde"
        tipo="date"
        error="Se solapa con 2025."
        ayuda="Inclusive."
      />,
    );

    const control = screen.getByLabelText('Vigencia desde');
    const referencias = (control.getAttribute('aria-describedby') ?? '').split(' ');
    const textos = referencias.map((referencia) => document.getElementById(referencia)?.textContent);

    expect(textos).toEqual(['Se solapa con 2025.', 'Inclusive.']);
  });

  it('sin error, el control no se declara invalido', () => {
    render(<Campo etiqueta="Llave" tipo="text" />);

    expect(screen.getByLabelText('Llave')).not.toHaveAttribute('aria-invalid');
  });
});

describe('el desplegable', () => {
  it('un valor que la API sirvio y el catalogo no tiene se ensena igual', () => {
    // Las dos listas vienen de sitios distintos y no tienen por que coincidir. Un `select`
    // con un valor que no esta en sus opciones se dibuja mostrando la PRIMERA, y entonces
    // la pantalla ensena un ambito que nadie eligio.
    render(
      <Campo
        etiqueta="Ambito"
        tipo="sel"
        valor="RECAUDACION"
        opciones={['OBLIGACION', 'VALUACION']}
      />,
    );

    expect(screen.getByLabelText('Ambito')).toHaveValue('RECAUDACION');
  });

  it('avisa del cambio con el valor elegido', async () => {
    const cambiar = vi.fn();
    render(
      <Campo
        etiqueta="Ambito"
        tipo="sel"
        valor=""
        opciones={['', 'OBLIGACION', 'VALUACION']}
        alCambiar={cambiar}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Ambito'), 'VALUACION');

    expect(cambiar).toHaveBeenCalledWith('VALUACION');
  });
});

describe('bloqueado y solo lectura no son lo mismo', () => {
  it('un campo bloqueado sigue en el recorrido del tabulador', async () => {
    // `readonly` y no `disabled`: un campo deshabilitado sale del recorrido, y en
    // ventanilla se trabaja con teclado. Quien recorre un conjunto ya sellado para LEERLO
    // se saltaria justo los campos que ya no puede cambiar.
    render(<Campo etiqueta="Llave" tipo="text" valor="UIT" bloqueado />);
    const control = screen.getByLabelText('Llave');

    expect(control).toHaveAttribute('readonly');
    expect(control).not.toBeDisabled();

    await userEvent.tab();

    expect(control).toHaveFocus();
  });

  it('un «ro» es un valor calculado, y ensena una raya cuando no lo hay', () => {
    render(<Campo etiqueta="Huella del snapshot" tipo="ro" />);

    expect(screen.getByLabelText('Huella del snapshot')).toHaveTextContent('—');
  });
});

describe('mientras el dato no llega', () => {
  it('en el sitio del control hay un esqueleto, y no un control vacio', () => {
    const { container } = render(<Campo etiqueta="Llave" tipo="text" cargando />);

    expect(container.querySelector('.kn-esqueleto')).toBeInTheDocument();
    expect(screen.queryByLabelText('Llave')).toBeNull();
  });
});

describe('lo accesorio', () => {
  it('«opcional» se dice con palabras', () => {
    render(<Campo etiqueta="Detalle de la norma" tipo="text" opcional />);

    expect(screen.getByText('opcional')).toBeInTheDocument();
  });

  it('la casilla manda «si» o vacio, no un booleano', async () => {
    const cambiar = vi.fn();
    render(
      <Campo
        etiqueta="Ratificada"
        tipo="chk"
        ph="La ordenanza tiene su acuerdo de ratificacion provincial"
        alCambiar={cambiar}
      />,
    );

    await userEvent.click(screen.getByLabelText('Ratificada'));

    expect(cambiar).toHaveBeenCalledWith('si');
  });

  it('el «ph» de un control que se escribe es su placeholder', () => {
    render(<Campo etiqueta="Llave" tipo="text" ph="UIT, TRAMO_PREDIAL, PLAZO…" />);

    expect(screen.getByLabelText('Llave')).toHaveAttribute(
      'placeholder',
      'UIT, TRAMO_PREDIAL, PLAZO…',
    );
  });

  it('«ancho» ocupa la fila entera de la rejilla', () => {
    const { container } = render(<Campo etiqueta="Documento fuente" tipo="text" ancho />);

    expect(container.querySelector('.kn-campo')).toHaveClass('kn-campo--ancho');
  });

  it('la ayuda queda enlazada aunque no haya error', () => {
    render(<Campo etiqueta="Llave" tipo="text" ayuda="Se escribe en mayusculas." />);

    const control = screen.getByLabelText('Llave');
    const referencia = control.getAttribute('aria-describedby') ?? '';

    expect(document.getElementById(referencia)?.textContent).toBe('Se escribe en mayusculas.');
  });
});
