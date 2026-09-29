// Corre en jsdom —el entorno por omision— y NO en `node`, por lo mismo que
// `los-cuadros-son-los-del-snapshot.test.ts`: importa los conectores, que arrastran
// `src/api/cliente.ts` -> `src/sesion.ts`, y ahi hay un `window.location.origin` de nivel de modulo.

import { ErrorDeLaApi } from '@kamayuk/api';
import { peldanoDe } from '@kamayuk/sesion';
import { coordenada } from '@kamayuk/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CUADROS, CUADROS_DE_VALUACION } from '../src/datos/cuadros.ts';
import type { Conector } from '../src/datos/conectores.ts';
import { EJERCICIO_DE_TRABAJO } from '../src/datos/ejercicio.ts';
import {
  CLAVE_DE_LA_PUBLICACION,
  CLAVE_DE_LOS_CONSUMIDORES,
  CLAVE_DE_LOS_CUADROS,
  DATO_DEL_IMPEDIMENTO,
} from '../src/datos/lecturas.ts';
import { PUBLICACION, guardarElSnapshot, olvidarLoDescargado } from '../src/datos/publicacion.ts';
import {
  AUSENCIA_SIN_PUBLICAR,
  FRASES_DEL_EJERCICIO_SIN_PUBLICAR,
  faltaPublicar,
  type EjercicioSinPublicar,
} from '../src/datos/sinPublicar.ts';

/**
 * Lo que `guardarElSnapshot` avisa, recogido en vez de pintado: el aviso es de `@kamayuk/ui` y aqui
 * no hay ningun `Toaster` montado que lo dibuje. Lo demas del paquete, tal cual.
 */
const avisos = vi.hoisted(() => [] as { titulo: string; descripcion: string | undefined }[]);
vi.mock('@kamayuk/ui', async (original) => ({
  ...(await original<typeof import('@kamayuk/ui')>()),
  avisar: (titulo: string, opciones?: { description?: string }) => {
    avisos.push({ titulo, descripcion: opciones?.description });
  },
}));

/**
 * **«Ese ejercicio no esta publicado» es una respuesta, y un 404 de ruta es un fallo** (#97; AC 6
 * de #66 y AC 8 de #67).
 *
 * <h2>Se inyectan LOS DOS 404, y con el MISMO mensaje</h2>
 *
 * Los dos llegan como **404 `NO_ENCONTRADO`**. Lo unico que los separa es el miembro
 * `parametroQueFalta`, que pone `FaltaPublicar.noEncontrado` y un 404 de ruta no lleva. Asi que aqui
 * se sirven **con el mismo `codigo` y el mismo `mensaje`** —el que el backend escribe para el
 * primero—, y lo que cambia es solo el miembro. Una implementacion que leyera el `mensaje` en
 * castellano —lo que el catalogo de errores prohibe— trataria los dos igual, y sale roja aqui.
 *
 * <h2>Se ejerce el CONECTOR, con `fetch` doblado</h2>
 *
 * Lo que se dobla es `fetch` y no el cliente, como en `la-huella-del-snapshot.test.ts`: la peticion
 * pasa por `@kamayuk/api` de verdad, y el `ErrorDeLaApi` que llega es el que la libreria construye
 * con el cuerpo que se sirvio. Que lo dibujado sea esto lo mide `e2e/el-ejercicio-sin-publicar.spec.ts`.
 */

/** El `mensaje` de los DOS 404, a proposito el mismo. Es el que escribe `EjercicioSinSellar`. */
const EL_MISMO_MENSAJE = `El ejercicio ${String(EJERCICIO_DE_TRABAJO)} no tiene un conjunto de parametros sellado`;

/**
 * El ejercicio que dice el miembro, **distinto del que pregunto el reloj**.
 *
 * El backend devuelve el que se le pregunto, asi que en produccion coinciden. Aqui no, y es para
 * poder afirmar de donde sale el ano que la hoja escribe: del miembro, y no de la constante de
 * `src/datos/ejercicio.ts`. Con los dos iguales, las dos implementaciones pasarian.
 */
const EJERCICIO_DEL_MIEMBRO = EJERCICIO_DE_TRABAJO + 5;

