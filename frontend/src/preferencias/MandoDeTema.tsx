import {
  Cajon,
  IDENTIDADES,
  MODOS,
  NotaDelCajon,
  PanelDelCajon,
  TituloDelCajon,
  cn,
  useTema,
  type Identidad,
  type Modo,
} from '@kamayuk/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * **El mando de los temas** — calcado de `rentas/frontend/src/preferencias/MandoDeTema.tsx@ac379ac`
 * (#57, AC 6).
 *
 * <h2>Por que un cajon y no una pantalla</h2>
 *
 * Porque `NormativaV8.dc.html` **no dibuja ninguna pantalla de preferencias**, y las cuatro que
 * dibuja se comparan campo por campo contra el artboard (#58). Inventar la quinta seria meter en el
 * arbol una pantalla que el artboard no tiene. El menu de sesion **si** trae «Preferencias», asi
 * que el mando cuelga de ahi.
 *
 * El cajon es la pieza de `@kamayuk/ui` que corresponde: sale por un lado, se cierra con Escape y es
 * un dialogo de verdad para el lector de pantalla. No hace falta pieza nueva.
 *
 * <h2>Los dos ejes se ofrecen SEPARADOS, porque son dos cosas distintas</h2>
 *
 *     Identidad visual   institucional | alto-contraste | sepia     <- de que servicio es esto
 *     Apariencia         claro | oscuro | el del sistema            <- como lo quiere ver quien mira
 *
 * Una sola lista de cinco obliga a escribir seis entradas y a repensarlas cada vez que entre una
 * identidad. Cruzados son tres por tres, y el tercero del segundo eje —«El del sistema»— no es un
 * tema: es **no elegir**, y por eso vale `null` y quita el atributo en vez de ponerlo en claro.
 *
 * <h2>Las opciones salen de la libreria, no de una lista de aqui</h2>
 *
 * `IDENTIDADES` y `MODOS` son de `@kamayuk/ui`. Escribirlas aqui a mano dejaria este mando corto el
 * dia que entre una cuarta identidad, y **sin que nada lo dijera**: el tema existiria, su CSS
 * viajaria en el paquete, y aqui no habria como elegirlo.
 *
 * <h2>Y desde #60 tambien se calca el `t()`</h2>
 *
 * Alli cada rotulo pasa por `react-i18next`, y aqui tambien: el castellano de las constantes de
 * abajo **es la clave** (epica #47), y `t()` corre donde se dibuja. Las once cadenas de esta pieza
 * se leen **por variable** —`t(ROTULO_DE_LA_IDENTIDAD[identidad])`—, asi que `i18next-cli` no las
 * ve: entran en el locale por `src/i18n/catalogo-de-claves.ts`, como las de las definiciones.
 *
 * Y esta es la unica pieza que este repositorio dibuja **fuera del interprete y fuera del marco**,
 * asi que es la unica que el recorrido de las cuatro hojas no puede ver. Por eso
 * `verificaciones/todo-el-texto-se-traduce.test.tsx` la monta aparte.
 *
 * Subir esta pieza a la libreria es `kamayuk-lib`#53; hasta entonces es una copia declarada, como en
 * `catastro`#110.
 */

/**
 * **Lo que dice el cajon, en castellano, que es la clave** (#60).
 *
 * Los rotulos de los dos ejes y sus dos notas. Los de las opciones estan justo debajo, en los dos
 * `Record` de siempre: no se funden aqui porque el compilador tiene que poder exigir **uno por
 * identidad y uno por modo**, y un saco plano no exige nada.
 */
const FRASES_DEL_MANDO = {
  preferencias: 'Preferencias',
  dondeSeGuarda:
    'Se guarda en este navegador y solo aqui: no viaja al servidor ni cambia lo que ven las demas ' +
    'personas.',
  identidadVisual: 'Identidad visual',
  notaDeLaIdentidad: 'La paleta con que se dibuja este servicio.',
  apariencia: 'Apariencia',
  notaDeLaApariencia: 'Sin elegir, se sigue lo que el equipo tenga puesto.',
} as const;

/** Como se lee cada identidad. El castellano ES la clave (epica #47), y `t()` corre al dibujar. */
const ROTULO_DE_LA_IDENTIDAD: Readonly<Record<Identidad, string>> = {
  institucional: 'Institucional',
  'alto-contraste': 'Alto contraste',
  sepia: 'Sepia',
  // La cuarta, que `rentas@ac379ac` todavia no tenia: entro en la libreria con `kamayuk-lib`#56.
  // Es un `Record<Identidad, …>` y no un mapa parcial justamente por esto — el compilador la pidio
  // en cuanto aparecio, en vez de dejarla sin rotulo y sin forma de elegirla.
  clasico: 'Clásico',
};

/** Como se lee cada modo. El tercero —no elegir— no esta aqui: no es un modo. */
const ROTULO_DEL_MODO: Readonly<Record<Modo, string>> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
};

/** Lo que se ofrece por cada eje: su clave estable, su rotulo y el valor que fija. */
interface Opcion<T> {
  /** Estable y sin tildes: es lo que el arnes usa para apuntar a la opcion. */
  readonly clave: string;
  readonly rotulo: string;
  readonly valor: T;
}

const DE_LA_IDENTIDAD: readonly Opcion<Identidad>[] = IDENTIDADES.map((identidad) => ({
  clave: identidad,
  rotulo: ROTULO_DE_LA_IDENTIDAD[identidad],
  valor: identidad,
}));

const DEL_MODO: readonly Opcion<Modo | null>[] = [
  ...MODOS.map((modo) => ({ clave: modo, rotulo: ROTULO_DEL_MODO[modo], valor: modo })),
  // El tercero es **no elegir**, y por eso su valor es `null` y no una tercera paleta.
  { clave: 'sistema', rotulo: 'El del sistema', valor: null },
];

/**
 * Todo lo que esta pieza aporta al inventario del locale. Ver `src/i18n/catalogo-de-claves.ts`.
 *
 * Se DERIVA de las tres listas y no se escribe: el dia que `@kamayuk/ui` publique una cuarta
 * identidad, el `Record` de arriba no compila hasta que se le ponga rotulo, y ese rotulo entra aqui
 * solo. Una lista escrita a mano se quedaria corta sin que nada lo dijera.
 */
export function clavesDelMando(): readonly string[] {
  return [
    ...Object.values(FRASES_DEL_MANDO),
    ...DE_LA_IDENTIDAD.map((o) => o.rotulo),
    ...DEL_MODO.map((o) => o.rotulo),
  ];
}

function Eje<T>({
  rotulo,
  nota,
  opciones,
  elegido,
  al,
}: {
  readonly rotulo: string;
  readonly nota: string;
  readonly opciones: readonly Opcion<T>[];
  readonly elegido: T;
  readonly al: (valor: T) => void;
}) {
  // El `name` del grupo tiene que ser unico en el documento: con el mismo en los dos ejes, marcar
  // una identidad desmarcaria el modo — son el mismo grupo de radios para el navegador.
  const grupo = useId();
  const { t } = useTranslation();

  return (
    <fieldset data-slot="eje-del-tema" className="m-0 border-0 p-0">
      <legend className="mb-[7px] p-0 text-[12.5px] font-bold text-tinta-3">{t(rotulo)}</legend>
      <div className="grid gap-[6px]">
        {opciones.map((opcion) => {
          const marcada = opcion.valor === elegido;
          return (
            <label
              key={opcion.clave}
              data-slot="opcion-del-tema"
              data-opcion={opcion.clave}
              data-elegida={marcada ? '1' : '0'}
              className={cn(
                'flex cursor-pointer items-center gap-[9px] rounded-sm border px-[10px] py-2 text-[13.5px] transition-colors',
                marcada
                  ? 'border-azul bg-azul-suave font-bold text-info-tinta'
                  : 'border-borde-campo bg-superficie text-tinta-2 hover:border-borde-hover',
              )}
            >
              <input
                type="radio"
                name={grupo}
                value={opcion.clave}
                checked={marcada}
                onChange={() => {
                  al(opcion.valor);
                }}
                className="size-4 shrink-0 accent-azul"
              />
              <span>{t(opcion.rotulo)}</span>
            </label>
          );
        })}
      </div>
      {/* `text-tinta-3` y NO `text-tinta-4` (`rentas`#140): `--tinta-4` no es color de texto —2,39:1
          sobre el lienzo, y WCAG 1.4.3 pide 4,5:1—, es el trazo de un icono decorativo. Esta frase
          se lee: es la unica que dice que hace «El del sistema». */}
      <p data-slot="nota-del-eje" className="mt-[7px] mb-0 text-[12px] leading-[1.5] text-tinta-3">
        {t(nota)}
      </p>
    </fieldset>
  );
}

export interface MandoDeTemaProps {
  readonly abierto: boolean;
  readonly alCerrar: () => void;
}

export function MandoDeTema({ abierto, alCerrar }: MandoDeTemaProps) {
  const { identidad, modo, fijarIdentidad, fijarModo } = useTema();
  const { t } = useTranslation();

  return (
    <Cajon
      open={abierto}
      onOpenChange={(abre) => {
        if (!abre) alCerrar();
      }}
    >
      {/* El cajon de la libreria mide 262 px, que es el ancho del carril. Aqui dentro van dos listas
          con sus rotulos, y a 262 px las tres opciones del modo salen partidas. */}
      <PanelDelCajon lado="derecha" className="w-[min(360px,92vw)]">
        <TituloDelCajon>{t(FRASES_DEL_MANDO.preferencias)}</TituloDelCajon>
        <NotaDelCajon>{t(FRASES_DEL_MANDO.dondeSeGuarda)}</NotaDelCajon>
        {/* El `data-slot` va en el cuerpo y NO en el panel: el panel ya lleva el suyo
            —`panel-del-cajon`, de la libreria— y pisarselo dejaria sin nombre a la pieza que lo
            dibuja, que es la que sus propias pruebas apuntan. */}
        <div
          data-slot="mando-de-tema"
          className="flex flex-col gap-[18px] overflow-y-auto px-[15px] pb-[15px]"
        >
          <Eje
            rotulo={FRASES_DEL_MANDO.identidadVisual}
            nota={FRASES_DEL_MANDO.notaDeLaIdentidad}
            opciones={DE_LA_IDENTIDAD}
            elegido={identidad}
            al={fijarIdentidad}
          />
          <Eje
            rotulo={FRASES_DEL_MANDO.apariencia}
            nota={FRASES_DEL_MANDO.notaDeLaApariencia}
            opciones={DEL_MODO}
            elegido={modo}
            al={fijarModo}
          />
        </div>
      </PanelDelCajon>
    </Cajon>
  );
}
