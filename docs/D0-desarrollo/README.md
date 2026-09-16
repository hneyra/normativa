# D0 — Desarrollo

Cómo montar el ambiente local de `normativa`, arrancarlo, depurarlo y probarlo. Escrito para quien
acaba de clonar el repositorio y quiere ver algo funcionando **hoy**.

| Documento | Para qué |
|---|---|
| [DEV-01 — Entorno local](entorno-local.md) | Qué instalar, el clon hermano que **no es opcional**, y las tres formas de trabajar |
| [DEV-02 — Pruebas](pruebas.md) | Qué verifica qué, cómo correr una sola, y cómo probar sin Docker |
| [DEV-03 — Cuando algo no arranca](solucion-de-problemas.md) | Los errores que ya costaron una tarde, con su causa |

## Lo primero, y no es un detalle

**`infrastructure` tiene que estar clonado al lado.** Las barreras que este backend ejecuta viven
allí y se consumen como *composite build*; sin ese clon, Gradle no llega ni a configurar el
proyecto.

```bash
cd ..                                                   # el directorio que contiene a normativa/
git clone https://github.com/hneyra/infrastructure
```

**Y el frontend no instala ni compila sin `kamayuk-lib` clonado al lado** (#55).
`frontend/package.json` enlaza los cinco `@kamayuk/{api,formato,sesion,shell,ui}` por
`link:../../kamayuk-lib/paquetes/*`, y `yarn install` **sale con código 0 aunque el clon falte**:
no enlaza nada y no avisa. El primer paso que lo dice es cargar `vite.config.ts` o
`vitest.config.ts` —`yarn dev`, `yarn build`, `yarn test`—, con el `git clone` en el mensaje.

```bash
cd ..                                                   # el mismo directorio
git clone https://github.com/hneyra/kamayuk-lib
```

Queda así, y las rutas de este documento cuentan con ello:

```
IdeaProjects/
├── infrastructure/     la plataforma y las barreras comunes
├── kamayuk-lib/        las librerias comunes del frontend
├── normativa/          este repositorio
└── sgtm/               el archivo historico (opcional, pero se consulta a diario)
```

## Lo mínimo para empezar

```bash
# 1 · Prerrequisitos. Docker sólo hace falta para la plataforma; hay salida sin él
java -version && node --version && yarn --version

# 2 · Las barreras de arquitectura. NO necesitan Docker, ni base de datos, ni red
cd backend && ./gradlew verificarArquitectura

# 3 · El descriptor de despliegue. Tampoco necesita Pulumi, ni token, ni cluster
cd ../infrastructure && yarn install && yarn verificar

# 4 · La interfaz. Tampoco necesita Docker: `yarn verificar` no levanta nada
cd ../frontend && yarn install --frozen-lockfile && yarn verificar
```

Con eso ya corre todo lo que hoy hay que correr en este repositorio. **Lo que todavía no hay es
un backend con negocio que arrancar**: no existe ni una clase de negocio, así que no hay
`bootRun` con nada dentro. Levantar la plataforma sirve para tener la base y la identidad
esperando —y para descubrir hoy lo que si no se descubre el día que haya código—, y está en
[DEV-01 §3](entorno-local.md).

**Pantalla hoy no hay, y es a propósito.** La V6 —la interfaz que
[#39](https://github.com/hneyra/normativa/issues/39) empaquetó y autenticó con PKCE S256— salió
entera en [#50](https://github.com/hneyra/normativa/issues/50); su fuente es `c01fe9a` y se lee con
`git show c01fe9a:frontend/<ruta>`. Lo que viene es la épica
[#47](https://github.com/hneyra/normativa/issues/47): la interfaz de `rentas` sobre `kamayuk-lib`.
Hasta entonces `yarn dev` sirve en `http://localhost:5173/normativa/` —con el prefijo, que es el
`base` de `vite.config.ts`— una página en blanco. Lo que sí sigue en pie es el camino a la API: las
peticiones a `/normativa/api/v1` las reenvía Vite al ingreso —el puerto sale de `KAMAYUK_BACKEND`,
con `http://localhost:8082` por omisión—, porque el backend **no publica ninguna cabecera CORS**: la
única vía es que todo cuelgue del mismo origen.

## Qué comando para qué tarea

| Quiero… | Comando | Dónde |
|---|---|---|
| Las reglas de arquitectura y los escáneres | `./gradlew verificarArquitectura` | `backend/` |
| El aislamiento multi-tenant | `./gradlew verificarAislamiento` | `backend/` |
| Todo, más el formato | `./gradlew build` | `backend/` |
| Arreglar el formato | `./gradlew spotlessApply` | `backend/` |
| Verificar el descriptor | `yarn verificar` | `infrastructure/` |
| Verificar la interfaz | `yarn verificar` | `frontend/` |
| Ver la interfaz mientras se trabaja | `yarn dev` → `http://localhost:5173/normativa/` | `frontend/` |
| Construir su imagen y levantarla | `docker compose --env-file ../infrastructure/despliegue/.env -f despliegue/compose.yaml up -d --build normativa-interfaz` | raíz |
| Levantar la plataforma | `docker compose -f despliegue/plataforma.compose.yaml up -d --wait` | `../infrastructure/` |
| Lo que hay que pasar antes de un PR | `./gradlew build verificarAislamiento verificarArquitectura` · `yarn verificar` | ambos |

## Las dos frases que gobiernan todo lo demás

**Ejecutar la prueba vale más que razonar sobre ella**, y **una verificación tiene que demostrarse
capaz de fallar**. Por eso aquí no hay ningún comando que «debería funcionar»: los de estos
documentos **se ejecutaron**, y donde algo falla en una máquina concreta se dice en
[DEV-03](solucion-de-problemas.md) en vez de omitirlo.

**Una prueba bloqueante no se omite a sí misma.** Sin motor de base de datos, `verificarAislamiento`
**falla**; no se salta. Si alguna vez encuentras la forma de ponerla en verde sin PostgreSQL, has
encontrado un defecto, no un atajo.
