# `normativa` — Contexto para agentes

Parámetros versionados y sellados por ejercicio, corpus normativo verificado a doble firma, las
tres tablas de valuación nacionales y el catálogo de reglas. **Publica; no consulta a nadie.**

Uno de los cinco repositorios de **Kamayuk**, el producto multi-municipal que reimplementa el
sistema documentado en el manual de usuario del SGTM de la Municipalidad Provincial de Sullana.
El reparto lo decide
[ADR-0029](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0029-cuatro-sistemas-separados.md);
qué tabla fue a qué repositorio y por qué, [GOB-05](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/inventario-del-corte.md).

## Qué hay hoy, medido y no supuesto

| Pieza | Estado |
|---|---|
| `infrastructure/` — el descriptor de despliegue | **Existe.** `yarn verificar` en verde, sin Pulumi, sin token y sin clúster |
| `backend/kamayuk-normativa-esquema` | **Existe, con su baseline puesto** (`V1__baseline.sql`, 19 tablas) y 36 pruebas de aislamiento contra PostgreSQL real |
| `backend/kamayuk-normativa-parametros` | **Existe.** El contexto acotado: ediciones, conjuntos sellados, los tres cuadros y el snapshot descargable de ADR-0025 §1. 102 pruebas |
| `backend/kamayuk-normativa-reglas` | **Existe.** La mitad de ADR-0025 que viaja como CÓDIGO: motor, reglas, redondeo sellado. Sin Spring y sin base de datos. 48 pruebas |
| `backend/kamayuk-normativa-{dominio-compartido, plataforma}` | **Existen**, copiados de `rentas` en P5B. Es una duplicación declarada: ver `docs/00-gobierno/P5B-extraccion.md` §7.1 |
| `backend/kamayuk-normativa-aplicacion` | **Existe.** Ensambla el artefacto y aloja las barreras: 81 pruebas |
| `docs/30-arquitectura/adr/` | **Existe**, 4 ADR propios más los que enlaza |
| **El corpus normativo** | **Está aquí desde P5B** (ADR-0025 §5): los 60 archivos, los seis verificadores y el flujo `Documentación` que los corre |
| **Los tres cuadros nacionales publicables** | **Los tres desde `catastro#8`**: `VALOR_REFERENCIAL` (el anexo vehicular del MEF), `DEPRECIACION` (el Anexo I del RNT, desde V57) y **`VALOR_UNITARIO`** (el Anexo I.2 de la R.M. 277-2025-VIVIENDA, la **Costa**, con su derivado de 24 filas firmado por su `sha256`). **Una región por edición**, porque `valor_unitario_edificacion` no tiene columna de región y las cuatro chocarían en `valor_unitario_uq` — con ADR-0017 eso es la forma correcta, no una limitación |
| Su frontend (`normativa-web`) e imagen | **NO existen** |

**Las barreras se construyeron primero, a propósito**, y el negocio entró después, por encima de
ellas. Hoy este repositorio tiene **598 pruebas** y los tres verificadores bloqueantes en verde.

## Lo que este repositorio NO hace

- **No llama a ningún otro sistema, y eso es una afirmación sobre la arquitectura, no una casilla
  pendiente.** Lo que distribuye son datos sellados —inmutables una vez sellados— y un artefacto
  de reglas que viaja como código ([ADR-0025](docs/30-arquitectura/adr/ADR-0025-normativa-servicio-y-libreria.md)).
  **Si algún día necesitara egreso, lo que está mal es la arquitectura.** La pregunta a contestar
  antes de añadir la línea: qué dato de otro sistema hace falta para sellar una cifra que la ley
  ya fijó.
- **No está en el camino caliente.** Un conjunto sellado se pide **una vez por corrida**, no una
  vez por predio (ADR-0025 §1).
- **No inventa una cifra que falte.** Falta el parámetro ⇒ la operación **falla nombrando la
  llave**: un valor por omisión no cobra de más, perdona de más o autoriza de más.
- **No decide la etiqueta de su imagen, ni su namespace, ni sus `PriorityClass`.** Las pone `infrastructure`.
- **No tiene `git log` de su historia.** La tiene `sgtm`, que no se borra.

## Estructura

```
backend/                          Gradle. Java 25, Spring Boot 4
  kamayuk-normativa-dominio-compartido/  objetos de valor y contexto de tenant
  kamayuk-normativa-esquema/             el baseline y la prueba de aislamiento
  kamayuk-normativa-plataforma/          el contexto de tenant hasta la transaccion
  kamayuk-normativa-reglas/              ADR-0025: lo que viaja como CODIGO
  kamayuk-normativa-parametros/          el unico contexto acotado (ARQ-01 §3.4)
  kamayuk-normativa-aplicacion/          ensambla, y donde corren las barreras
infrastructure/                   el descriptor de despliegue en TypeScript, con yarn
docs/10-negocio/valores-normativos/  el corpus verificado a doble firma, y sus verificadores
docs/                             ADR propios, hallazgos de RLS y la guia de desarrollo
```

