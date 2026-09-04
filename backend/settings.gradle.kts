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

// LA UNICA SALIDA, Y SOLO PARA CONSTRUIR EL ARTEFACTO (C-7, punto 5).
//
// La imagen construye con el contexto en la raiz de ESTE repositorio, y
// `infrastructure/librerias-backend` vive en un clon hermano: fuera del contexto, y sin forma de
// meterlo dentro —un `.dockerignore` no puede describir un contexto que es el directorio padre—.
//
// Lo que se midio antes de decidir: `comun-verificaciones` es `testImplementation` y **solo** de
// `kamayuk-normativa-aplicacion`. La imagen construye `bootJar` e `installDist` y no corre ni una
// prueba, asi que no necesita la libreria para nada — lo unico que la necesitaba era el `require`.
//
// Con la propiedad puesta el build se queda SIN las verificaciones, y para que eso no pueda
// convertirse en «verificar sin verificar» el `build.gradle.kts` de la raiz **hace fallar toda
// tarea de prueba** mientras este puesta. O sea: o esta la libreria, o no hay verificacion; nunca
// una verificacion que pasa en verde sin ella (#192).
val soloElArtefacto = providers.gradleProperty("kamayuk.sinLibreriasComunes").isPresent

require(libreriasComunes.isDirectory || soloElArtefacto) {
    "No esta ${libreriasComunes.canonicalPath}. El backend consume comun-verificaciones como" +
        " composite build, asi que `infrastructure` tiene que estar clonado al lado de" +
        " `normativa`: git clone https://github.com/hneyra/infrastructure ../../infrastructure"
}
if (!soloElArtefacto) {
    includeBuild(libreriasComunes)
}

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

// La copia local de usuarios, grupos y permisos, y su siembra (D-N5). No es un contexto
// acotado: es el lector que autoriza y el sembrador que implanta. Las pantallas de
// administracion de seguridad viven en `rentas` (ADR-0030 §3).
include("kamayuk-normativa-seguridad")

// Ensambla el artefacto unico y aloja las verificaciones.
include("kamayuk-normativa-aplicacion")

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        mavenCentral()
    }
}
