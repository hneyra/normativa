package kamayuk.normativa.seguridad.infraestructura.consumidor;

/**
 * De donde sale el {@code Authorization} con el que este sistema le pide el buzon a {@code
 * identidad} (ADR-0028 §2, {@code infrastructure}#21).
 *
 * <p>Existe para que {@link ClienteHttpDelBuzonDeIdentidad} no sepa <b>como</b> se consigue. Lo que
 * se configura es la <b>clave con la que se pide el token</b> —la de la cuenta de servicio {@code
 * kamayuk-normativa-servicio-<ubigeo>}— y quien lo pide y lo guarda es {@link
 * TokenDeServicioDeKeycloak}. Copiado de {@code rentas} con su motivo: hasta #21 lo que aquel
 * ingestor mandaba era una cadena configurada que ningun emisor firmo, y el destino la rechazaba
 * con 401.
 *
 * <p><b>Devuelve la cabecera entera, con su esquema.</b> Devolver solo el token dejaria el {@code
 * "Bearer "} escrito en el cliente HTTP.
 */
@FunctionalInterface
public interface CredencialDeServicio {

    /** La cabecera {@code Authorization}, o cadena vacia si este despliegue no tiene ninguna. */
    String cabecera();

    /** Una credencial fija, para las pruebas. */
    static CredencialDeServicio fija(String cabecera) {
        return () -> cabecera;
    }
}
