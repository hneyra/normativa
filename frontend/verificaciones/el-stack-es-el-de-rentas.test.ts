// @vitest-environment node
//
// Lee dos archivos del disco. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * **El stack es el de `rentas`, version a version** (#50, decision 5 de la epica #47).
 *
 * Calca `catastro/frontend/verificaciones/el-stack-es-el-de-rentas.test.ts` (`catastro`#115), con
 * dos diferencias: aqui faltan los SEIS `@kamayuk/*` y no cinco, y nada se lee en el cuerpo del
 * modulo.
 *
 * <h2>Por que una guarda, y por que la lista es un DATO escrito aqui</h2>
 *
 * «El mismo stack que `rentas`» no es «parecido»: son las mismas dependencias con los mismos
 * rangos, porque la interfaz de `normativa` se reconstruye sobre la misma libreria
 * (`kamayuk-lib`) y un `@kamayuk/ui` probado contra `react 19.3.0` no esta probado contra otra
 * cosa. Y esa igualdad **se pierde sin ruido**: un `yarn add` de comodidad, un rango subido para
 * arreglar un aviso, una dependencia que se quita porque «aqui todavia no se usa» —y hoy no se usa
 * casi ninguna—. Ninguna de las tres rompe nada en el momento, y las tres hacen que «funciona en
 * `rentas`» deje de decir algo de aqui.
 *
 * La lista **no se lee del clon de `rentas`**, y es a proposito: la CI de este repositorio no
 * clona `rentas` y no tiene por que. Una guarda que dependiera de ese clon sacaria un rojo que
 * habla de un directorio que falta, y peor, se moveria sola cada vez que `rentas` mezclara un PR.
 *
 * Asi que se escribe aqui, **con el `sha` del que se copio**, y cambiarla es un acto deliberado:
 * un PR que lo diga, con el `sha` nuevo y la lista nueva juntos. Si el stack de `rentas` cambia,
 * se sigue, pero nunca en silencio.
 *
 * <h2>Lo que queda fuera, y hasta cuando</h2>
 *
 * **Los cinco `@kamayuk/*` de ejecucion ya estan**: los enchufo #55, junto con `preserveSymlinks`,
 * `resolucion.ts`, los `@source` de `src/estilos.css` y el contexto con nombre de la imagen. Ese
 * dia esta prueba salio roja —«@kamayuk/api entra con #55»— y ese PR los movio de
 * {@link ENTRAN_DESPUES} a la lista, que es exactamente lo que esta guarda existe para obligar.
 *
 * El que queda es `@kamayuk/verificaciones`, y entra con #62: es cuando las prohibiciones dejan de
 * ser las diez propias. Sigue en {@link ENTRAN_DESPUES} con su issue, y **tambien es parte de la
 * guarda**: el dia que entre, esto se pone rojo y ese PR lo mueve.
 */

/** De donde se copio la lista. Cambiarlo es cambiar la lista, en el mismo PR. */
const RENTAS_EN = 'ac379ac2d1fbcc45914d1246f600ee5ff5a2eb71';

type Seccion = 'dependencies' | 'devDependencies';

/**
 * `rentas/frontend/package.json` en {@link RENTAS_EN}, seccion a seccion y rango a rango, **menos**
 * el de {@link ENTRAN_DESPUES}.
 */
const EL_STACK_DE_RENTAS: Readonly<Record<Seccion, Readonly<Record<string, string>>>> = {
  dependencies: {
    '@hookform/resolvers': '^5.2.0',
    // Los cinco de ejecucion, enchufados en #55: son el `link:` al clon hermano, con la ruta
    // letra por letra la de `rentas`. Tres rutas a tres sitios distintos serian tres
    // dependencias que mantener y no una, y eso lo vigila `enlace-con-kamayuk-lib`.
    '@kamayuk/api': 'link:../../kamayuk-lib/paquetes/api',
    '@kamayuk/formato': 'link:../../kamayuk-lib/paquetes/formato',
    '@kamayuk/sesion': 'link:../../kamayuk-lib/paquetes/sesion',
    '@kamayuk/shell': 'link:../../kamayuk-lib/paquetes/shell',
    '@kamayuk/ui': 'link:../../kamayuk-lib/paquetes/ui',
    '@tanstack/react-query': '^5.102.8',
    'class-variance-authority': '^0.7.1',
    clsx: '^2.1.1',
    cmdk: '^1.1.1',
    i18next: '^26.4.2',
    'radix-ui': '^1.6.7',
    react: '19.3.0',
    'react-day-picker': '^10.0.1',
    'react-dom': '19.3.0',
    'react-hook-form': '^7.88.0',
    'react-i18next': '^17.0.13',
    'react-router-dom': '^7.18.3',
    sonner: '^2.0.8',
    'tailwind-merge': '^3.6.0',
    zod: '^4.6.2',
  },
  devDependencies: {
    '@eslint/js': '^9.39.0',
    '@playwright/test': '^1.63.0',
    '@tailwindcss/vite': '^4.3.3',
    '@testing-library/dom': '^10.4.0',
    '@testing-library/jest-dom': '^6.9.0',
    '@testing-library/react': '^16.3.0',
    '@testing-library/user-event': '^14.6.0',
    '@types/node': '^22.15.0',
    '@types/react': '^19.2.0',
    '@types/react-dom': '^19.2.0',
    '@vitejs/plugin-react': '^5.0.0',
    eslint: '^9.39.0',
    'eslint-plugin-jsx-a11y': '^6.10.2',
    'eslint-plugin-react-hooks': '^5.2.0',
    globals: '^16.0.0',
    'i18next-cli': '^1.73.2',
    jsdom: '^26.1.0',
    tailwindcss: '^4.3.3',
    typescript: '~5.9.0',
    'typescript-eslint': '^8.46.0',
    vite: '^7.1.0',
    vitest: '^3.2.0',
  },
};

/** Los que `rentas` declara y aqui entran despues, cada uno con su seccion, su rango y su issue. */
const ENTRAN_DESPUES: Readonly<
  Record<string, { readonly seccion: Seccion; readonly rango: string; readonly issue: string }>
> = {
  // Uno solo desde #55, y es el que NO entra en el paquete: trae las prohibiciones de ESLint, que
  // aqui siguen siendo las DIEZ propias. La lista de la libreria lleva los nombres de importe de
  // `rentas` y no tiene `cifra-tributaria-literal` —la novena, que es de este repositorio—, asi
  // que adoptarla hoy debilitaria el lint. Es la diferencia deliberada de la epica #47.
  '@kamayuk/verificaciones': {
    seccion: 'devDependencies',
    rango: 'link:../../kamayuk-lib/paquetes/verificaciones',
    issue: '#62',
  },
};

/** El motor que `rentas` declara en `engines.node`, en el mismo `sha`. */
const EL_MOTOR_DE_RENTAS = '>=22';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

interface Manifiesto {
  readonly engines?: { readonly node?: string };
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

/**
 * El manifiesto, leido CUANDO SE LLAMA. Nunca en el cuerpo del modulo: un `package.json` que
 * falta o no parsea reventaria la recoleccion y el rojo hablaria de `readFileSync` en vez de la
 * prueba que lo necesitaba.
 */
const elManifiesto = () =>
  JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as Manifiesto;

/** Lo que difiere entre dos secciones, dicho dependencia a dependencia y con los dos rangos. */
function diferencias(
  seccion: Seccion,
  aqui: Readonly<Record<string, string>>,
  alla: Readonly<Record<string, string>>,
): string[] {
  const salida: string[] = [];
  for (const [nombre, rango] of Object.entries(aqui)) {
    const deRentas = alla[nombre];
    if (deRentas === undefined) {
      salida.push(`  + ${seccion}: «${nombre}» «${rango}» esta aqui y no en rentas`);
    } else if (deRentas !== rango) {
      salida.push(`  ~ ${seccion}: «${nombre}» pide «${rango}» aqui y «${deRentas}» en rentas`);
    }
  }
  for (const [nombre, rango] of Object.entries(alla)) {
    if (aqui[nombre] === undefined) {
      salida.push(`  - ${seccion}: «${nombre}» «${rango}» esta en rentas y no aqui`);
    }
  }
  return salida;
}

describe(`el stack es el de rentas@${RENTAS_EN.slice(0, 7)}, version a version`, () => {
  it('EL CENTINELA: la lista dice algo, el manifiesto se leyo, y no se contradicen', () => {
    // Sin esto, una lista vaciada por error dejaria la comparacion de abajo exigiendo que
    // `package.json` no declare nada — y el rojo hablaria de todas las dependencias a la vez.
    const entradas =
      Object.keys(EL_STACK_DE_RENTAS.dependencies).length +
      Object.keys(EL_STACK_DE_RENTAS.devDependencies).length;
    expect(entradas, 'la lista de rentas tiene 43 entradas; con 35 o menos alguien la vacio').toBeGreaterThan(35);
    // Un `sha` completo: uno corto se vuelve ambiguo con el tiempo, y entonces ya no dice de donde.
    expect(RENTAS_EN).toMatch(/^[0-9a-f]{40}$/);
    // Y el manifiesto se leyo de verdad, aqui dentro: un objeto vacio haria que la comparacion de
    // abajo saliera roja por TODO, y uno que no es este paquete la haria salir por nada.
    expect(elManifiesto()).toMatchObject({ name: '@kamayuk/normativa-web' });
    const enLasDos = Object.keys(ENTRAN_DESPUES).filter(
      (nombre) =>
        nombre in EL_STACK_DE_RENTAS.dependencies || nombre in EL_STACK_DE_RENTAS.devDependencies,
    );
    expect(enLasDos, 'un paquete no puede estar a la vez en la lista y en lo que entra despues').toEqual([]);
  });

  it('ninguna dependencia se anade, se quita ni cambia de rango', () => {
    const manifiesto = elManifiesto();
    const todas = [
      ...diferencias('dependencies', manifiesto.dependencies ?? {}, EL_STACK_DE_RENTAS.dependencies),
      ...diferencias(
        'devDependencies',
        manifiesto.devDependencies ?? {},
        EL_STACK_DE_RENTAS.devDependencies,
      ),
    ];
    expect(
      todas,
      `«frontend/package.json» ya no declara el stack de rentas@${RENTAS_EN.slice(0, 7)}:\n` +
        `${todas.join('\n')}\n\n` +
        '  La decision 5 de la epica #47 es el MISMO stack, no uno parecido. Si rentas cambio el\n' +
        '  suyo, se sigue: se actualiza la lista de este archivo con el sha nuevo, en un PR que lo\n' +
        '  diga. Si el cambio es solo de aqui, no entra.',
    ).toEqual([]);
  });

  it('y el @kamayuk/* que falta no entra antes de su issue', () => {
    // Es la misma guarda que la de arriba —uno de estos anadido sale alli como «+»—, pero con el
    // remedio que le toca: no es un desvio de rentas sino el trabajo de otro issue empezado aqui.
    const manifiesto = elManifiesto();
    const adelantados = Object.entries(ENTRAN_DESPUES)
      .filter(
        ([nombre]) =>
          manifiesto.dependencies?.[nombre] !== undefined ||
          manifiesto.devDependencies?.[nombre] !== undefined,
      )
      .map(([nombre, { issue }]) => `  ${nombre} entra con ${issue}`);
    expect(
      adelantados,
      'Un @kamayuk/* llego antes que el issue que lo enchufa:\n' +
        `${adelantados.join('\n')}\n\n` +
        '  `@kamayuk/verificaciones` cambia de donde salen las prohibiciones: las diez propias\n' +
        '  pasan a derivarse de la libreria (#62), y su lista no tiene `cifra-tributaria-literal`.\n' +
        '  Ese PR lo mueve de ENTRAN_DESPUES a la lista, como #55 hizo con los cinco de ejecucion.',
    ).toEqual([]);
  });

  it('el motor es el de rentas', () => {
    expect(
      elManifiesto().engines?.node,
      `«engines.node» tiene que ser «${EL_MOTOR_DE_RENTAS}», el de rentas@${RENTAS_EN.slice(0, 7)}.`,
    ).toBe(EL_MOTOR_DE_RENTAS);
  });

  it('y el gestor es yarn classic, con su candado v1', () => {
    // Un `package-lock.json` al lado, o un `yarn.lock` reescrito por yarn berry, son dos
    // resoluciones distintas del mismo manifiesto: «las mismas versiones que rentas» dejaria de
    // significar lo mismo en cuanto alguien instalara con la otra herramienta.
    const candado = readFileSync(join(RAIZ, 'yarn.lock'), 'utf8');
    expect(candado.split('\n').slice(0, 3).join('\n')).toContain('# yarn lockfile v1');
  });
});
