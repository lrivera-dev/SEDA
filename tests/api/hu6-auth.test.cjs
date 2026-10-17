const { describe, test, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
// Instalar todas las defensas ANTES de importar Supertest o SEDA.
const e = require('../helpers/entorno.cjs');
const request = require('supertest');
assert.equal(require('@supabase/supabase-js').createClient, e.createClient);
assert.equal(require('../../supabaseClient'), e.cliente);
const app = e.cargarApp();
const validarMined = require('../../middlewares/validarMined');
const TOKEN = 'token-ficticio-hu6';
const GENERICO = 'Correo o contraseña incorrectos';
const BLOQUEO = 'Demasiados intentos. Intenta de nuevo en 5 minutos';
const usuario = { id_usuario: 'qa-hu6', correo: 'mined@example.test', rol: 'MINED', estado: 'ACTIVO' };
const consulta = data => ({ operacion: 'consulta', resultado: { data, error: null }, verificar: a => {
    assert.equal(a.tabla, 'usuario');
    assert.deepEqual(a.eq, [['id_usuario', 'qa-hu6']]);
} });
const auth = (ok, correo) => ({ operacion: 'signInWithPassword', verificar: a => {
    assert.deepEqual(a, { email: correo, password: 'clave-ficticia' });
}, resultado: ok
    ? { data: { user: { id: 'qa-hu6' }, session: { access_token: TOKEN } }, error: null }
    : { data: { user: null, session: null }, error: { message: 'Credenciales simuladas rechazadas' } } });
const getUser = ok => ({ operacion: 'getUser', verificar: a => assert.equal(a.token, TOKEN),
    resultado: { data: { user: ok ? { id: 'qa-hu6' } : null }, error: ok ? null : { message: 'Token ficticio inválido' } } });

describe('HU-6: autenticación y autorización aisladas', { concurrency: false }, () => {
    let correo, secuencia = 0;
    before(() => {
        assert.equal(e.fabricaciones.length, 2, 'Auth y validarMined usan fábricas ficticias');
        assert.ok(!Object.keys(require.cache).some(f => /[/\\](?:@supabase|dotenv)[/\\]/.test(f)));
        assert.equal(process.env.SUPABASE_URL, 'https://supabase.invalid');
    });
    beforeEach(() => {
        // El Map de producción vive en el proceso: cada caso recibe una identidad única.
        correo = `hu6-${++secuencia}@example.test`;
        e.preparar();
    });
    afterEach(() => {
        e.verificarConsumo();
        assert.deepEqual(e.seguridad.bloqueos, [], 'Ningún intento externo ni de lectura .env');
    });
    const login = (body) => request(app).post('/auth/login')
        .send(body ?? { correo, contrasena: 'clave-ficticia' }).expect('Content-Type', /json/);
    async function fallo(numero) {
        e.preparar([auth(false, correo)]);
        const r = await login();
        e.verificarConsumo();
        assert.equal(r.status, numero === 3 ? 429 : 401);
        assert.deepEqual(r.body, { error: numero === 3 ? BLOQUEO : `${GENERICO}. Te quedan ${3 - numero} intentos` });
    }
    async function bloquear() { for (let n = 1; n <= 3; n++) await fallo(n); }

    test('HU6-01 CA1: MINED ACTIVO obtiene HTTP 200 y token ficticio', async () => {
        e.preparar([auth(true, correo), consulta(usuario)]);
        const r = await login();
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, { access_token: TOKEN });
    });
    for (const [id, body] of [
        ['02', {}], ['03', { correo: 'qa@example.test' }],
        ['04', { contrasena: 'clave-ficticia' }],
        ['05', { correo: ' ', contrasena: 'clave-ficticia' }],
        ['06', { correo: 'qa@example.test', contrasena: '' }]
    ]) test(`HU6-${id}: credenciales incompletas ${JSON.stringify(body)} devuelven 400 sin consultar Auth`, async () => {
        const r = await login(body);
        assert.equal(r.status, 400);
        assert.deepEqual(r.body, { error: 'Ingresa tu correo y contraseña' });
        assert.equal(e.llamadas.length, 0);
    });
    for (const [id, n] of [['07', 1], ['08', 2], ['09', 3]]) {
        test(`HU6-${id} CA2: intento fallido ${n}, mensaje y estado HTTP`, async () => {
            for (let i = 1; i <= n; i++) await fallo(i);
        });
    }
    test('HU6-10 CA2: bloqueo hasta 299999 ms, sin llamadas a Auth; acceso a 300000 ms', async t => {
        let ahora = 1800000000000;
        t.mock.method(Date, 'now', () => ahora);
        await bloquear();
        for (const incremento of [0, 299999]) {
            ahora = 1800000000000 + incremento;
            e.preparar();
            const r = await login();
            assert.equal(r.status, 429);
            assert.deepEqual(r.body, { error: BLOQUEO });
            assert.equal(e.llamadas.length, 0);
        }
        ahora = 1800000300000;
        e.preparar([auth(true, correo), consulta(usuario)]);
        const r = await login();
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, { access_token: TOKEN });
    });
    test('HU6-11 RN2: después del bloqueo un nuevo fallo reinicia el contador', async t => {
        let ahora = 1800000000000;
        t.mock.method(Date, 'now', () => ahora);
        await bloquear();
        ahora += 300000;
        await fallo(1);
    });
    test('HU6-12 RN2: acceso exitoso interrumpe la secuencia de fallos', async () => {
        await fallo(1); await fallo(2);
        e.preparar([auth(true, correo), consulta(usuario)]);
        assert.equal((await login()).status, 200);
        e.verificarConsumo();
        await fallo(1);
    });
    for (const [id, nombre, perfil] of [['13', 'correo inexistente', null], ['14', 'rol UNIVERSIDAD', { ...usuario, rol: 'UNIVERSIDAD' }]]) {
        test(`HU6-${id} CA3 propuesto: ${nombre} rechaza sin revelar cuenta ni rol`, async () => {
            e.preparar(perfil ? [auth(true, correo), consulta(perfil)] : [auth(false, correo)]);
            const r = await login();
            assert.equal(r.status, 401);
            assert.equal(r.body.access_token, undefined);
            // Propuesta pendiente del PO: lista cerrada, no admite datos de cuenta/rol.
            assert.deepEqual(Object.keys(r.body), ['error']);
            assert.ok([GENERICO, `${GENERICO}. Te quedan 2 intentos`].includes(r.body.error),
                `Mensaje fuera del contrato genérico propuesto: ${r.body.error}`);
        });
    }
    test('HU6-15 RN1: MINED INACTIVO no obtiene token', async () => {
        e.preparar([auth(true, correo), consulta({ ...usuario, estado: 'INACTIVO' })]);
        const r = await login();
        assert.equal(r.status, 401);
        assert.deepEqual(r.body, { error: `${GENERICO}. Te quedan 2 intentos` });
    });
    test('HU6-16 RN3: inexistente y rol incorrecto no revelan cuál dato fue rechazado', async () => {
        e.preparar([auth(false, correo)]);
        const inexistente = await login();
        e.verificarConsumo();
        correo = `otro-${correo}`;
        e.preparar([auth(true, correo), consulta({ ...usuario, rol: 'UNIVERSIDAD' })]);
        const rol = await login();
        assert.equal(rol.status, inexistente.status);
        assert.deepEqual(rol.body, inexistente.body);
        assert.deepEqual(Object.keys(rol.body), ['error']);
    });
    let id = 17;
    // Solo autorización HU-6; los controladores de HU-8/HU-9 no deben alcanzarse.
    for (const [metodo, ruta] of [['get', '/panel'], ['get', '/casos/1'], ['patch', '/casos/1/revision']]) {
        for (const modo of ['sin sesión', 'token inválido', 'rol incorrecto', 'cuenta inactiva']) {
            const numero = id++;
            test(`HU6-${numero} RN4: ${metodo.toUpperCase()} ${ruta} rechaza ${modo}`, async () => {
                const pasos = modo === 'sin sesión' ? [] : [getUser(modo !== 'token inválido')];
                if (modo === 'rol incorrecto') pasos.push(consulta({ ...usuario, rol: 'UNIVERSIDAD' }));
                if (modo === 'cuenta inactiva') pasos.push(consulta({ ...usuario, estado: 'INACTIVO' }));
                e.preparar(pasos);
                let req = request(app)[metodo](ruta);
                if (modo !== 'sin sesión') req = req.set('Authorization', `Bearer ${TOKEN}`);
                const r = await req.expect('Content-Type', /json/);
                assert.equal(r.status, 401);
                assert.deepEqual(r.body, { error: 'No autorizado.' });
            });
        }
    }
    test('HU6-29 RN1: middleware permite MINED ACTIVO y propaga identidad verificada', async () => {
        e.preparar([getUser(true), consulta(usuario)]);
        const req = { headers: { authorization: `Bearer ${TOKEN}` } };
        const res = e.respuesta(); let siguientes = 0;
        await validarMined(req, res, () => siguientes++);
        assert.equal(siguientes, 1);
        assert.equal(res.body, undefined);
        assert.deepEqual(req.usuario, { id: usuario.id_usuario, correo: usuario.correo });
    });
});
