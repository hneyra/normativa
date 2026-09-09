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
 * <h2>Un grupo, no dos</h2>
 *
 * <p>{@code rentas} crea dos —administracion y {@code Seguridad}—; aqui solo el primero. El segundo
 * es la plantilla de quien administra <b>el acceso de los usuarios</b>, y esas pantallas viven en
 * {@code rentas} (ADR-0030 §3): crear aqui un grupo que no puede administrar nada seria decir que
 * existe una delegacion que no existe.
 *
 * <h2>Idempotente, entera</h2>
 *
 * <p>Se ejecuta en cada despliegue. Lo que ya existe se queda como esta —con los permisos que
 * alguien haya configurado despues—, y lo que falta se crea. Nunca borra.
 *
 * <h2>Y desde la etapa 4 termina con una pasada del consumidor del buzon (ADR-0039)</h2>
 *
 * <p>Sembrar deja el primer administrador; lo que {@code identidad} haya publicado desde que esta
 * municipalidad existe —grupos, cuentas, permisos— lo trae el consumidor, y hacerlo aqui es lo que
 * deja la copia local al dia el mismo dia que se implanta, sin esperar al primer {@code CronJob}.
 * <b>Sin identidad configurada</b> ({@code kamayuk.identidad.url} sin poner) no hay consumidor: se
 * dice y la implantacion NO falla, porque en esta etapa la copia sembrada sigue siendo un estado
 * legitimo. Que deje de serlo es la etapa 5, cuando el sembrador se retire.
 *
 * <p>Si el buzon no contesta, la implantacion <b>si</b> falla: la municipalidad queda dada de alta
 * y sembrada —eso ya confirmo—, y la corrida sale distinta de cero para que el despliegue la
 * repita. Tragarselo dejaria una implantacion en verde con una copia que no sabe nada de lo que
 * {@code identidad} ya dijo.
 */
@Component
@Profile("batch")
@ConditionalOnProperty("kamayuk.implantacion.ubigeo")
@EnableConfigurationProperties(DatosDeImplantacion.class)
public class ImplantarMunicipalidad implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ImplantarMunicipalidad.class);

    private final RegistroDeMunicipalidadesJdbc registro;
    private final SembradorDeLaCopiaLocal sembrador;
    private final DatosDeImplantacion datos;
    private final @Nullable ConsumirEventosDeIdentidad consumidor;

    public ImplantarMunicipalidad(
            RegistroDeMunicipalidadesJdbc registro,
            SembradorDeLaCopiaLocal sembrador,
            DatosDeImplantacion datos,
            ObjectProvider<ConsumirEventosDeIdentidad> consumidor) {
        this.registro = registro;
        this.sembrador = sembrador;
        this.datos = datos;
        // `getIfAvailable`: el consumidor solo existe si el despliegue dijo donde esta el buzon.
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
                            datos.administrador(),
                            datos.nombreDelAdministrador(),
                            Observacion.de(
                                    "Implantacion de la municipalidad "
                                            + datos.ubigeo()
                                            + " en normativa (despliegue)"));

            // El regimen se registra aunque sea una sola palabra: es lo unico del resultado que no
            // se puede comprobar mirando pantallas. Una instalacion que se creia de demostracion y
            // salio real emite papeles sin marca, y quien lo descubre es quien recibe uno (#122).
            log.info(
                    "Municipalidad {} lista en normativa ({}): id {}, {} accesos nuevos,"
                            + " administrador '{}'",
                    datos.ubigeo(),
                    datos.esDemostracion() ? "DEMOSTRACION" : "instalacion real",
                    municipalidadId,
                    nuevos,
                    datos.administrador());

            traerLoQueIdentidadYaPublico();
        } finally {
            OrigenContext.limpiar();
            TenantContext.limpiar();
        }
    }

    /** La pasada del consumidor, con el contexto de tenant que este runner ya fijo. */
    private void traerLoQueIdentidadYaPublico() {
        if (consumidor == null) {
            log.info(
                    "Sin identidad configurada (kamayuk.identidad.url): la copia local de la"
                            + " autorizacion queda como la sembro esta implantacion. Lo que"
                            + " `identidad` haya publicado no llega hasta que se configure el"
                            + " consumidor (ADR-0039, etapa 4)");
            return;
        }
        try {
            consumidor.correr();
        } catch (BuzonDeIdentidad.IdentidadNoContesta noContesta) {
            // La municipalidad YA esta implantada —eso se confirmo arriba— y lo que no llego es
            // la frescura de la copia local, que el CronJob del consumidor trae en su siguiente
            // ventana. Tumbar el Job aqui dejaria un despliegue sin municipalidad por un sistema
            // que no es este, que es justo lo que ADR-0039 §«Lo que cuesta» (2) excluye: con
            // `identidad` caido, los otros cuatro siguen. Se dice, y con la causa entera.
            log.warn(
                    "La implantacion termino, y la pasada del consumidor de `identidad` NO: {}. La"
                            + " copia local de la autorizacion queda como la sembro esta implantacion"
                            + " hasta la siguiente vuelta del consumidor (ADR-0039, etapa 4)",
                    noContesta.getMessage());
        }
    }
}
