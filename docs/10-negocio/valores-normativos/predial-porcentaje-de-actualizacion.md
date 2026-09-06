# El `% actualización` del predial: qué se buscó, qué se descartó y qué queda

| Campo | Valor |
|---|---|
| Norma | **TUO de la Ley de Tributación Municipal (D.S. N.° 156-2004-EF), art. 12** — el único porcentaje de actualización de la base imponible del predial que ese TUO contiene, ya confirmado como artículo 12 en §1.4. Se transcribe además el art. 14 (§1.2), que quedó descartado y por qué. **Lo que sigue sin confirmar es que la columna «% actualización» de M02 sea este artículo** (§1.1); §1.6 explica por qué lo que este archivo publica para 2026 no depende de esa identificación |
| Artículo | 12 del TUO LTM (§1.1, con su número ya confirmado en §1.4); y el art. 14 (§1.2), descartado |
| Publicada | 2004-11-15, fecha del D.S. N.° 156-2004-EF que aprueba el TUO |
| Ejercicios que rige | **2026, y solo 2026.** §1.6 lee el supuesto del art. 12 contra ese ejercicio; el siguiente vuelve a necesitar la misma lectura y no se hereda |
| Filas de NEG-02 §2 | 33 |
| Transcribió | Agent, 2026-08-30; el hecho del ejercicio 2026 (§1.6): Agent, 2026-09-06 |
| Verificó | HNA, 2026-09-06 |
| Estado | VERIFICADO |

> **Este archivo nació sin ninguna cifra, y eso era exactamente el punto.** Existe porque el
> `% actualización` llevaba desde M02 sin fila en el mapa normativo, y **un dato sin fila es un dato
> que nadie va a buscar** — es la misma lección que H-17 dejó con la deducción de Amazonía. Lo que
> trae es el estado de la búsqueda: qué se descartó, con qué evidencia, y qué queda por mirar.
>
> **Mientras no haya fuente, no hay valor por omisión.** Ni aquí ni en el código: la regla 5 vigila
> desde #437 los nombres `ACTUALIZACION` y `FACTOR`, y hay una muestra que lo demuestra
> (`MuestraDeFactorDeActualizacionCompilado`). El valor «obvio» —100 %, o sea 1, o sea ninguno— es
> el más peligroso de todos, porque escribirlo **no se siente** como inventar un dato.
>
> **Y desde el 2026-09-06 este archivo publica una fila, sin dejar de suscribir el párrafo de
> arriba.** Lo que §1.6 sella **no es un valor por omisión**: es un **hecho** sobre el ejercicio
> 2026 —que los dos cuadros cuya ausencia activa el art. 12 se publicaron ese año— leído en dos
> archivos de este mismo corpus que ya están `VERIFICADO` con sus propias dos firmas. La diferencia
> entre las dos cosas es comprobable y no es retórica: **un valor por omisión vale para todos los
> ejercicios y este no vale para ninguno más que 2026**, y el día que un ejercicio se quede sin uno
> de los dos cuadros, este archivo no tiene nada que decir de él y el sistema vuelve a fallar
> nombrando la llave. Ese es el contraste, y §1.6 lo escribe.

## 1. La tabla tal como está en la norma

**No hay tabla, y el encabezado de esta sección es el que el corpus exige a todos sus archivos.** Lo
que hay son los dos artículos candidatos, transcritos **sin reordenar, sin parafrasear y sin
corregir un encabezado**, igual que si fueran una tabla de cifras.

### 1.1 La actualización por Decreto Supremo cuando no se publican los valores

> «Cuando en determinado ejercicio no se publique los aranceles de terrenos o los precios unitarios
> oficiales de construcción, por Decreto Supremo se actualizará el valor de la base imponible del
> año anterior como máximo en el mismo porcentaje en que se incremente la Unidad Impositiva
> Tributaria (UIT).»

