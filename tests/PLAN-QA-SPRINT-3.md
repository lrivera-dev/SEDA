# Plan QA — Sprint 3: HU-3 y HU-4

Planificación: 18/10/2026. Inicio: 19/10/2026, hora de El Salvador. Preparación local; publicación y activación en development pendientes de autorización del equipo.

Fuente autorizada: `Sprint_3_HU3_HU4_refinadas.md`. SHA-256: `76504ea31b550fbb738ae92d92af24c68074e0de8fa55eff05e265109a2ebdbe`. Los seis CA y quince RN se conservan literalmente en `qa/sprints/sprint-3.json`, junto con precondiciones, excepciones, tareas, dependencias y fuera de alcance. La estrategia y los siete criterios DoD se conservan desde Sprint 2.

## Alcance y seguridad

Estos identificadores PLAN representan escenarios documentales PROPUESTOS_NO_EJECUTADOS, no tests descubiertos ni resultados. Cada CA tiene plannedCase; testRefs y evidence vacíos, verification SIN_EVIDENCIA y coverageComplete false. No se programa IA ni checklist, no se modifican las 123 pruebas existentes y no se clasifican funcionalidades futuras como FAIL.

IA, persistencia, Auth y Storage serán simulados antes de importar código. Barreras contra .env y conexiones externas; relojes controlados para ventanas, timeout y límites. Una prueba con mock no demuestra calidad de IA real ni resistencia semántica a instrucciones maliciosas. Las tareas fuente de crear claves, probar proveedor real o migrar Supabase quedan exclusivamente a cargo del equipo con autorización separada; Hachi no las ejecuta.

## Catálogo de escenarios

41 escenarios planificados: 25 para HU-3 y 16 para HU-4. Las matrices de datos pueden producir varios tests en el futuro; no se inventa hoy su cantidad ejecutable.

### HU-3

#### PLAN-S3-HU-3-01 — Inicio automático después de HU-2

- Criterios/reglas: HU-3-CA1, HU-3-RN9.
- Tipo: API/integración.
- Datos ficticios: Caso PENDIENTE con 4 documentos legibles.
- Resultado esperado: Registrar sin acción adicional inicia cola y EN_CALCULO; al finalizar guarda porcentaje, reporte y CALCULADO.
- Dependencia técnica: HU-2 + tareas 2,3,5,6.
- Podrá ejecutarse: Tras integrar cola con IA y Storage simulados.
- Responsable por rol: QA automatización / backend.

#### PLAN-S3-HU-3-02 — Cuatro documentos obligatorios y roles

- Criterios/reglas: HU-3-CA1, HU-3-RN2.
- Tipo: Unitaria/integración.
- Datos ficticios: 4 documentos etiquetados y las 15 combinaciones incompletas.
- Resultado esperado: Recibe ambos programas y pensums; un faltante no produce porcentaje; no inventar HTTP no especificado.
- Dependencia técnica: Tareas 3,5,6.
- Podrá ejecutarse: Cuando exista preparación de documentos aislable.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-3-03 — PDF y Word legibles

- Criterios/reglas: HU-3-CA1, HU-3-RN8.
- Tipo: Unitaria.
- Datos ficticios: PDF y DOCX ficticios, 200+ caracteres, mezclas de formatos.
- Resultado esperado: Extracción legible o modalidad acordada en tarea 1; cálculo con cuatro documentos.
- Dependencia técnica: Lector de PDF/Word + tarea 1.
- Podrá ejecutarse: Tras confirmar formatos y disponer de lectores simulables.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-3-04 — Texto ilegible en cada documento

- Criterios/reglas: HU-3-CA3, HU-3-RN8.
- Tipo: Unitaria/integración.
- Datos ficticios: 0,199 y 200 caracteres por cada uno de los cuatro documentos; PDF imagen.
- Resultado esperado: Menos de 200: DOCUMENTO_ILEGIBLE, ERROR, sin porcentaje y mensaje E1 con documento; 200 no falla por esta regla.
- Dependencia técnica: Tareas 1,5,6.
- Podrá ejecutarse: Tras resolver modalidad texto/PDF directo.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-3-05 — Recorte de programas

- Criterios/reglas: HU-3-CA1, HU-3-RN8.
- Tipo: Unitaria.
- Datos ficticios: 14999,15000 y 15001 caracteres, distinto contenido final.
- Resultado esperado: Cada programa enviado tiene máximo 15000 caracteres; identificar recorte sin mezclar documentos.
- Dependencia técnica: Tarea 5.
- Podrá ejecutarse: Con función de preparación disponible.
- Responsable por rol: QA automatización.

