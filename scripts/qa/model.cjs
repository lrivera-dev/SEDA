const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./sanitize.cjs');
const statuses = ['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'];
const tally = cases => Object.fromEntries(statuses.map(s => [s, cases.filter(c => c.status === s).length]));
function sourceLine(file, text) {
    try { return fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).findIndex(line => line.includes(text)) + 1; }
    catch { return 0; }
}
function errorChain(error) {
    const chain = []; let e = error;
    while (e && typeof e === 'object' && chain.length < 8) { chain.push(e); e = e.cause; }
    return chain;
}
function expected(name, suite) {
    if (/^HU6-/.test(name)) return 'Comportamiento HU-6 indicado en el nombre y las aserciones del caso. CA3 propuesto no equivale a aprobación del contrato original.';
    if (/materias iguales|tipo .*debe producir|tipo incorrecto/.test(name)) return 'Rechazo de validación con estado HTTP 400 y mensaje de error.';
    if (/duplicada/.test(name)) return 'HTTP 409 con mensaje de universidad ya registrada.';
    if (/sin permiso/.test(name)) return 'HTTP 403 por falta de permiso sobre la materia de origen.';
    if (/error de búsqueda|error del servicio|error de almacenamiento|identificador rechazado/.test(name)) return 'HTTP 500 y propagación del mensaje de error simulado del servicio.';
    if (/error de Auth/.test(name)) return 'HTTP 400 y mensaje del error de Auth simulado.';
    if (/datos válidos|registro válido/.test(name)) return /equivalencia/.test(name)
        ? 'HTTP 201 y datos del registro; la prueba unitaria comprueba inserción en estado PENDIENTE.'
        : 'HTTP 201 y datos de la universidad registrada.';
    if (/válido/.test(name) && /archivo/.test(name)) return suite === 'unit'
        ? 'Continuar la cadena de middleware; DOCX incluye advertencia de lectura.'
        : 'HTTP 201 con mensaje y ruta de carga; DOCX incluye advertencia de lectura.';
    if (/archivo|vacío|ausentes|falta |inexistente|Falta |Debe indicar/.test(name)) return 'HTTP 400 con el mensaje o listado de validación indicado por las aserciones del caso.';
    return 'Cumplir las aserciones del caso indicado; consultar su archivo de prueba.';
}
function buildModel(raw) {
    const cases = [], suites = [];
    for (const run of raw.suites) {
        const completed = new Set(); const local = [];
        const identity = d => `${d.file}:${d.line}:${d.name}`;
        for (const event of run.events) {
            if (!['test:pass', 'test:fail'].includes(event.type)) continue;
            const d = event.data;
            completed.add(identity(d));
            if (d.details?.type === 'suite' || /subtestsFailed/.test(d.details?.error?.failureType || '') || /\.test\.cjs$/.test(d.name)) continue;
            const chain = errorChain(d.details?.error);
            const blocked = chain.some(e => ['EACCES', 'EPERM', 'ENOENT', 'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(e.code) || /connect (?:EACCES|EPERM)/.test(e.message || ''));
            const status = d.skip || d.todo ? 'NOT_RUN' : blocked ? 'BLOCKED' : event.type === 'test:pass' ? 'PASS' : 'FAIL';
            const assertion = [...chain].reverse().find(e => e.actual !== undefined || e.expected !== undefined);
            const location = `${d.file || 'Archivo no disponible'}:${d.line || '?'}${d.column ? ':' + d.column : ''}`;
            const c = { id: `${run.suite.toUpperCase()}-${String(local.length + 1).padStart(3, '0')}`, suite: run.suite,
                name: d.name, status, functionality: /^HU6-/.test(d.name) ? 'HU-6: autenticación y autorización MINED' : /^\/?universidad/.test(d.name) ? 'Universidades' : /^\/?equivalencia/.test(d.name) ? 'Equivalencias' : /^\/?archivo/.test(d.name) ? 'Archivos' : 'Otra',
                behavior: d.name, expected: expected(d.name, run.suite), location, durationMs: d.details?.duration_ms,
                observed: status === 'PASS' ? 'PASS confirmado por node:test; no se registraron valores de respuesta adicionales.'
                    : assertion ? `Esperado: ${JSON.stringify(assertion.expected)}; obtenido: ${JSON.stringify(assertion.actual)}.`
                    : [...new Set(chain.map(e => e.message).filter(Boolean))].join(' | ') || String(d.skip || d.todo || 'Sin evidencia suficiente; requiere investigación.'),
                error: d.details?.error || null, reason: d.skip || d.todo || null };
            local.push(c);
        }
        for (const event of run.events) {
            const d = event.data;
            if (event.type !== 'test:enqueue' || completed.has(identity(d)) || /\.test\.cjs$/.test(d.name)) continue;
            local.push({ id: `${run.suite.toUpperCase()}-P${local.length + 1}`, suite: run.suite, name: d.name, status: 'NOT_RUN',
                functionality: 'No determinada', behavior: d.name, expected: expected(d.name, run.suite), observed: 'Descubierta sin resultado final; ejecución interrumpida o incompleta.', location: `${d.file}:${d.line || '?'}` });
        }
        const totals = tally(local);
        const status = run.notRun ? 'NOT_RUN' : run.infrastructure || (!local.length && run.exitCode !== 0) ? 'BLOCKED'
            : totals.FAIL ? 'FAIL' : totals.BLOCKED ? 'BLOCKED' : run.exitCode !== 0 ? 'FAIL' : totals.NOT_RUN ? 'NOT_RUN' : local.length ? 'PASS' : 'BLOCKED';
        suites.push({ suite: run.suite, status, exitCode: run.exitCode ?? null, totals,
            reason: run.notRun ? 'Suite no seleccionada; cantidad de casos no descubierta.' : run.infrastructure || (!local.length ? 'No se recibieron resultados individuales; requiere investigación.' : ''),
            stderrBytes: run.stderrBytes || 0 });
        cases.push(...local);
    }
    const groups = new Map();
    const uniFile = 'controllers/universidades.controller.js';
    const eqFile = 'controllers/equivalencias.controller.js';
    const uniLine = sourceLine(uniFile, 'datos[campo].trim()');
    const eqLine = sourceLine(eqFile, 'res.json(400).json');
    for (const c of cases.filter(c => c.status === 'FAIL')) {
        const evidence = JSON.stringify(c.error || {});
        let finding;
        if (uniLine && c.functionality === 'Universidades' && (/trim is not a function/.test(evidence) || /tipo incorrecto/.test(c.name) && /500/.test(c.observed))) {
            finding = { id: 'QA-001', title: 'Tipos incorrectos provocan una excepción al registrar universidades', priority: 'Alta (sugerida)',
                component: `${uniFile}:${uniLine}`, verified: 'El código invoca trim() sin comprobar el tipo. Los resultados y excepciones observados en esta ejecución se detallan por caso.',
                explanation: 'Una entrada que debería rechazarse como dato inválido interrumpe el registro con un error interno.',
                cause: /trim is not a function/.test(evidence) ? 'Verificada en código y ejecución: uso de trim() sobre valores no textuales.' : 'Hipótesis basada en el código: uso de trim() sobre un valor no textual. La respuesta HTTP 500 por sí sola no confirma la causa; revisar la traza o repetir la prueba unitaria.',
                consequence: 'El consumidor no recibe el error de validación esperado; el registro no se completa en estos casos.',
                recommendation: 'Validar el tipo de cada campo obligatorio antes de usar trim() y devolver HTTP 400 con los campos inválidos.',
                rationale: 'La comprobación de tipo evita la excepción y permite usar la respuesta de validación existente.',
                related: 'Revisar los demás campos obligatorios y el formulario que consume los errores de registro.' };
        } else if (eqLine && c.functionality === 'Equivalencias' && /materias iguales/.test(c.name) && /200/.test(c.observed)) {
            finding = { id: 'QA-002', title: 'Materias iguales reciben HTTP 200 en lugar de rechazo', priority: 'Alta (sugerida)',
                component: `${eqFile}:${eqLine}`, verified: 'Las aserciones observan estado 200 frente al 400 esperado. El código usa res.json(400).json(...) en esta rama.',
                explanation: 'La respuesta indica éxito HTTP aunque la solicitud incumple la regla de materias diferentes.',
                cause: 'Verificada en código: json(400) envía un cuerpo y no establece el estado HTTP de error.',
                consequence: 'Los clientes que interpretan el código HTTP pueden tratar una solicitud inválida como exitosa.',
                recommendation: 'Usar res.status(400).json(...) y enviar una sola respuesta de error.',
                rationale: 'Establecer el estado antes de serializar el mensaje expresa el rechazo correctamente.',
                related: 'Revisar consumidores del endpoint y otras ramas de respuesta; no se afirma que tengan el mismo defecto.' };
        } else finding = { id: `INV-${c.id}`, title: c.name, priority: 'Por determinar', component: c.location,
            verified: c.observed, explanation: 'El comportamiento comprobado no satisfizo las aserciones.', cause: 'Requiere investigación',
            consequence: 'No se puede confirmar el comportamiento evaluado.', recommendation: 'Requiere investigación: revisar la evidencia y reproducir el caso.',
            rationale: 'La evidencia disponible no permite identificar una corrección segura.', related: 'No determinado.' };
        if (!groups.has(finding.id)) groups.set(finding.id, { ...finding, tests: [] });
        groups.get(finding.id).tests.push(c.id);
    }
    return { schemaVersion: 1, metadata: raw.metadata, totals: tally(cases), suites, cases, findings: [...groups.values()],
        scope: ['Registro de universidades', 'Registro de equivalencias', 'Validaciones de archivos', 'Errores y respuestas HTTP'],
        limitations: ['Supabase Auth, Storage y persistencia son simulados; no se validaron datos reales, RLS ni el entorno compartido.',
            'Las pruebas PASS acreditan únicamente las aserciones ejecutadas. No certifican todo el sistema ni la finalización del Sprint.',
            'No se captura stdout/stderr arbitrario de la aplicación en los artefactos; se conserva evidencia de excepciones y aserciones estructuradas.',
            'Los diagnósticos conocidos usan firmas del código actual; los demás hallazgos requieren investigación. Las prioridades y soluciones son recomendaciones.'],
        pending: ['Consultar la configuración de trazabilidad del Sprint para determinar alcance y criterios. No se clasifican funcionalidades futuras como defectos.',
            'Las evidencias de pruebas manuales, revisión del Product Owner y ambiente compartido no se obtienen de estas suites simuladas.'],
        dod: [['Pruebas automatizadas correspondientes', 'Consultar resultados; no se acredita cobertura completa de requisitos.'],
            ['Regresión', 'Primera suite ejecutada; no equivale a regresión completa del sistema.'],
            ['Pruebas manuales por pares', 'Pendiente / sin evidencia.'], ['Validación del Product Owner', 'Pendiente / sin evidencia.'],
            ['Funcionamiento en entorno compartido', 'No verificado; se usan servicios simulados.'], ['Criterios de aceptación del Sprint', 'Consultar la configuración de trazabilidad; no se infiere aprobación desde la regresión.']] };
}
module.exports = { buildModel, tally };
