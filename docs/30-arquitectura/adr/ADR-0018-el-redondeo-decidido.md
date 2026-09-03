# ADR-0018 — El redondeo, decidido: escala ratificada, `HALF_UP`, y ningún SRTM que imitar

| Campo | Valor |
|---|---|
| Estado | Aceptado |
| Fecha | 2026-08-28 |
| Decide | Dirección del proyecto |
| Cierra | **D-03a**, **D-03b** y **D-03c** (GOB-02). **No cierra D-03d** (el redondeo del cierre de caja), que sigue en GOB-02 |
| Referencias | ARQ-09 §1.4 (`../srtm`), [GOB-03 §E-7](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/00-gobierno/plan-de-desbloqueo-D-02.md), [`observaciones-srtm-mef/`](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/10-negocio/observaciones-srtm-mef/README.md), issue [#188](https://github.com/hneyra/sgtm/issues/188) |

## Decisión

Tres decisiones que iban juntas porque bloqueaban lo mismo —la primera regla de cálculo— y las
tres se cierran hoy:

### D-03a — La escala de cálculo intermedio, ratificada

`monto_calc numeric(18,6)` para todo cálculo intermedio; `dinero numeric(15,2)` para todo importe
que se asienta, se muestra o se cobra. Es lo que `../srtm/docs/40-datos/ddl/esquema-verificado.sql`
ya definía y este esquema ya usaba; GOB-02 la tenía como «casi decidida de hecho, falta
ratificarla». Ratificada: los dominios de
[DAT-01 §2](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/40-datos/modelo-logico-fisico.md) dejan de ser provisionales.

### D-03b — El modo de redondeo es `HALF_UP`

Redondeo aritmético —el medio céntimo sube—, que es la práctica tributaria peruana, frente a
`HALF_EVEN` (el redondeo bancario). Vale para todo punto de redondeo del cálculo tributario cuya
norma no diga otra cosa; cuando la norma fija su propio modo, gana la norma —el ejemplo ya
transcrito es el art. 2.2 de la R.M. N.° 008-2026-EF/15, que ordena su redondeo propio en la tabla
vehicular ([`vehicular-valores-referenciales-2026.md`](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/10-negocio/valores-normativos/vehicular-valores-referenciales-2026.md) §1.4.2)—.

### D-03c — Los puntos donde se redondea: el piloto no tiene un SRTM que imitar

D-03c decía «no es una decisión: es ingeniería inversa contra el SRTM del MEF», porque un padrón
migrado exige reproducir céntimo a céntimo las determinaciones del sistema anterior, y nadie puede
decidir dónde redondea un sistema ajeno: hay que observarlo.

**El piloto (Catacaos, D-01) arranca con padrón nuevo.** No migra saldos ni determinaciones del
SRTM del MEF, así que no hay ninguna cifra ajena que reproducir y la premisa entera de la
ingeniería inversa no aplica. Los puntos donde redondea **este** sistema los decide este sistema:

- **Se redondea al cierre de cada regla, a céntimo (escala 2), `HALF_UP`** — la asunción original
  de ARQ-09 §1.4, que M02 solo puso en duda para *imitar* al SRTM.
- **Los pasos intermedios corren en `monto_calc` (18,6) sin redondear**, salvo el punto que una
  norma redondee explícitamente, que se transcribe y se firma como cualquier otro dato normativo.

**El mecanismo no cambia ni un renglón.** Los catorce `PuntoDeRedondeo` siguen existiendo; la
política de cada punto sigue entrando **como dato** —una fila `REDONDEO:‹punto›` del conjunto
sellado, con la escala en `valor_numerico` y el modo en `valor_texto` (E-7 §3, #203)—; y un punto
que el cálculo pida sin política publicada **sigue fallando** en vez de no redondear. Lo que esta
decisión habilita es publicar esas filas para el piloto sin esperar una campaña de observación:
sus valores salen de este ADR, no de mirar una pantalla del MEF.

## Cuándo revive D-03c: la municipalidad que migra

**Para una municipalidad que migre saldos o determinaciones del SRTM del MEF, la campaña de
observación vuelve a ser prerrequisito** — de la migración (D-04), no de la primera regla—.
Conciliar los saldos migrados exige reproducir las determinaciones del sistema anterior, y eso
exige inventariar sus puntos de redondeo observándolo: el procedimiento de dos pasos —observar con
el desarrollo intermedio visible, validar con `CAL-02` sobre predios distintos— queda escrito en
[`observaciones-srtm-mef/README.md`](https://github.com/hneyra/sgtm/blob/migracion-a-microservicios/docs/10-negocio/observaciones-srtm-mef/README.md) y no se
pierde. La fila D-04 de GOB-02 lo deja anotado.

`CAL-02` cambia de sentido con esto: para el piloto deja de ser una meta de igualdad céntimo a
céntimo contra el SRTM —no hay determinaciones suyas en el padrón— y queda como contraste de
plausibilidad; la igualdad exacta vuelve a exigirse solo en una migración, contra las
determinaciones que se migran.

## Consecuencias

- **La primera regla de cálculo deja de esperar por el redondeo.** Lo que sigue impidiéndola está
  en GOB-02 y GOB-03 §0.6: D-11 para las reglas que llevan los cuatro factores (H-12), y sellar el
  conjunto del ejercicio con sus parámetros publicados.
- **Las filas `REDONDEO:‹punto›` del piloto se pueden publicar** por el mismo camino que todo
  parámetro (`PublicarParametros`, ADR-0007: documento fuente —este ADR— y dos firmas).
- **D-03d sigue abierta.** El importe a pagar en ventanilla puede redondearse distinto que el
  cálculo (a decisión de Tesorería y contabilidad); nada de lo de aquí la prejuzga.
- **La campaña de observación del SRTM no se hace ahora** y su formulario no se borra: queda
  esperando a la primera municipalidad que migre.

## Alternativas descartadas

- **`HALF_EVEN`.** Minimiza el sesgo estadístico en agregados grandes, pero no es lo que la
  administración tributaria peruana practica, y una diferencia de un céntimo contra lo que el
  contribuyente espera se explica peor que el sesgo.
- **Ejecutar la campaña de observación antes de la primera regla, aunque el padrón sea nuevo.**
  Era el plan cuando se asumía migración; con padrón nuevo produce un inventario de puntos de un
  sistema cuyas cifras no van a estar en la base, al coste de la dependencia más lenta del
  proyecto (acceso al SRTM del MEF).
- **Compilar la política en el código ya que ahora «es nuestra».** No: la regla 5 sigue —una
  política escrita a mano la detecta el escáner de fuentes— y el camino de datos ya existe y está
  probado. Que la política la decida este ADR no cambia dónde vive.
