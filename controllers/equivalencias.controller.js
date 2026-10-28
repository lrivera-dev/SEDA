const supabase = require('../supabaseClient');
const colaEvaluacion = require('../servicios/cola-evaluacion');

const CAMPOS_OBLIGATORIOS = [
    'id_materia_origen',
    'id_materia_destino',
    'descripcion'
];

async function listarEquivalencias(req, res) {
    const idUniversidad = req.usuario.id_universidad;

    if (!idUniversidad) {
        return res.status(400).json({
            error: 'Debes identificar a tu universidad para ver las equivalencias.'
        });
    }

    const { data: materias, error } = await supabase
        .from('materia')
        .select(`
            id_materia,
            nombre,
            carrera!inner (
                nombre,
                id_universidad
            ),
            casos:caso_equivalencia!caso_equivalencia_id_materia_origen_fkey (
            id_caso,
            id_solicitud,
            estado,
            estado_calculo,
            porcentaje_coincidencia,
            porcentaje_propuesto,
            justificacion_manual,
            fecha_registro,
            motivo_error_calculo,
            solicitud:solicitud_equivalencia!fk_caso_solicitud_equivalencia (
                nombre_estudiante,
                codigo_institucional,
                modalidad
            ),
            materia_destino:materia!caso_equivalencia_id_materia_destino_fkey (
                nombre,
                carrera (
                    nombre,
                    universidad (
                        nombre
                    )
                )
            )
        )
        `)
        .eq('carrera.id_universidad', idUniversidad);

    if (error) {
        console.error('No se pudieron consultar las equivalencias:', error.message);
        return res.status(500).json({
            error: 'No se pudieron consultar las equivalencias.'
        });
    }

    const casos = (materias || [])
        .flatMap((materia) => (materia.casos || []).map((caso) => {
            const modalidad = caso.solicitud?.modalidad ?? 'AUTOMATICA';
            const esManual = modalidad === 'MANUAL';

            const valorOriginal = esManual
                ? caso.porcentaje_propuesto
                : caso.porcentaje_coincidencia;

            const valorPorcentaje =
                valorOriginal === null ||
                    valorOriginal === undefined ||
                    valorOriginal === ''
                    ? null
                    : Number(valorOriginal);

            const porcentajeValido =
                valorPorcentaje !== null &&
                (esManual || caso.estado_calculo === 'CALCULADO') &&
                Number.isFinite(valorPorcentaje) &&
                valorPorcentaje >= 0 &&
                valorPorcentaje <= 100;

            return {
                id_caso: caso.id_caso,
                materia_origen: materia.nombre,
                carrera_origen: materia.carrera?.nombre ?? null,
                materia_destino: caso.materia_destino?.nombre ?? null,
                carrera_destino: caso.materia_destino?.carrera?.nombre ?? null,
                universidad_destino:
                    caso.materia_destino?.carrera?.universidad?.nombre ?? null,
                estado_calculo: caso.estado_calculo,
                estado: caso.estado,
                fecha_registro: caso.fecha_registro,
                motivo_error_calculo: caso.motivo_error_calculo ?? null,
                modalidad,
                nombre_estudiante: caso.solicitud?.nombre_estudiante ?? null,
                codigo_institucional: caso.solicitud?.codigo_institucional ?? null,
                porcentaje_coincidencia:
                    !esManual && porcentajeValido ? valorPorcentaje : null,
                porcentaje_propuesto:
                    esManual && porcentajeValido ? valorPorcentaje : null,
                justificacion_manual: caso.justificacion_manual ?? null,
            };
        }))
        .sort((a, b) =>
            String(b.fecha_registro).localeCompare(String(a.fecha_registro))
        );

    return res.status(200).json({
        total: casos.length,
        casos
    });
}

