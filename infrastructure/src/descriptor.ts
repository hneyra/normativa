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
 * La imagen de la interfaz (#39): `frontend/Dockerfile`, un nginx sirviendo el `dist/` de
 * `normativa-web`.
 *
 * **Nunca `normativa-web`.** Ese nombre YA ES otra cosa en este mismo archivo: el `Deployment` y
 * el `Service` del BACKEND con el perfil `web` de Spring, que produce
 * `despliegueDelPerfil(e, "web", true)` como `kamayuk-${SISTEMA}-web`. Reutilizarlo dejaria dos
 * artefactos del producto llamados igual —uno sirve la API y el otro archivos estaticos— y
 * cualquier frase del tipo «despliega `kamayuk-normativa-web`» pasaria a tener dos respuestas.
 */
const INTERFAZ = `${SISTEMA}-interfaz`;

/** El nombre de sus tres recursos. Sale una vez y se usa en seis sitios. */
const NOMBRE_DE_LA_INTERFAZ = `kamayuk-${SISTEMA}-interfaz`;

/**
 * Su etiqueta `componente`, **distinta de la del backend**, y no es cosmetica.
 *
 * `egreso()` selecciona por `componente: normativa` los pods que pueden hablar con el motor, con
 * Keycloak y con el buzon de `identidad`. Si la interfaz llevara esa misma etiqueta heredaria las
 * cuatro aristas, y un nginx de archivos estaticos con salida a PostgreSQL es superficie que
 * nadie pidio. Con etiqueta propia sus dos politicas se escriben aparte y dicen lo que de verdad
 * necesita, que es mucho menos: DNS y nada mas.
 */
const COMPONENTE_DE_LA_INTERFAZ = INTERFAZ;

/**
 * El cliente publico de Keycloak con el que la interfaz entra. **Se REUSA, y esa es la decision
 * que desbloqueaba todo lo demas de #39.**
 *
 * Hasta hoy `frontend/src/api/cliente.ts` decia que esta interfaz no mandaba `Authorization`
 * porque **no existia cliente OIDC de `normativa-web` en ningun realm**, y lo daba por un bloqueo
 * aguas arriba. La salida no es crear uno:
 *
 *   1. Es **el mismo realm y los mismos usuarios** (ADR-0005, ADR-0030 §3: un login para los
 *      cinco). Un cliente por sistema no anade ninguna frontera —quien entra es la misma persona—
 *      y multiplica por cinco la superficie del realm: cinco listas de `redirectUris` que ampliar
 *      cada vez que nace un ambiente, y cinco sitios donde equivocarse.
 *   2. **La autorizacion no la hace el emisor.** Cada backend autoriza contra su copia local de
 *      `usuario`/`grupo`/`miembro`/`permiso` (ADR-0039), asi que un `client_id` distinto no
 *      decidiria ni un permiso mas ni uno menos. Lo unico que cambiaria es el `azp`, que este
 *      backend no mira.
 *   3. Su `redirectUris` **ya cubre esta ruta**: medido sobre
 *      `infrastructure/despliegue/identidad/realm-kamayuk.json`, declara el comodin de host
 *      `https://<dominio>/*`, y `/normativa/` cae dentro. **No hay que tocar el realm versionado.**
 *
 * **Se escribe aqui porque `EntornoDelDescriptor` no lo publica**: el realm lo describe
 * `infrastructure` y este contrato entrega el emisor (`plataforma.emisor`) pero no el cliente.
 * Mientras siga asi, cambiar de cliente es cambiar esta linea — y es la misma que `rentas` tiene
 * en el mismo sitio y por el mismo motivo.
 */
const CLIENTE_OIDC_DE_LA_INTERFAZ = "kamayuk-backoffice";

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

/**
 * Lo que pide la interfaz, y es **mucho menos que el backend**: un nginx sirviendo archivos
 * estaticos no necesita 1 CPU ni 1 Gi.
 *
 * No son cifras inventadas: son las mismas que `convenciones.recursos.interfaz` de
 * `infrastructure` le da al nginx del monolito, que hace exactamente esto. Se copian y no se
 * importan porque un descriptor no puede depender de `infrastructure` —seria la dependencia al
 * reves de ADR-0031 §2—, y con un solo nodo lo que se reparte es el `request`: 50m frente a los
 * 100m del backend es la diferencia entre que este pod quepa al lado de todo lo demas o no.
 */
const RECURSOS_DE_LA_INTERFAZ = {
  requests: { cpu: "50m", memory: "64Mi" },
  limits: { cpu: "200m", memory: "128Mi" },
};

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

/**
 * Las senias del ambiente que la interfaz lee **al arrancar**, servidas como un guion.
 *
 * <h2>El problema que resuelve</h2>
 *
 * Vite sustituye `import.meta.env.VITE_*` **al construir**, asi que todo lo que la interfaz
 * supiera por esa via quedaria horneado dentro de la imagen. Y una de esas cosas es la **URL del
 * emisor OIDC**, que no es la misma en el puesto de quien desarrolla que en la municipalidad.
 *
 * <h2>Por que NO se hace una imagen por ambiente, que es lo que hizo el monolito</h2>
 *
 * `infrastructure/infra/componentes/Aplicacion.ts` etiqueta la del monolito
 * `sgtm-interfaz:${environment}-${version}` justamente por esto, y lo dice en su comentario. Aqui
 * no cabe, y por dos motivos que se pierden a la vez:
 *
 *   1. **La etiqueta es el `sha` de este repositorio**, que es lo que `publicar-imagenes.yml` ya
 *      hace con las otras dos. Meter el nombre del ambiente dentro deja una etiqueta que no
 *      resuelve contra ningun `git log`, y entonces «que corre en la municipalidad» vuelve a no
 *      tener respuesta — que es exactamente el defecto que aquel workflow vino a cerrar.
 *   2. **Lo verificado dejaria de ser lo desplegado.** Con una imagen por ambiente no se promueve
 *      un artefacto de la marcha blanca a produccion: se vuelve a construir, y lo que sale no es
 *      lo que se probo.
 *
 * <h2>Y por que un `ConfigMap` con esto y NO con el `nginx.conf`</h2>
 *
 * `caja` mete su `nginx.conf` en un `ConfigMap` y lo monta encima del que la imagen trae, para
 * poder cambiarlo sin republicar. Aqui **no se hace**, y es una decision: ese archivo no tiene ni
 * una linea que dependa del ambiente —el reparto entre la API y la interfaz lo hace el ingreso,
 * no el nginx, asi que aqui no hay ningun destino que reescribir— de modo que la copia seria un
 * segundo original con cero beneficio y una forma segura de divergir del que de verdad se sirve.
 *
 * Lo que si depende del ambiente es esto, y por eso es esto lo que viaja en el `ConfigMap`.
 *
 * <h2>El nombre del archivo y su forma</h2>
 *
 * `configuracion.js`, el mismo que `frontend/public/configuracion.js` —que viaja **vacio** dentro
 * de la imagen— y sobre el que este se monta. Se compone con `JSON.stringify` y no concatenando
 * comillas: un valor con una comilla dentro se saldria del literal y dejaria un guion que no
 * analiza, o sea la aplicacion entera en blanco.
 */
function senasDelAmbiente(e: EntornoDelDescriptor): Record<string, string> {
  return {
    // El emisor PUBLICO, que es el que el navegador tiene que alcanzar. Es la misma cadena que el
    // backend recibe en `KAMAYUK_OIDC_EMISOR` —el contrato la describe como «el emisor OIDC,
    // publico. Es lo que se compara con el `iss`»— y por eso no se compone aqui: componerla seria
    // repetir una convencion de `infrastructure`, y dos copias de una convencion se separan.
    //
    // Ojo con la otra: `plataforma.jwks` NO vale aqui. Es una direccion de la red interna del
    // cluster, y el navegador no la puede alcanzar.
    oidcRealm: e.plataforma.emisor,
    oidcCliente: CLIENTE_OIDC_DE_LA_INTERFAZ,
    // Sin `offline_access` ni nada que pida un `refresh_token`: el token de esta interfaz vive en
    // una variable de modulo y muere con la pestana (ADR-0030 §3), asi que una credencial de vida
    // larga seria justo lo que ese diseno evita.
    oidcAlcance: "openid profile",
  };
}

/**
 * La interfaz: su `ConfigMap`, su `Deployment` y su `Service` (#39).
 *
 * <h2>Que corre aqui, y que NO</h2>
 *
 * Un `nginx` sirviendo el `dist/` de `normativa-web`. **Sin una sola variable de entorno y sin un
 * solo `secretKeyRef`**: lo unico que este proceso necesita saber del ambiente son las senias del
 * emisor, que no son secretas —el cliente es publico y su URL la ve cualquiera que abra el
 * navegador— y viajan en el `ConfigMap`. Un `Secret` montado aqui seria una credencial regalada a
 * un proceso que no la usa.
 *
 * <h2>`runAsNonRoot` sin `runAsUser`</h2>
 *
 * `SEGURIDAD` fija `runAsNonRoot: true`. El monolito tiene que anadirle ademas `runAsUser: 101`
 * porque su `Dockerfile` dice `USER nginx` —un NOMBRE— y el kubelet no puede comprobar que un
 * nombre no sea root: se niega a arrancar el contenedor con un `CreateContainerConfigError` que
 * solo aparece al desplegar. El de #39 dice **`USER 101`**, en numero y por este motivo, asi que
 * aqui no hace falta repetirlo. Y si alguien lo devolviera a un nombre, este `Deployment` dejaria
 * de arrancar sin que este archivo tuviera por que enterarse: por eso
 * `frontend/verificaciones/imagen-y-despliegue.test.ts` lee el `Dockerfile` y lo comprueba.
 *
 * <h2>Las sondas piden `/index.html` y no `/`</h2>
 *
 * Por lo mismo que el `HEALTHCHECK` de la imagen: con el `try_files` de `nginx.conf`, `/` devuelve
 * la pantalla **caiga lo que caiga**, asi que pedirlo no distingue «nginx levantado» de «nginx
 * levantado sobre el `dist/` que se copio». Pedir el archivo por su nombre si.
 *
 * <h2>Sin `startupProbe`, al reves que el backend</h2>
 *
 * El backend arranca una JVM con Spring y necesita hasta 150 s. Un nginx escucha en menos de un
 * segundo. Una sonda de arranque aqui solo retrasaria la primera lectura.
 */
function despliegueDeLaInterfaz(e: EntornoDelDescriptor): Manifiesto[] {
  const etiquetas = { ...e.etiquetas, componente: COMPONENTE_DE_LA_INTERFAZ };
  const configuracion = `${NOMBRE_DE_LA_INTERFAZ}-configuracion`;
  return [
    {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { name: configuracion, namespace: e.namespace, labels: etiquetas },
      data: {
        "configuracion.js": `window.__KAMAYUK_NORMATIVA__ = ${JSON.stringify(senasDelAmbiente(e), null, 2)};\n`,
      },
    },
    {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: NOMBRE_DE_LA_INTERFAZ, namespace: e.namespace, labels: etiquetas },
      spec: {
        replicas: 1,
        // El mismo `maxSurge: 0` que el backend, y por el mismo motivo: en un nodo sin holgura un
        // pod extra durante el despliegue no agenda y el rollout se cuelga.
        strategy: { type: "RollingUpdate", rollingUpdate: { maxSurge: 0, maxUnavailable: 1 } },
        selector: { matchLabels: { app: NOMBRE_DE_LA_INTERFAZ } },
        template: {
          metadata: { labels: { ...etiquetas, app: NOMBRE_DE_LA_INTERFAZ } },
          spec: {
            priorityClassName: e.prioridadDe("servicio"),
            containers: [
              {
                name: "interfaz",
                // La etiqueta la pone `infrastructure`. Ver la cabecera.
                image: e.imagenDe(INTERFAZ),
                ports: [{ name: "http", containerPort: 8080 }],
                resources: RECURSOS_DE_LA_INTERFAZ,
                readinessProbe: {
                  timeoutSeconds: 3,
                  httpGet: { path: "/index.html", port: 8080 },
                  periodSeconds: 10,
                },
                livenessProbe: {
                  timeoutSeconds: 3,
                  httpGet: { path: "/index.html", port: 8080 },
                  periodSeconds: 20,
                },
                volumeMounts: [
                  {
                    name: "configuracion",
                    mountPath: "/usr/share/nginx/html/configuracion.js",
                    // `subPath`, o el montaje taparia el directorio entero y se llevaria por
                    // delante el `index.html` y todo `assets/`: la imagen serviria un directorio
                    // con un solo archivo dentro.
                    //
                    // El precio del `subPath` es que **no se actualiza solo**: cambiar el
                    // `ConfigMap` exige reiniciar el pod. Es el precio correcto aqui — cambiar de
                    // emisor a mitad de sesion dejaria a unas pestanas hablando con un realm y a
                    // otras con otro.
                    subPath: "configuracion.js",
                    readOnly: true,
                  },
                ],
                securityContext: SEGURIDAD,
              },
            ],
            volumes: [{ name: "configuracion", configMap: { name: configuracion } }],
          },
        },
      },
    },
    {
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: NOMBRE_DE_LA_INTERFAZ, namespace: e.namespace, labels: etiquetas },
      spec: {
        type: "ClusterIP",
        selector: { app: NOMBRE_DE_LA_INTERFAZ },
        // 80 hacia fuera y 8080 dentro, como el `Service` del backend de este mismo archivo: el
        // contenedor no corre como root y no puede abrir un puerto privilegiado.
        ports: [{ name: "http", port: 80, targetPort: 8080 }],
      },
    },
  ];
}

