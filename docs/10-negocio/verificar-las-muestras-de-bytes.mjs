/* Comprueba que verificar-bytes-del-corpus.mjs muerde, y que no muerde de mas.

   Una guarda que no puede fallar no protege nada. Y aqui hace falta decirlo con
   cuidado, porque la guarda de C-15 tiene dos comprobaciones y una de ellas es facil
   de escribir muerta:

     1. el archivo esta DECLARADO `-text` en .gitattributes;
     2. los bytes del disco son los que git guardaria.

   Con (1) en pie, la conversion de fin de linea no puede ocurrir, asi que (2) no puede
   fallar POR ESE MOTIVO. Lo que la mantiene viva es que el fin de linea no es la unica
   forma que tiene git de cambiar los bytes de un archivo: un filtro `clean` los cambia
   igual, y `-text` no lo impide. El caso real es git-lfs —un archivo del corpus bajo
   LFS viaja como un puntero de 130 bytes, con el sha256 firmado apuntando a algo que no
   esta en el repositorio—, y por eso hay un caso que lo fabrica.

   Cada caso levanta su propio repositorio de usar y tirar, escribe su .gitattributes y
   sus archivos, y corre la guarda contra el. Se exige ademas que el rechazo **nombre el
   archivo**: rechazar por el motivo equivocado seria pasar por casualidad.

   Uso: node docs/10-negocio/verificar-las-muestras-de-bytes.mjs
*/

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARDA = fileURLToPath(new URL('./verificar-bytes-del-corpus.mjs', import.meta.url));
const SUBDIR = 'docs/10-negocio/valores-normativos';
const CUADRO = `${SUBDIR}/fuentes/tvr-2026/tvr-2026.csv`;

/** Dos lineas de un derivado, con el fin de linea que se le pida. */
function filas(finDeLinea) {
  return ['marca,modelo,valor', 'TOYOTA,YARIS,45000.00', 'NISSAN,SENTRA,38000.00', ''].join(
    finDeLinea,
  );
}

const CASOS = [
  {
    nombre: 'declarado y con LF: pasa',
    atributos: `${SUBDIR}/** -text\n`,
    contenido: filas('\n'),
    esperado: 'verde',
  },
  {
    /* El caso de `tvr-2026.csv`. Lo que la guarda prohibe NO es el CRLF —el derivado
       nace con el que produce su extractor y ese es el que se firma— sino que git lo
       cambie por el camino. Sin este caso, «declarar todo el corpus -text» y «normalizar
       todo el corpus a LF» pasarian las dos, y la segunda toca la cadena de firmas. */
    nombre: 'declarado y con CRLF: pasa, porque git lo conserva',
    atributos: `${SUBDIR}/** -text\n`,
    contenido: filas('\r\n'),
    esperado: 'verde',
  },
  {
    /* El defecto de C-15, exacto. */
    nombre: 'SIN declarar y con CRLF: rojo',
    atributos: '',
    contenido: filas('\r\n'),
    esperado: 'rojo',
    dice: CUADRO,
  },
  {
    /* Y este es el que impide que el proximo archivo del corpus pase por casualidad: hoy
       no tiene ni un CR, asi que la comprobacion de bytes le da verde, y se rompe en
       silencio el dia que alguien regenere el derivado en otra maquina. */
    nombre: 'SIN declarar y con LF: rojo igual, porque nada garantiza que siga asi',
    atributos: '',
    contenido: filas('\n'),
    esperado: 'rojo',
    dice: 'no esta declarado',
  },
  {
    /* `text eol=lf` es el «arreglo» que uno teclea por instinto: uniformar el corpus. Y es
       justo el que no vale, porque cambia los bytes de `tvr-2026.csv` y con ellos su
       sha256 firmado. */
    nombre: 'declarado `text eol=lf`: rojo, porque eso normaliza en vez de conservar',
    atributos: `${SUBDIR}/** text eol=lf\n`,
    contenido: filas('\r\n'),
    esperado: 'rojo',
    dice: 'no esta declarado',
  },
  {
    /* La comprobacion (2), sola. `-text` esta puesto —asi que (1) pasa— y aun asi los
       bytes que git guarda no son los del disco, porque un filtro `clean` los cambia. Es
       lo que hace git-lfs con todo archivo que declara. */
    nombre: 'declarado -text pero con un filtro `clean` encima: rojo por los bytes',
    atributos: `${SUBDIR}/** -text filter=recorta\n`,
    contenido: filas('\n'),
    filtro: true,
    esperado: 'rojo',
    dice: 'NO guardaria los bytes',
  },
];

function correr(caso) {
  const repo = mkdtempSync(join(tmpdir(), 'muestra-bytes-'));
  try {
    execFileSync('git', ['-C', repo, 'init', '--quiet']);
    // Se fija a proposito: `core.autocrlf` es un ajuste DE LA MAQUINA, y de que lo sea
    // vino C-15. Fijandolo aqui, el caso mide lo mismo en cualquier portatil y en el CI.
    execFileSync('git', ['-C', repo, 'config', 'core.autocrlf', 'input']);
    if (caso.filtro === true) {
      // Un `clean` que se come el primer campo. Da igual lo que haga: lo que el caso
      // demuestra es que git puede cambiar los bytes sin tocar el fin de linea.
      execFileSync('git', ['-C', repo, 'config', 'filter.recorta.clean', 'sed s/^TOYOTA/TOY/']);
    }
    if (caso.atributos !== '') writeFileSync(join(repo, '.gitattributes'), caso.atributos);
    const destino = join(repo, CUADRO);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, caso.contenido);
    execFileSync('git', ['-C', repo, 'add', '-A'], { stdio: 'ignore' });

    let salida = '';
    let codigo = 0;
    try {
      salida = execFileSync('node', [GUARDA, '--repo', repo, '--subdir', SUBDIR], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      codigo = error.status ?? 1;
      salida = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    return { codigo, salida };
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

const fallos = [];
for (const caso of CASOS) {
  const { codigo, salida } = correr(caso);
  const veredicto = codigo === 0 ? 'verde' : 'rojo';
  if (veredicto !== caso.esperado) {
    fallos.push(
      `«${caso.nombre}»: se esperaba ${caso.esperado} y salio ${veredicto}.\n` +
        `      ${salida.trim().split('\n').join('\n      ')}`,
    );
    continue;
  }
  if (caso.dice !== undefined && !salida.includes(caso.dice)) {
    fallos.push(
      `«${caso.nombre}»: salio rojo, pero el mensaje no nombra «${caso.dice}».\n` +
        '      Rechazar por el motivo equivocado es pasar por casualidad.\n' +
        `      ${salida.trim().split('\n').join('\n      ')}`,
    );
  }
}

if (fallos.length > 0) {
  console.error(`\n${fallos.length} muestra(s) de ${CASOS.length} no se comportan:\n`);
  for (const f of fallos) console.error(`  - ${f}`);
  console.error('');
  process.exit(1);
}

console.log(
  `${CASOS.length} muestras: la guarda de los bytes del corpus rechaza las ${
    CASOS.filter((c) => c.esperado === 'rojo').length
  } que tiene que rechazar, nombrando el archivo o el motivo, y deja pasar las ${
    CASOS.filter((c) => c.esperado === 'verde').length
  } que tiene que dejar pasar.`,
);
