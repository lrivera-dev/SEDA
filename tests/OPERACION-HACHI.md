# Operación de Hachi

## Pull Requests

CI se activa en PR hacia development, staging y main y push a esas ramas. Usa Node.js 24, npm ci, lint, aislamiento, pruebas del equipo, carga, generador y suites de regresión/Sprint. Un fallo de pruebas conserva el código fallido; la publicación de artefactos se intenta aunque falle Hachi. No se usan credenciales reales ni archivos .env.

## Informes

El PDF es una síntesis ejecutiva con límite obligatorio de diez páginas reales (habitualmente cinco a siete). No lista cada PASS. Resume hasta tres defectos y declara cuántos quedan en el detalle. Markdown, results.json, execution.json y JSONL conservan toda la evidencia. Si el PDF excede el límite, la generación falla explícitamente y mantiene la evidencia; nunca se trunca silenciosamente.

En GitHub: Actions → ejecución → Artifacts → hachi-qa-… → descargar ZIP. Retención: 14 días. El CI publica únicamente el directorio de la ejecución real, sin PDFs/Markdown de fixtures del generador.

PASS significa aserciones satisfechas, FAIL una aserción incumplida, BLOCKED un impedimento de infraestructura, NOT_RUN ausencia de ejecución y SIN_EVIDENCIA falta de cobertura/aceptación. Los estados de criterios no se deducen solo de la cantidad de PASS. CA3 de HU-6 requiere aprobación formal del PO. Navegador, tiempos E2E, pares y ambiente compartido siguen pendientes; no se acredita automáticamente la DoD.

## Cierre manual y calendario

`.github/workflows/hachi-sprint.yml` incluye workflow_dispatch y `0 6 * * 6` (sábado 00:00 de El Salvador, UTC-6). Un schedule puede demorarse: no es una garantía de ejecución puntual.

Instalación pendiente y obligatoria:
1. Revisar e integrar por el equipo la corrección HU-9 y Hachi en development.
2. Integrar el workflow en main mediante el proceso de revisión del equipo. Hachi no hace ese merge.
3. Verificar ambas condiciones. Antes de eso no declarar activa la automatización.
4. Para el cierre extraordinario del Sprint 2: Actions → Hachi - evaluación de Sprint → Run workflow, referencia main. El checkout explícito evalúa development y su qa/config.json. No cambies a una rama de trabajo para simular instalación.
5. Para el siguiente Sprint, revisar su configuración versionada y habilitar weeklyEnabled: true en qa/config.json de development. El schedule exige además un número de Sprint >= 3. Mientras weeklyEnabled sea false, no ejecuta la evaluación y lo indica en el resumen; no equivale a PASS de pruebas.

## Incorporar un Sprint

Los domingos, transcribir las historias entregadas y revisadas a qa/sprints/sprint-N.json, conservando schemaVersion, fuentes, criterios originales, reglas, testRefs, pendientes y DoD. No inventar historias. Actualizar activeSprint en qa/config.json mediante PR. Las referencias exigen suite, nombre exacto y archivo; coverageComplete debe mantenerse false si faltan verificaciones. No escribir PASS/FAIL manualmente.

El generador permite QA_SPRINT como selección local explícita; el workflow no depende de conversaciones ni de servicios de IA. Para ejecutar localmente: npm run lint, npm run test:isolation, npm run test:team, npm run test:load, npm run test:qa-generator y npm run test:qa, en ese orden. Solo continuar si el aislamiento pasa.

## Corrección HU-9

Se propone una validación mínima de tipo string y Object.hasOwn antes de consultar persistencia. Se mantiene HU9-20. La corrección va en una rama fix separada según ESTANDAR_CODIGO_SEDA.md y debe ser revisada por el equipo; el PR de Hachi declara su dependencia. El histórico del fallo permanece en HALLAZGO-HU9-20.md y en las ejecuciones locales ignoradas.
