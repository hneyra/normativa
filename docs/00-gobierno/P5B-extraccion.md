# P5B — `normativa` extraído: el primer sistema fuera del monolito

**Fecha:** 2026-09-04. **Origen:** `rentas@772a8d7` (que viene de `sgtm@0d33ad7b`).
**Repositorios tocados:** `normativa` (destino) y `rentas` (origen de la resta).
**`sgtm` no se tocó:** `git status` queda limpio, sin un solo archivo modificado.

Es la primera extracción de verdad. Se eligió `normativa` porque es la de menor riesgo —sólo
lectura, inmutable una vez sellado, y nacional desde ADR-0017— y porque lo que se aprenda aquí lo
pagan las tres que vienen.

---

## 1. Los cuatro criterios, con su medida

| # | Criterio | Medida |
|---|---|---|
| **1** | **`rentas` arranca y calcula con `normativa` apagado.** Prueba de humo en CI, no manual | **7 pruebas** en `SinNormativaFronteraTest`, contra PostgreSQL real y con el cliente HTTP de verdad apuntado a **un puerto que nadie escucha**. §3 |
| **2** | El recálculo de un ejercicio ya sembrado da **el mismo céntimo** antes y después | **Los dos archivos son idénticos**, mismo `sha256`: `a3f9ff2411c1ffef81b959b61b700ae1d6680b36529ee90ac76252dac017e3c5`. §4 |
| **3** | `verificar-valores-normativos.mjs` corre en el CI de `normativa` y sigue poniéndose rojo con sus muestras rotas | Corre en `Documentación` de este repositorio, **antes** de la comprobación real. Demostrado que muerde. §5 |
| **4** | Los tres verificadores bloqueantes en verde en los dos repositorios | Los seis, verdes. §6 |

---

## 2. El desglose de pruebas, y por qué sube

Medido ejecutando y contando los XML de `*/build/test-results/*/TEST-*.xml`, no leyendo la salida
de Gradle.

| | Antes (`rentas` solo) | `rentas` | `normativa` | Total |
|---|---:|---:|---:|---:|
| **Pruebas** | **3 756** | **3 667** | **598** | **4 265** |
| Fallos | 0 | 0 | 0 | 0 |

**La diferencia es +509, y cuadra al número:**

```
3 756 (base) + 20 (nuevas) + 448 (plataforma y barreras duplicadas)
             + 47 (reglas duplicadas) − 6 (retiradas)              = 4 265
```

| Concepto | Pruebas | Por qué |
|---|---:|---|
| **Nuevas** | **+20** | 5 del ámbito de ADR-0024, 7 del snapshot, 7 del criterio 1, 1 del criterio 2 |
| **Plataforma y barreras duplicadas** | **+448** | `dominio-compartido` (154), `plataforma` (177), las barreras de `aplicacion` (81) y el esquema (36). **Es la duplicación que P3 ya diseñó**: cada repositorio corre sus propias barreras, y §7.1 dice qué costaría no duplicar el resto |
| **Reglas duplicadas** | **+47** | `MotorDeReglasTest` y compañía viven en los dos. §7.1 |
| **Retiradas** | **−6** | Medían guardas de la base que se fueron con sus tablas. §7.3 |

Módulo a módulo, para que se vea qué se movió y qué no:

| Contexto | Antes | `rentas` | `normativa` |
|---|---:|---:|---:|
| aplicacion | 130 | 130 | 81 |
| catastro | 431 | **425** | — |
| coactiva | 197 | 197 | — |
| contribuyentes | 80 | 80 | — |
| cuentacorriente | 273 | 273 | — |
| dominio-compartido | 154 | 154 | 154 |
| esquema | 46 | 46 | 36 |
| fiscalizacion | 297 | 297 | — |
| indicadores | 57 | 57 | — |
| licencias | 285 | 285 | — |
| **parametros** | **138** | **54** | **102 + 48 (`reglas`)** |
| plataforma | 177 | 177 | 177 |
| rentas | 586 | **587** | — |
| sanciones | 240 | 240 | — |
| seguridad | 180 | 180 | — |
| tesoreria | 304 | 304 | — |
| valores | 181 | 181 | — |
| **TOTAL** | **3 756** | **3 667** | **598** |

