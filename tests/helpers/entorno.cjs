const assert = require('node:assert/strict');
const path = require('node:path');
const { mock } = require('node:test');
const seguridad = require('./seguridad.cjs');

// Se registra antes de cargar cualquier controlador: nunca se evalúa supabaseClient.js.
const rutaCliente = path.resolve(__dirname, '../../supabaseClient.js');
let pasos = [];
const llamadas = [];
function resolver(operacion, argumentos) {
    llamadas.push({ operacion, argumentos });
    const paso = pasos.shift();
    assert.ok(paso, `Acceso simulado no previsto: ${operacion}`);
    assert.equal(operacion, paso.operacion);
    if (paso.verificar) paso.verificar(argumentos);
    return Promise.resolve(paso.resultado);
}
const cliente = {
    from(tabla) {
        const argumentos = { tabla };
        const consulta = {};
        for (const metodo of ['select', 'eq', 'insert', 'update', 'order']) {
            consulta[metodo] = (...valores) => {
                (argumentos[metodo] ||= []).push(valores);
                return consulta;
            };
        }
        consulta.maybeSingle = () => resolver('consulta', argumentos);
        consulta.single = () => resolver('consulta', argumentos);
        consulta.then = (ok, error) => resolver('consulta', argumentos).then(ok, error);
        return consulta;
    },
    rpc(nombre, parametros = {}) {
        return resolver('rpc', { nombre, parametros });
    },
    auth: {
        admin: {
            createUser: datos => resolver('auth', datos),

            // HU-11 CA4: simular la eliminación compensatoria
            // de una cuenta recién creada en Supabase Auth.
            deleteUser: idUsuario => resolver('deleteUser', { idUsuario })
        },
        signInWithPassword: datos => resolver('signInWithPassword', datos),
        getUser: token => resolver('getUser', { token })
    },
    storage: { from: bucket => ({
        upload: (...datos) => resolver('upload', { bucket, datos }),
        createSignedUrl: (...datos) => resolver('createSignedUrl', { bucket, datos })
    }) }
};
require.cache[rutaCliente] = { id: rutaCliente, filename: rutaCliente, loaded: true, exports: cliente };
const fabricaciones = [];
function createClient(url, key) {
    assert.equal(url, 'https://supabase.invalid');
    assert.equal(key, 'hachi-clave-ficticia');
    const nuevo = { ...cliente, auth: { ...cliente.auth } };
    fabricaciones.push(nuevo);
    return nuevo;
}
seguridad.instalarFabrica(createClient);

function preparar(nuevosPasos = []) {
    pasos = [...nuevosPasos];
    llamadas.length = 0;
}
function verificarConsumo() { assert.equal(pasos.length, 0, 'Quedan respuestas simuladas sin consumir'); }
function respuesta() {
    return { statusCode: 200, body: undefined,
        status(codigo) { this.statusCode = codigo; return this; },
        json(body) { this.body = body; return this; }
    };
}
function cargarApp() {
    const express = require('express');
    let app;
    const escuchar = mock.method(express.application, 'listen', function () {
        throw new Error('La importación de SEDA no debe abrir un servidor');
    });
    try { app = require('../../server'); } finally { escuchar.mock.restore(); }
    assert.equal(typeof app, 'function', 'server.js debe exportar la aplicación Express');
    assert.equal(typeof app.set, 'function');
    app.set('env', 'test');
    return app;
}
module.exports = { preparar, verificarConsumo, llamadas, respuesta, cargarApp, cliente, createClient, fabricaciones, seguridad };
