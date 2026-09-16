import type { DefinicionDePantalla } from '@kamayuk/ui';

/**
 * **Los tipos del ARBOL de este sistema** (#58, AC 1).
 *
 * <h2>Por que estos cuatro se quedan aqui y los de la pantalla no</h2>
 *
 * Porque el reparto ya esta decidido y medido. `kamayuk-lib`#27 subio a `@kamayuk/ui` **la mitad
 * que el interprete lee** —campo, tabla, bloque y pantalla— y dejo en cada sistema **la otra
 * mitad**: el arbol, sus hojas y sus operaciones. El motivo lo escribe el propio
 * `paquetes/ui/interprete/tipos.ts`: «el arbol es de quien tiene los modulos, y la regla de
 * ADR-0030 §4 no deja que una libreria comun sepa cuales son».
 *
 * Asi que `Pantalla` es un alias de lo que publica la libreria —no una copia— y `Modulo`, `Hoja`,
 * `Operacion` y `Verbo` se escriben aqui, calcados de
 * `rentas/frontend/src/pantallas/tipos.ts@ac379ac:180-210`.
 *
 * <h2>Por que un alias y no `import type { DefinicionDePantalla }` en cada archivo</h2>
 *
 * Porque las cuatro definiciones, el catalogo y dos guardas nombran el mismo tipo, y un alias en un
 * solo sitio es lo que hace que el dia que la libreria lo renombre haya **un** archivo que tocar.
 * No es una segunda declaracion: si `DefinicionDePantalla` cambia de forma, esto cambia con ella.
 */

/** Una de las cuatro pantallas: `{ instruccion, bloques }`, lo que dibuja `<Pantalla>`. */
export type Pantalla = DefinicionDePantalla;

/**
 * El verbo con que una hoja declara una operacion del backend.
 *
 * `BASE` no es un verbo HTTP: marca una ruta de la que solo se leyo el `@RequestMapping` de la
 * clase. Lo trae la gramatica de `rentas` y **el artboard de `normativa` no lo usa**: sus cuatro
 * operaciones salen de un `@GetMapping` leido —`ParametrosController.java:41,90` y
 * `SnapshotController.java:86,118`—, y por eso las cuatro llevan `GET`. Se declara igualmente,
 * porque quitarlo convertiria en error de compilacion una hoja que el artboard sabe escribir.
 */
export type Verbo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'BASE';

/** Una operacion del backend que la hoja declara servir. */
export interface Operacion {
  readonly verbo: Verbo;
  readonly ruta: string;
  /** De donde sale: el controlador que la publica, o que hace. */
  readonly nota: string;
}

/**
 * Una pieza de shadcn que la hoja declara, con para que.
 *
 * Las cuatro hojas de `normativa` la traen **vacia**, y eso es un dato y no un olvido: el artboard
 * V8 de este sistema no declara ni una (`NormativaV8.dc.html`, `const ARBOL`). Lo que la V6 dibujaba
 * y la gramatica no expresa esta contado uno a uno en `frontend/diseno/HUECOS.md`, no aqui.
 */
export interface PiezaDeclarada {
  readonly pieza: string;
  readonly uso: string;
}

/** Una hoja del arbol: lo que se abre por su hash. */
export interface Hoja {
  readonly clave: string;
  readonly rotulo: string;
  readonly operaciones: readonly Operacion[];
  readonly piezasDeclaradas: readonly PiezaDeclarada[];
}

/** Un modulo del arbol, con sus hojas. */
export interface Modulo {
  readonly rotulo: string;
  /** La linea de debajo del rotulo: de que va el modulo. */
  readonly nota: string;
  /** El slug, que es lo que viaja al hash. */
  readonly slug: string;
  /** El codigo con que lo nombra el catalogo de seguridad del cluster. */
  readonly codigo: string;
  /** Los trazos de su icono. Se emparejan contra `ICONOS` en `src/catalogo.ts`; no se dibujan. */
  readonly trazos: readonly string[];
  readonly hojas: readonly Hoja[];
}
