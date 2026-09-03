# ADR-0007 — Parámetros tributarios versionados y sellados por ejercicio

**Estado:** Aceptado
**Fecha:** 2026-08-17

## Contexto

El cálculo de un tributo municipal depende de cifras que cambian todos los años y que no las fija
el equipo de desarrollo: UIT, tramos y alícuotas del predial, deducción del pensionista, tasas de
arbitrios por sector y uso, valores unitarios de edificación, aranceles de terreno, tablas de
depreciación, valores referenciales vehiculares, porcentajes de multa.

Además, un sistema tributario debe poder **recalcular un ejercicio pasado**: por una
reclamación, por una fiscalización, por una orden judicial. Si el recálculo de 2027 hecho en 2037
no da el mismo céntimo, el sistema no sirve como prueba de nada.

## Decisión

**Ningún dato normativo vive en el código.** Todos son filas, con:

- **Vigencia** (`desde`, `hasta`).
- **Documento fuente**: la ordenanza, el decreto o la resolución que lo fija. Obligatorio.
- **Doble verificación**: quien carga no puede aprobar. Es una restricción de la tabla, no una
  convención.

Al cerrar la carga de un ejercicio, el **conjunto de parámetros se sella**. Un conjunto sellado
no se modifica: corregirlo obliga a crear una versión nueva, y eso queda registrado.

**Toda determinación guarda con qué conjunto se calculó y qué reglas se aplicaron.** Sin eso el
recálculo no es reproducible.

## Consecuencias

- Cambiar una alícuota es cargar datos, no desplegar código.
- Recalcular un ejercicio pasado usa su conjunto sellado y da el mismo resultado.
- Un error en una cifra afecta a todo el padrón, de ahí la doble verificación en la base.
- Las reglas de cálculo son **funciones puras**: reciben los parámetros y la fecha como
  argumentos, no los buscan. Lo verifica ArchUnit (regla 6 de
  [ARQ-04](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/30-arquitectura/estandares-de-codigo-backend.md)).
- **Hoy no hay valores cargados**, y por eso ninguna regla de cálculo puede escribirse: es la
  decisión **D-02** de [GOB-02](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/decisiones-abiertas.md).

## Alternativas consideradas

- **Constantes en el código, cambiadas por despliegue.** Es lo que hacen muchos sistemas
  municipales, y lo que hace que recalcular 2019 exija recuperar el binario de 2019.
- **Parámetros en archivo de configuración.** Mejor que constantes, pero sin vigencia, sin
  documento fuente, sin doble verificación y sin sellado. Y un archivo no se audita como una
  tabla.
- **Motor de reglas externo.** Añade una tecnología y un formato propio para un problema que aquí
  es de datos versionados, no de expresividad.
