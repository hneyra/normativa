package kamayuk.normativa.parametros.infraestructura.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.autorizacion.RequiereAcceso;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.parametros.FaltaPublicar;
import kamayuk.normativa.parametros.aplicacion.ComponerSnapshot;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto;
import kamayuk.normativa.reglas.Ambito;
import kamayuk.normativa.reglas.IdentificadorDeConjunto;
import kamayuk.normativa.reglas.LectorDeParametros;
import kamayuk.normativa.web.Api;
import kamayuk.normativa.web.CodigoDeError;
import kamayuk.normativa.web.ProblemaDeNegocio;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * El conjunto sellado, entero y descargable: la mitad de ADR-0025 que viaja como <b>datos</b>.
 *
 * <h2>Las dos rutas, y por que son dos</h2>
 *
 * <ul>
 *   <li>{@code GET /conjuntos?ejercicio=2026} resuelve <b>cual</b> rige hoy. Es lo que se pregunta
 *       al abrir una corrida nueva.
 *   <li>{@code GET /conjuntos/{id}/snapshot} entrega <b>ese</b> conjunto. Es lo que se pregunta al
 *       recalcular, y es la unica de las dos que un cliente con cache no necesita volver a pedir.
 * </ul>
 *
 * <p>Separarlas es lo que permite que {@code rentas} recalcule con {@code normativa} apagada: el
 * recalculo parte del {@code conjuntoId} que la determinacion guardo (ADR-0025 §3) y ese conjunto
 * ya esta en su cache. Si la resolucion y la descarga fueran una sola ruta, todo recalculo pasaria
 * por la red.
 *
 * <h2>{@code Cache-Control: immutable}, y por que aqui no es optimista</h2>
 *
 * <p>Un conjunto sellado no cambia: el disparador de {@code V9} lo vuelve inmutable a el y a su
 * contenido en cuanto se sella. Asi que la respuesta se puede guardar <b>para siempre</b> sin
 * invalidacion, sin ventana de inconsistencia y sin TTL. Lo que hace legitima esa promesa no es
 * esta cabecera sino el disparador; la cabecera solo la dice.
 *
 * <h2>La huella, y que es exactamente</h2>
 *
 * <p>El {@code ETag} es el {@code sha256} <b>de los bytes que se sirven</b>, y el mismo valor viaja
 * dentro del cuerpo. Es de los bytes y no de una serializacion canonica aparte a proposito: una
 * canonica exigiria dos implementaciones que tienen que coincidir —una aqui y otra en cada
 * consumidor—, y dos algoritmos que deben dar lo mismo son dos que un dia dejan de darlo. Con los
 * bytes, el cliente hace {@code sha256(cuerpo)} y compara; no hay nada que mantener sincronizado.
 *
 * <p>Lo que eso obliga es a serializar de forma <b>determinista</b>, y por eso las tres consultas
 * de los cuadros llevan un {@code ORDER BY} total: si el orden de las filas dependiera del plan, el
 * {@code ETag} cambiaria sin que cambiara el conjunto, que es el defecto que ADR-0025
 * §Consecuencias manda probar. Hay una prueba que pide dos veces y compara.
 */
@RestController
@RequestMapping(Api.RAIZ + "/conjuntos")
public class SnapshotController {

    private final ComponerSnapshot componer;
    private final JsonMapper json;

    public SnapshotController(ComponerSnapshot componer, JsonMapper json) {
        this.componer = componer;
        this.json = json;
    }

    /**
     * Que conjunto sellado rige hoy el ejercicio.
     *
     * <p>No lleva ni una fila: es la <b>identidad</b>, que es lo unico que hace falta para saber si
     * el snapshot que ya se tiene en cache sigue siendo el bueno. Pedir el snapshot entero para
     * comprobar eso seria descargar 54 000 filas para leer un numero.
     */
    @GetMapping
    @RequiereAcceso(acceso = "parametros", privilegio = Privilegio.LECTURA)
    public ConjuntoVigenteResource vigente(@RequestParam int ejercicio) {
        try {
            // OBLIGACION y no «el mas barato»: da igual cual, porque de esta llamada solo se lee la
            // identidad y esa es la misma en los dos ambitos. Se nombra uno para no tener que
            // inventar un tercero que signifique «ninguno».
            SnapshotDelConjunto snapshot =
                    componer.vigenteDe(new Ejercicio(ejercicio), Ambito.OBLIGACION);
            return new ConjuntoVigenteResource(
                    snapshot.conjuntoId(), snapshot.ejercicio().valor(), snapshot.version());
        } catch (LectorDeParametros.EjercicioSinSellar sinSellar) {
            // 404 y no 422, por lo que #723 midio: aqui se PIDE UN DOCUMENTO —el conjunto sellado
            // de ese ejercicio— y no se intenta ejecutar ningun calculo. Y en esta misma ruta el
            // 422 ya significa otra cosa: `?ejercicio=1800` lo rechaza el constructor de Ejercicio.
            throw FaltaPublicar.noEncontrado(sinSellar);
        }
    }

