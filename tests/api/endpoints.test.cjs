const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const entorno = require('../helpers/entorno.cjs');
const d = require('../helpers/datos.cjs');
const request = require('supertest');
const app = entorno.cargarApp();

const TOKEN_UNIVERSIDAD = 'token-universidad-qa';
const ID_USUARIO = 'usuario-universidad-qa';

function conUniversidadAutenticada(metodo, ruta, ...pasos) {
    entorno.preparar([
        {
            operacion: 'getUser',
            resultado: {
                data: { user: { id: ID_USUARIO } },
                error: null
            }
        },
        d.consulta({
            id_usuario: ID_USUARIO,
            correo: 'qa@example.test',
            rol: 'UNIVERSIDAD',
            estado: 'ACTIVO'
        }),
        d.consulta({
            id_universidad: 10,
            estado: 'ACTIVA'
        }),
        ...pasos
    ]);

    return request(app)[metodo](ruta).set('Authorization', `Bearer ${TOKEN_UNIVERSIDAD}`);
}
beforeEach(() => entorno.preparar());
afterEach(() => entorno.verificarConsumo());

for (const ruta of ['/universidades', '/equivalencias']) {
    test(`${ruta}: campos ausentes, 400 JSON en español`, async () => {
        const peticion = ruta === '/equivalencias'
            ? conUniversidadAutenticada('post', ruta)
            : request(app).post(ruta);
        const res = await peticion.send({}).expect('Content-Type', /json/).expect(400);
        assert.equal(res.body.error, 'Campos obligatorios faltantes o inválidos');
        assert.ok(res.body.campos.length > 0);
        if (ruta === '/equivalencias') {
            assert.deepEqual(res.body.campos, ['id_materia_origen', 'id_materia_destino', 'descripcion']);
        }
    });
}
test('universidades: tipo incorrecto debe devolver 400 JSON', async () => {
    const res = await request(app).post('/universidades').send({ ...d.universidad, nombre: 123 });
    assert.equal(res.status, 400); assert.match(res.headers['content-type'], /json/);
    assert.equal(res.body.error, 'Campos obligatorios faltantes o inválidos');
});
test('universidades: duplicada devuelve 409', async () => {
    entorno.preparar([d.consulta({ id_universidad: 10 })]);
    const res = await request(app).post('/universidades').send(d.universidad).expect(409);
    assert.equal(res.body.error, 'Ya existe una universidad registrada con ese nombre. Verifique los datos.');
});
test('universidades: registro válido devuelve 201 y universidad', async () => {
    entorno.preparar([
        // Verificar que la universidad no existe.
        d.consulta(),

        // Simular la creación exitosa de la cuenta en Auth.
        {
            operacion: 'auth',
            resultado: {
                data: { user: { id: 'qa' } },
                error: null
            }
        },

        // HU-11: registrar usuario y universidad en una sola RPC.
        {
            operacion: 'rpc',
            resultado: {
                data: { id_universidad: 10 },
                error: null
            },
            verificar: args => {
                assert.equal(
                    args.nombre,
                    'registrar_universidad_transaccional'
                );

                assert.deepEqual(args.parametros, {
                    p_id_usuario: 'qa',
                    p_correo: d.universidad.correo,
                    p_nombre: d.universidad.nombre,
                    p_ubicacion: d.universidad.ubicacion,
                    p_correo_contacto: d.universidad.correo_contacto,
                    p_telefono_contacto: d.universidad.telefono_contacto
                });
            }
        }
    ]);

    const res = await request(app)
        .post('/universidades')
        .send(d.universidad)
        .expect(201)
        .expect('Content-Type', /json/);

    assert.deepEqual(res.body.universidad, {
        id_universidad: 10
    });

    // Conservamos el contrato de respuesta existente.
    assert.equal(
        res.body.mensaje,
        'Universidad registarada exitosamente'
    );

    // Debe haber exactamente tres operaciones:
    // consulta de duplicados, Auth y RPC.
    assert.deepEqual(
        entorno.llamadas.map(llamada => llamada.operacion),
        ['consulta', 'auth', 'rpc']
    );
});
test('universidades: fallo PostgreSQL compensa Auth', async () => {
    entorno.preparar([
        // La universidad todavía no existe.
        d.consulta(),

        // Supabase Auth crea correctamente la cuenta.
        {
            operacion: 'auth',
            resultado: {
                data: { user: { id: 'qa-hu11' } },
                error: null
            }
        },

        // La función transaccional falla en PostgreSQL.
        {
            operacion: 'rpc',
            resultado: {
                data: null,
                error: {
                    code: '23505',
                    message: 'ERROR_INTERNO_SIMULADO'
                }
            },
            verificar: args => {
                assert.equal(
                    args.nombre,
                    'registrar_universidad_transaccional'
                );
                assert.equal(
                    args.parametros.p_id_usuario,
                    'qa-hu11'
                );
            }
        },

        // HU-11 CA4: el backend intenta eliminar
        // la cuenta que acaba de crear.
        {
            operacion: 'deleteUser',
            resultado: {
                data: {},
                error: null
            },
            verificar: args => {
                assert.equal(
                    args.idUsuario,
                    'qa-hu11'
                );
            }
        }
    ]);

    const res = await request(app)
        .post('/universidades')
        .send(d.universidad)
        .expect(500)
        .expect('Content-Type', /json/);

    // La respuesta debe ser controlada.
    assert.equal(
        res.body.error,
        'No se pudo registrar la universidad. Intenta de nuevo.'
    );

    // No debemos exponer información interna de PostgreSQL.
    assert.doesNotMatch(
        JSON.stringify(res.body),
        /ERROR_INTERNO_SIMULADO|23505/
    );

    // Verificamos el orden exacto de las operaciones.
    assert.deepEqual(
        entorno.llamadas.map(llamada => llamada.operacion),
        ['consulta', 'auth', 'rpc', 'deleteUser']
    );
});
test('universidades: fallo de compensación Auth registra incidencia', async () => {
    entorno.preparar([
        // La universidad no existe previamente.
        d.consulta(),

        // Auth crea correctamente la cuenta.
        {
            operacion: 'auth',
            resultado: {
                data: { user: { id: 'qa-hu11' } },
                error: null
            }
        },

        // PostgreSQL rechaza el registro transaccional.
        {
            operacion: 'rpc',
            resultado: {
                data: null,
                error: {
                    code: '23505',
                    message: 'ERROR_SQL_INTERNO_SIMULADO'
                }
            },
            verificar: args => {
                assert.equal(
                    args.nombre,
                    'registrar_universidad_transaccional'
                );
            }
        },

        // La eliminación compensatoria también falla.
        {
            operacion: 'deleteUser',
            resultado: {
                data: null,
                error: {
                    code: 'AUTH_DELETE_SIMULADO',
                    message: 'ERROR_ELIMINACION_SIMULADO'
                }
            },
            verificar: args => {
                assert.equal(args.idUsuario, 'qa-hu11');
            }
        }
    ]);

    // Capturar los logs para verificar que se registra
    // la incidencia, sin imprimir errores simulados.
    const logs = [];

    const capturaLog = require('node:test').mock.method(
        console,
        'error',
        (...argumentos) => {
            logs.push(argumentos);
        }
    );

    try {
        const res = await request(app)
            .post('/universidades')
            .send(d.universidad)
            .expect(500)
            .expect('Content-Type', /json/);

        // El cliente recibe un mensaje controlado.
        assert.equal(
            res.body.error,
            'No se pudo registrar la universidad. Intenta de nuevo.'
        );

        // No revelar detalles internos al cliente.
        assert.doesNotMatch(
            JSON.stringify(res.body),
            /ERROR_SQL_INTERNO_SIMULADO|ERROR_ELIMINACION_SIMULADO|23505/
        );

        // Comprobar el orden de las operaciones.
        assert.deepEqual(
            entorno.llamadas.map(llamada => llamada.operacion),
            ['consulta', 'auth', 'rpc', 'deleteUser']
        );

        // Comprobar que el fallo de compensación
        // quedó registrado para recuperación manual.
        const incidencia = logs.find(
            ([evento]) =>
                evento === 'HU11_COMPENSACION_AUTH_FALLIDA'
        );

        assert.ok(
            incidencia,
            'Debe registrarse una incidencia de compensación'
        );

        assert.equal(
            incidencia[1].id_usuario,
            'qa-hu11'
        );

        assert.equal(
            incidencia[1].codigo,
            'AUTH_DELETE_SIMULADO'
        );

        assert.ok(
            !Number.isNaN(Date.parse(incidencia[1].fecha)),
            'La incidencia debe incluir una fecha válida'
        );

    } finally {
        // Restaurar console.error, incluso si falla la prueba.
        capturaLog.mock.restore();
    }
});
test('universidades: excepción al compensar Auth registra incidencia', async () => {
    entorno.preparar([
        // La universidad no existe previamente.
        d.consulta(),

        // Supabase Auth crea correctamente la cuenta.
        {
            operacion: 'auth',
            resultado: {
                data: { user: { id: 'qa-hu11-excepcion' } },
                error: null
            }
        },

        // La RPC de PostgreSQL devuelve un error simulado.
        {
            operacion: 'rpc',
            resultado: {
                data: null,
                error: {
                    code: '23505',
                    message: 'ERROR_SQL_SIMULADO'
                }
            },
            verificar: args => {
                assert.equal(
                    args.nombre,
                    'registrar_universidad_transaccional'
                );
            }
        },

        // Simular una excepción inesperada durante deleteUser.
        {
            operacion: 'deleteUser',
            verificar: args => {
                assert.equal(
                    args.idUsuario,
                    'qa-hu11-excepcion'
                );

                throw new Error('EXCEPCION_AUTH_SIMULADA');
            }
        }
    ]);

    const logs = [];

    const capturaLog = require('node:test').mock.method(
        console,
        'error',
        (...argumentos) => {
            logs.push(argumentos);
        }
    );

    try {
        const res = await request(app)
            .post('/universidades')
            .send(d.universidad)
            .expect(500)
            .expect('Content-Type', /json/);

        // La excepción no debe llegar al cliente.
        assert.equal(
            res.body.error,
            'No se pudo registrar la universidad. Intenta de nuevo.'
        );

        assert.doesNotMatch(
            JSON.stringify(res.body),
            /EXCEPCION_AUTH_SIMULADA|ERROR_SQL_SIMULADO|23505/
        );

        // Verificar que se intentó la compensación.
        assert.deepEqual(
            entorno.llamadas.map(llamada => llamada.operacion),
            ['consulta', 'auth', 'rpc', 'deleteUser']
        );

        // Debe registrarse la incidencia de compensación.
        const incidencia = logs.find(
            ([evento]) =>
                evento === 'HU11_COMPENSACION_AUTH_FALLIDA'
        );

        assert.ok(
            incidencia,
            'Debe registrarse la excepción de compensación'
        );

        assert.equal(
            incidencia[1].id_usuario,
            'qa-hu11-excepcion'
        );

        assert.equal(
            incidencia[1].codigo,
            'ERROR_DESCONOCIDO'
        );

        assert.equal(
            incidencia[1].detalle,
            'EXCEPCION_AUTH_SIMULADA'
        );

        assert.ok(
            !Number.isNaN(Date.parse(incidencia[1].fecha)),
            'La incidencia debe incluir una fecha válida'
        );

    } finally {
        capturaLog.mock.restore();
    }
});
test('equivalencias: materias iguales deben devolver 400 y mensaje en español', async () => {
    const res = await conUniversidadAutenticada('post', '/equivalencias')
        .send({ ...d.equivalencia, id_materia_destino: 1 });
    assert.equal(res.status, 400); assert.equal(res.body.error, 'La materia de origen y destino no pueden ser la misma.');
});
test('equivalencias: origen inexistente devuelve 400', async () => {
    const res = await conUniversidadAutenticada('post', '/equivalencias', d.consulta())
        .send(d.equivalencia)
        .expect(400);

    assert.equal(res.body.error, 'La materia de origen indicada no existe.');
});

