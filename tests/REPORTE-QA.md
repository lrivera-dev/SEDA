# HACHI — Reporte de QA y preparación del Draft PR

Fecha: 14 de octubre de 2026 (America/El_Salvador).

## Entorno verificado antes de modificar

| Verificación | Resultado |
|---|---|
| Carpeta | CORRECTO: checkout independiente `SEDA-qa-hachi` (ruta personal omitida) |
| Rama | CORRECTO: `feature/qa-hachi` |
| Remoto origin | CORRECTO: `lrivera-dev/SEDA` en GitHub; no se imprimió la URL completa |
| Estado inicial de la implementación | CORRECTO: limpio; actualmente existen cambios de QA y CI pendientes de commit |
| Node.js | CORRECTO: `v24.21.0`; dependencias Supabase requieren >=22 |
| HEAD final, sin commits nuevos | `4fc989258a6159a305f39edd957748eeec68c514` |

## Resultado final

| Suite | Casos ejecutados | PASS | FAIL | BLOCKED |
|---|---:|---:|---:|---:|
| Unitarias | 31 | 26 | 5 | 0 |
| API | 20 | 18 | 2 | 0 |
| Total de casos únicos | 51 | 44 | 7 | 0 |

Ambos comandos terminaron con código 1 por defectos de producción. Los siete fallos corresponden a dos defectos, no a siete causas distintas. No hay pruebas omitidas, canceladas o TODO.

Durante la implementación inicial hubo un intento adicional de los 20 casos API dentro del sandbox: todos quedaron BLOCKED por `connect EACCES 127.0.0.1`. Node los imprimió como FAIL, pero se clasifican como limitación del entorno, sin evaluación del backend. El reintento autorizado resolvió el bloqueo. Esa fase incluyó 71 intentos de casos, de los cuales 51 evaluaron el código. Posteriormente, al integrar CI, se repitieron las 51 pruebas y se obtuvieron nuevamente 44 PASS, 7 FAIL y 0 BLOCKED. No se suman intentos repetidos ni bloqueos transitorios a los resultados de la última ejecución.

## Estado actual del CI

La configuración local de `.github/workflows/ci.yml` integra ambas suites con Node.js 22. Conserva checkout, comprobación de `.env` versionado, instalación reproducible con `npm ci` cuando existe package-lock.json, lint/build opcionales y los disparadores `pull_request` y `push` para development, staging y main.

El paso `npm run test:qa` usa la condición `!cancelled() && steps.dependencias.outcome == 'success'`: el ejecutor corre ambas suites una vez, conserva sus resultados por separado y continúa con API aunque fallen las unitarias. No se usa `continue-on-error`; cualquier suite o generación fallida mantiene el resultado global fallido. Un paso posterior con `actions/upload-artifact@v4` publica PDF, Markdown y JSON/JSONL incluso ante fallos, si la instalación fue exitosa.

El YAML y los scripts se verificaron localmente. La ejecución en GitHub Actions sobre Ubuntu con Node.js 22 está pendiente. Las ejecuciones son locales; cada informe automático registra la versión de Node y el entorno efectivamente usados. El Draft PR hacia development todavía no se ha creado; los siete fallos deben permanecer visibles y no representan una validación satisfactoria del sistema.

## Generador automático (Paso 12.2)

`scripts/qa/` recopila eventos JSON de node:test, conserva los casos individuales y genera PDF y Markdown desde un modelo común. Los resultados actuales se calculan en cada ejecución; este reporte histórico no alimenta los contadores. `npm run test:qa` ejecuta ambas suites, mientras `test:unit` y `test:api` generan informes parciales de la suite seleccionada. PDFKit 0.17.2 es una dependencia de desarrollo.

Los informes y resultados estructurados se guardan en `qa-output/<fecha-UTC-id>/`, excluido de Git. No reemplazan las evidencias históricas de `tests/evidence/`. Los diagnósticos distinguen evidencia verificada de hipótesis y no modifican código funcional. Las verificaciones del generador se ejecutan con `npm run test:qa-generator` y se contabilizan por separado de la suite SEDA. La guía de reproducción y descarga de artefactos se encuentra en `tests/README.md`.

