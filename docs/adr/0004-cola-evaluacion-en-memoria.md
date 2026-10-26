# ADR 0004: Evaluar las equivalencias con IA mediante una cola en memoria

## Contexto

En la HU-3 la universidad registra una equivalencia y el sistema calcula solo el porcentaje de coincidencia, sin que nadie escriba ni presione nada. El tiempo de cada cálculo no es predecible: con Gemini 3.5 Flash-Lite las pruebas tardaron entre 2.9 y 5.3 segundos, pero Gemini 3.8 Flash llegó a 36.8 segundos y devolvió errores 503 por alta demanda, y la historia fija 60 segundos como máximo antes de dar el cálculo por fallido. Además, cada llamada consume tokens de la cuota del modelo. Hoy no pagamos por ellos, pero esa cuota tiene límites, si enviamos muchas solicitudes a la vez, el servicio puede saturarse, devolver errores o responder más lento, así que no podíamos ejecutarlas sin orden ni sin límite.

Hacer esperar a la universidad dentro del registro tampoco era una opción, porque no podemos garantizar cuánto tardará la IA y un fallo suyo habría impedido registrar la equivalencia. Por otra parte, somos un equipo de cuatro personas con un sprint corto y un solo servidor Node.js, y no queríamos sumar infraestructura nueva solo para esta tarea.

## Decisión

Procesamos las evaluaciones en una cola dentro del propio servidor que atiende un caso a la vez. `registrarEquivalencias` encola el caso justo después de insertarlo y responde sin esperar el resultado; si encolar falla, el registro sigue funcionando. La base de datos guarda el estado de cada cálculo, ya sea en cálculo, calculado o con error, y un caso con error nunca conserva un porcentaje.

Limitamos el consumo de tokens con un tope diario de evaluaciones, 100 por defecto y configurable con `MAX_EVALUACIONES_DIARIAS`. Los reintentos manuales también cuentan, porque lo que queremos evitar es agotar la cuota o saturar el servicio. Al alcanzar el tope, los casos nuevos quedan sin calcular hasta el día siguiente.

La cola solo se activa cuando arranca el servidor, dentro de `if (require.main === module)` en `server.js`. Ahí mismo, los casos que un reinicio dejó a medias pasan a error con el aviso de que el cálculo se interrumpió. Así las pruebas y el CI nunca tocan la base de datos ni la IA.

Descartamos esperar el resultado dentro de la petición HTTP, y también una cola persistente con Redis, una tabla de tareas o un proceso aparte, porque el volumen esperado no justifica esa complejidad.

## Consecuencias

- No agregamos infraestructura y podemos probar la cola con servicios simulados.
- La universidad recibe su respuesta de registro de inmediato y ve el avance del cálculo en el checklist.
- Si el servidor se reinicia, los casos que esperaban turno en memoria se pierden de la cola y quedan sin calcular; la universidad debe usar **Reintentar**.
- Los casos que quedan sin calcular por el tope diario tampoco se retoman solos al día siguiente.
- El contador diario vive en memoria, por lo que un reinicio lo borra y puede permitir superar el tope ese día.
- La cola solo funciona bien con una instancia del servidor; con varias habría cálculos repetidos y contadores separados.
- Revisaremos esta decisión si crece el volumen de evaluaciones o si el despliegue pasa a varias instancias.

## Estado

Aceptada