import { peldanoDe } from '@kamayuk/sesion';
import type { ModuloDelCatalogo } from '@kamayuk/shell';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { cliente } from '../api/cliente.ts';
import { CATALOGO, CODIGO_POR_CLAVE } from '../catalogo.ts';
import { NADA, componer, type CatalogoCompuesto } from '../permisos.ts';
import type { LecturaDeLaSesion } from '../sesion.ts';
import {
  ACCESOS_DEL_SISTEMA,
  MODULOS_DEL_SISTEMA,
  MUNICIPALIDAD_DE_LA_SESION,
  PERMISOS_DE_LA_SESION,
  QUIEN_ES_LA_SESION,
  rutaDe,
  type AccesoDelSistema,
  type ModuloDelSistema,
  type MunicipalidadResource,
  type Paginado,
  type PeticionDeclarada,
  type PermisosDeLaSesion,
  type SesionResource,
} from './lecturas.ts';

/**
 * **El catalogo que el armazon recibe, filtrado por lo que la cuenta puede abrir** (#64).
 *
 * Calcado de `rentas/frontend/src/datos/useCatalogoPermitido.ts@ac379ac`, con tres cambios que se
 * dicen:
 *
 *   · **el cliente es el de `@kamayuk/api`** (`src/api/cliente.ts`) y las rutas son las que
 *     DECLARA `src/datos/lecturas.ts`, que la guarda `camino-a-la-api` cruza contra el contrato;
 *   · **los fallos los traduce `peldanoDe()`** de `@kamayuk/sesion`, no un `instanceof ErrorDeLaApi`
 *     con el 401 escrito a mano: es la misma escalera que dibuja el fallo de cada hoja, sin una
 *     traduccion paralela;
 *   · **las dos lecturas de la barra viven aqui tambien** ({@link useLaSesion}): en `rentas` la
 *     barra era un literal, y aqui se pide (G2, #52).
 *
 * <h2>Y este archivo es una COSTURA de `src/aplicacion.tsx`, la novena, y por que</h2>
 *
 * El plan de la epica ponia estos ganchos detras de `src/catalogo.ts` o de `src/sesion.ts`, que son
 * las dos costuras de #64. **Las dos se midieron, y las dos se rompen**, porque este archivo usa el
 * cliente de la API y el cliente lee `identidad` de `src/sesion.ts` AL CARGARSE:
 *
 *   · **por `src/sesion.ts`** es un ciclo de carga: el primer modulo que entre por `sesion.ts` carga
 *     el cliente con `identidad` sin inicializar. Medido reexportando `useLaSesion` desde alli —
 *     `src/arranque.test.ts`, que la importa la primera, sale como «Failed Suites» con sus 22
 *     pruebas sin correr:
 *
 *         TypeError: Cannot read properties of undefined (reading 'token')
 *          ❯ src/api/cliente.ts:39:20
 *          ❯ src/datos/useCatalogoPermitido.ts:7:1
 *
 *   · **por `src/catalogo.ts`** se lleva por delante a las guardas que corren sin DOM y leen el
 *     catalogo —`la-ruta-de-la-hoja-llega-al-conector` y `pantallas-del-artboard`—, porque el
 *     cliente arrastra `sesion.ts` y `sesion.ts` lee `window` al cargarse. Medido reexportando desde
 *     alli: las dos salen como «Failed Suites» con
 *
 *         ReferenceError: window is not defined
 *          ❯ src/sesion.ts:115:12
 *          ❯ src/api/cliente.ts:3:1
 *
 * La tercera salida —pedir el cliente con un `import()` dentro de la consulta— rompe el ciclo y
 * deja a Vite avisando en cada `yarn build` que «`src/api/cliente.ts` is dynamically imported by
 * `useCatalogoPermitido.ts` but also statically imported by … dynamic import will not move module
 * into another chunk» (medido). Un aviso permanente en la construccion es el que se acaba ignorando.
 *
 * Asi que se declara **una costura mas, con su dueño**, que es la salida que
 * `verificaciones/la-costura-es-la-que-es.test.ts` tiene escrita para esto. Lo que `sesion.ts` y
 * `catalogo.ts` ponen sigue ahi: **como se dicen** la cuenta y la entidad, y **que se ve** mientras
 * no hay catalogo. Esto solo PIDE.
 *
 * <h2>Los cuatro estados, y por que «sin permiso» NO es un error</h2>
 *
 * · **Pidiendo** — no se ofrece nada todavia. Ofrecer el catalogo entero «mientras llega» seria
 *   ensenar durante un segundo justo lo que este issue existe para esconder, y un segundo basta
 *   para pulsar.
 * · **Error** — no se sabe que puede la cuenta, asi que **no se ofrece nada** y se dice. Ofrecerlo
 *   todo ante un fallo convierte un problema de red en un agujero de autorizacion. Y es error
 *   tambien una respuesta que llega sin la forma publicada (`CatalogoCompuesto.rotas`).
 * · **Sin permiso para nada** — se pidio, contesto, y esta cuenta no puede abrir ni un modulo. **No
 *   es un error**: es una cuenta recien creada o mal afiliada, y quien la mire tiene que poder
 *   distinguirlo de un backend caido. Una pantalla en blanco no distingue las dos.
 * · **Compuesto** — lo que se puede abrir, con el rotulo del backend.
 *
 * <h2>Las tres consultas van juntas y no una tras otra</h2>
 *
 * No se necesitan entre si: ninguna usa el resultado de otra. Encadenarlas triplicaria la espera
 * del arranque para no ganar nada. Y las dos de la barra —{@link useLaSesion}— salen a la vez.
 */

