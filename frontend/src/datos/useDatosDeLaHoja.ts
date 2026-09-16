import { peldanoDe } from '@kamayuk/sesion';
import type { DatosDeLaPantalla, EstadoDeUnaLectura } from '@kamayuk/ui';
import { useQueries } from '@tanstack/react-query';

import { hojaDe, type ClaveDeHoja } from '../pantallas/arbol.ts';
import { porQueNoHayDato } from '../porQueNoHayDato.ts';
import { CONECTORES } from './conectores.ts';

/**
 * **Los datos de una hoja, pedidos de verdad** (#63, AC 1, AC 2 y AC 4).
 *
 * <h2>Los estados van POR LECTURA y no por pantalla, y eso es el AC 2</h2>
 *
 * El Panel pide dos cosas con **dos autorizaciones distintas**: el estado del ejercicio pasa con
 * `SESION_PROPIA` y el listado de versiones exige el acceso `parametros`. Una cuenta de ventanilla
 * recibe 200 en la primera y **403 en la segunda**, y si el fallo se dijera «de la pantalla» esa
 * cuenta se quedaria sin lo que si puede ver.
 *
 * Por eso lo que sale de aqui es `lecturas: Map<clave, EstadoDeUnaLectura>`: cada pieza de la
 * definicion nombra la suya —`lectura`— y avisa del fallo de sus vecinas —`fallosDe`—, y
 * `@kamayuk/ui` pone cada estado en su sitio sin tapar lo que si llego.
 *
 * <h2>Los errores se distinguen EN UN SITIO, con la escalera de la libreria (AC 4)</h2>
 *
 * `peldanoDe()` de `@kamayuk/sesion` traduce un fallo a que decir y a quien, y **aqui no hay una
 * traduccion paralela**: ni un `switch` sobre el estado, ni un mapa de codigos a frases. Lo que este
 * archivo anade son las dos decisiones que la escalera deja al que dibuja, y las dos salen de su
 * `esAveria`:
 *
 *   · **el tono** — `mal` cuando es una averia, `atencion` cuando no. Un 403 `SIN_PRIVILEGIO`
 *     pintado de rojo de «algo se rompio» manda a mirar un despliegue cuando lo que falta es una
 *     fila en una tabla de permisos;
 *   · **si se ofrece reintentar** — solo donde reintentar puede cambiar algo. Un privilegio que
 *     falta sale igual las veces que se pulse.
 *
 * <h2>Lo que hoy NO distingue, medido y no supuesto</h2>
 *
 * **Los dos 422 comparten peldano.** `VALIDACION` y `ORDEN_NO_ADMITIDO` son los dos `no-valido`
 * —mismo titulo, mismo remedio— y solo los separa el `detalle`, que es el texto del backend
 * (`kamayuk-lib@origin/main:paquetes/sesion/escalera.ts:167-186`). Con el **mismo** mensaje
 * inyectado, sus dos pantallas son identicas. **Y un 409 no tiene peldano**: cae en `averia`, o sea
 * «Reintente en unos segundos», que para un conflicto de estado es un consejo falso.
 *
 * Ninguna de las dos se arregla aqui: la primera es de `kamayuk-lib`#52 —que gana un peldano por
 * `codigo`— y la segunda tambien. Resolverlas con un `switch` en este archivo seria la traduccion
 * paralela que el AC 4 prohibe, y ademas serian **cuatro** traducciones paralelas en cuanto los
 * otros tres sistemas hicieran lo mismo.
 *
 * <h2>Por que no se reintenta solo</h2>
 *
 * `retry: false`, como en `rentas`. Un 401 reintentado tres veces son tres idas a un backend que ya
 * dijo que no, y quien esta delante espera el triple para leer el mismo mensaje. Lo que hay que
 * hacer con un 401 no es insistir: es volver a entrar.
 */

/**
 * El fallo de una lectura, con el peldano ya resuelto.
 *
 * `peldano` se pasa **por sus cuatro campos** y no el objeto entero: `Peldano` de `@kamayuk/sesion`
 * lleva ademas `clave`, `pideIdentidad` y `esAveria`, que son decisiones de este lado y no texto que
 * dibujar. El interprete declara su propio `PeldanoDeUnFallo` justo por eso.
 */
function falloDe(error: unknown, reintentar: (() => void) | undefined): EstadoDeUnaLectura {
  const peldano = peldanoDe(error);
  return {
    estado: 'fallo',
    peldano: {
      titulo: peldano.titulo,
      detalle: peldano.detalle,
      remedio: peldano.remedio,
    },
    // `mal` solo cuando el sistema esta roto. Los tres peldanos de autorizacion y el 422 son el
    // sistema funcionando, y se dicen en `atencion`.
    tono: peldano.esAveria ? 'mal' : 'atencion',
    ...(reintentar === undefined ? {} : { reintentar }),
  };
}

export function useDatosDeLaHoja(clave: ClaveDeHoja): DatosDeLaPantalla {
  const conector = CONECTORES[clave];
  const declaradas = conector?.lecturas ?? [];

  const resultados = useQueries({
    queries: declaradas.map((lectura) => ({
      // La clave lleva la hoja dentro: dos hojas no comparten cache aunque pidan lo mismo.
      queryKey: lectura.consulta,
      queryFn: ({ signal }: { signal: AbortSignal }) => lectura.pedir(signal),
      retry: false,
    })),
  });

  // Sin conector no se pide nada —`queries: []`— y el motivo lo redacta quien cruza las operaciones
  // de la hoja contra lo que el backend publica y contra lo que se ha visto contestar.
  if (conector === undefined) return { ausencia: porQueNoHayDato(hojaDe(clave)) };

  /**
   * Reintentar vuelve a pedir **todas** las lecturas de la hoja, y no solo la que fallo.
   *
   * Porque lo que fallo puede haber dejado obsoleto lo que no: si el listado cayo por una averia
   * del backend, el estado del ejercicio que se leyo antes es de antes de la averia. Volver a
   * pedirlo cuesta una peticion y evita una pantalla mitad vieja y mitad nueva.
   */
  const volverAPedir = () => {
    for (const resultado of resultados) void resultado.refetch();
  };

  const lecturas = new Map<string, EstadoDeUnaLectura>();
  const llegado = new Map<string, unknown>();
  // El boton sale UNA vez por pantalla: se ofrece en la primera averia y en ninguna mas. Dos
  // botones que hacen exactamente lo mismo no son dos remedios, son ruido.
  let yaHayBoton = false;

  declaradas.forEach((lectura, i) => {
    const resultado = resultados[i];
    if (resultado === undefined || resultado.isPending) {
      lecturas.set(lectura.clave, { estado: 'pidiendo' });
      return;
    }
    if (resultado.isError) {
      const esAveria = peldanoDe(resultado.error).esAveria;
      const ofrece = esAveria && !yaHayBoton;
      if (ofrece) yaHayBoton = true;
      lecturas.set(lectura.clave, falloDe(resultado.error, ofrece ? volverAPedir : undefined));
      return;
    }
    lecturas.set(lectura.clave, { estado: 'con-datos' });
    llegado.set(lectura.clave, resultado.data);
  });

  const reparto = conector.repartir(llegado);
  return {
    valores: reparto.valores,
    tablas: reparto.tablas,
    ausenciaPorCampo: reparto.ausenciaPorCampo,
    nombrados: reparto.nombrados,
    ausencia: reparto.ausencia,
    lecturas,
  };
}

export { falloDe };