#### PLAN-S3-HU-3-06 — Recorte de pensums

- Criterios/reglas: HU-3-CA1, HU-3-RN8.
- Tipo: Unitaria.
- Datos ficticios: 7999,8000 y 8001 caracteres.
- Resultado esperado: Cada pensum enviado tiene máximo 8000 caracteres.
- Dependencia técnica: Tarea 5.
- Podrá ejecutarse: Con función de preparación disponible.
- Responsable por rol: QA automatización.

#### PLAN-S3-HU-3-07 — Instrucciones fijas, sin entrada libre

- Criterios/reglas: HU-3-CA1, HU-3-RN1.
- Tipo: Unitaria + navegador.
- Datos ficticios: Documentos ficticios y payload con instrucciones adicionales.
- Resultado esperado: No hay chat/caja editable; servicio usa instrucciones fijas no controladas por navegador.
- Dependencia técnica: Tareas 3,8 y UI.
- Podrá ejecutarse: Tras integrar servicio/UI; proveedor real no necesario.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-3-08 — Programas comparados y pensums de contexto

- Criterios/reglas: HU-3-CA1, HU-3-RN2.
- Tipo: Unitaria/contrato.
- Datos ficticios: Programas con contenidos, objetivos, metodología, evaluación, horas y bibliografía; pensums etiquetados.
- Resultado esperado: Solicitud distingue dos programas de dos contextos; el mock no acredita calidad semántica real de IA.
- Dependencia técnica: Tareas 1,3.
- Podrá ejecutarse: Con constructor de solicitud; evaluación real solo por equipo autorizado.
- Responsable por rol: QA / responsable técnico IA.

#### PLAN-S3-HU-3-09 — Instrucciones maliciosas dentro de documentos

- Criterios/reglas: HU-3-CA1, HU-3-RN3.
- Tipo: Unitaria/contrato + revisión.
- Datos ficticios: Textos ficticios con órdenes de ignorar instrucciones y devolver 100.
- Resultado esperado: Documentos delimitados como datos, no como instrucciones; sin ejecutar órdenes; mock no prueba resistencia real del proveedor.
- Dependencia técnica: Tareas 1,3.
- Podrá ejecutarse: Con servicio aislado; validación semántica posterior autorizada.
- Responsable por rol: QA seguridad / responsable IA.

#### PLAN-S3-HU-3-10 — Porcentaje válido y fuera de rango

- Criterios/reglas: HU-3-CA1, HU-3-CA3, HU-3-RN9.
- Tipo: Unitaria/contrato.
- Datos ficticios: 0,59.99,60,79.99,80,100,-1,101,null y texto.
- Resultado esperado: Solo resultado válido 0–100; entradas inválidas no se guardan; aclarar rechazo frente a limitar antes de fijar aserción.
- Dependencia técnica: Tarea 3.
- Podrá ejecutarse: Tras aclarar tratamiento fuera de rango.
- Responsable por rol: QA / PO / backend.

#### PLAN-S3-HU-3-11 — JSON con seis secciones

- Criterios/reglas: HU-3-CA1, HU-3-CA3, HU-3-RN9.
- Tipo: Unitaria/contrato.
- Datos ficticios: Objeto con porcentaje,resumen,contenidos_coincidentes,metodologia,diferencias,contexto_pensum,conclusion; quitar cada clave.
- Resultado esperado: Completo: guardar justificacion_ia; incompleto/inválido: ERROR sin porcentaje, mensaje E2; tipos detallados por acordar.
- Dependencia técnica: Tareas 3,6.
- Podrá ejecutarse: Con validador de respuesta disponible.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-3-12 — Timeout y servicio no disponible

- Criterios/reglas: HU-3-CA3.
- Tipo: Unitaria/integración.
- Datos ficticios: Promesa simulada sin resolver, rechazo y reloj 59999/60000/60001 ms.
- Resultado esperado: Máximo 60 s, error identificable y mensaje E2; ERROR sin porcentaje; no esperar tiempo real.
- Dependencia técnica: Tareas 3,6.
- Podrá ejecutarse: Con reloj y proveedor sustituibles.
- Responsable por rol: QA automatización.

#### PLAN-S3-HU-3-13 — Límites de clasificación

- Criterios/reglas: HU-3-CA1, HU-3-CA2, HU-3-RN4.
- Tipo: Unitaria.
- Datos ficticios: 59.99,60,79.99,80 y null.
- Resultado esperado: BAJA,MEDIA,MEDIA,ALTA,SIN_CALCULAR respectivamente; aprobada solo desde 80; umbrales pendientes negocio.
- Dependencia técnica: Tarea 4.
- Podrá ejecutarse: Con clasificador puro; registrar pendiente PO.
- Responsable por rol: QA / PO.

