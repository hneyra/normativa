package kamayuk.normativa.parametros.aplicacion;

import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.parametros.dominio.ClaveDeIdempotencia;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.DeclaracionDelArancel;
import kamayuk.normativa.parametros.dominio.LlaveDeParametro;
import kamayuk.normativa.web.CodigoDeError;
import kamayuk.normativa.web.ProblemaDeNegocio;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

/**
 * Las tres escrituras de un conjunto por HTTP —abrir, agregar y sellar— con lo que ADR-0043 §5 y §7
 * deciden para cuando dos peticiones llegan a la vez (#59).
 *
 * <h2>Por que esta clase NO es transaccional, y tiene que no serlo</h2>
 *
 * <p>Cuando dos peticiones chocan en un indice unico, PostgreSQL aborta la transaccion de la que
 * pierde: cualquier consulta que se intente despues en ella contesta {@code current transaction is
 * aborted}. Lo que ADR-0043 §5 pide —«se vuelve a buscar por clave <b>en otra transaccion</b>»—
 * solo se puede hacer desde fuera de la que fallo. Por eso cada metodo de aqui llama a un
 * {@code @Transactional} de {@link AdministrarParametros}, que es otro {@code @Service} y abre la
 * suya por el proxy, y la relectura va en <b>otra</b> llamada, de solo lectura. Es el mismo reparto
 * que {@link ImportarParametrosDelConjunto} documenta para el batch: con una transaccion
 * envolvente, lo que revienta se lleva por delante a lo que viene detras.
 *
 * <p>Y por eso tambien no lleva {@code Observacion} mas que para pasarla: la regla {@code
 * TODO_CASO_DE_USO_DE_ESCRITURA_EXIGE_OBSERVACION} vigila los metodos {@code @Transactional} de
 * escritura, y las escrituras de verdad estan en {@link AdministrarParametros}, cada una con la
 * suya.
 *
 * <h2>Lo que se traduce aqui, y nada mas</h2>
 *
 * <ul>
 *   <li><b>Abrir</b>: un {@code unique_violation} en {@code conjunto_uq} o en {@code
 *       conjunto_idempotencia_uq}. Se relee por clave: si la abrio otra peticion con el mismo
 *       ejercicio, es un reintento y contesta lo mismo; con otro, el 409 de la clave reusada; y si
 *       no existe —chocaron dos claves distintas en la misma version—, 409 diciendo que la peticion
 *       no escribio nada y se puede reenviar con la <b>misma</b> clave.
 *   <li><b>Agregar</b>: un {@code unique_violation} en {@code conjunto_detalle_pk}. Otro lo agrego
 *       a la vez: se relee y se contesta que esta dentro, sin auditar.
 * </ul>
 *
 * <p>Los dos {@code restrict_violation} —agregar a un sellado y sellar un sellado— se traducen
 * dentro de {@link AdministrarParametros}: no hace falta releer nada para contestarlos. Todo lo
 * demas sale tal cual, y el borde lo convierte en 500 con incidencia.
 */
@Service
public class EscriturasDelConjunto {

    private static final String CONJUNTO_UQ = "conjunto_uq";
    private static final String CONJUNTO_IDEMPOTENCIA_UQ = "conjunto_idempotencia_uq";
    private static final String CONJUNTO_DETALLE_PK = "conjunto_detalle_pk";

    private final AdministrarParametros administrar;

    public EscriturasDelConjunto(AdministrarParametros administrar) {
        this.administrar = administrar;
    }

    /**
     * Abre una version del ejercicio con esa clave, o devuelve la que la clave ya abrio.
     *
     * <p>La lectura previa por clave —dentro de {@link
     * AdministrarParametros#abrirVersion(Ejercicio, ClaveDeIdempotencia, Observacion)}— contesta el
     * reintento <b>sin escribir</b>. Lo que resuelve dos peticiones a la vez es el indice, y su
     * choque se atiende aqui.
     *
     * @throws ProblemaDeNegocio {@code CONFLICTO} si la clave ya abrio un conjunto de otro
     *     ejercicio, o si otra version del ejercicio se abrio a la vez con otra clave
     */
    public ConjuntoDeParametros abrir(
            Ejercicio ejercicio, ClaveDeIdempotencia clave, Observacion observacion) {
        try {
            return administrar.abrirVersion(ejercicio, clave, observacion);
        } catch (DataAccessException choque) {
            if (!CausaEnLaBase.esChoqueDeUnicidadEn(
                    choque, CONJUNTO_UQ, CONJUNTO_IDEMPOTENCIA_UQ)) {
                throw choque;
            }
            // Otra transaccion: la de la llamada anterior esta abortada y ya se deshizo.
            return administrar
                    .abiertoConLaClave(clave)
                    .map(
                            abierto ->
                                    AdministrarParametros.elQueEsaClaveAbrio(
                                            abierto, ejercicio, clave))
                    .orElseThrow(
                            () ->
                                    new ProblemaDeNegocio(
                                            CodigoDeError.CONFLICTO,
                                            "Otra version del ejercicio "
                                                    + ejercicio
                                                    + " se abrio a la vez que esta, con otra clave."
                                                    + " Esta peticion no escribio nada: se puede"
                                                    + " reenviar con la MISMA clave de idempotencia"
                                                    + " y abrira la version siguiente"));
        }
    }

    /**
     * Agrega el parametro publicado con esa llave, o contesta que ya estaba.
     *
     * @throws ProblemaDeNegocio {@code NO_ENCONTRADO} si el conjunto o la llave no existen, y
     *     {@code CONFLICTO} si hay homonimos o si el conjunto esta sellado y el parametro no esta
     *     dentro
     */
    public ParametroIncorporado agregar(
            long conjuntoId, LlaveDeParametro llave, Observacion observacion) {
        try {
            return administrar.agregarParametroPublicado(conjuntoId, llave, observacion);
        } catch (DataAccessException choque) {
            if (!CausaEnLaBase.esChoqueDeUnicidadEn(choque, CONJUNTO_DETALLE_PK)) {
                throw choque;
            }
            // Otro lo agrego entre la comprobacion y el INSERT. Lo que se pidio —que este
            // dentro— ya es verdad, y quien lo escribio lo audito.
            return administrar
                    .incorporadoConLaLlave(conjuntoId, llave)
                    .map(ParametroIncorporado::queYaEstaba)
                    .orElseThrow(() -> choque);
        }
    }

    /**
     * Sella el conjunto con la declaracion del punto 3 de «Antes de sellar».
     *
     * <p><b>Normativa no puede comprobar si el arancel esta cargado, y no lo va a comprobar: la
     * tabla es de catastro.</b> Lo que se guarda es lo que declara quien sella (ADR-0043 §8).
     *
     * @throws ProblemaDeNegocio {@code CONFLICTO} si ya esta sellado —tambien cuando otro lo sello
     *     a la vez— o si esta vacio, con mensajes distintos
     */
    public ConjuntoDeParametros sellar(
            long conjuntoId, Observacion observacion, DeclaracionDelArancel arancel) {
        return administrar.sellar(conjuntoId, observacion, arancel);
    }
}
