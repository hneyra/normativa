import type { CatalogoDeLaSesion } from './useCatalogoPermitido.ts';

/**
 * **Lo que se ve mientras el armazon no se puede montar: por que** (#64, AC 4).
 *
 * El `Armazon` de `@kamayuk/shell` no tiene estado de carga —recibe el catalogo ya filtrado y lo
 * dibuja—, asi que quien espera es la aplicacion, y lo que espera lo dice esto. Es el patron de
 * `rentas/frontend/src/aplicacion.tsx@ac379ac:175-183`, con una diferencia: aqui se dice ademas
 * **debajo** que paso —el peldano de la escalera, o lo que le falta a la cuenta—, porque sin barra
 * no hay menu de sesion ni otra pieza donde decirlo.
 *
 * <h2>Por que no se monta el armazon vacio mientras tanto</h2>
 *
 * Porque un enlace profundo —`#/ediciones`, con las tres de seguridad todavia en vuelo— dibujaria
 * «Esa direccion no corresponde a ningun destino disponible para esta cuenta». Se lo diria a una
 * cuenta que SI puede abrirla, y una negativa de permisos no se lee como una espera: se lee como un
 * no. Medido en `rentas`#136.
 *
 * <h2>Tres tonos, porque son tres cosas</h2>
 *
 * · **pidiendo** — `role="status"`: se anuncia sin interrumpir;
 * · **error** — `role="alert"` y la tinta del error: el sistema no pudo contestar, o contesto algo
 *   que no tiene la forma publicada;
 * · **sin permiso** — `role="status"` y la tinta de atencion: el sistema funciono, y esta cuenta no
 *   puede nada. No es una averia y no se pinta como tal.
 *
 * Los textos llegan YA dichos —`porQue` pasa por `t()` en el gancho, y el peldano llega en el
 * idioma de la escalera—, asi que aqui no se escribe ni una palabra.
 */
export function EsperaDelCatalogo({
  estado,
  porQue,
  detalle,
}: Pick<CatalogoDeLaSesion, 'estado' | 'porQue' | 'detalle'>) {
  const tinta =
    estado === 'error' ? 'text-mal-tinta' : estado === 'sin-permiso' ? 'text-atencion-tinta' : 'text-tinta-2';
  return (
    <div
      data-slot="espera-del-catalogo"
      data-estado={estado}
      role={estado === 'error' ? 'alert' : 'status'}
      className="grid min-h-screen place-items-center bg-fondo p-[30px]"
    >
      <div className="max-w-[60ch] text-center">
        <p className={`m-0 text-[14px] leading-[1.6] text-pretty ${tinta}`}>{porQue}</p>
        {detalle.map((linea) => (
          <p key={linea} className="mt-[8px] mb-0 text-[13px] leading-[1.5] text-tinta-3 text-pretty">
            {linea}
          </p>
        ))}
      </div>
    </div>
  );
}
