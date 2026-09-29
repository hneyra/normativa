-- ============================================================================
--  V4 — EL SELLO ESPERA AL DETALLE QUE TODAVIA NO SE CONFIRMO
--       (revision de `normativa#100`, ADR-0043 §7, ADR-0007, ADR-0025)
--
--  QUE CAMBIA
--  ----------
--  Una sola cosa: `detalle_de_conjunto_sellado_es_inmutable()` (V1) lee el
--  estado del conjunto `FOR SHARE` en vez de con un `SELECT` a secas. El
--  cuerpo es el de V1 letra por letra salvo esa clausula, y el codigo y el
--  mensaje del `RAISE` NO cambian: `CausaEnLaBase` reconoce el rechazo por su
--  `SQLState` (`23001`) y por el nombre de la funcion, y quien lo traduce a
--  409 no tiene que enterarse de esta migracion.
--
--  ----------------------------------------------------------------------------
--  LA CARRERA QUE CIERRA: UN CONJUNTO SELLADO QUE GANA UN PARAMETRO
--  ----------------------------------------------------------------------------
--
--  El `SELECT` de V1 no toma ningun candado sobre la fila del conjunto. La
--  clave foranea del detalle toma `FOR KEY SHARE`, y el `UPDATE ... SET
--  estado = 'SELLADO'` toma `FOR NO KEY UPDATE`, que NO choca con aquel. Asi:
--
--    1. A (agregar) inserta el detalle; el disparador ve ABIERTO.
--    2. Antes de que A confirme —le falta su fila de auditoria—, B (sellar)
--       comprueba el contenido, hace su UPDATE sin esperar a nadie y confirma.
--    3. A confirma.
--
--  El conjunto queda SELLADO con un parametro que no estaba cuando se sello, y
--  su snapshot y su `ETag` cambian DESPUES de sellado, que es exactamente lo
--  que ADR-0007 y ADR-0025 dicen que no pasa nunca. Se reprodujo en psql
--  contra PostgreSQL 16 —el sello termino en 0,1 s y el conjunto quedo
--  `SELLADO | {1,2}`— y por HTTP (`sello=200 agrega=201 estado=SELLADO
--  detalles=2`).
--
--  Con `FOR SHARE`, el candado de A choca con el `FOR NO KEY UPDATE` de B, y
--  la carrera se resuelve de una de dos maneras, las dos correctas:
--
--    - A inserto primero: el UPDATE de B ESPERA a que A confirme, y sella con
--      el parametro dentro. Medido: el sello tardo 2,1 s, lo que A tardo en
--      confirmar, y el conjunto quedo `SELLADO | {1,2}` con los dos ya
--      confirmados antes del sello.
--    - B actualizo primero: el disparador de A ESPERA a que B confirme, relee
--      la fila —READ COMMITTED devuelve la version nueva a un `FOR SHARE`— y
--      ve SELLADO: `23001`, con el mismo mensaje. Medido: `SELLADO | {1}`.
--
--  Dos agregados a la vez no se estorban: `FOR SHARE` no choca con `FOR
--  SHARE`.
--
--  ----------------------------------------------------------------------------
--  POR QUE EN LA BASE, Y NO EN EL CASO DE USO
--  ----------------------------------------------------------------------------
--
--  La inmutabilidad de lo sellado es de la base desde V1, y el detalle lo
--  escriben DOS caminos: `POST /conjuntos/{id}/parametros` y el proceso
--  `batch` (`AbrirConjuntoDeParametros`). Un candado tomado en el caso de uso
--  protegeria a quien pasa por el y a nadie mas; el disparador lo toma
--  cualquiera que inserte.
--
--  ----------------------------------------------------------------------------
--  PRIVILEGIOS: `FOR SHARE` EXIGE `UPDATE`, Y SE COMPROBO ANTES DE ELEGIRLO
--  ----------------------------------------------------------------------------
--
--  Un `SELECT ... FOR SHARE` exige privilegio `UPDATE` sobre la tabla, y la
--  funcion es `SECURITY INVOKER` (no se declara otra cosa en V1), asi que ese
--  privilegio lo necesita QUIEN INSERTA el detalle. Medido sobre V1-V3 con
--  `has_table_privilege`:
--
--    rol                    INSERT detalle   UPDATE conjunto_parametros
--    kamayuk_app            si (V1 :678)     si (V1 :680)
--    kamayuk_owner          si (dueno)       si (dueno)
--    kamayuk_readonly       no               no
--    rol_carga_parametros   no               no
--
--  Todo rol que puede insertar el detalle puede bloquear el conjunto, y ningun
--  rol es miembro de otro (`crear-roles.sql` no concede pertenencias). Por eso
--  NO hace falta `SECURITY DEFINER`, que ademas ejecutaria el disparador como
--  `kamayuk_owner` para cualquiera que inserte: no se usa. Lo fija
--  `ElSelloEsperaAlDetalleTest`, que se pone rojo el dia que un `GRANT` le de
--  el detalle a un rol sin `UPDATE` sobre el conjunto.
--
--  Y RLS: un `SELECT ... FOR SHARE` aplica tambien la politica de UPDATE de la
--  tabla. `conjunto_parametros_tenant` es `FOR ALL` y con la misma condicion
--  para leer que para escribir, asi que la fila que el disparador ve es la
--  misma que veia.
--
--  ----------------------------------------------------------------------------
--  POR QUE `CREATE OR REPLACE` Y NO EDITAR V1
--  ----------------------------------------------------------------------------
--
--  V1 ya esta aplicada en las bases que existen, y Flyway valida su suma de
--  comprobacion: editarla haria fallar el arranque de todas ellas. `CREATE OR REPLACE`
--  conserva el OID de la funcion, asi que `detalle_de_conjunto_sellado_inmutable`
--  —el disparador de V1 que la llama— sigue apuntando a ella sin tocarlo. Lo
--  puede hacer `kamayuk_owner`, que es su dueno. No lee ni escribe ninguna fila,
--  asi que aplica igual sobre una base con conjuntos sellados.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detalle_de_conjunto_sellado_es_inmutable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    estado_actual text;
    conjunto      bigint;
BEGIN
    conjunto := COALESCE(NEW.conjunto_id, OLD.conjunto_id);
    SELECT c.estado INTO estado_actual
      FROM conjunto_parametros c
     WHERE c.municipalidad_id = COALESCE(NEW.municipalidad_id, OLD.municipalidad_id)
       AND c.id = conjunto
       FOR SHARE;

    IF estado_actual = 'SELLADO' THEN
        RAISE EXCEPTION
            'El conjunto de parametros % esta sellado: su contenido no cambia (ADR-0007)',
            conjunto
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$function$
;