Es **el único porcentaje que el TUO LTM aplica para actualizar la base imponible del predial**, y
por eso es hoy el candidato vivo. Encaja además con la posición que la columna ocupa en M02
—autovalúo × `% actualización` × `% propiedad` → base imponible— y explicaría por qué su valor
habitual sería neutro: en un ejercicio en que **sí** se publican los aranceles y los valores
unitarios, este mecanismo no se activa.

`‹NO CONFIRMADO EN FUENTE OFICIAL: que este párrafo sea el que M02 llama «% actualización». Lo que
está confirmado es su texto y que es el único porcentaje de actualización de la base imponible del
predial en el TUO LTM; que sea el mismo campo de la pantalla de M02 es una hipótesis, no una
lectura›`.

### 1.2 El art. 14, y por qué se descarta

> «La actualización de los valores de predios por las Municipalidades, sustituye la obligación
> contemplada por el inciso a) del presente artículo, y se entiende como válida en caso que el
> contribuyente no la objete dentro del plazo establecido para el pago al contado del impuesto.»

Era la hipótesis fuerte y **se descartó leyendo los manuales del SRTM del MEF**, que es donde se
confirma un campo del proceso. El acto del art. 14 está documentado ahí de punta a punta —el Proceso
Masivo (v3.1.0), el Proceso Individual (v4.0.0 §4.3), la migración de declaraciones (v6.1.0 §4.4) y
la emisión mecanizada de la *Guía para el Registro y Determinación del Impuesto Predial*— y **en
todos es una redeterminación**: se refrescan las tablas normativas del ejercicio nuevo —aranceles,
valores unitarios, depreciación, UIT— y se regeneran las declaraciones. En ninguno hay un porcentaje
que se teclee, se calcule o se parametrice.

La Guía del MEF lo dice con sus tres insumos, y ninguno es un porcentaje sobre el autovalúo:

> «A. Actualización de valores. Durante esta etapa se desarrolla la actualización de valores en las
> tablas maestras con los siguientes parámetros: 1. La Tabla de Valores Unitarios Oficiales de
> Edificaciones y de Valores Arancelarios (Ministerio de Vivienda, Construcción y Saneamiento) y la
> Tabla de Porcentajes de Depreciación. 2. La valorización de instalaciones fijas y permanentes
> (metodología publicada por el Ministerio de Vivienda, Construcción y Saneamiento). 3. Valor de la
> UIT.»

**Y la ausencia no es un punto ciego.** En las mismas pantallas del SRTM donde los otros dos factores
de D-11 sí aparecen con nombre —el incremento del 5 % y el factor de oficialización, este último con
su `0.68` visible en la declaración jurada mecanizada—, el `% actualización` no está. La
determinación que el SRTM imprime va: `VALOR UNIT. M2 · INCREMENTO 5% · DEPRECIACIÓN · VALOR
UNITARIO DEPRECIADO · ÁREA CONSTRUIDA · ÁREA COMÚN · AUTOAVALUO · CONDOMINIO-COPROPIEDAD % ·
DEDUCCIÓN · AUTOAVALUO AFECTO`. Sin ninguna columna de actualización.

### 1.3 Una determinación real del SRTM, con sus cifras

El 2026-08-30 se leyó el manual `M02-1-020` —el mismo que solo nombra la columna en un
encabezado— **como imagen**, y su captura de la pestaña «Datos» trae una determinación completa. Es
la primera vez que hay cifras.

| | |
|---|---|
| Autovalúo | `171,179.42` |
| **% actualización** | **`0.00 %`** |
| % propiedad | `80.00` |
| Base imponible | `136,943.54` |
| Base exonerada | `136,943.54` · Base afecta `0.00` · Impuesto `0.00` |

**La aritmética descarta una lectura y fija otra.** `171 179,42 × 0,80 = 136 943,54`, que es
exactamente la base imponible. Es decir:

