// `normativa-reglas`: la mitad de ADR-0025 que viaja como CODIGO y no como datos.
//
// Aqui viven el motor de reglas, `ReglaTributaria`, `ReglaDeAgregacion`, `Concepto`,
// `PoliticasDeRedondeoSelladas` y `ParametrosSellados` —lo que una regla recibe como argumento—.
// Son funciones puras (regla 6): sin base de datos, sin reloj y sin configuracion global.
//
// NO DEPENDE DE SPRING NI DE LA PLATAFORMA, y eso es lo que lo hace publicable. Un artefacto de
// reglas que arrastrara el `starter-web` obligaria a `catastro` y a `rentas` a fijar tambien la
// version de Spring de `normativa`, que es exactamente la dependencia que ADR-0024 separa.
//
// Su unica dependencia es `kamayuk-normativa-dominio-compartido`, porque una regla habla en
// `Dinero`, `Ejercicio` y `ValorNormativo`. Es tambien lo que hoy impide que `rentas` lo consuma:
// ver `docs/00-gobierno/P5B-extraccion.md` §7.

plugins {
    id("sgtm.java-base")
    id("sgtm.pruebas")
}

dependencies {
    api(project(":kamayuk-normativa-dominio-compartido"))
}
