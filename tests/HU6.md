# HU-6: autenticación MINED y propuesta de evolución de CA3

Ejecución local del 2026-10-15 sobre HEAD `81c5700384c32f83e95923a69833bdd3c97664cf`, con Node.js 22.23.3 y el nuevo archivo de pruebas sin commit. Fuente de requisitos: HU-6, CA1–CA3 y RN1–RN5 en `qa/sprints/sprint-2.json`, transcritos de los documentos del equipo. No se modificaron requisitos.


## Estado actual: paso 13.19, propuesta pendiente del Product Owner

Se modificaron exclusivamente las expectativas de HU6-13 y HU6-14. No hubo cambios de producción. Nuevo resultado real con Node.js 22.23.3: **29 PASS, 0 FAIL, 0 BLOCKED, 0 NOT_RUN**, código de salida 0. Las otras 27 pruebas mantienen sus expectativas. El catálogo e incumplimientos descritos más abajo conservan el historial del contrato original; los nuevos PASS no lo invalidan.

CA3 original: «Al ingresar un correo no registrado o una cuenta sin rol MINED, el sistema niega el acceso con el mensaje genérico “Correo o contraseña incorrectos”, sin iniciar sesión y sin revelar cuál dato es incorrecto».

Propuesta: rechazar correos inexistentes y cuentas sin permisos MINED sin devolver token; no revelar existencia, rol ni datos sensibles; permitir un mensaje genérico con intentos restantes; conservar el bloqueo de CA2. **PENDIENTE_PO**: el criterio original sigue vigente hasta validación formal. El ajuste puede orientar al usuario antes del bloqueo sin exponer su identidad o rol.

Las dos pruebas mantienen HTTP 401 y ausencia de token, exigen que el único campo sea error y admiten exclusivamente el mensaje genérico o ese mismo mensaje con dos intentos restantes para este primer fallo. El caso 16 continúa comparando respuestas entre escenarios. CA2 conserva sus pruebas de contador y cinco minutos. Esto no constituye una auditoría completa de enumeración de usuarios por tiempos o ataques distribuidos.

Trazabilidad: 29 referencias por suite, nombre exacto y archivo en sprint-2.json, separadas del catálogo de 51 casos de regresión. CA1 enlaza login/validaciones y autorización como soporte de RN1/RN4; CA2 enlaza intentos/bloqueo/reinicio; CA3 enlaza 13, 14 y 16. CA1/CA2 siguen parciales por navegador. CA3 sigue parcial y pendiente del PO. HU-8/HU-9 continúan SIN_EVIDENCIA de pruebas específicas. Ninguna historia ni Sprint se declara terminada.

Validación del generador: `npm run test` devuelve el placeholder existente «Error: no test specified» (salida 1). No se modificó package.json. `npm run test:qa-generator`: **28 PASS, 0 FAIL**. Incluye pruebas con eventos sintéticos explícitos para separación de ámbitos, emparejamiento exacto, bloqueo de aprobación pendiente y conservación de QA-001/QA-002; esos eventos no son resultados de SEDA.

Evidencia real actual (ignorada por Git): `qa-output/hu6-contrato-propuesto/api.jsonl`, `execution.json`, `results.json` e `informe.md`. El Markdown y modelo fueron construidos con los eventos reales de esta ejecución exclusiva de HU-6; no se mezclaron resultados históricos de regresión. No se generó ni revisó un PDF en esta fase. El generador usa los mismos bloques para Markdown y PDF; la revisión visual de la matriz ampliada permanece pendiente.

El modelo identifica HU-6 y evita asignarle expectativas genéricas de archivos/universidades. El informe muestra original, propuesta, historial y validación pendiente del PO. Se compactaron referencias de la matriz, manteniendo nombres y detalle individual en anexos. La clasificación previa de HU-6 como «Otra» y la descripción incorrecta de HTTP 400 quedan corregidas.

No se ejecutaron las 51 pruebas, no se accedió a Supabase ni se leyó .env. No hay commits, push ni cambios de CI. Próximos pasos: validación del PO, navegador aislado (navegación, mensajes y tres segundos), revisión visual del PDF y después regresión completa bajo autorización.

