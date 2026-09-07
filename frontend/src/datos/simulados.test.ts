import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { OPERACIONES, claveDe } from './operaciones.ts';
import { ESCRITURAS_SIMULADAS, SIMULADOS, simulado } from './simulados.ts';

/**
 * Lo inventado esta declarado, y lo que reproduce es lo que el backend dice de verdad (AC6, AC8).
 *
 * Dos cosas distintas, y las dos se caen en silencio si nadie las mira:
 *
 *   1. **Que una invencion no nombre la operacion que la sustituira.** Entonces no es un hueco
 *      temporal: es una decision de producto tomada en el frontend, y el dia que el backend
 *      conecte nadie sabra de donde salio la cifra.
 *   2. **Que una negativa simulada se «lea mejor» que la de verdad.** Un texto reescrito aqui
 *      ensena a la pantalla un error que el backend no manda, y el desajuste no aparece hasta
 *      que alguien intenta sellar dos veces el mismo conjunto en produccion.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(AQUI, '../../../backend');
const ADMINISTRAR = join(
  BACKEND,
  'kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros/aplicacion/AdministrarParametros.java',
);
const OBSERVACION = join(
  BACKEND,
  'kamayuk-normativa-dominio-compartido/src/main/java/kamayuk/normativa/dominio/Observacion.java',
);

/**
 * Une lo que Spotless parte: `"abc" + "def"` → `"abcdef"`.
 *
 * **Sin esto la comparacion no encuentra nada**, y ese es el modo de fallo interesante: un
 * `grep` del mensaje completo sale vacio aunque el mensaje este ahi, letra por letra.
 */
function unirCadenas(java: string): string {
  let anterior = java;
  for (;;) {
    const unido = anterior.replace(/"\s*\+\s*"/g, '');
    if (unido === anterior) return unido;
    anterior = unido;
  }
}

function java(ruta: string): string {
  return unirCadenas(readFileSync(ruta, 'utf8'));
}

/**
 * Comprueba que cada trozo del mensaje, partido por lo que el backend interpola, es un literal
 * del fuente de Java.
 *
 * Es lo mas fuerte que se puede afirmar sin ejecutar Java: el backend escribe
 * `"El conjunto " + conjuntoId + " ya esta sellado…"`, asi que lo comparable son las dos mitades
 * y no la frase entera. Una coma cambiada, una tilde anadida o un «para corregirlo» en vez de
 * «corregirlo exige» ponen esto rojo.
 */
function laJavaLoDice(fuente: string, mensaje: string, interpolado: string): void {
  const trozos = mensaje.split(interpolado).filter((t) => t !== '');
  expect(trozos.length, `«${interpolado}» no aparece en «${mensaje}».`).toBeGreaterThan(0);
  for (const trozo of trozos) {
    expect(
      fuente,
      `El backend no dice «${trozo}». Una negativa reescrita «para que se lea mejor» ensena a ` +
        'la pantalla un error que el backend no manda.',
    ).toContain(`"${trozo}"`);
  }
}

const CLAVES = OPERACIONES.map(claveDe);

describe('cada invencion nombra la operacion que la sustituira (AC6)', () => {
  it.each(SIMULADOS.map((s) => [s.clave, s] as const))('%s', (_clave, entrada) => {
    expect(
      CLAVES,
      `El simulado «${entrada.clave}» dice que lo sustituira «${entrada.operacion}», que no es ` +
        'ninguna de las operaciones declaradas. Si el dato no lo publica ninguna, no hay ' +
        'backend que pueda sustituirlo y la invencion es permanente.',
    ).toContain(entrada.operacion);
  });

  it('y explica por que el prototipo no lo trae', () => {
    for (const entrada of SIMULADOS) {
      expect(entrada.porQue.length, `El simulado «${entrada.clave}» no dice por que.`).toBeGreaterThan(
        30,
      );
    }
  });

  it('pedir una clave no declarada revienta, y dice donde se declara', () => {
    expect(() => simulado('unaClaveQueNadieDeclaro')).toThrowError(
      /no esta declarado en simulados\.ts/,
    );
  });
});

describe('las tres escrituras que ADR-0025 §5 anticipa (AC8)', () => {
  it('son exactamente tres, las tres POST, y las tres estan en la tabla como SIMULADA', () => {
    expect(ESCRITURAS_SIMULADAS.map((e) => `${e.metodo} ${e.ruta}`)).toEqual([
      'POST /ediciones',
      'POST /ediciones/{id}/parametros',
      'POST /ediciones/{id}/sellar',
    ]);
    expect(OPERACIONES.filter((o) => o.origen === 'SIMULADA').map(claveDe)).toEqual([
      'POST /ediciones',
      'POST /ediciones/{id}/parametros',
      'POST /ediciones/{id}/sellar',
    ]);
  });

  it('cada una nombra ADR-0025 §5 y que src/main no la tiene', () => {
    for (const escritura of ESCRITURAS_SIMULADAS) {
      expect(escritura.porQue).toContain('ADR-0025 §5');
      expect(escritura.porQue).toContain('src/main` no la tiene');
    }
  });

  it('y el caso de uso que nombran SI existe en AdministrarParametros', () => {
    const fuente = java(ADMINISTRAR);
    for (const escritura of ESCRITURAS_SIMULADAS) {
      const metodo = escritura.casoDeUso.split('.')[1]!;
      // Lo que falta es la ruta, no el comportamiento. Si el metodo tampoco existiera, la
      // escritura no seria «anticipada»: seria inventada de punta a punta.
      expect(fuente, `«${escritura.casoDeUso}» no existe.`).toMatch(
        new RegExp(`public [\\w<>, .]+ ${metodo}\\(`),
      );
    }
  });
});

