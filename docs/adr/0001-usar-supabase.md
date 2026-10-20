# ADR 0001: Usar Supabase como plataforma backend del MVP

## Contexto

Al construir el MVP de SEDA, necesitábamos una base de datos para usuarios, universidades, carreras, materias y casos; autenticación para las cuentas; y almacenamiento para los PDF de pensums y programas. Teníamos tiempo limitado y desarrollar por nuestra cuenta el hash de contraseñas, la generación y verificación de tokens, la recuperación de contraseñas y otros controles de autenticación podía introducir errores difíciles de detectar y corregir.

La autenticación pesó más que las otras necesidades: preferimos delegar el manejo de credenciales y sesiones en un servicio mantenido. También necesitábamos guardar documentos sin construir un sistema de archivos propio ni añadir otro proveedor, y conservar las relaciones SQL que ya definimos entre nuestras entidades.

## Decisión

Elegimos Supabase para proporcionar PostgreSQL, Auth y Storage desde una misma plataforma, y accedemos a sus servicios desde nuestro backend Express. Descartamos implementar por nuestra cuenta la gestión de credenciales y tokens, y operar la base de datos y los archivos en servicios separados.

## Consecuencias

- Reducimos el código de seguridad que tenemos que diseñar y mantener para autenticar usuarios.
- Usamos PostgreSQL y sus relaciones para mantener la integridad entre usuarios, universidades, carreras, materias y casos.
- Guardamos los PDF en buckets sin construir un sistema de archivos propio ni integrar un servicio adicional como S3.
- Dependemos de la disponibilidad, los límites y las condiciones de Supabase para acceder a la base de datos, Auth y Storage.
- Si cambiamos de plataforma, tendremos que migrar cuentas, relaciones, documentos y código que usa las APIs de Supabase.
- La regla de SEDA que bloquea tras tres intentos durante cinco minutos sigue siendo código propio. La guardamos en memoria, por lo que un reinicio del servidor la borra y varias instancias no comparten el contador.

## Estado

Aceptada