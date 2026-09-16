package kamayuk.normativa.seguridad.aplicacion;

import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.seguridad.dominio.AccesoDelSistema;
import kamayuk.normativa.seguridad.dominio.LecturaDeLaCopiaLocal;
import kamayuk.normativa.seguridad.dominio.ModuloDelSistema;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Las dos lecturas del catalogo de este sistema con las que la interfaz compone su menu (#54).
 *
 * <p>Existe por la transaccion y por nada mas, y eso no es poco: {@code modulo_sistema} y {@code
 * acceso} llevan RLS con {@code FORCE}, y sus politicas leen el {@code app.municipalidad_id} que
 * {@code TenantTransactionManager} fija al abrirla. Es el defecto que {@code rentas} pago en la
 * etapa 4 de ADR-0039 —retiro su caso de uso transaccional, dejo a {@code SeguridadController}
 * llamando al repositorio, y las dos rutas de las que su interfaz compone el arbol contestaron 500
 * a todo el mundo, con «invalid input syntax for type bigint: ""»—. Ninguna prueba lo veia porque
 * todas abren su propia transaccion; aqui lo vigila {@code LecturasDeSeguridadDePuntaAPuntaTest},
 * que entra por HTTP con el inquilino puesto solo por el filtro, y la regla compartida {@code
 * NINGUN_CONTROLADOR_SOSTIENE_UN_REPOSITORIO}.
 */
@Service
public class ConsultaDelCatalogo {

    private final LecturaDeLaCopiaLocal copiaLocal;

    public ConsultaDelCatalogo(LecturaDeLaCopiaLocal copiaLocal) {
        this.copiaLocal = copiaLocal;
    }

    @Transactional(readOnly = true)
    public Pagina<ModuloDelSistema> modulos(Paginacion paginacion) {
        return copiaLocal.modulos(paginacion);
    }

    @Transactional(readOnly = true)
    public Pagina<AccesoDelSistema> accesos(Paginacion paginacion) {
        return copiaLocal.accesos(paginacion);
    }
}
