# Hachi: primera suite de regresión

Requiere Node.js 22 o superior y acceso a loopback para Supertest. No necesita `.env`, credenciales ni servicios de Supabase. Desde la raíz del repositorio:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:qa
```

`npm run test:qa` ejecuta ambas suites una sola vez, genera informes incluso si fallan y devuelve código 1 mientras permanezcan los defectos documentados en `REPORTE-QA.md`. `npm run test:unit` y `npm run test:api` siguen disponibles: ejecutan su suite y generan un informe parcial, con la otra suite indicada como NOT_RUN y cantidad no descubierta. No se han marcado pruebas como omitidas ni se ha cambiado el resultado esperado para ocultarlos. El script heredado `npm test` no forma parte de esta configuración.

## Aislamiento

- `helpers/entorno.cjs` precarga un sustituto de `supabaseClient.js` en la caché CommonJS antes de importar controladores o servidor. El módulo original no se lee ni ejecuta, tampoco se carga dotenv.
- El sustituto únicamente representa respuestas de persistencia, Auth y Storage. Verifica el orden de operaciones y falla ante accesos no programados o respuestas sin consumir. Las reglas de validación, controladores, rutas, Multer y manejo de errores son los originales.
- Para API se captura temporalmente `express.application.listen` con `node:test.mock` al cargar el `server.js` original. Se obtiene la aplicación montada sin iniciar su puerto configurado; se restaura `listen` inmediatamente. Supertest usa puertos efímeros locales. No se copian rutas ni manejadores de error a una aplicación paralela.
- Se bloquean `fetch` y conexiones TCP a destinos distintos de loopback dentro del proceso de pruebas. Esta protección complementa la sustitución del cliente; no pretende ser un sandbox para código arbitrario.
- Cada archivo de pruebas tiene su propio proceso de Node; los casos se ejecutan en secuencia. No activar concurrencia dentro del archivo sin rediseñar el estado del sustituto.
- Los PDF y DOCX se construyen en memoria con datos ficticios; el caso de tamaño usa 20 MiB + 1 byte y pasa por Multer real. Los validadores existentes comprueban firmas, no la legibilidad completa de documentos.

## Alcance

Se prueba HTTP real con Express y Supertest, sin comprobar contratos de Supabase real, RLS, esquema de base de datos ni comportamiento de Auth remoto. El caso de identificador inválido documenta cómo el controlador propaga un error simulado de persistencia; no demuestra validación local del formato ni define si los IDs del esquema deben ser UUID o enteros.

Las pruebas unitarias usan un objeto de respuesta mínimo; la suite HTTP comprueba además la respuesta real de Express. No se implementa Sprint 2 ni IA.

## Integración con CI

Las suites unitarias y API ya están integradas en la configuración local de GitHub Actions (`.github/workflows/ci.yml`), con Node.js 22 y un paso `npm run test:qa`. El ejecutor conserva resultados independientes y continúa con API aunque falle la suite unitaria. Se conserva `npm ci` cuando existe el lockfile, además de checkout, comprobación de `.env` versionado, lint/build opcionales y disparadores `pull_request` y `push` para development, staging y main.

Ambas suites se ejecutan si la instalación de dependencias fue exitosa, aunque falle un paso anterior, salvo cancelación del workflow. No se usa `continue-on-error`: el fallo de cualquier suite mantiene el CI fallido.

Las ejecuciones locales han mostrado 51 pruebas: 44 PASS, 7 FAIL y 0 BLOCKED, correspondientes a dos defectos conocidos. Cada informe nuevo calcula sus cifras y registra la versión real de Node, fecha y entorno; estos números históricos no se usan como entrada del generador. La ejecución en GitHub Actions con Ubuntu y Node.js 22 todavía está pendiente; configurar el workflow no equivale a haberlo validado en GitHub.

## Informes automáticos

El generador en `scripts/qa/` consume eventos estructurados de `node:test` mediante un reporter JSON. No analiza TAP ni texto libre de la terminal. PDFKit 0.17.2 crea el PDF sin navegador, servicios externos, credenciales ni APIs de IA. PDF y Markdown derivan del mismo modelo y contienen portada, resumen visual, casos PASS, fallos agrupados, recomendaciones, pendientes, Definition of Done y conclusiones.

Cada ejecución crea `qa-output/<fecha-UTC-id>/` con:

- `informe.pdf` e `informe.md`.
- `execution.json`: metadatos y eventos por suite.
- `results.json`: casos normalizados, cifras y hallazgos.
- `unit.jsonl` y/o `api.jsonl`: eventos individuales de las suites seleccionadas.
- `report-error.json`: solo si falla la generación. Se conserva la evidencia y se devuelve código 1; el Markdown permanece si ya se generó.

La carpeta completa está ignorada por Git. Las rutas personales y patrones de secretos se sanitizan antes de escribir evidencia; no se recopilan variables de entorno completas ni stdout/stderr arbitrario de la aplicación. Se preservan excepciones, expected/actual y trazas estructuradas. Esta sanitización no autoriza usar datos reales: las suites deben mantener sus fixtures ficticios y servicios simulados.

PASS/FAIL proceden del ejecutor; errores explícitos de acceso o carga de módulos se clasifican BLOCKED, y skip/todo o casos descubiertos sin finalizar se clasifican NOT_RUN. Una suite no descubierta se informa aparte, sin inventar su número de pruebas. El código de salida no cero del proceso también se conserva aunque falten resultados individuales. Se diferencia infraestructura de defectos, sin identificar automáticamente toda causa posible.

Los dos diagnósticos conocidos se vinculan a evidencia de ejecución y firmas del código revisado. Para otros errores se indica «Requiere investigación». Las recomendaciones nunca modifican producción. El Sprint y sus requisitos se cargan desde `qa/config.json` y `qa/sprints/<id>.json`; no están fijos en el generador. La fecha de ejecución se expresa en UTC.

La estrategia proporcionada y el documento del Sprint están incorporados en la configuración revisada. El resumen ejecutivo precede a la matriz de criterios y a la DoD; el detalle individual se conserva como anexo técnico. Las pruebas de regresión no acreditan HU-6, HU-8 ni HU-9. La guía `qa/README.md` describe los estados, el cambio de Sprint y la regeneración histórica sin ejecutar pruebas. El comando `node scripts/qa/regenerate.cjs qa-output/<ejecución>/results.json sprint-2` conserva fechas y hallazgos originales y marca el nuevo informe como histórico.

Verificaciones del propio generador: `npm run test:qa-generator`. Son casos de soporte independientes de las 51 pruebas de SEDA y no se suman al informe del producto.

## Descargar desde GitHub Actions

Después de publicar los cambios y ejecutar el workflow: abrir **Actions → CI → ejecución → Artifacts → hachi-qa-<run_id>-<run_attempt>**. Descargar y descomprimir el archivo para obtener PDF, Markdown y JSON/JSONL. `actions/upload-artifact@v4` se ejecuta aunque fallen las pruebas, si la instalación terminó correctamente; la retención configurada es de 14 días. No se suben las evidencias históricas ni archivos fuera de los patrones de `qa-output/` definidos en el workflow.

La subida no convierte el CI en exitoso: si una suite o el generador falla, el paso de QA falla. Si no se producen artefactos, la subida también informa error. Una terminación forzada del proceso o del runner puede impedir terminar el PDF; los archivos ya escritos son la evidencia recuperable.

## Evidencias publicables

`evidence/unit.txt` y `evidence/api.txt` conservan los resultados y trazas de la ejecución inicial; las rutas personales se sustituyeron por `<repositorio>`. La última ejecución local repitió los mismos resultados. Los logs auxiliares `evidence/api-sandbox-blocked.txt` y `evidence/git-final.txt` se conservan únicamente de forma local y están excluidos mediante `evidence/.gitignore`; no deben incorporarse al futuro commit, tampoco con `git add -f`.
