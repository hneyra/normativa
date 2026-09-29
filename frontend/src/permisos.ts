import type { Catalogo, ModuloDelCatalogo } from '@kamayuk/shell';

import type { AccesoDelSistema, ModuloDelSistema, PermisosDeLaSesion } from './datos/lecturas.ts';

/**
 * **Lo que la cuenta no puede abrir, no se ofrece** (#64).
 *
 * Calcado de `rentas/frontend/src/permisos.ts@ac379ac` (`rentas`#105, y por modulo desde
 * `rentas`#120), con lo que este sistema mide distinto. Las diferencias estan dichas donde caen, y
 * son cuatro: {@link DE_OTRO_SISTEMA} vacio, `SEGURIDAD` en `sinCatalogo`, el centinela
 * {@link SESION_PROPIA} y las respuestas rotas.
 *
 * <h2>Que se cruza, y por que son tres operaciones y no una</h2>
 *
 *   · `GET /seguridad/modulos` dice **que modulos existen**, en que orden, con que rotulo y si
 *     estan activos.
 *   · `GET /seguridad/accesos` dice **que se puede abrir dentro de cada modulo**, con su `moduloId`.
 *   · `GET /seguridad/sesion/permisos` dice **que puede esta cuenta**, como una matriz
 *     `codigo → privilegios[]`.
 *
 * Ninguna de las tres basta sola: la primera no sabe de cuentas, la segunda no sabe de permisos, y
 * la tercera es una bolsa de codigos planos que no dice a que modulo pertenece cada uno.
 *
 * <h2>Por modulo, y no por hoja (`rentas`#120)</h2>
 *
 * `NORMATIVA` se ofrece entero si ALGUNO de sus accesos tiene `lectura` en la matriz. Aqui no se
 * escribe un mapa hoja → acceso: ADR-0043 §2 cuelga **las cuatro hojas** de una sola opcion,
 * `conjuntos`, y filtrar hoja a hoja sigue abierto en `rentas`#120 — no se decide en esta interfaz.
 *
 * <h2>El rotulo es el del BACKEND, no el del artboard</h2>
 *
 * El dia que la municipalidad renombre un modulo, el arbol dira el nombre nuevo **sin que nadie
 * toque este repositorio**, que es la mitad util de haber conectado el arbol. Y por eso ese rotulo
 * **no pasa por `t()`**: es un dato del backend, como el nombre de una persona.
 *
 * **Lo que NO se pisa es la nota ni las hojas**, y ahi hay una trampa que `rentas` no tiene: aqui
 * el catalogo lleva CAPTADORES que traducen al leerse (`src/catalogo.ts`, desde #60). Un
 * `{ ...modulo, rotulo }` los evaluaria al componer y congelaria `nota` en el idioma del arranque.
 * Ver {@link conElRotuloDelBackend}.
 */

/**
 * **Los modulos que el backend publica y este sistema NO sirve: NINGUNO, y esta medido.**
 *
 * En `rentas` son `CATASTRO` y `TESORERIA`, porque su catalogo de seguridad es el del cluster y
 * publica los doce modulos del manual. **Aqui no hay ninguno que restar**, y no por olvido: la
 * copia local de `modulo_sistema` y `acceso` la siembra `SembradorDelCatalogo` **desde
 * `CatalogoDelSistema`** (`backend/kamayuk-normativa-seguridad/…/aplicacion/SembradorDelCatalogo.java`),
 * que es la lista de las opciones que declaran los endpoints de ESTE backend. Por construccion,
 * `GET /seguridad/modulos` no publica un modulo de otro sistema.
 *
 * Que siga vacio no se afirma aqui: lo MIDE `permisos.test.ts`, que exige que cada llave de este
 * mapa sea un modulo que la captura de `docs/50-api/seguridad/modulos.json` trae y que el arbol no
 * sirve. Copiar el de `rentas` sale rojo nombrando los dos.
 */
export const DE_OTRO_SISTEMA: ReadonlyMap<string, string> = new Map<string, string>();

