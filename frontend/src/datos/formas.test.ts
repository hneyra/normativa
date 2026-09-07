import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CODIGOS_DEL_BACKEND, CODIGOS_DE_ESTA_INTERFAZ } from '../api/cliente.ts';
import { TITULO_DEL_CODIGO } from '../api/proxy.ts';
import { OPERACIONES } from './operaciones.ts';

/**
 * Los tipos de `lecturas.ts` son los `record` del backend, campo a campo (AC2).
 *
 * <h2>Por que se lee el `.java` y no un archivo generado</h2>
 *
 * `rentas` compara contra `docs/50-api/formas-de-la-api.json`, que produce una prueba del
 * backend. **Aqui ese archivo no existe** —lo comprueba esta misma prueba, para que el dia que
 * exista alguien se acuerde de cambiar de fuente—, asi que se lee lo unico que hay y que no
 * puede quedarse atras: el fuente. Un `record` renombrado, un campo anadido o uno que deja de
 * publicarse ponen rojo esto, nombrando el campo.
 *
 * Una alternativa era escribir la lista de campos a mano en la prueba. Se descarto por lo mismo
 * que `eslint.prohibiciones.mjs` deriva sus muestras: **una copia a mano de lo que se quiere
 * comparar no compara nada**, porque quien cambie el tipo cambia tambien la lista.
 *
 * <h2>Y el snapshot se compara en ORDEN</h2>
 *
 * El `ETag` es el `sha256` de los bytes servidos y Jackson emite un `record` en el orden de sus
 * componentes: **mover un campo de sitio cambia la huella sin cambiar un solo valor**, y toda
 * descarga cacheada —`Cache-Control: immutable`, un ano— se leeria como corrupta. Por eso las
 * cinco formas del snapshot se comparan en orden y las otras dos como conjunto: su huella no la
 * mira nadie, y exigir un orden donde no lo hay convierte la prueba en un obstaculo sin motivo.
 *
 * <h2>El truco de Spotless, que hay que saber</h2>
 *
 * Spotless parte las cadenas largas en concatenaciones `"..." + "..."`, asi que un `grep` directo
 * no encuentra el texto completo. Antes de comparar se unen: `unirCadenas()`.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../../..');
const PARAMETROS = join(
  RAIZ,
  'backend/kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros',
);
const PLATAFORMA = join(
  RAIZ,
  'backend/kamayuk-normativa-plataforma/src/main/java/kamayuk/normativa/web',
);

const CONTROLADOR_DE_PARAMETROS = join(PARAMETROS, 'infraestructura/web/ParametrosController.java');
const CONTROLADOR_DE_SNAPSHOT = join(PARAMETROS, 'infraestructura/web/SnapshotController.java');
const SNAPSHOT_DEL_CONJUNTO = join(PARAMETROS, 'dominio/SnapshotDelConjunto.java');
const RESPUESTA_PAGINADA = join(PLATAFORMA, 'RespuestaPaginada.java');
const CODIGO_DE_ERROR = join(PLATAFORMA, 'CodigoDeError.java');

const LECTURAS = join(AQUI, 'lecturas.ts');

function fuente(ruta: string): string {
  return readFileSync(ruta, 'utf8');
}

/**
 * Une las concatenaciones que Spotless parte: `"abc" + "def"` → `"abcdef"`.
 *
 * Solo une literal con literal. `conjuntoId + " ya esta..."` no casa, porque a la izquierda del
 * `+` no hay comilla — que es justo lo que hace falta para poder buscar despues los trozos que
 * rodean a un valor interpolado.
 */
export function unirCadenas(java: string): string {
  let anterior = java;
  for (;;) {
    const unido = anterior.replace(/"\s*\+\s*"/g, '');
    if (unido === anterior) return unido;
    anterior = unido;
  }
}

