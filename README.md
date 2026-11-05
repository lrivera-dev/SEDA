# SEDA

SEDA es una plataforma web que organiza la preparación y revisión de propuestas de equivalencia entre materias de distintas universidades.

El proyecto busca reunir en un mismo espacio la información del estudiante, las materias que se comparan y los documentos académicos que respaldan cada propuesta. Así, la universidad puede preparar y enviar un caso, y el MINED puede revisarlo con la información y la evidencia disponibles.

## ¿Qué permite hacer?

### A las universidades

- Registrar y administrar sus carreras y materias.
- Asociar pénsums y programas académicos a sus registros.
- Crear propuestas de equivalencia manuales o con apoyo de IA.
- Incluir los datos del estudiante y los documentos necesarios.
- Revisar sus propuestas y enviarlas al MINED para evaluación.

### Al MINED

- Consultar las propuestas recibidas en un panel.
- Abrir el detalle de cada caso y revisar la información académica y sus documentos.
- Consultar la justificación de la universidad y el análisis de IA, cuando estén disponibles.
- Registrar una decisión, como aceptar la equivalencia o emitir una advertencia.

## Análisis con inteligencia artificial

SEDA puede comparar los programas académicos de las materias de origen y destino y generar un porcentaje de coincidencia junto con un reporte. Los pénsums sirven como contexto para el análisis.

En las propuestas manuales, la valoración y la justificación de la universidad se conservan separadas del resultado de IA. El reporte automatizado sirve como información complementaria para el MINED; no sustituye su revisión ni su decisión final.

## Acceso y manejo de información

La plataforma distingue las funciones de universidad y MINED mediante sesiones autenticadas. Las operaciones universitarias se asocian con la institución autenticada, y los documentos se relacionan con las carreras, materias y casos correspondientes.

## Tecnologías principales

- Node.js y Express para el servidor y la API.
- HTML, CSS y JavaScript para la interfaz web.
- Supabase para PostgreSQL, autenticación y almacenamiento de documentos.
- Gemini para el análisis de coincidencia con IA.
- Node.js Test Runner y Hachi para apoyar las pruebas automatizadas.

## Alcance del proyecto

SEDA proporciona herramientas para preparar y revisar propuestas de equivalencia. El análisis de IA facilita la comparación de documentos, pero la aprobación oficial corresponde al MINED.