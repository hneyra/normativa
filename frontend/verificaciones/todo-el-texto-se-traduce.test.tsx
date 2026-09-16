import { peldanoDe } from '@kamayuk/sesion';
import { TEXTOS_DEL_ARMAZON, type TextosDelArmazon } from '@kamayuk/shell';
import { ProveedorDeTema, TEXTOS_DE_LA_UI } from '@kamayuk/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Aplicacion } from '../src/aplicacion.tsx';
import { CATALOGO } from '../src/catalogo.ts';
import { AMBITOS } from '../src/datos/lecturas.ts';
import { CONSUMIDORES } from '../src/datos/publicacion.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO, IDIOMA_POR_OMISION } from '../src/i18n/i18n.ts';
import { TEXTOS_DEL_MARCO } from '../src/i18n/armazon.ts';
import { FRASES_DEL_INTERPRETE } from '../src/i18n/textosDelInterprete.ts';
import { FRASES_DEL_MARCO } from '../src/i18n/textosDelMarco.ts';
import { MandoDeTema } from '../src/preferencias/MandoDeTema.tsx';
import { AvisoDeLaPuerta } from '../src/puerta/AvisoDeLaPuerta.tsx';
import { artboardDeclarado } from './artboards.ts';

/**
 * **Ninguna cadena llega al DOM sin pasar por `t()`** (#60, AC 5).
 *
 * Calcado de `rentas/frontend/verificaciones/todo-el-texto-se-traduce.test.tsx@ac379ac`, con lo de
 * este sistema: cuatro destinos y no cuarenta, y **ninguna exencion heredada** — ver
 * {@link NO_ES_TEXTO}.
 *
 * <h2>Por que se MONTA y no se barren las fuentes</h2>
 *
 * Un escaner de fuentes contesta otra pregunta —«¿hay literales en el codigo?»— y contesta mal las
 * dos direcciones: da rojos sobre cadenas que nunca se dibujan (una clave de configuracion, un
 * `data-slot`) y **se calla sobre las que si**, porque no sabe cuales llegan a la pantalla.
 *
 * Montando, la pregunta es la de verdad: **lo que se ve**. Se cambia el idioma a uno que envuelve
 * todo lo que traduce entre `⟦` y `⟧`, se dibuja, y **lo que salga sin marcar es texto que se escapo
 * de `t()`**. No hay forma de que un literal se cuele y esto lo ignore: si se ve, se mide.
 *
 * <h2>Y por que se monta LA APLICACION ENTERA y no `<Pantalla>` suelta</h2>
 *
 * Porque este repositorio no dibuja el marco: lo dibuja `@kamayuk/shell`, y ahi viven treinta y dos
 * palabras que hasta #60 salian en castellano. Montar solo el cuerpo dejaria fuera la barra, el
 * carril, la cabecera y el pie — o sea, la mitad que sale en las cuatro hojas. La guarda de `rentas`
 * tuvo ese hueco desde `kamayuk-lib`#19 hasta `rentas`#133, **en verde**.
 *
 * <h2>Las cuatro cosas que se miden, y por que no basta con montar</h2>
 *
 * 1. **Los cuatro destinos**, cada uno abierto por su hash, con el marco alrededor.
 * 2. **La paleta de mando** y **el mando de preferencias**, que no son pantallas y no salen solos.
 * 3. **La puerta caida**, que sustituye a todo lo demas y por eso nadie la ve al recorrer destinos.
 * 4. **El inventario del saco del marco**: montar **no ve las treinta y dos** —ocho no se dibujan
 *    nunca, y otras cuantas solo salen en un estado que esta prueba no provoca—, asi que ademas se
 *    compara el saco contra lo que publica la libreria y se comprueba que **cada entrada pasa por
 *    `t()`**, llamando a las cuatro que llevan un dato dentro. Las tres juntas son las que hacen que
 *    quitar una entrada tenga que ponerse rojo nombrandola.
 */

/**
 * Lo que puede aparecer sin marcar sin que sea un defecto.
 *
 * **Cuatro separadores y nada mas, y aqui esta la diferencia con `rentas`**: la suya exime ademas
 * `'J. Cardenas Vega'` y `'JC'`, que son el nombre y las iniciales de la cuenta de su captura. Aqui
 * no hay ninguna cuenta escrita —G2 (#52) lo prohibe, y `src/sesion.ts` pone dos puntos medios que
 * no son las iniciales de nadie—, asi que esas dos exenciones no viajan: copiarlas seria dejar
 * abierta la puerta por la que volveria a entrar un nombre propio.
 *
 * Los cuatro que quedan son separadores que el propio artboard dibuja —la raya de un dato vacio, la
 * barra de la miga— y el circulo de la cuenta. Traducir una raya no significa nada.
 */
