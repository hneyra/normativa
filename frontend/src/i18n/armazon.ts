import type { TextosDelArmazon } from '@kamayuk/shell';

/**
 * **Las palabras del marco** — costura de #55, la llena #60.
 *
 * <h2>`undefined` no es «sin texto»: es «los de la libreria»</h2>
 *
 * `@kamayuk/shell` trae las treinta y una palabras que el marco dice por su cuenta —«No hay ningun
 * destino abierto…», «Guardar», «Buscar»— en castellano, y `textos?` es un `Partial`: lo que no se
 * pasa sale como ellas. Asi que pasar `undefined` deja el marco hablando, y bien.
 *
 * Lo contrario —un objeto con las treinta y una copiadas aqui— seria una segunda fuente de verdad
 * que se queda vieja en silencio la primera vez que la libreria corrija una: `textos.ts` de
 * `@kamayuk/shell` dice por escrito que traducir el marco no puede ser todo o nada, y por eso es
 * `Partial`.
 *
 * <h2>Que hace #60 con esto</h2>
 *
 * Monta `i18next` con el español como clave —la decision de la epica #47— y pasa por aqui solo lo
 * que este sistema diga distinto del resto. El tipo se deja escrito ya para que ese PR no tenga
 * que tocar `aplicacion.tsx`.
 */
export const TEXTOS_DEL_MARCO: Partial<TextosDelArmazon> | undefined = undefined;
