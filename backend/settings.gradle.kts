// Backend de `normativa`: el servicio de datos normativos y la libreria de reglas (ADR-0025).
//
// Las barreras —ArchUnit, el escaner de fuentes, el de aserciones y la frontera de sistema— viven
// en `infrastructure/librerias-backend` y las comparten los cinco repositorios. Se consumen como
// *composite build* y no como artefacto publicado, y el motivo es el modo de fallo: un jar
// publicado a mano se queda viejo sin que nada se ponga rojo, y una verificacion vieja que pasa en
// verde es lo que este proyecto lleva doscientos issues evitando. Con `includeBuild`, Gradle la
// recompila desde el fuente en cada build: no puede quedarse vieja.
//
// LO QUE CUESTA, dicho aqui y no descubierto mas tarde: este backend NO COMPILA sin tener
// `infrastructure` clonado al lado.
val libreriasComunes = file("../../infrastructure/librerias-backend")
require(libreriasComunes.isDirectory) {
    "No esta ${libreriasComunes.canonicalPath}. El backend consume comun-verificaciones como" +
        " composite build, asi que `infrastructure` tiene que estar clonado al lado de" +
        " `normativa`: git clone https://github.com/hneyra/infrastructure ../../infrastructure"
}
includeBuild(libreriasComunes)

rootProject.name = "kamayuk-normativa-backend"

// Compartido: objetos de valor y contexto de tenant. No depende de ningun contexto acotado.
include("kamayuk-normativa-dominio-compartido")

// El esquema: migraciones Flyway y la prueba de aislamiento multi-tenant.
include("kamayuk-normativa-esquema")

// Plataforma: lleva el contexto de tenant hasta la transaccion (ARQ-03 §2).
include("kamayuk-normativa-plataforma")

// `normativa-reglas`: la mitad de ADR-0025 que viaja como CODIGO. Funciones puras, sin Spring y
// sin base de datos, y por eso es la unica pieza de este repositorio que otro sistema compila
// dentro del suyo.
include("kamayuk-normativa-reglas")

// El unico contexto acotado (ARQ-01 §3.4): ediciones, conjuntos sellados y los tres cuadros.
include("kamayuk-normativa-parametros")

// Ensambla el artefacto unico y aloja las verificaciones.
include("kamayuk-normativa-aplicacion")

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        mavenCentral()
    }
}
