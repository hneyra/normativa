import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { RAIZ, TOKENS, bloque, leer, normalizar, paletas } from './tokens.ts';

/**
 * AC11 — el contraste se MIDE, no se supone.
 *
 * Esta prueba calcula el ratio WCAG 2.1 de cada par de tokens que los ocho componentes
 * ponen juntos, **en los dos temas**, y falla por debajo de AA. No hay ninguna cifra
 * copiada de una herramienta: la formula esta aqui abajo y los colores salen de
 * `tokens/colors.css`, asi que cambiar un token cambia el resultado en la siguiente
 * corrida.
 *
 * DOS CRITERIOS, porque WCAG tiene dos y piden cosas distintas:
 *
 *   · **1.4.3 Contraste (minimo)** — texto: 4.5:1. Un `::placeholder` es texto, y la
 *     palabra «opcional» junto a una etiqueta tambien.
 *   · **1.4.11 Contraste no textual** — el filo que identifica un control y la informacion
 *     visual que identifica un ESTADO: 3:1.
 *
 * Y un tercero que no es de WCAG sino de honestidad: `decorativo`, para lo que no
 * transporta informacion. Un par solo puede declararse decorativo **con su motivo
 * escrito**, y la prueba exige que lo lleve: sin eso, «decorativo» seria el cajon donde se
 * esconde lo que no pasa.
 *
 * LO QUE NO CUMPLE ESTA ENUMERADO Y MEDIDO, no exento. `POR_DEBAJO_DEL_MINIMO` lleva los
 * pares que la paleta de V6 deja por debajo de su piso, cada uno con su ratio exacto. La
 * prueba comprueba **las dos direcciones**: que ninguno se aleje mas del piso, y que
 * ninguno que ya cumple siga en la lista. Asi la lista no crece en silencio ni se queda
 * tapando un defecto que ya se arreglo.
 */

type Criterio = 'texto' | 'no-textual' | 'decorativo';

/** El piso de cada criterio. `decorativo` no tiene: por definicion no informa. */
const MINIMO: Record<Criterio, number> = {
  texto: 4.5,
  'no-textual': 3,
  decorativo: 0,
};

interface Par {
  readonly frente: string;
  readonly fondo: string;
  readonly criterio: Criterio;
  /** Donde se ve. Lo lee quien revisa; la maquina no lo comprueba. */
  readonly donde: string;
  /** Obligatorio si el criterio es `decorativo`. */
  readonly porque?: string;
}

/**
 * Todo par de tokens que un componente de `src/ds/`, el reinicio o el marco (`src/marco/`)
 * pone junto.
 */