---

## 3. Criterio 1 — `rentas` calcula con `normativa` apagado

`SinNormativaFronteraTest` monta las piezas de producción —`CacheDeSnapshotsJdbc` escribiendo las
tablas de `V3`, `ClienteHttpDeNormativa` hablando HTTP de verdad, `LectorDeParametrosCacheados`
resolviendo la vigencia— y apunta el cliente a **un puerto reservado y soltado**, que es la forma
más fiel de «no hay nadie al otro lado». Lo único fabricado es el servidor, porque es justamente lo
que se quiere poder apagar.

**El reparto que se mide es asimétrico, y la asimetría es la decisión:**

- **Recalcular** (`porConjunto`) **no llama por red nunca.** Parte del `conjuntoId` que la
  determinación guardó (ADR-0025 §3) y ese conjunto ya está en la caché. Es lo que hace que
  recalcular un ejercicio de 2027 funcione en 2037 (regla 6).
- **Abrir una corrida nueva** (`vigenteEn`) pregunta primero, porque entre dos corridas puede
  haberse sellado una versión nueva —un arancel corregido a mitad de año, ARQ-09 §3— y ésa es la
  única llamada que se entera. Con `normativa` caído se repliega al conjunto cacheado **y lo dice**
  en el registro, con el conjunto y el día en que se descargó.
- Y **si no hay ni caché ni servidor**, falla con `NormativaInalcanzable` y **no** con
  `EjercicioSinSellar`. Las dos se arreglan de manera distinta —una levantando un despliegue, otra
  sellando un ejercicio— y decir la segunda cuando pasa la primera manda a quien atiende a buscar
  una ordenanza que sí existe.

### Cómo se demostró que muerde

Tres roturas, cada una aplicada **sola** sobre `src/main` y restaurada **por copia comparada con
`diff -r`**:

| Rotura | Resultado |
|---|---|
| Que el recálculo vuelva a llamar por red: se quita la comprobación de caché en las **dos** capas | **5 de 7 en rojo.** Sin la caché delante, `porConjunto` sale a la red y con el puerto muerto no vuelve |
| Que el cliente no verifique la huella antes de cachear | 1 en rojo, la que lo mide: «cachear PARA SIEMPRE un contenido que no se pudo verificar es peor que no tener caché» |
| Que el repliegue diga `EjercicioSinSellar` en vez de `NormativaInalcanzable` | 1 en rojo. Es la que separa «falta sellar» de «falta un despliegue» |

### Lo que la propiedad NO la sostiene una prueba

Que no haya una consulta por parámetro dentro de un bucle **no lo sujeta ningún test**: lo sujeta
que `PublicadorDeNormativa` tenga **dos** métodos y ninguno sepa contestar a una pregunta por
partida. No hay `uitDe(ejercicio)` ni `arancelDe(via)`, y el día que alguien los añada la propiedad
se pierde sin que nada se ponga rojo. Queda dicho en el javadoc del puerto.

---

## 4. Criterio 2 — el mismo céntimo, comparado como archivos

`PadronRecalculadoTest` publica las **33 filas** del derivado `parametros-2026.csv`, las compone en
un conjunto, lo sella, y **lo vuelve a leer por el camino de producción** —que es exactamente el que
P5B cambió—. Después escribe un archivo con el cuadro resuelto (UIT, los tres tramos, mínimo
imponible, políticas de redondeo) y con el impuesto de **catorce autovalúos** que cubren los tres
tramos del art. 13, sus dos fronteras exactas y el borde del mínimo.

**La cuenta la hace la regla de producción**, `TramosProgresivosAcumulativos`, con las políticas del
mismo conjunto: escribirla en la prueba habría medido la prueba y no el sistema.

La misma clase corrió en un **worktree de `rentas@772a8d7`** —el árbol anterior a P5B— con dos
adaptaciones, y ninguna toca lo que se compara: el nombre de la tabla donde se publica
(`parametro_tributario` allí, `parametro_tributario_de_prueba` aquí, y por eso entra por propiedad
de sistema) y la ruta del corpus, que antes estaba en el mismo repositorio.

