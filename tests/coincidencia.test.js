'use strict';

// Igual que rutas.test.js: activa el entorno aislado del equipo antes de
// cargar controladores. Nunca usa Supabase, Gemini ni conexiones externas.
const entorno = require('./entorno-prueba');
const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { reintentarCoincidencia } = require('../controllers/coincidencia.controller');
const limitarReintentos = require('../middlewares/limitarReintentos');
const colaEvaluacion = require('../servicios/cola-evaluacion');
const { calcularCoincidencia } = require('../servicios/ia-coincidencia');
const { clasificarCoincidencia } = require('../servicios/clasificar-coincidencia');

const ID_CASO = '00000000-0000-4000-8000-000000000001';
const ID_UNIVERSIDAD = 'universidad-prueba';
const DOCUMENTOS = {
    programa_origen: 'Programa de Matemática I',
    programa_destino: 'Programa de Matemática General',
    pensum_origen: 'Pensum de origen',
    pensum_destino: 'Pensum de destino'
};
const REPORTE_VALIDO = {
    porcentaje: 80,
    resumen: '  Equivalencia favorable  ',
    contenidos_coincidentes: 'Coinciden los contenidos principales',
    metodologia: 'Metodologías similares',
    diferencias: 'Existen diferencias menores',
    contexto_pensum: 'Materias del mismo nivel',
    conclusion: 'Se recomienda revisión de MINED'
};

function casoBase(cambios = {}) {
    return {
        id_caso: ID_CASO,
        estado: 'PENDIENTE',
        estado_calculo: 'ERROR',
        materia_origen: { carrera: { id_universidad: ID_UNIVERSIDAD } },
        ...cambios
    };
}

function consultarCaso(caso, error = null) {
    entorno.preparar([{
        operacion: 'consulta',
        resultado: { data: caso, error },
        verificar(argumentos) {
            assert.equal(argumentos.tabla, 'caso_equivalencia');
            assert.deepEqual(argumentos.eq, [['id_caso', ID_CASO]]);
        }
    }]);
}

async function reintentar({ idCaso = ID_CASO, idUniversidad = ID_UNIVERSIDAD } = {}) {
    const req = {
        params: { id_caso: idCaso },
        body: idUniversidad === undefined ? {} : { id_universidad: idUniversidad }
    };
    const res = entorno.respuesta();
    await reintentarCoincidencia(req, res);
    return res;
}

function clienteIA(texto, comprobarSolicitud = () => {}) {
    let llamadas = 0;
    const cliente = {
        models: {
            async generateContent(solicitud) {
                llamadas += 1;
                comprobarSolicitud(solicitud);
                return { text: texto };
            }
        }
    };
    return { cliente, cantidad: () => llamadas };
}

async function ejecutarIA(cliente) {
    // Valores ficticios: la dependencia inyectada impide importar o llamar a Gemini.
    const clavePrevia = process.env.IA_API_KEY;
    const modeloPrevio = process.env.IA_MODELO;
    process.env.IA_API_KEY = 'clave-de-prueba-sin-acceso';
    process.env.IA_MODELO = 'modelo-de-prueba-sin-acceso';
    try {
        return await calcularCoincidencia(DOCUMENTOS, { cliente });
    } finally {
        if (clavePrevia === undefined) delete process.env.IA_API_KEY;
        else process.env.IA_API_KEY = clavePrevia;
        if (modeloPrevio === undefined) delete process.env.IA_MODELO;
        else process.env.IA_MODELO = modeloPrevio;
    }
}

// Se borra el registro de solicitudes simulado tras cada caso de prueba;
// el guardián del equipo exige terminar sin operaciones pendientes.
beforeEach(() => entorno.preparar());
afterEach(() => {
    entorno.verificarConsumo();
    entorno.preparar();
});

describe('POST /coincidencia/:id_caso/reintentar (Supabase y cola simulados)', () => {
    it('sin universidad devuelve 400 sin consultar Supabase', async () => {
        const res = await reintentar({ idUniversidad: null });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Debe indicar la universidad.');
        assert.equal(entorno.llamadas.length, 0);
    });

    it('con identificador de caso inválido devuelve 404', async () => {
        const res = await reintentar({ idCaso: 'no-es-uuid' });
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.error, 'El caso indicado no existe.');
        assert.equal(entorno.llamadas.length, 0);
    });

    it('con caso inexistente devuelve 404', async () => {
        consultarCaso(null);
        const res = await reintentar();
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.error, 'El caso indicado no existe.');
    });

    it('con error de consulta devuelve 500', async () => {
        consultarCaso(null, { message: 'Fallo simulado de Supabase' });
        const res = await reintentar();
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.error, 'Fallo simulado de Supabase');
    });

    it('rechaza con 403 un caso de otra universidad', async () => {
        consultarCaso(casoBase({
            materia_origen: { carrera: { id_universidad: 'otra-universidad' } }
        }));
        const res = await reintentar();
        assert.equal(res.statusCode, 403);
        assert.match(res.body.error, /no tiene permiso/);
    });

    it('rechaza con 409 un caso que MINED ya revisó', async () => {
        consultarCaso(casoBase({ estado: 'ACEPTADO' }));
        const res = await reintentar();
        assert.equal(res.statusCode, 409);
        assert.match(res.body.error, /ya fue revisado/);
    });

    for (const estado of ['CALCULADO', 'EN_CALCULO']) {
        it(`rechaza con 409 un caso ${estado}`, async () => {
            consultarCaso(casoBase({ estado_calculo: estado }));
            const res = await reintentar();
            assert.equal(res.statusCode, 409);
            assert.match(res.body.error, /ya está calculado o en evaluación/);
        });
    }

    for (const estado of ['ERROR', 'SIN_CALCULAR']) {
        it(`admite ${estado}, encola y devuelve 202`, async () => {
            consultarCaso(casoBase({ estado_calculo: estado }));
            const encolar = mock.method(colaEvaluacion, 'encolar', () => true);
            try {
                const res = await reintentar();
                assert.equal(res.statusCode, 202);
                assert.equal(res.body.id_caso, ID_CASO);
                assert.equal(encolar.mock.callCount(), 1);
                assert.equal(encolar.mock.calls[0].arguments[0], ID_CASO);
            } finally {
                encolar.mock.restore();
            }
        });
    }

    it('si la cola lanza un error, devuelve 500', async () => {
        consultarCaso(casoBase());
        const encolar = mock.method(colaEvaluacion, 'encolar', () => {
            throw new Error('Fallo de cola simulado');
        });
        try {
            const res = await reintentar();
            assert.equal(res.statusCode, 500);
            assert.match(res.body.error, /No se pudo poner el caso/);
        } finally {
            encolar.mock.restore();
        }
    });
});

