// @vitest-environment node
//
// Lee JSON y fuentes del disco, y con `KAMAYUK_REGENERAR=1` los escribe. No es un DOM lo que necesita.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CAMPOS_DEL_ACCESO,
  CAMPOS_DEL_MODULO,
  CAMPOS_DEL_PAGINADO,
  CAMPOS_DE_LA_MUNICIPALIDAD,
  CAMPOS_DE_LA_SESION,
} from '../src/datos/lecturas.ts';
import {
  ARCHIVOS,
  CAPTURAS,
  DEL_CATALOGO,
  DE_LA_SESION,
  FRONTEND,
  LA_FECHA,
  captura,
  generar,
  hoy,
} from './capturas-de-seguridad.ts';

/**
 * **Las capturas de la interfaz son las que dejo el backend en `docs/50-api/seguridad/`** (#64, AC 6).
 *
 * El porque entero —que se generan, por que TypeScript y por que en dos sitios— esta en
 * `capturas-de-seguridad.ts`. Aqui se mide que lo que hay en el disco sea **exactamente** lo que el
 * generador escribiria hoy con los cinco JSON, salvo la fecha.
 *
 * El rojo tipico es el del dia en que el backend cambia de forma: `LecturasDeSeguridadDePunta
 * APuntaTest` regenera su JSON en el PR del backend, y este archivo se pone rojo en el mismo PR —
 * `frontend.yml` dispara con `docs/50-api/**`— nombrando el archivo que hay que regenerar.
 *
 * Con `KAMAYUK_REGENERAR=1` (`yarn capturas:regenerar`) no compara: escribe, con la fecha de hoy.
 */

const REGENERAR = process.env['KAMAYUK_REGENERAR'] === '1';

const SALIDAS = [DEL_CATALOGO, DE_LA_SESION] as const;

/** Las llaves de un objeto, ordenadas: lo que se compara es el conjunto, no el orden. */
const llaves = (valor: unknown): readonly string[] =>
  typeof valor === 'object' && valor !== null ? Object.keys(valor).sort() : [];

describe('las capturas de `/seguridad` son las de `docs/50-api/seguridad/`', () => {
  it('EL CENTINELA: las cinco estan, y dicen algo que comparar', () => {
    // Sin esto, un directorio vacio o un JSON con `contenido: []` dejarian el generador escribiendo
    // listas vacias y la comparacion de abajo en verde sobre la nada.
    for (const archivo of Object.values(ARCHIVOS)) {
      expect(existsSync(join(CAPTURAS, archivo)), `falta «docs/50-api/seguridad/${archivo}»`).toBe(
        true,
      );
    }
    expect((captura('modulos') as { contenido: unknown[] }).contenido.length).toBeGreaterThan(0);
    expect((captura('accesos') as { contenido: unknown[] }).contenido.length).toBeGreaterThan(0);
    expect(Object.keys(captura('permisos') as object).length).toBeGreaterThan(0);
    // Y el generador escribe una fecha que su propia expresion reconoce: si no, la comparacion no
    // sabria que linea ignorar y saldria roja cada manana por la razon equivocada.
    for (const texto of Object.values(generar(hoy()))) expect(texto).toMatch(LA_FECHA);
  });

  it.each(SALIDAS)('«%s» es lo que escribe el generador con los JSON de hoy', (ruta) => {
    const destino = join(FRONTEND, ruta);

    if (REGENERAR) {
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, generar(hoy())[ruta] ?? '', 'utf8');
      return;
    }

    expect(existsSync(destino), `falta «${ruta}». Se genera con \`yarn capturas:regenerar\`.`).toBe(
      true,
    );
    const enElDisco = readFileSync(destino, 'utf8');
    const fecha = LA_FECHA.exec(enElDisco)?.[1];
    expect(fecha, `«${ruta}» no dice cuando se tomo: le falta la fecha en la cabecera`).toBeDefined();

    expect(
      enElDisco,
      `«${ruta}» ya no es lo que el backend contesta.\n` +
        '  Los JSON de `docs/50-api/seguridad/` cambiaron —los regenera\n' +
        '  `LecturasDeSeguridadDePuntaAPuntaTest`— o alguien edito el archivo a mano.\n' +
        '  Se arregla con `yarn capturas:regenerar`, nunca editandolo.',
    ).toBe(generar(fecha ?? '')[ruta]);
  });

  it('y lo capturado trae los campos que la interfaz LEE, fila a fila', () => {
    // Es la mitad que el tipo no da: el `.ts` generado se tipa contra los testigos, pero un campo de
    // mas en el JSON compila igual. Lo que se siembra y lo que se lee tienen que ser lo mismo.
    const modulos = captura('modulos') as { contenido: readonly unknown[] };
    const accesos = captura('accesos') as { contenido: readonly unknown[] };

    expect(llaves(modulos)).toEqual(Object.keys(CAMPOS_DEL_PAGINADO).sort());
    expect(llaves(accesos)).toEqual(Object.keys(CAMPOS_DEL_PAGINADO).sort());
    for (const fila of modulos.contenido) {
      expect(llaves(fila)).toEqual(Object.keys(CAMPOS_DEL_MODULO).sort());
    }
    for (const fila of accesos.contenido) {
      expect(llaves(fila)).toEqual(Object.keys(CAMPOS_DEL_ACCESO).sort());
    }
    expect(llaves(captura('sesion'))).toEqual(Object.keys(CAMPOS_DE_LA_SESION).sort());
    expect(llaves(captura('municipalidad'))).toEqual(
      Object.keys(CAMPOS_DE_LA_MUNICIPALIDAD).sort(),
    );
    // Y la matriz es un mapa de LISTAS de privilegios en minuscula: «LECTURA» dejaria el menu vacio
    // sin un solo error, porque `componer` busca «lectura» tal cual.
    for (const [codigo, privilegios] of Object.entries(captura('permisos') as object)) {
      expect(Array.isArray(privilegios), `«${codigo}» no trae una lista`).toBe(true);
      for (const privilegio of privilegios as readonly string[]) {
        expect(privilegio).toBe(privilegio.toLowerCase());
      }
    }
  });
});
