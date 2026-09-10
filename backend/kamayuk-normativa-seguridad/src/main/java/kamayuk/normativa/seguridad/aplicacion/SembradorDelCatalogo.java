package kamayuk.normativa.seguridad.aplicacion;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import kamayuk.normativa.auditoria.Auditoria;
import kamayuk.normativa.auditoria.Operacion;
import kamayuk.normativa.auditoria.RegistroDeAuditoria;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.persistencia.RepositorioJdbc;
import kamayuk.normativa.seguridad.dominio.CatalogoDelSistema;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Siembra el CATALOGO de este sistema —sus modulos y sus opciones— y nada mas (RF-122).
 *
 * <h2>Lo que esta clase dejo de escribir en la etapa 5, y por que (ADR-0039)</h2>
 *
 * <p>Hasta la etapa 4 se llamaba {@code SembradorDeLaCopiaLocal} y escribia SEIS tablas: las dos
 * del catalogo y ademas {@code grupo}, {@code usuario}, {@code miembro} y {@code permiso} —el grupo
 * de administracion, el primer administrador, su afiliacion y sus siete privilegios—. Las cuatro
 * ultimas son <b>la autorizacion</b>, y desde ADR-0039 su dueño es {@code identidad}: aqui llegan
 * por el buzon, aplicadas por {@code CopiaLocalDeLaAutorizacionJdbc} desde un hecho con su {@code
 * evento_id}. Que las escribieran dos sitios no daba un error: daba <b>dos respuestas</b> a «quien
 * puede hacer esto» —una decidida aqui por el despliegue y otra decidida alla por una pantalla—, y
 * la de aqui no se enteraba de ninguna revocacion.
 *
 * <p>La consecuencia se dice porque es lo que cuesta: <b>una implantacion cuyo consumidor no
 * consiga hablar con {@code identidad} ya no deja a nadie que pueda entrar</b>, y por eso {@link
 * ImplantarMunicipalidad} pasa a fallar en vez de avisar. Antes ese caso quedaba «a medias pero
 * usable»; ahora no hay medias.
 *
 * <h2>Y esto SI se sigue sembrando aqui, que no es una excepcion sino otra cosa</h2>
 *
 * <p>{@code modulo_sistema} y {@code acceso} no son la autorizacion: son <b>el catalogo de lo que
 * este sistema tiene</b>, o sea la lista de opciones sobre las que se puede conceder algo. Cada
 * sistema declara el suyo ({@code CatalogoDelSistema}) y ADR-0039 §«Lo que cuesta» punto 5 lo deja
 * expresamente en su dueño. Sin esta siembra un {@code PERMISO_FIJADO} que llegara del buzon no
 * tendria sobre que fijarse, y la opcion quedaria sin nadie que pudiera dar permiso sobre ella.
 *
 * <h2>Idempotente y solo agrega</h2>
 *
 * <p>Se puede ejecutar en cada despliegue: lo que ya existe se queda como esta y lo que falta se
 * crea. Lo que <b>no</b> hace es borrar: los permisos que cuelgan de un acceso retirado son
 * constancia de quien pudo hacer que, y eso no se borra (RNF-051, regla 4).
 */
@Service
public class SembradorDelCatalogo extends RepositorioJdbc {

    private final Auditoria auditoria;
    private final Clock reloj;

    public SembradorDelCatalogo(JdbcClient jdbc, Auditoria auditoria, Clock reloj) {
        super(jdbc);
        this.auditoria = auditoria;
        this.reloj = reloj;
    }

    /**
     * Deja el catalogo de este sistema sembrado para la municipalidad del contexto.
     *
     * <p><b>Una sola transaccion para todo</b>, y por dos motivos distintos. El primero es de
     * negocio: un catalogo sembrado a medias —modulos sin sus opciones— es peor que ninguno, porque
     * parece listo. El segundo es tecnico y se paga en cuanto se olvida: las dos tablas llevan RLS
     * con {@code FORCE} y sus politicas leen {@code app.municipalidad_id}, que el gestor de
     * transacciones fija con {@code SET LOCAL} <b>al abrir la transaccion</b>; leerlas fuera de una
     * no devuelve vacio, revienta (DAT-01 §0, #486).
     *
     * @return cuantos accesos se crearon; 0 en un despliegue donde no cambio el catalogo
     */
    @Transactional
    public int sembrar(Observacion porQue) {
        List<CatalogoDelSistema.Opcion> opciones = CatalogoDelSistema.opciones();
        if (opciones.isEmpty()) {
            throw new IllegalStateException(
                    "El catalogo de este sistema vino vacio. Sembrar cero accesos dejaria el"
                            + " sistema sin ninguna opcion configurable, y en silencio");
        }

        int creados = 0;
        for (CatalogoDelSistema.Opcion opcion : opciones) {
            creados += crearAccesoSiFalta(opcion, moduloId(opcion));
        }

        // Solo si se creo algo. Un despliegue que no cambia el catalogo no tiene nada que
        // asentar, y una fila de auditoria por despliegue convierte la bitacora en un registro de
        // reinicios — que es lo contrario de lo que ADR-0008 quiere que se pueda leer ahi.
        if (creados == 0) {
            return 0;
        }
        auditoria.registrar(
                RegistroDeAuditoria.enLaFechaDe(
                                LocalDate.now(reloj), "acceso", "catalogo", Operacion.ALTA, porQue)
                        .con(
                                null,
                                "{\"accesosCreados\":"
                                        + creados
                                        + ",\"opcionesDelSistema\":"
                                        + opciones.size()
                                        + "}"));
        return creados;
    }

    /** Crea el modulo si falta y devuelve su identificador. */
    private long moduloId(CatalogoDelSistema.Opcion opcion) {
        jdbc().sql(
                        "INSERT INTO modulo_sistema (municipalidad_id, codigo, nombre)"
                                + " VALUES ("
                                + MUNICIPALIDAD_ACTUAL
                                + ", :codigo, :nombre)"
                                + " ON CONFLICT (municipalidad_id, codigo) DO NOTHING")
                .param("codigo", opcion.moduloCodigo())
                .param("nombre", opcion.moduloNombre())
                .update();

        return jdbc().sql("SELECT id FROM modulo_sistema WHERE codigo = :codigo")
                .param("codigo", opcion.moduloCodigo())
                .query(Long.class)
                .single();
    }

    private int crearAccesoSiFalta(CatalogoDelSistema.Opcion opcion, long moduloId) {
        return jdbc().sql(
                        "INSERT INTO acceso (municipalidad_id, modulo_id, tipo, codigo, nombre)"
                                + " VALUES ("
                                + MUNICIPALIDAD_ACTUAL
                                + ", :modulo, 'OPCION_MENU', :codigo, :nombre)"
                                + " ON CONFLICT (municipalidad_id, codigo) DO NOTHING")
                .param("modulo", moduloId)
                .param("codigo", opcion.codigo())
                .param("nombre", opcion.nombre())
                .update();
    }
}