const PARES: readonly Par[] = [
  // —— Texto (1.4.3) ——
  {
    frente: '--tinta',
    fondo: '--superficie',
    criterio: 'texto',
    donde:
      'Aviso: el titulo; Boton secundario: el rotulo; Campo: lo que se teclea. Y, del ' +
      'reves, el aviso flotante del marco: `--superficie` sobre `--tinta`',
  },
  { frente: '--tinta', fondo: '--fondo', criterio: 'texto', donde: 'el texto sobre el lienzo' },
  {
    frente: '--tinta',
    fondo: '--sup',
    criterio: 'texto',
    donde: 'Importe: el valor, sobre la superficie sutil de una fila',
  },
  { frente: '--tinta-2', fondo: '--superficie', criterio: 'texto', donde: 'Campo: la etiqueta' },
  {
    frente: '--tinta-2',
    fondo: '--fondo',
    criterio: 'texto',
    donde: 'Campo: la etiqueta, cuando el formulario cae sobre el lienzo',
  },
  {
    frente: '--tinta-2',
    fondo: '--sup',
    criterio: 'texto',
    donde: 'Campo «ro»: el valor calculado, y el texto de una casilla',
  },
  {
    frente: '--tinta-3',
    fondo: '--superficie',
    criterio: 'texto',
    donde: 'Aviso: el detalle; Importe: la fecha; Campo: la ayuda, «opcional» y el ::placeholder',
  },
  { frente: '--tinta-3', fondo: '--fondo', criterio: 'texto', donde: 'FechaDeCalculo' },
  {
    frente: '--tinta-3',
    fondo: '--sup',
    criterio: 'texto',
    donde: 'el ::placeholder de un campo de solo lectura',
  },
  {
    frente: '--azul',
    fondo: '--superficie',
    criterio: 'texto',
    donde: 'Boton fantasma: el rotulo; un enlace',
  },
  { frente: '--azul', fondo: '--fondo', criterio: 'texto', donde: 'un enlace sobre el lienzo' },
  {
    frente: '--azul',
    fondo: '--realce',
    criterio: 'texto',
    donde: 'Boton fantasma con el puntero encima',
  },
  { frente: '--sobre-azul', fondo: '--azul', criterio: 'texto', donde: 'Boton primario: el rotulo' },
  {
    frente: '--sobre-azul',
    fondo: '--azul-hover',
    criterio: 'texto',
    donde: 'Boton primario con el puntero encima',
  },
  { frente: '--ok-tinta', fondo: '--ok-fondo', criterio: 'texto', donde: 'Insignia «ok»' },
  {
    frente: '--atencion-tinta',
    fondo: '--atencion-fondo',
    criterio: 'texto',
    donde: 'Insignia «atencion»',
  },
  { frente: '--mal-tinta', fondo: '--mal-fondo', criterio: 'texto', donde: 'Insignia «mal»' },
  { frente: '--info-tinta', fondo: '--info-fondo', criterio: 'texto', donde: 'Insignia «info»' },
  {
    frente: '--mal-tinta',
    fondo: '--superficie',
    criterio: 'texto',
    donde: 'Campo: el mensaje de error del backend',
  },
  {
    frente: '--ok-tinta',
    fondo: '--superficie',
    criterio: 'texto',
    donde: 'Aviso: el «Copiada» de la traza',
  },
  {
    frente: '--sobre-barra',
    fondo: '--azul-oscuro',
    criterio: 'texto',
    donde: 'Marco: el nombre de la entidad y el de la sesion, sobre la barra global',
  },
  {
    frente: '--sobre-barra-2',
    fondo: '--azul-oscuro',
    criterio: 'texto',
    donde: 'Marco: la segunda linea de la entidad, el papel de la sesion y el rotulo «Ejercicio»',
  },
  {
    frente: '--info-tinta',
    fondo: '--azul-suave',
    criterio: 'texto',
    donde: 'Marco: el selector de ejercicio, el avatar, el submodulo activo y la pastilla',
  },
  {
    frente: '--tinta-2',
    fondo: '--realce',
    criterio: 'texto',
    donde: 'Marco: la fila de un submodulo del arbol con el puntero encima',
  },

  // —— No textual (1.4.11) ——
  {
    frente: '--azul',
    fondo: '--superficie',
    criterio: 'no-textual',
    donde: 'el indicador de :focus-visible sobre papel, y el borde de un campo enfocado',
  },
  {
    frente: '--azul',
    fondo: '--fondo',
    criterio: 'no-textual',
    donde: 'el indicador de :focus-visible sobre el lienzo',
  },
  {
    frente: '--borde-campo',
    fondo: '--superficie',
    criterio: 'no-textual',
    donde: 'Campo: el filo de un control que se escribe',
  },
  {
    frente: '--borde-campo',
    fondo: '--fondo',
    criterio: 'no-textual',
    donde: 'Campo: el mismo filo cuando el formulario cae sobre el lienzo',
  },
  {
    frente: '--borde-boton',
    fondo: '--superficie',
    criterio: 'no-textual',
    donde: 'Boton secundario: su filo',
  },
  {
    frente: '--borde-hover',
    fondo: '--superficie',
    criterio: 'no-textual',
    donde: 'Boton secundario con el puntero encima',
  },
  {
    frente: '--mal-borde',
    fondo: '--mal-campo',
    criterio: 'no-textual',
    donde: 'Campo con error: su filo sobre su relleno',
  },

  // —— Decorativo, cada uno con su motivo ——
  {
    frente: '--tinta-4',
    fondo: '--superficie',
    criterio: 'decorativo',
    donde: 'Aviso: el trazo del icono',
    porque:
      'El icono de un Aviso no dice nada que el titulo no diga: los tres tipos llevan su ' +
      'texto debajo, y el componente no admite dibujarse sin el —`titulo` es obligatorio—. ' +
      'Si algun dia un icono quedara solo, este par deja de ser decorativo.',
  },
  {
    frente: '--foco',
    fondo: '--superficie',
    criterio: 'decorativo',
    donde: 'Campo: el halo de 3 px detras de un control enfocado',
    porque:
      'El halo ENGORDA el indicador de foco, no lo es. Lo que identifica el estado es el ' +
      'borde, que pasa a `--azul` y da 8.26:1 sobre papel; el halo es la aureola que lo ' +
      'hace visible de lejos. Medirlo como no-textual seria exigir 3:1 a un degradado que ' +
      'nadie tiene que distinguir por si solo.',
  },
  {
    frente: '--esqueleto',
    fondo: '--superficie',
    criterio: 'decorativo',
    donde: 'Esqueleto: la barra que ocupa el sitio del dato',
    porque:
      'Un marcador de carga lleva `aria-hidden` y no transporta informacion: lo que dice ' +
      '«esto se esta cargando» es el `aria-busy` de la region, no el gris de la barra. ' +
      'Quien no lo distinga del papel no se pierde ningun dato, porque todavia no hay dato.',
  },
  {
    frente: '--esqueleto-brillo',
    fondo: '--esqueleto',
    criterio: 'decorativo',
    donde: 'Esqueleto: el barrido',
    porque:
      'Es la animacion de un marcador de carga que ya lleva `aria-hidden`: quien no la ve ' +
      'no se pierde nada, y `prefers-reduced-motion` la apaga del todo desde el reinicio.',
  },
  {
    frente: '--desplazamiento-hover',
    fondo: '--fondo',
    criterio: 'decorativo',
    donde: 'el pulgar de la barra de desplazamiento bajo el puntero',
    porque:
      'El pulgar en REPOSO es `--borde-campo` y ya se ve; este par es el realce que le ' +
      'anade el puntero, o sea informacion que solo existe para quien ya esta usando el ' +
      'raton encima. Ademas el desplazamiento funciona con teclado y con rueda sin ver el ' +
      'pulgar en absoluto.',
  },
];

