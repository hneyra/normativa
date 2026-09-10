package kamayuk.normativa.seguridad.infraestructura.consumidor;

import java.time.Clock;
import kamayuk.normativa.seguridad.aplicacion.AlertaDeEventosSinAplicar;
import kamayuk.normativa.seguridad.aplicacion.AplicarUnEventoDeIdentidad;
import kamayuk.normativa.seguridad.aplicacion.ConsumirEventosDeIdentidad;
import kamayuk.normativa.seguridad.aplicacion.CorrerElConsumidorDeIdentidad;
import kamayuk.normativa.seguridad.dominio.consumidor.BuzonDeIdentidad;
import kamayuk.normativa.seguridad.dominio.consumidor.CopiaLocalDeLaAutorizacion;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;

/**
 * El consumidor del buzon de {@code identidad}, cableado (etapa 4 de ADR-0039).
 *
 * <h2>Cuando existe, y cuando no</h2>
 *
 * <p>Solo en el perfil {@code batch} y solo si el despliegue dice DONDE esta el buzon ({@code
 * kamayuk.identidad.url}). Sin esa propiedad no hay consumidor: la implantacion lo dice y sigue —en
 * esta etapa la copia queda como la sembro—, y el proceso web nunca lo tiene.
 *
 * <p>El runner del {@code CronJob} exige ademas {@code kamayuk.identidad.consumidor.municipalidad}:
 * la implantacion hace su propia pasada con la municipalidad que acaba de dar de alta, y no
 * necesita un segundo runner que la repita.
 *
 * <h2>Con el pool de la aplicacion, y no con uno propio</h2>
 *
 * <p>{@code kamayuk_app} tiene {@code INSERT/SELECT/UPDATE} sobre las cuatro tablas desde el
 * baseline —es lo que ya usa el sembrador— y {@code V2} le da lo mismo sobre las dos del
 * consumidor. Un rol aparte, como el ingestor de {@code rentas}, tendria sentido si escribiera
 * tablas que la aplicacion no toca; aqui escribe justo las que la aplicacion lee para autorizar.
 */
@Configuration(proxyBeanMethods = false)
@Profile("batch")
@ConditionalOnProperty(ClienteHttpDelBuzonDeIdentidad.PROPIEDAD_DE_LA_URL)
public class ConfiguracionDelConsumidorDeIdentidad {

    @Bean
    CopiaLocalDeLaAutorizacion copiaLocalDeLaAutorizacion(JdbcClient jdbc, JsonMapper json) {
        return new CopiaLocalDeLaAutorizacionJdbc(jdbc, json);
    }

    @Bean
    AplicarUnEventoDeIdentidad aplicarUnEventoDeIdentidad(CopiaLocalDeLaAutorizacion copia) {
        return new AplicarUnEventoDeIdentidad(copia);
    }

    @Bean
    ResponsableDeLaCopiaLocal responsableDeLaCopiaLocal(
            @Value("${kamayuk.identidad.consumidor.responsable:}") String nombre,
            @Value("${kamayuk.identidad.consumidor.canal:}") String canal) {
        return new ResponsableDeLaCopiaLocal(nombre, canal);
    }

    @Bean
    AlertaDeEventosSinAplicar alertaDeEventosSinAplicar(
            JsonMapper json, ResponsableDeLaCopiaLocal responsable) {
        return new AlertaAlCanalDelResponsable(json, responsable);
    }

    @Bean
    CredencialDeServicio credencialDeServicioDeIdentidad(
            JsonMapper json,
            Clock reloj,
            @Value("${kamayuk.identidad.token:}") String punto,
            @Value("${kamayuk.identidad.cliente:}") String cliente,
            @Value("${kamayuk.identidad.credencial:}") String clave) {
        return new TokenDeServicioDeKeycloak(json, reloj, punto, cliente, clave);
    }

    @Bean
    BuzonDeIdentidad buzonDeIdentidad(
            JsonMapper json,
            @Value("${" + ClienteHttpDelBuzonDeIdentidad.PROPIEDAD_DE_LA_URL + "}") String raiz,
            CredencialDeServicio credencial) {
        return new ClienteHttpDelBuzonDeIdentidad(json, raiz, credencial);
    }

    @Bean
    ConsumirEventosDeIdentidad consumirEventosDeIdentidad(
            BuzonDeIdentidad buzon,
            AplicarUnEventoDeIdentidad aplicador,
            AlertaDeEventosSinAplicar alerta,
            Clock reloj) {
        return new ConsumirEventosDeIdentidad(buzon, aplicador, alerta, reloj);
    }

    @Bean
    @ConditionalOnProperty("kamayuk.identidad.consumidor.municipalidad")
    CorrerElConsumidorDeIdentidad correrElConsumidorDeIdentidad(
            ConsumirEventosDeIdentidad consumidor,
            @Value("${kamayuk.identidad.consumidor.municipalidad}") long municipalidadId) {
        return new CorrerElConsumidorDeIdentidad(consumidor, municipalidadId);
    }
}
