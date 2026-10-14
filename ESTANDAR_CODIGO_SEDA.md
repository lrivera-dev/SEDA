# Manual de Estándar de Código y Flujo de Git — SEDA

**Repositorio:** `https://github.com/lrivera-dev/SEDA`  
**Equipo:** 4 integrantes  
**Stack:** Node.js (CommonJS) · Express · Supabase (PostgreSQL + Auth + Storage) · HTML5 / CSS3 / JS Vanilla

Este documento define las reglas técnicas del equipo para escribir código uniforme, hacer commits claros y fusionar cambios sin pisar el trabajo de los demás.

---

## 1. Estructura del Proyecto y Nombres de Archivos

Cada archivo debe ubicarse en su capa correspondiente. **Ningún archivo nuevo debe llevar espacios, mayúsculas ni tildes en su nombre.**

```text
SEDA/
├── .github/workflows/       # Pipeline de Integración Continua (ci.yml)
├── controllers/             # Lógica de cada endpoint (*.controller.js)
├── middlewares/             # Validaciones previas en kebab-case o camelCase (*.js)
├── routes/                  # Definición de rutas de Express (*.routes.js)
├── servicios/               # Lógica reutilizable / helpers en kebab-case (*.js)
├── public/                  # Frontend estático
│   ├── css/                 # Hojas de estilo por pantalla (*.css)
│   ├── js/                  # Scripts del navegador por pantalla (*.js)
│   └── *.html               # Vistas en kebab-case (ej. subir-equivalencia.html)
├── supabaseClient.js        # Cliente de conexión a Supabase
└── server.js                # Punto de entrada de la aplicación
```

| Tipo de archivo | Regla de nombre | ✅ Correcto | ❌ Incorrecto |
| :--- | :--- | :--- | :--- |
| **Controladores** | `recurso.controller.js` | `casos.controller.js` | `ControladorCasos.js`, `casos.js` |
| **Rutas** | `recurso.routes.js` | `casos.routes.js` | `rutas-casos.js`, `casosRoutes.js` |
| **Servicios** | `kebab-case.js` | `documentos-caso.js` | `Documentos caso.js` *(con espacio)* |
| **Vistas HTML / CSS / JS** | `kebab-case` | `subir-equivalencia.js` | `subirEquivalencia.js`, `subir_archivos.js` |

---

## 2. Estándar de Variables, Funciones y Datos

### 2.1 Reglas de Idioma
* **Español para todo el dominio del negocio:** nombres de variables, funciones, parámetros, rutas y mensajes al usuario van en español (`materiaOrigen`, `revisarCaso`, `documentosFaltantes`).
* **Inglés solo para términos nativos de la tecnología:** `req`, `res`, `next`, `buffer`, `mimetype`, `fetch`, `status`, `error`.
* **Prohibido mezclar idiomas en una misma variable:** usar `fechaRevision` (no `dateRevision`) y `obtenerPanel` (no `getPanel`).

### 2.2 Cómo nombrar cada elemento en JavaScript

| Elemento | Convención | Cómo debe escribirse | ✅ Ejemplo en SEDA | ❌ Evitar |
| :--- | :--- | :--- | :--- | :--- |
| **Variables comunes** | `camelCase` | Sustantivo claro y sin abreviar | `materiaOrigen`, `casoActual` | `mat_ori`, `mo`, `c`, `data1` |
| **Booleanos** | `camelCase` | Prefijo `es`, `tiene`, `esta`, `puede` | `esPdfValido`, `estaPendiente` | `pdfValido`, `flag`, `check` |
| **Arreglos / Listas** | `camelCase` | Sustantivo en **plural** | `casos`, `archivosFaltantes` | `lista`, `arrayCasos`, `caso` |
| **Funciones** | `camelCase` | **Verbo en infinitivo** + sustantivo | `registrarUniversidad()`, `revisarCaso()` | `universidad()`, `hacerRevision()` |
| **Constantes fijas** | `UPPER_SNAKE_CASE` | Mayúsculas separadas por `_` | `CAMPOS_OBLIGATORIOS`, `MAX_MB` | `camposObligatorios`, `max_mb` |
| **Columnas BD y JSON** | `snake_case` | Minúsculas separadas por `_` | `id_materia_origen`, `fecha_revision` | `idMateriaOrigen`, `FechaRevision` |
| **Estados en BD** | `UPPER_SNAKE_CASE` | Texto en mayúsculas exactas | `'PENDIENTE'`, `'ACEPTADO'`, `'ADVERTENCIA'` | `'pendiente'`, `'Aceptado'` |