/** `Privilegio.LECTURA`, en la minuscula en que lo publica la matriz. Lo minimo para ABRIR. */
export const PRIVILEGIO_LECTURA = 'lectura';

/**
 * **El centinela `RequiereAcceso.SESION_PROPIA`**, tal como lo escribe el backend.
 *
 * Anota las rutas que **cualquier sesion** puede leer —las cinco de `/seguridad` y el estado del
 * ejercicio del Panel— porque no hay privilegio que configurar (ADR-0043 §3). No es una opcion del
 * catalogo: `CatalogoDelSistema` no lo declara, la matriz no lo trae y ningun acceso se llama asi.
 *
 * **Y no se busca en la matriz, que es lo que se exige**: leerlo ahi seria tratar «cualquier sesion»
 * como un permiso que se tiene o no, y el dia que alguien lo sembrara como opcion —un escaner de
 * anotaciones que no lo excluya lo encontraria en cinco controladores— abriria el modulo al que lo
 * colgaran **a toda cuenta que tenga sesion**. Que el valor es el del Java lo compara
 * `permisos.test.ts` contra `RequiereAcceso.java`.
 */
export const SESION_PROPIA = '__sesion_propia__';

/** Lo que se sabe del catalogo despues de componerlo. */
export interface CatalogoCompuesto {
  /** Lo que se ofrece, en el orden en que el backend publica sus modulos. */
  readonly catalogo: Catalogo;
  /** Lo que el backend publica y este sistema no tiene en su arbol. Hoy, `SEGURIDAD`. */
  readonly sinCatalogo: readonly string[];
  /** Lo que se ofreceria si la cuenta pudiera, y no puede. */
  readonly sinPermiso: readonly string[];
  /** Los de otro sistema, restados con su motivo. Hoy, ninguno: ver {@link DE_OTRO_SISTEMA}. */
  readonly deOtroSistema: readonly string[];
  /**
   * Las operaciones cuya respuesta no tiene la forma publicada. **Con una sola, no se ofrece NADA**:
   * ofrecer lo que se pudo leer de una respuesta rota seria adivinar que decia el resto.
   */
  readonly rotas: readonly string[];
}

/** Nada que ofrecer. La forma de «no se sabe», que no es la de «no se puede». */
export const NADA: CatalogoCompuesto = {
  catalogo: [],
  sinCatalogo: [],
  sinPermiso: [],
  deOtroSistema: [],
  rotas: [],
};

/** Si un valor es un objeto con esos campos de esos tipos. Lo que viene de la red se mira. */
function tieneLaForma(
  fila: unknown,
  campos: Readonly<Record<string, 'number' | 'string' | 'boolean'>>,
): boolean {
  if (typeof fila !== 'object' || fila === null) return false;
  const suya = fila as Readonly<Record<string, unknown>>;
  return Object.entries(campos).every(([campo, tipo]) => typeof suya[campo] === tipo);
}

/**
 * Si una lista que vino de la red es la lista que el contrato promete.
 *
 * **Toda la lista o nada**: una fila rota no se salta, se declara rota la respuesta entera. Saltarla
 * es exactamente ofrecer lo que se pudo leer y callar lo que no — y un modulo que falta del menu no
 * da ningun error, solo no esta.
 */
function esListaDe(
  valor: unknown,
  campos: Readonly<Record<string, 'number' | 'string' | 'boolean'>>,
): boolean {
  return Array.isArray(valor) && valor.every((fila) => tieneLaForma(fila, campos));
}