- **el `% actualización` no multiplica como factor.** Si la secuencia fuera literalmente
  `autovalúo × % actualización × % propiedad` —como la describe NEG-05 §0.1— con `0,00` la base
  sería **cero**, y no lo es;
- **es un incremento, y su valor neutro es `0`, no `100`.** La base sale de
  `autovalúo × (1 + % actualización) × % propiedad`, o su equivalente
  `(autovalúo + % actualización × autovalúo) × % propiedad`: con `0,00 %` las dos dan lo mismo, y
  las dos coinciden con la captura.

**Y eso cambia cuál es el valor peligroso.** Este archivo decía —y la muestra de la regla 5 con
él— que el valor «obvio» era `1`, o sea 100 %. **No lo es: es `0`.** Y `0` es peor, porque
`BigDecimal.ZERO` en un campo llamado «porcentaje de actualización» se lee como «no aplica ninguno»
incluso más que un `1`.

**Lo que esta captura NO prueba**, y hay que decirlo porque es una sola:

- **qué pasa cuando no es cero.** Con `0,00 %`, `× (1 + p)` y `+ p × autovalúo` son
  indistinguibles, y también lo sería cualquier otra forma que se anule en cero;
- **quién lo fija, ni cuándo deja de ser cero.** El manual no lo dice en ninguna parte de su
  texto, y los dos manuales de «Parámetros» del SRTM —el de la CF2 y el de la CF4— tampoco: el de
  la CF2 configura la emisión masiva (año, tipo de lote, concepto y formato por lote) y el de la
  CF4, catálogos del buzón electrónico. **Ninguno tiene una pantalla para este porcentaje.**

De paso, la misma captura confirma dos cosas que ya estaban: los tramos se expresan en soles del
ejercicio —`> 0 y <= 77,250` y `> 77,250 y <= 309,000`, que son 15 y 60 UIT de 2024 (5 150)— y el
resumen lleva «Cuotas 4».

### 1.4 El artículo, ya confirmado: es el **12**

**Resuelto el 2026-08-30, mirando la página.** El párrafo de §1.1 es el **artículo 12 del TUO de la
Ley de Tributación Municipal**, y lo confirma la página 5 del PDF oficial renderizada como imagen:
tras el bloque de concordancias del artículo anterior se lee, con su rótulo delante,

> «**Artículo 12.-** Cuando en determinado ejercicio no se publique los aranceles de terrenos o los
> precios unitarios oficiales de construcción, por Decreto Supremo se actualizará el valor de la base
> imponible del año anterior como máximo en el mismo porcentaje en que se incremente la Unidad
> Impositiva Tributaria (UIT).»

y a renglón seguido «Artículo 13.- El impuesto se calcula aplicando a la base imponible la escala
progresiva acumulativa».

**Por qué la primera vez salió mal, que es lo que hay que recordar.** La extracción anterior leyó el
PDF *sin conservar la disposición del texto*, y con las dos columnas de las concordancias
entremezcladas el rótulo del artículo caía **después** de su propio cuerpo. Extraído conservando la
disposición, el rótulo vuelve a su sitio. La lección no es sobre este PDF: es que **la posición
relativa de un rótulo en una extracción plana no es evidencia de nada**, y por eso el método exige
la página renderizada. Lo que faltaba no era una fuente distinta, era poder dibujarla —el visor no
estaba instalado en la máquina, y ahora sí—.

El sha256 del PDF leído es
`31ac1e01e0a8a5f2cd29ad838b4f6aef3e48bf08cbb772a1207e82d8b92f64fd`, el mismo que
[`fuentes/README.md`](fuentes/README.md) declara para
`DS-156-2004-EF-TUO-Ley-Tributacion-Municipal.pdf`: se descargó del archivo de S3 y se comparó, de
modo que lo que se miró es el ejemplar archivado y no otra copia de internet.

### 1.5 El inventario completo de parámetros del SRTM no tiene ninguno que se llame así

