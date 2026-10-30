
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DIRECTORIO = __dirname;

const inventario = JSON.parse(
    fs.readFileSync(
        path.join(DIRECTORIO, "inventario.json"),
        "utf8"
    )
);

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
        } else if (caracter === "\n" || caracter === "\r") {
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

function simularCarga() {
    const rutaCSV = path.join(
        DIRECTORIO,
        "metadatos-storage.csv"
    );

    const registros = leerCSV(
        fs.readFileSync(rutaCSV, "utf8").replace(/^\uFEFF/, "")
    );

    const rutasExistentes = new Set(
        registros.map(registro => registro.ruta_archivo)
    );

    const documentos = new Set();

    for (const registro of inventario) {
        documentos.add(registro.pensum_url);
        documentos.add(registro.programa_url);
    }

    const existentes = [];
    const pendientes = [];

    for (const ruta of documentos) {
        if (rutasExistentes.has(ruta)) {
            existentes.push(ruta);
        } else {
            pendientes.push(ruta);
        }
    }

    console.log("\nHU-12 - Simulacion de carga documental");
    console.log("------------------------------------");
    console.log("Documentos requeridos:", documentos.size);
    console.log("Documentos existentes:", existentes.length);
    console.log("Documentos pendientes:", pendientes.length);

    for (const ruta of pendientes) {
        console.log("PENDIENTE:", ruta);
    }

    console.log("\nModo: DRY-RUN");
    console.log("Archivos modificados: 0");
    console.log("Operaciones en Supabase: 0");

    if (pendientes.length === 0) {
        console.log("\nPASS: No se requieren cargas adicionales.");
    } else {
        console.log("\nAVISO: Hay documentos pendientes de carga.");
    }

    return { existentes, pendientes };
}

if (require.main === module) {
    try {
        simularCarga();
    } catch (error) {
        console.error("\nFAIL:", error.message);
        process.exitCode = 1;
    }
}

module.exports = { simularCarga };