```
$ diff /tmp/padron-ANTES.csv /tmp/padron-DESPUES.csv
$ shasum -a 256 /tmp/padron-ANTES.csv /tmp/padron-DESPUES.csv
a3f9ff2411c1ffef81b959b61b700ae1d6680b36529ee90ac76252dac017e3c5  /tmp/padron-ANTES.csv
a3f9ff2411c1ffef81b959b61b700ae1d6680b36529ee90ac76252dac017e3c5  /tmp/padron-DESPUES.csv
```

El archivo, entero:

```
seccion,clave,valor
cuadro,uit,5500.000000
cuadro,minimoImponible,33.00000000000000
tramo,0,82500.000000000000|0.200000
tramo,1,330000.000000000000|0.600000
tramo,2,sin-tope|1.000000
cuadro,redondeo,PoliticasDeRedondeo{IMPUESTO_POR_TRAMO=…[escala=2, modo=HALF_UP], CUOTA=…}
padron,0.00,0.00
padron,1000.00,33.00000000000000
padron,50000.00,100.00
padron,82500.00,165.00
padron,82500.01,165.00
padron,100000.00,270.00
padron,200000.00,870.00
padron,329999.99,1650.00
padron,330000.00,1650.00
padron,330000.01,1650.00
padron,500000.00,3350.00
padron,1000000.00,8350.00
padron,2500000.00,23350.00
padron,9999999.99,98350.00
```

### Cómo se demostró que la comparación muerde

| Rotura en el árbol de después | Resultado |
|---|---|
| Quitar la resolución de vigencia de #659 (`put` en vez de `putIfAbsent` con el filtro) | **Ni siquiera llega a escribir el archivo**: la prueba falla con `VigenciasQueSeSolapan`, porque las cinco filas de `UIT` colisionan. Es mejor que un diff: el sistema se **niega** en vez de elegir |
| Que `rigeEn` devuelva siempre `true` | Igual: falla en vez de producir un padrón equivocado |
| Recortar la precisión del valor leído a dos decimales | **Diff de seis líneas**: `uit` pasa de `5500.000000` a `5500.00`, los tres tramos cambian de escala y el mínimo imponible de `33.00000000000000` a `33.000000` |

**Lo que este criterio NO cubre, dicho aquí:** no es un padrón de 14 422 predios recalculado
extremo a extremo. `DeterminarPredial` exige padrón, predios y titularidad —el escenario entero— y
lo que P5B cambió es **de dónde salen los parámetros**, no las reglas, que son puras y no se tocó
ni una. Lo que se compara es el cuadro que llega al cálculo más el impuesto que de él sale; si el
cuadro cambiara un céntimo, la frontera de tramo lo delata. Un padrón sembrado completo es de la
etapa que lo tenga.

---

## 5. Criterio 3 — el corpus y sus verificadores, corriendo aquí

Se mudaron a `normativa` (ADR-0025 §5, «la doble verificación empieza en el documento y no en la
fila»): los **60 archivos** de `docs/10-negocio/valores-normativos/`, los **seis verificadores**,
`marco-normativo.md` (NEG-02) y `plan-de-desbloqueo-D-02.md` (GOB-03).

Los siete pasos del flujo `Documentación` de este repositorio, ejecutados aquí:

| Paso | Resultado |
|---|---|
| `verificar-mapa-normativo.mjs` | 34 filas, 7 issues bloqueados (D-02a: 0 · D-02b: 5 · D-02c: 3) |
| `verificar-las-muestras-de-valores.mjs` | «Las 9 prohibiciones de valores normativos muerden, y una en regla pasa» |
| `verificar-valores-normativos.mjs` | Verde. D-02c: 2 sin archivo |
| `verificar-las-muestras-de-publicacion.mjs` | «Las 12 prohibiciones del derivado publicable muerden, y el real pasa» |
| `verificar-publicacion.mjs` | Verde. VERIFICADO y sin publicar: 8, con su motivo escrito |
| `verificar-cuadros.mjs` | 2 ediciones publicables, cada una respaldada por su archivo VERIFICADO y por la huella de su archivo de filas |
| `derivar-depreciacion.mjs --comprobar` | Verde |