describe('las negativas son las del backend, letra por letra', () => {
  const administrar = java(ADMINISTRAR);
  const observacion = java(OBSERVACION);
  const sellar = ESCRITURAS_SIMULADAS.find((e) => e.ruta.endsWith('/sellar'))!;

  it('sin observacion no se guarda: 422 VALIDACION, con el texto de Observacion (regla 10)', () => {
    const negativa = sellar.negativa({ conjuntoId: 2, observacion: 'no' });

    expect(negativa?.codigo).toBe('VALIDACION');
    expect(negativa?.estado).toBe(422);
    // El `5` lo interpola el backend desde `LARGO_MINIMO`, que sale de
    // `auditoria_observacion_ck`: `CHECK (length(btrim(observacion)) >= 5)`.
    expect(observacion).toContain('LARGO_MINIMO = 5');
    laJavaLoDice(observacion, negativa?.mensaje ?? '', '5');
  });

  it('y cinco caracteres bastan, que es el borde exacto y no uno parecido', () => {
    expect(sellar.negativa({ conjuntoId: 2, observacion: '12345' })?.codigo).not.toBe('VALIDACION');
    expect(sellar.negativa({ conjuntoId: 2, observacion: '1234' })?.codigo).toBe('VALIDACION');
    // Recortada, como hace `Observacion`: cinco espacios no explican nada.
    expect(sellar.negativa({ conjuntoId: 2, observacion: '     ' })?.codigo).toBe('VALIDACION');
  });

  it('un conjunto que no existe: 404 NO_ENCONTRADO', () => {
    const negativa = sellar.negativa({ conjuntoId: 99, observacion: 'Sellar el conjunto' });

    expect(negativa?.codigo).toBe('NO_ENCONTRADO');
    expect(negativa?.estado).toBe(404);
    laJavaLoDice(administrar, negativa?.mensaje ?? '', '99');
  });

  it('uno ya sellado: 409 CONFLICTO, y corregirlo exige una version nueva', () => {
    const negativa = sellar.negativa({ conjuntoId: 2, observacion: 'Sellar el conjunto' });

    expect(negativa?.codigo).toBe('CONFLICTO');
    expect(negativa?.estado).toBe(409);
    // Primero contra el FUENTE de Java y despues contra el literal: si el orden fuera el otro,
    // una redaccion cambiada saldria roja diciendo «esperaba esta cadena», que es una queja
    // sobre la copia de la prueba. Asi el rojo dice lo que de verdad pasa: el backend no lo dice.
    laJavaLoDice(administrar, negativa?.mensaje ?? '', '2');
    expect(negativa?.mensaje).toBe(
      'El conjunto 2 ya esta sellado; corregirlo exige una version nueva (ADR-0007)',
    );
  });

  it('uno vacio: 409 CONFLICTO, y NO el mismo texto que el anterior', () => {
    const negativa = sellar.negativa({ conjuntoId: 3, observacion: 'Sellar el conjunto' });

    expect(negativa?.codigo).toBe('CONFLICTO');
    laJavaLoDice(administrar, negativa?.mensaje ?? '', '3');
    expect(negativa?.mensaje).toBe(
      'El conjunto 3 no tiene ningun parametro: sellarlo vacio diria que el ejercicio esta ' +
        'parametrizado cuando no lo esta',
    );

    // Las dos son 409 CONFLICTO y se arreglan de maneras OPUESTAS: una abriendo una version
    // nueva y otra agregando parametros. Con el mismo texto, la pantalla manda a quien atiende
    // a hacer justo lo contrario de lo que hace falta.
    const yaSellado = sellar.negativa({ conjuntoId: 2, observacion: 'Sellar el conjunto' });
    expect(negativa?.mensaje).not.toBe(yaSellado?.mensaje);
  });

  it('el orden es el del borde: primero lo que no se puede leer, luego el caso de uso', () => {
    // Un cuerpo que no se puede leer no llega nunca al caso de uso, asi que un conjunto
    // inexistente Y sin observacion contesta 422 y no 404.
    expect(sellar.negativa({ conjuntoId: 99, observacion: '' })?.estado).toBe(422);
  });

  it('las dos escrituras que no sellan no reproducen las negativas del sellado', () => {
    const abrir = ESCRITURAS_SIMULADAS.find((e) => e.ruta === '/ediciones')!;
    // `abrirVersion` no mira ningun conjunto: crea uno. Solo la observacion la sujeta.
    expect(abrir.negativa({ conjuntoId: null, observacion: 'Abrir la version' })).toBeNull();
    expect(abrir.negativa({ conjuntoId: null, observacion: '' })?.codigo).toBe('VALIDACION');

    const agregar = ESCRITURAS_SIMULADAS.find((e) => e.ruta.endsWith('/parametros'))!;
    // Un conjunto SELLADO admite `agregarParametro` en esta simulacion, y es correcto que lo
    // haga: lo que lo impide de verdad es el disparador `conjunto_sellado_inmutable` de la
    // base, no una comprobacion de la aplicacion — y el proxy no tiene base.
    expect(agregar.negativa({ conjuntoId: 2, observacion: 'Agregar la UIT' })).toBeNull();
    expect(agregar.negativa({ conjuntoId: 99, observacion: 'Agregar la UIT' })?.estado).toBe(404);
  });
});
