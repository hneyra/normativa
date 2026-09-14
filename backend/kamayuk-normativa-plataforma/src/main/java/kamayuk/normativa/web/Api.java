package kamayuk.normativa.web;

/** Constantes del contrato HTTP. */
public final class Api {

    /**
     * Raiz de todas las operaciones.
     *
     * <p>Es la raiz que {@code ConfiguracionDeNormativa.raizDeLaApi()} declara a las barreras de
     * {@code comun-verificaciones}: {@code EndpointsPublicados} la quita de cada ruta, y asi se
     * escriben las claves de {@code docs/50-api/formas-de-la-api.json} y {@code
     * docs/50-api/parametros-de-la-api.json} —las generan {@code FormasDeLaApiTest} y {@code
     * ParametrosDeLaApiTest}— y las de los contratos que {@code rentas} y {@code catastro} publican
     * para este backend. Un controlador montado fuera de esta raiz sale en esos archivos con la
     * ruta entera, y el diff del archivo regenerado lo ensena; en los contratos, no coincide
     * ninguna operacion.
     *
     * <p>Este repositorio no tiene contrato OpenAPI (#49): hasta ese issue este javadoc nombraba un
     * {@code normativa-v1.yaml} y una prueba de rutas que no existian, copiados de {@code rentas}.
     */
    public static final String RAIZ = "/normativa/api/v1";

    private Api() {}
}
