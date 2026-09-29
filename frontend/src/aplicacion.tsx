import { Armazon } from '@kamayuk/shell';
import { ProveedorDeTema, type ConfiguracionDeTema } from '@kamayuk/ui';

import { ACCIONES } from './acciones.ts';
import { EsperaDelCatalogo } from './catalogo.ts';
import { ProveedorDeDatos } from './datos/proveedor.tsx';
import { useCatalogoPermitido, useLaSesion } from './datos/useCatalogoPermitido.ts';
import { TEXTOS_DEL_MARCO } from './i18n/armazon.ts';
import { ESCUDO, PIE_DEL_CARRIL, TITULO } from './marca.ts';
import { pantallaDe } from './pantallas/index.ts';
import {
  OPCIONES_DE_SESION,
  CajonDePreferencias,
  PuertaCaida,
  cuentaDe,
  entidadDe,
} from './sesion.ts';

/**
 * **`normativa-web` sobre `kamayuk-lib`: el `Armazon`, y sus NUEVE COSTURAS** (#55, #64).
 *
 * <h2>Este archivo lo toca un solo issue, y es este</h2>
 *
 * Es la regla de la epica #47 («Para que los issues de una ola no se pisen»): `src/aplicacion.tsx`
 * es de #55 y de nadie mas. Todo lo que el `Armazon` recibe sale de un archivo de costura, y cada
 * uno tiene su dueño escrito dentro:
 *
 * | Lo que entra | De donde | Quien lo llena |
 * |---|---|---|
 * | `titulo`, `escudo`, `pieDelCarril` | `./marca.ts` | #58, tras G2 |
 * | como se dicen `entidad` y `cuenta`, `opcionesDeSesion`, la puerta caida y el cajon | `./sesion.ts` | #57, #64 |
 * | el catalogo de este sistema, y lo que se ve mientras no se sabe que puede abrir la cuenta | `./catalogo.ts` | #58, #64 |
 * | `catalogo` filtrado por la cuenta, y quien entro y donde: las cinco lecturas de `/seguridad` | `./datos/useCatalogoPermitido.ts` | #64 |
 * | `pantalla` | `./pantallas/index.ts` | #58 |
 * | `acciones` | `./acciones.ts` | #58, #67, #68 |
 * | `textos` | `./i18n/armazon.ts` | #60 |
 * | el proveedor de consultas | `./datos/proveedor.tsx` | #63 |
 * | el arranque | `./arranque.ts`, desde `main.tsx` | #57 |
 *
 * Asi que **aqui no se escribe ni un texto visible**, ni un `[]` en la llamada, ni un
 * `() => null`: cada uno de esos seria el trozo por el que otro issue tendria que volver a este
 * archivo. Lo comprueba `verificaciones/la-costura-es-la-que-es.test.ts`, que ademas exige que los
 * unicos `import` de aqui sean `@kamayuk/*`, `react` y las costuras de esta tabla.
 *
 * **Y hubo una vuelta, la de #64, que se dice**: el catalogo dejo de ser una constante y paso a ser
 * lo que contestan tres lecturas, y el `Armazon` no tiene estado de carga — asi que la espera tiene
 * que estar ENTRE el proveedor de datos y el armazon, y eso solo se puede escribir aqui
 * ({@link ArmazonDelSistema}). Lo que entro es la forma y nada mas: ni un texto ni una decision. Y
 * **una costura mas, la novena**, con su dueño: lo que pide las cinco lecturas no podia entrar por
 * `sesion.ts` ni por `catalogo.ts` sin romper algo medido, y los dos rojos estan en la cabecera de
 * `src/datos/useCatalogoPermitido.ts`.
 *
 * <h2>Que se ve desde #64, dicho aqui y no descubierto luego</h2>
 *
 * **Primero, por que todavia no hay armazon**: mientras las tres lecturas de `/seguridad` no digan
 * que puede abrir la cuenta, lo que se ve es `EsperaDelCatalogo` —«averiguando…», el fallo con su
 * peldano, o «esta cuenta no puede abrir ningun modulo»—. **Despues**, el marco de `@kamayuk/shell`
 * con el catalogo que la cuenta puede abrir —hoy el modulo NORMATIVA con sus cuatro hojas, si la
 * cuenta lee `conjuntos`—, la entidad y la cuenta que contesta la sesion, y la hoja del hash.
 *
 * El armazon **no tiene estado de carga**, y por eso la espera la hace {@link ArmazonDelSistema} y
 * no el marco: es el patron de `rentas/frontend/src/aplicacion.tsx@ac379ac:147-195`.
 */

