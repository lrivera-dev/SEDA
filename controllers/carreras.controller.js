const supabase = require('../supabaseClient');

async function listarCarreras(req, res) {
    const { data: carreras, error } = await supabase
        .from('carrera')
        .select('id_carrera, nombre, pensum_url')
        .eq('id_universidad', req.usuario.id_universidad)
        .order('nombre', { ascending: true });

    if (error) {
        console.error('No se pudieron consultar las carreras:', error.message);
        return res.status(500).json({
            error: 'No se pudieron consultar las carreras.'
        });
    }

    return res.status(200).json({
        carreras: carreras || []
    });
}

async function crearCarrera(req, res) {
    const nombre = typeof req.body?.nombre === 'string'
        ? req.body.nombre.trim()
        : '';

    if (!nombre) {
        return res.status(400).json({
            error: 'El nombre de la carrera es obligatorio.'
        });
    }

    const { data: carrera, error } = await supabase
        .from('carrera')
        .insert({
            nombre,
            id_universidad: req.usuario.id_universidad
        })
        .select('id_carrera, nombre, pensum_url')
        .single();

    if (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                error: 'Ya existe una carrera con ese nombre en esta universidad.'
            });
        }

        console.error('No se pudo registrar la carrera:', error.message);
        return res.status(500).json({
            error: 'No se pudo registrar la carrera.'
        });
    }

    return res.status(201).json({
        mensaje: 'Carrera registrada exitosamente.',
        carrera
    });
}

module.exports = {
    listarCarreras,
    crearCarrera
};