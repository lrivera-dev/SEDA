const assert = require('node:assert/strict');
const path = require('node:path');
const { mock } = require('node:test');

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
        for (const metodo of ['select', 'eq', 'insert', 'update']) {
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
    auth: { admin: { createUser: datos => resolver('auth', datos) } },
    storage: { from: bucket => ({ upload: (...datos) => resolver('upload', { bucket, datos }) }) }
};
require.cache[rutaCliente] = { id: rutaCliente, filename: rutaCliente, loaded: true, exports: cliente };

// Defensa adicional: solo se permiten conexiones HTTP locales de Supertest.
const net = require('node:net');
const conectar = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    let opciones = args[0];
    if (Array.isArray(opciones)) opciones = opciones[0];
    const host = typeof opciones === 'object' ? opciones.host : args[1];
    assert.ok(['127.0.0.1', '::1', 'localhost'].includes(host), `Conexión externa bloqueada: ${host}`);
    return conectar.apply(this, args);
};
globalThis.fetch = async () => { throw new Error('fetch externo bloqueado durante QA'); };

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
    const escuchar = mock.method(express.application, 'listen', function () { app = this; });
    try { require('../../server'); } finally { escuchar.mock.restore(); }
    assert.ok(app, 'No se capturó la aplicación real');
    app.set('env', 'test');
    return app;
}
module.exports = { preparar, verificarConsumo, llamadas, respuesta, cargarApp };
