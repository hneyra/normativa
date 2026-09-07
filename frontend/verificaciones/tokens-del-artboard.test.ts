import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ARTBOARD,
  RAIZ,
  TOKENS,
  coloresDelArtboard,
  constantesDelArtboard,
  leer,
  normalizar,
  paletas,
  propiedades,
  sinComentarios,
} from './tokens.ts';

/**
 * Los tokens dicen lo que dice el artboard.
 *
 * **Es la barrera contra el modo de fallo mas caro de un sistema de diseno: que alguien
 * reescriba un valor a ojo.** Un `#005286` en vez de un `#005284` no lo ve nadie en una
 * revision, no rompe ninguna prueba de componente, y a los tres meses hay dos azules en la
 * pantalla y ya no se sabe cual era el bueno.
 *
 * Lo que se compara sale de `frontend/diseno/NormativaV6.dc.html`, que es el artboard
 * vendorizado — **no una copia de sus valores escrita en esta prueba, y no los tokens de
 * otro repositorio**. Si la lista viviera aqui, cambiar el token y cambiar la lista serian
 * el mismo commit y nadie se enteraria.
 *
 * TRES FAMILIAS DE COMPROBACION, y la distincion importa:
 *
 *   1. Las ONCE constantes que el artboard declara con nombre. Se comparan por nombre,
 *      valor a valor: los dos lados leidos, ninguno escrito aqui.
 *   2. Los literales que el artboard escribe en linea —el fondo de pagina, el halo del
 *      foco, la tinta del `::placeholder`, el realce del puntero, los cuatro pares de la
 *      insignia—. No tienen nombre alli, asi que se comprueba que el hexadecimal del token
 *      APAREZCA en el artboard. Es una afirmacion mas debil, y se dice: no distingue «este
 *      es el color del `::placeholder`» de «este color esta en alguna parte». Lo que si
 *      impide, que es lo que importa, es inventarse uno.
 *   3. **Que NINGUN token de color tenga un hexadecimal que no este en el artboard.** Es la
 *      red que sostiene a las otras dos: sin ella, un token que nadie metio en ninguna
 *      lista pasaria desapercibido para siempre.
 *
 * Lo que esta prueba NO mira es el tema oscuro, porque el artboard no lo trae. De eso
 * responde `contraste.test.ts`, que es lo unico que se puede medir sobre unos valores que
 * no tienen fuente que copiar.
 */

/** Los cinco archivos de tokens, en el orden en que `estilos.css` los encadena. */
const LOS_CINCO = ['colors.css', 'fonts.css', 'typography.css', 'spacing.css', 'base.css'];

/** Los ocho componentes base del AC6. */
const LOS_OCHO = [
  'Aviso',
  'Boton',
  'Campo',
  'Esqueleto',
  'FechaDeCalculo',
  'Icono',
  'Importe',
  'Insignia',
];

/**
 * El TypeScript sin sus comentarios.
 *
 * Los javadoc de este proyecto **citan el artboard** —«background:#005284», la URL de
 * Google Fonts que NO se usa— porque esa cita es lo que hace revisable de donde salio cada
 * regla. Un escaner que no los quitara pondria rojo justo al codigo mejor documentado, y
 * el arreglo seria borrar la documentacion: exactamente al reves de lo que se quiere.
 */
const sinComentariosDeCodigo = (fuente: string): string =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Token -> constante del artboard. Es la tabla de equivalencias, y es lo unico escrito a
 * mano de este archivo: los VALORES de los dos lados se leen.
 */
const CON_NOMBRE_EN_EL_ARTBOARD: ReadonlyArray<readonly [string, string]> = [
  ['--azul', 'AZUL'],
  ['--azul-hover', 'AZUL_OSC'],
  ['--azul-suave', 'AZUL_SUAVE'],
  ['--acento', 'ACENTO'],
  ['--linea', 'LINEA'],
  ['--linea-2', 'LINEA_2'],
  ['--borde-campo', 'BORDE_CAMPO'],
  ['--tinta', 'TINTA'],
  ['--tinta-2', 'TINTA_2'],
  ['--tinta-3', 'TINTA_3'],
  ['--sup', 'SUP'],
];

