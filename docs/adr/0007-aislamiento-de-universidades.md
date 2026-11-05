# ADR 0007: Derivar la identidad de la universidad de la sesión autenticada

## Contexto

Las operaciones de una universidad deben limitarse a sus propios datos. Un identificador de universidad enviado desde el navegador no demuestra que el usuario tenga permiso para acceder a esa institución. La HU-10 requiere que la identidad y el acceso se basen en una sesión validada.

El ADR 0002 documenta la protección de las rutas de MINED, pero no detalla cómo se identifica y aísla a cada universidad.

## Decisión

Validamos el token de acceso con Supabase Auth y comprobamos en el servidor que la cuenta vinculada tenga rol UNIVERSIDAD y esté activa, y que su universidad también esté activa.

El backend obtiene `id_universidad` a partir del usuario autenticado y lo incorpora al contexto de la solicitud. Los controladores usan esa identidad para consultar o modificar datos. Un identificador enviado por el navegador no se considera prueba de propiedad ni autorización.

Esta decisión complementa el ADR 0002, que documenta el acceso de MINED.

## Consecuencias

- Las operaciones universitarias pueden limitarse a los registros de la universidad autenticada.
- Cambiar un identificador en el navegador no debe permitir acceder a datos de otra universidad.
- Las rutas privadas deben aplicar el middleware de autenticación y autorización correspondiente.
- Cada operación protegida depende de la validación de Supabase y de la consulta del estado y rol de la cuenta.
- Si una ruta sensible omite el middleware, no queda cubierta por esta decisión.

## Estado

Aceptada