#### PLAN-S3-HU-3-14 — Advertencia por coincidencia baja

- Criterios/reglas: HU-3-CA2, HU-3-RN4, HU-3-RN9.
- Tipo: API + navegador.
- Datos ficticios: Resultado 59.99 y 60.
- Resultado esperado: 59.99 guarda porcentaje/reporte y muestra exactamente advertencia A1; 60 no activa advertencia baja.
- Dependencia técnica: Tareas 4,6,8.
- Podrá ejecutarse: Tras integrar almacenamiento simulado y UI.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-3-15 — Transiciones de estados

- Criterios/reglas: HU-3-CA1, HU-3-CA3, HU-3-RN9.
- Tipo: Integración.
- Datos ficticios: SIN_CALCULAR, ejecución, éxito y error del proveedor.
- Resultado esperado: SIN_CALCULAR → EN_CALCULO → CALCULADO o ERROR; fecha y motivo según tareas; sin porcentajes ante error.
- Dependencia técnica: Tareas 2,6.
- Podrá ejecutarse: Con repositorio y reloj simulados.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-3-16 — Un procesamiento a la vez

- Criterios/reglas: HU-3-CA1, HU-3-RN6.
- Tipo: Unitaria/integración.
- Datos ficticios: Tres casos y promesas controladas.
- Resultado esperado: Máximo una evaluación activa; cola conserva orden definido por implementación; no inventar SLA de espera.
- Dependencia técnica: Tarea 6.
- Podrá ejecutarse: Con cola aislable; aclarar CA1 y espera.
- Responsable por rol: QA automatización.

#### PLAN-S3-HU-3-17 — Reintento desde ERROR y SIN_CALCULAR

- Criterios/reglas: HU-3-CA3, HU-3-RN5, HU-3-RN6.
- Tipo: API.
- Datos ficticios: Caso propio PENDIENTE en ambos estados.
- Resultado esperado: POST reintentar válido devuelve 202 y encola; posterior éxito guarda resultado.
- Dependencia técnica: Tareas 6,7.
- Podrá ejecutarse: Con router y servicios simulados.
- Responsable por rol: QA API.

#### PLAN-S3-HU-3-18 — Límite por conexión

- Criterios/reglas: HU-3-CA3, HU-3-RN6.
- Tipo: API + reloj controlado.
- Datos ficticios: Seis solicitudes válidas de una conexión, otra conexión y ventana siguiente.
- Resultado esperado: Máximo cinco/minuto; sexta 429 con E5; estudiar reinicio de ventana sin esperas reales.
- Dependencia técnica: Tarea 7.
- Podrá ejecutarse: Con contador/reloj aislados.
- Responsable por rol: QA API.

#### PLAN-S3-HU-3-19 — Propiedad del caso y validaciones de reintento

- Criterios/reglas: HU-3-CA3, HU-3-RN5, HU-3-RN6.
- Tipo: API/seguridad.
- Datos ficticios: Universidades A/B, sin id_universidad y caso inexistente.
- Resultado esperado: Ausencia 400, inexistente 404, ajeno 403; no encolar; id aportado no acredita autenticación.
- Dependencia técnica: Tarea 7.
- Podrá ejecutarse: Con autorización temporal inspeccionada y mocks.
- Responsable por rol: QA seguridad / backend.

#### PLAN-S3-HU-3-20 — Caso ya revisado por MINED

- Criterios/reglas: HU-3-CA3, HU-3-RN5.
- Tipo: API.
- Datos ficticios: Caso ACEPTADO o ADVERTENCIA.
- Resultado esperado: 409 con mensaje E4; porcentaje fijo y sin cola/escritura.
- Dependencia técnica: Tarea 7 + HU-9.
- Podrá ejecutarse: Tras integrar controlador.
- Responsable por rol: QA API.

#### PLAN-S3-HU-3-21 — Duplicados en cálculo o calculados

- Criterios/reglas: HU-3-CA1, HU-3-CA3, HU-3-RN6.
- Tipo: API/concurrencia.
- Datos ficticios: Caso CALCULADO o EN_CALCULO, solicitudes simultáneas.
- Resultado esperado: 409 según tarea 7; no iniciar doble evaluación; aclarar alcance RN5 sobre reintentar PENDIENTE.
- Dependencia técnica: Tareas 6,7.
- Podrá ejecutarse: Con cola y endpoint disponibles.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-3-22 — Reinicio durante el cálculo