### 2.3 Regla de traducción entre Base de Datos (`snake_case`) y JS (`camelCase`)
La base de datos en Supabase y los cuerpos JSON usan `snake_case`, pero nuestras variables internas en JavaScript usan `camelCase`. Al recibir datos de `req.body` o `req.params`, **desestructura y renombra en una sola línea**:

```javascript
// ❌ INCORRECTO: usar snake_case como variables locales o nombres de una letra
const id_caso = req.params.id_caso;
const d = req.body;
if (d.id_materia_origen === d.id_materia_destino) { ... }

// ✅ CORRECTO: mantener el contrato snake_case externo y usar camelCase adentro
const { id_caso: idCaso } = req.params;
const {
    id_materia_origen: idMateriaOrigen,
    id_materia_destino: idMateriaDestino,
    descripcion
} = req.body || {};

if (idMateriaOrigen === idMateriaDestino) { ... }
```

### 2.4 Estándar en HTML y CSS
* **IDs y Clases:** Usar siempre `kebab-case` en minúsculas (`id="casos-pendientes"`, `id="form-equivalencia"`).
* **Variantes de estado (BEM):** Usar doble guion `--` para estados (`mensaje--error`, `campo--invalido`) y doble guion bajo `__` para subelementos (`campo__error`, `confirmacion__icono`).
* **No romper selectores existentes:** Si un archivo ya usa `id="totalCasos"`, no cambiarlo a menos que en el mismo commit actualices el `.html`, el `.css` y el `.js`.

---

## 3. Estándar de Endpoints, Respuestas JSON y Validaciones

### 3.1 Estructura uniforme de respuestas JSON
Todas las respuestas de los controladores deben devolver siempre un objeto JSON con las mismas llaves para que el Frontend las procese igual:

* **Éxito (`200 OK` o `201 Created`):**
  ```json
  {
    "mensaje": "Equivalencia aceptada",
    "caso": { "id_caso": 12, "estado": "ACEPTADO" }
  }
  ```
* **Error (`400`, `401`, `403`, `404`, `409`, `500`):**
  ```json
  {
    "error": "Debe elegir una decisión: Aceptar o emitir advertencia"
  }
  ```
  *(Si faltan campos obligatorios, se permite añadir el arreglo `"campos": ["nombre", "correo"]` o `"archivos_faltantes": [...]`).*

### 3.2 Códigos de estado HTTP obligatorios en SEDA

| Código | Cuándo usarlo en el proyecto | Ejemplo real |
| :--- | :--- | :--- |
| **`200`** | Consulta exitosa o actualización (`GET`, `PATCH`) | Panel cargado o caso revisado (`Equivalencia aceptada`) |
| **`201`** | Creación exitosa de un registro (`POST`) | Universidad registrada, archivo subido o equivalencia creada |
| **`400`** | Datos faltantes, formato inválido o regla incumplida | Observación menor a 10 caracteres o archivo que no es PDF/Word |
| **`401`** | Sin sesión o token inválido/expirado | Petición sin header `Authorization: Bearer <token>` en `validarMined` |
| **`403`** | Autenticado pero sin permiso sobre el recurso | Universidad intentando registrar equivalencia con materia ajena |
| **`404`** | El recurso buscado por ID no existe en Supabase | `PATCH /casos/999/revision` cuando el caso `999` no existe |
| **`409`** | Conflicto con el estado actual o registro duplicado | Universidad con nombre repetido o caso que **ya fue revisado** |
| **`500`** | Error inesperado de Supabase o del servidor | Caída de conexión o fallo de escritura en base de datos |

### 3.3 Patrón de Retorno Temprano (*Early Return*)
En lugar de anidar múltiples bloques `if / else`, valida primero las condiciones de error y corta la ejecución con `return res.status(...).json(...)`:

