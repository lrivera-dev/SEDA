const supabase = require('../supabaseClient');

const UUID_VALIDO =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listarUniversidadesMined(req, res) {
    const { data, error } = await supabase
        .from('universidad')
        .select(`
            id_universidad,
            nombre,
            ubicacion,
            estado,
            carreras:carrera(id_carrera)
        `)
        .order('nombre', { ascending: true });

    if (error) {
        console.error('No se pudieron consultar las universidades:', error.message);
        return res.status(500).json({
            error: 'No se pudieron consultar las universidades.'
        });
    }

    const universidades = (data || []).map((universidad) => ({
        id_universidad: universidad.id_universidad,
        nombre: universidad.nombre,
        ubicacion: universidad.ubicacion,
        estado: universidad.estado,
        cantidad_carreras: Array.isArray(universidad.carreras)
            ? universidad.carreras.length
            : 0
    }));

    return res.status(200).json({ universidades });
}

async function obtenerUniversidadMined(req, res) {
    const { id_universidad: idUniversidad } = req.params;

    if (!UUID_VALIDO.test(idUniversidad)) {
        return res.status(400).json({
            error: 'El identificador de la universidad no es válido.'
        });
    }

    const { data: universidad, error } = await supabase
        .from('universidad')
        .select(`
            id_universidad,
            nombre,
            ubicacion,
            correo_contacto,
            telefono_contacto,
            estado,
            carreras:carrera(
                id_carrera,
                nombre,
                pensum_url,
                materias:materia(
                    id_materia,
                    nombre,
                    programa_url
                )
            )
        `)
        .eq('id_universidad', idUniversidad)
        .maybeSingle();

    if (error) {
        console.error('No se pudo consultar la universidad:', error.message);
        return res.status(500).json({
            error: 'No se pudo consultar la universidad.'
        });
    }

    if (!universidad) {
        return res.status(404).json({
            error: 'No se encontró la universidad.'
        });
    }

    const carreras = (universidad.carreras || []).map((carrera) => ({
        id_carrera: carrera.id_carrera,
        nombre: carrera.nombre,
        tiene_pensum: Boolean(carrera.pensum_url),
        materias: (carrera.materias || []).map((materia) => ({
            id_materia: materia.id_materia,
            nombre: materia.nombre,
            tiene_programa: Boolean(materia.programa_url)
        }))
    }));

    return res.status(200).json({
        universidad: {
            id_universidad: universidad.id_universidad,
            nombre: universidad.nombre,
            ubicacion: universidad.ubicacion,
            correo_contacto: universidad.correo_contacto,
            telefono_contacto: universidad.telefono_contacto,
            estado: universidad.estado,
            cantidad_carreras: carreras.length,
            carreras
        }
    });
}

module.exports = {
    listarUniversidadesMined,
    obtenerUniversidadMined
};