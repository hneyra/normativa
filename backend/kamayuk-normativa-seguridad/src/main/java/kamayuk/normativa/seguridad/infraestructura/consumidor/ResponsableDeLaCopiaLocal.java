package kamayuk.normativa.seguridad.infraestructura.consumidor;

import java.util.Objects;

/**
 * Quien recibe el aviso de que un hecho de la autorizacion se aparto sin aplicar.
 *
 * <p>Nombre y canal, y los dos obligatorios: sin nombre nadie es responsable, y un canal que no sea
 * una direccion http(s) no se puede ejercitar — P5D dejo la alerta de {@code caja} declarada como
 * «construida y no medida» precisamente porque su canal era texto libre. Es la misma clase que
 * {@code ResponsableDeLaProyeccion} de {@code rentas}, con las propiedades de este sistema.
 */
public class ResponsableDeLaCopiaLocal {

    private final String nombre;
    private final String canal;

    public ResponsableDeLaCopiaLocal(String nombre, String canal) {
        this.nombre = nombre.strip();
        this.canal = canal.strip();
        if (this.nombre.isEmpty() || this.canal.isEmpty()) {
            throw new IllegalStateException(
                    "Faltan kamayuk.identidad.consumidor.responsable y/o .canal. No son"
                            + " opcionales: un hecho de la autorizacion que no se pudo aplicar"
                            + " deja la copia local diciendo de alguien algo que `identidad` ya"
                            + " no dice, y ninguna cifra lo delata. El consumidor no arranca"
                            + " hasta que alguien diga quien recibe ese aviso");
        }
        if (!this.canal.startsWith("http://") && !this.canal.startsWith("https://")) {
            throw new IllegalStateException(
                    "kamayuk.identidad.consumidor.canal tiene que ser una direccion http(s) a la"
                            + " que se pueda entregar el aviso, y llego «"
                            + this.canal
                            + "»");
        }
    }

    public String nombre() {
        return nombre;
    }

    public String canal() {
        return canal;
    }

    @Override
    public String toString() {
        return Objects.requireNonNull(nombre) + " <" + canal + ">";
    }
}