- Criterios/reglas: HU-3-CA3, HU-3-RN9.
- Tipo: Integración de ciclo de vida.
- Datos ficticios: Estado persistido EN_CALCULO y arranque simulado.
- Resultado esperado: Pasa a ERROR con E3; importar server no toca BD; identificar trabajos en memoria perdidos sin recuperación inventada.
- Dependencia técnica: Tareas 2,6.
- Podrá ejecutarse: Con arranque aislable, sin arrancar servidor real.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-3-23 — Tope diario y renovación

- Criterios/reglas: HU-3-CA1, HU-3-RN7.
- Tipo: Unitaria/integración.
- Datos ficticios: 99,100,101 evaluaciones; valor configurable 2; reloj siguiente día.
- Resultado esperado: Tope100 por defecto; nuevos casos SIN_CALCULAR al alcanzar límite; continuidad día siguiente según aclaración.
- Dependencia técnica: Tarea 6.
- Podrá ejecutarse: Con contador/reloj; aclarar zona horaria y persistencia.
- Responsable por rol: QA / backend / PO.

#### PLAN-S3-HU-3-24 — Errores sin guardar porcentaje

- Criterios/reglas: HU-3-CA3, HU-3-RN9.
- Tipo: Integración.
- Datos ficticios: Documento ilegible, timeout, JSON incompleto, error de servicio; caso con valor previo.
- Resultado esperado: ERROR y motivo; ningún porcentaje nuevo; aclarar limpieza de valor previo si reintento permitido.
- Dependencia técnica: Tareas 3,5,6.
- Podrá ejecutarse: Con spies de repositorio y respuestas negativas.
- Responsable por rol: QA automatización.

#### PLAN-S3-HU-3-25 — Error al encolar no rompe registro

- Criterios/reglas: HU-3-CA1.
- Tipo: API/integración.
- Datos ficticios: Registro válido y cola simulada que rechaza.
- Resultado esperado: HU-2 conserva registro exitoso aunque falle encolar, según tarea 6; evidencia del estado para investigar.
- Dependencia técnica: HU-2 + tarea 6.
- Podrá ejecutarse: Con integración del disparo automático.
- Responsable por rol: QA / backend.

### HU-4

#### PLAN-S3-HU-4-01 — GET checklist solo de universidad indicada

- Criterios/reglas: HU-4-CA1, HU-4-RN2.
- Tipo: API/seguridad.
- Datos ficticios: Casos ficticios con materia de origen A y B.
- Resultado esperado: GET /checklist devuelve solo casos de A con campos y resumen de tarea 1; sin fuga de B.
- Dependencia técnica: HU-4 tarea 1 + HU-3.
- Podrá ejecutarse: Con controlador aislado.
- Responsable por rol: QA seguridad / backend.

#### PLAN-S3-HU-4-02 — Todos calculados >=80

- Criterios/reglas: HU-4-CA1, HU-4-RN1, HU-4-RN4.
- Tipo: API + navegador.
- Datos ficticios: CALCULADO con80,85,100 y documentos completos.
- Resultado esperado: Todas APROBADA y marcadas; mensaje exacto Todas las materias están aprobadas.
- Dependencia técnica: HU-3 clasificador + HU-4 tareas 1,2.
- Podrá ejecutarse: Con API/UI integradas y servicios ficticios.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-4-03 — Calculados menores de80

- Criterios/reglas: HU-4-CA2, HU-4-RN1, HU-4-RN4.
- Tipo: API + navegador.
- Datos ficticios: CALCULADO con0,40,70,79.99.
- Resultado esperado: PENDIENTE_ANALISIS sin marcar y motivo visible, sin sustituir decisión MINED.
- Dependencia técnica: HU-3 clasificador + HU-4 tareas 1,2.
- Podrá ejecutarse: Con clasificador/UI.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-4-04 — Estados no calculados

- Criterios/reglas: HU-4-CA2, HU-4-RN1, HU-4-RN4.
- Tipo: API + navegador.
- Datos ficticios: SIN_CALCULAR,EN_CALCULO,ERROR incluso con porcentaje inconsistente.
- Resultado esperado: Pendiente sin marcar; estado y motivo; no aprobar por porcentaje sin CALCULADO.
- Dependencia técnica: HU-4 tareas 1,2.
- Podrá ejecutarse: Con fixtures simulados de estados.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-4-05 — Resumen mixto

