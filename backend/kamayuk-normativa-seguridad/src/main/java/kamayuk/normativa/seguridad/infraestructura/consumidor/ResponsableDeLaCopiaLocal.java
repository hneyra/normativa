package kamayuk.normativa.seguridad.infraestructura.consumidor;

import java.util.Objects;

/**
 * Quien recibe el aviso de que un hecho de la autorizacion se aparto sin aplicar (ADR-0026 §4,
 * aplicado a ADR-0039).
 *
 * <h2>El nombre y el canal son OBLIGATORIOS, y se comprueban al construirlo</h2>
 *
 * <p>ADR-0026 §4 no pide «una alerta»: pide <b>«alerta a una persona con nombre»</b>. Un hecho que
 * no se pudo aplicar deja esta copia diciendo de alguien algo que {@code identidad} ya no dice —un
 * permiso que sigue, una cuenta que entra— y ninguna cifra lo delata.
 *
 * <h2>Y el canal NO tiene que ser una direccion http(s), y eso es una decision MEDIDA</h2>
 *
 * <p>Es la diferencia con {@code ResponsableDeLaProyeccion} de {@code rentas}, que exige {@code
 * http(s)://} para poder comprobar la entrega ejecutandola (C-8). La primera version de esta clase
 * la copio tal cual, y la medida la corrigio: el canal que los ambientes declaran es un CORREO
 * —{@code kamayuk:canalDeOperacion: operaciones@example.pe} en los dos stacks, y {@code
 * KAMAYUK_CANAL_DE_OPERACION} en el {@code .env} de la plataforma—, y es lo que el descriptor pone
 * en {@code KAMAYUK_IDENTIDAD_CONSUMIDOR_CANAL} desde {@code e.operacion.canal}. Exigir http aqui
 * dejaria el {@code Job} de implantacion —que termina con una pasada del consumidor— sin arrancar
 * en ningun ambiente: la regresion de C-7, «el pod no levanta». Es la misma decision, con el mismo
 * motivo, que el carril de {@code catastro} tomo en su {@code ResponsableDelConsumidor} tras medir
 * exactamente lo mismo antes de copiar la clase de {@code rentas}.
 *
 * <p>Asi que el aviso <b>siempre</b> se escribe en el registro con nivel ERROR, con el responsable
 * y su canal dentro, y <b>ademas</b> se entrega con un {@code POST} cuando el canal es una
 * direccion http(s). Lo que cuesta queda dicho: con un correo, la unica constancia es esa linea, y
 * la observabilidad del proyecto (INF-11) alerta sobre ERROR. El defecto latente de {@code rentas}
 * —su {@code CronJob} no arranca con ese mismo canal— es suyo y se declara sin arreglarlo aqui.
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
    }

    public String nombre() {
        return nombre;
    }

    /**
     * Donde se avisa. Una direccion http(s) recibe ademas un POST; cualquier otra —un correo, un
     * telefono— solo se nombra en la linea de ERROR.
     */
    public String canal() {
        return canal;
    }

    /** Si al canal se le puede ENTREGAR el aviso, y no solo nombrarlo. */
    public boolean seLeEntrega() {
        return canal.startsWith("http://") || canal.startsWith("https://");
    }

    @Override
    public String toString() {
        return Objects.requireNonNull(nombre) + " <" + canal + ">";
    }
}
