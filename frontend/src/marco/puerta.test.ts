import { describe, expect, it } from 'vitest';

import { razonDeLaPuerta } from './puerta.ts';

/**
 * Las cuatro razones son cuatro remedios distintos, y el orden de las ramas es el criterio.
 *
 * Lo que se prueba aqui no es el texto —se reescribe en cuanto alguien lo lee en voz alta— sino
 * la `clave`, que es estable, y las dos decisiones que la pantalla toma a partir de ella: si se
 * ofrece el boton y si el tono es de averia.
 */

const DENTRO = {
  hayPuerta: true,
  vieneDeSalir: false,
  puedeIrALaPuerta: true,
  ultimoFallo: null,
} as const;

describe('por que no se esta dentro', () => {
  it('lo que dijo el emisor gana a todo lo demas', () => {
    // Es el unico que trae informacion de fuera. Mirado despues del tope, tres rebotes contra
    // un `redirect_uri` mal declarado ensenarian «se intento tres veces» —que es cierto y no
    // sirve— en vez de «Invalid parameter: redirect_uri», que nombra la linea que cambiar.
    const razon = razonDeLaPuerta({
      ...DENTRO,
      hayPuerta: false,
      vieneDeSalir: true,
      puedeIrALaPuerta: false,
      ultimoFallo: { motivo: 'El emisor no reconoce a este cliente', detalle: 'redirect_uri' },
    });

    expect(razon.clave).toBe('el-emisor-no-dejo');
    expect(razon.titulo).toBe('El emisor no reconoce a este cliente');
    expect(razon.detalle).toBe('redirect_uri');
  });

  it('sin crypto.subtle no se ofrece volver a la puerta: volveria aqui', () => {
    const razon = razonDeLaPuerta({ ...DENTRO, hayPuerta: false });

    expect(razon.clave).toBe('origen-inseguro');
    // Es la unica de las cuatro que NO ofrece el boton, y esa es la afirmacion: sin
    // `crypto.subtle` no hay reto S256 que calcular, asi que `entrar()` devolveria esta misma
    // pantalla. El remedio es abrir la aplicacion por otra URL.
    expect(razon.ofreceEntrar).toBe(false);
    expect(razon.remedio).toContain('localhost');
  });

  it('cerrar sesion NO es una averia, y el tono lo dice antes que el texto', () => {
    const razon = razonDeLaPuerta({ ...DENTRO, vieneDeSalir: true });

    expect(razon.clave).toBe('se-cerro-sesion');
    // El sistema contesto exactamente lo que se le pidio. Pintarlo de rojo manda a mirar un
    // despliegue por haber pulsado «Salir».
    expect(razon.esAveria).toBe(false);
    expect(razon.ofreceEntrar).toBe(true);
  });

  it('tres idas sin canjear se paran, y se dice que se pararon a proposito', () => {
    const razon = razonDeLaPuerta({ ...DENTRO, puedeIrALaPuerta: false });

    expect(razon.clave).toBe('demasiadas-idas');
    expect(razon.ofreceEntrar).toBe(true);
  });

  it('y el orden entre salir y el tope: salir gana, porque es lo que acaba de pasar', () => {
    const razon = razonDeLaPuerta({ ...DENTRO, vieneDeSalir: true, puedeIrALaPuerta: false });

    // `salir()` borra la cuenta de idas justamente para que esto no se pueda dar en la
    // aplicacion; que aqui haya una respuesta decidida es lo que impide que el dia que se den
    // a la vez la pantalla diga «se intento tres veces» a quien acaba de cerrar sesion.
    expect(razon.clave).toBe('se-cerro-sesion');
  });

  it('las cuatro dicen que hacer, y ninguna dice «reintente» a secas', () => {
    const todas = [
      razonDeLaPuerta({ ...DENTRO, ultimoFallo: { motivo: 'm', detalle: 'd' } }),
      razonDeLaPuerta({ ...DENTRO, hayPuerta: false }),
      razonDeLaPuerta({ ...DENTRO, vieneDeSalir: true }),
      razonDeLaPuerta({ ...DENTRO, puedeIrALaPuerta: false }),
    ];

    expect(new Set(todas.map((r) => r.clave)).size).toBe(4);
    for (const razon of todas) {
      expect(razon.remedio.length, `«${razon.clave}» no dice que hacer`).toBeGreaterThan(20);
      expect(razon.titulo).not.toBe('');
    }
  });
});
