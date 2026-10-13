# Estándar de código asistido por IA — SEDA

**Estado:** propuesta basada en el código y configuración visibles en el repositorio (12 de octubre de 2026).  
**Propósito:** mantener un estilo único para el código nuevo y las modificaciones, minimizando cambios de nombres en el sistema existente.

## Criterio de adopción

El estándar recomienda seguir el patrón predominante en cada capa. No renombraremos código existente solo para que coincida con este documento. En cambios funcionales, la IA debe respetar el contrato público vigente (rutas, campos JSON, columnas de base de datos y selectores HTML) y solo corregir nombres incompatibles cuando el alcance incluya explícitamente esa migración.

## Convenciones observadas

| Área | Patrón encontrado | Ejemplos del proyecto |
|---|---|---|
| Lenguaje y estilo | JavaScript CommonJS; identificadores y mensajes en español | `require('./supabaseClient')`, `registrarUniversidad`, `mensaje` |
| Variables y funciones JS | `camelCase` | `materiaOrigen`, `errorSubida`, `subirArchivo`, `obtenerPanel` |
| Constantes | `UPPER_SNAKE_CASE` | `CAMPOS_OBLIGATORIOS`, `TIPOS_PERMITIDOS`, `MAX_MB`, `MIME_PDF` |
| Rutas/controladores/middlewares | nombres en español; archivos generalmente en minúsculas; controladores terminan en `.controller.js`, rutas en `.routes.js` | `universidades.routes.js`, `archivos.controller.js`, `validarArchivo.js` |
| Carpetas | minúsculas y descriptivas, normalmente plurales para colecciones | `routes/`, `controllers/`, `middlewares/`, `public/` |
| API | recursos en español, plural para colecciones, URL en kebab-case; acciones HTTP (`get`, `post`) | `POST /universidades`, `POST /equivalencias`, `GET /panel`, `POST /archivos` |
| Persistencia / payloads | `snake_case` en columnas y campos intercambiados con Supabase/API | `id_materia_origen`, `correo_contacto`, `fecha_registro` |
| HTML | etiquetas e IDs mayoritariamente en español; IDs compuestos usan tanto guion como guion bajo; clases usan guion, BEM o nombres simples | `form-registro`, `correo_contacto`, `mensaje--error`, `casos-container` |
| CSS | minúsculas; combinación de guiones, BEM (`mensaje--error`, `campo__error`) y nombres simples | `subir-equivalencia.css`, `.campo--invalido`, `.contenedor` |
| Git | rama actual `development`; plantilla de PR describe una “rama de función → development” y promoción `development → staging → main` | `.github/pull_request_template.md` |

No hay clases JavaScript en el código revisado. `package.json` se declara CommonJS. Las ramas visibles incluyen `development`; por ello, no se puede deducir el uso real o la forma exacta de nombrar ramas de trabajo solo con esta inspección.

## Estándar recomendado

1. **Idioma:** conservar español en nombres de dominio y lógica nueva. Usar términos en inglés únicamente cuando sean nombres establecidos por la plataforma o dependencia (`req`, `res`, `buffer`, `mimetype`, `fetch`). No traducir a medias un identificador dentro de una misma capa.
2. **JavaScript:** variables y funciones en `camelCase`; constantes globales o de configuración en `UPPER_SNAKE_CASE`. Usar nombres descriptivos: `materiaOrigen`, no `mo`; `errorBusqueda`, no `err` salvo callbacks cortos y claros.
3. **Clases:** si se introducen, usar `PascalCase` singular (`GestorArchivos`). No crear una clase para lógica que encaja naturalmente en las funciones y módulos actuales.
4. **Archivos y carpetas:** minúsculas y nombres en español con kebab-case cuando tengan varias palabras (`subir-equivalencia.js`). Mantener sufijos ya establecidos: `.routes.js` para rutas y `.controller.js` para controladores. Para nuevos módulos, mantener nombres coherentes con la capa (`validar-archivo.js` como middleware); no renombrar módulos existentes de forma aislada.
5. **API, base de datos y JSON:** mantener los nombres `snake_case` que ya exige el esquema/cuerpo, aunque el JavaScript use `camelCase`. Las URLs usan kebab-case y recursos en plural; las operaciones se expresan con el método HTTP, por ejemplo `POST /universidades`.
6. **HTML/CSS/DOM:** IDs y clases en español y minúsculas. Para nombres compuestos del DOM usar kebab-case (`total-casos`, `casos-pendientes`) y mantener exactamente el mismo valor en HTML, CSS y JavaScript. Usar BEM para componentes con estados o partes (`campo--invalido`, `campo__error`) y no mezclar convenciones dentro de una pantalla nueva.
7. **Git:** respetar el flujo documentado `rama de función → development → staging → main`. Propuesta para nombres de ramas nuevas: `feature/HU-XX-descripcion-corta`, `fix/HU-XX-descripcion-corta`, `hotfix/descripcion-corta`; usar minúsculas y guiones. Es una regla propuesta, no una convención comprobada en ramas existentes.
8. **Compatibilidad:** antes de cambiar un campo o selector, buscar todos sus usos. Los nombres de la base de datos, endpoints y campos JSON son contratos: cualquier cambio requiere actualizar productores y consumidores coordinadamente.
9. **Al trabajar con IA:** pedirle que lea este documento y los archivos vecinos antes de editar; limitar el cambio al alcance solicitado; imitar la convención de la capa; conservar contratos existentes; y reportar cualquier inconsistencia preexistente en vez de corregirla incidentalmente.

