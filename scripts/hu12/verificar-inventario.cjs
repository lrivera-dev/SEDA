
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const RUTA_INVENTARIO = path.join(__dirname, "inventario.json");

function verificarInventario() {
    const datos = JSON.parse(
        fs.readFileSync(RUTA_INVENTARIO, "utf8")
    );

    assert.ok(Array.isArray(datos), "El inventario debe ser un arreglo");

    const universidades = new Set();
    const carreras = new Map();
    const materias = new Set();
    const documentos = new Set();
    const errores = [];

    for (const registro of datos) {
        const {
            id_universidad,
            universidad,
            id_carrera,
            carrera,
            id_materia,
            materia,
            pensum_url,
            programa_url
        } = registro;

        if (!id_universidad || !universidad ||
            !id_carrera || !carrera ||
            !id_materia || !materia ||
            !pensum_url || !programa_url) {
            errores.push("Registro con campos obligatorios incompletos");
            continue;
        }

        universidades.add(id_universidad);

        if (carreras.has(id_carrera)) {
            const anterior = carreras.get(id_carrera);

            if (anterior.id_universidad !== id_universidad ||
                anterior.pensum_url !== pensum_url ||
                anterior.nombre !== carrera) {
                errores.push(`Carrera inconsistente: ${carrera}`);
            }
        } else {
            carreras.set(id_carrera, {
                id_universidad,
                nombre: carrera,
                pensum_url
            });
        }

        if (materias.has(id_materia)) {
            errores.push(`Materia duplicada: ${materia}`);
        }

        materias.add(id_materia);
        documentos.add(pensum_url);
        documentos.add(programa_url);

        if (!pensum_url.startsWith(`${id_carrera}/pensum/`)) {
            errores.push(`Ruta incorrecta del pensum: ${carrera}`);
        }

        if (!programa_url.startsWith(
            `${id_carrera}/materias/${id_materia}/`
        )) {
            errores.push(`Ruta incorrecta del programa: ${materia}`);
        }
    }

    
    const resultados = {
        universidades: universidades.size,
        carreras: carreras.size,
        materias: materias.size,
        documentos: documentos.size,
        errores
    };

    // Validaciones sin imprimir mensajes repetidos.
    assert.equal(universidades.size, 2, "Se requieren 2 universidades");
    assert.equal(carreras.size, 4, "Se requieren 4 carreras");
    assert.equal(materias.size, 12, "Se requieren 12 materias");
    assert.equal(documentos.size, 16, "Se requieren 16 documentos");
    assert.equal(errores.length, 0, errores.join("\n"));

    return resultados;
}

// Solo mostramos el resumen cuando ejecutamos este archivo directamente.
if (require.main === module) {
    try {
        const resultado = verificarInventario();

        console.log("\nHU-12 - Verificacion de inventario");
        console.log("--------------------------------");
        console.log("Universidades:", resultado.universidades);
        console.log("Carreras:", resultado.carreras);
        console.log("Materias:", resultado.materias);
        console.log("Documentos unicos:", resultado.documentos);
        console.log("Inconsistencias:", resultado.errores.length);
        console.log("\nPASS: Inventario academico consistente.");
    } catch (error) {
        console.error("\nFAIL:", error.message);
        process.exitCode = 1;
    }
}

module.exports = { verificarInventario };
