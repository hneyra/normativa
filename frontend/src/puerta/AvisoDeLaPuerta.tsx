import { useTranslation } from 'react-i18next';

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
 * <h2>El texto pasa por `t()` desde #60, y el castellano ES la clave</h2>
 *
 * Es la decision de la epica #47. Las tres frases viven en {@link FRASES_DE_LA_PUERTA} y no escritas
 * dentro de cada `t()`: asi entran solas en el inventario del locale
 * (`src/i18n/catalogo-de-claves.ts`), que es lo unico que impide que se quede corto.
 *
 * **Lo que NO se traduce, y por que**: `porQue.motivo` y `porQue.detalle` los dice **el emisor**
 * —`error` y `error_description` de la vuelta—, y `emisor`, `url` y el motivo de red son datos de la
 * instalacion. Traducirlos seria falso: no son frases de este sistema. Entran por interpolacion, que
 * es lo que deja que caigan donde el idioma los ponga.
 */

export interface AvisoDeLaPuertaProps {
  readonly porQue: PorQueNoSeEntro;
}

/**
 * **Lo que esta capa dice, en castellano, que es la clave** (#60).
 *
 * Las dos primeras son calcadas de `rentas@ac379ac:src/aplicacion.tsx:275-285`, palabra por palabra.
 * La tercera es de este sistema: `rentas` no tiene el caso «el emisor no dejo entrar» porque alli un
 * canje fallido acaba saliendo como un 401 (ver `falla.ts`).
 */
export const FRASES_DE_LA_PUERTA = {
  noContesto: 'No se pudo llegar al emisor de identidad, asi que no se mando a nadie a identificarse.',
  senasDelEmisor: 'El emisor es {{emisor}}, y la peticion a {{url}} no llego a completarse: {{motivo}}.',
  noDejoEntrar: '{{motivo}}, asi que no se entro.',
  queHacer:
    'Si esto es un puesto de desarrollo, levante la plataforma; si no, avise a quien la ' +
    'administra. Despues vuelva a cargar la pagina.',
} as const;

/** Todo lo que este archivo aporta al inventario del locale. Ver `catalogo-de-claves.ts`. */
export function clavesDeLaPuerta(): readonly string[] {
  return Object.values(FRASES_DE_LA_PUERTA);
}

/**
 * El titulo y la linea de las senas, segun cual de los dos casos sea.
 *
 * `traducir` entra por parametro con la firma estrecha —«una clave, y los datos que lleve dentro»—
 * y no como el `TFunction` de i18next: esto no es un componente y no puede llamar al gancho, y atar
 * su firma a la de la libreria la ataria a su version. Es la misma decision que `t` en
 * `src/i18n/i18n.ts`.
 */
function loQuePaso(
  porQue: PorQueNoSeEntro,
  traducir: (clave: string, datos?: Readonly<Record<string, unknown>>) => string,
): { readonly titulo: string; readonly senas: string } {
  if (porQue.tipo === 'no-contesto') {
    return {
      titulo: traducir(FRASES_DE_LA_PUERTA.noContesto),
      senas: traducir(FRASES_DE_LA_PUERTA.senasDelEmisor, {
        emisor: porQue.falla.emisor,
        url: porQue.falla.url,
        motivo: porQue.falla.motivo,
      }),
    };
  }
  return {
    titulo: traducir(FRASES_DE_LA_PUERTA.noDejoEntrar, { motivo: porQue.motivo }),
    // Lo dice el emisor, no este sistema: ver el javadoc.
    senas: porQue.detalle,
  };
}

export function AvisoDeLaPuerta({ porQue }: AvisoDeLaPuertaProps) {
  const { t } = useTranslation();
  const { titulo, senas } = loQuePaso(porQue, t);

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
          {t(FRASES_DE_LA_PUERTA.queHacer)}
        </p>
      </div>
    </div>
  );
}
