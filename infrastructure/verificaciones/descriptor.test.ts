import { describe, expect, it } from "vitest";
import type {
  ConfigMap,
  Contenedor,
  EntornoDelDescriptor,
  Deployment,
  IngressRoute,
  Manifiesto,
  Service,
} from "@kamayuk/infra-contrato";
import { normativa } from "../src/descriptor";

/**
 * El descriptor de `normativa`, verificado sobre lo que devuelve.
 *
 * Esto es lo que corre en la maquina de quien lo escribe y en el CI de este repositorio: **sin
 * Pulumi, sin token y sin cluster**. La auditoria completa —las convenciones de `INF-01` §4 y las
 * cinco prohibiciones— la hace `infrastructure` al componer; aqui se comprueba lo que este
 * repositorio decide y solo el.
 */

const ENTORNO: EntornoDelDescriptor = {
  ambiente: "stg",
  namespace: "kamayuk-normativa-stg",
  dominio: "stg.kamayuk.example",
  etiquetas: { "app.kubernetes.io/part-of": "kamayuk", ambiente: "stg" },
  imagenDe: (c) => `ghcr.io/hneyra/kamayuk-${c}:0eee58e43e04b1c2d3f4a5b6c7d8e9f0a1b2c3d4`,
  secretoDe: (c) => `kamayuk-normativa-stg-${c}`,
  prioridadDe: (clase) => `kamayuk-stg-prioridad-${clase}`,
  // Del AMBIENTE, no de este sistema (C-7): quien recibe el aviso cuando algo
  // se rompe aqui. `checkInvariants` de `infrastructure` rechaza el relleno.
  operacion: { responsable: "Guardia de plataforma", canal: "guardia@example.pe" },
  // La municipalidad que el AMBIENTE implanta (C-14, punto 4). Los cuatro sistemas implantan la
  // misma, cada uno en su base.
  implantacion: {
    ubigeo: "200105",
    nombre: "Municipalidad Distrital de Catacaos",
    tipo: "DISTRITAL",
    administrador: "administrador",
    nombreDelAdministrador: "Administrador del sistema",
    esDemostracion: true,
    // El `id` de la fila que crea el Job de implantacion. En una base recien creada vale 1.
    municipalidadId: 1,
  },
  namespaceDe: (otro) => `kamayuk-${otro}-stg`,
  // El nombre de un `Job` lleva la version: un `Job` de Kubernetes es INMUTABLE.
  nombreConVersion: (base) => `${base}-0eee58e43e04`,
  plataforma: {
    namespace: "kamayuk-stg",
    // El anfitrion del motor, ya cruzando el namespace (C-17, punto 1). Los cuatro descriptores
    // escribian `postgres:5432` a mano, que es el nombre del `compose.yaml` local: en Kubernetes
    // no existe ningun `Service` que se llame asi.
    motor: "kamayuk-stg-postgres.kamayuk-stg:5432",
    emisor: "https://stg.kamayuk.example/keycloak/realms/kamayuk",
    jwks: "http://kamayuk-stg-identidad.kamayuk-stg:8080/keycloak/realms/kamayuk/protocol/openid-connect/certs",
    token: "http://kamayuk-stg-identidad.kamayuk-stg:8080/keycloak/realms/kamayuk/protocol/openid-connect/token",
  },
};

