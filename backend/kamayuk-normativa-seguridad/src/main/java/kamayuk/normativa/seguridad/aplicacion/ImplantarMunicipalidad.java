package kamayuk.normativa.seguridad.aplicacion;

import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.seguridad.dominio.consumidor.BuzonDeIdentidad;
import kamayuk.normativa.seguridad.infraestructura.RegistroDeMunicipalidadesJdbc;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Pone la municipalidad dentro de la base de {@code normativa}: sin esto no hay nada que
 * administrar.
 *
 * <h2>El hueco que cierra (C-6, hueco 3)</h2>
 *
 * <p>Cada sistema tiene <b>su propia base</b> (ADR-0032) y en cada una hay una tabla {@code
 * municipalidad} con su {@code es_demostracion}. {@code SoloEnDemostracion} la consulta <b>en la
 * base de su propio sistema</b>, y las politicas RLS resuelven {@code app.municipalidad_id} contra
 * ella. Hasta C-7, el unico {@code INSERT INTO municipalidad} del arbol de este repositorio estaba
 * en fixtures de prueba: una instalacion real no tenia como escribir esa fila, y sin ella los pasos
 * de siembra se negaban a correr —correctamente— sin que nada dijera que era lo que faltaba.
 *
 * <p>Es el mismo hueco que #430 cerro para {@code area} y {@code caja}, y se cierra igual: <b>por
 * donde entra la configuracion de la municipalidad, no con una pantalla</b>.
 *
 * <h2>Por que un proceso y no un endpoint</h2>
 *
 * <p>Porque {@code municipalidad} solo la escribe {@code kamayuk_owner}. Un endpoint que lo hiciera
 * le exigiria a {@code kamayuk_app} un privilegio que se le quito a proposito, y seria el camino
 * mas corto de una pantalla de alta a una escalada entre municipalidades.
 *
 * <p>Corre en el perfil {@code batch}: sin servidor web, sin puerto expuesto y con vida corta. Las
 * credenciales de {@code kamayuk_owner} entran <b>solo</b> en el paso 1, para <b>un</b> {@code
 * INSERT}, en una conexion que se abre y se cierra. Todo lo demas va por el camino normal de la
 * aplicacion, como {@code kamayuk_app} y con su auditoria.
 *
 * <h2>Tres pasos, y el tercero ya no es opcional (ADR-0039, etapa 5)</h2>
 *
 * <ol>
 *   <li>dar de alta la municipalidad;
 *   <li>sembrar <b>el catalogo</b> de este sistema —sus modulos y sus opciones—, que es lo unico
 *       que le queda a {@link SembradorDelCatalogo};
 *   <li>traer del buzon de {@code identidad} lo que aquel sistema ya publico: el grupo de
 *       administracion, el primer administrador, su afiliacion y sus permisos.
 * </ol>
 *
 * <p>Hasta la etapa 4 el paso 2 escribia ademas el administrador, asi que el 3 era un extra: si el
 * buzon no contestaba, la copia sembrada seguia siendo un estado legitimo y la implantacion podia
 * avisar y terminar. <b>Desde la etapa 5 no lo es</b>: la autorizacion la escribe solo el
 * consumidor, de modo que una implantacion cuyo paso 3 no llegue a hacer nada deja esta base <b>sin
 * una sola cuenta</b> —nadie puede entrar, y el guardia le dice a quien acaba de implantar la
 * municipalidad que no esta dado de alta en este sistema—. Por eso el paso 3 falla en vez de
 * avisar, y la corrida sale distinta de cero para que el despliegue la repita.
 *
 * <h2>Fallar aqui NO es lo mismo que fallar en el {@code CronJob}, y la diferencia vive aqui</h2>
 *
 * <p>{@link ConsumirEventosDeIdentidad#correr()} no cambia: una vuelta periodica con hechos
 * pospuestos termina <b>normal</b>, avisa una vez por corrida y deja que la siguiente siga (etapa
 * 4). Convertir eso en un fallo pondria el {@code CronJob} en {@code Failed} cada cinco minutos, y
 * un {@code Job} que falla siempre no lo mira nadie.
 *
 * <p>Lo que esta clase anade es una exigencia <b>del momento de implantar</b>, que es otro momento:
 * ahi no hay «la siguiente vuelta trae lo que falte», hay un despliegue que o deja la municipalidad
 * utilizable o no la deja. Las dos reglas conviven porque preguntan cosas distintas —«¿avanzo la
 * copia?» y «¿quedo alguien que pueda entrar?»— y la segunda solo se hace aqui.
 *
 * <h2>Idempotente, entera</h2>
 *
 * <p>Se ejecuta en cada despliegue. Lo que ya existe se queda como esta —con los permisos que
 * alguien haya configurado despues—, y lo que falta se crea. Nunca borra. Y la comprobacion del
 * paso 3 cuenta <b>filas de {@code usuario}</b> y no hechos aplicados, precisamente por eso: un
 * segundo despliegue aplica cero hechos —los acuso el primero— y tiene a quien entrar.
 */
@Component
@Profile("batch")
@ConditionalOnProperty("kamayuk.implantacion.ubigeo")
@EnableConfigurationProperties(DatosDeImplantacion.class)
public class ImplantarMunicipalidad implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ImplantarMunicipalidad.class);

    /** Lo que hay que hacer antes, y va dentro de los tres mensajes de {@link SinAutorizacion}. */
    private static final String REMEDIO =
            "Remedio: implantar `identidad` PRIMERO —es el dueño de la autorizacion (ADR-0039)— y"
                    + " darle a este proceso las variables del consumidor: KAMAYUK_IDENTIDAD_URL,"
                    + " _TOKEN, _CLIENTE y _CREDENCIAL. Despues, repetir esta implantacion: es"
                    + " idempotente.";

    private final RegistroDeMunicipalidadesJdbc registro;
    private final SembradorDelCatalogo sembrador;
    private final DatosDeImplantacion datos;
    private final @Nullable ConsumirEventosDeIdentidad consumidor;

    public ImplantarMunicipalidad(
            RegistroDeMunicipalidadesJdbc registro,
            SembradorDelCatalogo sembrador,
            DatosDeImplantacion datos,
            ObjectProvider<ConsumirEventosDeIdentidad> consumidor) {
        this.registro = registro;
        this.sembrador = sembrador;
        this.datos = datos;
        // `getIfAvailable`: el consumidor solo existe si el despliegue dijo donde esta el buzon.
        // Desde la etapa 5 que no exista NO es un estado admisible al implantar, y quien lo dice
        // es `traerLaAutorizacionDeIdentidad`: aqui no se puede lanzar todavia, porque este
        // constructor corre al montar el contexto y el rojo saldria sin haber hecho ni el paso 1.
        this.consumidor = consumidor.getIfAvailable();
    }

    @Override
    public void run(ApplicationArguments argumentos) {
        long municipalidadId =
                registro.darDeAltaSiFalta(
                        datos.ubigeo(), datos.nombre(), datos.tipo(), datos.esDemostracion());

        // El perfil batch no tiene filtros HTTP, asi que los dos contextos que en una peticion
        // salen del token se fijan aqui a mano. `Origen.deProceso` existe para esto: una escritura
        // sin peticion detras, que aun asi tiene que decir quien.
        TenantContext.fijar(new MunicipalidadId(municipalidadId));
        OrigenContext.fijar(Origen.deProceso(datos.usuarioDelProceso()));
        try {
            int nuevos =
                    sembrador.sembrar(
                            Observacion.de(
                                    "Implantacion de la municipalidad "
                                            + datos.ubigeo()
                                            + " en normativa (despliegue)"));

            // El regimen se registra aunque sea una sola palabra: es lo unico del resultado que no
            // se puede comprobar mirando pantallas. Una instalacion que se creia de demostracion y
            // salio real emite papeles sin marca, y quien lo descubre es quien recibe uno (#122).
            log.info(
                    "Municipalidad {} lista en normativa ({}): id {}, {} accesos nuevos del"
                            + " catalogo de este sistema",
                    datos.ubigeo(),
                    datos.esDemostracion() ? "DEMOSTRACION" : "instalacion real",
                    municipalidadId,
                    nuevos);

            traerLaAutorizacionDeIdentidad();
        } finally {
            OrigenContext.limpiar();
            TenantContext.limpiar();
        }
    }

    /**
     * El paso 3: la pasada del consumidor, con el contexto de tenant que este runner ya fijo, y la
     * comprobacion de que dejo a alguien que pueda entrar.
     *
     * <p>Las tres formas de no conseguirlo se distinguen porque se arreglan de tres maneras: falta
     * configuracion, {@code identidad} no contesta, o contesta y no tiene nada que decir de esta
     * municipalidad —que es el orden equivocado: implantar este sistema antes que su dueño—.
     */
    private void traerLaAutorizacionDeIdentidad() {
        if (consumidor == null) {
            throw new SinAutorizacion(
                    "Este despliegue no configuro el consumidor del buzon de `identidad` (falta"
                            + " kamayuk.identidad.url), asi que la copia local de la autorizacion se"
                            + " queda VACIA: desde la etapa 5 de ADR-0039 el administrador ya no se"
                            + " siembra aqui, llega por el buzon. Sin el, esta municipalidad queda"
                            + " implantada y sin una sola cuenta que pueda entrar. "
                            + REMEDIO);
        }
        try {
            consumidor.correr();
        } catch (BuzonDeIdentidad.IdentidadNoContesta noContesta) {
            // Antes esto era un WARN y la implantacion terminaba en verde. Con el sembrador
            // retirado eso dejaria un `Job` en `Complete` sobre una base sin usuarios, que es
            // exactamente el modo de fallo de C-18: verde, y nada funciona.
            throw new SinAutorizacion(
                    "No se pudo traer la autorizacion del buzon de `identidad`: "
                            + noContesta.getMessage()
                            + ". La municipalidad quedo dada de alta y con su catalogo sembrado,"
                            + " pero sin ninguna cuenta: nadie puede entrar. "
                            + REMEDIO,
                    noContesta);
        }
        long cuentas = consumidor.cuentasEnLaCopia();
        if (cuentas == 0) {
            throw new SinAutorizacion(
                    "El buzon de `identidad` contesto y no publico ni una cuenta para la"
                            + " municipalidad "
                            + datos.ubigeo()
                            + ": la copia local se queda con CERO usuarios y nadie puede entrar."
                            + " Lo normal es que sea el orden: esta municipalidad todavia no esta"
                            + " implantada en `identidad`, asi que alli no hay nada publicado que"
                            + " traer. "
                            + REMEDIO);
        }
        log.info(
                "Autorizacion traida del buzon de `identidad`: la copia local de la municipalidad"
                        + " {} tiene {} cuenta(s)",
                datos.ubigeo(),
                cuentas);
    }

    /**
     * La implantacion no pudo dejar a nadie que entre. Sale sin capturar: el {@code
     * ApplicationRunner} la propaga, el proceso termina distinto de cero y el {@code Job} del
     * despliegue queda {@code Failed} en vez de {@code Complete}.
     */
    public static final class SinAutorizacion extends RuntimeException {
        @java.io.Serial private static final long serialVersionUID = 1L;

        public SinAutorizacion(String mensaje) {
            super(mensaje);
        }

        public SinAutorizacion(String mensaje, Throwable causa) {
            super(mensaje, causa);
        }
    }
}
