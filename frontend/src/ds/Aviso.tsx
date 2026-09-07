import { useState } from 'react';
import type { ReactNode } from 'react';

import { Boton } from './Boton.tsx';
import { Icono } from './Icono.tsx';
import type { NombreDeIcono } from './Icono.tsx';

/**
 * El mensaje centrado que ocupa el sitio de lo que no hay: **vacio, error o sin permiso**.
 *
 * Los tres son el mismo bloque del artboard —icono desvaido de 30 px, titulo de 16 px en
 * 700, detalle de 13.5 px— y son tres casos distintos a proposito, porque lo que hay que
 * hacer con cada uno es distinto: en el vacio se elige o se crea algo, en el error se
 * reintenta o se llama a soporte, y en el sin permiso no se hace nada aqui — se pide el
 * permiso. Colapsarlos en «no hay datos» manda a la persona equivocada a mirar. En este
 * sistema la distincion es cara de verdad: «el ejercicio no esta sellado» y «no puedes ver
 * el conjunto» se arreglan de manera distinta, y confundirlas manda a alguien a buscar una
 * ordenanza que si existe.
 *
 * `detalle` llega **ya redactado por el backend**, en castellano y en lenguaje del dominio.
 * Este componente lo muestra; no lo reescribe ni lo sustituye por un texto generico.
 *
 * **La traza se copia de un gesto** porque quien atiende en ventanilla la dicta por
 * telefono a soporte, y leerla de la pantalla para teclearla en otro sitio es donde se
 * pierde un caracter. Si el portapapeles no esta —navegador viejo, contexto sin permiso— el
 * identificador sigue en pantalla y se dicta igual: el boton es una comodidad, no el unico
 * camino.
 */
export type TipoDeAviso = 'vacio' | 'error' | 'sin-permiso';

const ICONO: Record<TipoDeAviso, NombreDeIcono> = {
  vacio: 'lupa',
  error: 'alerta',
  'sin-permiso': 'candado',
};

export interface AvisoProps {
  readonly tipo: TipoDeAviso;
  readonly titulo: string;
  readonly detalle?: string;
  /** El identificador de traza, para que soporte pueda seguir el caso. */
  readonly traza?: string;
  /** Lo que se puede hacer desde aqui: «Abrir la edicion 2027», «Reintentar». */
  readonly children?: ReactNode;
}

export function Aviso({ tipo, titulo, detalle, traza, children }: AvisoProps) {
  return (
    <div
      className={`kn-aviso kn-aviso--${tipo}`}
      // Un vacio no es una alerta: es el resultado normal de una busqueda que no encontro
      // nada, y anunciarlo como alerta interrumpe por algo que no lo merece. Un error y una
      // falta de permiso si interrumpen.
      role={tipo === 'vacio' ? undefined : 'alert'}
    >
      <span className="kn-aviso__icono">
        <Icono nombre={ICONO[tipo]} tamano={30} grosor={1.5} />
      </span>
      <p className="kn-aviso__titulo">{titulo}</p>
      {detalle !== undefined && <p className="kn-aviso__detalle">{detalle}</p>}
      {traza !== undefined && <Traza traza={traza} />}
      {children !== undefined && <div className="kn-aviso__acciones">{children}</div>}
    </div>
  );
}

function Traza({ traza }: { readonly traza: string }) {
  const [copiada, fijarCopiada] = useState(false);

  return (
    <p className="kn-aviso__traza">
      <span>Traza {traza}</span>
      <Boton
        menudo
        variante="secundario"
        onClick={() => {
          // `?.` y las dos ramas: en un contexto sin portapapeles `clipboard` es
          // `undefined`, y en uno con permiso denegado la promesa se rechaza. Ni una ni
          // otra puede reventar la pantalla que esta explicando un error.
          void navigator.clipboard?.writeText(traza).then(
            () => fijarCopiada(true),
            () => fijarCopiada(false),
          );
        }}
      >
        Copiar
      </Boton>
      <span role="status" className="kn-aviso__copiada">
        {copiada ? 'Copiada' : ''}
      </span>
    </p>
  );
}
