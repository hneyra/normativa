import { peldanoDe } from '@kamayuk/sesion';
import { TEXTOS_DEL_ARMAZON } from '@kamayuk/shell';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MUNICIPALIDAD_MEDIDA, SESION_MEDIDA } from '../desarrollo/sesionMedida.ts';
import {
  NADIE_CONTESTA,
  contestarLaSeguridad,
} from '../verificaciones/la-seguridad-contestada.ts';
import { Aplicacion } from './aplicacion.tsx';
import { CONSULTAS } from './datos/proveedor.tsx';
import i18n, { ABRE, IDIOMA_MARCADO, IDIOMA_POR_OMISION } from './i18n/i18n.ts';
import { cerrarLasPreferencias } from './preferencias/cajon.ts';
import { fijarElPorQue } from './puerta/falla.ts';
import {
  FRASES_DE_LA_SESION,
  OPCIONES_DE_SESION,
  SIN_INICIALES,
  cuentaDe,
  entidadDe,
  identidad,
  inicialesDe,
} from './sesion.ts';

/**
 * **El menu de sesion, la puerta caida y lo que la sesion pone en la barra** (#57 y #64).
 *
 * <h2>Por que aqui y no en `src/aplicacion.test.tsx`</h2>
 *
 * Porque aquel archivo prueba lo que #55 monto —que el armazon se dibuja con UN solo React— y lo
 * comparte con #58, que le anade las cuatro hojas. Lo de este archivo es la costura `src/sesion.ts`,
 * y tiene su archivo por lo mismo que cada issue de la ola 2 tiene el suyo: para que dos ramas no
 * editen las mismas lineas.
 *
 * <h2>Se pulsa cada opcion, una a una</h2>
 *
 * Y no se comprueba «hay cuatro opciones»: una lista de cuatro rotulos cableados a funciones vacias
 * pasaria esa comprobacion entera. Lo que se afirma es que cada pulsacion llega a la puerta o abre
 * el cajon. Lo mismo por el otro lado —que ninguna se quede muda leyendo la costura— lo hace
 * `verificaciones/ninguna-opcion-del-menu-se-queda-muda.test.ts`.
 *
 * <h2>Y desde #64, la cuenta y la entidad salen de `/seguridad`</h2>
 *
 * Se miden dos veces: `cuentaDe` y `entidadDe` sueltas —son puras—, en sus tres estados; y la barra
 * montada con las capturas del backend, y con OTRA municipalidad, para que un literal que por
 * casualidad coincidiera con la captura no pase.
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
  // Y la cache de consultas, tambien de modulo: cada prueba contesta lo suyo.
  CONSULTAS.clear();
});

afterEach(async () => {
  fijarElPorQue(null);
  cerrarLasPreferencias();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-tema');
  document.documentElement.removeAttribute('data-modo');
  window.location.hash = '';
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

/** Monta la aplicacion con la seguridad contestada y espera a la barra. */
async function montar(): Promise<void> {
  contestarLaSeguridad();
  render(<Aplicacion />);
  await screen.findByText(MUNICIPALIDAD_MEDIDA.nombre);
}

/** Abre el menu de la cuenta y devuelve con que interactuar. */
async function abrirElMenu() {
  const persona = userEvent.setup();
  await persona.click(screen.getByLabelText(TEXTOS_DEL_ARMAZON.opcionesDeLaSesion));
  return persona;
}

