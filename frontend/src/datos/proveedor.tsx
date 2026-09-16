import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * **El proveedor de consultas** — costura de #55, llena por #63.
 *
 * <h2>Lo que decia este archivo hasta hoy, y por que ya no</h2>
 *
 * Decia que montar un `QueryClient` sin consultas no es neutral: fija reintentos, frescura y
 * politica de foco **antes** de que nadie haya medido contra que backend. Ese dia llego: el Panel
 * pide dos operaciones de verdad (`src/datos/panel.ts`), asi que las tres decisiones se toman aqui y
 * se dicen.
 *
 * <h2>Las tres, y de donde sale cada una</h2>
 *
 * Son **las de `rentas`** (`rentas@ac379ac:src/aplicacion.tsx:120-121`), y se copian con su motivo y
 * no por parecido:
 *
 *   · **`retry: false`.** Un 401 reintentado tres veces son tres idas a un backend que ya dijo que
 *     no, y quien esta delante espera el triple para leer el mismo mensaje. Lo que hay que hacer con
 *     un 401 no es insistir: es volver a entrar. Y con la escalera de `@kamayuk/sesion` **tres de
 *     los siete peldanos no son averias** —403 `SIN_PRIVILEGIO`, 403 `SIN_MUNICIPALIDAD` y 422—:
 *     reintentarlos es insistir sobre algo ya imposible. El boton de reintentar sale solo donde SI
 *     puede cambiar algo, y lo decide `useDatosDeLaHoja`.
 *   · **`refetchOnWindowFocus: false`.** Volver a la pestana no es pedir datos nuevos. En una
 *     ventanilla, una pantalla que se repinta sola mientras alguien la esta leyendo es peor que una
 *     que se queda quieta — y aqui lo que se lee **esta sellado**: un conjunto sellado es inmutable
 *     (ADR-0025), asi que no hay frescura que ganar.
 *   · **Y ninguna tercera.** Ni `staleTime`, ni `gcTime`, ni `refetchInterval`: cada una seria una
 *     decision sobre un backend contra el que todavia no se ha medido nada — `YA_SERVIDAS` esta
 *     vacia, y lo dice con su motivo. Se ponen cuando alguien las mida, no antes.
 *
 * <h2>Un cliente de modulo, y no uno por pintada</h2>
 *
 * `new QueryClient()` dentro del componente crearia un cliente nuevo en cada renderizado, y con el
 * una cache vacia: cada pintada volveria a pedir las dos operaciones. Se construye una vez, al
 * cargar el modulo.
 */
const CONSULTAS = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export function ProveedorDeDatos({ children }: { readonly children: ReactNode }) {
  return <QueryClientProvider client={CONSULTAS}>{children}</QueryClientProvider>;
}

export { CONSULTAS };
