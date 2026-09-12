# `normativa`

Parametros versionados y sellados, corpus normativo y el catalogo de reglas. **Publica; no
consulta a nadie.**

> **Todavia no hay una sola linea de codigo de negocio, y este README lo dice antes que nada.**
> Lo que hay es el **descriptor de infraestructura** —como se desplegaria este sistema el dia que
> exista— y las **dos barreras bloqueantes**, que se construyeron antes que el negocio a proposito.
> El negocio llega en la etapa 5 de [ADR-0029](https://github.com/hneyra/infrastructure/blob/main/docs/30-arquitectura/adr/ADR-0029-cuatro-sistemas-separados.md).

## Que hay hoy, y que falta

| Pieza | Estado |
|---|---|
| `infrastructure/` — el descriptor (ADR-0031 §2) | **Existe y verifica**: `yarn verificar` en verde, sin Pulumi, sin token y sin cluster |
| `.github/workflows/` — su CI | **Existe**, con tres flujos: el descriptor, las **dos barreras bloqueantes** del backend y la guarda del registro |
| `docs/30-arquitectura/adr/` | **Existe**, con 4 ADR propio(s) y su indice ⚠ ver la nota de abajo |
| `backend/` — dos modulos y **cero clases de negocio** | **Existe desde P3**: `kamayuk-esquema` con su prueba de aislamiento (9 pruebas) y `kamayuk-verificaciones` con las barreras (79). El **negocio** llega en la etapa 5 |
| `docs/40-datos/baselines/V1__baseline.sql` — su esquema | **NO esta aqui todavia.** Generado y verificado, vive en [`sgtm/docs/40-datos/baselines/normativa/`](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/40-datos/baselines/normativa/V1__baseline.sql) hasta que la extraccion lo traiga |
| Su frontend (`normativa-web`, ADR-0030 §1) | **Existe, con sus cinco secciones, y desde [#39](https://github.com/hneyra/normativa/issues/39) se empaqueta, se despliega y AUTENTICA.** Vite 7 + React 19 + TypeScript 5.9 en `frontend/`; `yarn verificar` en verde con **866 pruebas**. Entra por codigo de autorizacion con **PKCE S256** contra `kamayuk-backoffice` —el cliente se reusa, no se declara uno propio— y el token vive **en memoria**. `frontend/Dockerfile` + `nginx.conf` producen `kamayuk-normativa-interfaz`; el descriptor la despliega y parte la ruta en dos |
| La imagen `ghcr.io/hneyra/kamayuk-normativa` | **NO existe** en el registro todavia. Desde #39 son **tres** las que `publicar-imagenes.yml` construye —`kamayuk-normativa`, `-migrador` y `-interfaz`— y la de la interfaz **si se construyo y se levanto en local**: 28 988 192 bytes, `USER 101`, `healthy`, sirviendo exactamente su `dist/` |

## Por donde entrar

- **Montar el entorno y ejecutarlo**: [`docs/D0-desarrollo/README.md`](docs/D0-desarrollo/README.md).
- **Contexto para agentes**, con las diez reglas y lo que este repositorio no hace:
  [`CLAUDE.md`](CLAUDE.md).

## El descriptor

```bash
cd infrastructure
yarn install
yarn verificar          # lint, tipos y pruebas. Sin Pulumi, sin token y sin cluster
```

Declara **su base y sus roles**, **su Deployment**, **su Job de migracion**, **el `CronJob` del
consumidor de `identidad`** (ADR-0039, etapa 4), **sus rutas bajo su prefijo `normativa/`**, **su
egreso**, sus alertas, su panel y su inventario de claves.
No declara la etiqueta de su imagen: la pone `infrastructure`, y es lo que hace que una
liberacion normal no sea un `pulumi up` (ADR-0011 §5).

**Su egreso, que es su grafo de dependencias:**

```
normativa  ──▶  identidad    (el buzon de eventos de la autorizacion, ADR-0039 etapa 4)
```

**Una sola arista, y hay que decir por que hasta la etapa 4 de ADR-0039 aqui decia
«ninguno».** Lo que `normativa` distribuye son datos sellados —inmutables una vez sellados
(`V9`)— y un artefacto de reglas que viaja como codigo (ADR-0025 §2), y nada de eso necesita
preguntarle nada a nadie: **para sellar, sigue sin llamar a ningun sistema**. La pregunta que
este README dejaba escrita —«que dato de otro sistema hace falta para sellar una cifra que la ley
ya fijo»— sigue contestandose «ninguno».

La arista no es un dato de negocio: es **la replica de la autorizacion**. Las cuatro tablas
`usuario`, `grupo`, `miembro` y `permiso` con las que el guardia autoriza sin un viaje de red
dejan de sembrarse a mano desde el catalogo y pasan a leerse del buzon de `identidad`, que desde
ADR-0039 es su dueno (ADR-0039 §«Lo que cuesta»; AC-3.3 de `infrastructure#52`). La lleva el
perfil `batch` —el `CronJob` del consumidor y el `Job` de implantacion—, no el proceso web: con
`identidad` caido la ventanilla sigue leyendo sus parametros; lo que se pierde es la frescura de
la copia, no la capacidad de autorizar. Y **`identidad` el sistema no es `identidad` Keycloak**:
la arista apunta a `componente: identidad-sistema` en `kamayuk-identidad-<ambiente>`, y la de
Keycloak —el JWKS del proceso web— sigue apuntando a la plataforma.

## Lo que este repositorio NO decide

- **La etiqueta de su imagen.** La fija `infrastructure` al componer.
- **Su namespace ni sus `PriorityClass`.** Son de alcance de cluster.
- **Como se sella un valor normativo.** Eso es de `normativa`; aqui se consume un conjunto ya
  sellado.
- **Si su descriptor se aplica.** `infrastructure` lo audita con las mismas reglas que audita los
  suyos y **se niega** si incumple: una ruta fuera del prefijo, un `Deployment` sin limites, un
  `Secret` en claro o privilegios sobre la base de otro sistema.

## De donde viene

Extraido de [`sgtm`](https://github.com/hneyra/sgtm/tree/migracion-a-microservicios), que **no se borra**: es el archivo historico y la unica copia con
`git log`. El inventario del corte —que tabla va a que repositorio, y por que— esta en
[GOB-05](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/inventario-del-corte.md).
