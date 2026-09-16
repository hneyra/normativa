import type { ReactNode } from 'react';

/**
 * **El proveedor de consultas** — costura de #55, la llena #63.
 *
 * <h2>Hoy solo pinta a sus hijos, y es a proposito</h2>
 *
 * `@tanstack/react-query` esta en el stack desde #50 —es el de `rentas`, version a version— pero
 * montar su `QueryClientProvider` aqui hoy no serviria de nada: **no hay ni una lectura**. El
 * backend no publica todavia `GET /seguridad/modulos`, `GET /seguridad/accesos` ni
 * `GET /seguridad/sesion` (#54), y la V6 dejo `YA_SERVIDAS = []` escrito con sus tres motivos
 * (`c01fe9a:src/datos/servidas.ts`).
 *
 * Un `QueryClient` montado sin consultas no es neutral: fija reintentos, tiempos de frescura y
 * politica de reintento en foco **antes** de que nadie haya medido contra que backend, y esos
 * valores por omision se heredan despues sin que nadie los decida. #63 los elige cuando haya algo
 * que pedir.
 *
 * <h2>Por que existe igual</h2>
 *
 * Para que #63 no tenga que tocar `src/aplicacion.tsx`, que es lo unico que #55 se reserva. El
 * envoltorio esta puesto en su sitio —dentro del tema y por fuera del armazon, como en
 * `rentas`— y lo que cambia ese dia es el cuerpo de esta funcion.
 */
export function ProveedorDeDatos({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}
