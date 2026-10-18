// Síntesis acotada; la evidencia completa permanece en Markdown y JSON.
const show = v => v == null || v === '' ? 'No disponible' : String(v);
const brief = (v, n = 260) => { const s = show(v); return s.length > n ? s.slice(0, n - 1) + '… [detalle en informe.md]' : s; };
function executiveBlocks(m) {
    const b = [], title = text => b.push({ type: 'title', text }), p = text => b.push({ type: 'paragraph', text });
    const table = (headers, rows) => b.push({ type: 'table', compact: true, headers, rows });
    const t = m.traceability;
    title('Hachi | Resumen ejecutivo');
    p('SEDA - Sistema de Equivalencias Académicas. Evaluación técnica; no equivale a aprobación del Sprint.');
    table(['Ejecución', 'Referencia'], [
        ['Sprint', brief(m.metadata.sprint, 110)], ['Fecha UTC', show(m.metadata.started)],
        ['Rama / commit evaluado', brief(m.metadata.branch, 80) + '\n' + show(m.metadata.commit)],
        ['Entorno', `${show(m.metadata.environment)}; ${show(m.metadata.platform)}; Node ${show(m.metadata.node)}`],
        ['Cambios locales', m.metadata.dirty ? 'Árbol con cambios sin commit; consultar execution.json.' : 'Sin cambios detectados.']
    ]);
    p(`Total: ${m.cases.length}. ${m.totals.PASS} PASS, ${m.totals.FAIL} FAIL, ${m.totals.BLOCKED} BLOCKED y ${m.totals.NOT_RUN} NOT_RUN.`);
    p('Estado: ' + (m.suites.some(s => s.status !== 'PASS') ? 'REQUIERE ATENCIÓN. Revisar fallos, bloqueos y suites incompletas.' : 'Pruebas seleccionadas satisfactorias; cobertura y aceptación pendientes.'));
    b.push({ type: 'chart', totals: m.totals });
    if (m.report) p('EVIDENCIA HISTÓRICA: ' + brief(m.report.note));
    title('Resultados y alcance');
    const groups = [['Regresión', m.cases.filter(c => t?.regression.ids.includes(c.id))],
        ...(t?.stories || []).map(s => [s.id, m.cases.filter(c => t.rows.filter(r => r.storyId === s.id).some(r => r.links.some(l => l.id === c.id)))])];
    table(['Alcance', 'Resultados'], groups.slice(0, 10).map(([name, cs]) => [name, `${cs.length} casos: ${cs.filter(c => c.status === 'PASS').length} PASS; ${cs.filter(c => c.status === 'FAIL').length} FAIL; ${cs.filter(c => c.status === 'BLOCKED').length} BLOCKED; ${cs.filter(c => c.status === 'NOT_RUN').length} NOT_RUN`]));
    if (groups.length > 10) p(`${groups.length - 10} grupos adicionales: ver informe.md. No se excluyen de los totales.`);
    table(['Suite', 'Estado / salida'], m.suites.slice(0, 6).map(s => [s.suite, `${s.status}; código ${show(s.exitCode)}`]));
    p('Pruebas del equipo: esta ejecución del generador no recopila sus resultados. Consultar la etapa test:team del mismo CI; no se reutilizan resultados históricos como actuales.');
    p('PASS acredita aserciones con servicios simulados. FAIL indica una aserción incumplida; BLOCKED, un impedimento de infraestructura; NOT_RUN, ausencia de ejecución. SIN_EVIDENCIA se aplica a cobertura o aceptación no acreditada.');
    if (m.findings.length) title('Defectos y recomendaciones');
    else b.push({ type: 'heading', text: 'Defectos y recomendaciones' });
    p(`Hallazgos activos: ${m.findings.length}. Se resumen hasta tres; ${Math.max(0, m.findings.length - 3)} quedan fuera de esta síntesis y están completos en informe.md y results.json.`);
    const ranked = [...m.findings].sort((a, c) => Number(!/Alta|Crítica/i.test(a.priority)) - Number(!/Alta|Crítica/i.test(c.priority)));
    for (const f of ranked.slice(0, 3)) {
        b.push({ type: 'heading', text: `${f.id} | ${brief(f.priority, 30)} | ACTIVO` });
        p(brief(f.title, 110) + '. Componente: ' + brief(f.component, 100));
        const c = m.cases.find(c => f.tests.includes(c.id));
        p('Esperado: ' + brief(c?.expected, 160) + '\nObtenido: ' + brief(c?.observed || f.verified, 160));
        p('Causa: ' + brief(f.cause, 140) + '\nRecomendación: ' + brief(f.recommendation, 160));
        p('Verificación: repetir ' + brief(f.tests.join(', '), 90) + ' y regresión. Prioridad sugerida; requiere revisión del equipo.');
    }
    if (!m.findings.length) p('No hay defectos activos derivados de FAIL en esta ejecución. Esto no acredita ausencia de defectos en áreas no cubiertas ni aprobación de cambios de producción.');
    title('Historias y criterios');
    p('Matriz resumida. Los textos originales, reglas y pruebas individuales permanecen íntegros en informe.md. Ninguna prueba API acredita tiempos ni navegación E2E.');
    table(['Criterio', 'Pruebas / cobertura'], (t?.rows || []).slice(0, 12).map(r => [r.id, `${r.testResult}; ${r.links.length} pruebas vinculadas. Estado: ${r.status}. ${r.coverageComplete ? 'Cobertura declarada completa, sujeta a evidencia.' : 'Cobertura parcial.'}`]));
    if ((t?.rows.length || 0) > 12) p(`${t.rows.length - 12} criterios adicionales detallados en Markdown; sus estados no se consideran aprobados por omisión.`);
    for (const r of (t?.rows || []).filter(r => r.proposal).slice(0, 3)) p(`${r.id}: ${r.proposal.status}. La propuesta no aprueba retroactivamente el criterio original; requiere validación formal del Product Owner.`);
    p('Pendientes comunes: navegación y mensajes en navegador, tiempos E2E, ambiente compartido autorizado, revisión por pares y Product Owner.');
    title('Definition of Done y próximos pasos');
    table(['Criterio de la estrategia', 'Evaluación'], (t?.dod || []).slice(0, 8).map(d => [brief(d.text, 160), `${d.status === 'PASS' ? 'Cumplido' : d.status === 'FAIL' ? 'No cumplido' : 'Sin evidencia completa'}. ${brief(d.evaluation, 170)}`]));
    if ((t?.dod.length || 0) > 8) p(`${t.dod.length - 8} criterios DoD adicionales en Markdown.`);
    p(brief(t?.closure || 'Sprint no acreditado: faltan evidencias de cobertura y aceptación.', 240));
    p('Acciones: revisar fallos y bloqueos, validar correcciones por pares, repetir pruebas afectadas, completar E2E y solicitar aceptación del PO. No se modifica producción automáticamente.');
    p('Evidencia completa: informe.md, results.json, execution.json, unit.jsonl y api.jsonl. Esta síntesis omite el listado individual de PASS; no elimina ningún resultado.');
    return b;
}
function countPdfPages(file) {
    // PDFKit emite cada diccionario /Type /Page sin comprimir; no contar /Pages.
    return (require('node:fs').readFileSync(file).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}
module.exports = { executiveBlocks, countPdfPages };
