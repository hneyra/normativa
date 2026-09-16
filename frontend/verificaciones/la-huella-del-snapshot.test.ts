// Corre en jsdom —el entorno por omision— y no en `node`, por lo mismo que
// `el-nulo-no-es-un-cero.test.ts`: importa el conector, que arrastra `src/api/cliente.ts` ->
// `src/sesion.ts`, y ahi hay un `window.location.origin` de nivel de modulo. En `node` eso es
// «ReferenceError: window is not defined» al CARGAR, sin una sola prueba ejecutada.
//
// Y ademas hace falta un DOM de verdad: la entrega del archivo crea un `<a download>`, lo pulsa y
// revoca la URL del `Blob`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AMBITO_DE_LA_FICHA,
  CACHE_CONTROL_DEL_CONTRATO,
  FRASES_DE_LA_PUBLICACION,
  PUBLICACION,
  guardarElSnapshot,
  nombreDelArchivo,
  olvidarLoDescargado,
  tonoDeLaComprobacion,
  type Descarga,
  type LoDeLaPublicacion,
} from '../src/datos/publicacion.ts';
import {
  AMBITOS,
  CLAVE_DE_LAS_LISTAS,
  CLAVE_DE_LA_PUBLICACION,
  DATO_DEL_IMPEDIMENTO,
  DATO_DEL_TONO,
  type Ambito,
} from '../src/datos/lecturas.ts';
import { huellaAnunciada, sePuedeCalcularLaHuella, sha256DeLosBytes } from '../src/datos/huella.ts';
import { coordenada } from '@kamayuk/ui';

/**
 * **El `ETag` es el `sha256` de los BYTES, y esta pantalla lo comprueba** (#67, AC 2, 3, 4, 5, 6 y 7).
 *
 * <h2>Que renace aqui</h2>
 *
 * La leccion que la V6 dejo medida y que salio con ella en #50:
 * `c01fe9a:frontend/src/api/proxy.test.ts:342-368` —«el ETag es el sha256 de los bytes servidos» y
 * «con Cache-Control immutable»—, y la comprobacion que su cliente hacia
 * (`c01fe9a:frontend/src/api/cliente.ts:294-338`). La epica #47 la manda renacer en este issue.
 *
 * <h2>Por que se ejerce el CONECTOR y no la pantalla</h2>
 *
 * Porque el conector es quien decide, y porque asi el rojo nombra el veredicto y no un nodo del
 * DOM. Lo que se dobla es **`fetch`**, no el cliente: asi la peticion pasa por `@kamayuk/api` de
 * verdad —su prefijo, su token, su `ErrorDeLaApi`— y lo que se mide es el camino que se usa.
 *
 * <h2>El cuerpo lleva TILDES, y eso es la mitad de la prueba</h2>
 *
 * «Resolución Ministerial» aparece en cada fila del derivado del corpus. Sobre un cuerpo sin
 * tildes, `sha256` de los bytes UTF-8 y `sha256` de las unidades de codigo de JavaScript **dan lo
 * mismo**, y una prueba escrita con un cuerpo ASCII pasaria con las dos implementaciones. Con la
 * tilde, no: es el unico sitio donde la diferencia se ve.
 */

/* ── El doble de `fetch`, que sirve lo que cada caso quiera ────────────────────────────────── */

/** Lo que el doble contesta para un ambito. */
interface Servido {
  readonly cuerpo: string;
  /** Lo que va en el `ETag`, ya con sus comillas si las lleva. `null`: no se manda la cabecera. */
  readonly etag: string | null;
  readonly cacheControl?: string | null;
}

/** La identidad que devuelve `GET /conjuntos`. */
const VIGENTE = { conjuntoId: 2, ejercicio: 2026, version: 3 };

/**
 * Un cuerpo de snapshot **con la forma que el contrato publica** y con tildes dentro.
 *
 * Las cifras son de juguete y no salen de ningun corpus: lo que esta prueba mide es la huella de
 * unos bytes, no un valor normativo. Por eso `documentoFuente` es lo unico que lleva texto, y lleva
 * el que hace divergir las dos formas de resumir.
 */
