/**
 * El arranque de `normativa-web`: primero quien contesta, despues quien pregunta.
 *
 * <h2>El orden es el criterio, no un detalle</h2>
 *
 * React monta y las pantallas piden datos en su primer efecto. Si el proxy se instalara despues
 * de `createRoot(...).render(...)`, la primera peticion de la primera pantalla saldria al `fetch`
 * de verdad —y en desarrollo la atenderia el servidor de Vite, que devuelve el `index.html` con
 * un `200`—: no un error, una pagina HTML donde la pantalla espera JSON.
 *
 * Por eso el montaje entra aqui como argumento y no como una linea de mas abajo: `arrancar()` no
 * puede montar antes de instalar, y `arranque.test.ts` lo comprueba mirando el orden en que
 * ocurren las dos cosas.
 *
 * <h2>La bandera se lee de `import.meta.env`, y de ahi y no de otro sitio</h2>
 *
 * Vite sustituye `import.meta.env.VITE_*` por su valor **al construir**, asi que con la bandera
 * apagada la condicion queda en `"false" === "true"` —o en `undefined === "true"`, que es lo que
 * pasa en `yarn build`, porque `.env.development` solo se lee en modo desarrollo—, Rollup la
 * pliega y **se lleva por delante el `import()` dinamico entero**: el proxy, las siete
 * operaciones y todas las cifras del corpus capturadas del artboard. Ese es todo el mecanismo de
 * AC9, y esta medido en la fila del registro con los dos tamanos y el `grep`.
 *
 * **Lo que importa es de DONDE sale el valor, no como esta escrita la condicion.** Lo que si
 * mete los datos del prototipo en produccion es leer la bandera en **tiempo de ejecucion** —de
 * la URL, de una configuracion pedida al arrancar—: entonces no hay nada que plegar y el trozo
 * viaja igual.
 *
 * Es opt-in y no opt-out a proposito: lo que decide si un despliegue lleva datos inventados no
 * puede ser que alguien se acuerde de apagarlos. `.env.development` la enciende para `yarn dev`,
 * que es donde hace falta.
 *
 * <h2>Y en ESTE repositorio la bandera protege algo mas</h2>
 *
 * Lo que el `import()` arrastra no son datos de ejemplo cualesquiera: son la UIT de cinco
 * ejercicios, los tramos de la escala progresiva con sus alicuotas y filas de los tres cuadros
 * nacionales. Un bundle de produccion con esas cifras dentro seria este repositorio —el que
 * existe para que las cifras vivan en el corpus firmado a dos manos (ADR-0007, regla 5)—
 * publicandolas por un camino que no pasa por ninguna firma.
 */

/** Instala el proxy si la bandera lo pide, y solo entonces monta la aplicacion. */
export async function arrancar(montar: () => void): Promise<void> {
  if (import.meta.env.VITE_KAMAYUK_PROXY_DE_DATOS === 'true') {
    const { instalarProxyDeDatos } = await import('./api/proxy.ts');
    instalarProxyDeDatos({ latencia: true });
  }
  montar();
}