- Criterios/reglas: HU-4-CA2, HU-4-RN1.
- Tipo: API + navegador.
- Datos ficticios: Dos aprobadas y tres pendientes completos.
- Resultado esperado: Mensaje exacto 2 aprobadas y 3 pendientes de análisis y conteos consistentes.
- Dependencia técnica: HU-4 tareas 1,2.
- Podrá ejecutarse: Con UI y API disponibles.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-4-06 — Selección y deselección manual

- Criterios/reglas: HU-4-CA2, HU-4-RN3, HU-4-RN4.
- Tipo: Navegador.
- Datos ficticios: Casos completos aprobados y pendientes.
- Resultado esperado: Ambos grupos pueden marcarse/desmarcarse; no altera estado de cálculo ni decisión MINED.
- Dependencia técnica: HU-4 tarea 2.
- Podrá ejecutarse: Con DOM y backend ficticios.
- Responsable por rol: QA navegador.

#### PLAN-S3-HU-4-07 — Selección no persistente

- Criterios/reglas: HU-4-CA2, HU-4-RN3.
- Tipo: Navegador/red simulada.
- Datos ficticios: Cambiar casillas y recargar/volver a pantalla.
- Resultado esperado: No guarda formalmente selección ni la conserva entre visitas; HU-5 fuera de alcance.
- Dependencia técnica: HU-4 tarea 2.
- Podrá ejecutarse: Con UI y captura de solicitudes.
- Responsable por rol: QA navegador.

#### PLAN-S3-HU-4-08 — Documentos faltantes

- Criterios/reglas: HU-4-CA3, HU-4-RN5.
- Tipo: API + navegador.
- Datos ficticios: Cada documento faltante y 15 combinaciones incompletas.
- Resultado esperado: Caso en datos_incompletos, no seleccionable; mensaje CA3 con lista exacta de faltantes.
- Dependencia técnica: HU-4 tareas 1,2 + HU-2.
- Podrá ejecutarse: Con detector de completitud disponible.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-4-09 — Universidad sin casos

- Criterios/reglas: HU-4-CA1.
- Tipo: API + navegador.
- Datos ficticios: A sin casos.
- Resultado esperado: API lista vacía; UI Aún no tienes equivalencias registradas; no declarar todas aprobadas por vacuidad.
- Dependencia técnica: HU-4 tareas 1,2; E2.
- Podrá ejecutarse: Con API/UI disponibles.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-4-10 — Identificador ausente

- Criterios/reglas: HU-4-CA1, HU-4-RN2.
- Tipo: API + navegador.
- Datos ficticios: Sin id_universidad.
- Resultado esperado: API400; UI pide identificar universidad según E3; mensaje exacto no fijado por fuente.
- Dependencia técnica: HU-4 tareas 1,2.
- Podrá ejecutarse: Con API/UI disponibles.
- Responsable por rol: QA / backend.

#### PLAN-S3-HU-4-11 — Actualización cada cinco segundos

- Criterios/reglas: HU-4-CA2, HU-4-RN6.
- Tipo: Navegador + reloj simulado.
- Datos ficticios: EN_CALCULO pasa a CALCULADO o ERROR; 4999/5000 ms.
- Resultado esperado: Consulta cada5s mientras haya EN_CALCULO, muestra transición y cesa sondeo al terminar.
- Dependencia técnica: HU-4 tarea 2.
- Podrá ejecutarse: Con temporizador controlado.
- Responsable por rol: QA navegador.

#### PLAN-S3-HU-4-12 — Presentación del reporte IA

- Criterios/reglas: HU-4-CA1, HU-4-CA2.
- Tipo: Navegador.
- Datos ficticios: JSON ficticio con seis secciones y porcentaje.
- Resultado esperado: Secciones desplegables, porcentaje/barra/estado; advertencia baja y motivo de error según HU-3 tarea8.
- Dependencia técnica: HU-3 tarea8 + HU-4 tarea2.
- Podrá ejecutarse: Con UI integrada.
- Responsable por rol: QA / frontend.

#### PLAN-S3-HU-4-13 — Textos seguros con textContent

- Criterios/reglas: HU-4-CA1, HU-4-CA2.
- Tipo: Navegador/seguridad + revisión.
- Datos ficticios: Reporte y nombres con HTML, script y atributos maliciosos ficticios.
- Resultado esperado: Se muestran como texto, no ejecutan código; datos de IA no entran mediante innerHTML.
- Dependencia técnica: HU-3 tarea8 + HU-4 tarea2.
- Podrá ejecutarse: Con renderer real y DOM controlado.
- Responsable por rol: QA seguridad / frontend.

