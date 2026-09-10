/**
 * El descriptor de infraestructura de `normativa` (`ADR-0031` §2).
 *
 * Parametros versionados y sellados, corpus normativo y el catalogo de reglas.
 *
 * ## Que es esto, y por que son funciones puras
 *
 * `infrastructure` lo importa, **fija su version**, lo compone y **lo audita con las mismas
 * reglas que audita los suyos**. Eso solo es posible porque lo que hay aqui son **funciones
 * puras que devuelven objetos planos de Kubernetes**: `infrastructure` recibe datos, puede
 * leerlos y puede negarse a aplicarlos. Si este archivo creara recursos —un `pulumi.Input`, una
 * conexion, una lectura de `process.env`—, la auditoria no tendria nada que leer y la unica
 * garantia seria la confianza en quien lo escribio.
 *
 * ## Lo que este archivo NO puede hacer
 *
 * Cinco cosas, y `infrastructure` las rechaza: una ruta fuera de su prefijo, **la etiqueta de la
 * imagen** —la pone `infrastructure`, o cada liberacion vuelve a ser un `pulumi up`—, privilegios
 * sobre la base de otro sistema, un `Deployment` sin limites ni sondas, y un `Secret` en claro.
 *
 * ## UN SOLO EGRESO A OTRO SISTEMA: el buzon de `identidad` (ADR-0039, etapa 4)
 *
 * Hasta la etapa 4 de ADR-0039 este descriptor decia «SIN EGRESO A NINGUN SISTEMA, y no es que
 * aun no le haga falta», y era cierto sobre lo que `normativa` PUBLICA: conjuntos sellados
 * —inmutables una vez sellados (`V9`)— y un artefacto de reglas que viaja como codigo
 * (`ADR-0025` §2). Nada de eso necesita preguntarle nada a nadie, y sigue sin necesitarlo.
 *
 * Lo que si necesita —y no lo necesitaba porque lo sembraba a mano— es **de donde sale su copia
 * local de la autorizacion**: las cuatro tablas `usuario`, `grupo`, `miembro` y `permiso` con las
 * que `ComprobadorDeAccesoJdbc` autoriza sin un viaje de red. ADR-0039 §«Lo que cuesta» contesta
 * la pregunta que la cabecera anterior dejaba escrita («que dato de otro sistema hace falta para
 * sellar una cifra que la ley ya fijo»): **ninguno**. Leer el buzon de `identidad` no es consultar
 * un dato de negocio: es **replicar la autorizacion**, que desde ADR-0039 tiene un dueno y ese
 * dueno no es este sistema. Es la unica arista de egreso hacia un sistema, se declara con su
 * motivo en `egreso()`, y **no cambia nada de lo que ADR-0025 afirma**: para sellar, `normativa`
 * sigue sin llamar a nadie.
 *
 * Y la arista es del `CronJob` de `lotes()` y del `Job` de implantacion —los dos en perfil
 * `batch`—, no del proceso web: el guardia sigue autorizando contra la copia local, y con
 * `identidad` caido la ventanilla sigue leyendo sus parametros (ADR-0039 §«Lo que cuesta», 2).
 *
 * ## Todavia no hay codigo de negocio
 *
 * Los `Deployment` apuntan a imagenes que **aun no existen**. Es correcto en esta etapa: describe
 * como se desplegaria este sistema, y no se despliega nada.
 */

import type {
  BaseDeDatosDeclarada,
  ClaveDeclarada,
  Contenedor,
  CronJob,
  DescriptorDeSistema,
  EntornoDelDescriptor,
  Manifiesto,
  NetworkPolicy,
  PanelDeclarado,
  ReglaDeAlerta,
  VariableDeEntorno,
} from "@kamayuk/infra-contrato";

const SISTEMA = "normativa";

/** La imagen del migrador: el otro objetivo del mismo `Dockerfile` (C-14, punto 1). */
const MIGRADOR = `${SISTEMA}-migrador`;

/**
 * Su base, en el motor de la plataforma. Una por sistema (ADR-0029, ADR-0032).
 *
 * **El anfitrion lo pide, no lo escribe** (C-17, punto 1). Hasta aqui esta linea decia
 * `jdbc:postgresql://postgres:5432/...`, y en Kubernetes **no hay ningun `Service` llamado
 * `postgres`**: ese nombre viene del `compose.yaml` local. El servicio real es
 * `kamayuk-<ambiente>-postgres` y vive en el namespace de la PLATAFORMA, asi que ni siquiera un
 * nombre corto correcto resolveria desde aqui. Lo medido fue `UnknownHostException` en los ocho
 * Jobs y en los `Deployment` de los cuatro: nada del producto podia arrancar.
 *
 * Componerlo aqui seria repetir dos convenciones que son de `infrastructure` —como se nombra un
 * recurso del ambiente y como se llama su namespace—, y dos copias de una convencion se separan.
 * Lo que si es de este sistema, y por eso se escribe aqui, es el nombre de su base.
 */
