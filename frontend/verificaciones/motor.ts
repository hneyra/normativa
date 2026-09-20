/**
 * **Los motores de Node que este arbol declara, y la distancia con la libreria** (#90).
 *
 * Vive aparte de su prueba —como `enlace.ts`— para que las muestras puedan ejercer cada regla
 * sobre disposiciones INVENTADAS: un `.nvmrc` que no cumple lo prometido, un `Dockerfile` con
 * otra mayor, un paquete enlazado que pide mas de lo que aqui se corre. Sobre el disco de verdad
 * esas tres cosas no pasan hoy, y una guarda que solo pudiera mirar el disco de verdad seria una
 * guarda que nunca se ha visto morder.
 *
 * <h2>Que problema es este, medido</h2>
 *
 * Este frontend dice la version de Node en TRES sitios, y ninguno comprobaba a los otros:
 *
 *   · `package.json` la **promete** (`engines.node`), y con `.npmrc` esa promesa muerde al instalar;
 *   · `.nvmrc` **elige** una concreta, y de ahi la toma la CI (`node-version-file`);
 *   · el `Dockerfile` **corre** el `yarn build` que se publica, sobre `FROM node:<mayor>-alpine`.
 *
 * El tercero estaba atado a los otros dos por un COMENTARIO —«la version mayor es la que
 * `frontend.yml` declara»— que ademas ya no era cierto: `frontend.yml` no declara ninguna, la lee
 * de `.nvmrc`. Un comentario no sale rojo.
 *
 * <h2>Y la cuarta, que no es de este arbol: lo que pide la libreria</h2>
 *
 * `kamayuk-lib` subio su raiz a `>=24` el 2026-09-16 (`kamayuk-lib`#90, PR #91) y este frontend
 * siguio prometiendo `>=22` cuatro dias, con lo que **lo que se enlaza exigia un motor que esta
 * CI no usaba**. Lo cerro la decision del dueno del 2026-09-20 (#90): este arbol se alinea a Node
 * 24, y los tres sitios de arriba dicen 24 desde entonces.
 *
 * Que se alineen HOY no es lo que cuesta: es que sigan alineados. Por eso la cuarta regla guarda
 * lo que la raiz de la libreria pedia cuando se midio, y sale roja cuando se mueva — pidiendo que
 * alguien vuelva a MEDIR, no que alguien copie el numero nuevo. Y la tercera mira lo que de
 * verdad viaja por el `link:`: el dia que un paquete ENLAZADO declare un rango que la version del
 * `.nvmrc` no cumpla, sale roja nombrandolo, que es el aviso que no existio en septiembre.
 */

/** Lo que un paquete enlazado pide, ya leido de su `package.json`. */
export interface MotorDeUnPaquete {
  /** El nombre tal como se importa: `@kamayuk/ui`. */
  readonly paquete: string;
  /** Su `engines.node`, o `undefined` si no declara ninguno — que es el caso de los seis hoy. */
  readonly pide: string | undefined;
}

/** Los cuatro sitios donde hay una version de Node, ya leidos del disco. */
export interface Motores {
  /** `engines.node` de `frontend/package.json`: lo que este frontend PROMETE. */
  readonly promete: string;
  /** `.nvmrc`: la version que se ELIGE, y de la que sale la de la CI. */
  readonly elige: string;
  /** La etiqueta del `FROM node:…` del `Dockerfile`, o `undefined` si ya no construye con node. */
  readonly imagen: string | undefined;
  /** Lo que pide cada `@kamayuk/*` enlazado. */
  readonly enlazados: readonly MotorDeUnPaquete[];
  /** `engines.node` de la RAIZ del clon hermano, o `undefined` si no lo declara o no esta. */
  readonly libreria: string | undefined;
}

/** Un sitio que dice algo distinto de los demas, con que hacer al respecto. */
export interface Desacuerdo {
  readonly donde: string;
  readonly que: string;
  readonly remedio: string;
}

/**
 * **La UNICA forma de rango que esta guarda sabe leer**, y el motivo de que sea una sola.
 *
 * Los seis manifiestos del producto escriben `>=22` o `>=24`, y nada mas. Un lector de rangos de
 * semver completo —`^24 || >=22.5 <23`— tendria que ADIVINAR, y lo que se juega es autorizar un
 * motor que nadie ha medido. Asi que lo que no cuadra con esto no se interpreta: sale rojo y lo
 * lee una persona, que es exactamente el acto que este issue pide que no se salte nadie.
 */
const SOLO_MAYOR_O_IGUAL = /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/** Una version a secas: `22`, `22.14` o `22.14.0`. */
const UNA_VERSION = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/** Las tres cifras de una coincidencia, con `0` donde no se escribio ninguna. */
function cifras(encontrado: RegExpExecArray): [number, number, number] {
  return [Number(encontrado[1] ?? 0), Number(encontrado[2] ?? 0), Number(encontrado[3] ?? 0)];
}

/**
 * Si `version` cumple `rango`. **`null` quiere decir «no se sabe leer»**, y no «no cumple»:
 * son dos rojos distintos y el remedio de cada uno es otro.
 */
export function cumple(version: string, rango: string): boolean | null {
  const pedido = SOLO_MAYOR_O_IGUAL.exec(rango.trim());
  const tengo = UNA_VERSION.exec(version.trim());
  if (pedido === null || tengo === null) return null;
  const [mayorPedida, menorPedida, parchePedido] = cifras(pedido);
  const [mayor, menor, parche] = cifras(tengo);
  if (mayor !== mayorPedida) return mayor > mayorPedida;
  if (menor !== menorPedida) return menor > menorPedida;
  return parche >= parchePedido;
}

