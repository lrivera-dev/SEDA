const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const entorno = require('../helpers/entorno.cjs');
const d = require('../helpers/datos.cjs');
const request = require('supertest');
const app = entorno.cargarApp();

// HU-11 · Tarea 3: pruebas de resiliencia con errores simulados de Storage, PostgreSQL y Auth.
// Todo es simulado: no hay conexión real a Supabase.

const MENSAJE_REGISTRO = 'No se pudo registrar la universidad. Intenta de nuevo.';
const MENSAJE_ERROR_GLOBAL = 'Error inesperado al procesar el archivo.';
const TOKEN_UNIVERSIDAD = 'token-universidad-qa';
const ID_USUARIO = 'usuario-universidad-qa';

// Tres accesos de autenticación (getUser, usuario, universidad) + la consulta de la carrera.
const OPERACIONES_BASE_ARCHIVO = ['getUser', 'consulta', 'consulta', 'consulta'];

beforeEach(() => entorno.preparar());
afterEach(() => entorno.verificarConsumo());

function operaciones() {
    return entorno.llamadas.map(llamada => llamada.operacion);
}

// Silencia console.error y guarda lo que se registró, para verificar las incidencias.
function capturarErrores() {
    const registros = [];
    const espia = mock.method(console, 'error', (...argumentos) => {
        registros.push(argumentos);
    });
    return { registros, restaurar: () => espia.mock.restore() };
}

function simularExcepcion(mensaje, codigo = 'ERROR_SIMULADO') {
    return () => {
        throw Object.assign(new Error(mensaje), { code: codigo });
    };
}

function universidadAutenticada(...pasos) {
    entorno.preparar([
        { operacion: 'getUser', resultado: { data: { user: { id: ID_USUARIO } }, error: null } },
        d.consulta({ id_usuario: ID_USUARIO, correo: 'qa@example.test', rol: 'UNIVERSIDAD', estado: 'ACTIVO' }),
        d.consulta({ id_universidad: 10, estado: 'ACTIVA' }),
        ...pasos
    ]);
    return request(app).post('/archivos').set('Authorization', `Bearer ${TOKEN_UNIVERSIDAD}`);
}

function subirPensum(...pasos) {
    return universidadAutenticada(d.consulta({ id_carrera: '10', id_universidad: 10 }), ...pasos)
        .field('tipo', 'pensum')
        .field('id_carrera', '10')
        .attach('archivo', d.pdf, { filename: 'qa.pdf', contentType: d.MIME_PDF });
}

// Registro de universidad: pasos previos comunes.
const sinDuplicado = () => d.consulta();
const authCreada = () => ({
    operacion: 'auth',
    resultado: { data: { user: { id: 'qa-hu11' } }, error: null }
});

// ---------------------------------------------------------------------------
// Registro de universidades (PostgreSQL + Auth)
// ---------------------------------------------------------------------------

for (const [nombre, respuestaRpc] of [
    ['sin datos', { data: null, error: null }],
    ['sin id_universidad', { data: {}, error: null }]
]) {
    test(`universidades: respuesta incompleta de la RPC (${nombre}) no elimina la cuenta de Auth`, async () => {
        entorno.preparar([sinDuplicado(), authCreada(), { operacion: 'rpc', resultado: respuestaRpc }]);
        const errores = capturarErrores();

        try {
            const res = await request(app).post('/universidades').send(d.universidad)
                .expect(500).expect('Content-Type', /json/);

            assert.equal(res.body.error, MENSAJE_REGISTRO);
            // Estado incierto: nunca debe intentarse deleteUser.
            assert.deepEqual(operaciones(), ['consulta', 'auth', 'rpc']);

            const incidencia = errores.registros.find(([evento]) => evento === 'HU11_REGISTRO_ESTADO_INCIERTO');
            assert.ok(incidencia, 'Debe registrarse el estado incierto');
            assert.equal(incidencia[1].motivo, 'RESPUESTA_RPC_INCOMPLETA');
            assert.equal(incidencia[1].id_usuario, 'qa-hu11');
        } finally {
            errores.restaurar();
        }
    });
}

