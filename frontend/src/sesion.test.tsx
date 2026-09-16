import { TEXTOS_DEL_ARMAZON } from '@kamayuk/shell';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Aplicacion } from './aplicacion.tsx';
import { cerrarLasPreferencias } from './preferencias/cajon.ts';
import { fijarElPorQue } from './puerta/falla.ts';
import { CUENTA, ENTIDAD, OPCIONES_DE_SESION, identidad } from './sesion.ts';

/**
 * **El menu de sesion y la puerta caida, sobre el DOM** (#57, AC 6 y AC 7).
 *
 * <h2>Por que aqui y no en `src/aplicacion.test.tsx`</h2>
 *
 * Porque aquel archivo prueba lo que #55 monto —que el armazon se dibuja con UN solo React— y lo
 * comparte con #58, que le anade las cuatro hojas. Lo de este issue es la costura `src/sesion.ts`,
 * y tiene su archivo por lo mismo que cada issue de la ola 2 tiene el suyo: para que dos ramas no
 * editen las mismas lineas.
 *
 * <h2>Se pulsa cada opcion, una a una</h2>
 *
 * Y no se comprueba «hay cuatro opciones»: una lista de cuatro rotulos cableados a funciones vacias
 * pasaria esa comprobacion entera. Lo que se afirma es que cada pulsacion llega a la puerta o abre
 * el cajon. Lo mismo por el otro lado —que ninguna se quede muda leyendo la costura— lo hace
 * `verificaciones/ninguna-opcion-del-menu-se-queda-muda.test.ts`.
 */

beforeAll(() => {
  // Lo que jsdom no trae y las piezas del armazon piden. El mismo relleno que
  // `src/aplicacion.test.tsx` y que las pruebas del armazon en `rentas`.
  Element.prototype.scrollIntoView = () => {};
  globalThis.matchMedia ??= ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof matchMedia;
});

beforeEach(() => {
  fijarElPorQue(null);
  // El cajon de preferencias es estado de MODULO —ver `preferencias/cajon.ts`—, asi que se queda
  // abierto de una prueba a la siguiente. Y abierto no es inocuo: es un dialogo de Radix, que pone
  // `pointer-events: none` en el cuerpo y `aria-hidden` en todo lo que no es el dialogo. Sin esta
  // linea, la prueba de «Cerrar sesion» no puede pulsar nada y la de la puerta caida no encuentra
  // su `role="alert"` — dos rojos que hablan del DOM y no de lo que se venia a probar.
  cerrarLasPreferencias();
});

afterEach(() => {
  fijarElPorQue(null);
  cerrarLasPreferencias();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-tema');
  document.documentElement.removeAttribute('data-modo');
  window.location.hash = '';
});

/** Abre el menu de la cuenta y devuelve con que interactuar. */
async function abrirElMenu() {
  const persona = userEvent.setup();
  await persona.click(screen.getByLabelText(TEXTOS_DEL_ARMAZON.opcionesDeLaSesion));
  return persona;
}

describe('AC 6 — las cuatro opciones del menu de sesion, pulsadas una a una', () => {
  it('«Mi perfil» lleva a la consola de la cuenta del emisor', async () => {
    const abrir = vi.spyOn(identidad, 'abrirLaCuenta').mockImplementation(() => {});
    render(<Aplicacion />);

    const persona = await abrirElMenu();
    await persona.click(await screen.findByText('Mi perfil'));

    // No se dibuja aqui ningun formulario de perfil: la autorizacion es de `identidad` desde
    // ADR-0039 y ningun backend de este repositorio puede atender esa escritura.
    expect(abrir).toHaveBeenCalledWith('perfil');
  });

  it('«Cambiar la contrasena» lleva a la pagina de claves del emisor', async () => {
    const abrir = vi.spyOn(identidad, 'abrirLaCuenta').mockImplementation(() => {});
    render(<Aplicacion />);

    const persona = await abrirElMenu();
    await persona.click(await screen.findByText('Cambiar la contrasena'));

    // La contrasena NUNCA llega a ningun sistema del producto: la guarda Keycloak, que es quien la
    // pide en su formulario.
    expect(abrir).toHaveBeenCalledWith('contrasena');
  });

  it('«Preferencias» abre el cajon del tema, que antes no estaba', async () => {
    render(<Aplicacion />);
    expect(document.querySelector('[data-slot="mando-de-tema"]')).toBeNull();

    const persona = await abrirElMenu();
    await persona.click(await screen.findByText('Preferencias'));

    expect(await screen.findByText('Identidad visual')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="mando-de-tema"]')).not.toBeNull();
  });

  it('«Cerrar sesion» cierra en el emisor', async () => {
    const salir = vi.spyOn(identidad, 'salir').mockImplementation(() => {});
    render(<Aplicacion />);

    const persona = await abrirElMenu();
    await persona.click(await screen.findByText('Cerrar sesión'));

    expect(salir).toHaveBeenCalledTimes(1);
  });

  it('y las cuatro estan, en el orden de `rentas`', () => {
    expect(OPCIONES_DE_SESION.map((o) => o.rotulo)).toEqual([
      'Mi perfil',
      'Cambiar la contrasena',
      'Preferencias',
      'Cerrar sesión',
    ]);
    // La que no se deshace se pinta distinta, y es la unica.
    expect(OPCIONES_DE_SESION.filter((o) => o.peligrosa === true).map((o) => o.rotulo)).toEqual([
      'Cerrar sesión',
    ]);
  });
});