#### PLAN-S3-HU-4-14 — Visualización máximo cinco segundos

- Criterios/reglas: HU-4-CA1.
- Tipo: E2E/rendimiento.
- Datos ficticios: Universidad con todos los casos calculados >=80; reloj navegador.
- Resultado esperado: Checklist completo visible en <=5s; acordar carga, punto inicial y entorno de medición.
- Dependencia técnica: HU-4 tareas1,2,4.
- Podrá ejecutarse: Con navegador y flujo completo; no acreditable con solo API.
- Responsable por rol: QA E2E / PO.

#### PLAN-S3-HU-4-15 — Flujo HU-2 → HU-3 → HU-4

- Criterios/reglas: HU-4-CA1, HU-4-CA2, HU-4-CA3.
- Tipo: E2E.
- Datos ficticios: Cuatro documentos ficticios; IA simulada éxito85,advertencia40,error y reintento.
- Resultado esperado: Registro → En evaluación → Calculado/reporte/checklist; mensajes y selección; incompletos excluidos; no cierre sin evidencia.
- Dependencia técnica: HU-2 + HU-3 + HU-4 tarea4.
- Podrá ejecutarse: Tras integrar incremento completo en entorno aislado.
- Responsable por rol: QA E2E / equipo por pares.

#### PLAN-S3-HU-4-16 — Selección durante refresco

- Criterios/reglas: HU-4-CA2, HU-4-RN6.
- Tipo: Navegador.
- Datos ficticios: Selección manual mientras otro caso está EN_CALCULO.
- Resultado esperado: Registrar comportamiento y solicitar definición de conservación durante refresco; no inventar PASS o FAIL.
- Dependencia técnica: HU-4 tarea2; aclaración UX.
- Podrá ejecutarse: Tras acordar contrato de refresco.
- Responsable por rol: QA / frontend / PO.

## Riesgos y aclaraciones pendientes — no son defectos

- **S3-ACL-01** (SPRINT3 / HU-3 RN4; HU-4 RN1): Confirmar con negocio los umbrales 60 y 80; se planifican literalmente como referencia provisional, no se cambian.
- **S3-ACL-02** (SPRINT3 / HU-3 RN5; HU-4 RN1): Confirmar lenguaje de APROBADA en checklist: es preclasificación y nunca sustituye decisión final del MINED.
- **S3-ACL-03** (SPRINT3 / HU-3 precondiciones/tarea7; HU-4 RN2): id_universidad del navegador es temporal y manipulable; no es autenticación segura. Acordar controles de identidad/propiedad y riesgo aceptado sin inventar login fuera de alcance.
- **S3-ACL-04** (SPRINT3 / HU-3 CA1/RN6): ¿El máximo de 60 segundos incluye espera en cola o solo ejecución? Definir inicio/fin del SLA con una evaluación a la vez.
- **S3-ACL-05** (SPRINT3 / HU-3 E3/tarea6): Cola en memoria pierde trabajos pendientes al reiniciar. Acordar recuperación de SIN_CALCULAR y reconciliación de EN_CALCULO sin afirmar persistencia inexistente.
- **S3-ACL-06** (SPRINT3 / HU-3 tarea1/dependencias): Proveedor, formato texto o PDF directo, soporte de escaneados, tiempo y costo requieren validación técnica del equipo. Hachi no ejecutará esa tarea con servicios reales ni credenciales.
- **S3-ACL-07** (SPRINT3 / HU-3 RN7/tarea6): ¿Cómo persistir y coordinar límite diario tras reinicios o múltiples instancias? Acordar zona horaria, qué cuenta, reintentos y reanudación de casos al día siguiente.
- **S3-ACL-08** (SPRINT3 / HU-3 CA3/tarea3/tarea9): Aclarar rechazo de porcentaje fuera de rango frente a limitarlo a 0–100; definir tipos del JSON, claves vacías, valores no finitos y textos largos sin reinterpretar requisitos.
- **S3-ACL-09** (SPRINT3 / HU-3 RN5/tarea7/campos UI): RN5 permite reintento mientras PENDIENTE, pero tarea7 rechaza CALCULADO/EN_CALCULO y UI solo permite ERROR/SIN_CALCULAR. Confirmar elegibilidad y tratamiento de valores previos.
- **S3-ACL-10** (SPRINT3 / HU-4 CA1/RN6/tarea2): Acordar condiciones para medir 5 segundos, selección durante refresco y conteos de datos incompletos. No inventar umbrales de carga ni persistencia de selección.
- **S3-ACL-11** (ESTRATEGIA / DOD-7): La estrategia literal dice developer; la rama efectiva es development. Mantener texto original y confirmar equivalencia con el equipo.