/**
 * Los tokens de color que no forman par medible con ningun otro, con su motivo.
 *
 * **Existe para que la cobertura sea comprobable.** Sin esta lista, un token nuevo al que
 * nadie le escribiera su par quedaria sin medir y la prueba seguiria en verde: mediria los
 * pares que hay, que es exactamente lo que no basta. Con ella, `PARES` y `SIN_PAR` tienen
 * que cubrir entre las dos **todos** los tokens de `colors.css`.
 *
 * Son de dos clases, y la distincion importa: los que NADIE pone junto a otro todavia, y
 * los que si se dibujan pero **no son un color** —capas translucidas y velos—, sobre los
 * que esta calculadora, que lee hexadecimales, daria una cifra que el navegador no pinta.
 */
const SIN_PAR: ReadonlyArray<{ readonly token: string; readonly porque: string }> = [
  {
    token: '--linea',
    porque:
      'El filo por omision del artboard (`const LINEA`). Es el que SEPARA —el borde de la ' +
      'ficha ajena del marco, el filo derecho del panel, el de una caja flotante—, y eso no ' +
      'identifica ningun control: WCAG 1.4.11 no lo alcanza. El filo que si identifica uno ' +
      'es `--borde-boton` para un boton y para la caja de filtro del arbol, y ' +
      '`--borde-campo` para lo que se escribe; los dos tienen su par y estan medidos.',
  },
  {
    token: '--linea-2',
    porque:
      'El filo mas tenue (`const LINEA_2`), el de entre filas: separa la cabecera de un menu ' +
      'de sus opciones y una pestana de la siguiente. Mismo caso que `--linea` y por el ' +
      'mismo motivo —separar no es identificar—. Su valor si esta en uso, como `--esqueleto`, ' +
      'y ese par si se mide.',
  },
  {
    token: '--barra-control',
    porque:
      'El relleno de un control de la barra global en reposo, y **no es un color sino una ' +
      'capa**: `rgba(255,255,255,.09)` sobre `--azul-oscuro`. Esta calculadora lee ' +
      'hexadecimales de seis digitos y componer alfa sobre el fondo daria una cifra que no ' +
      'es la que el navegador pinta. Lo que si esta medido es lo que se LEE encima: ' +
      '`--sobre-barra` y `--sobre-barra-2` sobre `--azul-oscuro`, y ese par no cambia por ' +
      'una capa de un nueve por ciento de blanco — al contrario, la aclara y sube el ratio.',
  },
  {
    token: '--barra-realce',
    porque:
      'La misma capa translucida al 20 %: el control pulsado y el filo del buscador. Mismo ' +
      'motivo que `--barra-control` —es alfa sobre `--azul-oscuro`, no un color—, y mismo ' +
      'consuelo: el texto de encima esta medido contra el fondo mas oscuro de los dos, que ' +
      'es el caso peor.',
  },
  {
    token: '--barra-hover',
    porque:
      'La tercera capa, la del puntero encima (18 %). Ademas de ser alfa y no color, es ' +
      'informacion que solo existe para quien ya esta apuntando con el raton: el mismo ' +
      'control se alcanza con el tabulador, y entonces lo que lo senala es el ' +
      '`:focus-visible` del reinicio, que si esta medido.',
  },
  {
    token: '--velo',
    porque:
      'El velo del dialogo de cierre: `rgba(0,54,90,.4)` sobre lo que haya debajo. **No ' +
      'lleva texto encima** —el texto va dentro del dialogo, sobre `--superficie`, y ese ' +
      'par si esta medido—, asi que no hay nada que leer a traves de el. Su trabajo es ' +
      'apagar el fondo lo justo para que el dialogo se lea como lo unico activo.',
  },
  {
    token: '--velo-paleta',
    porque:
      'El velo de la paleta de comandos, `rgba(22,35,44,.38)`. Es otro que el del dialogo ' +
      'porque el artboard los escribe distintos —uno tapa con el azul de la marca y el ' +
      'otro con la tinta—, y por lo demas mismo caso: nada se lee encima de el.',
  },
  {
    token: '--acento',
    porque:
      'El celeste de la marca. **No se usa como indicador de foco a proposito**: sobre papel ' +
      'blanco da 2.12:1 y WCAG 1.4.11 pide 3:1, asi que el foco lo pinta `--azul`. El marco ' +
      'lo tuvo un momento —el visto del aviso flotante, que el artboard pinta de celeste—, y ' +
      'se le quito: el toast se INVIERTE con el tema, y `--acento` sobre `--tinta` da 7.54:1 ' +
      'en claro y **1.39:1** en oscuro, o sea un icono que desaparece en la mitad de los ' +
      'temas. Hoy no lo pone nadie.',
  },
];