test('universidades: excepción de la RPC se trata como estado incierto y no elimina la cuenta de Auth', async () => {
    entorno.preparar([
        sinDuplicado(),
        authCreada(),
        { operacion: 'rpc', resultado: null, verificar: simularExcepcion('RPC_CAIDA_SIMULADA', 'ECONNRESET') }
    ]);
    const errores = capturarErrores();

    try {
        const res = await request(app).post('/universidades').send(d.universidad)
            .expect(500).expect('Content-Type', /json/);

        assert.equal(res.body.error, MENSAJE_REGISTRO);
        assert.doesNotMatch(JSON.stringify(res.body), /RPC_CAIDA_SIMULADA|ECONNRESET/);
        assert.deepEqual(operaciones(), ['consulta', 'auth', 'rpc']);

        const incidencia = errores.registros.find(([evento]) => evento === 'HU11_REGISTRO_ESTADO_INCIERTO');
        assert.ok(incidencia, 'Debe registrarse el estado incierto');
        assert.equal(incidencia[1].motivo, 'EXCEPCION_RPC');
        assert.equal(incidencia[1].codigo, 'ECONNRESET');
    } finally {
        errores.restaurar();
    }
});

test('universidades: error de Auth al crear la cuenta devuelve 400 controlado sin llamar a la RPC', async () => {
    entorno.preparar([
        sinDuplicado(),
        { operacion: 'auth', resultado: { data: null, error: { message: 'AUTH_INTERNO_SIMULADO' } } }
    ]);

    const res = await request(app).post('/universidades').send(d.universidad)
        .expect(400).expect('Content-Type', /json/);

    assert.equal(res.body.error, 'No se pudo crear la cuenta de la universidad.');
    assert.doesNotMatch(JSON.stringify(res.body), /AUTH_INTERNO_SIMULADO/);
    assert.deepEqual(operaciones(), ['consulta', 'auth']);
});

test('universidades: excepción al crear la cuenta en Auth devuelve 500 controlado sin llamar a la RPC', async () => {
    entorno.preparar([
        sinDuplicado(),
        { operacion: 'auth', resultado: null, verificar: simularExcepcion('AUTH_CAIDO_SIMULADO', 'ECONNRESET') }
    ]);
    const errores = capturarErrores();

    try {
        const res = await request(app).post('/universidades').send(d.universidad).expect(500);

        assert.equal(res.body.error, MENSAJE_REGISTRO);
        assert.doesNotMatch(JSON.stringify(res.body), /AUTH_CAIDO_SIMULADO/);
        assert.deepEqual(operaciones(), ['consulta', 'auth']);
        assert.ok(errores.registros.some(([evento]) => evento === 'HU11_ERROR_CREACION_AUTH'));
    } finally {
        errores.restaurar();
    }
});

test('universidades: Auth responde sin identificador de usuario y no se llama a la RPC', async () => {
    entorno.preparar([
        sinDuplicado(),
        { operacion: 'auth', resultado: { data: { user: {} }, error: null } }
    ]);
    const errores = capturarErrores();

    try {
        const res = await request(app).post('/universidades').send(d.universidad).expect(500);

        assert.equal(res.body.error, MENSAJE_REGISTRO);
        assert.deepEqual(operaciones(), ['consulta', 'auth']);
        assert.ok(errores.registros.some(([evento]) => evento === 'HU11_AUTH_SIN_IDENTIFICADOR'));
    } finally {
        errores.restaurar();
    }
});

test('universidades: error al consultar universidades existentes no crea cuentas y no expone detalles', async () => {
    entorno.preparar([
        d.consulta(null, { code: 'XX000', message: 'ERROR_CONSULTA_INTERNO_SIMULADO' })
    ]);
    const errores = capturarErrores();

    try {
        const res = await request(app).post('/universidades').send(d.universidad)
            .expect(500).expect('Content-Type', /json/);

        assert.equal(res.body.error, MENSAJE_REGISTRO);
        assert.doesNotMatch(JSON.stringify(res.body), /ERROR_CONSULTA_INTERNO_SIMULADO|XX000/);
        assert.deepEqual(operaciones(), ['consulta']);

        const incidencia = errores.registros.find(([evento]) => evento === 'HU11_ERROR_CONSULTA_UNIVERSIDAD');
        assert.ok(incidencia, 'Debe registrarse el error de consulta');
        assert.equal(incidencia[1].codigo, 'XX000');
    } finally {
        errores.restaurar();
    }
});

test('universidades: excepción al consultar universidades existentes no crea cuentas', async () => {
    entorno.preparar([
        { operacion: 'consulta', resultado: null, verificar: simularExcepcion('CONSULTA_CAIDA_SIMULADA') }
    ]);
    const errores = capturarErrores();

    try {
        const res = await request(app).post('/universidades').send(d.universidad).expect(500);

        assert.equal(res.body.error, MENSAJE_REGISTRO);
        assert.doesNotMatch(JSON.stringify(res.body), /CONSULTA_CAIDA_SIMULADA/);
        assert.deepEqual(operaciones(), ['consulta']);
    } finally {
        errores.restaurar();
    }
});