## Criterios literales y casos principales

### HU-3-CA1

Al registrarse una equivalencia con sus 4 documentos legibles, el sistema inicia la evaluación sin que la universidad escriba ni presione nada, marca el caso como “En evaluación” y, en un máximo de 60 segundos por caso, guarda el porcentaje (de 0 a 100) y el reporte de la IA con sus seis secciones (resumen, contenidos coincidentes, metodología, diferencias, contexto del pensum y conclusión), visibles en el checklist.

Caso principal: `PLAN-HU-3-CA1`; escenarios: PLAN-S3-HU-3-01: Inicio automático después de HU-2, PLAN-S3-HU-3-02: Cuatro documentos obligatorios y roles, PLAN-S3-HU-3-03: PDF y Word legibles, PLAN-S3-HU-3-05: Recorte de programas, PLAN-S3-HU-3-06: Recorte de pensums, PLAN-S3-HU-3-07: Instrucciones fijas, sin entrada libre, PLAN-S3-HU-3-08: Programas comparados y pensums de contexto, PLAN-S3-HU-3-09: Instrucciones maliciosas dentro de documentos, PLAN-S3-HU-3-10: Porcentaje válido y fuera de rango, PLAN-S3-HU-3-11: JSON con seis secciones, PLAN-S3-HU-3-13: Límites de clasificación, PLAN-S3-HU-3-15: Transiciones de estados, PLAN-S3-HU-3-16: Un procesamiento a la vez, PLAN-S3-HU-3-21: Duplicados en cálculo o calculados, PLAN-S3-HU-3-23: Tope diario y renovación, PLAN-S3-HU-3-25: Error al encolar no rompe registro.

### HU-3-CA2

Si el porcentaje es menor a 60%, el sistema lo muestra junto con el reporte y la advertencia **“Coincidencia baja: se recomienda revisión manual”**, y el resultado queda guardado.

Caso principal: `PLAN-HU-3-CA2`; escenarios: PLAN-S3-HU-3-13: Límites de clasificación, PLAN-S3-HU-3-14: Advertencia por coincidencia baja.

### HU-3-CA3

Si no se puede evaluar (documento ilegible, IA sin respuesta en 60 segundos o resultado inválido), el sistema no guarda ningún porcentaje, marca el caso con error, muestra **“No se pudo calcular la coincidencia: [motivo]”** y permite reintentar.

Caso principal: `PLAN-HU-3-CA3`; escenarios: PLAN-S3-HU-3-04: Texto ilegible en cada documento, PLAN-S3-HU-3-10: Porcentaje válido y fuera de rango, PLAN-S3-HU-3-11: JSON con seis secciones, PLAN-S3-HU-3-12: Timeout y servicio no disponible, PLAN-S3-HU-3-15: Transiciones de estados, PLAN-S3-HU-3-17: Reintento desde ERROR y SIN_CALCULAR, PLAN-S3-HU-3-18: Límite por conexión, PLAN-S3-HU-3-19: Propiedad del caso y validaciones de reintento, PLAN-S3-HU-3-20: Caso ya revisado por MINED, PLAN-S3-HU-3-21: Duplicados en cálculo o calculados, PLAN-S3-HU-3-22: Reinicio durante el cálculo, PLAN-S3-HU-3-24: Errores sin guardar porcentaje.

### HU-4-CA1

Al abrir el checklist de una universidad cuyos casos están calculados y todos tienen 80% o más de coincidencia, el sistema lo muestra en un máximo de 5 segundos, con todas las materias marcadas como aprobadas y el mensaje **“Todas las materias están aprobadas”**.

Caso principal: `PLAN-HU-4-CA1`; escenarios: PLAN-S3-HU-4-01: GET checklist solo de universidad indicada, PLAN-S3-HU-4-02: Todos calculados >=80, PLAN-S3-HU-4-09: Universidad sin casos, PLAN-S3-HU-4-10: Identificador ausente, PLAN-S3-HU-4-12: Presentación del reporte IA, PLAN-S3-HU-4-13: Textos seguros con textContent, PLAN-S3-HU-4-14: Visualización máximo cinco segundos, PLAN-S3-HU-4-15: Flujo HU-2 → HU-3 → HU-4.

### HU-4-CA2

Si hay materias aprobadas y otras pendientes de análisis (menos de 80%, sin calcular, en evaluación o con error), el sistema muestra el resumen **“[N] aprobadas y [M] pendientes de análisis”**; las aprobadas aparecen marcadas, las pendientes sin marcar con su motivo, y la universidad puede marcar o desmarcar cada una.

