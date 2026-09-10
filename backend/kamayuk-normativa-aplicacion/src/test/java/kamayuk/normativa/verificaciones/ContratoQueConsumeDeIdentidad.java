package kamayuk.normativa.verificaciones;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import kamayuk.comun.verificaciones.contrato.ContratoDelConsumidor;
import kamayuk.comun.verificaciones.contrato.ContratoQueSePublicaTestBase;
import kamayuk.normativa.seguridad.infraestructura.consumidor.ClienteHttpDelBuzonDeIdentidad;
import org.junit.jupiter.api.DisplayName;

/**
 * Lo que {@code normativa} le pide a {@code identidad}, publicado para que su CI lo compruebe
 * (etapa 4 de ADR-0039, AC-4 de {@code identidad#4}).
 *
 * <h2>El PRIMER contrato de esta direccion</h2>
 *
 * <p>Hasta la etapa 4 este repositorio solo era PROVEEDOR: {@code ContratoConRentasTest} y {@code
 * ContratoConCatastroTest} leen lo que aquellos esperan de este backend. Este archivo es la primera
 * vez que {@code normativa} <b>pide</b> algo a otro sistema, y por eso ADR-0025 —«no llama a ningun
 * otro sistema»— hay que leerlo con ADR-0039 §«Lo que cuesta» al lado: lo que se pide no es un dato
 * de negocio sino la copia local de la autorizacion.
 *
 * <h2>Lo que se declara es lo que se LEE y lo que se MANDA, no lo que el proveedor publica</h2>
 *
 * <p>Un campo declarado es un campo que {@code identidad} no puede retirar sin poner rojo su build.
 * Se declaran los siete del hecho porque {@link ClienteHttpDelBuzonDeIdentidad} los lee los siete y
 * {@code CopiaLocalDeLaAutorizacionJdbc} los escribe en sus dos tablas; y se declara {@code quedan}
 * porque la vuelta lo imprime. Del acuse se declaran los tres campos de la respuesta aunque hoy
 * solo se mire el estado HTTP: son la constancia que quien atienda un 422 necesita leer, y
 * comprometerlos cuesta lo que cuesta un {@code record} de tres enteros.
 *
 * <h2>El cuerpo del hecho es TEXTO con JSON dentro, y asi se declara</h2>
 *
 * <p>{@code cuerpo} viaja como cadena —{@code EventoResource.cuerpo} es {@code String}— y este lado
 * lo parsea aparte. Declararlo como objeto pondria rojo el CI del proveedor por un campo que
 * publica bien; y es lo que permite guardar tal cual, en {@code identidad_evento_muerto}, un cuerpo
 * que no sea JSON.
 */
@DisplayName("Contrato que normativa consume de identidad")
public class ContratoQueConsumeDeIdentidad extends ContratoQueSePublicaTestBase {

    /** Un hecho del buzon, tal como lo lee {@code ClienteHttpDelBuzonDeIdentidad.leer}. */
    public static final Map<String, Object> EVENTO =
            ordenados(
                    Map.entry("eventoId", "texto"),
                    Map.entry("secuencia", "entero"),
                    Map.entry("tipo", "texto"),
                    Map.entry("sujetoId", "entero"),
                    Map.entry("cuerpo", "texto"),
                    Map.entry("huella", "texto"),
                    Map.entry("creadoEn", "texto"));

    /** Una pagina del buzon. */
    public static final Map<String, Object> LOTE =
            ordenados(Map.entry("eventos", List.of(EVENTO)), Map.entry("quedan", "entero"));

    /** El acuse, tal como se manda. */
    public static final Map<String, Object> PETICION_DE_ACUSE =
            ordenados(Map.entry("eventos", List.of("texto")));

    /** Lo que vuelve del acuse. */
    public static final Map<String, Object> RESULTADO_DEL_ACUSE =
            ordenados(
                    Map.entry("recibidos", "entero"),
                    Map.entry("escritos", "entero"),
                    Map.entry("quedan", "entero"));

    @Override
    public ContratoDelConsumidor contrato() {
        Map<String, ContratoDelConsumidor.OperacionEsperada> operaciones = new LinkedHashMap<>();

        // Lo pendiente para este consumidor, en orden de secuencia. `limite` viaja en la URL.
        operaciones.put(
                "GET /eventos/pendientes",
                ContratoDelConsumidor.OperacionEsperada.lectura(Set.of("limite"), LOTE));

        // El acuse: lo unico que este sistema ESCRIBE en otro. Su respuesta se declara porque
        // se lee cuando algo sale mal.
        operaciones.put(
                "POST /eventos/acuses",
                new ContratoDelConsumidor.OperacionEsperada(
                        Set.of(), RESULTADO_DEL_ACUSE, PETICION_DE_ACUSE));

        return new ContratoDelConsumidor(
                "normativa",
                "identidad",
                ClienteHttpDelBuzonDeIdentidad.RAIZ_DE_LA_API,
                operaciones);
    }

    @SafeVarargs
    private static Map<String, Object> ordenados(Map.Entry<String, Object>... campos) {
        Map<String, Object> mapa = new LinkedHashMap<>();
        for (Map.Entry<String, Object> campo : campos) {
            mapa.put(campo.getKey(), campo.getValue());
        }
        // `unmodifiableMap` sobre un `LinkedHashMap`, no `Map.copyOf`: este mapa se serializa al
        // archivo comprometido, y el orden de `Map.copyOf` no esta especificado.
        return Collections.unmodifiableMap(mapa);
    }
}
