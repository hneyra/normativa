package kamayuk.normativa.verificaciones;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import kamayuk.comun.verificaciones.ConfiguracionDeLasVerificaciones;

/**
 * Lo que `normativa` declara de si mismo a las barreras de {@code comun-verificaciones}.
 *
 * <p>La descubre {@link java.util.ServiceLoader}: el descriptor esta en {@code
 * src/test/resources/META-INF/services/}. Si se borra, las barreras <b>no corren en silencio</b> —
 * fallan nombrando lo que falta, que es lo que este mecanismo compra frente a pasar la
 * configuracion por constructor.
 *
 * <p>Desde P5B este repositorio SI tiene negocio —el contexto acotado `parametros` y la libreria de
 * reglas—, asi que la exencion {@code sinContextosAcotadosTodavia()} que P3 dejo puesta se retiro.
 * Caducaba sola: las barreras exigian que en efecto no hubiera NADA en {@code ..dominio..}, y la
 * primera clase que llego las habria puesto en rojo pidiendo justo eso.
 */
public final class ConfiguracionDeNormativa implements ConfiguracionDeLasVerificaciones {

    /**
     * El reparto de tablas de GOB-05 §2, ENTERO y no solo el de este sistema.
     *
     * <p>La regla {@code NINGUN_SQL_CRUZA_LA_FRONTERA_DE_normativa} necesita saber de quien es la
     * tabla ajena para poder decir a que frontera pertenece el cruce; con solo las propias, una
     * consulta a {@code predio} desde {@code caja} seria «una tabla que nadie repartio» y pasaria
     * sin ruido.
     *
     * <p>Las transversales y las de seguridad se replican en los cuatro (§2.5 y §2.6), y por eso
     * van con {@link #SISTEMA_REPLICADO}: leerlas nunca es cruzar nada.
     */
    private static final Set<String> DE_RENTAS =
            Set.of(
                    "acta_fiscalizacion",
                    "acto_coactivo",
                    "anuncio",
                    "anuncio_correlativo",
                    "anuncio_movimiento",
                    "beneficio",
                    "certificado",
                    "certificado_correlativo",
                    "ciiu",
                    "codigo_infraccion",
                    "constancia_libre",
                    "contacto",
                    "contribuyente",
                    "convenio",
                    "convenio_correlativo",
                    "convenio_cuota",
                    "convenio_deuda",
                    "convenio_movimiento",
                    "corrida_predial",
                    "corrida_predial_observado",
                    "costa_obligacion",
                    "costa_procesal",
                    "cuenta_corriente_asiento",
                    "cuenta_corriente_asiento_2026",
                    "cuenta_corriente_asiento_2027",
                    "declaracion_jurada",
                    "descargo",
                    "determinacion",
                    "determinacion_2026",
                    "determinacion_2027",
                    "determinacion_arbitrio",
                    "determinacion_arbitrio_2026",
                    "determinacion_arbitrio_2027",
                    "determinacion_predio_detalle",
                    "determinacion_predio_detalle_2026",
                    "determinacion_predio_detalle_2027",
                    "dj_correlativo",
                    "domicilio",
                    "edificacion_correlativo",
                    "edificacion_estructura",
                    "edificacion_movimiento",
                    "edificacion_profesional",
                    "edificacion_proyecto",
                    "edificacion_requisito",
                    "edificacion_terreno",
                    "edificacion_vigencia",
                    "espectaculo",
                    "expediente_coactivo",
                    "expediente_correlativo",
                    "expediente_movimiento",
                    "expediente_valor",
                    "internamiento",
                    "internamiento_movimiento",
                    "licencia_correlativo",
                    "licencia_duplicado",
                    "licencia_edificacion",
                    "licencia_funcionamiento",
                    "licencia_giro",
                    "licencia_movimiento",
                    "liquidacion_correlativo",
                    "liquidacion_costas",
                    "liquidacion_costas_correlativo",
                    "liquidacion_detalle",
                    "liquidacion_fiscalizacion",
                    "liquidacion_movimiento",
                    "notificacion",
                    "notificacion_administrativa",
                    "papeleta",
                    "papeleta_cambio_numero",
                    "papeleta_masivo",
                    "papeleta_masivo_item",
                    "prescripcion",
                    "prescripcion_ejercicio",
                    "prescripcion_hecho",
                    "programa_fiscalizacion",
                    "programa_muestra",
                    "resolucion_determinacion",
                    "resolucion_gerencia",
                    "responsable_solidario",
                    "saldo_proyectado",
                    "transferencia",
                    "valor",
                    "valor_correlativo",
                    "valor_detalle",
                    "valor_masivo",
                    "valor_masivo_item",
                    "valor_movimiento",
                    "vehiculo");

