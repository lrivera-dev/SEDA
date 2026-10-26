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
// Fuentes simuladas solo para el clasificador; nunca se escriben controladores.
// La lectura interceptada se limita al archivo de equivalencias y node:test la restaura.
const fuenteDefectuosa = `if (id_materia_origen === id_materia_destino) {
    return res.json(400).json({ error: 'La materia de origen y destino no pueden ser la misma.' });
}`;
const fuenteCorregida = fuenteDefectuosa.replace('res.json(400).json', 'res.status(400).json');
function simularFuenteEquivalencias(t, fuente) {
    const fs = require('node:fs');
    const path = require('node:path');
    const original = fs.readFileSync;
    const target = path.join(root, 'controllers/equivalencias.controller.js');
    t.mock.method(fs, 'readFileSync', function (file, ...args) {
        if (typeof file === 'string' && path.resolve(file) === target) return fuente;
        return original.call(this, file, ...args);
    });
}

test('las materias iguales se agrupan en QA-002 con evidencia HTTP exacta', t => {
    simularFuenteEquivalencias(t, fuenteDefectuosa);
    const m = model([event('equivalencias: materias iguales deben devolver 400', { details: { error: { cause: { actual: 200, expected: 400 } } } }, 'test:fail')], 1);
    assert.equal(m.findings[0].id, 'QA-002'); assert.equal(m.findings[0].tests.length, 1);
});
test('fuente corregida y fallo simulado conservan FAIL como INV sin atribuir QA-002', t => {
    simularFuenteEquivalencias(t, fuenteCorregida);
    const m = model([event('equivalencias: materias iguales deben devolver 400',
        { details: { error: { cause: { actual: 200, expected: 400 } } } }, 'test:fail')], 1);
    assert.equal(m.totals.FAIL, 1);
    assert.equal(m.findings[0].id, 'INV-UNIT-001');
    assert.equal(m.findings[0].cause, 'Requiere investigación');
    assert.match(m.cases[0].observed, /Esperado: 400; obtenido: 200/);
});

test('comparación genérica HTTP 200/400 no acredita QA-002 aunque exista su firma', t => {
    simularFuenteEquivalencias(t, fuenteDefectuosa);
    const m = model([event('equivalencias: otro rechazo debe devolver 400',
        { details: { error: { actual: 200, expected: 400 } } }, 'test:fail')], 1);
    assert.equal(m.totals.FAIL, 1);
    assert.equal(m.findings[0].id, 'INV-UNIT-001');
    assert.equal(m.findings[0].cause, 'Requiere investigación');
});