**Y se demostró que la cadena muerde:** neutralizando la regla de las dos firmas distintas en
`verificar-valores-normativos.mjs`, `verificar-las-muestras-de-valores.mjs` se pone rojo nombrando
la muestra —«La muestra «transcriptor-igual-a-verificador» NO se detecta: la comprobación pasó en
verde»—. Restaurado byte a byte, vuelve a verde.

**Un hallazgo del traslado:** `etiquetas-de-bloqueo.json` viaja con el corpus aunque GOB-05 §924 lo
agrupe con `catalogo-de-opciones.md` hacia `infrastructure`. El contenido del archivo decide: es la
instantánea de las etiquetas `bloqueado:D-02x`, y D-02b y D-02c son decisiones **de `normativa`**.
Dejarlo en `rentas` habría dejado `verificar-mapa-normativo.mjs` sin la mitad que compara.

---

## 6. Criterio 4 — los tres verificadores bloqueantes

Contra PostgreSQL **16.15 real** en `127.0.0.1:55444`, con `--no-build-cache`, `--no-parallel` y
`cleanTest`, para que ninguna tarea se dé por `UP-TO-DATE` (lección de #192 §2).

| Tarea | `normativa` | `rentas` |
|---|---|---|
| `./gradlew build` | **VERDE** — 598 pruebas | **VERDE** — 3 667 pruebas |
| `./gradlew verificarArquitectura` | **VERDE** | **VERDE** |
| `./gradlew verificarAislamiento` | **VERDE** | **VERDE** |

> **Hueco heredado, medido otra vez:** las pruebas de persistencia corrieron contra un **motor de
> verdad**, con RLS, `FORCE ROW LEVEL SECURITY` y los cuatro roles reales, pero **no por el camino
> de Testcontainers**, que es el que corre en CI. Testcontainers no sirve desde esta máquina y está
> medido, no supuesto: el demonio es un túnel a un VPS, el contenedor arranca allí y su puerto se
> publica allí, de modo que `getJdbcUrl()` devuelve un `localhost:<puerto>` inalcanzable. Es el
> mismo hueco que declararon P3, P4 y P5A.

---

## 7. Las decisiones de diseño, y lo que cuestan

### 7.1 `normativa-reglas` existe, y `rentas` todavía no lo consume — con su número

ADR-0025 pide dos artefactos y los dos están: el **servicio** (datos) y **`kamayuk-normativa-reglas`**
(código), sin Spring y sin base de datos, que es lo que lo hace publicable. Cada regla declara su
`Ambito` (ADR-0024): el método **no tiene cuerpo**, así que una regla sin ámbito **no compila** —se
comprobó: el compilador rechazó las tres reglas anónimas de `MotorDeReglasTest`— y `MotorDeReglas`
rechaza el catálogo entero **al construirse**, no a mitad de una corrida.

**Lo que falta es que `rentas` lo compile dentro del suyo, y el motivo está medido.** Una regla
habla en `Dinero`, `Ejercicio`, `ValorNormativo` y `PoliticasDeRedondeo`, y esos objetos de valor
viven hoy en el `dominio-compartido` de **cada** sistema. Para que `rentas` importe
`kamayuk.normativa.reglas.MotorDeReglas` haría falta que los dos hablen de los **mismos** tipos, y
eso es sacar `kamayuk.rentas.dominio` a una librería compartida:

```
$ grep -rl "import kamayuk.rentas.dominio." --include='*.java' . | grep -v /build/ | wc -l
     938
```

**938 archivos.** Es una etapa entera, y esta instrucción dice explícitamente que no se renombra
nada de Java salvo el paquete raíz. Así que hoy hay **dos copias** de las reglas puras —47 pruebas
duplicadas— y el riesgo que eso trae es el que ADR-0024 §3 nombra: dos interpretaciones del
`HALF_UP`. **No hay ninguna guarda que impida que diverjan**, y es el hueco más caro que deja esta
etapa. Lo mismo vale para `plataforma` y `dominio-compartido`, duplicados enteros (331 pruebas).

### 7.2 La caché local: filas, no un `jsonb`

Se midió la alternativa y se descartó **por cómo lee el cálculo**, no por gusto:
`ValorReferencialRepositoryJdbc` resuelve **un** vehículo por marca, modelo y año dentro de un anexo
de 54 000 filas, y hacerlo dentro de un documento de varios megabytes obliga a deserializarlo entero
en cada consulta. Con filas, la consulta es la misma de antes salvo el nombre de la tabla, y sigue
teniendo su índice.

Lo que la forma cuesta está escrito en `V3`: la huella **no se puede recalcular** después sobre esas
filas. Se verifica al descargar y se guarda con la fila de identidad.

Y lo que la separa de «replicar las tablas por evento» —que ADR-0025 descarta— son dos cosas del
esquema, no una promesa: **sólo entra lo sellado** (`normativa` no sirve un conjunto abierto) y
**`sgtm_app` recibe `INSERT` y `SELECT` y nada más**.

### 7.3 La descarga abre su propia transacción, y **no** es el defecto de #52

Quien pide un valor normativo casi siempre está dentro de un `@Transactional(readOnly = true)`, y
ahí PostgreSQL rechaza todo `INSERT` — se descubrió ejecutando: **13 pruebas de convenios en rojo
con «cannot execute INSERT in a read-only transaction»**. Por eso `DescargaDeNormativa` va con
`REQUIRES_NEW`.

#52 midió que un `REQUIRES_NEW` deja sobrevivir al fallo del paso siguiente lo que la transacción
interna ya escribió, y allí eso **era** el defecto. Aquí es al revés, y por una propiedad del dato:
lo que se escribe es una copia **inmutable y verificada** de un conjunto ya sellado. Que sobreviva
no deja nada a medias — deja exactamente lo mismo que dejaría volver a descargarlo, byte a byte.

### 7.4 Lo que se retiró de `rentas`, y qué garantía se fue con ello

| Qué | Dónde está ahora |
|---|---|
| `PublicarParametros`, `PublicarCuadros`, `AbrirConjuntoDeParametros`, `ImportarParametrosDelConjunto`, `AdministrarParametros` y sus repositorios | `normativa`. Publicar es un acto administrativo con doble firma y ocurre donde está el rol de carga |
| `GET /seguridad/parametros` (el listado paginado de conjuntos) | Sale de `IMPLEMENTADAS` y **se queda en el contrato**, como `GET /portal/deuda`. Servirlo desde `rentas` sólo podría enumerar los conjuntos **descargados**, y eso diría «éstos son los conjuntos de la municipalidad» cuando lo cierto sería «éstos son los que hemos bajado» |
| `GET /seguridad/parametros/ejercicios/{ejercicio}` (#605) | **Se queda**, servido desde el lector. Las doce pantallas que calculan siguen en `rentas` |
| 4 pruebas de `TablasDeValuacionTest`, 1 de `ImportarArancelTest`, 1 de `DosVocabulariosDePartidaTest` | Medían el `REVOKE` de `V55`, el disparador de `V9`, el `CHECK` de `V59` y el disparador de `V18`. Las tres primeras viven en `normativa` con sus tablas. **La cuarta no**: ver el hueco 3 de §8 |

---

## 8. Huecos declarados

1. **Dos copias de las reglas puras, sin nada que impida que diverjan.** §7.1, con su número: son
   938 archivos de renombrado. Es el hueco más caro de esta etapa, y el que le toca a quien decida
   sacar `dominio-compartido` a una librería compartida.

2. **`rentas` no compila sus pruebas sin `normativa` clonado al lado.** Tres clases —los plazos de
   prescripción, el plazo de la REC-1 y el corpus de casos del predial— comprueban que **la llave
   con que el derivado publica un valor es la que el consumidor pide** (#192). Antes de P5B las dos
   mitades estaban en el mismo árbol; ahora el CSV es de `normativa` y el consumidor de `rentas`.
   Se sostiene por el mismo mecanismo con que el backend consume `comun-verificaciones`: el
   repositorio hermano. **Si no está, la prueba falla nombrando el `git clone`; no se salta.** El
   CI de `rentas` tiene que hacer checkout de **tres** repositorios, y eso no se ha escrito en su
   `backend.yml` — los workflows no se empujan desde esta sesión.

3. **`arancel` se queda sin la guarda de `V18`.** El disparador
   `arancel_de_conjunto_sellado_inmutable` consultaba `conjunto_parametros`, que se fue: una
   función que consulta una tabla inexistente no protege nada, revienta en el primer `INSERT`. `V2`
   la retira. **Hoy nada impide cargar un arancel contra un conjunto ya sellado.** Hay que
   reconstruirlo en `catastro` (P5C), donde `arancel` va a vivir y donde estará la copia local del
   conjunto con la que comprobarlo.

4. **`rol_carga_parametros` sigue pudiendo conectarse a la base de `rentas`,** donde ya no tiene ni
   una tabla que escribir. El `REVOKE CONNECT` es un privilegio **sobre la base** y sólo lo puede
   retirar su dueño; `sgtm_owner` a propósito no lo es (lo midió #722: «permission denied for
   database»), así que la sentencia en la migración fallaría y dejaría la instalación sin migrar.
   Le toca a `crear-roles.sql`, que corre como superusuario.

5. **`normativa` no tiene contrato de API derivado.** Publica cuatro operaciones —los conjuntos, el
   snapshot y las dos de parámetros— y no hay `ContratoDeApiTest` ni `FormasDeLaApiTest` que las
   sujeten. El generador de `rentas` deriva del prototipo del manual (#312) y aquí no hay prototipo
   del que derivar; inventar un YAML a mano sería exactamente lo que ese issue prohíbe. Lo que sí
   está sujeto es la forma del snapshot, por `ComponerSnapshotTest`.

6. **La huella es de los bytes servidos, no de una serialización canónica.** Se eligió así a
   propósito —una canónica exigiría dos implementaciones que tienen que coincidir, y dos algoritmos
   que deben dar lo mismo son dos que un día dejan de darlo— y el coste es que un cambio del
   serializador cambiaría el `ETag` sin cambiar el `conjuntoId`. Que dos composiciones del mismo
   conjunto sean idénticas lo mide `ComponerSnapshotTest`; que el `ETag` sea estable entre versiones
   de Jackson, no lo mide nadie.

7. **La descarga no está en el camino de ninguna corrida masiva todavía**, porque ninguna existe con
   cifras: D-02a sigue abierta y ningún ejercicio está sellado en ninguna instalación. El día que lo
   esté, lo que hay que medir es que una corrida de 300 000 predios haga **una** petición; hoy eso
   lo sostiene la forma del puerto (§3) y no una medida.

8. **`kamayuk-normativa-plataforma` viajó entero**, con su paquete `documentos` —los tres
   renderizadores de PDF, RTF y XLS— y con `RecorridoPorMunicipalidades`, que no tienen consumidor
   en este sistema. No cuestan ninguna dependencia (los renderizadores están escritos a mano) y se
   van cuando la plataforma se saque a librería compartida.

---

## 9. Cambios al baseline de P0B, con su diff

El baseline `docs/40-datos/baselines/normativa/V1__baseline.sql` entró **tal cual salvo cinco
funciones** que el generador había arrastrado y que no son de este sistema. Ninguna tenía aquí un
disparador que la usara:

| Función retirada | De quién es |
|---|---|
| `nombre_normalizado(text)` | `catastro` — es la columna generada de `via` |
| `verificar_participacion_no_excede()` | `catastro` |
| `verificar_titularidad_no_excede()` | `catastro` |
| `declaracion_jurada_estado_es_terminal()` | `rentas` |
| `valuacion_de_conjunto_sellado_es_inmutable()` | Cuelga de `arancel`, que se queda en `catastro` (✅ D-N4) |

El archivo pasa de **836 a 748 líneas**. **Y no lo encontró una revisión**: lo encontró el escáner
de frontera de sistema, porque `verificar_participacion_no_excede` consulta `participacion_comun`
—una tabla de otro sistema— y eso es un cruce de frontera escrito dentro del propio esquema.

`sgtm/docs/40-datos/baselines/normativa/V1__baseline.sql` **no se tocó**: es archivo histórico y la
instrucción de esta etapa es no modificarlo. El baseline vivo es el de este repositorio.

---

## 10. Los dos cruces de GOB-05 que esta etapa cierra

`PENDIENTE-CRUCE-02` (valores unitarios y depreciación, `catastro` → `normativa`) y
`PENDIENTE-CRUCE-03` (valores referenciales, `rentas` → `normativa`) **salen de
`CrucesConsentidosDelSgtm`**. Ya no cruzan nada: las tres tablas se fueron y lo que
`ValuacionRepositoryJdbc` y `ValorReferencialRepositoryJdbc` leen ahora es la caché local.

Retirarlos no es un trámite: `ningunCruceConsentidoSobra` vuelve a escanear **sin** la lista y exige
que cada entrada siga eximiendo un cruce de verdad, así que dejarlas puestas habría puesto la prueba
en rojo. Es la lista de trabajo pendiente encogiéndose por haberse hecho el trabajo.

Quedan cuatro: `PENDIENTE-CRUCE-01` (dos clases, `rentas` → `catastro`), `-04`, `-05` y `-06`.

---

## 11. Cómo sembrar el escenario en una prueba, ahora que las tablas no están

Veinte clases de prueba de `rentas` necesitan la misma premisa de siempre —«esta municipalidad tiene
un conjunto sellado con estos valores»— y las tablas donde la escribían se fueron. La solución tiene
tres piezas y conviene entenderlas juntas:

1. **`EscenarioDeNormativa`** (en los fixtures del esquema) crea seis tablas con sufijo
   `_de_prueba`, réplicas de las que se fueron. El sufijo **no es cosmético**: conservarles el nombre
   habría dejado veinte clases con SQL contra `parametro_tributario`, y quien lo leyera concluiría
   que la tabla sigue aquí — además de que el escáner de frontera no podría distinguir una siembra
   de un cruce de verdad.
2. **Un disparador que hace de descarga.** Al marcar un conjunto como `SELLADO`, copia sus
   parámetros y sus cuadros a la caché de `V3`. Va `SECURITY DEFINER` porque la caché lleva RLS con
   `FORCE` y el sellado ocurre en conexiones que no siempre tienen el contexto fijado.
3. **`LectorDeParametrosSellados`** conserva el nombre de antes y **no es un doble**: debajo está
   `LectorDeParametrosCacheados`, la clase que corre en ventanilla, con su resolución de vigencias.

**Dos defectos salieron de montar esto, y los dos enseñan algo.** El primero: sin filtro de
municipalidad en las consultas del escenario —que en producción lo pone RLS y aquí hay que
escribirlo— una prueba con dos municipalidades resolvía «el conjunto vigente» al de la vecina, el de
mayor id, y la valorización salía sin cuadro sobre un expediente cuya municipalidad sí lo tenía
sellado. El segundo: con el disparador y el fixture escribiendo los dos, la mayoría de las clases
—que sellan con SQL directo— pasaban, y las pocas que usan el fixture chocaban contra
`normativa_conjunto_pk`; el escritor tiene que ser **uno**.

---

## 12. Lo que se movió, archivo a archivo

| Qué | De | A |
|---|---|---|
| `backend/kamayuk-rentas-parametros/` (47 clases) | `rentas` | `kamayuk-normativa-reglas` (20) + `kamayuk-normativa-parametros` (27) |
| `docs/10-negocio/valores-normativos/` (60 archivos) | `rentas` | `normativa` |
| Los seis verificadores del corpus | `rentas` | `normativa` |
| `docs/10-negocio/marco-normativo.md` (NEG-02) | `rentas` | `normativa` |
| `docs/10-negocio/etiquetas-de-bloqueo.json` | `rentas` | `normativa` (§5) |
| `docs/00-gobierno/plan-de-desbloqueo-D-02.md` (GOB-03) | `rentas` | `normativa` |
| Seis pasos de `documentacion.yml` | `rentas` | `normativa` |
| `parametro_tributario`, `conjunto_parametros`, `conjunto_parametro_detalle`, `valor_unitario_edificacion`, `depreciacion`, `valor_referencial_vehiculo` | `rentas` (`V2` las retira) | `normativa` (`V1` baseline) |

**Lo que NO se movió, y por qué:** `arancel` es municipal —se carga por vía y se corrige por
municipalidad— así que se queda con `via`, o sea con `catastro` (✅ D-N4). Y los guiones de
publicación de `infra/carga-de-datos/` que el enunciado nombra **no estaban en `rentas`**: P5A no
copió `infra/` salvo sus CSV de ejemplo, así que siguen en `sgtm` y les toca a la etapa que mueva
la infraestructura.
