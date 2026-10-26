const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { e, ID, REVISOR, TOKEN, sesion, lectura, consulta } = require('../helpers/casos.cjs');
const request = require('supertest');
const app = e.cargarApp();
beforeEach(() => e.preparar());
afterEach(() => e.verificarConsumo());
const patch = body => request(app).patch(`/casos/${ID}/revision`).set('Authorization', `Bearer ${TOKEN}`).send(body);
const pendiente = () => lectura({ id_caso: ID, estado: 'PENDIENTE' });
const mensaje = 'Debe elegir una decisión: Aceptar o emitir advertencia';
function escritura(estado, observacion, data, error = null) {
    return consulta(data, a => {
        assert.equal(a.tabla, 'caso_equivalencia');
        assert.deepEqual(a.eq, [['id_caso', ID], ['estado', 'PENDIENTE']]);
        // Cada invocación conserva su lista de argumentos: update(objeto) -> [[objeto]].
        assert.deepEqual(a.update, [[{ estado, observacion_revision: observacion, id_revisor: REVISOR, fecha_revision: '2026-01-02T03:04:05.000Z' }]]);
    }, error);
}
test('HU9-01 CA1: aceptar persiste estado, revisor autenticado y fecha', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-01-02T03:04:05Z') });
    const datos = { id_caso: ID, estado: 'ACEPTADO', id_revisor: REVISOR, fecha_revision: new Date().toISOString() };
    e.preparar([...sesion(), pendiente(), escritura('ACEPTADO', null, datos)]);
    const r = await patch({ decision: 'ACEPTAR', id_revisor: 'identidad-no-autorizada' }).expect(200);
    assert.deepEqual(r.body, { mensaje: 'Equivalencia aceptada', caso: datos });
});
test('HU9-02 CA2: advertencia de diez caracteres persiste observación y auditoría', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-01-02T03:04:05Z') });
    const datos = { id_caso: ID, estado: 'ADVERTENCIA', observacion_revision: '1234567890', id_revisor: REVISOR, fecha_revision: new Date().toISOString() };
    e.preparar([...sesion(), pendiente(), escritura('ADVERTENCIA', '1234567890', datos)]);
    const r = await patch({ decision: 'ADVERTENCIA', observacion: ' 1234567890 ' }).expect(200);
    assert.deepEqual(r.body, { mensaje: 'Advertencia emitida', caso: datos });
});
for (const [id, observacion] of [['03', ''], ['04', '123456789'], ['05', '          '], ['06', 1234567890]]) {
    test(`HU9-${id} CA2: observación inválida ${JSON.stringify(observacion)} no modifica datos`, async () => {
        e.preparar(sesion());
        const r = await patch({ decision: 'ADVERTENCIA', observacion }).expect(400);
        assert.deepEqual(r.body, { error: 'Indica el motivo de la advertencia' });
    });
}
for (const [id, decision] of [['07', null], ['08', ''], ['09', 'RECHAZAR'], ['10', 'aceptar']]) {
    test(`HU9-${id} CA3: decisión inválida ${JSON.stringify(decision)} no modifica datos`, async () => {
        e.preparar(sesion()); const r = await patch({ decision }).expect(400);
        assert.deepEqual(r.body, { error: mensaje });
    });
}
for (const [id, estado, decision, ca] of [['11', 'ACEPTADO', 'ACEPTAR', 'CA1'], ['12', 'ADVERTENCIA', 'ADVERTENCIA', 'CA2']]) {
    test(`HU9-${id} ${ca}: caso ${estado} rechaza segunda revisión`, async () => {
        e.preparar([...sesion(), lectura({ id_caso: ID, estado })]);
        const r = await patch({ decision, observacion: 'Motivo ficticio suficiente' }).expect(409);
        assert.deepEqual(r.body, { error: 'Este caso ya fue revisado' });
    });
}
test('HU9-13 CA1: actualización concurrente no sobrescribe revisión ajena', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-01-02T03:04:05Z') });
    e.preparar([...sesion(), pendiente(), escritura('ACEPTADO', null, null)]);
    const r = await patch({ decision: 'ACEPTAR' }).expect(409);
    assert.deepEqual(r.body, { error: 'Este caso ya fue revisado' });
});
test('HU9-14 CA1: caso inexistente devuelve 404 sin escritura', async () => {
    e.preparar([...sesion(), lectura(null)]);
    const r = await patch({ decision: 'ACEPTAR' }).expect(404);
    assert.deepEqual(r.body, { error: 'El caso indicado no existe.' });
});
test('HU9-15 CA1: error de lectura devuelve 500 sin escritura', async () => {
    e.preparar([...sesion(), lectura(null, { message: 'Lectura simulada fallida' })]);
    const r = await patch({ decision: 'ACEPTAR' }).expect(500);
    assert.deepEqual(r.body, { error: 'Lectura simulada fallida' });
});
test('HU9-16 CA1: error de escritura conserva resultado fallido del servicio', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-01-02T03:04:05Z') });
    e.preparar([...sesion(), pendiente(), escritura('ACEPTADO', null, null, { message: 'Escritura simulada fallida' })]);
    const r = await patch({ decision: 'ACEPTAR' }).expect(500);
    assert.deepEqual(r.body, { error: 'Escritura simulada fallida' });
});
test('HU9-17 CA1: sin sesión no puede revisar', async () => {
    await request(app).patch(`/casos/${ID}/revision`).send({ decision: 'ACEPTAR' }).expect(401);
    assert.equal(e.llamadas.length, 0);
});
test('HU9-18 CA1: otro perfil no puede revisar', async () => {
    e.preparar(sesion('UNIVERSIDAD')); await patch({ decision: 'ACEPTAR' }).expect(401);
});
test('HU9-19 CA1: MINED inactivo no puede revisar', async () => {
    e.preparar(sesion('MINED', 'INACTIVO')); await patch({ decision: 'ACEPTAR' }).expect(401);
});
test('HU9-20 CA3: decisión heredada constructor se rechaza antes de persistencia', async t => {
    e.preparar(sesion());
    // Spy de persistencia: un acceso indebido recibe un caso inexistente ficticio.
    // Permite distinguir HTTP 404 de la validación 400 exigida, sin lanzar un error del mock.
    const original = e.cliente.from;
    let accesos = 0;
    t.mock.method(e.cliente, 'from', function (tabla) {
        if (tabla !== 'caso_equivalencia') return original.call(this, tabla);
        accesos++;
        const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: null, error: null }) };
        return q;
    });
    const r = await patch({ decision: 'constructor' });
    assert.equal(r.status, 400, `RN3 exige rechazo antes de persistencia; consultas observadas: ${accesos}`);
    assert.deepEqual(r.body, { error: mensaje }); assert.equal(accesos, 0);
});