/**
 * **El tema de este servicio**, con las dos decisiones que la libreria deja al sistema.
 *
 * · `identidadPorOmision`: `institucional`, la misma que `rentas` y `catastro`. Que ese nombre
 *   exista en la libreria lo comprueba `verificaciones/resuelve-el-clon-hermano.test.ts`: uno que
 *   no estuviera dejaria `data-tema` sin reglas y la pantalla sin colores, sin un solo error.
 * · `prefijoDeClaves`: las cinco interfaces se sirven **del mismo origen** —`/rentas/`, `/caja/`,
 *   `/catastro/`, `/normativa/`…—, asi que comparten el almacenamiento del navegador. Sin prefijo
 *   propio, cambiar el tema aqui se lo cambiaria a las otras cuatro.
 *
 * El modo no se declara: ausente es «el del equipo».
 *
 * Es una constante de modulo y no un literal en la llamada, por lo mismo que el catalogo: un
 * objeto nuevo en cada pintada es una configuracion distinta para el proveedor.
 */
const TEMA: ConfiguracionDeTema = {
  identidadPorOmision: 'institucional',
  prefijoDeClaves: 'kamayuk.normativa',
};

/**
 * **El armazon, cuando ya se sabe que puede abrir la cuenta.**
 *
 * Va **dentro** del proveedor de datos y no en `Aplicacion`: los dos ganchos son consultas, y un
 * gancho corre antes que el JSX del componente que lo llama — con los tres en la misma funcion,
 * pedirian antes de que el proveedor existiera («No QueryClient set», medido en `rentas`).
 *
 * Los ganchos se llaman **los dos, siempre, antes de decidir**: un gancho detras de un `return` es
 * un gancho que unas pintadas se llama y otras no, y React no lo admite.
 */
function ArmazonDelSistema() {
  const permitido = useCatalogoPermitido();
  const { quien, donde } = useLaSesion();

  if (permitido.estado !== 'compuesto') {
    return (
      <EsperaDelCatalogo
        estado={permitido.estado}
        porQue={permitido.porQue}
        detalle={permitido.detalle}
      />
    );
  }

  return (
    <Armazon
      titulo={TITULO}
      entidad={entidadDe(donde)}
      escudo={ESCUDO}
      catalogo={permitido.catalogo}
      cuenta={cuentaDe(quien)}
      opcionesDeSesion={OPCIONES_DE_SESION}
      pantalla={pantallaDe}
      acciones={ACCIONES}
      pieDelCarril={PIE_DEL_CARRIL}
      textos={TEXTOS_DEL_MARCO}
    />
  );
}

/**
 * El orden de los tres envoltorios, y por que es ese.
 *
 * `ProveedorDeTema` por fuera de todo: estampa `data-tema` y `data-modo` en `<html>`, asi que
 * tiene que estar puesto antes de que se dibuje nada —incluida la puerta caida, que si #57 la
 * enciende sustituye a la aplicacion entera y tambien necesita colores—.
 *
 * `ProveedorDeDatos` por dentro del tema y por fuera del armazon: las pantallas piden datos y el
 * armazon las dibuja, asi que el proveedor tiene que envolverlas a las dos.
 */
export function Aplicacion() {
  return (
    <ProveedorDeTema configuracion={TEMA}>
      <ProveedorDeDatos>
        <PuertaCaida />
        <ArmazonDelSistema />
        <CajonDePreferencias />
      </ProveedorDeDatos>
    </ProveedorDeTema>
  );
}
