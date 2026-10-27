const supabase = require('../supabaseClient');

const REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actualizarMateria(req, res) {
    const idMateria = req.params.id_materia;
    const nombre = typeof req.body?.nombre === 'string'
        ? req.body.nombre.trim()
        : '';

    if (!REGEX_UUID.test(idMateria)) {
        return res.status(400).json({
            error: 'El identificador de la materia no es válido.'
        });
    }

    if (!nombre) {
        return res.status(400).json({
            error: 'El nombre de la materia es obligatorio.'
        });
    }

    const { data: materiaExistente, error: errorMateria } = await supabase
        .from('materia')
        .select('id_materia, id_carrera')
        .eq('id_materia', idMateria)
        .maybeSingle();

    if (errorMateria) {
        console.error('No se pudo consultar la materia:', errorMateria.message);
        return res.status(500).json({
            error: 'No se pudo actualizar la materia.'
        });
    }

    if (!materiaExistente) {
        return res.status(404).json({
            error: 'No se encontró esa materia en tu universidad.'
        });
    }

    const { data: carrera, error: errorCarrera } = await supabase
        .from('carrera')
        .select('id_carrera')
        .eq('id_carrera', materiaExistente.id_carrera)
        .eq('id_universidad', req.usuario.id_universidad)
        .maybeSingle();

    if (errorCarrera) {
        console.error('No se pudo validar la universidad de la materia:', errorCarrera.message);
        return res.status(500).json({
            error: 'No se pudo actualizar la materia.'
        });
    }

    if (!carrera) {
        return res.status(404).json({
            error: 'No se encontró esa materia en tu universidad.'
        });
    }

    const { data: materia, error } = await supabase
        .from('materia')
        .update({ nombre })
        .eq('id_materia', idMateria)
        .eq('id_carrera', carrera.id_carrera)
        .select('id_materia, id_carrera, nombre, programa_url')
        .maybeSingle();

    if (error?.code === '23505') {
        return res.status(409).json({
            error: 'Ya existe una materia con ese nombre en esta carrera.'
        });
    }

    if (error) {
        console.error('No se pudo actualizar la materia:', error.message);
        return res.status(500).json({
            error: 'No se pudo actualizar la materia.'
        });
    }

    if (!materia) {
        return res.status(404).json({
            error: 'No se encontró esa materia en tu universidad.'
        });
    }

    return res.status(200).json({
        mensaje: 'Materia actualizada correctamente.',
        materia
    });
}

async function listarMaterias(req, res) {
    const idCarrera = typeof req.query.id_carrera === 'string'
        ? req.query.id_carrera.trim()
        : '';

    if (idCarrera && !REGEX_UUID.test(idCarrera)) {
        return res.status(400).json({
            error: 'El identificador de carrera no es válido.'
        });
    }

    const { data: carreras, error: errorCarreras } = await supabase
        .from('carrera')
        .select('id_carrera')
        .eq('id_universidad', req.usuario.id_universidad);

    if (errorCarreras) {
        console.error('No se pudieron consultar las carreras:', errorCarreras.message);
        return res.status(500).json({
            error: 'No se pudieron consultar las materias.'
        });
    }

    const idsCarreras = (carreras || []).map((carrera) => carrera.id_carrera);

    if (idsCarreras.length === 0) {
        return res.status(200).json({ materias: [] });
    }

    let consulta = supabase
        .from('materia')
        .select('id_materia, id_carrera, nombre, programa_url')
        .in('id_carrera', idsCarreras)
        .order('nombre', { ascending: true });

    if (idCarrera) {
        consulta = consulta.eq('id_carrera', idCarrera);
    }

    const { data: materias, error } = await consulta;

    if (error) {
        console.error('No se pudieron consultar las materias:', error.message);
        return res.status(500).json({
            error: 'No se pudieron consultar las materias.'
        });
    }

    return res.status(200).json({
        materias: materias || []
    });
}

async function crearMateria(req, res) {
    const idCarrera = typeof req.body?.id_carrera === 'string'
        ? req.body.id_carrera.trim()
        : '';

    const nombre = typeof req.body?.nombre === 'string'
        ? req.body.nombre.trim()
        : '';

    if (!idCarrera || !nombre) {
        return res.status(400).json({
            error: 'El ID de carrera y el nombre de la materia son obligatorios.'
        });
    }

    if (!REGEX_UUID.test(idCarrera)) {
        return res.status(400).json({
            error: 'El identificador de carrera no es válido.'
        });
    }

    const { data: carrera, error: errorCarrera } = await supabase
        .from('carrera')
        .select('id_carrera')
        .eq('id_carrera', idCarrera)
        .eq('id_universidad', req.usuario.id_universidad)
        .maybeSingle();

    if (errorCarrera) {
        console.error('No se pudo validar la carrera:', errorCarrera.message);
        return res.status(500).json({
            error: 'No se pudo validar la carrera.'
        });
    }

    if (!carrera) {
        return res.status(404).json({
            error: 'No se encontró esa carrera en tu universidad.'
        });
    }

    const { data: materia, error } = await supabase
        .from('materia')
        .insert({
            id_carrera: carrera.id_carrera,
            nombre
        })
        .select('id_materia, id_carrera, nombre, programa_url')
        .single();

    if (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                error: 'Ya existe una materia con ese nombre en esta carrera.'
            });
        }

        console.error('No se pudo registrar la materia:', error.message);
        return res.status(500).json({
            error: 'No se pudo registrar la materia.'
        });
    }

    return res.status(201).json({
        mensaje: 'Materia registrada exitosamente.',
        materia
    });
}

async function listarMateriasCatalogo(req, res) {
    const { data: materias, error } = await supabase
        .from('materia')
        .select(`
            id_materia,
            nombre,
            carrera!inner (
                nombre,
                pensum_url,
                universidad!inner (
                    nombre,
                    estado
                )
            )
        `)
        .not('programa_url', 'is', null)
        .not('carrera.pensum_url', 'is', null)
        .eq('carrera.universidad.estado', 'ACTIVA')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('No se pudo consultar el catálogo de materias:', error.message);
        return res.status(500).json({
            error: 'No se pudo consultar el catálogo de materias.'
        });
    }

    const catalogo = (materias || []).map((materia) => ({
        id_materia: materia.id_materia,
        nombre: materia.nombre,
        carrera: materia.carrera?.nombre || 'Carrera',
        universidad: materia.carrera?.universidad?.nombre || 'Universidad'
    }));

    return res.status(200).json({
        materias: catalogo
    });
}

module.exports = {
    listarMaterias,
    listarMateriasCatalogo,
    crearMateria,
    actualizarMateria
};