const NO_ES_TEXTO = new Set(['—', '/', '·', '··', ':']);

/**
 * Los atributos que LLEVAN TEXTO, que son los que nadie mira.
 *
 * Ocho de las treinta y dos palabras del armazon no se dibujan en ninguna parte: seis son nombres
 * accesibles —el boton del carril, el menu de sesion, la miga, el dialogo de la paleta, su lista y
 * la region viva de los avisos— y dos son marcadores de una caja de texto. Un recorrido de nodos de
 * texto no ve ni una, asi que una guarda que solo mirase el texto dibujado diria que el marco esta
 * entero **teniendo ocho cadenas en el idioma equivocado**. Es como llegaron en ingles
 * `Notifications alt+T` de `sonner` y `Suggestions` de `cmdk`, sin que nadie lo notara.
 *
 * Solo estos cuatro, y no todos: `class`, `id`, `href` o un `data-slot` no son frases, y meterlos
 * convertiria la guarda en un ruido que alguien acabaria apagando.
 */
const ATRIBUTOS_CON_TEXTO = ['aria-label', 'placeholder', 'title', 'alt'] as const;

/** Todo el texto visible del documento, trozo a trozo. */
function textoSuelto(raiz: HTMLElement): readonly string[] {
  const paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const trozos: string[] = [];
  let nodo = paseo.nextNode();
  while (nodo !== null) {
    const texto = (nodo.textContent ?? '').trim();
    if (texto !== '') trozos.push(texto);
    nodo = paseo.nextNode();
  }
  return trozos;
}

/** Lo que dicen esos atributos en todo el arbol, uno a uno. */
function textoDeLosAtributos(raiz: HTMLElement): readonly string[] {
  const salida: string[] = [];
  for (const elemento of raiz.querySelectorAll('*')) {
    for (const atributo of ATRIBUTOS_CON_TEXTO) {
      const valor = elemento.getAttribute(atributo)?.trim() ?? '';
      if (valor !== '') salida.push(valor);
    }
  }
  return salida;
}

/**
 * Lo que se escapo: trozos con contenido que no van envueltos.
 *
 * `tambienDato` es para lo que NO lo dice este sistema —lo que contesta el emisor de identidad, o el
 * backend el dia que conteste—. No tiene valor por omision a proposito: una pantalla de este
 * repositorio dibuja lo que sale de sus definiciones, asi que ahi no hay nada que eximir, y un valor
 * por omision invitaria a eximir de mas.
 */
function sinTraducir(
  raiz: HTMLElement,
  tambienDato: ReadonlySet<string> = new Set(),
): readonly string[] {
  return [...textoSuelto(raiz), ...textoDeLosAtributos(raiz)].filter(
    (trozo) => !trozo.startsWith(ABRE) && !NO_ES_TEXTO.has(trozo) && !tambienDato.has(trozo),
  );
}

const DESTINOS = CATALOGO.flatMap((modulo) => modulo.destinos.map((destino) => destino.slug ?? destino.clave));

/**
 * **Lo que dice la ESCALERA, y por que se exime** (#63).
 *
 * Desde #63 el Panel pide de verdad, asi que montarlo dibuja el estado de sus dos lecturas. Aqui no
 * hay backend: las dos fallan, y lo que sale es el peldano que `peldanoDe()` de `@kamayuk/sesion`
 * resuelve — titulo, detalle y remedio.
 *
 * **Y ese texto no pasa por `t()` a proposito**, que es la parte que hay que decir para que la
 * exencion no parezca un atajo: el peldano llega **ya en el idioma de la sesion**, del saco de
 * `@kamayuk/sesion`, y el AC 4 de #63 prohibe expresamente una traduccion paralela en `normativa`
 * —«Todo sale de `peldanoDe()`, sin una traduccion paralela»—. Traducirlo aqui seria tener dos
 * verdades sobre la misma frase. Es la misma clase de exencion que ya tenia lo que contesta el
 * emisor de identidad en la puerta caida, un poco mas abajo.
 *
 * Se computa llamando a `peldanoDe` y **no copiando sus frases**: una que la libreria reescriba
 * entra sola, y esta guarda no se queda vieja afirmando la de ayer.
 */
const NO_CONTESTO = new TypeError('el arnes no deja salir ninguna peticion');

function loQueDiceLaEscalera(): ReadonlySet<string> {
  const peldano = peldanoDe(NO_CONTESTO);
  return new Set([peldano.titulo, peldano.detalle, peldano.remedio]);
}

