# ADR 0002: Validar el acceso de MINED en el servidor

## Contexto

El panel permite consultar casos y el reporte permite tomar decisiones sobre ellos. El sistema debe permitir esas operaciones solo a usuarios autenticados con rol MINED y estado ACTIVO; una selección de perfil en el navegador no comprueba la identidad ni impide que alguien llame directamente a la API.

## Decisión

Validamos el token Bearer y comprobamos en el servidor el rol y el estado del usuario antes de permitir una operación protegida. Descartamos confiar únicamente en la selección de perfil o en validaciones ejecutadas en el navegador.

## Consecuencias

- Aplicamos la misma comprobación de acceso en las rutas que usan el middleware.
- Podemos rechazar una sesión inválida, una cuenta inactiva o un usuario que no pertenece a MINED.
- Cada solicitud protegida depende de Supabase Auth y de una consulta a la tabla `usuario`, lo que agrega latencia y dependencia del servicio.
- El navegador debe conservar y enviar el token; actualmente usamos `sessionStorage`, donde podría leerlo un script malicioso ejecutado en la página.
- Si olvidamos aplicar el middleware a una ruta sensible, esa ruta no tendrá esta protección.

## Estado

Aceptada