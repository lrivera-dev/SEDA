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
    entorno.preparar([d.consulta(), { operacion: 'auth', resultado: { data: { user: { id: 'qa' } } } }, d.consulta(), d.consulta({ id_universidad: 10 })]);
    const res = await request(app).post('/universidades').send(d.universidad).expect(201).expect('Content-Type', /json/);
    assert.deepEqual(res.body.universidad, { id_universidad: 10 });
    // Se conserva la errata existente para documentar el contrato actual.
    assert.equal(res.body.mensaje, 'Universidad registarada exitosamente');
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
                assert.match(args.update[0][0].pensum_url, /^10\/pensum\/\d+-qa\./);
            })
        ).field('tipo', 'pensum').field('id_carrera', '10')
            .attach('archivo', buffer, { filename: `qa.${nombre.toLowerCase()}`, contentType }).expect(201);
        assert.equal(res.body.mensaje, 'Archivo cargado exitosamente'); assert.match(res.body.path, /^10\/pensum\/\d+-qa\./);
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
