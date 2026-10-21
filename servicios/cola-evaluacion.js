const supabase = require('../supabaseClient');
const preparadorDocumentos = require('./preparar-documentos');
const iaCoincidencia = require('./ia-coincidencia');

// RN9: estados del cálculo (columna estado_calculo de caso_equivalencia); SIN_CALCULAR es el valor inicial.
const ESTADO_EN_CALCULO = 'EN_CALCULO';
const ESTADO_CALCULADO = 'CALCULADO';
const ESTADO_ERROR = 'ERROR';

// RN7: tope diario de evaluaciones, configurable con MAX_EVALUACIONES_DIARIAS en el .env.
const MAX_EVALUACIONES_DIARIAS_POR_DEFECTO = 100;
const ZONA_HORARIA = 'America/El_Salvador';

const PREFIJO_ERROR = 'No se pudo calcular la coincidencia: ';
const MENSAJE_CALCULO_INTERRUMPIDO = 'El cálculo se interrumpió, intenta de nuevo';

const CAMPOS_CASO = `
    id_caso,
    estado,
    estado_calculo,
    materia_origen:materia!caso_equivalencia_id_materia_origen_fkey (
        programa_url,
        carrera ( pensum_url )
    ),
    materia_destino:materia!caso_equivalencia_id_materia_destino_fkey (
        programa_url,
        carrera ( pensum_url )
    )
`;

let estaActiva = false;
let estaRecuperada = false;
let estaProcesando = false;
let casoEnProceso = null;
let procesoActual = null;
const casosPendientes = [];
const evaluacionesDelDia = { dia: null, total: 0 };

function obtenerDiaActual() {
    return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA });
}

function obtenerTopeDiario() {
    const configurado = Number.parseInt(process.env.MAX_EVALUACIONES_DIARIAS, 10);
    return Number.isInteger(configurado) && configurado >= 0
        ? configurado
        : MAX_EVALUACIONES_DIARIAS_POR_DEFECTO;
}

function obtenerEvaluacionesDeHoy() {
    if (evaluacionesDelDia.dia !== obtenerDiaActual()) {
        evaluacionesDelDia.dia = obtenerDiaActual();
        evaluacionesDelDia.total = 0;
    }

    return evaluacionesDelDia.total;
}

function haAlcanzadoTopeDiario() {
    return obtenerEvaluacionesDeHoy() >= obtenerTopeDiario();
}

function contarEvaluacion() {
    obtenerEvaluacionesDeHoy();
    evaluacionesDelDia.total += 1;
}

function describirError(error) {
    switch (error.code) {
        case 'DOCUMENTO_ILEGIBLE':
        case 'DOCUMENTO_FORMATO_NO_SOPORTADO':
            return `${PREFIJO_ERROR}no se pudo leer ${error.documento}`;
        case 'DOCUMENTO_NO_DISPONIBLE':
            return `${PREFIJO_ERROR}no se pudo obtener ${error.documento}, intenta de nuevo`;
        case 'IA_TIMEOUT':
        case 'IA_RESPUESTA_INVALIDA':
        case 'IA_NO_DISPONIBLE':
            return `${PREFIJO_ERROR}el servicio de IA no está disponible, intenta de nuevo`;
        default:
            return `${PREFIJO_ERROR}ocurrió un error inesperado, intenta de nuevo`;
    }
}

async function guardarResultado(idCaso, resultado) {
    const { porcentaje, ...reporte } = resultado || {};

    // CA3: un porcentaje inválido nunca se guarda.
    if (typeof porcentaje !== 'number' || !Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        const errorRespuesta = new Error('La IA devolvió un porcentaje inválido');
        errorRespuesta.code = 'IA_RESPUESTA_INVALIDA';
        throw errorRespuesta;
    }

    const { error } = await supabase
        .from('caso_equivalencia')
        .update({
            porcentaje_coincidencia: porcentaje,
            justificacion_ia: reporte,
            estado_calculo: ESTADO_CALCULADO,
            motivo_error_calculo: null,
            fecha_calculo: new Date().toISOString()
        })
        .eq('id_caso', idCaso);

    if (error) {
        throw new Error(`No se pudo guardar el resultado: ${error.message}`);
    }
}

// No toca porcentaje_coincidencia: un caso con error nunca conserva ni guarda un porcentaje.
async function guardarError(idCaso, motivo) {
    const { error } = await supabase
        .from('caso_equivalencia')
        .update({ estado_calculo: ESTADO_ERROR, motivo_error_calculo: motivo })
        .eq('id_caso', idCaso);

    if (error) {
        console.error(`No se pudo guardar el error del caso ${idCaso}:`, error.message);
    }
}

