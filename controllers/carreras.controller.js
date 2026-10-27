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

async function eliminarCarrera(req, res) {
    const idCarrera = req.params.id_carrera;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idCarrera)) {
        return res.status(400).json({
            error: 'El identificador de la carrera no es válido.'
        });
    }

    const { data: carrera, error: errorCarrera } = await supabase
        .from('carrera')
        .select('id_carrera, pensum_url')
        .eq('id_carrera', idCarrera)
        .eq('id_universidad', req.usuario.id_universidad)
        .maybeSingle();

    if (errorCarrera) {
        console.error('No se pudo consultar la carrera:', errorCarrera.message);
        return res.status(500).json({
            error: 'No se pudo eliminar la carrera.'
        });
    }

    if (!carrera) {
        return res.status(404).json({
            error: 'No se encontró esa carrera en tu universidad.'
        });
    }

    const { count, error: errorMaterias } = await supabase
        .from('materia')
        .select('id_materia', { count: 'exact', head: true })
        .eq('id_carrera', idCarrera);

    if (errorMaterias) {
        console.error('No se pudieron verificar las materias:', errorMaterias.message);
        return res.status(500).json({
            error: 'No se pudo verificar si la carrera tiene materias asociadas.'
        });
    }

    if (count > 0) {
        return res.status(409).json({
            error: 'No se puede eliminar esta carrera porque tiene materias asociadas.'
        });
    }

    const { data: eliminada, error: errorEliminar } = await supabase
        .from('carrera')
        .delete()
        .eq('id_carrera', idCarrera)
        .eq('id_universidad', req.usuario.id_universidad)
        .select('id_carrera')
        .maybeSingle();

    if (errorEliminar?.code === '23503') {
        return res.status(409).json({
            error: 'No se puede eliminar esta carrera porque tiene registros asociados.'
        });
    }

    if (errorEliminar) {
        console.error('No se pudo eliminar la carrera:', errorEliminar.message);
        return res.status(500).json({
            error: 'No se pudo eliminar la carrera.'
        });
    }

    if (!eliminada) {
        return res.status(404).json({
            error: 'No se encontró esa carrera en tu universidad.'
        });
    }

    let advertencia;

    if (carrera.pensum_url) {
        const { error: errorArchivo } = await supabase.storage
            .from('documentos-carreras')
            .remove([carrera.pensum_url]);

        if (errorArchivo) {
            console.error('No se pudo eliminar el archivo del pénsum:', errorArchivo.message);
            advertencia =
                'La carrera se eliminó, pero no se pudo borrar su pénsum del almacenamiento.';
        }
    }

    return res.status(200).json({
        mensaje: 'Carrera eliminada correctamente.',
        ...(advertencia ? { advertencia } : {})
    });
}

module.exports = {
    listarCarreras,
    crearCarrera,
    actualizarCarrera,
    eliminarCarrera
};