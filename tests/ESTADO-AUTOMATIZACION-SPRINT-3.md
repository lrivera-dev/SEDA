# Estado de automatización Sprint 3

Referencia inspeccionada: development `cebb094`. Este inventario describe esta referencia, no ramas de desarrollo ajenas.

## Implementado y ejecutable

15 pruebas API nuevas en `tests/api/sprint3-precondiciones.test.cjs`, descubiertas por `npm run test:qa`. Ejecutan router y controlador reales con Supabase simulado. Verifican las 15 combinaciones incompletas de cuatro documentos: HTTP 400, mensaje de validación, cantidad de faltantes y ausencia de inserción. No se simula la lógica del controlador.

Cobertura parcial de PLAN-S3-HU-3-02: solo precondición HU-2, no descarga, lectura, envío ni evaluación IA. Las 15 referencias se añaden a regresión y no a los testRefs de aceptación de HU-3/HU-4. Los 123 casos anteriores se conservan. No se crearon skips, TODO ejecutables ni PASS por ausencia de módulos.

## Estado de los 41 escenarios

| Escenario | Estado | Dependencia para completar / ejecutar |
|---|---|---|
| PLAN-S3-HU-3-01 | PENDIENTE_IMPLEMENTACION | HU-2 + tareas 2,3,5,6. |
| PLAN-S3-HU-3-02 | PARCIAL: precondición HU-2 automatizada; evaluación IA PENDIENTE | Tareas 3,5,6. |
| PLAN-S3-HU-3-03 | PENDIENTE_IMPLEMENTACION | Lector de PDF/Word + tarea 1. |
| PLAN-S3-HU-3-04 | PENDIENTE_IMPLEMENTACION | Tareas 1,5,6. |
| PLAN-S3-HU-3-05 | PENDIENTE_IMPLEMENTACION | Tarea 5. |
| PLAN-S3-HU-3-06 | PENDIENTE_IMPLEMENTACION | Tarea 5. |
| PLAN-S3-HU-3-07 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | Tareas 3,8 y UI. |
| PLAN-S3-HU-3-08 | PENDIENTE_IMPLEMENTACION | Tareas 1,3. |
| PLAN-S3-HU-3-09 | PENDIENTE_IMPLEMENTACION | Tareas 1,3. |
| PLAN-S3-HU-3-10 | PENDIENTE_IMPLEMENTACION | Tarea 3. |
| PLAN-S3-HU-3-11 | PENDIENTE_IMPLEMENTACION | Tareas 3,6. |
| PLAN-S3-HU-3-12 | PENDIENTE_IMPLEMENTACION | Tareas 3,6. |
| PLAN-S3-HU-3-13 | PENDIENTE_IMPLEMENTACION | Tarea 4. |
| PLAN-S3-HU-3-14 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | Tareas 4,6,8. |
| PLAN-S3-HU-3-15 | PENDIENTE_IMPLEMENTACION | Tareas 2,6. |
| PLAN-S3-HU-3-16 | PENDIENTE_IMPLEMENTACION | Tarea 6. |
| PLAN-S3-HU-3-17 | PENDIENTE_IMPLEMENTACION | Tareas 6,7. |
| PLAN-S3-HU-3-18 | PENDIENTE_IMPLEMENTACION | Tarea 7. |
| PLAN-S3-HU-3-19 | PENDIENTE_IMPLEMENTACION | Tarea 7. |
| PLAN-S3-HU-3-20 | PENDIENTE_IMPLEMENTACION | Tarea 7 + HU-9. |
| PLAN-S3-HU-3-21 | PENDIENTE_IMPLEMENTACION | Tareas 6,7. |
| PLAN-S3-HU-3-22 | PENDIENTE_IMPLEMENTACION | Tareas 2,6. |
| PLAN-S3-HU-3-23 | PENDIENTE_IMPLEMENTACION | Tarea 6. |
| PLAN-S3-HU-3-24 | PENDIENTE_IMPLEMENTACION | Tareas 3,5,6. |
| PLAN-S3-HU-3-25 | PENDIENTE_IMPLEMENTACION | HU-2 + tarea 6. |
| PLAN-S3-HU-4-01 | PENDIENTE_IMPLEMENTACION | HU-4 tarea 1 + HU-3. |
| PLAN-S3-HU-4-02 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-3 clasificador + HU-4 tareas 1,2. |
| PLAN-S3-HU-4-03 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-3 clasificador + HU-4 tareas 1,2. |
| PLAN-S3-HU-4-04 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tareas 1,2. |
| PLAN-S3-HU-4-05 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tareas 1,2. |
| PLAN-S3-HU-4-06 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tarea 2. |
| PLAN-S3-HU-4-07 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tarea 2. |
| PLAN-S3-HU-4-08 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tareas 1,2 + HU-2. |
| PLAN-S3-HU-4-09 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tareas 1,2; E2. |
| PLAN-S3-HU-4-10 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tareas 1,2. |
| PLAN-S3-HU-4-11 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tarea 2. |
| PLAN-S3-HU-4-12 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-3 tarea8 + HU-4 tarea2. |
| PLAN-S3-HU-4-13 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-3 tarea8 + HU-4 tarea2. |
| PLAN-S3-HU-4-14 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tareas1,2,4. |
| PLAN-S3-HU-4-15 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-2 + HU-3 + HU-4 tarea4. |
| PLAN-S3-HU-4-16 | PENDIENTE_IMPLEMENTACION; requiere navegador/E2E | HU-4 tarea2; aclaración UX. |