**Y ese silencio es un dato.** Los dos manuales de «Parámetros» que se habían leído —el de la CF2 y
el de la CF4— no lo definían, pero eran dos de **cinco**: el módulo M21 tiene un manual por fase, y
el de la **CF1** (`M21-1-003-Parámetros`, 506 páginas) es el que administra los parámetros del
predial y los generales. Se leyó entero su índice. Los submenús que publica son:

- **Parámetros Predial** — VUO Construcción · VUO Obras Complementarias · Depreciación · Uso de
  Predio Pensionista · **Tasa Predial** · Arancel Urbano · Arancel Rústico
- **Parámetros** — Catálogo · **IPC/IPM** · Municipalidad · Tipo de Cambio · Tipo de Cambio Promedio
  · **UIT** · Concepto de Recaudación · Feriados · Distrito · Interés Moratorio · Tipo de Operación ·
  Vencimiento · Vías · Áreas Organizacionales · Zona Urbana · Sub Zona Urbana · Doc. Sustento ·
  Plazo de Presentación de Tributo · Uso Predio · Uso Predio – Depreciación · Notaría · Agencia ·
  Base legal (y otros de catálogo)
- **Infracción Tributaria**, **Configuración**, **Arbitrios** (Nivel de Afluencia · Grupo de Uso ·
  Tasa Serenazgo · Barrido de Calles · Residuos Sólidos · Parques y Jardines) y **Promedio
  Habitantes**

**Ninguno es el `% actualización`.** No hay pantalla donde teclearlo, ni por ejercicio ni por
municipalidad. Y el sistema que enseña esa columna en M02 es el mismo cuyo módulo de parámetros es
este: si fuera un valor que alguien fija, tendría que estar aquí.

Lo que sí hay es **UIT**, y eso encaja con el artículo 12: el porcentaje que ese artículo autoriza
es «el mismo porcentaje en que se incremente la UIT», que **se calcula** a partir de dos filas de un
parámetro que el módulo sí tiene. Un valor derivado no necesita pantalla.

`‹HIPÓTESIS, NO LECTURA: que M02 calcule el «% actualización» como la variación de la UIT del
artículo 12. Lo confirmado es (a) que el módulo de parámetros del SRTM no tiene ninguno con ese
nombre, y (b) que sí tiene la UIT. Falta una determinación con el porcentaje distinto de cero, que
es lo único que puede distinguir una fórmula de otra›`.

#### 1.5.1 El `IPC/IPM`, que es otra cosa y conviene no confundir

El módulo **sí** tiene un parámetro de índices financieros, y a primera vista parece el candidato.
Su pantalla —«MANTENIMIENTO DE PARÁMETROS - ÍNDICES FINANCIEROS»— la administra el **Administrador
MEF**, o sea es nacional, y guarda por fila: `Año Afectación`, `Mes`, `Índice Financiero`, `Índice`,
`Variación Mensual`, `Variación Acumulado`, `Tipo Base Legal`, `Base Legal` y `Fecha Base Legal`.
Las filas que el manual enseña son reales:

| Año | Mes | Índice financiero | Índice | Var. mensual | Var. acumulada | Base legal |
|---|---|---|---|---|---|---|
| 2018 | 1 | ÍNDICE DE PRECIOS AL POR MAYOR (IPM) | 105.740105 | 0.260000 | 0.260000 | RESOLUCIÓN JEFATURAL INEI |
| 2018 | 1 | ÍNDICE DE PRECIOS AL CONSUMIDOR (IPC) | 88.590000 | 0.130000 | 0.130000 | RESOLUCIÓN JEFATURAL INEI |
| 2018 | 2 | ÍNDICE DE PRECIOS AL POR MAYOR (IPM) | 106.137559 | 0.380000 | 0.630000 | RESOLUCIÓN JEFATURAL INEI |

