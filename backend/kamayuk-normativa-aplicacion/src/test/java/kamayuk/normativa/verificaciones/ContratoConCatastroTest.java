package kamayuk.normativa.verificaciones;

import java.util.Map;
import kamayuk.comun.verificaciones.contrato.ContratoConElConsumidorTestBase;
import org.junit.jupiter.api.DisplayName;

/**
 * {@code normativa} sigue cumpliendo lo que {@code catastro} espera de el (ADR-0030 §4).
 *
 * <p>El contrato lo publica {@code catastro} —{@code
 * catastro/docs/50-api/contratos-que-consume/normativa.json}— derivado de lo que {@code
 * ClienteHttpDeNormativa} pide y lee de verdad.
 *
 * <p><b>El snapshot se declara como cuerpo escrito a mano.</b> {@code SnapshotController.snapshot}
 * devuelve {@code ResponseEntity<String>} porque calcula su propio {@code ETag} con el sha256 del
 * cuerpo, asi que su tipo de retorno es «texto» y no describe nada: sin declarar aqui que lo que
 * escribe es {@code SnapshotResource}, esta comprobacion pasaria en verde sin haber mirado ni un
 * campo — y el snapshot es la respuesta con mas campos de las cuatro fronteras.
 *
 * <p>Lo que esta comprobacion NO puede ver, y conviene tenerlo escrito: el consumidor verifica la
 * huella, asi que el cuerpo tiene que ser <b>byte a byte</b> el que se sello. Reordenar las claves
 * de {@code SnapshotResource} rompe la descarga sin cambiar un solo campo, y eso ninguna
 * comparacion de formas lo ve.
 */
@DisplayName("Contrato con catastro (normativa es el proveedor)")
class ContratoConCatastroTest extends ContratoConElConsumidorTestBase {

    @Override
    protected String consumidor() {
        return "catastro";
    }

    @Override
    protected String proveedor() {
        return "normativa";
    }

    @Override
    protected Map<String, Class<?>> respuestasSerializadasAMano() {
        return Map.of(
                "GET /conjuntos/{id}/snapshot",
                kamayuk.normativa.parametros.infraestructura.web.SnapshotController.SnapshotResource
                        .class);
    }
}
