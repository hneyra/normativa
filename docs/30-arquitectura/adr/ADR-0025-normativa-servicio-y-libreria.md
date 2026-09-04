# ADR-0025 — La normativa es un servicio de datos y una libreria de reglas, y no está en el camino caliente

| Campo | Valor |
|---|---|
| Estado | **Aceptado** |
| Fecha | 2026-09-03 |
| Decide | Dirección del proyecto |
| Depende de | [ADR-0029](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0029-cuatro-sistemas-separados.md) |
| Conserva | [ADR-0007](ADR-0007-parametros-versionados.md) y [ADR-0017](ADR-0017-tablas-de-valuacion-nacionales.md) sin cambios de fondo |


> Aceptado el 2026-09-04 por la direccion del proyecto, al contestar **D-22**: el producto lo opera un equipo central, no cada municipalidad. Ver [`D-22`](https://github.com/hneyra/infrastructure/blob/main/docs/00-gobierno/D-22-quien-opera-cuatro-despliegues.md) en `infrastructure`.

## Contexto

Los valores normativos son el caso obvio para un sistema compartido: los consumen `catastro` y
`rentas`, no los fija el equipo de desarrollo, y desde ADR-0017 tres de los cuadros ya son
nacionales —una copia para todo el pais, con `CHECK (municipalidad_id IS NULL)`—.

Tambien son el caso donde un servicio compartido mal hecho hunde el sistema entero. Una corrida de
emisión de un padrón mediano-grande resuelve cientos de miles de partidas; si cada una consulta por
red la UIT, el arancel de su via y el valor unitario de su categoría, la emisión anual depende de que
otro despliegue este arriba durante horas, y el día que no lo este no hay padrón.

Lo que salva el caso es una propiedad que ADR-0007 y ADR-0017 **ya construyeron** y que nadie ha
aprovechado todavía: **una vez sellado, el dato no cambia nunca**. La edición tiene su disparador de
inmutabilidad; el conjunto se vuelve inmutable al sellarse (`V9`). Lo inmutable se copia sin miedo,
se cachea para siempre y se verifica por huella.

## Decisión

**Dos artefactos, no uno.**

| Artefacto | Qué es | Qué distribuye |
|---|---|---|
| `normativa` | Un servicio HTTP | **Datos**: ediciones, conjuntos sellados, el snapshot descargable |
| `normativa-reglas` | Un artefacto Gradle versionado | **Código**: `MotorDeReglas`, `ReglaTributaria`, `ReglaDeAgregacion`, `PoliticasDeRedondeoSelladas` |

### 1. El calculo no llama por red

Al abrir una corrida se resuelve **una vez** el `conjuntoId`, se descarga el snapshot sellado, se
verifica su `sha256` y se cachea en tabla local **para siempre**. Una corrida de 300 000 predios hace
una petición a `normativa`, no 300 000.

La consecuencia es la que importa, y es el criterio de aceptación de la fase 1:

> **`rentas` arranca y calcula con `normativa` apagada.** Prueba de humo en CI, no manual.

Qué el snapshot sea inmutable es lo que hace la cache legitima: no hay invalidación que diseñar, no
hay ventana de inconsistencia, no hay TTL que ajustar. Un conjunto sellado que cambiara de contenido
sería el defecto que `V9` ya cierra.

### 2. Las reglas viajan como código, no como datos

El motor resuelve un **grafo** —«en cada vuelta aplica toda regla cuyos insumos ya están
calculados»— y las reglas son funciones puras (regla 6). Serializarlas para transportarlas por HTTP
sería inventar un lenguaje de reglas, que es exactamente lo que ADR-0007 descartó: «anade una
tecnología y un formato propio para un problema que aquí es de datos versionados, no de
expresividad».

`catastro` y `rentas` **fijan la misma versión** del artefacto para un ejercicio dado. Una versión
distinta entre los dos es una diferencia de céntimos que nadie ve hasta la reclamación, así que la
versión del catálogo de reglas viaja con cada resultado (§3) y la corrida la compara.

### 3. Lo que se guarda con cada resultado

Toda valuación y toda determinación guardan el `conjuntoId` **y** la versión del catálogo de reglas
con que se calcularon. Es la extensión natural de ADR-0007 —«toda determinación guarda con que
conjunto se calculo y qué reglas se aplicaron»— al hecho de que ahora hay dos ejecutores.

Sin eso, un recalculo no es una verificación: es un calculo nuevo que casualmente se parece.

### 4. El ambito nacional / municipal no se toca

Lo decidido en ADR-0017 se traslada tal cual: los cuadros nacionales van con `municipalidad_id` nulo
y su `CHECK`; el arancel sigue siendo municipal, porque se carga por via y se corrige por
municipalidad. RLS sigue activa en las dos clases de tabla; cambia la política, no su existencia.

### 5. La escritura sigue siendo un acto administrativo

`POST normativa/api/v1/ediciones` exige el rol de carga, el documento fuente y las dos firmas de
ADR-0007. La aplicación no tiene camino hasta el cuadro: `catastro` y `rentas` sólo leen. El corpus
de `docs/10-negocio/valores-normativos/` y su verificador se mudan con el servicio, porque la doble
verificación empieza en el documento y no en la fila.

## Consecuencias

- **`normativa` puede caerse sin detener nada** que ya haya resuelto su conjunto. Sólo bloquea abrir
  una corrida nueva.
- **Una edición nueva no se cuela en una corrida en marcha.** El conjunto ya está descargado; publicar
  algo a mitad de la emisión no cambia lo que se está emitiendo.
- **La cache es contenido, no tiempo.** Se indexa por `conjuntoId` y se valida por `sha256`. Un
  `ETag` que cambie sin que cambie el `conjuntoId` es un defecto del servidor, y hay que probarlo.
- **Aparece una asimetría útil**: `catastro` sólo necesita las tablas de valuación; `rentas`
  necesita además UIT, tramos, deducciones y plazos. El snapshot se puede pedir por ambito, pero la
  **identidad** del conjunto es la misma para los dos, y eso es lo que la corrida compara.

## Lo descartado, y por qué

- **Una API de consulta por parámetro en el camino del calculo** (`GET /uit?ejercicio=2026`). Es la
  forma natural y es la que convierte la emisión anual en un problema de disponibilidad. Ademas
  invita al defecto que ARQ-09 §3 nombra: «la lectura de parámetros por ejercicio que falla en
  silencio».
- **Replicar las tablas de normativa en cada base por evento.** Es cachear sin decirlo, con el
  agravante de que la copia se puede escribir. El snapshot inmutable hace lo mismo y no se puede
  editar.
- **Un motor de reglas como servicio** (`POST /calcular`). Mueve la latencia al peor sitio posible y
  convierte una función pura en una llamada con reintentos. Y hace imposible probar el calculo sin
  levantar un despliegue, que es justo lo que la regla 7 evita.
- **Dejar la normativa dentro de `rentas` y que `catastro` se la pida.** Deja a catastro dependiendo
  de rentas para valorizar, que es la dependencia que ADR-0024 separa; y pone la carga de un cuadro
  nacional detras del ciclo de despliegue del sistema más grande.
