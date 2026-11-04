const supabase = require('../supabaseClient');
const { clasificarCoincidencia, UMBRAL_APROBACION } = require('../servicios/clasificar-coincidencia');

const MENSAJE_SIN_CASOS = 'Aún no tienes equivalencias registradas';
const MENSAJE_SIN_UNIVERSIDAD = 'Debes identificar a tu universidad para ver el checklist';
const MENSAJE_UNIVERSIDAD_INVALIDA = 'El identificador de universidad no es válido';

// Código de Postgres cuando el id no tiene el formato de la columna (por ejemplo, un UUID mal escrito).
const CODIGO_FORMATO_INVALIDO = '22P02';

const ESTADO_CALCULADO = 'CALCULADO';
const ESTADO_EN_CALCULO = 'EN_CALCULO';
const ESTADO_ERROR = 'ERROR';

// RN5: los 4 documentos de un caso, con los mismos nombres que usa servicios/documentos-caso.js.
const DOCUMENTOS_REQUERIDOS = [
    {
        nombre: 'Pensum de la carrera de origen',
        obtenerRuta: (caso) => caso.materia_origen?.carrera?.pensum_url
    },
    {
        nombre: 'Programa de la materia de origen',
        obtenerRuta: (caso) => caso.materia_origen?.programa_url
    },
    {
        nombre: 'Pensum de la carrera de destino',
        obtenerRuta: (caso) => caso.materia_destino?.carrera?.pensum_url
    },
    {
        nombre: 'Programa de la materia de destino',
        obtenerRuta: (caso) => caso.materia_destino?.programa_url
    }
];

// Se parte de la materia de origen para quedarse solo con los casos de la universidad (RN2).
const CAMPOS_MATERIA_ORIGEN = `
    id_materia,
    nombre,
    programa_url,
    carrera!inner (
        nombre,
        pensum_url,
        id_universidad
    ),
    casos:caso_equivalencia!caso_equivalencia_id_materia_origen_fkey!inner (
        id_caso,
        id_solicitud,
        porcentaje_propuesto,
        justificacion_manual,
        solicitud:solicitud_equivalencia!fk_caso_solicitud_equivalencia (
            nombre_estudiante,
            codigo_institucional,
            modalidad
        ),
        estado_calculo,
        porcentaje_coincidencia,
        justificacion_ia,
        motivo_error_calculo,
        fecha_registro,
        estado,
        confirmada_universidad,
        fecha_confirmacion,
        id_usuario_confirmacion,
        materia_destino:materia!caso_equivalencia_id_materia_destino_fkey (
            nombre,
            programa_url,
            carrera (
                nombre,
                pensum_url,
                universidad (
                    nombre
                )
            )
        )
    )
`;

function tieneRuta(ruta) {
    return typeof ruta === 'string' && ruta.trim() !== '';
}

function obtenerDocumentosFaltantes(caso) {
    return DOCUMENTOS_REQUERIDOS
        .filter((documento) => !tieneRuta(documento.obtenerRuta(caso)))
        .map((documento) => documento.nombre);
}

// RN1: solo un caso CALCULADO tiene un porcentaje que cuente; en cualquier otro estado es null.
function leerPorcentaje(caso, modalidad) {
    if (modalidad !== 'MANUAL' && caso.estado_calculo !== ESTADO_CALCULADO) {
        return null;
    }

    const valor = modalidad === 'MANUAL'
        ? caso.porcentaje_propuesto
        : caso.porcentaje_coincidencia;

    if (valor === null || valor === undefined || valor === '') {
        return null;
    }

    const porcentaje = Number(valor);

    return Number.isFinite(porcentaje) &&
        porcentaje >= 0 &&
        porcentaje <= 100
        ? porcentaje
        : null;
}

// El reporte se guarda como JSON; si la columna es de texto llega como string y se convierte.
function leerReporte(valor) {
    if (typeof valor !== 'string') {
        return valor ?? null;
    }

    try {
        return JSON.parse(valor);
    } catch (error) {
        return valor;
    }
}

