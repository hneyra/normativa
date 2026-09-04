// Ensambla el artefacto unico de `normativa` (ADR-0003: los perfiles web y batch son el mismo
// jar), y es tambien donde corren las verificaciones que necesitan ver todo el sistema a la vez:
// las reglas de ArchUnit, el escaner de fuentes, el de aserciones, la frontera de sistema y los
// limites de Spring Modulith. Ningun otro modulo tiene en su classpath a todos los demas.

plugins {
    id("sgtm.java-base")
    id("sgtm.pruebas")
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(platform(libs.spring.boot.bom))
    implementation(platform(libs.spring.modulith.bom))

    implementation(project(":kamayuk-normativa-dominio-compartido"))
    implementation(project(":kamayuk-normativa-plataforma"))
    implementation(project(":kamayuk-normativa-reglas"))

    // El unico contexto acotado de este sistema (ARQ-01 §3.4).
    implementation(project(":kamayuk-normativa-parametros"))

    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.modulith:spring-modulith-starter-core")

    // Actuator entra por la sonda de vida y las metricas (issue #156). Se exponen `health` y
    // `prometheus`, y nada mas (application.yaml, SeguridadWeb).
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")

    // Las migraciones viven en kamayuk-normativa-esquema y las ejecuta el proceso de despliegue
    // como sgtm_owner. La aplicacion NO migra al arrancar: se conecta como sgtm_app, que no
    // tiene DDL (ARQ-03 §4).
    runtimeOnly(libs.postgresql)

    // Las barreras, compartidas con los otros cuatro repositorios (composite build; ver
    // settings.gradle.kts). Trae ArchUnit consigo como `api`, junto con JUnit y AssertJ.
    testImplementation("kamayuk.comun:comun-verificaciones")

    // La muestra de caso de uso que viola la regla 10 lleva @Transactional: sin spring-tx no
    // compilaria, y sin ella la regla no tendria como demostrarse.
    testImplementation("org.springframework:spring-tx")
    testImplementation("org.springframework.modulith:spring-modulith-starter-test")
}

tasks.test {
    // El escaner de aserciones (#724) lee `src/test` de TODOS los modulos, y esas fuentes no estan
    // en el classpath de este. Sin declararlas como entrada, editar una prueba de otro modulo
    // dejaria esta tarea en UP-TO-DATE y una asercion que no puede fallar pasaria en verde rancio.
    // Es la leccion de #192 punto 2 aplicada al unico escaner que recorre `src/test`.
    inputs
        .files(
            rootProject.layout.projectDirectory.asFileTree.matching {
                include("*/src/test/java/**/*.java")
            })
        .withPathSensitivity(PathSensitivity.RELATIVE)
}

// Nombre fijo del artefacto ejecutable. La imagen lo copia por nombre y no por comodin:
// `*.jar` casaria tambien con el `-plain.jar` que produce el plugin de java-library.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    archiveFileName.set("normativa.jar")
}
