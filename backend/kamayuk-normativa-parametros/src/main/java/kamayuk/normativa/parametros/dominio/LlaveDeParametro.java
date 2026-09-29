package kamayuk.normativa.parametros.dominio;

import java.time.LocalDate;
import org.jspecify.annotations.Nullable;

/**
 * Como se nombra un parametro <b>ya publicado</b> para incorporarlo a un conjunto: por lo que es
 * —tipo, clave y desde cuando rige— y no por el identificador que le toco en la base.
 *
 * <p><b>Por que no el identificador.</b> Componer el conjunto de un ejercicio es el acto del que
 * cuelga la reproducibilidad de todo lo que se emita con el (ADR-0007), y se ejecuta al menos dos
 * veces —una en {@code stg} y otra en {@code prod}—. El mismo valor normativo tiene identificadores
 * distintos en cada ambiente, asi que un archivo de operacion escrito con numeros entra en el
 * ambiente equivocado <b>sin fallar</b>: sella un juego de parametros que no es el que dice. Con
 * tipo y clave, el mismo archivo vale en los dos, se lee al lado de {@code
 * docs/10-negocio/valores-normativos/} y lo que no exista se rechaza nombrandolo.
 *
 * <p>La fecha de inicio de vigencia forma parte de la llave porque un tipo se republica: la UIT de
 * 2026 y la de 2027 comparten {@code tipo} y {@code clave} y son filas distintas. Sin ella habria
 * que elegir una, y elegirla en silencio es el modo de falla que ARQ-09 §3 describe.
 *
 * <h2>Lo que PostgreSQL no puede guardar no llega a PostgreSQL (revision de #100)</h2>
 *
 * <p>La llave se busca en {@code parametro_tributario} tal cual, y hay dos cosas que Java acepta y
 * la base no, y que salian como <b>500 con incidencia</b> desde {@code
 * ParametrosRepositoryJdbc.publicados} cuando lo que estaba mal era la peticion:
 *
 * <ul>
 *   <li><b>El caracter nulo</b> ({@code U+0000}) en {@code tipo} o en {@code clave}: es JSON valido
 *       —su escape es la barra invertida seguida de {@code u0000}—, {@code strip()} no lo quita y
 *       {@code isBlank()} no lo ve, y PostgreSQL no lo admite en ningun texto —{@code 22021 invalid
 *       byte sequence for encoding "UTF8": 0x00}—. Ninguna llave publicada puede llevarlo, asi que
 *       no hay nada que buscar.
 *   <li><b>Un ano que el tipo {@code date} no tiene</b>: {@code LocalDate.parse} lee {@code
 *       +5874898-01-01} y {@code -4714-01-01}, y la base contesta {@code 22008 date out of range}.
 * </ul>
 *
 * <p><b>Solo el nulo, y no los demas caracteres de control</b>, a proposito. El nulo es el unico
 * que la base no puede guardar; un tabulador o un {@code U+001B} se guardan y se comparan como se
 * escribieron, y una llave que los lleve no coincide con ninguna publicada: la respuesta es el 404
 * de «no hay ningun parametro publicado con esa llave», que es verdad. Rechazarlos aqui cambiaria
 * un 404 cierto por un 422 sin que ningun defecto lo pida.
 *
 * @param tipo que clase de parametro es: {@code UIT}, {@code TRAMO_PREDIAL}, {@code ARANCEL}…
 * @param clave dentro del tipo, cual; nulo si el tipo tiene un solo valor
 * @param vigenciaDesde el dia desde el que rige la fila publicada, tal como se cargo
 */
public record LlaveDeParametro(String tipo, @Nullable String clave, LocalDate vigenciaDesde) {