## Evidencia de implementación ausente

- `servicios/ia-coincidencia.js`, `servicios/preparar-documentos.js`, `servicios/clasificar-coincidencia.js` y `servicios/cola-evaluacion.js` no existen en la referencia.
- No existen `routes/coincidencia.routes.js`, `routes/checklist.routes.js` ni `public/checklist.html`. `server.js` no registra esas rutas.
- `registrarEquivalencias` termina tras insertar y responder 201; todavía no hay disparo de la cola. No se prueba un endpoint inexistente esperando éxito ni se clasifica su ausencia como defecto.

## Activación en CI y límite actual

El CI existente responde a opened/reopened/synchronize de PR hacia development y ejecuta test:qa después del aislamiento/carga. El runner descubre todos los archivos *.test.cjs de tests/unit y tests/api; este archivo nuevo se ejecutará automáticamente al publicar la rama y abrir/actualizar el PR. No se creó ni modificó ningún workflow.

La mera aparición de un módulo futuro no crea un contrato de pruebas seguro. Las pruebas pendientes requerirán implementar adaptadores y mocks contra sus exportaciones reales, inspeccionar dependencias antes de cargar el SDK de IA y añadir referencias reales. Una vez añadidas a esas carpetas, CI las descubre sin intervención manual. No hay generación automática ni activación ficticia de pruebas todavía no escritas.

No se han escrito pruebas unitarias del clasificador/IA porque aún no hay código real ni contrato de exportación completo. API de checklist/reintento y E2E quedan pendientes por el mismo motivo. No se inventan interfaces para hacerlas pasar.

Los seis CA mantienen testRefs vacíos, SIN_EVIDENCIA y coverageComplete=false. DoD independiente. No se cambian activeSprint, weeklyEnabled, criterios ni reglas.

## Validación local — 19/10/2026

Node.js 24.21.0. Lint correcto; aislamiento 10 PASS; equipo 35 PASS; generador 35 PASS. Hachi: 138 PASS (123 anteriores + 15 nuevas), 0 FAIL, 0 BLOCKED y 0 NOT_RUN; no hay skips. Ejecución `qa-output/2026-10-19T15-33-14-477Z-7321f1`, con cambios sin commit sobre cebb094. Las 138 referencias de regresión coinciden; no hay resultados sin mapear. PDF: 4 páginas reales verificadas con pypdf. HU-3/HU-4 siguen SIN_EVIDENCIA, DoD NO ACREDITADO.

CI verificado estáticamente; no se ejecutó remotamente esta rama. Sin publicación ni cambios de producción. Los 40 escenarios restantes y la parte IA del escenario parcialmente cubierto requieren implementación real y, donde se indica, E2E. La aparición futura de archivos no basta para afirmar que sus pruebas pendientes están automatizadas.