```javascript
// ❌ INCORRECTO: if/else anidados difíciles de leer y un error común en res.status
if (decision) {
    if (casoActual) {
        if (casoActual.estado === 'PENDIENTE') {
            // lógica...
        } else {
            return res.json(409).json({ error: 'Ya revisado' }); // Bug: doble .json()
        }
    }
}

// ✅ CORRECTO: validaciones planas arriba y flujo principal al final
if (!decision || !DECISIONES_VALIDAS[decision]) {
    return res.status(400).json({ error: 'Debe elegir una decisión: Aceptar o emitir advertencia' });
}

if (!casoActual) {
    return res.status(404).json({ error: 'El caso indicado no existe.' });
}

if (casoActual.estado !== 'PENDIENTE') {
    return res.status(409).json({ error: 'Este caso ya fue revisado' });
}

// Lógica principal limpia y sin anidación...
```

---

## 4. Flujo de Ramas en Git (Equipo de 4 personas)

### 4.1 Reglas principales de convivencia
1. **Prohibido trabajar directo en `main`, `staging` o `development`.** Ningún integrante hace commits ni push directos a las ramas compartidas.
2. **Una rama = Una Historia de Usuario o tarea concreta.** No mezclar en una misma rama el arreglo del login con el endpoint de equivalencias.
3. **Ramas cortas (máximo 2 días):** Si una rama pasa más de 2 días sin integrarse, se desactualiza y genera conflictos graves para los otros 3 compañeros.
4. **Cada quien trabaja en su propia rama:** Nunca hacer push a la rama que está desarrollando otro compañero sin coordinarlo antes.

### 4.2 Mapa de ramas del repositorio

```text
main (Producción: versión estable lista para demostraciones y Feria)
 ↑ Pull Request al cerrar entrega
staging (Pre-producción: pruebas de sistema completas)
 ↑ Pull Request de versión
development (Integración diaria del equipo de 4 personas)
 ├── feature/hu-08-reporte-detallado
 ├── feature/hu-09-revision-equivalencia
 └── fix/hu-07-contador-pendientes-panel
```

### 4.3 Cómo nombrar las ramas

**Formato obligatorio:**
```text
prefijo/hu-xx-descripcion-corta
```
*(Si es una tarea técnica sin número de HU, usar `prefijo/descripcion-corta`).*

| Prefijo | Para qué sirve | ✅ Ejemplo Correcto | ❌ Ejemplo Incorrecto |
| :--- | :--- | :--- | :--- |
| **`feature/`** | Nueva historia de usuario o función | `feature/hu-09-revision-equivalencia` | `rama-luis`, `feature/HU09` |
| **`fix/`** | Corregir un error o defecto detectado | `fix/hu-07-filtro-estado-pendiente` | `arreglos`, `fix/bug` |
| **`hotfix/`** | Corrección urgente de algo roto en `main` | `hotfix/error-variables-entorno` | `urgente-main` |
| **`refactor/`** | Ordenar código sin cambiar cómo funciona | `refactor/renombrar-servicio-documentos` | `limpieza_codigo` |
| **`docs/`** | Crear o actualizar documentación | `docs/actualizar-estandar-equipo` | `documento-nuevo` |

**Reglas para el nombre:** solo minúsculas, separar palabras con guion medio (`-`), sin tildes, sin espacios y **jamás poner el nombre de la persona**.

---

## 5. Estándar de Commits (Título y Descripción)

Hacer commits pequeños por cada paso lógico completado (por ejemplo: un commit al terminar el controlador y otro al conectar el HTML/JS), en vez de un único commit gigante al final de la semana.

### 5.1 Estructura de un Commit

Todo commit debe tener un **título claro** (máximo 72 caracteres) y, cuando el cambio toca varios detalles o validaciones, una **descripción en viñetas**:

```text
tipo(HU-XX): verbo en infinitivo + qué se hizo

- Detalle 1 de lo que se agregó o validó.
- Detalle 2 de lo que se modificó.
```

**Cómo escribirlo en la terminal:**
```bash
git commit -m "feat(HU-09): implementar revisión de casos en PATCH /casos/:id_caso/revision" -m "- Protege el endpoint con el middleware validarMined.
- Valida decisión obligatoria (400) y observación mínima de 10 caracteres en advertencias (400).
- Verifica existencia del caso (404) y bloquea casos que no estén en estado PENDIENTE (409)."
```

### 5.2 Tabla de tipos de Commit

