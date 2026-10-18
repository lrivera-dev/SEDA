# Configuración de trazabilidad de Hachi

La estrategia del equipo y el documento del Sprint se incorporan como datos revisados, sin ejecutar las tareas técnicas que describen. No se leen `.env`, credenciales ni Supabase. Los documentos originales permanecen intactos fuera del repositorio; la configuración guarda títulos, huellas SHA-256 y referencias a páginas/secciones, no nombres o matrículas de la portada del PDF.

## Seleccionar un Sprint

`qa/config.json` contiene `activeSprint`. Su valor se resuelve como `qa/sprints/<id>.json`. Para otro Sprint, crear ese JSON y cambiar únicamente `activeSprint`, o usar la variable opcional `QA_SPRINT` al ejecutar las pruebas. No hay un número de Sprint fijo en el generador general. No se modifica GitHub Actions para seleccionar el Sprint: utiliza el archivo de configuración del checkout.

```powershell
$env:QA_SPRINT = 'sprint-2'
npm run test:qa
```

## Regenerar un informe histórico sin ejecutar pruebas

```text
node scripts/qa/regenerate.cjs qa-output/2026-10-14T17-31-33-827Z-5d16d1/results.json sprint-2
```

El primer argumento es un `results.json` de una ejecución real; el segundo es el identificador de configuración (opcional). Se crea una carpeta nueva `qa-output/historico-<fecha>-<id>/`, sin sobrescribir los archivos originales. Contiene PDF, Markdown, `results.json` enriquecido y una copia `source-results.json` de la evidencia original. Se conservan fechas, rama, commit, casos y hallazgos históricos; se añade fecha de regeneración, huella del resultado original y un aviso visible de que no es una ejecución nueva. El comando devuelve 1 cuando la evidencia original contiene suites FAIL/BLOCKED, aunque genere correctamente los documentos.

La regeneración conserva los diagnósticos de la evidencia histórica: no los recalcula contra código de producción que pudiera haber cambiado. Los criterios y su configuración aplicada quedan identificados por hash. Una configuración nueva tampoco transforma evidencia histórica en aprobación del Sprint actual.

## Estructura del JSON (schemaVersion 1)

- `number`, `id`, `title`, `goal`: identidad y objetivo del Sprint.
- `sources`: documentos incorporados, huellas SHA-256 y alcance de la extracción.
- `strategy`: niveles de prueba, pruebas cruzadas y prevención de regresiones, con referencias a la estrategia.
- `stories`: historia, funcionalidad, precondiciones, dependencias, exclusiones y reglas de negocio originales.
- `stories[].criteria`: identificador, texto original, fuente, estado de implementación conocido, `testRefs`, evidencias, observaciones, pendientes y caso propuesto.
- `plannedCase`: caso derivado del criterio, expresamente propuesto/no ejecutado. No cuenta como una prueba automatizada ejecutada.
- `coverageComplete`: declaración revisada de cobertura del criterio. No poner `true` hasta confirmar que las pruebas relacionadas cubren todas sus condiciones, incluidos tiempos y reglas aplicables.
- `regression.testRefs`: catálogo de pruebas anteriores. Esta clasificación no vincula por sí sola pruebas a historias nuevas.
- `dod`: criterios originales de Definition of Done y su tipo de evaluación (`applicable`, `peers`, `regression`, `defects`, `shared`, `po`, `branches`).
- `openQuestions`: diferencias entre fuentes o decisiones que requieren aclaración; no se resuelven alterando requisitos.
- `outOfScope`: exclusiones acordadas para ese Sprint.

Cada referencia automatizada requiere `id`, `suite`, `name` y `file` relativo al repositorio. El ID ordinal se conserva como referencia documental, pero la asociación se comprueba por suite, nombre exacto y archivo: evita atribuir un resultado de otra prueba cuando cambia el orden. Los IDs actuales aparecen en el resultado de cada ejecución. Si un test se renombra o cambia de archivo, revisar su asociación explícitamente.

## Estados y límites de aprobación

| Estado | Interpretación |
|---|---|
| PASS | Todas las pruebas vinculadas pasaron y la cobertura completa del criterio fue declarada y revisada. |
| FAIL | Al menos una prueba vinculada falló en la evidencia utilizada. No se asigna por una funcionalidad futura. |
| BLOCKED | Hay una prueba vinculada impedida por infraestructura. |
| NOT_RUN | Una prueba vinculada se omitió o no tiene resultado con la identidad configurada. |
| SIN_EVIDENCIA | No existen asociaciones verificables o la cobertura del criterio es incompleta, aunque una prueba aislada pase. |

`verification` se mantiene en `SIN_EVIDENCIA` en la configuración; PASS/FAIL no se escriben manualmente. El resultado se deriva de las ejecuciones. Los textos de evidencia manual no se convierten automáticamente en aprobación: el mecanismo actual los presenta como referencias, y la validación por pares/PO y del entorno compartido continúa sin evaluación automatizada de sus documentos. Para incorporar esa validación estructurada será necesario ampliar y revisar el mecanismo.

La historia solo puede mostrar PASS si todos sus criterios muestran PASS. El generador no certifica automáticamente el cierre del Sprint, que exige también evidencia de DoD. Se informa aparte la cobertura parcial de regresión: haber ejecutado pruebas no equivale a verificar todo el incremento ni a corregir los errores encontrados.

## Sprint configurado actualmente

Se transcribieron 9 criterios de HU-6, HU-8 y HU-9, 15 reglas de negocio y los 7 criterios DoD de la estrategia. Las 51 referencias actuales son regresión y **ninguna está asociada a esos 9 criterios**. Los casos PLAN-HU-* son propuestas derivadas, no implementaciones ni resultados.

La implementación se presenta como «No verificado en la referencia evaluada»: no se inspeccionaron otras ramas. Quedan registradas las diferencias sobre developer/development, el mensaje de login, la alternativa de URLs públicas y el recorte sugerido del bloqueo. El cálculo de IA está fuera de alcance; mostrar «Pendiente de cálculo» sigue siendo una regla de HU-8.

## Verificación

`npm run test:qa-generator` comprueba clasificación de estados, ausencia de aprobación automática por regresión, cobertura parcial, identidad de pruebas, criterios duplicados, preservación de evidencia histórica y cambio de Sprint sin reescribir el generador. Las 51 pruebas de SEDA no se modifican.
