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
| Su frontend (`normativa-web`, ADR-0030 §1) | **Existe el andamiaje, y ninguna pantalla** (F-1). Vite 7 + React 19 + TypeScript 5.9 en `frontend/`, con el codigo en `frontend/src/`. `yarn verificar` en verde: **53 pruebas**, 0 fallos, y `yarn build` da un bundle de 193.59 kB bajo `/normativa/`. Sus nueve reglas son **diez prohibiciones de ESLint con su muestra que las viola** |
| La imagen `ghcr.io/hneyra/kamayuk-normativa` | **NO existe.** El `Deployment` del descriptor la nombra igual: es correcto, y en esta etapa no se despliega nada |

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

Declara **su base y sus roles**, **su Deployment**, **su Job de migracion**, **sus
rutas bajo su prefijo `normativa/`**, **su egreso**, sus alertas, su panel y su inventario de claves.
No declara la etiqueta de su imagen: la pone `infrastructure`, y es lo que hace que una
liberacion normal no sea un `pulumi up` (ADR-0011 §5).

**Su egreso, que es su grafo de dependencias:**

```
normativa  ──▶  (ninguno)
```

**Sin egreso a ningun sistema, y es una afirmacion sobre la arquitectura, no una casilla
pendiente.** Lo que distribuye son datos sellados —inmutables una vez sellados (`V9`)— y un
artefacto de reglas que viaja como codigo (ADR-0025 §2). Nada de eso necesita preguntarle nada a
nadie.

**Si algun dia necesitara egreso, lo que esta mal es la arquitectura, no el descriptor.** La
pregunta que habria que contestar antes de anadir la linea es que dato de otro sistema hace falta
para sellar una cifra que la ley ya fijo.

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
