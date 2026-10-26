const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { e, ID, TOKEN, sesion, lectura, caso, firmas, claves, etiquetas } = require('../helpers/casos.cjs');
const request = require('supertest');
const app = e.cargarApp();
beforeEach(() => e.preparar());
afterEach(() => e.verificarConsumo());
const get = (id = ID) => request(app).get(`/casos/${id}`).set('Authorization', `Bearer ${TOKEN}`);

test('HU8-01 CA1: reporte completo, cuatro enlaces de 3600 segundos y solo lectura', async () => {
    e.preparar([...sesion(), lectura(caso()), ...firmas()]);
    const r = await get().expect(200).expect('Content-Type', /json/);
    assert.deepEqual(r.body.caso, { id_caso: ID, descripcion: 'Equivalencia ficticia', estado: 'PENDIENTE',
        fecha_registro: '2026-01-01T00:00:00Z', porcentaje_coincidencia: 'Pendiente de cálculo',
        origen: { materia: 'Materia A', carrera: 'Carrera A', universidad: 'Universidad A' },
        destino: { materia: 'Materia B', carrera: 'Carrera B', universidad: 'Universidad B' } });
    assert.deepEqual(r.body.documentos_faltantes, []);
    assert.deepEqual(Object.keys(r.body.enlaces), claves);
    for (const k of claves) assert.equal(r.body.enlaces[k], `https://documentos.invalid/${k}?firma=ficticia`);
    assert.ok(!JSON.stringify(r.body).includes('privado/'));
    assert.ok(e.llamadas.every(x => !x.argumentos.update && !x.argumentos.insert));
});
for (let mask = 0; mask < 15; mask++) {
    test(`HU8-F${String(mask).padStart(2, '0')} CA2: documentos disponibles máscara ${mask}`, async () => {
        e.preparar([...sesion(), lectura(caso(mask)), ...firmas(mask)]);
        const r = await get().expect(200);
        assert.deepEqual(r.body.documentos_faltantes, etiquetas.filter((_, i) => !(mask & (1 << i))));
        for (const [i, k] of claves.entries()) assert.equal(r.body.enlaces[k], mask & (1 << i) ? `https://documentos.invalid/${k}?firma=ficticia` : null);
        assert.equal(r.body.caso.id_caso, ID); assert.equal(r.body.error, undefined);
    });
}
test('HU8-02 CA3: UUID inválido devuelve 404 sin consulta ni datos parciales', async () => {
    e.preparar(sesion());
    const r = await get('invalido').expect(404);
    assert.deepEqual(r.body, { error: 'El caso solicitado no existe o fue eliminado' });
});
test('HU8-03 CA3: caso inexistente devuelve 404 sin datos parciales', async () => {
    e.preparar([...sesion(), lectura(null)]);
    const r = await get().expect(404);
    assert.deepEqual(r.body, { error: 'El caso solicitado no existe o fue eliminado' });
});
test('HU8-04 CA1: sin sesión no consulta datos', async () => {
    const r = await request(app).get(`/casos/${ID}`).expect(401);
    assert.deepEqual(r.body, { error: 'No autorizado.' }); assert.equal(e.llamadas.length, 0);
});
test('HU8-05 CA1: otro perfil no accede al reporte', async () => {
    e.preparar(sesion('UNIVERSIDAD'));
    const r = await get().expect(401); assert.deepEqual(r.body, { error: 'No autorizado.' });
});
test('HU8-06 CA1: MINED inactivo no accede al reporte', async () => {
    e.preparar(sesion('MINED', 'INACTIVO')); await get().expect(401);
});
test('HU8-07 CA2: fallo de Storage mantiene reporte y no expone rutas internas', async () => {
    e.preparar([...sesion(), lectura(caso()), ...firmas(15, true)]);
    const r = await get().expect(200);
    assert.deepEqual(r.body.documentos_faltantes, etiquetas);
    assert.ok(Object.values(r.body.enlaces).every(x => x === null));
    assert.ok(!JSON.stringify(r.body).includes('privado/'));
});
test('HU8-08 CA1: error de lectura devuelve 500 sin datos parciales', async () => {
    e.preparar([...sesion(), lectura(null, { message: 'Lectura simulada fallida' })]);
    const r = await get().expect(500); assert.deepEqual(r.body, { error: 'Lectura simulada fallida' });
});
