// --require se hereda a cada worker; el coordinador no carga SEDA.
if (process.env.NODE_TEST_CONTEXT) {
    const assert = require('node:assert/strict');
    const { after } = require('node:test');
    const fetchNativo = globalThis.fetch;
    const e = require('./entorno.cjs');
    const net = require('node:net');
    const puertos = new Set();
    const inesperadas = [];
    // Único contrato de Auth requerido por los casos del equipo.
    e.cliente.auth.getUser = async token => {
        if (token !== 'token-falso') {
            inesperadas.push('getUser no previsto');
            throw new Error('QA: token simulado no previsto');
        }
        return { data: { user: null }, error: { message: 'Token ficticio inválido' } };
    };
    const escuchar = net.Server.prototype.listen;
    net.Server.prototype.listen = function (port, host, ...rest) {
        assert.equal(port, 0, 'QA: solo puerto dinámico');
        assert.equal(host, '127.0.0.1', 'QA: solo servidor local');
        let asignado;
        this.once('listening', () => { asignado = this.address().port; puertos.add(asignado); });
        this.once('close', () => puertos.delete(asignado));
        return escuchar.call(this, port, host, ...rest);
    };
    const conectar = net.Socket.prototype.connect;
    net.Socket.prototype.connect = function (...args) {
        const a = Array.isArray(args[0]) ? args[0] : args;
        const opciones = typeof a[0] === 'object' ? a[0] : { port: a[0], host: a[1] };
        assert.ok(opciones.host === '127.0.0.1' && puertos.has(Number(opciones.port)),
            'QA: conexión fuera del servidor de prueba');
        return conectar.apply(this, args);
    };
    globalThis.fetch = async (input, options = {}) => {
        const url = new URL(input instanceof Request ? input.url : input);
        assert.ok(url.protocol === 'http:' && url.hostname === '127.0.0.1' &&
            puertos.has(Number(url.port)) && !url.username && !url.password,
        'QA: fetch fuera del servidor de prueba');
        assert.ok(!options.dispatcher, 'QA: dispatcher no autorizado');
        return fetchNativo(input, { ...options, redirect: 'error' });
    };
    after(() => {
        assert.deepEqual(inesperadas, [], 'Operaciones Auth inesperadas');
        assert.equal(e.llamadas.length, 0, 'El equipo no debe acceder a persistencia ni Storage');
    });
    module.exports = e;
}
