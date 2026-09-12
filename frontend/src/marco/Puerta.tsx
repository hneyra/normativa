import { Aviso, Boton } from '../ds/index.ts';
import type { RazonDeLaPuerta } from './puerta.ts';

/**
 * Lo que se ve cuando no hay token: **una de las cuatro razones, y cuál**.
 *
 * <h2>Por que ocupa la pantalla entera y no un rincon</h2>
 *
 * Porque sin token no hay nada que hacer aqui. Las cuatro operaciones que este sistema publica
 * exigen token —`SeguridadWeb.cadenaDeSeguridad` deja `authenticated()` todo lo que cuelga de la
 * raiz de la API— y el inquilino sale del token, asi que ninguna seccion puede pedir nada. El
 * marco dibujaria un panel sin ediciones, unos cuadros vacios y una publicacion sin conjuntos:
 * tres pantallas que se ven exactamente igual que «no hay ediciones abiertas», «este ejercicio
 * no tiene cuadros» y «no hay nada publicado». En el sistema cuyo trabajo entero es decir que
 * cifra rige, esa es la peor manera posible de mentir.
 *
 * <h2>El boton que se ofrece depende de la razon, y por eso lo decide `puerta.ts`</h2>
 *
 * Volver a la puerta arregla tres de las cuatro y **no arregla** la del origen inseguro: sin
 * `crypto.subtle` no hay reto S256 que calcular, asi que `entrar()` volveria aqui con la misma
 * pantalla. Ofrecerlo ahi seria mandar a dar vueltas a quien tiene que abrir la aplicacion por
 * otra URL.
 */
export interface PuertaProps {
  readonly razon: RazonDeLaPuerta;
  readonly alVolverAIdentificarse: () => void;
}

export function Puerta({ razon, alVolverAIdentificarse }: PuertaProps) {
  return (
    <main className="kn-puerta">
      <div className="kn-puerta__caja">
        <p className="kn-puerta__marca">
          Normativa
          <span className="kn-puerta__marca-nota">Sistema de gestión tributaria municipal</span>
        </p>

        <Aviso
          // Cerrar sesion no es una averia, y el tono lo dice antes que el texto: el candado
          // manda a volver a entrar y el aspa manda a mirar el despliegue.
          tipo={razon.esAveria ? 'error' : 'sin-permiso'}
          titulo={razon.titulo}
          detalle={razon.detalle}
        >
          <p className="kn-puerta__remedio">{razon.remedio}</p>
          {razon.ofreceEntrar && (
            <Boton variante="primario" onClick={alVolverAIdentificarse}>
              Volver a identificarse
            </Boton>
          )}
        </Aviso>
      </div>
    </main>
  );
}
