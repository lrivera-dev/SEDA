const supabase = require('../supabaseClient');

async function obtenerPanel(req, res) {
    const { data: casos, error } = await supabase
        .from('caso_equivalencia')
        .select(`
            id_caso,
            descripcion,
            estado,
            porcentaje_coincidencia,
            porcentaje_propuesto,
            solicitud:solicitud_equivalencia!fk_caso_solicitud_equivalencia (
                modalidad
            ),
            fecha_registro,
            materia_origen:materia!caso_equivalencia_id_materia_origen_fkey (
                nombre,
                carrera (
                    nombre,
                    universidad ( nombre )
                )
            ),
            materia_destino:materia!caso_equivalencia_id_materia_destino_fkey (
                nombre,
                carrera (
                    nombre,
                    universidad ( nombre )
                )
            )
        `)
        .order('fecha_registro', { ascending: false })
        .eq('confirmada_universidad', true);

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    if (!casos || casos.length === 0) {
        return res.status(200).json({
            mensaje: 'No hay casos confirmados disponibles para revisión',
            casos: []
        });
    }

    return res.status(200).json({
        total: casos.length,
        casos
    });
}

module.exports = { obtenerPanel };