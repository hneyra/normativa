-- ============================================================================
--  V3 — LA CLAVE DE IDEMPOTENCIA CON LA QUE SE ABRE UN CONJUNTO POR HTTP
--       (ADR-0043 §5, `normativa#59`)
--
--  QUE CAMBIA
--  ----------
--  Hasta esta migracion un conjunto de parametros solo se abria con el proceso
--  `batch` (`AbrirConjuntoDeParametros`), una vez por corrida y con quien lo
--  corria identificado en el registro. ADR-0043 lo publica tambien por HTTP
--  —`POST /conjuntos`—, y por HTTP un reintento es lo normal: la red se corta
--  entre el `COMMIT` y la respuesta, el navegador vuelve a mandar, y cada
--  llamada abre la version `max + 1`. Una version ABIERTA de mas no se puede
--  borrar —`kamayuk_app` no tiene DELETE sobre la tabla (regla 4)— y corre la
--  numeracion del ejercicio para siempre.
--
--  Por eso `POST /conjuntos` exige la cabecera `Idempotency-Key`, y esta
--  migracion trae lo unico que hace falta para que la clave GARANTICE algo: la
--  columna donde se guarda y el indice que impide que la misma clave abra dos
--  conjuntos en la misma municipalidad. La lectura previa por clave contesta
--  el reintento sin escribir; lo que resuelve dos peticiones A LA VEZ es el
--  indice, no la lectura.
--
--  ----------------------------------------------------------------------------
--  LA COLUMNA ES NULA, Y NO HAY NINGUN UPDATE DE RELLENO
--  ----------------------------------------------------------------------------
--
--  Las filas que ya existen las abrio el `batch`, que no lleva clave, y se
--  quedan en NULL: no hay clave que inventarles. Y no se podria aunque la
--  hubiera, por DOS motivos medidos:
--
--  1. `conjunto_sellado_inmutable` (V1, `BEFORE UPDATE`) rechaza con
--     `restrict_violation` todo UPDATE de una fila con `estado = 'SELLADO'`,
--     cambie la columna que cambie. Un UPDATE de relleno romperia esta
--     migracion en toda base que tenga un conjunto sellado —o sea, en toda
--     municipalidad que ya emitio—.
--  2. Y antes aun: el migrador corre como `kamayuk_owner` SIN contexto de
--     tenant, y la tabla lleva `FORCE ROW LEVEL SECURITY`. Un UPDATE desde una
--     migracion muere con `unrecognized configuration parameter
--     "app.municipalidad_id"` en cuanto la tabla tiene una fila
--     (`docs/40-datos/hallazgos-de-rls.md`, hallazgo 4).
--
--  `ADD COLUMN` sin valor por omision no reescribe la tabla ni dispara ningun
--  disparador de fila, y `CREATE UNIQUE INDEX` lee el monton sin pasar por la
--  politica (medido en #588, el mismo hallazgo 4). Las dos sentencias aplican
--  sobre una base con conjuntos sellados; lo fija `LaV3SobreUnConjuntoSelladoTest`.
--
--  ----------------------------------------------------------------------------
--  EL INDICE ES PARCIAL, Y EL AMBITO ES LA MUNICIPALIDAD
--  ----------------------------------------------------------------------------
--
--  `WHERE clave_idempotencia IS NOT NULL`: las filas del `batch` no llevan
--  clave y no chocan entre si. Y `municipalidad_id` va delante porque la clave
--  es de quien la manda: la misma cadena en dos municipalidades son dos
--  peticiones distintas y abren dos conjuntos (ADR-0043 §5, «Ambito»). Un
--  indice sin la municipalidad dejaria que una adivinara las claves de otra
--  por el 409.
--
--  Un indice unico no tiene `NOT VALID`; lo que hace que no pueda pararse al
--  crearse es que su predicado excluye por construccion a toda fila anterior,
--  que acaba de nacer con la columna en NULL (hallazgo 4).
--
--  ----------------------------------------------------------------------------
--  PRIVILEGIOS
--  ----------------------------------------------------------------------------
--
--  Ninguno nuevo. `kamayuk_app` tiene `INSERT, SELECT, UPDATE` DE TABLA sobre
--  `conjunto_parametros` (V1) y no por columna, asi que la columna nueva ya
--  esta cubierta; y `kamayuk_readonly`, `SELECT` de tabla. Sigue sin haber
--  DELETE para nadie.
-- ============================================================================

ALTER TABLE conjunto_parametros ADD COLUMN clave_idempotencia varchar(64);

CREATE UNIQUE INDEX conjunto_idempotencia_uq
    ON conjunto_parametros (municipalidad_id, clave_idempotencia)
    WHERE clave_idempotencia IS NOT NULL;

COMMENT ON COLUMN conjunto_parametros.clave_idempotencia IS
    'La `Idempotency-Key` con la que `POST /conjuntos` abrio este conjunto (ADR-0043 §5): de 1 a '
    '64 caracteres ASCII visibles, comparada byte a byte y sin normalizar. NULL en los que abrio el '
    'proceso batch, que no la lleva. Unica por municipalidad (`conjunto_idempotencia_uq`): un '
    'reintento con la misma clave devuelve este conjunto en vez de abrir otro.';
