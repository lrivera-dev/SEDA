
# ADR 0006: Carga segura y reutilización de documentos académicos de prueba

## Contexto

Para validar y demostrar el funcionamiento de SEDA durante la HU-12, necesitamos disponer de dos universidades de prueba, cuatro carreras, doce materias de diferentes ciclos y dieciséis documentos académicos asociados: cuatro pensums y doce programas.

Los documentos se almacenan en Supabase Storage, en el bucket `documentos-carreras`, mientras que PostgreSQL registra las rutas mediante los campos `carrera.pensum_url` y `materia.programa_url`.

Como algunos documentos ya están almacenados y asociados, repetir una carga sin verificaciones podría generar duplicados, sobrescribir referencias existentes o dejar archivos sin asociación. También necesitamos conservar los documentos originales y controlar los fallos que puedan producirse durante las operaciones de Storage y PostgreSQL.

## Decisión

Decidimos implementar herramientas específicas para la carga y verificación documental de la HU-12, reutilizando la plataforma Supabase que ya utiliza SEDA.

El procedimiento adopta las siguientes decisiones:

- Mantener un inventario académico que identifica las universidades, carreras, materias y rutas de sus documentos.
- Verificar las referencias de PostgreSQL y la existencia de los archivos en Storage antes de considerar completa una carga.
- Omitir las operaciones de carga cuando el documento ya está correctamente registrado.
- Utilizar rutas independientes para las copias, sin modificar los archivos originales.
- Realizar las copias mediante descarga y subida con `upsert: false`, para evitar sobrescribir objetos existentes.
- Registrar las referencias mediante actualizaciones condicionales que solo permiten asociar documentos cuando el campo correspondiente está vacío.
- Detener las operaciones ante referencias diferentes o errores que impidan confirmar el estado de los documentos.
- Conservar para revisión manual las copias recién creadas cuando una asociación posterior falle, en lugar de eliminar archivos cuyo estado pueda ser incierto.
- Ejecutar las pruebas automatizadas con Hachi, utilizando simulaciones de Supabase sin conexiones reales.

La automatización distingue las operaciones de verificación de las operaciones de escritura. La ejecución directa del cargador permanece en modo de preparación, sin realizar cargas reales automáticamente.

## Consecuencias

- Reducimos el riesgo de duplicar documentos y modificar archivos originales durante la preparación de datos de prueba.
- Podemos comprobar las asociaciones entre universidades, carreras, materias y documentos antes de realizar nuevas operaciones.
- Las actualizaciones condicionales protegen las referencias existentes frente a reemplazos accidentales.
- La opción `upsert: false` permite rechazar intentos de subir archivos sobre rutas ocupadas.
- Las pruebas aisladas con Hachi permiten validar escenarios exitosos, errores de PostgreSQL, errores de Storage y operaciones concurrentes simuladas.
- El procedimiento incorpora verificaciones adicionales, aumentando la complejidad del cargador y el número de operaciones necesarias.
- Si una copia se realiza correctamente pero falla su asociación, puede quedar un archivo pendiente de revisión manual.
- Las verificaciones basadas en exportaciones de Storage representan el estado registrado al momento de la consulta y no sustituyen una comprobación en tiempo real.
- Las pruebas automatizadas realizadas hasta ahora utilizan simulaciones. No demuestran una carga real ni una ejecución exitosa en GitHub Actions.
- La integridad histórica de los documentos originales no se ha demostrado mediante una comparación con hashes anteriores a la HU-12. Por tanto, no se considera verificada esa condición.

## Estado

Propuesta