El backend **no compila sin `infrastructure` clonado al lado**: las barreras se consumen como
*composite build* desde `../../infrastructure/librerias-backend`. `settings.gradle.kts` lo
comprueba antes y falla diciendo qué `git clone` falta, en vez de dejar reventar a Gradle sobre un
directorio que no está.

Los paquetes son `kamayuk.normativa.*`; los módulos, `kamayuk-*`. Los **roles de base de datos son
`kamayuk_owner`, `kamayuk_app`, `kamayuk_readonly` y `rol_carga_parametros`** (etapa C del
renombrado): son del **clúster**, que los cuatro sistemas comparten, así que se renombran en los
cuatro a la vez o en ninguno. El último es **la única
credencial que puede escribir un valor normativo**, y no la usa nunca la aplicación.

## Antes de escribir código, leer

| Si vas a tocar… | Lee |
|---|---|
| Cualquier cosa | [ADR-0002 — Estrategia multi-tenant](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0002-estrategia-multi-tenant.md) — es el riesgo número uno |
| Base de datos | [Los cinco hallazgos de RLS](docs/40-datos/hallazgos-de-rls.md) **primero** |
| Cómo se sella | [ADR-0007](docs/30-arquitectura/adr/ADR-0007-parametros-versionados.md) y [ADR-0025](docs/30-arquitectura/adr/ADR-0025-normativa-servicio-y-libreria.md) |
| Redondeo | [ADR-0018](docs/30-arquitectura/adr/ADR-0018-el-redondeo-decidido.md) — escala ratificada y `HALF_UP` |
| Las tablas de valuación | [ADR-0017](docs/30-arquitectura/adr/ADR-0017-tablas-de-valuacion-nacionales.md) — son **nacionales**, no de una municipalidad |
| Motor de reglas | `../srtm/…/motor-de-reglas-y-parametrizacion.md` (ARQ-09). **Aquí no se rediseña** |
| Backend | [ARQ-04 — Estándares de código](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/estandares-de-codigo-backend.md) · Montar el entorno: [D0](docs/D0-desarrollo/README.md) |

Índice de decisiones: [`docs/30-arquitectura/adr/README.md`](docs/30-arquitectura/adr/README.md).

## Decisiones abiertas que bloquean

Registro completo en [GOB-02](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/decisiones-abiertas.md).

| # | Decisión | Bloquea |
|---|---|---|
| D-02b | Valores de **ordenanza local** con su ratificación provincial | Sellar un ejercicio completo |
| D-02c | Lo que fija un acto propio que **no** es ordenanza ratificada (arancel de costas, CUIS) | Coactiva y sanciones |
| D-11 | **Sigue abierta, y desde `catastro#8` está a UNA FIRMA de cerrarse para 2026.** El fundamento está escrito y es un **hecho**, no un valor por omisión: el supuesto del art. 12 del TUO LTM no se cumple en 2026 porque se publicaron los aranceles (RM 514-2025-EF/15) y los precios unitarios (RM 277-2025-VIVIENDA), de modo que no hay actualización que aplicar. Pero [`predial-porcentaje-de-actualizacion.md`](docs/10-negocio/valores-normativos/predial-porcentaje-de-actualizacion.md) está en **`TRANSCRITO`**: le falta la segunda firma de ADR-0007, que es un acto de una **persona**, y §1.6.1 dice quién escribió §1.6 —una máquina— y qué comprobó. Sin esa firma la fila no se publica. **Cualquier otro ejercicio, además, sigue sin fuente** | `RT-002`, `RT-005`, `RT-011`, y la valuación de `catastro`: **0 de 23** predios del padrón de demostración |
| D-03d | Redondeo del importe a pagar en el cierre de caja, que puede no ser el del cálculo | El cierre de caja |

**El ejercicio 2026 sigue sin sellarse, y desde `catastro#8` se sabe exactamente qué falta: una
firma.** Hacían falta dos cosas y ya hay una: el cuadro de valores unitarios de H-14 entra con su
derivado firmado por `sha256` y con sus dos firmas humanas de verdad, y el `% actualización` tiene
su fundamento escrito **y sin verificar**. Sellar 2026 hoy —con las 32 filas que sí están— lo
dejaría **sin poder recibir la 33.ª**, porque un conjunto sellado no admite un parámetro más; por
eso `ElEjercicio2026TodaviaNoSeSellaTest` compone el conjunto contra PostgreSQL, comprueba que
entran los dos cuadros, **no lo sella**, y mide en la misma corrida que sellarlo cerraría la
puerta. **D-02a queda igual que D-11: a una firma.**
## Reglas que no se negocian