/**
 * **Los IDENTIFICADORES que Publicacion dibuja, y por que no se traducen** (#67).
 *
 * La tabla «Quien se lo lleva» pinta dos cosas que no son frases:
 *
 * · **el nombre de un sistema** —`rentas`, `catastro`—, que es el mismo en todos los idiomas: es
 *   como se llama un repositorio, un `PathPrefix` de Traefik y un espacio de nombres. Traducirlo
 *   seria renombrar un sistema en una celda;
 * · **el ambito** —`VALUACION`, `OBLIGACION`—, que son los dos valores de un enumerado del backend
 *   y viajan tal cual en `?ambito=`. El controlador **no los lee en minusculas**
 *   (`SnapshotController.java:149-151`), asi que la celda tiene que decir exactamente lo que hay que
 *   escribir en la consulta.
 *
 * Y no se escriben aqui a mano: salen **del mismo dato que la hoja dibuja**, asi que un consumidor
 * nuevo o un tercer ambito entran por su cuenta y esta exencion no se queda vieja eximiendo lo que
 * ya no existe. Lo que la exencion NO cubre es el resto de esa tabla —«Una vez por emision», «Dice
 * cuanto vale un predio»—, que si son frases y si pasan por `t()`.
 */
function losIdentificadores(): ReadonlySet<string> {
  return new Set([
    ...AMBITOS,
    ...CONSUMIDORES.map((consumidor) => consumidor.sistema),
  ]);
}

beforeAll(async () => {
  // Lo que jsdom no trae y las piezas del armazon piden. Sus motivos, en `@kamayuk/shell`.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  // `cmdk` observa el tamano de su lista y jsdom no trae el observador: sin esto la paleta revienta
  // con «ResizeObserver is not defined» y el rojo habla de jsdom, no de traducciones.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.matchMedia ??= ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof matchMedia;

  // Ninguna peticion sale de aqui, y la que se intente falla IGUAL SIEMPRE. Sin esto, las dos
  // lecturas del Panel corren contra `fetch` de Node y la pantalla se mide unas veces «pidiendo» y
  // otras «fallo»: una guarda que depende de quien gane la carrera no dice nada de la pantalla.
  globalThis.fetch = (() => Promise.reject(NO_CONTESTO)) as typeof fetch;

  await i18n.changeLanguage(IDIOMA_MARCADO);
});

afterAll(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-tema');
  document.documentElement.removeAttribute('data-modo');
  window.location.hash = '';
});

/**
 * Monta la aplicacion con el hash ya puesto, y espera a que el marco este dibujado **y a que
 * ninguna lectura siga en vuelo**.
 *
 * La segunda espera es de #63: con una lectura «pidiendo» la pantalla ensena barras, no el estado
 * que haya de salir. Medir ahi daria verde sin haber mirado lo que la hoja dice cuando contesta —y
 * daria verde o rojo segun la maquina, que es peor.
 */
async function abrir(slug: string): Promise<void> {
  window.location.hash = `#/${slug}`;
  render(<Aplicacion />);
  await waitFor(() => {
    expect(document.querySelector('[data-slot="barra-global"], header, nav')).not.toBeNull();
    expect(document.querySelector('[data-estado-de-la-lectura="pidiendo"]')).toBeNull();
  });
}

