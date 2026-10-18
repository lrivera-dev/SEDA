# Aislamiento de Supabase — Paso 13.8

## Alcance y orden de carga

Validado localmente el 15 de octubre de 2026 con Node.js 22.23.3 sobre Windows,
en la base `51a47a0d68d674e7e4c00e6d004678a7b424d405`, con cambios QA sin commit.
No se ejecutaron las 51 pruebas de regresión ni se validaron los criterios completos del Sprint.

El servidor importa universidades, archivos, equivalencias, panel, casos y autenticación.
Panel y casos cargan `validarMined`; casos también carga el servicio de documentos.
Se identificaron tres puntos de creación: `supabaseClient.js`,
`controllers/auth.controller.js` y `middlewares/validarMined.js`.

1. Cada archivo de prueba carga `helpers/entorno.cjs` antes de SEDA.
2. `helpers/seguridad.cjs` exige un proceso de node:test y rechaza una instalación
   tardía si SEDA o el SDK ya están cargados. Instala las defensas de red y archivos.
3. Se reemplazan las variables SUPABASE por valores ficticios, sin leer ni imprimir
   los valores heredados. El destino es `https://supabase.invalid`.
4. Se precarga el cliente principal en `require.cache`: no se evalúa su código ni dotenv.
5. `Module._load` intercepta `@supabase/supabase-js` y devuelve la fábrica simulada.
   No se evalúa el SDK real. Cada llamada devuelve un cliente ficticio; su URL y clave
   deben coincidir con los valores de prueba. Importar otros módulos @supabase o dotenv falla.
6. Solo entonces se importan los controladores, middleware o servidor reales.

## Contrato de servicios simulados

La cola de `preparar()` exige orden exacto, admite verificaciones de argumentos y
`verificarConsumo()` detecta respuestas sin utilizar. No hay fallback al SDK real.

| Operación en la cola | Métodos |
|---|---|
| `auth` | `auth.admin.createUser()` (contrato anterior conservado) |
| `signInWithPassword` | `auth.signInWithPassword()` |
| `getUser` | `auth.getUser()` |
| `consulta` | `from`, `select`, `eq`, `insert`, `update`, `order`; finaliza por `single`, `maybeSingle` o `await` |
| `upload` | `storage.from().upload()` |
| `createSignedUrl` | `storage.from().createSignedUrl()` |

Una operación sin respuesta programada lanza una aserción. Los métodos no implementados
no existen y fallan explícitamente. Las reglas, rutas, controladores y middleware no se simulan.

## Defensas y ciclo de vida

- Se bloquea todo fetch, WebSocket, TLS directo, HTTP2 y UDP.
- HTTP/HTTPS y TCP solo permiten destinos loopback explícitos para Supertest;
  sockets de archivos y destinos externos fallan antes de invocar el transporte original.
- Se interceptan las APIs habituales de lectura/apertura de archivos para rechazar
  `.env` y sus variantes antes de abrirlas. Las pruebas verifican este rechazo: no leen esos archivos.
- Los parches duran todo el proceso hijo de node:test. No se restauran dejando módulos
  SEDA vivos en caché. La finalización del proceso elimina mocks, variables y estado de login.
- No utilizar `--test-isolation=none`, concurrencia interna o importar este helper desde
  el servidor de desarrollo. Los helpers no son una barrera de seguridad para código hostil,
  módulos nativos, imports ESM arbitrarios o procesos secundarios creados por la aplicación.
  Un nuevo mecanismo de acceso exige revisar el aislamiento antes de cargarlo.

## Verificación por etapas

Con Node.js 22 activo:

```text
npm run test:isolation
npm run test:load
```

`test:load` vuelve a exigir el éxito del aislamiento antes de cargar la aplicación en
otro proceso. No ejecuta las suites unit/api. También se puede efectuar la secuencia explícita:

```text
node --test tests/isolation/supabase.test.cjs
node --test tests/isolation/carga.test.cjs
```

Solo ejecutar el segundo comando si el primero termina con código 0.

Resultado observado: 7 comprobaciones de aislamiento PASS y 1 comprobación de carga PASS,
0 FAIL. Se verificaron las respuestas ficticias a través del login y middleware reales,
consultas, actualización, Storage, rechazo de accesos y ausencia de recursos activos adicionales.
La carga capturó `listen`, comprobó seis routers y GET/PATCH de casos y login sin abrir puertos
ni enviar peticiones HTTP. No se cargó el SDK real, ni se contactó con Supabase.

Node.js 22.23.3 se obtuvo temporalmente de nodejs.org y se contrastó con su SHA-256 oficial;
esa descarga precedió a las comprobaciones, que se ejecutaron sin acceso externo.
Ubuntu aún no se ha validado. No se añadieron dependencias ni se cambió GitHub Actions.
Los anteriores 44 PASS y 7 FAIL siguen siendo evidencia histórica: hay que ejecutar las
51 pruebas en el siguiente paso autorizado para conocer los resultados del backend integrado.
