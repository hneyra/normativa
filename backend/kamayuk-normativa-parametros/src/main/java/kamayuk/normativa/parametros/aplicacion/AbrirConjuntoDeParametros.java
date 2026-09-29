package kamayuk.normativa.parametros.aplicacion;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import kamayuk.normativa.auditoria.Origen;
import kamayuk.normativa.auditoria.OrigenContext;
import kamayuk.normativa.carga.InformeDeImportacion;
import kamayuk.normativa.carga.InformeDeImportacion.FilaRechazada;
import kamayuk.normativa.compartido.TenantContext;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.MunicipalidadId;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Abre —y opcionalmente compone y sella— el conjunto de parametros de un ejercicio contra un
 * ambiente real (#247 §2).
 *
 * <p>Es el camino de invocacion que le faltaba a {@link AdministrarParametros}: el metodo existia y
 * estaba probado, pero {@code ParametrosController} solo publicaba {@code GET} y sin un proceso que
 * lo llamara no habia ningun {@code conjunto_id} que darle a {@code cargar-arancel-vial.sh
 * --conjunto-id N}.
 *
 * <h2>Hubo una decision aqui, y ADR-0043 la revirtio: el {@code POST} existe desde #59</h2>
 *
 * <p>Este javadoc decia que se resolvia «como proceso {@code batch} y no como un {@code POST}»,
 * porque abrir y sellar un ejercicio «no es una operacion de ventanilla sino un acto de
 * implantacion», y que sin perfil «el contenedor que atiende peticiones tendria dentro el camino
 * mas corto entre una peticion HTTP y el sellado de un ejercicio» (#202). ADR-0043 ({@code
 * docs/30-arquitectura/adr/ADR-0043-componer-y-sellar-por-http.md}, aceptado en G1) decidio
 * publicarlo por HTTP para la interfaz nueva, y desde #59 {@code POST /conjuntos}, {@code POST
 * /conjuntos/{id}/parametros} y {@code POST /conjuntos/{id}/sellar} existen ({@code
 * EscriturasDelConjuntoController}). Las dos respuestas del ADR (§9), dichas donde estaba la
 * decision que revierte:
 *
 * <ul>
 *   <li><b>Sigue siendo un acto administrativo</b>, y lo que lo hace tal no es el proceso que lo
 *       corre sino lo que exige. Por HTTP exige <b>mas</b> que aqui, no menos: un privilegio de una
 *       persona de esa municipalidad —{@code REGISTRO} sobre {@code conjuntos} para componer,
 *       {@code ESPECIAL} para sellar—, que este proceso no pide porque corre con un usuario de
 *       proceso; una observacion en cada escritura; auditoria con el usuario del token; y la
 *       declaracion del punto 3 de «Antes de sellar», que aqui no se pregunta.
 *   <li><b>El camino mas corto existe, y es a proposito.</b> Lo que lo guarda ya no es la ausencia
 *       de codigo sino {@code @RequiereAcceso} en cada ruta —con {@code
 *       TODO_ENDPOINT_DECLARA_SU_ACCESO} rompiendo el build si falta— y el guardia negando lo que
 *       no encuentra. La credencial no cambia: {@code kamayuk_app} ya podia componer y sellar, y
 *       sigue sin poder publicar una cifra.
 * </ul>
 *
 * <h2>Y por que este proceso se queda</h2>
 *
 * <p>Como alternativa, no como resto: para una implantacion desde un archivo —el mismo {@code
 * parametros-2026.csv} en {@code stg} y en {@code prod}, por llave—, y para quien todavia no tiene
 * la interfaz. Pasa por el mismo {@link AdministrarParametros}, y conserva lo que por HTTP no tiene
 * equivalente: la negativa a sellar un conjunto compuesto a medias («N fila(s) del archivo no
 * entraron»), que por HTTP no se puede decir porque se agrega de uno en uno y el servidor no sabe
 * que es «completo», y la linea {@code CONJUNTO_ID=N} del registro.
 *
 * <p>Corre en el perfil {@code batch} por la misma razon que los otros procesos de arranque (#202),
 * y esa razon <b>no</b> la toco ADR-0043: un {@code ApplicationRunner} sin perfil se ejecutaria al
 * arrancar el proceso web, sin peticion, sin token y con los contextos fijados a mano. Lo fija
 * {@code AbrirConjuntoDeParametrosTest.correSoloEnElPerfilBatch}. No hace falta {@code
 * kamayuk_owner}: {@code conjunto_parametros} y {@code conjunto_parametro_detalle} son tablas que
 * {@code kamayuk_app} escribe (V7).
 *
 * <p>El perfil {@code batch} no tiene filtros HTTP, asi que los dos contextos que en una peticion
 * salen del token se fijan aqui a mano, igual que hacen la implantacion y las cargas de catastro.
 *
 * <h2>Lo que este proceso no hace</h2>
 *
 * <p>No publica ninguna cifra. Los valores normativos entran por {@code rol_carga_parametros}, con
 * su propia conexion y su doble firma (REQ-03, ADR-0007); lo que este proceso decide es <b>cuales
 * de los ya publicados</b> componen el ejercicio, y cuando se congelan.
 */
@Component
@Profile("batch")
@ConditionalOnProperty("kamayuk.conjunto-parametros.municipalidad-id")
@EnableConfigurationProperties(DatosDelConjunto.class)
public class AbrirConjuntoDeParametros implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AbrirConjuntoDeParametros.class);

    private final AdministrarParametros administrar;
    private final ImportarParametrosDelConjunto importar;
    private final DatosDelConjunto datos;

    public AbrirConjuntoDeParametros(
            AdministrarParametros administrar,
            ImportarParametrosDelConjunto importar,
            DatosDelConjunto datos) {
        this.administrar = administrar;
        this.importar = importar;
        this.datos = datos;
    }

    @Override
    public void run(ApplicationArguments argumentos) throws IOException {
        // La observacion se construye antes de fijar nada: si el texto no cumple la regla 10, lo
        // que tiene que pasar es que el proceso no empiece, no que empiece y deje los dos contextos
        // fijados para lo que corra despues.
        Observacion observacion = Observacion.de(datos.observacion());
        TenantContext.fijar(new MunicipalidadId(datos.municipalidadId()));
        OrigenContext.fijar(Origen.deProceso(datos.usuarioDelProceso()));
        try {
            long conjuntoId = resolverConjunto(observacion);
            int rechazadas = componer(conjuntoId, observacion);
            sellarSiSePidio(conjuntoId, rechazadas, observacion);

            // La linea que espera quien corre esto: es el N de `cargar-arancel-vial.sh
            // --conjunto-id N`, y por eso va sola, en una forma que se puede extraer del
            // registro sin leerlo entero.
            log.info("CONJUNTO_ID={}", conjuntoId);
        } finally {
            OrigenContext.limpiar();
            TenantContext.limpiar();
        }
    }

    private long resolverConjunto(Observacion observacion) {
        if (!datos.abreVersion()) {
            log.info("Se opera sobre el conjunto {}, ya abierto", datos.conjuntoId());
            return datos.conjuntoId();
        }
        ConjuntoDeParametros abierto =
                administrar.abrirVersion(new Ejercicio(datos.ejercicio()), observacion);
        long id = Objects.requireNonNull(abierto.id(), "Un conjunto recien creado tiene id");
        log.info(
                "Conjunto de parametros abierto para la municipalidad {}: ejercicio {}, version {}",
                datos.municipalidadId(),
                abierto.ejercicio().valor(),
                abierto.version());
        return id;
    }

    /** Incorpora los parametros del archivo, si lo hay. Devuelve cuantas filas se rechazaron. */
    private int componer(long conjuntoId, Observacion observacion) throws IOException {
        String archivo = datos.archivo();
        if (archivo == null) {
            return 0;
        }
        try (Reader lectura = Files.newBufferedReader(Path.of(archivo), StandardCharsets.UTF_8)) {
            InformeDeImportacion informe = importar.importar(lectura, conjuntoId, observacion);

            for (FilaRechazada rechazada : informe.rechazadas()) {
                log.warn(
                        "Parametro de la fila {} rechazado: {}",
                        rechazada.fila(),
                        rechazada.motivo());
            }
            log.info(
                    "Conjunto {} compuesto desde {}: {} fila(s) leidas, {} incorporada(s), {}"
                            + " rechazada(s)",
                    conjuntoId,
                    archivo,
                    informe.totalFilas(),
                    informe.nuevas(),
                    informe.rechazadas().size());
            return informe.rechazadas().size();
        }
    }

    private void sellarSiSePidio(long conjuntoId, int rechazadas, Observacion observacion) {
        if (!datos.sellar()) {
            return;
        }
        if (rechazadas > 0) {
            // Sellar es congelar: un conjunto sellado al que le falta un valor no se corrige, se
            // sustituye por otra version. Y el que falta no se nota al sellar sino el dia que una
            // regla lo pide, con el padron ya emitido.
            throw new IllegalStateException(
                    "No se sella el conjunto "
                            + conjuntoId
                            + ": "
                            + rechazadas
                            + " fila(s) del archivo no entraron, y lo que se congelaria seria un"
                            + " ejercicio compuesto a medias. Corrija el archivo y vuelva a"
                            + " componer antes de sellar");
        }
        ConjuntoDeParametros sellado = administrar.sellar(conjuntoId, observacion);
        log.info(
                "Conjunto {} sellado el {} por {}: a partir de aqui rige y no se modifica"
                        + " (ADR-0007)",
                conjuntoId,
                sellado.fechaSellado(),
                sellado.usuarioSellado());
    }
}
