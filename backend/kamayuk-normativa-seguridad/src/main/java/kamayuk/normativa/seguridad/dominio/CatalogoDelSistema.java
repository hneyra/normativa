package kamayuk.normativa.seguridad.dominio;

import java.util.List;

/**
 * Las opciones del menu que sirve <b>este</b> sistema (NEG-03, RF-122).
 *
 * <h2>Por que aqui hay una lista y en {@code rentas} se lee un documento</h2>
 *
 * <p>{@code rentas} lee {@code docs/10-negocio/catalogo-de-opciones.md} —las 134 opciones del
 * manual— porque ese documento vive en su repositorio. Aqui no vive: leerlo obligaria a que el
 * build de {@code normativa} dependiera del clon de {@code rentas} <b>en produccion</b>, y no solo
 * en las pruebas. Lo que se hace en su lugar es lo que el inventario del corte ya decia: «cada
 * sistema siembra <b>su parte</b>».
 *
 * <p>Cual es su parte no se elige a ojo: es <b>el conjunto de {@code acceso} que sus propios
 * endpoints declaran</b> con {@code @RequiereAcceso} —contando tambien lo que declaran en {@code
 * oTambien}, que es una opcion del catalogo como cualquier otra—. Y eso no se deja a la buena
 * memoria — {@code CatalogoDelSistemaTest} recorre {@code src/main}, junta los valores de la
 * anotacion y exige que sean exactamente estos. Una opcion de mas seria un permiso que nadie puede
 * usar; una de menos, una pantalla a la que no se le puede dar permiso, que es el defecto que
 * RF-122 existe para impedir.
 *
 * <h2>Dos modulos desde ADR-0043 §2, y ninguna opcion retirada</h2>
 *
 * <p>Hasta #53 habia <b>una</b> opcion, {@code SEGURIDAD/parametros}, y las cuatro hojas de la
 * interfaz nueva no tenian modulo propio del que colgar (epica #47). ADR-0043 §2 anade el modulo
 * {@code NORMATIVA} con <b>una sola</b> opcion, {@code conjuntos}, que es la que declaran desde
 * este mismo PR las <b>cinco</b> lecturas de conjuntos y de su contenido; las escrituras de #59
 * naceran sobre ella y sin {@code oTambien}.
 *
 * <p><b>{@code parametros} se queda donde esta</b>, en {@code SEGURIDAD} y con su nombre, y eso no
 * es conservadurismo: {@code SembradorDelCatalogo} siembra con {@code ON CONFLICT
 * (municipalidad_id, codigo) DO NOTHING}, asi que mover una opcion de modulo <b>no llega</b> a
 * ninguna base ya sembrada —la fila de {@code acceso} se queda con su {@code modulo_id} viejo— y
 * retirarla es {@code identidad}#16, que en {@code prod} dejo la replica de {@code rentas} parada
 * 20 horas ({@code identidad}#21). Las cinco lecturas la siguen admitiendo por {@code oTambien},
 * asi que quien solo tiene {@code parametros} sigue leyendo lo que leia.
 *
 * <p>El nombre y el modulo estan transcritos de {@code
 * rentas/docs/10-negocio/catalogo-de-opciones.md}, que sigue siendo la fuente del manual. Se copian
 * y no se derivan por lo dicho arriba, y por eso la prueba compara <b>codigos</b>: es lo unico que
 * este sistema puede comprobar por si mismo.
 *
 * <p>Es una clase de dominio: sin Spring, sin base de datos y sin reloj (regla 7).
 */
public final class CatalogoDelSistema {

    private CatalogoDelSistema() {}

    /** Una opcion del menu, con el modulo al que pertenece. */
    public record Opcion(String moduloCodigo, String moduloNombre, String codigo, String nombre) {}

    private static final List<Opcion> OPCIONES =
            List.of(
                    new Opcion("SEGURIDAD", "Seguridad", "parametros", "Parametros del sistema"),
                    new Opcion("NORMATIVA", "Normativa", "conjuntos", "Conjuntos de parametros"));

    /** Las opciones de este sistema, en el orden del catalogo del manual. */
    public static List<Opcion> opciones() {
        return OPCIONES;
    }
}