/**
 * Los tokens cuyo valor el artboard escribe EN LINEA, con el sitio donde se ve.
 * El sitio no lo comprueba la maquina: lo lee quien revisa, y por eso esta.
 */
const EN_LINEA_EN_EL_ARTBOARD: ReadonlyArray<readonly [string, string]> = [
  ['--fondo', 'html, body { … background: #F2F6F9 … }'],
  ['--superficie', 'el papel de una tarjeta: background:#fff'],
  ['--sobre-azul', 'el rotulo del boton primario: color:#fff'],
  ['--tinta-4', '::placeholder { color: #93A3AF }, y la palabra «opcional»'],
  ['--realce', 'style-hover="background:#EFF7FC"'],
  ['--borde-boton', 'el boton secundario: border:1px solid #D6DEE4'],
  ['--borde-hover', 'style-hover="border-color:#7E96A8"'],
  ['--desplazamiento-hover', '::-webkit-scrollbar-thumb:hover { background: #A7B7C4 }'],
  ['--foco', 'input:focus { … box-shadow: 0 0 0 3px #D3EBFA }'],
  ['--ok-fondo', 'INS.ok'],
  ['--ok-tinta', 'INS.ok'],
  ['--atencion-fondo', 'INS.warn'],
  ['--atencion-tinta', 'INS.warn'],
  ['--mal-fondo', 'INS.bad'],
  ['--mal-tinta', 'INS.bad'],
  ['--info-fondo', 'INS.info'],
  ['--info-tinta', 'INS.info'],
  ['--mal-borde', 'const IN_MAL'],
  ['--mal-campo', 'const IN_MAL'],
  ['--esqueleto', 'el filo tenue del artboard, #E3E9EE'],
  ['--esqueleto-brillo', 'la superficie sutil del artboard, #F7FBFE'],
];

describe('AC1 — los cinco archivos de tokens, y un solo punto de entrada', () => {
  const entrada = leer(join(RAIZ, 'src/estilos/estilos.css'));

  it.each(LOS_CINCO)('«tokens/%s» existe', (archivo) => {
    expect(existsSync(join(TOKENS, archivo))).toBe(true);
  });

  it('«estilos.css» los importa a los cinco, EN ORDEN', () => {
    const importados = [...sinComentarios(entrada).matchAll(/@import\s+'\.\/tokens\/([^']+)'/g)].map(
      (encontrado) => encontrado[1],
    );

    expect(
      importados,
      'El orden no es decorativo. Para `var()` da igual —se resuelve al usarla—, pero\n' +
        '`base.css` escribe REGLAS que leen lo que los otros cuatro declaran, y a igualdad\n' +
        'de especificidad gana la ultima que llega. Un `@import` movido de sitio no rompe\n' +
        'nada el dia que se mueve, y el dia que si lo rompe ya no se parece a ese cambio.',
    ).toEqual(LOS_CINCO);
  });

  it('«componentes.css» va DESPUES de los tokens: un componente le gana al reinicio', () => {
    const limpio = sinComentarios(entrada);
    expect(limpio.indexOf('./componentes.css')).toBeGreaterThan(limpio.indexOf('./tokens/base.css'));
  });

  it('«marco.css» va DESPUES de los componentes: el marco los COLOCA', () => {
    // El `Boton` del dialogo de cierre, el `Campo` del hueco y el `Aviso` de una seccion sin
    // construir se posicionan desde `marco.css`, y a igualdad de especificidad gana el
    // ultimo que llega. Con la hoja del marco antes, colocarlos exigiria `!important`.
    const limpio = sinComentarios(entrada);
    expect(limpio.indexOf('./marco.css')).toBeGreaterThan(limpio.indexOf('./componentes.css'));
  });

  it('nadie mas importa una hoja de estilos: el punto de entrada es uno', () => {
    // Si cada componente trajera la suya, el orden de la cascada lo decidiria el orden en
    // que Vite resuelve los modulos, que cambia con un `import` movido de sitio.
    const conCss = [...leer(join(RAIZ, 'src/main.tsx')).matchAll(/import\s+'([^']+\.css)'/g)].map(
      (encontrado) => encontrado[1],
    );

    expect(conCss).toEqual(['./estilos/estilos.css']);
  });
});

