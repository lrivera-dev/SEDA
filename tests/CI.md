# Hachi en GitHub Actions — preparación local, Paso 13.10

Configuración revisada el 15 de octubre de 2026. Todavía no validada en Ubuntu/GitHub Actions.
Esta descripción actualiza el flujo anterior documentado en el README: ya no existe
alternativa `npm install` cuando falta el lockfile y la regresión exige aislamiento y carga exitosos.

## Orden y condiciones

1. Checkout sin persistir credenciales Git y control de `.env` versionado (solo nombres).
2. Ubuntu, Node.js 22 y caché npm; instalación estricta mediante `npm ci`.
3. Lint y build si existen; sus errores conservan el estado fallido.
4. `npm run test:isolation`, solo con instalación y control de entorno exitosos.
5. `npm run test:load`, solo si pasó aislamiento. Este script vuelve a ejecutar los
   siete controles antes de su prueba de carga, por diseño previo; no duplica regresión.
6. `npm run test:qa` una sola vez, solo si ambos pasos previos pasaron y no hubo cancelación.
   Ejecuta unitarias y API secuencialmente aunque fallen las primeras; espera la generación
   de PDF/Markdown antes de terminar. Los resultados y códigos de salida no se alteran.
7. Subida de artefactos con `always()` si la regresión terminó con éxito o fallo.
8. Resumen de etapas incluso ante fallos. No reclasifica ni sustituye resultados.

No se usa `continue-on-error`. El fallo de cualquier paso obligatorio permanece en el
resultado del job aunque el resumen o la publicación finalicen correctamente. Un fallo de
lint/build no impide recoger QA si la instalación y ambas barreras de seguridad pasaron.
Si falla aislamiento o carga, la regresión y su publicación se omiten: no se inventa un informe.

## Artefactos y seguridad

`hachi-qa-<run_id>-<run_attempt>` contiene únicamente los nombres previstos bajo
`qa-output/*/`: `informe.pdf`, `informe.md`, `execution.json`, `results.json`,
`report-error.json` si existe, `unit.jsonl` y `api.jsonl`. No incluye previews, logs auxiliares,
archivos ocultos, `.env`, dependencias o toda la carpeta del repositorio.

Retención solicitada: 14 días, sujeta a políticas del repositorio/organización.
Ausencia total de archivos produce un error de publicación. Si falla el PDF, los archivos
parciales ya generados pueden publicarse; `report-error.json` distingue ese fallo.
La cancelación o pérdida del runner puede impedir generar o subir evidencia.

Los helpers usan valores ficticios y bloquean las conexiones externas de las pruebas.
El reporter sanitiza rutas y patrones sensibles; no publica stdout/stderr arbitrarios.
No se inyectan secretos de Supabase ni se necesitan credenciales reales. `contents: read`
es el único permiso explícito del token. Las acciones sí requieren acceso a GitHub y al
registro npm para preparar el runner y publicar artefactos: eso es distinto de las conexiones
de las pruebas, que permanecen aisladas.

Para descargar: Actions → CI → ejecución → Artifacts → hachi-qa-…. Una subida correcta
no acredita que las pruebas pasaron.

## Diagnóstico y límites

El workflow anterior ya usaba Node 22, generaba informes y permitía subirlos tras un fallo,
pero no exigía los pasos de aislamiento y carga, no declaraba permisos mínimos y permitía
instalar sin lockfile. El nuevo flujo conserva los eventos pull_request y push hacia
development, staging y main, además de concurrency. No se añade schedule.

Evidencia local previa: 51 casos, 44 PASS y 7 FAIL de QA-001/QA-002. Hubo otro intento
con 20 BLOCKED por EACCES en loopback del sandbox; no fue un fallo funcional ni una
ejecución de GitHub Actions. QA-003/QA-004 impedían cargar la versión anterior del servidor
y están corregidos en la referencia integrada. No hay logs remotos revisados que permitan
atribuir una causa a fallos anteriores de CI: la primera ejecución de Hachi en GitHub sigue pendiente.

El resumen separa instalación, aislamiento, carga, regresión/generación y subida. Un código
1 de regresión no demuestra por sí solo un defecto del producto: consultar casos y hallazgos
en results.json, eventos en execution.json y report-error.json cuando exista.

PDFKit usa las fuentes incorporadas; generar el PDF no requiere Poppler, navegador ni
Python en Ubuntu. Falta verificar realmente npm ci, loopback de Supertest, carga de módulos,
generación, sanitización de rutas Linux, subida y descarga en GitHub. Los resultados de las
51 pruebas no se repitieron en este paso.

La preparación se verificó con parseo YAML, revisión de scripts y lockfile, escenarios
estáticos de condiciones y cotejo de rutas de artefactos con el código del generador.
Los PDF de ejecuciones anteriores no estaban disponibles para cotejo en esta revisión;
no se regeneraron ni se repitieron las pruebas para esta validación estática.
Estas verificaciones no sustituyen ejecutar el workflow en GitHub.

Referencias oficiales: [setup-node v4](https://github.com/actions/setup-node/tree/v4),
[upload-artifact v4](https://github.com/actions/upload-artifact/tree/v4) y
[condiciones de estado](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions).