/** Quita comentarios de bloque y de linea, para que ningun ejemplo del javadoc cuente. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** El texto entre el parentesis que abre en `desde` y el que lo cierra. */
function entreParentesis(codigo: string, desde: number): string {
  let profundidad = 0;
  for (let i = desde; i < codigo.length; i += 1) {
    if (codigo[i] === '(') profundidad += 1;
    if (codigo[i] === ')') {
      profundidad -= 1;
      if (profundidad === 0) return codigo.slice(desde + 1, i);
    }
  }
  throw new Error('El parentesis no cierra.');
}

/** Parte por las comas de primer nivel, respetando `<...>` y `(...)`. */
function porComasDePrimerNivel(texto: string): string[] {
  const trozos: string[] = [];
  let actual = '';
  let angulos = 0;
  let parentesis = 0;
  for (const letra of texto) {
    if (letra === '<') angulos += 1;
    if (letra === '>') angulos -= 1;
    if (letra === '(') parentesis += 1;
    if (letra === ')') parentesis -= 1;
    if (letra === ',' && angulos === 0 && parentesis === 0) {
      trozos.push(actual);
      actual = '';
      continue;
    }
    actual += letra;
  }
  if (actual.trim() !== '') trozos.push(actual);
  return trozos;
}

/**
 * Los componentes de un `record` de Java, en orden.
 *
 * De cada componente se toma el ULTIMO identificador, que es su nombre: asi
 * `@Nullable Instant fechaSellado` y `java.util.List<SnapshotDelConjunto.ParametroDelSnapshot>
 * parametros` dan `fechaSellado` y `parametros` sin tener que entender el tipo.
 */
export function componentesDelRecord(java: string, nombre: string): readonly string[] {
  const codigo = sinComentarios(java);
  // `(?:<[^>]*>)?` porque `RespuestaPaginada` es generico: `record RespuestaPaginada<T>(`.
  const buscado = new RegExp(`record\\s+${nombre}\\s*(?:<[^>]*>)?\\s*\\(`).exec(codigo);
  if (buscado === null) {
    throw new Error(`No hay ningun «record ${nombre}» en el fuente leido.`);
  }
  const abre = codigo.indexOf('(', buscado.index);
  return porComasDePrimerNivel(entreParentesis(codigo, abre)).map((componente) => {
    const identificadores = componente.trim().match(/[A-Za-z_$][\w$]*/g);
    if (identificadores === null || identificadores.length === 0) {
      throw new Error(`El componente «${componente}» de ${nombre} no tiene nombre.`);
    }
    return identificadores[identificadores.length - 1]!;
  });
}

/**
 * Los campos de una interfaz de TypeScript, en orden.
 *
 * Se lee el FUENTE y no el tipo: en tiempo de ejecucion una interfaz no existe, asi que no hay
 * forma de preguntarle sus campos ni —sobre todo— su orden, que es la mitad de lo que aqui se
 * comprueba.
 */
export function camposDeLaInterfaz(ts: string, nombre: string): readonly string[] {
  const buscado = new RegExp(`export interface ${nombre}(?:<[^>]*>)?\\s*\\{`).exec(ts);
  if (buscado === null) {
    throw new Error(`No hay ninguna «export interface ${nombre}» en lecturas.ts.`);
  }
  const abre = ts.indexOf('{', buscado.index);
  let profundidad = 0;
  let cierra = abre;
  for (let i = abre; i < ts.length; i += 1) {
    if (ts[i] === '{') profundidad += 1;
    if (ts[i] === '}') {
      profundidad -= 1;
      if (profundidad === 0) {
        cierra = i;
        break;
      }
    }
  }
  const cuerpo = sinComentarios(ts.slice(abre + 1, cierra));
  return [...cuerpo.matchAll(/readonly\s+([A-Za-z_$][\w$]*)\s*\??\s*:/g)].map((m) => m[1]!);
}

/** Una forma publicada: su interfaz aqui, su `record` alli, y si el orden importa. */
interface Forma {
  readonly interfaz: string;
  readonly registro: string;
  readonly archivo: string;
  /** Cierto solo en las del snapshot: su orden es la huella. */
  readonly enOrden: boolean;
}

