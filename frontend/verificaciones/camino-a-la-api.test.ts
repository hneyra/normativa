// @vitest-environment node
//
// Lee JSON y fuentes del disco. No es un DOM lo que necesita, y bajo jsdom `fileURLToPath` revienta.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EJERCICIO_DE_TRABAJO } from '../src/datos/ejercicio.ts';
import {
  AMBITOS,
  CAMPOS_DEL_CONJUNTO,
  CAMPOS_DEL_CONJUNTO_VIGENTE,
  CAMPOS_DEL_ESTADO,
  CAMPOS_DEL_PAGINADO,
  CAMPOS_DEL_SNAPSHOT,
  CLAVE_DEL_ESTADO,
  CLAVE_DE_LAS_LISTAS,
  CLAVE_DE_LAS_VERSIONES,
  CLAVE_DE_LA_PUBLICACION,
  CLAVE_DE_LOS_CONSUMIDORES,
  CONJUNTO_VIGENTE,
  DATO_DEL_IMPEDIMENTO,
  DATO_DEL_TONO,
  DIRECCION_DEL_LISTADO,
  OPERACION_DE_GUARDAR,
  ESTADO_DEL_EJERCICIO,
  LISTADO_DE_CONJUNTOS,
  ORDEN_DEL_LISTADO,
  PETICIONES,
  SNAPSHOT_POR_AMBITO,
  TAMANO_DEL_LISTADO,
  rutaDe,
} from '../src/datos/lecturas.ts';
import { YA_SERVIDAS } from '../src/datos/servidas.ts';
import { ARBOL } from '../src/pantallas/arbol.ts';
import { PANTALLAS } from '../src/pantallas/definiciones/index.ts';

/**
 * **El camino a la API: lo que esta interfaz pide contra lo que el backend PUBLICA** (#63, AC 3).
 *
 * <h2>La diferencia buscada con `rentas`, y por que importa</h2>
 *
 * La de `rentas` mide contra `docs/50-api/formas-de-la-api.json`; **esta mide contra los DOS**
 * —aquel y `parametros-de-la-api.json`—, que es lo que #49 publica. Y la diferencia con la V6 es
 * mayor todavia: `c01fe9a:src/datos/formas.test.ts:323-358` exigia que ese archivo **no existiera**
 * y que no hubiera ni un `@PostMapping`. O sea que la interfaz estaba atada al backend **por la
 * negativa**, y con el filtro `frontend/**` de la CI un PR de backend que publicara una forma nueva
 * no ponia rojo a nadie.
 *
 * Ahora el sentido es el correcto: **el backend regenera los dos JSON en su PR**, el PR de frontend
 * lo ve en el diff, y `frontend.yml` ya dispara con `docs/50-api/**` y con `backend/**` (lo dejo
 * puesto el AC 5 de #55). Un cambio de forma sale rojo aqui, nombrando la operacion y el campo, sin
 * que nadie levante nada.
 *
 * <h2>Las seis cosas que se miden</h2>
 *
 * <table>
 *   <tr><td>1</td><td>toda operacion que `src/datos/**` compone es **clave del contrato, con su
 *     verbo**</td></tr>
 *   <tr><td>2</td><td>todo parametro que compone esta declarado para ESA operacion, o es del
 *     dialecto de la paginacion. Lo que sobre sale rojo **nombrando el nombre**, que es el 422 que
 *     el backend daria</td></tr>
 *   <tr><td>3</td><td>todo tipo de respuesta se contrasta **campo a campo** con su forma
 *     publicada</td></tr>
 *   <tr><td>4</td><td>el `ordenarPor` que se ofrece esta en la lista blanca publicada, y el `tamano`
 *     no pasa del tope</td></tr>
 *   <tr><td>5</td><td>las rutas del arbol y los accesos que el JAVA exige: lo que hace que «un 403
 *     del listado no tumba el Panel» sea una propiedad medida y no una suposicion</td></tr>
 *   <tr><td>6</td><td>una forma publicada **como `texto` a secas no cuenta como contrastada**</td></tr>
 * </table>
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const RAIZ = join(FRONTEND, '..');
const FORMAS = join(RAIZ, 'docs/50-api/formas-de-la-api.json');
const PARAMETROS = join(RAIZ, 'docs/50-api/parametros-de-la-api.json');

/** Los cuatro nombres que TODA operacion admite: `GuardiaDeParametros.DIALECTO_DE_LA_PAGINACION`. */
const DIALECTO_DE_LA_PAGINACION = ['pagina', 'tamano', 'ordenarPor', 'direccion'];

