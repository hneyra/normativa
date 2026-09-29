package kamayuk.normativa.parametros.dominio;

import java.util.Arrays;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;

/**
 * Lo que declara quien sella sobre el arancel vial de su municipalidad: el punto 3 de «Antes de
 * sellar» (ADR-0043 §8, {@code valores-normativos/publicacion/README.md}).
 *
 * <h2>{@code normativa} no comprueba el arancel</h2>
 *
 * <p><b>Normativa no puede comprobar si esta cargado, y no lo va a comprobar: la tabla es de
 * catastro.</b> {@code arancel} es de {@code catastro}, la undecima regla prohibe consultarla desde
 * aqui, y ninguna ruta de este sistema llama a otro <b>para sellar</b> (CLAUDE.md). Asi que este
 * tipo no es una verificacion: es <b>quien dijo que, cuando y con que observacion</b>. Prueba lo
 * que alguien declaro, no que el arancel este cargado.
 *
 * <h2>Dos valores, ninguno por omision</h2>
 *
 * <p>Son las dos frases que la interfaz ofrece antes de sellar (ADR-0043 §8), y ninguna viene
 * marcada. Son dos y no una casilla «confirmo que esta cargado» porque el propio README sello 2026
 * <b>sabiendo</b> que no lo estaba: una sola casilla empujaria a declarar lo contrario de lo que se
 * sabe para poder hacer lo que el repositorio ya hizo con motivo. Y no hay valor por omision: un
 * valor por omision seria una declaracion que nadie hizo.
 *
 * <h2>Donde queda</h2>
 *
 * <p><b>Solo</b> en el {@code datos_nuevos} de la fila {@code MODIFICACION} de la auditoria del
 * sellado, junto a {@code "comprobadoPorNormativa":false}, que vale siempre {@code false} para que
 * quien lea la fila sin haber leido el ADR no la tome por una verificacion. <b>No</b> va en {@code
 * conjunto_parametros} ni en el snapshot: no es una propiedad del conjunto sino lo que alguien dijo
 * al sellarlo, y un consumidor que la leyera la trataria como un hecho.
 */
public enum DeclaracionDelArancel {

    /** «Declaro que el arancel de esta municipalidad esta cargado contra este conjunto.» */
    DECLARADO_CARGADO,

    /**
     * «Sello sabiendo que el arancel de esta municipalidad no esta cargado contra este conjunto.»
     */
    SIN_CARGAR;

    /** El nombre del campo del cuerpo de {@code POST /conjuntos/{id}/sellar} que la trae. */
    public static final String CAMPO = "arancelDeLaMunicipalidad";

    /**
     * La declaracion que nombra ese texto, tal cual: sin recortar y sin pasar a mayusculas.
     *
     * <p>Admite nulo porque es lo que llega de un campo ausente, y el rechazo tiene que ser un 422
     * que nombra el campo y no un 500 (ADR-0043 §7).
     *
     * @throws IllegalArgumentException si falta o no es uno de los dos valores
     */
    public static DeclaracionDelArancel de(@Nullable String valor) {
        for (DeclaracionDelArancel declaracion : values()) {
            if (declaracion.name().equals(valor)) {
                return declaracion;
            }
        }
        throw new IllegalArgumentException(
                "'"
                        + CAMPO
                        + "' admite "
                        + admitidos()
                        + (valor == null ? ", y no llego ninguno" : ", y llego '" + valor + "'")
                        + ". No hay valor por omision: normativa no comprueba el arancel, y lo que"
                        + " se guarda es lo que declara quien sella (ADR-0043 §8)");
    }

    private static String admitidos() {
        return Arrays.stream(values())
                .map(declaracion -> "'" + declaracion.name() + "'")
                .collect(Collectors.joining(" o "));
    }
}
