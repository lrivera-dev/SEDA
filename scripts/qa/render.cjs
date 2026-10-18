const fs = require('node:fs');
const path = require('node:path');
const { finished } = require('node:stream/promises');

const display = value => value === undefined || value === null || value === '' ? 'No disponible' : String(value);
function documentBlocks(m) {
    const blocks = [];
    const title = text => blocks.push({ type: 'title', text });
    const p = text => blocks.push({ type: 'paragraph', text });
    const table = (headers, rows) => blocks.push({ type: 'table', headers, rows });
    const h = text => blocks.push({ type: 'heading', text });
    title('A. Portada');
    h('SEDA - Sistema de Equivalencias Académicas');
    h('Hachi - Agente de Quality Assurance');
    p('Informe automatizado de calidad y regresión');
    table(['Dato', 'Evidencia'], [
        ['Sprint evaluado', m.metadata.sprint], ['Fecha de inicio (UTC)', m.metadata.started], ['Fecha de fin (UTC)', m.metadata.finished],
        ['Rama', display(m.metadata.branch)], ['Commit base', display(m.metadata.commit)],
        ['Cambios sin commit', m.metadata.dirty ? 'Sí. Se evaluó el árbol de trabajo; el commit no representa por sí solo todos los archivos ejecutados.' : 'No detectados.'],
        ['Entorno', `${m.metadata.environment}; ${m.metadata.platform}; Node.js ${m.metadata.node}`], ['Identificador', m.metadata.id]
    ]);
    p(m.metadata.sprintSource);
    if (m.report?.mode === 'HISTORICO_REGENERADO') {
        h('EVIDENCIA HISTÓRICA - NO ES UNA NUEVA EJECUCIÓN');
        p(m.report.note);
        p(`Fecha de regeneración (UTC): ${m.report.generatedAt}. Ejecución original: ${m.report.sourceExecutionId}.`);
    }
    title('B. Resumen ejecutivo');
    const attempted = m.totals.PASS + m.totals.FAIL + m.totals.BLOCKED;
    p(`Se registraron ${m.cases.length} casos individuales: ${attempted} intentados, ${m.totals.PASS} PASS, ${m.totals.FAIL} FAIL, ${m.totals.BLOCKED} BLOCKED y ${m.totals.NOT_RUN} NOT_RUN. BLOCKED identifica impedimentos de infraestructura; NOT_RUN identifica casos omitidos o sin resultado final.`);
    p('Estado general: ' + (m.suites.some(s => ['FAIL', 'BLOCKED'].includes(s.status)) ? 'EJECUCIÓN NO SATISFACTORIA; requiere atención.' : m.suites.some(s => s.status === 'NOT_RUN') ? 'EJECUCIÓN PARCIAL; existen suites o casos no ejecutados.' : 'Las pruebas seleccionadas terminaron sin fallos; esto no certifica todo el sistema.'));
    table(['Suite', 'PASS', 'FAIL', 'BLOCKED', 'NOT_RUN', 'Estado'], m.suites.map(s => [s.suite, ...['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].map(k => s.totals[k]), s.status]));
    blocks.push({ type: 'chart', totals: m.totals });
    p('Funcionalidades evaluadas: ' + [...new Set(m.cases.filter(c => c.status !== 'NOT_RUN').map(c => c.functionality))].join(', ') + '.');
    p(`${m.findings.length} hallazgos agrupados a partir de pruebas FAIL. ` + (m.findings.map(f => `${f.id}: ${f.title}`).join('; ') || 'No hay hallazgos FAIL identificados; revisar también bloqueos y alcance.'));
    for (const s of m.suites) p(`Suite ${s.suite}: salida del proceso ${display(s.exitCode)}. ${s.reason || 'Resultados individuales recibidos.'} ${s.stderrBytes ? 'Hubo salida stderr no publicada; revisar el ejecutor si la evidencia estructurada es insuficiente.' : ''}`);
    title('C. Pruebas exitosas');
    p('PASS significa que las aserciones de ese caso se cumplieron con los datos y servicios simulados de esta ejecución. No se infieren valores de respuestas que el ejecutor no registró.');
    for (const c of m.cases.filter(c => c.status === 'PASS')) {
        h(`${c.id} | PASS | ${c.name}`);
        p(`Funcionalidad: ${c.functionality}. El nombre del caso identifica el comportamiento comprobado.`);
        if (m.traceability) p('Alcance: ' + (m.traceability.regression.ids.includes(c.id) ? 'regresión de funcionalidades anteriores.' : m.traceability.rows.some(r => r.links.some(l => l.id === c.id)) ? 'criterios vinculados en la matriz del Sprint.' : 'sin clasificación; no acredita historias del Sprint.'));
        p(`Esperado: ${c.expected}`);
        p(`Obtenido: ${c.observed}`);
        p(`Fuente: ${c.location}. Duración: ${display(c.durationMs)} ms.`);
    }
    if (!m.totals.PASS) p('No se registraron casos PASS.');
    title('D. Errores y pruebas fallidas');
    for (const f of m.findings) {
        h(`${f.id} | ${f.title}`);
        p(`Prioridad: ${f.priority}. Componente: ${f.component}.`);
        p(`Explicación: ${f.explanation}`);
        p(`Evidencia verificada: ${f.verified}`);
        p(`Causa: ${f.cause}`);
        p(`Consecuencias: ${f.consequence}`);
        for (const c of m.cases.filter(c => f.tests.includes(c.id))) {
            h(`${c.id} | FAIL | ${c.name}`);
            p(`Funcionalidad: ${c.functionality}. Se intentó comprobar: ${c.behavior}.`);
            p(`Esperado: ${c.expected}`);
            p(`Obtenido: ${c.observed}`);
            p(`Prueba: ${c.location}. Componente relacionado: ${f.component}.`);
            const err = c.error?.cause || c.error;
            blocks.push({ type: 'evidence', text: err ? `${err.code || err.name || 'Error'}: ${err.message || 'Sin mensaje'}\n${(err.stack || '').split('\n').slice(0, 5).join('\n')}` : 'Sin evidencia adicional; requiere investigación.' });
        }
    }
    if (!m.findings.length) p('No se registraron hallazgos FAIL. Consultar bloqueos y pruebas no ejecutadas.');
    title('E. Posibles soluciones');
    p('Recomendaciones para revisión del equipo; este generador no modifica código de producción.');
    for (const f of m.findings) {
        h(`${f.id} | ${f.priority}`);
        p(`Qué corregir: ${f.recommendation}`);
        p(`Por qué: ${f.rationale}`);
        p(`Revisar: ${f.component}. Repetir: ${f.tests.join(', ')} y ambas suites de regresión.`);
        p(`Posibles áreas relacionadas: ${f.related}`);
    }
    if (!m.findings.length) p('Sin correcciones derivadas de FAIL. Esto no elimina las verificaciones pendientes.');
    title('F. Pruebas pendientes');
    for (const c of m.cases.filter(c => ['BLOCKED', 'NOT_RUN'].includes(c.status))) {
        h(`${c.id} | ${c.status} | ${c.name}`); p(`${c.observed} Fuente: ${c.location}. Dependencia/acción: revisar el impedimento antes de repetir el caso; no se asume un defecto de producción.`);
    }
    for (const s of m.suites.filter(s => ['BLOCKED', 'NOT_RUN'].includes(s.status))) p(`Suite ${s.suite}: ${s.status}. ${s.reason || 'Revisar casos individuales.'} Una suite no descubierta no aporta una cantidad ficticia de pruebas a los totales.`);
    if (!m.totals.BLOCKED && !m.totals.NOT_RUN) p('No se registraron casos individuales bloqueados ni omitidos; esto no implica que todos los requisitos del producto estén cubiertos.');
    m.pending.forEach(p);
    title('G. Definition of Done');
    p('La estrategia y los criterios se evalúan desde la configuración de trazabilidad. Si no se suministra configuración, esa fuente no está incorporada a este informe automatizado; esto no significa que el equipo no haya proporcionado documentos.');
    table(['Criterio', 'Evaluación según evidencia disponible'], m.dod);
    p('No se declara el Sprint terminado. La validación del Product Owner y las verificaciones externas permanecen pendientes.');
    title('H. Conclusiones');
    p(`Resultado: ${m.totals.PASS} PASS, ${m.totals.FAIL} FAIL, ${m.totals.BLOCKED} BLOCKED y ${m.totals.NOT_RUN} NOT_RUN. Hallazgos prioritarios: ${m.findings.filter(f => f.priority.startsWith('Alta')).map(f => f.id).join(', ') || 'No identificados con evidencia suficiente'}.`);
    p('Acciones: revisar los hallazgos, autorizar las correcciones necesarias y repetir los casos afectados junto con ambas suites. Resolver primero cualquier bloqueo de infraestructura.');
    m.limitations.forEach(p);
    p('Trazabilidad: execution.json conserva eventos por suite; results.json contiene el modelo normalizado y los diagnósticos; unit.jsonl/api.jsonl conservan eventos individuales sanitizados de las suites seleccionadas.');
    if (!m.traceability) return blocks;
    const t = m.traceability;
    // Reordenar el contenido existente sin perder el detalle técnico de cada caso.
    const sections = [];
    for (const b of blocks) { if (b.type === 'title') sections.push([]); sections.at(-1).push(b); }
    const summary = sections[1].filter(b => b.type !== 'paragraph' || !b.text.startsWith('Suite ') && !b.text.startsWith(`${m.findings.length} hallazgos agrupados`));
    summary.push({ type: 'heading', text: 'Problemas principales y soluciones recomendadas' });
    for (const f of m.findings) summary.push({ type: 'paragraph', text: `${f.id}: ${f.explanation} Recomendación: ${f.recommendation}` });
    summary.push({ type: 'paragraph', text: `Alcance nuevo: ${t.rows.length} criterios de ${t.stories.map(s => s.id).join(', ')}; ${t.totals.PASS} PASS, ${t.totals.FAIL} FAIL, ${t.totals.BLOCKED} BLOCKED, ${t.totals.NOT_RUN} NOT_RUN y ${t.totals.SIN_EVIDENCIA} SIN_EVIDENCIA. Los resultados de regresión no aprueban estas historias.` });
    summary.push({ type: 'paragraph', text: `Definition of Done: ${t.closure} Prioridades: verificar el alcance en la referencia autorizada, ejecutar los casos específicos y aportar revisión por pares, PO, ambiente compartido e integración.` });
    if (m.report) summary.splice(1, 0, { type: 'paragraph', text: 'LECTURA HISTÓRICA: los resultados corresponden a la fecha de ejecución de la portada, no a la fecha de generación del informe.' });
    summary.push({ type: 'paragraph', text: `Pruebas del Sprint vinculadas: ${t.sprintCases.ids.length}; ${t.sprintCases.totals.PASS} PASS y ${t.sprintCases.totals.FAIL} FAIL. Regresión previa en esta ejecución: ${t.regression.ids.length} casos (catálogo independiente; no se reutilizan resultados históricos).` });
    for (const r of t.rows.filter(r => r.proposal)) {
        summary.push({ type: 'heading', text: `${r.id}: propuesta ${r.proposal.status}` });
        summary.push({ type: 'paragraph', text: `Original vigente: ${r.criterion}` });
        summary.push({ type: 'paragraph', text: `Propuesta: ${r.proposal.text} Valor: ${r.proposal.rationale}` });
        summary.push({ type: 'paragraph', text: r.proposal.history });
    }
    const sprint = [{ type: 'title', text: 'C. Evaluación del Sprint y criterios de aceptación' },
        { type: 'paragraph', text: `Objetivo: ${t.goal}` },
        { type: 'paragraph', text: 'PASS/FAIL proceden exclusivamente de casos ejecutados y vinculados por suite, nombre y archivo. BLOCKED expresa impedimentos de ejecución; NOT_RUN, pruebas planificadas sin resultado. SIN_EVIDENCIA indica ausencia de pruebas vinculadas o cobertura incompleta del criterio. Una historia exige todos sus criterios; el cierre del Sprint requiere además la DoD.' },
        { type: 'table', headers: ['Historia', 'Resultado de criterios', 'Implementación'], rows: t.stories.map(s => [s.id + ': ' + s.title, s.status, 'No verificado en la referencia evaluada']) },
        { type: 'paragraph', text: `Regresión separada: ${t.regression.ids.length} casos vinculados; ${t.regression.totals.PASS} PASS, ${t.regression.totals.FAIL} FAIL. ${t.regression.description}` },
        { type: 'paragraph', text: `Casos sin clasificación de alcance: ${t.unmappedIds.join(', ') || 'Ninguno'}. No se asignan automáticamente a historias.` }];
    for (const story of t.stories) sprint.push({ type: 'matrix', text: `${story.id}: ${story.title}`, headers: ['Historia / CA', 'Criterio de aceptación original', 'Implementación conocida', 'Pruebas relacionadas', 'Resultado / estado', 'Evidencia', 'Observaciones', 'Pendientes'],
        rows: t.rows.filter(r => r.storyId === story.id).map(r => [r.id, r.criterion, r.implementation,
            r.links.map(l => l.configuredId).join(', ') || 'Ninguna automatizada vinculada',
            `${r.status}\nPruebas: ${r.testResult}`, (r.links.length ? `Ejecución ${m.metadata.id}. Detalle individual y fuente de cada prueba en anexos. ` + r.links.map(l => `${l.configuredId} ${l.status}`).join('; ') : r.evidence.join('\n')) || `Sin evidencia de ejecución. Fuente del requisito: ${r.sourceRef}`,
            r.observations + (r.proposal ? ` Propuesta ${r.proposal.status}; no acredita CA original.` : '') + (!r.coverageComplete ? ' Cobertura completa no acreditada.' : ''), `${r.pending.join(' ')} Caso propuesto: ${r.plannedCase?.id || 'No definido'} (no ejecutado).`]) });
    const dod = [{ type: 'title', text: 'D. Definition of Done' },
        { type: 'paragraph', text: 'Se incorporan los siete criterios de la estrategia del equipo (sección 5, páginas 3-4). Los documentos están disponibles; lo pendiente es la evidencia de cumplimiento.' },
        { type: 'table', compact: true, headers: ['Criterio original', 'Evaluación y evidencia'], rows: t.dod.map(d => [d.text, `${d.status}: ${d.evaluation}\nFuente: ${d.sourceRef}`]) }];
    const conclusion = [...sections[7]]; conclusion[0] = { type: 'title', text: 'E. Conclusiones y acciones' };
    conclusion.push({ type: 'paragraph', text: `Historias: ${t.stories.map(s => `${s.id} ${s.status}`).join('; ')}. Ningún dato permite afirmar que las funcionalidades pendientes sean defectos o que el Sprint esté terminado.` });
    const sources = [{ type: 'title', text: 'F. Fuentes, reglas y casos propuestos' }];
    for (const s of t.sources) sources.push({ type: 'paragraph', text: `${s.id}: ${s.title}. ${s.incorporation} SHA-256: ${s.sha256}` });
    sources.push({ type: 'paragraph', text: `Configuración: ${t.configPath || t.configId}; SHA-256: ${t.configHash || 'No disponible'}.` });
    for (const question of t.openQuestions) sources.push({ type: 'paragraph', text: `${question.id}: ${question.text} Fuente: ${question.sourceRef}. Pendiente de aclaración; no se modificaron requisitos.` });
    for (const s of t.stories) {
        sources.push({ type: 'heading', text: s.id + ': reglas de negocio' });
        for (const r of s.businessRules) sources.push({ type: 'paragraph', text: `${r.id}: ${r.text} (${r.sourceRef})` });
        for (const row of t.rows.filter(r => r.storyId === s.id)) {
            const plan = row.plannedCase;
            if (plan) sources.push({ type: 'paragraph', text: `${plan.id} - PROPUESTO, NO EJECUTADO. ${plan.steps.join('. ')}. Resultado esperado: criterio ${row.id} transcrito en la matriz; no es evidencia de aprobación.` });
        }
    }
    t.outOfScope.forEach(text => sources.push({ type: 'paragraph', text: 'Fuera de alcance: ' + text }));
    const technical = [sections[2], sections[3], sections[4], sections[5]].map((s, i) => [{ type: 'title', text: ['Anexo 1. Pruebas aprobadas: detalle individual', 'Anexo 2. Fallos y evidencia técnica', 'Anexo 3. Recomendaciones técnicas', 'Anexo 4. Pruebas pendientes'][i] }, ...s.slice(1)]);
    return [...sections[0], ...summary, ...sprint, ...dod, ...conclusion, ...sources, ...technical.flat()];
}
const mdText = s => display(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const mdCell = s => mdText(s).replaceAll('|', '\\|').replaceAll('\n', '<br>');
function markdown(blocks) {
    return blocks.map(b => {
        if (b.type === 'title') return '# ' + mdText(b.text);
        if (b.type === 'heading') return '## ' + mdText(b.text);
        if (b.type === 'paragraph') return mdText(b.text);
        if (b.type === 'evidence') return '```text\n' + b.text.replaceAll('```', "'''") + '\n```';
        if (b.type === 'table' || b.type === 'matrix') return (b.type === 'matrix' ? '## ' + mdText(b.text) + '\n\n' : '') + '| ' + b.headers.map(mdCell).join(' | ') + ' |\n|' + b.headers.map(() => '---').join('|') + '|\n' + b.rows.map(r => '| ' + r.map(mdCell).join(' | ') + ' |').join('\n');
        const total = Object.values(b.totals).reduce((a, n) => a + n, 0);
        return '```text\n' + Object.entries(b.totals).map(([s, n]) => `${s.padEnd(8)} ${'#'.repeat(total ? Math.round(30 * n / total) : 0).padEnd(30)} ${n}`).join('\n') + '\n```';
    }).join('\n\n') + '\n';
}
async function pdf(blocks, file) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margins: { top: 58, bottom: 58, left: 48, right: 48 }, bufferPages: true,
        info: { Title: 'SEDA - Informe automatizado de calidad', Author: 'Hachi - QA' } });
    const stream = fs.createWriteStream(file);
    const completion = finished(stream);
    doc.on('error', error => stream.destroy(error));
    doc.pipe(stream);
    const width = 499, bottom = 775;
    const colors = { PASS: '#18806b', FAIL: '#b23a48', BLOCKED: '#a46b10', NOT_RUN: '#63748a' };
    function ensure(height) { if (doc.y + height > bottom) doc.addPage(); }
    function text(value, size = 10, bold = false, color = '#26364b') {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
        const height = doc.heightOfString(value, { width, lineGap: 3 });
        ensure(height + 8);
        doc.fillColor(color).text(value, 48, doc.y, { width, lineGap: 3 });
        doc.moveDown(0.5);
    }
    let first = true;
    for (let index = 0; index < blocks.length; index++) {
        const b = blocks[index];
        if (b.type === 'title') {
            if (!first) doc.addPage({ size: 'A4', layout: 'portrait', margins: { top: 58, bottom: 58, left: 48, right: 48 } });
            first = false;
            doc.rect(48, doc.y, width, 4).fill('#18806b'); doc.y += 17;
            text(b.text, 22, true, '#132a46');
        } else if (b.type === 'heading') {
            // Mantener cada ficha de prueba en una página cuando cabe completa.
            doc.font('Helvetica-Bold').fontSize(12);
            let groupHeight = doc.heightOfString(b.text, { width, lineGap: 3 }) + 12;
            for (let j = index + 1; j < blocks.length && ['paragraph', 'evidence'].includes(blocks[j].type); j++) {
                doc.font('Helvetica').fontSize(blocks[j].type === 'evidence' ? 8 : 10);
                groupHeight += doc.heightOfString(blocks[j].text, { width, lineGap: 3 }) + 12;
            }
            ensure(Math.min(groupHeight, bottom - 58)); text(b.text, 12, true, '#132a46');
        }
        else if (b.type === 'paragraph') text(b.text);
        else if (b.type === 'evidence') text(b.text, 8, false, '#526075');
        else if (b.type === 'matrix') {
            const widths = [56, 165, 84, 72, 79, 99, 91, 99];
            const totalWidth = widths.reduce((a, n) => a + n, 0), limit = 535;
            const plain = value => display(value).replaceAll('**', '').replaceAll('`', '');
            function matrixPage() {
                doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 58, bottom: 58, left: 48, right: 48 } });
                doc.font('Helvetica-Bold').fontSize(14).fillColor('#132a46').text(b.text, 48, 55, { width: totalWidth });
                doc.moveDown(0.6); matrixRow(b.headers, true);
            }
            function matrixRow(values, header) {
                doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
                const height = Math.max(...values.map((v, i) => doc.heightOfString(plain(v), { width: widths[i] - 12, lineGap: 2 }))) + 16;
                if (height > 390) throw new Error('Fila de matriz demasiado alta: dividir el criterio en presentación sin alterar el texto fuente.');
                if (!header && doc.y + height > limit) matrixPage();
                // El encabezado repetido cambia la fuente: restaurarla para los datos.
                doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
                const y = doc.y; let x = 48;
                doc.rect(x, y, totalWidth, height).fill(header ? '#18334f' : '#f0f4f7');
                values.forEach((v, i) => { doc.fillColor(header ? '#ffffff' : '#26364b').text(plain(v), x + 6, y + 8, { width: widths[i] - 12, lineGap: 2 }); x += widths[i]; });
                doc.y = y + height + 2;
            }
            matrixPage(); b.rows.forEach(r => matrixRow(r, false));
        }
        else if (b.type === 'chart') {
            const total = Object.values(b.totals).reduce((a, n) => a + n, 0); ensure(120);
            for (const [status, n] of Object.entries(b.totals)) {
                const y = doc.y;
                doc.font('Helvetica-Bold').fontSize(9).fillColor(colors[status]).text(status, 48, y, { lineBreak: false });
                doc.rect(115, y, 340, 11).fill('#edf1f5');
                if (total && n) doc.rect(115, y, 340 * n / total, 11).fill(colors[status]);
                doc.fillColor('#26364b').text(String(n), 470, y, { lineBreak: false });
                doc.y = y + 26;
            }
        } else if (b.type === 'table') {
            const widths = b.headers.length === 2 ? [210, 289] : b.headers.length === 3 ? [180, 139, 180] : [79, 68, 68, 88, 88, 108];
            function row(values, header) {
                doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(b.compact ? 8.5 : 9);
                const height = Math.max(...values.map((v, i) => doc.heightOfString(display(v), { width: widths[i] - 14, lineGap: 2 }))) + (b.compact ? 14 : 18);
                if (doc.y + height > bottom) { doc.addPage(); if (!header) row(b.headers, true); }
                doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(b.compact ? 8.5 : 9);
                const y = doc.y; let x = 48;
                doc.rect(x, y, width, height).fill(header ? '#18334f' : '#f0f4f7');
                values.forEach((v, i) => {
                    doc.fillColor(header ? '#ffffff' : '#26364b').text(display(v), x + 7, y + 8, { width: widths[i] - 14, lineGap: 2 }); x += widths[i];
                });
                doc.y = y + height + 2;
            }
            row(b.headers, true); b.rows.forEach(r => row(r, false)); doc.moveDown(0.7);
        }
    }
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(8).fillColor('#63748a');
        doc.text('SEDA / HACHI - Informe de calidad', 48, 28, { lineBreak: false });
        doc.text(`Página ${i + 1} de ${range.count}`, doc.page.width - 155, doc.page.height - 33, { lineBreak: false });
    }
    doc.end();
    await completion;
}
async function generate(model, directory, renderPdf = pdf) {
    const blocks = documentBlocks(model);
    fs.writeFileSync(path.join(directory, 'informe.md'), markdown(blocks));
    // PDF se publica con su nombre final solo después de terminar el stream.
    const temporary = path.join(directory, 'informe.pdf.partial');
    try { await renderPdf(blocks, temporary); fs.renameSync(temporary, path.join(directory, 'informe.pdf')); }
    catch (error) { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); throw error; }
}
module.exports = { documentBlocks, markdown, generate };