/** La clave `_` de los dos JSON es la nota del generador, no una operacion. */
const NOTA = '_';

type Formas = Record<string, unknown>;
type Parametros = Record<string, Record<string, unknown>>;

/**
 * Los dos JSON, leidos **dentro de cada caso** y no en el cuerpo del modulo.
 *
 * Es la leccion de `rentas`#78, y aqui vale doble: los produce el BACKEND, asi que pueden faltar en
 * un arbol recien clonado. Leidos arriba, su ausencia mataria la recoleccion y esta guarda saldria
 * como «Failed Suites» sin una sola prueba — callada justo cuando hay que mirarla.
 */
function formas(): Formas {
  return JSON.parse(readFileSync(FORMAS, 'utf8')) as Formas;
}
function parametros(): Parametros {
  return JSON.parse(readFileSync(PARAMETROS, 'utf8')) as Parametros;
}

/** Las operaciones que el contrato publica, sin la nota del generador. */
function operacionesDelContrato(): readonly string[] {
  return Object.keys(formas()).filter((clave) => clave !== NOTA);
}

/** Lo que una operacion admite pedir: lo suyo mas el dialecto. */
function admitidos(operacion: string): readonly string[] {
  const suyos = parametros()[operacion] ?? {};
  const lista = (clave: string): readonly string[] =>
    Array.isArray(suyos[clave]) ? (suyos[clave] as readonly string[]) : [];
  return [
    ...DIALECTO_DE_LA_PAGINACION,
    ...lista('obligatorios'),
    ...lista('opcionales'),
    ...lista('condicionales'),
    ...lista('algunoDeEstos').flat(),
  ];
}

/* ── 1 y 6 — las operaciones existen, y su forma es una FORMA ──────────────────────────────── */