| Tipo | Cuándo utilizarlo | Ejemplo para SEDA |
| :--- | :--- | :--- |
| **`feat`** | Nueva funcionalidad (backend o frontend) | `feat(HU-09): agregar endpoint para aceptar o advertir equivalencia` |
| **`fix`** | Corrección de un error o validación fallida | `fix(HU-06): corregir comparación de estado PENDIENTE en mined.html` |
| **`refactor`** | Mejora de código sin alterar su resultado | `refactor(HU-08): separar generación de URLs firmadas en servicio` |
| **`style`** | Cambios visuales de CSS, diseño o indentación | `style(HU-05): ajustar colores de etiquetas de estado en panel MINED` |
| **`test`** | Creación o corrección de pruebas automáticas | `test(HU-09): agregar pruebas para rechazo de casos ya revisados` |
| **`docs`** | Cambios en archivos `.md` o guías del equipo | `docs: unificar estándar de código y guía de git en un solo manual` |
| **`chore`** | Configuración de paquetes, `.gitignore` o CI/CD | `chore(ci): configurar ejecución de pruebas en workflow de GitHub` |

> 🚫 **Commits estrictamente prohibidos:**  
> `"cambios"`, `"avance"`, `"subiendo archivos"`, `"arreglando error"`, `"test"`, `"ahora sí"`, `"final final"`.

---

## 6. Guía Paso a Paso: Push, Conflictos, Pull Request y Merge

### Paso 1: Antes de empezar a programar (Todos los días)
Nunca crees una rama sin antes descargar lo último que tus compañeros ya integraron:

```bash
# 1. Ir a la rama base de integración
git switch development

# 2. Descargar los últimos cambios del equipo
git pull origin development

# 3. Crear tu rama nueva a partir de la versión actualizada
git switch -c feature/hu-09-revision-equivalencia
```

### Paso 2: Guardar cambios y hacer Push seguro
Antes de hacer `git add`, **siempre ejecuta `git status`** para verificar que no estás subiendo archivos basura ni credenciales:

```bash
# 1. Revisar qué archivos se modificaron
git status

# 2. Agregar los archivos de tu tarea
git add controllers/casos.controller.js routes/casos.routes.js server.js

# 3. Crear el commit siguiendo el estándar
git commit -m "feat(HU-09): implementar endpoint de revisión de equivalencia"

# 4. Subir tu rama a GitHub (primera vez usa -u)
git push -u origin feature/hu-09-revision-equivalencia
```
*(En los siguientes commits dentro de la misma rama, basta con escribir `git push`).*

### Paso 3: ¿Qué hacer si un compañero hizo Merge mientras yo trabajaba?
Antes de abrir tu Pull Request, **es obligatorio traer los cambios recientes de la rama base a tu rama** para comprobar que tu código y el de tus compañeros funcionan juntos:

```bash
# 1. Traer la información más reciente de GitHub
git fetch origin

# 2. Actualizar tu rama development local
git switch development
git pull origin development

# 3. Volver a tu rama de trabajo y fusionar lo nuevo
git switch feature/hu-09-revision-equivalencia
git merge development
```
* **Si no hay conflictos:** haz `git push` y abre tu Pull Request.
* **Si aparecen conflictos (`CONFLICT`):**
  1. Abre los archivos marcados en VS Code y elige qué código conservar (sin borrar el trabajo de tu compañero).
  2. Corre `npm start` y verifica que la aplicación levante sin errores.
  3. Guarda la solución del conflicto:
     ```bash
     git add .
     git commit -m "chore(HU-09): resolver conflictos de integración con development"
     git push
     ```

### Paso 4: Crear el Pull Request (PR) y Revisión por Pares
Cuando tu código esté arriba y actualizado, entra a GitHub y crea el **Pull Request** usando siempre esta estructura (que carga automáticamente desde `.github/pull_request_template.md`):

```markdown
## Historia de usuario
HU-09: Revisión de equivalencia

## Qué se hizo
- Se creó `controllers/casos.controller.js` con la función `revisarCaso`.
- Se habilitó `PATCH /casos/:id_caso/revision` protegido con `validarMined`.
- Se validaron los códigos 400 (decisión/observación), 404 (inexistente) y 409 (ya revisado).

## Pruebas manuales realizadas
- [x] Prueba de componente (rama de función → development)
- [ ] Prueba de integración (ya integrado en development)
- [ ] Pruebas de sistema (development → staging y staging → main)

## Revisión
- [ ] Lo aprueba una persona distinta a quien desarrolló
```

