import { Armazon } from '@kamayuk/shell';
import { ProveedorDeTema, type ConfiguracionDeTema } from '@kamayuk/ui';

import { ACCIONES } from './acciones.ts';
import { CATALOGO } from './catalogo.ts';
import { ProveedorDeDatos } from './datos/proveedor.tsx';
import { TEXTOS_DEL_MARCO } from './i18n/armazon.ts';
import { ESCUDO, PIE_DEL_CARRIL, TITULO } from './marca.ts';
import { pantallaDe } from './pantallas/index.ts';
import { CUENTA, ENTIDAD, OPCIONES_DE_SESION, CajonDePreferencias, PuertaCaida } from './sesion.ts';

/**
 * **`normativa-web` sobre `kamayuk-lib`: el `Armazon` vacio, y las OCHO COSTURAS** (#55).
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
 * | `entidad`, `cuenta`, `opcionesDeSesion`, la puerta caida y el cajon | `./sesion.ts` | #57, #64 |
 * | `catalogo` | `./catalogo.ts` | #58, #64 |
 * | `pantalla` | `./pantallas/index.ts` | #58 |
 * | `acciones` | `./acciones.ts` | #58, #67, #68 |
 * | `textos` | `./i18n/armazon.ts` | #60 |
 * | el proveedor de consultas | `./datos/proveedor.tsx` | #63 |
 * | el arranque | `./arranque.ts`, desde `main.tsx` | #57 |
 *
 * Asi que **aqui no se escribe ni un texto visible**, ni un `[]` en la llamada, ni un
 * `() => null`: cada uno de esos seria el trozo por el que otro issue tendria que volver a este
 * archivo. Lo comprueba `verificaciones/la-costura-es-la-que-es.test.ts`, que ademas exige que los
 * unicos `import` de aqui sean `@kamayuk/*`, `react` y las ocho costuras.
 *
 * <h2>Que se ve hoy, dicho aqui y no descubierto luego</h2>
 *
 * El marco de `@kamayuk/shell` con sus textos por omision: la barra con el titulo del sistema, el
 * buscador, la campana y el circulo de la cuenta; el carril **sin un solo modulo**, porque el
 * catalogo esta vacio; y el cuerpo diciendo «No hay ningun destino abierto…». Un hash cualquiera
 * cae en «destino no ofrecido» y `pantalla` no se llama nunca. Las cuatro hojas —Panel, Ediciones,
 * Cuadros de valuacion y Publicacion— llegan con #58, que depende de este issue y de G2.
 *
 * <h2>Lo que NO hay, y su issue</h2>
 *
 * · **Identidad, cliente de la API y opciones del menu de sesion** (#57): la entidad y la cuenta
 *   son marcadores y no hay ni una opcion que pulsar.
 * · **El catalogo filtrado por permisos** (#64) y **el i18n** (#60).
 * · **Las lecturas** (#63, #65, #66, #67): el backend no publica todavia `/seguridad/modulos`,
 *   `/seguridad/accesos` ni `/seguridad/sesion` (#54), y ninguna ruta esta encendida.
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
        <Armazon
          titulo={TITULO}
          entidad={ENTIDAD}
          escudo={ESCUDO}
          catalogo={CATALOGO}
          cuenta={CUENTA}
          opcionesDeSesion={OPCIONES_DE_SESION}
          pantalla={pantallaDe}
          acciones={ACCIONES}
          pieDelCarril={PIE_DEL_CARRIL}
          textos={TEXTOS_DEL_MARCO}
        />
        <CajonDePreferencias />
      </ProveedorDeDatos>
    </ProveedorDeTema>
  );
}