describe('AC 3 — lo que se pide es una operacion del contrato', () => {
  it('EL CENTINELA: los dos JSON estan, y publican las SEIS operaciones de hoy', () => {
    // Sin esto, un archivo vacio o con solo la nota dejaria todo lo de abajo pasando sobre el
    // conjunto vacio: cero operaciones comparadas, en verde.
    //
    // **SEIS desde #56, y no las cuatro que #49 midio**: se anaden `GET /conjuntos/{id}/parametros`
    // —el contenido de un conjunto, ABIERTO o sellado— y `GET /parametros` —los publicados que se
    // le pueden agregar—, las filas 4 y 5 de ADR-0043 §1. La hoja de Ediciones (#65) las lee; esta
    // lista sube con el backend, no con la hoja.
    const publicadas = [...operacionesDelContrato()].sort();
    expect(publicadas).toEqual([
      'GET /conjuntos',
      'GET /conjuntos/{id}/parametros',
      'GET /conjuntos/{id}/snapshot',
      'GET /parametros',
      'GET /seguridad/parametros',
      'GET /seguridad/parametros/ejercicios/{ejercicio}',
    ]);
    expect(Object.keys(parametros()).filter((c) => c !== NOTA).sort()).toEqual(publicadas);
    // Y que `src/datos/**` pida algo: con `PETICIONES` vacia no habria nada que contrastar.
    //
    // **CINCO desde #67, y no cuatro**: las dos del Panel, la del conjunto vigente y el snapshot
    // **una vez por ambito**. El snapshot se declara dos veces a proposito —el ambito decide que
    // cuadros vienen dentro y con ellos la huella—, asi que la cuenta no es el numero de
    // operaciones publicadas sino el de peticiones que este sistema compone.
    expect(PETICIONES.length, '`PETICIONES` esta vacia: esta guarda se quedaria sin sujeto').toBe(
      2 + 1 + AMBITOS.length,
    );
  });

  it.each(PETICIONES.map((p) => p.operacion))('«%s» es una operacion del contrato', (operacion) => {
    expect(
      operacionesDelContrato(),
      `«${operacion}» no la publica el backend.\n` +
        '  Se compone en `src/datos/lecturas.ts` y no es clave de `docs/50-api/formas-de-la-api.json`.\n' +
        '  Ese archivo lo genera `FormasDeLaApiTest` del tipo de retorno de cada controlador: si la\n' +
        '  operacion existe de verdad, hay que regenerarlo en el PR del backend.',
    ).toContain(operacion);
  });

  it('y su forma publicada es un OBJETO: «texto» a secas no cuenta como contrastada', () => {
    // El caso que lo justifica esta medido: `GET /conjuntos/{id}/snapshot` lo sirve un
    // `ResponseEntity<String>` (`SnapshotController.java:120`), y un generador que mire el tipo de
    // retorno no ve ningun `record` ahi dentro. Hoy #49 lo publica entero porque el controlador lo
    // declara en `RespuestasEscritasAMano`; el dia que una operacion vuelva a salir como `"texto"`
    // —o como `"objeto"`, que es lo que le paso a la matriz de permisos de `rentas`— la
    // comparacion campo a campo de mas abajo no tendria campos que comparar y pasaria en verde
    // sobre la nada. Esto lo dice antes, y NOMBRA la operacion.
    const escalares = Object.entries(formas())
      .filter(([clave]) => clave !== NOTA)
      .filter(([, forma]) => typeof forma !== 'object' || forma === null)
      .map(([clave, forma]) => `  «${clave}» se publica como «${String(forma)}»`);

    expect(
      escalares,
      'Hay operaciones cuya forma publicada es un escalar y no una forma:\n' +
        `${escalares.join('\n')}\n\n` +
        '  Una forma asi no se puede contrastar campo a campo: no tiene campos. Si la interfaz la\n' +
        '  lee, lo que la sostiene no es el contrato — y hay que decirlo en #49, no darlo por bueno.',
    ).toEqual([]);
  });
});

/* ── 2 y 4 — los parametros que se componen ────────────────────────────────────────────────── */

