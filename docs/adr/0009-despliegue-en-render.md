# ADR 0009: Desplegar SEDA en Render

- **Estado:** Aceptada
- **Fecha:** 5 de octubre de 2026

## Contexto

SEDA utiliza una aplicación Node.js con Express. El servidor sirve la interfaz ubicada en `public/`, expone las rutas de la API y ejecuta una cola de evaluaciones de IA cuyo estado se mantiene actualmente en memoria, según lo documentado en el ADR 0004.

La aplicación recibe documentos PDF y DOCX mediante el backend, con un límite configurado de hasta 20 MB por archivo, y los almacena en Supabase Storage.

Necesitamos una plataforma que permita desplegar el servidor actual con pocos cambios y que sea compatible con el flujo de carga de documentos y evaluación de equivalencias.

## Decisión

Desplegaremos SEDA en Render como un servicio web de Node.js.

## Alternativas consideradas

### Render

Render permite ejecutar la aplicación Express como un servicio web. Esto se ajusta al modelo actual de SEDA: un proceso que sirve la interfaz, atiende las rutas de la API y mantiene activa la cola de evaluaciones mientras el servicio está en ejecución.

### Vercel

Vercel admite aplicaciones Express, pero las ejecuta como una Function. En ese entorno, `express.static()` no sirve los archivos de la carpeta `public/` y las solicitudes a una Function tienen un límite de carga de 4.5 MB. El flujo actual de SEDA permite archivos de hasta 20 MB y los envía al backend, por lo que sería necesario adaptar la publicación de archivos y la carga de documentos.

Vercel podría considerarse en el futuro si SEDA cambia la carga para enviar los archivos directamente a Supabase Storage y reemplaza la cola en memoria por un mecanismo de trabajo persistente.

## Consecuencias

### Positivas

- Podemos desplegar el servidor Express existente con pocos cambios.
- La interfaz y la API pueden mantenerse en la misma aplicación.
- El límite actual de carga configurado por SEDA no queda sujeto al límite de 4.5 MB de las Functions de Vercel.
- La cola de evaluaciones puede ejecutarse en el proceso web actual.

### Negativas y consideraciones

- En el plan gratuito, el servicio puede dormir después de un periodo sin tráfico y tardar en responder cuando vuelve a recibir una solicitud.
- La cola está en memoria: los trabajos pendientes pueden perderse si el servicio se reinicia o se detiene.
- El plan gratuito no debe considerarse una configuración de producción para un servicio que requiera disponibilidad continua.