Caso principal: `PLAN-HU-4-CA2`; escenarios: PLAN-S3-HU-4-03: Calculados menores de80, PLAN-S3-HU-4-04: Estados no calculados, PLAN-S3-HU-4-05: Resumen mixto, PLAN-S3-HU-4-06: Selección y deselección manual, PLAN-S3-HU-4-07: Selección no persistente, PLAN-S3-HU-4-11: Actualización cada cinco segundos, PLAN-S3-HU-4-12: Presentación del reporte IA, PLAN-S3-HU-4-13: Textos seguros con textContent, PLAN-S3-HU-4-15: Flujo HU-2 → HU-3 → HU-4, PLAN-S3-HU-4-16: Selección durante refresco.

### HU-4-CA3

Si algún caso no tiene sus 4 documentos, el sistema no lo incluye en la selección y muestra **“No se puede generar el checklist completo: faltan materias o datos necesarios: [lista]”**.

Caso principal: `PLAN-HU-4-CA3`; escenarios: PLAN-S3-HU-4-08: Documentos faltantes, PLAN-S3-HU-4-15: Flujo HU-2 → HU-3 → HU-4.

## Regresión y Definition of Done

Las referencias históricas se deduplican por suite, nombre exacto y archivo desde sprint-2.json (123). Se mantienen sus IDs reales de configuración; los IDs ordinales de ejecución pueden variar. Cada nueva ejecución calcula PASS/FAIL/BLOCKED/NOT_RUN desde eventos; no reutiliza cifras históricas como actuales. Ninguna de estas referencias se vincula como evidencia de HU-3/HU-4.

Los siete criterios DoD originales están intactos en JSON. Pruebas aplicables al nuevo alcance, pares, defectos críticos, PO, ambiente compartido e integración continúan pendientes. El esquema mantiene literalmente developer en DoD; aclarar su equivalencia con development. No se acredita el Sprint por pasar regresión.

## Preparación y activación

`qa/config.json`: activeSprint=sprint-3, weeklyEnabled=true SOLO en esta rama local. No publicar ni integrar hasta autorización del equipo. El workflow de main permanece intacto; cron existente 0 6 * * 6 (sábado 00:00 El Salvador). No hay ejecución remota ni activación por estos cambios locales.

Validación local con Node.js 24, comandos separados:

```powershell
npm run test:isolation
npm run test:team
npm run test:qa-generator
$env:QA_SPRINT = 'sprint-3'
npm run test:qa
Remove-Item Env:QA_SPRINT
```

Detener pruebas si falla aislamiento; no usar servicios reales ni .env. Comprobar seis CA/quince RN literales, 123 referencias coincidentes, reporte HU-3/HU-4 SIN_EVIDENCIA y PDF <=10 páginas. Conservar todos los resultados individuales en Markdown/JSON/JSONL bajo qa-output (ignorado).

Al llegar implementación real: inspeccionar dependencias y contratos, resolver preguntas, crear pruebas aisladas con nombres/suites/archivos reales, incorporar testRefs tras ejecución verificable y mantener coverageComplete false mientras falte navegador/aceptación. No activar tests que fallen solo por ausencia de funcionalidad futura.

## Validación de esta preparación — 19/10/2026

Base: `cb5a51b7ba091d959c6ee612ce447be33eda7160`, rama local `feature/hachi-sprint-3`, con configuración y plan sin commit. Node.js 24.21.0.

- Validador real de Hachi: esquema válido; 6 CA y 15 RN comparados literalmente con la fuente; 7 DoD intactos.
- Aislamiento: 10 PASS. Equipo: 35 PASS. Generador: 35 PASS. Todos los comandos finalizaron con código 0.
- `QA_SPRINT=sprint-3 npm run test:qa`: 123 PASS de regresión; 0 FAIL, BLOCKED y NOT_RUN. Las 123 referencias coincidieron por suite, nombre y archivo; cero casos sin mapear.
- HU-3/HU-4: cero casos ejecutables vinculados; seis criterios SIN_EVIDENCIA. DoD NO ACREDITADO. No son funcionalidades aprobadas.
- Ejecución nueva: `qa-output/2026-10-19T14-47-28-506Z-b986ad`. PDF de 4 páginas contado con pypdf y revisado visualmente; Markdown, results.json, execution.json y JSONL conservados localmente e ignorados por Git.
- Sin cambios en producción, pruebas existentes, generador ni workflows; sin servicios reales, lectura de .env, publicación o activación remota.