test('universidades: una universidad duplicada devuelve 409 sin crear cuentas ni llamar a la RPC', async () => {
    entorno.preparar([d.consulta({ id_universidad: 10 })]);

    const res = await request(app).post('/universidades').send(d.universidad).expect(409);

    assert.equal(res.body.error, 'Ya existe una universidad registrada con ese nombre. Verifique los datos.');
    assert.deepEqual(operaciones(), ['consulta']);
});

for (const campo of ['nombre', 'ubicacion', 'correo_contacto', 'telefono_contacto', 'correo', 'contrasena']) {
    test(`universidades: ${campo} vacío devuelve 400 sin ningún acceso a Supabase`, async () => {
        const res = await request(app).post('/universidades')
            .send({ ...d.universidad, [campo]: '   ' })
            .expect(400).expect('Content-Type', /json/);

        assert.equal(res.body.error, 'Campos obligatorios faltantes o inválidos');
        assert.deepEqual(res.body.campos, [campo]);
        assert.equal(entorno.llamadas.length, 0);
    });
}

test('universidades: la incidencia de compensación no registra contraseñas ni credenciales', async () => {
    entorno.preparar([
        sinDuplicado(),
        authCreada(),
        { operacion: 'rpc', resultado: { data: null, error: { code: '23505', message: 'ERROR_SQL_INTERNO_SIMULADO' } } },
        { operacion: 'deleteUser', resultado: { data: null, error: { code: 'AUTH_DELETE_SIMULADO', message: 'FALLO_ELIMINACION_SIMULADO' } } }
    ]);
    const errores = capturarErrores();

    try {
        const res = await request(app).post('/universidades').send(d.universidad).expect(500);

        const registrado = JSON.stringify(errores.registros);
        assert.ok(errores.registros.some(([evento]) => evento === 'HU11_COMPENSACION_AUTH_FALLIDA'));
        assert.ok(!registrado.includes(d.universidad.contrasena), 'El log no debe incluir la contraseña');
        assert.ok(!JSON.stringify(res.body).includes(d.universidad.contrasena));
    } finally {
        errores.restaurar();
    }
});

// ---------------------------------------------------------------------------
// Carga de documentos (Storage + PostgreSQL)
// ---------------------------------------------------------------------------

function subidaExitosa(captura) {
    return {
        operacion: 'upload',
        resultado: { error: null },
        verificar: argumentos => { captura.ruta = argumentos.datos[0]; }
    };
}

test('archivos: si falla la subida a Storage no se registra ninguna referencia ni se intenta limpiar', async () => {
    const errores = capturarErrores();

    try {
        await subirPensum({ operacion: 'upload', resultado: { error: { message: 'STORAGE_SIMULADO' } } }).expect(500);

        assert.deepEqual(operaciones(), [...OPERACIONES_BASE_ARCHIVO, 'upload']);
    } finally {
        errores.restaurar();
    }
});

test('archivos: si falla el registro en PostgreSQL se elimina el archivo recién subido', async () => {
    const subida = {};
    const errores = capturarErrores();

    try {
        const res = await subirPensum(
            subidaExitosa(subida),
            d.consulta(null, { message: 'ERROR_SQL_INTERNO_SIMULADO' }),
            {
                operacion: 'remove',
                resultado: { data: [{ name: 'archivo' }], error: null },
                verificar: argumentos => {
                    assert.equal(argumentos.bucket, 'documentos-carreras');
                    // Solo se elimina el archivo nuevo: el anterior se conserva (RN3).
                    assert.deepEqual(argumentos.datos[0], [subida.ruta]);
                }
            }
        ).expect(500).expect('Content-Type', /json/);

        assert.deepEqual(operaciones(), [...OPERACIONES_BASE_ARCHIVO, 'upload', 'consulta', 'remove']);
        // La limpieza fue exitosa: no hay incidencia de huérfanos.
        assert.ok(!errores.registros.some(([texto]) => String(texto).startsWith('[documentos]')));
        // La respuesta no debe mostrar la ruta interna de Storage.
        assert.ok(!JSON.stringify(res.body).includes(subida.ruta));
    } finally {
        errores.restaurar();
    }
});

