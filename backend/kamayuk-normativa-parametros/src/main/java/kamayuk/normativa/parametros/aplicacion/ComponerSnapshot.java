package kamayuk.normativa.parametros.aplicacion;

import java.util.List;
import java.util.Objects;
import kamayuk.normativa.dominio.Ejercicio;
import kamayuk.normativa.parametros.dominio.ConjuntoDeParametros;
import kamayuk.normativa.parametros.dominio.ParametroTributario;
import kamayuk.normativa.parametros.dominio.ParametrosRepository;
import kamayuk.normativa.parametros.dominio.SnapshotDelConjunto;
import kamayuk.normativa.parametros.dominio.SnapshotRepository;
import kamayuk.normativa.reglas.Ambito;
import kamayuk.normativa.reglas.IdentificadorDeConjunto;
import kamayuk.normativa.reglas.LectorDeParametros;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Compone el snapshot de un conjunto <b>sellado</b> (ADR-0025 §1).
 *
 * <p>Solo sellado, y por lo mismo que {@link LectorDeParametros} solo entrega sellados: un conjunto
 * abierto se puede seguir corrigiendo, asi que cachearlo «para siempre» seria cachear algo que
 * manana es otra cosa. Un conjunto abierto no se sirve; se contesta que no esta sellado.
 *
 * <p>La transaccion es <b>una</b> para las cuatro consultas, y no es una optimizacion: el snapshot
 * afirma que ese conjunto contiene exactamente esas filas, y con cuatro transacciones distintas
 * podria componerse a caballo de una publicacion — imposible hoy, porque lo sellado no se toca,
 * pero la afirmacion se sostiene sola en vez de depender de que el disparador siga puesto.
 */
@Service
public class ComponerSnapshot {

    private final ParametrosRepository parametros;
    private final SnapshotRepository cuadros;

    public ComponerSnapshot(ParametrosRepository parametros, SnapshotRepository cuadros) {
        this.parametros = parametros;
        this.cuadros = cuadros;
    }

    /** El snapshot del conjunto sellado que rige hoy el ejercicio. */
    @Transactional(readOnly = true)
    public SnapshotDelConjunto vigenteDe(Ejercicio ejercicio, Ambito ambito) {
        ConjuntoDeParametros conjunto =
                parametros
                        .selladoVigenteDe(ejercicio)
                        .orElseThrow(() -> new LectorDeParametros.EjercicioSinSellar(ejercicio));
        return componer(conjunto, ambito);
    }

    /** El snapshot de un conjunto concreto, sea o no el vigente. Es la lectura del recalculo. */
    @Transactional(readOnly = true)
    public SnapshotDelConjunto porConjunto(IdentificadorDeConjunto identificador, Ambito ambito) {
        ConjuntoDeParametros conjunto =
                parametros
                        .selladoPorId(identificador.valor())
                        .orElseThrow(() -> new LectorDeParametros.ConjuntoNoSellado(identificador));
        return componer(conjunto, ambito);
    }

    private SnapshotDelConjunto componer(ConjuntoDeParametros conjunto, Ambito ambito) {
        long id = Objects.requireNonNull(conjunto.id(), "Un conjunto leido de la base tiene id");
        return new SnapshotDelConjunto(
                id,
                conjunto.ejercicio(),
                conjunto.version(),
                ambito,
                parametros.parametrosDe(id).stream().map(ComponerSnapshot::deParametro).toList(),
                // Los cuadros se reparten por ambito; los parametros van en los dos. El motivo esta
                // en el javadoc de SnapshotDelConjunto: son 33 filas, y lo que pesa son los
                // cuadros.
                ambito == Ambito.OBLIGACION ? List.of() : cuadros.valoresUnitariosDe(id),
                ambito == Ambito.OBLIGACION ? List.of() : cuadros.depreciacionesDe(id),
                ambito == Ambito.VALUACION ? List.of() : cuadros.valoresReferencialesDe(id));
    }

    private static SnapshotDelConjunto.ParametroDelSnapshot deParametro(ParametroTributario p) {
        return new SnapshotDelConjunto.ParametroDelSnapshot(
                p.tipo(),
                p.clave(),
                p.valorNumerico() == null ? null : p.valorNumerico().valor().toPlainString(),
                p.valorTexto(),
                p.vigencia().desde() == null ? null : p.vigencia().desde().toString(),
                p.vigencia().hasta() == null ? null : p.vigencia().hasta().toString(),
                p.documentoFuente());
    }
}