## Ejecución histórica: contrato original

Con Node.js 22 seleccionado:

```sh
node --test --test-reporter=tap tests/api/hu6-auth.test.cjs
```

Resultado histórico del paso 13.18: **29 pruebas, 27 PASS, 2 FAIL, 0 BLOCKED, 0 NOT_RUN**. Código de salida 1. No se ejecutaron las 51 pruebas históricas ni se generó un nuevo PDF. El contenedor `describe` no cuenta como prueba adicional.

Evidencia resumida de terminal:

```text
# tests 29
# suites 1
# pass 27
# fail 2
# cancelled 0
# skipped 0
# todo 0
```

La primera ejecución dentro del sandbox obtuvo EACCES en 127.0.0.1 para los 28 casos HTTP; el caso unitario pasó. Es una limitación de infraestructura, no 28 defectos de producto. Se repitió el mismo archivo, sin modificar sus aserciones, con permiso para las conexiones locales de Supertest. La ejecución final anterior corresponde a esa repetición y no acumula ambas ejecuciones.

## Catálogo de casos

| ID HU6 | Comportamiento comprobado | Resultado |
|---|---|---|
| 01 | MINED ACTIVO, credenciales válidas, HTTP 200 y token exacto ficticio | PASS |
| 02 | Cuerpo vacío: 400, sin llamadas Auth | PASS |
| 03 | Falta contraseña: 400, sin llamadas Auth | PASS |
| 04 | Falta correo: 400, sin llamadas Auth | PASS |
| 05 | Correo en blanco: 400, sin llamadas Auth | PASS |
| 06 | Contraseña vacía: 400, sin llamadas Auth | PASS |
| 07 | Primer fallo: 401, quedan dos intentos | PASS |
| 08 | Segundo fallo: 401, queda un intento | PASS |
| 09 | Tercer fallo: 429 y mensaje de bloqueo | PASS |
| 10 | Rechazo inmediato y a 299999 ms sin consultar Auth; acceso a 300000 ms | PASS |
| 11 | Nuevo fallo tras cinco minutos reinicia el contador | PASS |
| 12 | Acceso exitoso reinicia la secuencia de fallos consecutivos | PASS |
| 13 | Correo inexistente: 401, sin token, mensaje literal CA3 | FAIL |
| 14 | Rol UNIVERSIDAD: 401, sin token, mensaje literal CA3 | FAIL |
| 15 | MINED INACTIVO: rechazo sin token | PASS |
| 16 | Inexistente y rol incorrecto reciben igual estado y cuerpo, sin detalles de cuenta | PASS |
| 17 / 18 / 19 / 20 | GET /panel: sin sesión / token inválido / rol incorrecto / inactivo | 4 PASS |
| 21 / 22 / 23 / 24 | GET /casos/1: sin sesión / token inválido / rol incorrecto / inactivo | 4 PASS |
| 25 / 26 / 27 / 28 | PATCH /casos/1/revision: sin sesión / token inválido / rol incorrecto / inactivo | 4 PASS |
| 29 | Middleware real permite MINED ACTIVO y propaga identidad al siguiente handler | PASS |

Las verificaciones de rutas de casos cubren exclusivamente autorización HU-6-RN4; no evalúan consulta, aceptación ni advertencias de HU-8/HU-9. `/casos` es el montaje del router: las rutas existentes requieren un identificador. Los códigos y mensajes para entradas incompletas documentan el contrato existente, sin atribuirlos a una redacción literal de CA1–CA3.

## Hallazgo: mensaje de CA3 diferente del requisito literal

Dos casos (HU6-13 y HU6-14) fallan por una misma discrepancia verificada en `controllers/auth.controller.js:105`; las ramas de rechazo de líneas 58 y 73 llaman al mismo `registrarFallo`.

