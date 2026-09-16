import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './locales/es.json' with { type: 'json' };

/**
 * **El castellano es la clave** (#60), calcado de `rentas/frontend/src/i18n/i18n.ts@ac379ac`.
 *
 * <h2>La decision, y la tension que resuelve</h2>
 *
 * `verificaciones/pantallas-del-artboard.test.ts` compara las cuatro definiciones **campo por campo
 * y literal** contra `diseno/NormativaV8.dc.html`. Es la guarda que hace cierto «debe lucir
 * identico», y el AC 7 de este issue exige que siga comparando **las cadenas en castellano**.
 *
 * Con claves opacas —`'nor-panel.b0.c4'`— esa comparacion muere: compararia claves contra
 * castellano. Y ensenandola a resolver, sus rojos pasarian de decir
 *
 *     bloque 0 · campo 4: «Qué se puede hacer» tipo «r1»
 *
 * a decir «nor-panel.b0.c4», que es mucho peor de leer justo cuando mas falta hace.
 *
 * Asi que la clave **es** el castellano. `t('Qué se puede hacer')`. La guarda queda intacta, el
 * artboard sigue siendo la fuente de verdad, y **un segundo idioma es un JSON** que mapea
 * castellano → destino. Ese es el andamiaje, y es todo: la epica #47 deja fuera cualquier segundo
 * idioma, y este issue instala la costura.
 *
 * <h2>El coste conocido de esta forma, y quien lo cubre</h2>
 *
 * Cambiar el castellano **pierde su traduccion**, porque la clave cambia. Eso lo cubre
 * `i18next-cli`, que informa de las claves que el codigo usa y el locale no tiene — y que corre
 * dentro de `yarn verificar`, no como un paso que alguien se acuerda de ejecutar.
 *
 * <h2>Los idiomas que hay, y el que no es un idioma</h2>
 *
 * · **`es`** — el de verdad. Su JSON tiene una entrada por clave con **el mismo castellano** al
 *   otro lado, y no es redundancia: es de donde se copia el segundo idioma. Que no pueda decir otra
 *   cosa lo cierra la tercera prueba de `el-locale-esta-completo`.
 * · **`marcado`** — no es un idioma: es el arnes de la guarda de cobertura. Envuelve TODO lo que
 *   traduce entre `⟦` y `⟧`, de modo que lo que llegue al DOM sin marcar es texto que se escapo de
 *   `t()`. Ver `verificaciones/todo-el-texto-se-traduce.test.tsx`.
 *
 * <h2>Por que el marcado es un POST-PROCESADOR y no un «no encontre la clave»</h2>
 *
 * Es la leccion que `rentas` dejo escrita en este mismo docblock, y viaja porque el defecto viaja:
 * su primera version lo hacia con `parseMissingKeyHandler`, y funciono **hasta que el locale se
 * lleno**. Con las entradas puestas, i18next las encuentra por el idioma de reserva y ese gancho
 * **no se llama nunca**. El sintoma fue el peor posible — la guarda paso de verde a rojo diciendo
 * que todo se escapaba, cuando lo que se habia roto era el arnes.
 *
 * Un post-procesador corre **sobre lo que ya se tradujo**, venga de donde venga. Es lo unico que
 * mide lo que se queria medir: no «que claves faltan» sino **que texto paso por `t()`**.
 */

/** Lo que envuelve el locale de prueba. No son caracteres que ninguna pantalla use. */
export const ABRE = '⟦';
export const CIERRA = '⟧';

export const IDIOMA_POR_OMISION = 'es';

/** El locale que marca todo, para que la guarda pueda ver lo que NO paso por `t()`. */
export const IDIOMA_MARCADO = 'marcado';

/**
 * Envuelve lo traducido cuando el idioma es el de marcado. En cualquier otro, no toca nada.
 *
 * `postProcess` se declara en la configuracion y no en cada llamada: si hubiera que acordarse de
 * pedirlo en cada `t()`, la cadena que alguien olvidara seria justo la que la guarda no veria.
 */
