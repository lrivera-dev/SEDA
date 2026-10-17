const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { root, sanitize } = require('./sanitize.cjs');
const { loadSprint, applyTraceability } = require('./traceability.cjs');
const { generate } = require('./render.cjs');

async function main() {
    const [input, sprint] = process.argv.slice(2);
    if (!input) throw new Error('Uso: node scripts/qa/regenerate.cjs qa-output/<ejecución>/results.json [sprint-id]');
    const source = path.resolve(root, input);
    if (!source.startsWith(path.join(root, 'qa-output') + path.sep) || path.basename(source) !== 'results.json') throw new Error('Usar results.json dentro de qa-output/.');
    const bytes = fs.readFileSync(source), original = JSON.parse(bytes);
    if (!original.metadata?.id || !original.metadata.started || !Array.isArray(original.cases) || !Array.isArray(original.findings)) throw new Error('No es un resultado normalizado con procedencia.');
    // Conservar eventos, diagnósticos y fechas originales; no volver a analizar producción actual.
    const generatedAt = new Date().toISOString();
    const model = applyTraceability(original, loadSprint(sprint));
    model.report = { mode: 'HISTORICO_REGENERADO', generatedAt, sourceExecutionId: original.metadata.id,
        sourceResultsSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        note: 'Informe regenerado de evidencia histórica. No se ejecutaron nuevamente las pruebas; las fechas y el entorno evaluado corresponden a la ejecución original.' };
    const directory = path.join(root, 'qa-output', 'historico-' + generatedAt.replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex'));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(model, null, 2));
    fs.writeFileSync(path.join(directory, 'source-results.json'), bytes);
    await generate(model, directory);
    console.log(JSON.stringify({ directory: path.relative(root, directory), mode: model.report.mode, originalDate: original.metadata.started, totals: model.totals, criteria: model.traceability.totals }));
    if (model.suites.some(s => ['FAIL', 'BLOCKED'].includes(s.status))) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(sanitize(error.message)); process.exitCode = 1; });