const FORMAS: readonly Forma[] = [
  {
    interfaz: 'Paginado',
    registro: 'RespuestaPaginada',
    archivo: RESPUESTA_PAGINADA,
    enOrden: false,
  },
  {
    interfaz: 'ConjuntoResource',
    registro: 'ConjuntoResource',
    archivo: CONTROLADOR_DE_PARAMETROS,
    enOrden: false,
  },
  {
    interfaz: 'EjercicioParametrizadoResource',
    registro: 'EjercicioParametrizadoResource',
    archivo: CONTROLADOR_DE_PARAMETROS,
    enOrden: false,
  },
  {
    interfaz: 'ConjuntoVigenteResource',
    registro: 'ConjuntoVigenteResource',
    archivo: CONTROLADOR_DE_SNAPSHOT,
    enOrden: false,
  },
  {
    interfaz: 'SnapshotResource',
    registro: 'SnapshotResource',
    archivo: CONTROLADOR_DE_SNAPSHOT,
    enOrden: true,
  },
  {
    interfaz: 'ParametroDelSnapshot',
    registro: 'ParametroDelSnapshot',
    archivo: SNAPSHOT_DEL_CONJUNTO,
    enOrden: true,
  },
  {
    interfaz: 'ValorUnitarioDelSnapshot',
    registro: 'ValorUnitarioDelSnapshot',
    archivo: SNAPSHOT_DEL_CONJUNTO,
    enOrden: true,
  },
  {
    interfaz: 'DepreciacionDelSnapshot',
    registro: 'DepreciacionDelSnapshot',
    archivo: SNAPSHOT_DEL_CONJUNTO,
    enOrden: true,
  },
  {
    interfaz: 'ValorReferencialDelSnapshot',
    registro: 'ValorReferencialDelSnapshot',
    archivo: SNAPSHOT_DEL_CONJUNTO,
    enOrden: true,
  },
];

const lecturas = fuente(LECTURAS);

describe('los tipos del frontend son los record del backend, campo a campo', () => {
  it.each(FORMAS.filter((f) => !f.enOrden).map((f) => [f.interfaz, f] as const))(
    '%s: los mismos campos, en los dos sentidos',
    (_nombre, forma) => {
      const delBackend = componentesDelRecord(fuente(forma.archivo), forma.registro);
      const delFrontend = camposDeLaInterfaz(lecturas, forma.interfaz);
      expect(
        [...delFrontend].sort(),
        `«${forma.interfaz}» no publica los mismos campos que «record ${forma.registro}».\n` +
          'Un campo que SOBRA es tan grave como uno que falta: una pantalla puede acabar\n' +
          'leyendo el que sobra, y ese no llegara nunca.',
      ).toEqual([...delBackend].sort());
    },
  );

  it.each(FORMAS.filter((f) => f.enOrden).map((f) => [f.interfaz, f] as const))(
    '%s: los mismos campos Y EN EL MISMO ORDEN, porque el orden es la huella',
    (_nombre, forma) => {
      const delBackend = componentesDelRecord(fuente(forma.archivo), forma.registro);
      const delFrontend = camposDeLaInterfaz(lecturas, forma.interfaz);
      expect(
        delFrontend,
        `«${forma.interfaz}» no coincide con «record ${forma.registro}».\n` +
          'Aqui el ORDEN cuenta: el ETag es el sha256 de los bytes servidos y Jackson emite\n' +
          'un record en el orden de sus componentes. Mover un campo de sitio cambia la huella\n' +
          'sin cambiar un solo valor, y toda descarga cacheada se lee como corrupta.',
      ).toEqual(delBackend);
    },
  );

  it('las cuatro operaciones REALES declaran una forma que existe en los dos lados', () => {
    const reales = OPERACIONES.filter((o) => o.origen === 'REAL');
    expect(reales).toHaveLength(4);
    for (const operacion of reales) {
      const forma = FORMAS.find((f) => f.interfaz === operacion.forma);
      expect(
        forma,
        `La operacion «${operacion.metodo} ${operacion.ruta}» dice publicar «${String(
          operacion.forma,
        )}», que no esta en la tabla de formas comprobadas.`,
      ).toBeDefined();
    }
  });

  it('ninguna operacion SIMULADA afirma una forma del backend', () => {
    // Una escritura inventada que dijera publicar un `record` de Java estaria afirmando un
    // contrato que no existe, y la prueba de arriba la daria por buena.
    for (const operacion of OPERACIONES.filter((o) => o.origen === 'SIMULADA')) {
      expect(operacion.forma).toBeUndefined();
    }
  });
});