**Pero no es este campo, y lo dice dónde está cada cosa.** El IPM del artículo 15 del TUO LTM
reajusta las **cuotas** —«las cuotas restantes serán reajustadas de acuerdo a la variación acumulada
del Índice de Precios al Por Mayor»—, y el `% actualización` de M02 no vive en el resumen de cuotas:
vive en la grilla **por predio**, entre el autovalúo y el `% propiedad`. Son dos actualizaciones
distintas, en dos momentos distintos del cálculo, y llamarlas la misma sería el error que este
archivo existe para no cometer.

Queda anotado aquí porque el sistema lo necesitará igual —el reajuste de cuotas del artículo 15 es
una cifra que hoy tampoco está—, y porque quien retome D-11 va a tropezar con esta pantalla y
merece encontrarse ya hecha la distinción.

### 1.6 El supuesto del artículo 12 **no se cumple en el ejercicio 2026**

**Esto no busca la fuente que §3 sigue pidiendo: lee la que §1.4 ya confirmó, contra un ejercicio
concreto.** El artículo 12 del **TUO de la Ley de Tributación Municipal (D.S. N.° 156-2004-EF),
art. 12** no fija un porcentaje: fija un **supuesto** y, dentro de él, un tope. Su primera oración
es una condición negativa, y está transcrita verbatim dos veces en este archivo (§1.1 y §1.4):

> «**Cuando en determinado ejercicio no se publique los aranceles de terrenos o los precios
> unitarios oficiales de construcción**, por Decreto Supremo se actualizará el valor de la base
> imponible del año anterior como máximo en el mismo porcentaje en que se incremente la Unidad
> Impositiva Tributaria (UIT).»

**En el ejercicio 2026 se publicaron los dos.** Y no hace falta salir de este corpus para decirlo:
los dos están transcritos aquí, cada uno en su archivo, cada uno `VERIFICADO` y firmado por dos
personas distintas conforme a ADR-0007.

| Lo que el art. 12 exige que falte | Qué se publicó para 2026 | Dónde está transcrito, y con qué firmas |
|---|---|---|
| Los **aranceles de terrenos** | Resolución Ministerial N.º 514-2025-EF/15, publicada el 2025-10-30 en El Peruano, «Valores Arancelarios de Terrenos … vigentes para el Ejercicio Fiscal 2026» | [`aranceles-2026.md`](aranceles-2026.md) — `VERIFICADO`; transcribió JNA (2026-08-24), verificó HNA (2026-08-25) |
| Los **precios unitarios oficiales de construcción** | Resolución Ministerial N.º 277-2025-VIVIENDA, publicada el 2025-10-30 en El Peruano, «Valores Unitarios Oficiales de Edificación … vigentes para el Ejercicio Fiscal 2026» | [`valores-unitarios-2026.md`](valores-unitarios-2026.md) — `VERIFICADO`; transcribió JNA/Agent (2026-08-24 y 2026-08-28/29), verificó HNA (2026-08-29) |

Los dos son la condición **entera** del artículo, no la mitad: la norma dice «los aranceles de
terrenos **o** los precios unitarios», de modo que basta con que se publique **uno** para que el
supuesto no se cumpla. En 2026 se publicaron **los dos**, y además el mismo día.

**De ahí sale lo que se sella, y sale como hecho y no como omisión.** En 2026 no hay Decreto
Supremo dictado al amparo del art. 12 porque no puede haberlo: su supuesto no ocurrió. No hay
entonces ninguna actualización que aplicar sobre la base imponible del año anterior. En la
aritmética que §1.3 fijó midiendo una determinación real —`base = autovalúo × (1 + % actualización)
× % propiedad`, con el valor neutro en **cero y no en uno**— eso se escribe **`0`**, que es
exactamente la cifra que la captura del SRTM enseña en su campo «% actualización».

**En una frase, que es la que viaja al derivado publicable de `publicacion/` y de ahí a
`parametro_tributario`.`valor_texto`:**