describe("el descriptor de normativa", () => {
  it("declara su base, y SOLO la suya", () => {
    const base = normativa.baseDeDatos(ENTORNO);
    expect(base.nombre).toBe("normativa");
    for (const rol of base.roles) {
      expect(rol.sobre).toEqual(["normativa"]);
      // Un superusuario OMITE RLS aunque haya FORCE (DAT-01 §0, hallazgo 1).
      expect(rol.superusuario).toBe(false);
    }
  });

  it("no fija la etiqueta de ninguna imagen: la pide", () => {
    // La prohibicion (b) de `infrastructure`, comprobada aqui tambien porque es la que sostiene
    // que una liberacion normal NO sea un `pulumi up` (ADR-0011 §5).
    const admisibles = normativa.imagenes.map((n) => ENTORNO.imagenDe(n));
    const imagenes = [...normativa.despliegue(ENTORNO), ...normativa.migracion(ENTORNO)]
      .flatMap((m) =>
        m.kind === "Deployment"
          ? m.spec.template.spec.containers
          : m.kind === "Job"
            ? m.spec.template.spec.containers
            : [],
      )
      .map((c) => c.image);
    expect(imagenes.length).toBeGreaterThan(0);
    for (const i of imagenes) expect(admisibles).toContain(i);
  });

  it("todas sus rutas van bajo su prefijo", () => {
    for (const m of normativa.ingreso(ENTORNO)) {
      if (m.kind !== "IngressRoute") continue;
      for (const r of m.spec.routes) {
        for (const encaje of r.match.matchAll(/PathPrefix\(`([^`]*)`\)/g)) {
          expect(encaje[1]).toMatch(/^\/normativa(\/|$)/);
        }
      }
    }
  });

  it("no emite ningun Secret, y su inventario no trae valores", () => {
    const todos = [
      ...normativa.despliegue(ENTORNO),
      ...normativa.migracion(ENTORNO),
      ...normativa.ingreso(ENTORNO),
    ];
    expect(todos.some((m) => (m as { kind: string }).kind === "Secret")).toBe(false);
    for (const c of normativa.claves(ENTORNO)) {
      for (const campo of ["valor", "value", "data", "stringData", "password"]) {
        expect((c as unknown as Record<string, unknown>)[campo]).toBeUndefined();
      }
    }
  });

  it("todo contenedor declara limites de recursos", () => {
    const contenedores = [...normativa.despliegue(ENTORNO), ...normativa.migracion(ENTORNO)].flatMap((m) =>
      m.kind === "Deployment"
        ? m.spec.template.spec.containers
        : m.kind === "Job"
          ? m.spec.template.spec.containers
          : [],
    );
    for (const c of contenedores) {
      expect(c.resources.requests.cpu).toBeTruthy();
      expect(c.resources.limits.memory).toBeTruthy();
    }
  });

  /**
   * Hasta la etapa 4 de ADR-0039 esta prueba decia «NO tiene egreso a ningun sistema, y es una
   * afirmacion», y exigia la lista vacia. **Cambia de signo, y hay que decir por que**: la
   * pregunta que la cabecera del descriptor dejaba escrita —«que dato de otro sistema hace falta
   * para sellar una cifra que la ley ya fijo»— sigue contestandose «ninguno», y ese egreso no es
   * para sellar. Es para **replicar la autorizacion**: la copia local de `usuario`, `grupo`,
   * `miembro` y `permiso` con la que el guardia autoriza sin un viaje de red deja de sembrarse a
   * mano y pasa a leerse del buzon de `identidad` (ADR-0039 §«Lo que cuesta»; AC-3.3 de
   * `infrastructure`#52). Es la unica arista, y es la que hace que un permiso retirado en
   * `identidad` llegue aqui.
   */
  it("tiene UN egreso a otro sistema, `identidad`, y solo ese (ADR-0039, etapa 4)", () => {
    expect(destinosDeEgreso()).toEqual(["identidad"]);
  });

  /**
   * Y la arista apunta al SISTEMA y no a Keycloak, que en la plataforma tambien se llama
   * `identidad`: los pods del sistema llevan `componente: identidad-sistema` a proposito (su
   * `CLAUDE.md`, «La colision de nombre con Keycloak»), y viven en `kamayuk-identidad-<amb>`,
   * no en el namespace de la plataforma. Una regla con `componente: identidad` hacia
   * `kamayuk-identidad-stg` no abre nada: ahi no hay ningun pod con esa etiqueta.
   */
  it("y esa arista va al namespace del sistema, al pod `identidad-sistema`, por el 8080", () => {
    const reglas = normativa.egreso(ENTORNO).flatMap((p) => p.spec.egress ?? []);
    const alSistema = reglas.filter((r) =>
      (r.to ?? []).some(
        (d) =>
          d.namespaceSelector?.matchLabels?.["kubernetes.io/metadata.name"] === "kamayuk-identidad-stg",
      ),
    );
    expect(alSistema).toHaveLength(1);
    const destino = alSistema[0]!.to![0]!;
    expect(destino.podSelector?.matchLabels?.["componente"]).toBe("identidad-sistema");
    expect((alSistema[0]!.ports ?? []).map((p) => `${p.protocol}/${p.port}`)).toEqual(["TCP/8080"]);
    // Y la de Keycloak sigue: sin ella el proceso web no se trae el JWKS y todo token es invalido.
    const aKeycloak = reglas.filter((r) =>
      (r.to ?? []).some(
        (d) =>
          d.namespaceSelector?.matchLabels?.["kubernetes.io/metadata.name"] === "kamayuk-stg" &&
          d.podSelector?.matchLabels?.["componente"] === "identidad",
      ),
    );
    expect(aKeycloak, "la arista a Keycloak (el JWKS) no puede irse con la del sistema").toHaveLength(1);
  });
});

/**
 * Como se nombra un destino de egreso en un rojo: su namespace, y su `componente` si lo lleva.
 *
 * `kamayuk-stg/postgres` se lee; `{ namespaceSelector: { matchLabels: … } }` no. Un rojo que
 * imprime el objeto entero obliga a leer JSON para saber si lo que sobra es el motor o el buzon.
 */
function nombreDelDestino(destino: {
  namespaceSelector?: { matchLabels?: Record<string, string> };
  podSelector?: { matchLabels?: Record<string, string> };
}): string {
  const namespace = destino.namespaceSelector?.matchLabels?.["kubernetes.io/metadata.name"] ?? "?";
  const componente = destino.podSelector?.matchLabels?.["componente"];
  return componente === undefined ? namespace : `${namespace}/${componente}`;
}

/**
 * Los SISTEMAS a los que este descriptor declara egreso. El motor y Keycloak no cuentan, y se
 * distinguen por el NAMESPACE de destino y no por el nombre de la etiqueta: `identidad` es
 * Keycloak en el namespace de la plataforma y el sistema en el suyo (la leccion de la etapa 1 de
 * `infrastructure`#52, `grafoDeEgreso`).
 */
function destinosDeEgreso(): string[] {
  const plataforma = ENTORNO.plataforma.namespace;
  return normativa
    .egreso(ENTORNO)
    .flatMap((p) => p.spec.egress ?? [])
    .flatMap((r) => r.to ?? [])
    .map((s) => s.namespaceSelector?.matchLabels?.["kubernetes.io/metadata.name"])
    .filter((ns): ns is string => ns !== undefined && ns !== plataforma && ns !== "kube-system")
    .map((ns) => {
      const encaje = /^kamayuk-(.+)-stg$/.exec(ns);
      expect(encaje, `un namespace de destino que no es de un sistema: ${ns}`).not.toBeNull();
      return encaje![1]!;
    })
    .sort();
}

describe("C-14 — que esto se pueda desplegar", () => {
  /**
   * El Job de migracion corre la imagen del MIGRADOR, no la de la aplicacion.
   *
   * Hasta C-14 corria la misma que el `Deployment` con `KAMAYUK_DB_USUARIO=kamayuk_owner` y sin perfil:
   * arrancaba el proceso web con las credenciales del unico rol con DDL, y la aplicacion tiene
   * `spring.flyway.enabled: false` a proposito (ARQ-03 §4). O sea que ese Job **no migraba**.
   */
  it("el Job de migracion corre el migrador, con las variables que el migrador lee", () => {
    const contenedores = contenedoresDe(normativa.migracion(ENTORNO));
    expect(contenedores).toHaveLength(1);
    const c = contenedores[0]!;
    expect(c.image).toBe(ENTORNO.imagenDe(`${"normativa"}-migrador`));
    expect(valorDe(c, "KAMAYUK_DB_OWNER_USUARIO")).toBe("kamayuk_owner");
    expect(declara(c, "KAMAYUK_DB_OWNER_CLAVE")).toBe(true);
    // La de la APLICACION. El migrador no la lee, y ponerla es lo que hacia que este Job
    // pareciera correcto sin migrar nada.
    expect(declara(c, "KAMAYUK_DB_USUARIO")).toBe(false);
  });

  /**
   * TRES imagenes y DOS `Dockerfile` (#39).
   *
   * `normativa` y `normativa-migrador` son dos objetivos del mismo `backend/Dockerfile`, con el
   * contexto en la raiz del repositorio. `normativa-interfaz` sale de `frontend/Dockerfile`, con
   * el contexto en `frontend/` — y esa diferencia no es cosmetica: un `.dockerignore` solo cuenta
   * desde la raiz de SU contexto, asi que construir aquel con el contexto en la raiz se llevaria
   * dentro `node_modules`, los `.env` —y con ellos la bandera que devuelve las cifras del corpus
   * al paquete— y el artboard entero.
   */
  it("y las tres imagenes son los objetivos de los dos Dockerfile", () => {
    expect(normativa.imagenes).toEqual(["normativa", "normativa-migrador", "normativa-interfaz"]);
  });

  /**
   * El Job de implantacion (C-7 §2.3): la fila de `municipalidad` en SU base.
   *
   * Con el migrador de contenedor de inicializacion: un `Deployment` no sabe esperar a un `Job`,
   * y la salida del monolito —un contenedor con `psql`— no vale aqui, porque un descriptor solo
   * puede nombrar SUS imagenes (prohibicion (b)).
   */
  it("implanta la municipalidad del ambiente, detras del esquema", () => {
    const jobs = normativa.implantacion(ENTORNO).filter((m) => m.kind === "Job");
    expect(jobs).toHaveLength(1);
    const job = jobs[0]!;
    expect(job.metadata.name).toContain("0eee58e43e04");
    const pod = job.spec.template.spec;
    expect((pod.initContainers ?? []).map((c) => c.image)).toEqual([
      ENTORNO.imagenDe(`${"normativa"}-migrador`),
    ]);
    const c = pod.containers[0]!;
    expect(c.image).toBe(ENTORNO.imagenDe("normativa"));
    expect(valorDe(c, "SPRING_PROFILES_ACTIVE")).toBe("batch");
    expect(valorDe(c, "KAMAYUK_IMPLANTACION_UBIGEO")).toBe("200105");
    expect(valorDe(c, "KAMAYUK_IMPLANTACION_ESDEMOSTRACION")).toBe("true");
  });

  /**
   * Un `podSelector` sin `namespaceSelector` selecciona pods **del mismo namespace**, y desde
   * ADR-0031 cada sistema tiene el suyo. Una regla escrita asi no abre nada: el sintoma es
   * trafico denegado con una politica que dice permitirlo.
   */
  it("toda regla de egreso nombra el namespace de su destino", () => {
    const destinos = normativa.egreso(ENTORNO)
      .flatMap((p) => p.spec.egress ?? [])
      .flatMap((r) => r.to ?? []);
    expect(destinos.length).toBeGreaterThan(0);
    for (const destino of destinos) {
      expect(destino.namespaceSelector, JSON.stringify(destino)).toBeDefined();
    }
  });
});

/** Los contenedores de una lista de manifiestos, los de inicializacion aparte. */
function contenedoresDe(manifiestos: readonly Manifiesto[]) {
  return manifiestos.flatMap((m) =>
    m.kind === "Deployment"
      ? m.spec.template.spec.containers
      : m.kind === "Job"
        ? m.spec.template.spec.containers
        : m.kind === "CronJob"
          ? m.spec.jobTemplate.spec.template.spec.containers
          : [],
  );
}

function valorDe(c: Contenedor, nombre: string): string | undefined {
  return (c.env ?? []).find((e) => e.name === nombre)?.value;
}

function declara(c: Contenedor, nombre: string): boolean {
  return (c.env ?? []).some((e) => e.name === nombre);
}

describe("ADR-0039, etapa 4 — el consumidor del buzon de identidad", () => {
  /**
   * Hasta la etapa 4 esto afirmaba `lotes(...) == []`: «`normativa` no corre nada de madrugada;
   * sellar es un acto con dos firmas, no una tarea programada». Sigue sin correr nada para
   * sellar. Lo que corre ahora, cada cinco minutos, es la replica de la autorizacion.
   *
   * **Y no nace suspendido.** Un `suspend: true` diria «corre esto, y hoy no puede»; lo que
   * sostiene que pueda no es un interruptor sino una guarda que se pone roja: la credencial
   * declara `emisor: "keycloak"` y `identidad-de-servicio` de `infrastructure` exige que cada
   * municipalidad declare el cliente de servicio. Es la leccion de `rentas` #21 AC-4, donde dos
   * guardas DEMANDABAN el `suspend` y quitarlo ponia rojo el arbol.
   */
  it("declara su configuracion entera, y CORRE", () => {
    const crones = normativa.lotes(ENTORNO).filter((m) => m.kind === "CronJob");
    expect(crones).toHaveLength(1);
    const cron = crones[0]!;
    // `undefined` es lo que Kubernetes lee como «no suspendido». Se afirma que NO es `true` y no
    // que sea `false`: declarar `suspend: false` seria ruido en el manifiesto.
    expect(cron.spec.suspend, "el consumidor nacio suspendido (AC-7 de identidad#4)").not.toBe(true);
    expect(cron.spec.schedule).toBe("*/5 * * * *");
    // Dos vueltas a la vez aplicarian la misma cola dos veces; el `ON CONFLICT` de la copia lo
    // aguantaria, pero seria trabajo doble en el nodo justo.
    expect(cron.spec.concurrencyPolicy).toBe("Forbid");
    expect(cron.spec.jobTemplate.spec.backoffLimit).toBe(1);
    const pod = cron.spec.jobTemplate.spec.template.spec;
    expect(pod.restartPolicy).toBe("Never");
    expect(pod.priorityClassName).toBe("kamayuk-stg-prioridad-lote");
    const c = pod.containers[0]!;
    expect(c.image).toBe(ENTORNO.imagenDe("normativa"));
    expect(valorDe(c, "SPRING_PROFILES_ACTIVE")).toBe("batch");
    // `@ConditionalOnProperty("kamayuk.identidad.consumidor.municipalidad")`: sin ella el runner
    // no existe y el proceso arranca, no consume nada y sale con cero.
    expect(valorDe(c, "KAMAYUK_IDENTIDAD_CONSUMIDOR_MUNICIPALIDAD")).toBe("1");
    // El buzon vive en el namespace del SISTEMA `identidad`, y su servicio es el `-web`.
    expect(valorDe(c, "KAMAYUK_IDENTIDAD_URL")).toBe("http://kamayuk-identidad-web.kamayuk-identidad-stg");
    expect(valorDe(c, "KAMAYUK_IDENTIDAD_TOKEN")).toBe(ENTORNO.plataforma.token);
    expect(valorDe(c, "KAMAYUK_IDENTIDAD_CLIENTE")).toBe("kamayuk-normativa-servicio-200105");
    expect(declara(c, "KAMAYUK_IDENTIDAD_CREDENCIAL")).toBe(true);
    // `ResponsableDeLaCopiaLocal` exige los dos: un evento apartado es un permiso que aqui no
    // llego, y avisar a nadie es no avisar.
    expect(valorDe(c, "KAMAYUK_IDENTIDAD_CONSUMIDOR_RESPONSABLE")).toBe("Guardia de plataforma");
    expect(valorDe(c, "KAMAYUK_IDENTIDAD_CONSUMIDOR_CANAL")).toBe("guardia@example.pe");
    expect(c.resources.limits.memory).toBeTruthy();
  });

  /**
   * La implantacion termina con una pasada del consumidor, para que la municipalidad recien
   * implantada traiga lo que `identidad` ya publico. Lleva las mismas variables de identidad
   * que el `CronJob` **menos** la que enciende el runner del `CronJob`: con las dos, la misma
   * pasada correria dos veces en el mismo proceso.
   */
  it("la implantacion lleva las variables del consumidor, y NO el interruptor del CronJob", () => {
    const c = contenedoresDe(normativa.implantacion(ENTORNO))[0]!;
    const cron = contenedoresDe(normativa.lotes(ENTORNO))[0]!;
    const deIdentidad = (x: Contenedor) =>
      (x.env ?? []).map((v) => v.name).filter((n) => n.startsWith("KAMAYUK_IDENTIDAD_")).sort();
    expect(deIdentidad(c)).toEqual(
      deIdentidad(cron).filter((n) => n !== "KAMAYUK_IDENTIDAD_CONSUMIDOR_MUNICIPALIDAD"),
    );
    expect(declara(c, "KAMAYUK_IDENTIDAD_CONSUMIDOR_MUNICIPALIDAD")).toBe(false);
    expect(deIdentidad(c)).toHaveLength(6);
  });

  /**
   * La credencial se declara con su emisor. Sin `emisor: "keycloak"` seria indistinguible de una
   * clave de PostgreSQL —una cadena aleatoria de `bootstrap-secretos.sh` que ningun emisor
   * firmo— y el sintoma seria un 401 en el primer pod, con el build en verde (#21).
   */
  it("la credencial de identidad se declara con emisor keycloak, y el secreto es el que monta", () => {
    const clave = normativa.claves(ENTORNO).find((k) => k.nombre === "kamayuk-normativa-stg-identidad");
    expect(clave).toBeDefined();
    expect(clave!.emisor).toBe("keycloak");
    const c = contenedoresDe(normativa.lotes(ENTORNO))[0]!;
    const ref = (c.env ?? []).find((v) => v.name === "KAMAYUK_IDENTIDAD_CREDENCIAL")?.valueFrom?.secretKeyRef;
    expect(ref?.name).toBe(clave!.nombre);
    expect(ref?.key).toBe(clave!.clave);
  });

  /** Y el perfil `batch` corre donde hay trabajo: en el Job de implantacion y en el CronJob. */
  it("el perfil `batch` corre donde hay trabajo: la implantacion y el consumidor", () => {
    const perfiles = contenedoresDe([...normativa.implantacion(ENTORNO), ...normativa.lotes(ENTORNO)]).map(
      (c) => valorDe(c, "SPRING_PROFILES_ACTIVE"),
    );
    expect(perfiles).toEqual(["batch", "batch"]);
  });
});

describe("C-17 — que el despliegue pase de verdad", () => {
  /**
   * El anfitrion del motor **se pide**, y este descriptor no escribe ninguno.
   *
   * Es la mutacion que este criterio existe para cazar: hasta C-17 la constante decia
   * `jdbc:postgresql://postgres:5432/...`, y en Kubernetes no hay ningun `Service` llamado
   * `postgres` —ese nombre viene del `compose.yaml` local—. Medido en el clúster:
   * `UnknownHostException` en los ocho Jobs de los cuatro sistemas y en sus `Deployment`.
   */
  it("toda URL de base sale del anfitrion que entrega el entorno", () => {
    const urls = contenedoresDe([
      ...normativa.despliegue(ENTORNO),
      ...normativa.migracion(ENTORNO),
      ...normativa.implantacion(ENTORNO),
      ...normativa.lotes(ENTORNO),
    ]).flatMap((c) => (c.env ?? []).map((v) => v.value ?? ""))
      .filter((v) => v.startsWith("jdbc:"));

    expect(urls.length, "ninguna variable lleva una URL de base: ¿se dejo de leer?").toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toBe(`jdbc:postgresql://${ENTORNO.plataforma.motor}/normativa`);
    }
  });

  /**
   * DNS, sin el cual las demas reglas de egreso no sirven de nada.
   *
   * Una politica de egreso convierte a los pods que selecciona en «solo lo declarado», y todo lo
   * que estas reglas nombran —el motor, la identidad, los sistemas hermanos— se alcanza por el
   * nombre de un `Service`. Resolverlo es una consulta a CoreDNS, en `kube-system`. Con la regla
   * anadida a mano sobre el clúster, las ocho tareas de los cuatro sistemas pasaron de `Failed` a
   * `Complete` (C-17, punto 3).
   */
  it("abre DNS hacia kube-system, en UDP y en TCP, en TODA politica de egreso", () => {
    // Desde #39 hay DOS politicas de egreso —la del backend y la de la interfaz— y las dos la
    // necesitan. Se cuenta por politica y no en total: dos reglas de DNS en la misma politica y
    // ninguna en la otra darian la misma suma y dejarian un pod sin resolver un solo nombre.
    const politicas = normativa.egreso(ENTORNO).filter((p) => (p.spec.egress ?? []).length > 0);

    expect(politicas.length, "ninguna politica declara egreso: ¿se dejo de leer?").toBeGreaterThan(1);
    for (const politica of politicas) {
      const dns = (politica.spec.egress ?? []).filter((r) =>
        (r.to ?? []).some(
          (d) => d.namespaceSelector?.matchLabels?.["kubernetes.io/metadata.name"] === "kube-system",
        ),
      );

      expect(
        dns,
        `«${politica.metadata.name}» no abre DNS: sin el, ninguna de sus demas reglas puede resolver un nombre`,
      ).toHaveLength(1);
      expect(
        (dns[0]?.ports ?? []).map((p) => `${p.protocol}/${p.port}`).sort(),
        "TCP tambien: una respuesta que no cabe en un datagrama se reintenta por TCP",
      ).toEqual(["TCP/53", "UDP/53"]);
    }
  });
});

/**
 * La interfaz desplegada (#39).
 *
 * Ninguna de estas propiedades falla haciendo ruido. Es la lista de las que, rotas, dejan un
 * despliegue que arranca:
 *
 *   · Las dos prioridades del ingreso al reves hacen que la API la conteste el nginx, **con un
 *     200 y el `index.html` dentro**.
 *   · El prefijo quitado en la ruta del backend lo deja buscando `/api/v1/...` y contestando 404.
 *   · La interfaz heredando la etiqueta del backend gana salida a PostgreSQL y al buzon de
 *     `identidad`, que es superficie que nadie pidio.
 *   · Y un `ConfigMap` con el JWKS en vez del emisor publico da una interfaz que manda al
 *     navegador a una direccion de la red interna del cluster.
 */
describe("#39 — la interfaz desplegada", () => {
  const manifiestos = normativa.despliegue(ENTORNO);
  // Con `is` y no con `as`: el `kind` es el discriminante de la union, asi que narrar por el es
  // lo que hace que el compilador lea la forma de verdad. Un `as` la afirmaria sin comprobarla,
  // y una ruta que dejara de existir saldria como `undefined` en vez de como un rojo.
  const rutaDe = (ms: Manifiesto[]): IngressRoute => {
    const encontrada = ms.find((m): m is IngressRoute => m.kind === "IngressRoute");
    expect(encontrada, "el ingreso no declara ningun IngressRoute").toBeDefined();
    return encontrada!;
  };
  const rutas = rutaDe(normativa.ingreso(ENTORNO)).spec.routes;
  const deLaApi = rutas.find((r) => r.match.includes("/normativa/api/v1"));
  const deLaInterfaz = rutas.find((r) => !r.match.includes("/normativa/api/v1"));

  const interfazDe = (ms: Manifiesto[]) =>
    contenedoresDe(
      ms.filter((m) => m.kind === "Deployment" && m.metadata.name === "kamayuk-normativa-interfaz"),
    );

  /**
   * Desde #39 son dos `Deployment` y no uno: el backend en perfil `web` y la interfaz, que es un
   * nginx y no una JVM.
   */
  it("produce DOS Deployment —el backend y la interfaz— y ninguno en perfil `batch`", () => {
    const nombres = manifiestos.filter((m) => m.kind === "Deployment").map((m) => m.metadata.name);
    expect(nombres.sort()).toEqual(["kamayuk-normativa-interfaz", "kamayuk-normativa-web"]);
  });

  /**
   * La interfaz no hereda NADA de la configuracion del backend.
   *
   * Es la mitad que no se ve mirando lo que si declara: un nginx que sirve archivos no necesita
   * la URL de la base, ni el emisor, ni un `secretKeyRef`. Un `Secret` montado aqui seria una
   * credencial regalada a un proceso que no la usa.
   */
  it("la interfaz no declara ni una variable de entorno ni un solo secreto", () => {
    const interfaz = interfazDe(manifiestos);
    expect(interfaz).toHaveLength(1);
    expect(interfaz[0]?.env ?? []).toEqual([]);
    expect(JSON.stringify(interfaz[0])).not.toContain("secretKeyRef");
  });

  /**
   * Las sondas piden `/index.html` y no `/`.
   *
   * Con el `try_files` de `nginx.conf`, `/` devuelve la pantalla caiga lo que caiga, asi que
   * pedirlo no distingue «nginx levantado» de «nginx levantado sobre el `dist/` que se copio».
   */
  it("sus dos sondas piden un archivo por su nombre", () => {
    const contenedor = interfazDe(manifiestos)[0]!;
    for (const sonda of [contenedor.readinessProbe, contenedor.livenessProbe]) {
      expect(sonda?.httpGet?.path, "«/» cae al index.html pase lo que pase").toBe("/index.html");
    }
    // Sin `startupProbe`, al reves que el backend: un nginx escucha en menos de un segundo, y una
    // sonda de arranque aqui solo retrasaria la primera lectura.
    expect(contenedor.startupProbe).toBeUndefined();
  });

  /**
   * Las dos prioridades, **escritas y no heredadas de la longitud de la regla**.
   *
   * Traefik v3 ordena por longitud del `match` cuando nadie declara `priority`, asi que hoy
   * saldria bien por accidente. Y al reves el fallo no grita: la API la contestaria el nginx con
   * un 200 y el `index.html` dentro. La pantalla pide JSON y recibe HTML con codigo de exito.
   */
  it("la ruta va partida en dos, y la de la API gana por prioridad ESCRITA", () => {
    expect(rutas, "la ruta va partida en dos: la API y la interfaz").toHaveLength(2);
    expect(deLaApi?.priority).toBeTypeOf("number");
    expect(deLaInterfaz?.priority).toBeTypeOf("number");
    expect(
      deLaApi!.priority!,
      "[con la precedencia al reves, «/normativa/api/v1/conjuntos» lo atiende el nginx de la\n" +
        "interfaz: su `try_files $uri /index.html` devuelve el index.html con un **200**, asi que\n" +
        "la pantalla pide JSON y recibe HTML con codigo de exito. No un error: una pagina]",
    ).toBeGreaterThan(deLaInterfaz!.priority!);
  });

  /**
   * El prefijo se quita SOLO en la de la interfaz.
   *
   * `Api.RAIZ` del backend es `/normativa/api/v1` entera, asi que quitarselo lo dejaria buscando
   * `/api/v1/...` y contestando 404 a todo. Y a la interfaz hay que quitarselo porque su nginx
   * sirve en la raiz de su contenedor.
   */
  it("el prefijo se quita SOLO en la ruta de la interfaz", () => {
    expect(deLaApi?.middlewares, "el backend espera la ruta entera").toBeUndefined();
    expect((deLaInterfaz?.middlewares ?? []).map((m) => m.name)).toEqual([
      "kamayuk-normativa-quitar-prefijo",
    ]);

    // El `Middleware` de Traefik esta en la union `Manifiesto` y el contrato **no exporta su
    // tipo suelto**, asi que se saca de la union con `Extract` en vez de escribir su forma aqui:
    // una forma copiada a mano no se enteraria el dia que el contrato la cambie.
    const middleware = normativa
      .ingreso(ENTORNO)
      .find(
        (m): m is Extract<Manifiesto, { kind: "Middleware" }> => m.kind === "Middleware",
      );
    expect(middleware?.metadata.name).toBe("kamayuk-normativa-quitar-prefijo");
    expect(middleware?.spec["stripPrefix"]).toEqual({ prefixes: ["/normativa"] });
  });

  /** Cada ruta a SU servicio, y el de la interfaz no es el del backend. */
  it("la API va al backend y la interfaz a la interfaz", () => {
    expect(deLaApi?.services.map((s) => s.name)).toEqual(["kamayuk-normativa-web"]);
    expect(deLaInterfaz?.services.map((s) => s.name)).toEqual(["kamayuk-normativa-interfaz"]);
  });

  /**
   * La interfaz **no hereda** las aristas del backend, y el vehiculo es la etiqueta.
   *
   * `egreso()` selecciona por `componente: normativa`. Con esa misma etiqueta, el `podSelector`
   * del backend la seleccionaria y un nginx de archivos estaticos tendria salida a PostgreSQL y
   * al buzon de `identidad`.
   */
  it("la interfaz no sale a PostgreSQL ni al buzon de identidad: solo DNS", () => {
    // La etiqueta se LEE del pod de la interfaz, no se escribe aqui: si alguien le pusiera la del
    // backend, esto no daria «no encuentro sus politicas» —que manda a mirar el sitio
    // equivocado— sino la acusacion de verdad, que es que sale a sitios que no necesita.
    const suPod = manifiestos.find(
      (m): m is Deployment =>
        m.kind === "Deployment" && m.metadata.name === "kamayuk-normativa-interfaz",
    );
    const suComponente = suPod?.spec.template.metadata?.labels?.["componente"];

    const alcanzan = normativa
      .egreso(ENTORNO)
      .filter(
        (p) =>
          (p.spec.policyTypes ?? []).includes("Egress") &&
          p.spec.podSelector.matchLabels?.["componente"] === suComponente,
      );
    const destinos = alcanzan
      .flatMap((p) => p.spec.egress ?? [])
      .flatMap((r) => (r.to ?? []).map((d) => nombreDelDestino(d)))
      .sort();

    expect(
      destinos,
      "[una interfaz que solo sirve archivos no habla con nadie: el mismo origen lo consigue el\n" +
        "ingreso, un piso mas arriba, y `nginx.conf` no tiene un solo reenvio. Si aqui aparece el\n" +
        "motor o el buzon, este nginx heredo las aristas del backend por llevar su etiqueta]",
    ).toEqual(["kube-system"]);

    expect(alcanzan.map((p) => p.metadata.name)).toEqual(["kamayuk-normativa-interfaz-egreso"]);
  });

  /**
   * Y la de entrada abre el puerto del POD, no el del `Service`.
   *
   * Una `NetworkPolicy` filtra sobre el puerto del pod, y el mapeo 80 -> 8080 lo deshace el
   * `Service` antes de que la politica mire nada. Escribir 80 aqui seria una politica que no
   * admite absolutamente nada, y el sintoma seria el navegador esperando con el pod sano.
   */
  it("la entrada viene del ingreso y abre el 8080 del contenedor", () => {
    const entrada = normativa
      .egreso(ENTORNO)
      .find((p) => p.metadata.name === "kamayuk-normativa-interfaz-ingreso");
    expect((entrada?.spec.ingress ?? []).flatMap((r) => r.ports ?? [])).toEqual([
      { protocol: "TCP", port: 8080 },
    ]);

    const servicio = manifiestos.find(
      (m): m is Service =>
        m.kind === "Service" && m.metadata.name === "kamayuk-normativa-interfaz",
    );
    expect(servicio?.spec.ports).toEqual([{ name: "http", port: 80, targetPort: 8080 }]);
  });

  /**
   * El `ConfigMap` lleva el emisor PUBLICO, que es el que el navegador tiene que alcanzar.
   *
   * `plataforma.jwks` NO vale aqui: es una direccion de la red interna del cluster, que el
   * navegador no puede alcanzar. Confundirlas daria una interfaz que manda a identificarse a una
   * URL que solo existe dentro del cluster — y el sintoma es un rebote que no llega a ningun
   * sitio, con el pod perfectamente sano.
   */
  it("las senias del ambiente llevan el emisor publico y el cliente que se reusa", () => {
    const configuracion = manifiestos.find(
      (m): m is ConfigMap => m.kind === "ConfigMap" && m.metadata.name.includes("interfaz"),
    );
    const guion = (configuracion?.data ?? {})["configuracion.js"] ?? "";

    expect(guion).toContain("window.__KAMAYUK_NORMATIVA__");
    expect(guion).toContain(ENTORNO.plataforma.emisor);
    expect(guion, "el JWKS es interno: el navegador no lo alcanza").not.toContain(
      ENTORNO.plataforma.jwks,
    );
    // Se REUSA el de `rentas` en vez de declarar uno propio: mismo realm, mismos usuarios, y la
    // autorizacion la hace este backend contra su copia local. Ver `CLIENTE_OIDC_DE_LA_INTERFAZ`.
    expect(guion).toContain("kamayuk-backoffice");
    // Sin `offline_access`: el token vive en una variable de modulo y muere con la pestana, asi
    // que una credencial de vida larga seria justo lo que ese diseno evita.
    expect(guion).not.toContain("offline_access");
  });

  /**
   * El montaje cae sobre el archivo que `nginx` sirve, y con `subPath`.
   *
   * Sin `subPath` el montaje tapa el directorio entero y se lleva por delante el `index.html` y
   * todo `assets/`: la imagen serviria un directorio con un solo archivo dentro.
   */
  it("el ConfigMap se monta sobre configuracion.js, con subPath", () => {
    const contenedor = interfazDe(manifiestos)[0]!;
    expect(contenedor.volumeMounts).toEqual([
      {
        name: "configuracion",
        mountPath: "/usr/share/nginx/html/configuracion.js",
        subPath: "configuracion.js",
        readOnly: true,
      },
    ]);
  });

  /**
   * `runAsNonRoot` sin `runAsUser`, y eso solo vale porque la imagen declara su uid en NUMERO.
   *
   * La otra mitad —que `frontend/Dockerfile` diga `USER 101` y no `USER nginx`— la comprueba
   * `frontend/verificaciones/imagen-y-despliegue.test.ts`, leyendo el archivo. Con un `USER` no
   * numerico el kubelet se niega a crear el contenedor con un `CreateContainerConfigError`, y eso
   * solo aparece al desplegar.
   */
  it("la interfaz corre sin root, con el mismo endurecimiento que el backend", () => {
    const contenedor = interfazDe(manifiestos)[0]!;
    expect(contenedor.securityContext).toEqual({
      runAsNonRoot: true,
      allowPrivilegeEscalation: false,
      capabilities: { drop: ["ALL"] },
    });
    expect(contenedor.resources?.limits, "sin limites, `infrastructure` lo rechaza").toBeDefined();
  });
});
