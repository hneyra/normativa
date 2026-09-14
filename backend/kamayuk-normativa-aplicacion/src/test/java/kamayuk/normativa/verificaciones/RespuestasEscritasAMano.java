package kamayuk.normativa.verificaciones;

import java.util.Map;
import kamayuk.normativa.parametros.infraestructura.web.SnapshotController;

/**
 * Las operaciones de este backend que serializan su cuerpo A MANO, con el tipo que escriben de
 * verdad.
 *
 * <p>Hoy es una: {@code GET /conjuntos/{id}/snapshot} devuelve {@code ResponseEntity<String>}
 * porque el {@code ETag} es el {@code sha256} de los bytes que se sirven, y para calcularlo hay que
 * tener los bytes antes de que Spring los escriba ({@code SnapshotController.snapshot}). Su tipo de
 * retorno dice «texto» y no describe nada; lo que escribe es {@link
 * SnapshotController.SnapshotResource}.
 *
 * <p><b>Vive aparte, y una sola vez, porque la leen tres pruebas</b>: {@link FormasDeLaApiTest},
 * que publica la forma en {@code docs/50-api/formas-de-la-api.json}, y los dos contratos del
 * proveedor —{@link ContratoConRentasTest} y {@link ContratoConCatastroTest}—, que comparan esa
 * misma forma con lo que cada consumidor lee. Hasta #49 los dos contratos llevaban cada uno su
 * copia del mapa; con una tercera, tres copias de lo mismo empiezan iguales y acaban discrepando, y
 * entonces el archivo publicado y el contrato describen el snapshot con dos tipos distintos.
 *
 * <p>Lo que impide que esto sea una puerta para sustituir una forma real por otra lo comprueba
 * {@link FormasDeLaApiTest#lasRespuestasEscritasAManoSonLegitimas()}: cada entrada tiene que ser
 * una operacion publicada que devuelva {@code ResponseEntity<String>}, y toda operacion publicada
 * cuya forma sea «texto» tiene que estar aqui.
 */
final class RespuestasEscritasAMano {

    private RespuestasEscritasAMano() {}

    static final Map<String, Class<?>> DE_ESTE_BACKEND =
            Map.of("GET /conjuntos/{id}/snapshot", SnapshotController.SnapshotResource.class);
}