describe('AC 3 — todo parametro que se compone lo admite esa operacion', () => {
  it.each(PETICIONES.map((p) => [p.operacion, p] as const))(
    '«%s» no compone ni un parametro de mas',
    (operacion, peticion) => {
      const puede = new Set(admitidos(operacion));
      const sobran = Object.keys(peticion.parametros).filter((nombre) => !puede.has(nombre));

      expect(
        sobran,
        `«${operacion}» compone parametros que esa operacion NO declara: ${sobran.join(', ')}\n` +
          `  Se admiten: ${[...puede].sort().join(', ')}\n\n` +
          '  `GuardiaDeParametros` contesta **422 VALIDACION «Parametro desconocido»** a todo\n' +
          '  nombre que la firma del controlador no lea, salvo los cuatro de la paginacion. Esto es\n' +
          '  ese 422, dicho sin levantar nada.',
      ).toEqual([]);
    },
  );

  it('y los obligatorios de cada una se mandan: no se pide sin lo que la operacion exige', () => {
    const faltan = PETICIONES.flatMap((peticion) => {
      const suyos = parametros()[peticion.operacion] ?? {};
      const obligatorios = Array.isArray(suyos['obligatorios'])
        ? (suyos['obligatorios'] as readonly string[])
        : [];
      return obligatorios
        .filter((nombre) => !(nombre in peticion.parametros))
        .map((nombre) => `  «${peticion.operacion}» no manda «${nombre}», que es obligatorio`);
    });

    expect(faltan, `Faltan parametros obligatorios:\n${faltan.join('\n')}`).toEqual([]);
  });

  it('el `ordenarPor` del listado esta en la lista blanca que publica el contrato', () => {
    // La lista blanca es `OrdenSeguro.sobre("ejercicio", "version", "estado", "id")` del
    // repositorio, y #49 la publica como `ordenarPorAdmitidos`. Otro campo es un 422
    // `ORDEN_NO_ADMITIDO`, que la escalera de hoy no distingue del otro 422 — razon de mas para que
    // no llegue a salir al cable.
    const suyos = parametros()['GET /seguridad/parametros'] ?? {};
    const admite = suyos['ordenarPorAdmitidos'];

    expect(Array.isArray(admite), 'el contrato no publica `ordenarPorAdmitidos` para el listado').toBe(
      true,
    );
    expect(admite as readonly string[]).toContain(ORDEN_DEL_LISTADO);
    expect(LISTADO_DE_CONJUNTOS.parametros['ordenarPor']).toBe(ORDEN_DEL_LISTADO);
  });

  it('y el `tamano` no pasa del tope que publica el contrato', () => {
    const suyos = parametros()['GET /seguridad/parametros'] ?? {};
    const tope = suyos['tamanoMaximo'];

    expect(typeof tope, 'el contrato no publica `tamanoMaximo` para el listado').toBe('number');
    expect(TAMANO_DEL_LISTADO).toBeLessThanOrEqual(tope as number);
    expect(LISTADO_DE_CONJUNTOS.parametros['tamano']).toBe(String(TAMANO_DEL_LISTADO));
  });

  it('la ruta compuesta lleva sus parametros y ningun `{sujeto}` sin sustituir', () => {
    // Un `{ejercicio}` que llegara al cable seria un 404 de ruta, indistinguible de los 404 de
    // negocio. `rutaDe` revienta antes; esto lo comprueba sobre lo que de verdad se compone.
    expect(rutaDe(LISTADO_DE_CONJUNTOS)).toBe(
      `/seguridad/parametros?ordenarPor=${ORDEN_DEL_LISTADO}&direccion=${DIRECCION_DEL_LISTADO}` +
        `&tamano=${String(TAMANO_DEL_LISTADO)}`,
    );
    expect(rutaDe(ESTADO_DEL_EJERCICIO, { ejercicio: '2026' })).toBe(
      '/seguridad/parametros/ejercicios/2026',
    );
    expect(() => rutaDe(ESTADO_DEL_EJERCICIO)).toThrow(/ejercicio/);
  });

  it('las de Publicacion componen el ejercicio DEL RELOJ y el ambito EN MAYUSCULAS (#67)', () => {
    // Las dos mitades importan:
    //
    // · el ejercicio sale de `EJERCICIO_DE_TRABAJO` y no de un literal. Un literal sigue pareciendo
    //   correcto el 1 de enero siguiente, y la hoja pregunta por el ejercicio equivocado sin que
    //   nada lo diga (es la leccion de `src/datos/ejercicio.ts`);
    // · el ambito viaja tal cual, en mayusculas. El backend **no lee en minusculas**
    //   (`SnapshotController.java:149-151`) y lo rechaza nombrandolo — que es lo correcto: aceptarlo
    //   devolveria un snapshot con otra huella que el cliente creeria correcto.
    expect(rutaDe(CONJUNTO_VIGENTE)).toBe(`/conjuntos?ejercicio=${String(EJERCICIO_DE_TRABAJO)}`);

    for (const ambito of AMBITOS) {
      expect(ambito, `«${ambito}» no esta en mayusculas`).toBe(ambito.toUpperCase());
      expect(rutaDe(SNAPSHOT_POR_AMBITO[ambito], { id: '2' })).toBe(
        `/conjuntos/2/snapshot?ambito=${ambito}`,
      );
    }
    // Y sin el sujeto revienta AQUI, no en el cable: `/conjuntos/{id}/snapshot` pedido literal
    // seria un 404 de ruta indistinguible de los 404 de negocio.
    expect(() => rutaDe(SNAPSHOT_POR_AMBITO.VALUACION)).toThrow(/id/);
  });
});