describe('el catalogo de errores es el del backend', () => {
  const enumerado = unirCadenas(sinComentarios(fuente(CODIGO_DE_ERROR)));
  const declarados = [...enumerado.matchAll(/([A-Z_]+)\(\s*HttpStatus\.(\w+),\s*"([^"]*)"\)/g)];

  it('los once codigos, en el orden en que los declara CodigoDeError.java', () => {
    expect(declarados.map((d) => d[1])).toEqual([...CODIGOS_DEL_BACKEND]);
  });

  it('y los dos de esta interfaz NO estan en el enumerado, porque no los emite nadie', () => {
    for (const codigo of CODIGOS_DE_ESTA_INTERFAZ) {
      expect(
        declarados.map((d) => d[1]),
        `«${codigo}» aparecio en CodigoDeError.java. Si el backend lo emite, deja de ser un ` +
          'codigo que se inventa esta interfaz y tiene que moverse a CODIGOS_DEL_BACKEND.',
      ).not.toContain(codigo);
    }
  });

  it('los titulos que el proxy publica son los mensajes del enumerado, letra por letra', () => {
    for (const [codigo, titulo] of Object.entries(TITULO_DEL_CODIGO)) {
      const declarado = declarados.find((d) => d[1] === codigo);
      expect(declarado, `«${codigo}» no esta en CodigoDeError.java.`).toBeDefined();
      expect(
        declarado?.[3],
        `El title que el proxy publica para «${codigo}» no es el del backend. Una pantalla que ` +
          'reaccione a ese texto reaccionaria a algo que el backend no manda.',
      ).toBe(titulo);
    }
  });
});

describe('la fuente de la comparacion sigue siendo el .java', () => {
  it('no hay un formas-de-la-api.json en este repositorio', () => {
    // El dia que lo haya, esta prueba se pone roja y hay que cambiar de fuente: comparar contra
    // el fuente cuando existe un archivo generado seria comparar contra la copia peor.
    let existe = true;
    try {
      readFileSync(join(RAIZ, 'docs/50-api/formas-de-la-api.json'), 'utf8');
    } catch {
      existe = false;
    }
    expect(existe).toBe(false);
  });

  it('y el backend sigue sin publicar una sola escritura, en TODO src/main', () => {
    // Es la premisa de la que cuelga todo: si aparece un @PostMapping, las tres escrituras
    // simuladas dejan de ser un dibujo y tienen que salir de `simulados.ts`. Se mira el arbol
    // entero y no los dos controladores de hoy: una escritura nueva no tiene por que aparecer
    // en ellos, y mirar solo donde ya se sabe no comprueba nada.
    const java = readdirSync(join(RAIZ, 'backend'), { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.java') && f.includes(`${sep}src${sep}main${sep}`))
      .map((f) => join(RAIZ, 'backend', f));
    expect(java.length).toBeGreaterThan(100);

    const conEscritura = java.filter((f) =>
      /@(Post|Put|Patch|Delete)Mapping/.test(sinComentarios(fuente(f))),
    );
    expect(conEscritura).toEqual([]);

    // Y las cuatro lecturas siguen ahi, para que el cero de arriba no sea el de un arbol vacio.
    const conLectura = java.filter((f) => /@GetMapping/.test(sinComentarios(fuente(f))));
    expect(conLectura.map((f) => f.split(sep).at(-1))).toEqual([
      'ParametrosController.java',
      'SnapshotController.java',
    ]);
  });
});