/**
 * Lo que la paleta de V6 deja por debajo de su piso. **Enumerado y medido, no exento.**
 *
 * Cada entrada lleva su ratio exacto: la prueba comprueba que sigue siendo ese, y tambien
 * que sigue estando por debajo del piso. Un token que cambie de valor pone esta lista roja
 * aunque el cambio «mejore» el contraste, que es lo que se quiere — la lista es el
 * inventario del defecto, y un inventario que se actualiza solo no sirve de inventario.
 */
const POR_DEBAJO_DEL_MINIMO: ReadonlyArray<{
  readonly frente: string;
  readonly fondo: string;
  readonly tema: 'claro' | 'oscuro';
  readonly ratio: number;
  readonly porque: string;
}> = [
  {
    frente: '--borde-campo',
    fondo: '--superficie',
    tema: 'claro',
    ratio: 1.58,
    porque:
      'El filo de un control en reposo. #C3CFD9 es `const BORDE_CAMPO` del artboard, y el ' +
      'AC2 lo ata: cambiarlo aqui seria repintar el diseno desde una prueba. El estado de ' +
      'FOCO si cumple —el filo pasa a `--azul` (8.26:1) mas un halo de 3 px—, asi que lo ' +
      'que queda por debajo es solo el reposo. Cerrarlo es un cambio del artboard, no de ' +
      'F-2. En el tema oscuro, donde nada obliga, el mismo token si cumple (3.56:1).',
  },
  {
    frente: '--borde-campo',
    fondo: '--fondo',
    tema: 'claro',
    ratio: 1.45,
    porque:
      'El mismo filo de control, cuando el campo cae sobre el lienzo en vez de sobre una ' +
      'tarjeta. Misma causa —el valor esta atado al artboard— y mismo arreglo: repintar el ' +
      'artboard, no el token.',
  },
  {
    frente: '--borde-boton',
    fondo: '--superficie',
    tema: 'claro',
    ratio: 1.36,
    porque:
      'El filo de un boton secundario. En claro vale #D6DEE4, que es lo que el artboard le ' +
      'pone (`border:1px solid #D6DEE4`, y es ademas `const LINEA`). El ROTULO del boton si ' +
      'cumple (16.01:1) y su foco tambien, asi que el boton se lee y se opera; lo que no ' +
      'llega a 3:1 es su contorno en reposo. En oscuro, sin artboard que copiar, cumple.',
  },
];