describe('AC2 — los valores coinciden con el artboard', () => {
  const { claro } = paletas();
  const delArtboard = constantesDelArtboard();
  const coloresQueUsa = coloresDelArtboard();

  it('el artboard vendorizado esta y declara sus once constantes con nombre', () => {
    expect(existsSync(ARTBOARD), `Falta el artboard en ${ARTBOARD}.`).toBe(true);

    // Sin esta comprobacion, un cambio en el formato del artboard —o un archivo que no se
    // descargo entero— dejaria el mapa VACIO, y entonces los once casos de abajo
    // compararian `undefined` contra `undefined` y pasarian en verde.
    expect(
      [...delArtboard.keys()].sort(),
      'El artboard tiene que declarar exactamente estas once constantes de color.',
    ).toEqual(
      [
        'ACENTO',
        'AZUL',
        'AZUL_OSC',
        'AZUL_SUAVE',
        'BORDE_CAMPO',
        'LINEA',
        'LINEA_2',
        'SUP',
        'TINTA',
        'TINTA_2',
        'TINTA_3',
      ].sort(),
    );
  });

  it.each(CON_NOMBRE_EN_EL_ARTBOARD)('%s vale lo que el artboard llama %s', (token, constante) => {
    expect(
      normalizar(claro.get(token) ?? ''),
      `«${token}» tiene que valer lo que el artboard declara en «const ${constante}».\n` +
        'No se reescribe a ojo: se copia, o se cambia el artboard primero.',
    ).toBe(delArtboard.get(constante));
  });

  it.each(EN_LINEA_EN_EL_ARTBOARD)('%s sale del artboard (%s)', (token, donde) => {
    const valor = normalizar(claro.get(token) ?? '');

    expect(
      coloresQueUsa.has(valor),
      `«${token}» vale ${valor}, y ese color no aparece en el artboard.\n` +
        `Deberia salir de: ${donde}.\n` +
        'Un color que no esta en el artboard es un color que alguien invento.',
    ).toBe(true);
  });

  it('AC2 (b) — ningun token de color se invento: TODOS salen del artboard', () => {
    // **La red de seguridad de las dos listas de arriba, y la comprobacion que el issue
    // subraya.** Si alguien anade un token de color nuevo y no lo mete en ninguna lista,
    // esta prueba lo caza igual — y si de verdad no sale del artboard, tiene que decirlo
    // aqui y no en un comentario que nadie ejecuta.
    const inventados = [...claro]
      .filter(([, valor]) => /^#[0-9a-f]{3,6}$/i.test(valor.trim()))
      .filter(([, valor]) => !coloresQueUsa.has(normalizar(valor)))
      .map(([nombre, valor]) => `${nombre}: ${valor}`);

    expect(
      inventados,
      'Estos colores no estan en el artboard. Si hacen falta, el sitio donde se justifican\n' +
        'es el javadoc de `colors.css`, y ademas hay que declararlos aqui como excepcion.',
    ).toEqual([]);
  });

  it('y la comprobacion anterior mira algo: la paleta clara tiene colores que mirar', () => {
    // Sin esto, un `colors.css` que dejara de declarar hexadecimales —porque alguien los
    // pasara a `rgb()` o a `color-mix()`— dejaria la lista de arriba vacia y en verde.
    const hexadecimales = [...claro.values()].filter((valor) => /^#[0-9a-f]{3,6}$/i.test(valor));

    expect(hexadecimales.length).toBeGreaterThan(25);
  });
});

describe('AC2 (c) — los componentes no pintan: solo usan tokens', () => {
  it.each(['componentes.css', 'tokens/base.css', 'marco.css'])(
    '«%s» no escribe ni un color a mano',
    (hoja) => {
      const css = sinComentarios(leer(join(RAIZ, 'src/estilos', hoja)));
      const colores = css.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi) ?? [];

      expect(
        colores,
        `«${hoja}» tiene un color escrito a mano. Todo color sale de \`tokens/colors.css\`:\n` +
          'es lo que hace que el tema oscuro exista sin tocar un componente, y lo que hace\n' +
          'que la prueba de contraste mida lo que la pantalla ensena y no otra cosa.',
      ).toEqual([]);
    },
  );

  it('y tampoco los pinta un componente de React', () => {
    // El otro sitio por donde se cuela un color: un `style={{ color: '#005284' }}` en el
    // JSX. `Icono` usa `currentColor` justamente para no tener que pasar ninguno.
    //
    // Se miran los comentarios aparte del codigo, y hace falta: los javadoc de estos
    // componentes CITAN el artboard —«background:#005284» en el de `Boton`— y esa cita es
    // lo que hace revisable de donde salio cada regla. Buscar sobre el archivo entero
    // habria puesto rojo justo al componente mejor documentado.
    const conColor = LOS_OCHO.map(
      (nombre) => [nombre, sinComentariosDeCodigo(leer(join(RAIZ, 'src/ds', `${nombre}.tsx`)))] as const,
    )
      .filter(([, fuente]) => /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(fuente))
      .map(([nombre]) => nombre);

    expect(conColor).toEqual([]);
  });

  it('y la comprobacion anterior no esta ciega: sobre el archivo SIN limpiar, «Boton» cae', () => {
    // La mitad que impide que `sinComentariosDeCodigo` se coma el archivo entero por un
    // comentario mal cerrado. Si el limpiador devolviera la cadena vacia, la prueba de
    // arriba pasaria en verde sin mirar nada; esta comprueba que lo que quita son los
    // comentarios y no el codigo, usando el unico componente que cita hexadecimales.
    const conCitas = leer(join(RAIZ, 'src/ds/Boton.tsx'));

    expect(/#[0-9a-f]{3,8}\b/i.test(conCitas)).toBe(true);
    expect(sinComentariosDeCodigo(conCitas)).toContain('kn-boton');
  });
});

describe('AC12 — el tema oscuro se declara dos veces y dice lo mismo', () => {
  const { claro, oscuroPorPreferencia, oscuroPorAtributo } = paletas();

  it('la preferencia del sistema y el atributo declaran los mismos valores', () => {
    // En CSS plano no hay forma de escribir esto una sola vez: un `@media` no admite que le
    // anadan un selector desde fuera. Asi que se escribe dos veces y lo que impide que
    // diverjan es esta prueba — que es peor que no tener que repetirlo, y mejor que
    // repetirlo sin nada que lo vigile.
    expect(Object.fromEntries(oscuroPorPreferencia)).toEqual(Object.fromEntries(oscuroPorAtributo));
  });

  it('la regla del @media se guarda para que la eleccion explicita de tema claro gane', () => {
    const css = sinComentarios(leer(join(TOKENS, 'colors.css')));

    expect(
      css,
      'Sin `:not([data-tema=\'claro\'])`, quien tiene el sistema en oscuro y elige el tema\n' +
        'claro se queda con el oscuro: la preferencia del sistema ganaria a su eleccion.',
    ).toContain(":root:not([data-tema='claro'])");
  });

  it('el tema oscuro redefine TODOS los colores del claro, sin dejarse ninguno', () => {
    const huerfanos = [...claro.keys()].filter((token) => !oscuroPorAtributo.has(token));

    expect(
      huerfanos,
      'Un color declarado solo en el tema claro se queda con el valor claro sobre papel\n' +
        'oscuro. No sale un error: sale un texto que no se lee.',
    ).toEqual([]);
  });

  it('y no inventa ninguno que el claro no tenga', () => {
    const sobrantes = [...oscuroPorAtributo.keys()].filter((token) => !claro.has(token));

    expect(sobrantes).toEqual([]);
  });
});

describe('AC4 — la escala tipografica y el espaciado son los del artboard, sin redondear', () => {
  const html = leer(ARTBOARD);

  it.each([
    ['--texto-base', 'font-size: 15px'],
    ['--texto-titulo', 'font-size:16px'],
    ['--texto-control', 'font-size:14px'],
    ['--texto-celda', 'font-size:13.5px'],
    ['--texto-etiqueta', 'font-size:12.5px'],
    ['--texto-menudo', 'font-size:12px'],
    ['--texto-insignia', 'font-size:11.5px'],
    ['--linea-prosa', 'line-height:1.55'],
    ['--linea-ayuda', 'line-height:1.45'],
    ['--linea-apretada', 'line-height:1.4'],
    ['--relleno-campo', 'padding:9px 10px'],
    ['--relleno-boton', 'padding:9px 15px'],
    ['--relleno-boton-primario', 'padding:10px 18px'],
    ['--relleno-boton-menudo', 'padding:5px 11px'],
    ['--relleno-insignia', 'padding:2px 8px'],
    ['--relleno-celda', 'padding:11px 16px'],
    ['--relleno-vacio', 'padding:32px'],
    ['--hueco-etiqueta', 'margin-bottom:5px'],
    ['--hueco-rotulo', 'gap:7px'],
    ['--hueco-boton', 'gap:8px'],
    ['--hueco-casilla', 'gap:9px'],
    ['--radio-insignia', 'border-radius:4px'],
    ['--radio-menudo', 'border-radius:5px'],
    ['--radio', 'border-radius:6px'],
    ['--lado-casilla', 'width:17px'],
    ['--ancho-aviso', 'max-width:44ch'],
  ])('%s vale lo que el artboard escribe («%s»)', (token, comoLoEscribeElArtboard) => {
    const escala = propiedades(leer(join(TOKENS, 'typography.css')));
    const espacios = propiedades(leer(join(TOKENS, 'spacing.css')));
    const valor = escala.get(token) ?? espacios.get(token);

    expect(valor, `Falta el token «${token}».`).toBeDefined();
    expect(
      comoLoEscribeElArtboard.endsWith(valor as string),
      `«${token}» vale ${valor} y el artboard escribe «${comoLoEscribeElArtboard}».\n` +
        'Los medios pixeles y los impares de V6 son deliberados: una tabla de 13.5 px cabe\n' +
        'donde una de 14 no, y 9, 11 y 15 no caben en ninguna rejilla de cuatros.\n' +
        'Redondearlos es reescribir el diseno a ojo.',
    ).toBe(true);

    expect(
      html.includes(comoLoEscribeElArtboard),
      `El artboard ya no escribe «${comoLoEscribeElArtboard}»: la referencia cambio.`,
    ).toBe(true);
  });

  it('NINGUN espaciado esta redondeado a una rejilla de 4 px', () => {
    // Es la afirmacion del AC4 dicha al reves, y hace falta decirla asi: la lista de arriba
    // comprueba los que hay, y esta comprueba que no aparezca uno nuevo «limpiado» a ojo.
    // Los rellenos del artboard son 9, 10, 11, 15, 18, 2, 5, 8, 16 y 32 px: si TODOS los
    // valores fueran multiplos de cuatro, alguien habria pasado por aqui con una regla.
    const espacios = propiedades(leer(join(TOKENS, 'spacing.css')));
    const numeros = [...espacios.values()]
      .flatMap((valor) => valor.match(/(\d+(?:\.\d+)?)px/g) ?? [])
      .map((medida) => Number.parseFloat(medida));

    expect(numeros.length).toBeGreaterThan(10);
    expect(
      numeros.some((medida) => medida % 4 !== 0),
      'Todos los espaciados son multiplos de 4. V6 NO esta en una rejilla de cuatros, asi\n' +
        'que eso solo puede haber pasado redondeando: los rellenos reales son 9px 10px en\n' +
        'un campo, 9px 15px en un boton secundario y 2px 8px en una insignia.',
    ).toBe(true);
  });

  it('la familia es una sola, y es la del artboard', () => {
    const familias = propiedades(leer(join(TOKENS, 'fonts.css')));

    expect(familias.get('--fuente')).toContain("'Source Sans 3'");
    expect(html).toContain("font-family: 'Source Sans 3', system-ui, sans-serif");
  });
});

describe('AC5 — las fuentes se auto-hospedan', () => {
  const fuentes = leer(join(TOKENS, 'fonts.css'));

  it.each(['source-sans-3-latin.woff2', 'source-sans-3-latin-ext.woff2'])(
    'el «%s» esta en el repositorio',
    (archivo) => {
      expect(
        existsSync(join(RAIZ, 'src/ds/fuentes', archivo)),
        'Sin el archivo, el `@font-face` apunta a un 404 y la pagina cae a `system-ui`\n' +
          'sin decir nada.',
      ).toBe(true);
    },
  );

  it('los dos se declaran con «font-display: swap»', () => {
    const bloques = fuentes.match(/@font-face\s*\{[^}]*\}/g) ?? [];

    expect(bloques).toHaveLength(2);
    for (const declaracion of bloques) {
      expect(declaracion).toContain('font-display: swap');
      expect(declaracion).toContain('.woff2');
    }
  });

  it('NADA de Google Fonts en tiempo de ejecucion', () => {
    // El artboard las pide al CDN con un `<link>`. Una municipalidad con red mala no
    // deberia depender de un tercero para que su sistema se LEA — ni contarle a ese tercero
    // quien lo usa. Los comentarios se quitan: `fonts.css` CITA la URL del artboard para
    // decir que no se usa, y esa frase es la que explica la decision.
    const arbol = [
      leer(join(RAIZ, 'index.html')),
      sinComentariosDeCodigo(leer(join(RAIZ, 'src/main.tsx'))),
      sinComentarios(leer(join(RAIZ, 'src/estilos/estilos.css'))),
      sinComentarios(fuentes),
    ].join('\n');

    expect(arbol).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});

describe('AC13 — «prefers-reduced-motion» esta en el reinicio, no en cada componente', () => {
  it('«base.css» lo declara', () => {
    // Va en el reinicio a proposito: una animacion nueva no se acuerda de preguntar, y la
    // que se anada manana ya nace apagada.
    expect(leer(join(TOKENS, 'base.css'))).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('y «componentes.css» NO lo repite, aunque tenga la unica animacion del proyecto', () => {
    // Sin comentarios: la hoja NOMBRA el `prefers-reduced-motion` de `base.css` para decir
    // que el barrido del `Esqueleto` se apaga alli y no aqui, que es justo lo que se
    // comprueba.
    expect(
      sinComentarios(leer(join(RAIZ, 'src/estilos/componentes.css'))),
      'Si cada componente pusiera el suyo, el que no lo pusiera no se notaria.',
    ).not.toContain('prefers-reduced-motion');
  });
});

describe('AC3 — los tokens se nombran por USO y en castellano', () => {
  const { claro } = paletas();

  it('ninguno se llama por su color', () => {
    // `--azul-3` no dice donde va, y el siguiente que lo necesite lo elegira a ojo.
    // `--azul` si: es el color de lo que se puede pulsar, y en tema oscuro vale otra cosa
    // sin que el nombre mienta.
    const porColor = [...claro.keys()].filter((token) =>
      /^--(gris|verde|rojo|amarillo|naranja|celeste|blanco|negro)/.test(token),
    );

    expect(porColor).toEqual([]);
  });

  it('los que el AC3 nombra estan todos', () => {
    const exigidos = [
      '--tinta',
      '--tinta-2',
      '--fondo',
      '--superficie',
      '--linea',
      '--borde-campo',
      '--azul',
      '--acento',
      '--foco',
      '--ok-fondo',
      '--ok-tinta',
      '--atencion-fondo',
      '--atencion-tinta',
      '--mal-fondo',
      '--mal-tinta',
      '--info-fondo',
      '--info-tinta',
    ];

    expect(exigidos.filter((token) => !claro.has(token))).toEqual([]);
  });

  it('y no hay tildes ni enie en ningun nombre de token', () => {
    // La misma regla del repositorio, en el idioma del CSS: `--tamaño` obliga a escribirlo
    // con la enie en cada `var()`, y basta una que se teclee sin ella para que el valor
    // llegue vacio y la regla se caiga en silencio.
    const conTilde = [...claro.keys()].filter((token) => /[áéíóúñüÁÉÍÓÚÑÜ]/.test(token));

    expect(conTilde).toEqual([]);
  });
});
