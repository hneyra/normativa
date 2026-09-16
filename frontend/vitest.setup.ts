import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Testing Library limpia el DOM entre pruebas por su cuenta solo cuando Vitest corre con
 * `globals: true`. Aqui corre sin globales —los importes explicitos dicen de donde sale
 * cada cosa— asi que la limpieza se enchufa a mano; sin ella, la segunda prueba encuentra
 * dos aplicaciones montadas y `getByRole` falla por ambiguo, que es un rojo que no habla
 * de lo que se estaba probando.
 */
afterEach(cleanup);

/**
 * **La instancia de i18next, para TODAS las pruebas** (#60, AC 1).
 *
 * `react-i18next` sin proveedor usa la instancia global de `i18next`, que solo existe si alguien la
 * inicializo. En la aplicacion lo hace `src/main.tsx`; en las pruebas no lo haria nadie, y el
 * sintoma es pequeno y confuso: `t()` devolveria la clave sin resolver nada —sin elegir forma
 * plural, y sin el post-procesador que marca—, de modo que
 * `verificaciones/todo-el-texto-se-traduce.test.tsx` saldria **verde sobre la nada**: nada estaria
 * marcado y nada se consideraria escapado.
 *
 * Importarlo aqui es lo que hace que una prueba de componente vea **lo mismo que la pantalla**.
 * Ponerlo en cada archivo que lo necesite seria lo contrario: la que se olvidara pasaria en verde
 * comprobando texto sin traducir.
 *
 * Es un `import` estatico —se iza, asi que corre antes que nada de este archivo— y `i18n.ts` tiene
 * un `await` de nivel superior: cuando el modulo termina de evaluarse, la instancia esta lista.
 */
import './src/i18n/i18n.ts';

/**
 * **`:modal` y `:popover-open` contestan `false` sin preguntarle a jsdom** (#57; hallazgo de
 * `catastro`#110, PR `catastro`#138).
 *
 * <h2>El defecto, medido alli y heredado aqui</h2>
 *
 * Abrir una capa de Radix que se coloca con `@floating-ui` —el menu de sesion del armazon; tambien
 * los desplegables y los globos— deja el hilo de las pruebas **bloqueado decenas de segundos**. Con
 * un perfil de CPU tomado dentro del hilo, el 95 % del tiempo es una sola recursion de
 * `nwsapi@2.2.27` —la que trae `jsdom@26.1.0`, y la misma que este candado fija—:
 *
 *     isFullscreen -> matchesNative(node, ':fullscreen') -> Element.matches -> _matches -> isFullscreen …
 *
 * que no para hasta desbordar la pila. Quien la dispara es `@floating-ui/utils`, que en
 * `isTopLayer()` pregunta `element.matches(':popover-open')` y `':modal'` dentro de un `try`, y lo
 * pregunta en cada recolocacion. El `catch` recoge el desbordamiento y todo sale bien, **tarde**:
 * alli las cinco pruebas del menu sin esta guarda no terminaron en 280 s.
 *
 * <h2>Por que esto y no otra cosa</h2>
 *
 * `false` es la respuesta verdadera en jsdom, que **no tiene capa superior**: ni `<dialog>` modal ni
 * `popover`. Todo otro selector sigue yendo a jsdom sin tocar, y la guarda es de las pruebas: el
 * paquete no la lleva, porque en un navegador de verdad `:modal` lo contesta el navegador.
 *
 * El sitio es este, y no cada prueba, porque la sufre **toda** prueba que abra una de esas capas de
 * `@kamayuk/ui` — hoy `src/sesion.test.tsx`, y las cuatro hojas de #58 van a abrir muchas.
 */
function sinCapaSuperior() {
  // Las guardas que corren con `@vitest-environment node` no tienen `Element`.
  if (typeof Element === 'undefined') return;
  const deJsdom = Element.prototype.matches;
  Element.prototype.matches = function matches(this: Element, selector: string): boolean {
    if (selector === ':modal' || selector === ':popover-open') return false;
    return deJsdom.call(this, selector);
  };
}

sinCapaSuperior();
