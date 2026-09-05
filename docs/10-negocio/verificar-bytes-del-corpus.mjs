/* Los bytes del corpus normativo son los que git conserva (C-15).

   Un cuadro normativo no se transcribe a mano: se extrae mecanicamente de la fuente
   oficial y lo que se firma —a doble firma, ADR-0007— es el **sha256 de sus bytes**.
   `verificar-cuadros.mjs` lo recalcula en cada PR y `PublicarCuadros` antes de publicar
   una sola fila, y las dos dicen lo mismo: «un byte distinto en un cuadro normativo se
   investiga, no se publica».

   Esa promesa se apoya en algo que git **no hace por omision**: conservar los bytes. Con
   `core.autocrlf=input` —un ajuste de la maquina de cada quien, no del repositorio— el
   filtro `clean` quita el CR de todo archivo que git considere texto AL COMMITEAR, asi
   que el blob no es lo que habia en el disco. Es lo que se pago en C-15:

     tvr-2026.csv   disco  1 552 103 bytes, 18 044 CR  -> sha256 239a75a0...  (el firmado)
                    git    1 534 059 bytes,      0 CR  -> sha256 f9369989...  (el que viaja)
                    la diferencia son 18 044 bytes: exactamente uno por linea

   La verificacion pasaba en la maquina donde se extrajo el archivo y fallaba en cualquier
   clon —que es donde corre el CI—, y el sintoma es el peor posible: la guarda que existe
   para distinguir un cuadro de otro acusando de manipulacion a un archivo intacto.

   Lo que esto comprueba, por cada archivo del corpus, y las dos cosas hacen falta:

     1. **Esta declarado**: `git check-attr text` dice `unset`, o sea que `.gitattributes`
        lo marca `-text` y git no le toca un byte en ninguna direccion. Sin esto, (2)
        pasaria hoy por casualidad —el archivo no tiene ni un CR— y se rompeeria el dia
        que alguien regenerara el derivado en una maquina que escriba CRLF, en silencio.
     2. **Los bytes del disco son los que git guarda**: `git hash-object` con filtros y sin
        ellos dan el mismo objeto. Es la comprobacion directa del defecto, y la unica que
        vale en la maquina donde se extrae, que es donde el archivo nace con sus CR.

   Lo que esto NO comprueba, y no puede: que los bytes sean los correctos. Eso lo sostiene
   la doble firma del corpus y `verificar-cuadros.mjs`. Aqui solo se garantiza que los
   bytes que se firmaron sean los que llegan al clon de otro.

   Uso:  node docs/10-negocio/verificar-bytes-del-corpus.mjs
         node docs/10-negocio/verificar-bytes-del-corpus.mjs --repo DIR --subdir RUTA
*/

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ_POR_OMISION = fileURLToPath(new URL('../../', import.meta.url));
const SUBDIR_POR_OMISION = 'docs/10-negocio/valores-normativos';

const argumentos = process.argv.slice(2);
function opcion(nombre, porOmision) {
  const i = argumentos.indexOf(nombre);
  return i >= 0 && argumentos[i + 1] ? argumentos[i + 1] : porOmision;
}
const repo = opcion('--repo', RAIZ_POR_OMISION);
const subdir = opcion('--subdir', SUBDIR_POR_OMISION);

function git(...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

/* `git ls-files` y no `readdir`: lo que importa es lo que git versiona. Un archivo del
   corpus que no este en el indice no viaja a ningun clon, asi que su huella no puede
   estar firmada. */
let archivos;
try {
  archivos = git('ls-files', '--', subdir)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
} catch (error) {
  console.error(`No se pudo leer el indice de git en «${repo}»: ${error.message}`);
  process.exit(1);
}

if (archivos.length === 0) {
  console.error(
    `git no versiona ningun archivo bajo «${subdir}» en «${repo}».\n` +
      '  Un barrido vacio no dice que el corpus este en regla: dice que no se miro nada.',
  );
  process.exit(1);
}

/* «text: unset» es `-text` en .gitattributes: ninguna conversion, en ninguna direccion.
   `unspecified` significa que git decide solo, que es justo lo que no puede pasar aqui. */
function declarado(archivo) {
  const salida = git('check-attr', 'text', '--', archivo).trim();
  return salida.endsWith(': unset');
}

const problemas = [];
for (const archivo of archivos) {
  if (!declarado(archivo)) {
    problemas.push(
      `«${archivo}» no esta declarado en .gitattributes.\n` +
        '    Sin `-text`, git decide solo si es texto y le quita el CR al commitear: el sha256\n' +
        '    que el corpus firma dejaria de ser el que llega a un clon. Declaralo con\n' +
        `    \`${subdir}/** -text\`.`,
    );
    continue;
  }
  const conFiltros = git('hash-object', '--', archivo).trim();
  const sinFiltros = git('hash-object', '--no-filters', '--', archivo).trim();
  if (conFiltros !== sinFiltros) {
    problemas.push(
      `«${archivo}»: git NO guardaria los bytes que hay en el disco.\n` +
        `    en el disco:   ${sinFiltros}\n` +
        `    lo que git guardaria: ${conFiltros}\n` +
        '    El sha256 que el corpus firma es el del disco; el que veria cualquier clon es el\n' +
        '    otro. Es C-15: la guarda de los cuadros acusaria de manipulacion a un archivo\n' +
        '    intacto. Se arregla declarando el archivo `-text` y volviendo a anadirlo\n' +
        '    (`git add --renormalize`), NO recalculando el sha256: eso toca la cadena de\n' +
        '    firmas, y una cifra del corpus se re-firma a dos manos (ADR-0007).',
    );
  }
}

if (problemas.length > 0) {
  console.error(`\n${problemas.length} problema(s) con los bytes del corpus de «${repo}»:\n`);
  for (const p of problemas) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `${archivos.length} archivo(s) del corpus: git conserva sus bytes, y esta declarado que` +
    ' los conserve.',
);
