# syntax=docker/dockerfile:1
#
# `kamayuk-normativa-interfaz`: la interfaz de normativa, compilada y servida como archivos
# estaticos.
#
# ## POR QUE SE LLAMA `interfaz` Y NO `web`
#
# Porque `kamayuk-normativa-web` YA ES OTRA COSA: en `infrastructure/src/descriptor.ts` es el
# nombre del **`Deployment` y el `Service` del BACKEND** con el perfil `web` de Spring —lo compone
# `despliegueDelPerfil(e, "web", true)` como `kamayuk-${SISTEMA}-${perfil}`—, o sea un proceso que
# no tiene nada que ver con este.
#
# Un `Service` de Kubernetes y una imagen de un registro son espacios de nombres distintos, asi
# que la colision **no seria un error**: seria peor. Dos artefactos del mismo producto llamados
# igual, uno sirviendo la API y otro archivos estaticos, y a partir de ahi cualquier frase del
# tipo «despliega `kamayuk-normativa-web`» tiene dos respuestas. Es lo que `catastro` tiene hoy y
# lo que `rentas` y `caja` decidieron por escrito no tener.
#
# ## Por que NO se reutiliza `backend/Dockerfile`
#
# Aquel compila con Gradle y su contexto es la RAIZ del repositorio, porque tiene `COPY` que salen
# de `backend/`. Este no necesita nada de fuera de `frontend/`, asi que su contexto es `frontend/`
# y su `.dockerignore` es `frontend/.dockerignore`. Las dos decisiones van juntas: un
# `.dockerignore` solo se aplica desde la raiz del contexto, de modo que el de la raiz —que ademas
# excluye `frontend/` entero— no dice nada de esta imagen.
#
# ## Las dos etapas se tratan distinto a proposito
#
# `construccion` se tira: nada de ella se publica, y por eso su base es la etiqueta movil
# `node:22-alpine` —la version mayor es la que `frontend.yml` declara y lo que fija que se instale
# es `yarn.lock` con `--frozen-lockfile`—.
#
# `interfaz` SI se publica, asi que su base va clavada: `nginx:1.31.5-alpine`, no `stable-alpine`
# ni `1.31`. Es lo que permite que un escaneo de imagenes diga de que version habla, y actualizar
# el numero es la correccion cuando el escaneo encuentre algo, no ignorar el hallazgo.

# ---------------------------------------------------------------------------
FROM node:22-alpine AS construccion

WORKDIR /origen

# Primero el manifiesto y el candado, y nada mas: asi la capa de dependencias se reutiliza
# mientras esos dos archivos no cambien, que es lo que hace barato reconstruir tras tocar una
# pantalla. `--frozen-lockfile` es lo mismo que exige `frontend.yml`: si `package.json` y
# `yarn.lock` no cuadran, esto falla aqui en vez de instalar en silencio una version distinta de
# la que se verifico.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# EL PROXY DE DATOS, APAGADO Y DICHO.
#
# Vite sustituye `import.meta.env.VITE_*` **al construir**, asi que con esta variable en `false`
# la condicion de `src/arranque.ts` se pliega y el `import()` dinamico del proxy —con las siete
# operaciones y todas las cifras del corpus capturadas del artboard— se cae del paquete. Medido
# en esta misma rama: `dist/` sale con **1 787 522** bytes con la bandera apagada y **1 889 312**
# con ella encendida, y la diferencia es el trozo `proxy-*.js` entero (20 221 bytes) con su mapa.
#
# **Y aqui esa bandera protege mas que en los otros cuatro repositorios**: lo que el trozo
# arrastra son la UIT de cinco ejercicios, los tramos de la escala progresiva con sus alicuotas y
# filas de los tres cuadros nacionales. Un bundle de produccion con esas cifras dentro seria este
# repositorio —el que existe para que las cifras vivan en el corpus firmado a dos manos
# (ADR-0007, regla 5)— publicandolas por un camino que no pasa por ninguna firma.
#
# Es la PRIMERA de dos vallas, y ninguna sobra. `vite build` no lee `.env.development` —solo se
# carga en modo desarrollo—, o sea que en teoria bastaria con no hacer nada; pero «el paquete sale
# limpio porque nadie se acordo de encenderlo» es una propiedad que se pierde el dia que alguien
# cree un `.env.production`. Escribirlo aqui lo hace una decision y no una casualidad. La segunda
# valla es `.dockerignore`, que deja fuera del contexto **todos** los `.env*`.
ENV VITE_KAMAYUK_PROXY_DE_DATOS=false