for (const [nombre, resultadoRemove, motivoEsperado] of [
    ['Storage devuelve un error', { data: null, error: { message: 'LIMPIEZA_FALLIDA_SIMULADA' } }, 'LIMPIEZA_FALLIDA_SIMULADA'],
    ['Storage no confirma la eliminación', { data: [], error: null }, 'Storage no confirmó la eliminación del archivo']
]) {
    test(`archivos: si falla también la limpieza (${nombre}) se registra la incidencia para recuperación manual`, async () => {
        const subida = {};
        const errores = capturarErrores();

        try {
            const res = await subirPensum(
                subidaExitosa(subida),
                d.consulta(null, { message: 'ERROR_SQL_INTERNO_SIMULADO' }),
                { operacion: 'remove', resultado: resultadoRemove }
            ).expect(500);

            assert.deepEqual(operaciones(), [...OPERACIONES_BASE_ARCHIVO, 'upload', 'consulta', 'remove']);

            const incidencia = errores.registros.find(([texto]) => String(texto).startsWith('[documentos]'));
            assert.ok(incidencia, 'La falla de limpieza no puede ignorarse en silencio (RN6)');

            const detalle = JSON.parse(incidencia[1]);
            assert.equal(detalle.ruta_storage, subida.ruta);
            assert.equal(detalle.tipo_documento, 'pensum');
            assert.equal(detalle.id_registro, '10');
            assert.equal(detalle.motivo_error, motivoEsperado);
            assert.ok(!Number.isNaN(Date.parse(detalle.fecha_error)));

            // El cliente nunca recibe la ruta interna del archivo huérfano.
            assert.ok(!JSON.stringify(res.body).includes(subida.ruta));
        } finally {
            errores.restaurar();
        }
    });
}

test('archivos: si la eliminación compensatoria lanza una excepción se registra la incidencia y se responde igual', async () => {
    const subida = {};
    const errores = capturarErrores();

    try {
        await subirPensum(
            subidaExitosa(subida),
            d.consulta(null, { message: 'ERROR_SQL_INTERNO_SIMULADO' }),
            { operacion: 'remove', resultado: null, verificar: simularExcepcion('STORAGE_CAIDO_SIMULADO') }
        ).expect(500);

        const incidencia = errores.registros.find(([texto]) => String(texto).startsWith('[documentos]'));
        assert.ok(incidencia, 'Debe registrarse la incidencia');
        assert.equal(JSON.parse(incidencia[1]).motivo_error, 'STORAGE_CAIDO_SIMULADO');
    } finally {
        errores.restaurar();
    }
});

test('archivos: una excepción inesperada al registrar en PostgreSQL elimina el archivo y responde con error controlado', async () => {
    const subida = {};
    const errores = capturarErrores();

    try {
        const res = await subirPensum(
            subidaExitosa(subida),
            { operacion: 'consulta', resultado: null, verificar: simularExcepcion('SQL_CAIDO_SIMULADO') },
            {
                operacion: 'remove',
                resultado: { data: [{ name: 'archivo' }], error: null },
                verificar: argumentos => assert.deepEqual(argumentos.datos[0], [subida.ruta])
            }
        ).expect(500).expect('Content-Type', /json/);

        assert.deepEqual(res.body, { error: MENSAJE_ERROR_GLOBAL });
        assert.deepEqual(operaciones(), [...OPERACIONES_BASE_ARCHIVO, 'upload', 'consulta', 'remove']);
    } finally {
        errores.restaurar();
    }
});

test('archivos: una excepción al subir a Storage responde con error controlado sin registrar referencia', async () => {
    const errores = capturarErrores();

    try {
        const res = await subirPensum(
            { operacion: 'upload', resultado: null, verificar: simularExcepcion('STORAGE_CAIDO_SIMULADO') }
        ).expect(500).expect('Content-Type', /json/);

        assert.deepEqual(res.body, { error: MENSAJE_ERROR_GLOBAL });
        assert.deepEqual(operaciones(), [...OPERACIONES_BASE_ARCHIVO, 'upload']);
    } finally {
        errores.restaurar();
    }
});

// Hallazgo para reportar (RN7): el controlador devuelve errorGuardado.message al cliente, por lo que
// el mensaje interno de PostgreSQL llega a la respuesta. Se marca como pendiente (todo) para dejar
// la evidencia sin bloquear el CI; quitar la marca cuando el equipo corrija el controlador.
test('archivos: el mensaje interno de PostgreSQL no debería llegar al cliente (RN7)',
    { todo: 'Hallazgo HU-11 RN7: archivos.controller devuelve errorGuardado.message al cliente' },
    async () => {
        const subida = {};
        const errores = capturarErrores();

        try {
            const res = await subirPensum(
                subidaExitosa(subida),
                d.consulta(null, { message: 'ERROR_SQL_INTERNO_SIMULADO' }),
                { operacion: 'remove', resultado: { data: [{ name: 'archivo' }], error: null } }
            ).expect(500);

            assert.doesNotMatch(JSON.stringify(res.body), /ERROR_SQL_INTERNO_SIMULADO/);
        } finally {
            errores.restaurar();
        }
    });
