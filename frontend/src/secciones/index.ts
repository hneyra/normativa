/**
 * Las secciones del modulo propio, importadas desde aqui y no de su archivo.
 *
 * Igual que `ds/index.ts`, y por lo mismo: el `Lienzo` monta lo que hay, y anadir la siguiente
 * es una linea en este indice y no una ronda de `import` por el marco.
 *
 * `export type` explicito en cada tipo: con `verbatimModuleSyntax` un tipo reexportado como
 * valor se cuela en el bundle y arrastra su modulo entero.
 */

export { Cuadros } from './Cuadros.tsx';
export type { CuadrosProps } from './Cuadros.tsx';

export { Publicacion } from './Publicacion.tsx';
export type { PublicacionProps } from './Publicacion.tsx';

export { Tabla } from './Tabla.tsx';
export type { CeldaDeTabla, ColumnaDeTabla, FilaDeTabla, TablaProps } from './Tabla.tsx';