async function registrarEquivalencias(req, res) {
    const datos = req.body;

    // Validar campos obligatorios
    const faltantes = CAMPOS_OBLIGATORIOS.filter(campo => !datos[campo] || String(datos[campo]).trim() === '');

    if (faltantes.length > 0) {
        return res.status(400).json({
            error: 'Campos obligatorios faltantes o inválidos',
            campos: faltantes
        });
    }

    const {
        id_materia_origen,
        id_materia_destino,
        descripcion
    } = datos;

    // Materias no pueden ser la misma
    if (id_materia_origen === id_materia_destino) {
        return res.status(400).json({ error: 'La materia de origen y destino no pueden ser la misma.' })
    }

    // Obtener materia_origen junto con su carrera y universidad
    const { data: materiaOrigen, error: errorOrigen } = await supabase
        .from('materia')
        .select('id_materia, programa_url, carrera:id_carrera(id_carrera, pensum_url, id_universidad)')
        .eq('id_materia', id_materia_origen)
        .maybeSingle();

    if (errorOrigen) {
        return res.status(500).json({ error: errorOrigen.message });
    }

    if (!materiaOrigen) {
        return res.status(400).json({ error: 'La materia de origen indicada no existe.' });
    }

    // Obtener materia_destino junto con su carrera
    const { data: materiaDestino, error: errorDestino } = await supabase
        .from('materia')
        .select('id_materia, programa_url, carrera:id_carrera(id_carrera, pensum_url, id_universidad)')
        .eq('id_materia', id_materia_destino)
        .maybeSingle();

    if (errorDestino) {
        return res.status(500).json({ error: errorDestino.message })
    }

    if (!materiaDestino) {
        return res.status(400).json({ error: 'La materia de destino indicada no existe.' })
    }

    if (
        String(materiaOrigen.carrera.id_universidad) !==
        String(req.usuario.id_universidad)
    ) {
        return res.status(403).json({
            error: 'La universidad no tiene permiso sobre la materia de origen.'
        });
    }

    // Valida que existen archivos cargados (pensum y programa) para ambas materias
    const faltanArchivos = [];

    if (!materiaOrigen.carrera.pensum_url) faltanArchivos.push('pensum de la carrera de origen');
    if (!materiaOrigen.programa_url) faltanArchivos.push('programa de la materia de origen');
    if (!materiaDestino.carrera.pensum_url) faltanArchivos.push('pensum de la carrera de destino');
    if (!materiaDestino.programa_url) faltanArchivos.push('programa de la materia de destino');

    if (faltanArchivos.length > 0) {
        return res.status(400).json({
            error: 'No se puede registrar la equivalencia: faltan archivos por cargar.',
            archivos_faltantes: faltanArchivos
        })
    }

    // 7. Insertar la equivalencia
    const { data: equivalencia, error: errorInsert } = await supabase
        .from('caso_equivalencia')
        .insert({
            id_materia_origen,
            id_materia_destino,
            descripcion,
            estado: 'PENDIENTE'
        })
        .select()
        .single();

    if (errorInsert) {
        return res.status(500).json({ error: errorInsert.message });
    }

    // HU-3: la evaluación con IA corre en segundo plano, sin esperar su resultado.
    // Si encolar falla, el registro de la equivalencia sigue funcionando.
    try {
        colaEvaluacion.encolar(equivalencia.id_caso);
    } catch (error) {
        console.error(`No se pudo encolar la evaluación del caso ${equivalencia.id_caso}:`, error.message);
    }

    return res.status(201).json({
        mensaje: 'Equivalencia registrada exitosamente',
        equivalencia
    });

}

const UUID_VALIDO =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responderErrorSolicitud(res, codigo, mensaje) {
    return res.status(codigo).json({ error: mensaje });
}