Validación del Paso 12.2: ejecución local con Node.js 22.23.3 en Windows, identificador `2026-10-14T17-31-33-827Z-5d16d1`. Resultados estructurados: 51 casos, 44 PASS, 7 FAIL, 0 BLOCKED y 0 NOT_RUN; salida global 1. QA-001 agrupa cinco casos y QA-002 dos. PDF y Markdown se generaron pese a los fallos. Las 13 verificaciones del generador pasaron por separado, incluida la conservación de Markdown ante un fallo simulado de PDF. Se revisaron visualmente las páginas del PDF; la validación remota de Ubuntu/GitHub Actions continúa pendiente.

## Evidencia de terminal

Actualización de trazabilidad (Paso 12.3): se incorporaron la estrategia proporcionada y las historias del Sprint como configuración reutilizable. HU-6, HU-8 y HU-9 suman 9 criterios y 15 reglas; la DoD conserva sus 7 criterios originales. Las 51 pruebas históricas se clasifican como regresión, sin asociarlas a la aprobación de estas historias. Se regeneran los informes históricos con fecha original y fecha de regeneración separadas; no se ejecutan nuevamente las 51 pruebas. Los criterios nuevos permanecen SIN_EVIDENCIA y su implementación «No verificado en la referencia evaluada». Las diferencias entre documentos se registran para aclaración, sin alterar requisitos.

Salida de la ejecución inicial: `evidence/unit.txt` y `evidence/api.txt`, con las rutas personales sustituidas por `<repositorio>` y sin modificar resultados, errores ni ubicaciones relativas de las trazas. La última ejecución local repitió esos resultados; estos archivos no se presentan como logs nuevos de esa repetición.

El intento bloqueado se conserva localmente en `evidence/api-sandbox-blocked.txt`; `evidence/git-final.txt` conserva una captura histórica de Git anterior a la integración del CI. Ambos son auxiliares locales, están excluidos mediante `evidence/.gitignore` y no deben incluirse en el futuro commit ni forzarse con `git add -f`.

```text
npm run test:unit
# tests 31
# pass 26
# fail 5
# cancelled 0
# skipped 0
# todo 0

npm run test:api
# tests 20
# pass 18
# fail 2
# cancelled 0
# skipped 0
# todo 0
```

Cada archivo TAP enumera por nombre todas las pruebas PASS y FAIL y muestra sus errores y trazas.

## Defectos de producción confirmados

| ID | Archivo y línea | Evidencia e impacto | Casos FAIL |
|---|---|---|---|
| QA-001 | `controllers/universidades.controller.js:9` | Se invoca `.trim()` sin validar el tipo. Nombre numérico, booleano, objeto o arreglo lanza `TypeError: datos[campo].trim is not a function`. Por HTTP, el número devuelve 500 en lugar del 400 de validación. | Unitarias 7–10; API 3 |
| QA-002 | `controllers/equivalencias.controller.js:22` | `res.json(400).json(...)` envía primero el cuerpo numérico 400 con HTTP 200; debería establecer el estado antes de enviar JSON. La respuesta para materias iguales incumple el rechazo descrito por el propio controlador. | Unitaria 19; API 6 |

No se corrigió código de producción. Los criterios 400 se apoyan en las ramas de validación existentes y la regla explícita de no permitir materias iguales.

Observaciones de mensajes, no contadas como pruebas fallidas: `controllers/universidades.controller.js:79` contiene “registarada”; `controllers/equivalencias.controller.js:63` contiene “orifen”. La prueba de alta válida conserva el mensaje actual y documenta la errata. Los mensajes propagados desde servicios se comprueban con errores ficticios en español; esto no garantiza que los errores reales externos estén traducidos.

## Cobertura que pasó

- Universidades: seis campos vacíos, alta válida, duplicado, error de búsqueda y error de Auth. HTTP verifica campos ausentes, duplicado, alta y estructura JSON.
- Equivalencias: cuatro campos ausentes, origen/destino inexistentes, propagación de identificador rechazado por persistencia, universidad sin permiso, archivos faltantes y registro PENDIENTE. HTTP verifica campos ausentes, origen inexistente, error de servicio y alta válida.
- Archivos: vacío, formato incompatible, PDF y DOCX truncados y válidos. HTTP verifica ausencia de archivo, MIME/contenido inválidos, tamaño mayor a 20 MiB, cargas válidas, advertencia DOCX, tipo/identificadores faltantes y error de almacenamiento.

