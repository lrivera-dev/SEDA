const supabase = require('../supabaseClient');

const MIN_CARACTERES_OBSERVACION = 10;

const DECISIONES_VALIDAS = {
    ACEPTAR: {
        nuevoEstado: 'ACEPTADO',
        mensaje: 'Equivalencia aceptada'
    },
    ADVERTENCIA: {
        nuevoEstado: 'ADVERTENCIA',
        mensaje: 'Advertencia emitida'
    }
};

async function revisarCaso(req, res) {
    const { id_caso: idCaso } = req.params;
    const { decision, observacion } = req.body || {};

    // E1 / RN3: Validar que la decisión sea ACEPTAR o ADVERTENCIA
    if (!decision || !DECISIONES_VALIDAS[decision]) {
        return res.status(400).json({
            error: 'Debe elegir una decisión: Aceptar o emitir advertencia'
        });
    }

    // E2 / RN4: Validar observación obligatoria de mínimo 10 caracteres en ADVERTENCIA
    const observacionLimpia = typeof observacion === 'string' ? observacion.trim() : '';

    if (decision === 'ADVERTENCIA' && observacionLimpia.length < MIN_CARACTERES_OBSERVACION) {
        return res.status(400).json({
            error: 'Indica el motivo de la advertencia'
        });
    }

    // Verificar que el caso exista y consultar su estado actual
    const { data: casoActual, error: errorBusqueda } = await supabase
        .from('caso_equivalencia')
        .select('id_caso, estado')
        .eq('id_caso', idCaso)
        .maybeSingle();

    if (errorBusqueda) {
        return res.status(500).json({ error: errorBusqueda.message });
    }

    if (!casoActual) {
        return res.status(404).json({
            error: 'El caso indicado no existe.'
        });
    }

    // E3 / RN2: Solo los casos en estado PENDIENTE pueden revisarse
    if (casoActual.estado !== 'PENDIENTE') {
        return res.status(409).json({
            error: 'Este caso ya fue revisado'
        });
    }

    const { nuevoEstado, mensaje } = DECISIONES_VALIDAS[decision];

    // RN2 / RN5: Actualizar condicionando por estado = 'PENDIENTE' para evitar condición de carrera
    const { data: casoActualizado, error: errorActualizacion } = await supabase
        .from('caso_equivalencia')
        .update({
            estado: nuevoEstado,
            observacion_revision: observacionLimpia || null,
            id_revisor: req.usuario.id,
            fecha_revision: new Date().toISOString()
        })
        .eq('id_caso', idCaso)
        .eq('estado', 'PENDIENTE')
        .select()
        .maybeSingle();

    if (errorActualizacion) {
        return res.status(500).json({ error: errorActualizacion.message });
    }

    // Si otro revisor modificó el caso entre la lectura y el update
    if (!casoActualizado) {
        return res.status(409).json({
            error: 'Este caso ya fue revisado'
        });
    }

    return res.status(200).json({
        mensaje,
        caso: casoActualizado
    });
}

module.exports = { revisarCaso };