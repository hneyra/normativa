// La copia local de usuarios, grupos y permisos de `normativa` (D-N5, que contesta D-19).
//
// Lo que hay aqui son TRES cosas y no un contexto acotado entero: quien LEE la copia para autorizar
// —`ComprobadorDeAccesoJdbc`, la implementacion del puerto que `kamayuk-normativa-plataforma`
// declara—, quien la SIEMBRA al implantar la municipalidad, y desde #54 quien se la ENSENA a la
// interfaz: cinco lecturas bajo `/seguridad`, sin una sola escritura. Las escrituras de
// administracion de seguridad viven en `identidad`, que es el dueno de la autorizacion desde
// ADR-0039.
//
// El nombre del modulo no se elige: `ConfiguracionDeNormativa` ya lo reparte a
// SISTEMA_REPLICADO desde P5C, porque las cinco tablas de seguridad estan replicadas en los cuatro
// baselines (ADR-0032). Este modulo es el que las usa.

plugins {
    id("kamayuk.modulo")
    id("kamayuk.pruebas-postgres")
}

dependencies {
    testImplementation(testFixtures(project(":kamayuk-normativa-esquema")))
    testImplementation("org.springframework.boot:spring-boot-starter-jdbc")
    testImplementation("org.springframework:spring-aop")
    // MockMvc para las cinco lecturas de #54: el transporte con dobles, y de HTTP a PostgreSQL
    // con el filtro, el guardia y la transaccion de verdad.
    testImplementation("org.springframework:spring-test")
    testRuntimeOnly(libs.postgresql)
}

// LAS CAPTURAS DE LAS CINCO LECTURAS SON ENTRADA DE LA PRUEBA QUE LAS COMPARA (#54).
//
// `LecturasDeSeguridadDePuntaAPuntaTest` compara lo que el backend contesta con los cinco JSON de
// `docs/50-api/seguridad/`, que la interfaz usa como siembra de desarrollo (#64). Viven fuera de
// todo conjunto de fuentes: sin declararlos, editar uno dejaria la tarea en UP-TO-DATE y la captura
// desfasada pasaria en verde rancio (#192 punto 2).
val capturasDeSeguridad =
    rootProject.layout.projectDirectory.dir("../docs/50-api/seguridad").asFileTree

// La prueba de aislamiento de estas lecturas va en su PROPIA tarea, y la corre
// `verificarAislamiento` (#54, AC-7).
//
// El resto de las pruebas de este modulo no es aislamiento —el consumidor del buzon, la
// implantacion, el comprobador— y meter `:kamayuk-normativa-seguridad:test` entero en la barrera
// bloqueante la haria medir otra cosa. Es el mismo reparto que `pruebaDeArranque` en
// `kamayuk-normativa-aplicacion`: se excluye de `test`, se declara aparte y `check` depende de las
// dos, asi que `./gradlew build` sigue corriendo ambas.
val pruebaDeAislamiento = tasks.register<Test>("pruebaDeAislamiento") {
    group = "verification"
    description =
        "Las lecturas de seguridad de HTTP a PostgreSQL: una municipalidad no ve la copia de otra."
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    filter { includeTestsMatching("*LecturasDeSeguridadDePuntaAPuntaTest*") }
    // Como la de `kamayuk-normativa-esquema`: un fallo de aislamiento no puede quedar oculto por la
    // cache de Gradle cuando lo que cambio es el motor y no las fuentes.
    outputs.upToDateWhen { false }
    inputs.files(capturasDeSeguridad).withPathSensitivity(PathSensitivity.RELATIVE)
    // Gradle no hereda las propiedades del sistema en la JVM de las pruebas.
    providers
        .systemProperty("kamayuk.capturas.regenerar")
        .orNull
        ?.let { systemProperty("kamayuk.capturas.regenerar", it) }
}

tasks.test {
    filter { excludeTestsMatching("*LecturasDeSeguridadDePuntaAPuntaTest*") }
}

tasks.check {
    dependsOn(pruebaDeAislamiento)
}
