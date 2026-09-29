import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CATALOGO, CODIGO_POR_CLAVE } from './catalogo.ts';
import type { AccesoDelSistema, ModuloDelSistema, PermisosDeLaSesion } from './datos/lecturas.ts';
import { ACCESOS_MEDIDOS, MODULOS_MEDIDOS, PERMISOS_MEDIDOS } from './datos/seguridadMedida.ts';
import i18n, { ABRE, IDIOMA_MARCADO, IDIOMA_POR_OMISION } from './i18n/i18n.ts';
import { DE_OTRO_SISTEMA, SESION_PROPIA, componer } from './permisos.ts';

/**
 * **Lo que la cuenta no puede abrir, no se ofrece** (#64, AC 1, 2, 3 y 7).
 *
 * Calcado de `rentas/frontend/src/permisos.test.ts@ac379ac`. Se prueba contra
 * `src/datos/seguridadMedida.ts`, que es lo que el backend CONTESTA —generado de
 * `docs/50-api/seguridad/`, que produce `LecturasDeSeguridadDePuntaAPuntaTest` de HTTP a
 * PostgreSQL—, y no contra invenciones. Un doble inventado probaria que la funcion hace lo que la
 * funcion hace; esto prueba que hace lo correcto **con lo que el backend contesta**.
 *
 * Lo que la captura no trae —una cuenta que solo lee `parametros`, una que no lee nada, un modulo
 * apagado, una respuesta rota— se construye **quitando o cambiando algo de la captura**, nunca
 * escribiendo una respuesta entera a mano.
 */

const MODULOS = MODULOS_MEDIDOS.contenido;
const ACCESOS = ACCESOS_MEDIDOS.contenido;

const codigoDe = (m: { readonly clave: string }) => CODIGO_POR_CLAVE.get(m.clave) ?? '';

const componerMedido = (permisos: PermisosDeLaSesion = PERMISOS_MEDIDOS) =>
  componer(CATALOGO, MODULOS, ACCESOS, permisos, codigoDe);

/**
 * La misma matriz sin ninguno de los accesos de esos modulos: la cuenta que NO puede abrirlos.
 *
 * Por `moduloId` y no por una lista de codigos escrita a mano: el dia que el catalogo gane una
 * opcion mas en ese modulo, la muestra sigue siendo cierta.
 */
function sinLosAccesosDe(...codigosDeModulo: readonly string[]): PermisosDeLaSesion {
  const ids = new Set(MODULOS.filter((m) => codigosDeModulo.includes(m.codigo)).map((m) => m.id));
  const fuera = new Set(ACCESOS.filter((a) => ids.has(a.moduloId)).map((a) => a.codigo));
  return Object.fromEntries(
    Object.entries(PERMISOS_MEDIDOS).filter(([codigo]) => !fuera.has(codigo)),
  );
}

/** Un archivo del backend, leido desde `frontend/` —que es donde corre Vitest—. */
const delBackend = (ruta: string) => readFileSync(join(process.cwd(), '../backend', ruta), 'utf8');