/** La matriz es un objeto plano, no una lista ni un nulo. */
function esMatriz(valor: unknown): boolean {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Los codigos de acceso que la cuenta puede LEER.
 *
 * `Array.isArray` y no un `as`: esto viene de la red, y lo que el contrato promete es «objeto». Un
 * valor que no sea lista descarta ESE acceso, no el arbol entero.
 *
 * Y **el centinela se descarta antes de mirar su valor**: no se lee `permisos[SESION_PROPIA]` ni
 * para preguntar. Ver {@link SESION_PROPIA}.
 */
function loQuePuedeLeer(permisos: PermisosDeLaSesion): ReadonlySet<string> {
  return new Set(
    Object.keys(permisos)
      .filter((codigo) => codigo !== SESION_PROPIA)
      .filter((codigo) => {
        const privilegios: unknown = permisos[codigo];
        return Array.isArray(privilegios) && privilegios.includes(PRIVILEGIO_LECTURA);
      }),
  );
}

/**
 * El modulo de este arbol con el rotulo que publica el backend, **sin evaluar sus captadores**.
 *
 * Se copian los DESCRIPTORES y no los valores: `nota` sigue siendo el captador que traduce al
 * leerse, y `destinos` la misma lista con los suyos. Solo `rotulo` pasa a ser un valor, que es lo
 * que se quiere: el del backend no se traduce.
 */
function conElRotuloDelBackend(nuestro: ModuloDelCatalogo, rotulo: string): ModuloDelCatalogo {
  return Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(nuestro),
      rotulo: { value: rotulo, enumerable: true },
    },
  ) as ModuloDelCatalogo;
}

/** Los campos que el contrato publica para una fila de cada listado, con su tipo en JavaScript. */
const FORMA_DEL_MODULO = { id: 'number', codigo: 'string', nombre: 'string', orden: 'number', activo: 'boolean' } as const;
const FORMA_DEL_ACCESO = { id: 'number', moduloId: 'number', codigo: 'string' } as const;

/**
 * El catalogo de este sistema, filtrado por lo que la cuenta puede abrir.
 *
 * El orden es el del BACKEND y no el del arbol: es quien decide en que orden se ensenan los
 * modulos. Y ante una respuesta que no tiene la forma publicada **no se ofrece nada**, con la
 * operacion nombrada en `rotas`.
 */
export function componer(
  nuestro: Catalogo,
  modulos: readonly ModuloDelSistema[],
  accesos: readonly AccesoDelSistema[],
  permisos: PermisosDeLaSesion,
  codigoDe: (modulo: ModuloDelCatalogo) => string,
): CatalogoCompuesto {
  const rotas = [
    ...(esListaDe(modulos, FORMA_DEL_MODULO) ? [] : ['GET /seguridad/modulos']),
    ...(esListaDe(accesos, FORMA_DEL_ACCESO) ? [] : ['GET /seguridad/accesos']),
    ...(esMatriz(permisos) ? [] : ['GET /seguridad/sesion/permisos']),
  ];
  if (rotas.length > 0) return { ...NADA, rotas };

  const legibles = loQuePuedeLeer(permisos);
  const porCodigo = new Map(nuestro.map((m) => [codigoDe(m), m]));

  const catalogo: ModuloDelCatalogo[] = [];
  const sinCatalogo: string[] = [];
  const sinPermiso: string[] = [];
  const deOtroSistema: string[] = [];

  for (const modulo of [...modulos].sort((a, b) => a.orden - b.orden)) {
    if (DE_OTRO_SISTEMA.has(modulo.codigo)) {
      deOtroSistema.push(modulo.codigo);
      continue;
    }
    if (!modulo.activo) continue;

    // Lo que el backend publica y este arbol no tiene —hoy `SEGURIDAD`, por `parametros`— **se
    // cuenta aqui y no como de otro sistema**: es de este backend, y lo que le falta es una hoja
    // en esta interfaz. Ninguna hoja se dibuja por `parametros` (ADR-0043 §2).
    const nuestroModulo = porCodigo.get(modulo.codigo);
    if (nuestroModulo === undefined) {
      sinCatalogo.push(modulo.codigo);
      continue;
    }

    const puedeAbrirAlgo = accesos.some(
      (acceso) => acceso.moduloId === modulo.id && legibles.has(acceso.codigo),
    );
    if (!puedeAbrirAlgo) {
      sinPermiso.push(modulo.codigo);
      continue;
    }

    catalogo.push(conElRotuloDelBackend(nuestroModulo, modulo.nombre));
  }

  return { catalogo, sinCatalogo, sinPermiso, deOtroSistema, rotas };
}
