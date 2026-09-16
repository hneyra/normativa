import type { Hoja, Modulo } from './tipos.ts';

/**
 * **El arbol del artboard V8: un modulo y cuatro hojas** (#58, AC 1).
 *
 * <h2>De donde sale, literalmente</h2>
 *
 * De `const ARBOL` de `frontend/diseno/NormativaV8.dc.html`, entrada a entrada. No se reescribio ni
 * un trazo de icono ni una ruta: `verificaciones/pantallas-del-artboard.test.ts` compara este
 * archivo contra el artboard vendorizado y no contra una copia suya, que es lo unico que impide que
 * las dos cosas se «arreglen» de memoria por separado.
 *
 * La forma del artboard es posicional —`[rotulo, nota, clave, codigo, trazos, submodulos]`— y aqui
 * es un objeto. Es la unica libertad que se toma la transcripcion: las **cadenas** van literales, y
 * la guarda las compara una a una.
 *
 * <h2>Un modulo y no trece</h2>
 *
 * Lo dice el propio artboard: la pestana ajena que justificaba los otros doce
 * (`NormativaV6.dc.html:1147-1149`) no existe en `@kamayuk/shell`. Los cuatro submodulos de la V6
 * son las cuatro hojas de este.
 *
 * <h2>Por que `as const`</h2>
 *
 * Porque de aqui sale `ClaveDeHoja`, y de `ClaveDeHoja` sale que **no pueda haber una hoja sin
 * pantalla ni una pantalla sin hoja** sin que el compilador lo diga. Con el tipo ancho —`readonly
 * Modulo[]`— `clave` seria `string` y las cuatro definiciones podrian ser tres, o cinco, sin que
 * nada se pusiera rojo hasta correr la guarda.
 *
 * El `satisfies` de al lado es lo que impide que `as const` se lo trague todo: comprueba la forma
 * —que un verbo sea uno de los cinco, que una hoja traiga sus cuatro campos— sin ensanchar los
 * literales.
 *
 * <h2>El icono, y el codigo</h2>
 *
 * Los cinco trazos son **exactamente** los de `ICONOS.balanza` de `@kamayuk/ui`: G2 lo eligio
 * (#52, 2026-09-15) y por eso `kamayuk-lib`#59 —el libro de la V6— se cerro como no planeado. Aqui
 * NO se escribe el nombre del icono: lo deduce `src/catalogo.ts` del trazo, y revienta si la
 * libreria deja de publicarlo. El codigo `NORMATIVA` es el que propone #48, todavia sin aceptar
 * (G1): si cambia, se ajusta en el artboard y de ahi aqui.
 */
export const ARBOL = [
  {
    rotulo: 'Normativa',
    nota: 'Parámetros sellados y corpus',
    slug: 'normativa',
    codigo: 'NORMATIVA',
    trazos: [
      'M12 4.4v3.2',
      'M5 8.6h14',
      'M5 8.6 2.8 14.4h4.4z',
      'M19 8.6 16.8 14.4h4.4z',
      'M8.4 20h7.2',
    ],
    hojas: [
      {
        clave: 'nor-panel',
        rotulo: 'Panel',
        operaciones: [
          {
            verbo: 'GET',
            ruta: '/seguridad/parametros/ejercicios/{ejercicio}',
            nota: 'ParametrosController',
          },
          { verbo: 'GET', ruta: '/seguridad/parametros', nota: 'ParametrosController' },
        ],
        piezasDeclaradas: [],
      },
      {
        clave: 'nor-ediciones',
        rotulo: 'Ediciones',
        operaciones: [
          { verbo: 'GET', ruta: '/seguridad/parametros', nota: 'ParametrosController' },
          {
            verbo: 'GET',
            ruta: '/seguridad/parametros/ejercicios/{ejercicio}',
            nota: 'ParametrosController',
          },
          { verbo: 'GET', ruta: '/conjuntos/{id}/snapshot', nota: 'SnapshotController' },
        ],
        piezasDeclaradas: [],
      },
      {
        clave: 'nor-cuadros',
        rotulo: 'Cuadros de valuación',
        operaciones: [
          { verbo: 'GET', ruta: '/conjuntos', nota: 'SnapshotController' },
          { verbo: 'GET', ruta: '/conjuntos/{id}/snapshot', nota: 'SnapshotController' },
        ],
        piezasDeclaradas: [],
      },
      {
        clave: 'nor-publicacion',
        rotulo: 'Publicación',
        operaciones: [
          { verbo: 'GET', ruta: '/conjuntos', nota: 'SnapshotController' },
          { verbo: 'GET', ruta: '/conjuntos/{id}/snapshot', nota: 'SnapshotController' },
        ],
        piezasDeclaradas: [],
      },
    ],
  },
] as const satisfies readonly Modulo[];

/**
 * Las cuatro claves de hoja, como tipo.
 *
 * Es lo que ata las definiciones al arbol **en tiempo de compilacion**: `PANTALLAS` se declara
 * `Record<ClaveDeHoja, Pantalla>`, de modo que una hoja sin pantalla no compila y una pantalla con
 * una clave que no es de ninguna hoja, tampoco.
 */
export type ClaveDeHoja = (typeof ARBOL)[number]['hojas'][number]['clave'];

/** El slug del unico modulo, como tipo. */
export type SlugDeModulo = (typeof ARBOL)[number]['slug'];

/**
 * Las cuatro claves en el orden del arbol.
 *
 * En ese orden y no ordenadas alfabeticamente: el orden del arbol es el que se dibuja, y es el que
 * la guarda compara contra el artboard.
 */
export const CLAVES_DE_HOJA: readonly ClaveDeHoja[] = ARBOL.flatMap((modulo) =>
  modulo.hojas.map((hoja) => hoja.clave),
);

/** Las cuatro hojas, por su clave. Se construye una vez: se consultan en cada pintada. */
const POR_CLAVE: ReadonlyMap<string, Hoja> = new Map(
  ARBOL.flatMap((modulo) => modulo.hojas.map((hoja) => [hoja.clave, hoja] as const)),
);

/**
 * La hoja de una clave.
 *
 * Revienta con una clave que no existe en vez de devolver `undefined`: el tipo `ClaveDeHoja` ya
 * impide escribir una mal, asi que llegar aqui sin hoja significa que el arbol y las claves se han
 * desincronizado — y eso no se arregla dibujando una pantalla vacia.
 */
export function hojaDe(clave: ClaveDeHoja): Hoja {
  const hoja = POR_CLAVE.get(clave);
  if (hoja === undefined) {
    throw new Error(`«${clave}» no esta en el arbol. El arbol y las claves se desincronizaron.`);
  }
  return hoja;
}