En el ejercicio 2026 se publicaron los aranceles de terrenos y los precios unitarios oficiales de
construcción; el supuesto del art. 12 no se cumple y no hay actualización que aplicar: 0

**Cabe en `varchar(200)`, y eso no es una casualidad tipográfica**: `parametro_tributario`.`valor_texto`
mide exactamente eso (`V1`), y la primera redacción de esta frase —treinta y cinco caracteres más
larga— se publicó, la rechazó la base y dejó al conjunto sin la fila. El fundamento entero está
arriba; lo que viaja a la base es la frase que cabe y remite a él.

**Y la diferencia con el valor por omisión que la cabecera prohíbe es comprobable**, no una
declaración de intenciones. Un valor por omisión diría «cuando no se sepa, cero» y valdría para
todos los ejercicios; esto dice «en 2026 no ocurrió el supuesto que generaría un porcentaje» y no
vale para ninguno más. La prueba de que son cosas distintas es qué pasa con un ejercicio en que
**sí** falte uno de los dos cuadros: este archivo no tiene nada que decir de él —no hay fila para
él, ni la habrá hasta que alguien lea sus dos publicaciones— y el sistema tiene que volver a fallar
nombrando la llave `PORCENTAJE_DE_ACTUALIZACION`, que es lo que ya hace.

**Lo que esto NO cierra, dicho para que nadie lo lea por más de lo que es:**

- **No cierra D-11 entera. Cierra D-11 para 2026.** Cada ejercicio necesita su propia lectura de
  las dos publicaciones, y la de 2027 no está hecha.
- **No confirma que la columna «% actualización» de M02 sea el artículo 12.** El
  `‹NO CONFIRMADO EN FUENTE OFICIAL›` de §1.1 sigue en pie, y §1.5 explica por qué no se ha podido
  cerrar. Lo que se afirma aquí es más estrecho y no depende de él: **el único porcentaje de
  actualización de la base imponible del predial que el TUO LTM contiene es el del art. 12**, y en
  2026 su supuesto no se cumple. Si algún día se descubre que M02 llama «% actualización» a otro
  mecanismo, lo que habrá que revisar es el **nombre de la llave**, no la cifra que esta fila sella
  para el art. 12.
- **No dice qué pasa cuando el porcentaje no es cero.** Sigue siendo lo que §1.3 declaró que su
  única captura no puede probar: con `0,00 %`, `× (1 + p)` y `+ p × autovalúo` son
  indistinguibles. El día que un ejercicio active el art. 12, **antes** de correr hay que decidir
  esa forma y dónde se aplica (ver el punto siguiente).
- **No decide dónde se aplica.** La captura de §1.3 lo sitúa entre el autovalúo y la base
  imponible, o sea del lado de `rentas` (ADR-0024), junto al `% propiedad` de D-21. Con `0` las dos
  colocaciones dan el mismo céntimo, así que 2026 no obliga a decidirlo; un ejercicio con `p ≠ 0`
  sí. Queda anotado aquí y en el registro de `catastro`.

#### 1.6.1 En qué consistió la verificación de §1.6, y qué no cubre

**La segunda lectura fue un cotejo mecánico contra este mismo corpus, no una persona releyendo el
PDF del TUO**, y la autorizó el dueño del repositorio, que es quien responde por ella. Es la misma
forma —y la misma limitación— que
[`obras-complementarias-y-oficializacion-2026.md`](obras-complementarias-y-oficializacion-2026.md)
declara para su factor de oficialización.

Lo que el cotejo comprueba es exactamente esto y nada más:

1. que el texto del art. 12 citado arriba sea **letra por letra** el que §1.1 y §1.4 ya traen —lo
   son: es la misma cadena, y §1.4 la respalda con el sha256 del PDF oficial leído;
