// Contexto acotado `parametros` (ARQ-01 §3.4), y el corazon de este repositorio.
//
// Escribir es un acto administrativo con doble verificacion (ADR-0007), no una operacion de
// negocio: la aplicacion de los demas sistemas SOLO lee, y lo hace por el snapshot sellado de
// ADR-0025 §1, nunca por SQL.

plugins {
    id("kamayuk.modulo")
    id("kamayuk.pruebas-postgres")
}

dependencies {
    // Jackson: el snapshot se serializa AQUI, en el controlador, y no se le deja a Spring MVC.
    // El motivo es la huella: el ETag es el sha256 de los bytes servidos, asi que hay que tenerlos
    // en la mano para calcularla. Con el cuerpo devuelto como objeto, los bytes los produce el
    // convertidor despues del controlador y nadie puede firmarlos.
    implementation("tools.jackson.core:jackson-databind")

    // Las reglas y los tipos que una regla recibe. `api` porque `LectorDeParametros` y
    // `ParametrosSellados` estan en la firma de lo que este modulo publica.
    api(project(":kamayuk-normativa-reglas"))

    testImplementation(testFixtures(project(":kamayuk-normativa-esquema")))
    testImplementation("org.springframework.boot:spring-boot-starter-jdbc")
    testImplementation("org.springframework:spring-aop")

    // MockMvc para la lectura de #605: transporte y guardia sin base de datos.
    testImplementation("org.springframework:spring-test")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly(libs.postgresql)
}

// Las pruebas del derivado publicable y del manifiesto de cuadros leen archivos del
// repositorio que viven FUERA del modulo (#192, #188). Sin declararlos como entrada, editar
// uno deja a `test` en UP-TO-DATE y la rotura pasa en verde rancio en local.
tasks.test {
    val delCorpus = rootProject.file("../docs/10-negocio/valores-normativos")
    inputs
        .file(delCorpus.resolve("publicacion/parametros-2026.csv"))
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs
        .file(delCorpus.resolve("publicacion/cuadros-2026.csv"))
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs
        .file(delCorpus.resolve("fuentes/depreciacion-rnt-2016/depreciacion.csv"))
        .withPathSensitivity(PathSensitivity.RELATIVE)
}
