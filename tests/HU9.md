# HU-9 — Revisión de equivalencias

20 pruebas API contra controladores reales y servicios simulados, sin persistencia externa.

- CA1: aceptación, identidad autenticada frente a un revisor enviado por el cliente, fecha controlada, estado y mensaje; rechazo de segunda revisión; actualización condicionada por PENDIENTE y conflicto concurrente; errores de lectura/escritura y caso inexistente; autorización.
- CA2: observación vacía, espacios, nueve caracteres, tipo incorrecto y diez caracteres válidos; normalización y persistencia de auditoría; caso ya revisado.
- CA3: decisiones ausentes, vacías, desconocidas o en minúsculas; rechazo de nombres heredados de Object.prototype como constructor, antes de cualquier persistencia.

La concurrencia se verifica simulando una actualización condicional sin filas; no constituye una prueba de carreras contra una base real. El reloj se restaura automáticamente al terminar cada caso.

Pendientes: navegador, actualización visual del panel, límite de tres segundos, persistencia en ambiente compartido autorizado, revisión por pares y PO. Todos los criterios mantienen cobertura parcial.