RUN yarn build

# LOS MAPAS DE FUENTE NO SE PUBLICAN, y es una decision con dos motivos, el segundo MEDIDO AQUI.
#
# `vite.config.ts` declara `build.sourcemap: true` desde F-1, asi que `dist/` sale con un `.map`
# por trozo. No se toca esa opcion —`yarn build` tiene que seguir dando lo mismo para todo lo que
# ya se mide contra el— y se retiran **aqui**, que es donde importa:
#
#   1. Un `.map` lleva dentro **el codigo fuente entero**. Publicarlo entrega el arbol a
#      cualquiera que abra las herramientas del navegador. Y aqui son 1 354 034 bytes frente a los
#      297 627 del `.js`: el mapa es cuatro veces y media lo que se sirve para ejecutar.
#   2. **Llevan las cifras del corpus, y esto se midio y no se supuso.** Con la bandera APAGADA,
#      `5500.00` —la UIT de 2026— aparece **cero** veces en el `.js` y **si** dentro del
#      `index-*.js.map`. O sea que sin este paso la propiedad que la bandera compra seria falsa
#      por los mapas, con el codigo que se ejecuta perfectamente limpio.
#
# Se quita tambien el comentario `sourceMappingURL` que quedaria apuntando a un archivo que ya no
# esta: dejarlo daria un 404 en la consola de cada navegador que abriera las herramientas, y un
# aviso que sale siempre es un aviso que nadie lee.
RUN find dist -name '*.map' -delete \
    && find dist -name '*.js' -exec sed -i '/^\/\/# sourceMappingURL=/d' {} + \
    && find dist -name '*.css' -exec sed -i '/^\/\*# sourceMappingURL=/d' {} +

# ---------------------------------------------------------------------------
FROM nginx:1.31.5-alpine AS interfaz