    private static final Set<String> DE_CATASTRO =
            Set.of(
                    "actividad_economica",
                    "arancel",
                    "bien_comun",
                    "colindante_rural",
                    "construccion",
                    "ficha_catastral",
                    // V6: el frente del predio. Se nombra aunque este sistema no la tenga —y por
                    // eso
                    // mismo—: sin la entrada, el reparto la da por «replicada» y el escaner de la
                    // regla 11 DEJA DE MIRAR un cruce contra ella, en verde (la leccion de R-N).
                    "frente_predio",
                    "inquilino",
                    "manzana",
                    "otra_instalacion",
                    "participacion_comun",
                    "predio",
                    "sector",
                    "tierra_rural",
                    "titularidad",
                    "via");

    private static final Set<String> DE_NORMATIVA =
            Set.of(
                    "conjunto_parametro_detalle",
                    "conjunto_parametros",
                    "depreciacion",
                    "parametro_tributario",
                    "valor_referencial_vehiculo",
                    "valor_unitario_edificacion");

    private static final Set<String> DE_CAJA =
            Set.of(
                    "area",
                    "caja",
                    "cierre_caja",
                    "cierre_turno",
                    "cierre_turno_detalle",
                    "recibo",
                    "recibo_correlativo",
                    "recibo_detalle",
                    "recibo_movimiento",
                    "tasa");

    private static final Set<String> REPLICADAS =
            Set.of(
                    "acceso",
                    "auditoria",
                    "auditoria_2026",
                    "auditoria_2027",
                    "documento_emitido",
                    "grupo",
                    "miembro",
                    "modulo_sistema",
                    "municipalidad",
                    "permiso",
                    "respaldo",
                    "sesion",
                    "usuario");

    @Override
    public String paqueteRaiz() {
        return "kamayuk.normativa";
    }

    @Override
    public String sistema() {
        return "normativa";
    }

    @Override
    public String raizDeLaApi() {
        return kamayuk.normativa.web.Api.RAIZ;
    }

    @Override
    public Map<String, String> sistemaDeCadaTabla() {
        Map<String, String> reparto = new HashMap<>();
        DE_RENTAS.forEach(t -> reparto.put(t, "rentas"));
        DE_CATASTRO.forEach(t -> reparto.put(t, "catastro"));
        DE_NORMATIVA.forEach(t -> reparto.put(t, "normativa"));
        DE_CAJA.forEach(t -> reparto.put(t, "caja"));
        REPLICADAS.forEach(t -> reparto.put(t, SISTEMA_REPLICADO));
        return Map.copyOf(reparto);
    }

    /**
     * Vacia, y tiene que estarlo: sin codigo no puede haber ningun cruce que consentir.
     *
     * <p>{@code FronteraDeSistemaTest} lo comprueba. Cuando P5 traiga las clases del monolito, los
     * cruces que le tocan a este sistema entran aqui con su issue —los de {@code sgtm} estan en
     * {@code CrucesConsentidosDelSgtm}, con quien los cierra—, y en P5E esta lista tiene que volver
     * a quedar vacia.
     */
    @Override
    public List<CruceConsentido> crucesConsentidos() {
        return List.of();
    }

