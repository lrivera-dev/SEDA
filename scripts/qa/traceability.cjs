const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { root } = require('./sanitize.cjs');

function validate(config) {
    if (config.schemaVersion !== 1 || !Number.isInteger(config.number) || config.number < 1 || !config.title || !config.goal) throw new Error('Configuración de Sprint inválida.');
    for (const key of ['sources', 'stories', 'dod', 'openQuestions', 'outOfScope']) if (!Array.isArray(config[key])) throw new Error(`Falta ${key} en la configuración.`);
    const ids = new Set();
    for (const story of config.stories) {
        if (!story.id || !Array.isArray(story.criteria) || !story.criteria.length) throw new Error('Historia sin criterios.');
        for (const criterion of story.criteria) {
            if (!criterion.id || ids.has(criterion.id) || !criterion.text || !criterion.sourceRef) throw new Error('Criterio duplicado o incompleto.');
            ids.add(criterion.id);
            if (!Array.isArray(criterion.testRefs) || !Array.isArray(criterion.evidence) || typeof criterion.coverageComplete !== 'boolean') throw new Error(`Trazabilidad incompleta: ${criterion.id}`);
            for (const ref of criterion.testRefs) if (!ref.id || !ref.name || !ref.suite || !ref.file) throw new Error(`Referencia ambigua en ${criterion.id}: se exige id, suite, nombre y archivo.`);
            // Los estados declarados no son resultados: PASS/FAIL solo se calculan de eventos.
            if (criterion.verification !== 'SIN_EVIDENCIA') throw new Error('No almacenar PASS/FAIL manuales en criterios.');
        }
    }
    return config;
}
function loadSprint(selection) {
    const id = selection || process.env.QA_SPRINT || JSON.parse(fs.readFileSync(path.join(root, 'qa/config.json'), 'utf8')).activeSprint;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Sprint inválido: usar el identificador de un JSON en qa/sprints/.');
    const file = path.join(root, 'qa/sprints', id + '.json');
    const bytes = fs.readFileSync(file);
    return { ...validate(JSON.parse(bytes)), configPath: `qa/sprints/${id}.json`, configHash: crypto.createHash('sha256').update(bytes).digest('hex') };
}
function fileOf(c) { return (c.location || c.file || '').replaceAll('\\', '/').replace(/^<repositorio>\//, '').replace(/:\d+(?::\d+)?$/, ''); }
function matchRef(ref, cases) {
    // No aceptar solo un ordinal: el orden de pruebas puede cambiar entre ejecuciones.
    return cases.find(c => c.suite === ref.suite && c.name === ref.name && fileOf(c) === ref.file);
}
function aggregate(states) {
    for (const s of ['FAIL', 'BLOCKED', 'NOT_RUN', 'SIN_EVIDENCIA']) if (states.includes(s)) return s;
    return states.length ? 'PASS' : 'SIN_EVIDENCIA';
}
function applyTraceability(model, config) {
    validate(config);
    const rows = [];
    for (const story of config.stories) for (const criterion of story.criteria) {
        const links = criterion.testRefs.map(ref => {
            const c = matchRef(ref, model.cases);
            return { configuredId: ref.id, id: c?.id || ref.id, name: ref.name, status: c?.status || 'NOT_RUN',
                evidence: c ? `${c.location}; ejecución ${model.metadata.id}; ${c.observed}` : 'No se encontró un resultado con la misma suite, nombre y archivo.' };
        });
        const testResult = aggregate(links.map(l => l.status));
        const status = testResult === 'PASS' && !criterion.coverageComplete ? 'SIN_EVIDENCIA' : testResult;
        rows.push({ storyId: story.id, storyTitle: story.title, functionality: story.functionality,
            id: criterion.id, criterion: criterion.text, sourceRef: criterion.sourceRef,
            implementation: criterion.implementation || 'No verificado en la referencia evaluada', links, testResult, status,
            evidence: [...links.map(l => l.evidence), ...criterion.evidence], observations: criterion.observations || '',
            coverageComplete: criterion.coverageComplete, pending: criterion.pending,
            plannedCase: criterion.plannedCase });
    }
    const regression = model.cases.filter(c => (config.regression?.testRefs || []).some(ref => matchRef(ref, [c])));
    const mapped = new Set(rows.flatMap(row => row.links.filter(l => l.status !== 'NOT_RUN').map(l => l.id)));
    const unmapped = model.cases.filter(c => !regression.includes(c) && !mapped.has(c.id));
    const counts = list => Object.fromEntries(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN', 'SIN_EVIDENCIA'].map(s => [s, list.filter(c => c.status === s).length]));
    const dod = config.dod.map(d => {
        let result = 'SIN_EVIDENCIA'; let evidence = 'No hay evidencia incorporada de esta verificación.';
        if (d.kind === 'applicable') evidence = 'Hay pruebas unitarias y HTTP con servicios simulados. No acreditan integración con BD real, E2E ni los criterios nuevos del Sprint.';
        if (d.kind === 'regression') evidence = `Evidencia parcial: ${regression.length} casos de regresión identificados, ${regression.filter(c => c.status === 'PASS').length} PASS y ${regression.filter(c => c.status === 'FAIL').length} FAIL. La ejecución está acreditada; la verificación de todo el incremento no lo está.`;
        if (d.kind === 'defects') evidence = `${model.findings.length} hallazgos documentados; las prioridades son sugeridas. No se acredita corrección de errores críticos ni cierre de criterios.`;
        if (d.kind === 'shared') evidence = 'Las ejecuciones usan servicios simulados; no verifican el ambiente compartido.';
        if (d.kind === 'branches') evidence = `Referencia de la evidencia: ${model.metadata.branch || 'No disponible'}, ${model.metadata.commit || 'No disponible'}. No se inspeccionaron otras ramas ni se acredita integración. Revisar la diferencia developer/development indicada en las fuentes.`;
        return { ...d, status: result, evaluation: evidence };
    });
    return { ...model, metadata: { ...model.metadata, sprint: `Sprint ${config.number}: ${config.title}`, sprintSource: config.sources.map(s => s.title).join('; ') },
        dod: dod.map(d => [d.text, `${d.status}: ${d.evaluation}`]),
        traceability: { configId: config.id, configPath: config.configPath, configHash: config.configHash, number: config.number, goal: config.goal,
            sources: config.sources, strategy: config.strategy, rows, totals: counts(rows),
            stories: config.stories.map(s => ({ id: s.id, title: s.title, status: aggregate(rows.filter(r => r.storyId === s.id).map(r => r.status)), businessRules: s.businessRules, dependencies: s.dependencies })),
            regression: { description: config.regression?.description || 'Regresión configurada.', totals: counts(regression), ids: regression.map(c => c.id) },
            unmappedIds: unmapped.map(c => c.id), openQuestions: config.openQuestions, dod, outOfScope: config.outOfScope,
            closure: 'NO ACREDITADO: una historia requiere todos sus criterios y el Sprint requiere además evidencia de la Definition of Done.' },
        pending: [...config.outOfScope, 'Implementación del alcance nuevo: No verificado en la referencia evaluada. Las funcionalidades futuras no se clasifican como defectos.',
            'Los requisitos y la estrategia proporcionados están incorporados. Continúan pendientes las evidencias de ejecución específicas, revisión por pares, PO, ambiente compartido e integración entre ramas.'] };
}
module.exports = { validate, loadSprint, applyTraceability, matchRef, aggregate };
