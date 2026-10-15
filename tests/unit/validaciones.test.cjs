const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const entorno = require('../helpers/entorno.cjs');
const d = require('../helpers/datos.cjs');
const { registrarUniversidad } = require('../../controllers/universidades.controller');
const { registrarEquivalencias } = require('../../controllers/equivalencias.controller');
const validarArchivo = require('../../middlewares/validarArchivo');
beforeEach(() => entorno.preparar());
afterEach(() => entorno.verificarConsumo());

for (const campo of Object.keys(d.universidad)) {
    test(`universidad: ${campo} vacío devuelve 400`, async () => {
        const res = entorno.respuesta();
        await registrarUniversidad({ body: { ...d.universidad, [campo]: '  ' } }, res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'Campos obligatorios faltantes o inválidos', campos: [campo] });
        assert.equal(entorno.llamadas.length, 0);
    });
}
for (const valor of [123, true, {}, []]) {
    test(`universidad: tipo ${JSON.stringify(valor)} debe producir error de validación`, async () => {
        const res = entorno.respuesta();
        await registrarUniversidad({ body: { ...d.universidad, nombre: valor } }, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.campos.includes('nombre'));
    });
}
test('universidad: datos válidos crean usuario y universidad', async () => {
    const registro = { id_universidad: 10, nombre: d.universidad.nombre };
    entorno.preparar([d.consulta(), { operacion: 'auth', resultado: { data: { user: { id: 'qa-usuario' } }, error: null }, verificar: datos => assert.equal(datos.email, d.universidad.correo) },
        d.consulta(null, null, args => { assert.equal(args.tabla, 'usuario'); assert.equal(args.insert[0][0].rol, 'UNIVERSIDAD'); }),
        d.consulta(registro, null, args => { assert.equal(args.tabla, 'universidad'); assert.equal(args.insert[0][0].nombre, d.universidad.nombre); })]);
    const res = entorno.respuesta();
    await registrarUniversidad({ body: d.universidad }, res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body.universidad, registro);
});
for (const [nombre, pasos, codigo, mensaje] of [
    ['duplicada', [d.consulta({ id_universidad: 10 })], 409, 'Ya existe una universidad registrada con ese nombre. Verifique los datos.'],
    ['error de búsqueda', [d.consulta(null, { message: 'Error de consulta simulado' })], 500, 'Error de consulta simulado'],
    ['error de Auth', [d.consulta(), { operacion: 'auth', resultado: { error: { message: 'Correo inválido simulado' } } }], 400, 'Correo inválido simulado']
]) {
    test(`universidad: ${nombre}`, async () => {
        entorno.preparar(pasos); const res = entorno.respuesta();
        await registrarUniversidad({ body: d.universidad }, res);
        assert.equal(res.statusCode, codigo); assert.deepEqual(res.body, { error: mensaje });
    });
}
for (const campo of Object.keys(d.equivalencia)) {
    test(`equivalencia: falta ${campo}`, async () => {
        const body = { ...d.equivalencia }; delete body[campo];
        const res = entorno.respuesta(); await registrarEquivalencias({ body }, res);
        assert.equal(res.statusCode, 400); assert.deepEqual(res.body.campos, [campo]);
        assert.equal(entorno.llamadas.length, 0);
    });
}
test('equivalencia: materias iguales deben devolver HTTP 400', async () => {
    const res = entorno.respuesta();
    await registrarEquivalencias({ body: { ...d.equivalencia, id_materia_destino: 1 } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'La materia de origen y destino no pueden ser la misma.');
});
for (const [nombre, pasos, codigo, mensaje] of [
    ['origen inexistente', [d.consulta()], 400, 'La materia de origen indicada no existe.'],
    ['destino inexistente', [d.consulta(d.materia), d.consulta()], 400, 'La materia de destino indicada no existe.'],
    ['identificador rechazado por persistencia', [d.consulta(null, { message: 'Identificador inválido simulado' })], 500, 'Identificador inválido simulado'],
    ['universidad sin permiso', [d.consulta({ ...d.materia, carrera: { ...d.materia.carrera, id_universidad: 99 } }), d.consulta(d.materia)], 403, 'La universidad indicada no tiene permiso sobre la materia de origen. ']
]) {
    test(`equivalencia: ${nombre}`, async () => {
        entorno.preparar(pasos); const res = entorno.respuesta();
        await registrarEquivalencias({ body: { ...d.equivalencia, ...(nombre.startsWith('identificador') ? { id_materia_origen: 'invalido' } : {}) } }, res);
        assert.equal(res.statusCode, codigo); assert.deepEqual(res.body, { error: mensaje });
    });
}
test('equivalencia: archivos faltantes impiden insertar', async () => {
    entorno.preparar([d.consulta({ ...d.materia, programa_url: null }), d.consulta(d.materia)]);
    const res = entorno.respuesta(); await registrarEquivalencias({ body: d.equivalencia }, res);
    assert.equal(res.statusCode, 400); assert.deepEqual(res.body.archivos_faltantes, ['programa de la materia de origen']);
});
test('equivalencia: datos válidos quedan PENDIENTE', async () => {
    entorno.preparar([d.consulta(d.materia), d.consulta(d.materia), d.consulta({ id_caso: 1 }, null, args => {
        assert.equal(args.tabla, 'caso_equivalencia'); assert.deepEqual(args.insert[0][0], {
            id_materia_origen: 1, id_materia_destino: 2, descripcion: d.equivalencia.descripcion, estado: 'PENDIENTE'
        });
    })]);
    const res = entorno.respuesta(); await registrarEquivalencias({ body: d.equivalencia }, res);
    assert.equal(res.statusCode, 201); assert.deepEqual(res.body.equivalencia, { id_caso: 1 });
});
for (const [nombre, buffer, mimetype, valido] of [
    ['vacío', Buffer.alloc(0), d.MIME_PDF, false],
    ['formato incompatible', Buffer.from('texto'), 'text/plain', false],
    ['PDF truncado', Buffer.from('%PDF-1.4'), d.MIME_PDF, false],
    ['DOCX truncado', Buffer.from('PK\x03\x04word/document.xml'), d.MIME_DOCX, false],
    ['PDF válido', d.pdf, d.MIME_PDF, true], ['DOCX válido', d.docx, d.MIME_DOCX, true]
]) {
    test(`archivo: ${nombre}`, () => {
        const req = { file: { buffer, mimetype } }, res = entorno.respuesta(); let siguientes = 0;
        validarArchivo(req, res, () => siguientes++);
        assert.equal(siguientes, valido ? 1 : 0);
        if (!valido) { assert.equal(res.statusCode, 400); assert.equal(res.body.error, 'El archivo no es compatible, formatos aceptados: PDF o Word'); }
        if (valido && mimetype === d.MIME_DOCX) assert.equal(req.advertenciaArchivo, 'El archivo fue cargado, pero su lectura podría tardar o fallar');
    });
}
