const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildModel } = require('./model.cjs');
const { documentBlocks, markdown } = require('./render.cjs');
const { serializable, root } = require('./sanitize.cjs');
const event = (name, extra = {}, type = 'test:pass') => ({ type, data: { name, file: 'tests/fixture.cjs', line: 10, details: {}, ...extra } });
const model = (events, exitCode = 0) => buildModel({ metadata: {}, suites: [{ suite: 'unit', exitCode, events }] });

test('clasifica PASS, FAIL, BLOCKED y NOT_RUN sin convertir bloqueos en defectos', () => {
    const m = model([event('correcto'), event('incorrecto', { details: { error: { code: 'ERR_ASSERTION', actual: 500, expected: 400 } } }, 'test:fail'),
        event('sin socket', { details: { error: { cause: { code: 'EACCES', message: 'connect EACCES' } } } }, 'test:fail'), event('omitido', { skip: 'pendiente' })], 1);
    assert.deepEqual(m.totals, { PASS: 1, FAIL: 1, BLOCKED: 1, NOT_RUN: 1 });
    assert.equal(m.findings.length, 1);
    assert.equal(m.suites[0].status, 'FAIL');
});
test('no duplica contenedores de archivos ni suites con hijos fallidos', () => {
    const m = model([event('caso', {}, 'test:fail'), event('archivo.test.cjs', { details: { error: { failureType: 'subtestsFailed' } } }, 'test:fail')], 1);
    assert.equal(m.cases.length, 1);
});
test('conserva pruebas descubiertas sin final como NOT_RUN', () => {
    const m = model([event('pendiente', {}, 'test:enqueue')], 1);
    assert.equal(m.totals.NOT_RUN, 1);
    assert.notEqual(m.suites[0].status, 'PASS');
});
test('una suite no iniciada no inventa un total de casos', () => {
    const m = buildModel({ metadata: {}, suites: [{ suite: 'unit', notRun: true, events: [] }, { suite: 'api', exitCode: null, infrastructure: 'No disponible', events: [] }] });
    assert.equal(m.cases.length, 0);
    assert.deepEqual(m.suites.map(s => s.status), ['NOT_RUN', 'BLOCKED']);
});
test('un código de proceso fallido no se oculta aunque los casos recibidos pasen', () => {
    assert.equal(model([event('correcto')], 1).suites[0].status, 'FAIL');
});
test('errores desconocidos no reciben diagnósticos inventados', () => {
    const m = model([event('caso nuevo', { details: { error: { message: 'No conocido' } } }, 'test:fail')], 1);
    assert.equal(m.findings[0].cause, 'Requiere investigación');
});
test('agrupa errores de tipos de universidades en un hallazgo con casos individuales', () => {
    const m = model(['tipo 123', 'tipo true'].map(n => event('universidad: ' + n, { details: { error: { message: 'datos[campo].trim is not a function' } } }, 'test:fail')), 1);
    assert.equal(m.findings.length, 1); assert.equal(m.findings[0].tests.length, 2);
});
test('serializa propiedades no enumerables de Error y anonimiza rutas y secretos', () => {
    const e = new Error('Prueba en ' + root); e.actual = 500; e.expected = 400;
    const output = serializable({ error: e, token: 'ficticio', message: 'token=ejemplo' });
    assert.equal(output.error.actual, 500); assert.equal(output.error.expected, 400);
    assert.ok(!JSON.stringify(output).includes(root)); assert.ok(output.error.stack);
    assert.equal(output.token, '<omitido>'); assert.ok(!output.message.includes('ejemplo'));
});
test('Markdown conserva las ocho secciones y cifras del modelo compartido', () => {
    const m = model([event('archivo: PDF válido')]);
    const blocks = documentBlocks(m), md = markdown(blocks);
    assert.equal(blocks.filter(b => b.type === 'title').length, 8);
    assert.match(md, /1 PASS, 0 FAIL, 0 BLOCKED y 0 NOT_RUN/);
    assert.match(md, /Definition of Done/); assert.match(md, /UNIT-001/);
});
test('la serialización de una ejecución completa conserva expected y actual anidados', () => {
    const raw = serializable({ metadata: {}, suites: [{ suite: 'api', exitCode: 1, events: [event('universidades: tipo incorrecto debe devolver 400 JSON', {
        details: { error: { cause: { message: 'AssertionError', expected: 400, actual: 500 } } }
    }, 'test:fail')] }] });
    const m = buildModel(raw);
    assert.match(m.cases[0].observed, /Esperado: 400; obtenido: 500/);
    assert.equal(m.findings[0].id, 'QA-001');
});
test('las materias iguales se agrupan en QA-002 con evidencia HTTP exacta', () => {
    const m = model([event('equivalencias: materias iguales deben devolver 400', { details: { error: { cause: { actual: 200, expected: 400 } } } }, 'test:fail')], 1);
    assert.equal(m.findings[0].id, 'QA-002'); assert.equal(m.findings[0].tests.length, 1);
});
test('un campo id_universidad no cambia la funcionalidad de equivalencias', () => {
    assert.equal(model([event('equivalencia: falta id_universidad')]).cases[0].functionality, 'Equivalencias');
});
test('un fallo del renderizador PDF conserva Markdown y propaga el error', async () => {
    const fs = require('node:fs'), path = require('node:path');
    const folder = path.join(root, 'qa-output', 'generator-validation-' + Date.now());
    fs.mkdirSync(folder, { recursive: true });
    const m = model([event('fallo de ejemplo', {}, 'test:fail')], 1);
    await assert.rejects(require('./render.cjs').generate(m, folder, async () => { throw new Error('Fallo PDF simulado'); }), /Fallo PDF simulado/);
    assert.ok(fs.existsSync(path.join(folder, 'informe.md')));
    assert.ok(!fs.existsSync(path.join(folder, 'informe.pdf')));
    assert.match(fs.readFileSync(path.join(folder, 'informe.md'), 'utf8'), /1 FAIL/);
});

