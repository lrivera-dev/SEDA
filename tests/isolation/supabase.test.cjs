const { test, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const before = process.getActiveResourcesInfo();
const e = require('../helpers/entorno.cjs');
const consulta = data => ({ operacion: 'consulta', resultado: { data, error: null } });
afterEach(() => e.verificarConsumo());
after(() => {
    assert.deepEqual(process.getActiveResourcesInfo().sort(), before.sort(), 'No quedan recursos activos adicionales');
});

test('fábrica sustituida antes de importar controladores; SDK y dotenv no evaluados', () => {
    assert.equal(require('@supabase/supabase-js').createClient, e.createClient);
    assert.equal(require('../../supabaseClient'), e.cliente);
    assert.equal(e.fabricaciones.length, 0);
    require('../../controllers/auth.controller');
    require('../../middlewares/validarMined');
    require('../../controllers/casos.controller');
    require('../../servicios/documentos-caso');
    assert.equal(e.fabricaciones.length, 2);
    assert.ok(e.fabricaciones.every(c => c.auth.getUser === e.cliente.auth.getUser));
    assert.ok(!Object.keys(require.cache).some(f => /[/\\](?:@supabase|dotenv)[/\\]/.test(f)));
    assert.equal(e.seguridad.bloqueos.length, 0);
});
test('login real consume Auth y consulta ficticios', async () => {
    e.preparar([
        { operacion: 'signInWithPassword', resultado: { data: { user: { id: 'qa' }, session: { access_token: 'token-ficticio' } }, error: null },
            verificar: a => assert.deepEqual(a, { email: 'mined@example.test', password: 'ficticia' }) },
        consulta({ rol: 'MINED', estado: 'ACTIVO' })
    ]);
    const res = e.respuesta();
    await require('../../controllers/auth.controller').iniciarSesion({ body: { correo: 'mined@example.test', contrasena: 'ficticia' } }, res);
    assert.deepEqual(res.body, { access_token: 'token-ficticio' });
});
test('middleware real utiliza getUser ficticio', async () => {
    e.preparar([{ operacion: 'getUser', resultado: { data: { user: { id: 'qa' } }, error: null },
        verificar: a => assert.equal(a.token, 'token-ficticio') }, consulta({ id_usuario: 'qa', correo: 'mined@example.test', rol: 'MINED', estado: 'ACTIVO' })]);
    const req = { headers: { authorization: 'Bearer token-ficticio' } }; let next = 0;
    await require('../../middlewares/validarMined')(req, e.respuesta(), () => next++);
    assert.equal(next, 1); assert.equal(req.usuario.id, 'qa');
});
test('consultas, actualizaciones, upload y enlaces firmados solo consumen respuestas', async () => {
    e.preparar([consulta([{ id: 'qa' }]), { operacion: 'upload', resultado: { error: null } },
        { operacion: 'createSignedUrl', resultado: { data: { signedUrl: 'https://documento.invalid/qa' }, error: null } }]);
    assert.deepEqual((await e.cliente.from('caso_equivalencia').update({ estado: 'ACEPTADO' }).eq('id', 'qa').select().order('id')).data, [{ id: 'qa' }]);
    assert.equal((await e.cliente.storage.from('qa').upload('qa.pdf', Buffer.from('ficticio'))).error, null);
    const result = await require('../../servicios/documentos-caso').generarEnlacesDocumentos({ materia_origen: { programa_url: 'qa.pdf' } });
    assert.equal(result.enlaces.programa_origen, 'https://documento.invalid/qa');
});
test('operación inesperada falla explícitamente sin fallback', () => {
    e.preparar();
    assert.throws(() => e.cliente.auth.getUser('ficticio'), /Acceso simulado no previsto/);
    assert.throws(() => e.cliente.from('qa').single(), /Acceso simulado no previsto/);
    assert.throws(() => e.cliente.storage.from('qa').createSignedUrl('qa', 1), /Acceso simulado no previsto/);
    assert.throws(() => e.cliente.auth.signOut(), TypeError);
});
test('fetch, HTTP, HTTPS y TCP externos son rechazados antes de conectar', async () => {
    await assert.rejects(fetch('https://supabase.invalid'), /QA bloqueado/);
    for (const mod of ['http', 'https']) for (const method of ['request', 'get']) {
        assert.throws(() => require('node:' + mod)[method]('https://supabase.invalid'), /QA bloqueado/);
        assert.throws(() => require('node:' + mod)[method]({ hostname: '192.0.2.1' }), /QA bloqueado/);
    }
    const socket = new (require('node:net').Socket)();
    try { assert.throws(() => socket.connect({ host: '192.0.2.1', port: 443 }), /QA bloqueado/); }
    finally { socket.destroy(); }
    assert.throws(() => require('node:tls').connect(443, 'supabase.invalid'), /QA bloqueado/);
    assert.throws(() => require('node:http2').connect('https://supabase.invalid'), /QA bloqueado/);
    assert.throws(() => require('node:dgram').createSocket('udp4'), /QA bloqueado/);
    assert.throws(() => new WebSocket('wss://supabase.invalid'), /QA bloqueado/);
});
test('dotenv, SDK alternativo y lecturas .env se bloquean sin abrir archivos', async () => {
    assert.throws(() => require('dotenv'), /QA bloqueado/);
    assert.throws(() => require('@supabase/auth-js'), /QA bloqueado/);
    assert.throws(() => require(require.resolve('@supabase/supabase-js')), /QA bloqueado/);
    const fs = require('node:fs');
    assert.throws(() => fs.readFileSync('.env'), /QA bloqueado/);
    assert.throws(() => fs.openSync('.env.local', 'r'), /QA bloqueado/);
    await assert.rejects(fs.promises.readFile('.env'), /QA bloqueado/);
    assert.equal(process.env.SUPABASE_URL, 'https://supabase.invalid');
    assert.equal(process.env.SUPABASE_ANON_KEY, 'hachi-clave-ficticia');
});