/* ── 3 — las respuestas, campo a campo ─────────────────────────────────────────────────────── */

describe('AC 3 — lo que la interfaz LEE es lo que el backend publica, campo a campo', () => {
  it('`GET /seguridad/parametros` publica la pagina, y el envoltorio es el que se lee', () => {
    const forma = formas()['GET /seguridad/parametros'] as Record<string, unknown>;

    expect(Object.keys(forma).sort(), 'el envoltorio paginado').toEqual(
      Object.keys(CAMPOS_DEL_PAGINADO).sort(),
    );
    // `totalElementos` y `totalPaginas` son CUENTAS y no importes: llegan como entero, y la
    // prohibicion del importe declarado `number` no les aplica (el lookahead de `CAMPOS_DE_DINERO`).
    expect(forma['totalElementos']).toBe('entero');
    expect(forma['totalPaginas']).toBe('entero');
  });

  it('y su fila tiene EXACTAMENTE los seis campos que `ConjuntoResource` declara', () => {
    const forma = formas()['GET /seguridad/parametros'] as Record<string, unknown>;
    const fila = (forma['contenido'] as readonly unknown[])[0] as object;

    expect(
      Object.keys(fila).sort(),
      'La fila del listado dejo de cuadrar con `ConjuntoResource` de `src/datos/lecturas.ts`.\n' +
        '  Un campo que falta no da error: da `undefined`, y la celda sale vacia sin que nada lo\n' +
        '  diga. Es el sintoma mudo que esta guarda existe para convertir en rojo.',
    ).toEqual(Object.keys(CAMPOS_DEL_CONJUNTO).sort());
  });

  it('`GET /seguridad/parametros/ejercicios/{ejercicio}` publica los CUATRO que se leen', () => {
    const forma = formas()['GET /seguridad/parametros/ejercicios/{ejercicio}'] as object;

    expect(Object.keys(forma).sort()).toEqual(Object.keys(CAMPOS_DEL_ESTADO).sort());
  });

  it('y «sellado» es un BOOLEANO: «sin sellar» es una respuesta, no un 404', () => {
    // Es la mitad del AC 2 que se puede comprobar sin levantar nada. Si algun dia esta operacion
    // dejara de publicar `sellado` —o lo publicara como otra cosa—, el Panel estaria dibujando
    // «No» sobre un `undefined`, que es exactamente lo que un nulo no puede parecer.
    const forma = formas()['GET /seguridad/parametros/ejercicios/{ejercicio}'] as Record<
      string,
      unknown
    >;

    expect(forma['sellado']).toBe('booleano');
    expect(forma['conjuntoId']).toBe('entero');
    expect(forma['version']).toBe('entero');
  });

  it('`GET /conjuntos` publica los TRES campos de la identidad, y ni uno mas (#67)', () => {
    // La identidad no lleva ni una fila: es lo unico que hace falta para saber si el snapshot que
    // ya se tiene en cache sigue siendo el bueno. Un campo de mas aqui seria una fila viajando en
    // la respuesta que resuelve **cual** conjunto, que es lo que ADR-0025 §1 separa a proposito.
    const forma = formas()['GET /conjuntos'] as object;

    expect(Object.keys(forma).sort()).toEqual(Object.keys(CAMPOS_DEL_CONJUNTO_VIGENTE).sort());
  });

  it('`GET /conjuntos/{id}/snapshot` publica los NUEVE campos que la hoja lee (#67)', () => {
    // Y la huella **no esta entre ellos**: es de estos mismos bytes, asi que meterla dentro seria
    // pedirle a un valor que se contenga a si mismo. Viaja en el `ETag`, que es una cabecera y no
    // un campo — por eso esta hoja lee la respuesta con `solicitarRespuesta()`.
    const forma = formas()['GET /conjuntos/{id}/snapshot'] as Record<string, unknown>;

    expect(Object.keys(forma).sort()).toEqual(Object.keys(CAMPOS_DEL_SNAPSHOT).sort());
    expect(
      Object.keys(forma),
      'El cuerpo del snapshot publica un `sha256`. Si el backend lo metio dentro, la comprobacion\n' +
        '  de la huella deja de tener sentido: un valor no puede contener su propia huella.',
    ).not.toContain('sha256');
    // Y las cuatro listas son LISTAS: sobre un escalar, `filas.length` daria `undefined` y la
    // tabla «Que viene y que no» diria «0» sobre algo que no se conto.
    for (const lista of ['parametros', 'valoresUnitarios', 'depreciaciones', 'valoresReferenciales']) {
      expect(Array.isArray(forma[lista]), `«${lista}» no se publica como lista`).toBe(true);
    }
  });

  it('`fechaSellado` se publica como INSTANTE, y por eso se ensena tal cual', () => {
    // No es un detalle de tipos: es el AC 6. Un instante lo escribe el servidor en su texto ISO, y
    // pasarlo por `Date` lo moveria a la zona del puesto — el mismo sello leido con dos fechas
    // distintas en dos ventanillas. `ConjuntoResource.fechaSellado` es `string | null` aqui a
    // proposito.
    const forma = formas()['GET /seguridad/parametros'] as Record<string, unknown>;
    const fila = (forma['contenido'] as readonly unknown[])[0] as Record<string, unknown>;

    expect(fila['fechaSellado']).toBe('instante');
    expect(fila['usuarioSellado']).toBe('texto');
  });
});

