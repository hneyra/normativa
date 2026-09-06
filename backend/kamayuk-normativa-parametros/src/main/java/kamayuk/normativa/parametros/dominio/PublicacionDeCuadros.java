package kamayuk.normativa.parametros.dominio;

import java.util.Optional;
import kamayuk.normativa.dominio.Alicuota;
import kamayuk.normativa.dominio.Dinero;
import kamayuk.normativa.dominio.ValorNormativo;
import org.jspecify.annotations.Nullable;

/**
 * Puerto de publicacion de los <b>cuadros normativos nacionales</b>: las tablas que no caben en una
 * fila de {@code parametro_tributario} porque tienen miles (D-13, ADR-0017).
 *
 * <h2>Que es una edicion</h2>
 *
 * <p>Una edicion es la resolucion entera —«la Tabla de Valores Referenciales del ejercicio 2026»—,
 * y se representa como <b>una fila de {@code parametro_tributario}</b>: su tipo, su clave, su
 * documento fuente y las dos firmas de ADR-0007. Las miles de filas del cuadro cuelgan de ella por
 * {@code publicacion_id}.
 *
 * <p>Eso es lo que permite que un conjunto municipal la congele <b>sin ningun mecanismo nuevo</b>:
 * componer la edicion en un conjunto es la misma fila de {@code conjunto_parametro_detalle} con la
 * que ya se compone la UIT, y V9 la vuelve inmutable en cuanto el conjunto se sella.
 *
 * <h2>Por que hay un {@code cerrar}</h2>
 *
 * <p>Porque componer congela <b>que</b> edicion se uso, no <b>cuantas filas</b> tenia. Sin cerrar,
 * una edicion ya sellada en el conjunto de una municipalidad podria recibir filas nuevas y el
 * recalculo de 2037 leeria un cuadro mas grande que el que se emitio, sin ningun error de por
 * medio. {@code cerrar} marca {@code parametro_tributario.sellado}, y el disparador de V55 rechaza
 * desde entonces cualquier fila mas.
 *
 * <p>Corregir una edicion cerrada no es editarla: es publicar otra, con su documento fuente y sus
 * dos firmas, y componerla en un conjunto nuevo (ADR-0007).
 *
 * <h2>Quien lo implementa</h2>
 *
 * <p>Solo el perfil {@code batch}, por lo mismo que {@link PublicacionDeParametros}: la unica
 * credencial que puede escribir estas tres tablas es {@code rol_carga_parametros} (V55), y esa
 * credencial la lleva un Job de un solo uso, no el proceso que atiende peticiones.
 */
public interface PublicacionDeCuadros {

    /** La edicion ya publicada con esa llave, si la hay, con su estado. */
    Optional<Edicion> edicionPublicada(LlaveDeParametro llave);

    /**
     * Abre una edicion: escribe su cabecera en {@code parametro_tributario} y devuelve su
     * identificador. Las dos firmas son las del corpus, y la base exige que sean distintas ({@code
     * parametro_doble_verificacion_ck}).
     */
    long abrirEdicion(ParametroTributario cabecera, String transcribio, String verifico);

    /**
     * Una fila del cuadro de depreciacion del Anexo I del Reglamento Nacional de Tasaciones.
     *
     * @param uso la tabla del Anexo I —{@code 01}..{@code 04}—, con el numero de la propia norma
     * @param antiguedadHasta el tope del tramo en anios; <b>nulo</b> es «mas de 50 anios», el tramo
     *     abierto con que cierra cada tabla. Un centinela seria una cifra inventada dentro de un
     *     cuadro normativo, y ademas una que se lee igual que un tope de verdad (V57)
     */
    void agregarDepreciacion(
            long edicion,
            String uso,
            String material,
            String estadoConservacion,
            @Nullable Integer antiguedadHasta,
            Alicuota porcentaje,
            String documentoFuente);

    /**
     * Una celda del Cuadro de Valores Unitarios Oficiales de Edificacion (H-14, catastro#8).
     *
     * <p><b>Una region por edicion.</b> {@code valor_unitario_edificacion} no tiene columna de
     * region y su unicidad es {@code (publicacion_id, partida, categoria,
     * anio_construccion_desde)}: las cuatro regiones del Anexo I chocarian celda con celda dentro
     * de una misma edicion. Con ADR-0017 eso no es una limitacion sino la forma —cada region es una
     * edicion distinta y el conjunto de una municipalidad compone la suya—, y por eso este metodo
     * no recibe la region: la lleva la CABECERA de la edicion, en su clave.
     *
     * @param partida una de las tres de apreciacion exterior: {@code MUROS}, {@code TECHOS} o
     *     {@code PUERTAS} (V59). No son las siete de {@code construccion.categoria_*}, que son el
     *     formulario de la ficha catastral y otra cosa
     * @param categoria la letra del cuadro, {@code A}..{@code J}. La {@code J} solo existe en el
     *     Anexo I.4 (Selva) y solo en muros y columnas (V58)
     * @param anioConstruccionHasta el tope del tramo de ano de construccion; <b>nulo</b> es el
     *     tramo abierto. El Anexo I <b>no</b> tiene dimension de ano de construccion —H-4 se
     *     contesto leyendolo: es {@code categoria x partida}, y el ano entra en la tabla de
     *     depreciacion— asi que hoy toda celda llega con un tramo unico y sin tope
     */
    void agregarValorUnitario(
            long edicion,
            String partida,
            String categoria,
            int anioConstruccionDesde,
            @Nullable Integer anioConstruccionHasta,
            ValorNormativo valorM2,
            String documentoFuente);

    /** Una fila del cuadro de valores referenciales de vehiculos. */
    void agregarValorReferencial(
            long edicion,
            int ejercicio,
            String categoria,
            String marca,
            String modelo,
            int anioFabricacion,
            Dinero valor,
            String documentoFuente);

    /** Cierra la edicion: desde aqui no admite una fila mas. */
    void cerrar(long edicion);

    /**
     * Una edicion publicada.
     *
     * @param id su identificador, que es el del {@code parametro_tributario} que la encabeza
     * @param cerrada si ya no admite filas
     */
    record Edicion(long id, boolean cerrada) {}
}
