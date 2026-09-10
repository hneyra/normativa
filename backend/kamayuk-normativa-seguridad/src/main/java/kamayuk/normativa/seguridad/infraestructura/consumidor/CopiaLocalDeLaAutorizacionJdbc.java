package kamayuk.normativa.seguridad.infraestructura.consumidor;

import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Locale;
import kamayuk.normativa.autorizacion.Privilegio;
import kamayuk.normativa.persistencia.RepositorioJdbc;
import kamayuk.normativa.seguridad.dominio.consumidor.CopiaLocalDeLaAutorizacion;
import kamayuk.normativa.seguridad.dominio.consumidor.EventoRecibido;
import kamayuk.normativa.seguridad.dominio.consumidor.TipoDeEventoDeIdentidad;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * La copia local de la autorizacion, escrita desde los hechos de {@code identidad} (etapa 4 de
 * ADR-0039). Es la segunda clase de este sistema que escribe {@code usuario}, {@code grupo}, {@code
 * miembro} y {@code permiso}, y las dos estan declaradas en {@code
 * ConfiguracionDeNormativa.escritoresDeLaAutorizacionConMotivo()}: la primera —el sembrador— hasta
 * la etapa 5; esta, sin fecha de fin, porque ES el consumidor.
 *
 * <h2>Se escribe por CLAVE NATURAL, y es lo que hace que los identificadores no viajen</h2>
 *
 * <p>El {@code sujetoId} del hecho es el identificador del sujeto EN LA BASE DE {@code identidad}.
 * Aqui los identificadores son otros —los asigna esta base al insertar—, asi que cada tipo se
 * aplica por lo que identifica al sujeto en las dos bases: la {@code cuenta} del usuario, el {@code
 * nombre} del grupo, el {@code codigo} de la opcion. Es la misma forma que {@code
 * AplicadorDeReferencia} de {@code identidad} usa para demostrar que su cuerpo alcanza para
 * reconstruir la fila.
 *
 * <h2>Lo que este esquema NO tiene y el emisor si: la columna {@code sistema}</h2>
 *
 * <p>{@code identidad} guarda los catalogos de los CINCO sistemas y su {@code acceso} lleva {@code
 * sistema}; aqui {@code acceso} solo tiene el de {@code normativa} y se llavea por {@code
 * (municipalidad_id, codigo)}. Por eso un {@code PERMISO_FIJADO} se mira ANTES por su {@code
 * sistema}: uno de {@code rentas} sobre una opcion que se llame igual que una de aqui —{@code
 * permisos} lo es en dos catalogos— escribiria aqui un permiso que nadie concedio.
 *
 * <h2>Lo que se escribe se escribe ENTERO, salvo lo que esta base no tiene</h2>
 *
 * <p>{@code usuario.sujeto_oidc} no viaja en el hecho, y aqui se deja como esta; {@code
 * miembro.fecha_alta} y {@code permiso.fecha_registro} las pone la base al insertar. Una baja
 * ({@code habilitado = false}, {@code activo = false}) se aplica como baja: <b>no se borra nada</b>
 * (regla 4), y la fila de la desafiliacion conserva quien la dio de alta.
 *
 * <h2>La deduplicacion va DENTRO de la misma transaccion</h2>
 *
 * <p>Lo primero que hace {@link #aplicar} es anotar el hecho en {@code identidad_evento_aplicado}
 * con {@code ON CONFLICT DO NOTHING}: si la fila ya estaba, el hecho ya se aplico y se devuelve
 * {@link Aplicacion#YA_APLICADO} sin tocar nada. Si la transaccion no confirma, la anotacion
 * tampoco, y el hecho se vuelve a aplicar entero la proxima vez.
 */
public class CopiaLocalDeLaAutorizacionJdbc extends RepositorioJdbc
        implements CopiaLocalDeLaAutorizacion {

    /** El sistema cuyos permisos son de esta copia, tal como `identidad` lo escribe. */
    static final String ESTE_SISTEMA = "normativa";

    /** `motivo` es `varchar(400)`: lo que no cabe se recorta y se dice. */
    private static final int MOTIVO_MAXIMO = 400;

    private static final String SUJETO_GRUPO = "GRUPO";
    private static final String SUJETO_USUARIO = "USUARIO";

    private final JsonMapper json;

    public CopiaLocalDeLaAutorizacionJdbc(JdbcClient jdbc, JsonMapper json) {
        super(jdbc);
        this.json = json;
    }

    @Override
    public Aplicacion aplicar(EventoRecibido evento, Instant cuando) {
        TipoDeEventoDeIdentidad tipo = evento.tipo();
        if (tipo == null) {
            throw new NoSePuedeAplicar(
                    "`identidad` publica un hecho de tipo «"
                            + evento.tipoPublicado()
                            + "» y este sistema no lo conoce. Los que conoce: "
                            + Arrays.toString(TipoDeEventoDeIdentidad.values())
                            + ". No es una capacidad que falte: los siete son la autorizacion"
                            + " entera, asi que hasta que se despliegue una version que lo"
                            + " conozca este hecho no se puede aplicar");
        }
        JsonNode cuerpo = leer(evento);
        if (!anotarComoAplicado(evento, cuando)) {
            return Aplicacion.YA_APLICADO;
        }
        return switch (tipo) {
            case USUARIO_DADO_DE_ALTA, USUARIO_MODIFICADO -> escribirUsuario(cuerpo);
            case GRUPO_DADO_DE_ALTA, GRUPO_MODIFICADO -> escribirGrupo(cuerpo);
            case MIEMBRO_AFILIADO, MIEMBRO_DESAFILIADO -> escribirMiembro(cuerpo, cuando);
            case PERMISO_FIJADO -> escribirPermiso(cuerpo);
        };
    }

    @Override
    public void apartar(EventoRecibido evento, String motivo, Instant cuando) {
        jdbc().sql(
                        "INSERT INTO identidad_evento_muerto (municipalidad_id, evento_id,"
                                + " secuencia, tipo, sujeto_id, cuerpo, huella, motivo,"
                                + " recibido_en)"
                                + " VALUES ("
                                + MUNICIPALIDAD_ACTUAL
                                + ", :evento, :secuencia, :tipo, :sujeto, :cuerpo, :huella,"
                                + " :motivo, :cuando)"
                                + " ON CONFLICT DO NOTHING")
                .param("evento", evento.eventoId())
                .param("secuencia", evento.secuencia())
                .param("tipo", recortar(evento.tipoPublicado(), 40))
                .param("sujeto", evento.sujetoId())
                .param("cuerpo", evento.cuerpo())
                .param("huella", recortar(evento.huella(), 64))
                .param("motivo", recortar(motivo, MOTIVO_MAXIMO))
                .param("cuando", enLaBase(cuando))
                .update();
    }

    @Override
    public @Nullable String filaQueEscribe(EventoRecibido evento) {
        TipoDeEventoDeIdentidad tipo = evento.tipo();
        if (tipo == null) {
            return null;
        }
        JsonNode cuerpo;
        try {
            cuerpo = json.readTree(evento.cuerpo());
        } catch (JacksonException noEsJson) {
            return null;
        }
        if (!cuerpo.isObject()) {
            return null;
        }
        return switch (tipo) {
            case USUARIO_DADO_DE_ALTA, USUARIO_MODIFICADO ->
                    "usuario:" + cuerpo.path("cuenta").asString("");
            case GRUPO_DADO_DE_ALTA, GRUPO_MODIFICADO ->
                    "grupo:" + cuerpo.path("nombre").asString("");
            case MIEMBRO_AFILIADO, MIEMBRO_DESAFILIADO ->
                    "miembro:"
                            + cuerpo.path("grupoNombre").asString("")
                            + "/"
                            + cuerpo.path("usuarioCuenta").asString("");
            case PERMISO_FIJADO ->
                    "permiso:"
                            + cuerpo.path("sujeto").asString("")
                            + "/"
                            + cuerpo.path("sujetoNombre").asString("")
                            + "/"
                            + cuerpo.path("sistema").asString("")
                            + "/"
                            + cuerpo.path("codigo").asString("");
        };
    }

    @Override
    public long apartadosSinExplicar() {
        return jdbc().sql(
                        "SELECT count(*) FROM identidad_evento_muerto"
                                + " WHERE explicacion IS NULL")
                .query(Long.class)
                .single();
    }

    /**
     * Las cuentas de la municipalidad del contexto. La politica RLS de {@code usuario} las acota,
     * asi que esto <b>tiene que correr dentro de una transaccion</b>: sin el {@code SET LOCAL} la
     * politica evalua {@code ''::bigint} y la consulta no devuelve vacio, revienta (la leccion que
     * {@code rentas} pago con sus dos lecturas de la copia local en la etapa 4).
     */
    @Override
    public long cuentasEnLaCopia() {
        return jdbc().sql("SELECT count(*) FROM usuario").query(Long.class).single();
    }

    // ------------------------------------------------------------------ cada tipo

    private Aplicacion escribirUsuario(JsonNode cuerpo) {
        jdbc().sql(
                        "INSERT INTO usuario (municipalidad_id, cuenta, nombre, correo, habilitado,"
                                + " vigencia_desde, vigencia_hasta)"
                                + " VALUES ("
                                + MUNICIPALIDAD_ACTUAL
                                + ", :cuenta, :nombre, :correo, :habilitado, :desde, :hasta)"
                                + " ON CONFLICT (municipalidad_id, cuenta) DO UPDATE SET"
                                + " nombre = EXCLUDED.nombre, correo = EXCLUDED.correo,"
                                + " habilitado = EXCLUDED.habilitado,"
                                + " vigencia_desde = EXCLUDED.vigencia_desde,"
                                + " vigencia_hasta = EXCLUDED.vigencia_hasta")
                .param("cuenta", texto(cuerpo, "cuenta"))
                .param("nombre", texto(cuerpo, "nombre"))
                .param("correo", textoOpcional(cuerpo, "correo"), Types.VARCHAR)
                .param("habilitado", booleano(cuerpo, "habilitado"))
                .param("desde", fecha(cuerpo, "vigenciaDesde"), Types.DATE)
                .param("hasta", fecha(cuerpo, "vigenciaHasta"), Types.DATE)
                .update();
        return Aplicacion.APLICADO;
    }

    private Aplicacion escribirGrupo(JsonNode cuerpo) {
        jdbc().sql(
                        "INSERT INTO grupo (municipalidad_id, nombre, descripcion, habilitado,"
                                + " vigencia_desde, vigencia_hasta)"
                                + " VALUES ("
                                + MUNICIPALIDAD_ACTUAL
                                + ", :nombre, :descripcion, :habilitado, :desde, :hasta)"
                                + " ON CONFLICT (municipalidad_id, nombre) DO UPDATE SET"
                                + " descripcion = EXCLUDED.descripcion,"
                                + " habilitado = EXCLUDED.habilitado,"
                                + " vigencia_desde = EXCLUDED.vigencia_desde,"
                                + " vigencia_hasta = EXCLUDED.vigencia_hasta")
                .param("nombre", texto(cuerpo, "nombre"))
                .param("descripcion", textoOpcional(cuerpo, "descripcion"), Types.VARCHAR)
                .param("habilitado", booleano(cuerpo, "habilitado"))
                .param("desde", fecha(cuerpo, "vigenciaDesde"), Types.DATE)
                .param("hasta", fecha(cuerpo, "vigenciaHasta"), Types.DATE)
                .update();
        return Aplicacion.APLICADO;
    }

    /**
     * La afiliacion y la desafiliacion son la MISMA fila con {@code activo} distinto: una
     * desafiliacion se aplica como baja, con su fecha y quien la dio, y la fila se queda.
     */
    private Aplicacion escribirMiembro(JsonNode cuerpo, Instant cuando) {
        String grupo = texto(cuerpo, "grupoNombre");
        String cuenta = texto(cuerpo, "usuarioCuenta");
        boolean activo = booleano(cuerpo, "activo");
        String usuarioAlta = textoOpcional(cuerpo, "usuarioAlta");
        int escritas =
                jdbc().sql(
                                "INSERT INTO miembro (municipalidad_id, grupo_id, usuario_id,"
                                        + " usuario_alta, activo, fecha_baja, usuario_baja)"
                                        + " SELECT "
                                        + MUNICIPALIDAD_ACTUAL
                                        + ", g.id, u.id, :usuarioAlta, :activo,"
                                        + " CASE WHEN :activo THEN NULL"
                                        + " ELSE CAST(:cuando AS timestamptz) END,"
                                        + " :usuarioBaja"
                                        + " FROM grupo g, usuario u"
                                        + " WHERE g.nombre = :grupo AND u.cuenta = :cuenta"
                                        + " ON CONFLICT (municipalidad_id, grupo_id, usuario_id)"
                                        + " DO UPDATE SET activo = EXCLUDED.activo,"
                                        + " fecha_baja = EXCLUDED.fecha_baja,"
                                        + " usuario_baja = EXCLUDED.usuario_baja")
                        .param("grupo", grupo)
                        .param("cuenta", cuenta)
                        .param("activo", activo)
                        .param("usuarioAlta", usuarioAlta == null ? "identidad" : usuarioAlta)
                        .param("usuarioBaja", textoOpcional(cuerpo, "usuarioBaja"), Types.VARCHAR)
                        .param("cuando", enLaBase(cuando))
                        .update();
        if (escritas != 1) {
            throw dependenciaQueNoLlego(grupo, cuenta);
        }
        return Aplicacion.APLICADO;
    }

    private Aplicacion escribirPermiso(JsonNode cuerpo) {
        String sistema = texto(cuerpo, "sistema");
        String codigo = texto(cuerpo, "codigo");
        if (!ESTE_SISTEMA.equals(sistema)) {
            return Aplicacion.IGNORADO_POR_AJENO;
        }
        if (!hayAcceso(codigo)) {
            throw new NoSePuedeAplicar(
                    "el permiso es sobre la opcion «"
                            + codigo
                            + "» de `normativa`, y esta copia no tiene esa opcion en su catalogo:"
                            + " no hay sobre que fijarlo. O el catalogo de `identidad` y el de"
                            + " este sistema se separaron, o esta instalacion no se implanto");
        }
        String sujeto = texto(cuerpo, "sujeto").toUpperCase(Locale.ROOT);
        String sujetoNombre = texto(cuerpo, "sujetoNombre");
        JsonNode privilegios = cuerpo.path("privilegios");
        StringBuilder columnas = new StringBuilder();
        StringBuilder valores = new StringBuilder();
        StringBuilder cambios = new StringBuilder();
        for (Privilegio privilegio : Privilegio.values()) {
            columnas.append(", ").append(privilegio.columna());
            valores.append(", :").append(privilegio.columna());
            cambios.append(", ")
                    .append(privilegio.columna())
                    .append(" = EXCLUDED.")
                    .append(privilegio.columna());
        }
        String sql;
        if (SUJETO_GRUPO.equals(sujeto)) {
            sql =
                    "INSERT INTO permiso (municipalidad_id, acceso_id, grupo_id, usuario_id,"
                            + " usuario_registro"
                            + columnas
                            + ") SELECT "
                            + MUNICIPALIDAD_ACTUAL
                            + ", a.id, g.id, CAST(NULL AS bigint), :quien"
                            + valores
                            + " FROM acceso a, grupo g"
                            + " WHERE a.codigo = :codigo AND g.nombre = :sujeto"
                            + " ON CONFLICT (municipalidad_id, acceso_id, grupo_id)"
                            + " WHERE grupo_id IS NOT NULL"
                            + " DO UPDATE SET usuario_registro = EXCLUDED.usuario_registro"
                            + cambios;
        } else if (SUJETO_USUARIO.equals(sujeto)) {
            sql =
                    "INSERT INTO permiso (municipalidad_id, acceso_id, grupo_id, usuario_id,"
                            + " usuario_registro"
                            + columnas
                            + ") SELECT "
                            + MUNICIPALIDAD_ACTUAL
                            + ", a.id, CAST(NULL AS bigint), u.id, :quien"
                            + valores
                            + " FROM acceso a, usuario u"
                            + " WHERE a.codigo = :codigo AND u.cuenta = :sujeto"
                            + " ON CONFLICT (municipalidad_id, acceso_id, usuario_id)"
                            + " WHERE usuario_id IS NOT NULL"
                            + " DO UPDATE SET usuario_registro = EXCLUDED.usuario_registro"
                            + cambios;
        } else {
            throw new NoSePuedeAplicar(
                    "el permiso dice que su sujeto es «"
                            + sujeto
                            + "», y solo puede ser GRUPO o USUARIO");
        }
        JdbcClient.StatementSpec sentencia =
                jdbc().sql(sql)
                        .param("codigo", codigo)
                        .param("sujeto", sujetoNombre)
                        .param("quien", texto(cuerpo, "usuarioRegistro"));
        for (Privilegio privilegio : Privilegio.values()) {
            sentencia =
                    sentencia.param(
                            privilegio.columna(), booleano(privilegios, privilegio.columna()));
        }
        if (sentencia.update() != 1) {
            throw new DependenciaQueNoLlego(
                    "el permiso nombra "
                            + (SUJETO_GRUPO.equals(sujeto) ? "el grupo «" : "la cuenta «")
                            + sujetoNombre
                            + "» y esta copia no lo conoce todavia: el hecho que lo da de alta"
                            + " va antes y no ha llegado");
        }
        return Aplicacion.APLICADO;
    }

    // ------------------------------------------------------------------ ayudantes

    private boolean anotarComoAplicado(EventoRecibido evento, Instant cuando) {
        int escritas =
                jdbc().sql(
                                "INSERT INTO identidad_evento_aplicado (municipalidad_id, evento_id,"
                                        + " secuencia, tipo, sujeto_id, huella, aplicado_en)"
                                        + " VALUES ("
                                        + MUNICIPALIDAD_ACTUAL
                                        + ", :evento, :secuencia, :tipo, :sujeto, :huella, :cuando)"
                                        + " ON CONFLICT DO NOTHING")
                        .param("evento", evento.eventoId())
                        .param("secuencia", evento.secuencia())
                        .param("tipo", recortar(evento.tipoPublicado(), 40))
                        .param("sujeto", evento.sujetoId())
                        .param("huella", recortar(evento.huella(), 64))
                        .param("cuando", enLaBase(cuando))
                        .update();
        return escritas == 1;
    }

    private boolean hayAcceso(String codigo) {
        return jdbc().sql("SELECT count(*) FROM acceso WHERE codigo = :codigo")
                        .param("codigo", codigo)
                        .query(Long.class)
                        .single()
                > 0;
    }

    private DependenciaQueNoLlego dependenciaQueNoLlego(String grupo, String cuenta) {
        boolean hayGrupo =
                jdbc().sql("SELECT count(*) FROM grupo WHERE nombre = :nombre")
                                .param("nombre", grupo)
                                .query(Long.class)
                                .single()
                        > 0;
        boolean hayCuenta =
                jdbc().sql("SELECT count(*) FROM usuario WHERE cuenta = :cuenta")
                                .param("cuenta", cuenta)
                                .query(Long.class)
                                .single()
                        > 0;
        return new DependenciaQueNoLlego(
                "el hecho nombra el grupo «"
                        + grupo
                        + "»"
                        + (hayGrupo ? "" : " (que esta copia NO conoce)")
                        + " y la cuenta «"
                        + cuenta
                        + "»"
                        + (hayCuenta ? "" : " (que esta copia NO conoce)")
                        + ": lo que falta llega en un hecho anterior que todavia no se aplico");
    }

    private JsonNode leer(EventoRecibido evento) {
        JsonNode cuerpo;
        try {
            cuerpo = json.readTree(evento.cuerpo());
        } catch (JacksonException ilegible) {
            throw new NoSePuedeAplicar(
                    "el cuerpo del hecho no es JSON (" + ilegible.getOriginalMessage() + ")",
                    ilegible);
        }
        if (cuerpo == null || !cuerpo.isObject()) {
            throw new NoSePuedeAplicar("el cuerpo del hecho no es un objeto JSON");
        }
        return cuerpo;
    }

    private static String texto(JsonNode cuerpo, String campo) {
        JsonNode valor = cuerpo.path(campo);
        if (valor.isMissingNode() || valor.isNull() || valor.asString("").isBlank()) {
            throw new NoSePuedeAplicar(
                    "el cuerpo del hecho no trae «" + campo + "», y sin el no se sabe de quien es");
        }
        return valor.asString();
    }

    private static @Nullable String textoOpcional(JsonNode cuerpo, String campo) {
        JsonNode valor = cuerpo.path(campo);
        if (valor.isMissingNode() || valor.isNull()) {
            return null;
        }
        return valor.asString();
    }

    private static boolean booleano(JsonNode cuerpo, String campo) {
        JsonNode valor = cuerpo.path(campo);
        if (!valor.isBoolean()) {
            throw new NoSePuedeAplicar("el cuerpo del hecho no trae «" + campo + "» como booleano");
        }
        return valor.asBoolean();
    }

    private static @Nullable LocalDate fecha(JsonNode cuerpo, String campo) {
        String texto = textoOpcional(cuerpo, campo);
        if (texto == null || texto.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(texto);
        } catch (DateTimeParseException malFormada) {
            throw new NoSePuedeAplicar(
                    "«" + campo + "» del hecho no es una fecha ISO: " + texto, malFormada);
        }
    }

    private static OffsetDateTime enLaBase(Instant cuando) {
        return cuando.atOffset(ZoneOffset.UTC);
    }

    private static String recortar(String texto, int maximo) {
        return texto.length() <= maximo ? texto : texto.substring(0, maximo);
    }
}