async function evaluarCaso(idCaso) {
    // RN7: al llegar al tope el caso queda como está (SIN_CALCULAR) hasta el día siguiente.
    if (haAlcanzadoTopeDiario()) {
        console.warn(`Tope diario de evaluaciones alcanzado (${obtenerTopeDiario()}): el caso ${idCaso} queda sin calcular.`);
        return;
    }

    const { data: caso, error: errorLectura } = await supabase
        .from('caso_equivalencia')
        .select(CAMPOS_CASO)
        .eq('id_caso', idCaso)
        .maybeSingle();

    if (errorLectura) {
        console.error(`No se pudo leer el caso ${idCaso}:`, errorLectura.message);
        return;
    }

    if (!caso) {
        console.warn(`El caso ${idCaso} ya no existe: se omite la evaluación.`);
        return;
    }

    // E4 / RN5: solo se calculan casos PENDIENTES que no estén ya calculados ni en cálculo.
    if (caso.estado !== 'PENDIENTE' || [ESTADO_EN_CALCULO, ESTADO_CALCULADO].includes(caso.estado_calculo)) {
        console.warn(`El caso ${idCaso} no se evalúa (estado ${caso.estado}, cálculo ${caso.estado_calculo}).`);
        return;
    }

    const { error: errorMarcado } = await supabase
        .from('caso_equivalencia')
        .update({ estado_calculo: ESTADO_EN_CALCULO, motivo_error_calculo: null })
        .eq('id_caso', idCaso);

    if (errorMarcado) {
        console.error(`No se pudo marcar el caso ${idCaso} como en cálculo:`, errorMarcado.message);
        return;
    }

    try {
        const documentos = await preparadorDocumentos.prepararDocumentos(caso);

        contarEvaluacion();
        const resultado = await iaCoincidencia.calcularCoincidencia(documentos);

        await guardarResultado(idCaso, resultado);
    } catch (error) {
        console.error(`Falló la evaluación del caso ${idCaso}:`, error.code || '', error.message);
        await guardarError(idCaso, describirError(error));
    }
}

async function vaciarCola() {
    estaProcesando = true;

    try {
        while (casosPendientes.length > 0) {
            casoEnProceso = casosPendientes.shift();

            try {
                await evaluarCaso(casoEnProceso);
            } catch (error) {
                console.error(`Error inesperado al evaluar el caso ${casoEnProceso}:`, error.message);
            }
        }
    } finally {
        casoEnProceso = null;
        estaProcesando = false;
    }
}

function procesarSiguiente() {
    if (!estaActiva || !estaRecuperada || estaProcesando) {
        return;
    }

    procesoActual = vaciarCola();
}

/**
 * Agrega un caso a la cola de evaluación y vuelve de inmediato, sin esperar el resultado.
 * Devuelve true si quedó encolado; false si la cola no está activa o el caso ya estaba en espera.
 */
function encolar(idCaso) {
    if (!estaActiva || idCaso === undefined || idCaso === null || idCaso === '') {
        return false;
    }

    const idNormalizado = String(idCaso);

    if (idNormalizado === casoEnProceso || casosPendientes.includes(idNormalizado)) {
        return false;
    }

    casosPendientes.push(idNormalizado);
    procesarSiguiente();

    return true;
}

// E3: los casos que quedaron EN_CALCULO por un reinicio pasan a ERROR. Devuelve cuántos fueron.
async function recuperarCasosInterrumpidos() {
    const { data, error } = await supabase
        .from('caso_equivalencia')
        .update({ estado_calculo: ESTADO_ERROR, motivo_error_calculo: MENSAJE_CALCULO_INTERRUMPIDO })
        .eq('estado_calculo', ESTADO_EN_CALCULO)
        .select('id_caso');

    if (error) {
        throw new Error(error.message);
    }

    return data ? data.length : 0;
}

/**
 * Activa la cola. Se llama una sola vez al arrancar el servidor (dentro de
 * `require.main === module` en server.js). Nunca rechaza: si la recuperación falla,
 * lo registra en el log y la cola sigue funcionando.
 */
async function iniciar() {
    if (estaActiva) {
        return;
    }

    estaActiva = true;

    try {
        const recuperados = await recuperarCasosInterrumpidos();

        if (recuperados > 0) {
            console.log(`${recuperados} caso(s) con cálculo interrumpido pasaron a ERROR.`);
        }
    } catch (error) {
        console.error('No se pudieron recuperar los casos con cálculo interrumpido:', error.message);
    }

    estaRecuperada = true;
    procesarSiguiente();
}

// Promesa que se cumple cuando la cola termina lo que tiene en espera (útil en pruebas).
function esperarCola() {
    return procesoActual || Promise.resolve();
}

module.exports = {
    iniciar,
    encolar,
    esperarCola,
    recuperarCasosInterrumpidos
};