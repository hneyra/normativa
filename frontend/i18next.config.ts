import { defineConfig } from 'i18next-cli';

/**
 * **La extraccion de claves** (#60).
 *
 * Calcado de `rentas/frontend/i18next.config.ts@ac379ac`, con la unica diferencia que este
 * repositorio impone: las cuentas son las de `normativa` —una hoja de ruta de cuatro pantallas, no
 * de cuarenta—, y ninguna se escribe aqui.
 *
 * <h2>Que extrae, y de donde</h2>
 *
 * Todo lo que pase por `t(...)` en `src/`. Con el castellano como clave, lo que sale es
 * directamente **la lista que un traductor recibe**: frases en castellano, no identificadores que
 * alguien tendria que descifrar.
 *
 * <h2>Lo que NO puede extraer, y por que eso no es un defecto</h2>
 *
 * Las pantallas de este sistema son **dato** —`src/pantallas/definiciones/*.ts`— y el interprete de
 * `@kamayuk/ui` las traduce por variable: `traducir(campo.etiqueta)`. Ninguna extraccion estatica
 * puede seguir eso. Por eso el inventario del locale **se deriva del dato** en
 * `src/i18n/catalogo-de-claves.ts`, y esta herramienta solo cubre lo que si esta escrito como una
 * llamada con la frase dentro. Las dos mitades juntas son lo que
 * `verificaciones/el-locale-esta-completo.test.ts` compara contra `es.json`.
 *
 * <h2>Por que `es.json` se llena, si i18next devolveria la clave igualmente</h2>
 *
 * Porque sin el no hay nada que sincronizar: un segundo idioma se hace **copiando `es.json` y
 * traduciendo los valores**, y con el archivo vacio no habria de donde copiar. Ese es el andamiaje
 * que la epica #47 pide, y todo lo que pide.
 *
 * El riesgo de tener el castellano dos veces —en la definicion y en el locale— lo cierra la tercera
 * prueba de `el-locale-esta-completo`: **cada valor tiene que ser igual a su clave**, salvo las
 * formas plurales, que no pueden serlo. Asi el locale no puede divergir del artboard V8 sin ponerse
 * rojo, y `verificaciones/pantallas-del-artboard.test.ts` sigue comparando contra el artboard las
 * mismas cadenas en castellano que ahora son claves.
 */
export default defineConfig({
  locales: ['es'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/i18n/locales/{{language}}.json',
    // La clave ES el castellano: lleva puntos, dos puntos y comas dentro. Con los separadores
    // puestos, «Nada se escribe hasta que pulse Guardar.» se partiria por el punto.
    keySeparator: false,
    nsSeparator: false,
    // Sin entrada, el valor es la propia clave. Es lo que hace que `es.json` no pueda divergir.
    defaultValue: (_locale: string, _ns: string, clave: string) => clave,
    // Ordenadas: un diff de este archivo tiene que decir que cadena cambio, no que todo se movio.
    sort: true,
  },
});