function urlDeLaBase(e: EntornoDelDescriptor): string {
  return `jdbc:postgresql://${e.plataforma.motor}/${SISTEMA}`;
}

/**
 * Lo que piden los Jobs de un solo uso —migrar e implantar— y los procesos por lotes.
 *
 * Mismos `limits` que el perfil web y `requests` mas bajos, que es el reparto que
 * `RECURSOS.arranque` del monolito documenta desde el 2026-08-26: el `request` es lo que el
 * planificador **reserva y bloquea**, y estos Jobs corren a la vez que todos los `Deployment`
 * durante un `pulumi up`. Con el nodo justo, un `request` alto no es lentitud: es que no entran,
 * y como llevan la clase `lote` —la mas baja del cluster— no pueden desalojar a nadie para
 * hacerlo. Nadie cede y el despliegue se cuelga (`capacidad.ts`, issue #252).
 */
const RECURSOS_DE_ARRANQUE = {
  requests: { cpu: "50m", memory: "256Mi" },
  limits: { cpu: "1", memory: "1Gi" },
};

/** La conexion de la aplicacion: `kamayuk_app` y solo `kamayuk_app` (ARQ-03 §4). */
function credencialesDeLaAplicacion(e: EntornoDelDescriptor): VariableDeEntorno[] {
  return [
    { name: "KAMAYUK_DB_URL", value: urlDeLaBase(e) },
    { name: "KAMAYUK_DB_USUARIO", value: "kamayuk_app" },
    {
      name: "KAMAYUK_DB_CLAVE",
      valueFrom: { secretKeyRef: { name: e.secretoDe("app"), key: "clave" } },
    },
  ];
}

/**
 * El contenedor del migrador: **la imagen del migrador, no la de la aplicacion** (C-14, punto 1).
 *
 * Lee `KAMAYUK_DB_OWNER_USUARIO` y `KAMAYUK_DB_OWNER_CLAVE` —lo dice el `main` de
 * `kamayuk.normativa.esquema.Migrador`, que rechaza argumentos a proposito para que una
 * clave no quede en el historial del proceso—, y **no** `KAMAYUK_DB_USUARIO`, que es lo que este
 * descriptor ponia hasta C-14 sobre la imagen de la aplicacion: aquello arrancaba el proceso web
 * con las credenciales de `kamayuk_owner` y con `spring.flyway.enabled: false`, o sea DDL al alcance
 * de un servidor HTTP y ninguna migracion aplicada.
 */
function contenedorDelMigrador(e: EntornoDelDescriptor): Contenedor {
  return {
    name: "migrador",
    image: e.imagenDe(MIGRADOR),
    env: [
      { name: "KAMAYUK_DB_URL", value: urlDeLaBase(e) },
      // Migrar es lo unico que corre como `kamayuk_owner`: es el unico rol con DDL.
      { name: "KAMAYUK_DB_OWNER_USUARIO", value: "kamayuk_owner" },
      {
        name: "KAMAYUK_DB_OWNER_CLAVE",
        valueFrom: { secretKeyRef: { name: e.secretoDe("owner"), key: "clave" } },
      },
    ],
    resources: RECURSOS_DE_ARRANQUE,
    securityContext: SEGURIDAD,
  };
}

/**
 * La ventana del consumidor del buzon de `identidad`: **cada cinco minutos**, y no de madrugada.
 *
 * Lo que trae son altas, bajas, afiliaciones y permisos —quien puede hacer que—, y la ventana ES
 * la ventana de inconsistencia de la copia local que ADR-0039 §«Lo que cuesta» (2) exige medir:
 * un permiso retirado en `identidad` sigue valiendo aqui hasta la siguiente vuelta. Cinco minutos
 * es la cota superior que este descriptor declara; lo que tarda de verdad se mide en la etapa 5.
 *
 * No compite con la ventanilla: cada vuelta es un pod de `RECURSOS_DE_ARRANQUE` con la clase
 * `lote`, que termina en cuanto el buzon deja de servir algo que aplicar (`sinProgreso`).
 */
const VENTANA_DEL_CONSUMIDOR = "*/5 * * * *";