    /**
     * RNF-051: de aqui no se borra. Las seis tablas de este sistema mas la auditoria.
     *
     * <p>Las tres de valuacion y las dos del conjunto entran aunque {@code kamayuk_app} ya no tenga
     * {@code DELETE} sobre ellas, y no es redundancia: son <b>dos guardas independientes</b> y
     * basta una para parar la escritura, pero solo el escaner dice <i>cual</i> —el privilegio y la
     * politica dan el mismo {@code 42501} y el sintoma no los distingue (#435)—. Que la lista este
     * escrita aqui es lo que hace que un {@code DELETE FROM depreciacion} en {@code src/main} rompa
     * el build antes de llegar al motor.
     */
    @Override
    public Set<String> tablasProtegidas() {
        return Set.of(
                "parametro_tributario",
                "conjunto_parametros",
                "conjunto_parametro_detalle",
                "valor_unitario_edificacion",
                "depreciacion",
                "valor_referencial_vehiculo",
                "auditoria");
    }

    /**
     * Ademas de no borrarse, no se actualizan.
     *
     * <p>La auditoria por ADR-0008 —quien puede modificarla puede borrar su rastro—, y los tres
     * cuadros nacionales porque una celda publicada no se corrige en el sitio: se publica otra
     * edicion y el conjunto elige cual compone (ADR-0007, ADR-0017).
     *
     * <p><b>{@code parametro_tributario} y {@code conjunto_parametros} NO estan aqui, y no es un
     * olvido</b>: los dos reciben un {@code UPDATE} legitimo del codigo de produccion —la segunda
     * firma de ADR-0007 sobre la edicion, y el sellado sobre el conjunto— y el disparador de {@code
     * V9} es quien impide que ese {@code UPDATE} toque algo ya sellado. Meterlos aqui pondria el
     * build en rojo por el acto que este sistema existe para ejecutar.
     */
    @Override
    public Set<String> tablasInmutables() {
        return Set.of(
                "auditoria",
                "valor_unitario_edificacion",
                "depreciacion",
                "valor_referencial_vehiculo");
    }

    /** Ninguna: aqui no se compone ningun area a mano, porque no hay predios que medir (#607). */
    @Override
    public Set<String> componenElAreaAManoConMotivo() {
        return Set.of();
    }

    /**
     * Los paquetes que este sistema declara suyos.
     *
     * <p>No es una formalidad. Sin nombrarlos, «hay clases que revisar» se conforma con que haya
     * <b>algo</b>, y el dia que {@code kamayuk-normativa-aplicacion} dejara de depender de un
     * modulo —una linea del {@code build.gradle.kts}— ArchUnit no lo veria y las reglas pasarian en
     * verde sin haber mirado ese modulo.
     *
     * <p>{@code kamayuk.normativa.esquema} <b>no</b> esta, y es deliberado: el migrador no esta en
     * el classpath de este modulo, y no debe estarlo —la aplicacion no migra al arrancar (ARQ-03
     * §4)—.
     */
    @Override
    public Set<String> paquetesQueTienenQueExistir() {
        return Set.of(
                "kamayuk.normativa.compartido",
                "kamayuk.normativa.dominio",
                "kamayuk.normativa.plataforma.tenant",
                "kamayuk.normativa.reglas",
                "kamayuk.normativa.parametros.dominio",
                "kamayuk.normativa.parametros.aplicacion",
                "kamayuk.normativa.parametros.infraestructura");
    }

    /**
     * El minimo existe para que el escaner no pase sin revisar nada, asi que tiene que ser un
     * numero de verdad: si manana desapareciera medio repositorio, el escaner lo diria en vez de
     * quedarse en verde. Medido tras P5B y redondeado a la baja.
     */
    @Override
    public int minimoDeFuentesDeProduccion() {
        return 120;
    }

    /** Mismo motivo que el minimo de arriba, medido y redondeado a la baja. */
    @Override
    public int minimoDePruebas() {
        return 40;
    }

    /**
     * Los dos ambitos que solo existen en {@code rentas}, declarados ausentes.
     *
     * <p>Sin esto, las dos reglas acotadas a ellos —la frontera de {@code fiscalizacion} y el panel
     * de recaudacion— correrian con {@code allowEmptyShould(true)} y nadie miraria. La declaracion
     * NO las apaga: {@code ArquitecturaTestBase} exige que el ambito declarado ausente lo este de
     * verdad, asi que el dia que aparezca una clase suya la prueba se pone roja.
     */
    @Override
    public Set<String> ambitosAusentes() {
        return Set.of("fiscalizacion", "indicadores");
    }
}
