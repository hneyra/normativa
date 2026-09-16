import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { PROHIBICIONES } from './eslint.prohibiciones.mjs';

/**
 * Reglas de ESLint del frontend de `normativa`.
 *
 * Mismo criterio que en el backend (ARQ-04) y que en `infrastructure/infra/`: **toda
 * prohibicion que pueda expresarse como verificacion automatica se expresa asi.** Una
 * prohibicion que solo vive en un documento se incumple en seis meses, y nadie se entera
 * hasta que hay que arreglar veinte sitios.
 *
 * Las prohibiciones NO estan aqui: estan en `eslint.prohibiciones.mjs`, porque las lee
 * tambien `verificaciones/reglas-de-eslint.test.ts`, que exige de cada una su muestra que
 * la viola. **Una regla que no puede fallar no protege nada.**
 *
 * Desde #50 este archivo es el de `rentas@ac379ac` con el nombre de este sistema, y desde #62
 * tambien lo es de donde salen las prohibiciones: `eslint.prohibiciones.mjs` las DERIVA de
 * `@kamayuk/verificaciones`. Las dos diferencias que quedan con `rentas` estan medidas en la
 * cabecera de aquel archivo: cuantas se encienden —diez aqui y nueve alli, porque este sistema
 * enciende `cifra-tributaria-literal`— y que aqui `fetch` no se exceptua en ningun directorio.
 */

/** Las prohibiciones que valen en todo el arbol. */
const EN_TODAS_PARTES = PROHIBICIONES.map(({ selector, message }) => ({ selector, message }));

/**
 * Las excepciones, una por directorio exceptuado.
 *
 * Se derivan de los `salvo` en vez de escribirse: una excepcion escrita a mano se olvida
 * de la prohibicion que se anadio ayer, y la deja apagada en un directorio entero.
 *
 * **Cada `salvo` es una LISTA de prefijos desde #50**, como en `rentas` (`rentas`#137) y en
 * `@kamayuk/verificaciones`: este bloque es el de `rentas@ac379ac`. Con la cadena que
 * `normativa` tenia hasta `c01fe9a`, `includes` buscaba una SUBCADENA y no un elemento; cuales
 * son los prefijos de aqui lo dice `DONDE_SE_LLAMA_A_FETCH`, en `eslint.prohibiciones.mjs`.
 *
 * **Y desde #62 esa lista esta VACIA**, asi que aqui no se monta ni un bloque de excepcion: este
 * frontend no tiene cliente de API propio —lo pone `@kamayuk/api` (#55)— y no queda un solo
 * `fetch` en `src/` (#57). El codigo se deja tal cual y no se simplifica: lo que decide si hay
 * bloques o no es el dato, no este archivo, y el dia que aparezca un sitio donde `fetch` sea
 * legitimo se declara alli y aqui no se toca nada.
 */
const EXCEPCIONES = [...new Set(PROHIBICIONES.flatMap((p) => p.salvo ?? []))];

/** @type {import('eslint').Linter.Config[]} */
const bloquesDeExcepcion = EXCEPCIONES.map((directorio) => ({
  files: [`${directorio}**/*.{ts,tsx}`],
  rules: {
    'no-restricted-syntax': [
      'error',
      ...PROHIBICIONES.filter((p) => !(p.salvo ?? []).includes(directorio)).map(
        ({ selector, message }) => ({ selector, message }),
      ),
    ],
  },
}));

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.ts',
      // Violan las reglas a proposito. Se lintan desde la prueba, con su texto y una ruta
      // sintetica dentro de `src/`, que es donde la regla tiene que aplicar de verdad.
      'verificaciones/muestras/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'no-restricted-syntax': ['error', ...EN_TODAS_PARTES],
    },
  },

  ...bloquesDeExcepcion,

  {
    // `public/` es codigo de NAVEGADOR que Vite copia tal cual, sin transformar ni empaquetar:
    // no es un modulo, no pasa por TypeScript y por eso no lo alcanza el bloque de arriba, que
    // solo mira `.ts`/`.tsx`. Sin esta linea `window` sale como `no-undef`.
    //
    // Se le dan globales de navegador y NO se mete en `ignores`, a proposito: `configuracion.js`
    // es lo primero que ejecuta la pagina —antes que el paquete— y un error de sintaxis ahi deja
    // la aplicacion entera en blanco. Es justo el archivo que mas conviene que alguien revise.
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  },

  {
    // Las pruebas y los arneses corren en Node y hablan DE las prohibiciones: una prueba
    // que no puede escribir `municipalidadId` no puede comprobar que esta prohibido.
    //
    // `verificaciones/*.ts` y no `verificaciones/**/*.ts`: un comodin de dos niveles se
    // llevaria por delante `verificaciones/muestras/`, y entonces las muestras dejarian de
    // violar nada a ojos de `yarn lint`. Hoy no se lintan porque estan en `ignores`; si
    // manana alguien quita esa linea, tienen que ponerse ROJAS, no pasar en silencio.
    files: ['**/*.test.{ts,tsx}', 'verificaciones/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off' },
  },
);
