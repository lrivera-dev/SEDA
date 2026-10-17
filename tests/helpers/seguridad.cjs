// Solo para procesos de node:test. No restaurar defensas mientras SEDA siga en caché.
const assert = require('node:assert/strict');
assert.ok(process.env.NODE_TEST_CONTEXT, 'Cargar el helper solo dentro de node:test');
const Module = require('node:module');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
assert.ok(!Object.keys(require.cache).some(file => /[/\\](?:controllers|routes|middlewares)[/\\]|[/\\]supabaseClient\.js$|[/\\]@supabase[/\\]/.test(file)),
    'Instalar aislamiento antes de cargar SEDA o el SDK');
const bloqueos = [];
function bloquear(tipo) {
    bloqueos.push(tipo);
    throw new Error(`QA bloqueado: ${tipo}`);
}
// Sobrescribir sin leer ni registrar los valores heredados.
for (const key of Object.keys(process.env)) if (key.startsWith('SUPABASE_')) delete process.env[key];
process.env.SUPABASE_URL = 'https://supabase.invalid';
process.env.SUPABASE_ANON_KEY = 'hachi-clave-ficticia';
process.env.SUPABASE_SECRET_KEY = 'hachi-clave-ficticia';
let fabrica;
const load = Module._load;
Module._load = function (id, parent, main) {
    if (id === '@supabase/supabase-js') {
        assert.ok(fabrica, 'La fábrica QA debe instalarse antes de importar SEDA');
        return { createClient: fabrica };
    }
    const normalized = id.replaceAll('\\', '/');
    if (normalized.includes('@supabase/') || /(^|\/)dotenv(\/|$)/.test(normalized)) return bloquear('SDK real o dotenv');
    return load.call(this, id, parent, main);
};
function local(host) { return ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(host); }
function destino(args) {
    const first = args[0];
    const options = typeof first === 'string' || first instanceof URL ? new URL(first) : first;
    const override = args[1] && typeof args[1] === 'object' ? args[1] : {};
    const merged = { ...options, ...override };
    return { host: override.hostname || override.host || options?.hostname || options?.host, socketPath: merged.socketPath };
}
for (const transport of [http, https]) {
    const request = transport.request;
    transport.request = function (...args) {
        const d = destino(args);
        if (d.socketPath || !local(d.host)) return bloquear('HTTP/HTTPS externo');
        return request.apply(this, args);
    };
    transport.get = function (...args) { const req = transport.request(...args); req.end(); return req; };
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    let a = args;
    if (Array.isArray(a[0])) a = a[0];
    const options = a[0];
    const host = typeof options === 'object' ? options.host : a[1];
    if (options?.path || !local(host)) return bloquear('TCP externo');
    return connect.apply(this, args);
};
// TLS/HTTP2 y UDP no son necesarios para Supertest; no dejar vías alternativas.
require('node:tls').connect = () => bloquear('TLS');
require('node:http2').connect = () => bloquear('HTTP2');
require('node:dgram').createSocket = () => bloquear('UDP');
globalThis.fetch = async () => bloquear('fetch');
globalThis.WebSocket = class { constructor() { bloquear('WebSocket'); } };
// Bloquear .env antes de abrirlo, incluso si alguna dependencia intenta leerlo.
function revisarArchivo(file) {
    const name = file instanceof URL ? file.pathname : Buffer.isBuffer(file) ? file.toString() : file;
    if (typeof name === 'string' && /^\.env(?:\.|$)/i.test(path.basename(name))) bloquear('lectura .env');
}
for (const key of ['readFileSync', 'readFile', 'openSync', 'open', 'createReadStream']) {
    const original = fs[key];
    fs[key] = function (file, ...args) { revisarArchivo(file); return original.call(this, file, ...args); };
}
for (const key of ['readFile', 'open']) {
    const original = fs.promises[key];
    fs.promises[key] = async function (file, ...args) { revisarArchivo(file); return original.call(this, file, ...args); };
}
module.exports = { bloqueos, instalarFabrica(fn) { assert.equal(fabrica, undefined); fabrica = fn; } };