    /**
     * El primer y el ultimo dia que admite {@code vigenciaDesde}: los de un ano de cuatro cifras,
     * {@code 0001-01-01} a {@code 9999-12-31}.
     *
     * <p><b>No es una cifra tributaria ni una opinion sobre que anos son razonables</b>: es el
     * conjunto de fechas que cumplen a la vez tres cosas, y se puede medir cada una. (1) Es la
     * forma {@code aaaa-mm-dd} que la API documenta y el corpus escribe; {@code LocalDate.parse}
     * lee ademas la representacion <i>ampliada</i> de ISO 8601 —con signo y mas de cuatro cifras—,
     * que nadie acordo. (2) PostgreSQL las guarda y las devuelve en esa misma forma: un ano cero o
     * negativo vuelve como {@code 0001-01-01 BC}, uno de cinco cifras con cinco, y fuera de {@code
     * 4713 BC}–{@code 5874897} no las guarda —{@code 22008}—. (3) {@code LocalDate.toString} las
     * escribe sin signo, asi que el mensaje de un 404 nombra la llave como se pidio.
     *
     * <p><b>Por que no el rango de {@code Ejercicio}</b> (1990–2100), que es la otra cota del
     * dominio: {@code vigenciaDesde} no es un ejercicio sino el dia en que empezo a regir una
     * norma, y una que rige desde antes de 1990 compone legitimamente el conjunto de un ejercicio
     * posterior. Acotarla por el ejercicio convertiria en 422 una llave publicable. Dentro de estas
     * cotas, una fecha sin fila publicada es el 404 de siempre, y es verdad.
     */
    private static final LocalDate PRIMER_DIA = LocalDate.of(1, 1, 1);

    private static final LocalDate ULTIMO_DIA = LocalDate.of(9999, 12, 31);

    /** El unico caracter que PostgreSQL no admite en un texto. */
    private static final char NULO = (char) 0;

    /**
     * La llave, con el tipo recortado y la clave en blanco llevada a nulo.
     *
     * <p><b>Los nulos son {@link IllegalArgumentException}, no {@link NullPointerException}</b>
     * (#59, ADR-0043 §6): la llave llega tambien por HTTP, en el cuerpo de {@code POST
     * /conjuntos/{id}/parametros}, y el borde solo traduce el primero a 422. Con el {@code
     * requireNonNull} de antes, un cuerpo sin {@code tipo} o sin {@code vigenciaDesde} salia como
     * 500 con incidencia. El mensaje nombra el campo del cuerpo. El constructor se declara entero,
     * y no compacto, para que sus parametros admitan nulo sin que lo admitan los componentes.
     *
     * @throws IllegalArgumentException si falta el tipo o la vigencia, si el tipo va en blanco, si
     *     el tipo o la clave llevan el caracter nulo, o si la vigencia cae fuera de {@code
     *     0001-01-01} a {@code 9999-12-31}; el mensaje nombra el campo del cuerpo
     */
    public LlaveDeParametro(
            @Nullable String tipo, @Nullable String clave, @Nullable LocalDate vigenciaDesde) {
        if (tipo == null) {
            throw new IllegalArgumentException(
                    "Todo parametro tiene tipo, y la llave no trae ninguno ('tipo')");
        }
        if (vigenciaDesde == null) {
            throw new IllegalArgumentException(
                    "Sin la fecha de vigencia ('vigenciaDesde') la llave no distingue el valor de"
                            + " un ejercicio del de otro");
        }
        sinElCaracterNulo(tipo, "tipo");
        if (clave != null) {
            sinElCaracterNulo(clave, "clave");
        }
        if (vigenciaDesde.isBefore(PRIMER_DIA) || vigenciaDesde.isAfter(ULTIMO_DIA)) {
            throw new IllegalArgumentException(
                    "'vigenciaDesde' tiene que ser una fecha aaaa-mm-dd, de "
                            + PRIMER_DIA
                            + " a "
                            + ULTIMO_DIA
                            + ", y llego "
                            + vigenciaDesde);
        }
        String recortado = tipo.strip();
        if (recortado.isEmpty()) {
            throw new IllegalArgumentException("El tipo de parametro no puede ir vacio");
        }
        this.tipo = recortado;
        this.clave = clave == null || clave.isBlank() ? null : clave.strip();
        this.vigenciaDesde = vigenciaDesde;
    }

    private static void sinElCaracterNulo(String texto, String campo) {
        if (texto.indexOf(NULO) >= 0) {
            throw new IllegalArgumentException(
                    "'"
                            + campo
                            + "' lleva el caracter nulo (U+0000), que PostgreSQL no guarda en un"
                            + " texto: ningun parametro publicado puede llevarlo");
        }
    }

    /**
     * La llave legible, con el mismo formato {@code tipo:clave} que usa {@link
     * kamayuk.normativa.reglas.ParametrosSellados}: lo que se escribe en un informe de carga tiene
     * que poder buscarse tal cual en el mensaje de un parametro ausente.
     */
    @Override
    public String toString() {
        return (clave == null ? tipo : tipo + ":" + clave) + " vigente desde " + vigenciaDesde;
    }
}
