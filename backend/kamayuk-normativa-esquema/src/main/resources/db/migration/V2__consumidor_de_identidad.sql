-- ============================================================================
--  V2 — LO QUE EL CONSUMIDOR DEL BUZON DE `identidad` DEJA EN ESTA BASE
--       (etapa 4 de `infrastructure#52`, ADR-0039, ADR-0028 §3, `identidad#4`)
--
--  QUE CAMBIA
--  ----------
--  Hasta esta migracion la copia local de la autorizacion —`usuario`, `grupo`,
--  `miembro`, `permiso`— la escribia UNA sola cosa: la implantacion, al sembrar
--  el primer administrador. Un permiso concedido despues NO llegaba, y el
--  `package-info` del modulo `seguridad` lo declaraba como HUECO desde D-N5.
--
--  Desde la etapa 4 la escribe ademas el consumidor del buzon de `identidad`:
--  lee los hechos que aquel sistema publica (`GET /identidad/api/v1/eventos/
--  pendientes`), los aplica aqui, y los acusa (`POST …/eventos/acuses`). Lo que
--  esta migracion trae es lo que ese consumidor necesita GUARDAR para hacerlo
--  bien, y no toca ninguna de las cuatro tablas de la autorizacion.
--
--  ----------------------------------------------------------------------------
--  DOS TABLAS, Y POR QUE HACEN FALTA LAS DOS
--  ----------------------------------------------------------------------------
--
--  `identidad_evento_aplicado`: QUE hecho ya se aplico aqui. La entrega es AL
--  MENOS UNA VEZ (ADR-0028 §3): un acuse que no llega —la red se corto entre
--  el commit y el acuse, el proceso murio— hace que `identidad` vuelva a servir
--  el hecho, y sin esta tabla se aplicaria dos veces. La clave primaria lleva
--  el `evento_id` y se inserta EN LA MISMA TRANSACCION que la escritura sobre
--  la copia local: si la fila esta, la escritura esta, y un `ON CONFLICT DO
--  NOTHING` que no escribe dice «ya aplicado» sin tocar nada.
--
--  `identidad_evento_muerto`: lo que NO se pudo aplicar y NUNCA se va a poder
--  —un cuerpo que no es JSON, un tipo que este sistema no conoce, un permiso
--  sobre una opcion que este catalogo no tiene—. Se aparta CON SU CUERPO y su
--  motivo, se acusa, y se avisa al responsable: dejarlo en el buzon bloquearia
--  la cola detras de el, y descartarlo en silencio dejaria la copia
--  desatrasada sin que nada lo dijera —que es el defecto que `rentas`#54 midio
--  con su ingestor—. Lo que NO se aparta es lo que no se puede aplicar HOY (la
--  base caida, un grupo que todavia no llego): eso no se acusa y se reintenta.
--
--  ----------------------------------------------------------------------------
--  `cuerpo` ES `text` Y NO `jsonb`, A PROPOSITO (la leccion de `rentas` V12)
--  ----------------------------------------------------------------------------
--
--  Lo que se aparta se aparta PORQUE no se pudo aplicar, y una de las causas es
--  que el cuerpo no sea JSON. Una columna `jsonb` rechazaria justamente la fila
--  que esta tabla existe para conservar, y el hecho se perderia en el momento
--  de apartarlo. Se guarda tal como llego.
--
--  ----------------------------------------------------------------------------
--  RLS EN LAS DOS, Y `FORCE` EN LAS DOS
--  ----------------------------------------------------------------------------
--
--  Las dos llevan `municipalidad_id` y son de tenant: lo que una municipalidad
--  aplico o aparto es suyo. Sin `FORCE` el dueno de la tabla omitiria la
--  politica (DAT-01 §0, hallazgo 1), y aqui el hallazgo 1 pesa el doble porque
--  lo que se protege es quien puede hacer que.
--
--  ----------------------------------------------------------------------------
--  PRIVILEGIOS
--  ----------------------------------------------------------------------------
--
--  El consumidor corre como `kamayuk_app` —el mismo pool que la aplicacion, que
--  ya tiene INSERT/SELECT/UPDATE sobre las cuatro tablas de la autorizacion—.
--  `identidad_evento_aplicado` se INSERTA y se LEE, y nada mas: es la constancia
--  de que un hecho entro, y una constancia no se edita ni se borra (regla 4).
--  `identidad_evento_muerto` admite ademas UPDATE, por una sola columna: la
--  explicacion de quien atendio el aviso. Ninguna de las dos admite DELETE.
-- ============================================================================

CREATE TABLE identidad_evento_aplicado (
    municipalidad_id bigint       NOT NULL REFERENCES municipalidad (id),
    evento_id        uuid         NOT NULL,
    secuencia        bigint       NOT NULL,
    tipo             varchar(40)  NOT NULL,
    sujeto_id        bigint       NOT NULL,
    huella           char(64)     NOT NULL,
    aplicado_en      timestamptz  NOT NULL,

    CONSTRAINT identidad_evento_aplicado_pk PRIMARY KEY (municipalidad_id, evento_id)
);