/** La rama de la cache donde viven las cinco de `/seguridad`. Una sola palabra, escrita una vez. */
const RAMA = 'seguridad';

/**
 * Las llaves con que las cinco viven en la cache de consultas.
 *
 * **Se exportan**, y eso dice algo de ellas: la siembra de desarrollo (`desarrollo/
 * sembrarElCatalogo.ts`) tiene que poner el dato **en estas mismas llaves** para que estas
 * consultas lo encuentren ya contestado. Con los literales repetidos alli, renombrar una llave aqui
 * dejaria la siembra apuntando a una llave que nadie lee — y el sintoma no seria un error sino el
 * menu vacio, o sea lo mismo que se ve cuando no hay backend.
 *
 * Ninguna empieza como las de las hojas —esas llevan delante la clave de la hoja, `nor-panel`—,
 * asi que lo que la siembra fije para esta rama no toca ninguna lectura de hoja.
 */
export const LLAVES = {
  rama: [RAMA],
  modulos: [RAMA, 'modulos'],
  accesos: [RAMA, 'accesos'],
  permisos: [RAMA, 'permisos'],
  sesion: [RAMA, 'sesion'],
  municipalidad: [RAMA, 'municipalidad'],
} as const;

/** Lo que este gancho dice con sus palabras. Pasa por `t()` donde se usa; aqui es la clave. */
export const FRASES_DEL_CATALOGO = {
  pidiendo: 'Averiguando qué puede abrir esta cuenta.',
  error:
    'No se pudo saber qué módulos puede abrir esta cuenta, así que no se ofrece ninguno. Ofrecerlos todos ante un fallo convertiría un problema de red en un agujero de autorización.',
  rota: 'La respuesta de «{{operaciones}}» no tiene la forma que publica el contrato, así que no se ofrece ningún módulo: ofrecer lo que se pudo leer de ella sería adivinar el resto.',
  sinPermiso:
    'Esta cuenta no puede abrir ningún módulo de este sistema. No es un fallo: es una cuenta sin permisos, o afiliada a un grupo que no los tiene.',
  loQueFalta: 'Hace falta el privilegio de lectura sobre alguna opción de: {{modulos}}.',
} as const;

/** Las claves de traduccion de este gancho, para el inventario del locale. */
export function clavesDelCatalogo(): readonly string[] {
  return Object.values(FRASES_DEL_CATALOGO);
}

/** Que se sabe del catalogo, ademas del catalogo. */
export interface CatalogoDeLaSesion extends CatalogoCompuesto {
  readonly estado: 'pidiendo' | 'error' | 'sin-permiso' | 'compuesto';
  /** Que decir cuando no hay arbol. Vacio cuando si lo hay. */
  readonly porQue: string;
  /**
   * Lo que se dice DEBAJO, linea a linea: el peldano de la escalera ante un fallo —su titulo, su
   * detalle y su remedio— o lo que le falta a la cuenta cuando no puede nada. Vacio en lo demas.
   */
  readonly detalle: readonly string[];
}

/** Pide una peticion declarada con el cliente de `@kamayuk/api`. */
function pedir<T>(peticion: PeticionDeclarada, senal: AbortSignal): Promise<T> {
  return cliente.solicitar<T>(rutaDe(peticion), { senal });
}

/**
 * El `contenido` de una pagina que vino de la red, **sin fiarse de que sea una pagina**.
 *
 * Si no lo es —un `[]` pelado, un `{}`, un `null`—, devuelve lo que haya y `componer` lo declara
 * roto: aqui no se decide nada, solo no se revienta leyendo `.contenido` de un nulo.
 */
function contenidoDe<T>(pagina: Paginado<T>): readonly T[] {
  const llegada: unknown = pagina;
  const contenido =
    typeof llegada === 'object' && llegada !== null
      ? (llegada as { readonly contenido?: unknown }).contenido
      : undefined;
  return contenido as readonly T[];
}

/** Una pagina sin nada, para no leer `.contenido` de un `undefined` que el tipo ya descarta. */
const NADA_PAGINADO: Paginado<ModuloDelSistema> = {
  contenido: [],
  pagina: 0,
  tamano: 0,
  totalElementos: 0,
  totalPaginas: 0,
  hayMas: false,
};

/** El codigo de modulo del backend de una entrada del catalogo —`NORMATIVA`—. */
const codigoDe = (modulo: ModuloDelCatalogo): string => CODIGO_POR_CLAVE.get(modulo.clave) ?? '';

