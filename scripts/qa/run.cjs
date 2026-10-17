const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { root, sanitize, serializable } = require('./sanitize.cjs');
const { buildModel } = require('./model.cjs');
const { generate } = require('./render.cjs');
const { loadSprint, applyTraceability } = require('./traceability.cjs');

function git(args) {
    try { return sanitize(execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); }
    catch { return 'No disponible'; }
}
async function execute(suite, directory) {
    const files = fs.readdirSync(path.join(root, 'tests', suite)).filter(f => f.endsWith('.test.cjs')).sort()
        .map(f => path.join('tests', suite, f));
    if (!files.length) return { suite, exitCode: null, events: [], infrastructure: 'No se encontraron archivos de pruebas.' };
    const args = ['--test', '--test-reporter=./scripts/qa/reporter.cjs', ...files];
    return new Promise(resolve => {
        const events = []; let partial = '', parseError = '', spawnError = '', stderrBytes = 0;
        const output = path.join(directory, `${suite}.jsonl`);
        fs.writeFileSync(output, '');
        const child = spawn(process.execPath, args, { cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        function consume(line) {
            if (!line.trim()) return;
            try {
                const event = JSON.parse(line);
                events.push(event);
                fs.appendFileSync(output, JSON.stringify(serializable(event)) + '\n');
            } catch { parseError = 'El reporter produjo un evento JSON no válido; requiere investigación.'; }
        }
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', chunk => {
            partial += chunk;
            let newline;
            while ((newline = partial.indexOf('\n')) >= 0) { consume(partial.slice(0, newline)); partial = partial.slice(newline + 1); }
        });
        child.stderr.on('data', chunk => { stderrBytes += chunk.length; });
        child.on('error', error => { spawnError = sanitize(`${error.code}: ${error.message}`); });
        child.on('close', (code, signal) => {
            consume(partial);
            resolve({ suite, exitCode: code, signal, events, stderrBytes,
                infrastructure: spawnError || parseError || (signal ? `Proceso interrumpido: ${signal}` : '') });
        });
    });
}
async function main() {
    const selection = process.argv[2] || 'all';
    if (!['unit', 'api', 'all'].includes(selection)) throw new Error('Uso: node scripts/qa/run.cjs [all|unit|api]');
    const started = new Date().toISOString();
    const id = started.replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
    const directory = path.join(root, 'qa-output', id);
    fs.mkdirSync(directory, { recursive: true });
    const metadata = { id, started, branch: process.env.GITHUB_HEAD_REF || git(['branch', '--show-current']),
        commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']).length > 0,
        node: process.version, platform: `${process.platform}/${process.arch}`,
        environment: process.env.GITHUB_ACTIONS === 'true' ? 'GitHub Actions' : 'Local' };
    const suites = [];
    for (const suite of ['unit', 'api']) {
        if (selection !== 'all' && selection !== suite) { suites.push({ suite, notRun: true, events: [] }); continue; }
        console.log(`Hachi: ejecutando suite ${suite}...`);
        try { suites.push(await execute(suite, directory)); }
        catch (error) { suites.push({ suite, exitCode: null, events: [], infrastructure: sanitize(error.message) }); }
    }
    const raw = serializable({ metadata: { ...metadata, finished: new Date().toISOString() }, suites });
    fs.writeFileSync(path.join(directory, 'execution.json'), JSON.stringify(raw, null, 2));
    let model;
    try {
        model = applyTraceability(buildModel(raw), loadSprint());
        fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(model, null, 2));
        await generate(model, directory);
    } catch (error) {
        fs.writeFileSync(path.join(directory, 'report-error.json'), JSON.stringify(serializable({ message: error.message, stack: error.stack }), null, 2));
        console.error('Falló el generador. Se conserva execution.json y cualquier resultado ya generado.');
        process.exitCode = 1;
    }
    if (model) {
        console.log(JSON.stringify({ totals: model.totals, suiteStatus: model.suites.map(s => ({ suite: s.suite, status: s.status, exitCode: s.exitCode })) }));
        if (model.suites.some(s => ['FAIL', 'BLOCKED'].includes(s.status))) process.exitCode = 1;
    }
    if (suites.some(s => !s.notRun && (s.exitCode !== 0 || s.infrastructure))) process.exitCode = 1;
    console.log(`Informes: ${path.relative(root, directory).replaceAll('\\', '/')}`);
}
if (require.main === module) main().catch(error => { console.error(sanitize(error.message)); process.exitCode = 1; });
module.exports = { execute };
