
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const { simularCarga } = require("./simular-carga.cjs");

const inventario = require("./inventario.json");

test("HU-12: el inventario contiene 16 documentos unicos", () => {
    const documentos = new Set();

    for (const registro of inventario) {
        documentos.add(registro.pensum_url);
        documentos.add(registro.programa_url);
    }

    assert.equal(documentos.size, 16);
});

test("HU-12: no existen documentos pendientes de carga", () => {
    const resultado = simularCarga();

    assert.equal(resultado.existentes.length, 16);
    assert.equal(resultado.pendientes.length, 0);
});

test("HU-12: ejecutar dos veces produce el mismo resultado", () => {
    const primera = simularCarga();
    const segunda = simularCarga();

    assert.deepEqual(primera, segunda);
});

test("HU-12: la simulacion no modifica el archivo CSV", () => {
    const ruta = require("node:path").join(
        __dirname,
        "metadatos-storage.csv"
    );

    const antes = fs.readFileSync(ruta);

    simularCarga();

    const despues = fs.readFileSync(ruta);

    assert.deepEqual(despues, antes);
});

test("HU-12: los documentos existentes no se consideran pendientes", () => {
    const resultado = simularCarga();

    const existentes = new Set(resultado.existentes);

    for (const ruta of resultado.pendientes) {
        assert.equal(existentes.has(ruta), false);
    }
});
