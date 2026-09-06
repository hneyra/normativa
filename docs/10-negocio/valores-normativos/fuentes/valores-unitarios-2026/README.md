# Fuente: Cuadro de Valores Unitarios Oficiales de Edificación, Anexo I.2 (Costa), ejercicio 2026

La matriz del **Anexo I.2** de la R.M. N.º 277-2025-VIVIENDA —la Costa, excepto Lima Metropolitana
y Callao— proyectada a la forma de filas que `PublicarCuadros` carga. El archivo del corpus que la
transcribe es [`../../valores-unitarios-2026.md`](../../valores-unitarios-2026.md), y este
directorio **no vuelve a transcribir nada**: lo deriva.

## Por qué este derivado sale del corpus y no de un PDF

Por lo mismo que [`../depreciacion-rnt-2016/`](../depreciacion-rnt-2016/README.md) y al revés que
[`../tvr-2026/`](../tvr-2026/README.md). El anexo vehicular son 169 páginas y 18 043 filas: no cabe
en un archivo del corpus, así que se extrae de la fuente con dos métodos independientes por fila y
lo que el corpus firma es su huella. **El Anexo I.2 cabe entero en una tabla de nueve filas por tres
columnas**, y por eso ya está transcrito celda por celda en `valores-unitarios-2026.md` §1.1, con el
encabezado verbatim del anexo y su nota al pie, `VERIFICADO` y firmado por dos personas distintas
(ADR-0007).

Escribir además un CSV a mano sería un **segundo sitio donde una cifra puede estar mal**, y el
corpus dejaría de ser la única fuente. Por eso `derivar-valores-unitarios.mjs` lo proyecta, y
`--comprobar` exige en cada PR que el archivo desplegado sea exactamente lo que el guion produce hoy
desde el corpus: el derivado no se edita, se regenera.

```bash
node docs/10-negocio/valores-normativos/fuentes/valores-unitarios-2026/derivar-valores-unitarios.mjs
node docs/10-negocio/valores-normativos/fuentes/valores-unitarios-2026/derivar-valores-unitarios.mjs --comprobar
```

## La huella del archivo de filas

| Archivo | Filas | sha256 |
|---|---|---|
| `valores-unitarios-costa-2026.csv` | 24 | `0540c3af64fd015b905135d0274c07ffec2f52dbfe4764ff27823e6e7c775261` |

`PublicarCuadros` la vuelve a calcular antes de publicar una sola fila y rechaza la edición entera
si no coincide; `docs/10-negocio/verificar-cuadros.mjs` la comprueba además en cada PR y exige que
esté escrita **aquí o en el archivo del corpus** —no solo en el manifiesto—, que es lo que la
convierte en una firma y no en un número que el manifiesto se puso a sí mismo.

## Tres cosas que hay que saber antes de leer el CSV

**1. Son 24 filas y no 27, y las tres que faltan no valen cero.** La matriz tiene 9 categorías × 3
partidas = 27 celdas, y tres de ellas son **puntos suspensivos en el propio cuadro** —muros en `H` e
`I`, techos en `I`—. §1.1 del corpus lo dice con todas las letras: «no son un dato que falte en esta
transcripción ni un cero». El cuadro distingue tres cosas —una cifra, un `0.00` explícito y una
celda con puntos—, así que la fila sencillamente no existe, igual que las celdas `*` de la
depreciación. Quien busque esa combinación tiene que fallar nombrándola en vez de valorizar al
`0,00` (#48). Los dos `0.00` que **sí** están —techos en `H`, «SIN TECHO»; puertas en `I`, «SIN
PUERTAS NI VENTANAS»— se publican, porque los publica la norma.

**2. Una región por edición, y ésta es la Costa.** `valor_unitario_edificacion` no tiene columna de
región y su unicidad es `(publicacion_id, partida, categoria, anio_construccion_desde)`: las cuatro
regiones del Anexo I chocarían celda con celda dentro de una misma edición. Con
[ADR-0017](../../../30-arquitectura/adr/ADR-0017-tablas-de-valuacion-nacionales.md) eso no es un
problema sino la forma correcta —cada región es una edición distinta y el conjunto de una
municipalidad compone la suya—, así que este derivado es el de la Costa, que es la región del
piloto: **Catacaos, Piura** (D-01). Lima Metropolitana/Callao (I.1), Sierra (I.3) y Selva (I.4)
están transcritas en §1.5 del mismo archivo del corpus y su derivado es otro, el día que una
municipalidad de otra región lo necesite. **Publicar las cuatro en una sola edición no es que esté
mal: es que la base lo rechaza**, y por eso este archivo no lo intenta.

**3. El tramo de año de construcción es único y abierto.** H-4 preguntaba si el cuadro es una matriz
`categoría × año de construcción`; §3 del corpus lo contesta leyendo el Anexo I.2: **no lo es** —es
`categoría × partida`— y el año de construcción es la entrada de la **tabla de depreciación**, que es
otra tabla con su propia clave. `anio_construccion_desde` es `NOT NULL`, así que el tramo único se
escribe con el **piso del dominio `ejercicio`** (`V1`: 1990..2100) y sin tope. Ese `1990` no es una
cifra de la norma —la norma no publica ninguna dimensión de año— sino el extremo que el propio
esquema admite, y por eso vive en el guion de derivación y no en el código de la aplicación.

## El PDF original

No se versiona aquí. Es el mismo lote archivado en S3 que declara [`../README.md`](../README.md), y
la procedencia de las 27 celdas —cómo se leyó el Anexo I.2, y por qué la lectura anterior estaba
mal— está en §1.4 del archivo del corpus.
