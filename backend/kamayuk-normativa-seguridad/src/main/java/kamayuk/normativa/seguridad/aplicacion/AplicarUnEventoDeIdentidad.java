package kamayuk.normativa.seguridad.aplicacion;

import java.time.Instant;
import kamayuk.normativa.seguridad.dominio.consumidor.CopiaLocalDeLaAutorizacion;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;
import org.jspecify.annotations.Nullable;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * UN hecho, UNA transaccion (etapa 4 de ADR-0039, AC-2 de {@code identidad#4}).
 *
 * <h2>Por que {@code REQUIRES_NEW} y no {@code REQUIRED}</h2>
 *
 * <p>La politica RLS de las cuatro tablas lee {@code app.municipalidad_id}, que el gestor de
 * transacciones fija con {@code SET LOCAL} <b>al abrir la transaccion</b> desde {@code
 * TenantContext}. Con {@code REQUIRED}, un llamador que ya tuviera una transaccion abierta —una
 * implantacion que recorriera dos municipalidades, una prueba— dejaria a este metodo escribiendo
 * bajo el {@code SET LOCAL} de OTRA municipalidad: las filas de B irian a A, sin un solo error,
 * porque las escrituras ponen {@code current_setting(...)} y no un parametro. Con {@code
 * REQUIRES_NEW} cada hecho abre su propia conexion con su propio {@code SET LOCAL}, y lo que queda
 * confirmado al volver es exactamente ese hecho.
 *
 * <p>Y por lo mismo el acuse va DESPUES de volver de aqui: lo que vuelve esta confirmado, y lo que
 * lanzo no lo esta. Un acuse dentro de la transaccion —«una transaccion por vuelta, mas barato»— se
 * ejecuta antes del {@code COMMIT}, y un {@code COMMIT} que falla despues de acusar deja el hecho
 * perdido para siempre: {@code identidad} no vuelve a servir lo acusado.
 *
 * <p>Usa el gestor por omision de la aplicacion —{@code TenantTransactionManager} sobre el pool de
 * {@code kamayuk_app}—, que es quien tiene {@code INSERT/SELECT/UPDATE} sobre las cuatro tablas
 * desde el baseline. No hace falta un segundo rol ni un segundo pool, y por eso no hay un gestor
 * con nombre como en el ingestor de {@code rentas}.
 */
public class AplicarUnEventoDeIdentidad {

    private final CopiaLocalDeLaAutorizacion copia;

    public AplicarUnEventoDeIdentidad(CopiaLocalDeLaAutorizacion copia) {
        this.copia = copia;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public CopiaLocalDeLaAutorizacion.Aplicacion aplicar(EventoRecibido evento, Instant cuando) {
        return copia.aplicar(evento, cuando);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void apartar(EventoRecibido evento, String motivo, Instant cuando) {
        copia.apartar(evento, motivo, cuando);
    }

    /**
     * La fila que ese hecho escribe, en clave natural. <b>Sin transaccion a proposito</b>: lee el
     * cuerpo del hecho y no toca la base, y quien lo llama lo hace ANTES de decidir si abre una.
     */
    public @Nullable String filaQueEscribe(EventoRecibido evento) {
        return copia.filaQueEscribe(evento);
    }

    @Transactional(readOnly = true)
    public long apartadosSinExplicar() {
        return copia.apartadosSinExplicar();
    }

    /**
     * Cuantas cuentas dejo la copia local. <b>Transaccional a proposito</b>, como la de arriba: la
     * politica RLS de {@code usuario} lee {@code app.municipalidad_id} y sin el {@code SET LOCAL}
     * que abre la transaccion esta consulta no devuelve cero, revienta.
     */
    @Transactional(readOnly = true)
    public long cuentasEnLaCopia() {
        return copia.cuentasEnLaCopia();
    }
}