/** Un `problem+json` como el de `ManejadorDeErrores`, con o sin el miembro. */
function unCuatrocientosCuatro(conElMiembro: boolean): Response {
  return new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      codigo: 'NO_ENCONTRADO',
      mensaje: EL_MISMO_MENSAJE,
      ...(conElMiembro ? { parametroQueFalta: { ejercicio: EJERCICIO_DEL_MIEMBRO } } : {}),
    }),
    { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** Sirve el 404 a `GET /conjuntos` y apunta todo lo que se pidio. */
function servirElCuatrocientosCuatro(conElMiembro: boolean): { readonly pedidas: string[] } {
  const pedidas: string[] = [];
  vi.stubGlobal('fetch', ((entrada: RequestInfo | URL) => {
    pedidas.push(String(entrada));
    return Promise.resolve(unCuatrocientosCuatro(conElMiembro));
  }) as typeof fetch);
  return { pedidas };
}

/** Las dos hojas que preguntan que conjunto rige, con la clave de su unica lectura. */
const LAS_DOS: readonly { readonly hoja: string; readonly conector: Conector; readonly clave: string }[] = [
  { hoja: 'Cuadros', conector: CUADROS, clave: CLAVE_DE_LOS_CUADROS },
  { hoja: 'Publicacion', conector: PUBLICACION, clave: CLAVE_DE_LA_PUBLICACION },
];

/** Pide la hoja entera, como lo hace `useDatosDeLaHoja`. */
function pedir(conector: Conector): Promise<unknown> {
  const lectura = conector.lecturas[0];
  if (lectura === undefined) throw new Error('la hoja dejo de declarar su lectura');
  return lectura.pedir(new AbortController().signal, { sujeto: null, parametros: {} });
}

/** Lo que `pedir` lanzo, o un rojo que dice que no lanzo. */
async function loQueLanzo(promesa: Promise<unknown>): Promise<unknown> {
  try {
    const llego = await promesa;
    throw new Error(`se esperaba un fallo y la lectura contesto: ${JSON.stringify(llego)}`);
  } catch (fallo) {
    return fallo;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  olvidarLoDescargado();
  avisos.length = 0;
});

describe('`faltaPublicar` lee el MIEMBRO, y solo en un 404', () => {
  const con = (estado: number, cuerpo: Record<string, unknown>) =>
    new ErrorDeLaApi(estado, 'GET /conjuntos?ejercicio=0', cuerpo);

  it('404 con `parametroQueFalta` ⇒ lo que falta, tal como llego', () => {
    expect(
      faltaPublicar(con(404, { codigo: 'NO_ENCONTRADO', parametroQueFalta: { ejercicio: 7 } })),
    ).toEqual({ ejercicio: 7 });
  });

  it('404 SIN el miembro ⇒ `null`, aunque el `mensaje` diga exactamente lo mismo', () => {
    // Es la mitad del criterio que no se ve mirando la otra: el mensaje en castellano NO cuenta.
    expect(
      faltaPublicar(con(404, { codigo: 'NO_ENCONTRADO', mensaje: EL_MISMO_MENSAJE })),
      'un 404 SIN el miembro se leyo como «no esta publicado»: o decide el `mensaje` —que el\n' +
        '  catalogo prohibe— o basta el estado, y lo unico que lo separa del 404 de ruta es el miembro',
    ).toBeNull();
  });

  it('422 con el miembro ⇒ `null`: es un CALCULO que no se pudo hacer, no un documento que no esta', () => {
    expect(
      faltaPublicar(con(422, { codigo: 'VALIDACION', parametroQueFalta: { ejercicio: 7, llave: 'UIT' } })),
    ).toBeNull();
  });

  it('y lo que no es un `ErrorDeLaApi` —la red caida— tampoco', () => {
    expect(faltaPublicar(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe.each(LAS_DOS)('$hoja: los dos 404 de `GET /conjuntos` no se leen igual', ({ conector, clave }) => {
  it('EL CENTINELA: los dos cuerpos servidos solo se distinguen por el miembro', async () => {
    const con = (await unCuatrocientosCuatro(true).json()) as Record<string, unknown>;
    const sin = (await unCuatrocientosCuatro(false).json()) as Record<string, unknown>;
    // Si se distinguieran por otra cosa, una implementacion que leyera esa otra cosa pasaria.
    const { parametroQueFalta, ...resto } = con;
    expect(parametroQueFalta).toEqual({ ejercicio: EJERCICIO_DEL_MIEMBRO });
    expect(resto).toEqual(sin);
  });

  it('CON el miembro la lectura CONTESTA: no lanza, y no pide ningun snapshot', async () => {
    const { pedidas } = servirElCuatrocientosCuatro(true);

    const llego = await pedir(conector);

    expect(llego, 'la hoja no contesto «sin publicar»').toEqual({
      sinPublicar: { ejercicio: EJERCICIO_DEL_MIEMBRO },
    } satisfies EjercicioSinPublicar);
    // Sin `conjuntoId` no hay snapshot que pedir: solo sale `GET /conjuntos`.
    expect(pedidas).toHaveLength(1);
    expect(pedidas[0]).toContain('/conjuntos?ejercicio=');
  });

  it('y se reparte como RESPUESTA: la frase de arriba en `atencion`, con el ano que dijo el miembro', async () => {
    servirElCuatrocientosCuatro(true);
    const reparto = conector.repartir(new Map([[clave, await pedir(conector)]]));

    expect(reparto.ausencia).toBe(AUSENCIA_SIN_PUBLICAR);
    expect(reparto.ausencia.tono).toBe('atencion');

    // El ano que se escribe es el del MIEMBRO, no el del reloj de este puesto.
    const escritos = [...(reparto.valores ?? new Map<string, string>()).values()];
    const conElAno = escritos.filter((valor) => valor.includes(String(EJERCICIO_DEL_MIEMBRO)));
    expect(conElAno.length, 'ningun campo nombra el ejercicio que dijo el miembro').toBeGreaterThan(0);
    expect(escritos.some((valor) => valor.includes(String(EJERCICIO_DE_TRABAJO)))).toBe(false);

    // Y ni una tabla que dependa de la lectura: no llego ningun snapshot que dibujar.
    const deLaLectura = [...(reparto.tablas?.keys() ?? [])].filter(
      (tabla) => tabla !== CLAVE_DE_LOS_CONSUMIDORES,
    );
    expect(deLaLectura).toEqual([]);
  });

  it('SIN el miembro —el 404 de ruta— es un FALLO, y la escalera lo dice `no-encontrado`', async () => {
    const { pedidas } = servirElCuatrocientosCuatro(false);

    const fallo = await loQueLanzo(pedir(conector));

    expect(fallo).toBeInstanceOf(ErrorDeLaApi);
    expect(faltaPublicar(fallo)).toBeNull();
    // Lo clasifica la escalera de siempre, sin una rama nueva en este sistema.
    expect(peldanoDe(fallo).clave).toBe('no-encontrado');
    expect(pedidas).toHaveLength(1);
  });
});

describe('lo que cada hoja hace con la respuesta', () => {
  it('Cuadros: el documento fuente de los TRES cuadros nombra el ejercicio del miembro', async () => {
    servirElCuatrocientosCuatro(true);
    const reparto = CUADROS.repartir(new Map([[CLAVE_DE_LOS_CUADROS, await pedir(CUADROS)]]));

    for (const cuadro of CUADROS_DE_VALUACION) {
      expect(reparto.valores?.get(coordenada(cuadro.bloque, 0))).toBe(
        FRASES_DEL_EJERCICIO_SIN_PUBLICAR.elEjercicio.replace(
          '{{ejercicio}}',
          String(EJERCICIO_DEL_MIEMBRO),
        ),
      );
    }
  });

  it('Publicacion: guardar sale impedido con ESE motivo, y el aviso dice lo mismo', async () => {
    servirElCuatrocientosCuatro(true);
    const reparto = PUBLICACION.repartir(
      new Map([[CLAVE_DE_LA_PUBLICACION, await pedir(PUBLICACION)]]),
    );
    const motivo = String(reparto.nombrados?.get(DATO_DEL_IMPEDIMENTO));
    expect(motivo).toContain(String(EJERCICIO_DEL_MIEMBRO));

    // El pie llama a guardar aunque el boton del bloque salga impedido. No entrega nada, y el
    // motivo NO es «todavia no ha llegado» —mandaria a esperar algo que no va a llegar—.
    expect(guardarElSnapshot()).toBe(false);
    expect(avisos.at(-1)?.descripcion).toBe(motivo);
  });
});