describe('Límite de cinco reintentos por minuto', () => {
    it('permite cinco, bloquea el sexto (429) y libera al cumplirse 60 segundos', () => {
        let ahora = 1_000_000;
        const reloj = mock.method(Date, 'now', () => ahora);
        // IP solo como clave en memoria; NO se realiza ninguna conexión de red.
        const req = { ip: '192.0.2.150' };
        try {
            for (let intento = 1; intento <= 5; intento += 1) {
                let siguio = false;
                limitarReintentos(req, entorno.respuesta(), () => { siguio = true; });
                assert.equal(siguio, true, `El intento ${intento} debe pasar`);
            }
            const bloqueado = entorno.respuesta();
            let siguio = false;
            limitarReintentos(req, bloqueado, () => { siguio = true; });
            assert.equal(siguio, false);
            assert.equal(bloqueado.statusCode, 429);
            assert.match(bloqueado.body.error, /Demasiados intentos/);

            ahora += 60_000;
            const permitido = entorno.respuesta();
            limitarReintentos(req, permitido, () => { siguio = true; });
            assert.equal(siguio, true);
            assert.equal(permitido.statusCode, 200);
        } finally {
            reloj.mock.restore();
        }
    });
});

describe('Respuestas de Gemini mediante cliente simulado', () => {
    it('acepta el JSON válido y configura una solicitud sin enviar nada a Internet', async () => {
        const simulado = clienteIA(JSON.stringify(REPORTE_VALIDO), solicitud => {
            assert.equal(solicitud.model, 'modelo-de-prueba-sin-acceso');
            assert.equal(solicitud.config.responseMimeType, 'application/json');
            assert.equal(solicitud.config.responseJsonSchema.required.length, 7);
            assert.equal(solicitud.contents.length, 4);
        });
        const resultado = await ejecutarIA(simulado.cliente);
        assert.equal(resultado.porcentaje, 80);
        assert.equal(resultado.resumen, 'Equivalencia favorable');
        assert.equal(simulado.cantidad(), 1);
    });

    it('rechaza la respuesta cuando falta una clave obligatoria', async () => {
        const { conclusion, ...incompleto } = REPORTE_VALIDO;
        const simulado = clienteIA(JSON.stringify(incompleto));
        await assert.rejects(ejecutarIA(simulado.cliente), {
            code: 'IA_RESPUESTA_INVALIDA'
        });
        assert.equal(simulado.cantidad(), 1);
    });

    for (const porcentaje of [-1, 101]) {
        it(`rechaza porcentaje fuera de rango (${porcentaje})`, async () => {
            const simulado = clienteIA(JSON.stringify({
                ...REPORTE_VALIDO,
                porcentaje
            }));
            await assert.rejects(ejecutarIA(simulado.cliente), {
                code: 'IA_RESPUESTA_INVALIDA'
            });
        });
    }

    it('rechaza JSON mal formado', async () => {
        const simulado = clienteIA('{"porcentaje":80');
        await assert.rejects(ejecutarIA(simulado.cliente), {
            code: 'IA_RESPUESTA_INVALIDA'
        });
    });

    it('traduce un error del servicio simulado a IA_NO_DISPONIBLE', async () => {
        const simulado = {
            models: {
                async generateContent() {
                    throw new Error('Error simulado del proveedor');
                }
            }
        };
        await assert.rejects(ejecutarIA(simulado), {
            code: 'IA_NO_DISPONIBLE'
        });
    });
});

describe('Clasificación de coincidencia por umbrales', () => {
    for (const [valor, nivel, estado] of [
        [null, 'SIN_CALCULAR', 'PENDIENTE_ANALISIS'],
        [0, 'BAJA', 'PENDIENTE_ANALISIS'],
        [59.99, 'BAJA', 'PENDIENTE_ANALISIS'],
        [60, 'MEDIA', 'PENDIENTE_ANALISIS'],
        [79.99, 'MEDIA', 'PENDIENTE_ANALISIS'],
        [80, 'ALTA', 'APROBADA'],
        [100, 'ALTA', 'APROBADA']
    ]) {
        it(`${valor} se clasifica como ${nivel}`, () => {
            assert.deepEqual(clasificarCoincidencia(valor), {
                nivel,
                estado_checklist: estado
            });
        });
    }

    it('rechaza valores inválidos sin interpretarlos como porcentajes', () => {
        for (const valor of [-1, 101, Number.NaN, '80']) {
            assert.throws(() => clasificarCoincidencia(valor), TypeError);
        }
    });
});
