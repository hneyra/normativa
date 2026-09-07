import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Boton } from './Boton.tsx';
import { Esqueleto } from './Esqueleto.tsx';
import { FechaDeCalculo } from './FechaDeCalculo.tsx';
import { Icono } from './Icono.tsx';
import { Importe } from './Importe.tsx';
import { Insignia } from './Insignia.tsx';

/**
 * Los seis componentes que se pueden probar en una linea. `Campo` y `Aviso` tienen su
 * propio archivo porque tienen su propio comportamiento.
 */

describe('Boton', () => {
  it('es «button» por omision y NO «submit»', () => {
    // El defecto clasico del HTML: un boton sin `type` dentro de un `<form>` lo envia. Un
    // «Ver el snapshot» junto al formulario de una edicion la guardaria.
    render(<Boton>Ver el snapshot</Boton>);

    expect(screen.getByRole('button', { name: 'Ver el snapshot' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('pero quien quiera enviar, puede', () => {
    render(<Boton type="submit">Sellar el conjunto</Boton>);

    expect(screen.getByRole('button', { name: 'Sellar el conjunto' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it.each(['primario', 'secundario', 'fantasma'] as const)('la variante «%s» se ve', (variante) => {
    render(<Boton variante={variante}>Sellar el conjunto</Boton>);

    expect(screen.getByRole('button')).toHaveClass(`kn-boton--${variante}`);
  });

  it('la talla menuda es la del artboard, y se distingue en la clase', () => {
    render(<Boton menudo>Copiar</Boton>);

    expect(screen.getByRole('button')).toHaveClass('kn-boton', 'kn-boton--menudo');
  });

  it('deshabilitado no llama a nadie', async () => {
    const pulsar = vi.fn();
    render(
      <Boton disabled onClick={pulsar}>
        Sellar el conjunto
      </Boton>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(pulsar).not.toHaveBeenCalled();
  });

  it('conserva la clase que le pasen, sin perder las suyas', () => {
    render(<Boton className="mia">Ir</Boton>);

    expect(screen.getByRole('button')).toHaveClass('kn-boton', 'kn-boton--secundario', 'mia');
  });
});

describe('Insignia', () => {
  it('el texto va SIEMPRE dentro, no solo el color (AC9)', () => {
    render(<Insignia tono="ok">Sellado</Insignia>);

    // Que se pueda encontrar POR SU TEXTO es exactamente la propiedad: quien no distingue
    // el verde del ambar lee «Sellado» igual, y aqui eso es la diferencia entre una cifra
    // con la que se puede cobrar y una que todavia no.
    expect(screen.getByText('Sellado')).toBeInTheDocument();
  });

  it.each(['ok', 'atencion', 'mal', 'info'] as const)('el tono «%s» se ve', (tono) => {
    render(<Insignia tono={tono}>Estado</Insignia>);

    expect(screen.getByText('Estado')).toHaveClass(`kn-insignia--${tono}`);
  });
});

describe('Importe', () => {
  it('dice la cifra Y la fecha a la que esta calculada (AC8)', () => {
    render(<Importe valor="104740.00" fechaCalculo="2026-09-06" />);

    expect(screen.getByText('104,740.00')).toBeInTheDocument();
    expect(screen.getByText('al 06/09/2026')).toBeInTheDocument();
  });

  it('con «fechaImplicita» calla la fecha, pero sigue habiendo que pasarla', () => {
    render(<Importe valor="104740.00" fechaCalculo="2026-09-06" fechaImplicita />);

    expect(screen.getByText('104,740.00')).toBeInTheDocument();
    expect(screen.queryByText('al 06/09/2026')).toBeNull();
  });

  it('no hace aritmetica: pinta el texto que le dieron', () => {
    render(<Importe valor="0.10" fechaCalculo="2026-09-06" fechaImplicita />);
    render(<Importe valor="0.20" fechaCalculo="2026-09-06" fechaImplicita />);

    expect(screen.getByText('0.10')).toBeInTheDocument();
    expect(screen.getByText('0.20')).toBeInTheDocument();
  });
});

describe('FechaDeCalculo', () => {
  it('dice de cuando son las cifras de la pantalla', () => {
    render(<FechaDeCalculo fecha="2026-09-06" />);

    expect(screen.getByText(/Cifras vigentes al/)).toBeInTheDocument();
    expect(screen.getByText('06/09/2026')).toBeInTheDocument();
  });
});

describe('Esqueleto', () => {
  it('ocupa el sitio del dato y no se anuncia', () => {
    const { container } = render(<Esqueleto alto={20} ancho="12ch" />);
    const marcador = container.querySelector('.kn-esqueleto');

    expect(marcador).toHaveAttribute('aria-hidden', 'true');
    expect(marcador).toHaveStyle({ height: '20px', width: '12ch' });
  });
});

describe('Icono', () => {
  it('es decorativo: se esconde del lector de pantalla', () => {
    const { container } = render(<Icono nombre="lupa" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('hereda el color de quien lo contiene', () => {
    // Es lo que hace que el mismo icono salga blanco dentro de un boton primario y desvaido
    // dentro de un aviso, sin que nadie le pase un color — y sin que ningun componente
    // escriba un hexadecimal.
    const { container } = render(<Icono nombre="alerta" />);

    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
  });

  it('dibuja los trazos del artboard, y la reja de 24x24', () => {
    // Los tres trazos son los de la linea 405 de `NormativaV6.dc.html`, el estado vacio de
    // pagina entera. Copiados, no redibujados.
    const { container } = render(<Icono nombre="expediente" />);

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 24');
    expect([...container.querySelectorAll('path')].map((trazo) => trazo.getAttribute('d'))).toEqual([
      'M6.5 3.5h7.5l4 4v13h-11.5z',
      'M14 3.5v4h4',
      'M9.5 12.5h5',
    ]);
  });
});