/** La luminancia relativa de un canal, segun WCAG 2.1 §Relative luminance. */
function canal(valor: number): number {
  const proporcion = valor / 255;
  return proporcion <= 0.04045 ? proporcion / 12.92 : ((proporcion + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const entero = Number.parseInt(normalizar(hex).slice(1), 16);
  return (
    0.2126 * canal((entero >> 16) & 255) +
    0.7152 * canal((entero >> 8) & 255) +
    0.0722 * canal(entero & 255)
  );
}

/** El ratio de contraste de WCAG: `(L1 + 0.05) / (L2 + 0.05)`. */
function ratio(frente: string, fondo: string): number {
  const uno = luminancia(frente);
  const otro = luminancia(fondo);
  return (Math.max(uno, otro) + 0.05) / (Math.min(uno, otro) + 0.05);
}

/** Redondeado a dos decimales HACIA ABAJO: 4.4999 no puede leerse como 4.50. */
const dosDecimales = (numero: number): number => Math.floor(numero * 100) / 100;

const { claro, oscuroPorAtributo } = paletas();
const TEMAS = { claro, oscuro: oscuroPorAtributo } as const;

function color(tema: keyof typeof TEMAS, token: string): string {
  const valor = TEMAS[tema].get(token);
  if (valor === undefined) {
    throw new Error(`El tema «${tema}» no declara «${token}».`);
  }
  return valor;
}

const declarada = (frente: string, fondo: string, tema: string) =>
  POR_DEBAJO_DEL_MINIMO.find(
    (entrada) => entrada.frente === frente && entrada.fondo === fondo && entrada.tema === tema,
  );

describe.each(['claro', 'oscuro'] as const)('AC11 — contraste medido, tema %s', (tema) => {
  const evaluables = PARES.filter((par) => par.criterio !== 'decorativo');

  it.each(evaluables.map((par) => ({ ...par })))(
    '$frente sobre $fondo — $donde',
    ({ frente, fondo, criterio, donde }) => {
      const medido = dosDecimales(ratio(color(tema, frente), color(tema, fondo)));
      const piso = MINIMO[criterio];
      const excepcion = declarada(frente, fondo, tema);

      if (excepcion !== undefined) {
        expect(
          medido,
          `«${frente}» sobre «${fondo}» (${tema}) esta declarado en POR_DEBAJO_DEL_MINIMO con\n` +
            `${excepcion.ratio}:1, y ahora mide ${medido}:1. Si el cambio es deliberado, la\n` +
            'lista se actualiza en el mismo commit: es el inventario del defecto.',
        ).toBe(excepcion.ratio);
        return;
      }

      expect(
        medido,
        `«${frente}» ${color(tema, frente)} sobre «${fondo}» ${color(tema, fondo)} da\n` +
          `  ${medido}:1, y el criterio «${criterio}» pide ${piso}:1.\n` +
          `  Donde se ve: ${donde}.\n` +
          '  Si el par no puede cumplir, se declara en POR_DEBAJO_DEL_MINIMO con su motivo;\n' +
          '  lo que no vale es dejarlo pasar en silencio.',
      ).toBeGreaterThanOrEqual(piso);
    },
  );
});

describe('la lista de excepciones no crece ni se queda vieja', () => {
  it.each(POR_DEBAJO_DEL_MINIMO.map((entrada) => ({ ...entrada })))(
    '$frente sobre $fondo ($tema) sigue por debajo del piso',
    ({ frente, fondo, tema, ratio: anotado }) => {
      const par = PARES.find(
        (candidato) => candidato.frente === frente && candidato.fondo === fondo,
      );
      expect(
        par,
        `«${frente}»/«${fondo}» ya no es un par que ningun componente ponga junto.`,
      ).toBeDefined();

      const medido = dosDecimales(ratio(color(tema, frente), color(tema, fondo)));
      expect(medido).toBe(anotado);
      expect(
        medido,
        `«${frente}» sobre «${fondo}» (${tema}) ya cumple: ${medido}:1. Sale de la lista, o la\n` +
          'lista deja de significar «esto es lo que falta por arreglar».',
      ).toBeLessThan(MINIMO[(par as Par).criterio]);
    },
  );

  it('cada excepcion dice por que, y no de pasada', () => {
    for (const entrada of POR_DEBAJO_DEL_MINIMO) {
      expect(entrada.porque.length, `«${entrada.frente}»/«${entrada.fondo}»`).toBeGreaterThan(80);
    }
  });

  it('todo par decorativo dice por que lo es', () => {
    const mudos = PARES.filter((par) => par.criterio === 'decorativo' && par.porque === undefined);

    expect(
      mudos.map((par) => `${par.frente}/${par.fondo}`),
      '«decorativo» sin motivo escrito es el cajon donde se esconde lo que no pasa.',
    ).toEqual([]);
  });
});

describe('ningun token de color se queda sin medir', () => {
  /**
   * **La comprobacion de cobertura, y es la que hace que las otras signifiquen algo.** Una
   * prueba de contraste mide los pares que alguien le escribio; si un token nuevo llega sin
   * su par, la prueba sigue verde habiendo dejado de mirarlo.
   */
  it('cada token de «colors.css» tiene par medido, o esta declarado sin par y con motivo', () => {
    const conPar = new Set(PARES.flatMap((par) => [par.frente, par.fondo]));
    const declaradosSinPar = new Set(SIN_PAR.map((entrada) => entrada.token));

    const huerfanos = [...claro.keys()].filter(
      (token) => !conPar.has(token) && !declaradosSinPar.has(token),
    );

    expect(
      huerfanos,
      'Estos tokens no aparecen en ningun par y tampoco estan declarados en SIN_PAR. Un\n' +
        'color que nadie mide es un color que puede estar mal desde el dia que se escribio.',
    ).toEqual([]);
  });

  it('y nadie esta en SIN_PAR teniendo par: la lista no tapa lo que ya se mide', () => {
    const conPar = new Set(PARES.flatMap((par) => [par.frente, par.fondo]));
    const sobrantes = SIN_PAR.filter((entrada) => conPar.has(entrada.token)).map((e) => e.token);

    expect(sobrantes).toEqual([]);
  });

  it('cada token sin par dice por que no lo tiene', () => {
    for (const entrada of SIN_PAR) {
      expect(entrada.porque.length, `«${entrada.token}»`).toBeGreaterThan(80);
    }
  });
});

describe('que par quedo mas cerca del limite', () => {
  /**
   * **Anotado, y por eso comprobado.** No basta con que todo pase: el par mas ajustado es el
   * que se rompe primero cuando alguien toca un token, y si nadie lo nombra el dia que se
   * rompa no habra con que comparar.
   */
  const MAS_AJUSTADO = {
    // 3.08:1 contra un piso de 3: ocho centesimas. Es el par que se rompe primero, y esta a
    // un tono de distancia — cualquier retoque de `--borde-hover` o de `--superficie` lo
    // cruza. El mas ajustado de TEXTO va muy por detras: `--tinta-3` sobre `--fondo`,
    // 5.07:1 contra 4.5.
    claro: {
      frente: '--borde-hover',
      fondo: '--superficie',
      criterio: 'no-textual',
      ratio: 3.08,
    },
    // En oscuro nada esta en la lista de excepciones, asi que el mas ajustado es el que en
    // claro NO llega: `--borde-campo`, que aqui vale un valor elegido y no copiado.
    oscuro: {
      frente: '--borde-campo',
      fondo: '--superficie',
      criterio: 'no-textual',
      ratio: 3.56,
    },
  } as const;

  it.each(['claro', 'oscuro'] as const)('en el tema %s', (tema) => {
    const evaluables = PARES.filter(
      (par) => par.criterio !== 'decorativo' && declarada(par.frente, par.fondo, tema) === undefined,
    );

    const conMargen = evaluables
      .map((par) => ({
        par,
        ratio: dosDecimales(ratio(color(tema, par.frente), color(tema, par.fondo))),
      }))
      .map((medida) => ({ ...medida, margen: medida.ratio - MINIMO[medida.par.criterio] }))
      .sort((uno, otro) => uno.margen - otro.margen);

    const [masAjustado] = conMargen;
    if (masAjustado === undefined) {
      // No es una asercion: si no hay pares que evaluar, esta prueba no mide nada y decirlo
      // asi es mas util que un `expect` que pasa sobre una lista vacia.
      throw new Error(`No hay ningun par evaluable en el tema ${tema}.`);
    }

    expect(
      {
        frente: masAjustado.par.frente,
        fondo: masAjustado.par.fondo,
        criterio: masAjustado.par.criterio,
        ratio: masAjustado.ratio,
      },
      `El par mas ajustado del tema ${tema} cambio. Si el cambio es deliberado, se anota aqui\n` +
        'el nuevo: esta constante es lo que hace que «pasa de sobra» y «pasa por poco» sean\n' +
        'afirmaciones distintas.',
    ).toEqual(MAS_AJUSTADO[tema]);
  });
});

describe('las TRES desviaciones del artboard siguen aplicadas', () => {
  /**
   * El catalogo de pares de arriba dice que el `::placeholder` usa `--tinta-3`, que el
   * indicador de foco usa `--azul` y que la palabra «opcional» usa `--tinta-3`. **Eso son
   * afirmaciones sobre el CSS, y el CSS no las firma.**
   *
   * Sin estas comprobaciones, devolver el `::placeholder` a `--tinta-4` —el valor del
   * artboard, 2.59:1— dejaria la prueba de contraste entera EN VERDE: seguiria midiendo el
   * par que el catalogo declara, que ya no seria el que la pantalla pinta. Es la forma de
   * fallo mas silenciosa que tiene una prueba de accesibilidad, y por eso el CSS se lee.
   */
  const base = leer(join(TOKENS, 'base.css'));
  const componentes = leer(join(RAIZ, 'src/estilos/componentes.css'));

  it('el ::placeholder usa «--tinta-3» y no «--tinta-4» (2.59:1)', () => {
    expect(
      bloque(base, '::placeholder {'),
      'El artboard pinta el ::placeholder con #93A3AF, que sobre papel blanco da 2.59:1.\n' +
        'Un placeholder es texto y WCAG 1.4.3 pide 4.5:1. «--tinta-3» da 5.51:1 y tambien es\n' +
        'un color del artboard: lo que cambia es cual de los suyos se usa, no la paleta.',
    ).toContain('var(--tinta-3)');
  });

  it('el indicador de foco usa «--azul» y no «--acento» (2.12:1)', () => {
    expect(
      bloque(base, ':focus-visible {'),
      'El artboard pinta el foco con #52BDEF, que sobre papel blanco da 2.12:1, y WCAG\n' +
        '1.4.11 pide 3:1 para lo que identifica un ESTADO. «--azul» da 8.26:1, y es el mismo\n' +
        'color que el artboard le pone al borde de un campo enfocado.',
    ).toContain('var(--azul)');
  });

  it('la palabra «opcional» usa «--tinta-3» y no «--tinta-4» (2.59:1)', () => {
    // La tercera, y es propia de este artboard: NormativaV6 escribe
    // `<span style="font-size:11.5px; color:#93A3AF">opcional</span>`. Es texto igual que
    // un placeholder, y con la misma medida.
    expect(bloque(componentes, '.kn-campo__opcional {')).toContain('var(--tinta-3)');
  });

  it('y los tres numeros que las justifican son los que se dicen', () => {
    // **Recalculados aqui**, para que las tres frases de arriba no sean una nota de un dia.
    // Si alguien cambiara `--tinta-3` o `--acento`, estas tres cifras se moverian y la
    // prueba diria exactamente cual de las tres razones dejo de ser cierta.
    const papel = color('claro', '--superficie');

    expect(dosDecimales(ratio(color('claro', '--tinta-4'), papel))).toBe(2.59);
    expect(dosDecimales(ratio(color('claro', '--acento'), papel))).toBe(2.12);
    expect(dosDecimales(ratio(color('claro', '--tinta-3'), papel))).toBe(5.51);
    expect(dosDecimales(ratio(color('claro', '--azul'), papel))).toBe(8.26);
  });
});