describe('AC 6 — las cuatro opciones del menu de sesion, pulsadas una a una', () => {
  it('«Mi perfil» lleva a la consola de la cuenta del emisor', async () => {
    const abrir = vi.spyOn(identidad, 'abrirLaCuenta').mockImplementation(() => {});
    await montar();

    const persona = await abrirElMenu();
    await persona.click(await screen.findByText('Mi perfil'));

    // No se dibuja aqui ningun formulario de perfil: la autorizacion es de `identidad` desde
    // ADR-0039 y ningun backend de este repositorio puede atender esa escritura.
    expect(abrir).toHaveBeenCalledWith('perfil');
  });

  it('«Cambiar la contrasena» lleva a la pagina de claves del emisor', async () => {
    const abrir = vi.spyOn(identidad, 'abrirLaCuenta').mockImplementation(() => {});
    await montar();

    const persona = await abrirElMenu();
    await persona.click(await screen.findByText('Cambiar la contrasena'));

    // La contrasena NUNCA llega a ningun sistema del producto: la guarda Keycloak, que es quien la
    // pide en su formulario.
    expect(abrir).toHaveBeenCalledWith('contrasena');
  });

  it('«Preferencias» abre el cajon del tema, que antes no estaba', async () => {
    await montar();
    expect(document.querySelector('[data-slot="mando-de-tema"]')).toBeNull();

    const persona = await abrirElMenu();
    await persona.click(await screen.findByText('Preferencias'));

    expect(await screen.findByText('Identidad visual')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="mando-de-tema"]')).not.toBeNull();
  });

  it('«Cerrar sesion» cierra en el emisor', async () => {
    const salir = vi.spyOn(identidad, 'salir').mockImplementation(() => {});
    await montar();

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

describe('AC 5 de #64 — la cuenta y la entidad salen de `/seguridad`, nunca de un literal', () => {
  it('la barra dice la municipalidad y la cuenta que CONTESTO la sesion', async () => {
    await montar();

    // La V6 escribia «H. Neyra Alama» (`c01fe9a:src/marco/BarraGlobal.tsx:70-76`) y `rentas` llevo
    // «Municipalidad Distrital de Catacaos» hasta su I-1. G2 (#52) lo prohibe.
    expect(screen.getAllByText(MUNICIPALIDAD_MEDIDA.nombre).length).toBeGreaterThan(0);
    expect(screen.getAllByText(inicialesDe(SESION_MEDIDA.nombre)).length).toBeGreaterThan(0);
    const texto = document.body.textContent ?? '';
    expect(texto).not.toContain('Neyra');
    expect(texto).not.toContain('Catacaos');
  });

  it('y con OTRA municipalidad dice la otra: no hay un nombre escrito que coincida por casualidad', async () => {
    const otra = { ...MUNICIPALIDAD_MEDIDA, nombre: `${MUNICIPALIDAD_MEDIDA.nombre} (otra)` };
    contestarLaSeguridad({ 'GET /seguridad/sesion/municipalidad': { estado: 200, cuerpo: otra } });
    render(<Aplicacion />);

    expect(await screen.findByText(otra.nombre)).toBeInTheDocument();
  });

  it('si la municipalidad no contesta, la barra dice el peldano y no pone un nombre de ejemplo', async () => {
    contestarLaSeguridad({ 'GET /seguridad/sesion/municipalidad': { sinRed: true } });
    render(<Aplicacion />);

    expect(await screen.findByText(peldanoDe(NADIE_CONTESTA).titulo)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain(MUNICIPALIDAD_MEDIDA.nombre);
  });
});

describe('`cuentaDe` y `entidadDe`: tres estados, y solo uno nombra a alguien', () => {
  it('mientras se pide: la frase que lo dice, y un circulo que no son las iniciales de nadie', () => {
    const cuenta = cuentaDe({ estado: 'pidiendo' });
    expect(cuenta.nombre).toBe(FRASES_DE_LA_SESION.averiguandoLaCuenta);
    expect(cuenta.iniciales).toBe(SIN_INICIALES);
    expect(entidadDe({ estado: 'pidiendo' })).toBe(FRASES_DE_LA_SESION.averiguandoLaEntidad);
  });

  it('y la frase de mientras se pide se traduce AL LEERLA, no al componerla', async () => {
    const cuenta = cuentaDe({ estado: 'pidiendo' });
    await i18n.changeLanguage(IDIOMA_MARCADO);
    expect(cuenta.nombre.startsWith(ABRE)).toBe(true);
  });

  it('si fallo: lo que dice la escalera, sin traduccion paralela', () => {
    const peldano = peldanoDe(NADIE_CONTESTA);
    expect(cuentaDe({ estado: 'fallo', error: NADIE_CONTESTA })).toEqual({
      nombre: peldano.titulo,
      iniciales: SIN_INICIALES,
      nota: peldano.detalle,
    });
    expect(entidadDe({ estado: 'fallo', error: NADIE_CONTESTA })).toBe(peldano.titulo);
  });

  it('lista: el nombre de la fila de `usuario`, sus iniciales y la cuenta debajo', () => {
    const cuenta = cuentaDe({ estado: 'lista', dato: SESION_MEDIDA });
    expect(cuenta.nombre).toBe(SESION_MEDIDA.nombre);
    expect(cuenta.iniciales).toBe(inicialesDe(SESION_MEDIDA.nombre));
    expect(cuenta.nota).toBe(SESION_MEDIDA.cuenta);
    expect(entidadDe({ estado: 'lista', dato: MUNICIPALIDAD_MEDIDA })).toBe(
      MUNICIPALIDAD_MEDIDA.nombre,
    );
  });

  it('y un nombre en blanco no es un nombre: se dice la cuenta', () => {
    const cuenta = cuentaDe({ estado: 'lista', dato: { ...SESION_MEDIDA, nombre: '  ' } });
    expect(cuenta.nombre).toBe(SESION_MEDIDA.cuenta);
  });

  it('las iniciales: la primera de las dos primeras palabras, en mayuscula', () => {
    expect(inicialesDe('ana maria quispe')).toBe('AM');
    expect(inicialesDe('  Úrsula  ')).toBe('Ú');
    expect(inicialesDe('')).toBe(SIN_INICIALES);
  });
});

describe('AC 4 y AC 7 — la puerta caida se ve, y solo cuando la hay', () => {
  it('sin falla no se dibuja nada: no es un estado mas de la pantalla', async () => {
    await montar();

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
    contestarLaSeguridad();

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
    contestarLaSeguridad();

    render(<Aplicacion />);

    expect(
      [...document.querySelectorAll('[role="alert"]')].some(
        (aviso) => aviso.getAttribute('data-slot') === 'puerta-caida',
      ),
    ).toBe(true);
  });

  it('y el OTRO caso —el emisor que no dejo entrar— tambien llega a la pantalla', () => {
    // Es la leccion propia de este sistema: un `?error=` se quedaria mudo sin ella. Ver
    // `puerta/falla.ts`.
    fijarElPorQue({
      tipo: 'no-dejo-entrar',
      motivo: 'El emisor no reconoce a este cliente',
      detalle: 'Invalid parameter: redirect_uri',
    });
    contestarLaSeguridad();

    render(<Aplicacion />);

    const aviso = document.querySelector('[data-slot="puerta-caida"]');
    expect(aviso?.getAttribute('data-porque')).toBe('no-dejo-entrar');
    expect(aviso?.textContent ?? '').toContain('El emisor no reconoce a este cliente');
    expect(aviso?.textContent ?? '').toContain('Invalid parameter: redirect_uri');
  });
});