function cuerpoDe(ambito: Ambito, parametros = 33): string {
  const laValuacion = ambito === 'VALUACION';
  // **Con sangrado**, y no es estetica: lo que el servidor firma son SUS bytes, y nada obliga a que
  // coincidan con los que esta interfaz produciria al volver a serializar el objeto. Con un cuerpo
  // compacto, resumir sobre `JSON.stringify(JSON.parse(texto))` —o guardar el objeto reserializado
  // en vez de los bytes— daria lo mismo y estas pruebas pasarian con las dos implementaciones.
  return JSON.stringify(
    {
      conjuntoId: VIGENTE.conjuntoId,
      ejercicio: VIGENTE.ejercicio,
      version: VIGENTE.version,
      ambito,
      filas: parametros,
      parametros: Array.from({ length: parametros }, (_, i) => ({
        tipo: 'UIT',
        clave: `clave-${String(i)}`,
        documentoFuente: 'Resolución Ministerial',
      })),
      valoresUnitarios: laValuacion ? [{ partida: 'A', documentoFuente: 'Resolución Ministerial' }] : [],
      depreciaciones: laValuacion ? [{ uso: 'CASA', documentoFuente: 'Resolución Ministerial' }] : [],
      valoresReferenciales: laValuacion
        ? []
        : [{ categoria: 'A', documentoFuente: 'Resolución Ministerial' }],
    },
    null,
    2,
  );
}

