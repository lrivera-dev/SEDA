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
const preparadorDocumentos = require('../servicios/preparar-documentos');

const ID_CASO = '00000000-0000-4000-8000-000000000001';
const ID_UNIVERSIDAD = 'universidad-prueba';
const DOCUMENTOS = {
    programa_origen: 'Programa de Matemática I',
    programa_destino: 'Programa de Matemática General',
    pensum_origen: 'Pensum de origen',
    pensum_destino: 'Pensum de destino'
};
const REPORTE_VALIDO = {
    evaluacion_posible: true,
    documento_ilegible: 'NINGUNO',
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

async function reintentar({
    idCaso = ID_CASO,
    idUniversidad = ID_UNIVERSIDAD
} = {}) {
    const req = {
        params: { id_caso: idCaso },
        usuario: idUniversidad === undefined
            ? undefined
            : { id_universidad: idUniversidad }
    };

    const res = entorno.respuesta();
    await reintentarCoincidencia(req, res);
    return res;
}

function clienteIA(texto, comprobarSolicitud = () => { }) {
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
            assert.equal(solicitud.config.responseJsonSchema.required.length, 9);
            assert.equal(solicitud.contents.length, 4);
        });
        const resultado = await ejecutarIA(simulado.cliente);
        assert.equal(resultado.porcentaje, 80);
        assert.equal(resultado.resumen, 'Equivalencia favorable');
        assert.equal(simulado.cantidad(), 1);
    });

    it('acepta 0% cuando la evaluación fue válida', async () => {
        const simulado = clienteIA(JSON.stringify({
            ...REPORTE_VALIDO,
            porcentaje: 0
        }));

        const resultado = await ejecutarIA(simulado.cliente);

        assert.equal(resultado.porcentaje, 0);
        assert.equal(
            Object.hasOwn(resultado, 'evaluacion_posible'),
            false
        );
    });

    it('rechaza un documento ilegible sin guardar porcentaje', async () => {
        const simulado = clienteIA(JSON.stringify({
            ...REPORTE_VALIDO,
            evaluacion_posible: false,
            documento_ilegible: 'programa_origen',
            porcentaje: null,
            resumen: 'No se pudo leer el programa de origen'
        }));

        await assert.rejects(
            ejecutarIA(simulado.cliente),
            (error) => {
                assert.equal(error.code, 'DOCUMENTO_ILEGIBLE');
                assert.equal(
                    error.documento,
                    'el programa de la materia de origen'
                );
                return true;
            }
        );
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

    it('convierte el timeout de 60 segundos en IA_TIMEOUT', async () => {
        const temporizadorOriginal = globalThis.setTimeout;
        let tiempoLimiteConfigurado = false;

        const temporizador = mock.method(
            globalThis,
            'setTimeout',
            (callback, milisegundos, ...argumentos) => {
                if (milisegundos === 60_000) {
                    tiempoLimiteConfigurado = true;

                    // Simula el vencimiento sin esperar 60 segundos.
                    queueMicrotask(() => callback(...argumentos));
                    return null;
                }

                return temporizadorOriginal(
                    callback,
                    milisegundos,
                    ...argumentos
                );
            }
        );

        const cliente = {
            models: {
                generateContent({ config }) {
                    return new Promise((resolve, reject) => {
                        config.abortSignal.addEventListener(
                            'abort',
                            () => reject(new Error('Tiempo agotado')),
                            { once: true }
                        );
                    });
                }
            }
        };

        try {
            await assert.rejects(
                ejecutarIA(cliente),
                { code: 'IA_TIMEOUT' }
            );

            assert.equal(tiempoLimiteConfigurado, true);
        } finally {
            temporizador.mock.restore();
        }
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

describe('HU-3 CA3: limpieza de resultados ante errores', () => {
    it('guarda ERROR y elimina porcentaje y reporte anteriores', async () => {
        const errorIA = new Error('Documento ilegible');
        errorIA.code = 'DOCUMENTO_ILEGIBLE';
        errorIA.documento = 'el programa de la materia de origen';

        const preparar = mock.method(
            preparadorDocumentos,
            'prepararDocumentos',
            async () => DOCUMENTOS
        );

        const evaluar = mock.method(
            require('../servicios/ia-coincidencia'),
            'calcularCoincidencia',
            async () => {
                throw errorIA;
            }
        );

        const caso = casoBase({
            estado_calculo: 'SIN_CALCULAR',
            porcentaje_coincidencia: 0,
            justificacion_ia: { resumen: 'Resultado anterior' }
        });

        entorno.preparar([
            {
                operacion: 'consulta',
                resultado: { data: [], error: null }
            },
            {
                operacion: 'consulta',
                resultado: { data: caso, error: null }
            },
            {
                operacion: 'rpc',
                resultado: { data: true, error: null },
                verificar(argumentos) {
                    assert.equal(
                    argumentos.nombre,
                    'reservar_evaluacion_diaria'
                    );
                }
            },
            {
                operacion: 'consulta',
                resultado: { error: null }
            },
            {
                operacion: 'consulta',
                resultado: { error: null }
            }
        ]);

        try {
            await colaEvaluacion.iniciar();

            assert.equal(colaEvaluacion.encolar(ID_CASO), true);
            await colaEvaluacion.esperarCola();

            assert.equal(preparar.mock.callCount(), 1);
            assert.equal(evaluar.mock.callCount(), 1);
            assert.equal(entorno.llamadas.length, 5);

            const ultimaLlamada = entorno.llamadas.at(-1);
            assert.equal(
                ultimaLlamada.argumentos.tabla,
                'caso_equivalencia'
            );

            assert.deepEqual(
                ultimaLlamada.argumentos.update[0][0],
                {
                    estado_calculo: 'ERROR',
                    porcentaje_coincidencia: null,
                    justificacion_ia: null,
                    fecha_calculo: null,
                    motivo_error_calculo:
                        'No se pudo calcular la coincidencia: ' +
                        'no se pudo leer el programa de la materia de origen'
                }
            );

            assert.deepEqual(
                ultimaLlamada.argumentos.eq[0],
                ['id_caso', ID_CASO]
            );
        } finally {
            preparar.mock.restore();
            evaluar.mock.restore();
        }
    });
});

describe('HU-3 E3: recuperación de cálculos interrumpidos', () => {
    it('cambia EN_CALCULO a ERROR después de una interrupción', async () => {
        entorno.preparar([
            {
                operacion: 'consulta',
                resultado: {
                    data: [{ id_caso: ID_CASO }],
                    error: null
                },
                verificar(argumentos) {
                    assert.equal(
                        argumentos.tabla,
                        'caso_equivalencia'
                    );

                    assert.deepEqual(
                        argumentos.update[0][0],
                        {
                            estado_calculo: 'ERROR',
                            motivo_error_calculo:
                                'El cálculo se interrumpió, intenta de nuevo'
                        }
                    );

                    assert.deepEqual(
                        argumentos.eq,
                        [['estado_calculo', 'EN_CALCULO']]
                    );

                    assert.deepEqual(
                        argumentos.select,
                        [['id_caso']]
                    );
                }
            }
        ]);

        const recuperados =
            await colaEvaluacion.recuperarCasosInterrumpidos();

        assert.equal(recuperados, 1);
        assert.equal(entorno.llamadas.length, 1);
    });
});

describe('HU-3 RN7: límite diario de evaluaciones', () => {
    it('procesa 100 evaluaciones y bloquea la número 101', async () => {
        const limiteAnterior = process.env.MAX_EVALUACIONES_DIARIAS;
        const rutaCola = require.resolve('../servicios/cola-evaluacion');
        const moduloAnterior = require.cache[rutaCola];

        process.env.MAX_EVALUACIONES_DIARIAS = '100';

        // Nueva instancia de la cola con contador diario en cero.
        delete require.cache[rutaCola];
        const colaAislada = require(rutaCola);

        const preparar = mock.method(
            preparadorDocumentos,
            'prepararDocumentos',
            async () => DOCUMENTOS
        );

        const evaluar = mock.method(
            require('../servicios/ia-coincidencia'),
            'calcularCoincidencia',
            async () => ({
                porcentaje: 80,
                resumen: 'Resultado simulado'
            })
        );

        // Una consulta de recuperación inicial.
        const pasos = [{
            operacion: 'consulta',
            resultado: { data: [], error: null }
        }];

        // Simular 100 reservas autorizadas por PostgreSQL.
        for (let i = 1; i <= 100; i++) {
            pasos.push(
                {
                    operacion: 'consulta',
                    resultado: {
                        data: casoBase({
                            id_caso: `caso-${i}`,
                            estado_calculo: 'SIN_CALCULAR'
                        }),
                        error: null
                    }
                },
                {
                    operacion: 'rpc',
                    resultado: { data: true, error: null },
                    verificar(argumentos) {
                        assert.equal(
                            argumentos.nombre,
                            'reservar_evaluacion_diaria'
                        );
                    }
                },
                {
                    operacion: 'consulta',
                    resultado: { error: null }
                },
                {
                    operacion: 'consulta',
                    resultado: { error: null }
                }
            );
        }

        // La evaluación 101 encuentra el límite agotado.
        pasos.push(
            {
                operacion: 'consulta',
                resultado: {
                    data: casoBase({
                        id_caso: 'caso-101',
                        estado_calculo: 'SIN_CALCULAR'
                    }),
                    error: null
                }
            },
            {
                operacion: 'rpc',
                resultado: { data: false, error: null },
                verificar(argumentos) {
                    assert.equal(
                        argumentos.nombre,
                        'reservar_evaluacion_diaria'
                    );
                }
            }
        );

        entorno.preparar(pasos);

        try {
            await colaAislada.iniciar();

            for (let i = 1; i <= 101; i++) {
                assert.equal(
                    colaAislada.encolar(`caso-${i}`),
                    true
                );

                await colaAislada.esperarCola();
            }

            assert.equal(preparar.mock.callCount(), 100);
            assert.equal(evaluar.mock.callCount(), 100);

            // 1 recuperación + 100 evaluaciones × 3 operaciones.
            assert.equal(entorno.llamadas.length, 403);
        } finally {
            preparar.mock.restore();
            evaluar.mock.restore();

            require.cache[rutaCola] = moduloAnterior;

            if (limiteAnterior === undefined) {
                delete process.env.MAX_EVALUACIONES_DIARIAS;
            } else {
                process.env.MAX_EVALUACIONES_DIARIAS = limiteAnterior;
            }
        }
    });
});

describe('HU-3 E2: timeout de Gemini en la cola', () => {
    it('guarda ERROR y elimina resultados anteriores', async () => {
        const rutaCola = require.resolve('../servicios/cola-evaluacion');
        const moduloAnterior = require.cache[rutaCola];

        delete require.cache[rutaCola];
        const colaAislada = require(rutaCola);

        const preparar = mock.method(
            preparadorDocumentos,
            'prepararDocumentos',
            async () => DOCUMENTOS
        );

        const evaluar = mock.method(
            require('../servicios/ia-coincidencia'),
            'calcularCoincidencia',
            async () => {
                const error = new Error('Tiempo agotado');
                error.code = 'IA_TIMEOUT';
                throw error;
            }
        );

        entorno.preparar([
            {
                operacion: 'consulta',
                resultado: { data: [], error: null }
            },
            {
                operacion: 'consulta',
                resultado: {
                    data: casoBase({
                        estado_calculo: 'SIN_CALCULAR',
                        porcentaje_coincidencia: 85,
                        justificacion_ia: {
                            resumen: 'Reporte anterior'
                        }
                    }),
                    error: null
                }
            },
            {
                operacion: 'rpc',
                resultado: { data: true, error: null },
                verificar(argumentos) {
                    assert.equal(
                        argumentos.nombre,
                        'reservar_evaluacion_diaria'
                    );
                }
            },
            {
                operacion: 'consulta',
                resultado: { error: null }
            },
            {
                operacion: 'consulta',
                resultado: { error: null }
            }
        ]);

        try {
            await colaAislada.iniciar();

            assert.equal(
                colaAislada.encolar(ID_CASO),
                true
            );

            await colaAislada.esperarCola();

            assert.equal(preparar.mock.callCount(), 1);
            assert.equal(evaluar.mock.callCount(), 1);
            assert.equal(entorno.llamadas.length, 5);

            const ultimaLlamada = entorno.llamadas.at(-1);

            assert.equal(
                ultimaLlamada.argumentos.tabla,
                'caso_equivalencia'
            );

            assert.deepEqual(
                ultimaLlamada.argumentos.update[0][0],
                {
                    estado_calculo: 'ERROR',
                    porcentaje_coincidencia: null,
                    justificacion_ia: null,
                    fecha_calculo: null,
                    motivo_error_calculo:
                        'No se pudo calcular la coincidencia: ' +
                        'el servicio de IA no está disponible, ' +
                        'intenta de nuevo'
                }
            );
        } finally {
            preparar.mock.restore();
            evaluar.mock.restore();
            require.cache[rutaCola] = moduloAnterior;
        }
    });
});
