const supabase = require('../supabaseClient');

async function subirArchivo(req, res) {
    if (!req.file) {
        return res.status(400).json({ error: "No se recibió ningún archivo, o el fomarto no es válido (solo PDF o Word)." });
    }

    const { tipo, id_carrera, id_materia } = req.body;

    if (!tipo || !['pensum', 'programa'].includes(tipo)) {
        return res.status(400).json({ error: 'Debe indicar el tipo de documento: pensum o programa.' });
    }

    if (tipo === 'pensum' && !id_carrera) {
        return res.status(400).json({ error: 'Falta id_carrera para subir el pensum.' });
    }

    if (tipo === 'programa' && !id_materia) {
        return res.status(400).json({ error: 'Falta id_materia para subir el programa.' });
    }

    const nombreArchivo = `${Date.now()}-${req.file.originalname}`;

    const path = tipo === 'pensum'
        ? `${id_carrera}/pensum/${nombreArchivo}`
        : `${id_carrera || 'materias'}/materias/${id_materia}/${nombreArchivo}`;

    const { error: errorSubida } = await supabase.storage
        .from('documentos-carreras')
        .upload(path, req.file.buffer, { contentType: req.file.mimetype });

    if (errorSubida) {
        return res.status(500).json({ error: errorSubida.message });
    }

    const tabla = tipo === 'pensum' ? 'carrera' : 'materia';
    const columna = tipo === 'pensum' ? 'pensum_url' : 'programa_url';
    const idRegistro = tipo === 'pensum' ? id_carrera : id_materia;
    const idColumna = tipo === 'pensum' ? 'id_carrera' : 'id_materia';

    const { error: errorUpdate } = await supabase
        .from(tabla)
        .update({ [columna]: path })
        .eq(idColumna, idRegistro);

    if (errorUpdate) {
        return res.status(500).json({ error: errorUpdate.message });
    }

    return res.status(201).json({
        mensaje: 'Archivo cargado exitosamente',
        path
    })
}

module.exports = { subirArchivo };