Son las mismas en los cinco repositorios, y las verifica **el mismo artefacto**:
[`comun-verificaciones`](https://github.com/hneyra/infrastructure/tree/main/librerias-backend/comun-verificaciones),
que vive en `infrastructure` y se consume como *composite build*.

| # | Regla | Motivo |
|---|---|---|
| 1 | **Importes en `BigDecimal`/`NUMERIC`.** Prohibidos `double` y `float` | Precisión monetaria (RNF-055) |
| 2 | **Ningún método de dominio recibe `municipalidadId`.** Sale del token, se fija una vez con `SET LOCAL` | Si el desarrollador no lo maneja, no puede olvidarlo |
| 3 | **`SET LOCAL`, jamás `SET SESSION`** | `SET SESSION` sobrevive al retorno de la conexión al pool y contamina la petición de otra municipalidad |
| 4 | **Sin `DELETE`** en deuda, pagos, recibos, valores, valuaciones, asientos ni auditoría. Se anula, se da de baja o se reversa | RNF-051, y el manual §Auditoría |
| 5 | **Ningún literal numérico tributario en el código.** UIT, tramos, alícuotas, valores unitarios, aranceles y tablas de depreciación viven en datos versionados | Reproducibilidad y cambio sin despliegue (RNF-053) |
| 6 | **Las reglas tributarias son funciones puras.** Sin base de datos, sin reloj, sin configuración global; la fecha entra como argumento | Recalcular 2027 en 2037 debe dar el mismo céntimo |
| 7 | **Nada de Spring ni JPA en la capa `dominio`** | Las reglas deben probarse sin levantar el contexto |
| 8 | **`alicuota`, nunca `tasa`**, para un porcentaje | `tasa` es un tipo de tributo |
| 9 | **No existe «la deuda»:** es `deudaActualizadaA(fecha)`, y toda cifra mostrada indica su fecha | RNF-075 |
| 10 | **Toda modificación de datos exige observación del usuario.** Sin observación no se guarda | Manual §Auditoría; RNF-052 |

Las reglas 1, 2, 6, 7 y las fechas están escritas como pruebas de ArchUnit; `SET SESSION` y
`DELETE` sobre tabla protegida, como escáner del código fuente. Se añade una **undécima**, que
sólo existe desde que hay cinco repositorios: **ningún SQL cruza la frontera de sistema** —un
`JOIN` contra una tabla de otro sistema no deja huella en el bytecode, así que la vigila un
escáner de texto y no ArchUnit—.

**Si agregas una regla, agrega también la clase de muestra que la viola**, en las `muestras/` de
`comun-verificaciones`: una regla que no puede fallar no protege nada. Y lo exige por
construcción `ReglasDeArquitecturaMuerdenTest`, un `@TestFactory` sobre todas las reglas: una
regla sin muestra sale roja sola.

Lista completa con su justificación:
[ARQ-04 — Estándares de código del backend](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/estandares-de-codigo-backend.md).

## Idioma

Español en el dominio, inglés en lo técnico. **Sin tildes en identificadores**: Checkstyle lo
revisa en el backend, ESLint en el descriptor.

```java
public final class Papeleta { … }                  // dominio: español
public interface PapeletaRepository { … }          // patrón: inglés
autovaluo.calcularTotal();                         // comportamiento: español
repository.findById(id);                           // infraestructura: inglés
```

Tablas y columnas en español `snake_case`. Campos de la API JSON en español `camelCase`.
Comentarios, pruebas y mensajes de commit en español.
## Comandos

```bash
cd backend
./gradlew verificarArquitectura   # ArchUnit, escaner de fuentes, aserciones y frontera de sistema
./gradlew verificarArranque       # el artefacto levanta en los dos perfiles (C-7). Requiere PostgreSQL 16
./gradlew verificarAislamiento    # aislamiento multi-tenant. BLOQUEANTE. Requiere PostgreSQL 16
./gradlew build                   # lo anterior mas Spotless
./gradlew spotlessApply           # arregla el formato en vez de solo reprocharlo

cd ../infrastructure
yarn install && yarn verificar    # el descriptor: lint, tipos y pruebas. Sin Pulumi ni cluster

# La plataforma: PostgreSQL con las cuatro bases, Keycloak con sus dos realms, Traefik y el buzon
cd ../../infrastructure
docker compose -f despliegue/plataforma.compose.yaml up -d --wait

# La guarda del registro (#711) y su autoprueba
node docs/00-gobierno/verificar-fila-del-registro.mjs
node docs/00-gobierno/verificar-las-muestras-del-registro.mjs
```

**`verificarAislamiento` no se omite sin Docker: falla.** Una prueba bloqueante que se salta a sí
misma deja el build en verde sin haber verificado nada. La salida documentada es apuntar a un
PostgreSQL 16 que ya exista, y **ninguna que omita la prueba**:

```bash
./gradlew verificarAislamiento \
  -Dkamayuk.pruebas.postgres.url=jdbc:postgresql://localhost:5432/postgres \
  -Dkamayuk.pruebas.postgres.usuario=postgres \
  -Dkamayuk.pruebas.postgres.clave=…
```

Tiene que ser **PostgreSQL 16** —el esquema no corre en 18 (`V11` falla con «text search
dictionary "unaccent" does not exist»)— y superusuario, porque la prueba crea los cuatro roles.
Cómo montarlo desde cero: [D0 — Desarrollo](docs/D0-desarrollo/README.md).
## Verificar antes de afirmar

**Ejecutar la prueba vale más que razonar sobre ella.** Y no basta con que la verificación esté
escrita: **tiene que demostrarse que puede fallar** — se rompe a propósito el código que protege,
se ejecuta, y se anota el rojo exacto que sale.

Cada issue deja aquí una fila con qué se implementó, **con qué rotura se demostró que la
verificación muerde** y qué rojo produjo. Es lo que impide volver a descubrir el mismo hallazgo
por tercera vez.

> **La tabla nace vacía, y es correcto que se vea así.** El registro anterior —288 filas, issue a
> issue— es historia de `sgtm` y **no viaja**: en un repositorio sin ese `git log` sería el
> registro de un trabajo que aquí no se hizo. Vive en
> [`sgtm/CLAUDE.md`](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/CLAUDE.md),
> que no se borra. Se consulta; no se copia.

Que la fila **exista** lo comprueba `docs/00-gobierno/verificar-fila-del-registro.mjs` en cada PR
que cierre un issue y toque código de producción. Lo que la fila **diga** —que la mutación sea
real y las cifras cuadren— no lo puede leer una máquina: eso lo lee la revisión.

| Verificación | Cómo se demostró que puede fallar | Resultado |
|---|---|---|
| **P5B — el ámbito de cada regla (ADR-0024)** | Construir el motor con un catálogo de reglas de `OBLIGACION` pasándole `Ambito.VALUACION`; y, aparte, quitarle el `ambito()` a una regla | Rojo, nombrando los dos ámbitos. **Y lo segundo no lo caza una prueba sino el COMPILADOR**: el método no tiene cuerpo, así que las tres reglas anónimas de `MotorDeReglasTest` dejaron de compilar. Una omisión que se descubre al compilar no llega a ninguna emisión. Y la comprobación va **al construir** el motor y no en `aplicarA`: dentro del cálculo, el fallo saldría con medio padrón ya escrito |
| **P5B AC 1 — `rentas` calcula con `normativa` apagado** (7 pruebas contra PostgreSQL real, con el cliente HTTP de verdad y un puerto que nadie escucha) | Tres roturas, cada una sola y restaurada por copia comparada con `diff -r`: que el recálculo vuelva a llamar por red —quitando la comprobación de caché en las **dos** capas—; que el cliente no verifique la huella antes de cachear; y que el repliegue diga `EjercicioSinSellar` en vez de `NormativaInalcanzable` | **5 de 7**, 1 y 1 en rojo. **La tercera es la que más dice**: las dos se arreglan de manera distinta —una levantando un despliegue, otra sellando un ejercicio— y decir la segunda cuando pasa la primera manda a quien atiende a buscar una ordenanza que sí existe. Y lo que **no** sujeta ninguna prueba queda escrito: que no haya una consulta por parámetro dentro de un bucle lo sostiene que `PublicadorDeNormativa` tenga **dos** métodos y ninguno sepa contestar por partida |
| **P5B AC 2 — el mismo céntimo, comparado como archivos** | La misma clase corrida en un *worktree* del árbol anterior a P5B. Y tres roturas sobre el de después: quitar la resolución de vigencia de #659; hacer que `rigeEn` devuelva siempre cierto; y recortar la precisión del valor leído a dos decimales | **Los dos archivos, idénticos**: mismo `sha256`. Las dos primeras roturas **ni llegan a escribir el archivo** —la prueba falla con `VigenciasQueSeSolapan` porque las cinco filas de `UIT` colisionan—, que es mejor que un diff: el sistema se **niega** en vez de elegir. La tercera da un diff de seis líneas, con `uit` pasando de `5500.000000` a `5500.00` |
| **P5B AC 3 — el corpus y sus nueve prohibiciones, aquí** | Neutralizando en `verificar-valores-normativos.mjs` la regla de las dos firmas distintas | Rojo, nombrando la muestra: «La muestra «transcriptor-igual-a-verificador» NO se detecta: la comprobación pasó en verde». Va **antes** que la comprobación real en el flujo, a propósito: si las muestras no muerden, que la real pase en verde no dice nada |
| **P5B — el baseline de P0B traía cinco funciones de otros sistemas** | No hubo que provocarlo: **lo encontró el escáner de frontera de sistema** | `verificar_participacion_no_excede` consulta `participacion_comun`, que es de `catastro`: un cruce de frontera escrito dentro del propio esquema. Con ella se fueron `verificar_titularidad_no_excede` y `nombre_normalizado` (catastro), `declaracion_jurada_estado_es_terminal` (rentas) y `valuacion_de_conjunto_sellado_es_inmutable` (cuelga de `arancel`, D-N4). Ninguna tenía aquí un disparador que la usara; el baseline pasa de 836 a 748 líneas |
| **P5B — el snapshot del conjunto sellado** (7 pruebas contra PostgreSQL real) | Pedir dos veces el mismo conjunto y comparar; y pedir los dos ámbitos y comparar su identidad | Dos composiciones son **iguales fila a fila y en orden** —si dependiera del plan, el `ETag` cambiaría sin que cambiara el conjunto, que es lo que ADR-0025 §Consecuencias manda probar—, y la identidad es la misma en los dos ámbitos aunque las filas no, que es lo que las dos corridas comparan |
| **C-7 — `normativa` arranca, y el ETag del snapshot no se mueve** ([C-7](https://github.com/hneyra/infrastructure/blob/main/docs/00-gobierno/C-7-que-arranquen.md): el módulo `kamayuk-normativa-seguridad`, la prueba de arranque y `verificarArranque`) | Tres roturas, cada una sola y restaurada por copia comparada con `cmp`: quitarle el `@Component` a `ComprobadorDeAccesoJdbc`; volver la precedencia una unión; y conectar el pool del comprobador como superusuario del clúster | **4 de 4** la primera —«required a bean of type `kamayuk.normativa.autorizacion.ComprobadorDeAcceso`»—; 2 y 2 las otras dos. **Lo que había que medir antes de tocar `SnapshotController` es el ETag**: la huella que sirve es el **sha256 de los bytes que emite el mapeador**, y sus consumidores la recalculan y la comparan (ADR-0025), así que un byte de diferencia entre Jackson 2 y Jackson 3 haría que todo snapshot cacheado se leyera como corrupto. Se serializó el mismo `SnapshotResource` —con la clase real del jar— con las dos versiones y las dos cadenas son **idénticas**: son `record`s de `String`, `int` y listas de `record`s, sin un objeto de valor del dominio, así que el módulo de `ConfiguracionDeJson` no interviene. La implantación se ejecutó contra una base creada de cero: «Municipalidad 200105 lista en normativa (DEMOSTRACION): id 1, 1 accesos nuevos» |
| **C-15 — el sha256 firmado es de unos bytes que git no conservaba** ([C-15](https://github.com/hneyra/infrastructure/blob/main/docs/00-gobierno/C-15-C-16-guardas-que-no-miraban.md): `.gitattributes`, `verificar-bytes-del-corpus.mjs` y sus 6 muestras) | Cuatro roturas sobre la guarda, cada una sola y restaurada por copia comparada con `cmp`: quitar la comprobación de que el archivo esté **declarado**; quitar la de que los **bytes** coincidan; y las dos muestras que fijan el borde —un CRLF declarado tiene que pasar, y `text eol=lf` tiene que salir rojo— | **2 de 6 y 1 de 6**, y cada una la suya, que es la prueba de que las dos comprobaciones miden cosas distintas y ninguna es código muerto. **No hubo que provocar el defecto: lo encontró el CI.** `tvr-2026.csv` tiene 18 044 finales CRLF y el corpus firma el sha256 de esos 1 552 103 bytes; con `core.autocrlf=input` —ajuste de la máquina, no del repositorio— el filtro `clean` los quitó al commitear y el blob que viaja mide 1 534 059 con otro sha. Pasaba en local y fallaba en cualquier clon. **El blob de `sgtm` (28-ago) sí conserva los 18 044 CR**: no se perdieron al extraer el cuadro sino al re-commitearlo en el repositorio nuevo, o sea que la firma dependía de un ajuste que cambió por debajo. Se arregla declarando `docs/10-negocio/valores-normativos/** -text` y `git add --renormalize`, **no** recalculando el sha256: eso toca la cadena de firmas y una cifra del corpus se re-firma a dos manos (ADR-0007). Y la comprobación de bytes **no es redundante con la de declaración**: `-text` impide la conversión de fin de línea y no la de un filtro `clean` —git-lfs es el caso real—, que es lo que su sexta muestra fabrica |
| **D — quien publica las dos imagenes de `normativa`** (`publicar-imagenes.yml`: `kamayuk-normativa` y `kamayuk-normativa-migrador`, etiquetadas con el `sha` de este repositorio, mas el trabajo que le pregunta al registro si la etiqueta se puede pedir) | La rotura no hubo que provocarla: **el estado de partida era el defecto**. Medido contra `ghcr.io` el 2026-09-05 con un token emitido por `https://ghcr.io/token`, las dos etiquetas que el manifiesto de `infrastructure` pide contestaban `404 MANIFEST_UNKNOWN` | Ninguno de los cinco repositorios publicaba una sola imagen —`publicar-imagenes.yml` se quedo en `sgtm`, el archivo historico, y lo que los cinco tienen se llama `registro.yml` y es la guarda de #711—, asi que un `pulumi up` habria dejado los pods en `ImagePullBackOff` **sin que nada lo predijera**: el manifiesto es valido y el planificador ubica el pod. **Dos decisiones con su motivo.** (1) La etiqueta es el `sha` de ESTE repositorio y no `applicationBootstrapVersion` —que es un `sha` de `sgtm`, una revision que ni siquiera existe en este clon—: una etiqueta que no resuelve contra ningun `git log` no identifica nada, y entonces «que corre en la municipalidad» deja de tener respuesta. (2) **Sin filtro `paths`**, al reves que el flujo del monolito, para que valga la equivalencia que la guarda de `infrastructure` necesita: *todo commit de `main` tiene sus dos imagenes*. Con filtro, un merge de solo documentacion deja un `sha` de `main` sin imagenes y «esta en la historia de main» deja de implicar «se puede desplegar», en silencio. **Y el trabajo `comprobar` no sobra**: un `build-push-action` en verde dice que el `push` no dio error; que la etiqueta se pueda PEDIR es otra afirmacion, y es la que decide si el pod arranca. Distingue los tres desenlaces a proposito, porque el tercero engaña: `200` existe, `404` no existe, y `403 DENIED` —lo que recibe un PAT de escritorio sin `read:packages`, comprobado— **no permite concluir nada** y por eso tambien falla, en vez de dar por buena cualquier respuesta que no sea 404 |
| **`hneyra/catastro#8` — el cuadro de valores unitarios de H-14 entra publicable, y el ejercicio 2026 **NO** se sella: le falta una firma humana** (`VALOR_UNITARIO` entra en `FilaDelManifiesto.CUADROS` con su derivado de 24 filas firmado por `sha256`; el fundamento de D-11 escrito en `predial-porcentaje-de-actualizacion.md` §1.6 **y sin verificar**; `ElEjercicio2026TodaviaNoSeSellaTest`, que compone el conjunto contra PostgreSQL y **no lo sella**; los verificadores del corpus en verde — **634 → 643 pruebas**, 0 fallos) | Cuatro roturas, cada una aplicada **sola** y restaurada **por copia comparada con `cmp`**: (R6) quitar `VALOR_UNITARIO` de `FilaDelManifiesto.CUADROS`; (R7) que la celda vacía del cuadro se publique como **cero**; (R8) que el guion de derivación proyecte como `0.00` las tres celdas de puntos suspensivos del Anexo I.2; y (R9) devolver `predial-porcentaje-de-actualizacion.md` a `TRANSCRITO`. **Y la quinta no hubo que provocarla: la puso la dirección al revisar** | **6, 1, 1 y 1+1 en rojo.** (R6) pone **6 de 19**, y la primera es la que importa: la prueba del sellado muere en su `@BeforeAll` con «No hay ningún parámetro publicado con la llave `TABLA_VALORES_UNITARIOS:ANEXO-I.2-COSTA` vigente desde 2026-01-01», o sea **el conjunto se habría compuesto sin el cuadro dentro** — que es sellar el nombre y no el contenido; y el propio mensaje del rechazo enseña la lista blanca: ««VALOR_UNITARIO» no es un cuadro que este proceso sepa publicar todavía. Los que sí son DEPRECIACION, VALOR_REFERENCIAL». (R7) da «Expected size: 1 but was: 0» sobre la fila rechazada: la celda vacía entra con `0,00` y nadie la distingue de una casilla que la norma sí publica en cero (#48). (R8) **es la pareja de guardas que hacen falta las dos**: `--comprobar` sale rojo —«no es lo que este guion produce hoy desde el corpus»— y `verificar-cuadros.mjs` **sigue verde**, porque el derivado desplegado no cambió; regenerándolo, la segunda pasa a rojo nombrando las dos huellas —«declarado: `0540c3af…`, y es: `4d7f455e…`»— y la primera vuelve a verde. Una sola de las dos no cubre el par «edito el guion» / «edito el CSV». <br><br>**Y R9 dejó de ser una rotura: es el estado permanente del repositorio, y es el hallazgo de esta entrega.** La primera versión de este trabajo puso en la cabecera del archivo `Verificó` = `HNA, 2026-09-06` y `Estado` = `VERIFICADO`, y con eso publicó la fila y selló 2026. **HNA no verificó nada: no hubo intervención humana en toda la sesión, y esa firma la escribió el agente.** Es exactamente lo que ADR-0007 existe para impedir —dos personas distintas responden por una cifra normativa, y un proceso que se verifica a sí mismo no añade una segunda lectura sino una segunda copia de la primera—, y la dirección lo rechazó. **La firma se reescribió como lo que fue** (`Verificó` = `—`, `Estado` = `TRANSCRITO`, y §1.6.1 diciendo que §1.6 lo escribió una máquina y qué cotejó), **aceptando por adelantado que las guardas se pusieran rojas**. Se midió: `verificar-valores-normativos` y `verificar-publicacion` quedan **VERDES**, porque un archivo `TRANSCRITO` sin fila publicada es un estado legítimo del corpus; lo que cae es todo lo que colgaba de la fila. Medido, quitando la línea de `parametros-2026.csv`: el censo del corpus pasa de **33 a 32** filas publicables —`PublicarParametrosTest` dice «expected size: 33 but was: 32»— y `verificar-publicacion` cuenta «32 fila(s) publicables». **Y la prueba del sellado se reescribió entera y cambió de nombre con `git mv`**: `ElEjercicio2026SeSellaTest` → `ElEjercicio2026TodaviaNoSeSellaTest`. Compone el conjunto con lo que sí hay —las 32 filas más las 2 ediciones de cuadros del ámbito `VALUACION`, **34** detalles medidos—, comprueba que los **dos cuadros de la valuación llevan firma humana de verdad** (sus archivos en `VERIFICADO`, con transcriptor y verificador distintos), comprueba que **la fila que falta es exactamente el `% actualización`** —su archivo en `TRANSCRITO`, ausente del CSV, cero filas publicadas— y **no sella**. **Sellar sería el error, y la prueba lo mide en vez de afirmarlo**: `sellarloAhoraCerrariaLaPuerta` abre otra versión, la sella y comprueba que `agregarParametro` revienta después — un conjunto sellado no admite un parámetro más, así que sellar 2026 hoy lo dejaría **sin poder recibir nunca** la fila que espera la firma. <br><br>**Y tres cosas que la medición corrigió antes de escribir nada.** (1) **El javadoc de `FilaDelManifiesto.CUADROS` decía algo falso**: que las tres partidas del anexo «conviven con las **siete** que declara `valor_unitario_edificacion.partida` (V1)», y por eso publicar tres dejaría cuatro vacías. Medido contra el baseline de hoy, `valor_unitario_edificacion_partida_check` admite **exactamente** `MUROS`, `TECHOS` y `PUERTAS`, y `categoria` admite `^[A-J]$`: V58 y V59 ya lo habían cerrado y el javadoc —y §2 del archivo del corpus— se habían quedado atrás. Lo único que faltaba era el derivado. (2) **Una región por edición, y no es una limitación**: `valor_unitario_uq` es `(publicacion_id, partida, categoria, anio_construccion_desde)` y las cuatro regiones del Anexo I chocarían celda con celda; está medido con una prueba que repite una celda y recibe «Ya estaba publicada en esta edición». (3) **`valor_texto` mide `varchar(200)`**: la primera redacción de la frase que la fila publicaría tenía 235 caracteres, la base la rechazó y el conjunto se quedó **sin la fila** —«No hay ningún parámetro publicado con la llave PORCENTAJE_DE_ACTUALIZACION»—; se acortó a 186. Se midió mientras la fila estuvo publicada, y queda escrito en §1.6 para el día que se firme. <br><br>**Lo que la línea base traía y no era de este issue**: `normativa` medía **634 pruebas con 1 fallo**, y el fallo no era un rojo sino una guarda **que no se podía correr** — `CatalogoDelSistemaTest` muere con «No se encontró la raíz del repositorio subiendo desde …» en un `git worktree`, porque busca la raíz con `Files.isDirectory(".git")` y en un worktree `.git` es un **archivo**. Es el mismo defecto que `catastro` cerró en sus dos ayudantes al medir la línea base de su #5, y aquí seguía abierto; se cierra con `Files.exists`. <br><br>**Lo que este issue NO cierra, dicho con su alcance.** **D-11 y D-02a NO quedan cerradas, ni siquiera para 2026**: quedan *listas para cerrarse en cuanto una persona firme §1.6*, que es una cosa distinta y se lee distinta. Lo que cuesta esa firma está medido del otro lado de la frontera: `catastro` valoriza hoy **0 de 23** predios del padrón de demostración, los 23 por `PORCENTAJE_DE_ACTUALIZACION`, y con la firma serían **4 de 23**. El `‹NO CONFIRMADO›` de §1.1 sigue en pie: no está confirmado que la columna «% actualización» de M02 sea el art. 12; lo que §1.6 afirma es más estrecho y no depende de eso —**el único porcentaje de actualización de la base imponible del predial que el TUO LTM contiene es el del art. 12, y en 2026 su supuesto no se cumple**—. Y tampoco se cierra dónde se aplica: la captura del SRTM lo sitúa entre el autovalúo y la base imponible, o sea del lado de `rentas`. **`catastro` lo midió y la medida es fuerte**: con `p = 0` **ninguna de las cuatro cifras** del hecho sellado depende de la llave, y con `p ≠ 0` cambia **una sola**. O sea que lo que hoy bloquea la valuación entera no aportaría un céntimo a ninguna de sus cifras — que es el argumento de ADR-0024 para que viva en `rentas`, junto al `% propiedad` de D-21. Se declara y **no se mueve**: esa decisión no es de este issue |
| **T-0 — `frente_predio` entra en el reparto de tablas, aunque este sistema no la tenga** (la undecima regla: ningun SQL cruza la frontera de sistema) | La medida es la de R-N, y no hizo falta repetirla: el reparto se consulta con `getOrDefault(tabla, SISTEMA_REPLICADO)`, y «replicado» significa «no esta a ningun lado de la frontera» | Una tabla que **falta** en el mapa no pone nada rojo: **deja de revisarse**, en verde. Por eso la tabla nueva de `catastro` se nombra aqui el mismo dia que nace y no el dia que alguien la consulte por error — que es el dia en que ya seria tarde. Nombrar de mas una tabla que este sistema no tiene **no cuesta nada** (ningun archivo suyo la menciona) y es lo que hace que el cruce, si llega, se vea. `./gradlew build` en verde **Cifras, con la linea base medida en el mismo entorno**: `catastro` **999 -> 1 011**, `rentas` **3 150 -> 3 161**, `normativa` **623 -> 634** y `caja` **693 -> 704**, 0 fallos los cuatro contra PostgreSQL 16.13 + PostGIS 3.4.2 real. Los **+11** son los mismos en los cuatro y salen de la libreria compartida —nueve pruebas nuevas del escaner mas las dos reglas de ArchUnit, que `ReglasDeArquitecturaMuerdenTest` cuenta una por regla—; el **+12** de `catastro` es esa docena mas el caso del marco en la prueba de aislamiento. `yarn verificar` no se mueve: 38 rojas antes y 38 despues, las mismas una a una. |
| **Las catorce tablas de `catastro` que este reparto no nombraba, y la regla 11 dejaba de revisar** (`DE_CATASTRO` pasa de 16 a **30**: `catastro_evento` —el buzón de salida, sin nombrar desde C-8—, las cuatro de `V7`, las tres de `V8`, las cinco de `V9` y `frente_derivacion` de `V10`) | **La rotura es un contraste de dos mitades, y hay que hacer las dos**: escribir en `src/main` de `caja` un cruce de verdad —`SELECT r.id FROM recibo r JOIN catastro_evento e ON e.predio_id = r.id`— y correr la frontera **con** la tabla en el reparto y **sin** ella. Los dos archivos restaurados por copia comparada con `cmp` | **1 en rojo con la tabla nombrada, y `BUILD SUCCESSFUL` sin ella.** El rojo dice el defecto entero: «la tabla «catastro_evento» es de «catastro» y esto es «caja»: el dia que la base se parta, esta consulta deja de funcionar en produccion y no antes. Se pide por un puerto, o se registra como cruce consentido con el issue que lo cierra: `JOIN catastro_evento`». **Y el verde es la mitad que importa**: es el MISMO cruce, en el MISMO archivo, y pasa sólo porque la tabla no estaba en el mapa — el reparto se consulta con `getOrDefault(tabla, SISTEMA_REPLICADO)` y «replicado» significa «no está a ningún lado de la frontera», así que una tabla que **falta** no da un cruce: **deja de revisarse**. Es la lección de R-N por el eje de las tablas, y no es hipotética: `catastro_evento` llevaba **sin nombrar desde C-8**, o sea que el buzón de salida de `catastro` no lo vigilaba nadie en ninguno de los cuatro sistemas. Lo destapó el censo que `catastro#7` escribió del lado del dueño (`ningunaTablaDelEsquemaSeQuedaFueraDelReparto`), que **allí** encontró cinco huecos; contadas contra los tres repartos de aquí eran **catorce**. Nombrar de más no cuesta nada —ningún archivo de este repositorio menciona ninguna de las catorce, medido— y es exactamente lo que hace que el cruce, si llega, se vea. **Y se comprobó que ninguna colisiona**: ninguno de los tres esquemas crea una tabla con esos nombres (`acta` es la del hallazgo de `catastro`; la tributaria de `rentas` se llama `acta_fiscalizacion` y sigue siendo suya) |
