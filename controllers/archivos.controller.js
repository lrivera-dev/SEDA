const supabase = require('../supabaseClient');
const gestionarDocumentos = require('../servicios/gestionar-documentos');
const { generarEnlacesDocumentos } = require('../servicios/documentos-caso');

const EXTENSIONES_POR_MIME = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};
const REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DURACION_ENLACE_DOCUMENTO_SEGUNDOS = 3600;

async function obtenerDocumentosComparacion(req, res) {
    const idMateriaOrigen = req.body?.id_materia_origen;
    const idMateriaDestino = req.body?.id_materia_destino;

    if (
        !REGEX_UUID.test(idMateriaOrigen || '') ||
        !REGEX_UUID.test(idMateriaDestino || '') ||
        idMateriaOrigen === idMateriaDestino
    ) {
        return res.status(400).json({
            error: 'Las materias seleccionadas no son válidas.'
        });
    }

    const seleccion = `
        id_materia,
        nombre,
        programa_url,
        carrera!inner (
            nombre,
            pensum_url,
            id_universidad,
            universidad!inner (
                nombre,
                estado
            )
        )
    `;

    const [
        { data: materiaOrigen, error: errorOrigen },
        { data: materiaDestino, error: errorDestino }
    ] = await Promise.all([
        supabase
            .from('materia')
            .select(seleccion)
            .eq('id_materia', idMateriaOrigen)
            .eq('carrera.id_universidad', req.usuario.id_universidad)
            .maybeSingle(),
        supabase
            .from('materia')
            .select(seleccion)
            .eq('id_materia', idMateriaDestino)
            .eq('carrera.universidad.estado', 'ACTIVA')
            .maybeSingle()
    ]);

    if (errorOrigen || errorDestino) {
        console.error(
            'No se pudieron consultar los documentos de comparación:',
            errorOrigen?.message || errorDestino?.message
        );
        return res.status(500).json({
            error: 'No se pudieron consultar los documentos de comparación.'
        });
    }

    // La materia de origen debe pertenecer a la universidad autenticada.
    // El destino se limita al catálogo de universidades activas.
    if (!materiaOrigen || !materiaDestino) {
        return res.status(404).json({
            error: 'No se encontraron las materias para comparar.'
        });
    }

    const casoTemporal = {
        materia_origen: materiaOrigen,
        materia_destino: materiaDestino
    };
    const { enlaces, documentos_faltantes } =
        await generarEnlacesDocumentos(casoTemporal);

    if (documentos_faltantes.length > 0) {
        return res.status(503).json({
            error: 'No se pudieron preparar todos los documentos para comparar.'
        });
    }

    const describirMateria = (materia) => ({
        nombre: materia.nombre,
        carrera: materia.carrera.nombre,
        universidad: materia.carrera.universidad.nombre
    });

    return res.status(200).json({
        origen: describirMateria(materiaOrigen),
        destino: describirMateria(materiaDestino),
        enlaces
    });
}

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
            console.error("HU11_ERROR_CONSULTA_CARRERA", {
                codigo: error?.code || "ERROR_DESCONOCIDO"
            });

            return res.status(500).json({
                error: "No se pudo consultar la carrera."
            });
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
            console.error("HU11_ERROR_CONSULTA_MATERIA", {
                codigo: error?.code || "ERROR_DESCONOCIDO"
            });

            return res.status(500).json({
                error: "No se pudo consultar la materia."
            });
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
    }

    const extension = EXTENSIONES_POR_MIME[req.file.mimetype];

    if (!extension) {
        return res.status(400).json({
            error: 'El archivo no es compatible, formatos aceptados: PDF o Word'
        });
    }

    const { path, error: errorGuardado } = await gestionarDocumentos.guardarDocumento({
        tipo,
        idRegistro,
        idCarrera: idCarreraArchivo,
        extension,
        archivo: req.file
    });
    if (errorGuardado) {
        console.error("HU11_ERROR_GUARDADO_DOCUMENTO", {
            codigo: errorGuardado?.code || "ERROR_DESCONOCIDO"
        });

        return res.status(500).json({
            error: "No se pudo guardar el documento."
        });
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

module.exports = {
    subirArchivo,
    obtenerEnlaceDocumento,
    obtenerDocumentosComparacion
};
