# ADR 0008: Mantener separados la propuesta manual y el análisis de IA

## Contexto

SEDA permite registrar equivalencias en modalidad automática o manual. En la modalidad manual, la universidad propone un porcentaje y aporta una justificación. El MINED también necesita consultar el análisis de IA para contrastar la propuesta con los documentos académicos.

Si ambos resultados se mezclaran, no quedaría claro quién asignó el porcentaje ni qué texto corresponde a la justificación de la universidad o al análisis automatizado. Además, la decisión final corresponde al MINED.

## Decisión

En las propuestas manuales conservamos por separado el porcentaje y la justificación ingresados por la universidad. El sistema puede generar de forma asíncrona un análisis complementario de IA a partir de los documentos del caso y mostrarlo al MINED cuando esté disponible.

El análisis de IA no reemplaza ni modifica la propuesta manual. Una propuesta manual no depende de que el cálculo de IA haya terminado para poder enviarse al MINED. En la modalidad automática, el porcentaje y el reporte de IA corresponden al análisis de la equivalencia.

La IA es una referencia para la revisión; el MINED conserva la decisión final.

## Consecuencias

- El MINED puede contrastar la valoración de la universidad con un análisis automatizado.
- La interfaz debe identificar claramente el origen de cada porcentaje y explicación.
- Un cálculo de IA pendiente o fallido no invalida la propuesta manual.
- Generar análisis para casos manuales consume cuota y puede generar costos según el proveedor y el plan utilizado.
- Las decisiones de aceptación o advertencia siguen siendo responsabilidad del MINED.

## Estado

Aceptada