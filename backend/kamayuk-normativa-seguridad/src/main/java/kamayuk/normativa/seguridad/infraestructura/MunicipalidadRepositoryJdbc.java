package kamayuk.normativa.seguridad.infraestructura;

import java.util.Optional;
import kamayuk.normativa.persistencia.RepositorioJdbc;
import kamayuk.normativa.seguridad.dominio.Municipalidad;
import kamayuk.normativa.seguridad.dominio.MunicipalidadRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * La municipalidad de la sesion, resuelta por el motor y no por Java (#54, G2 de #52).
 *
 * <h2>Aqui SI hay {@code WHERE}, y conviene decir por que</h2>
 *
 * <p>En las tablas de tenant el filtrado no se escribe: lo pone la politica RLS. {@code
 * municipalidad} es la excepcion, y no por descuido: es el <b>registro</b> de tenants, y {@code V1}
 * le pone {@code municipalidad_lectura … FOR SELECT TO PUBLIC USING (true)} (V1:620-621) porque los
 * procesos masivos la recorren entera. <b>Sin {@code WHERE} esta lectura devolveria todas</b>, y la
 * barra de la interfaz podria acabar mostrando el nombre de otra municipalidad. Lo demuestra la
 * prueba de las dos municipalidades de {@code LecturasDeSeguridadDePuntaAPuntaTest}.
 *
 * <p>Lo que no hay es un parametro de Java: el identificador lo pone el motor con {@link
 * RepositorioJdbc#MUNICIPALIDAD_ACTUAL}, el mismo parametro que consultan las politicas y que fija
 * {@code SET LOCAL} al abrir la transaccion. Es la forma de {@code RegimenDeLaInstalacionJdbc} para
 * leer {@code es_demostracion} de esta misma tabla, y la forma estricta de {@code current_setting}
 * hace que sin contexto la consulta <b>falle</b> en vez de contestar «esta municipalidad no
 * existe».
 */
@Repository
public class MunicipalidadRepositoryJdbc extends RepositorioJdbc
        implements MunicipalidadRepository {

    private static final String CONSULTA =
            "SELECT id, ubigeo, nombre, tipo FROM municipalidad WHERE id = " + MUNICIPALIDAD_ACTUAL;

    public MunicipalidadRepositoryJdbc(JdbcClient jdbc) {
        super(jdbc);
    }

    @Override
    public Optional<Municipalidad> deLaSesion() {
        return jdbc().sql(CONSULTA)
                .query(
                        (fila, numero) ->
                                new Municipalidad(
                                        fila.getLong("id"),
                                        // character(6): PostgreSQL lo devuelve relleno con espacios
                                        // si alguna fila se escribio corta, y el ubigeo se compara.
                                        fila.getString("ubigeo").strip(),
                                        fila.getString("nombre"),
                                        fila.getString("tipo")))
                .optional();
    }
}
