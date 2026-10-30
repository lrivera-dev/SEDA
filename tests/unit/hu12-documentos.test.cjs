
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DIRECTORIO_HU12 = path.resolve(__dirname, "../../scripts/hu12");

const { simularCarga } = require(
    path.join(DIRECTORIO_HU12, "simular-carga.cjs")
);

const { verificarInventario } = require(
    path.join(DIRECTORIO_HU12, "verificar-inventario.cjs")
);

const { verificarIntegridad } = require(
    path.join(DIRECTORIO_HU12, "verificar-integridad.cjs")
);

test("HU-12: inventario academico consistente", () => {
    const resultado = verificarInventario();

    assert.equal(resultado.universidades, 2);
    assert.equal(resultado.carreras, 4);
    assert.equal(resultado.materias, 12);
    assert.equal(resultado.documentos, 16);
    assert.equal(resultado.errores.length, 0);
});

test("HU-12: metadatos de documentos consistentes", () => {
    verificarIntegridad();
});

test("HU-12: los 16 documentos aparecen en Storage exportado", () => {
    const resultado = simularCarga();

    assert.equal(resultado.existentes.length, 16);
    assert.equal(resultado.pendientes.length, 0);
});

test("HU-12: el simulador produce resultados repetibles", () => {
    const primera = simularCarga();
    const segunda = simularCarga();

    assert.deepEqual(primera, segunda);
});

test("HU-12: la simulacion no modifica los metadatos", () => {
    const rutaCSV = path.join(
        DIRECTORIO_HU12,
        "metadatos-storage.csv"
    );

    const antes = fs.readFileSync(rutaCSV);
    simularCarga();
    const despues = fs.readFileSync(rutaCSV);

    assert.deepEqual(despues, antes);
});
