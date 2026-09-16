# Lo que la V6 hacía y el intérprete no expresa

> **Medido a mano el 2026-09-14** sobre la V6 congelada en `c01fe9a`, hoja por hoja
> (`frontend/src/secciones/`), con [hneyra/normativa#51](https://github.com/hneyra/normativa/issues/51).
> Cada cita lleva un fragmento literal de su línea y **lo comprueba** `node frontend/diseno/comprobar-huecos.mjs`:
> si una línea se mueve o se copió mal, sale en rojo nombrando la entrada. No corre en CI (el
> `checkout` superficial no trae `c01fe9a`): se corre en local.
>
> **Conciliado el 2026-09-15** con los doce huecos que [hneyra/normativa#52](https://github.com/hneyra/normativa/issues/52)
> encontró al derivar `NormativaV8.dc.html` (N1–N12, [comentario en #51](https://github.com/hneyra/normativa/issues/51#issuecomment-5660090605)),
> en [hneyra/normativa#76](https://github.com/hneyra/normativa/issues/76): diez se funden en la entrada que ya
> los decía y dos son entradas nuevas. La tabla está en [N1–N12, conciliados](#n1n12-conciliados).

Es la entrada de [`kamayuk-lib`#61](https://github.com/hneyra/kamayuk-lib/issues/61) —lo genérico que
`normativa` necesita y [`kamayuk-lib`#44](https://github.com/hneyra/kamayuk-lib/issues/44) no cubre— y de
las hojas de la épica [hneyra/normativa#47](https://github.com/hneyra/normativa/issues/47):
[#58](https://github.com/hneyra/normativa/issues/58), [#65](https://github.com/hneyra/normativa/issues/65),
[#66](https://github.com/hneyra/normativa/issues/66), [#67](https://github.com/hneyra/normativa/issues/67) y
[#68](https://github.com/hneyra/normativa/issues/68).

## Contra qué se mide

Contra la gramática de `rentas/frontend/src/pantallas/tipos.ts` en `ac379ac`, que sube a `@kamayuk/ui` con
[`kamayuk-lib`#27](https://github.com/hneyra/kamayuk-lib/issues/27):

- `Pantalla{instruccion, bloques[]}` y `Bloque{titulo, nota, campos[], tabla?}`;
- `Campo` de siete tipos —`''` texto, `s` lista, `d` fecha, `r` sólo lectura, `c` casilla, `a` área, `t`— con su variante de ancho `…1`;
- `Tabla{titulo, columnas[{rotulo, alineadoDerecha}], nota?, columnaDeInsignia?, accion?}`.

Desde `rentas`#97 ni el valor de un campo `r` ni las filas viajan en la definición (`tipos.ts:72-91` y
`:130-137`), y en el artboard (`RentasV8.dc.html:652-655`) no hay nada que diga pasos, selección de fila,
paginación ni dependencia entre consultas. Lo que sí trae el intérprete tal como quedó en la librería
(`kamayuk-lib@942fb59:paquetes/ui/interprete/`) se tiene en cuenta: `DatosDeLaPantalla{valores, filas, conteos,
ausencia, ausenciaPorCampo}` (`datos.ts:40-44`), `tonoDeLaInsignia(texto)` del consumidor y `alEnsuciar`
(`Pantalla.tsx:48`, `:54`).

**No es un hueco** lo que cabe ahí: un bloque con título y nota fijos, una rejilla de sólo lectura con sus
valores servidos, una tabla con columnas, alineación, nota y conteo, un campo con su ayuda, un desplegable de
opciones fijas. **Es un hueco** todo lo demás.

## Cómo se lee una entrada

- **Hoja**: `nor-panel`, `nor-ediciones`, `nor-cuadros` o `nor-publicacion`.
- **Citas**: `c01fe9a:<ruta>:<línea>` y, entre comillas dobles invertidas, un fragmento literal de esa línea.
  Una cita es una línea: los rangos se dicen en la prosa.
- **Forma mínima**: un ejemplo de **qué** haría falta decir como dato, en vocabulario neutro si es genérico.
  **Cómo** se llama lo decide `kamayuk-lib`#44 o #61.
- **Clase** (ADR-0030 §4): **genérico** si le serviría a otro sistema sin nombrar a `normativa`; **propio**
  si necesitaría nombrar un conjunto, un ámbito, un snapshot o un ejercicio. Lo mixto está partido en dos
  entradas (`a`/`b`).
- **Renace en**: una salida por entrada.
  - **KL#44** es «lo que #44 cubre». Desde el 2026-09-14 eso son **cuatro issues**: #44 (punto de extensión,
    lecturas y textos) y su reparto en [#65](https://github.com/hneyra/kamayuk-lib/issues/65) (campos y
    tablas), [#66](https://github.com/hneyra/kamayuk-lib/issues/66) (actos y acciones) y
    [#67](https://github.com/hneyra/kamayuk-lib/issues/67) (la hoja en la ruta, maestro-detalle y pestañas).
    Se escribe «KL#44 (reparto: #65)» con el nombre del hueco de `catastro` que lo cubre.
  - **KL#61** si no lo cubre ninguno de esos cuatro. **KL#57** si es del cliente HTTP.
  - **El punto de extensión de KL#44**, en la hoja que lo implementa, para lo propio.
  - La hoja (normativa#65 a #68), o **no renace**, con el motivo.

Los números de hueco 1 a 35 son los de la tabla de hneyra/normativa#51; del 36 al 48 son los que
aparecieron al recorrer las cuatro hojas, y H49 y H50 son los dos de N1–N12 que no tenían entrada. Una entrada que
absorbió un N lo dice en el índice y en un párrafo **N… (#52)** con su cita.

## Índice

| # | Hueco | Hojas | Clase | Renace en |
|---|---|---|---|---|
| [H01](#h01--paginacion-y-orden-en-el-servidor) | Paginación y orden en el servidor | ediciones | genérico | KL#61 |
| [H02](#h02--filtro-en-el-cliente-con-conteo) | Filtro en el cliente sobre la página servida, con conteo | ediciones | genérico | KL#61 |
| [H03](#h03--seleccion-de-fila-y-detalle) | Selección de una fila y su ficha al lado | ediciones | genérico | KL#44 (reparto: #67) |
| [H04a](#h04a--pasos-en-pestanas) | Pasos en pestañas, y cuáles se ofrecen | ediciones | genérico | KL#44 (reparto: #67) |
| [H04b](#h04b--los-tres-actos-de-la-edicion) | Abrir, agregar y sellar como flujo | ediciones | propio | extensión, normativa#68 |
| [H05a](#h05a--acto-con-observacion-y-cuerpo-compuesto) | El acto con observación y el cuerpo compuesto de sus campos | ediciones | genérico | KL#44 (reparto: #66) |
| [H05b](#h05b--obligatorio-u-opcional-por-campo) | Obligatorio u opcional por campo, con su mensaje (y N3, N4) | ediciones | genérico | KL#61 |
| [H49](#h49--ayuda-en-un-desplegable) | Ayuda en un desplegable (N2) | ediciones | genérico | KL#44 (reparto: #65) |
| [H50](#h50--ayuda-en-un-campo-de-solo-lectura) | Ayuda en un campo de sólo lectura (N1) | ediciones | genérico | KL#61 |
| [H06](#h06--compuerta-con-un-motivo) | La compuerta con UN motivo, dicho en tres sitios | ediciones | genérico | KL#44 (reparto: #66) |
| [H07](#h07--errores-tras-el-primer-intento) | Errores sólo tras el primer intento | ediciones | genérico | KL#61 |
| [H08](#h08--impedido-con-aria-disabled) | `aria-disabled` con motivo, nunca `disabled` | ediciones, publicacion | genérico | KL#44 (reparto: #66) |
| [H09](#h09--negativa-del-servidor-tal-cual) | La negativa del servidor, tal cual y persistente | ediciones | genérico | KL#57 |
| [H10](#h10--solo-lectura-con-lo-servido) | Campos de sólo lectura con lo servido | ediciones | genérico | no renace (cabe) |
| [H11](#h11--ausencia-por-bloque) | Ausencia por bloque | panel | genérico | KL#44 |
| [H12](#h12--error-total-y-error-parcial) | Error total frente a error parcial | ediciones | genérico | KL#44 |
| [H13a](#h13a--parametro-global-del-marco) | Un parámetro global del marco que gobierna las lecturas | las cuatro | genérico | KL#44 (reparto: #67) |
| [H13b](#h13b--opciones-propias-escritas-en-src) | Ejercicios y tipos de parámetro escritos en `src/` | ediciones | propio | extensión, normativa#68 |
| [H14a](#h14a--selector-que-gobierna-una-lectura) | Un selector local que gobierna una lectura, y no hace la hoja editable (N11) | cuadros, publicacion | genérico | KL#44 (reparto: #67) |
| [H14b](#h14b--los-dos-ambitos) | Los dos ámbitos del snapshot | cuadros, publicacion | propio | extensión, normativa#66 |
| [H15](#h15--lecturas-encadenadas) | Lecturas encadenadas | ediciones, cuadros, publicacion | genérico | normativa#66 |
| [H16](#h16--texto-que-depende-del-dato) | Texto que depende del dato | panel, ediciones, publicacion | genérico | KL#44 |
| [H17](#h17--la-composicion-del-sello-escrita-en-src) | La composición del sello de 2026, escrita en `src/` | panel | propio | no renace |
| [H18](#h18--tono-de-insignia-como-dato) | Tono de insignia como dato | panel, ediciones, publicacion | genérico | KL#44 (reparto: #65) |
| [H19](#h19--marca-de-vigente) | La marca «Vigente», calculada | panel, ediciones | propio | extensión, normativa#65 |
| [H20](#h20--pestanas-con-conteo) | Pestañas internas con conteo | cuadros | genérico | KL#44 (reparto: #67) |
| [H21](#h21--tablas-grandes) | Tablas de decenas de miles de filas | cuadros | genérico | KL#61 |
| [H22a](#h22a--celda-nula-con-palabra-y-nota) | Celda nula con su palabra y su nota | ediciones, cuadros, publicacion | genérico | KL#61 |
| [H22b](#h22b--tramo-abierto) | «Sin tope» y «Más de N años» | cuadros | propio | extensión, normativa#66 |
| [H23](#h23--cabecera-con-campo-y-dominio) | Cabecera o etiqueta con el campo JSON y su dominio (N5) | cuadros, publicacion | genérico | KL#61 |
| [H24](#h24--que-significa-un-cuadro-vacio) | Qué significa un cuadro vacío: cuatro estados | cuadros | propio | extensión, normativa#66 |
| [H25](#h25--dominio-comprobado-sobre-lo-llegado) | El dominio comprobado sobre lo llegado | cuadros | propio | extensión, normativa#66 |
| [H26](#h26--vacio-con-su-salida) | El vacío con su acción dentro | las cuatro | genérico | KL#61 |
| [H27](#h27--abrir-otra-hoja-con-parametro) | Abrir otra hoja con parámetro | panel, publicacion | genérico | KL#44 (reparto: #66) |
| [H28](#h28--cabeceras-y-texto-crudo) | Leer cabeceras y el cuerpo sin reserializar | publicacion | genérico | KL#57 |
| [H29a](#h29a--la-pantalla-de-la-huella) | La comprobación de la huella, dicha en pantalla | publicacion | propio | extensión, normativa#67 |
| [H29b](#h29b--huella-de-los-bytes-en-el-cliente) | `ETag` == sha256 de los bytes, en el cliente | publicacion | genérico | normativa#67 |
| [H30a](#h30a--guardar-como-archivo) | Guardar como archivo los bytes verificados | publicacion | genérico | KL#61 |
| [H30b](#h30b--nombre-del-archivo) | El nombre compuesto del archivo | publicacion | propio | extensión, normativa#67 |
| [H31](#h31--comparar-los-dos-ambitos) | Comparar las dos descargas de un conjunto | publicacion | propio | extensión, normativa#67 |
| [H32a](#h32a--404-de-dominio-y-404-de-ruta) | El 404 de dominio frente al de ruta | cuadros, publicacion | genérico | KL#57 |
| [H32b](#h32b--ejercicio-sin-publicar) | «Ese ejercicio no tiene un conjunto sellado» | cuadros, publicacion | propio | extensión, normativa#67 |
| [H33](#h33--validar-el-ejercicio-antes-de-pedir) | Validar el ejercicio antes de pedir | cuadros, publicacion | propio | extensión, normativa#66 |
| [H34](#h34--filas-de-contenido-que-viajan) | Filas de CONTENIDO que sí viajan | panel, publicacion | genérico | KL#61 |
| [H35a](#h35a--el-sitio-sobrevive-a-irse-y-volver) | Página, orden, ficha y paso sobreviven a irse y volver | ediciones | genérico | KL#44 (reparto: #67) |
| [H35b](#h35b--lo-tecleado-y-la-negativa-sobreviven) | Lo tecleado y la negativa sobreviven: choca con la `key` | ediciones | genérico | KL#61 |
| [H36](#h36--estados-de-una-lectura) | Cada lectura espera en su sitio | panel, ediciones, cuadros | genérico | KL#44 |
| [H37](#h37--aviso-efimero-tras-un-acto) | Aviso efímero tras un acto | ediciones, publicacion | genérico | KL#61 |
| [H38](#h38--la-hoja-se-marca-sucia-al-teclear) | La hoja se marca sucia al teclear | ediciones | genérico | KL#61 |
| [H39](#h39--pie-de-operaciones) | El pie que dice qué operaciones sirven la hoja, y el pie de pantalla (N9) | panel, publicacion | genérico | KL#44 |
| [H40](#h40--nota-al-pie-del-bloque) | Nota al pie de un bloque, y más de una nota (N12) | las cuatro | genérico | KL#44 |
| [H41](#h41--aviso-fijo-con-titulo) | Aviso fijo con título y varios párrafos, dentro de la hoja (N7) | ediciones, cuadros | genérico | KL#44 |
| [H42](#h42--insignias-fijas-en-la-cabecera) | Insignias y ruta en la cabecera de un bloque (N10) | cuadros, publicacion | genérico | KL#61 |
| [H43](#h43--texto-con-marcas) | Texto con marcas (`code`, `strong`) (N6) | panel, cuadros, publicacion | genérico | KL#61 |
| [H44](#h44--documento-fuente-de-las-filas) | El documento fuente, sacado de las filas, y la tabla y el ámbito constantes (N8) | cuadros | propio | extensión, normativa#66 |
| [H45](#h45--bloque-de-una-sola-pestana) | Nota, pie y bloque de una sola pestaña | cuadros | genérico | KL#44 (reparto: #67) |
| [H46](#h46--accion-en-cada-fila) | Una acción en cada fila | panel | genérico | KL#44 (reparto: #65) |
| [H47](#h47--cuantas-trae-cada-lista-y-por-que) | Cuántas filas trae cada lista y por qué | publicacion | propio | extensión, normativa#67 |
| [H48](#h48--descartar-lo-escrito) | Descartar lo escrito | ediciones | genérico | KL#61 |

## Lecturas y estados

### H01 · `paginacion-y-orden-en-el-servidor`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61 (sus H1 y H3)

`?pagina`, `?tamano` (tope 500), `?ordenarPor` —sólo de la lista cerrada `ejercicio`, `version`, `estado`, `id`— y
`?direccion` viajan en la ruta; los mandos son desplegables, «Página N de M» va entre «Anterior» y «Siguiente», y
los dos llevan `aria-disabled` cuando no hay a dónde ir.

- `c01fe9a:frontend/src/secciones/conjuntos.ts:55` `` export const ORDENES_ADMITIDOS ``
- `c01fe9a:frontend/src/secciones/conjuntos.ts:66` `` export const DIRECCIONES ``
- `c01fe9a:frontend/src/secciones/conjuntos.ts:76` `` export const TAMANO_MAXIMO = 500; ``
- `c01fe9a:frontend/src/secciones/conjuntos.ts:98` `` Math.min(Math.max(estado.tamano, 1), TAMANO_MAXIMO) ``
- `c01fe9a:frontend/src/secciones/conjuntos.ts:107` `` consulta.toString() ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:128` `` useUno<Paginado<ConjuntoResource>>(rutaDelListado(estado)) ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:273` `` Ordenar por ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:411` `` aria-disabled={estado.pagina === 0} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:423` `` Página ${String(pagina.pagina + 1)} de ${String(pagina.totalPaginas)} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:427` `` aria-disabled={pagina === null || !pagina.hayMas} ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:40` `` readonly pagina: number; ``

```json
{"tabla":{"paginacion":{"en":"servidor","parametros":{"pagina":"pagina","tamano":"tamano","orden":"ordenarPor","sentido":"direccion"},"tamanos":[20,50,100,500],"orden":{"admitidos":["a","b"],"rotulos":{"a":"Campo A","b":"Campo B"},"sentidos":["DESCENDENTE","ASCENDENTE"]},"indicador":"Página {pagina} de {totalPaginas}","siguienteSi":"hayMas"}}}
```

**Por qué KL#61.** En `catastro`, `paginacion` y `orden` los usa una sola hoja y se quedaron locales
(catastro#137); KL#65 lo dice en «Lo que NO entra»: la paginación la decide #61 junto con #25. La forma de la
respuesta es la `RespuestaPaginada` común (`contenido, pagina, tamano, totalElementos, totalPaginas, hayMas`).

### H02 · `filtro-en-el-cliente-con-conteo`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61 (nuevo: no está entre sus H1-H13)

El buscador y los chips «Todas / Abiertas / Selladas» filtran **la página que el servidor mandó**, y el conteo dice
«N de M · T en total» para que la diferencia no se lea como filas que faltan. No viajan porque `?estado=` sería un
422 «parámetro desconocido» de `GuardiaDeParametros`.

- `c01fe9a:frontend/src/secciones/ediciones.ts:435` `` «parametro desconocido» ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:439` `` export function filtrar( ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:449` `` estado.chip === 'Todas' ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:228` `` placeholder="Año, «v2» o identificador" ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:252` `` aria-pressed={estado.chip === chip} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:268` `` String(visibles.length)} de ${String(servidos.length)} · ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:270` `` en total ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:21` `` export const CHIPS: readonly string[] = ['Todas', 'Abiertas', 'Selladas']; ``

```json
{"tabla":{"filtroLocal":{"buscador":{"marcador":"Año o identificador","buscaEn":["{a}","v{b}","{id}"]},"chips":[{"rotulo":"Todas"},{"rotulo":"Abiertas","campo":"estado","vale":"ABIERTO"}],"conteo":"{visibles} de {servidas} · {totalElementos} en total"}}}
```

**Por qué KL#61.** `buscador` y `chips-de-filtro` de `catastro` se quedaron locales (KL#65 y KL#67, «Lo que NO
entra»), y además van **a la ruta y al servidor**. Aquí es lo contrario: filtran en memoria y lo dicen.

### H03 · `seleccion-de-fila-y-detalle`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#44 (reparto: #67, `maestro-detalle`)

La fila elegida lleva `aria-current` y abre su ficha al lado —identificador, insignias, título y contexto—, sin
salir de la lista; elegir otra reinicia el paso, lo tecleado, el intento y la negativa.

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:139` `` const elegida = servidos.find((uno) => uno.id === estado.elegida) ?? null; ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:170` `` const elegir = (conjunto: ConjuntoResource) => { ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:385` `` aria-current={estado.elegida === conjunto.id} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:439` `` <div className="kn-ediciones__ficha"> ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:443` `` 'Sin conjunto' ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:452` `` <p className="kn-ficha__titulo"> ``

```json
{"tipo":"maestroDetalle","maestro":{"fila":{"titulo":"{a} · versión {b}","insignia":"{estado}","linea":"{sello}","pie":"registro {id}"}},"detalle":{"cabecera":{"identificador":"registro {id}","titulo":"{a} · versión {b}"},"sinEleccion":{"identificador":"Sin registro","insignia":"Nuevo"},"alElegir":{"reinicia":["paso","valores","intento","rechazo"]}}}
```

**Observación.** La V6 busca la elegida sólo entre las filas de la página (`:139`): si no vino en esta página,
la ficha cae en silencio al formulario de apertura. `catastro` dice «no está en esta página»; aquí no se dice.

### H11 · `ausencia-por-bloque`

**Hoja** `nor-panel` · **genérico** · **Renace en** KL#44 (`estados-de-una-lectura`: el error de UNA lectura, con su peldaño, en su sitio)

Sin el acceso `parametros`, el bloque de las versiones dice «hace falta el acceso» —no «no se pudo leer», que
mandaría a reintentar— y el resto del Panel sigue contestando con la lectura de sesión propia.

- `c01fe9a:frontend/src/secciones/Panel.tsx:76` `` const sinAcceso = codigoDelError(conjuntos.error) === 'SIN_PRIVILEGIO'; ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:193` `` tipo="sin-permiso" ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:194` `` Hace falta el acceso «parametros» para ver las versiones ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:203` `` {!sinAcceso && conjuntos.error !== null && ( ``
- `c01fe9a:frontend/src/secciones/conjuntos.ts:188` `` export function codigoDelError(error: string | null): string { ``

```json
{"bloques":[{"titulo":"Estado","lectura":"estado"},{"titulo":"Versiones","lectura":"lista","sinPermiso":{"titulo":"Hace falta el acceso «{acceso}» para ver esto","texto":"El resto de la hoja sigue contestando."}}]}
```

### H12 · `error-total-y-error-parcial`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#44 (`fallo-fuera-de-su-lectura`)

Si la lista no llega, no hay nada que enseñar; si la lista llega y la lectura de «cuál rige» no, se dice encima y la
lista sigue, avisando de que la marca se resolvió sobre la página.

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:131` `` const rige = useUno<EjercicioParametrizadoResource>( ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:321` `` {listado.error !== null && ( ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:338` `` {listado.error === null && rige.error !== null && ( ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:341` `` titulo="No se pudo resolver cuál conjunto rige" ``

```json
{"bloque":{"lecturas":["principal","auxiliar"],"falloDe":{"principal":"tapa","auxiliar":"encima"},"textoDelParcial":"La lista está, pero no se pudo preguntar por {periodo}."}}
```

**Observación.** El «Reintentar» del error total sale siempre (`c01fe9a:frontend/src/secciones/Ediciones.tsx:332` `` Reintentar ``),
aunque el cliente sabe cuándo reintentar no cambia nada (`c01fe9a:frontend/src/api/cliente.ts:177` `` get reintentable(): boolean { ``).

### H15 · `lecturas-encadenadas`

**Hojas** `nor-ediciones`, `nor-cuadros`, `nor-publicacion` · **genérico** · **Renace en** normativa#66 (y #67, #65)

`GET /conjuntos?ejercicio` da el `conjuntoId`, y con él se pide el snapshot; sin el primero no se pide nada. En
Ediciones, un conjunto sin sellar no tiene snapshot y no se pide.

- `c01fe9a:frontend/src/secciones/Cuadros.tsx:59` `` const conjuntoId = vigente.dato?.conjuntoId ?? null; ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:61` `` conjuntoId === null ? null : RUTAS.snapshot(conjuntoId, ambito), ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:64` `` nulo no se pide nada ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:66` `` conjuntoId === null ? null : RUTAS.snapshot(conjuntoId, 'VALUACION'), ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:146` `` elegida !== null && elegida.estado === SELLADO ``

```json
{"lecturas":{"vigente":{"ruta":"/recursos?periodo={marco.periodo}"},"documento":{"ruta":"/recursos/{vigente.id}/documento","soloSi":"vigente.id"}}}
```

**Por qué la hoja.** Encadenar consultas es conectar datos, y KL#61 lo deja fuera («Conectar datos (TanStack Query,
conectores): es de cada sistema»). Lo que sí es de la librería —que el bloque diga «falta el sujeto» mientras la
primera no llega— ya es el `soloSi` de `estados-de-una-lectura` (KL#44).

### H32a · `404-de-dominio-y-404-de-ruta`

**Hojas** `nor-cuadros`, `nor-publicacion` · **genérico** · **Renace en** KL#57 (AC6: las extensiones del `problem+json`)

Los dos son 404; lo que separa «ese ejercicio no está publicado» de «esa ruta no existe» es el miembro
`parametroQueFalta` del cuerpo, y la pantalla lo pinta como vacío con salida y no como avería.

- `c01fe9a:frontend/src/api/cliente.ts:166` `` get faltaUnaCifraNormativa(): boolean { ``
- `c01fe9a:frontend/src/api/cliente.ts:396` `` ...leerParametroQueFalta(cuerpo.parametroQueFalta), ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:358` `` return fallo.estado === 404 && fallo.faltaUnaCifraNormativa; ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:74` `` const sinPublicar = vigente.fallo !== null && esEjercicioSinPublicar(vigente.fallo); ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:74` `` const sinPublicar = vigente.fallo !== null && esEjercicioSinPublicar(vigente.fallo); ``

```json
{"lectura":{"siFalla":[{"estado":404,"conExtension":"recursoQueFalta","como":"vacio"},{"estado":404,"como":"no-encontrado"}]}}
```

### H32b · `ejercicio-sin-publicar`

**Hojas** `nor-cuadros`, `nor-publicacion` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#67 (y #66)

El texto de ese 404 —«Ese ejercicio no tiene un conjunto de parámetros sellado»—, su insignia `404` y la explicación
de por qué es 404 y no 422 nombran el ejercicio y el conjunto.

- `c01fe9a:frontend/src/secciones/Publicacion.tsx:444` `` <Insignia tono="atencion">404</Insignia> ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:449` `` titulo="Ese ejercicio no tiene un conjunto de parámetros sellado" ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:468` `` <code>parametroQueFalta</code> del cuerpo ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:128` `` titulo="Ese ejercicio no tiene un conjunto de parámetros sellado" ``

```json
{"pieza":"ejercicioSinPublicar","clave":"normativa.ejercicio-sin-publicar"}
```

### H33 · `validar-el-ejercicio-antes-de-pedir`

**Hojas** `nor-cuadros`, `nor-publicacion` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#66 (y #67)

Un ejercicio que no es un año entre 1990 y 2100 no se manda: el 422 que contestaría hablaría del parámetro y no de
lo que pasa.

- `c01fe9a:frontend/src/secciones/seccion.ts:10` `` const PRIMER_EJERCICIO = 1990; ``
- `c01fe9a:frontend/src/secciones/seccion.ts:26` `` if (!/^\d{4}$/.test(ejercicio.trim())) return null; ``
- `c01fe9a:frontend/src/secciones/seccion.ts:28` `` return anio >= PRIMER_EJERCICIO && anio <= ULTIMO_EJERCICIO ? anio : null; ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:104` `` {pedido === null && ( ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:107` `` titulo="El ejercicio de trabajo no es un ejercicio" ``

```json
{"pieza":"ejercicioPedido","clave":"normativa.ejercicio-pedido"}
```

**Observación.** Cuadros usa la misma función (`c01fe9a:frontend/src/secciones/Cuadros.tsx:57` `` const pedido = ejercicioPedido(ejercicio); ``)
pero no pinta ningún aviso cuando sale `null`: no pide y no dice por qué.

### H36 · `estados-de-una-lectura`

**Hojas** `nor-panel`, `nor-ediciones`, `nor-cuadros` · **genérico** · **Renace en** KL#44 (`estados-de-una-lectura`)

Cada lectura ocupa su sitio con esqueletos y `aria-busy` mientras llega, y su error va en ese mismo sitio; la tabla
pinta filas de hueco en vez de quedarse vacía.

- `c01fe9a:frontend/src/secciones/Panel.tsx:83` `` aria-busy={estado.cargando} ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:94` `` {estado.error === null && estado.cargando && ( ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:351` `` {listado.error === null && listado.cargando && ( ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:507` `` cargando={paso.id === PASO_DE_LECTURA && listado.cargando} ``
- `c01fe9a:frontend/src/secciones/Tabla.tsx:129` `` {cargando && ``

```json
{"tipo":"lectura","operacion":{"verbo":"GET","ruta":"/recursos"},"cargando":{"filasDeHueco":5},"error":{"titulo":"No se pudieron leer los registros"},"bloques":[]}
```

## Textos

### H16 · `texto-que-depende-del-dato`

**Hojas** `nor-panel`, `nor-ediciones`, `nor-publicacion` · **genérico** · **Renace en** KL#44 (`texto-con-dato` y `pieza-condicional`)

Título, insignia, texto y botón del Panel cambian con `sellado`, y «no hay conjunto sellado» es un 200 que se pinta
como estado y no como error; el conteo de filas y la ruta pedida llevan el dato dentro.

- `c01fe9a:frontend/src/secciones/Panel.tsx:77` `` const hayConjunto = estado.dato?.sellado === true; ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:111` `` no tiene ningún conjunto sellado ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:114` `` {hayConjunto ? 'Se puede emitir' : 'No se puede emitir'} ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:130` `` conjunto sellado» es una respuesta y llega como 200, no como 404. ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:140` `` : 'Abrir la primera versión'} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:460` `` Corregir un conjunto sellado exige una versión nueva ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:620` `` String(parametros.length)} filas ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:87` `` GET ${PREFIJO}${RUTAS.snapshot(conjuntoId, ambito)} ``

```json
{"titulo":{"segun":"cerrado","valores":{"true":"El periodo {periodo} está cerrado","false":"El periodo {periodo} no tiene nada cerrado"}},"insignia":{"segun":"cerrado","valores":{"true":{"tono":"ok","texto":"Se puede"},"false":{"tono":"atencion","texto":"No se puede"}}}}
```

### H17 · `la-composicion-del-sello-escrita-en-src`

**Hoja** `nor-panel` · **propio** · **Renace en** no renace

El bloque «Con qué se selló 2026» sólo existe si la barra dice 2026, y sus cuentas —33 filas, 2 cuadros, 35
detalles— están escritas en `src/`; el pie de D-11 calcula `ejercicio + 1` sobre esa constante.

- `c01fe9a:frontend/src/secciones/panel.ts:185` `` no lo publica ninguna operacion ``
- `c01fe9a:frontend/src/secciones/panel.ts:215` `` export const SELLO_DE_2026: ComposicionDelSello = { ``
- `c01fe9a:frontend/src/secciones/panel.ts:219` `` filasDelCorpus: 33, ``
- `c01fe9a:frontend/src/secciones/panel.ts:221` `` detalles: 35, ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:147` `` {SELLO_DE_2026.ejercicio === anio && ( ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:320` `` {String(SELLO_DE_2026.ejercicio + 1)} ``

```json
{"pieza":"composicionDelSello","clave":"normativa.composicion-del-sello","desde":"una respuesta que hoy no existe"}
```

**Por qué no renace.** Una cuenta escrita en `src/` es exactamente lo que `sin-cifras-inventadas`
(hneyra/normativa#58) tiene que impedir, y la propia V6 dice que **ninguna operación la publica** (`panel.ts:185`).
Si alguna vez vuelve, vuelve como dato servido: eso es trabajo del backend (hneyra/normativa#56), no un hueco del
intérprete.

### H18 · `tono-de-insignia-como-dato`

**Hojas** `nor-panel`, `nor-ediciones`, `nor-publicacion` · **genérico** · **Renace en** KL#44 (reparto: #65, `insignia-con-tono-por-regla`)

El tono va declarado en la fila (`decision.tono`) o calculado por una regla sobre el dato, nunca deducido del texto.

- `c01fe9a:frontend/src/secciones/panel.ts:98` `` readonly tono: Tono; ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:312` `` <Insignia tono={decision.tono}>{decision.estado}</Insignia> ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:397` `` <Insignia tono={conjunto.estado === SELLADO ? 'ok' : 'atencion'}> ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:192` `` tono: snapshot.parametros.length > 0 ? 'ok' : 'mal', ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:203` `` tono: laValuacion && snapshot.valoresUnitarios.length === 0 ? 'atencion' : 'ok', ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:295` `` <Insignia tono={lista.tono}>{String(lista.cuantas)}</Insignia> ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:320` `` <Insignia tono={comparacion.tono}> ``

```json
{"tabla":{"columnaDeInsignia":2,"tonoDesde":"tono"},"otraTabla":{"columnaDeInsignia":0,"tonoSegun":{"campo":"estado","valores":{"CERRADO":"ok"},"resto":"atencion"}}}
```

**Por qué no basta con `tonoDeLaInsignia(texto)`.** En `@kamayuk/ui` el tono ya es del consumidor, pero es una
función **del texto**. En Publicación la insignia es el conteo: un `0` es `mal` en `parametros` (`publicacion.ts:192`)
y `atencion` en un cuadro que su ámbito lleva (`:203`). El mismo texto, dos tonos. Contraste:
`rentas@ac379ac:frontend/diseno/RentasV8.dc.html:1267-1268` saca el tono de una expresión regular con vocabulario de
`rentas`, y con ella «SELLADO» y «ABIERTO» salen los dos `ok`.

**En el artboard V8 (#76).** D-02b y D-03d dicen las dos «Abierta» y la V6 las pinta en `mal` y en `atencion`. El
artboard de #52 lo sacaba del texto y pintaba D-03d en `mal`; G2 lo devolvió a `atencion`, y el artboard lo dice con
`TONOS.porFila`, una excepción por la primera celda de la fila que la gramática de `PANTALLAS` no tiene. Es el
síntoma de esta entrada, no su arreglo: en `src/` lo trae el tono como dato, no una copia de esa tabla.

### H34 · `filas-de-contenido-que-viajan`

**Hojas** `nor-panel`, `nor-publicacion` · **genérico** · **Renace en** KL#61

Las diez filas sin archivo del corpus, las cuatro decisiones, los tres consumidores y las tres razones de la caché
**son el texto de la pantalla**, no cifras de ejemplo; y hay textos que cuentan esas mismas filas.

- `c01fe9a:frontend/src/secciones/panel.ts:61` `` export const SIN_ARCHIVO: readonly FilaSinArchivo[] = [ ``
- `c01fe9a:frontend/src/secciones/panel.ts:122` `` export const DECISIONES: readonly DecisionAbierta[] = [ ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:266` `` {String(SIN_ARCHIVO.length)} filas sin archivo del corpus ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:285` `` {SIN_ARCHIVO.map((fila) => ( ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:304` `` {DECISIONES.map((decision) => ( ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:384` `` export const CONSUMIDORES: readonly Consumidor[] = [ ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:396` `` filas={CONSUMIDORES.map((quien) => ({ ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:431` `` export const RAZONES_DE_LA_CACHE: readonly RazonDeLaCache[] = [ ``

```json
{"tabla":{"titulo":"Lo que falta","columnas":[{"rotulo":"Fila","alineadoDerecha":false},{"rotulo":"Qué","alineadoDerecha":false}],"filasDeContenido":[["1","Algo que este sistema no publica"],["2","Otra cosa"]]},"titulo":"Lo que no incluye: {filasDeContenido.length} filas"}
```

**Por qué es un hueco.** La gramática V8 sólo tiene filas de **ejemplo**, y desde `rentas`#97 no viajan
(`tipos.ts:130-137`). Estas no son ejemplo: sin ellas la pantalla no dice nada. Que no sean cifras tributarias lo
vigila hneyra/normativa#58.

### H39 · `pie-de-operaciones`

**Hojas** `nor-panel`, `nor-publicacion` · **genérico** · **Renace en** KL#44 (`pie-de-operaciones`)

El Panel dice qué operación contesta su estado y qué no publica ninguna; Publicación dice qué dos operaciones
consumen los contratos y cuáles nadie.

- `c01fe9a:frontend/src/secciones/Panel.tsx:128` `` Es lo que contesta <code>GET /seguridad/parametros/ejercicios/{ejercicio}</code>, ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:327` `` Lo que no está aquí no está en ninguna respuesta ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:406` `` export const OPERACIONES_CONSUMIDAS: readonly string[] = [ ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:409` `` <Operaciones cuales={OPERACIONES_CONSUMIDAS} /> ``

```json
{"tipo":"pie","lee":["GET /recursos/{id}"],"falta":"Ningún conteo por registro lo publica operación alguna."}
```

**N9 (#52).** El artboard V8 no tiene pie de **pantalla**: lo que va debajo de las acciones es el aviso del armazón, no
texto de la hoja. El del Panel —«Lo que no está aquí no está en ninguna respuesta»— se queda fuera
(`c01fe9a:frontend/src/secciones/Panel.tsx:327` `` Lo que no está aquí no está en ninguna respuesta ``). Es el mismo
pie de arriba dicho de toda la hoja, y por eso se funde aquí.

### H40 · `nota-al-pie-del-bloque`

**Hojas** las cuatro · **genérico** · **Renace en** KL#44 (`nota-al-pie-del-bloque`)

Lo que hay que saber para leer la tabla o las cifras de arriba va debajo, fuera de la tabla.

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:676` `` <p className="kn-tarjeta__pie"> ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:318` `` <p className="kn-tarjeta__pie"> ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:166` `` <p className="kn-seccion__pie">{cuadro.pie}</p> ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:228` `` <p className="kn-seccion__pie"> ``

```json
{"titulo":"Contenido","nota":"","campos":[],"tabla":{"titulo":"Filas","columnas":[]},"pie":"«Hasta» vacío no es un olvido: es un tramo sin fin."}
```

**N12 (#52).** Y un bloque de la V6 lleva **más de una** nota. La cabecera de cada cuadro tiene la suya
(`c01fe9a:frontend/src/secciones/Cuadros.tsx:100` `` <p className="kn-seccion__nota">{cuadro.nota}</p> ``), debajo
la prosa «Es nacional y no de esta municipalidad…» (`c01fe9a:frontend/src/secciones/Cuadros.tsx:108` `` Es nacional y no de esta municipalidad ``)
y junto al selector la nota del ámbito (`c01fe9a:frontend/src/secciones/Cuadros.tsx:241` `` <span className="kn-seccion__ambito-nota"> ``).
El bloque V8 tiene una sola `nota` y el artboard V8 se queda con la primera: la segunda es este pie, y la del selector
va con el selector (H14a).

### H41 · `aviso-fijo-con-titulo`

**Hojas** `nor-ediciones`, `nor-cuadros` · **genérico** · **Renace en** KL#44 (`aviso`)

Una sección de alerta con título y párrafos —«De qué región es este cuadro», «Este cuadro llegó, y el ámbito no lo
lleva»— o un párrafo que ocupa el sitio de la tabla cuando el conjunto está abierto.

- `c01fe9a:frontend/src/secciones/Cuadros.tsx:315` `` <section className="kn-seccion__alerta" aria-labelledby={id}> ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:317` `` De qué región es este cuadro ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:351` `` Este cuadro llegó, y el ámbito {ambito} no lo lleva ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:629` `` <p className="kn-tabla__vacio"> ``

```json
{"tipo":"aviso","tono":"atencion","titulo":"De qué grupo es este cuadro","texto":["Esta operación no lo dice.","Sin el grupo no se puede usar."]}
```

**N7 (#52).** Los dos párrafos son dos a propósito —qué no dice la operación, y por qué sin eso el cuadro no se
puede usar—, y la nota de un bloque V8 es una cadena: el artboard V8 los une en uno
(`c01fe9a:frontend/src/secciones/Cuadros.tsx:320` `` <strong>Esta operación no lo dice.</strong> `` y
`c01fe9a:frontend/src/secciones/Cuadros.tsx:330` `` Un cuadro de valores unitarios sin su región no se puede usar ``).
Por eso `texto` es una lista en la forma de arriba.

### H43 · `texto-con-marcas`

**Hojas** `nor-panel`, `nor-cuadros`, `nor-publicacion` · **genérico** · **Renace en** KL#61

La prosa lleva nombres de restricción, de columna o de ruta en `<code>` y lo que no se puede pasar por alto en
`<strong>`, dentro de la misma frase.

- `c01fe9a:frontend/src/secciones/Panel.tsx:187` `` <code>conjunto_uq</code> lleva la ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:319` `` <strong>y sólo para {String(SELLO_DE_2026.ejercicio)}</strong> ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:109` `` <code>{cuadro.checkNacional}</code> sobre <code>{cuadro.tabla}</code> ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:229` `` El <strong>ámbito no tiene valor por omisión</strong> ``

```json
{"nota":[{"texto":"Lo impide "},{"codigo":"{restriccion}"},{"texto":" en la base, "},{"fuerte":"no una validación"},{"texto":"."}]}
```

**Por qué es un hueco.** `nota` e `instruccion` son cadenas planas, y con el texto como dato (i18next, clave en
castellano) una marca dentro de la frase no puede ser JSX suelto.

**N6 (#52).** Al derivar el artboard V8 cada `<code>` y cada `<strong>` de una nota se aplanó a texto (su regla R3):
`conjunto_uq`, `?ambito=valuacion` o `ETag` se leen allí como palabras sueltas
(`c01fe9a:frontend/src/secciones/Publicacion.tsx:277` `` El <code>sha256</code> no viene dentro del cuerpo ``).

### H42 · `insignias-fijas-en-la-cabecera`

**Hojas** `nor-cuadros`, `nor-publicacion` · **genérico** · **Renace en** KL#61

Junto al título o la nota de un bloque van insignias fijas («Sólo lectura», «Nacional (ADR-0017)», «200») o la ruta
que se pidió, a la derecha.

- `c01fe9a:frontend/src/secciones/Cuadros.tsx:102` `` <Insignia tono="info">Sólo lectura</Insignia> ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:103` `` <Insignia tono="info">Nacional (ADR-0017)</Insignia> ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:169` `` <code className="kn-seccion__ruta">{ruta}</code> ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:251` `` <Insignia tono="ok">200</Insignia> ``

```json
{"titulo":"Lo que se publica","insignias":[{"tono":"info","texto":"Sólo lectura"}],"aLaDerecha":{"codigo":"{ruta}"}}
```

**Por qué KL#61.** La cabecera con insignias de `catastro` es la del detalle de un maestro-detalle (KL#67); aquí es
la de un bloque cualquiera, y `dato-con-insignia` (KL#65) pinta un dato, no una marca fija.

**N10 (#52).** El artboard V8 las pierde todas —«Sólo lectura», «Nacional (ADR-0017)», «200» y el «404» de la
respuesta que no llega (`c01fe9a:frontend/src/secciones/Publicacion.tsx:444` `` <Insignia tono="atencion">404</Insignia> ``)—:
un bloque V8 es título, nota, campos y tabla, y ninguno de los cuatro lleva una marca.

## Campos y actos

### H04a · `pasos-en-pestanas`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#44 (reparto: #67, `pestanas`; lo que se ofrece según haya elección, `pieza-condicional`)

La ficha tiene cuatro pestañas `role="tab"` —una de lectura y tres de escritura—, y sin conjunto elegido sólo se
ofrece la de abrir.

- `c01fe9a:frontend/src/secciones/ediciones.ts:142` `` export const PASOS: readonly PasoDeLaEdicion[] = [ ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:288` `` return conjunto === null ? PASOS.filter((paso) => paso.id === PASO_DE_APERTURA) : PASOS; ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:464` `` role="tablist" aria-label="Pasos de la edición" ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:470` `` aria-selected={paso.id === uno.id} ``

```json
{"tipo":"pestanas","pestanas":[{"clave":"lectura","rotulo":"Contenido","escribe":false},{"clave":"alta","rotulo":"Abrir","escribe":true,"tambienSinEleccion":true},{"clave":"cierre","rotulo":"Cerrar","escribe":true}]}
```

### H04b · `los-tres-actos-de-la-edicion`

**Hoja** `nor-ediciones` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#68

Qué ruta escribe cada paso —abrir versión, agregar parámetro, sellar—, cuáles necesitan un conjunto detrás y qué
caso de uso del backend ejecuta cada uno.

- `c01fe9a:frontend/src/secciones/ediciones.ts:178` `` casoDeUso: 'AdministrarParametros.abrirVersion', ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:386` `` export function rutaDe(paso: PasoDeLaEdicion, conjunto: ConjuntoResource | null): string | null { ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:388` `` return ESCRITURAS.abrirVersion; ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:397` `` return ESCRITURAS.sellar(conjunto.id); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:200` `` Esa operación necesita un conjunto abierto en la ficha. ``

```json
{"pieza":"actosDeLaEdicion","clave":"normativa.actos-de-la-edicion"}
```

**Por qué propio.** KL#61 lo deja escrito en «Lo que NO entra»: los tres pasos de escritura como flujo de
`normativa` van por el punto de extensión. Lo genérico de cada uno está en H04a, H05a, H06 y H07.

### H05a · `acto-con-observacion-y-cuerpo-compuesto`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#44 (reparto: #66, `acto-con-observacion`)

Los tres actos llevan al final la observación (de 5 a 500, con una clave por formulario), el cuerpo JSON se compone
recorriendo los campos que declaran su nombre —lo opcional vacío no viaja— y el primario dice «Enviando…» mientras va.

- `c01fe9a:frontend/src/secciones/ediciones.ts:45` `` readonly campo?: string; ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:72` `` export const OBSERVACION_MINIMA = 5; ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:75` `` export const OBSERVACION_MAXIMA = 500; ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:81` `` observacionAbrir ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:98` `` function observacionDe(clave: string, ph: string): CampoDelFormulario { ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:410` `` export function cuerpoDe( ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:420` `` if (escrito === '' && campo.opcional === true) { ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:204` `` void enviar<unknown>(ruta, cuerpoDe(paso, valor)).then( ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:551` `` {enviando ? 'Enviando…' : (paso.verbo ?? 'Guardar')} ``

```json
{"tipo":"acto","verbo":"Registrar","campos":[{"etiqueta":"Tipo","tipo":"s","viaja":"tipo"},{"etiqueta":"Motivo","tipo":"a1","viaja":"observacion","claveLocal":"observacionAlta","largo":{"minimo":5,"maximo":500}}],"envia":{"verbo":"POST","ruta":"/recursos"},"opcionalVacioNoViaja":true,"mientras":"Enviando…"}
```

### H05b · `obligatorio-u-opcional-por-campo`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61 (su H8)

Cada campo es obligatorio salvo que se declare opcional (los de sólo lectura y las casillas no cuentan), lleva su
marcador y su ayuda, y su mensaje cuando falta.

- `c01fe9a:frontend/src/secciones/ediciones.ts:49` `` readonly opcional?: boolean; ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:50` `` readonly ph?: string; ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:324` `` return campo.opcional !== true && campo.tipo !== 'ro' && campo.tipo !== 'chk'; ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:332` `` esObligatorio(campo) && valor(campo.clave).trim() === '' ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:504` `` opcional={campo.opcional} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:578` `` 'Este dato es obligatorio.' ``

```json
{"etiqueta":"Clave","tipo":"","opcional":true,"marcador":"Vacía si no aplica","ayuda":"Uno de 1, 2 o 3.","mensajes":{"obligatorio":"Este dato es obligatorio."}}
```

**Por qué KL#61.** El marcador es `marcador` de KL#65. `acto-con-observacion` (KL#66) nace apagado con «Falta
rellenar: …», pero ni #65 ni #66 dicen cómo se declara un campo **opcional** ni su mensaje: #66 sólo fija como dato
los límites de la observación. Si #66 lo trae, se usa y KL#61 no lo repite.

**N3 y N4 (#52).** Al derivar el artboard V8 salieron las dos mitades de esta entrada. **N3**: el marcador distinto de
la ayuda no cabe, porque el intérprete pinta la ayuda como marcador —«Por qué se abre esta versión»
(`c01fe9a:frontend/src/secciones/ediciones.ts:201` `` observacionDe('observacionAbrir', 'Por qué se abre esta versión'), ``)
y «Vacía si el tipo tiene un solo valor» (`c01fe9a:frontend/src/secciones/ediciones.ts:230` `` ph: 'Vacía si el tipo tiene un solo valor', ``)
se pierden—; eso es `marcador` de KL#65. **N4**: «Clave» es opcional (`c01fe9a:frontend/src/secciones/ediciones.ts:229` `` opcional: true, ``)
y su ayuda no dice «opcional» (`c01fe9a:frontend/src/secciones/ediciones.ts:231` `` ayuda: 'La UIT no lleva clave. ``), y el
artboard deduce lo opcional de `/opcional/i` sobre la ayuda: en el V8 «Clave» no lleva «(opcional)». Es exactamente el
`opcional` como dato que esta entrada pide a KL#61.

### H49 · `ayuda-en-un-desplegable`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#44 (reparto: #65, `ayuda-en-una-lista`) · **N2** de #52

«Ejercicio», en «Abrir versión», es un desplegable **con su ayuda debajo**: el rango, y por qué salirse de él es un
422 que nombra el rango y no «ese ejercicio no está sellado». En la gramática V8 el tercer elemento de un campo `s`
son sus opciones, y la ayuda no tiene sitio: el artboard V8 la pierde.

- `c01fe9a:frontend/src/secciones/ediciones.ts:189` `` tipo: 'sel', ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:190` `` opciones: EJERCICIOS, ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:192` `` 'Entre 1990 y 2100. Fuera de rango lo rechaza el constructor del ejercicio ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:506` `` ayuda={campo.ayuda} ``

```json
{"etiqueta":"Periodo","tipo":"s","opciones":["A","B"],"ayuda":"Fuera de los admitidos lo rechaza el servidor nombrando el rango."}
```

**Por qué KL#44.** Es `ayuda-en-una-lista` de `catastro`, que KL#65 sube tal cual.

### H50 · `ayuda-en-un-campo-de-solo-lectura`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61 (nuevo: no está entre sus H1-H13, y `ayuda-en-una-lista` de KL#65 es sólo de desplegables) · **N1** de #52

«Estado», «Usuario que selló» y «Versión que se asignará» son de sólo lectura **y llevan ayuda**: qué dos valores
hay y en qué dirección se pasa, por qué el sello queda con nombre, quién calcula la versión. En la gramática V8 el
tercer elemento de un campo `r` es su valor de ejemplo, que desde `rentas`#97 no viaja: la ayuda no tiene sitio, y en
el artboard V8 «Versión que se asignará» lleva como valor una frase que es su ayuda.

- `c01fe9a:frontend/src/secciones/ediciones.ts:160` `` ayuda: 'ABIERTO o SELLADO. Son dos y el paso entre ellos va en una sola dirección.', ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:165` `` etiqueta: 'Usuario que selló', ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:168` `` 'El acto administrativo del que cuelga la reproducibilidad del ejercicio queda con ' + ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:199` `` ayuda: 'La última del ejercicio más uno. La calcula el servidor.', ``

```json
{"etiqueta":"Estado","tipo":"r","ayuda":"Uno de dos, y el paso entre ellos va en una sola dirección."}
```

### H06 · `compuerta-con-un-motivo`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#44 (reparto: #66, `impedido-con-motivo` y `acto-con-observacion`)

Por qué no se puede guardar es **un solo texto**, que va al `title` del primario, al pie del formulario y al aviso
del intento; primero lo que falta teclear y después la observación.

- `c01fe9a:frontend/src/secciones/ediciones.ts:353` `` export function motivoDe(paso: PasoDeLaEdicion, valor: (clave: string) => string): string { ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:361` `` Quedan ${String(pendientes.length)} datos obligatorios sin llenar. ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:365` `` Sin observación no se guarda: al menos ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:368` `` La observación no cabe: como mucho ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:159` `` const motivo = motivoDe(paso, valor); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:195` `` alAvisar(motivo); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:531` `` : motivo} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:548` `` title={bloqueado ? motivo : undefined} ``

```json
{"acto":{"impedido":{"orden":["obligatorios","observacion"],"motivos":{"falta1":"Queda 1 dato obligatorio sin llenar.","faltanN":"Quedan {n} datos obligatorios sin llenar.","corta":"Sin observación no se guarda: al menos {minimo} caracteres.","larga":"La observación no cabe: como mucho {maximo} caracteres."},"seDiceEn":["title","pie","aviso"]}}}
```

### H07 · `errores-tras-el-primer-intento`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61 (su H8)

El rojo de un obligatorio vacío sale al pulsar guardar, no mientras se escribe; el de la observación tiene su propio
texto.

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:194` `` alCambiar({ intento: true }); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:509` `` error={errorDe(campo, estado.intento, valor(campo.clave))} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:573` `` if (!intento || !esObligatorio(campo) || escrito.trim() !== '') { ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:577` `` 'Sin observación no se guarda (regla 10).' ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:50` `` readonly intento: boolean; ``

```json
{"acto":{"errores":"trasElPrimerIntento","mensajes":{"obligatorio":"Este dato es obligatorio.","observacion":"Sin observación no se guarda."}}}
```

### H08 · `impedido-con-aria-disabled`

**Hojas** `nor-ediciones`, `nor-publicacion` · **genérico** · **Renace en** KL#44 (reparto: #66, AC3)

El botón que no puede actuar sigue en el recorrido del tabulador con `aria-disabled` y su motivo en `title`, y al
pulsarlo lo dice en vez de no hacer nada.

- `c01fe9a:frontend/src/secciones/ediciones.ts:373` `` Si el boton primario no puede guardar. ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:547` `` aria-disabled={bloqueado || enviando} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:549` `` onClick={guardar} ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:92` `` if (verificado === null) return; ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:215` `` aria-disabled={!puedeDescargar} ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:219` `` 'Todavía no hay un snapshot verificado que guardar' ``

```json
{"accion":{"rotulo":"Guardar","impedidoSi":"sinVerificar","motivo":"Todavía no hay nada verificado que guardar","seApagaCon":"aria-disabled","alPulsarImpedido":"dice el motivo"}}
```

**Choque.** El pie de `@kamayuk/shell` hace lo contrario: `kamayuk-lib@942fb59:paquetes/shell/AccionesAlPie.tsx:48`
pone `disabled` a la acción no atendida. Eso no es de la V6: es la H11 de KL#61.

### H09 · `negativa-del-servidor-tal-cual`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#57 (AC7: el peldaño del 409, no reintentable)

Lo que contesta el servidor al rechazar se enseña **tal cual**, con su código delante y en la ficha, porque las dos
negativas del sellado se arreglan de maneras opuestas; y persiste hasta el siguiente intento.

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:76` `` **se arreglan de maneras opuestas** ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:213` `` alCambiar({ negativa: mensajeDelServidor(fallo) }); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:486` `` El servidor rechazó la operación ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:487` `` {estado.negativa} ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:583` `` return fallo instanceof Error ? fallo.message : 'El sistema no pudo contestar.'; ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:58` `` readonly negativa: string | null; ``

```json
{"acto":{"rechazo":{"titulo":"El servidor rechazó la operación","texto":"delServidor","nota":"Es el texto del backend, sin reescribir.","conflicto":{"reintentable":false}}}}
```

**Por qué KL#57.** Pintar la respuesta en su sitio ya es de `acto-con-observacion` (KL#66). Lo que falta es que la
escalera de `@kamayuk/sesion` tenga un peldaño para el 409: hoy cae en `averia` y dice «Reintente en unos segundos»
(`kamayuk-lib@942fb59:paquetes/sesion/escalera.ts:186`), que es lo contrario de lo que pide un conjunto ya sellado. Que persista al irse y volver es H35b.

### H10 · `solo-lectura-con-lo-servido`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** no renace: cabe en lo que dejó `kamayuk-lib`#27

Los campos de sólo lectura de cada paso (identificador, conjunto, estado, sello) se rellenan con lo servido, y lo
tecleado mandaría sobre lo servido.

- `c01fe9a:frontend/src/secciones/ediciones.ts:294` `` Solo alimenta los campos de **solo lectura** ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:305` `` export function valoresServidos( ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:313` `` conjunto: String(conjunto.id), ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:153` `` const valor = (clave: string) => estado.vals[clave] ?? servidosDelPaso[clave] ?? ''; ``

```json
{"valores":{"0|0":"42","0|3":"CERRADO"}}
```

**Por qué no renace.** `DatosDeLaPantalla.valores` (`kamayuk-lib@942fb59:paquetes/ui/interprete/datos.ts:40`) ya
pinta un campo `r` con su valor por coordenada. «Lo tecleado manda» no ocurre nunca en la V6: ningún campo es a la
vez tecleado y servido (`ediciones.ts:294`).

### H13b · `opciones-propias-escritas-en-src`

**Hoja** `nor-ediciones` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#68

El desplegable de «Abrir versión» ofrece los ejercicios `2026, 2027, 2028` y el de «Agregar parámetro», trece tipos
de parámetro, escritos en `src/`; la barra, `2026, 2027, 2025, 2024`.

- `c01fe9a:frontend/src/secciones/ediciones.ts:117` `` const TIPOS_DE_PARAMETRO: readonly string[] = [ ``
- `c01fe9a:frontend/src/secciones/ediciones.ts:134` `` const EJERCICIOS = ['', '2026', '2027', '2028']; ``
- `c01fe9a:frontend/src/marco/BarraGlobal.tsx:67` `` export const EJERCICIOS = ['2026', '2027', '2025', '2024'] as const; ``

```json
{"pieza":"opcionesDeLaEdicion","clave":"normativa.opciones-de-la-edicion","desde":"lo que el backend publique"}
```

**Por qué la hoja.** El año de la barra es la lección «el ejercicio no se escribe como literal» (tabla de abajo, en
hneyra/normativa#63); los de la edición y los tipos de parámetro son de hneyra/normativa#68.

### H35b · `lo-tecleado-y-la-negativa-sobreviven`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61 (sus H9 y H10: decide cómo convive con la `key` por destino)

Escribir media observación, ir al Panel y volver deja lo tecleado, el intento y la negativa del servidor donde
estaban, con el asterisco de la pestaña diciendo la verdad.

- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:48` `` readonly vals: Readonly<Record<string, string>>; ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:55` `` quien recibe «el conjunto ya esta sellado», se va al panel a comprobarlo y ``
- `c01fe9a:frontend/src/marco/Marco.tsx:124` `` dejaria el formulario en blanco **con el asterisco puesto** ``

```json
{"hoja":{"conservaAlSalir":["valores","intento","rechazo"],"soloSiSucia":true}}
```

**Choque.** hneyra/normativa#58 pone una `key` por destino para que lo tecleado en una hoja no aparezca en la
siguiente (`kamayuk-lib@942fb59:paquetes/shell/Armazon.tsx:147` dibuja la pantalla sin `key`); con la `key`, lo
tecleado se pierde al salir. `@kamayuk/shell` sólo pregunta antes de salir si la hoja se marcó sucia (`Armazon.tsx:174`,
`:222`), y la V6 no preguntaba: conservaba. Las dos cosas no pueden ser verdad a la vez, y quien lo decide es KL#61.

**Medido al cerrar [hneyra/normativa#58](https://github.com/hneyra/normativa/issues/58) (2026-09-16), y el choque es
más grande de lo que decía el párrafo de arriba.** La librería **ya no dibuja la pantalla sin `key`**: desde
`kamayuk-lib`#67, `paquetes/shell/Armazon.tsx` envuelve la llamada en `<Fragment key={hoja.destino.clave}>` y lo dice
en su propio javadoc («sin ella, dos destinos cuya pantalla es el mismo componente en el mismo sitio comparten la
instancia»). O sea que la `key` por destino ya está tomada **para las cuatro interfaces**, y no sólo aquí: la decisión
de [`kamayuk-lib`#86](https://github.com/hneyra/kamayuk-lib/issues/86) AC-3 no es «ponerla o no», sino si hay que
**retirarla o convivir con ella**. `normativa` pone además la suya en `src/pantallas/index.ts`, y el motivo está escrito
ahí: `pantalla()` es una función pública de ese módulo, y quien la monte fuera del armazón no hereda la de la librería.
Lo demuestra `frontend/verificaciones/la-hoja-no-hereda-lo-tecleado.test.tsx`, que mide las dos mitades por separado:
quitar la de `src/` deja la mitad del armazón **en verde** y pone roja la del arnés.

### H37 · `aviso-efimero-tras-un-acto`

**Hojas** `nor-ediciones`, `nor-publicacion` · **genérico** · **Renace en** KL#61

Al guardar, descartar, fallar o bajar un archivo sale un aviso efímero del marco que vive 3,4 s y se cancela al
desmontar.

- `c01fe9a:frontend/src/marco/Marco.tsx:121` `` const [toast, fijarToast] = useState(''); ``
- `c01fe9a:frontend/src/marco/Marco.tsx:191` `` }, VIDA_DEL_TOAST); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:208` `` registrado con su observación. ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:214` `` alAvisar('El servidor rechazó la operación. El motivo está en la ficha.'); ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:95` `` alAvisar( ``

```json
{"acto":{"alTerminar":{"aviso":"{verbo}: registrado con su observación."},"alFallar":{"aviso":"El servidor rechazó la operación. El motivo está en la ficha."}}}
```

### H38 · `la-hoja-se-marca-sucia-al-teclear`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61 (su H9)

Cada pulsación en un campo de la ficha marca la pestaña como sucia, sin que la hoja lo cablee campo a campo.

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:95` `` readonly alEnsuciar: () => void; ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:156` `` alEnsuciar(); ``
- `c01fe9a:frontend/src/marco/Lienzo.tsx:193` `` alEnsuciar={alEnsuciar} ``

```json
{"hoja":{"suciaAlTeclear":true,"limpiaAl":["guardar","descartar"]}}
```

**Por qué KL#61.** El intérprete tiene `alEnsuciar` y sólo avisa con el primer valor
(`kamayuk-lib@942fb59:paquetes/ui/interprete/Pantalla.tsx:77`), y nadie lo conecta con `useHoja().marcarSucia`.

### H48 · `descartar-lo-escrito`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#61

Al pie del acto, un secundario vacía lo tecleado, el intento y la negativa, y lo dice.

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:535` `` alCambiar({ vals: {}, intento: false, negativa: null }); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:536` `` alAvisar('Se descartó lo escrito.'); ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:539` `` Descartar lo escrito ``

```json
{"acto":{"descartar":{"rotulo":"Descartar lo escrito","limpia":["valores","intento","rechazo"],"aviso":"Se descartó lo escrito."}}}
```

**Por qué KL#61.** `acto-con-observacion` (KL#66) describe enviar y leer la respuesta; ni él ni
`confirmacion-de-lo-irreversible` tienen un «descartar» del formulario.

## Tablas

### H19 · `marca-de-vigente`

**Hojas** `nor-panel`, `nor-ediciones` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#65 (el Panel la reusa en #63)

«Vigente» es la última versión sellada del ejercicio entre lo servido, o lo que diga el servidor si lo sabe.

- `c01fe9a:frontend/src/secciones/conjuntos.ts:125` `` export function vigenteDe( ``
- `c01fe9a:frontend/src/secciones/conjuntos.ts:131` `` (mayor, uno) => (mayor === null || uno.version > mayor.version ? uno : mayor), ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:164` `` if (conjunto.ejercicio === anio && rige.dato !== null) { ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:400` `` {rigeEste(conjunto) && <Insignia tono="info">Vigente</Insignia>} ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:75` `` const sellados = selladosDe(servidos, anio); ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:245` `` {esVigente(servidos, conjunto) ? ( ``

```json
{"pieza":"marcaDeVigente","clave":"normativa.vigente"}
```

### H20 · `pestanas-con-conteo`

**Hoja** `nor-cuadros` · **genérico** · **Renace en** KL#44 (reparto: #67, `pestanas`; el conteo, `texto-con-dato`)

Los tres cuadros son pestañas `role="tab"`, cada una con cuántas filas trae o «—» sin dato.

- `c01fe9a:frontend/src/secciones/Cuadros.tsx:78` `` role="tablist" aria-label="Los tres cuadros" ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:84` `` aria-selected={uno.id === id} ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:92` `` {recurso === null ? '—' : String(cuantasFilasDe(uno, recurso))} ``

```json
{"tipo":"pestanas","pestanas":[{"clave":"a","rotulo":"Primera","conteo":"{a.length}","sinDato":"—"},{"clave":"b","rotulo":"Segunda","conteo":"{b.length}","sinDato":"—"}]}
```

### H21 · `tablas-grandes`

**Hoja** `nor-cuadros` · **genérico** · **Renace en** KL#61 (su H2, y la decisión de `kamayuk-lib`#25)

La V6 pinta **todas** las filas de un cuadro sin paginar, y el vehicular son 54 129.

- `c01fe9a:frontend/src/secciones/Tabla.tsx:140` `` filas.map((fila) => ( ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:159` `` <Tabla ``
- `c01fe9a:frontend/diseno/NormativaV6.dc.html:1249` `` 18 043 líneas y 54 129 filas ``
- `c01fe9a:frontend/diseno/NormativaV6.dc.html:1296` `` conteo: '54 129', total: 54129 ``
- `c01fe9a:frontend/src/datos/prototipo.test.ts:34` `` 10 de 54 129 ``

```json
{"tabla":{"paginacion":{"en":"cliente","tamano":100},"filasEnMemoria":true}}
```

**Observación.** La V6 nunca pintó 54 129 filas: el proxy de datos llevaba 10 de ellas (`prototipo.test.ts:34`). Que
aguante el tamaño real no está medido en ningún sitio.

### H22a · `celda-nula-con-palabra-y-nota`

**Hojas** `nor-ediciones`, `nor-cuadros`, `nor-publicacion` · **genérico** · **Renace en** KL#61 (su H5)

Una celda es `{texto, nota?}`: `null` se pinta «—» con un `title` que dice por qué, y una celda con texto puede
llevar su nota; nunca una celda en blanco.

- `c01fe9a:frontend/src/secciones/Tabla.tsx:55` `` readonly texto: string | null; ``
- `c01fe9a:frontend/src/secciones/Tabla.tsx:57` `` readonly nota?: string; ``
- `c01fe9a:frontend/src/secciones/Tabla.tsx:85` `` if (celda.texto === null) { ``
- `c01fe9a:frontend/src/secciones/Tabla.tsx:90` `` title={celda.nota ?? 'Ninguna operación publica este dato'} ``
- `c01fe9a:frontend/src/secciones/conjuntos.ts:151` `` export const SIN_DATO = '—'; ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:663` `` <td>{fila.clave ?? SIN_DATO}</td> ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:679` `` Donde no hay dato va {SIN_DATO}, no una celda en blanco. ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:178` `` <dd>{conjunto === null ? '—' : String(conjunto.conjuntoId)}</dd> ``

```json
{"tabla":{"sinDato":{"texto":"—","nota":"Ninguna operación publica este dato"}},"celdas":[{"texto":null},{"texto":"Sin tope","nota":"Llega como null: no hay tope."}]}
```

### H22b · `tramo-abierto`

**Hoja** `nor-cuadros` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#66

Un `antiguedadHasta` nulo es «Más de N años» con N el tope del último tramo cerrado de su misma tabla, o «Sin tope»
si no hay ninguno; un `anioConstruccionHasta` nulo es «Sin tope». Nunca cero.

- `c01fe9a:frontend/src/secciones/cuadros.ts:230` `` export function antiguedadAbierta( ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:246` `` return mayor === null ? 'Sin tope' ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:250` `` const NOTA_ANTIGUEDAD = ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:284` `` ? { texto: 'Sin tope', nota: NOTA_ANIO } ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:300` `` ? { texto: antiguedadAbierta(filas, fila), nota: NOTA_ANTIGUEDAD } ``

```json
{"pieza":"tramoAbierto","clave":"normativa.tramo-abierto"}
```

### H23 · `cabecera-con-campo-y-dominio`

**Hojas** `nor-cuadros`, `nor-publicacion` · **genérico** · **Renace en** KL#61

Bajo el rótulo de cada columna va el nombre del campo JSON y, cuando la base lo acota, su dominio (`MUROS · TECHOS ·
PUERTAS`, `A … J`).

- `c01fe9a:frontend/src/secciones/Tabla.tsx:39` `` readonly campo: string; ``
- `c01fe9a:frontend/src/secciones/Tabla.tsx:50` `` readonly dominio?: string; ``
- `c01fe9a:frontend/src/secciones/Tabla.tsx:120` `` <span className="kn-tabla__campo">{columna.campo}</span> ``
- `c01fe9a:frontend/src/secciones/Tabla.tsx:122` `` <span className="kn-tabla__dominio">{columna.dominio}</span> ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:101` `` { etiqueta: 'Partida', campo: 'partida', dominio: DOMINIOS.partida.join(' · ') }, ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:102` `` dominio: 'A … J' ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:391` `` { etiqueta: 'Quién', campo: 'consumidor' }, ``

```json
{"columnas":[{"rotulo":"Partida","campo":"partida","dominio":"A · B · C","alineadoDerecha":false},{"rotulo":"Valor","campo":"valor","alineadoDerecha":true}]}
```

**N5 (#52).** Lo mismo en la etiqueta de un campo, no sólo en la cabecera de una columna: «Conjunto `conjuntoId`»
(`c01fe9a:frontend/src/secciones/Publicacion.tsx:176` `` Conjunto <code>conjuntoId</code> ``), «Ámbito `ambito`»
(`c01fe9a:frontend/src/secciones/Publicacion.tsx:192` `` Ámbito <code>ambito</code> ``) y «Ámbito del snapshot `ambito`»
(`c01fe9a:frontend/src/secciones/Cuadros.tsx:222` `` Ámbito del snapshot <code>ambito</code> ``). La etiqueta de un
campo V8 es una cadena, y el artboard V8 deja sólo el rótulo. La forma es la misma: `{"etiqueta":"Conjunto","campo":"conjuntoId"}`.

### H24 · `que-significa-un-cuadro-vacio`

**Hoja** `nor-cuadros` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#66

Un cuadro dentro de un snapshot tiene cuatro desenlaces —`CON_FILAS`, `FUERA_DEL_AMBITO`, `SIN_FILAS`, `DE_MAS`—
según el ámbito lo lleve y hayan llegado filas, cada uno con su texto y su salida.

- `c01fe9a:frontend/src/secciones/cuadros.ts:194` `` export type EstadoDelCuadro = 'CON_FILAS' | 'FUERA_DEL_AMBITO' | 'SIN_FILAS' | 'DE_MAS'; ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:201` `` const loLleva = cuadro.ambito === ambitoPedido; ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:158` `` {estado === 'DE_MAS' && <ElCuadroDeMas cuadro={cuadro} ambito={ambito} />} ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:170` `` {estado === 'FUERA_DEL_AMBITO' && ( ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:192` `` {estado === 'SIN_FILAS' && ( ``

```json
{"pieza":"estadoDelCuadro","clave":"normativa.estado-del-cuadro"}
```

### H25 · `dominio-comprobado-sobre-lo-llegado`

**Hoja** `nor-cuadros` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#66

Lo que llega se contrasta con los CHECK de la base (`partida`, `categoria`, `uso`), y un valor fuera se dice encima
nombrando la restricción.

- `c01fe9a:frontend/src/secciones/cuadros.ts:67` `` export const DOMINIOS = { ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:376` `` export function fueraDeDominio( ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:388` `` (valor_unitario_edificacion_partida_check) ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:148` `` titulo="Hay valores fuera del dominio que la base declara" ``

```json
{"pieza":"dominioDeLosCuadros","clave":"normativa.dominio-de-los-cuadros"}
```

### H26 · `vacio-con-su-salida`

**Hojas** las cuatro · **genérico** · **Renace en** KL#61

El vacío lleva su botón dentro —«Abrir una versión», «Abrir la primera versión», «Pedir el snapshot en X», «Ir a
componer el ejercicio»— y distingue «ninguno todavía» de «ninguno coincide».

- `c01fe9a:frontend/src/secciones/Ediciones.tsx:367` `` servidos.length === 0 ? 'Ninguna edición todavía' : 'Ninguna edición coincide' ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:376` `` Abrir una versión ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:231` `` Abrir la primera versión ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:187` `` Pedir el snapshot en {cuadro.ambito} ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:458` `` Ir a componer el ejercicio ``

```json
{"tabla":{"vacio":{"titulo":"Ningún registro todavía","texto":"Lo siguiente es crear el primero.","accion":{"rotulo":"Crear el primero","va":{"hoja":"modulo/lista","parametros":{"paso":"alta"}}}},"vacioPorFiltro":{"titulo":"Ningún registro coincide"}}}
```

**Por qué KL#61.** `tabla-con-vacio` (KL#65) sólo pone el texto; ningún hueco de `catastro` pone la salida dentro.

### H44 · `documento-fuente-de-las-filas`

**Hoja** `nor-cuadros` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#66

El documento fuente de la edición se saca de las filas y no de una constante, y si las filas dicen más de uno se
avisa de que el cuadro mezcla dos ediciones.

- `c01fe9a:frontend/src/secciones/cuadros.ts:352` `` export function fuenteDelCuadro(filas: readonly FilaDeTabla[]): FuenteDelCuadro { ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:361` `` return { documento: distintos.length === 1 ? (distintos[0] ?? null) : null, distintos }; ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:121` `` <FichaDeLaEdicion cuadro={cuadro} documento={fuente.documento} distintos={fuente.distintos} /> ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:271` `` Las filas dicen {distintos.length} documentos distintos ``

```json
{"pieza":"fuenteDelCuadro","clave":"normativa.fuente-del-cuadro"}
```

**N8 (#52).** En la misma ficha, «Tabla» y «Ámbito que la lleva» no son datos servidos sino **constantes del cuadro**
(`c01fe9a:frontend/src/secciones/Cuadros.tsx:278` `` <dt>Tabla</dt> ``, `c01fe9a:frontend/src/secciones/Cuadros.tsx:280` `` <code>{cuadro.tabla}</code> ``,
`c01fe9a:frontend/src/secciones/Cuadros.tsx:284` `` <dt>Ámbito que la lleva</dt> `` y `c01fe9a:frontend/src/secciones/Cuadros.tsx:285` `` <dd>{cuadro.ambito}</dd> ``).
En la gramática V8 el valor de un campo `r` es un ejemplo y no viaja (`rentas`#97), así que en `src/` quedarían «—».
Lo pone la misma pieza que saca el documento fuente —o la hoja, en `DatosDeLaPantalla.valores` (H10)—, y como nombra
una tabla y un ámbito es propio: no hay nada que pedirle a la librería.

### H46 · `accion-en-cada-fila`

**Hoja** `nor-panel` · **genérico** · **Renace en** KL#44 (reparto: #65, `acciones-por-fila`; el destino, `navegar-a-otra-hoja` de #66)

Cada versión sellada de la lista del Panel lleva su botón «Abrir», que lleva a Ediciones con esa versión elegida.

- `c01fe9a:frontend/src/secciones/Panel.tsx:239` `` <li className="kn-panel__version" key={conjunto.id}> ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:253` `` alAbrirEdicion(conjunto.id); ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:256` `` Abrir ``

```json
{"tabla":{"columnas":[{"rotulo":"Versión","alineadoDerecha":false}],"accionPorFila":{"rotulo":"Abrir","va":{"hoja":"modulo/lista","sujeto":"{id}"}}}}
```

## Composición de la hoja y el marco

### H13a · `parametro-global-del-marco`

**Hojas** las cuatro · **genérico** · **Renace en** KL#44 (reparto: #67, `parametro-del-marco`)

El ejercicio de la barra global decide qué se pide en las cuatro hojas y el subtítulo del Panel lo nombra.

- `c01fe9a:frontend/src/marco/BarraGlobal.tsx:21` `` **El selector de ejercicio es global a la sesion** ``
- `c01fe9a:frontend/src/marco/Marco.tsx:104` `` Ejercicio ${ejercicio} ``
- `c01fe9a:frontend/src/marco/Marco.tsx:120` `` const [ejercicio, fijarEjercicio] = useState('2026'); ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:70` `` Number.isFinite(anio) ? RUTAS.ejercicio(anio) : null, ``
- `c01fe9a:frontend/src/secciones/Ediciones.tsx:132` `` Number.isFinite(anio) ? RUTAS.ejercicio(anio) : null, ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:58` `` RUTAS.vigente(pedido) ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:61` `` RUTAS.vigente(pedido) ``

```json
{"marco":{"parametros":[{"clave":"periodo","rotulo":"Periodo"}]},"lectura":{"ruta":"/recursos","parametros":{"periodo":"{marco.periodo}"}},"subtitulo":"Periodo {marco.periodo}"}
```

### H14a · `selector-que-gobierna-una-lectura`

**Hojas** `nor-cuadros`, `nor-publicacion` · **genérico** · **Renace en** KL#44 (reparto: #67, `estado-en-la-ruta`: un filtro que vuelve a pedir)

Dos botones exclusivos con `aria-pressed` eligen un parámetro de la lectura; cambiarlo vuelve a pedir.

- `c01fe9a:frontend/src/secciones/Cuadros.tsx:55` `` const [ambito, fijarAmbito] = useState<Ambito>('VALUACION'); ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:229` `` aria-pressed={uno === ambito} ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:58` `` const [ambito, fijarAmbito] = useState<Ambito>('VALUACION'); ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:199` `` aria-pressed={uno === ambito} ``

```json
{"selector":{"rotulo":"Mitad","parametroDe":"documento","opciones":[{"valor":"A","rotulo":"A"},{"valor":"B","rotulo":"B"}],"inicial":"A","seDibujaComo":"botonesExclusivos"}}
```

**Observación.** El texto dice que el ámbito «no tiene valor por omisión» (`c01fe9a:frontend/src/secciones/Cuadros.tsx:243` `` omisión y no se lee en minúsculas ``):
lo dice del backend. La pantalla empieza en `VALUACION`, marcado.

**N11 (#52).** Y el selector **no hace editable la hoja**. En la gramática V8 sólo cabe como campo `s`, y
`seEscribe(tipo)` cuenta como escrito todo lo que no es `r` (`kamayuk-lib@c6f6361:paquetes/ui/shadcn/campos.ts:53`):
Cuadros y Publicación, que son de sólo lectura, salen en el artboard V8 con «Limpiar» y «Guardar» al pie en vez de
«Exportar» e «Imprimir». La V6 lo dice al revés (`c01fe9a:frontend/src/secciones/Cuadros.tsx:111` `` aquí no hay ningún ``
control que guarde nada). Declarado como parámetro de la lectura y no como campo, deja de contar, y por eso se funde aquí.

### H14b · `los-dos-ambitos`

**Hojas** `nor-cuadros`, `nor-publicacion` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#66 (y #67)

Los dos valores `VALUACION`/`OBLIGACION`, qué cuadro lleva cada uno y el botón que cambia al ámbito que lo lleva.

- `c01fe9a:frontend/src/datos/lecturas.ts:206` `` export const AMBITOS = ['VALUACION', 'OBLIGACION'] as const; ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:184` `` fijarAmbito(cuadro.ambito); ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:242` `` viaja en <strong>{cuadro.ambito}</strong> ``

```json
{"pieza":"ambitoDelSnapshot","clave":"normativa.ambito-del-snapshot"}
```

### H27 · `abrir-otra-hoja-con-parametro`

**Hojas** `nor-panel`, `nor-publicacion` · **genérico** · **Renace en** KL#44 (reparto: #66, `navegar-a-otra-hoja`; y la H12 de KL#61)

Desde el Panel se abre Ediciones en un conjunto concreto y en un paso concreto; desde Publicación, Ediciones sin más.

- `c01fe9a:frontend/src/secciones/Panel.tsx:61` `` readonly alAbrirEdicion: (conjuntoId: number | null) => void; ``
- `c01fe9a:frontend/src/secciones/Panel.tsx:135` `` alAbrirEdicion(hayConjunto ? (estado.dato?.conjuntoId ?? null) : null); ``
- `c01fe9a:frontend/src/marco/Lienzo.tsx:176` `` paso: conjuntoId === null ? PASO_DE_APERTURA : PASO_DE_LECTURA, ``
- `c01fe9a:frontend/src/marco/Lienzo.tsx:181` `` alAbrir('nor-ediciones'); ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:455` `` alAbrir('nor-ediciones'); ``

```json
{"accion":{"rotulo":"Ver el registro {id}","va":{"hoja":"modulo/lista","sujeto":"{id}","parametros":{"paso":"lectura"}}}}
```

### H35a · `el-sitio-sobrevive-a-irse-y-volver`

**Hoja** `nor-ediciones` · **genérico** · **Renace en** KL#44 (reparto: #67, `estado-en-la-ruta`)

Página, tamaño, orden, sentido, la ficha elegida y el paso sobreviven a ir a otra hoja y volver: si no, se relanzaría
la página cero.

- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:4` `` El marco desmonta la seccion al cambiar de pestana ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:16` `` **relanzaria la peticion de la pagina cero** ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:44` `` readonly elegida: number | null; ``
- `c01fe9a:frontend/src/secciones/estadoDeNormativa.ts:46` `` readonly paso: string; ``
- `c01fe9a:frontend/src/marco/Marco.tsx:131` `` const [ediciones, fijarEdiciones] = useState<EstadoDeEdiciones>(EDICIONES_AL_EMPEZAR); ``

```json
{"estadoEnLaRuta":["pagina","tamano","ordenarPor","direccion","elegido","paso"]}
```

**Diferencia con `catastro`.** La V6 de `normativa` lo guardaba en el estado del marco, no en la dirección: el hash
sólo lleva la pestaña (`c01fe9a:frontend/src/marco/Marco.tsx:144` `` marcarHash(pestanas.activa); ``). Recargar
lo perdía. Con `estado-en-la-ruta` sobrevive también a recargar.

### H45 · `bloque-de-una-sola-pestana`

**Hoja** `nor-cuadros` · **genérico** · **Renace en** KL#44 (reparto: #67, `pestanas`: cada pestaña con sus bloques)

La nota y el pie cambian con la pestaña, y el aviso de la región sólo existe en la de valores unitarios.

- `c01fe9a:frontend/src/secciones/Cuadros.tsx:100` `` <p className="kn-seccion__nota">{cuadro.nota}</p> ``
- `c01fe9a:frontend/src/secciones/Cuadros.tsx:123` `` {cuadro.id === 'unitarios' && <LaRegion />} ``
- `c01fe9a:frontend/src/secciones/cuadros.ts:98` `` La J existe sólo en el anexo de la Selva ``

```json
{"tipo":"pestanas","pestanas":[{"clave":"a","nota":"Lo que es la primera.","bloques":[{"tipo":"aviso","titulo":"Sólo aquí"}],"pie":"Lo que hay que saber de la primera."},{"clave":"b","nota":"Lo que es la segunda.","bloques":[]}]}
```

## Publicación

### H28 · `cabeceras-y-texto-crudo`

**Hoja** `nor-publicacion` · **genérico** · **Renace en** KL#57

Del snapshot se leen el `ETag`, el `Cache-Control` que trajo **esa** respuesta y el cuerpo tal como llegó, sin
volver a serializarlo.

- `c01fe9a:frontend/src/api/cliente.ts:194` `` **Los bytes que se verificaron**, tal como llegaron y sin volver a serializar. ``
- `c01fe9a:frontend/src/api/cliente.ts:299` `` const texto = await respuesta.text(); ``
- `c01fe9a:frontend/src/api/cliente.ts:336` `` cacheControl: respuesta.headers.get('Cache-Control'), ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:103` `` etiqueta: 'ETag' ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:106` `` valor: verificado.cacheControl ?? 'sin Cache-Control', ``

```json
{"lectura":{"ruta":"/recursos/{id}/documento","respuesta":{"texto":"crudo","cabeceras":["ETag","Cache-Control"]}}}
```

### H29a · `la-pantalla-de-la-huella`

**Hoja** `nor-publicacion` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#67

La ficha «La respuesta» pinta cada línea con su origen (cabecera o cuerpo) y la comprobación: `ok` si el sha256
cuadra y el `Cache-Control` es el del contrato, `atencion` si la caché no es la prometida.

- `c01fe9a:frontend/src/secciones/publicacion.ts:88` `` export const CACHE_CONTROL_DEL_CONTRATO = 'public, max-age=31536000, immutable'; ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:140` `` export function comprobacionDe(verificado: SnapshotVerificado<SnapshotResource>): Comprobacion { ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:144` `` 'El sha256 cuadra con el ETag; el Cache-Control no es el del contrato' ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:255` `` {lineasDeLaRespuesta(verificado).map((linea) => ( ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:259` `` <span className="kn-seccion__origen">{linea.origen}</span> ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:266` `` kn-seccion__comprobacion--${comprobacion.tono} ``

```json
{"pieza":"laRespuesta","clave":"normativa.la-respuesta"}
```

### H29b · `huella-de-los-bytes-en-el-cliente`

**Hoja** `nor-publicacion` · **genérico** · **Renace en** normativa#67

El cliente recalcula el sha256 de los bytes en UTF-8 y lo compara con un `ETag` **fuerte** (un `W/` no vale); si no
cuadra, `HUELLA_QUE_NO_CUADRA`, que no se reintenta.

- `c01fe9a:frontend/src/api/cliente.ts:97` `` export const CODIGOS_DE_ESTA_INTERFAZ = ['SIN_RESPUESTA', 'HUELLA_QUE_NO_CUADRA'] as const; ``
- `c01fe9a:frontend/src/api/cliente.ts:321` `` const calculada = await sha256(texto); ``
- `c01fe9a:frontend/src/api/cliente.ts:349` `` const bytes = new TextEncoder().encode(cuerpo); ``
- `c01fe9a:frontend/src/api/cliente.ts:364` `` if (cabecera === null || cabecera.startsWith('W/')) return null; ``
- `c01fe9a:frontend/src/api/proxy.test.ts:349` `` respuesta.headers.get('etag')).toBe( ``

```json
{"verificar":{"cabecera":"ETag","fuerte":true,"algoritmo":"SHA-256","sobre":"texto","siNoCuadra":{"codigo":"HUELLA_QUE_NO_CUADRA","reintentable":false}}}
```

**Por qué la hoja, siendo genérico.** Por la definición le serviría a cualquier sistema que firme su cuerpo, pero
KL#57 lo **devolvió**: «la comprobación del sha256 tampoco entra: es de `normativa` (ADR-0025)». Sube cuando otro
sistema lo pida.

### H30a · `guardar-como-archivo`

**Hoja** `nor-publicacion` · **genérico** · **Renace en** KL#61

«Guardar el snapshot» guarda **el texto que se verificó**, no el que el navegador volvería a pedir, y dice si el
navegador no ofrece descarga.

- `c01fe9a:frontend/src/secciones/publicacion.ts:53` `` export function guardarComoArchivo(nombre: string, cuerpo: string): boolean { ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:56` `` URL.createObjectURL(new Blob([cuerpo], { type: 'application/json' })) ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:67` `` URL.revokeObjectURL(direccion); ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:94` `` const guardado = guardarComoArchivo(nombre, verificado.cuerpo); ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:99` `` 'Este navegador no ofrece descarga de archivos, así que no se guardó nada.' ``

```json
{"accion":{"rotulo":"Guardar","guarda":{"texto":"{lectura.texto}","tipoDeMedio":"application/json","nombre":"{plantilla}"},"entregado":"Guardado «{nombre}»","sinDescarga":"Este navegador no ofrece descarga de archivos."}}
```

**Por qué KL#61.** `descarga-de-documento` de `catastro` se quedó local (una hoja), y KL#57 no toca `descargar()`,
que además lanza `NoEsUnDocumento` con un JSON.

### H30b · `nombre-del-archivo`

**Hoja** `nor-publicacion` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#67

El archivo se llama con el conjunto, el ejercicio, la versión y el ámbito.

- `c01fe9a:frontend/src/secciones/publicacion.ts:26` `` export function nombreDelArchivo(snapshot: SnapshotResource): string { ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:28` `` 'normativa-conjunto', ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:31` `` v${String(snapshot.version)} ``

```json
{"pieza":"nombreDelSnapshot","clave":"normativa.nombre-del-snapshot"}
```

### H31 · `comparar-los-dos-ambitos`

**Hoja** `nor-publicacion` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#67

Se piden los dos ámbitos del mismo conjunto y se dice lo medido: misma identidad y huellas distintas, o lo que haya
salido.

- `c01fe9a:frontend/src/secciones/publicacion.ts:302` `` export function compararAmbitos( ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:307` `` const huellaCambia = valuacion.huella !== obligacion.huella; ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:65` `` const deValuacion = useSnapshot( ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:68` `` const deObligacion = useSnapshot( ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:137` `` {deValuacion.dato !== null && deObligacion.dato !== null && ( ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:319` `` Un conjunto, dos descargas ``

```json
{"pieza":"losDosAmbitos","clave":"normativa.los-dos-ambitos"}
```

### H47 · `cuantas-trae-cada-lista-y-por-que`

**Hoja** `nor-publicacion` · **propio** · **Renace en** el punto de extensión de KL#44, en normativa#67

«Qué viene y qué no»: cada una de las cuatro listas del snapshot con cuántas filas trae, en una insignia, y el
motivo de que venga llena o vacía en ese ámbito.

- `c01fe9a:frontend/src/secciones/publicacion.ts:184` `` export function listasDelSnapshot(snapshot: SnapshotResource): readonly ListaDelSnapshot[] { ``
- `c01fe9a:frontend/src/secciones/publicacion.ts:244` `` function motivoDeCuadro( ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:290` `` Qué viene y qué no ``
- `c01fe9a:frontend/src/secciones/Publicacion.tsx:297` `` <code className="kn-seccion__campo-json">{lista.campo}</code> ``

```json
{"pieza":"queVieneYQueNo","clave":"normativa.que-viene-y-que-no"}
```

## N1–N12, conciliados

Los doce que [hneyra/normativa#52](https://github.com/hneyra/normativa/issues/52) encontró al derivar
`NormativaV8.dc.html` y que la tabla de #51 no recogía ([comentario en #51](https://github.com/hneyra/normativa/issues/51#issuecomment-5660090605),
detalle en el cuerpo de #73). Conciliados en [hneyra/normativa#76](https://github.com/hneyra/normativa/issues/76):
**diez se funden** en la entrada que ya decía lo mismo —con su párrafo **N… (#52)** y su cita dentro— y **dos son
entradas nuevas**. La clase y el destino son los de la entrada en la que quedan.

| N | Hueco (#51) | Cita en `c01fe9a` | Clase | Queda en | Renace en |
|---|---|---|---|---|---|
| N1 | Ayuda en un campo de sólo lectura | `c01fe9a:frontend/src/secciones/ediciones.ts:199` `` ayuda: 'La última del ejercicio más uno. `` | genérico | **H50**, nueva | KL#61 |
| N2 | Ayuda en un desplegable | `c01fe9a:frontend/src/secciones/ediciones.ts:192` `` 'Entre 1990 y 2100. `` | genérico | **H49**, nueva | KL#44 (reparto: #65, `ayuda-en-una-lista`) |
| N3 | Un marcador distinto de la ayuda | `c01fe9a:frontend/src/secciones/ediciones.ts:230` `` ph: 'Vacía si el tipo tiene un solo valor', `` | genérico | se funde en H05b | KL#61 (el `marcador`, KL#65) |
| N4 | Un campo opcional cuya ayuda no dice «opcional» | `c01fe9a:frontend/src/secciones/ediciones.ts:229` `` opcional: true, `` | genérico | se funde en H05b | KL#61 |
| N5 | El nombre del campo JSON junto a la etiqueta | `c01fe9a:frontend/src/secciones/Publicacion.tsx:176` `` Conjunto <code>conjuntoId</code> `` | genérico | se funde en H23 | KL#61 |
| N6 | Código en línea dentro de una nota | `c01fe9a:frontend/src/secciones/Publicacion.tsx:277` `` El <code>sha256</code> no viene `` | genérico | se funde en H43 | KL#61 |
| N7 | Dos párrafos en una nota | `c01fe9a:frontend/src/secciones/Cuadros.tsx:330` `` Un cuadro de valores unitarios sin su región `` | genérico | se funde en H41 | KL#44 (`aviso`) |
| N8 | Un valor constante en un campo de sólo lectura no viaja | `c01fe9a:frontend/src/secciones/Cuadros.tsx:284` `` <dt>Ámbito que la lleva</dt> `` | propio | se funde en H44 | el punto de extensión de KL#44, en normativa#66 |
| N9 | Pie de pantalla | `c01fe9a:frontend/src/secciones/Panel.tsx:327` `` Lo que no está aquí no está en ninguna respuesta `` | genérico | se funde en H39 | KL#44 (`pie-de-operaciones`) |
| N10 | Insignias en la cabecera de un bloque | `c01fe9a:frontend/src/secciones/Cuadros.tsx:102` `` <Insignia tono="info">Sólo lectura</Insignia> `` | genérico | se funde en H42 | KL#61 |
| N11 | Una hoja de sólo lectura con un selector se lee como editable | `c01fe9a:frontend/src/secciones/Cuadros.tsx:111` `` aquí no hay ningún `` | genérico | se funde en H14a | KL#44 (reparto: #67) |
| N12 | Una sola nota por bloque | `c01fe9a:frontend/src/secciones/Cuadros.tsx:108` `` Es nacional y no de esta municipalidad `` | genérico | se funde en H40 | KL#44 (`nota-al-pie-del-bloque`) |

**Por qué N8 es propio y N1 no.** N1 le serviría a cualquier sistema con una ficha de sólo lectura. N8 no pide nada
a la librería: el valor cabe en `DatosDeLaPantalla.valores` (H10), y lo que falta es que alguien lo ponga, y ese valor
nombra una tabla y un ámbito de `normativa`.

**Lo que G2 decidió y no es un hueco.** El escudo no se porta, el título es «Sistema de Gestión de Rentas y Tributos
Municipales» y el icono del módulo es `balanza` de `ICONOS`: están en el artboard y no piden nada al intérprete. La
entidad y la cuenta son marcadores de sesión (hneyra/normativa#54, #57 y #64). El tono de D-03d, en cambio, **sí** es
un hueco y ya tenía entrada: es H18, y el artboard lo pinta con una excepción por fila que la gramática no tiene.

## Lo que la V6 aprendió y dónde renace

Las guardas de la V6 salen con ella en hneyra/normativa#50; **lo que cada una midió** tiene dónde renacer. Las diez
primeras son las de la épica; las demás salieron de recorrer los huecos.

| Lección de la V6 | Dónde se ve en `c01fe9a` | Renace en |
|---|---|---|
| Ninguna cifra del corpus en lo que se sirve | `c01fe9a:frontend/Dockerfile:129` `` RUN set -eu; `` (hasta la 141), con `c01fe9a:frontend/Dockerfile:135` `` '5500.00' `` | hneyra/normativa#50 y #58 (`sin-cifras-inventadas`) |
| `cifra-tributaria-literal`: ninguna cifra tributaria literal en el código | `c01fe9a:frontend/eslint.prohibiciones.mjs:191` `` clave: 'cifra-tributaria-literal', `` | hneyra/normativa#50 → #62 |
| El 422 de `GuardiaDeParametros` y la lista blanca de `ordenarPor` | `c01fe9a:frontend/src/secciones/conjuntos.ts:55` `` export const ORDENES_ADMITIDOS `` y `c01fe9a:frontend/src/secciones/ediciones.ts:435` `` «parametro desconocido» `` | hneyra/normativa#49 y #63 |
| `ETag` = sha256 de los bytes, y `Cache-Control: immutable` | `c01fe9a:frontend/src/api/proxy.test.ts:349` `` respuesta.headers.get('etag')).toBe( `` y `c01fe9a:frontend/src/api/proxy.test.ts:357` `` public, max-age=31536000, immutable `` | hneyra/normativa#67 |
| Los títulos de error son los de `CodigoDeError.java` | `c01fe9a:frontend/src/api/cliente.ts:66` `` Son los **once de `` | hneyra/normativa#63 |
| «—» es `null`, nunca cero | `c01fe9a:frontend/src/secciones/Tabla.tsx:77` `` const SIN_DATO = '—'; `` y `c01fe9a:frontend/src/secciones/cuadros.ts:223` `` pintarlo como cero convertiria `` | hneyra/normativa#63 |
| Observación de al menos 5 caracteres, y dos 409 con mensajes distintos | `c01fe9a:frontend/src/secciones/ediciones.ts:72` `` export const OBSERVACION_MINIMA = 5; `` y `c01fe9a:frontend/src/secciones/Ediciones.tsx:76` `` **se arreglan de maneras opuestas** `` | hneyra/normativa#59 y #68 |
| `base '/normativa/'`, PKCE S256, `redirect_uri` a la raíz, el token nunca en almacenamiento | `c01fe9a:frontend/vite.config.ts:35` `` base: '/normativa/', ``, `c01fe9a:frontend/src/api/identidad.ts:173` `` code_challenge_method: 'S256', ``, `c01fe9a:frontend/src/api/identidad.ts:169` `` redirect_uri: retorno(), `` y `c01fe9a:frontend/eslint.prohibiciones.mjs:169` `` clave: 'token-en-almacenamiento', `` | hneyra/normativa#50, #57 y #61 |
| El ejercicio no se escribe como literal | `c01fe9a:frontend/src/marco/BarraGlobal.tsx:67` `` export const EJERCICIOS ``, `c01fe9a:frontend/src/marco/Marco.tsx:120` `` useState('2026') `` y `c01fe9a:frontend/src/secciones/ediciones.ts:134` `` const EJERCICIOS `` | hneyra/normativa#63, #66 y #68 (H13b) |
| Una ruta se enciende sólo tras ejercerla con token (`YA_SERVIDAS`) | `c01fe9a:frontend/src/datos/servidas.ts:73` `` export const YA_SERVIDAS: readonly OperacionServida[] = []; `` | hneyra/normativa#63 y #69 |
| `lienzo-sin-campo-propio`, `marco-sin-selector`, `arbol-del-artboard` | `c01fe9a:frontend/verificaciones/lienzo-sin-campo-propio.test.ts:140` `` el Lienzo no dibuja ningun campo propio `` y `c01fe9a:frontend/verificaciones/marco-sin-selector.test.ts:66` `` el conmutador A/B/C no existe en el codigo `` | Obsoletas: se retiran con su motivo en hneyra/normativa#50 |
| **Lo tecleado sobrevive a irse y volver, y eso choca con la `key` por destino** (H35b) | `c01fe9a:frontend/src/marco/Marco.tsx:124` `` dejaria el formulario en blanco **con el asterisco puesto** `` | `kamayuk-lib`#61 lo decide; hneyra/normativa#58 pone la `key` y #68 comprueba lo que quede |
| **Un 409 no se reintenta, y su texto no se reescribe** (H09) | `c01fe9a:frontend/src/secciones/Ediciones.tsx:583` `` return fallo instanceof Error ? fallo.message `` | `kamayuk-lib`#57 (AC7) y hneyra/normativa#68 |
| **El tono no se deduce del texto** (H18): el mismo «0» es `mal` o `atencion` | `c01fe9a:frontend/src/secciones/publicacion.ts:192` `` tono: snapshot.parametros.length > 0 ? 'ok' : 'mal', `` | `kamayuk-lib`#65 (por #44) y hneyra/normativa#63 |
| **Una lectura que no todos pueden hacer degrada su bloque, no la hoja** (H11) | `c01fe9a:frontend/src/secciones/Panel.tsx:193` `` tipo="sin-permiso" `` | `kamayuk-lib`#44 y hneyra/normativa#63 |
| **«No hay conjunto sellado» es un 200, y el 404 con `parametroQueFalta` no es una avería** (H16, H32a) | `c01fe9a:frontend/src/secciones/Panel.tsx:130` `` es una respuesta y llega como 200 `` y `c01fe9a:frontend/src/secciones/publicacion.ts:358` `` fallo.faltaUnaCifraNormativa `` | `kamayuk-lib`#57 (AC6) y hneyra/normativa#67 |
| **`aria-disabled` con motivo, nunca `disabled`** (H08) | `c01fe9a:frontend/src/secciones/Ediciones.tsx:547` `` aria-disabled={bloqueado `` | `kamayuk-lib`#66 (AC3) en la hoja, `kamayuk-lib`#61 (H11) en el pie del armazón, y hneyra/normativa#68 |
| **Se guarda el texto que se verificó, no una reserialización** (H28, H30a) | `c01fe9a:frontend/src/secciones/Publicacion.tsx:94` `` guardarComoArchivo(nombre, verificado.cuerpo) `` | `kamayuk-lib`#57 (AC2) y hneyra/normativa#67 |
| **La V6 nunca pintó las 54 129 filas: el proxy traía 10** (H21) | `c01fe9a:frontend/src/datos/prototipo.test.ts:34` `` 10 de 54 129 `` | `kamayuk-lib`#61 (AC3, con 54 129 filas sintéticas) y hneyra/normativa#66 |
| **La composición de un sello no se escribe en `src/`** (H17) | `c01fe9a:frontend/src/secciones/panel.ts:219` `` filasDelCorpus: 33, `` | hneyra/normativa#58 (`sin-cifras-inventadas`) |

## Cifras

Contadas sobre las **59 entradas** de arriba —las 57 de #51 y H49 y H50 de N1–N12—: **44 genéricas** y **15 propias**.

- **Hojas que se expresan enteras con la gramática que sube en `kamayuk-lib`#27, sin lo de #44: 0 de 4.**
- **Hojas que necesitan algo genérico: 4 de 4.**
- **Hojas que necesitan algo propio: 4 de 4.** El Panel, sólo por H19 si H17 no renace.

Por hoja, sin contar H10 (que cabe):

| Hoja | Genéricos | de ellos, KL#44 y su reparto | KL#61 | KL#57 | en la hoja | Propios |
|---|---|---|---|---|---|---|
| `nor-panel` | 12 | 9 (H11, H13a, H16, H18, H27, H36, H39, H40, H46) | 3 (H26, H34, H43) | 0 | 0 | 2 (H17, H19) |
| `nor-ediciones` | 27 | 14 (H03, H04a, H05a, H06, H08, H12, H13a, H16, H18, H35a, H36, H40, H41, H49) | 11 (H01, H02, H05b, H07, H22a, H26, H35b, H37, H38, H48, H50) | 1 (H09) | 1 (H15) | 3 (H04b, H13b, H19) |
| `nor-cuadros` | 15 | 7 (H13a, H14a, H20, H36, H40, H41, H45) | 6 (H21, H22a, H23, H26, H42, H43) | 1 (H32a) | 1 (H15) | 7 (H14b, H22b, H24, H25, H32b, H33, H44) |
| `nor-publicacion` | 19 | 7 (H08, H13a, H14a, H16, H18, H27, H40) | 8 (H22a, H23, H26, H30a, H34, H37, H42, H43) | 2 (H28, H32a) | 2 (H15, H29b) | 7 (H14b, H29a, H30b, H31, H32b, H33, H47) |

**Con todo lo que #44 cubre** (#44, #65, #66 y #67) **siguen sin caber las cuatro**: a cada una le queda al menos un
hueco de KL#61. Los genéricos que #44 no cubre son **17 para KL#61** y **3 para KL#57**; de los de KL#61, los que
más hojas piden son `vacio-con-su-salida` (4), `texto-con-marcas` (3) y `celda-nula-con-palabra-y-nota` (3).
Con KL#61 y KL#57 cerrados, lo que queda en cada hoja es propio —por el punto de extensión— más las dos lecturas
que cada sistema conecta (H15) y la huella que KL#57 devolvió (H29b).

**hneyra/normativa#52 ya está en `main`** (se mezcló en #73, `dbd5d29`, después que este documento), y lo que declaró
que la gramática V8 no expresa está conciliado arriba, en [N1–N12, conciliados](#n1n12-conciliados) (hneyra/normativa#76).
Lo que salga de derivar o de montar una hoja y no esté aquí entra como entrada nueva con su cita, o se funde en la que
ya lo diga.
