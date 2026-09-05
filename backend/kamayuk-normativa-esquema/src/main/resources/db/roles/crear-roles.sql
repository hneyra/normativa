-- ============================================================================
--  SGTM — Roles de base de datos (ARQ-03 §4)
--
--  NO es una migracion de Flyway. Se ejecuta ANTES de la primera migracion, con
--  una conexion de superusuario, porque:
--    - las politicas RLS de V6 nombran roles y estos deben existir;
--    - kamayuk_owner necesita CREATE sobre el esquema para poder migrar;
--    - un rol no puede crearse a si mismo.
--
--  Idempotente: se puede volver a ejecutar sobre una base ya provisionada.
--
--  Las CLAVES NO ESTAN AQUI. Los roles se crean sin LOGIN; quien provisiona el
--  ambiente asigna la clave con `ALTER ROLE ... LOGIN PASSWORD ...` desde su
--  gestor de secretos. La prueba de aislamiento hace lo mismo con claves
--  generadas al vuelo.
--
--  NOSUPERUSER y NOBYPASSRLS son explicitos y no decorativos: un superusuario
--  omite RLS incluso con FORCE ROW LEVEL SECURITY (DAT-01 §0, hallazgo 1).
-- ============================================================================

DO $roles$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['kamayuk_owner', 'kamayuk_app', 'kamayuk_readonly', 'rol_carga_parametros']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
        EXECUTE format(
            'ALTER ROLE %I NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION', r);
    END LOOP;
END
$roles$;

-- Solo kamayuk_owner hace DDL. La aplicacion nunca.
GRANT USAGE, CREATE ON SCHEMA public TO kamayuk_owner;
GRANT USAGE           ON SCHEMA public TO kamayuk_app, kamayuk_readonly, rol_carga_parametros;

-- Sin GRANT de pertenencia entre roles: kamayuk_owner concede privilegios sobre sus
-- propias tablas sin necesitarla, y ser miembro de kamayuk_app le permitiria un
-- SET ROLE que borra la separacion.

-- ---------- Extensiones: NINGUNA (C-13) ----------
-- Este esquema no crea ni una. No es limpieza: es que `normativa` guarda valores
-- normativos versionados y sellados, y ninguna de las cuatro que este archivo
-- declaraba tiene nada que hacer aqui. Medido migracion por migracion sobre su
-- unico `V1__baseline.sql`, y vigilado desde `infrastructure` por
-- `extensiones-de-las-migraciones.ts`, que lo comprueba en las DOS direcciones:
--
--   pg_trgm     la busqueda por aproximacion de nombre es del PADRON de
--               contribuyentes (RF-014), que es de `rentas`. Aqui no hay una sola
--               llamada a similarity() ni un indice con gin_trgm_ops.
--   unaccent    lo que la obligaria es la funcion `nombre_normalizado(text)`,
--               cuyo cuerpo la llama — y P5B la retiro de este baseline por ser
--               de `catastro`, dicho en su propia seccion 2. No queda ninguna
--               llamada a unaccent() en el esquema.
--   postgis     la geometria del predio es de `catastro` (ADR-0021). Era la mas
--               cara de las cuatro: NO es trusted —medido: `SELECT trusted FROM
--               pg_available_extension_versions WHERE name='postgis'` da `f`—,
--               asi que obligaba a un superusuario y a la imagen postgis/postgis
--               para provisionar una base que no dibuja nada. Y no se quedaba
--               quieta: su tabla `spatial_ref_sys` obligaba a una exencion en el
--               AislamientoMultiTenantTest de este modulo, o sea que una
--               declaracion de mas se propagaba a la lista de excepciones de la
--               barrera numero uno. Esa exencion se fue con ella.
--   btree_gist  la exclusion de vigencias que no se pisan es de `catastro`
--               (#669, V72). Este baseline no tiene un solo EXCLUDE USING gist.
--
-- Las cuatro venian del archivo que P3 copio del monolito, que P5D si podo en
-- `caja` y P5E en `rentas`, y que aqui no se habia decidido. Retirarlas no toca
-- ningun ambiente ya provisionado —no hay ningun DROP EXTENSION—: lo que cambia
-- es que una base NUEVA no las recibe, y que `05-crear-bases.sh` deja de crearlas
-- en la base de este sistema (C-10). El dia que una migracion de aqui necesite
-- una, la guarda de `infrastructure` se pone roja nombrando la migracion y la
-- extension, antes de que llegue a ningun motor.

-- ---------- CONNECT sobre esta base ----------
--  PostgreSQL concede `CONNECT` a PUBLIC al crear una base, asi que TODO rol del cluster puede
--  conectarse a la de cualquier sistema sin que nadie se lo haya dado. Se midio (C-7 §6): sobre
--  una base recien creada, `has_database_privilege('<un rol cualquiera>', '<esa base>', 'CONNECT')`
--  devuelve `true`; tras el `REVOKE ... FROM PUBLIC`, `false`.
--
--  Los roles son del CLUSTER y los cuatro sistemas lo comparten, de modo que sin esto la
--  credencial de carga de valores normativos —y la de la aplicacion de cualquier otro sistema—
--  puede abrir una sesion contra esta base. No veria filas —RLS esta forzada— pero seria una
--  credencial de mas apuntando a un padron, que es exactamente lo que #155 midio con el rol del
--  respaldo y lo que `30-base-de-keycloak.sh` ya hace con la base del monolito.
--
--  `rol_carga_parametros` SI esta, y es el unico sitio donde tiene sentido: es la
--  unica credencial que puede escribir un valor normativo (ADR-0007 §5), y sus cuatro politicas
--  de escritura estan en `V1` de este esquema.
--
--  Va aqui y no en una migracion porque `REVOKE ... ON DATABASE` solo lo puede hacer quien la
--  posee, y `kamayuk_owner` —que es quien migra— a proposito NO es dueno de la base (#722 lo midio:
--  «permission denied for database»). Este guion corre como superusuario.
DO $connect$
DECLARE
    base text := current_database();
BEGIN
    EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', base);
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO kamayuk_owner, kamayuk_app, kamayuk_readonly, rol_carga_parametros', base);
END
$connect$;
