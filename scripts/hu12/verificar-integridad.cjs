
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const DIRECTORIO = __dirname;

const inventario = JSON.parse(
    fs.readFileSync(
        path.join(DIRECTORIO, "inventario.json"),
        "utf8"
    )
);

// Identifica las 16 rutas que pertenecen a HU-12.
const rutasEsperadas = new Set();

for (const registro of inventario) {
    rutasEsperadas.add(registro.pensum_url);
    rutasEsperadas.add(registro.programa_url);
}

// Parseador CSV que respeta comillas y comas internas.
function leerCSV(contenido) {
    const filas = [];
    let fila = [];
    let campo = "";
    let entreComillas = false;

    for (let i = 0; i < contenido.length; i++) {
        const caracter = contenido[i];

        if (caracter === '"') {
            if (entreComillas && contenido[i + 1] === '"') {
                campo += '"';
                i++;
            } else {
                entreComillas = !entreComillas;
            }
        } else if (caracter === "," && !entreComillas) {
            fila.push(campo);
            campo = "";
        } else if ((caracter === "\n" || caracter === "\r") &&
                   !entreComillas) {
            if (caracter === "\r" && contenido[i + 1] === "\n") {
                i++;
            }
            fila.push(campo);
            if (fila.some(valor => valor.trim())) {
                filas.push(fila);
            }
            fila = [];
            campo = "";
        } else {
            campo += caracter;
        }
    }

    if (campo || fila.length) {
        fila.push(campo);
        filas.push(fila);
    }

    const encabezados = filas.shift().map(x => x.trim());

    return filas.map(valores =>
        Object.fromEntries(
            encabezados.map((nombre, indice) => [
                nombre,
                valores[indice] || ""
            ])
        )
    );
}

function verificarIntegridad() {
    const rutaCSV = path.join(DIRECTORIO, "metadatos-storage.csv");

    const registros = leerCSV(
        fs.readFileSync(rutaCSV, "utf8").replace(/^\uFEFF/, "")
    );

    const encontrados = new Map();
    const errores = [];

    for (const registro of registros) {
        if (!rutasEsperadas.has(registro.ruta_archivo)) {
            continue;
        }

        if (encontrados.has(registro.ruta_archivo)) {
            errores.push(
                `Ruta duplicada: ${registro.ruta_archivo}`
            );
        }

        encontrados.set(registro.ruta_archivo, registro);
    }

    for (const ruta of rutasEsperadas) {
        const registro = encontrados.get(ruta);

        if (!registro) {
            errores.push(`Documento no encontrado: ${ruta}`);
            continue;
        }

        if (registro.tipo_archivo !== "application/pdf") {
            errores.push(`Formato incorrecto: ${ruta}`);
        }

        if (!Number.isSafeInteger(Number(registro.tamano_bytes)) ||
            Number(registro.tamano_bytes) <= 0) {
            errores.push(`Tamaño inválido: ${ruta}`);
        }

        if (!registro.etag) {
            errores.push(`ETag ausente: ${ruta}`);
        }

        if (!registro.id_objeto) {
            errores.push(`Identificador ausente: ${ruta}`);
        }
    }

    console.log("\nHU-12 - Verificacion de integridad");
    console.log("---------------------------------");
    console.log("Documentos esperados:", rutasEsperadas.size);
    console.log("Documentos encontrados:", encontrados.size);
    console.log("Inconsistencias:", errores.length);

    if (errores.length) {
        console.error(errores.join("\n"));
    }

    assert.equal(errores.length, 0, "Verificacion fallida");
    assert.equal(encontrados.size, 16);

    console.log("\nPASS: Metadatos de los 16 documentos consistentes.");
}

if (require.main === module) {
    try {
        verificarIntegridad();
    } catch (error) {
        console.error("\nFAIL:", error.message);
        process.exitCode = 1;
    }
}

module.exports = { verificarIntegridad };
