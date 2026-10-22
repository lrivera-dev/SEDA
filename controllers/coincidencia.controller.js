const supabase = require('../supabaseClient');
const colaEvaluacion = require('../servicios/cola-evaluacion');

const REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MENSAJE_NO_EXISTE = 'El caso indicado no existe.';
const MENSAJE_YA_REVISADO = 'Este caso ya fue revisado y no se puede recalcular';
const MENSAJE_EN_PROCESO = 'Este caso ya está calculado o en evaluación';

async function reintentarCoincidencia(req, res) {
    const { id_caso } = req.params;
    const { id_universidad } = req.body || {};

    // Sin universidad: 400
    if (id_universidad === undefined || id_universidad === null || id_universidad === '') {
        return res.status(400).json({ error: 'Debe indicar la universidad.' });
    }

    // Un id que no tiene formato de caso no puede existir: 404
    if (!REGEX_UUID.test(id_caso)) {
        return res.status(404).json({ error: MENSAJE_NO_EXISTE });
    }

    const { data: caso, error } = await supabase
        .from('caso_equivalencia')
        .select(
            `
            id_caso,
            estado,
            estado_calculo,
            materia_origen:materia!caso_equivalencia_id_materia_origen_fkey (
                carrera ( id_universidad )
            )
        `
        )
        .eq('id_caso', id_caso)
        .maybeSingle();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // Caso inexistente: 404
    if (!caso) {
        return res.status(404).json({ error: MENSAJE_NO_EXISTE });
    }

    // El caso no es de esa universidad: 403
    const universidadDelCaso = caso.materia_origen?.carrera?.id_universidad;
    if (String(universidadDelCaso) !== String(id_universidad)) {
        return res.status(403).json({
            error: 'La universidad indicada no tiene permiso sobre este caso.'
        });
    }

    // El MINED ya decidió (E4): 409
    if (caso.estado !== 'PENDIENTE') {
        return res.status(409).json({ error: MENSAJE_YA_REVISADO });
    }

    // Ya calculado o en evaluación: 409
    if (caso.estado_calculo === 'CALCULADO' || caso.estado_calculo === 'EN_CALCULO') {
        return res.status(409).json({ error: MENSAJE_EN_PROCESO });
    }

    try {
        colaEvaluacion.encolar(caso.id_caso);
    } catch (errorCola) {
        return res.status(500).json({ error: 'No se pudo poner el caso en la cola de evaluación.' });
    }

    return res.status(202).json({
        mensaje: 'El caso se puso en la cola de evaluación',
        id_caso: caso.id_caso
    });
}

module.exports = { reintentarCoincidencia };