/**
 * Las dos prioridades del ingreso, **explicitas y no heredadas de la longitud de la regla**.
 *
 * Traefik v3 ordena las rutas por la longitud de su `match` cuando nadie declara `priority`, y
 * `PathPrefix(/normativa/api/v1)` es mas larga que `PathPrefix(/normativa)`, asi que hoy saldria
 * bien **por accidente**. No se deja implicito, y el motivo es que el fallo no grita: con la
 * precedencia al reves, `/normativa/api/v1/conjuntos` lo atenderia el nginx de la interfaz, cuyo
 * `try_files $uri /index.html` devuelve el `index.html` con un **200**. La pantalla pide JSON y
 * recibe HTML con codigo de exito: no un error, una pagina. Es el mismo modo de fallo que
 * `frontend/src/api/cliente.ts` lleva escrito desde F-4 —«un 200 cuyo cuerpo no es JSON no es una
 * respuesta vacia: es OTRA COSA contestando»— y que su guarda convierte en `SIN_RESPUESTA`.
 */
const PRIORIDAD_DE_LA_API = 20;
const PRIORIDAD_DE_LA_INTERFAZ = 10;

/**
 * DNS, y va primero en toda politica de egreso porque todo lo demas depende de el.
 *
 * Sin esta regla las demas NO SIRVEN DE NADA. Una politica de egreso convierte a los pods que
 * selecciona en «solo lo declarado», y `postgres`, `identidad` y los sistemas hermanos se nombran
 * por su `Service`: resolver ese nombre es una consulta a CoreDNS, que vive en `kube-system`, y
 * ninguna de las otras reglas la permite. El sintoma medido es `UnknownHostException`, y es
 * **intermitente** —la resolucion se cachea, asi que a veces sale y a veces no—, que es peor que
 * fallar siempre.
 *
 * Con esta regla anadida a mano sobre el clúster, las OCHO tareas de los cuatro sistemas pasaron
 * de `Failed` a `Complete` (C-17, punto 3).
 *
 * Es la misma politica que `Red.ts` le da al namespace de la plataforma desde que existe
 * (`permitir-dns`): lo que fallo aqui no fue la idea, fue que estas politicas se escribieron de
 * cero y esa parte no se copio. Va **en el descriptor** y no en `infrastructure` porque quien
 * decide que pods restringe esta politica es este archivo —`podSelector` es suyo—; lo que si es
 * de `infrastructure` es la guarda que comprueba que ningun sistema se la deje.
 *
 * Sin `podSelector` en el destino, a proposito: lo que se abre es el PUERTO 53 hacia el namespace
 * del sistema, no un pod concreto. Nombrar `k8s-app: kube-dns` ataria esta politica a como
 * etiqueta sus pods una distribucion de Kubernetes.
 *
 * **Escrita una vez y usada dos** (#39): la del backend y la de la interfaz. Hasta aqui vivia en
 * linea dentro de `egreso()`, y con una segunda politica en el archivo eso habrian sido dos
 * copias de la misma decision envejeciendo aparte.
 */
