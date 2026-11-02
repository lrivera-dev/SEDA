'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../../public/js/proteger-universidad.js'), 'utf8');

function cargarPagina(datos = {}, cantidadBotones = 1) {
    const almacen = new Map(Object.entries(datos));
    const eliminados = [];
    const redirecciones = [];
    const eventosDocumento = new Map();
    const eventosBotones = [];
    const botones = Array.from({ length: cantidadBotones }, () => ({
        addEventListener(nombre, callback) {
            if (nombre === 'click') eventosBotones.push(callback);
        }
    }));
    const sessionStorage = {
        getItem: clave => almacen.has(clave) ? almacen.get(clave) : null,
        removeItem(clave) { eliminados.push(clave); almacen.delete(clave); }
    };
    const window = {
        location: { replace: url => redirecciones.push(url) }
    };
    const document = {
        addEventListener(nombre, callback) { eventosDocumento.set(nombre, callback); },
        querySelectorAll(selector) {
            assert.equal(selector, '.logout');
            return botones;
        }
    };
    vm.runInNewContext(script, { sessionStorage, window, document }, { filename: 'proteger-universidad.js', timeout: 1000 });
    return { almacen, eliminados, redirecciones, eventosDocumento, eventosBotones, window };
}

test('HU10-CA5: cerrar sesión elimina token y rol y redirige al inicio', () => {
    const p = cargarPagina({ seda_access_token: 'token-ficticio', seda_rol: 'UNIVERSIDAD' });
    assert.equal(typeof p.window.SEDAAuthUniversidad.cerrarSesion, 'function');
    p.window.SEDAAuthUniversidad.cerrarSesion();
    assert.equal(p.almacen.has('seda_access_token'), false);
    assert.equal(p.almacen.has('seda_rol'), false);
    assert.deepEqual(p.eliminados, ['seda_access_token', 'seda_rol']);
    assert.deepEqual(p.redirecciones, ['/index.html']);
});

test('HU10-CA5: botón logout ejecuta el cierre de sesión', () => {
    const p = cargarPagina({ seda_access_token: 'token-ficticio', seda_rol: 'UNIVERSIDAD' });
    assert.equal(p.eventosDocumento.has('DOMContentLoaded'), true);
    p.eventosDocumento.get('DOMContentLoaded')();
    assert.equal(p.eventosBotones.length, 1);
    p.eventosBotones[0]();
    assert.equal(p.almacen.size, 0);
    assert.deepEqual(p.redirecciones, ['/index.html']);
});

test('HU10-CA5: volver a cargar página protegida sin sesión redirige', () => {
    const p = cargarPagina();
    assert.equal(p.window.SEDAAuthUniversidad, undefined);
    assert.deepEqual(p.redirecciones, ['/index.html']);
});

test('HU10-CA5: rol no universitario no permite cargar página protegida', () => {
    const p = cargarPagina({ seda_access_token: 'token-ficticio', seda_rol: 'MINED' });
    assert.equal(p.window.SEDAAuthUniversidad, undefined);
    assert.equal(p.almacen.has('seda_access_token'), false);
    assert.equal(p.almacen.has('seda_rol'), false);
    assert.deepEqual(p.redirecciones, ['/index.html']);
});

test('HU10-CA5: sesión de universidad válida no redirige al cargar', () => {
    const p = cargarPagina({ seda_access_token: 'token-ficticio', seda_rol: 'UNIVERSIDAD' });
    assert.deepEqual(p.redirecciones, []);
    assert.equal(typeof p.window.SEDAAuthUniversidad.cerrarSesion, 'function');
});