#### ¿Qué debe revisar el compañero antes de aprobar el PR?
1. **Cumplimiento de la HU:** ¿Cumple todos los Criterios de Aceptación y Reglas de Negocio?
2. **Estándar de código:** ¿Usa `camelCase` en JS, `snake_case` en BD/JSON y nombres de archivos correctos?
3. **Seguridad:** ¿Están libres de llaves secretas, contraseñas o archivos `.env`?
4. **Alcance limpio:** ¿Modifica únicamente los archivos que corresponden a su tarea sin romper lo que ya funcionaba?
5. **Pipeline en verde (CI):** ¿Pasó con check verde (`✓`) el flujo automático de **GitHub Actions**?

### Paso 5: Merge y limpieza obligatoria de la rama
Una vez que **1 compañero aprueba el PR** y el **CI está en verde**, se hace clic en **Merge pull request**. Inmediatamente después, se elimina la rama para mantener limpio el repositorio:

```bash
# 1. Volver a la rama base y actualizarla
git switch development
git pull origin development

# 2. Borrar la rama ya usada en tu computadora (-d verifica que ya fue integrada)
git branch -d feature/hu-09-revision-equivalencia

# 3. Borrar la rama en GitHub (si no se borró con el botón del PR)
git push origin --delete feature/hu-09-revision-equivalencia
```

---

## 7. Reglas de Oro: CI/CD, Seguridad y Rollback

1. **La Regla del Build Verde (GitHub Actions):**
   * En cada Push o Pull Request, `.github/workflows/ci.yml` verifica que `.env` no esté en el repositorio, instala dependencias con `npm ci` y ejecuta las pruebas.
   * **Nadie hace merge si el pipeline está en rojo (`✕`).**
   * Si un cambio integrado rompe el build en `development` o `main`, **arreglarlo o revertirlo en menos de 10 minutos es la prioridad número uno** de quien lo subió. Nadie más integra código encima de un build roto.
2. **Cero Secretos en el Repositorio:**
   * `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_ANON_KEY` viven únicamente en el archivo `.env` local de cada integrante y en los *Secrets* de GitHub / servidor de despliegue.
   * Si alguien sube una clave por error, no basta con borrarla en otro commit: debe avisar de inmediato al equipo para rotar la clave en Supabase.
3. **Prohibido usar `git push --force` (`-f`):**
   * Sobrescribe el historial remoto y borra el trabajo de los demás.
4. **Cómo revertir rápido si algo falla en una demostración (Rollback):**
   * Si un merge recién hecho rompe la aplicación antes de una entrega, se revierte desde GitHub con el botón **Revert** del Pull Request o por consola sin borrar el historial:
     ```bash
     git revert -m 1 <hash-del-commit-de-merge>
     git push
     ```

---

## 8. Resumen de Comandos Rápidos para el Día a Día

| Acción | Comando exacto |
| :--- | :--- |
| Ver en qué rama estoy y qué modifiqué | `git status` |
| Cambiar a `development` y actualizar | `git switch development && git pull origin development` |
| Crear mi rama para una historia | `git switch -c feature/hu-XX-nombre-corto` |
| Guardar mis cambios en un commit | `git add <archivos>` y `git commit -m "feat(HU-XX): descripción"` |
| Subir mi rama por primera vez | `git push -u origin feature/hu-XX-nombre-corto` |
| Traer cambios de `development` a mi rama | `git fetch origin && git merge origin/development` |
| Borrar mi rama local tras el merge | `git switch development && git branch -d feature/hu-XX-nombre-corto` |

---

## 9. Checklist de "Terminado" (Definition of Done) antes de pedir PR

Antes de avisar en el grupo que tu Pull Request está listo para revisión, verifica:

- [ ] **Nombres:** Variables y funciones en `camelCase`, constantes en `UPPER_SNAKE_CASE`, archivos en `kebab-case` sin espacios.
- [ ] **Contratos:** Columnas de Supabase y respuestas JSON en `snake_case`; estados en mayúsculas (`'PENDIENTE'`, `'ACEPTADO'`, `'ADVERTENCIA'`).
- [ ] **Pruebas:** Probé manualmente el flujo principal y las excepciones (`400`, `401`, `404`, `409`) y el servidor levanta sin errores con `npm start`.
- [ ] **Seguridad:** Verifiqué con `git status` que no subí `.env`, `node_modules` ni archivos de prueba temporales.
- [ ] **Git:** Mis commits siguen el formato `tipo(HU-XX): descripción` y sincronicé mi rama contra `development`