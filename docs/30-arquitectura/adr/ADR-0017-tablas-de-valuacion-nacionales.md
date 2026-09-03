# ADR-0017 — Las tres tablas de valuación son nacionales

| Campo | Valor |
|---|---|
| Estado | Aceptado |
| Fecha | 2026-08-28 |
| Decide | Dirección del proyecto |
| Cierra | **D-13** (GOB-02), y con ella el hallazgo **H-5** de [GOB-03](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/plan-de-desbloqueo-D-02.md) |
| Implementa | `V55__tablas_de_valuacion_nacionales.sql`, issue [#188](https://github.com/hneyra/sgtm/issues/188) |

## Decisión

`valor_unitario_edificacion`, `depreciacion` y `valor_referencial_vehiculo` pasan a ser **catálogos
nacionales**: `municipalidad_id` nulo, cargados una vez para todas las municipalidades, escritos
sólo por `rol_carga_parametros`. Es la opción (a) de D-13 y el modelo que
[ARQ-09 §2.1](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/../srtm/docs/30-arquitectura/motor-de-reglas-y-parametrizacion.md) ya
describía:

> | Ámbito | Parámetros | `municipalidad_id` | Quién carga |
> |---|---|---|---|
> | **Nacional** | UIT, aranceles, valores unitarios de edificación, tabla vehicular, tramos y alícuotas de ley | Nulo | Una vez, para todas |
>
> Los nacionales viven en tablas de catálogo con política de lectura abierta y escritura restringida
> al rol de carga (ARQ-08 §1.4); **RLS sigue activa**, cambia la política, no su existencia.

**`arancel` no se toca.** ARQ-09 lo lista en esa misma casilla, pero en este sistema es
correctamente municipal: se carga por vía y se corrige por municipalidad, como explica
[`aranceles-2026.md`](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/10-negocio/valores-normativos/aranceles-2026.md) §5. Sigue colgando de
`conjunto_parametros`, con su disparador de V18 intacto. Apartarse de ARQ-09 aquí es deliberado y
queda escrito.

### Nacionales puras, no «nulo por omisión»

`parametro_tributario` admite las dos cosas —nulo para la UIT, con municipalidad para la TIM—
porque ahí conviven parámetros de los dos ámbitos. Estas tres no: ninguna municipalidad publica su
propio cuadro del MEF ni del Ministerio de Vivienda. La columna se conserva (para que la política de
RLS tenga qué comparar) pero con `CHECK (municipalidad_id IS NULL)`.

**Eso es lo que cierra H-5 por construcción**, y es la diferencia entre la decisión y una intención:
sin el `CHECK`, nada impediría volver a cargar una copia por municipalidad, y H-5 seguiría abierto
bajo otra forma. Admitir la excepción municipal el día que exista costará quitar una restricción con
nombre y justificarlo en su diff.

## Cómo sigue congelando el sellado municipal

Es la pregunta que decide si esto se puede hacer. Si la tabla ya no cuelga del conjunto, ¿qué impide
que recalcular en 2037 una determinación de 2026 lea otra tabla —el defecto de ARQ-09 §3 que V17
existía para cerrar?

Lo mismo que ya impide que lea otra UIT: **el conjunto la compone por referencia**. No hay mecanismo
nuevo.

1. Cada cuadro se publica como **una fila de `parametro_tributario`** —su *edición*: tipo, clave,
   vigencia, documento fuente y las dos firmas de ADR-0007—.
2. Las miles de filas del cuadro cuelgan de ella por `publicacion_id`.
3. Componer el cuadro en un conjunto es **la misma fila de `conjunto_parametro_detalle`** con la que
   se compone la UIT, y V9 la vuelve inmutable en cuanto el conjunto se sella.
4. Leerlo es un `JOIN` por esa fila de detalle. Como `conjunto_parametro_detalle` es tabla de tenant,
   su política de RLS acota la consulta a la municipalidad del contexto sin que nadie lo escriba:
   preguntar por el conjunto de otra municipalidad no devuelve su cuadro, devuelve nada.

`LectorDeParametros.conjuntoVigenteEn` sigue existiendo con la misma firma, y por el mismo motivo:
para leer un cuadro nacional también hace falta saber **de qué conjunto** se habla.

### Se descartó componer fila por fila

La tabla vehicular de 2026 tiene 18 043 filas de anexo (54 111 de cuadro). Una entrada de detalle
por fila, por municipalidad y por ejercicio es un padrón de punteros que crece con el producto de
los tres, para congelar algo que la norma **no publica por celdas sino por resolución entera**. Lo
que se sella es la edición, y esa es la unidad que el conjunto nombra.

### Una edición se carga una vez y queda cerrada

Componer congela **qué** edición se usó, no **cuántas filas** tenía. Sin más, una edición ya sellada
en el conjunto de una municipalidad podría recibir filas nuevas y el recálculo leería un cuadro más
grande que el que se emitió — el «sellado cuyo contenido cambia» que V9 describe.

Se cierra con la columna que `parametro_tributario` tiene desde V1 y que hasta hoy nadie usaba:
`sellado`, con su significado de ARQ-09 §2.3. El proceso de carga la marca al terminar, y el
disparador `valuacion_de_publicacion_sellada_es_inmutable` (V55) rechaza desde entonces cualquier
fila más. Corregir una edición cerrada es **publicar otra**, con su documento fuente y sus dos
firmas, y componerla en un conjunto nuevo.

De paso cierra un hueco que nadie había visto: `valor_referencial_vehiculo` **nunca tuvo** disparador
de inmutabilidad. V18 se lo puso a `arancel`, a `valor_unitario_edificacion` y a `depreciacion`; V17,
que fue quien enganchó la vehicular al conjunto, no le puso ninguno.

## Por qué ahora, si el intento del 25-08 se paró

D-13 registraba dos motivos para no plegar todavía. **Los dos dejaron de existir:**

| Motivo del 2026-08-25 | Hoy |
|---|---|
| «Exige construir desde cero la conexión de `rol_carga_parametros` — no existe para ninguna tabla, ni siquiera UIT» | Existe desde [#375](https://github.com/hneyra/sgtm/issues/375): `PublicarParametros`, `PublicacionDeParametrosJdbc` y `publicar-parametros.sh`, con la política de escritura de V6 y el rol nombrado en V7 |
| «Y retirar código probado de #17» | Se retira, y se dice cuál: ver abajo |
| (implícito) No había derivados verificables que cargar | El corpus tiene `fuentes/tvr-2026/tvr-2026.csv` —18 043 filas mecánicas del anexo, con su sha256— y los cuadros de `valores-unitarios-2026.md` y `depreciacion.md`, los tres `VERIFICADO` |

El argumento (b) de D-13 era el javadoc de `LectorDeParametros`, que agrupaba
`valor_referencial_vehiculo` con `arancel` como «datos normativos que no caben en
`ParametrosSellados`… esa tabla cuelga del conjunto». **Esa frase era la simplificación que sostenía
H-5**, y está reescrita en el propio javadoc en vez de borrada: lo que no cabía en
`ParametrosSellados` sigue sin caber, pero el ámbito de las tres tablas no era lo mismo que el del
arancel.

## Qué se conserva y qué se retira de #17

| Qué | Decisión |
|---|---|
| `TablasDeValuacion.aranceles/valoresUnitarios/depreciaciones` | **Se conservan**, sin cambio de firma ni de semántica: siguen resolviendo el ejercicio a un conjunto y leyendo ese conjunto |
| `TablasDeValuacion.cargarArancel` | **Se conserva.** El arancel es municipal |
| `TablasDeValuacion.cargarValorUnitario` y `cargarDepreciacion` | **Se retiran**, con sus dos métodos de `ValuacionRepository`. No se mueven ni se renombran: dejaron de tener sentido. Cargaban una copia del cuadro nacional *para una municipalidad*, que es exactamente H-5 |
| `valuacion_de_conjunto_sellado_es_inmutable` (V18) | **Se conserva para `arancel`**; las otras dos pasan al disparador de edición |
| `anio_construccion_desde/hasta` de V18 | **Se conserva.** Ver H-4, abajo |
| Las pruebas de #17 | Se conservan las de arancel y las de resolución por conjunto; la que cargaba los dos cuadros se sustituye por cuatro que prueban el modelo nuevo |

## Consecuencias

- **Se desbloquea la carga de las tres tablas**, que es lo que D-13 bloqueaba. La vehicular quedó
  cargada por `PublicarCuadros` desde el manifiesto del corpus, y **la de depreciación desde el
  2026-08-29**: `V57` le dio la dimensión de uso que le faltaba y sus 492 filas —las cuatro tablas
  del Anexo I del RNT— se publican por el mismo camino (H-15). La de valores unitarios firmó la
  suya el 2026-08-29 y sigue sin publicarse por lo que H-14 enumera, que ya no es una firma: el
  proceso no conoce ese cuadro, no hay derivado con su huella, y las tres partidas del Anexo I.2
  conviven con el vocabulario de siete que el esquema declara (H-14).
- **H-5 queda resuelto por construcción**: una sola copia nacional no puede divergir de sí misma.
- **La región de los valores unitarios cabe sin columna nueva.** La RM de valores unitarios publica
  un cuadro por región —Costa, Lima/Callao, Sierra, Selva—: cada una es una **edición** distinta, y
  el conjunto de una municipalidad compone la de su región. Que eso sea suficiente hay que
  comprobarlo al cargarlas, no aquí.
- **La aplicación pierde `INSERT` y `UPDATE` sobre las tres.** Una petición HTTP ya no tiene camino
  hasta el cuadro de valores unitarios de todas las municipalidades del país.
- **No se desbloquea ninguna regla de cálculo.** D-02a está firmada, pero D-03c y D-11 siguen
  abiertas y CLAUDE.md sigue prohibiendo implementar reglas. Esto carga el dato; no lo usa.

## Alternativas descartadas

- **Dejarlo como estaba (opción (b) de D-13).** Es lo que produce H-5: dos municipalidades con
  copias divergentes del mismo cuadro del MEF, sin ningún error visible y con dos bases imponibles
  distintas para el mismo vehículo.
- **Una tabla de cabecera propia para las ediciones.** Habría hecho falta un `conjunto_edicion_detalle`
  paralelo y un sellado paralelo. `parametro_tributario` + `conjunto_parametro_detalle` ya son
  exactamente eso, con su inmutabilidad probada desde V9.
- **Componer fila por fila**, como el detalle compone un parámetro suelto. Descartada por el tamaño
  y porque la unidad que la norma publica es la resolución.