# La base trae su propio `index.html` de bienvenida y un `50x.html`. Se vacia el directorio antes
# de copiar para que lo que la imagen sirve sea EXACTAMENTE `dist/` y nada mas — que es lo que
# hace legible un `ls /usr/share/nginx/html` como comprobacion, en vez de dejar dos archivos
# ajenos que hay que aprenderse para saber que sobran.
RUN rm -rf /usr/share/nginx/html/*

COPY --from=construccion /origen/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# LO QUE SE SIRVE NO LLEVA CODIGO FUENTE NI UNA CIFRA DEL CORPUS.
#
# ## Por que la comprobacion esta AQUI y no en la etapa de construccion
#
# Porque una comprobacion sobre un artefacto intermedio no afirma nada sobre el artefacto que se
# publica: un `COPY --from=construccion /origen/src/ /usr/share/nginx/html/src/` en ESTA etapa no
# lo veria nadie, porque la comprobacion ya habria corrido en otra imagen. Es el hallazgo que
# `rentas` midio en su #44 —con ese `COPY` puesto, el `docker build` salia en VERDE y la imagen
# servia `/src/api/identidad.ts` con 200— y por eso aqui nace en el sitio correcto.
#
# ## Lo que busca
#
# `vite build` no deberia emitir un solo `.ts`/`.tsx`, pero «no deberia» no es una comprobacion.
# Y con el corpus igual: si alguna seccion importara `datos/prototipo.ts` de forma ESTATICA, las
# cifras entrarian en el paquete aunque la bandera este apagada, porque lo que Rollup se lleva por
# delante es lo que solo se alcanza por el `import()` dinamico.
#
# Las cinco cadenas salen de medir los dos `dist/`: las cuatro primeras aparecen **solo** en
# `proxy-*.js` con la bandera encendida y en ningun archivo con ella apagada; `5500.00` es la UIT
# de 2026 y es la que demuestra por que los mapas se retiran — con la bandera apagada esta en el
# `.map` y no en el `.js`.
RUN set -eu; \
    servido=/usr/share/nginx/html; \
    if find "$servido" \( -name '*.ts' -o -name '*.tsx' \) | grep -q .; then \
        echo "Lo que se sirve lleva codigo fuente dentro:"; \
        find "$servido" \( -name '*.ts' -o -name '*.tsx' \); exit 1; \
    fi; \
    for cadena in 'AGYA 1.0L E AT' 'FO COMFORT' 'AUTOCRAFT' 'Carreras de caballos' '5500.00'; do \
        if grep -rqF "$cadena" "$servido"; then \
            echo "Lo que se sirve lleva una cifra del corpus: «$cadena». Viven en el conjunto sellado y se PIDEN (regla 5, ADR-0007)."; \
            grep -rlF "$cadena" "$servido"; exit 1; \
        fi; \
    done; \
    echo "lo servido esta limpio: sin fuentes y sin cifras del corpus"

# Sin root, y esto es lo unico que lo consigue: la configuracion de `nginx:*-alpine` trae `User`
# VACIO, o sea que sin este `USER` la interfaz correria como root. El usuario `nginx` ya existe en
# la base con uid 101.
#
# Ponerle `USER` a secas no basta, y hay tres cosas que arreglar:
#
#   1. `/var/cache/nginx` — el maestro crea ahi sus directorios temporales al arrancar. Sin
#      permiso de escritura no es un aviso: es `[emerg] mkdir() ... failed (13: Permission
#      denied)` y el contenedor no levanta.
#   2. `/etc/nginx` — dos guiones del entrypoint escriben ahi en CADA arranque
#      (`30-tune-worker-processes.sh` hace `sed -i.bak` sobre `nginx.conf`, y
#      `10-listen-on-ipv6-by-default.sh` empieza por un `touch` de `default.conf`). Sin permiso
#      los dos abortan con un error por consola en cada arranque.
#   3. El pid, que por omision va a `/run/nginx.pid`. Se manda a `/tmp`, escribible por cualquiera.
#
# El `chown` es a `nginx:0` y el `chmod` a `g=u` —por GRUPO y no por usuario— para que siga
# funcionando si el orquestador decide correrlo con un uid arbitrario del grupo 0, que es como
# despliega OpenShift.
#
# Y se borra `user nginx;` del conf principal porque nginx no puede cambiar de usuario cuando ya
# no es root: la directiva queda muerta y el arranque la anuncia en cada reinicio.
RUN sed -i \
        -e '/^user  *nginx;/d' \
        -e 's#^pid .*#pid /tmp/nginx.pid;#' \
        /etc/nginx/nginx.conf \
    && chown -R nginx:0 /var/cache/nginx /etc/nginx \
    && chmod -R g=u /var/cache/nginx /etc/nginx

# EL UID EN NUMERO, no `USER nginx`, y no es estilo.
#
# `infrastructure/src/descriptor.ts` endurece todo contenedor con `runAsNonRoot: true` —«el
# endurecimiento que no admite excepcion», aqui es `SEGURIDAD`—. Con un `USER` no numerico el
# kubelet **no puede comprobar** que el usuario no es root y se niega a arrancar el contenedor,
# con un `CreateContainerConfigError` que solo aparece al desplegar. Por eso las dos imagenes del
# backend ya usan `USER 10001` y `USER 10002`.
#
# El 101 es el del usuario `nginx` de la base, asi que el `chown` de arriba —que resuelve el
# nombre en tiempo de construccion, cuando todavia se es root— apunta a este mismo uid. Y es el
# mismo numero que `infrastructure/infra/verificaciones/usuario-de-los-contenedores.ts` tiene
# anotado para las interfaces de `rentas` y de `caja`, releyendolo de su `Dockerfile`.
USER 101
EXPOSE 8080

# La sonda se ejecuta DENTRO del contenedor, y aqui —al reves que en `backend/Dockerfile`— no hay
# que instalar ningun cliente: el `wget` de busybox viene en la base.
#
# Pide `/index.html` y no `/`: con el `try_files` de `nginx.conf`, `/` devuelve la pantalla
# **aunque el directorio este vacio**. Pedir el archivo **por su nombre** es lo unico que
# distingue «nginx levantado» de «nginx levantado sobre el `dist/` que se copio»: si el `COPY`
# fallara, esto da 404 y el contenedor sale `unhealthy`.
#
# En forma JSON, o sea sin shell de por medio: `wget --spider` ya sale con codigo 1 cuando no
# puede conectar o recibe un 4xx, de modo que el `|| exit 1` que la forma de shell obliga a
# escribir no anade nada y se lleva por delante un proceso mas.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "--spider", "-q", "http://127.0.0.1:8080/index.html"]