/** Instala el doble de `fetch` y devuelve cuantas veces se pidio cada ruta. */
function servir(porAmbito: Readonly<Record<Ambito, Servido>>): { readonly pedidas: string[] } {
  const pedidas: string[] = [];
  vi.stubGlobal('fetch', ((entrada: RequestInfo | URL) => {
    const ruta = String(entrada);
    pedidas.push(ruta);
    if (ruta.includes('/snapshot')) {
      const ambito = (AMBITOS.find((uno) => ruta.includes(`ambito=${uno}`)) ?? 'VALUACION') as Ambito;
      const servido = porAmbito[ambito];
      const cabeceras = new Headers({ 'Content-Type': 'application/json' });
      if (servido.etag !== null) cabeceras.set('ETag', servido.etag);
      const cache = servido.cacheControl === undefined ? CACHE_CONTROL_DEL_CONTRATO : servido.cacheControl;
      if (cache !== null) cabeceras.set('Cache-Control', cache);
      return Promise.resolve(new Response(servido.cuerpo, { status: 200, headers: cabeceras }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(VIGENTE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as typeof fetch);
  return { pedidas };
}

/** Sirve los dos ambitos con su huella de verdad, y con lo que cada caso quiera cambiar. */
async function losDosBien(
  cambios: Partial<Record<Ambito, Partial<Servido>>> = {},
): Promise<Readonly<Record<Ambito, Servido>>> {
  const salida = {} as Record<Ambito, Servido>;
  for (const ambito of AMBITOS) {
    const cuerpo = cambios[ambito]?.cuerpo ?? cuerpoDe(ambito);
    salida[ambito] = {
      cuerpo,
      etag: `"${await sha256DeLosBytes(cuerpo)}"`,
      ...cambios[ambito],
    };
  }
  return salida;
}

/** Pide la hoja entera, como lo hace `useDatosDeLaHoja`. */
async function pedir(): Promise<LoDeLaPublicacion> {
  const lectura = PUBLICACION.lecturas[0];
  expect(lectura?.clave, 'la hoja dejo de declarar su lectura').toBe(CLAVE_DE_LA_PUBLICACION);
  return (await lectura?.pedir(new AbortController().signal)) as LoDeLaPublicacion;
}

/** Y reparte lo que llego, como lo hace el interprete. */
function repartir(lo: LoDeLaPublicacion) {
  return PUBLICACION.repartir(new Map([[CLAVE_DE_LA_PUBLICACION, lo]]));
}

/** La descarga del ambito que la ficha ensena. */
function laFicha(lo: LoDeLaPublicacion): Descarga {
  const descarga = lo.porAmbito.get(AMBITO_DE_LA_FICHA);
  expect(descarga, `no llego la descarga de «${AMBITO_DE_LA_FICHA}»`).toBeDefined();
  return descarga as Descarga;
}

afterEach(() => {
  vi.unstubAllGlobals();
  olvidarLoDescargado();
});

/* ── AC 2 — la huella, sobre los bytes ─────────────────────────────────────────────────────── */

describe('el sha256 se calcula sobre los BYTES del texto recibido', () => {
  it('EL CENTINELA: con una tilde dentro, los bytes y las unidades de JavaScript NO dan lo mismo', async () => {
    // Es la premisa de todo lo demas. Sobre un cuerpo ASCII las dos formas coinciden y esta guarda
    // pasaria con la implementacion equivocada; con «Resolución Ministerial» dentro, no.
    const conTilde = cuerpoDe('VALUACION');
    expect(conTilde, 'el cuerpo de prueba perdio su tilde: la medicion se queda sin sujeto').toContain(
      'Resolución',
    );

    const deLosBytes = await sha256DeLosBytes(conTilde);
    // La otra forma, la mala: un byte por unidad de codigo. Se escribe aqui —y no se importa de
    // `src/`— precisamente porque es la que NO tiene que estar en el codigo.
    const porUnidades = new Uint8Array([...conTilde].map((letra) => letra.charCodeAt(0) & 0xff));
    const otra = [...new Uint8Array(await crypto.subtle.digest('SHA-256', porUnidades))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    expect(deLosBytes).not.toBe(otra);
    expect(deLosBytes).toMatch(/^[0-9a-f]{64}$/);
  });

  it('con el ETag de verdad, la descarga sale VERIFICADA', async () => {
    servir(await losDosBien());
    const lo = await pedir();

    expect(laFicha(lo).veredicto).toEqual({
      clase: 'verificada',
      huella: await sha256DeLosBytes(cuerpoDe(AMBITO_DE_LA_FICHA)),
    });
    expect(tonoDeLaComprobacion(laFicha(lo))).toBe('ok');
  });

  it('con UN BYTE del cuerpo cambiado, NO cuadra — y se enseñan las DOS huellas', async () => {
    const bueno = cuerpoDe(AMBITO_DE_LA_FICHA);
    const anunciada = await sha256DeLosBytes(bueno);
    // El ETag sigue siendo el del cuerpo bueno; lo que se sirve es el cuerpo con una letra cambiada.
    const tocado = bueno.replace('Resolución', 'Resolucion');
    expect(tocado, 'el cuerpo no cambio: no hay nada que medir').not.toBe(bueno);
    servir({
      ...(await losDosBien()),
      [AMBITO_DE_LA_FICHA]: { cuerpo: tocado, etag: `"${anunciada}"` },
    } as Record<Ambito, Servido>);

    const lo = await pedir();
    const veredicto = laFicha(lo).veredicto;

    expect(veredicto.clase).toBe('no-cuadra');
    expect(veredicto).toEqual({
      clase: 'no-cuadra',
      anunciada,
      calculada: await sha256DeLosBytes(tocado),
    });
    expect(tonoDeLaComprobacion(laFicha(lo))).toBe('mal');

    // Y la pantalla las DICE las dos: el motivo del boton impedido las lleva dentro.
    const motivo = repartir(lo).nombrados?.get(DATO_DEL_IMPEDIMENTO);
    expect(String(motivo)).toContain(anunciada);
    expect(String(motivo)).toContain(await sha256DeLosBytes(tocado));
  });

  it('y la respuesta NO se reserializa: el texto que se guarda es el que llego', async () => {
    // `JSON.parse` y `JSON.stringify` no son inversas. Un cuerpo con blancos dentro tiene otra
    // huella al volver a serializarlo, y esta es la forma de medir que no se hace.
    const conBlancos = `${cuerpoDe(AMBITO_DE_LA_FICHA).slice(0, -1)} }`;
    expect(JSON.stringify(JSON.parse(conBlancos))).not.toBe(conBlancos);
    servir({
      ...(await losDosBien()),
      [AMBITO_DE_LA_FICHA]: { cuerpo: conBlancos, etag: `"${await sha256DeLosBytes(conBlancos)}"` },
    } as Record<Ambito, Servido>);

    const lo = await pedir();

    expect(laFicha(lo).texto).toBe(conBlancos);
    expect(laFicha(lo).veredicto.clase).toBe('verificada');
  });
});

describe('el ETag tiene que ser FUERTE y ser un sha256', () => {
  it('sin ETag no se acepta, y se dice', async () => {
    servir({
      ...(await losDosBien()),
      [AMBITO_DE_LA_FICHA]: { cuerpo: cuerpoDe(AMBITO_DE_LA_FICHA), etag: null },
    } as Record<Ambito, Servido>);

    const lo = await pedir();

    expect(laFicha(lo).veredicto).toEqual({ clase: 'sin-etag' });
    expect(tonoDeLaComprobacion(laFicha(lo))).toBe('mal');
  });

  it('un ETag debil `W/` NO se normaliza quitandole la W: se rechaza nombrandolo', async () => {
    const cuerpo = cuerpoDe(AMBITO_DE_LA_FICHA);
    const huella = await sha256DeLosBytes(cuerpo);
    servir({
      ...(await losDosBien()),
      [AMBITO_DE_LA_FICHA]: { cuerpo, etag: `W/"${huella}"` },
    } as Record<Ambito, Servido>);

    const lo = await pedir();

    // Lo que importa: **aunque la huella de dentro sea la correcta**, no se acepta.
    expect(laFicha(lo).veredicto).toEqual({ clase: 'etag-debil', etag: `W/"${huella}"` });
    expect(tonoDeLaComprobacion(laFicha(lo))).toBe('mal');
  });

  it('y un ETag que no es un sha256 se dice aparte: lo que cambio es el algoritmo', async () => {
    servir({
      ...(await losDosBien()),
      [AMBITO_DE_LA_FICHA]: { cuerpo: cuerpoDe(AMBITO_DE_LA_FICHA), etag: '"v3"' },
    } as Record<Ambito, Servido>);

    const lo = await pedir();

    expect(laFicha(lo).veredicto).toEqual({ clase: 'etag-que-no-es-sha256', etag: '"v3"' });
  });

  it('EL CENTINELA de la lectura del ETag, caso a caso y sin red', () => {
    expect(huellaAnunciada(null)).toEqual({ clase: 'sin-etag' });
    expect(huellaAnunciada('W/"abc"')).toEqual({ clase: 'etag-debil', etag: 'W/"abc"' });
    expect(huellaAnunciada('"no-es"')).toEqual({ clase: 'etag-que-no-es-sha256', etag: '"no-es"' });
    const enMayusculas = 'A'.repeat(64);
    // Se compara en minusculas: el hexadecimal es el mismo valor escrito de dos formas, y eso no
    // puede hacer que una huella correcta salga como «no cuadra».
    expect(huellaAnunciada(`"${enMayusculas}"`)).toEqual({
      clase: 'huella',
      huella: enMayusculas.toLowerCase(),
    });
    expect(huellaAnunciada(' "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" ')).toEqual({
      clase: 'huella',
      huella: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });
  });
});

/* ── AC 3 — sin origen seguro no se afirma nada ────────────────────────────────────────────── */

describe('sin origen seguro no se afirma NADA sobre la huella', () => {
  it('EL CENTINELA: aqui SI se puede calcular, y por eso lo de arriba mide algo', () => {
    expect(sePuedeCalcularLaHuella()).toBe(true);
  });

  it('sin la criptografia del navegador no se revienta, no se dice «ok» y no se dice «no cuadra»', async () => {
    servir(await losDosBien());
    // Exactamente lo que pasa por `http://` con un nombre que no es `localhost`: `crypto` esta y
    // `crypto.subtle` no. Sin la comprobacion, el `digest` de abajo seria
    // `TypeError: Cannot read properties of undefined (reading 'digest')`.
    vi.stubGlobal('crypto', { ...globalThis.crypto, subtle: undefined });
    expect(sePuedeCalcularLaHuella()).toBe(false);

    const lo = await pedir();
    const veredicto = laFicha(lo).veredicto;

    expect(veredicto.clase).toBe('sin-origen-seguro');
    // La huella que el servidor ANUNCIO si se ensena: llego. Lo que no se afirma es si cuadra.
    expect(veredicto).toHaveProperty('anunciada');
    // Y no es `ok` ni es `mal`: es `atencion`. Decir «ok» afirmaria algo que no se midio.
    expect(tonoDeLaComprobacion(laFicha(lo))).toBe('atencion');

    const reparto = repartir(lo);
    expect(String(reparto.nombrados?.get(DATO_DEL_IMPEDIMENTO))).toContain('origen seguro');
    expect(reparto.nombrados?.get(DATO_DEL_TONO)).toBe('atencion');
  });

  it('y `sha256DeLosBytes` lanza nombrando el origen, no un TypeError de la API', async () => {
    vi.stubGlobal('crypto', { ...globalThis.crypto, subtle: undefined });
    await expect(sha256DeLosBytes('lo que sea')).rejects.toThrow(/origen/);
  });
});

/* ── AC 4 — el Cache-Control del contrato ──────────────────────────────────────────────────── */

describe('el Cache-Control se compara con el del contrato', () => {
  it('EL CENTINELA: el contrato es el que el controlador manda, y no una cadena parecida', () => {
    expect(CACHE_CONTROL_DEL_CONTRATO).toBe('public, max-age=31536000, immutable');
  });

  it('igual al del contrato con la huella bien ⇒ ok', async () => {
    servir(await losDosBien());
    expect(tonoDeLaComprobacion(laFicha(await pedir()))).toBe('ok');
  });

  it('reescrito, con la huella bien ⇒ ATENCION, y se dice lo que llego', async () => {
    servir(await losDosBien({ [AMBITO_DE_LA_FICHA]: { cacheControl: 'no-store' } }));
    const lo = await pedir();

    // Los bytes no estan en duda —el sha256 cuadra—; lo que esta en duda es la promesa de un año.
    expect(laFicha(lo).veredicto.clase).toBe('verificada');
    expect(tonoDeLaComprobacion(laFicha(lo))).toBe('atencion');
    expect(repartir(lo).nombrados?.get(DATO_DEL_TONO)).toBe('atencion');

    // Y la barra de «Que viene y que no» dice lo que llego y lo que el contrato declara.
    const barra = repartir(lo).tablas?.get(CLAVE_DE_LAS_LISTAS)?.conteo ?? '';
    expect(barra).toContain('no-store');
    expect(barra).toContain(CACHE_CONTROL_DEL_CONTRATO);
  });

  it('ausente, con la huella bien ⇒ atencion tambien, y el campo dice que no vino', async () => {
    servir(await losDosBien({ [AMBITO_DE_LA_FICHA]: { cacheControl: null } }));
    const lo = await pedir();

    expect(tonoDeLaComprobacion(laFicha(lo))).toBe('atencion');
    expect(repartir(lo).ausenciaPorCampo?.get(coordenada(1, 1))).toBe(
      FRASES_DE_LA_PUBLICACION.sinCacheControl,
    );
  });
});

/* ── AC 5 — cabecera y cuerpo, separados ───────────────────────────────────────────────────── */

describe('la ficha separa lo que vino de una CABECERA de lo que vino del CUERPO', () => {
  it('los dos primeros campos salen de las cabeceras y los cuatro de abajo del cuerpo', async () => {
    // La prueba que lo demuestra de verdad: se sirve un cuerpo cuya identidad **no es** la que
    // devolvio `GET /conjuntos`. Si los cuatro campos de abajo salieran de la identidad, esto
    // pasaria en verde sin haber mirado el cuerpo ni una vez.
    const otroCuerpo = cuerpoDe(AMBITO_DE_LA_FICHA).replace('"version": 3', '"version": 9');
    expect(otroCuerpo).toContain('"version": 9');
    servir({
      ...(await losDosBien()),
      [AMBITO_DE_LA_FICHA]: { cuerpo: otroCuerpo, etag: `"${await sha256DeLosBytes(otroCuerpo)}"` },
    } as Record<Ambito, Servido>);

    const reparto = repartir(await pedir());
    const valor = (bloque: number, campo: number) => reparto.valores?.get(coordenada(bloque, campo));

    // De la CABECERA.
    expect(valor(1, 0)).toBe(`"${await sha256DeLosBytes(otroCuerpo)}"`);
    expect(valor(1, 1)).toBe(CACHE_CONTROL_DEL_CONTRATO);
    // Del CUERPO, y se nota: la version de abajo es la del cuerpo (9) y la de arriba la que
    // devolvio `GET /conjuntos` (3).
    expect(valor(1, 2)).toBe(String(VIGENTE.conjuntoId));
    expect(valor(1, 3)).toBe(`${String(VIGENTE.ejercicio)} · 9`);
    expect(valor(1, 4)).toBe(AMBITO_DE_LA_FICHA);
    expect(valor(0, 1)).toBe(`${String(VIGENTE.ejercicio)} · ${String(VIGENTE.version)}`);
  });

  it('y «Que viene y que no» explica cada lista POR AMBITO, no por lo que llego', async () => {
    servir(await losDosBien());
    const reparto = repartir(await pedir());
    const filas = reparto.tablas?.get(CLAVE_DE_LAS_LISTAS)?.filas ?? [];

    expect(filas.map((fila) => fila.clave)).toEqual([
      'parametros',
      'valoresUnitarios',
      'depreciaciones',
      'valoresReferenciales',
    ]);
    // `valoresReferenciales` llega vacio en VALUACION **porque ese ambito no los lleva**, y eso no
    // es lo mismo que un vacio por averia. El motivo lo dice el ambito, no el conteo.
    const referenciales = filas[3]?.celdas[2];
    expect(String(referenciales)).toContain(AMBITO_DE_LA_FICHA);
    expect(String(referenciales)).not.toContain('algo no compuso');
  });
});

/* ── AC 6 — un conjunto, dos descargas ─────────────────────────────────────────────────────── */

describe('un conjunto, dos descargas: misma identidad y huellas distintas', () => {
  it('se piden LOS DOS ambitos del MISMO conjunto, y el conjunto se resuelve UNA vez', async () => {
    const { pedidas } = servir(await losDosBien());
    const lo = await pedir();

    expect(pedidas.filter((ruta) => ruta.includes('/conjuntos?')), 'la identidad se pidio dos veces').toHaveLength(1);
    for (const ambito of AMBITOS) {
      expect(pedidas.some((ruta) => ruta.includes(`/conjuntos/2/snapshot?ambito=${ambito}`))).toBe(true);
      expect(lo.porAmbito.get(ambito)?.snapshot.ambito).toBe(ambito);
    }
  });

  it('con bytes distintos, el veredicto es el de ADR-0025: misma identidad y huellas distintas', async () => {
    servir(await losDosBien());
    const reparto = repartir(await pedir());

    expect(reparto.valores?.get(coordenada(2, 3))).toBe(FRASES_DE_LA_PUBLICACION.huellasDistintas);
    expect(reparto.valores?.get(coordenada(2, 1))).not.toBe(reparto.valores?.get(coordenada(2, 2)));
  });

  it('y si salen IGUALES lo dice, en vez de repetir la frase del ADR', async () => {
    // Pasa de verdad contra un doble que no mira la consulta —le paso a la V6 con su proxy—, y el
    // desenlace no se puede dibujar como si fuera el bueno.
    const mismo = cuerpoDe('VALUACION');
    const etag = `"${await sha256DeLosBytes(mismo)}"`;
    servir({ VALUACION: { cuerpo: mismo, etag }, OBLIGACION: { cuerpo: mismo, etag } });

    const reparto = repartir(await pedir());

    expect(reparto.valores?.get(coordenada(2, 3))).toBe(FRASES_DE_LA_PUBLICACION.mismaHuella);
  });

  it('y si la identidad NO coincide, tambien: no son dos mitades del mismo juego de valores', async () => {
    const otro = cuerpoDe('OBLIGACION').replace('"conjuntoId": 2', '"conjuntoId": 7');
    servir({
      ...(await losDosBien()),
      OBLIGACION: { cuerpo: otro, etag: `"${await sha256DeLosBytes(otro)}"` },
    });

    const reparto = repartir(await pedir());

    expect(reparto.valores?.get(coordenada(2, 3))).toBe(FRASES_DE_LA_PUBLICACION.identidadDistinta);
  });
});

/* ── AC 7 — guardar los bytes que se verificaron ───────────────────────────────────────────── */

describe('guardar entrega LOS BYTES VERIFICADOS, y nunca vuelve a pedir la ruta', () => {
  /** Lo que el navegador recibio: el nombre del archivo y su contenido. */
  let entregado: { nombre: string; contenido: Blob } | null = null;

  /**
   * El texto de un `Blob`, con `FileReader`.
   *
   * Y no con `blob.text()`: **jsdom no lo implementa** —«bajado.contenido.text is not a function»—,
   * y el rojo habla del arnes y no de la huella.
   */
  const leer = (blob: Blob): Promise<string> =>
    new Promise((cumplir, fallar) => {
      const lector = new FileReader();
      lector.onload = () => {
        cumplir(String(lector.result));
      };
      lector.onerror = () => {
        fallar(lector.error ?? new Error('no se pudo leer el Blob entregado'));
      };
      lector.readAsText(blob);
    });

  beforeEach(() => {
    entregado = null;
    let ultimo: Blob | null = null;
    // jsdom no implementa ninguna de las dos, y `entregarAlNavegador` usa las dos.
    URL.createObjectURL = (objeto: Blob | MediaSource) => {
      ultimo = objeto as Blob;
      return 'blob:lo-que-sea';
    };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function estaVez(this: HTMLAnchorElement) {
      entregado = { nombre: this.download, contenido: ultimo as Blob };
    };
  });

  it('el archivo bajado tiene el sha256 del ETag, y el nombre lleva la identidad entera', async () => {
    const servidos = await losDosBien();
    const { pedidas } = servir(servidos);
    const lo = await pedir();
    const cuantasAntes = pedidas.length;

    expect(guardarElSnapshot()).toBe(true);

    expect(entregado, 'no se entrego nada al navegador').not.toBeNull();
    const bajado = entregado as unknown as { nombre: string; contenido: Blob };
    // **El sha256 de lo bajado ES el ETag.** Es el criterio entero en una linea.
    expect(await sha256DeLosBytes(await leer(bajado.contenido))).toBe(
      servidos[AMBITO_DE_LA_FICHA].etag?.replaceAll('"', ''),
    );
    expect(bajado.contenido.type).toBe('application/json');
    expect(bajado.nombre).toBe(
      `normativa-conjunto-${String(VIGENTE.conjuntoId)}-${String(VIGENTE.ejercicio)}-v${String(
        VIGENTE.version,
      )}-${AMBITO_DE_LA_FICHA}.json`,
    );
    expect(bajado.nombre).toBe(nombreDelArchivo(laFicha(lo).snapshot));

    // Y NO se emitio una segunda peticion al snapshot: lo que se guarda es lo que ya se comprobo,
    // no lo que el servidor —o la cache del navegador, bajo `immutable`— volviera a dar.
    expect(pedidas.length, 'guardar volvio a pedir la ruta').toBe(cuantasAntes);
  });

  it('sin descarga verificada no entrega NADA, y el motivo es visible', async () => {
    servir({
      ...(await losDosBien()),
      [AMBITO_DE_LA_FICHA]: { cuerpo: cuerpoDe(AMBITO_DE_LA_FICHA), etag: null },
    } as Record<Ambito, Servido>);
    const lo = await pedir();

    expect(guardarElSnapshot()).toBe(false);
    expect(entregado, 'se entrego un archivo sin huella comprobada').toBeNull();

    // Visible: el boton sale impedido y su motivo lo dice, con el veredicto dentro.
    const motivo = String(repartir(lo).nombrados?.get(DATO_DEL_IMPEDIMENTO));
    expect(motivo).toContain(AMBITO_DE_LA_FICHA);
    expect(motivo).toContain(FRASES_DE_LA_PUBLICACION.sinEtag);
  });

  it('y antes de pedir nada tampoco, con su propio motivo', () => {
    expect(guardarElSnapshot()).toBe(false);
    expect(entregado).toBeNull();

    const reparto = PUBLICACION.repartir(new Map());
    expect(reparto.nombrados?.get(DATO_DEL_IMPEDIMENTO)).toBe(
      FRASES_DE_LA_PUBLICACION.todaviaNoLlego,
    );
  });

  it('y con todo bien el boton NO sale impedido: `null` es «se puede»', async () => {
    servir(await losDosBien());
    const reparto = repartir(await pedir());

    expect(reparto.nombrados?.get(DATO_DEL_IMPEDIMENTO)).toBeNull();
  });
});