async function registrarSolicitudEquivalencia(req, res) {
    const datos = req.body || {};
    const {
        nombre_estudiante: nombreEstudiante,
        codigo_institucional: codigoInstitucional,
        modalidad,
        equivalencias
    } = datos;

    if (
        typeof nombreEstudiante !== 'string' ||
        !nombreEstudiante.trim() ||
        nombreEstudiante.trim().length > 200 ||
        typeof codigoInstitucional !== 'string' ||
        !codigoInstitucional.trim() ||
        codigoInstitucional.trim().length > 100
    ) {
        return responderErrorSolicitud(
            res,
            400,
            'Ingresa el nombre del estudiante y su código institucional.'
        );
    }

    if (!['MANUAL', 'AUTOMATICA'].includes(modalidad)) {
        return responderErrorSolicitud(res, 400, 'Selecciona una modalidad válida.');
    }

    if (!Array.isArray(equivalencias) || equivalencias.length === 0) {
        return responderErrorSolicitud(
            res,
            400,
            'Agrega al menos una equivalencia.'
        );
    }

    const origenesUsados = new Set();

    for (const [indice, equivalencia] of equivalencias.entries()) {
        const fila = indice + 1;
        const origen = equivalencia?.id_materia_origen;
        const destino = equivalencia?.id_materia_destino;

        if (!UUID_VALIDO.test(origen || '') || !UUID_VALIDO.test(destino || '')) {
            return responderErrorSolicitud(
                res,
                400,
                `Selecciona las materias de origen y destino de la fila ${fila}.`
            );
        }

        if (origen === destino) {
            return responderErrorSolicitud(
                res,
                400,
                `Las materias de la fila ${fila} no pueden ser la misma.`
            );
        }

        if (origenesUsados.has(origen)) {
            return responderErrorSolicitud(
                res,
                400,
                'No repitas una materia de origen en la solicitud.'
            );
        }

        origenesUsados.add(origen);

        const notaObtenida = equivalencia?.nota_obtenida;
        const notaMaxima = equivalencia?.nota_maxima;

        if (
            typeof notaObtenida !== 'number' ||
            !Number.isFinite(notaObtenida) ||
            typeof notaMaxima !== 'number' ||
            !Number.isFinite(notaMaxima) ||
            notaObtenida < 0 ||
            notaMaxima <= 0 ||
            notaObtenida > notaMaxima
        ) {
            return responderErrorSolicitud(
                res,
                400,
                `Ingresa una nota válida, dentro de su escala, en la fila ${fila}.`
            );
        }

        if (modalidad === 'MANUAL') {
            const porcentaje = equivalencia.porcentaje_propuesto;
            const justificacion = equivalencia.justificacion_manual;

            if (
                typeof porcentaje !== 'number' ||
                !Number.isFinite(porcentaje) ||
                porcentaje < 0 ||
                porcentaje > 100 ||
                typeof justificacion !== 'string' ||
                justificacion.trim().length < 10 ||
                justificacion.trim().length > 500
            ) {
                return responderErrorSolicitud(
                    res,
                    400,
                    `La fila ${fila} requiere un porcentaje de 0 a 100 y una justificación de 10 a 500 caracteres.`
                );
            }
        } else if (
            equivalencia.porcentaje_propuesto != null ||
            equivalencia.justificacion_manual != null
        ) {
            return responderErrorSolicitud(
                res,
                400,
                'La modalidad automática no admite porcentaje ni justificación manual.'
            );
        }
    }

    try {
        const { data, error } = await supabase.rpc(
            'crear_solicitud_equivalencia',
            {
                p_id_universidad: req.usuario.id_universidad,
                p_nombre_estudiante: nombreEstudiante.trim(),
                p_codigo_institucional: codigoInstitucional.trim(),
                p_modalidad: modalidad,
                p_equivalencias: equivalencias.map((equivalencia) => ({
                    id_materia_origen: equivalencia.id_materia_origen,
                    id_materia_destino: equivalencia.id_materia_destino,
                    nota_obtenida: equivalencia.nota_obtenida,
                    nota_maxima: equivalencia.nota_maxima,
                    porcentaje_propuesto:
                        modalidad === 'MANUAL'
                            ? equivalencia.porcentaje_propuesto
                            : null,
                    justificacion_manual:
                        modalidad === 'MANUAL'
                            ? equivalencia.justificacion_manual.trim()
                            : null
                }))
            }
        );

        if (error) {
            const mensaje = error.message || '';

            if (mensaje.includes('MATERIA_ORIGEN_AJENA')) {
                return responderErrorSolicitud(
                    res,
                    403,
                    'No tienes permiso sobre una de las materias de origen.'
                );
            }

            const erroresSolicitud = {
                DOCUMENTOS_INCOMPLETOS:
                    'Todas las materias deben tener sus documentos cargados.',
                MATERIA_ORIGEN_NO_EXISTE:
                    'No se encontró una de las materias de origen.',
                MATERIA_DESTINO_NO_EXISTE:
                    'No se encontró una de las materias de destino.',
                DATOS_MANUALES_INVALIDOS:
                    'Revisa el porcentaje y la justificación de la modalidad manual.',
                DATOS_MANUALES_NO_PERMITIDOS:
                    'La modalidad automática no admite datos manuales.',
                MATERIAS_IGUALES:
                    'Las materias de origen y destino no pueden ser la misma.',
                SIN_EQUIVALENCIAS:
                    'Agrega al menos una equivalencia.'
            };

            const clave = Object.keys(erroresSolicitud).find((item) =>
                mensaje.includes(item)
            );

            if (clave) {
                return responderErrorSolicitud(res, 400, erroresSolicitud[clave]);
            }

            console.error('No se pudo registrar la solicitud:', mensaje);
            return responderErrorSolicitud(
                res,
                500,
                'No se pudo registrar la solicitud. Intenta de nuevo.'
            );
        }

        if (
            modalidad === 'AUTOMATICA' &&
            Array.isArray(data?.ids_caso)
        ) {
            for (const idCaso of data.ids_caso) {
                try {
                    colaEvaluacion.encolar(idCaso);
                } catch (error) {
                    console.error(
                        `No se pudo encolar el caso ${idCaso}:`,
                        error.message
                    );
                }
            }
        }

        return res.status(201).json({
            mensaje: 'Solicitud de equivalencia registrada exitosamente.',
            solicitud: {
                id_solicitud: data.id_solicitud,
                modalidad,
                ids_caso: data.ids_caso
            }
        });
    } catch (error) {
        console.error('Error al registrar la solicitud:', error.message);
        return responderErrorSolicitud(
            res,
            500,
            'No se pudo registrar la solicitud. Intenta de nuevo.'
        );
    }
}

module.exports = {
    registrarEquivalencias,
    listarEquivalencias,
    registrarSolicitudEquivalencia
};