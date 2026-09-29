package kamayuk.normativa.parametros.infraestructura.web;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.autorizacion.RequiereAcceso;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.dominio.Observacion;
import kamayuk.normativa.parametros.aplicacion.EscriturasDelConjunto;
import kamayuk.normativa.parametros.dominio.ClaveDeIdempotencia;
import kamayuk.normativa.parametros.dominio.DeclaracionDelArancel;
import kamayuk.normativa.parametros.dominio.LlaveDeParametro;
import kamayuk.normativa.parametros.infraestructura.web.ContenidoDelConjuntoController.ParametroResource;
import kamayuk.normativa.parametros.infraestructura.web.ParametrosController.ConjuntoResource;
import kamayuk.normativa.web.Api;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Abrir, agregar y sellar un conjunto por HTTP: las filas 1, 2 y 3 de ADR-0043 §1 (#59).
 *
 * <h2>Lo que cambia, y lo que no</h2>
 *
 * <p>Hasta aqui componer y sellar el ejercicio de una municipalidad solo se podia hacer con un
 * {@code Job} {@code batch} ({@code AbrirConjuntoDeParametros}). ADR-0043 lo publica tambien por
 * HTTP para la interfaz, y lo que protege el camino ya no es la ausencia de codigo sino
 * {@code @RequiereAcceso} en cada ruta y el guardia negando lo que no encuentra. <b>Ninguna ruta de
 * aqui publica una cifra</b>: {@code kamayuk_app} solo tiene {@code SELECT} sobre {@code
 * parametro_tributario} y los tres cuadros, asi que un {@code POST} que se equivocara de SQL
 * recibiria {@code permission denied} (ADR-0043 §4). Lo que se compone es lo ya publicado.
 *
 * <h2>Los accesos: {@code conjuntos}, sin {@code oTambien}</h2>
 *
 * <p>Componer pide {@code REGISTRO} y sellar {@code ESPECIAL}, no {@code MODIFICACION}: sellar es
 * el acto que no se deshace, y quien concede {@code MODIFICACION} para corregir algo no debe estar
 * concediendo, sin saberlo, el sello (ADR-0043 §1). Y ninguna de las tres lleva {@code oTambien =
 * "parametros"}: daria componer y sellar a todo el que tenga esos privilegios sobre la opcion del
 * modulo Seguridad, y el grupo de administracion tiene los siete sobre todas (ADR-0043 §2). Las
 * anotaciones van con literales y justo debajo del mapeo: las leen {@code CatalogoDelSistemaTest} y
 * {@code frontend/verificaciones/camino-a-la-api.test.ts} con expresiones regulares.
 *
 * <h2>Lo que el cuerpo exige, dicho aqui y garantizado mas abajo</h2>
 *
 * <p>Cada campo obligatorio que falte sale 422 con un mensaje escrito en esta clase, que dice
 * {@code falta} y nombra el campo entre comillas angulares: es lo que {@code ParametrosDeLaApiTest}
 * lee para publicar {@code enElCuerpo} en {@code docs/50-api/parametros-de-la-api.json}, y lo que
 * ata lo publicado a lo que el controlador exige. <b>Pero lo que impide el 500 no es esto.</b> Los
 * objetos de valor rechazan el nulo con un {@code IllegalArgumentException} en su constructor
 * —{@link Observacion}, {@link LlaveDeParametro}, {@link DeclaracionDelArancel}, {@link
 * ClaveDeIdempotencia}—, que es donde pasan todas las escrituras (ADR-0043 §6): un cuarto
 * controlador que olvidara la comprobacion de aqui daria un 422 con el mensaje del constructor, no
 * un 500. Es el reparto de {@code rentas}: la ausencia con mensaje propio, lo invalido con el del
 * constructor.
 *
 * <p>Los cuerpos son {@code record} con todos sus campos {@code @Nullable} a proposito: Jackson
 * pone {@code null} en lo que falta, y el 422 lo da esta clase nombrando el campo. Si el cuerpo
 * validara en su constructor, Jackson envolveria la excepcion en un {@code
 * HttpMessageNotReadableException} y el 422 saldria con el mensaje fijo del cuerpo ilegible, sin
 * decir que campo.
 *
 * <h2>Sin {@code Location}</h2>
 *
 * <p>No hay {@code GET /conjuntos/{id}}: la ruta que lee un conjunto es {@code GET
 * /conjuntos/{id}/parametros}, que ya trae su {@code ConjuntoResource}. Las rutas 1 y 3 contestan
 * con ese mismo recurso, y no con una segunda forma suya.
 */
@RestController
@RequestMapping(Api.RAIZ)
public class EscriturasDelConjuntoController {

    /** El unico caracter que PostgreSQL no admite en un texto. */
    private static final char NULO = (char) 0;

    private final EscriturasDelConjunto escrituras;

    public EscriturasDelConjuntoController(EscriturasDelConjunto escrituras) {
        this.escrituras = escrituras;
    }

    /**
     * Abre una version nueva del ejercicio (ADR-0043 §1, fila 1).
     *
     * <p><b>201 tambien en el reintento</b>: la misma {@code Idempotency-Key} con el mismo
     * ejercicio devuelve el mismo conjunto —mismo {@code id}, misma {@code version}, en su estado
     * de ahora— sin escribir ni auditar otra vez, y la {@code observacion} del reenvio se ignora.
     * Dos codigos para el mismo exito obligarian a quien llama a distinguirlos (ADR-0043 §5). La
     * misma clave con otro ejercicio es 409: no es un reintento sino una clave reusada.
     */
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/conjuntos")
    @RequiereAcceso(acceso = "conjuntos", privilegio = Privilegio.REGISTRO)
    public ConjuntoResource abrir(
            @RequestHeader(ClaveDeIdempotencia.CABECERA) String claveDeIdempotencia,
            @RequestBody AbrirConjunto cuerpo) {
        return ConjuntoResource.de(
                escrituras.abrir(
                        cuerpo.ejercicioPedido(),
                        new ClaveDeIdempotencia(claveDeIdempotencia),
                        observacionDe(cuerpo.observacion())));
    }

    /**
     * Agrega al conjunto un parametro ya publicado, nombrado por su llave (ADR-0043 §1, fila 2).
     *
     * <p><b>Por llave y no por {@code parametroId}</b>: por identificador, la clave foranea deja
     * meter en el conjunto un parametro de otra municipalidad —PostgreSQL comprueba las claves
     * foraneas sin aplicar RLS, y se midio—, y el {@code JOIN} de la lectura lo esconderia. Por
     * llave, la resolucion es un {@code SELECT} bajo {@code parametro_lectura}.
     *
     * <p><b>201 tambien si ya estaba</b>, con la misma fila y sin escribir ni auditar: la
     * composicion es un conjunto, no una lista. Y «ya esta dentro» se contesta antes que «esta
     * sellado»; si no esta y el conjunto esta sellado, 409.
     */
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/conjuntos/{id}/parametros")
    @RequiereAcceso(acceso = "conjuntos", privilegio = Privilegio.REGISTRO)
    public ParametroResource agregar(@PathVariable long id, @RequestBody AgregarParametro cuerpo) {
        return ParametroResource.de(
                escrituras
                        .agregar(id, cuerpo.llave(), observacionDe(cuerpo.observacion()))
                        .parametro());
    }

    /**
     * Sella el conjunto: desde aqui rige y no se modifica (ADR-0043 §1, fila 3; ADR-0007).
     *
     * <p><b>200 y no 201</b>: no crea un recurso, cambia el estado de uno que existe. Repetirlo
     * sobre uno ya sellado es 409, no un exito: {@code usuario_sellado} es de quien sello primero,
     * y contestar «hecho» le atribuiria a quien lo pide un sello que puede ser de otra persona.
     *
     * <p><b>El punto 3 de «Antes de sellar».</b> El cuerpo trae {@code arancelDeLaMunicipalidad},
     * {@code DECLARADO_CARGADO} o {@code SIN_CARGAR}, sin valor por omision, y queda en la
     * auditoria del sellado. <b>Normativa no puede comprobar si esta cargado, y no lo va a
     * comprobar: la tabla es de catastro.</b> Lo que se guarda prueba quien dijo que, cuando y con
     * que observacion — no que el arancel este cargado.
     */
    @PostMapping("/conjuntos/{id}/sellar")
    @RequiereAcceso(acceso = "conjuntos", privilegio = Privilegio.ESPECIAL)
    public ConjuntoResource sellar(@PathVariable long id, @RequestBody SellarConjunto cuerpo) {
        return ConjuntoResource.de(
                escrituras.sellar(
                        id, observacionDe(cuerpo.observacion()), cuerpo.declaracionDelArancel()));
    }

    // ------------------------------------------------------------------

    /**
     * La observacion del cuerpo. La ausencia se contesta aqui, con el nombre del campo; lo que
     * llega y no vale —en blanco, corta o larga— lo rechaza el constructor de {@link Observacion}
     * con el suyo.
     *
     * <h2>El caracter nulo, aqui y no en {@link Observacion} (revision de #100)</h2>
     *
     * <p>Una observacion con el caracter cero en medio —en el cuerpo, la barra invertida seguida de
     * {@code u0000}— es JSON valido y pasa los 5 a 500 caracteres, y PostgreSQL rechaza el {@code
     * INSERT} de la auditoria con {@code 22021 invalid byte sequence for encoding "UTF8": 0x00}: la
     * escritura entera se deshacia y salia <b>500 con incidencia</b>, en las tres rutas. Es un dato
     * del cliente que la base no puede guardar, y es un 422 que nombra la observacion.
     *
     * <p>El sitio natural seria el constructor de {@link Observacion}, por el mismo motivo que el
     * nulo (ADR-0043 §6). <b>No se pone alli</b> porque {@code dominio-compartido} es una copia
     * declarada de {@code rentas} (P5B §7.1) y la vigila {@code lo-que-los-cinco-comparten} en
     * {@code infrastructure}, que compara las cinco copias de {@code Observacion.java} y exige
     * declarar cada divergencia: cambiar su codigo en una sola copia es exactamente lo que esa
     * guarda existe para impedir, y el arreglo de las cinco a la vez no es de este PR. Aqui pasan
     * <b>todas</b> las observaciones que llegan por HTTP a este sistema —no hay otra ruta que
     * reciba una—, y los otros dos caminos no pueden traer un nulo: la del {@code batch} sale de
     * una variable de entorno y la de la implantacion es un literal.
     *
     * <p><b>Solo el nulo, y no los demas caracteres de control.</b> El nulo es el unico que la base
     * no puede guardar; un tabulador, un salto de linea o un {@code U+001B} se guardan tal cual, y
     * la observacion es lo que quien escribe dijo (regla 10): decidir que caracteres puede decir es
     * una politica de contenido de las cinco copias, no el arreglo de un 500.
     */
    private static Observacion observacionDe(@Nullable String texto) {
        if (texto == null) {
            throw new IllegalArgumentException(
                    "Toda escritura exige decir por que se hace (regla 10, ADR-0008): falta"
                            + " «observacion»");
        }
        if (texto.indexOf(NULO) >= 0) {
            throw new IllegalArgumentException(
                    "La observacion lleva el caracter nulo (U+0000), que PostgreSQL no guarda en un"
                            + " texto: 'observacion' tiene que ser texto sin el");
        }
        return Observacion.de(texto);
    }

    /**
     * El cuerpo de {@code POST /conjuntos}.
     *
     * @param ejercicio el ano que se abre; fuera de 1990 a 2100 lo rechaza {@link Ejercicio}
     * @param observacion por que se abre, de 5 a 500 caracteres una vez recortada
     */
    public record AbrirConjunto(@Nullable Integer ejercicio, @Nullable String observacion) {

        Ejercicio ejercicioPedido() {
            if (ejercicio == null) {
                throw new IllegalArgumentException(
                        "Hay que decir que ejercicio se abre: falta «ejercicio»");
            }
            return new Ejercicio(ejercicio);
        }
    }

    /**
     * El cuerpo de {@code POST /conjuntos/{id}/parametros}: la llave del parametro publicado y la
     * observacion.
     *
     * @param tipo que clase de parametro es
     * @param clave cual dentro del tipo; nula o ausente si el tipo tiene un solo valor, como la UIT
     * @param vigenciaDesde el dia desde el que rige la fila publicada, {@code aaaa-mm-dd}
     * @param observacion por que se agrega
     */
    public record AgregarParametro(
            @Nullable String tipo,
            @Nullable String clave,
            @Nullable String vigenciaDesde,
            @Nullable String observacion) {

        LlaveDeParametro llave() {
            if (tipo == null) {
                throw new IllegalArgumentException(
                        "La llave de un parametro publicado es tipo, clave y vigenciaDesde: falta"
                                + " «tipo»");
            }
            if (vigenciaDesde == null) {
                throw new IllegalArgumentException(
                        "Sin la fecha de vigencia la llave no distingue el valor de un ejercicio"
                                + " del de otro: falta «vigenciaDesde»");
            }
            return new LlaveDeParametro(tipo, clave, fecha(vigenciaDesde));
        }

        private static LocalDate fecha(String texto) {
            try {
                return LocalDate.parse(texto);
            } catch (DateTimeParseException noEsFecha) {
                throw new IllegalArgumentException(
                        "'vigenciaDesde' tiene que ser una fecha aaaa-mm-dd, y llego '"
                                + texto
                                + "'");
            }
        }
    }

    /**
     * El cuerpo de {@code POST /conjuntos/{id}/sellar}.
     *
     * @param observacion por que se sella
     * @param arancelDeLaMunicipalidad {@code DECLARADO_CARGADO} o {@code SIN_CARGAR}: lo que
     *     declara quien sella, que normativa no comprueba (ADR-0043 §8)
     */
    public record SellarConjunto(
            @Nullable String observacion, @Nullable String arancelDeLaMunicipalidad) {

        DeclaracionDelArancel declaracionDelArancel() {
            if (arancelDeLaMunicipalidad == null) {
                throw new IllegalArgumentException(
                        "Sellar exige declarar si el arancel de la municipalidad esta cargado"
                                + " contra este conjunto, y no hay valor por omision: falta"
                                + " «arancelDeLaMunicipalidad»");
            }
            return DeclaracionDelArancel.de(arancelDeLaMunicipalidad);
        }
    }
}