function describirMotivo(caso, clasificacion) {
    if (clasificacion.estado_checklist === 'APROBADA') {
        return null;
    }

    if (caso.modalidad === 'MANUAL') {
        if (clasificacion.nivel === 'BAJA') {
            return 'Propuesta manual baja: revisa los documentos antes de confirmar';
        }

        return `La propuesta manual es menor al ${UMBRAL_APROBACION}% requerido para aprobar`;
    }

    if (caso.estado_calculo === ESTADO_ERROR) {
        return caso.motivo_error_calculo || 'No se pudo calcular la coincidencia';
    }

    if (caso.estado_calculo === ESTADO_EN_CALCULO) {
        return 'La evaluación con IA está en curso';
    }

    if (caso.estado_calculo !== ESTADO_CALCULADO || clasificacion.nivel === 'SIN_CALCULAR') {
        return 'Aún no se ha calculado la coincidencia';
    }

    if (clasificacion.nivel === 'BAJA') {
        return 'Coincidencia baja: se recomienda revisión manual';
    }

    return `Coincidencia media: menor al ${UMBRAL_APROBACION}% requerido para aprobar`;
}

function armarCaso(caso) {
    const modalidad = caso.solicitud?.modalidad ?? 'AUTOMATICA';
    const porcentaje = leerPorcentaje(caso, modalidad);
    const clasificacion = clasificarCoincidencia(porcentaje);

    return {
        id_caso: caso.id_caso,
        materia_origen: caso.materia_origen?.nombre ?? null,
        carrera_origen: caso.materia_origen?.carrera?.nombre ?? null,
        materia_destino: caso.materia_destino?.nombre ?? null,
        carrera_destino: caso.materia_destino?.carrera?.nombre ?? null,
        universidad_destino:
            caso.materia_destino?.carrera?.universidad?.nombre ?? null,
        estado_calculo: caso.estado_calculo,
        modalidad,
        nombre_estudiante: caso.solicitud?.nombre_estudiante ?? null,
        codigo_institucional: caso.solicitud?.codigo_institucional ?? null,
        porcentaje_coincidencia:
            modalidad === 'AUTOMATICA' ? porcentaje : null,
        porcentaje_propuesto:
            modalidad === 'MANUAL' ? porcentaje : null,
        justificacion_manual: caso.justificacion_manual ?? null,
        reporte: modalidad === 'AUTOMATICA'
            ? leerReporte(caso.justificacion_ia)
            : null,
        estado_checklist: clasificacion.estado_checklist,
        motivo: describirMotivo(
            { ...caso, modalidad },
            clasificacion
        ),
        documentos_faltantes: obtenerDocumentosFaltantes(caso),
        // HU-5: estado de la revisión del MINED y de la confirmación de la universidad (CA4).
        estado_caso: caso.estado ?? null,
        confirmada_universidad: caso.confirmada_universidad === true,
        fecha_confirmacion: caso.fecha_confirmacion ?? null,
        id_usuario_confirmacion: caso.id_usuario_confirmacion ?? null
    };
}

// Une cada caso con su materia de origen y los ordena del más reciente al más antiguo.
function aplanarCasos(materias) {
    return materias
        .flatMap((materia) => (materia.casos || []).map((caso) => ({ ...caso, materia_origen: materia })))
        .sort((a, b) => String(b.fecha_registro).localeCompare(String(a.fecha_registro)));
}

async function obtenerChecklist(req, res) {
    const idUniversidad = req.usuario.id_universidad;

    // E3: sin universidad identificada no hay checklist.
    if (!idUniversidad) {
        return res.status(400).json({ error: MENSAJE_SIN_UNIVERSIDAD });
    }

    const { data: materias, error } = await supabase
        .from('materia')
        .select(CAMPOS_MATERIA_ORIGEN)
        .eq('carrera.id_universidad', idUniversidad);

    if (error) {
        const estado = error.code === CODIGO_FORMATO_INVALIDO ? 400 : 500;
        const mensaje = estado === 400 ? MENSAJE_UNIVERSIDAD_INVALIDA : error.message;

        return res.status(estado).json({ error: mensaje });
    }

    const casos = aplanarCasos(materias || []).map(armarCaso);

    // E2: la universidad no tiene casos.
    if (casos.length === 0) {
        return res.status(200).json({
            mensaje: MENSAJE_SIN_CASOS,
            id_universidad: idUniversidad,
            resumen: { total: 0, aprobadas: 0, pendientes: 0 },
            casos: [],
            datos_incompletos: []
        });
    }

    // RN5 / CA3: los casos sin sus 4 documentos no se pueden seleccionar.
    const casosCompletos = casos.filter((caso) => caso.documentos_faltantes.length === 0);
    const datosIncompletos = casos
        .filter((caso) => caso.documentos_faltantes.length > 0)
        .map(({ id_caso, materia_origen, materia_destino, documentos_faltantes }) => ({
            id_caso,
            materia_origen,
            materia_destino,
            documentos_faltantes
        }));

    const aprobadas = casosCompletos.filter((caso) => caso.estado_checklist === 'APROBADA').length;

    return res.status(200).json({
        id_universidad: idUniversidad,
        resumen: {
            total: casosCompletos.length,
            aprobadas,
            pendientes: casosCompletos.length - aprobadas
        },
        casos: casosCompletos,
        datos_incompletos: datosIncompletos
    });
}

const REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CASOS_POR_CONFIRMACION = 100;

const MENSAJE_SIN_SELECCION = 'Selecciona al menos una equivalencia para confirmar';
const MENSAJE_ERROR_GUARDADO = 'No se pudieron registrar las equivalencias. Intenta de nuevo';

// Errores que lanza la función confirmar_equivalencias, con su código HTTP.
const ERRORES_CONFIRMACION = {
    CASO_NO_EXISTE: { estado: 404, mensaje: 'Uno o más casos seleccionados no existen.' },
    CASO_AJENO: { estado: 403, mensaje: 'No tienes permiso para confirmar uno o más de los casos seleccionados.' },
    CASO_YA_REVISADO: { estado: 409, mensaje: 'Uno o más casos ya fueron revisados por el MINED y no se pueden confirmar.' },
    CASO_YA_CONFIRMADO: { estado: 409, mensaje: 'Una o más equivalencias ya fueron confirmadas.' },
    CALCULO_INCOMPLETO: { estado: 409, mensaje: 'Debes completar la evaluación antes de confirmar esta equivalencia' },
    DOCUMENTOS_INCOMPLETOS: { estado: 409, mensaje: 'Uno o más casos no tienen sus 4 documentos cargados.' }
};

async function confirmarEquivalencias(req, res) {
    const { ids_caso: idsCaso } = req.body || {};

    // E1: sin materias seleccionadas.
    if (!Array.isArray(idsCaso) || idsCaso.length === 0) {
        return res.status(400).json({ error: MENSAJE_SIN_SELECCION });
    }

    const idsUnicos = [...new Set(idsCaso)];

    if (idsUnicos.length > MAX_CASOS_POR_CONFIRMACION) {
        return res.status(400).json({
            error: `Solo se pueden confirmar ${MAX_CASOS_POR_CONFIRMACION} equivalencias a la vez.`
        });
    }

    if (!idsUnicos.every((id) => typeof id === 'string' && REGEX_UUID.test(id))) {
        return res.status(400).json({ error: 'La selección contiene identificadores de caso no válidos.' });
    }

    // La universidad sale de la sesión (req.usuario), nunca del cuerpo de la petición.
    const { data: fechaConfirmacion, error } = await supabase.rpc('confirmar_equivalencias', {
        p_id_universidad: String(req.usuario.id_universidad),
        p_id_usuario: req.usuario.id,
        p_ids_caso: idsUnicos
    });

    if (error) {
        if (error.message === 'SIN_SELECCION') {
            return res.status(400).json({ error: MENSAJE_SIN_SELECCION });
        }

        const conocido = ERRORES_CONFIRMACION[error.message];

        if (conocido) {
            return res.status(conocido.estado).json({
                error: conocido.mensaje,
                ids_afectados: error.details ? [error.details] : []
            });
        }

        // E6: cualquier otro error; la función ya revirtió todo.
        console.error('No se pudieron confirmar las equivalencias:', error.message);
        return res.status(500).json({ error: MENSAJE_ERROR_GUARDADO });
    }

    return res.status(200).json({
        mensaje: 'Equivalencias confirmadas y registradas exitosamente',
        confirmadas: idsUnicos.length,
        fecha_confirmacion: fechaConfirmacion,
        ids_caso: idsUnicos
    });
}

module.exports = { obtenerChecklist, confirmarEquivalencias };