/** El catalogo de este sistema, filtrado por lo que la cuenta de la sesion puede abrir. */
export function useCatalogoPermitido(): CatalogoDeLaSesion {
  const { t } = useTranslation();

  const modulos = useQuery({
    queryKey: LLAVES.modulos,
    queryFn: ({ signal }) => pedir<Paginado<ModuloDelSistema>>(MODULOS_DEL_SISTEMA, signal),
    retry: false,
  });
  const accesos = useQuery({
    queryKey: LLAVES.accesos,
    queryFn: ({ signal }) => pedir<Paginado<AccesoDelSistema>>(ACCESOS_DEL_SISTEMA, signal),
    retry: false,
  });
  const permisos = useQuery({
    queryKey: LLAVES.permisos,
    queryFn: ({ signal }) => pedir<PermisosDeLaSesion>(PERMISOS_DE_LA_SESION, signal),
    retry: false,
  });

  const compuesto = useMemo(() => {
    if (modulos.data === undefined || accesos.data === undefined || permisos.data === undefined) {
      return null;
    }
    return componer(
      CATALOGO,
      contenidoDe(modulos.data),
      contenidoDe(accesos.data),
      permisos.data,
      codigoDe,
    );
  }, [modulos.data, accesos.data, permisos.data]);

  // **El fallo va ANTES que el dato**, y no es un detalle: una consulta que falla al refrescar pasa
  // a `error` CONSERVANDO el dato de antes. Mirar primero el dato ofreceria el menu de una
  // respuesta que el backend ya no sostiene.
  if (modulos.isError || accesos.isError || permisos.isError) {
    const peldano = peldanoDe(modulos.error ?? accesos.error ?? permisos.error);
    return {
      ...NADA,
      estado: 'error',
      porQue: t(FRASES_DEL_CATALOGO.error),
      detalle: [peldano.titulo, peldano.detalle, peldano.remedio],
    };
  }

  if (compuesto === null) {
    return { ...NADA, estado: 'pidiendo', porQue: t(FRASES_DEL_CATALOGO.pidiendo), detalle: [] };
  }

  if (compuesto.rotas.length > 0) {
    return {
      ...compuesto,
      estado: 'error',
      porQue: t(FRASES_DEL_CATALOGO.rota, { operaciones: compuesto.rotas.join(' · ') }),
      detalle: [],
    };
  }

  if (compuesto.catalogo.length === 0) {
    // Los nombres son los del BACKEND, como el rotulo del carril: dato, no texto de este sistema.
    const faltan = contenidoDe(modulos.data ?? NADA_PAGINADO)
      .filter((modulo) => compuesto.sinPermiso.includes(modulo.codigo))
      .map((modulo) => modulo.nombre);
    return {
      ...compuesto,
      estado: 'sin-permiso',
      porQue: t(FRASES_DEL_CATALOGO.sinPermiso),
      detalle:
        faltan.length === 0 ? [] : [t(FRASES_DEL_CATALOGO.loQueFalta, { modulos: faltan.join(', ') })],
    };
  }

  return { ...compuesto, estado: 'compuesto', porQue: '', detalle: [] };
}

/** Lo que sabe TanStack Query de una consulta, en la forma que `src/sesion.ts` entiende. */
function comoLectura<T>(consulta: UseQueryResult<T>): LecturaDeLaSesion<T> {
  if (consulta.isError) return { estado: 'fallo', error: consulta.error };
  if (consulta.data === undefined) return { estado: 'pidiendo' };
  return { estado: 'lista', dato: consulta.data };
}

/**
 * **Quien entro y de que municipalidad**: las dos lecturas de la barra (#64, AC 5).
 *
 * Como se DICEN lo decide `src/sesion.ts` —`cuentaDe` y `entidadDe`—; aqui solo se piden. Van por
 * su cuenta y no esperan al catalogo: la barra se monta cuando el catalogo esta compuesto, y lo que
 * estas dos no hayan contestado para entonces se dice con la frase de mientras se pide.
 *
 * Un fallo aqui **no tumba el menu**: la barra dice el peldano en el sitio del nombre, y lo que la
 * cuenta puede abrir lo decide la matriz, no quien es.
 */
export function useLaSesion(): {
  readonly quien: LecturaDeLaSesion<SesionResource>;
  readonly donde: LecturaDeLaSesion<MunicipalidadResource>;
} {
  const quien = useQuery({
    queryKey: LLAVES.sesion,
    queryFn: ({ signal }) => pedir<SesionResource>(QUIEN_ES_LA_SESION, signal),
    retry: false,
  });
  const donde = useQuery({
    queryKey: LLAVES.municipalidad,
    queryFn: ({ signal }) => pedir<MunicipalidadResource>(MUNICIPALIDAD_DE_LA_SESION, signal),
    retry: false,
  });
  return { quien: comoLectura(quien), donde: comoLectura(donde) };
}
