import type { TextosDelArmazon } from '@kamayuk/shell';

/**
 * **Los dos avisos del pie, con las palabras del artboard V8** (#58, AC 5).
 *
 * <h2>Por que esto merece un archivo y una guarda propios</h2>
 *
 * Porque son las dos frases que dicen **lo que el boton de al lado implica** —«nada se escribe hasta
 * que pulse Guardar»— y son las mas faciles de reescribir «para que suene mejor». Una vez
 * reescritas, la pantalla sigue funcionando y el contrato que el usuario leyo ya no es el que la
 * pantalla cumple. Que sigan siendo las del artboard lo comprueba
 * `verificaciones/los-avisos-del-pie-son-los-del-artboard.test.ts`.
 *
 * Salen de `NormativaV8.dc.html`, del `pie` de su armazon: el de escritura y el de consulta.
 *
 * <h2>El de consulta NO es el de la libreria, y por eso este archivo hace falta</h2>
 *
 * Medido sobre `kamayuk-lib@origin/main:paquetes/shell/textos.ts:183-184`:
 *
 *     nadaSeEscribeTodavia: 'Nada se escribe hasta que pulse Guardar.'   <- IGUAL que el artboard
 *     datosDeHoy:          'Los datos son los que figuran a la fecha de hoy.'
 *
 * El segundo es de `rentas` —un padron cambia cada dia— y **aqui seria falso**: lo que esta
 * pantalla ensena es un conjunto SELLADO, que por definicion no cambia con la fecha. El artboard lo
 * dice con otras palabras, y son las que viajan.
 *
 * <h2>Por que sale como `Partial<TextosDelArmazon>` y no se le pasa a `<Pantalla>`</h2>
 *
 * Porque **el pie no lo dibuja el interprete**: lo dibuja `@kamayuk/shell` con `avisoDelPie(destino,
 * textos)` (`paquetes/shell/acciones.ts:72-77`), que elige uno de los dos segun el `seEscribe` de la
 * hoja. El interprete de `@kamayuk/ui` no tiene ninguna clave para esto —`TextosDelInterprete` y
 * `TextosDeLasPiezas` no la traen—, asi que pasarselo a `<Pantalla>` no lo dibujaria en ninguna
 * parte. Llega al marco por `src/i18n/armazon.ts`, que es la costura de los textos del `Armazon`.
 */
export const AVISOS_DEL_PIE = {
  /** Lo que se lee al pie de una hoja **que se escribe**, junto a «Limpiar» y «Guardar». */
  escritura: 'Nada se escribe hasta que pulse Guardar.',
  /** Y al pie de una **de solo consulta**, junto a «Exportar» e «Imprimir». */
  consulta: 'Los datos son los del conjunto que se pidió: lo sellado no cambia.',
} as const;

/**
 * Los dos avisos en la forma que el `Armazon` lee.
 *
 * Es un `Partial` y lleva **solo estas dos claves**: las otras veintinueve palabras del marco son
 * las de la libreria, y copiarlas aqui seria una segunda fuente de verdad que se queda vieja en
 * silencio la primera vez que la libreria corrija una.
 */
export const TEXTOS_DEL_PIE: Partial<TextosDelArmazon> = {
  nadaSeEscribeTodavia: AVISOS_DEL_PIE.escritura,
  datosDeHoy: AVISOS_DEL_PIE.consulta,
};