describe('ninguna cadena llega al DOM sin pasar por `t()`', () => {
  it('EL CENTINELA: el idioma marcado MARCA de verdad, y hay cuatro destinos que recorrer', () => {
    // 1) Sin la primera mitad, un post-procesador que dejara de envolver haria que todo lo de abajo
    //    pasara en verde: nada estaria marcado y nada se consideraria escapado. La guarda se
    //    quedaria sin sujeto siendo su propio arnes lo que falla.
    expect(i18n.language).toBe(IDIOMA_MARCADO);
    expect(i18n.t('Una frase cualquiera')).toBe(`${ABRE}Una frase cualquiera${CIERRA}`);

    // 2) Y sin la segunda, un catalogo vacio dejaria el `it.each` sin casos y este archivo en verde
    //    habiendo recorrido cero pantallas. Es como `rentas` se quedo sin guarda dos veces (#78,
    //    #80). La cuenta sale de `artboards.ts`, que es donde vive lo que el artboard V8 declara.
    const cuentas = artboardDeclarado('NormativaV8.dc.html').cuentas;
    expect(cuentas, '`artboards.ts` no declara las cuentas del artboard').toBeDefined();
    expect(DESTINOS).toHaveLength(cuentas?.hojas ?? 0);
  });

  it.each(DESTINOS)('«%s» no ensena una sola cadena sin traducir, marco incluido', async (slug) => {
    await abrir(slug);
    const escapadas = sinTraducir(
      document.body,
      new Set([...loQueDiceLaEscalera(), ...losIdentificadores()]),
    );
    expect(
      escapadas,
      `«${slug}» dibuja texto que no paso por «t()»:\n` +
        `${escapadas.map((e) => `  «${e}»`).join('\n')}\n\n` +
        '  Ese texto no se puede traducir nunca, y nadie lo ve hasta que alguien pide un segundo\n' +
        '  idioma y aparece una pantalla a medias.\n' +
        '  Si son palabras del marco, van en `src/i18n/textosDelMarco.ts`; si son de una hoja,\n' +
        '  salen de su definicion y las traduce `src/pantallas/index.ts`.',
    ).toEqual([]);
  });

  it('y la PALETA tampoco, que es donde viven cuatro que no se ven de otro modo', async () => {
    await abrir('panel');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    const escapadas = sinTraducir(document.body, loQueDiceLaEscalera());
    expect(
      escapadas,
      'La paleta de mando dibuja texto que no paso por «t()»:\n' +
        `${escapadas.map((e) => `  «${e}»`).join('\n')}`,
    ).toEqual([]);
  });

  /**
   * **El mando de preferencias tambien.**
   *
   * Es la unica pieza que este repositorio dibuja fuera del interprete **y fuera del marco**, asi
   * que es la unica que el recorrido de los cuatro destinos no puede ver: no es una pantalla y no
   * esta en el catalogo. Sus once cadenas —los rotulos de los dos ejes, las cuatro identidades, los
   * tres modos y las dos notas— llegarian al DOM sin que nadie mirase.
   *
   * Se lee de `document.body` y no del contenedor porque el cajon sale en un portal: lo que se
   * dibuja no cuelga de lo que `render` devuelve.
   */
  it('y el mando de preferencias, que no es una pantalla y por eso se le olvida a todo el mundo', () => {
    render(
      <ProveedorDeTema
        configuracion={{ identidadPorOmision: 'institucional', prefijoDeClaves: 'kamayuk.prueba' }}
      >
        <MandoDeTema abierto alCerrar={() => undefined} />
      </ProveedorDeTema>,
    );
    const escapadas = sinTraducir(document.body);
    expect(
      escapadas,
      'El mando de preferencias dibuja texto que no paso por «t()»:\n' +
        `${escapadas.map((e) => `  «${e}»`).join('\n')}`,
    ).toEqual([]);
  });

  /**
   * **Y la puerta caida, que es la pantalla que sustituye a todas las demas.**
   *
   * No sale recorriendo destinos: solo se dibuja cuando no se pudo entrar, y entonces tapa la
   * aplicacion entera. Si sus frases no pasaran por `t()`, lo unico que se veria en un segundo
   * idioma seria una pantalla entera sin traducir — y justo la que se lee cuando algo ya ha fallado.
   *
   * Lo que el EMISOR dice —`error` y `error_description` de la vuelta— va en `tambienDato`: no es
   * texto de este sistema y traducirlo seria falso. Ver `src/puerta/AvisoDeLaPuerta.tsx`.
   */
  it('y la PUERTA CAIDA, en sus dos casos', () => {
    const { container: noContesto } = render(
      <AvisoDeLaPuerta
        porQue={{
          tipo: 'no-contesto',
          falla: {
            emisor: 'https://identidad.example/realms/kamayuk',
            url: 'https://identidad.example/realms/kamayuk/.well-known/openid-configuration',
            motivo: 'Failed to fetch',
          },
        }}
      />,
    );
    const delEmisor = new Set([
      'https://identidad.example/realms/kamayuk',
      'https://identidad.example/realms/kamayuk/.well-known/openid-configuration',
      'Failed to fetch',
    ]);
    expect(sinTraducir(noContesto, delEmisor), 'la puerta que no contesto').toEqual([]);

    cleanup();

    const { container: noDejo } = render(
      <AvisoDeLaPuerta
        porQue={{
          tipo: 'no-dejo-entrar',
          motivo: 'El emisor rechazo la peticion',
          detalle: 'invalid_request: Invalid parameter: redirect_uri',
        }}
      />,
    );
    expect(
      sinTraducir(noDejo, new Set(['invalid_request: Invalid parameter: redirect_uri'])),
      'la puerta que no dejo entrar',
    ).toEqual([]);
  });

  it('y el CENTINELA de la otra direccion: con el idioma normal NO hay marcas', async () => {
    // Sin esta mitad, todo lo de arriba pasaria igual con un post-procesador que envolviera SIEMPRE
    // —incluso en castellano—, y estariamos comprobando que el arnes funciona, no que la pantalla
    // traduce.
    await i18n.changeLanguage(IDIOMA_POR_OMISION);
    await abrir('panel');
    expect(screen.queryByText(new RegExp(ABRE))).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Estado del ejercicio' })).toBeTruthy();
    await i18n.changeLanguage(IDIOMA_MARCADO);
  });
});