function reglaDeDns() {
  return {
    to: [
      {
        namespaceSelector: {
          matchLabels: { "kubernetes.io/metadata.name": "kube-system" },
        },
      },
    ],
    ports: [
      { protocol: "UDP" as const, port: 53 },
      // TCP tambien: una respuesta que no cabe en un datagrama se reintenta por TCP, y una
      // politica que solo abriera UDP funcionaria hasta el dia que dejara de hacerlo, por el
      // tamano de una respuesta.
      { protocol: "TCP" as const, port: 53 },
    ],
  };
}

/**
 * Las dos politicas de red de la interfaz, y son las dos puntas de un solo flujo (#39).
 *
 * <h2>Entrada: Traefik y nadie mas</h2>
 *
 * `infrastructure` deniega por omision en el namespace, asi que sin esta regla el ingreso enruta
 * y el paquete no llega — la ruta existe, el pod esta sano y el navegador se queda esperando.
 *
 * El puerto es el **8080 del contenedor**, no el 80 del `Service`: una `NetworkPolicy` filtra
 * sobre el puerto del pod, y el mapeo 80 -> 8080 lo deshace el `Service` antes de que la politica
 * mire nada. Escribir 80 aqui seria una politica que no admite absolutamente nada, y el sintoma
 * volveria a ser el navegador esperando.
 *
 * <h2>Salida: DNS y NADA MAS, y sobre todo NO el backend</h2>
 *
 * Esta interfaz no habla con nadie. No es una promesa: `frontend/nginx.conf` no tiene un solo
 * reenvio, y no lo tiene porque **el mismo origen se consigue un piso mas arriba** — el ingreso
 * parte `/normativa` en dos y manda `/normativa/api/v1` al backend directamente. El navegador ve
 * un unico origen, que es lo que hacia falta para que no hubiera CORS, y este pod no participa.
 *
 * De ahi que **no exista una regla hacia el backend**, y eso es la mitad importante de este
 * bloque: no es un olvido, es que anadirla abriria una salida que ningun proceso usa. Y el dia
 * que alguien escriba un `proxy_pass` aqui, no funcionara en el cluster aunque funcione en el
 * compose — y ese es el sitio correcto para enterarse: el PR que lo escriba.
 *
 * Y **no sale a PostgreSQL ni al buzon de `identidad`**: no hereda ninguna de las cuatro aristas
 * del backend porque su `componente` es `normativa-interfaz` y no `normativa`, asi que ningun
 * `podSelector` de `egreso()` la alcanza.
 */
