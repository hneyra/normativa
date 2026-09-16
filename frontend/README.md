# `normativa-web`

La interfaz de `normativa`, sobre el `Armazon` de [`@kamayuk/shell`](https://github.com/hneyra/kamayuk-lib)
y el intérprete de `@kamayuk/ui`. El contexto entero —qué hay, qué no, y qué lo decide— está en el
[`CLAUDE.md`](../CLAUDE.md) del repositorio y en la épica
[#47](https://github.com/hneyra/normativa/issues/47).

Este archivo dice **una sola cosa**: cómo se regenera el locale, y por qué no se escribe a mano.

## El texto: el español es la clave

Todo el texto pasa por `t()` y **la clave es la frase en castellano** ([#60](https://github.com/hneyra/normativa/issues/60)).
No hay identificadores opacos: `t('Estado del ejercicio')`.

Se decidió así porque `verificaciones/pantallas-del-artboard.test.ts` compara las cuatro
definiciones **campo por campo y literal** contra `diseno/NormativaV8.dc.html`. Con claves opacas esa
comparación moriría —compararía claves contra castellano— y sus rojos pasarían de nombrar la frase a
nombrar un identificador, justo cuando más falta hace leerlos. Un segundo idioma, con esta forma, es
un JSON que mapea castellano → destino. Sólo existe `es`; lo que está instalado es la costura.

## `src/i18n/locales/es.json` SE REGENERA, no se escribe

```bash
yarn i18n:regenerar
```

Son cientos de entradas **derivadas** de las definiciones de las pantallas, del árbol, del catálogo,
de las palabras del marco y de las piezas propias — ver `src/i18n/catalogo-de-claves.ts`. A mano se
quedan viejas a la primera pantalla nueva, y nadie echa de menos lo que nadie listó.

Que el archivo del disco cuadre con lo que el sistema dice lo comprueba
`verificaciones/el-locale-esta-completo.test.ts`, que corre dentro de `yarn verificar`.

### Al rebasar, un conflicto en `es.json` se REGENERA

Es la regla de choques de la épica [#47](https://github.com/hneyra/normativa/issues/47) para la ola 3
en adelante, y no es una preferencia de estilo: el archivo es **una salida**, no una fuente.
Resolverlo a mano es elegir a ojo entre dos salidas de dos árboles distintos, y el resultado no es la
salida de ninguno de los dos.

```bash
git checkout --ours frontend/src/i18n/locales/es.json   # da igual cuál: se va a reescribir
cd frontend && yarn i18n:regenerar
git add src/i18n/locales/es.json
```

Después, `yarn verificar`. Si el locale quedó mal, sale rojo nombrando qué clave falta o sobra.

## Las órdenes

```bash
yarn install --frozen-lockfile
yarn verificar        # lint, tipos, i18n y pruebas. La misma que corre la CI
yarn build            # el bundle. Un `tsc` en verde no demuestra que Vite empaquete
yarn i18n             # las claves que el código usa y el locale no tiene. Va dentro de `verificar`
yarn i18n:regenerar   # reescribe `src/i18n/locales/es.json`
yarn dev              # sólo para mirar
```

Hace falta **Node 22** (`.nvmrc`) y el clon hermano `kamayuk-lib` **al lado** de este repositorio:
los cinco `@kamayuk/*` entran por `link:../../kamayuk-lib/paquetes/*`.