afterEach(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

describe('el catalogo se compone de lo que la cuenta puede abrir', () => {
  it('EL CENTINELA: la captura trae los dos modulos, sus dos accesos, y la cuenta lee `conjuntos`', () => {
    // Sin esto, unas capturas vacias dejarian todo lo de abajo comprobando que de nada sale nada.
    expect(MODULOS.map((m) => m.codigo)).toEqual(['SEGURIDAD', 'NORMATIVA']);
    expect(ACCESOS.map((a) => a.codigo).sort()).toEqual(['conjuntos', 'parametros']);
    expect(PERMISOS_MEDIDOS['conjuntos']).toContain('lectura');
    // Y el arbol de este sistema tiene su modulo, con el codigo con que el backend lo publica.
    expect(CATALOGO.map(codigoDe)).toEqual(['NORMATIVA']);
  });

  it('con la cuenta de la captura se ofrece NORMATIVA, con sus cuatro hojas', () => {
    const { catalogo, sinPermiso, rotas } = componerMedido();
    expect(catalogo.map((m) => m.clave)).toEqual(['normativa']);
    expect(catalogo[0]?.destinos.map((d) => d.clave)).toEqual([
      'nor-panel',
      'nor-ediciones',
      'nor-cuadros',
      'nor-publicacion',
    ]);
    expect(sinPermiso).toEqual([]);
    expect(rotas).toEqual([]);
  });

  it('SEGURIDAD sale en `sinCatalogo`, y NO como de otro sistema', () => {
    // La publica este backend —es la de `parametros`— y esta interfaz no tiene hoja que abrirle
    // (ADR-0043 §2: ninguna hoja se dibuja por `parametros`). Es de aqui, y se cuenta: descartarla en
    // silencio dejaria un modulo publicado que esta interfaz ignora sin que nadie lo sepa.
    const { sinCatalogo, deOtroSistema } = componerMedido();
    expect(sinCatalogo).toEqual(['SEGURIDAD']);
    expect(deOtroSistema).toEqual([]);
  });

  it('un modulo INACTIVO no se ofrece', () => {
    const apagado = MODULOS.map((m) => (m.codigo === 'NORMATIVA' ? { ...m, activo: false } : m));
    const { catalogo } = componer(CATALOGO, apagado, ACCESOS, PERMISOS_MEDIDOS, codigoDe);
    expect(catalogo).toEqual([]);
  });

  it('una cuenta que solo lee `parametros` NO abre nada: NORMATIVA se cuenta en `sinPermiso`', () => {
    // Es la cuenta que la captura describia hasta #64. `parametros` es de SEGURIDAD, que no tiene
    // hoja aqui; las cuatro cuelgan de `conjuntos` (ADR-0043 §2). Filtrar por hoja hubiera podido
    // abrirle el Panel —su estado del ejercicio va con `SESION_PROPIA`—; por modulo, no (#120).
    const soloParametros = sinLosAccesosDe('NORMATIVA');
    expect(Object.keys(soloParametros)).toEqual(['parametros']);

    const { catalogo, sinPermiso } = componerMedido(soloParametros);
    expect(catalogo).toEqual([]);
    expect(sinPermiso).toEqual(['NORMATIVA']);
  });

  it('una cuenta que no lee NADA: el catalogo sale vacio y NORMATIVA se cuenta', () => {
    // Que es distinto de un error: es una cuenta sin permisos, y quien la mire tiene que poder
    // distinguirlo de un backend caido. Lo dice `useCatalogoPermitido` con `sin-permiso`.
    const { catalogo, sinPermiso, rotas } = componerMedido({});
    expect(catalogo).toEqual([]);
    expect(sinPermiso).toEqual(['NORMATIVA']);
    expect(rotas).toEqual([]);
  });

  it('y el filtro es POR MODULO: basta un acceso con lectura para ofrecerlo entero', () => {
    // Otra opcion mas en NORMATIVA, que la cuenta no puede leer: el modulo se ofrece igual, con sus
    // cuatro hojas. Aqui no hay un mapa hoja -> acceso que pudiera esconder alguna.
    const normativa = MODULOS.find((m) => m.codigo === 'NORMATIVA');
    const otra: AccesoDelSistema = {
      id: 99,
      moduloId: normativa?.id ?? 0,
      tipo: 'OPCION_MENU',
      codigo: 'otra_opcion',
      nombre: 'Otra opcion',
      activo: true,
    };
    const { catalogo } = componer(CATALOGO, MODULOS, [...ACCESOS, otra], PERMISOS_MEDIDOS, codigoDe);
    expect(catalogo[0]?.destinos).toHaveLength(4);
  });

  it('el ORDEN es el del backend, no el del arbol', () => {
    const conOrden = [
      ...MODULOS.map((m) => (m.codigo === 'SEGURIDAD' ? { ...m, orden: 7 } : m)),
      { id: 50, codigo: 'OTRO', nombre: 'Otro', orden: 3, activo: true },
    ];
    const { sinCatalogo } = componer(CATALOGO, conOrden, ACCESOS, PERMISOS_MEDIDOS, codigoDe);
    expect(sinCatalogo).toEqual(['OTRO', 'SEGURIDAD']);
  });

  it('un privilegio que no sea lista no tumba el arbol: descarta ESE acceso', () => {
    const raros = { ...PERMISOS_MEDIDOS, conjuntos: 'lectura' as unknown as readonly string[] };
    expect(() => componerMedido(raros)).not.toThrow();
    expect(componerMedido(raros).sinPermiso).toEqual(['NORMATIVA']);
  });
});

describe('`DE_OTRO_SISTEMA` se MIDE contra lo que el backend publica, y no se copia de `rentas`', () => {
  it('cada llave es un modulo que la captura trae y el arbol no sirve', () => {
    // Copiar el de `rentas` —`CATASTRO` y `TESORERIA`— sale rojo aqui NOMBRANDOLOS: ninguno de los
    // dos lo publica este backend, asi que restarlos seria una lista de fantasmas.
    const publicados = new Set(MODULOS.map((m) => m.codigo));
    const nuestros = new Set(CATALOGO.map(codigoDe));
    const fantasmas = [...DE_OTRO_SISTEMA.keys()].filter(
      (codigo) => !publicados.has(codigo) || nuestros.has(codigo),
    );
    expect(
      fantasmas,
      'DE_OTRO_SISTEMA resta modulos que la captura de `GET /seguridad/modulos` no publica, o que\n' +
        'este arbol si sirve:\n' +
        `${fantasmas.map((c) => `  ${c}`).join('\n')}\n\n` +
        '  La copia local del catalogo la siembra `SembradorDelCatalogo` desde `CatalogoDelSistema`:\n' +
        '  este backend no publica modulos de otro sistema. Si algun dia publica uno, entra aqui\n' +
        '  con su motivo y con la captura que lo trae.',
    ).toEqual([]);
  });

  it('y hoy esta VACIO con su motivo: el backend publica exactamente los modulos de `CatalogoDelSistema`', () => {
    // El motivo, medido en el Java y no afirmado: los modulos que la captura trae son los que
    // declara el catalogo de ESTE sistema, y ninguno mas. Si el backend empezara a sembrar el
    // catalogo del cluster, esto sale rojo antes de que el menu se llene de modulos ajenos.
    const java = delBackend(
      'kamayuk-normativa-seguridad/src/main/java/kamayuk/normativa/seguridad/dominio/CatalogoDelSistema.java',
    );
    const delCatalogo = [...new Set([...java.matchAll(/new Opcion\("([A-Z_]+)"/g)].map((m) => m[1]))];
    expect(delCatalogo.length, 'no se pudo leer ninguna `Opcion` de `CatalogoDelSistema`').toBeGreaterThan(0);
    expect(MODULOS.map((m) => m.codigo).sort()).toEqual([...delCatalogo].sort());
    expect([...DE_OTRO_SISTEMA.keys()]).toEqual([]);
  });
});

describe('EL CENTINELA `SESION_PROPIA` no esta en la matriz, y no se busca en ella (AC 3)', () => {
  it('su valor es el de `RequiereAcceso.SESION_PROPIA` del backend', () => {
    const java = delBackend(
      'kamayuk-normativa-plataforma/src/main/java/kamayuk/normativa/autorizacion/RequiereAcceso.java',
    );
    expect(/String SESION_PROPIA = "([^"]+)";/.exec(java)?.[1]).toBe(SESION_PROPIA);
  });

  it('y lo que el backend contesta no lo trae: ni la matriz ni los accesos', () => {
    expect(Object.keys(PERMISOS_MEDIDOS)).not.toContain(SESION_PROPIA);
    expect(ACCESOS.map((a) => a.codigo)).not.toContain(SESION_PROPIA);
  });

  it('aunque llegara como opcion y con lectura, NO abre el modulo: y la matriz no se consulta por el', () => {
    // El caso de verdad: un escaner de anotaciones que no lo excluya lo encuentra en cinco
    // controladores y lo siembra como opcion de NORMATIVA; la implantacion de `identidad` le da los
    // siete privilegios al grupo de administracion. Si contara, el modulo se abriria **a toda
    // cuenta con sesion**, que es justo lo que el centinela significa.
    const normativa = MODULOS.find((m) => m.codigo === 'NORMATIVA');
    const centinela: AccesoDelSistema = {
      id: 77,
      moduloId: normativa?.id ?? 0,
      tipo: 'OPCION_MENU',
      codigo: SESION_PROPIA,
      nombre: 'Sesion propia',
      activo: true,
    };
    const leidas: PropertyKey[] = [];
    const matriz = new Proxy<Record<string, readonly string[]>>(
      { parametros: ['lectura'], [SESION_PROPIA]: ['lectura'] },
      {
        get(objetivo, llave, receptor) {
          leidas.push(llave);
          return Reflect.get(objetivo, llave, receptor) as unknown;
        },
      },
    );

    const { catalogo, sinPermiso } = componer(
      CATALOGO,
      MODULOS,
      [...ACCESOS, centinela],
      matriz,
      codigoDe,
    );

    expect(
      leidas,
      `\`componer\` leyo «${SESION_PROPIA}» de la matriz: lo trato como un permiso que se tiene o no.`,
    ).not.toContain(SESION_PROPIA);
    expect(catalogo, 'el centinela abrio NORMATIVA a una cuenta que solo lee `parametros`').toEqual([]);
    expect(sinPermiso).toEqual(['NORMATIVA']);
  });
});

describe('ante una respuesta que no tiene la forma publicada, no se ofrece NADA (AC 7)', () => {
  const rotos: readonly (readonly [string, unknown])[] = [
    ['una pagina en vez de su contenido', MODULOS_MEDIDOS],
    ['un objeto vacio', {}],
    ['un nulo', null],
    ['una fila sin `codigo`', MODULOS.map((m) => ({ ...m, codigo: undefined }))],
    ['una fila con `activo` en texto', MODULOS.map((m) => ({ ...m, activo: 'true' }))],
  ];

  it.each(rotos)('`GET /seguridad/modulos` con %s', (_, modulos) => {
    const { catalogo, rotas } = componer(
      CATALOGO,
      modulos as readonly ModuloDelSistema[],
      ACCESOS,
      PERMISOS_MEDIDOS,
      codigoDe,
    );
    // Toda la lista o nada: ofrecer lo que se pudo leer de una respuesta rota seria adivinar el
    // resto, y un modulo que falta del menu no da ningun error.
    expect(catalogo).toEqual([]);
    expect(rotas).toEqual(['GET /seguridad/modulos']);
  });

  it('y lo mismo con los accesos rotos, y con una matriz que no es un objeto', () => {
    const conAccesosRotos = componer(
      CATALOGO,
      MODULOS,
      { contenido: ACCESOS } as unknown as readonly AccesoDelSistema[],
      PERMISOS_MEDIDOS,
      codigoDe,
    );
    expect(conAccesosRotos.catalogo).toEqual([]);
    expect(conAccesosRotos.rotas).toEqual(['GET /seguridad/accesos']);

    const conMatrizRota = componer(
      CATALOGO,
      MODULOS,
      ACCESOS,
      ['conjuntos'] as unknown as PermisosDeLaSesion,
      codigoDe,
    );
    expect(conMatrizRota.catalogo).toEqual([]);
    expect(conMatrizRota.rotas).toEqual(['GET /seguridad/sesion/permisos']);
  });
});

describe('el rotulo es el del BACKEND, y lo demas sigue traduciendose', () => {
  it('el rotulo lo pisa `nombre` de `GET /seguridad/modulos`', () => {
    const renombrado = MODULOS.map((m) =>
      m.codigo === 'NORMATIVA' ? { ...m, nombre: 'Parametros normativos' } : m,
    );
    const { catalogo } = componer(CATALOGO, renombrado, ACCESOS, PERMISOS_MEDIDOS, codigoDe);
    // El dia que la municipalidad renombre un modulo, el arbol dice el nombre nuevo sin que nadie
    // toque este repositorio.
    expect(catalogo[0]?.rotulo).toBe('Parametros normativos');
    expect(CATALOGO[0]?.rotulo).not.toBe('Parametros normativos');
  });

  it('pero la NOTA y las hojas conservan su captador: cambiar de idioma las cambia', async () => {
    // La trampa de este arbol: `{ ...modulo, rotulo }` evaluaria los captadores al componer y
    // dejaria la nota congelada en el idioma del arranque —en verde, porque hoy solo hay uno—.
    const [compuesto] = componerMedido().catalogo;
    const notaAntes = compuesto?.nota;

    await i18n.changeLanguage(IDIOMA_MARCADO);

    expect(compuesto?.nota, 'la nota se quedo en el idioma en que se compuso').not.toBe(notaAntes);
    expect(compuesto?.nota?.startsWith(ABRE)).toBe(true);
    expect(compuesto?.destinos[0]?.rotulo.startsWith(ABRE)).toBe(true);
    // Y el del backend NO se traduce: es un dato, como el nombre de una persona.
    expect(compuesto?.rotulo).toBe('Normativa');
  });
});
