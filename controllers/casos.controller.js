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
const { generarEnlacesDocumentos } = require('../servicios/documentos-caso');

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENSAJE_NO_EXISTE = 'El caso solicitado no existe o fue eliminado';
const TEXTO_SIN_PORCENTAJE = 'Pendiente de cálculo';

function describirLado(materia) {
    return {
        materia: materia?.nombre ?? null,
        carrera: materia?.carrera?.nombre ?? null,
        universidad: materia?.carrera?.universidad?.nombre ?? null
    };
}

async function obtenerCaso(req, res) {
    const { id_caso } = req.params;

    if (!REGEX_UUID.test(id_caso)) {
        return res.status(404).json({ error: MENSAJE_NO_EXISTE });
    }

    const { data: caso, error } = await supabase
        .from('caso_equivalencia')
        .select(`
            id_caso,
            descripcion,
            estado,
            porcentaje_coincidencia,
            fecha_registro,
            materia_origen:materia!caso_equivalencia_id_materia_origen_fkey (
                nombre,
                programa_url,
                carrera ( nombre, pensum_url, universidad ( nombre ) )
            ),
            materia_destino:materia!caso_equivalencia_id_materia_destino_fkey (
                nombre,
                programa_url,
                carrera ( nombre, pensum_url, universidad ( nombre ) )
            )
        `)
        .eq('id_caso', id_caso)
        .maybeSingle();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    if (!caso) {
        return res.status(404).json({ error: MENSAJE_NO_EXISTE });
    }

    const { enlaces, documentos_faltantes } = await generarEnlacesDocumentos(caso);

    return res.status(200).json({
        caso: {
            id_caso: caso.id_caso,
            descripcion: caso.descripcion,
            estado: caso.estado,
            fecha_registro: caso.fecha_registro,
            porcentaje_coincidencia: caso.porcentaje_coincidencia ?? TEXTO_SIN_PORCENTAJE,
            origen: describirLado(caso.materia_origen),
            destino: describirLado(caso.materia_destino)
        },
        enlaces,
        documentos_faltantes
    });
}

module.exports = { obtenerCaso };
