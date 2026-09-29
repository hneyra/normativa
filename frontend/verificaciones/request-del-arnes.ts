/**
 * **El `Request` del arnes acepta la senal que fabrica el documento. Dos realms, y solo aqui** (#90).
 *
 * <h2>El defecto, medido en los dos motores</h2>
 *
 * En un navegador hay UN realm: el `AbortSignal` que sale de `new AbortController()` y el
 * `Request` que lo recibe vienen del mismo sitio. Bajo Vitest no: el `Request` es el de `undici`
 * —el que trae Node dentro— y el `AbortController`/`AbortSignal` globales son los que instala
 * jsdom al montar el documento.
 *
 * Desde **Node 24** eso revienta. `undici` comprueba la senal con
 * `webidl.is.AbortSignal = webidl.util.MakeTypeAssertion(AbortSignal)`, que es el `instanceof` de
 * siempre: recorre la cadena de prototipos, y la senal de jsdom no esta en la del `AbortSignal`
 * nativo. Quien construye ese `Request` es `createClientSideRequest` de `react-router`, **en cada
 * navegacion** del enrutador de datos, asi que lo que se muere es la navegacion entera: el hash
 * se queda como estaba y la hoja siguiente no llega a montarse.
 *
 * Medido en este arbol el 2026-09-20, sin esto:
 *
 *   · con **Node 22.14.0** (el `.nvmrc`), `yarn verificar` RC=0, `Tests 576 passed (576)`;
 *   · con **Node 24.14.1**, RC=1: `Test Files 2 failed | 44 passed (46)`, `Tests 2 failed | 574
 *     passed (576)` y **213** `TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an
 *     instance of AbortSignal`.
 *
 * Y no es de esta maquina: el trabajo `consumidores` de `kamayuk-lib` corre ESTA suite con Node 24
 * y saco el mismo dia las mismas cifras, con el aviso «ya estaba rojo con la libreria en main […]
 * alguien tiene que mirarlo alli». Este archivo es ese «mirarlo alli».
 *
 * <h2>Por que aqui, y por que asi</h2>
 *
 * El diagnostico y el remedio son de `kamayuk-lib`#90 (su `vitest.setup.ts`), y `caja` lo adopto
 * en `caja`#93. Aqui hay una diferencia deliberada: **el envoltorio no cambia nada cuando el
 * entorno no lo necesita**. Solo se aparta la senal si el `Request` de debajo la RECHAZA, de modo
 * que con Node 22 —con el que este arbol corrio hasta #90, y con el que sigue corriendo quien
 * tenga un `nvm` viejo— las 576 pruebas construyen exactamente el mismo objeto que antes. Un
 * arnes que cambia lo que se mide, segun el motor con el que se mide, es peor que el defecto que
 * arregla.
 *
 * La senal entra **tal cual**: `react-router` lee `request.signal` para cortar sus cargadores, y
 * tiene que recibir la misma que le pasaron, no una parecida.
 *
 * Es una fabrica y no un `globalThis.Request = …` suelto para que las muestras puedan darle un
 * `Request` de mentira que rechaza cualquier senal —o sea, un Node 24— y ejercer el repliegue
 * **tambien con Node 22**. Sin eso, la mitad que importa solo se probaria en la maquina de quien
 * tenga el motor equivocado.
 */

/**
 * El mismo `Request`, con un repliegue para la senal de otro realm.
 *
 * @param Base el `Request` del entorno; se recibe por parametro para poder fingirlo.
 */
export function requestQueAceptaLaSenalDeOtroRealm(Base: typeof Request): typeof Request {
  return class RequestDelArnes extends Base {
    constructor(entrada: RequestInfo | URL, init?: RequestInit) {
      try {
        super(entrada, init);
      } catch (causa) {
        // Solo el rechazo de la senal. Cualquier otro fallo —una URL invalida, un cuerpo en un
        // GET— es del codigo que se esta probando y tiene que salir tal cual.
        const senal = init?.signal;
        if (senal === undefined || senal === null || !esElRechazoDeLaSenal(causa)) throw causa;
        const sinLaSenal: RequestInit = { ...init };
        delete sinLaSenal.signal;
        super(entrada, sinLaSenal);
        Object.defineProperty(this, 'signal', { value: senal, configurable: true });
      }
    }
  };
}

/**
 * Si lo que fallo fue la comprobacion de la senal, y no otra cosa.
 *
 * Se mira el TIPO y el TEXTO: `undici` lanza un `TypeError` cuyo mensaje nombra `signal`. Mirar
 * solo el tipo se tragaria un `TypeError` legitimo del codigo probado y lo volveria a intentar
 * sin senal, que es como un arnes esconde un defecto de verdad.
 */
function esElRechazoDeLaSenal(causa: unknown): boolean {
  return causa instanceof TypeError && /signal/i.test(causa.message);
}
