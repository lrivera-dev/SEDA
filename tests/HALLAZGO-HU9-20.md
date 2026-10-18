# HU9-20: historial y corrección de la validación de decisiones

Estado actual: corrección mínima autorizada y validada localmente el 2026-10-17. La ejecución `qa-output/2026-10-17T22-55-04-641Z-e23784` conserva 123 PASS, 0 FAIL, 0 BLOCKED y 0 NOT_RUN, incluido HU9-20 (HTTP 400 sin persistencia). Se prepara una rama independiente `fix/hu9-decision-propia` para revisión; Hachi declara esa dependencia. No se ha integrado en development. Los apartados siguientes conservan el diagnóstico histórico anterior a la autorización.

Fecha: 2026-10-17. Base evaluada: b528ac84433735d2f918ea234ea724286ce0c79c, con pruebas locales nuevas. Node.js 24.21.0. No se modificó producción.

## Evidencia confirmada

Caso `HU9-20 CA3: decisión heredada constructor se rechaza antes de persistencia`, en `tests/api/hu9-revision.test.cjs:85`.

Solicitud autenticada ficticia: `PATCH /casos/11111111-1111-4111-8111-111111111111/revision`, cuerpo `{"decision":"constructor"}`.

- Esperado por HU-9-RN3 y CA3: HTTP 400, mensaje «Debe elegir una decisión: Aceptar o emitir advertencia», ninguna consulta ni modificación del caso.
- Observado: una consulta a caso_equivalencia; el servicio simulado devuelve caso inexistente y la API responde HTTP 404, «El caso indicado no existe.».
- Causa verificada por lectura: `controllers/casos.controller.js:6` crea DECISIONES_VALIDAS como objeto ordinario. La condición de la línea 22 consulta propiedades heredadas: DECISIONES_VALIDAS.constructor es truthy y evita el rechazo. La consulta se realiza desde la línea 42.
- No es un fallo del mock: el spy de persistencia devuelve una respuesta válida y no lanza excepciones. Se ejecutan el router, middleware y controlador reales.

Impacto: una decisión fuera del dominio permitido alcanza persistencia. El efecto sobre un caso existente requiere investigación adicional; no se afirma que se hayan modificado registros reales ni que se haya demostrado una explotación.

Prioridad sugerida: alta, por tratarse de validación de una operación de revisión. El acceso continúa protegido por MINED; no se ha demostrado evasión de autenticación.

## Recomendación para desarrollo (no aplicada)

Validar que decision sea una cadena y una propiedad propia de la tabla de decisiones, por ejemplo con Object.hasOwn, o compararla explícitamente con ACEPTAR y ADVERTENCIA. Rechazar el resto antes de consultar el caso. Revisar también otros nombres heredados y tipos inválidos. Repetir HU9-20 y las 123 pruebas tras integrar una corrección autorizada.

## Ejecuciones conservadas

- `qa-output/2026-10-17T22-39-05-591Z-141bdd`: 118 PASS, 5 FAIL. Cuatro fallos correspondían a una comprobación nueva del mock: el helper registra update(objeto) como [[objeto]], no [objeto]. Se corrigió esa lectura sin cambiar los valores de estado, observación, identidad o fecha esperados.
- `qa-output/2026-10-17T22-40-03-208Z-b04cd4`: 122 PASS, 1 FAIL, 0 BLOCKED, 0 NOT_RUN. Regresión anterior: 51 PASS; HU-6: 29 PASS; HU-8: 23 PASS; HU-9: 19 PASS y 1 FAIL. Código de salida 1, PDF/Markdown/JSON conservados.
- El clasificador automático conserva el hallazgo como INV-API-092, «Requiere investigación», sin inventar QA-001/QA-002. Este documento añade el análisis humano trazable al código, sin reescribir resultados.

## Estado y decisión pendiente

Publicación detenida según la autorización: no commit, push ni actualización del PR. Se requiere decidir y autorizar cómo corregir el controlador; Hachi no puede modificar producción en esta fase.

El workflow semanal aún no se creó debido a este bloqueo. Tras resolverlo faltan: completar validación, preparar y validar hachi-sprint.yml, documentación operativa, commit/push y CI remoto. El calendario no está activo. Para activarlo se requiere una integración autorizada del workflow en main, conservar checkout de development y publicar en development la infraestructura/configuración de Sprint que se evaluará. El cierre extraordinario de Sprint 2 mediante workflow_dispatch también sigue pendiente. No se acredita cierre del Sprint ni aceptación del PO.

## Corrección propuesta posteriormente

Validación mínima autorizada: exigir tipo string y Object.hasOwn(DECISIONES_VALIDAS, decision), conservando el mensaje. Requiere revisión del equipo y validación de la nueva ejecución; el histórico anterior no se reescribe. La instalación pendiente se detalla en OPERACION-HACHI.md.