/**
 * Lo que el consumidor del buzon de `identidad` lee del entorno (ADR-0039, etapa 4).
 *
 * Son las mismas para el `Job` de implantacion —que termina con una pasada del consumidor, para
 * que la municipalidad recien implantada traiga lo que `identidad` ya publico— y para el
 * `CronJob` de `lotes()`. Van juntas y se derivan de una sola lista porque la deriva entre las
 * dos mitades cuesta el despliegue: desde la etapa 5 de ADR-0039 el administrador ya no se siembra
 * —lo escribe solo el consumidor, con lo que `identidad` publica—, asi que un `Job` de implantacion
 * sin estas variables deja la base sin una sola cuenta y **falla nombrandolo** (`SinAutorizacion`).
 * Hasta la etapa 4 salia con cero diciendo «Sin identidad configurada», que era peor: `Complete`
 * sobre una municipalidad donde nadie puede entrar.
 *
 * - `KAMAYUK_IDENTIDAD_URL`: el buzon, en SU namespace. Se compone con `namespaceDe` y no a mano.
 *   **El servicio es `kamayuk-identidad-web`, en `kamayuk-identidad-<ambiente>`**, y no
 *   `kamayuk-<ambiente>-identidad`, que es Keycloak en el namespace de la plataforma: la colision
 *   de nombre esta medida en el `CLAUDE.md` de `identidad`.
 * - `KAMAYUK_IDENTIDAD_TOKEN`: a donde se pide el token, por la red INTERNA (#21 AC-2). Es una
 *   direccion, no una identidad: pedirlo al emisor publico haria salir al ingreso para volver a
 *   entrar, y la politica de egreso no lo permite.
 * - `KAMAYUK_IDENTIDAD_CLIENTE`: con QUE cliente, uno por municipalidad, porque la cuenta de
 *   servicio es la que lleva `municipalidad_id` (ADR-0028 §2) y `identidad` deriva QUIEN pregunta
 *   del `azp` del token y nunca de un parametro. El nombre lo fija `clienteDeServicio()` de
 *   `infrastructure`, y su guarda `identidad-de-servicio` compara esta cadena con la suya.
 * - `KAMAYUK_IDENTIDAD_CREDENCIAL`: la clave de ese cliente confidencial. No es el token.
 * - `KAMAYUK_IDENTIDAD_CONSUMIDOR_RESPONSABLE` y `_CANAL`: a quien se avisa cuando un evento no
 *   se puede aplicar nunca y se aparta. `ResponsableDeLaCopiaLocal` exige los dos.
 */
function variablesDeIdentidad(e: EntornoDelDescriptor): VariableDeEntorno[] {
  return [
    {
      name: "KAMAYUK_IDENTIDAD_URL",
      value: `http://kamayuk-identidad-web.${e.namespaceDe("identidad")}`,
    },
    { name: "KAMAYUK_IDENTIDAD_TOKEN", value: e.plataforma.token },
    {
      name: "KAMAYUK_IDENTIDAD_CLIENTE",
      value: `kamayuk-${SISTEMA}-servicio-${e.implantacion.ubigeo}`,
    },
    {
      name: "KAMAYUK_IDENTIDAD_CREDENCIAL",
      valueFrom: { secretKeyRef: { name: e.secretoDe("identidad"), key: "clave" } },
    },
    { name: "KAMAYUK_IDENTIDAD_CONSUMIDOR_RESPONSABLE", value: e.operacion.responsable },
    { name: "KAMAYUK_IDENTIDAD_CONSUMIDOR_CANAL", value: e.operacion.canal },
  ];
}

/**
 * Las propiedades de `DatosDeImplantacion`, tal como Spring las lee del entorno — y desde la
 * etapa 4 de ADR-0039 las del consumidor de `identidad`, porque la implantacion termina con una
 * pasada suya.
 */
function variablesDeImplantacion(e: EntornoDelDescriptor): VariableDeEntorno[] {
  const i = e.implantacion;
  return [
    { name: "SPRING_PROFILES_ACTIVE", value: "batch" },
    ...credencialesDeLaAplicacion(e),
    ...variablesDeIdentidad(e),
    { name: "KAMAYUK_IMPLANTACION_UBIGEO", value: i.ubigeo },
    { name: "KAMAYUK_IMPLANTACION_NOMBRE", value: i.nombre },
    { name: "KAMAYUK_IMPLANTACION_TIPO", value: i.tipo },
    // No crea ninguna contrasena: la credencial vive en Keycloak, y esta cuenta tiene que ser
    // la misma que exista alli.
    { name: "KAMAYUK_IMPLANTACION_ADMINISTRADOR", value: i.administrador },
    { name: "KAMAYUK_IMPLANTACION_NOMBREDELADMINISTRADOR", value: i.nombreDelAdministrador },
    { name: "KAMAYUK_IMPLANTACION_ESDEMOSTRACION", value: String(i.esDemostracion) },
    { name: "KAMAYUK_IMPLANTACION_URL", value: urlDeLaBase(e) },
    // OWNERCLAVE sin guion bajo: en una variable de entorno el `_` se traduce a punto, asi que
    // `KAMAYUK_IMPLANTACION_OWNER_CLAVE` seria `kamayuk.implantacion.owner.clave` y no
    // `owner-clave`. Es la misma nota que lleva el Job del monolito, y por el mismo motivo.
    {
      name: "KAMAYUK_IMPLANTACION_OWNERCLAVE",
      valueFrom: { secretKeyRef: { name: e.secretoDe("owner"), key: "clave" } },
    },
  ];
}

