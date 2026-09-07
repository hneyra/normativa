import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * El boton del artboard. Tres variantes y dos tallas, ni una mas.
 *
 * Las tres salen de NormativaV6: el primario (`padding:10px 18px; background:#005284;
 * color:#fff; font-weight:600`, con `style-hover="background:#00365A"`), el secundario
 * (`padding:9px 15px; border:1px solid #D6DEE4; background:#fff`, con
 * `style-hover="border-color:#7E96A8"`) y el fantasma, que solo se pinta bajo el puntero
 * (`style-hover="background:#EFF7FC"`). La talla menuda tambien: `border-radius:5px;
 * padding:5px 11px; font-size:12.5px`.
 *
 * En una barra de acciones **la ultima es la primaria** y las demas secundarias. Eso lo
 * decide quien compone la barra, no este componente: aqui no hay forma de declarar «soy la
 * accion de esta pantalla», porque entonces habria dos sitios donde se decide cual es y se
 * contradirian.
 *
 * `type="button"` por omision y no `submit`. Es el defecto clasico del HTML: un boton dentro
 * de un `<form>` sin `type` envia el formulario, asi que un boton de «Ver el snapshot» junto
 * al formulario de una edicion la guardaria. Quien quiera enviar lo pide por `type`, que
 * sigue pasando en `...resto`.
 */
export type VarianteDeBoton = 'primario' | 'secundario' | 'fantasma';

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: VarianteDeBoton;
  readonly menudo?: boolean;
  readonly children: ReactNode;
}

export function Boton({
  variante = 'secundario',
  menudo = false,
  children,
  className,
  type = 'button',
  ...resto
}: BotonProps) {
  const clases = ['kn-boton', `kn-boton--${variante}`];
  if (menudo) {
    clases.push('kn-boton--menudo');
  }
  if (className !== undefined) {
    clases.push(className);
  }

  return (
    <button type={type} className={clases.join(' ')} {...resto}>
      {children}
    </button>
  );
}
