/**
 * La copia local de usuarios, grupos y permisos, y lo que la siembra.
 *
 * <h2>Por que este modulo existe en `normativa` y no solo en {@code rentas}</h2>
 *
 * <p>Lo decidio <b>D-N5</b> (2026-09-03): «usuarios, grupos y permisos se definen en Keycloak; cada
 * sistema guarda una copia local en tabla y su guardia la consulta». Con eso <b>D-19</b> quedo
 * contestada — el {@link kamayuk.normativa.autorizacion.ComprobadorDeAcceso} de cada sistema
 * pregunta a su propia tabla, <b>no a otro sistema por HTTP</b>.
 *
 * <p>La alternativa medida y descartada era preguntarle a {@code rentas} en cada peticion: el
 * guardia corre en un {@code preHandle}, asi que seria un viaje de red por peticion y, sobre todo,
 * {@code rentas} caido dejaria a {@code normativa} sin poder autorizar nada. Una comprobacion de
 * acceso que depende de la disponibilidad de otro despliegue no es una comprobacion de acceso: es
 * un acoplamiento con forma de politica de seguridad.
 *
 * <h2>Lo que aqui NO hay, y es deliberado</h2>
 *
 * <p>No hay pantallas de administracion de seguridad. Las nueve escrituras de grupos, usuarios,
 * miembros y permisos viven <b>solo en {@code rentas}</b> (ADR-0030 §3: los cuatro frontends leen
 * {@code rentas/api/v1/sesion/permisos}). Aqui hay dos cosas: quien <b>lee</b> la copia para
 * autorizar, y quien la <b>siembra</b> al implantar la municipalidad.
 *
 * <p><b>El hueco que D-N5 dejo declarado esta cerrado desde la etapa 4 de ADR-0039</b>: la copia la
 * escribe ademas el consumidor del buzon de {@code identidad} ({@code dominio.consumidor}, {@code
 * aplicacion.ConsumirEventosDeIdentidad}, {@code infraestructura.consumidor}). Lee los hechos que
 * aquel sistema publica —altas, bajas, afiliaciones y permisos—, los aplica aqui uno por
 * transaccion y los acusa despues del commit; un {@code CronJob} lo despierta cada cinco minutos y
 * la implantacion hace una pasada al terminar de sembrar. <b>Lo que cuesta se dice</b>: es la
 * primera arista de este sistema hacia otro, y entre que {@code identidad} escribe y este
 * consumidor aplica hay una ventana en la que la copia esta desatrasada — cuanto dura esta por
 * medir (ADR-0039 §«Lo que cuesta», punto 2). El guardia sigue leyendo su propia tabla: con {@code
 * identidad} caido este sistema autoriza igual, y lo unico que no pasa es que un permiso nuevo
 * llegue.
 *
 * <p>El sembrador se queda hasta la etapa 5: hoy es lo que deja el primer administrador, y una
 * municipalidad sin consumidor configurado sigue siendo un estado legitimo.
 */
@org.jspecify.annotations.NullMarked
package kamayuk.normativa.seguridad;