## Inconsistencias encontradas y prioridades

### P1 — Nombres DOM inconsistentes entre atributos y capas

La misma interfaz mezcla kebab-case, snake_case y camelCase. Por ejemplo, `public/registro.html` contiene `id="correo_contacto"`, mientras que `public/mined.html` usa `id="totalCasos"` y `id="casosPendientes"`; otras vistas usan `id="form-registro"` y `id="casosContainer"`. El JavaScript accede a esos IDs directamente (`getElementById`), así que cualquier normalización sin actualización coordinada rompe la interfaz.

**Regla para código nuevo:** kebab-case para IDs y clases DOM compuestos, conservando los nombres existentes hasta que se haga una migración de UI completa y verificada.

### P1 — Campos `snake_case` cruzan a JavaScript sin capa de traducción

`controllers/archivos.controller.js` desestructura `id_carrera` e `id_materia` directamente y construye nombres JS como `idColumna`; `controllers/equivalencias.controller.js` usa `id_materia_origen`, `id_materia_destino` e `id_universidad` tanto como nombres de campos como variables locales. Es válido al respetar API/esquema, pero no sigue el patrón camelCase del resto de las variables JS (`materiaOrigen`, `errorInsert`).

**Regla para código nuevo:** preservar las claves `snake_case` del payload/DB y, cuando ayude a la claridad, asignarlas a variables locales `camelCase` (`const { id_materia_origen: idMateriaOrigen } = req.body`). No cambiar las claves externas.

### P2 — Sufijos y granularidad de nombres de módulos no son totalmente uniformes

Los controladores y rutas usan sufijos consistentes (`*.controller.js`, `*.routes.js`), pero middlewares son `upload.js` y `validarArchivo.js`; el cliente combina `app.js`, `login.js` y nombres de página como `subir-archivos.js`. No causa por sí solo una falla, pero hace menos predecible encontrar un módulo.

**Regla para módulos nuevos:** mantener el sufijo de capa ya usado cuando exista; nombrar middleware por su propósito en kebab-case. No renombrar `upload.js` ni archivos actuales como tarea lateral.

### P2 — Flujo de ramas descrito, pero regla de nombres insuficiente

La plantilla de PR especifica promoción entre ambientes y habla de una rama de función, pero no define el formato de su nombre. Solo se confirmó localmente `development` como rama actual.

**Regla para ramas nuevas:** aplicar el patrón propuesto arriba y confirmar con el equipo si los prefijos `feature/`, `fix/` y `hotfix/` corresponden a su flujo antes de convertirlo en regla obligatoria.

### P3 — El idioma de identificadores de interfaz y datos mezcla términos

Los nombres de negocio están mayormente en español (`subirArchivo`, `universidades`), mientras algunos elementos de UI están en inglés (`form`, `status`, `loading`, `empty`, `logout`) y se usan nombres técnicos de Supabase o navegador. Es una mezcla localizada y no justifica traducir selectores o textos ya conectados.

**Regla para código nuevo:** usar español en elementos y lógica de negocio; conservar inglés cuando forme parte de una API, framework o término técnico ampliamente establecido. Evitar mezclar idiomas dentro de un mismo nombre nuevo.

## Checklist breve para una contribución asistida por IA

- [ ] Revisé nombres y convenciones de archivos vecinos de la misma capa.
- [ ] Usé camelCase para variables/funciones JS y UPPER_SNAKE_CASE para constantes.
- [ ] Conservé snake_case requerido por la API o la base de datos.
- [ ] Si añadí IDs o clases, mantuve el mismo nombre en HTML, CSS y JS.
- [ ] No renombré rutas, columnas ni campos existentes sin actualizar todos sus consumidores.
- [ ] Nombré el archivo según su responsabilidad y el sufijo usado por su capa.
- [ ] La rama sigue el flujo del equipo; si su nombre no está definido, confirmé el formato acordado.
- [ ] Informé inconsistencias preexistentes relevantes en lugar de ampliar el alcance silenciosamente.

## Alcance de esta revisión

La propuesta se basa en los archivos de aplicación, recursos HTML/CSS/JS, `package.json`, la plantilla de Pull Request, el workflow de GitHub y las ramas que Git expuso localmente. Se excluyeron dependencias instaladas (`node_modules`) y se conservaron sin cambios los archivos existentes. La rama observada fue `development`, alineada con el flujo indicado en la plantilla; este documento es nuevo.