const { loadSprint, applyTraceability, validate } = require('./traceability.cjs');
const sprint = () => structuredClone(loadSprint('sprint-2'));
test('Sprint proporcionado conserva 9 CA, 15 RN y 7 criterios DoD, sin atribuir regresión a las HU', () => {
    const config = sprint();
    assert.equal(config.stories.flatMap(s => s.criteria).length, 9);
    assert.equal(config.stories.flatMap(s => s.businessRules).length, 15);
    assert.equal(config.dod.length, 7);
    assert.ok(config.stories.flatMap(s => s.criteria).every(c => c.testRefs.length === 0));
    const m = applyTraceability(model([event('archivo: PDF válido')]), config);
    assert.equal(m.traceability.totals.SIN_EVIDENCIA, 9);
    assert.ok(m.traceability.stories.every(s => s.status === 'SIN_EVIDENCIA'));
    assert.equal(m.totals.PASS, 1);
});
function linked(status = 'PASS', complete = true) {
    const config = sprint();
    config.stories[0].criteria[0].testRefs = [{ id: 'UNIT-001', name: 'criterio controlado', suite: 'unit', file: 'tests/fixture.cjs' }];
    config.stories[0].criteria[0].coverageComplete = complete;
    const extra = status === 'NOT_RUN' ? { skip: 'No ejecutado' } : status === 'BLOCKED' ? { details: { error: { code: 'EACCES' } } } : {};
    return applyTraceability(model([event('criterio controlado', extra, ['FAIL', 'BLOCKED'].includes(status) ? 'test:fail' : 'test:pass')], status === 'PASS' ? 0 : 1), config);
}
test('PASS de un criterio no aprueba la historia ni el Sprint', () => {
    const m = linked();
    assert.equal(m.traceability.rows[0].status, 'PASS');
    assert.equal(m.traceability.stories[0].status, 'SIN_EVIDENCIA');
    assert.match(m.traceability.closure, /NO ACREDITADO/);
});
test('PASS con cobertura incompleta no aprueba el criterio', () => {
    const row = linked('PASS', false).traceability.rows[0];
    assert.equal(row.testResult, 'PASS'); assert.equal(row.status, 'SIN_EVIDENCIA');
});
for (const status of ['FAIL', 'BLOCKED', 'NOT_RUN']) test(`trazabilidad conserva ${status} procedente de resultados`, () => {
    assert.equal(linked(status).traceability.rows[0].status, status);
});
test('mismo ordinal con otro nombre no enlaza pruebas por accidente', () => {
    const config = sprint();
    config.stories[0].criteria[0].testRefs = [{ id: 'UNIT-001', name: 'otro caso', suite: 'unit', file: 'tests/fixture.cjs' }];
    const m = applyTraceability(model([event('caso diferente')]), config);
    assert.equal(m.traceability.rows[0].status, 'NOT_RUN');
});
test('configuración rechaza estados PASS manuales y criterios duplicados', () => {
    const a = sprint(); a.stories[0].criteria[0].verification = 'PASS'; assert.throws(() => validate(a));
    const b = sprint(); b.stories[0].criteria[1].id = b.stories[0].criteria[0].id; assert.throws(() => validate(b));
});
test('Sprint futuro cambia metadatos sin reescribir el generador', () => {
    const c = sprint(); c.number = 3; c.title = 'Incremento siguiente'; c.id = 'sprint-3';
    const m = applyTraceability(model([]), c);
    assert.equal(m.metadata.sprint, 'Sprint 3: Incremento siguiente');
    assert.equal(m.traceability.number, 3);
});
test('resumen y matriz preceden al anexo técnico; no afirma que falten documentos', () => {
    const m = applyTraceability(model([event('caso')]), sprint());
    const blocks = documentBlocks(m), text = markdown(blocks);
    assert.equal(blocks.filter(b => b.type === 'matrix').length, 3);
    assert.ok(text.indexOf('Evaluación del Sprint') < text.indexOf('Anexo 1.'));
    assert.match(text, /Los documentos están disponibles/);
    assert.ok(!text.includes('No se dispone de una estrategia de Sprint'));
});
test('el informe histórico conserva fecha, totales y hallazgos de la evidencia', () => {
    const original = model([event('universidad: tipo 123', { details: { error: { message: 'datos[campo].trim is not a function' } } }, 'test:fail')], 1);
    original.metadata = { id: 'ejecucion-historica', started: '2026-01-01T00:00:00Z', finished: '2026-01-01T00:00:01Z' };
    const m = applyTraceability(original, sprint());
    m.report = { mode: 'HISTORICO_REGENERADO', note: 'No se ejecutaron nuevamente las pruebas.', generatedAt: '2026-02-01T00:00:00Z', sourceExecutionId: original.metadata.id };
    assert.deepEqual(m.totals, original.totals); assert.deepEqual(m.findings, original.findings);
    assert.equal(m.metadata.started, original.metadata.started);
    assert.match(markdown(documentBlocks(m)), /EVIDENCIA HISTÓRICA/);
});
