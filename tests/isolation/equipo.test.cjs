const e = require('../helpers/equipo-bootstrap.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Equipo: rechaza red externa y puertos locales ajenos antes de conectar', async () => {
    await assert.rejects(fetch('https://supabase.invalid'), /QA:/);
    await assert.rejects(fetch('http://127.0.0.1:9'), /QA:/);
    assert.throws(() => require('node:http').get('http://supabase.invalid'), /QA bloqueado/);
    assert.throws(() => require('node:net').connect(443, 'supabase.invalid'), /QA:/);
});

test('Equipo: rechaza .env y SDK real antes de abrirlos', async () => {
    const fs = require('node:fs');
    assert.throws(() => fs.readFileSync('.env'), /QA bloqueado: lectura .env/);
    await assert.rejects(fs.promises.readFile('.env.production'), /QA bloqueado: lectura .env/);
    assert.throws(() => require('dotenv'), /QA bloqueado/);
    assert.throws(() => require('@supabase/supabase-js/dist/main/index.js'), /QA bloqueado/);
});

test('Equipo: carga exportación real con fábrica simulada y caché estable, sin escuchar', async () => {
    const app = e.cargarApp();
    assert.equal(e.cargarApp(), app);
    assert.equal(require('@supabase/supabase-js').createClient, e.createClient);
    assert.equal(require('../../supabaseClient'), e.cliente);
    assert.equal(e.fabricaciones.length, 2);
    const resultado = await e.cliente.auth.getUser('token-falso');
    assert.equal(resultado.data.user, null);
    assert.ok(resultado.error);
});