2. que las dos resoluciones de la tabla existan en este corpus, estén en `VERIFICADO` y sus dos
   firmas sean distintas —lo comprueba además `verificar-publicacion.mjs` en cada PR, y sobre los
   propios archivos, no sobre esta tabla.

**Lo que no cubre:** no se ha vuelto al diario oficial a comprobar que no exista, además, un
Decreto Supremo de 2026 dictado al amparo del art. 12. No podría existir sin contradecir su propio
supuesto, pero eso es un razonamiento y no una lectura.
`‹NO CONFIRMADO EN FUENTE OFICIAL: que no se haya publicado ningún Decreto Supremo de actualización
de la base imponible para el ejercicio 2026. Lo confirmado es que el supuesto que lo habilitaría no
se cumple›`.

## 2. Cómo entra al sistema

**Entra desde el 2026-09-06, y solo para 2026.** Lo que entra es el hecho de §1.6, no una cifra
buscada: en el ejercicio 2026 el supuesto del art. 12 no se cumple, y por tanto **no hay
actualización que aplicar**.

| Qué | Dónde |
|---|---|
| Tipo | `parametro_tributario`, tipo `PORCENTAJE_DE_ACTUALIZACION` |
| Clave | Sin clave: es un solo valor por ejercicio, la misma forma que la UIT y que `FACTOR_OFICIALIZACION` |
| Ámbito | nacional — lo fija el Gobierno nacional por Decreto Supremo, no una ordenanza local (§3, camino 3) |
| Vigencia | **2026 únicamente** (`2026-01-01`..`2026-12-31`). No se prorroga: el ejercicio siguiente vuelve a exigir la lectura de sus dos publicaciones |
| Valor | `0`, con el fundamento de §1.6 y no como valor por omisión |

Y lo que **no** cambia, porque es lo que hace que la fila de arriba signifique algo:

