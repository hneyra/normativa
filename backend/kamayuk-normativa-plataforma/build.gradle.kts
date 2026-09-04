// kamayuk-normativa-plataforma no es un contexto acotado: es la infraestructura tecnica que
// lleva el contexto de tenant desde TenantContext hasta la transaccion de base de
// datos (ARQ-03 §2). Ningun contexto de negocio la llama; la usa Spring.
//
// Es la MISMA capa que `kamayuk-rentas-plataforma`, copiada en P5B con el paquete cambiado. Que
// haya dos copias es deliberado y esta declarado en `docs/00-gobierno/P5B-extraccion.md` §7:
// sacarla a `infrastructure/librerias-backend` exigiria compartir tambien los objetos de valor,
// que es un renombrado de 938 archivos en `rentas` y no cabe en esta etapa.

plugins {
    id("sgtm.java-base")
    id("sgtm.pruebas-postgres")
}

dependencies {
    implementation(platform(libs.spring.boot.bom))
    api(project(":kamayuk-normativa-dominio-compartido"))

    // spring-boot-starter-jdbc trae spring-jdbc y HikariCP. El pool es parte del
    // contrato aqui: la verificacion al devolver la conexion necesita poder
    // descartarla, no solo cerrarla.
    api("org.springframework.boot:spring-boot-starter-jdbc")

    // El filtro lee el claim del token ya validado (ADR-0005).
    api("org.springframework.boot:spring-boot-starter-oauth2-resource-server")

    // La capa web comun —contrato, errores, paginacion— vive aqui, en
    // kamayuk.normativa.web, y la usan los controladores del contexto `parametros`.
    api("org.springframework.boot:spring-boot-starter-web")

    testImplementation(testFixtures(project(":kamayuk-normativa-esquema")))

    // Solo para la prueba de la cadena de identidad: verifica que /actuator/health
    // y /actuator/prometheus siguen siendo lo unico publico (issue #156).
    testImplementation("org.springframework.boot:spring-boot-starter-actuator")
    testImplementation("io.micrometer:micrometer-registry-prometheus")
    testImplementation("org.springframework.boot:spring-boot-starter-web")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testRuntimeOnly(libs.postgresql)
}
