/* Deriva mecanicamente el archivo de filas del Cuadro de Valores Unitarios Oficiales
   de Edificacion desde el archivo del corpus (H-14, GOB-03; catastro#8).

   NO transcribe nada. La transcripcion es `valores-unitarios-2026.md`, que esta
   VERIFICADO y firmado por dos personas distintas (ADR-0007): la matriz del Anexo I.2
   —la Costa— esta ahi, celda por celda, con el encabezado verbatim del anexo y la
   nota al pie de las tres columnas. Esto solo la PROYECTA a la forma que
   `PublicarCuadros` sabe leer.

   Es el hermano de `derivar-depreciacion.mjs` y se escribio por lo mismo: un CSV a
   mano seria un segundo sitio donde una cifra puede estar mal, y el corpus dejaria
   de ser la unica fuente. `--comprobar` exige en cada PR que el archivo desplegado
   sea exactamente lo que este guion produce hoy desde el corpus.

   UNA SOLA REGION POR EDICION, Y ESTA ES LA COSTA. `valor_unitario_edificacion` no
   tiene columna de region y su unicidad es (publicacion_id, partida, categoria,
   anio_construccion_desde): las cuatro regiones del Anexo I chocarian celda con
   celda dentro de una misma edicion. Con ADR-0017 eso no es un problema sino la
   forma correcta —«cada region es una edicion distinta y el conjunto de una
   municipalidad compone la suya»—, asi que este derivado es el de la Costa (Anexo
   I.2), que es la region del piloto: Catacaos, Piura. Las otras tres estan
   transcritas en §1.5 del mismo archivo y su derivado es otro, el dia que una
   municipalidad de otra region lo necesite.

   LAS CELDAS CON PUNTOS SUSPENSIVOS NO SE PROYECTAN. El cuadro distingue tres cosas
   —una cifra, un `0.00` explicito y una celda con puntos— y §1.1 lo dice: los puntos
   «no son un dato que falte en esta transcripcion ni un cero». La fila sencillamente
   no existe, igual que las celdas `*` de la depreciacion, y quien busque esa
   combinacion tendra que fallar nombrandola en vez de valorizar al 0,00 (#48). De
   las 27 celdas de la matriz salen por eso 24 filas.

   EL TRAMO DE ANO DE CONSTRUCCION ES UNICO Y ABIERTO, Y ESA ES LA LECTURA DEL ANEXO.
   H-4 preguntaba si el cuadro es una matriz categoria x ano de construccion; §3 del
   corpus lo contesta leyendo el Anexo I.2: no lo es —es categoria x partida— y el
   ano de construccion es la entrada de la tabla de DEPRECIACION, que es otra tabla
   con su propia clave. `anio_construccion_desde` es NOT NULL desde V18, asi que el
   tramo unico se escribe con el PISO DEL DOMINIO `ejercicio` (V1: 1990..2100) y sin
   tope. Ese 1990 no es una cifra de la norma —la norma no publica ninguna— sino el
   extremo que el propio esquema admite, y por eso vive aqui y no en el codigo.

   Uso: node derivar-valores-unitarios.mjs [--comprobar]
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CORPUS = fileURLToPath(new URL('../../valores-unitarios-2026.md', import.meta.url));
const SALIDA = fileURLToPath(new URL('valores-unitarios-costa-2026.csv', import.meta.url));

/** Cabecera del derivado. La lee `PublicarCuadros` por POSICION, no por nombre. */
const CABECERA = 'partida,categoria,anio_construccion_desde,anio_construccion_hasta,valor_m2';

/** El titulo de la seccion del corpus que trae la matriz de la Costa. */
const SECCION = '### 1.1 La matriz, cifra por cifra';

/** La siguiente seccion: donde termina de leerse. */
const FIN = '### 1.2';

/**
 * El piso del dominio `ejercicio` de `V1` (1990..2100). NO es una cifra de la norma:
 * el Anexo no publica ninguna dimension de ano de construccion, y esta columna es
 * NOT NULL. Escribir el piso del dominio es la unica forma de decir «sin tope
 * inferior» en una columna que no admite nulo.
 */
const SIN_TRAMO_INFERIOR = '1990';

/**
 * Las tres partidas del anexo, en el orden de sus columnas 1, 2 y 3, con el
 * vocabulario que `valor_unitario_edificacion_partida_check` admite (V1, V59).
 * El orden NO se reordena: es el del cuadro.
 */
const PARTIDAS = ['MUROS', 'TECHOS', 'PUERTAS'];

/** Una celda es una cifra si es un numero; los puntos suspensivos no lo son. */
const CIFRA = /^\d+(?:\.\d+)?$/;

function celdas(linea) {
  return linea
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((celda) => celda.trim());
}

function derivar(markdown) {
  const lineas = markdown.split('\n');
  const desde = lineas.findIndex((l) => l.trim() === SECCION);
  if (desde === -1) {
    throw new Error(`No se encontro «${SECCION}» en el corpus: la matriz no se puede derivar.`);
  }
  const hasta = lineas.findIndex((l, i) => i > desde && l.trim().startsWith(FIN));
  if (hasta === -1) {
    throw new Error(`No se encontro «${FIN}»: sin el, la lectura se comeria otras tablas.`);
  }

  const filas = [];
  const categoriasVistas = new Set();
  for (const linea of lineas.slice(desde, hasta)) {
    const texto = linea.trim();
    if (!texto.startsWith('|')) continue;
    const partes = celdas(texto);
    // La cabecera de la matriz y su separador: se saltan por lo que SON, no por su
    // posicion, para que anadir una linea antes no descoloque la lectura.
    if (partes.length !== PARTIDAS.length + 1) continue;
    const categoria = partes[0];
    if (!/^[A-J]$/.test(categoria)) continue;
    if (categoriasVistas.has(categoria)) {
      throw new Error(`La categoria ${categoria} aparece dos veces en la matriz del corpus.`);
    }
    categoriasVistas.add(categoria);
    PARTIDAS.forEach((partida, columna) => {
      const celda = partes[columna + 1];
      // Los puntos suspensivos del cuadro no son una cifra y no producen fila.
      if (!CIFRA.test(celda)) return;
      filas.push([partida, categoria, SIN_TRAMO_INFERIOR, '', celda].join(','));
    });
  }

  if (categoriasVistas.size === 0) {
    throw new Error('La matriz del corpus no dio ninguna categoria: algo cambio de forma.');
  }
  // El orden del derivado es el del CUADRO —por categoria y, dentro de ella, por
  // columna—, que es como se lee en el anexo. Un orden distinto seria reordenar la
  // norma, que es exactamente lo que la transcripcion prohibe.
  return `${CABECERA}\n${filas.join('\n')}\n`;
}

const derivado = derivar(readFileSync(CORPUS, 'utf8'));

if (process.argv.includes('--comprobar')) {
  const enDisco = readFileSync(SALIDA, 'utf8');
  if (enDisco !== derivado) {
    console.error(
      `${SALIDA} no es lo que este guion produce hoy desde el corpus.\n` +
        'El derivado no se edita: se regenera con `node derivar-valores-unitarios.mjs`.',
    );
    process.exit(1);
  }
  const cuantas = derivado.trim().split('\n').length - 1;
  console.log(`El derivado desplegado es exactamente el del corpus: ${cuantas} fila(s).`);
} else {
  writeFileSync(SALIDA, derivado, 'utf8');
  const cuantas = derivado.trim().split('\n').length - 1;
  console.log(`${SALIDA}: ${cuantas} fila(s) derivadas del corpus.`);
}
