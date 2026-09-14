/*
   Comprueba que cada cita de `frontend/diseno/HUECOS.md` apunta a la linea que dice
   (hneyra/normativa#51, AC 5).

   ## Por que existe

   `HUECOS.md` manda a quien implemente una hoja a una linea concreta de la V6, congelada en
   `c01fe9a`. Una linea mal copiada lo manda al sitio equivocado, y eso no lo nota nadie leyendo
   el documento: la cita tiene la forma correcta y el archivo existe. Asi que cada cita lleva un
   **fragmento literal** de su linea, y esto lo busca en esa linea y en ninguna otra.

   ## Que se comprueba

   Una cita es `c01fe9a:<ruta desde la raiz del repositorio>:<linea>` entre comillas invertidas,
   seguida de su fragmento entre comillas invertidas dobles:

       `c01fe9a:frontend/src/secciones/conjuntos.ts:55` `` export const ORDENES_ADMITIDOS ``

   Para cada una se hace `git show c01fe9a:<ruta>` y se exige que la linea `<linea>` contenga el
   fragmento. Sale en rojo, nombrando la entrada, la cita y lo que hay de verdad en esa linea:

     - si el fragmento no esta en esa linea;
     - si la ruta no existe en `c01fe9a` o el archivo tiene menos lineas;
     - si una mencion `c01fe9a:frontend/…:N` no lleva fragmento, o es un rango `:N-M`: una cita
       sin fragmento es justo la que no se puede comprobar, y un rango no dice en que linea mirar.

   ## El centinela

   Una comprobacion que no encuentra nada que comprobar sale en verde sin haber comprobado nada.
   Por eso sale con codigo 2, diciendolo:

     - si `HUECOS.md` no existe;
     - si la extraccion no encuentra ninguna cita;
     - si hay menos entradas con cita que entradas tiene el documento (`### H…`).

   ## Lo que NO hace

   **No corre en CI**: `actions/checkout` clona con profundidad 1 y `c01fe9a` no estaria. Se
   ejecuta en local y su salida va pegada en el PR. Si el clon no tiene `c01fe9a`, lo dice y sale
   con codigo 2 en vez de dar cada cita por mala.

   ## Uso

     node frontend/diseno/comprobar-huecos.mjs

   Todo el trabajo va dentro de `comprobar()`, que se llama al final: cargar el modulo no lee
   ningun archivo.
*/

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** El commit en que la V6 quedo congelada. Es el que citan todas las entradas. */
const COMMIT = 'c01fe9a';

/** Una entrada del inventario: `### H07 · \`errores-tras-el-primer-intento\``. */
const ENTRADA = /^### (H\d+[a-z]?) · `([a-z0-9-]+)`/;

/** Cualquier encabezado, para saber a que seccion pertenece una cita fuera de las entradas. */
const ENCABEZADO = /^#{2,3} (.+)$/;

