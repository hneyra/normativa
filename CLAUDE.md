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
| D-11 | El **`% actualización`**: sigue sin fuente. Su valor neutro es **cero**, no uno | `RT-002`, `RT-005`, `RT-011` |
| D-03d | Redondeo del importe a pagar en el cierre de caja, que puede no ser el del cálculo | El cierre de caja |

**Hoy ningún ejercicio está sellado**, y no es un descuido: sellar 2026 sin los valores unitarios
ni el `% actualización` lo dejaría con la mitad de sus cifras y **sin poder recibir la otra
mitad**, porque un conjunto sellado no admite un parámetro más.
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
| **T-0 — `frente_predio` entra en el reparto de tablas, aunque este sistema no la tenga** (la undecima regla: ningun SQL cruza la frontera de sistema) | La medida es la de R-N, y no hizo falta repetirla: el reparto se consulta con `getOrDefault(tabla, SISTEMA_REPLICADO)`, y «replicado» significa «no esta a ningun lado de la frontera» | Una tabla que **falta** en el mapa no pone nada rojo: **deja de revisarse**, en verde. Por eso la tabla nueva de `catastro` se nombra aqui el mismo dia que nace y no el dia que alguien la consulte por error — que es el dia en que ya seria tarde. Nombrar de mas una tabla que este sistema no tiene **no cuesta nada** (ningun archivo suyo la menciona) y es lo que hace que el cruce, si llega, se vea. `./gradlew build` en verde **Cifras, con la linea base medida en el mismo entorno**: `catastro` **999 -> 1 011**, `rentas` **3 150 -> 3 161**, `normativa` **623 -> 634** y `caja` **693 -> 704**, 0 fallos los cuatro contra PostgreSQL 16.13 + PostGIS 3.4.2 real. Los **+11** son los mismos en los cuatro y salen de la libreria compartida —nueve pruebas nuevas del escaner mas las dos reglas de ArchUnit, que `ReglasDeArquitecturaMuerdenTest` cuenta una por regla—; el **+12** de `catastro` es esa docena mas el caso del marco en la prueba de aislamiento. `yarn verificar` no se mueve: 38 rojas antes y 38 despues, las mismas una a una. |
