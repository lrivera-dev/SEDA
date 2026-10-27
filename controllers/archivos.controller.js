const supabase = require('../supabaseClient');
const { randomUUID } = require('node:crypto');

const EXTENSIONES_POR_MIME = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};
const REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DURACION_ENLACE_DOCUMENTO_SEGUNDOS = 3600;

async function obtenerEnlaceDocumento(req, res) {
    const { tipo, id_registro: idRegistro } = req.params;

    if (!['pensum', 'programa'].includes(tipo) || !REGEX_UUID.test(idRegistro)) {
        return res.status(400).json({
            error: 'El tipo o identificador del documento no es válido.'
        });
    }

    let rutaDocumento;

    if (tipo === 'pensum') {
        const { data: carrera, error } = await supabase
            .from('carrera')
            .select('pensum_url')
            .eq('id_carrera', idRegistro)
            .eq('id_universidad', req.usuario.id_universidad)
            .maybeSingle();

        if (error) {
            return res.status(500).json({
                error: 'No se pudo consultar el pénsum.'
            });
        }

        if (!carrera) {
            return res.status(404).json({
                error: 'No se encontró el documento solicitado.'
            });
        }

        rutaDocumento = carrera.pensum_url;
    } else {
        const { data: materia, error: errorMateria } = await supabase
            .from('materia')
            .select('id_carrera, programa_url')
            .eq('id_materia', idRegistro)
            .maybeSingle();

        if (errorMateria) {
            return res.status(500).json({
                error: 'No se pudo consultar el programa.'
            });
        }

        if (!materia) {
            return res.status(404).json({
                error: 'No se encontró el documento solicitado.'
            });
        }

        const { data: carrera, error: errorCarrera } = await supabase
            .from('carrera')
            .select('id_carrera')
            .eq('id_carrera', materia.id_carrera)
            .eq('id_universidad', req.usuario.id_universidad)
            .maybeSingle();

        if (errorCarrera) {
            return res.status(500).json({
                error: 'No se pudo validar la universidad del documento.'
            });
        }

        if (!carrera) {
            return res.status(404).json({
                error: 'No se encontró el documento solicitado.'
            });
        }

        rutaDocumento = materia.programa_url;
    }

    if (!rutaDocumento) {
        return res.status(404).json({
            error: 'Este registro todavía no tiene un documento cargado.'
        });
    }

    const { data, error } = await supabase.storage
        .from('documentos-carreras')
        .createSignedUrl(rutaDocumento, DURACION_ENLACE_DOCUMENTO_SEGUNDOS);

    if (error || !data?.signedUrl) {
        return res.status(500).json({
            error: 'No se pudo generar el enlace del documento.'
        });
    }

    return res.status(200).json({
        url: data.signedUrl
    });
}

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

    const extension = EXTENSIONES_POR_MIME[req.file.mimetype];

    if (!extension) {
        return res.status(400).json({
            error: 'El archivo no es compatible, formatos aceptados: PDF o Word'
        });
    }

    const nombreArchivo = `${randomUUID()}.${extension}`;

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

module.exports = { subirArchivo, obtenerEnlaceDocumento };