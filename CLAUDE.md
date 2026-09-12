# `normativa` — Contexto para agentes

Parámetros versionados y sellados por ejercicio, corpus normativo verificado a doble firma, las
tres tablas de valuación nacionales y el catálogo de reglas. **Publica; para sellar no consulta a
nadie.** Lo único que lee de otro sistema es la replica de la autorización, del buzón de
`identidad` (ADR-0039, etapa 4).

Uno de los cinco repositorios de **Kamayuk**, el producto multi-municipal que reimplementa el
sistema documentado en el manual de usuario del SGTM de la Municipalidad Provincial de Sullana.
El reparto lo decide
[ADR-0029](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0029-cuatro-sistemas-separados.md);
qué tabla fue a qué repositorio y por qué, [GOB-05](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/inventario-del-corte.md).

## Qué hay hoy, medido y no supuesto

| Pieza | Estado |
|---|---|
| `infrastructure/` — el descriptor de despliegue | **Existe.** `yarn verificar` en verde —**17 pruebas**—, sin Pulumi, sin token y sin clúster. Desde la etapa 4 de ADR-0039 declara **un `CronJob`** —el consumidor del buzón de `identidad`, cada cinco minutos, sin `suspend`— y **una arista de egreso hacia un sistema**, la única: `identidad-sistema` en `kamayuk-identidad-<ambiente>`, que no es Keycloak |
| `backend/kamayuk-normativa-esquema` | **Existe, con su baseline puesto** (`V1__baseline.sql`, 19 tablas) **y `V2__consumidor_de_identidad.sql`** (etapa 4 de ADR-0039): `identidad_evento_aplicado` e `identidad_evento_muerto`, las dos con RLS `ENABLE`+`FORCE` y sin `DELETE`, y sembradas en `DatosDePrueba` para que la prueba de aislamiento las vea. 43 pruebas del esquema contra PostgreSQL real |
| `backend/kamayuk-normativa-seguridad` | **Existe, y desde la etapa 4 de ADR-0039 CONSUME el buzón de `identidad`** ([`identidad`#4](https://github.com/hneyra/identidad/issues/4)): el cliente HTTP con su token de servicio, el aplicador de los **siete tipos** sobre `usuario`/`grupo`/`miembro`/`permiso` —una transacción por hecho, acuse DESPUÉS del `COMMIT`—, la vuelta que aparta lo que no se puede aplicar nunca y **pospone sin cortarse** lo que todavía no —aplica lo que se puede aplicar y retiene sólo lo que escribe la misma fila que algo pospuesto, para no decir nada falso—, el aviso al responsable cuando un pospuesto pasa de **15 minutos**, el `ApplicationRunner` del `CronJob` y la pasada final de la implantación. Lo que ya estaba —el guardia— sigue. **Y desde la etapa 5 ([`identidad`#5](https://github.com/hneyra/identidad/issues/5)) el sembrador ya no escribe la autorización**: `SembradorDeLaCopiaLocal` es hoy `SembradorDelCatalogo` y se queda sólo con `modulo_sistema` y `acceso`; el grupo de administración, el primer administrador, su afiliación y sus permisos llegan por el buzón. La consecuencia es que `ImplantarMunicipalidad` **falla** —no avisa— cuando no puede traerlos, porque una municipalidad implantada sin una sola cuenta no la puede usar nadie |
| `backend/kamayuk-normativa-parametros` | **Existe.** El contexto acotado: ediciones, conjuntos sellados, los tres cuadros y el snapshot descargable de ADR-0025 §1. 102 pruebas |
| `backend/kamayuk-normativa-reglas` | **Existe.** La mitad de ADR-0025 que viaja como CÓDIGO: motor, reglas, redondeo sellado. Sin Spring y sin base de datos. 48 pruebas |
| `backend/kamayuk-normativa-{dominio-compartido, plataforma}` | **Existen**, copiados de `rentas` en P5B. Es una duplicación declarada: ver `docs/00-gobierno/P5B-extraccion.md` §7.1 |
| `backend/kamayuk-normativa-aplicacion` | **Existe.** Ensambla el artefacto y aloja las barreras, y desde la etapa 4 publica en `docs/50-api/contratos-que-consume/identidad.json` lo que este sistema pide y lee del buzón de `identidad`, que `identidad` comprueba en SU CI (ADR-0030 §4) |
| `docs/30-arquitectura/adr/` | **Existe**, 4 ADR propios más los que enlaza |
| **El corpus normativo** | **Está aquí desde P5B** (ADR-0025 §5): los 60 archivos, los seis verificadores y el flujo `Documentación` que los corre |
| **El ejercicio 2026** | **SELLADO desde el 2026-09-06, y hay que decir DE QUÉ** (#7). Lo que se sella son **33 filas** del derivado del corpus y los **dos cuadros** de la valuación —35 detalles compuestos—, o sea **lo de norma nacional, que es lo único que este repositorio publica**. Lo que faltaba no era una cifra sino la segunda firma de ADR-0007 sobre el `% actualización` — y su intervalo tuvo precio medido: mientras duró, `catastro` valorizó **0 de 23** predios; con la firma, **4 de 23**, y los otros 19 esperan a **RT-004**. **Y lo que ese sello NO comprobó**: el punto **3** de su propia lista «Antes de sellar» —el arancel de la municipalidad, que carga `cargar-arancel-vial.sh` **entre abrir y sellar**—. No se ha cargado nunca contra el `stg` partido y **hoy sigue sin poderse correr**, aunque [`infrastructure#11`](https://github.com/hneyra/infrastructure/issues/11) se cerrara el 2026-09-07: su guion está declarado pendiente en `GUIONES_PENDIENTES` (`hneyra/infrastructure#10`) y la credencial de `rol_carga_parametros` no alcanza al namespace del Job —su AC-2, que el propio cierre declara no cumplido—. Y **este sistema no lo puede comprobar**: `arancel` es tabla de `catastro` y la undécima regla prohíbe consultarla desde aquí. Sin ese paso, la corrida de `catastro` no da 4 de 23 sino **0 de 23, los 23 por `ARANCEL:2026`** — el «4 de 23» se mide **suponiendo el arancel publicado**, y su propio censo lo escribe como premisa. Se sella igual, con la decisión escrita en `publicacion/README.md` §«El punto 3»; el `--sellar` de verdad lo decide **quien ve los dos lados** |
| **Los tres cuadros nacionales publicables** | **Los tres desde `catastro#8`**: `VALOR_REFERENCIAL` (el anexo vehicular del MEF), `DEPRECIACION` (el Anexo I del RNT, desde V57) y **`VALOR_UNITARIO`** (el Anexo I.2 de la R.M. 277-2025-VIVIENDA, la **Costa**, con su derivado de 24 filas firmado por su `sha256`). **Una región por edición**, porque `valor_unitario_edificacion` no tiene columna de región y las cuatro chocarían en `valor_unitario_uq` — con ADR-0017 eso es la forma correcta, no una limitación |
| Su frontend (`normativa-web`) | **Existe el andamiaje, y ninguna pantalla** (F-1, #10). Vite 7 + React 19 + TypeScript 5.9 en `frontend/`, con el código en `frontend/src/` —y no en un monorepo, porque `verificar-fila-del-registro.mjs` declara `/^frontend\/src\//` como código de producción—. `yarn verificar` en verde: **53 pruebas**, 0 fallos; `yarn build` da un bundle de 193.59 kB que pide sus assets bajo `/normativa/`. Sus nueve reglas son **diez prohibiciones de ESLint, cada una con su muestra que la viola**, y la novena —**ninguna cifra tributaria literal en el código**— no está en ninguno de los otros tres frontends. **Su imagen no existe**: no hay pantallas que servir, y el compose no gana un servicio por eso |

**Las barreras se construyeron primero, a propósito**, y el negocio entró después, por encima de
ellas. Hoy este repositorio tiene **702 pruebas** en el backend —660 antes de la etapa 4 de ADR-0039, medido sobre un árbol extraído de `origin/main`— y los tres verificadores bloqueantes en verde.

## Lo que este repositorio NO hace

- **No llama a ningún otro sistema PARA SELLAR, y eso sigue siendo una afirmación sobre la
  arquitectura.** Lo que distribuye son datos sellados —inmutables una vez sellados— y un artefacto
  de reglas que viaja como código ([ADR-0025](docs/30-arquitectura/adr/ADR-0025-normativa-servicio-y-libreria.md)).
  La pregunta que ADR-0025 dejaba escrita —qué dato de otro sistema hace falta para sellar una
  cifra que la ley ya fijó— sigue contestándose **ninguno**. **Lo que sí lee de otro sistema
  desde la etapa 4 de ADR-0039 es el buzón de `identidad`**, y hay que decir por qué eso no
  contradice a ADR-0025: no es un dato de negocio, es **replicar la autorización** —las cuatro
  tablas `usuario`, `grupo`, `miembro` y `permiso` con las que `ComprobadorDeAccesoJdbc` autoriza
  sin un viaje de red—, y desde ADR-0039 esa autorización tiene un dueño que no es este sistema
  ([ADR-0039 §«Lo que cuesta»](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0039-la-identidad-es-un-sistema.md);
  AC-3.3 de [`infrastructure#52`](https://github.com/hneyra/infrastructure/issues/52)). La arista
  la lleva el perfil `batch` —el `CronJob` del consumidor y el `Job` de implantación—, **no el
  proceso web**: con `identidad` caído la ventanilla sigue leyendo sus parámetros, y lo que se
  pierde es la frescura de la copia local, no la capacidad de autorizar. Es la única arista de
  egreso hacia un sistema, y el descriptor la declara con ese motivo.
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
frontend/                         Vite 7, React 19, TypeScript 5.9, con yarn. `normativa-web`
  src/                                   el codigo de la interfaz. ESTA ruta, y no otra (F-1)
  src/api/                               el unico sitio donde se puede llamar a `fetch`
  eslint.prohibiciones.mjs               las prohibiciones como dato: las leen el config y la prueba
  verificaciones/                        las barreras, y sus `muestras/` que las violan
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
| Frontend | [ADR-0030](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0030-cuatro-interfaces-una-sesion.md) §1 y §2 · y `frontend/eslint.prohibiciones.mjs`, que es donde viven **las diez prohibiciones como dato** |

Índice de decisiones: [`docs/30-arquitectura/adr/README.md`](docs/30-arquitectura/adr/README.md).

## Decisiones abiertas que bloquean

Registro completo en [GOB-02](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/decisiones-abiertas.md).

| # | Decisión | Bloquea |
|---|---|---|
| D-02b | Valores de **ordenanza local** con su ratificación provincial | Sellar un ejercicio completo |
| D-02c | Lo que fija un acto propio que **no** es ordenanza ratificada (arancel de costas, CUIS) | Coactiva y sanciones |
| D-11 | **CERRADA PARA 2026, y sólo para 2026** (2026-09-06). El fundamento es un **hecho** y no un valor por omisión: el supuesto del art. 12 del TUO LTM no se cumple en 2026 porque se publicaron los aranceles (RM 514-2025-EF/15) y los precios unitarios (RM 277-2025-VIVIENDA), de modo que no hay actualización que aplicar. [`predial-porcentaje-de-actualizacion.md`](docs/10-negocio/valores-normativos/predial-porcentaje-de-actualizacion.md) está en **`VERIFICADO`** con sus dos firmas distintas, su fila viaja en `parametros-2026.csv` y el ejercicio 2026 **está sellado**. **Sigue ABIERTA para cualquier otro ejercicio**: §1.6 lee el supuesto contra 2026 y ninguno más, y el siguiente necesita la misma lectura y las mismas dos firmas — **no se hereda** | Ya no bloquea 2026. `RT-002`, `RT-005` y `RT-011` en los demás ejercicios |
| D-03d | Redondeo del importe a pagar en el cierre de caja, que puede no ser el del cálculo | El cierre de caja |

**El ejercicio 2026 está sellado desde el 2026-09-06, y lo que faltaba era una firma.** Hacían
falta dos cosas: el cuadro de valores unitarios de H-14 —que `catastro#8` trajo con su derivado
firmado por `sha256` y sus dos firmas humanas— y el `% actualización`, cuyo fundamento quedó
escrito **y sin verificar**. Ese día una persona leyó §1.6 y firmó; la fila entró en el derivado,
que pasa de 32 a **33**, y `ElEjercicio2026SeSellaTest` compone el conjunto contra PostgreSQL con
sus **35** detalles y lo **sella**. **D-02a queda cerrada para 2026 con D-11.**

**Y «sellado» aquí quiere decir una cosa concreta, que #7 obliga a escribir: sellado EN LA PRUEBA
que lo compone contra PostgreSQL real, con lo que este repositorio publica.** Ninguna instalación
tiene hoy 2026 sellado, y no consta en este repositorio ninguna corrida de `--sellar` contra un
ambiente: lo último anotado contra `stg` es del 2026-08-29 y dice, con esas palabras, «lo que **no**
se hizo, a propósito: `--sellar`». Lo que la prueba demuestra es que el corpus **ya alcanza** para
componer y sellar el ejercicio; quién lo sella en una municipalidad, y con el paso 4 corrido antes,
es otro acto y de otra persona.

**Lo que ese sello NO incluye, contado antes y no después**: **diez** filas del mapa normativo que
no tienen archivo del corpus —ocho de D-02b y dos de D-02c, todas de acto propio de la
municipalidad—. `normativa` no las puede publicar: son la ordenanza de arbitrios, la TIM, el CUIS,
el fraccionamiento, la tasa de anuncios, el arancel de costas y los descuentos de papeletas. Están
nombradas una a una en el README de `publicacion/`, porque quien selle el conjunto de **su**
municipalidad tiene que poder ver si alguna es suya. Y sellar no cierra ninguna puerta: no existe
la restricción de «un solo conjunto sellado por ejercicio» que ese README afirmaba —lo que hay es
`conjunto_uq (municipalidad_id, ejercicio, version)` y una lectura que toma la última versión
sellada—; lo que cuesta un sello prematuro es que cada valuación guarda con qué `conjuntoId` se
calculó (ADR-0025 §3), así que converger es **recalcular el padrón**.
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
## El monolito se llamaba `sgtm`, y en la prosa se sigue llamando asi

El producto es **Kamayuk**. El sistema del que sale —el monolito retirado— se llamaba `sgtm`, y
ese nombre **ya no esta en el codigo**: ni en un realm, ni en una imagen, ni en un identificador, ni
en un dato de configuracion.

**Pero sigue en los comentarios, en `docs/` y en el registro de «Verificar antes de afirmar», y eso
es deliberado.** No es limpieza pendiente:

- una fila del registro que dice «copiado de `sgtm@33f329a2`» **es la medicion que se hizo**;
  reescribirla la falsifica, y borrarla pierde con que rotura se demostro;
- un comentario que dice «hasta `E` la sonda apuntaba a `sgtm`» **es el motivo por el que el codigo
  de al lado es como es**; quitar el nombre lo deja sin sujeto y hay que volver a descubrirlo;
- y varias guardas explican en su docblock **de que defecto vienen**, que es lo que impide que
  alguien las «simplifique».

**Asi que NO se hace una pasada de limpieza sobre la prosa.** Si estas aqui por un `grep sgtm` que
devuelve cientos de lineas: casi todas son de este tipo y se quedan.

**Lo que si esta prohibido es que la cadena vuelva al codigo**, y lo vigila **una sola guarda para
los seis**: `sin-el-nombre-del-monolito.test.ts` de `infrastructure`, que barre este arbol y los
cinco clones hermanos. Barre **solo codigo de produccion** —ni `docs/`, ni `*.md`, ni pruebas— y
**omite comentarios**, por lo de arriba.

Esta en un sitio y no en `comun-verificaciones` porque, medido, **del lado Java no hay nada que
vigilar**: `backend/*/src/main` de los cinco solo nombra el monolito en comentarios y en dos
`COMMENT ON COLUMN`. Anadir una prohibicion a la libreria compartida exigiria su clase de muestra y
tocaria los seis builds para vigilar el conjunto vacio.

**Dos excepciones declaradas, y las dos con su motivo dentro de la guarda.** (1) Los buckets
`sgtm-{stg,prod}-respaldos` (`infra/Pulumi.{stg,prod}.yaml`): **son el nombre de cosas que
existen**, y renombrarlos en el codigo sin renombrar el bucket manda los respaldos a un sitio que no
existe — y eso no da error hasta el dia que hay que restaurar. (2) Dos `COMMENT ON COLUMN` dentro de
un `V1__baseline.sql` **ya aplicado**: Flyway valida la suma de comprobacion de cada migracion, asi
que editar una que ya corrio hace fallar el arranque de **toda base existente**. No es que no se
quiera cambiar: **no se puede** — se corregiria con una migracion nueva, si alguna vez importa.

## Comandos

```bash
cd backend
./gradlew verificarArquitectura   # ArchUnit, escaner de fuentes, aserciones y frontera de sistema
./gradlew verificarArranque       # el artefacto levanta en los dos perfiles (C-7). Requiere PostgreSQL 16
./gradlew verificarAislamiento    # aislamiento multi-tenant. BLOQUEANTE. Requiere PostgreSQL 16
./gradlew build                   # lo anterior mas Spotless
./gradlew spotlessApply           # arregla el formato en vez de solo reprocharlo

cd ../frontend
yarn install
yarn verificar                    # UNA orden: lint, tipos y pruebas. La misma que corre la CI
yarn build                        # el bundle. Un `tsc` en verde no demuestra que Vite empaquete
yarn dev                          # solo para mirar; hoy no hay ninguna pantalla que mirar

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

**Las 26 filas viven en [`docs/agent/HISTORY.md`](docs/agent/HISTORY.md)**, y ahí es donde se
escribe la siguiente. Se mudaron el 2026-09-12: eran el **84 %** de este archivo, que se carga
entero en cada sesión ([`infrastructure`#114](https://github.com/hneyra/infrastructure/issues/114)).

La tabla de arriba se deja **con su cabecera y vacía** a propósito: es la forma de la fila que hay
que escribir, y tenerla delante evita ir a buscarla.