/* ── 5 — el arbol, los accesos del Java y las claves de las lecturas ───────────────────────── */

/** Los controladores del backend, tal cual estan en el disco. */
function controladores(): readonly { readonly ruta: string; readonly texto: string }[] {
  const base = join(
    RAIZ,
    'backend/kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros/infraestructura/web',
  );
  return readdirSync(base)
    .filter((nombre) => nombre.endsWith('Controller.java'))
    .map((nombre) => ({ ruta: nombre, texto: readFileSync(join(base, nombre), 'utf8') }));
}

/** Lo que cada `@RequiereAcceso` del backend exige, con el `@GetMapping` de al lado. */
function accesosDelJava(): ReadonlyMap<string, string> {
  const salida = new Map<string, string>();
  for (const { texto } of controladores()) {
    const raiz = /@RequestMapping\(Api\.RAIZ \+ "([^"]*)"\)/.exec(texto)?.[1] ?? '';
    // `@GetMapping(...)` seguido de `@RequiereAcceso(acceso = ...)`, en cualquiera de los dos
    // ordenes en que se escriben.
    const bloques = texto.matchAll(
      /@(?:GetMapping|PostMapping|PutMapping)(?:\("([^"]*)"\))?\s*\n\s*@RequiereAcceso\(acceso = (?:"([^"]+)"|RequiereAcceso\.(\w+))/g,
    );
    for (const bloque of bloques) {
      const camino = `${raiz}${bloque[1] ?? ''}`;
      salida.set(camino === '' ? '/' : camino, bloque[2] ?? bloque[3] ?? '');
    }
  }
  return salida;
}

