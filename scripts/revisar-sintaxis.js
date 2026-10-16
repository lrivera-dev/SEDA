// Revisa que todos los archivos .js del proyecto tengan sintaxis válida (node --check).
// Se ejecuta con "npm run lint" y también lo corre el CI en cada Pull Request.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ_PROYECTO = path.join(__dirname, '..');
const CARPETAS_IGNORADAS = new Set(['node_modules', '.git']);

function listarArchivosJs(carpeta) {
    const archivos = [];

    for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
        if (CARPETAS_IGNORADAS.has(entrada.name)) {
            continue;
        }

        const ruta = path.join(carpeta, entrada.name);

        if (entrada.isDirectory()) {
            archivos.push(...listarArchivosJs(ruta));
        } else if (entrada.name.endsWith('.js')) {
            archivos.push(ruta);
        }
    }

    return archivos;
}

const archivos = listarArchivosJs(RAIZ_PROYECTO);
const archivosConErrores = [];

for (const archivo of archivos) {
    const resultado = spawnSync(process.execPath, ['--check', archivo], { encoding: 'utf8' });

    if (resultado.status !== 0) {
        archivosConErrores.push({
            archivo: path.relative(RAIZ_PROYECTO, archivo),
            detalle: resultado.stderr.trim()
        });
    }
}

if (archivosConErrores.length > 0) {
    console.error(`Se encontraron errores de sintaxis en ${archivosConErrores.length} archivo(s):\n`);

    for (const { archivo, detalle } of archivosConErrores) {
        console.error(`✘ ${archivo}\n${detalle}\n`);
    }

    process.exit(1);
}

console.log(`✔ ${archivos.length} archivos JavaScript sin errores de sintaxis`);