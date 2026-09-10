import { describe, expect, it } from "vitest";
import type { Contenedor, EntornoDelDescriptor, Manifiesto } from "@kamayuk/infra-contrato";
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

  it("y las dos imagenes son los dos objetivos del Dockerfile", () => {
    expect(normativa.imagenes).toEqual(["normativa", `${"normativa"}-migrador`]);
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
  it("abre DNS hacia kube-system, en UDP y en TCP", () => {
    const reglas = normativa.egreso(ENTORNO).flatMap((p) => p.spec.egress ?? []);
    const dns = reglas.filter((r) =>
      (r.to ?? []).some(
        (d) => d.namespaceSelector?.matchLabels?.["kubernetes.io/metadata.name"] === "kube-system",
      ),
    );

    expect(dns, "sin DNS ninguna de las demas reglas de egreso puede resolver un nombre").toHaveLength(1);
    expect(
      (dns[0]?.ports ?? []).map((p) => `${p.protocol}/${p.port}`).sort(),
      "TCP tambien: una respuesta que no cabe en un datagrama se reintenta por TCP",
    ).toEqual(["TCP/53", "UDP/53"]);
  });
});