describe('AC 3 — el arbol, y lo que el Java exige para cada operacion', () => {
  it('EL CENTINELA: el Java se lee y declara sus accesos', () => {
    // Sin esto, un cambio de forma en los controladores —o un `readdir` que no encuentre nada—
    // dejaria el mapa vacio y las dos pruebas de abajo pasarian sobre la nada.
    const accesos = accesosDelJava();
    expect(
      [...accesos.keys()].sort(),
      'No se pudo leer ningun `@RequiereAcceso` de los controladores.',
    ).toEqual([
      // Las dos primeras las anade #56: `GET /conjuntos/{id}/parametros` —el contenido de un
      // conjunto, ABIERTO o sellado, que es lo que el snapshot se niega a servir— y
      // `GET /parametros` —los publicados que se le pueden agregar—, las filas 4 y 5 de ADR-0043
      // §1. Las sirve un controlador nuevo, `ContenidoDelConjuntoController.java`, y esta lista es
      // de rutas y no de archivos: si no se actualizara, el centinela diria que el Java no se
      // pudo leer cuando lo que paso es que publica dos operaciones mas.
      '/conjuntos',
      '/conjuntos/{id}/parametros',
      '/conjuntos/{id}/snapshot',
      '/parametros',
      '/seguridad/parametros',
      '/seguridad/parametros/ejercicios/{ejercicio}',
    ]);
  });

  it('el listado exige el acceso «parametros» y el estado del ejercicio NO', () => {
    // **Esto es el AC 2.** La hoja dibuja el fallo del listado ENCIMA del cuerpo y no en su sitio
    // precisamente porque son dos autorizaciones distintas: una cuenta sin `parametros` recibe 403
    // en el listado y 200 en el estado, y tiene que seguir viendo el estado. Si algun dia las dos
    // exigieran lo mismo, esa separacion dejaria de tener sentido — y esto lo diria.
    const accesos = accesosDelJava();

    expect(accesos.get('/seguridad/parametros')).toBe('parametros');
    expect(accesos.get('/seguridad/parametros/ejercicios/{ejercicio}')).toBe('SESION_PROPIA');
  });

  it('las rutas que el ARBOL declara son operaciones del contrato, con su verbo', () => {
    const publicadas = operacionesDelContrato();
    const huerfanas = ARBOL.flatMap((modulo) =>
      modulo.hojas.flatMap((hoja) =>
        hoja.operaciones
          .map((o) => `${o.verbo} ${o.ruta}`)
          .filter((clave) => !publicadas.includes(clave))
          .map((clave) => `  «${hoja.clave}» declara «${clave}», que el contrato no publica`),
      ),
    );

    expect(
      huerfanas,
      `Hay hojas que declaran operaciones que el backend no publica:\n${huerfanas.join('\n')}`,
    ).toEqual([]);
  });

  it('y el arbol de ESTE sistema no declara ningun `acceso`: lo unico que declara es la ruta', () => {
    // El AC 3 pide que «todo `acceso` de `src/pantallas/arbol.ts` exista como `@RequiereAcceso` o en
    // el catalogo de #53». **Medido: aqui no hay ninguno.** `Operacion` es `{verbo, ruta, nota}` y
    // el artboard V8 no declara accesos, asi que ese criterio no tiene sujeto en este arbol — lo que
    // se comprueba en su lugar es lo de arriba, ruta a ruta y contra el `@RequiereAcceso` del Java.
    //
    // Esta prueba caduca sola: el dia que una operacion del arbol gane un `acceso`, sale roja y
    // dice que hay que cruzarlo contra el catalogo que publique #53.
    const conAcceso = ARBOL.flatMap((modulo) =>
      modulo.hojas.flatMap((hoja) =>
        hoja.operaciones.filter((o) => 'acceso' in o).map((o) => `${hoja.clave}: ${o.ruta}`),
      ),
    );

    expect(conAcceso).toEqual([]);
  });

  it('las claves de las lecturas del Panel son las que su DEFINICION nombra', () => {
    // La otra mitad de la costura: `useDatosDeLaHoja` publica los estados por nombre y la
    // definicion los busca por nombre. Una clave mal escrita **no da error**: el interprete dibuja
    // «lectura sin estado» —visible, eso si— y la tabla se queda sin filas. Esto lo dice antes.
    const bloque = PANTALLAS['nor-panel'].bloques[0];

    expect(bloque?.lectura?.clave).toBe(CLAVE_DEL_ESTADO);
    expect(bloque?.fallosDe).toEqual([CLAVE_DE_LAS_VERSIONES]);
    expect(bloque?.tabla?.clave).toBe(CLAVE_DE_LAS_VERSIONES);
  });

  it('y las de Publicacion tambien: su definicion escribe las claves A MANO (#67)', () => {
    // Esa definicion **no importa `src/datos/`** a proposito —arrastraria `src/sesion.ts`, que lee
    // `window` al cargarse, y las guardas que la leen corren sin DOM—, asi que las claves se
    // escriben como literales en los dos lados. Esto es lo que impide que se separen: una clave mal
    // escrita no da error, da una tabla sin filas y un aviso de «lectura sin estado».
    const bloques = PANTALLAS['nor-publicacion'].bloques;

    expect(
      bloques.filter((bloque) => bloque.lectura?.clave === CLAVE_DE_LA_PUBLICACION),
      'Ningun bloque de Publicacion nombra su lectura: la hoja pediria y no dibujaria su estado.',
    ).toHaveLength(3);
    expect(bloques[1]?.tabla?.clave).toBe(CLAVE_DE_LAS_LISTAS);
    expect(bloques[4]?.tabla?.clave).toBe(CLAVE_DE_LOS_CONSUMIDORES);

    // La accion que guarda: su clave tiene que ser la que `src/pantallas/index.ts` registra en
    // `alHacer`, y el dato de su impedimento el que el conector escribe. Sin lo primero el boton
    // sale impedido con «nadie atiende esto»; sin lo segundo, pulsable sin nada que guardar.
    const guardar = bloques[1]?.acciones?.[0];
    expect(guardar?.hace).toBe(OPERACION_DE_GUARDAR);
    expect(guardar?.impedida?.[0]?.si).toEqual({ dato: DATO_DEL_IMPEDIMENTO, hay: true });
    expect(guardar?.impedida?.[0]?.motivo).toEqual({ desde: DATO_DEL_IMPEDIMENTO });

    // Y el tono del `ETag` sale de un DATO y no de su texto (la leccion H18): un sha256 no dice de
    // que color va, y deducirlo de la cadena pintaria una huella mala de verde.
    const etag = bloques[1]?.campos[0];
    expect(etag?.etiqueta).toBe('ETag');
    expect(etag !== undefined && 'insignia' in etag ? etag.insignia : undefined).toMatchObject({
      tonoDesde: DATO_DEL_TONO,
    });
  });
});