- Esperado según CA3: `Correo o contraseña incorrectos`.
- Obtenido: `Correo o contraseña incorrectos. Te quedan 2 intentos`.
- HTTP 401 y ausencia de token sí se verificaron antes de la aserción fallida.
- Causa confirmada: `registrarFallo` agrega el contador sin distinguir estos escenarios.
- Impacto confirmado: incumplimiento textual del criterio. No se demostró revelación de cuentas: el caso 16 confirma igualdad de respuestas en los dos escenarios comparados. No es una auditoría de diferencias temporales ni de todos los estados posibles.
- Prioridad sugerida: media, pendiente de revisión con el Product Owner.
- Recomendación: aclarar con el PO la diferencia ya documentada entre CA3 y la tarea que pide contador en todos los rechazos. Hasta una decisión explícita, conservar CA3 y estos FAIL. El desarrollador debe revisar el contrato de errores sin introducir respuestas que permitan enumerar cuentas. Repetir 07–16 tras cualquier corrección.

## Cobertura de criterios

| Criterio | Evidencia disponible | Pendiente |
|---|---|---|
| CA1 | Parcial: login y token correctos con servicios ficticios | Navegación real al panel en máximo 3 segundos |
| CA2 | Parcial: API, tres fallos, bloqueo de cinco minutos y límites temporales comprobados | Presentación de mensajes y reintento en navegador |
| CA3 | Parcial y no conforme: rechazos y ausencia de token correctos; dos mensajes FAIL | Decisión sobre redacción y presentación en navegador |

Ningún criterio completo ni HU-6 se declara PASS. RN1/RN2 cuentan con evidencia de servidor; RN3 solo con la comparación indicada; RN4 tiene evidencia HTTP pero falta redirección del navegador; RN5 (administración de cuentas y ausencia de registro público MINED) no fue verificada exhaustivamente.

La página utilizada es `public/index.html`, que carga `public/js/login.js`. El código guarda el token en sessionStorage y asigna `/mined.html` a location, según lectura estática. No se ejecutó un navegador: el tiempo de Supertest no acredita el límite de tres segundos ni la presentación visual. Tampoco se verifica Supabase real.

## Aislamiento y determinismo

El helper existente se importa antes de SEDA. Se comprueban la sustitución del cliente principal y de createClient, las dos fábricas simuladas y la ausencia del SDK real y dotenv en caché. Las defensas existentes bloquean fetch, transportes externos y lecturas .env. Cada caso comprueba que no hubo intentos bloqueados y que consumió todas las respuestas previstas. Las consultas verifican la tabla e identidad esperadas.

Solo se utilizan identidades example.test y un token ficticio. Supertest hace HTTP de loopback; no se efectuaron conexiones externas ni lecturas .env. La aplicación se captura con listen sustituido. Los casos se ejecutan secuencialmente; cada uno recibe un correo único y su propia cola de respuestas. Date.now se controla con mocks de node:test, restaurados automáticamente, para no esperar cinco minutos. El proceso finaliza normalmente y no comparte el Map de intentos con otros procesos.

## Integración anterior (histórico del paso 13.18)

El descubrimiento de `scripts/qa/run.cjs:15` recoge los archivos `tests/api/*.test.cjs`, por lo que una futura ejecución test:api/test:qa incluirá automáticamente este archivo. No se modificaron esos comandos ni se ejecutaron aquí. El reporter soporta eventos de node:test y el modelo excluye el contenedor de suite de los recuentos.

Limitación del informe actual: las heurísticas de `model.cjs` no conocen HU-6; por ejemplo, un nombre con «inexistente» puede recibir una descripción genérica incorrecta de HTTP 400. La categoría, agrupación de hallazgos y trazabilidad HU-6 deben adaptarse formalmente antes de usar el PDF como informe de aceptación del Sprint. No se modificó el generador ni la configuración de Sprint en esta fase.

Siguiente fase sugerida: revisar el hallazgo con el PO, incorporar resultados HU-6 al modelo/trazabilidad y autorizar pruebas reales de navegador con servicios aislados. Mantener separadas las futuras pruebas de HU-8/HU-9. No se hicieron commits, push ni cambios al workflow.
