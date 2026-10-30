
# HU-12: Datos de prueba para la validación final de SEDA

## 1. Objetivo

Documentar los datos académicos de prueba utilizados para verificar el registro, consulta y acceso a documentos de las universidades participantes en SEDA.

Esta documentación corresponde a la Tarea 4 de la HU-12 y sirve como referencia para la demostración final del sistema.

## 2. Universidades y carreras

| Universidad | Carrera | Materias | Documentos |
|---|---|---:|---:|
| UCA | Arquitectura | 3 | 4 |
| UCA | Ingeniería Informática | 3 | 4 |
| UDB | Ingeniería Industrial | 3 | 4 |
| UDB | Licenciatura en Administración de Empresas | 3 | 4 |
| **Total** | **4 carreras** | **12** | **16** |

Cada carrera dispone de un pénsum y tres programas de materias.

## 3. Materias y ciclos académicos

### Universidad Centroamericana José Simeón Cañas (UCA)

**Arquitectura**

| Materia | Ciclo |
|---|---|
| Taller espacial I | I |
| Tecnología en construcción I | III |
| Arquitectura bioclimática | V |

**Ingeniería Informática**

| Materia | Ciclo |
|---|---|
| Fundamentos de programación | I |
| Bases de datos | III |
| Ingeniería de software | VIII |

### Universidad Don Bosco (UDB)

**Ingeniería Industrial**

| Materia | Ciclo |
|---|---|
| Aplicaciones de Dibujo Industrial y Sistemas CAD | II |
| Gestión Ambiental | V |
| Diseño de Plantas Industriales | VIII |

**Licenciatura en Administración de Empresas**

| Materia | Ciclo |
|---|---|
| Tecnologías de Información y Comunicación | I |
| Análisis de Datos Empresariales | III |
| Transformación Digital en la Empresa | IX |

Las doce materias pertenecen a seis ciclos académicos distintos: I, II, III, V, VIII y IX.

Los ciclos se verificaron mediante los cuatro pénsums cargados para la HU-12. La tabla `materia` de PostgreSQL no almacena actualmente el ciclo académico.

## 4. Documentos académicos

Se registraron dieciséis documentos en el bucket `documentos-carreras` de Supabase Storage:

- 4 pénsums, uno por carrera.
- 12 programas de materias, uno por materia.

Las rutas completas y los identificadores de los documentos se encuentran en:

- `scripts/hu12/inventario.json`
- `scripts/hu12/metadatos-storage.csv`

En PostgreSQL, las referencias se almacenan en:

- `carrera.pensum_url`
- `materia.programa_url`

Los programas elaborados específicamente para las pruebas de SEDA están identificados como documentos ficticios. No deben presentarse como programas oficiales de las universidades.

## 5. Verificaciones realizadas

### Inventario académico

Comando:

`node scripts/hu12/verificar-inventario.cjs`

Resultados:

- Universidades: 2
- Carreras: 4
- Materias: 12
- Documentos únicos: 16
- Inconsistencias: 0
- Estado: PASS

### Integridad de metadatos

Comando:

`node scripts/hu12/verificar-integridad.cjs`

Resultados:

- Documentos esperados: 16
- Documentos encontrados: 16
- Inconsistencias: 0
- Estado: PASS

### Supabase Storage

Se realizó una consulta SQL de solo lectura sobre `storage.objects`, contrastando las rutas registradas en las tablas `carrera` y `materia`.

Resultados:

- Documentos asociados encontrados: 16
- Objetos identificados como PDF: 16

Esta comprobación demuestra la existencia de los objetos registrados, pero no verifica por sí sola la descarga de todos los archivos ni su integridad histórica.

## 6. Validación desde cuentas universitarias

### UCA

Se comprobó mediante la interfaz de SEDA:

- Visualización de Arquitectura e Ingeniería Informática.
- Visualización de las seis materias correspondientes.
- Asociación visible de cada materia con su carrera.
- Apertura del pénsum de Arquitectura.
- Apertura del programa de Arquitectura bioclimática.

### UDB

Se comprobó mediante la interfaz de SEDA:

- Visualización de Ingeniería Industrial y Licenciatura en Administración de Empresas.
- Visualización de las seis materias correspondientes.
- Asociación visible de cada materia con su carrera.
- Apertura del pénsum de Ingeniería Industrial.
- Apertura del programa de Análisis de Datos Empresariales.

En ambas sesiones, las listas mostraron únicamente las carreras y materias correspondientes a la universidad utilizada.

## 7. Pruebas automatizadas de seguridad

Archivo:

`tests/api/hu12-seguridad.test.cjs`

Comando:

`node --test tests/api/hu12-seguridad.test.cjs`

Resultados:

- 9 pruebas aprobadas.
- 0 pruebas fallidas.
- 0 pruebas omitidas.

Se verificaron escenarios simulados de:

- Acceso sin autenticación.
- Tokens inválidos.
- Acceso a documentos de otra universidad.
- Acceso autorizado a documentos propios.
- Usuarios inactivos.
- Roles incorrectos.
- Documentos inexistentes.

Las pruebas automatizadas utilizan simulaciones y no equivalen a una prueba de acceso indebido contra el servidor desplegado.

## 8. Uso durante la demostración final

1. Iniciar sesión con una cuenta de prueba de la UCA.
2. Consultar Arquitectura e Ingeniería Informática.
3. Mostrar sus seis materias y abrir documentos de ejemplo.
4. Cerrar sesión e iniciar sesión con una cuenta de prueba de la UDB.
5. Consultar Ingeniería Industrial y Administración de Empresas.
6. Mostrar sus seis materias y abrir documentos de ejemplo.
7. Confirmar que cada cuenta visualiza únicamente sus propios registros.
8. Utilizar los documentos de prueba para demostrar los flujos de equivalencias y revisión, cuando corresponda.

No se incluyen contraseñas, tokens ni credenciales en esta documentación.

## 9. Limitaciones

- Los ciclos académicos se documentaron a partir de los pénsums, no de un campo específico en PostgreSQL.
- La consulta de Storage verificó la existencia de dieciséis objetos PDF, pero no la descarga individual de todos ellos.
- La comprobación manual abrió documentos representativos de ambas universidades.
- El aislamiento fue verificado visualmente y mediante pruebas automatizadas simuladas; queda fuera de estas evidencias una prueba de autorización directa contra el despliegue real.
- No se dispone de una comparación histórica de hashes que demuestre que los archivos originales mantienen exactamente su contenido anterior.

## 10. Decisión arquitectónica relacionada

ADR-0006: `docs/adr/0006-carga-segura-documentos-hu12.md`

La decisión documenta las verificaciones, las medidas para evitar sobrescrituras y el manejo de fallos durante la carga documental.