    /**
     * El conjunto entero.
     *
     * <p>El {@code ambito} es <b>obligatorio</b> y no tiene valor por omision. Un «todo» implicito
     * seria el snapshot mas grande servido a quien no lo pidio, con otra huella, y con la mitad de
     * sus filas sin consumidor; y un ambito por omision hace que olvidarlo no se note. Quien
     * necesite las dos mitades —hoy {@code rentas}, que todavia lleva {@code catastro} dentro— pide
     * <b>dos</b> snapshots del <b>mismo</b> conjunto: la identidad es la misma y es lo que las dos
     * corridas comparan (ADR-0025 §Consecuencias).
     *
     * @param ambito {@code VALUACION} para los dos cuadros que la valuacion necesita, {@code
     *     OBLIGACION} para los valores referenciales. Los parametros van en los dos
     */
    @GetMapping("/{id}/snapshot")
    @RequiereAcceso(acceso = "parametros", privilegio = Privilegio.LECTURA)
    public ResponseEntity<String> snapshot(@PathVariable long id, @RequestParam String ambito) {

        SnapshotDelConjunto snapshot;
        try {
            snapshot = componer.porConjunto(IdentificadorDeConjunto.de(id), ambitoDe(ambito));
        } catch (LectorDeParametros.ConjuntoNoSellado noSellado) {
            // Un conjunto abierto no se sirve, y decir «no esta» seria mentir: existe y todavia se
            // puede corregir. `ConjuntoNoSellado` no implementa ParametroSinPublicar —lo que falta
            // no es una cifra— asi que va como 404 sin discriminador, con su propio mensaje.
            throw new ProblemaDeNegocio(
                    CodigoDeError.NO_ENCONTRADO, String.valueOf(noSellado.getMessage()));
        }

        String cuerpo = serializar(snapshot);
        String huella = sha256(cuerpo);

        return ResponseEntity.ok()
                .eTag("\"" + huella + "\"")
                // Un ano es el maximo que la especificacion admite; `immutable` es lo que dice que
                // no hace falta revalidar nunca. Las dos juntas, porque los intermediarios viejos
                // no entienden `immutable` y se quedan con el maximo.
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
                .contentType(MediaType.APPLICATION_JSON)
                .body(cuerpo);
    }

    /**
     * El ambito pedido, sin lectura tolerante.
     *
     * <p>{@code ?ambito=valuacion} en minusculas se rechaza nombrandolo, y no se normaliza: es la
     * misma decision que #542 tomo con el tipo de transferencia y #427 con «ACTIVA». Aceptarlo
     * devolveria un snapshot con otra huella que el cliente creeria correcto.
     */
    private static Ambito ambitoDe(String ambito) {
        try {
            return Ambito.valueOf(ambito);
        } catch (IllegalArgumentException noEsDelEnumerado) {
            throw new AmbitoDesconocido(ambito, noEsDelEnumerado);
        }
    }

    private String serializar(SnapshotDelConjunto snapshot) {
        try {
            return json.writeValueAsString(SnapshotResource.de(snapshot));
        } catch (JacksonException noSePudo) {
            throw new IllegalStateException(
                    "No se pudo serializar el snapshot del conjunto " + snapshot.conjuntoId(),
                    noSePudo);
        }
    }

    private static String sha256(String cuerpo) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(cuerpo.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException imposible) {
            throw new IllegalStateException("SHA-256 es obligatorio en toda JVM", imposible);
        }
    }

    /** Que conjunto rige, sin una sola fila. */
    public record ConjuntoVigenteResource(long conjuntoId, int ejercicio, int version) {}

    /**
     * El cuerpo del snapshot.
     *
     * <p><b>No lleva el {@code sha256} dentro</b>, y no es un olvido: la huella es de estos mismos
     * bytes, asi que meterla aqui seria pedirle a un valor que se contenga a si mismo. Va en el
     * {@code ETag}; el cliente calcula {@code sha256(cuerpo)}, compara, y guarda el resultado con
     * la fila de su cache.
     */
    public record SnapshotResource(
            long conjuntoId,
            int ejercicio,
            int version,
            String ambito,
            int filas,
            java.util.List<SnapshotDelConjunto.ParametroDelSnapshot> parametros,
            java.util.List<SnapshotDelConjunto.ValorUnitarioDelSnapshot> valoresUnitarios,
            java.util.List<SnapshotDelConjunto.DepreciacionDelSnapshot> depreciaciones,
            java.util.List<SnapshotDelConjunto.ValorReferencialDelSnapshot> valoresReferenciales) {

        static SnapshotResource de(SnapshotDelConjunto snapshot) {
            return new SnapshotResource(
                    snapshot.conjuntoId(),
                    snapshot.ejercicio().valor(),
                    snapshot.version(),
                    snapshot.ambito().name(),
                    snapshot.filas(),
                    snapshot.parametros(),
                    snapshot.valoresUnitarios(),
                    snapshot.depreciaciones(),
                    snapshot.valoresReferenciales());
        }
    }

    /** El ambito pedido no es ninguno de los dos de ADR-0024. */
    public static final class AmbitoDesconocido extends RuntimeException {
        @java.io.Serial private static final long serialVersionUID = 1L;

        AmbitoDesconocido(String pedido, Throwable causa) {
            super(
                    "El ambito «"
                            + pedido
                            + "» no existe. Los de ADR-0024 son VALUACION y OBLIGACION, y ausente"
                            + " significa todo. Leerlo como «todo» devolveria un snapshot que el"
                            + " cliente no pidio y con otra huella",
                    causa);
        }
    }
}