## Herramientas y cambios

Se añadieron `supertest@7.1.4` como dependencia de desarrollo y sus dependencias transitivas. Supertest declara Node >=14.18, compatible con Node 24 y el mínimo del proyecto. `node:test` y `node:assert/strict` vienen con Node y no requieren instalación.

El árbol inicial no tenía dependencias instaladas. Se instalaron también las versiones ya fijadas del proyecto: Express 5.2.1, Multer 2.4.0, Supabase JS 2.117.2 y dotenv 18.0.6, sin ejecutar scripts de instalación. Instalación no implica acceso a Supabase. Una comparación programática del lockfile con HEAD confirmó que ninguna entrada preexistente de dependencia cambió.

Archivos modificados:

- `package.json`: scripts `test:unit` y `test:api`, dependencia de desarrollo Supertest.
- `package-lock.json`: resolución reproducible de Supertest y dependencias transitivas.
- `.github/workflows/ci.yml`: Node.js 22 y ejecución independiente de ambas suites sin ocultar fallos.

Archivos creados:

- `tests/unit/validaciones.test.cjs` y `tests/api/endpoints.test.cjs`.
- `tests/helpers/entorno.cjs` y `tests/helpers/datos.cjs`.
- `tests/README.md` y `tests/REPORTE-QA.md`.
- `tests/evidence/unit.txt` y `tests/evidence/api.txt`: evidencias anonimizadas para el PR.
- `tests/evidence/.gitignore`: exclusión de los dos logs auxiliares conservados localmente (`api-sandbox-blocked.txt` y `git-final.txt`).

`node_modules` contiene las dependencias instaladas y está ignorado por Git.

## Comandos principales

```powershell
Get-Location
git branch --show-current
git status --porcelain=v1
node --version
npm ls --depth=0
npm install --save-dev --save-exact supertest@7.1.4 --ignore-scripts --no-audit --no-fund
npm run test:unit
npm run test:api
git status --short --untracked-files=all
git diff --check
git diff --stat
git diff -- package.json
git diff --numstat
git rev-parse HEAD
```

Se usaron además lecturas de código con Get-Content/rg, comparación del lockfile con HEAD y captura de salida con Tee-Object. La instalación inicial falló por ENOTFOUND y se repitió con permiso de red. API requirió permiso para conexiones locales fuera del sandbox. No se detectaron errores del código de pruebas en la ejecución final; las limitaciones del entorno quedaron resueltas.

## Recomendaciones y siguientes pruebas

1. Solicitar autorización separada para corregir QA-001 y QA-002, y volver a ejecutar ambas suites.
2. Acordar el contrato de tipos y formatos de identificadores antes de agregar validación local y sus pruebas. El código actual delega parte de esa validación en persistencia.
3. Ampliar posteriormente con límites exactos de tamaño, campo multipart incorrecto, múltiples archivos, JSON malformado, body ausente/null, errores de inserción/actualización y carga de programa válida.
4. Evaluar consistencia del estado ante fallos parciales de Auth/BD/Storage, sin tocar datos compartidos. Corregir erratas y definir traducción de errores externos cuando se autorice.
5. Cuando corresponda, separar creación de la aplicación y arranque del puerto para simplificar las pruebas; no fue necesario hacerlo en esta fase.

Verificación final: el trabajo pendiente de publicar se limita a package.json, package-lock.json, tests/, scripts/qa/, .gitignore y .github/workflows/ci.yml. No se modificaron backend, frontend, .env ni configuración de Supabase; no se cambiaron rama/carpeta ni se hicieron commits, push o merges. GitHub Actions está configurado localmente, pero su ejecución en GitHub todavía no se ha validado. El Paso 12.2 añade generación de informes e integración de artefactos sin cambiar las aserciones de SEDA. La suite conserva los dos defectos y sus siete fallos visibles; no constituye aprobación funcional de SEDA. Trabajo detenido a la espera de autorización.