test('equivalencias: error del servicio se propaga como 500', async () => {
    const res = await conUniversidadAutenticada(
        'post', '/equivalencias', d.consulta(null, { message: 'Error de consulta simulado' })
    ).send(d.equivalencia).expect(500);
    assert.deepEqual(res.body, { error: 'Error de consulta simulado' });
});
test('equivalencias: registro válido devuelve 201', async () => {
    const res = await conUniversidadAutenticada(
        'post', '/equivalencias',
        d.consulta(d.materia), d.consulta(d.materia), d.consulta({ id_caso: 1 })
    ).send(d.equivalencia).expect(201);
    assert.deepEqual(res.body, { mensaje: 'Equivalencia registrada exitosamente', equivalencia: { id_caso: 1 } });
});
test('archivos: solicitud sin archivo devuelve 400', async () => {
    const res = await conUniversidadAutenticada('post', '/archivos').send({}).expect(400);
    assert.equal(res.body.error, 'No se recibió ningún archivo, o el formato no es válido (solo PDF o Word).');
});
for (const [nombre, buffer, contentType, mensaje] of [
    ['vacío', Buffer.alloc(0), d.MIME_PDF, 'El archivo no es compatible, formatos aceptados: PDF o Word'],
    ['MIME incompatible', Buffer.from('texto'), 'text/plain', 'El archivo no es compatible, formatos aceptados: PDF o Word'],
    ['contenido incompatible', Buffer.from('esto no es PDF'), d.MIME_PDF, 'El archivo no es compatible, formatos aceptados: PDF o Word'],
    ['más de 20 MB', Buffer.alloc(20 * 1024 * 1024 + 1), d.MIME_PDF, 'El archivo supera el tamaño máximo permitido (20 MB).']
]) {
    test(`archivos: ${nombre}`, async () => {
        const res = await conUniversidadAutenticada('post', '/archivos').field('tipo', 'pensum').field('id_carrera', '10')
            .attach('archivo', buffer, { filename: 'qa.pdf', contentType }).expect(400).expect('Content-Type', /json/);
        assert.deepEqual(res.body, { error: mensaje }); assert.equal(entorno.llamadas.length, 3);
    });
}
for (const [nombre, buffer, contentType] of [['PDF', d.pdf, d.MIME_PDF], ['DOCX', d.docx, d.MIME_DOCX]]) {
    test(`archivos: ${nombre} válido devuelve 201`, async () => {
        const extension = nombre.toLowerCase();
        const patronRuta = new RegExp(
            `^10/pensum/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.${extension}$`,
            'i'
        );

        const res = await conUniversidadAutenticada(
            'post', '/archivos',
            d.consulta({ id_carrera: '10', id_universidad: 10 }),
            {
            operacion: 'upload', resultado: { error: null }, verificar: args => {
                assert.equal(args.bucket, 'documentos-carreras'); assert.deepEqual(args.datos[1], buffer);
            }
            },
            d.consulta(null, null, args => {
                assert.equal(args.tabla, 'carrera');
                assert.deepEqual(args.eq, [['id_carrera', '10']]);
                assert.match(args.update[0][0].pensum_url, patronRuta);
            })
        ).field('tipo', 'pensum').field('id_carrera', '10')
            .attach('archivo', buffer, { filename: `qa.${nombre.toLowerCase()}`, contentType }).expect(201);
        assert.equal(res.body.mensaje, 'Archivo cargado exitosamente');
        assert.match(res.body.path, patronRuta);
        if (nombre === 'DOCX') assert.equal(res.body.advertencia, 'El archivo fue cargado, pero su lectura podría tardar o fallar');
        else assert.equal(res.body.advertencia, undefined);
    });
}
for (const [campos, mensaje] of [[{}, 'Debe indicar el tipo de documento: pensum o programa.'], [{ tipo: 'pensum' }, 'Falta id_carrera para subir el pensum.'], [{ tipo: 'programa' }, 'Falta id_materia para subir el programa.']]) {
    test(`archivos: ${mensaje}`, async () => {
        let peticion = conUniversidadAutenticada('post', '/archivos');
        for (const [clave, valor] of Object.entries(campos)) peticion = peticion.field(clave, valor);
        const res = await peticion.attach('archivo', d.pdf, { filename: 'qa.pdf', contentType: d.MIME_PDF }).expect(400);
        assert.deepEqual(res.body, { error: mensaje }); assert.equal(entorno.llamadas.length, 3);
    });
}
test('archivos: error de almacenamiento devuelve 500', async () => {
    const res = await conUniversidadAutenticada(
        'post', '/archivos',
        d.consulta({ id_carrera: '10', id_universidad: 10 }),
        { operacion: 'upload', resultado: { error: { message: 'Error de almacenamiento simulado' } } }
    ).field('tipo', 'pensum').field('id_carrera', '10')
        .attach('archivo', d.pdf, { filename: 'qa.pdf', contentType: d.MIME_PDF }).expect(500);
    assert.deepEqual(res.body, { error: 'Error de almacenamiento simulado' });
});