COMMENT ON TABLE identidad_evento_aplicado IS
    'Que hecho del buzon de `identidad` ya se aplico a la copia local de la autorizacion de este '
    'sistema (etapa 4, ADR-0039). La entrega es al menos una vez: esta fila es lo que hace que un '
    'hecho servido dos veces se aplique una. Se inserta en la MISMA transaccion que la escritura.';
COMMENT ON COLUMN identidad_evento_aplicado.evento_id IS
    'El identificador del hecho tal como `identidad` lo publica: es lo que se acusa y por lo que '
    'se deduplica. La secuencia ordena la entrega y no lo identifica.';
COMMENT ON COLUMN identidad_evento_aplicado.aplicado_en IS
    'Con el reloj de la aplicacion y no con `now()` de la base: el motor es otro proceso y una '
    'fecha que pone la base no se puede fijar en una prueba.';

CREATE TABLE identidad_evento_muerto (
    municipalidad_id bigint       NOT NULL REFERENCES municipalidad (id),
    evento_id        uuid         NOT NULL,
    secuencia        bigint       NOT NULL,
    tipo             varchar(40)  NOT NULL,
    sujeto_id        bigint       NOT NULL,
    cuerpo           text         NOT NULL,
    huella           char(64)     NOT NULL,
    motivo           varchar(400) NOT NULL,
    recibido_en      timestamptz  NOT NULL,
    explicacion      varchar(400),
    explicado_en     timestamptz,

    CONSTRAINT identidad_evento_muerto_pk PRIMARY KEY (municipalidad_id, evento_id),
    CONSTRAINT identidad_evento_muerto_motivo_ck CHECK (length(motivo) >= 5),
    CONSTRAINT identidad_evento_muerto_explicacion_ck
        CHECK ((explicacion IS NULL) = (explicado_en IS NULL))
);

-- Lo que el responsable tiene pendiente de mirar: es lo que cuenta el aviso.
CREATE INDEX identidad_evento_muerto_sin_explicar_ix
    ON identidad_evento_muerto (municipalidad_id, recibido_en)
    WHERE explicacion IS NULL;

COMMENT ON TABLE identidad_evento_muerto IS
    'Los hechos del buzon de `identidad` que este sistema NO pudo aplicar y NUNCA va a poder '
    '(cuerpo ilegible, tipo desconocido, opcion que este catalogo no tiene). Se apartan con su '
    'cuerpo y su motivo, se acusan y se avisa al responsable. Lo que no se puede aplicar HOY no '
    'entra aqui: no se acusa y se reintenta.';
COMMENT ON COLUMN identidad_evento_muerto.cuerpo IS
    '`text` y no `jsonb` a proposito: una de las causas de apartar un hecho es que su cuerpo no '
    'sea JSON, y una columna jsonb rechazaria justo la fila que esta tabla existe para conservar.';
COMMENT ON COLUMN identidad_evento_muerto.explicacion IS
    'Lo que decidio quien atendio el aviso. Mientras sea NULL el hecho cuenta como pendiente y el '
    'aviso lo dice; con ella y `explicado_en` puestos, deja de contar.';

-- ----------------------------------------------------------------------------
--  RLS. Sin valor por omision: sin contexto de tenant, la consulta FALLA.
-- ----------------------------------------------------------------------------

ALTER TABLE identidad_evento_aplicado ENABLE ROW LEVEL SECURITY;
ALTER TABLE identidad_evento_aplicado FORCE ROW LEVEL SECURITY;
CREATE POLICY identidad_evento_aplicado_tenant ON identidad_evento_aplicado FOR ALL TO PUBLIC
    USING ((municipalidad_id = (current_setting('app.municipalidad_id'::text))::bigint))
    WITH CHECK ((municipalidad_id = (current_setting('app.municipalidad_id'::text))::bigint));

ALTER TABLE identidad_evento_muerto ENABLE ROW LEVEL SECURITY;
ALTER TABLE identidad_evento_muerto FORCE ROW LEVEL SECURITY;
CREATE POLICY identidad_evento_muerto_tenant ON identidad_evento_muerto FOR ALL TO PUBLIC
    USING ((municipalidad_id = (current_setting('app.municipalidad_id'::text))::bigint))
    WITH CHECK ((municipalidad_id = (current_setting('app.municipalidad_id'::text))::bigint));

-- ----------------------------------------------------------------------------
--  PRIVILEGIOS. Ver la cabecera: ni una ni otra admiten DELETE.
-- ----------------------------------------------------------------------------

GRANT INSERT, SELECT         ON identidad_evento_aplicado TO kamayuk_app;
GRANT SELECT                 ON identidad_evento_aplicado TO kamayuk_readonly;
GRANT INSERT, SELECT, UPDATE ON identidad_evento_muerto   TO kamayuk_app;
GRANT SELECT                 ON identidad_evento_muerto   TO kamayuk_readonly;