/** Lo que pide y lo que puede gastar. Sin esto, el planificador no reserva nada. */
const RECURSOS = {
  requests: { cpu: "100m", memory: "512Mi" },
  limits: { cpu: "1", memory: "1Gi" },
};

/**
 * `timeoutSeconds` entre 3 y 5, y no es decorativo: el valor por omision del kubelet es **1 s**,
 * y en un nodo ocupado un contenedor sano pero atareado no contesta en 1 s. Tres fallos de la
 * sonda de vida y lo mata con codigo 143, que se parece a un OOM sin serlo.
 */
function sondas() {
  return {
    startupProbe: {
      timeoutSeconds: 3,
      httpGet: { path: "/actuator/health", port: 8080 },
      failureThreshold: 30,
      periodSeconds: 5,
    },
    readinessProbe: {
      timeoutSeconds: 3,
      httpGet: { path: "/actuator/health/readiness", port: 8080 },
      periodSeconds: 10,
    },
    livenessProbe: {
      timeoutSeconds: 5,
      httpGet: { path: "/actuator/health/liveness", port: 8080 },
      periodSeconds: 20,
    },
  };
}

/** El endurecimiento que no admite excepcion (issue #157). */
const SEGURIDAD = {
  runAsNonRoot: true,
  allowPrivilegeEscalation: false as const,
  capabilities: { drop: ["ALL"] as ["ALL"] },
};

function despliegueDelPerfil(e: EntornoDelDescriptor, perfil: string, atiendeHttp: boolean): Manifiesto[] {
  const nombre = `kamayuk-${SISTEMA}-${perfil}`;
  const etiquetas = { ...e.etiquetas, componente: SISTEMA, perfil };
  const manifiestos: Manifiesto[] = [
    {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: nombre, namespace: e.namespace, labels: etiquetas },
      spec: {
        replicas: 1,
        // `maxSurge: 0` obliga a matar el pod viejo antes de crear el nuevo: en un nodo sin
        // holgura, un pod extra durante el despliegue no agenda y el rollout se cuelga.
        strategy: { type: "RollingUpdate", rollingUpdate: { maxSurge: 0, maxUnavailable: 1 } },
        selector: { matchLabels: { app: nombre } },
        template: {
          metadata: { labels: { ...etiquetas, app: nombre } },
          spec: {
            priorityClassName: e.prioridadDe(perfil === "batch" ? "lote" : "servicio"),
            containers: [
              {
                name: SISTEMA,
                // La etiqueta la pone `infrastructure`. Ver la cabecera.
                image: e.imagenDe(SISTEMA),
                env: [
                  { name: "SPRING_PROFILES_ACTIVE", value: perfil },
                  { name: "KAMAYUK_DB_URL", value: urlDeLaBase(e) },
                  { name: "KAMAYUK_DB_USUARIO", value: "kamayuk_app" },
                  {
                    name: "KAMAYUK_DB_CLAVE",
                    valueFrom: { secretKeyRef: { name: e.secretoDe("app"), key: "clave" } },
                  },
                  // Sin el emisor la aplicacion se niega a arrancar, y es deliberado: un backend
                  // que atiende sin poder validar un token responde a la sonda, se declara sano y
                  // no atiende a nadie (ADR-0005).
                  { name: "KAMAYUK_OIDC_EMISOR", value: e.plataforma.emisor },
                  // El JWKS por la red INTERNA, cruzando el namespace de la plataforma (C-14).
                  // Hasta aqui este descriptor apuntaba las dos al nombre publico: el backend
                  // habria salido al ingreso para volver a entrar, y con la politica de egreso
                  // declarada —que nombra el pod de identidad, no internet— no habria salido en
                  // absoluto. Todo token invalido, por un motivo que no se parece a su causa.
                  { name: "KAMAYUK_OIDC_JWKS", value: e.plataforma.jwks },
                ],
                ...(atiendeHttp ? { ports: [{ name: "http", containerPort: 8080 }] } : {}),
                resources: RECURSOS,
                ...(atiendeHttp ? sondas() : {}),
                securityContext: SEGURIDAD,
              },
            ],
          },
        },
      },
    },
  ];
  if (atiendeHttp) {
    manifiestos.push({
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: nombre, namespace: e.namespace, labels: etiquetas },
      spec: {
        type: "ClusterIP",
        selector: { app: nombre },
        ports: [{ name: "http", port: 80, targetPort: 8080 }],
      },
    });
  }
  return manifiestos;
}