/* ── Lo ejercido con token ─────────────────────────────────────────────────────────────────── */

describe('AC 7 — `YA_SERVIDAS` solo lleva lo ejercido con un token de esta interfaz', () => {
  it('la lista esta VACIA, y la lista esperada se escribe a mano', () => {
    // A mano y no derivada, como en `rentas`: encender una ruta es una decision, y una decision se
    // revisa leyendo su diff. Hoy son cero — nadie ha visto contestar a ninguna de las cuatro con un
    // token de `normativa-web`, y no consta en este repositorio ninguna corrida asi.
    //
    // El dia que se ejerza la primera, esta prueba sale roja y obliga a escribir aqui **cual**, con
    // su traza en el PR: ambiente, fecha, operacion y estado HTTP.
    expect(YA_SERVIDAS.map((o) => `${o.metodo} ${o.ruta}`)).toEqual([]);
  });

  it('y toda entrada que se anada tendra que existir en el contrato y traer su traza', () => {
    const publicadas = operacionesDelContrato();
    const malas = YA_SERVIDAS.filter(
      (o) => !publicadas.includes(`${o.metodo} ${o.ruta}`) || o.traza.trim() === '',
    ).map((o) => `  «${o.metodo} ${o.ruta}» (traza: «${o.traza}»)`);

    expect(
      malas,
      'Hay entradas de `YA_SERVIDAS` sin operacion en el contrato o sin traza:\n' +
        `${malas.join('\n')}`,
    ).toEqual([]);
  });
});
