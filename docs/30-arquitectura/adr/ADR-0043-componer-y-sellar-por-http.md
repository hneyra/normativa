# ADR-0043 — Componer y sellar un conjunto por HTTP: el módulo `NORMATIVA`, las rutas y la idempotencia

| Campo | Valor |
|---|---|
| Estado | **Propuesto** |
| Fecha | 2026-09-14 |
| Decide | Dirección del proyecto, en la compuerta **G1** de [`normativa`#47](https://github.com/hneyra/normativa/issues/47) |
| Nace de | [`normativa`#48](https://github.com/hneyra/normativa/issues/48) |
| Depende de | [ADR-0007](ADR-0007-parametros-versionados.md), [ADR-0025](ADR-0025-normativa-servicio-y-libreria.md), [ADR-0008](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0008-auditoria-heredada-del-manual.md) y [ADR-0039](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0039-la-identidad-es-un-sistema.md) |
| Revierte | La decisión escrita en el javadoc de `AbrirConjuntoDeParametros` (#247 §2, #202): «se resuelve como proceso `batch` y no como un `POST`». El `batch` **se queda** |
| Conserva | ADR-0025 §5 sin cambios: publicar una cifra sigue siendo de `rol_carga_parametros` |
| Implementan | [`normativa`#53](https://github.com/hneyra/normativa/issues/53), [#54](https://github.com/hneyra/normativa/issues/54), [#56](https://github.com/hneyra/normativa/issues/56) y [#59](https://github.com/hneyra/normativa/issues/59); [`identidad`#48](https://github.com/hneyra/identidad/issues/48) y [`infrastructure`#188](https://github.com/hneyra/infrastructure/issues/188) |

> **Dónde se leyó cada cita.** Un `archivo:línea` sin repositorio delante es de `normativa@c01fe9a`.
> Los de otros repositorios llevan el suyo: `infrastructure@fc89d02`, `identidad@4d039bd`,
> `rentas@ac379ac` y `catastro@f134050`. Las rutas completas de los archivos citados están al final.

## Contexto

La interfaz nueva de `normativa` (épica #47) tiene que abrir una versión del conjunto de un
ejercicio, componerla y sellarla. **Hoy eso sólo se puede hacer con un proceso `batch`**, y no por
olvido. `AbrirConjuntoDeParametros.java:34-37` lo dice: «Se resuelve como proceso `batch` y no como
un `POST`: abrir y sellar un ejercicio no es una operación de ventanilla sino un acto de
implantación», y `:39-43` añade el motivo de #202: sin perfil, «el contenedor que atiende peticiones
tendría dentro el camino más corto entre una petición HTTP y el sellado de un ejercicio». Lo fija
`AbrirConjuntoDeParametrosTest.java:402-414` (`correSoloEnElPerfilBatch`). Revertir una decisión
escrita pide un ADR, y este lo es.

### Lo que la base ya permite, y lo que no

- `kamayuk_app` tiene `INSERT, SELECT, UPDATE` sobre `conjunto_parametro_detalle` y
  `conjunto_parametros` (`V1__baseline.sql:678`, `:680`). Sobre `parametro_tributario` sólo `SELECT`
  (`:696`); escribe únicamente `rol_carga_parametros` (`:695`, política `parametro_escritura`,
  `:624-626`), y lo mismo los tres cuadros (`:590`, `:653`, `:660`). **La barrera de #202 era de
  código, no de credencial**: el proceso web ya tenía en su conexión los privilegios para componer y
  sellar, y no los tiene para publicar una cifra.
- La inmutabilidad es de la base: `conjunto_sellado_inmutable` (`BEFORE UPDATE`, `:719`) y
  `detalle_de_conjunto_sellado_inmutable` (`BEFORE INSERT OR UPDATE`, `:718`), las dos con
  `restrict_violation` (`:128-141`, `:144-167`). La versión es única por `conjunto_uq UNIQUE
  (municipalidad_id, ejercicio, version)` (`:459`). **No hay columna ni índice de idempotencia** en
  `conjunto_parametros` (`:265-273`).

### Lo que un `POST` ingenuo contestaría hoy

| Caso | Qué pasa | Dónde |
|---|---|---|
| Cuerpo sin `observacion` | `Objects.requireNonNull` → `NullPointerException` → **500** con incidencia | `Observacion.java:32`; sólo `IllegalArgumentException` va a 422 (`ManejadorDeErrores.java:89-93`), el resto cae en `cualquierOtra` (`:283-286`) |
| Llave sin `tipo` o sin `vigenciaDesde` | la misma trampa: `requireNonNull` → **500** | `LlaveDeParametro.java:30-34` |
| Agregar a un conjunto sellado | el javadoc dice «Falla si el conjunto está sellado» (`AdministrarParametros.java:131`) y no lo comprueba: lo rechaza el disparador → `DataAccessException` → **500** | `ManejadorDeErrores.java:178-181` |
| Agregar dos veces el mismo parámetro | `conjunto_detalle_pk` → **500** | `V1__baseline.sql:455` |
| Dos aperturas del mismo ejercicio a la vez | `max + 1` dos veces → `conjunto_uq` → **500** | `AdministrarParametros.java:123`, `ParametrosRepositoryJdbc.java:97-106` |

Lo que **sí** contesta bien: `sellar` da dos 409 con mensajes distintos —ya sellado
(`AdministrarParametros.java:222-228`) y vacío (`:230-239`)—, y `agregarParametroPublicado` da 404 si
no hay publicado con esa llave y 409 si hay homónimos (`:171-187`).

### Una medición que decide el cuerpo de «agregar»

`AdministrarParametros` tiene **dos** formas de agregar: por identificador
(`agregarParametro(long, long, …)`, `:132-153`) y por llave (`agregarParametroPublicado`,
`:167-198`, que resuelve con un `SELECT` y luego llama a la primera). La primera inserta el
`parametro_id` recibido tal cual (`ParametrosRepositoryJdbc.java:152-161`), y lo único que lo valida
es la clave foránea `conjunto_parametro_detalle_parametro_id_fkey` (`V1__baseline.sql:511`).

**PostgreSQL comprueba las claves foráneas sin aplicar RLS**, y se midió en vez de suponerlo
(PostgreSQL 16.15, 2026-09-14): una reproducción con las políticas de `V1` —`parametro_lectura`
(`:627-628`) y las de tenant de las dos tablas del conjunto (`:580-587`)—, un rol sin privilegios de
dueño y `app.municipalidad_id = 1`:

```
SELECT … FROM parametro_tributario             → 1:UIT, 2:DE_LA_1   (la nacional y la propia)
INSERT INTO conjunto_parametro_detalle
       VALUES (1, 1, 3)   -- 3 es de la municipalidad 2
                                               → INSERT 0 1
SELECT … FROM conjunto_parametro_detalle       → 3
SELECT count(*) … JOIN parametro_tributario    → 0
```

O sea: por identificador, una municipalidad **puede meter en su conjunto un parámetro de otra**, que
no puede leer, y la lista del conjunto lo **esconde** (`ParametrosRepositoryJdbc.java:164-175` hace
ese `JOIN`). Por llave no puede: la resolución es un `SELECT` bajo `parametro_lectura`.

### El nombre de las rutas está ocupado a medias

- ADR-0025 §5 reserva `POST normativa/api/v1/ediciones` para **publicar** una cifra: «exige el rol de
  carga, el documento fuente y las dos firmas de ADR-0007» (`ADR-0025-normativa-servicio-y-libreria.md:79-84`).
- La V6 escribió sus tres escrituras justo ahí (`git show c01fe9a:frontend/src/datos/lecturas.ts:239-243`),
  y lo declaraba: «Las rutas están inventadas; el comportamiento no» (`:230`).
- Las lecturas que existen cuelgan de `/conjuntos` (`SnapshotController.java:68`) y de
  `/seguridad/parametros` (`ParametrosController.java:32`), bajo `Api.RAIZ = "/normativa/api/v1"`
  (`Api.java:13`).

### El catálogo, y por qué sólo se puede agregar

- `CatalogoDelSistema.java:37-38`: **una** opción, `SEGURIDAD / parametros`. Tres endpoints la exigen
  con `LECTURA` (`ParametrosController.java:42`, `SnapshotController.java:87` y `:119`) y uno usa
  `SESION_PROPIA` (`ParametrosController.java:91`).
- `acceso_codigo_uq UNIQUE (municipalidad_id, codigo)` (`V1__baseline.sql:449`) y la siembra con
  `ON CONFLICT … DO NOTHING` (`SembradorDelCatalogo.java:113`, `:130`): **mover `parametros` de módulo
  no llega a ningún ambiente ya sembrado**, y retirarlo o renombrarlo es
  [`identidad`#16](https://github.com/hneyra/identidad/issues/16), que en `prod` dejó la réplica de
  `rentas` parada **20 horas** ([`identidad`#21](https://github.com/hneyra/identidad/issues/21)).
- `CatalogoDelSistemaTest.java:44-45` sólo reconoce `@RequiereAcceso(acceso = "literal"`: no lee
  `oTambien`, y compara en los dos sentidos (`:78-84`).
- `oTambien` exige **el mismo privilegio** sobre la alternativa (`RequiereAcceso.java:72-97`,
  `GuardiaDeAcceso.java:38-41`, `:157-171`). Su javadoc dice que cada uso está censado en
  `AccesosCompartidosTest` (`RequiereAcceso.java:93-95`), y **esa prueba no existe en `normativa`**.
- Una opción nueva le llega al administrador **por el buzón**: la implantación de `identidad` fija los
  siete privilegios del grupo de administración sobre cada opción del catálogo unido
  (`identidad@4d039bd:ImplantarMunicipalidad.java:292-298`), y cada `fijarParaGrupo` **emite su
  evento siempre**, cambie o no el permiso (`identidad@4d039bd:AdministrarPermisos.java:297-303`).
- **Y aquí, si llega antes que la siembra, se pierde.** Un `PERMISO_FIJADO` sobre una opción que la
  copia no tiene es `NoSePuedeAplicar` (`CopiaLocalDeLaAutorizacionJdbc.java:272-279`), y
  `ConsumirEventosDeIdentidad.java:223-228` lo **aparta y lo acusa**: no vuelve.

### El orden de despliegue no se saca del orden de mezcla

`aplicar-stg` tiene `needs: verificar` (`infrastructure@fc89d02:.github/workflows/infra.yml:1142-1145`),
y `verificar` corre `infra/verificaciones/catalogo-de-accesos.test.ts` con los hermanos en su `main`
—con `normativa: 1` escrito en `:73` y `:90`—. Desde que se mezcla el primero de #53 /
`identidad`#48 hasta que se mezcla `infrastructure`#188, **`stg` no aplica nada de ningún sistema**; y
cuando aplica, las dos versiones nuevas entran en **el mismo** `pulumi up`. En `prod` sí se controla:
cada línea de `Pulumi.prod.yaml` sube en su PR. El `Job` de implantación de cada sistema lleva la
versión en el nombre (`infrastructure/src/descriptor.ts:804`; `identidad@4d039bd:infrastructure/src/descriptor.ts:472`),
así que corre una vez por versión, y en `normativa` es él quien siembra
(`ImplantarMunicipalidad.java:133`) **antes** de su pasada del consumidor (`:150`).

## Decisión

### 1. Las rutas

Todas bajo `/normativa/api/v1`.

| # | Operación | Cuerpo y cabeceras | Éxito | Acceso · privilegio | Lo implementa |
|---|---|---|---|---|---|
| 1 | `POST /conjuntos` | `{ejercicio, observacion}` + `Idempotency-Key` **obligatoria** | **201** `ConjuntoResource` | `conjuntos` · `REGISTRO` | #59 |
| 2 | `POST /conjuntos/{id}/parametros` | `{tipo, clave, vigenciaDesde, observacion}` | **201** la fila del parámetro incorporado | `conjuntos` · `REGISTRO` | #59 |
| 3 | `POST /conjuntos/{id}/sellar` | `{observacion, arancelDeLaMunicipalidad}` | **200** `ConjuntoResource`, ya sellado | `conjuntos` · `ESPECIAL` | #59 |
| 4 | `GET /conjuntos/{id}/parametros` | — | **200** `{conjunto, parametros}` | `conjuntos` (`oTambien` `parametros`) · `LECTURA` | #56 |
| 5 | `GET /parametros` | paginación y `ordenarPor` | **200** página | `conjuntos` (`oTambien` `parametros`) · `LECTURA` | #56 |

- **`/conjuntos` y no `/ediciones`.** ADR-0025 §5 ya usa «edición» para la publicación de
  `rol_carga_parametros`, que es otro acto con otra credencial. Poner la composición en la misma ruta
  haría que un `POST /ediciones` significara dos cosas según quién lo pidiera. Y `/conjuntos` es
  donde ya cuelgan las lecturas del mismo recurso (`SnapshotController.java:68`).
- **`ConjuntoResource` es el que ya existe** (`ParametrosController.java:133-150`): `id`, `ejercicio`,
  `version`, `estado`, `fechaSellado`, `usuarioSellado`. Las rutas 1 y 3 no inventan una segunda
  forma del mismo recurso. **Sin `Location`**: no hay `GET /conjuntos/{id}`, y la ruta que lo lee es
  la 4.
- **Agregar se pide por llave —`{tipo, clave, vigenciaDesde}`— y no por `parametroId`**, por tres
  motivos, el primero medido arriba: (a) por identificador, la clave foránea deja meter un parámetro
  de otra municipalidad y el `JOIN` lo esconde; por llave, la resolución pasa por
  `parametro_lectura`; (b) la llave es la del `batch` y la del derivado publicable
  (`parametros-2026.csv`, columnas `tipo,clave,vigencia_desde`), y vale igual en `stg` y en `prod`,
  que es lo que `LlaveDeParametro.java:11-17` defiende; (c) los homónimos ya contestan 409
  (`AdministrarParametros.java:179-187`) en vez de elegir uno en silencio. La interfaz no pierde nada:
  cada fila de la ruta 5 trae los tres campos. `agregarParametro(long, long, …)` puede seguir
  existiendo como paso interno de la llave, pero **ninguna ruta HTTP lo llama**.
- **Sellar contesta 200 y no 201**: no crea un recurso, cambia el estado de uno que existe.
- **Sellar pide `ESPECIAL` y no `MODIFICACION`.** `Privilegio.java:9-11` reserva «especial» para «las
  capacidades que no son una pantalla», y sellar es el acto que congela el ejercicio (ADR-0007): quien
  concede `MODIFICACION` pensando en corregir algo no debe estar concediendo, sin saberlo, el acto que
  no se deshace. Así una municipalidad puede separar quien compone (`REGISTRO`) de quien sella
  (`ESPECIAL`). La **operación** de auditoría sigue siendo `MODIFICACION`
  (`AdministrarParametros.java:245`): una cosa es qué privilegio se exige y otra qué le pasó a la fila.
- **La fila de parámetro** de las rutas 2, 4 y 5 es la que fijen #49 y #56 —con `valorNumerico` como
  cadena, nunca como número JSON—; este ADR no le da una forma propia.
- **`GET /parametros` sin filtros** en esta decisión: `parametros-2026.csv` son **33** filas y la ruta
  pagina. Un filtro (por tipo o por vigencia) entra con su issue el día que la lista deje de caber, y
  declarado en `GuardiaDeParametros`.

### 2. El catálogo: el módulo `NORMATIVA`, con una sola opción nueva

| Módulo | Opción | Nombre | La declaran cuando entra (#53) | Después |
|---|---|---|---|---|
| `SEGURIDAD` · «Seguridad» | `parametros` | «Parametros del sistema» | se queda **como está**, y desde #53 sólo como `oTambien` | — |
| `NORMATIVA` · «Normativa» | `conjuntos` | «Conjuntos de parametros» | `GET /seguridad/parametros`, `GET /conjuntos` y `GET /conjuntos/{id}/snapshot`, reanotadas a `acceso = "conjuntos", oTambien = "parametros"` · `LECTURA` | las rutas 4 y 5 (#56) igual; las rutas 1, 2 y 3 (#59) con `acceso = "conjuntos"` y **sin** `oTambien` |

Los nombres van sin tilde, como el que ya existe (`CatalogoDelSistema.java:38`). El catálogo de
`normativa` pasa de **1** opción a **2**.

- **Sólo se agrega.** `parametros` se queda en `SEGURIDAD` y con su nombre, por lo medido arriba: el
  sembrador no mueve lo sembrado, y retirar es `identidad`#16.
- **Una opción y no cuatro (una por hoja).** Una opción nueva tiene que declararla un endpoint que
  **ya exista** cuando entre el catálogo (#53 va antes que #56 y #59): una opción que sólo sirviera a
  una escritura futura saldría roja en `CatalogoDelSistemaTest.java:78-84` y obligaría a repetir el
  trío `normativa`/`identidad`/`infrastructure` más adelante. Hoy hay **tres** lecturas que reanotar,
  y las tres leen el mismo recurso —conjuntos sellados y su contenido—: repartirlas en opciones
  distintas separaría dos lecturas de lo mismo, mientras que lo que sí hay que separar (leer, componer,
  sellar) ya lo separan los **privilegios**. Agregar una opción más adelante sigue siendo posible;
  quitar una no.
- **Las cuatro hojas de la interfaz cuelgan de `conjuntos`.** Con las tres lecturas reanotadas,
  `LECTURA` sobre `conjuntos` basta para todo lo que las hojas leen, y el menú de la interfaz (#64)
  filtra por esa opción. Ninguna hoja se dibuja por `parametros`.
- **Las lecturas se reanotan con `oTambien = "parametros"`, y las dos que consumen `rentas` y
  `catastro` también.** `rentas` reenvía a `normativa` el `Authorization` de la persona que calcula
  (`rentas@ac379ac:ClienteHttpDeNormativa.java:63-68`), así que el `LECTURA` sobre `parametros` que
  esa persona tiene hoy es lo que deja pasar su snapshot; con `oTambien` lo sigue dejando, y además
  pasa quien tenga `conjuntos`, que lee lo mismo por la ruta 4. No se ensancha qué se ve: el snapshot
  es el contenido de un conjunto sellado. (`catastro@f134050:ClienteHttpDeNormativa.java:143-148` no
  manda `Authorization`: para `catastro`, esta reanotación no cambia nada. Qué contesta `normativa` a
  eso no es de este ADR.)
- **`oTambien` no va en ninguna escritura.** Daría componer y sellar a todo el que tenga `REGISTRO` o
  `ESPECIAL` sobre `parametros`, y el grupo de administración tiene los siete sobre todas las opciones.
  Las escrituras nacen sobre una opción que hoy no tiene nadie más que ese grupo.
- **`CatalogoDelSistemaTest` pasa a contar también `oTambien`**, en sus dos formas (`"x"` y
  `{"x", "y"}`): sin eso, con `parametros` declarada sólo como alternativa, la prueba diría que sobra.
  Y **`AccesosCompartidosTest` se porta** de `rentas`, con el motivo de cada `oTambien` —el de arriba—
  escrito en su censo. Las dos cosas son de #53.

### 3. Las cinco lecturas de `/seguridad`: `SESION_PROPIA`

`GET /seguridad/modulos`, `/seguridad/accesos`, `/seguridad/sesion`, `/seguridad/sesion/permisos` y
`/seguridad/sesion/municipalidad` (#54) se anotan con `acceso = RequiereAcceso.SESION_PROPIA`.

- **Motivo**: publican el catálogo **de este sistema** —el mismo en todas las municipalidades, escrito
  en `CatalogoDelSistema`— y lo que la propia sesión puede hacer. No revelan nada que el token no
  permita enumerar probando cada endpoint (`RequiereAcceso.java:35-44`, REQ-03 §5, ADR-0013). Es el
  precedente escrito de `ParametrosController.java:63-89`.
- **Por qué no como `rentas`**, que exige `modulos` y `accesos`
  (`rentas@ac379ac:SeguridadController.java:42`, `:49`): esas opciones **no existen** en `normativa`, y
  crearlas sería el trío de repositorios por dos opciones que no protegen nada. Exigirlas sin crearlas
  dejaría el menú vacío para todo el mundo. `catastro` tomó la misma salida
  (`catastro@f134050:SeguridadController.java:66-75`, `SesionController.java:60-82`).

### 4. Lo que sigue siendo de `rol_carga_parametros`

**Publicar cualquier cifra**: las filas sueltas de `parametro_tributario` y los tres cuadros, con
`publicar-parametros.sh` y `publicar-cuadros.sh` (`infrastructure@fc89d02:infra/carga-de-datos/`).
ADR-0025 §5 no cambia. Ninguna de las rutas de §1 escribe en `parametro_tributario`,
`valor_unitario_edificacion`, `depreciacion` ni `valor_referencial_vehiculo`, y **no lo sostiene el
controlador sino el `GRANT`**: `kamayuk_app` tiene sólo `SELECT` sobre las cuatro
(`V1__baseline.sql:683`, `:696`, `:707`, `:710`). Un `POST` de la aplicación que se equivoque de SQL
recibe `permission denied`; no publica.

### 5. La idempotencia

**`POST /conjuntos`** es la única escritura que no es idempotente por su estado —cada llamada abre
`max + 1`—, y la única que lleva clave.

- **`Idempotency-Key` obligatoria.** Sin ella, **422** nombrando la cabecera. En `rentas` es opcional
  (`rentas@ac379ac:ConvenioController.java:210`) porque tenía clientes antes de tenerla; esta ruta no
  tiene ninguno, y un reintento sin clave deja una versión `ABIERTA` de más que la aplicación no puede
  borrar —`V1__baseline.sql:680` no le da `DELETE`— y que corre la numeración.
- **Forma**: de 1 a **64** caracteres ASCII visibles (`!` a `~`), comparada byte a byte y sin
  normalizar. Fuera de eso, 422 nombrando la cabecera. Se guarda en `conjunto_parametros.clave_idempotencia varchar(64)`
  nula, con índice único parcial `(municipalidad_id, clave_idempotencia) WHERE clave_idempotencia IS NOT NULL`,
  **sin ningún `UPDATE`** de relleno: `conjunto_sellado_inmutable` rechaza todo `UPDATE` de una fila
  sellada (`V1__baseline.sql:128-141`) y rompería la migración en cualquier base con un conjunto
  sellado. La migración es la `V3` de #59.
- **Ámbito**: por municipalidad. La misma clave en dos municipalidades abre dos conjuntos.
- **Reintento con la misma clave y el mismo ejercicio → 201 con el mismo conjunto** —mismo `id`, misma
  `version`, en su estado de ahora—, sin escribir ni auditar otra vez. Es lo que hace `rentas`
  (`ConvenioController.java:75-87`), y contesta 201 también en el reenvío por lo mismo que allí: dos
  códigos para el mismo éxito obligan a quien llama a distinguirlos. La `observacion` del reenvío no
  forma parte de la identidad de la petición y se ignora: la auditada es la de la primera vez.
- **La misma clave con otro ejercicio → 409**, con un mensaje que nombra el conjunto que esa clave ya
  abrió y pide una clave nueva. No es un reintento sino una clave reusada, y devolverle el conjunto de
  otro ejercicio le haría componer el año equivocado. Es el precedente de
  `rentas@ac379ac:RegistrarPreconvenio.java:358-376` (`ClaveDeOtraPeticion`, 409).
- **La garantía es el índice, no la lectura previa.** Dos peticiones concurrentes pueden chocar en
  `conjunto_uq` o en el índice de la clave —no se decide aquí cuál salta primero—. Ante un
  `unique_violation` de cualquiera de los dos, se vuelve a buscar por clave **en otra transacción**:
  si ya existe con el mismo ejercicio, 201 con ese; con otro, el 409 de arriba; si no existe —chocaron
  dos claves distintas en la misma versión—, **409** diciendo que otra versión del ejercicio se abrió a
  la vez y que la petición se puede reenviar con la **misma** clave, porque no escribió nada.

**`POST /conjuntos/{id}/parametros`** es idempotente por su estado: un parámetro está en el conjunto o
no.

- **Repetirlo → 201 con la misma fila, sin escribir ni auditar.** Un reintento tras un tiempo de
  espera no debe leerse como un error, y la composición es un conjunto, no una lista.
- **«Ya está dentro» se contesta antes que «está sellado»**: si el parámetro ya está y el conjunto se
  selló después, la respuesta a lo que se pidió es que sí está, y no se escribe nada. Si no está y el
  conjunto está sellado, **409** (§7).
- No lee `Idempotency-Key`; si llega, se ignora.

**`POST /conjuntos/{id}/sellar` repetido sobre un conjunto ya sellado → el 409 de hoy**
(`AdministrarParametros.java:222-228`), no un éxito. Sellar es un acto con autor, fecha, observación y
la declaración del §8: contestar «hecho» a una segunda petición le atribuiría a quien la mandó un sello
que puede ser de otra persona (`usuario_sellado` es de quien selló primero). Si el primer intento fue
suyo y se cortó, el 409 lo dice y la interfaz vuelve a leer el conjunto (#68), donde ve quién y cuándo.
No lee `Idempotency-Key`.

### 6. La observación

En el cuerpo de las tres escrituras, **5 a 500 caracteres tras recortar** (`Observacion.java:26-46`,
`auditoria_observacion_ck` en `V1__baseline.sql:452`). Ausente, nula, en blanco, corta o larga →
**422**, con un mensaje que nombra `observacion`. **Nunca 500.**

Se arregla **donde pasan todas**: el constructor de `Observacion` lanza `IllegalArgumentException`
también ante un nulo, como hizo `rentas` (`rentas@ac379ac:Observacion.java:72-75`, `rentas`#30), y no
con una comprobación en cada controlador que el cuarto olvide. Lo mismo `LlaveDeParametro` con `tipo` y
`vigenciaDesde` nulos (`LlaveDeParametro.java:30-34`), nombrando el campo del cuerpo.

### 7. Los códigos

| Código | Cuándo |
|---|---|
| **201** | Ruta 1 (también en el reenvío con la misma clave) y ruta 2 (también si el parámetro ya estaba) |
| **200** | Ruta 3, y las lecturas 4 y 5 |
| **404** | El conjunto no existe **o es de otra municipalidad**, con el mismo mensaje en los dos casos: con RLS son el mismo hecho (`AdministrarParametros.java:249-258`). En la ruta 2, además, no hay ningún parámetro publicado con esa llave (`:171-178`), con su mensaje propio |
| **409** | Agregar a un conjunto sellado · sellar uno ya sellado · sellar uno vacío (con su mensaje distinto, `:230-239`) · llave con homónimos (`:179-187`) · la clave de idempotencia con otro ejercicio · dos aperturas del mismo ejercicio a la vez |
| **422** | Observación (§6) · `Idempotency-Key` ausente o fuera de forma · `ejercicio` fuera de rango (lo rechaza `Ejercicio`) · llave incompleta · `arancelDeLaMunicipalidad` ausente o fuera de sus dos valores (§8) · cuerpo ilegible |

**Qué `DataAccessException` se traducen, y sólo ésas**, cada una por su causa concreta —`SQLState` y,
cuando lo hay, nombre de la restricción— y **en la operación que la puede producir**, nunca con una
regla global en `ManejadorDeErrores` que convierta todo `23505` en 409:

| Causa | Operación | Respuesta |
|---|---|---|
| `restrict_violation` (`23001`) de `detalle_de_conjunto_sellado_inmutable` | agregar | **409** «sellado: su contenido no cambia» — el mismo que la comprobación previa, que existe para contestar bien sin llegar a la base |
| `restrict_violation` (`23001`) de `conjunto_sellado_inmutable` | sellar | **409** con el mensaje de «ya sellado»: es la carrera de dos sellos a la vez |
| `unique_violation` (`23505`) en `conjunto_detalle_pk` | agregar | **201**: otro lo agregó a la vez; se relee y se devuelve la fila |
| `unique_violation` (`23505`) en `conjunto_uq` o en el índice de la clave | abrir | lo del §5 |

Todo lo demás sigue siendo **500 con incidencia**, que es lo correcto para lo que no se espera. En
particular un `foreign_key_violation` al agregar no puede darse por llave —el identificador sale de un
`SELECT`—, y si se diera sería un defecto.

### 8. El punto 3 de «Antes de sellar»

La lista de [`publicacion/README.md`](../../10-negocio/valores-normativos/publicacion/README.md)
(`:213-219`) tiene un punto que **este sistema no puede comprobar** (`:217`): «El arancel de la
municipalidad está cargado — `cargar-arancel-vial.sh`, contra **ese** conjunto». `arancel` es tabla de
`catastro` y la undécima regla prohíbe consultarla desde aquí (`:266-272`); lo único que se afirma es la
frontera (`ElEjercicio2026SeSellaTest.java:442`). Sin él, `catastro` valoriza **0 de 23** predios, los
23 por `ARANCEL:2026` (`:283-288`). Y una vez sellado, `catastro` rechaza cargar un arancel contra ese
conjunto en cuanto lo tiene descargado (`catastro@f134050:V3__guarda_del_arancel.sql:6-12`, `:23-28`).

**Lo que la interfaz muestra antes de sellar** es este texto, **literal**, como dato de la hoja (#68),
con las dos interpolaciones de i18next:

<!-- punto-3:inicio -->
```text
Antes de sellar: el arancel de la municipalidad

El arancel vial de esta municipalidad no lo publica normativa: se carga en catastro, contra este conjunto ({{conjuntoId}}), entre abrirlo y sellarlo.

Normativa no puede comprobar si está cargado, y no lo va a comprobar: la tabla es de catastro.

Sin él, catastro no valoriza ningún predio del ejercicio {{ejercicio}}. Y una vez sellado, catastro rechaza cargar un arancel contra este conjunto en cuanto lo descarga: corregirlo exige abrir otra versión y recalcular lo que se haya emitido con esta.

○ Declaro que el arancel de esta municipalidad está cargado contra este conjunto.
○ Sello sabiendo que el arancel de esta municipalidad no está cargado contra este conjunto.
```
<!-- punto-3:fin -->

- **Qué confirma la persona**: una de las dos frases. **Ninguna viene marcada**; sin elegir, el botón
  de sellar no se habilita. Son dos y no una casilla «confirmo que está cargado», porque el propio
  README selló 2026 **sabiendo** que no lo estaba (`:290-301`): una sola casilla empujaría a quien sella
  a declarar lo contrario de lo que sabe para poder hacer lo que el repositorio ya hizo con motivo.
- **Viaja en el cuerpo de `sellar`**, como `arancelDeLaMunicipalidad: "DECLARADO_CARGADO" | "SIN_CARGAR"`.
  Ausente, nulo u otro valor → **422** nombrando el campo. No hay valor por omisión: un valor por
  omisión sería una declaración que nadie hizo.
- **Queda en la auditoría**, en el `datos_nuevos` de la fila `MODIFICACION` del sellado
  (`AdministrarParametros.java:278-296`), junto a lo que ya lleva:
  `{"ejercicio":…,"version":…,"estado":"SELLADO","arancelDeLaMunicipalidad":"SIN_CARGAR","comprobadoPorNormativa":false}`.
  `comprobadoPorNormativa` vale **siempre** `false`, y está para que quien lea la fila sin haber leído
  este ADR no la tome por una verificación. **No** va en `conjunto_parametros` ni en el snapshot: no es
  una propiedad del conjunto sino lo que alguien dijo al sellarlo, y un consumidor que la leyera la
  trataría como un hecho.
- **Qué NO prueba**: que el arancel esté cargado. Prueba **quién dijo qué, cuándo y con qué
  observación**. `normativa` no puede comprobar el arancel y no lo va a fingir: ninguna ruta de este
  sistema consulta `catastro` para sellar, y la arquitectura lo sigue diciendo (CLAUDE.md, «No llama a
  ningún otro sistema PARA SELLAR»).
- **El texto de arriba es el que se acepta en G1**, y la interfaz no lo reescribe: #68 lleva una prueba
  que lee el bloque entre `punto-3:inicio` y `punto-3:fin` de este archivo y lo compara con lo que la
  hoja dibuja. Un ADR aceptado no se edita, así que la fuente no se mueve.
- **El README no se toca en este ADR.** Su lista la lee `ElEjercicio2026SeSellaTest.java:473`, y lo
  que se decide aquí es cómo se pregunta por HTTP, no qué contesta la lista.

### 9. La respuesta a `AbrirConjuntoDeParametros`

**Al motivo de `:34-37`** —«no es una operación de ventanilla sino un acto de implantación»—: sigue
siendo un acto administrativo, y lo que lo hace tal no es el proceso que lo corre sino lo que exige.
Por HTTP exige más que por `batch`, no menos:

- un **privilegio** concedido a una persona de esa municipalidad —`REGISTRO` para componer,
  `ESPECIAL` para sellar—, que el `batch` no pide porque corre con un usuario de proceso;
- una **observación** en cada escritura, con la regla de ArchUnit
  `TODO_CASO_DE_USO_DE_ESCRITURA_EXIGE_OBSERVACION` (`infrastructure@fc89d02:ReglasDeArquitectura.java:236-243`);
- **auditoría con el usuario del token**, y la declaración del §8;
- **sólo compone lo ya publicado**: la cifra no la puede escribir (§4);
- y **un sello prematuro se corrige**: con la versión N+1, al precio de recalcular lo emitido con la N
  ([`publicacion/README.md`](../../10-negocio/valores-normativos/publicacion/README.md):204-208).

**Al motivo de `:39-43`** (#202) —el camino más corto entre una petición HTTP y el sellado—: el camino
existe desde este ADR, y es a propósito. Lo que lo guarda ya no es la ausencia de código sino
`@RequiereAcceso` sobre cada ruta, con `TODO_ENDPOINT_DECLARA_SU_ACCESO`
(`infrastructure@fc89d02:ReglasDeArquitectura.java:301-307`) rompiendo el build si falta, y el guardia
negando lo que no encuentra. La credencial no cambia: ya podía (Contexto).

**Lo que se pierde**, dicho:

- **Sellar deja de exigir acceso al clúster.** Hasta aquí sellaba quien podía lanzar un `Job`; desde
  aquí, quien tenga `ESPECIAL` sobre `conjuntos` en su municipalidad. Es el objetivo de la épica, y su
  riesgo es el de cualquier concesión de permisos.
- **La negativa del `batch` a sellar un conjunto compuesto a medias** (`AbrirConjuntoDeParametros.java:145-157`,
  «N fila(s) del archivo no entraron») no tiene equivalente: por HTTP se agrega de uno en uno y el
  servidor no sabe qué es «completo» —las filas de ordenanza local de D-02b son de cada
  municipalidad—. Lo que queda es la negativa a sellar vacío (`AdministrarParametros.java:230-239`) y
  la lista que la ruta 4 pone delante antes de sellar.
- **La línea `CONJUNTO_ID=N` del registro** (`AbrirConjuntoDeParametros.java:88-91`), que era lo que
  necesitaba `cargar-arancel-vial.sh --conjunto-id N`: por HTTP el `id` está en la respuesta de la ruta
  1 y en el texto del §8.

**El `batch` se queda** como alternativa —para una implantación desde un archivo, y para quien no tenga
todavía la interfaz—, pasa por el mismo `AdministrarParametros` y `correSoloEnElPerfilBatch` sigue
verde. Su javadoc lo enmienda #59, citando este ADR.

### 10. El orden de despliegue del catálogo (G3): las dos salidas, combinadas

**(a) El consumidor pospone lo que va a llegar, y aparta lo que no.** En la misma imagen que trae el
catálogo nuevo (#53): un `PERMISO_FIJADO` de `sistema = normativa` sobre una opción que
`CatalogoDelSistema` **declara** y la copia **todavía no tiene** sale `DependenciaQueNoLlego`
(`CopiaLocalDeLaAutorizacion.java:95-96`): no se acusa y no se aparta, y el buzón lo vuelve a servir.
Sobre un código que el catálogo **no** declara sigue siendo `NoSePuedeAplicar` y se aparta como hoy.

- **Por qué es la distinción correcta**: es la salida 2 de `identidad`#21 —«que el consumidor distinga
  "la dependencia no ha llegado" de "no va a llegar"»— aplicada al revés de donde se midió. Allí
  `rentas` posponía **siempre** y se atascó 20 horas con cuatro permisos sobre opciones que ya no
  declaraba; aquí `normativa` aparta **siempre** y perdería el permiso de una opción que sí declara y
  que su propio `Job` sembrará minutos después. Con la regla, lo que se pospone es exactamente lo que
  la siembra de esa misma imagen va a crear.
- **Lo que cubre**: la carrera **dentro** de `normativa` —el `CronJob` del consumidor con la imagen
  nueva corriendo antes de que el `Job` de implantación termine de sembrar—, y `identidad` llegando
  antes que la implantación de `normativa` en cualquier ambiente donde la imagen nueva de `normativa`
  ya esté.
- **Lo que cuesta**: si la siembra no llega nunca —el `Job` de implantación falló—, el permiso queda
  pospuesto y la alerta de los **15 minutos** grita (`ConsumirEventosDeIdentidad.java:98`), que es el
  aviso que ese caso merece. Sólo se retiene lo que escribe la misma fila. Y como en `normativa` una
  opción no se retira nunca (§2), no puede repetirse el atasco de `identidad`#21 por este camino.

**(b) Y el orden, escrito como operación**, porque (a) no cubre una imagen **vieja** de `normativa` —sin
la regla ni la opción— consumiendo el evento nuevo de `identidad`:

- **`prod`**: el PR que sube `kamayuk:versionDeNormativa` en `Pulumi.prod.yaml` a una versión con #53
  se aplica, y el `Job` `kamayuk-normativa-implantacion-<sha>` queda `Completed`, **antes** de abrir el
  que sube `identidad` a una versión con `identidad`#48. El segundo PR lo dice en su cuerpo.
- **`stg`**, donde el orden no se puede elegir: después del `pulumi up` que trae las dos, se comprueba
  como `kamayuk_readonly`, con la municipalidad fijada,

  ```sql
  BEGIN;
  SET LOCAL app.municipalidad_id = '<id de la municipalidad en normativa>';
  SELECT evento_id, secuencia, recibido_en, motivo
    FROM identidad_evento_muerto
   WHERE motivo LIKE '%esta copia no tiene esa opcion%'
     AND recibido_en >= '<hora del pulumi up>';
  COMMIT;
  ```

  (`identidad_evento_muerto` lleva RLS con `FORCE`, `V2__consumidor_de_identidad.sql:139-141`). **Cero
  filas** es lo esperado. Con alguna, se vuelve a correr la implantación de `identidad` —con su
  siguiente versión, o recreando su `Job`—: vuelve a emitir un `PERMISO_FIJADO` por opción
  (`identidad@4d039bd:AdministrarPermisos.java:297-303`), y esta vez la copia tiene la opción. Lo que
  salga se anota en #53.
- **Lo que se pierde mientras tanto**, si pasara: el grupo de administración sin permiso sobre
  `conjuntos` en la copia de `normativa`. Las lecturas siguen pasando por `oTambien = "parametros"`;
  las tres escrituras contestan 403 hasta la reemisión. `parametros` no se toca.

## Consecuencias

- **La interfaz puede componer y sellar sin acceso al clúster**, y el `batch` sigue ahí.
- **El catálogo cambia en tres repositorios a la vez** (#53, `identidad`#48, `infrastructure`#188), y
  cambia **una vez**: una sola opción nueva, declarada por lecturas que ya existen.
- **`normativa` publica escrituras por primera vez**, y con ellas tres tipos de respuesta que hoy salen
  500 pasan a ser 409 o 422 por causa concreta (§7). #59 lo implementa con la migración `V3`, y **G4**
  —la `V3` aplicada antes de que la imagen web sirva los `POST`— es suya.
- **El sello de un ejercicio queda con una declaración que no es una verificación**, y la fila de
  auditoría lo dice con `comprobadoPorNormativa: false`.
- **`agregarParametro(long, long, …)` deja de ser un camino admisible desde fuera** de
  `AdministrarParametros`: por lo medido en el Contexto, una ruta que lo llamara con un identificador
  del cliente abriría un cruce entre municipalidades que RLS no ve.
- **La compuerta G3 no se cierra con la mezcla**: se cierra con lo que se anote en #53 tras aplicar en
  cada ambiente.

## Lo descartado, y por qué

- **`POST /ediciones`** (lo que la V6 escribió). Ocupa la ruta que ADR-0025 §5 reserva a publicar una
  cifra, que es otro acto y otra credencial.
- **Agregar por `parametroId`.** Es la forma cómoda para una interfaz que ya tiene la fila, y es la que
  deja entrar un parámetro de otra municipalidad por la clave foránea (medido). La llave cuesta tres
  campos en vez de uno.
- **`Idempotency-Key` opcional**, como en `rentas`. Allí la hizo opcional tener clientes previos; aquí
  no hay ninguno, y lo que se evita —una versión abierta de más que no se borra— no tiene arreglo
  después.
- **Idempotencia por clave en agregar y sellar.** Agregar ya lo es por su estado; en sellar, un éxito
  repetido mentiría sobre quién selló (§5).
- **Sellar con `MODIFICACION`**, que es lo que la auditoría registra. Mezcla el privilegio de corregir
  con el del acto que no se deshace, y no deja separar a quien compone de quien sella.
- **Una opción por hoja** (`panel`, `ediciones`, `cuadros`, `publicacion`). Ninguna tendría hoy un
  endpoint propio que la declarara, así que obligaría a inventar lecturas o a repetir el trío de
  repositorios por cada una; y separaría lecturas del mismo dato (§2).
- **Mover `parametros` al módulo `NORMATIVA`.** No llega a ningún ambiente sembrado
  (`SembradorDelCatalogo.java:113`, `:130`), así que el código y la base dirían cosas distintas.
- **Dejar `GET /conjuntos` y el snapshot sólo en `parametros`.** Obligaría a colgar dos hojas de una
  opción del módulo Seguridad, o a que quien tiene `conjuntos` viera la hoja y recibiera 403.
- **Una sola casilla «confirmo que el arancel está cargado»**. Empuja a declarar lo que no se sabe (§8).
- **Que `normativa` pregunte a `catastro` si el arancel está cargado antes de sellar.** Es la primera
  llamada a otro sistema **para sellar**, que es lo que la arquitectura de este repositorio dice que no
  hace; y la regla 11 prohíbe la otra forma, leer la tabla.
- **Prohibir dos versiones abiertas del mismo ejercicio** (un índice único parcial sobre `ABIERTO`). No
  se ha medido si algún ambiente tiene hoy dos, y si las tiene la migración que lo añadiera fallaría;
  el `batch` las permite, y la clave obligatoria ya evita la causa más común —el reintento—. Si hace
  falta, es un issue propio con esa medición.
- **Sólo (a), o sólo (b), en el §10.** (a) sola deja la imagen vieja; (b) sola deja la carrera entre el
  `CronJob` y el `Job` de la misma imagen, que no se puede ordenar con PR.

## Dónde vive cada archivo citado

| Nombre corto | Ruta |
|---|---|
| `AbrirConjuntoDeParametros`, `AdministrarParametros` | `backend/kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros/aplicacion/` |
| `AbrirConjuntoDeParametrosTest`, `ElEjercicio2026SeSellaTest` | `backend/kamayuk-normativa-parametros/src/test/java/kamayuk/normativa/parametros/aplicacion/` |
| `ParametrosRepositoryJdbc` | `backend/kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros/infraestructura/` |
| `ParametrosController`, `SnapshotController` | `backend/kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros/infraestructura/web/` |
| `LlaveDeParametro` | `backend/kamayuk-normativa-parametros/src/main/java/kamayuk/normativa/parametros/dominio/` |
| `Observacion` | `backend/kamayuk-normativa-dominio-compartido/src/main/java/kamayuk/normativa/dominio/` |
| `ManejadorDeErrores`, `Api` | `backend/kamayuk-normativa-plataforma/src/main/java/kamayuk/normativa/web/` |
| `RequiereAcceso`, `GuardiaDeAcceso`, `Privilegio` | `backend/kamayuk-normativa-plataforma/src/main/java/kamayuk/normativa/autorizacion/` |
| `CatalogoDelSistema`, `CopiaLocalDeLaAutorizacion` | `backend/kamayuk-normativa-seguridad/src/main/java/kamayuk/normativa/seguridad/dominio/` (la segunda, en `consumidor/`) |
| `CatalogoDelSistemaTest` | `backend/kamayuk-normativa-seguridad/src/test/java/kamayuk/normativa/seguridad/dominio/` |
| `SembradorDelCatalogo`, `ImplantarMunicipalidad`, `ConsumirEventosDeIdentidad` | `backend/kamayuk-normativa-seguridad/src/main/java/kamayuk/normativa/seguridad/aplicacion/` |
| `CopiaLocalDeLaAutorizacionJdbc` | `backend/kamayuk-normativa-seguridad/src/main/java/kamayuk/normativa/seguridad/infraestructura/consumidor/` |
| `V1__baseline.sql`, `V2__consumidor_de_identidad.sql` | `backend/kamayuk-normativa-esquema/src/main/resources/db/migration/` |
| `ReglasDeArquitectura` | `infrastructure/librerias-backend/comun-verificaciones/src/main/java/kamayuk/comun/verificaciones/` |
| `identidad`: `ImplantarMunicipalidad`, `AdministrarPermisos` | `backend/kamayuk-identidad-nucleo/src/main/java/kamayuk/identidad/nucleo/aplicacion/` |
| `rentas`: `ConvenioController`, `RegistrarPreconvenio` | `backend/kamayuk-rentas-tesoreria/src/main/java/kamayuk/rentas/tesoreria/{infraestructura/web,aplicacion}/` |
| `rentas`: `Observacion` | `backend/kamayuk-rentas-dominio-compartido/src/main/java/kamayuk/rentas/dominio/` |
| `rentas`: `ClienteHttpDeNormativa` · `catastro`: `ClienteHttpDeNormativa` | `backend/kamayuk-rentas-parametros/src/main/java/kamayuk/rentas/parametros/infraestructura/` · `backend/kamayuk-catastro-parametros/src/main/java/kamayuk/catastro/parametros/infraestructura/` |
| `rentas` y `catastro`: `SeguridadController`, `SesionController` | `backend/kamayuk-<sistema>-seguridad/src/main/java/kamayuk/<sistema>/seguridad/infraestructura/web/` |
| `catastro`: `V3__guarda_del_arancel.sql` | `backend/kamayuk-catastro-esquema/src/main/resources/db/migration/` |
