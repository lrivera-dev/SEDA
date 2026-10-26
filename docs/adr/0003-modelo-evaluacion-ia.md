# ADR 0003: Usar Gemini 3.5 Flash-Lite temporalmente para evaluar equivalencias

## Contexto

Para la HU-3 necesitamos que un modelo compare los cuatro documentos de una equivalencia y devuelva un reporte en JSON en menos de 60 segundos.

Probamos Gemini 3.8 Flash y Gemini 3.5 Flash-Lite con los documentos de una misma equivalencia. Gemini 3.8 Flash generó un JSON válido en AI Studio en 36.8 segundos, pero dos solicitudes pequeñas desde la API devolvieron el error 503 por alta demanda. Gemini 3.5 Flash-Lite respondió correctamente desde la API y generó resultados válidos con los cuatro documentos en 2.9 segundos usando texto extraído y 5.3 segundos con PDFs adjuntos.

Los modelos asignaron porcentajes distintos a la misma equivalencia: 45 % con Gemini 3.8 Flash y 65 % con Gemini 3.5 Flash-Lite. Esa diferencia cruza el umbral de 60 % de coincidencia baja, por lo que necesitamos revisar la precisión de los resultados durante la integración.

## Decisión

Usaremos provisionalmente Gemini 3.5 Flash-Lite mediante la API de Gemini. Configuraremos `IA_MODELO=gemini-3.5-flash-lite` fuera del repositorio, en el `.env` local.

Esta decisión es temporal. Revisaremos el modelo después de validar la calidad y la disponibilidad del servicio en las pruebas integradas.

## Consecuencias

- Podemos continuar la integración con un modelo que respondió correctamente desde la API y completó las pruebas manuales dentro del límite de 60 segundos.
- Las pruebas de AI Studio en nivel gratuito no tuvieron costo dentro de sus límites. Sus estimaciones para uso pagado fueron aproximadamente $0.002875 por la prueba con texto extraído y $0.003449 por la prueba con PDF adjunto; esos valores pueden cambiar.
- Los porcentajes pueden variar entre modelos y afectar la advertencia de coincidencia baja. El resultado automático será una ayuda para el MINED, no una decisión oficial de equivalencia.
- Revisaremos que el reporte se base en los documentos y no incluya información inferida que no aparezca en ellos.
- Volveremos a evaluar esta decisión si Gemini 3.5 Flash-Lite no cumple la precisión o disponibilidad necesarias, o si cambian los límites y costos del proveedor.

## Estado

Provisional — pendiente de revisión después de las pruebas integradas.