describe('AC 6 — ningun nombre de persona ni de entidad escrito', () => {
  it('la barra no nombra a nadie ni a ninguna municipalidad', () => {
    render(<Aplicacion />);

    // La V6 escribia «H. Neyra Alama» (`c01fe9a:src/marco/BarraGlobal.tsx:70-76`) y `rentas` llevo
    // «Municipalidad Distrital de Catacaos» hasta su I-1. G2 (#52) lo prohibe: la cuenta y la
    // municipalidad salen de la sesion, y hasta #54 y #64 no hay de donde leerlas.
    const texto = document.body.textContent ?? '';
    expect(texto).not.toContain('Municipalidad');
    expect(texto).not.toContain('Neyra');
    expect(texto).not.toContain('Catacaos');
    // Y lo que SI se ve es el marcador, tomado de la costura y no repetido aqui.
    expect(screen.getAllByText(ENTIDAD).length).toBeGreaterThan(0);
    expect(screen.getAllByText(CUENTA.iniciales).length).toBeGreaterThan(0);
  });
});

describe('AC 4 y AC 7 — la puerta caida se ve, y solo cuando la hay', () => {
  it('sin falla no se dibuja nada: no es un estado mas de la pantalla', () => {
    render(<Aplicacion />);

    expect(document.querySelector('[data-slot="puerta-caida"]')).toBeNull();
  });

  it('con falla se ve el emisor, la URL y el motivo', () => {
    fijarElPorQue({
      tipo: 'no-contesto',
      falla: {
        emisor: 'http://localhost:8181/realms/kamayuk',
        url: 'http://localhost:8181/realms/kamayuk/.well-known/openid-configuration',
        motivo: 'Failed to fetch',
      },
    });

    render(<Aplicacion />);

    const senas = document.querySelector('[data-slot="senas-del-emisor"]')?.textContent ?? '';
    // Las tres causas —la plataforma sin levantar, un `ConfigMap` con la URL equivocada y un
    // cortafuegos— se distinguen leyendo QUE URL se pidio. Sin ella las tres son «no conecta», y
    // las tres se arreglan en sitios distintos.
    expect(senas).toContain('http://localhost:8181/realms/kamayuk');
    expect(senas).toContain('/.well-known/openid-configuration');
    expect(senas).toContain('Failed to fetch');
  });

  it('y lo dice como un aviso, no como un parrafo mas', () => {
    fijarElPorQue({ tipo: 'no-contesto', falla: { emisor: 'e', url: 'u', motivo: 'm' } });

    render(<Aplicacion />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('y el OTRO caso —el emisor que no dejo entrar— tambien llega a la pantalla', () => {
    // Es la leccion propia de este sistema: sin lectura obligatoria al arrancar, un `?error=` se
    // quedaria mudo. Ver `puerta/falla.ts`.
    fijarElPorQue({
      tipo: 'no-dejo-entrar',
      motivo: 'El emisor no reconoce a este cliente',
      detalle: 'Invalid parameter: redirect_uri',
    });

    render(<Aplicacion />);

    const aviso = screen.getByRole('alert');
    expect(aviso.getAttribute('data-porque')).toBe('no-dejo-entrar');
    expect(aviso.textContent ?? '').toContain('El emisor no reconoce a este cliente');
    expect(aviso.textContent ?? '').toContain('Invalid parameter: redirect_uri');
  });
});
