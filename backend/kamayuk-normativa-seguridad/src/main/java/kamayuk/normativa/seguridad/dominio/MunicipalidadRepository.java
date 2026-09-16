package kamayuk.normativa.seguridad.dominio;

import java.util.Optional;

/**
 * Lo unico que se puede preguntar del registro de tenants desde una peticion: <b>cual es la mia</b>
 * (#54).
 *
 * <p>Un metodo y sin argumento. Un {@code porId}, un {@code porUbigeo} o un {@code todas} harian de
 * este puerto un <b>directorio de municipalidades</b> —quien pregunta elegiria de quien pregunta—,
 * y la ruta que lo publicara dejaria de respetar el aislamiento cambiando un numero. Que no reciba
 * nada es lo que obliga a que el identificador salga del token (regla 2).
 *
 * <p>{@code municipalidad} no es una tabla de tenant —{@code V1__baseline.sql:620-621} le da {@code
 * municipalidad_lectura … FOR SELECT TO PUBLIC USING (true)}, porque los procesos masivos la
 * recorren entera—, asi que aqui el aislamiento no lo pone RLS: lo pone un {@code WHERE} contra
 * {@code current_setting('app.municipalidad_id')}. Fuera de una transaccion ese parametro no existe
 * y la consulta revienta, en vez de contestar por otra.
 */
public interface MunicipalidadRepository {

    /**
     * La municipalidad de la sesion en curso.
     *
     * @return vacio si el token trae una municipalidad que no esta en el registro, que es una
     *     instalacion rota y no una respuesta de negocio
     */
    Optional<Municipalidad> deLaSesion();
}
