package kamayuk.normativa.parametros.dominio;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import kamayuk.normativa.compartido.Pagina;
import kamayuk.normativa.compartido.Paginacion;
import kamayuk.normativa.dominio.Ejercicio;

/**
 * Puerto de persistencia de los conjuntos de parametros.
 *
 * <p><b>No hay ningun metodo que cree un {@link ParametroTributario}</b>, y no es una omision: la
 * aplicacion solo tiene {@code SELECT} sobre {@code parametro_tributario} (V7). Cargar valores
 * normativos es trabajo de {@code rol_carga_parametros}, un rol distinto con su propia conexion. Es
 * la separacion de funciones de REQ-03: quien opera el sistema no publica las cifras con las que se
 * calcula.
 *
 * <p>Lo que la aplicacion si hace es armar el conjunto del ejercicio con parametros ya publicados,
 * y sellarlo.
 */
public interface ParametrosRepository {

    Pagina<ConjuntoDeParametros> conjuntos(Paginacion paginacion);

    Optional<ConjuntoDeParametros> conjunto(long id);

    /**
     * El conjunto sellado de mayor version del ejercicio: el que rige hoy. Puede haber mas de uno
     * sellado —ARQ-09 §3 lo exige— y entonces el vigente es el ultimo.
     */
    Optional<ConjuntoDeParametros> selladoVigenteDe(Ejercicio ejercicio);

    /**
     * El conjunto sellado con ese identificador, sea o no el vigente. Devuelve vacio si no existe o
     * si sigue abierto: un conjunto abierto no se lee para calcular.
     */
    Optional<ConjuntoDeParametros> selladoPorId(long id);

    /** La ultima version del ejercicio, sellada o no. 0 si no hay ninguna. */
    int ultimaVersionDe(Ejercicio ejercicio);

    ConjuntoDeParametros crear(ConjuntoDeParametros conjunto);

    /**
     * Crea el conjunto guardando la {@code Idempotency-Key} con la que se pidio (ADR-0043 §5).
     *
     * <p>Lo que impide que la misma clave abra dos conjuntos es el indice {@code
     * conjunto_idempotencia_uq} de V3, no quien llama: si otra peticion la guardo antes, esto falla
     * con un {@code unique_violation} y quien llama lo atiende.
     */
    ConjuntoDeParametros crear(ConjuntoDeParametros conjunto, ClaveDeIdempotencia clave);

    /**
     * El conjunto que esa clave abrio en esta municipalidad, en su estado de ahora —abierto o ya
     * sellado—, o vacio si no abrio ninguno.
     */
    Optional<ConjuntoDeParametros> abiertoConLaClave(ClaveDeIdempotencia clave);

    /** Sella el conjunto. Falla si ya estaba sellado: lo impide un disparador de la base. */
    ConjuntoDeParametros sellar(long conjuntoId, Instant cuando, String quien);

    /** Agrega un parametro ya publicado al conjunto. Falla si el conjunto esta sellado. */
    void agregarParametro(long conjuntoId, long parametroId);

    /**
     * Si el parametro ya esta en el conjunto. Es lo que hace idempotente agregar: lo que ya esta
     * dentro no se vuelve a escribir ni a auditar (ADR-0043 §5).
     */
    boolean contiene(long conjuntoId, long parametroId);

    List<ParametroTributario> parametrosDe(long conjuntoId);

    /**
     * Los parametros publicados que responden a esa llave.
     *
     * <p>Devuelve una <b>lista</b> y no un {@code Optional} a proposito: {@code
     * parametro_tributario} no tiene ninguna restriccion de unicidad sobre (tipo, clave,
     * vigencia_desde) —V1 no la puso—, asi que dos filas homonimas son posibles. Resolverlas aqui
     * quedandose con «la primera» meteria en un conjunto sellado un valor que nadie eligio, y no
     * habria ningun sintoma. Quien llama decide, y lo que decide es rechazar.
     */
    List<ParametroTributario> publicados(LlaveDeParametro llave);

    /** Solo lectura: la aplicacion no publica valores normativos. */
    Pagina<ParametroTributario> parametros(Paginacion paginacion);
}
