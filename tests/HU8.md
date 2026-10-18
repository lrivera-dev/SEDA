# HU-8 — Reporte detallado

23 pruebas API ejecutan Express, middleware MINED, controlador y servicio documental reales contra las respuestas de Supabase simuladas de Hachi.

- CA1: datos completos, cuatro enlaces, vigencia solicitada de 3600 segundos, solo lectura, porcentaje pendiente, autorización y error de consulta.
- CA2: las 15 combinaciones de documentos ausentes, lista exacta y fallo de Storage sin exposición de rutas internas como campos de respuesta.
- CA3: UUID inválido y caso inexistente, HTTP 404 y mensaje exacto sin datos parciales.

Las URLs ficticias no se abren. Las pruebas demuestran que se solicita la vigencia correcta, no la expiración efectiva del servicio real. RN4 tiene una aclaración pendiente en la especificación; no se acredita ocultación del path dentro de URLs reales firmadas por Supabase.

Pendientes: navegador, mensaje visual «Documentos faltantes», navegación en cinco segundos, expiración real en un entorno autorizado, revisión por pares y PO. No son pruebas E2E y ningún criterio se declara completamente aprobado.
