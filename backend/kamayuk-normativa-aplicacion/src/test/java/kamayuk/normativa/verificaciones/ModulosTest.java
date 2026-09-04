package kamayuk.normativa.verificaciones;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import kamayuk.normativa.SgtmAplicacion;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

/**
 * Limites entre modulos (ADR-0003, ARQ-01 §4). Bloqueante.
 *
 * <p>Sin esto, "monolito modular" degrada a monolito en pocos meses: nada impide que un contexto
 * llame a las clases internas de otro, y cuando se nota ya hay cincuenta llamadas que desenredar.
 */
@DisplayName("ADR-0003 — Limites entre modulos")
class ModulosTest {

    private static final ApplicationModules MODULOS = ApplicationModules.of(SgtmAplicacion.class);

    @Test
    @DisplayName("los modulos esperados estan detectados")
    void losModulosEsperadosEstanDetectados() {
        List<String> detectados =
                MODULOS.stream().map(m -> m.getIdentifier().toString()).sorted().toList();

        // Si Modulith no detectara ningun modulo, verify() pasaria sin comprobar nada.
        //
        // Heredado del SRTM y verificado alli: un paquete con solo package-info.java
        // NO es un modulo para Modulith, hace falta al menos un tipo. Este sistema tiene UN
        // contexto acotado, no doce, y la lista lo dice: si `parametros` o `reglas` dejaran
        // de detectarse, esta prueba lo nombraria en vez de pasar en verde sin comprobar nada.
        assertThat(detectados)
                .as("los modulos que ya tienen codigo")
                .contains(
                        "dominio",
                        "compartido",
                        "plataforma",
                        "persistencia",
                        "auditoria",
                        "autorizacion",
                        // La copia local de usuarios, grupos y permisos (C-7, D-N5): el
                        // `ComprobadorDeAcceso` que el guardia pide y la implantacion que la
                        // siembra. Sin el, el contexto no levanta.
                        "seguridad",
                        "carga",
                        "documentos",
                        "web",
                        // El unico contexto acotado de este sistema (ARQ-01 §3.4), y la libreria
                        // de reglas que ADR-0025 publica como artefacto aparte. Que `reglas` sea
                        // un modulo de Modulith es lo que hace comprobable que no toque nada de
                        // `parametros`: es codigo puro que `catastro` y `rentas` compilan dentro
                        // del suyo, y una dependencia hacia el servicio la haria impublicable.
                        "parametros",
                        "reglas");
    }

    @Test
    @DisplayName("no hay dependencias no declaradas ni ciclos entre modulos")
    void noHayDependenciasNoDeclaradasNiCiclos() {
        MODULOS.verify();
    }
}
