package kamayuk.normativa.reglas;

/**
 * De que lado de la frontera de ADR-0024 se aplica una regla.
 *
 * <p>La separacion no es organizativa, es de responsabilidad: <b>{@code catastro} dice cuanto vale
 * un predio y {@code rentas} dice cuanto se debe por el</b>. Las dos cosas se calculan con reglas
 * puras del mismo motor y con parametros del mismo conjunto sellado, asi que nada en el codigo las
 * distinguia — y una regla de obligacion ejecutada dentro de una corrida de valuacion produce una
 * cifra <b>plausible</b>: no revienta, no avisa, y sale mal el autovaluo de todo el padron.
 *
 * <p>Por eso el ambito es <b>obligatorio</b> y no tiene valor por omision: {@link
 * ReglaTributaria#ambito()} y {@link ReglaDeAgregacion#ambito()} son metodos sin cuerpo, de modo
 * que <b>una regla que no lo declare no compila</b>. Una omision que se descubre al compilar no
 * llega a ninguna emision.
 *
 * <p>Y no se comprueba al calcular sino al construir el motor: {@link MotorDeReglas} recibe el
 * ambito con el que va a correr y rechaza <b>el catalogo entero</b> si alguna de sus reglas es de
 * otro. Comprobarlo dentro de {@code aplicarA} lo dejaria fallar en mitad de una corrida de
 * trescientos mil predios, con la mitad del padron ya escrita.
 */
public enum Ambito {

    /**
     * Cuanto vale la cosa. Es de {@code catastro}: valor unitario de edificacion, depreciacion,
     * arancel de la via, area — todo lo que compone el autovaluo (ADR-0024 §2, ADR-0027).
     */
    VALUACION,

    /**
     * Cuanto se debe por ella. Es de {@code rentas}: tramos y alicuotas, minimo imponible,
     * deducciones, plazos, intereses — todo lo que convierte una base imponible en una obligacion.
     */
    OBLIGACION
}
