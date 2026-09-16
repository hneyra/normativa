import type { PorQueNoSeEntro } from './falla.ts';

/**
 * **Cuando no se entro, lo que se dibuja ENCIMA de la aplicacion** (#57, AC 4 y AC 7).
 *
 * <h2>El defecto que esto cierra, medido en `rentas#112`</h2>
 *
 * `entrar()` termina en `location.assign(...)` y quien la llama no monta nada despues **a
 * proposito**: la pagina se va. Pero cuando la navegacion se RECHAZA —el emisor apagado, un DNS
 * que no resuelve, un cortafuegos que traga— no hay documento nuevo *ni* aplicacion. Medido alli
 * con `yarn dev` y nada mas levantado: `body.innerText` vacio, `body.innerHTML` vacio y la consola
 * con dos lineas de Vite, ni un error. Nada que leer en ninguna parte.
 *
 * <h2>Y el segundo caso, que es de ESTE sistema</h2>
 *
 * Volver con un `?error=` del emisor. La pagina si esta, pero la causa vive en una cadena de la URL
 * que el canje borra —y borrarla es lo correcto: un codigo ya usado no vale dos veces—. Sin esto,
 * lo que queda es el armazon vacio, sin sesion y sin una palabra. Ver `falla.ts`.
 *
 * <h2>Por que nombra la URL, o el detalle</h2>
 *
 * Porque las tres causas de que no se pueda llegar —la plataforma sin levantar, un `ConfigMap` con
 * la URL equivocada y un cortafuegos— se distinguen leyendo **que URL** se pidio. Sin ella las tres
 * son «no conecta», y las tres se arreglan en sitios distintos. Con el emisor contestando, lo que
 * distingue es **lo que el emisor dijo**: `error_description` lleva cosas como «Invalid parameter:
 * redirect_uri», que nombra el arreglo entero.
 *
 * <h2>Por que es una CAPA encima y no la pantalla entera</h2>
 *
 * En `rentas` esto se devuelve en lugar del `Armazon` (`ac379ac:src/aplicacion.tsx:174-186`). Aqui
 * no se puede: `src/aplicacion.tsx` lo toca solo #55 (epica #47) y ya dibuja `<PuertaCaida />`
 * **junto** al armazon, no en su lugar. Asi que esto se pone encima —`fixed inset-0`, con fondo
 * opaco— y tapa la aplicacion entera, que es el mismo efecto para quien mira.
 *
 * Lo que cambia es que el armazon sigue montado detras. No importa y se dice por que: sin token no
 * hay ni una lectura que pueda salir mal detras de esta capa —hoy no hay ninguna (#63)—, y el dia
 * que las haya seguiran sin token, que es la misma situacion que si no se hubiera montado.
 *
 * <h2>El texto va en castellano y sin `t()`</h2>
 *
 * El i18n es #60. Aqui el castellano es la clave, que es la decision de la epica #47.
 */

export interface AvisoDeLaPuertaProps {
  readonly porQue: PorQueNoSeEntro;
}

/** El titulo y la linea de las senas, segun cual de los dos casos sea. */
function loQuePaso(porQue: PorQueNoSeEntro): { readonly titulo: string; readonly senas: string } {
  if (porQue.tipo === 'no-contesto') {
    return {
      titulo:
        'No se pudo llegar al emisor de identidad, asi que no se mando a nadie a identificarse.',
      senas: `El emisor es ${porQue.falla.emisor}, y la peticion a ${porQue.falla.url} no llego a completarse: ${porQue.falla.motivo}.`,
    };
  }
  return {
    titulo: `${porQue.motivo}, asi que no se entro.`,
    senas: porQue.detalle,
  };
}

export function AvisoDeLaPuerta({ porQue }: AvisoDeLaPuertaProps) {
  const { titulo, senas } = loQuePaso(porQue);

  return (
    <div
      data-slot="puerta-caida"
      data-porque={porQue.tipo}
      role="alert"
      className="fixed inset-0 z-50 grid min-h-screen place-items-center bg-fondo p-[30px]"
    >
      <div className="max-w-[64ch] border border-mal-borde bg-mal-fondo p-[20px] text-[14px] leading-[1.6]">
        <p className="m-0 font-bold text-mal-tinta">{titulo}</p>
        {/* `break-all`: una URL de realm con el dominio de la municipalidad no cabe en 64ch y sin
            esto se sale del recuadro, que es justo el dato que hay que poder leer entero. */}
        <p data-slot="senas-del-emisor" className="mt-[10px] mb-0 break-all text-tinta-2">
          {senas}
        </p>
        <p className="mt-[10px] mb-0 text-tinta-2 text-pretty">
          Si esto es un puesto de desarrollo, levante la plataforma; si no, avise a quien la
          administra. Despues vuelva a cargar la pagina.
        </p>
      </div>
    </div>
  );
}