/** La mayor de una version o de una etiqueta de imagen (`22.14.0`, `22-alpine`), o `null`. */
export function mayorDe(texto: string): number | null {
  const encontrado = /^v?(\d+)/.exec(texto.trim());
  return encontrado === null ? null : Number(encontrado[1]);
}

/**
 * La etiqueta del `FROM node:…` de un `Dockerfile`, tal cual: `22-alpine`.
 *
 * Se toma la PRIMERA: la etapa de construccion es la que corre `yarn build`, y las demas —hoy
 * `nginx:1.31.5-alpine`— no son node y no las alcanza esta expresion.
 */
export function laImagenDeNode(dockerfile: string): string | undefined {
  return /^FROM\s+node:(\S+)/m.exec(dockerfile)?.[1];
}

/**
 * Todo lo que no cuadra, sitio por sitio.
 *
 * @param motores lo leido del disco.
 * @param laLibreriaPedia lo que la raiz del clon hermano pedia la ultima vez que alguien MIDIO
 *   este arbol con los dos motores. No es una preferencia: es la fecha de una medicion.
 */
export function desacuerdos(motores: Motores, laLibreriaPedia: string): Desacuerdo[] {
  const salida: Desacuerdo[] = [];
  const { promete, elige, imagen, enlazados, libreria } = motores;

  // 1. LO QUE SE ELIGE CUMPLE LO QUE SE PROMETE. Sin esto, subir `engines` y olvidar `.nvmrc`
  //    deja la CI corriendo un motor que el propio manifiesto declara insuficiente — y con
  //    `engine-strict` eso revienta al instalar, dos pasos despues y hablando de otra cosa.
  const elegidaVale = cumple(elige, promete);
  if (elegidaVale === null) {
    salida.push({
      donde: '.nvmrc contra engines.node',
      que: `no se sabe leer «${elige}» contra «${promete}».`,
      remedio:
        'Esta guarda solo lee rangos de la forma «>=N», que es la unica que escriben los seis\n' +
        '  manifiestos del producto. Si hace falta otra, se ensena aqui con su muestra: adivinarla\n' +
        '  seria autorizar un motor que nadie midio.',
    });
  } else if (!elegidaVale) {
    salida.push({
      donde: '.nvmrc',
      que: `elige Node ${elige}, y este package.json promete «${promete}».`,
      remedio:
        'Los dos se mueven juntos: `engines` acota y `.nvmrc` elige. Con `engine-strict=true`\n' +
        '  el desacuerdo sale como un fallo de `yarn install` que habla de versiones, no de esto.',
    });
  }

  // 2. Y LA IMAGEN CORRE ESA MISMA MAYOR. Es donde se ejecuta el `yarn build` que se publica:
  //    si se separa, «verde en CI» y «lo que se sirve» dejan de construirse con lo mismo.
  if (imagen === undefined) {
    salida.push({
      donde: 'Dockerfile',
      que: 'no hay ningun `FROM node:…`.',
      remedio:
        'La etapa de construccion es la que corre `yarn build` para la imagen que se publica.\n' +
        '  Si dejo de ser una imagen de node, esta regla hay que volver a escribirla.',
    });
  } else {
    const deLaImagen = mayorDe(imagen);
    const elegida = mayorDe(elige);
    if (deLaImagen === null || elegida === null || deLaImagen !== elegida) {
      salida.push({
        donde: 'Dockerfile',
        que: `construye sobre «node:${imagen}» y «.nvmrc» elige «${elige}».`,
        remedio:
          'El bundle que se sirve sale de esa imagen, no de la CI. Hasta #90 los dos estaban\n' +
          '  atados por un comentario, y un comentario no sale rojo.',
      });
    }
  }

  // 3. LA DISTANCIA QUE IMPORTA: un paquete ENLAZADO que pide mas de lo que aqui se corre.
  //    Hoy ninguno de los seis declara `engines`, asi que este bucle no dice nada — y es
  //    justamente lo que el centinela de la prueba afirma, para que «nada que decir» no se
  //    confunda con «no hay nada que mirar».
  for (const { paquete, pide } of enlazados) {
    if (pide === undefined) continue;
    const vale = cumple(elige, pide);
    if (vale === true) continue;
    salida.push({
      donde: paquete,
      que:
        vale === null
          ? `pide «${pide}», y esta guarda no sabe leer ese rango.`
          : `pide «${pide}» y aqui se corre Node ${elige}.`,
      remedio:
        'Esto ya no es contabilidad: lo que este frontend ENLAZA pide un motor que este frontend\n' +
        '  no corre. Hay que medir `yarn verificar` y `yarn build` con el motor que el paquete pide\n' +
        '  y decidir —con el stack de `rentas`, que es la referencia— si este arbol sube.',
    });
  }

  // 4. Y EL CENTINELA DE LA DISTANCIA: lo que la raiz de la libreria pide hoy es lo que este
  //    archivo tiene escrito. Cuando se mueva, lo que hace falta no es subir un numero: es
  //    volver a medir los dos motores, que es lo que #90 hizo y lo unico que decide.
  if (libreria !== laLibreriaPedia) {
    salida.push({
      donde: 'kamayuk-lib (la raiz del clon hermano)',
      que: `pide «${libreria ?? 'nada'}», y aqui esta escrito «${laLibreriaPedia}».`,
      remedio:
        'La libreria movio el motor de su repositorio. Su trabajo `consumidores` corre el\n' +
        '  `yarn verificar` DE ESTE ARBOL con esa version, asi que antes de tocar el numero de aqui\n' +
        '  se mide la suite con ella y se escribe el resultado, como hizo #90.',
    });
  }

  return salida;
}