function politicasDeLaInterfaz(e: EntornoDelDescriptor): NetworkPolicy[] {
  const seleccion = { matchLabels: { componente: COMPONENTE_DE_LA_INTERFAZ } };
  return [
    {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: {
        name: `${NOMBRE_DE_LA_INTERFAZ}-ingreso`,
        namespace: e.namespace,
        labels: e.etiquetas,
      },
      spec: {
        podSelector: seleccion,
        policyTypes: ["Ingress"],
        ingress: [
          {
            from: [
              {
                namespaceSelector: {
                  matchLabels: { "kubernetes.io/metadata.name": "kube-system" },
                },
              },
            ],
            ports: [{ protocol: "TCP", port: 8080 }],
          },
        ],
      },
    },
    {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: {
        name: `${NOMBRE_DE_LA_INTERFAZ}-egreso`,
        namespace: e.namespace,
        labels: e.etiquetas,
      },
      spec: {
        podSelector: seleccion,
        policyTypes: ["Egress"],
        egress: [reglaDeDns()],
      },
    },
  ];
}

export const normativa: DescriptorDeSistema = {
  sistema: SISTEMA,
  prefijo: SISTEMA,
  // TRES imagenes. Las dos primeras son dos objetivos del MISMO `backend/Dockerfile` (C-14,
  // punto 1): las credenciales de `kamayuk_owner` existen durante la migracion y desaparecen con
  // ella. La tercera es de OTRO —`frontend/Dockerfile`, con contexto `frontend/` (#39)— y no
  // comparte una sola capa con ellas: no lleva JVM, ni Node, ni codigo fuente; solo `dist/` y
  // nginx.
  imagenes: [SISTEMA, MIGRADOR, INTERFAZ],

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

  /**
   * Los DOS procesos que este sistema deja corriendo: el backend en perfil `web` y la interfaz.
   *
   * **Sin perfil `batch`**, y eso no cambia con #39: lo que corre por lotes aqui es el consumidor
   * del buzon de `identidad`, y es un `CronJob` de `lotes()` — un `Deployment` no valdria, porque
   * solo admite `restartPolicy: Always` y Kubernetes no podria distinguir «termino» de «se
   * murio».
   */
  despliegue: (e) => [...despliegueDelPerfil(e, "web", true), ...despliegueDeLaInterfaz(e)],

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
          // `6` y no `3`, y es `infrastructure`#65. Son los reintentos que este `Job` aguanta
          // esperando a que `identidad` implante su municipalidad, y de eso depende que su copia
          // local nazca poblada en vez de vacia.
          //
          // Medido en `infrastructure/infra/verificaciones/orden-de-implantacion.ts`: con el
          // retroceso exponencial de Kubernetes —10 s, 20 s, 40 s…, con tope de 360 s por intento—
          // `3` da **70 s** y `6` da **630 s**, contra el `MARGEN_MINIMO_SEGUNDOS = 600` que ese
          // archivo declara. Las dos cifras estan congeladas en su prueba, asi que no son una
          // estimacion. En un ambiente de cero 70 s no alcanzan: `identidad` tiene que esperar al
          // motor (hasta 120 s de `espera-al-motor`), migrar su esquema e implantar su municipalidad
          // antes de que su buzon publique nada.
          //
          // Y NO se arregla solo: un `Job` que agota su limite no reintenta nunca, y su nombre lleva
          // el `sha`, asi que `pulumi up` tampoco lo recrea — el ambiente se queda atascado hasta
          // que alguien lo borra a mano. Es el atasco de #44, y su cuarta repeticion fue
          // `infrastructure`#69.
          backoffLimit: 6,
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

  /**
   * Sus rutas, **bajo su prefijo**. Reclamar el de otro no falla: se lo queda.
   *
   * <h2>La ruta va PARTIDA EN DOS, y ese reparto es lo que quita el CORS (#39)</h2>
   *
   * `/normativa/api/v1` al backend y `/normativa` a la interfaz, dentro del **mismo `Host`**.
   * Desde el navegador todo cuelga de un solo origen, asi que no hay peticion entre origenes que
   * autorizar — y hace falta que no la haya, porque esta medido que el backend **no publica ni
   * una cabecera `Access-Control-Allow-Origin`**: cero `CorsConfiguration` y cero `@CrossOrigin`
   * en todo `backend/`. Una peticion desde otro origen la bloquea el navegador antes de que nadie
   * la lea.
   *
   * Es el mismo resultado que el monolito consigue con un `proxy_pass` dentro de su nginx, y se
   * prefiere este por tres cosas: no hay dos caminos a la API que puedan divergir, el destino no
   * cambia entre el compose y el cluster —asi que no hay que reescribir ninguna linea del
   * `nginx.conf` al meterlo en un `ConfigMap`, ni hay `ConfigMap` de `nginx.conf` que mantener— y
   * la interfaz no necesita salida de red hacia el backend (ver `politicasDeLaInterfaz`).
   *
   * <h2>El prefijo se quita SOLO en la de la interfaz</h2>
   *
   * `Api.RAIZ` del backend **es** `/normativa/api/v1` entera, asi que quitarle el prefijo dejaria
   * a Spring buscando `/api/v1/...` y contestando 404 a todo. La interfaz al reves: su
   * `nginx.conf` sirve en la raiz del contenedor, y el paquete pide con el prefijo puesto porque
   * `vite.config.ts` declara `base: '/normativa/'` (ADR-0030 §2).
   */
  ingreso(e): Manifiesto[] {
    const quitarElPrefijo = `kamayuk-${SISTEMA}-quitar-prefijo`;
    return [
      {
        apiVersion: "traefik.io/v1alpha1",
        kind: "Middleware",
        metadata: { name: quitarElPrefijo, namespace: e.namespace, labels: e.etiquetas },
        // Traefik reenvia lo que queda y anade `X-Forwarded-Prefix`, asi que quien quiera
        // reconstruir la URL publica puede; nginx no lo necesita para servir un archivo.
        spec: { stripPrefix: { prefixes: [`/${SISTEMA}`] } },
      },
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
              match: `Host(\`${e.dominio}\`) && PathPrefix(\`/${SISTEMA}/api/v1\`)`,
              kind: "Rule",
              priority: PRIORIDAD_DE_LA_API,
              // SIN `middlewares`: el backend espera la ruta entera. Ver la cabecera.
              services: [{ name: `kamayuk-${SISTEMA}-web`, port: 80 }],
            },
            {
              match: `Host(\`${e.dominio}\`) && PathPrefix(\`/${SISTEMA}\`)`,
              kind: "Rule",
              priority: PRIORIDAD_DE_LA_INTERFAZ,
              services: [{ name: NOMBRE_DE_LA_INTERFAZ, port: 80 }],
              middlewares: [{ name: quitarElPrefijo }],
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
            // Sin esta regla las tres que siguen NO SIRVEN DE NADA. Su motivo entero —y la
            // medida de las OCHO tareas que pasaron de `Failed` a `Complete`— esta en
            // `reglaDeDns()`, que desde #39 se escribe una vez y se usa dos: aqui y en la
            // politica de egreso de la interfaz.
            reglaDeDns(),
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
      // La interfaz, que **no comparte ninguna** de las aristas de arriba: su `componente` es
      // «normativa-interfaz» y no «normativa», asi que ningun `podSelector` de esta politica la
      // selecciona. Es lo que hace que un nginx de archivos estaticos no tenga salida a
      // PostgreSQL ni al buzon de `identidad` (#39). Ver `politicasDeLaInterfaz`.
      ...politicasDeLaInterfaz(e),
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
