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

async function actualizarCarrera(req, res) {
    const idCarrera = req.params.id_carrera;
    const nombre = typeof req.body?.nombre === 'string'
        ? req.body.nombre.trim()
        : '';

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idCarrera)) {
        return res.status(400).json({
            error: 'El identificador de la carrera no es válido.'
        });
    }

    if (!nombre) {
        return res.status(400).json({
            error: 'El nombre de la carrera es obligatorio.'
        });
    }

    const { data: carrera, error } = await supabase
        .from('carrera')
        .update({ nombre })
        .eq('id_carrera', idCarrera)
        .eq('id_universidad', req.usuario.id_universidad)
        .select('id_carrera, nombre, pensum_url')
        .maybeSingle();

    if (error?.code === '23505') {
        return res.status(409).json({
            error: 'Ya existe una carrera con ese nombre en esta universidad.'
        });
    }

    if (error) {
        console.error('No se pudo actualizar la carrera:', error.message);
        return res.status(500).json({
            error: 'No se pudo actualizar la carrera.'
        });
    }

    if (!carrera) {
        return res.status(404).json({
            error: 'No se encontró esa carrera en tu universidad.'
        });
    }

    return res.status(200).json({
        mensaje: 'Carrera actualizada correctamente.',
        carrera
    });
}

module.exports = {
    listarCarreras,
    crearCarrera,
    actualizarCarrera
};