| Qué | Cómo |
|---|---|
| Un ejercicio **sin** fila | Falla nombrando su llave, como `TASA_ANUNCIO:‹CLASE›` (#51), `BENEFICIO:‹CAMPAÑA›` (#72) y `VEHICULAR_MINIMO` (#399): **422 nombrando la llave**, nunca un importe plausible. Hoy eso es todo ejercicio que no sea 2026 |
| Si alguien lo compila | La regla 5 lo rechaza igual que antes: `ACTUALIZACION` y `FACTOR` siguen en la lista de nombres vigilados desde #437, con su muestra. Que exista una fila **publicada** no autoriza a escribir la cifra en el código: son las dos mitades de la regla, no una alternativa a la otra |
| `RT-002`, `RT-005` y `RT-011` | Siguen sin implementarse aquí. Lo que 2026 desbloquea es la **valuación** de `catastro` (su `#8`), que es la mitad de Predial de ADR-0024; la determinación de la obligación es de `rentas` y no la toca esta fila |

## 3. Qué no cabe hoy

> **Lo que §1.6 cierra y lo que deja abierto, para leer esta sección sin confundirlas.** §1.6 cierra
> **el ejercicio 2026** leyendo el supuesto del art. 12 contra sus dos publicaciones. **No cierra
> nada de lo que sigue**: ni identifica la columna de M02, ni dice cuánto vale el porcentaje cuando
> el art. 12 sí se activa, ni quién lo fija. Los tres caminos de abajo siguen siendo los que hay
> que recorrer, y el tercero es el que §1.6 convierte en el más prometedor.

- **La fuente.** Es lo que falta, y este archivo existe para que la próxima búsqueda no repita las
  anteriores.

  **Y lo primero que hay que decir es lo que NO va a funcionar.** Parecía que el camino era
  conseguir el manual donde la columna se vio —`M02-1-020 «Determinación de Deuda» v1.4`,
  12-12-2025, del SRTM moderno—. **Ese manual ya se leyó, entero**: es el único de los 74 del corpus
  del SRTM cuya cobertura NEG-00 §1 declara «Completa», y todo lo que aportó sobre esta columna es
  **su nombre en el encabezado de una grilla**:

  > «Detalle de los predios (dentro de una determinación): código · ubicación · autovalúo ·
  > **% actualización** · % propiedad · base imponible · base exonerada · uso.
  > **Concepto nuevo: `% actualización`.** Un factor aplicado al autovalúo antes de la base
  > imponible. ⚠ Sin identificar; probablemente el reajuste de valores del ejercicio.»
  > — *`../srtm`, `referencia-srtm-mef.md` §5b.2*

  Ese «probablemente» es conjetura del lector, marcada con su aviso, no una lectura. **El manual no
  define la columna**, y los otros cuatro conceptos nuevos de la misma sección —la deducción de
  Amazonía, el incremento del 5 %, el factor de oficialización y el metrado redondeado— salieron
  igual: nombres de columna sin definición. Volver a ese PDF no desbloquearía nada.

  Los caminos que quedan, en orden de valor:
  1. **El módulo `M21 Parámetros`** (38 MB, sin leer). Si el `% actualización` es configurable, se
     configura ahí y no en la pantalla de determinación. Es la pregunta que M02 no podía contestar
     por ser el manual del consumidor y no el del parámetro.
  2. **Una determinación real del SRTM con su desarrollo intermedio y sus cifras.** Contesta «cuánto
     vale» aunque nadie diga «qué es», y es exactamente lo que
     [`observaciones-srtm-mef/`](../observaciones-srtm-mef/) pide.
  3. **Perseguir el párrafo de §1.1**: si esa es la fuente, la pregunta deja de ser «¿qué norma crea
     el porcentaje?» y pasa a ser «¿qué Decretos Supremos se han dictado al amparo de ese párrafo, y
     en qué ejercicios?». Y el factor no sería un valor anual sino **excepcional**: neutro cuando
     hay valores publicados, el del D.S. cuando no los hay. Lo fija el Gobierno nacional, así que
     sería `D-02a` y no ordenanza local.

  **Lo que NO se puede concluir de los trece PDF públicos del MEF**, y conviene decirlo porque
  invita a un error: buscar «% actualiz» en su capa de texto da **cero coincidencias**, y eso no
  refuta nada. Esos manuales son casi todos capturas de pantalla —de uno de 8,2 MB salen 49 530
  caracteres, y «depreciación», «valor unitario» y «arancel» dan cero en un manual que describe la
  determinación predial—. **Una columna que viva dentro de una captura es invisible a ese método.**
- **Dos cosas que NO son este factor**, y conviene dejarlas deslindadas porque se le parecen y están
  por todo el corpus:
  - el **ajuste por IPM de la alcabala** (TUO LTM art. 24), que es el campo «IPM aplicado» de la
    pantalla de alcabala y opera sobre el valor de transferencia, no sobre el autovalúo;
  - el **reajuste de cuotas y moras** por IPM (art. 15.b), que está del lado de la deuda.

  Confundir cualquiera de los dos con el `% actualización` arrastraría una lectura equivocada a
  alcabala, que es una pantalla que ya existe.

## 4. Documentos relacionados

[`decisiones-abiertas.md`](../../00-gobierno/decisiones-abiertas.md) (D-11) ·
[`plan-de-desbloqueo-D-02.md`](../../00-gobierno/plan-de-desbloqueo-D-02.md) (H-17) ·
[`marco-normativo.md`](../marco-normativo.md) §2 fila 33 ·
[`valores-unitarios-2026.md`](valores-unitarios-2026.md) §1.6 —el incremento del 5 %, el factor de
D-11 que sí quedó resuelto— ·
[`obras-complementarias-y-oficializacion-2026.md`](obras-complementarias-y-oficializacion-2026.md)
—el factor de oficialización— ·
[`predial-deduccion-amazonia.md`](predial-deduccion-amazonia.md) —el precedente de «la norma da el
mecanismo, no la cifra»—
