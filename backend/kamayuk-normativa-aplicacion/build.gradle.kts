// Ensambla el artefacto unico de `normativa` (ADR-0003: los perfiles web y batch son el mismo
// jar), y es tambien donde corren las verificaciones que necesitan ver todo el sistema a la vez:
// las reglas de ArchUnit, el escaner de fuentes, el de aserciones, la frontera de sistema y los
// limites de Spring Modulith. Ningun otro modulo tiene en su classpath a todos los demas.

plugins {
    id("kamayuk.java-base")
    id("kamayuk.pruebas-postgres")
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(platform(libs.spring.boot.bom))
    implementation(platform(libs.spring.modulith.bom))

    implementation(project(":kamayuk-normativa-dominio-compartido"))
    implementation(project(":kamayuk-normativa-plataforma"))

    // La copia local de seguridad: el `ComprobadorDeAcceso` que el guardia necesita y la
    // implantacion de la municipalidad. Sin este modulo el contexto NO ARRANCA —el guardia
    // pide un bean que nadie declara— y eso es lo que C-6 midio y C-7 cierra.
    implementation(project(":kamayuk-normativa-seguridad"))
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
    // como kamayuk_owner. La aplicacion NO migra al arrancar: se conecta como kamayuk_app, que no
    // tiene DDL (ARQ-03 §4).
    runtimeOnly(libs.postgresql)

    // Las barreras, compartidas con los otros cuatro repositorios (composite build; ver
    // settings.gradle.kts). Trae ArchUnit consigo como `api`, junto con JUnit y AssertJ.
    testImplementation("kamayuk.comun:comun-verificaciones")

    // La muestra de caso de uso que viola la regla 10 lleva @Transactional: sin spring-tx no
    // compilaria, y sin ella la regla no tendria como demostrarse.
    testImplementation("org.springframework:spring-tx")
    testImplementation("org.springframework.modulith:spring-modulith-starter-test")

    // `ArranqueDeLaAplicacionTest` levanta el contexto ENTERO contra un PostgreSQL real, que es
    // lo unico que ve un bean que falta (C-7). De ahi las dos lineas: los fixtures que provisionan
    // la base y el arranque de Spring Boot con su servidor de pruebas.
    testImplementation(testFixtures(project(":kamayuk-normativa-esquema")))
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.test {
    // Gradle NO hereda las propiedades del sistema en la JVM de las pruebas: sin esto,
    // `-Dkamayuk.contratos.regenerar=true` no llega y el contrato que este repositorio
    // publica para sus proveedores no se puede regenerar. Es la misma linea que
    // `rentas` tiene desde #400 para las formas de la API.
    providers
        .systemProperty("kamayuk.contratos.regenerar")
        .orNull
        ?.let { systemProperty("kamayuk.contratos.regenerar", it) }

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

    // LOS DOS CONTRATOS DEL CONSUMIDOR VIVEN EN OTRO CLON, y sin declararlos esta tarea se queda
    // UP-TO-DATE cuando cambian. `ContratoConRentasTest` lee
    // `../../rentas/docs/50-api/contratos-que-consume/normativa.json` y `ContratoConCatastroTest`
    // el homonimo de `catastro` —lo que cada uno espera de este backend—, y ninguno de los dos
    // estaba en una entrada de Gradle: **medido en C-2**, anadirle al contrato de `rentas` un
    // campo que este sistema no publica daba `BUILD SUCCESSFUL` con la tarea UP-TO-DATE, o sea
    // **sin que la prueba corriera**. En CI corre fresco y muerde, que es la peor forma de
    // enterarse. Es la leccion de #192 punto 2, aplicada a la frontera entre repositorios, y el
    // mismo cierre que C-1 le puso a `catastro`; aqui quedaba declarado como hueco 1 de C-1.
    //
    // `optional()` porque el clon hermano puede no estar: si falta, la prueba falla con su propio
    // mensaje —nombrando el archivo y diciendo que el CI del proveedor tiene que hacer checkout
    // del consumidor—, que dice mas que un fallo de configuracion de Gradle.
    inputs
        .files(
            rootProject.layout.projectDirectory.file(
                "../../rentas/docs/50-api/contratos-que-consume/normativa.json"),
            rootProject.layout.projectDirectory.file(
                "../../catastro/docs/50-api/contratos-que-consume/normativa.json"))
        .optional()
        .withPathSensitivity(PathSensitivity.NONE)
}

// Nombre fijo del artefacto ejecutable. La imagen lo copia por nombre y no por comodin:
// `*.jar` casaria tambien con el `-plain.jar` que produce el plugin de java-library.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    archiveFileName.set("normativa.jar")
}

// La prueba de arranque va en su PROPIA tarea, y no es una manía de organización.
//
// `verificarArquitectura` corre `:kamayuk-normativa-aplicacion:test` y no necesita motor de base de
// datos: son ArchUnit, escaneres de fuentes y limites de Modulith. `ArranqueDeLaAplicacionTest`
// si lo necesita —levanta el artefacto de verdad y su sonda de salud consulta la base—, asi que
// meterla en `test` convertiria la barrera de arquitectura en una que no se puede correr sin
// PostgreSQL. Se excluye de `test` y se declara aparte; `check` depende de las dos, de modo que
// `./gradlew build` sigue corriendo ambas.
val pruebaDeArranque = tasks.register<Test>("pruebaDeArranque") {
    group = "verification"
    description = "Levanta el artefacto en los perfiles web y batch contra PostgreSQL real (C-7)."
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    filter { includeTestsMatching("*ArranqueDeLaAplicacionTest") }
    // Un arranque que se salta a si mismo deja el build en verde sin haber arrancado nada.
    outputs.upToDateWhen { false }
}

tasks.test {
    filter { excludeTestsMatching("*ArranqueDeLaAplicacionTest") }
}

tasks.check {
    dependsOn(pruebaDeArranque)
}