/** Con que se llaman las cuatro entradas del saco que llevan un dato dentro. */
const MUESTRAS: Readonly<Record<string, readonly unknown[]>> = {
  avisosSinLeer: [3],
  nadaCasaEnElArbol: ['arancel'],
  cuantosDestinos: [1, 4],
  hayCambiosSinGuardar: ['Ediciones'],
};

/** El saco, entrada a entrada, convertido a la cadena que el marco dibujaria. */
function loQueDiceElSaco(saco: TextosDelArmazon): ReadonlyMap<string, string> {
  const dicho = new Map<string, string>();
  for (const [clave, valor] of Object.entries(saco) as readonly (readonly [string, unknown])[]) {
    if (typeof valor === 'string') {
      dicho.set(clave, valor);
      continue;
    }
    const muestra = MUESTRAS[clave];
    if (typeof valor !== 'function' || muestra === undefined) {
      throw new Error(
        `«${clave}» no es una cadena y no tiene muestra con que llamarla.\n` +
          '  Anadela a MUESTRAS: una entrada del saco que esta prueba no sabe invocar es una\n' +
          '  entrada que no se esta midiendo.',
      );
    }
    dicho.set(clave, String((valor as (...datos: readonly unknown[]) => unknown)(...muestra)));
  }
  return dicho;
}

describe('y el INVENTARIO del marco: las treinta y dos palabras del armazon', () => {
  it('el saco trae las MISMAS llaves que publica la libreria', () => {
    // Es la mitad que no se ve montando: ocho de las treinta y dos no se dibujan en ninguna parte.
    // Quitar una del saco tiene que ponerse rojo NOMBRANDOLA, y aqui es donde pasa.
    const faltan = Object.keys(TEXTOS_DEL_ARMAZON).filter((c) => !(c in TEXTOS_DEL_MARCO));
    const sobran = Object.keys(TEXTOS_DEL_MARCO).filter((c) => !(c in TEXTOS_DEL_ARMAZON));

    expect(
      { faltan, sobran },
      'El saco de textos del marco dejo de cuadrar con el de «@kamayuk/shell».\n' +
        '  Lo que falta lo dibuja el armazon con su castellano por omision, y nadie lo ve hasta\n' +
        '  que alguien pide un segundo idioma y aparece media pantalla sin traducir.\n' +
        '  Se arregla en `src/i18n/textosDelMarco.ts`.',
    ).toEqual({ faltan: [], sobran: [] });
    expect(Object.keys(TEXTOS_DEL_MARCO)).toHaveLength(32);
  });

  it('y NINGUNA de las treinta y dos llega sin pasar por `t()`, ni las que no se dibujan', () => {
    const escapadas = [...loQueDiceElSaco(TEXTOS_DEL_MARCO)]
      .filter(([, dice]) => !dice.startsWith(ABRE))
      .map(([clave, dice]) => `  «${clave}» dice «${dice}»`);

    expect(
      escapadas,
      'Hay entradas del saco del marco escritas como literal en vez de pasar por «t()»:\n' +
        `${escapadas.join('\n')}\n\n` +
        '  Pasarlas por el saco y no traducirlas es el mismo defecto con un rodeo mas.',
    ).toEqual([]);
  });

  it('y las de `@kamayuk/ui` estan todas colocadas: ninguna se dibuja por omision', () => {
    // Tres de las seis viajan DENTRO del saco del armazon —la miga, la region de avisos y la lista
    // de la paleta—, la marca de opcional entra por el saco del interprete
    // (`src/i18n/textosDelInterprete.ts`), y las dos que envuelven una fecha son de `Importe` y
    // `FechaDeCalculo`, que este repositorio todavia no monta. Esta prueba caduca sola el dia que
    // alguna se monte: entonces se pone roja y dice cual.
    expect(FRASES_DEL_MARCO.ruta).toBe(TEXTOS_DE_LA_UI.ruta);
    expect(FRASES_DEL_MARCO.avisos).toBe(TEXTOS_DE_LA_UI.avisos);
    expect(FRASES_DEL_MARCO.sugerenciasDeLaPaleta).toBe(TEXTOS_DE_LA_UI.sugerencias);
    expect(FRASES_DEL_INTERPRETE.opcional).toBe(TEXTOS_DE_LA_UI.opcional);
  });
});