export const normativa: DescriptorDeSistema = {
  sistema: SISTEMA,
  prefijo: SISTEMA,
  // DOS imagenes, y son dos objetivos del mismo `Dockerfile` (C-14, punto 1): las
  // credenciales de `kamayuk_owner` existen durante la migracion y desaparecen con ella.
  imagenes: [SISTEMA, MIGRADOR],

  /**
   * Su base y sus roles. **Solo la suya**: pedir privilegios sobre la de otro sistema es una
   * base compartida disfrazada, y deja el aislamiento entre municipalidades en una promesa.
   *
   * `superusuario: false` no es una formalidad: un superusuario OMITE RLS incluso con
   * `FORCE ROW LEVEL SECURITY` (DAT-01 §0, hallazgo 1).
   */
  baseDeDatos(): BaseDeDatosDeclarada {
    return {
      nombre: SISTEMA,
      roles: [
        { nombre: "kamayuk_owner", sobre: [SISTEMA], privilegios: ["ALL"], superusuario: false },
        {
          nombre: "kamayuk_app",
          sobre: [SISTEMA],
          privilegios: ["SELECT", "INSERT", "UPDATE"],
          superusuario: false,
        },
        { nombre: "kamayuk_readonly", sobre: [SISTEMA], privilegios: ["SELECT"], superusuario: false },
      ],
    };
  },

  despliegue: (e) => [...despliegueDelPerfil(e, "web", true)],

  /**
   * Su Job de migracion. Cada base tiene sus migraciones y su prueba de aislamiento.
   *
   * **El nombre lleva la version**, y no es cosmetico: un `Job` de Kubernetes es INMUTABLE —su
   * plantilla de pod no se puede modificar—, asi que un nombre fijo hace fallar el `pulumi up` de
   * la version siguiente al intentar actualizarlo, porque la imagen lleva la etiqueta dentro. El
   * monolito lo resolvio asi desde el issue #150; este descriptor nacio sin ello.
   */
  migracion(e): Manifiesto[] {
    const nombre = e.nombreConVersion(`kamayuk-${SISTEMA}-migracion`);
    const etiquetas = { ...e.etiquetas, componente: SISTEMA };
    return [
      {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: { name: nombre, namespace: e.namespace, labels: etiquetas },
        spec: {
          backoffLimit: 3,
          ttlSecondsAfterFinished: 86400,
          template: {
            metadata: { labels: { ...etiquetas, app: nombre } },
            spec: {
              restartPolicy: "Never",
              priorityClassName: e.prioridadDe("lote"),
              containers: [contenedorDelMigrador(e)],
            },
          },
        },
      },
    ];
  },

  /**
   * Su Job de implantacion: la fila de `municipalidad` en SU base, y la copia local de usuarios,
   * grupos y accesos (C-7 §2.3, C-14 punto 4).
   *
   * ## Por que el migrador va de contenedor de inicializacion
   *
   * Un `Deployment` no sabe esperar a un `Job` y Kubernetes no tiene `dependsOn`. El monolito lo
   * resuelve con un contenedor que consulta la base con `psql` hasta ver `flyway_schema_history`;
   * aqui esa salida no existe, porque un descriptor solo puede nombrar SUS imagenes —la
   * prohibicion (b)— y la del motor no es suya.
   *
   * Lo que se hace es mas fuerte que esperar: se **asegura** que el esquema esta, corriendo el
   * migrador, que es idempotente y devuelve cero cuando no falta nada. Si el Job de migracion aun
   * no termino, Flyway toma su propio candado y uno de los dos espera al otro; cuando este
   * contenedor sale con exito **el esquema ESTA**, que es lo que la espera del monolito solo
   * puede suponer.
   */
  implantacion(e): Manifiesto[] {
    const nombre = e.nombreConVersion(`kamayuk-${SISTEMA}-implantacion`);
    const etiquetas = { ...e.etiquetas, componente: SISTEMA };
    return [
      {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: { name: nombre, namespace: e.namespace, labels: etiquetas },
        spec: {
          backoffLimit: 3,
          ttlSecondsAfterFinished: 86400,
          template: {
            metadata: { labels: { ...etiquetas, app: nombre } },
            spec: {
              restartPolicy: "Never",
              priorityClassName: e.prioridadDe("lote"),
              initContainers: [contenedorDelMigrador(e)],
              containers: [
                {
                  name: "implantacion",
                  // La MISMA imagen que la aplicacion, con el perfil `batch` (ADR-0003: un
                  // artefacto, dos perfiles). No abre puerto ninguno.
                  image: e.imagenDe(SISTEMA),
                  env: variablesDeImplantacion(e),
                  resources: RECURSOS_DE_ARRANQUE,
                  securityContext: SEGURIDAD,
                },
              ],
            },
          },
        },
      },
    ];
  },

  /**
   * Sus procesos por lotes con ventana: **el consumidor del buzon de `identidad`** (ADR-0039,
   * etapa 4), y ninguno mas.
   *
   * Hasta la etapa 4 esta lista estaba vacia y era una afirmacion: «`normativa` publica y no
   * consulta a nadie; sellar es un acto con dos firmas, no una tarea programada». Sigue siendo
   * cierto para sellar. Lo que este `CronJob` trae no es un parametro: es **quien puede hacer
   * que**, y hasta ahora lo sembraba a mano la implantacion desde el catalogo (etapa 1) — o sea que
   * un permiso concedido o retirado en `identidad` no llegaba aqui nunca.
   *
   * Corre con la MISMA imagen que la aplicacion en perfil `batch` (ADR-0003: un artefacto, dos
   * perfiles): `CorrerElConsumidorDeIdentidad` es un `ApplicationRunner`, da vueltas hasta que el
   * buzon deja de servir algo que aplicar y el proceso termina. Un `Deployment` no valdria —solo
   * admite `restartPolicy: Always` y reportaria como fallo una salida con exito— y un `CronJob`
   * con `concurrencyPolicy: Forbid` es lo que impide que dos vueltas apliquen la misma cola a la
   * vez. `backoffLimit: 1`, porque la siguiente ventana llega en cinco minutos y reintentar cuatro
   * veces lo mismo antes de ella no anade informacion.
   *
   * **No nace suspendido**, y lo que sostiene que no lo este es lo mismo que en `rentas` (#21):
   * `KAMAYUK_IDENTIDAD_CREDENCIAL` declara `emisor: "keycloak"` en el inventario y la guarda
   * `identidad-de-servicio` de `infrastructure` no deja pasar el build mientras alguna
   * municipalidad no declare `{"sistema":"normativa","llamaA":"identidad"}` en su bloque
   * `servicios`. Un `suspend: true` diria «corre esto, y hoy no puede», y hoy puede.
   */
  lotes(e): Manifiesto[] {
    const nombre = `kamayuk-${SISTEMA}-consumidor-de-identidad`;
    const etiquetas = { ...e.etiquetas, componente: SISTEMA };
    const consumidor: CronJob = {
      apiVersion: "batch/v1",
      kind: "CronJob",
      metadata: { name: nombre, namespace: e.namespace, labels: etiquetas },
      spec: {
        schedule: VENTANA_DEL_CONSUMIDOR,
        concurrencyPolicy: "Forbid",
        successfulJobsHistoryLimit: 3,
        failedJobsHistoryLimit: 3,
        jobTemplate: {
          spec: {
            backoffLimit: 1,
            template: {
              metadata: { labels: { ...etiquetas, app: nombre } },
              spec: {
                restartPolicy: "Never",
                priorityClassName: e.prioridadDe("lote"),
                containers: [
                  {
                    name: "consumidor",
                    image: e.imagenDe(SISTEMA),
                    env: [
                      { name: "SPRING_PROFILES_ACTIVE", value: "batch" },
                      ...credencialesDeLaAplicacion(e),
                      ...variablesDeIdentidad(e),
                      // `@ConditionalOnProperty("kamayuk.identidad.consumidor.municipalidad")`:
                      // es lo que separa este proceso del Job de implantacion, que lleva las
                      // mismas variables de identidad y NO esta: sin ella el runner del
                      // consumidor no existe, y con ella la implantacion correria dos veces
                      // la misma pasada.
                      {
                        name: "KAMAYUK_IDENTIDAD_CONSUMIDOR_MUNICIPALIDAD",
                        value: String(e.implantacion.municipalidadId),
                      },
                    ],
                    resources: RECURSOS_DE_ARRANQUE,
                    securityContext: SEGURIDAD,
                  },
                ],
              },
            },
          },
        },
      },
    };
    return [consumidor];
  },

  /** Sus rutas, **bajo su prefijo**. Reclamar el de otro no falla: se lo queda. */
  ingreso(e): Manifiesto[] {
    return [
      {
        apiVersion: "traefik.io/v1alpha1",
        kind: "IngressRoute",
        metadata: { name: `kamayuk-${SISTEMA}`, namespace: e.namespace, labels: e.etiquetas },
        spec: {
          // Solo `websecure`: 80 redirige, no coexiste. Un formulario de acceso servido por
          // HTTP es una credencial regalada.
          entryPoints: ["websecure"],
          routes: [
            {
              match: `Host(\`${e.dominio}\`) && PathPrefix(\`/${SISTEMA}\`)`,
              kind: "Rule",
              services: [{ name: `kamayuk-${SISTEMA}-web`, port: 80 }],
            },
          ],
          tls: { certResolver: "letsencrypt" },
        },
      },
    ];
  },

  /**
   * A quien puede llamar. **El egreso declarado ES el grafo de dependencias** (ADR-0029), y
   * tiene que coincidir con ARQ-01 reducido a cuatro nodos. Cada arista, con su motivo:
   *
   * - **`identidad`, el sistema**, para leer y acusar su buzon de eventos (ADR-0039, etapa 4).
   *   Es la unica, y ver la cabecera: no es un dato de negocio, es la replica de la
   *   autorizacion, y lo que ADR-0025 afirma sobre sellar sigue en pie.
   *
   * Y no confundir las DOS aristas con el nombre `identidad`: la de la plataforma es Keycloak
   * —`componente: identidad`, en `e.plataforma.namespace`, para el JWKS y el token— y la del
   * sistema es `componente: identidad-sistema`, en `e.namespaceDe("identidad")`. Los pods de
   * aquel llevan esa etiqueta a proposito, porque `componente: identidad` ya significaba Keycloak
   * cuando el sistema nacio (su `CLAUDE.md`, «La colision de nombre con Keycloak»).
   */
  egreso(e): NetworkPolicy[] {
    return [
      {
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        metadata: {
          name: `kamayuk-${SISTEMA}-egreso`,
          namespace: e.namespace,
          labels: e.etiquetas,
        },
        spec: {
          podSelector: { matchLabels: { componente: SISTEMA } },
          policyTypes: ["Egress"],
          egress: [
            // ── DNS, y va primero porque todo lo demas depende de el ──────────────────
            //
            // Sin esta regla las cuatro que siguen NO SIRVEN DE NADA. Una politica de egreso
            // convierte a los pods que selecciona en «solo lo declarado», y `postgres`,
            // `identidad` y los sistemas hermanos se nombran por su `Service`: resolver ese
            // nombre es una consulta a CoreDNS, que vive en `kube-system`, y ninguna de las
            // reglas de abajo la permite. El sintoma medido es `UnknownHostException`, y es
            // **intermitente** —la resolucion se cachea, asi que a veces sale y a veces no—,
            // que es peor que fallar siempre.
            //
            // Con esta regla anadida a mano sobre el clúster, las OCHO tareas de los cuatro
            // sistemas pasaron de `Failed` a `Complete` (C-17, punto 3).
            //
            // Es la misma politica que `Red.ts` le da al namespace de la plataforma desde que
            // existe (`permitir-dns`): lo que fallo aqui no fue la idea, fue que estas politicas
            // se escribieron de cero y esa parte no se copio. Va **en el descriptor** y no en
            // `infrastructure` porque quien decide que pods restringe esta politica es este
            // archivo —`podSelector` es suyo—; lo que si es de `infrastructure` es la guarda que
            // comprueba que ningun sistema se la deje.
            //
            // Sin `podSelector` en el destino, a proposito: lo que se abre es el PUERTO 53 hacia
            // el namespace del sistema, no un pod concreto. Nombrar `k8s-app: kube-dns` ataria
            // esta politica a como etiqueta sus pods una distribucion de Kubernetes.
            {
              to: [
                {
                  namespaceSelector: {
                    matchLabels: { "kubernetes.io/metadata.name": "kube-system" },
                  },
                },
              ],
              ports: [
                { protocol: "UDP", port: 53 },
                // TCP tambien: una respuesta que no cabe en un datagrama se reintenta por TCP,
                // y una politica que solo abriera UDP funcionaria hasta el dia que dejara de
                // hacerlo, por el tamano de una respuesta.
                { protocol: "TCP", port: 53 },
              ],
            },
            // Su motor. Los cuatro lo necesitan; cada uno a SU base.
            {
              to: [
                {
                  // El `namespaceSelector` NO es un adorno: desde ADR-0031 cada sistema tiene su
                  // namespace, y un `podSelector` a secas selecciona pods del MISMO. Sin el, esta
                  // regla no abre nada y el sintoma es trafico denegado con una politica que dice
                  // permitirlo (C-14, punto 3).
                  namespaceSelector: {
                    matchLabels: { "kubernetes.io/metadata.name": e.plataforma.namespace },
                  },
                  podSelector: { matchLabels: { componente: "postgres" } },
                },
              ],
              ports: [{ protocol: "TCP", port: 5432 }],
            },
            // La identidad: valida los tokens que recibe.
            {
              to: [
                {
                  // El `namespaceSelector` NO es un adorno: desde ADR-0031 cada sistema tiene su
                  // namespace, y un `podSelector` a secas selecciona pods del MISMO. Sin el, esta
                  // regla no abre nada y el sintoma es trafico denegado con una politica que dice
                  // permitirlo (C-14, punto 3).
                  namespaceSelector: {
                    matchLabels: { "kubernetes.io/metadata.name": e.plataforma.namespace },
                  },
                  podSelector: { matchLabels: { componente: "identidad" } },
                },
              ],
              ports: [{ protocol: "TCP", port: 8080 }],
            },
            // La identidad, EL SISTEMA (ADR-0039): su buzon de eventos, en SU namespace. Es la
            // unica arista hacia un sistema que este descriptor declara, y la lleva el perfil
            // `batch`; el proceso web sigue autorizando contra la copia local y no la usa. Con
            // `identidad` caido la ventanilla no se entera: lo que se pierde es la frescura de la
            // copia, no la capacidad de autorizar.
            {
              to: [
                {
                  namespaceSelector: {
                    matchLabels: { "kubernetes.io/metadata.name": e.namespaceDe("identidad") },
                  },
                  // `identidad-sistema` y no `identidad`: esa etiqueta es Keycloak (arriba).
                  podSelector: { matchLabels: { componente: "identidad-sistema" } },
                },
              ],
              ports: [{ protocol: "TCP", port: 8080 }],
            },
            // Y ningun otro sistema. Para sellar, `normativa` sigue sin consultar a nadie.
          ],
        },
      },
    ];
  },

  alertas: (): ReglaDeAlerta[] => [
    {
      alert: `${SISTEMA}SinResponder`,
      expr: `up{job="kamayuk-${SISTEMA}"} == 0`,
      for: "5m",
      labels: { severity: "critical", sistema: SISTEMA },
      annotations: {
        summary: `${SISTEMA} lleva 5 minutos sin responder`,
        description: "Con un solo nodo no hay a donde mover la carga: hay que mirar el pod.",
      },
    },
  ],

  panel: (): PanelDeclarado => ({
    nombre: `kamayuk-${SISTEMA}`,
    // Vacio a proposito: un panel se llena con las metricas que el sistema publica, y todavia
    // no publica ninguna. Inventarle paneles ahora seria dibujar cifras que nadie emite.
    json: { title: `Kamayuk · ${SISTEMA}`, panels: [] },
  }),

  /**
   * Su inventario de claves: metadatos, **nunca un valor** (INF-06, ADR-0011 §3).
   *
   * **El nombre sale de `e.secretoDe(...)`, el mismo que usan los manifiestos** (C-17, punto 4).
   * Hasta aqui esta lista decia `kamayuk-<sistema>-app` —sin el ambiente— mientras los
   * `secretKeyRef` de arriba pedian `kamayuk-<sistema>-<ambiente>-app`: el inventario nombraba
   * un `Secret` que nadie monta, y los que se montan no estaban en ningun inventario. La
   * interseccion entre lo declarado y lo referenciado era **cero**, y el sintoma no es un error
   * sino un pod en `Pending` esperando un `Secret` que nadie genera.
   */
  claves: (e): ClaveDeclarada[] => [
    {
      nombre: e.secretoDe("app"),
      clave: "clave",
      rol: "kamayuk_app",
      rotacion: "trimestral",
      proposito: `la conexion de ${SISTEMA} a su base`,
    },
    {
      nombre: e.secretoDe("owner"),
      clave: "clave",
      rol: "kamayuk_owner",
      rotacion: "anual",
      proposito: `migrar la base de ${SISTEMA}; es el unico rol con DDL`,
    },
    {
      // La credencial con que el consumidor lee y acusa el buzon de `identidad` (ADR-0039,
      // etapa 4).
      //
      // **`emisor: "keycloak"` es lo que la separa de una clave de PostgreSQL** (#21). Su valor no
      // vale por si mismo: es la clave del cliente confidencial `kamayuk-normativa-servicio-<ubigeo>`
      // con la que se pide un token, y ese cliente lo crea `reconciliar-identidades.sh servicios`
      // desde `despliegue/identidad/municipalidades/<ubigeo>.json` — que tiene que declarar
      // `{"sistema":"normativa","llamaA":"identidad"}`, o la guarda `identidad-de-servicio` de
      // `infrastructure` no deja pasar el build. `llamaA` se deriva del nombre de este secreto,
      // y por eso se llama `identidad`.
      nombre: e.secretoDe("identidad"),
      clave: "clave",
      emisor: "keycloak",
      rotacion: "trimestral",
      proposito: "leer y acusar el buzon de eventos de identidad con el token del cliente de servicio",
    },
  ],
};

export default normativa;
