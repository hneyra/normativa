import type { HojaDelCatalogo } from '@kamayuk/shell';
import type { Ausencia } from '@kamayuk/ui';
import type { ReactNode } from 'react';

/**
 * **La pantalla de un destino** — costura de #55, la llena #58.
 *
 * El `Armazon` no sabe dibujar ninguna pantalla y no puede saberlo (ADR-0030 §4): recibe esta
 * funcion y la llama con la hoja abierta. Aqui devuelve `null` **porque no hay ninguna hoja que
 * abrir**: `src/catalogo.ts` esta vacio, asi que el armazon dibuja su «sin destino abierto» y esta
 * funcion no llega a llamarse. Que no se llama lo comprueba `src/aplicacion.test.tsx`.
 *
 * <h2>Por que la ausencia se declara YA, si no la usa nadie todavia</h2>
 *
 * Porque es la mitad de la costura que #58 no debe inventar. Cuando las cuatro hojas lleguen como
 * datos, el interprete de `@kamayuk/ui` las dibujara **con su forma y sin sus datos** —ninguna
 * ruta de `normativa` esta encendida todavia: `c01fe9a:src/datos/servidas.ts` tenia
 * `YA_SERVIDAS = []` y el backend no publica aun `GET /seguridad/modulos` (#54)—, y lo que un
 * campo sin dato tiene que decir es esto y no un cero.
 *
 * El texto se calca de `rentas/frontend/src/porQueNoHayDato.ts@ac379ac` —`NADA_SERVIDO`—, que es
 * donde se redacto: una pantalla sin conectar dice que lo que se ve es su FORMA, no sus datos.
 * Tono `info` y no `atencion` porque no es una averia: es el estado esperado hasta la ola 5.
 */
export const AUSENCIA_SIN_CONECTAR: Ausencia = {
  enElCampo: 'sin conectar',
  explicacion:
    'Esta pantalla todavia no esta conectada: ninguna de las operaciones que declara la sirve el ' +
    'backend. Lo que se ve es su forma —que campos tiene y que columnas llevan sus listas—, no ' +
    'sus datos.',
  tono: 'info',
};

/**
 * Lo que se dibuja para un destino. Hoy, nada.
 *
 * El parametro se recibe y no se usa: la firma es la que el `Armazon` exige, y escribirla entera
 * aqui —en vez de un `() => null` en `aplicacion.tsx`— es lo que hace que #58 no tenga que tocar
 * `aplicacion.tsx` para llenarla.
 */
export function pantallaDe(_hoja: HojaDelCatalogo): ReactNode {
  return null;
}
