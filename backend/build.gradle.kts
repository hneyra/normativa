// Raiz del build de `normativa`. No produce artefactos: solo agrupa y declara las dos tareas
// bloqueantes, con los mismos nombres que en los otros cuatro repositorios.
//
// Van SEPARADAS a proposito, y en CI son dos pasos: cuando algo se rompe, el nombre del paso ya
// dice que barrera cayo.

tasks.register("verificarAislamiento") {
    group = "verification"
    description =
        "Aislamiento multi-tenant: la prueba del esquema, la del pool y la de las cinco lecturas " +
            "de seguridad de punta a punta. Bloqueante. Requiere PostgreSQL 16."
    // La tercera entra con #54: las lecturas de `/seguridad` de HTTP a PostgreSQL, con dos
    // municipalidades y el inquilino puesto solo por el filtro. Es la unica que ve el defecto que
    // vive entre las otras dos —una lectura sin transaccion, o la fila de `municipalidad` de otra,
    // que no la aisla RLS porque su politica es USING (true)—.
    dependsOn(
        ":kamayuk-normativa-esquema:test",
        ":kamayuk-normativa-plataforma:test",
        ":kamayuk-normativa-seguridad:pruebaDeAislamiento")
}

tasks.register("verificarArquitectura") {
    group = "verification"
    description =
        "Reglas de ArchUnit, escaner del codigo fuente, aserciones, frontera de sistema y " +
            "limites de Spring Modulith. Bloqueante."
    dependsOn(":kamayuk-normativa-aplicacion:test")
}

tasks.register("verificarArranque") {
    group = "verification"
    description =
        "Los dos perfiles del artefacto levantan de verdad, con todos sus beans. " +
            "Bloqueante. Requiere PostgreSQL 16."
    dependsOn(":kamayuk-normativa-aplicacion:pruebaDeArranque")
}

// El contrapeso de `kamayuk.sinLibreriasComunes` (C-7, punto 5).
//
// Esa propiedad existe para que la IMAGEN pueda construir el artefacto sin el clon hermano de
// `infrastructure`. Con ella no hay composite build, asi que no hay barreras — y una tarea de
// prueba que corriera igual estaria verificando SIN las verificaciones, que es exactamente el
// modo de fallo que el composite build existe para impedir (#192, y el README de
// `librerias-backend` con todas las letras).
//
// Falla en `doFirst` y no al configurar: configurar sigue siendo legitimo —`bootJar` configura
// el proyecto entero— y lo que no puede ocurrir es que una prueba se EJECUTE.
if (providers.gradleProperty("kamayuk.sinLibreriasComunes").isPresent) {
    subprojects {
        tasks.withType<Test>().configureEach {
            doFirst {
                throw GradleException(
                    "«$path» no se puede ejecutar con -Pkamayuk.sinLibreriasComunes: esa propiedad " +
                        "deja el build SIN el composite build de `infrastructure/librerias-backend`, " +
                        "o sea sin ArchUnit, sin el escaner de fuentes y sin la frontera de sistema. " +
                        "Sirve para construir el artefacto de la imagen y para nada mas. Clona " +
                        "`infrastructure` al lado y quita la propiedad.")
            }
        }
    }
}