test('casos PASS no activan QA-001 ni QA-002 incluso ante una firma de código', t => {
    simularFuenteEquivalencias(t, fuenteDefectuosa);
    const m = model([event('universidades: tipo incorrecto debe devolver 400 JSON'),
        event('equivalencias: materias iguales deben devolver 400')]);
    assert.deepEqual(m.totals, { PASS: 2, FAIL: 0, BLOCKED: 0, NOT_RUN: 0 });
    assert.deepEqual(m.findings, []);
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
    assert.ok(config.stories.slice(1).flatMap(s => s.criteria).every(c => c.testRefs.length > 0 && !c.coverageComplete));
    assert.equal(config.stories[0].criteria.flatMap(c => c.testRefs).length, 29);
    const m = applyTraceability(model([event('archivo: PDF válido')]), config);
    assert.equal(m.traceability.totals.SIN_EVIDENCIA, 0);
    assert.equal(m.traceability.totals.NOT_RUN, 9);
    assert.ok(m.traceability.stories.slice(1).every(s => s.status === 'NOT_RUN'));
    assert.equal(m.totals.PASS, 1);
});
function linked(status = 'PASS', complete = true) {
    const config = sprint();
    config.stories[0].criteria.forEach(c => { c.testRefs = []; });
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
    config.stories[0].criteria.forEach(c => { c.testRefs = []; });
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


test('HU-6: 29 resultados simulados vinculados sin aprobar CA3 pendiente ni HU-8/HU-9', () => {
    const config = sprint();
    const refs = config.stories[0].criteria.flatMap(c => c.testRefs);
    const events = refs.map(r => event(r.name, { file: r.file }));
    const m = applyTraceability(buildModel({ metadata: { id: 'fixture-simulada-no-ejecucion-producto' },
        suites: [{ suite: 'api', exitCode: 0, events }] }), config);
    assert.equal(m.cases.length, 29);
    assert.equal(m.traceability.sprintCases.totals.PASS, 29);
    assert.equal(m.traceability.regression.ids.length, 0);
    assert.equal(m.traceability.unmappedIds.length, 0);
    assert.ok(m.cases.every(c => c.functionality.startsWith('HU-6')));
    assert.ok(m.cases.every(c => !c.expected.includes('HTTP 400')));
    assert.ok(m.traceability.rows.slice(0, 3).every(r => r.testResult === 'PASS' && r.status === 'SIN_EVIDENCIA'));
    assert.ok(m.traceability.rows.slice(3).every(r => r.links.length > 0 && r.status === 'NOT_RUN'));
    const md = markdown(documentBlocks(m));
    assert.match(md, /PENDIENTE_PO/);
    assert.match(md, /27 PASS y 2 FAIL/);
    assert.match(md, /Original vigente/);
    assert.match(md, /NO ACREDITADO/);
    assert.match(md, /29 PASS/);
});

test('aprobación PO pendiente impide PASS incluso con cobertura declarada completa', () => {
    const config = sprint();
    const ca = config.stories[0].criteria[2]; ca.coverageComplete = true;
    const m = applyTraceability(buildModel({ metadata: {}, suites: [{ suite: 'api', exitCode: 0,
        events: ca.testRefs.map(r => event(r.name, { file: r.file })) }] }), config);
    assert.equal(m.traceability.rows[2].status, 'SIN_EVIDENCIA');
});

test('enlaces exigen suite y archivo exactos además del nombre', () => {
    const config = sprint(); const ref = config.stories[0].criteria[2].testRefs[0];
    for (const [suite, file] of [['unit', ref.file], ['api', 'tests/otro.cjs']]) {
        const m = applyTraceability(buildModel({ metadata: {}, suites: [{ suite, exitCode: 0,
            events: [event(ref.name, { file })] }] }), config);
        assert.equal(m.traceability.rows[2].links[0].status, 'NOT_RUN');
    }
});

test('PASS de HU-6 no cambia los FAIL de regresión QA-001 y QA-002', t => {
    simularFuenteEquivalencias(t, fuenteDefectuosa);
    const config = sprint(); const ref = config.stories[0].criteria[0].testRefs[0];
    const m = applyTraceability(buildModel({ metadata: {}, suites: [{ suite: 'api', exitCode: 1, events: [
        event(ref.name, { file: ref.file }),
        event('universidades: tipo incorrecto debe devolver 400 JSON', { file: 'tests/api/endpoints.test.cjs', details: { error: { actual: 500, expected: 400 } } }, 'test:fail'),
        event('equivalencias: materias iguales deben devolver 400 y mensaje en español', { file: 'tests/api/endpoints.test.cjs', details: { error: { actual: 200, expected: 400 } } }, 'test:fail')
    ] }] }), config);
    assert.equal(m.totals.FAIL, 2);
    assert.equal(m.traceability.regression.totals.FAIL, 2);
    assert.equal(m.traceability.sprintCases.totals.PASS, 1);
    assert.deepEqual(m.findings.map(f => f.id), ['QA-001', 'QA-002']);
});


for (const [label, passes, failures] of [['sin fallos', 123, 0], ['un defecto', 12, 1], ['muchos defectos', 10, 25], ['muchos PASS', 2000, 0]]) {
    test(`PDF ejecutivo: ${label}, cifras fieles y máximo diez páginas reales`, async () => {
        const fs = require('node:fs'), path = require('node:path');
        const { executiveBlocks, countPdfPages } = require('./executive.cjs');
        const events = [...Array.from({ length: passes }, (_, i) => event(`PASS ficticio ${i}`)),
            ...Array.from({ length: failures }, (_, i) => event(`Fallo ficticio ${i}`, { details: { error: { actual: 500, expected: 400 } } }, 'test:fail'))];
        const m = applyTraceability(model(events, failures ? 1 : 0), sprint());
        const folder = path.join(root, 'qa-output', `generator-validation-pdf-${label.replaceAll(' ', '-')}-${Date.now()}`);
        fs.mkdirSync(folder, { recursive: true });
        await require('./render.cjs').generate(m, folder);
        const pages = countPdfPages(path.join(folder, 'informe.pdf'));
        assert.ok(pages >= 1 && pages <= 10, `Páginas reales: ${pages}`);
        const executive = markdown(executiveBlocks(m));
        assert.ok(executive.includes(`${passes} PASS, ${failures} FAIL`));
        assert.match(executive, /PENDIENTE_PO/);
        assert.match(executive, /Definition of Done/);
        assert.match(executive, /Cobertura parcial/);
        assert.match(executive, /NO ACREDITADO/);
        if (failures > 3) assert.ok(executive.includes(`${failures - 3} quedan fuera`));
        assert.equal(m.cases.length, passes + failures);
        assert.ok(fs.readFileSync(path.join(folder, 'informe.md'), 'utf8').includes(`PASS ficticio ${passes - 1}`));
    });
}
