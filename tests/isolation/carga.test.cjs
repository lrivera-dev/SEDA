// Ejecutar únicamente después de supabase.test.cjs; no abre sockets ni envía peticiones.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const e = require('../helpers/entorno.cjs');
test('carga controlada de aplicación y routers reales sin escuchar ni contactar servicios', () => {
    const before = process.getActiveResourcesInfo();
    const app = e.cargarApp();
    assert.equal(typeof app, 'function');
    const routes = app.router.stack.flatMap(layer => layer.handle.stack || [])
        .filter(layer => layer.route).map(layer => ({ path: layer.route.path, methods: layer.route.methods }));
    assert.ok(routes.some(r => r.path === '/login' && r.methods.post));
    assert.ok(routes.some(r => r.path === '/:id_caso/revision' && r.methods.patch));
    assert.ok(routes.some(r => r.path === '/:id_caso' && r.methods.get));
    // Verificar los endpoints agregados en HU-3 y HU-4.
    assert.ok(routes.some(r =>
        r.path === '/:id_caso/reintentar' && r.methods.post
    ));

    assert.ok(routes.some(r =>
        Array.isArray(r.path) &&
        r.path.includes('/:id_universidad') &&
        r.methods.get
    ));

    // SEDA tiene 8 routers registrados.
    assert.equal(app.router.stack.filter(l => l.handle.stack).length, 8);

    assert.equal(e.fabricaciones.length, 2);
    assert.equal(e.llamadas.length, 0);
    assert.deepEqual(e.seguridad.bloqueos, []);
    assert.deepEqual(process.getActiveResourcesInfo().sort(), before.sort());
    e.verificarConsumo();
});