const marcador = {
  type: 'postProcessor' as const,
  name: 'marcar',
  process: (valor: string) =>
    i18next.language === IDIOMA_MARCADO ? `${ABRE}${valor}${CIERRA}` : valor,
};

await i18next
  .use(initReactI18next)
  .use(marcador)
  .init({
    lng: IDIOMA_POR_OMISION,
    fallbackLng: IDIOMA_POR_OMISION,
    // Sin espacios de nombre ni separadores: la clave es una frase en castellano y lleva puntos,
    // dos puntos y comas dentro. Con los separadores puestos, «Nada se escribe hasta que pulse
    // Guardar.» se partiria por el punto y la traduccion no se encontraria nunca.
    keySeparator: false,
    nsSeparator: false,
    resources: { es: { translation: es } },
    interpolation: { escapeValue: false },
    postProcess: ['marcar'],
  });

/**
 * **Traducir desde fuera de React**, que aqui hace falta mas que en `rentas`.
 *
 * `rentas` traduce casi todo con `useTranslation()` porque casi todo lo que dibuja cuelga de un
 * componente suyo. Aqui hay dos sitios donde no hay componente y sigue habiendo texto que una
 * persona lee:
 *
 * · **Las costuras que `src/aplicacion.tsx` consume como CONSTANTES** —`marca.ts`, `sesion.ts`,
 *   `catalogo.ts`, `i18n/armazon.ts`—. Ese archivo lo toca solo #55 (epica #47) y
 *   `verificaciones/la-costura-es-la-que-es.test.ts` da rojo si importa `react-i18next`, asi que no
 *   hay ningun `useTranslation()` que pueda envolverlas.
 * · **Los manejadores de `src/acciones.ts`**, que corren al pulsar y no al pintar.
 *
 * `i18next.t` lee el idioma **en el momento de la llamada**, asi que usarla aqui no congela nada:
 * lo que se congelaria es guardar su RESULTADO en una constante de modulo. Ver
 * {@link alCambiarElIdioma}, que es lo que impide justo eso.
 *
 * <h2>Y por que la firma es estrecha y no `typeof i18next.t`</h2>
 *
 * Porque `TFunction` lleva una marca de tipo —`$TFunctionBrand`— y acepta arreglos de claves,
 * espacios de nombre y opciones que aqui no se usan. Atar las costuras a esa firma las ata a la
 * version de i18next: lo que este sistema necesita es «una clave en castellano, y los datos que
 * lleve dentro».
 */
export const t = (clave: string, datos?: Readonly<Record<string, unknown>>): string =>
  i18next.t(clave, datos);

/**
 * **Rehacer lo que se tradujo al importar, cada vez que cambia el idioma.**
 *
 * Existe por una sola razon medida, y conviene dejarla escrita: tres de las cosas que
 * `src/aplicacion.tsx` pasa al `Armazon` son **cadenas sueltas** —`titulo`, `entidad` y
 * `pieDelCarril`—, no objetos. Una propiedad de un objeto se puede traducir al LEERLA, con un
 * captador; una cadena exportada, no: lo que se exporta es su valor.
 *
 * Asi que esas tres se exportan con `let` y se rehacen aqui. `aplicacion.tsx` las lee **dentro** de
 * su funcion de pintada, y un `import` de ESM es un enlace vivo: la siguiente pintada ve el valor
 * nuevo sin que ese archivo cambie ni una linea.
 *
 * **Lo que esto NO hace, dicho aqui y no descubierto luego**: no vuelve a pintar nada. Nadie se
 * suscribe al idioma en `Aplicacion` —no puede, ver arriba—, asi que cambiar de idioma **en
 * caliente** dejaria esas tres como estaban hasta la siguiente pintada por otro motivo. Hoy no
 * cuesta nada: solo existe `es` (epica #47, «Lo que NO entra»). El dia que haya un segundo idioma de
 * verdad, quien lo encienda tiene que poner `useTranslation()` en `aplicacion.tsx` — y ese archivo
 * ya se abre en #64, que filtra el catalogo por permisos y necesita un gancho por lo mismo.
 */
export function alCambiarElIdioma(rehacer: () => void): void {
  rehacer();
  i18next.on('languageChanged', rehacer);
}

export default i18next;