/** Una cita completa: la referencia y su fragmento entre comillas invertidas dobles. */
const CITA = /`c01fe9a:(frontend\/[^`\s:]+):(\d+)` ``\s?(.+?)\s?``/g;

/** Cualquier mencion que parezca una cita, tenga o no fragmento. */
const MENCION = /`c01fe9a:(frontend\/[^`\s:]+):(\d+(?:-\d+)?)`( ``)?/g;

function escribir(flujo, texto) {
  flujo.write(`${texto}\n`);
}

/** Las lineas de `ruta` en `COMMIT`, o `null` si no existe ahi. Una lectura por archivo. */
function lectorDeLaV6(raiz) {
  const leidos = new Map();
  return (ruta) => {
    if (!leidos.has(ruta)) {
      try {
        const texto = execFileSync('git', ['-C', raiz, 'show', `${COMMIT}:${ruta}`], {
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        leidos.set(ruta, texto.split('\n'));
      } catch {
        leidos.set(ruta, null);
      }
    }
    return leidos.get(ruta);
  };
}

function hayCommit(raiz) {
  try {
    execFileSync('git', ['-C', raiz, 'cat-file', '-e', `${COMMIT}^{commit}`], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function comprobar() {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const raiz = resolve(aqui, '..', '..');
  const archivo = join(aqui, 'HUECOS.md');
  const nombre = 'frontend/diseno/HUECOS.md';

  if (!existsSync(archivo)) {
    escribir(process.stderr, `comprobar-huecos: ROJO — no existe ${nombre}, así que no hay ninguna cita que comprobar.`);
    return 2;
  }
  if (!hayCommit(raiz)) {
    escribir(
      process.stderr,
      `comprobar-huecos: ROJO — este clon no tiene ${COMMIT}. Es un clon superficial (como el de ` +
        '`actions/checkout`): trae el historial con `git fetch --unshallow` y vuelve a correrlo.',
    );
    return 2;
  }

  const leer = lectorDeLaV6(raiz);
  const lineas = readFileSync(archivo, 'utf8').split('\n');

  const entradas = [];
  const conCita = new Set();
  const fallos = [];
  let seccion = '(antes del primer encabezado)';
  let citas = 0;

  lineas.forEach((texto, indice) => {
    const entrada = ENTRADA.exec(texto);
    if (entrada !== null) {
      seccion = `${entrada[1]} \`${entrada[2]}\``;
      entradas.push(seccion);
    } else {
      const encabezado = ENCABEZADO.exec(texto);
      if (encabezado !== null) seccion = encabezado[1];
    }

    for (const mencion of texto.matchAll(MENCION)) {
      if (mencion[2].includes('-')) {
        fallos.push(
          `${seccion} (HUECOS.md:${indice + 1}): \`${COMMIT}:${mencion[1]}:${mencion[2]}\` es un rango; una cita es UNA línea con su fragmento.`,
        );
      } else if (mencion[3] === undefined) {
        fallos.push(
          `${seccion} (HUECOS.md:${indice + 1}): \`${COMMIT}:${mencion[1]}:${mencion[2]}\` no lleva fragmento, así que no se puede comprobar.`,
        );
      }
    }

    for (const cita of texto.matchAll(CITA)) {
      const [, ruta, numero, fragmento] = cita;
      citas += 1;
      conCita.add(seccion);
      const referencia = `${COMMIT}:${ruta}:${numero}`;
      const contenido = leer(ruta);
      if (contenido === null) {
        fallos.push(`${seccion} (HUECOS.md:${indice + 1}): ${referencia} — la ruta no existe en ${COMMIT}.`);
        continue;
      }
      const linea = contenido[Number(numero) - 1];
      if (linea === undefined) {
        fallos.push(
          `${seccion} (HUECOS.md:${indice + 1}): ${referencia} — el archivo tiene ${contenido.length} líneas.`,
        );
        continue;
      }
      if (!linea.includes(fragmento)) {
        fallos.push(
          `${seccion} (HUECOS.md:${indice + 1}): ${referencia} no contiene «${fragmento}». En esa línea hay: «${linea.trim()}».`,
        );
      }
    }
  });

  if (fallos.length > 0) {
    escribir(process.stderr, `comprobar-huecos: ROJO — ${fallos.length} citas no están en su línea o no se pueden comprobar:`);
    for (const fallo of fallos) escribir(process.stderr, `  - ${fallo}`);
  }

  // El centinela: sin citas, o con entradas que no citan nada, no se ha comprobado lo que dice.
  // Va despues de los fallos para no esconderlos: los dos rojos se dicen, y manda el del centinela.
  const sinCita = entradas.filter((una) => !conCita.has(una));
  if (citas === 0) {
    escribir(
      process.stderr,
      `comprobar-huecos: ROJO (centinela) — la extracción no encontró ninguna cita en ${nombre}, ` +
        `y el documento tiene ${entradas.length} entradas. Nada comprobado no es verde.`,
    );
    return 2;
  }
  if (entradas.length === 0 || sinCita.length > 0) {
    escribir(
      process.stderr,
      `comprobar-huecos: ROJO (centinela) — ${entradas.length - sinCita.length} entradas con cita de ${entradas.length} que tiene el documento.` +
        (sinCita.length > 0 ? ` Sin ninguna cita: ${sinCita.join(', ')}.` : ' No se reconoció ninguna entrada `### H…`.'),
    );
    return 2;
  }
  if (fallos.length > 0) return 1;

  escribir(
    process.stdout,
    `comprobar-huecos: verde — ${citas} citas en ${entradas.length} entradas, cada fragmento en su línea de ${COMMIT}.`,
  );
  return 0;
}

process.exitCode = comprobar();
