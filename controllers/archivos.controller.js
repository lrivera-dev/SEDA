const supabase = require('../supabaseClient');

async function subirArchivo(req, res) {
    if (!req.file) {
        return res.status(400).json({
            error: 'No se recibió ningún archivo, o el formato no es válido (solo PDF o Word).'
        });
    }

    const { tipo, id_carrera, id_materia } = req.body || {};

    if (!tipo || !['pensum', 'programa'].includes(tipo)) {
        return res.status(400).json({
            error: 'Debe indicar el tipo de documento: pensum o programa.'
        });
    }

    let idRegistro;
    let idCarreraArchivo;
    let tabla;
    let columna;

    if (tipo === 'pensum') {
        if (!id_carrera) {
            return res.status(400).json({
                error: 'Falta id_carrera para subir el pensum.'
            });
        }

        const { data: carrera, error } = await supabase
            .from('carrera')
            .select('id_carrera, id_universidad')
            .eq('id_carrera', id_carrera)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        if (!carrera) {
            return res.status(404).json({ error: 'No se encontró la carrera.' });
        }

        if (
            String(carrera.id_universidad) !==
            String(req.usuario.id_universidad)
        ) {
            return res.status(403).json({
                error: 'La universidad no tiene permiso sobre esta carrera.'
            });
        }

        idRegistro = carrera.id_carrera;
        idCarreraArchivo = carrera.id_carrera;
        tabla = 'carrera';
        columna = 'pensum_url';
    } else {
        if (!id_materia) {
            return res.status(400).json({
                error: 'Falta id_materia para subir el programa.'
            });
        }

        const { data: materia, error } = await supabase
            .from('materia')
            .select('id_materia, carrera:id_carrera(id_carrera, id_universidad)')
            .eq('id_materia', id_materia)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        if (!materia || !materia.carrera) {
            return res.status(404).json({ error: 'No se encontró la materia.' });
        }

        if (
            String(materia.carrera.id_universidad) !==
            String(req.usuario.id_universidad)
        ) {
            return res.status(403).json({
                error: 'La universidad no tiene permiso sobre esta materia.'
            });
        }

        idRegistro = materia.id_materia;
        idCarreraArchivo = materia.carrera.id_carrera;
        tabla = 'materia';
        columna = 'programa_url';
    }

    const nombreArchivo = `${Date.now()}-${req.file.originalname}`;

    const path = tipo === 'pensum'
        ? `${idCarreraArchivo}/pensum/${nombreArchivo}`
        : `${idCarreraArchivo}/materias/${idRegistro}/${nombreArchivo}`;

    const { error: errorSubida } = await supabase.storage
        .from('documentos-carreras')
        .upload(path, req.file.buffer, {
            contentType: req.file.mimetype
        });

    if (errorSubida) {
        return res.status(500).json({ error: errorSubida.message });
    }

    const idColumna = tipo === 'pensum' ? 'id_carrera' : 'id_materia';

    const { error: errorUpdate } = await supabase
        .from(tabla)
        .update({ [columna]: path })
        .eq(idColumna, idRegistro);

    if (errorUpdate) {
        return res.status(500).json({ error: errorUpdate.message });
    }

    const respuesta = {
        mensaje: 'Archivo cargado exitosamente',
        path
    };

    if (req.advertenciaArchivo) {
        respuesta.advertencia = req.advertenciaArchivo;
    }

    return res.status(201).json(respuesta);
}

module.exports = { subirArchivo };