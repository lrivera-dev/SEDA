const assert = require('node:assert/strict');
const e = require('./entorno.cjs');
const ID = '11111111-1111-4111-8111-111111111111';
const REVISOR = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'token-ficticio-casos';
function consulta(data, verificar, error = null) {
    return { operacion: 'consulta', resultado: { data, error }, verificar };
}
function sesion(rol = 'MINED', estado = 'ACTIVO') {
    return [
        { operacion: 'getUser', resultado: { data: { user: { id: REVISOR } }, error: null },
            verificar: a => assert.equal(a.token, TOKEN) },
        consulta({ id_usuario: REVISOR, correo: 'qa@example.test', rol, estado }, a => {
            assert.equal(a.tabla, 'usuario'); assert.deepEqual(a.eq, [['id_usuario', REVISOR]]);
        })
    ];
}
function lectura(data, error = null) {
    return consulta(data, a => {
        assert.equal(a.tabla, 'caso_equivalencia');
        assert.deepEqual(a.eq, [['id_caso', ID]]);
        assert.ok(a.select); assert.equal(a.update, undefined); assert.equal(a.insert, undefined);
    }, error);
}
const claves = ['pensum_origen', 'programa_origen', 'pensum_destino', 'programa_destino'];
const etiquetas = ['Pensum de la carrera de origen', 'Programa de la materia de origen',
    'Pensum de la carrera de destino', 'Programa de la materia de destino'];
function caso(mask = 15) {
    return { id_caso: ID, descripcion: 'Equivalencia ficticia', estado: 'PENDIENTE',
        fecha_registro: '2026-01-01T00:00:00Z', porcentaje_coincidencia: null,
        materia_origen: { nombre: 'Materia A', programa_url: mask & 2 ? 'privado/programa-origen.pdf' : null,
            carrera: { nombre: 'Carrera A', pensum_url: mask & 1 ? 'privado/pensum-origen.pdf' : null, universidad: { nombre: 'Universidad A' } } },
        materia_destino: { nombre: 'Materia B', programa_url: mask & 8 ? 'privado/programa-destino.pdf' : null,
            carrera: { nombre: 'Carrera B', pensum_url: mask & 4 ? 'privado/pensum-destino.pdf' : null, universidad: { nombre: 'Universidad B' } } } };
}
function firmas(mask = 15, fallo = false) {
    const rutas = ['privado/pensum-origen.pdf', 'privado/programa-origen.pdf', 'privado/pensum-destino.pdf', 'privado/programa-destino.pdf'];
    return claves.flatMap((clave, i) => mask & (1 << i) ? [{ operacion: 'createSignedUrl',
        resultado: fallo ? { data: null, error: { message: 'Fallo Storage simulado' } } : { data: { signedUrl: `https://documentos.invalid/${clave}?firma=ficticia` }, error: null },
        verificar: a => { assert.equal(a.bucket, 'documentos-carreras'); assert.deepEqual(a.datos, [rutas[i], 3600]); } }] : []);
}
module.exports = { e, ID, REVISOR, TOKEN, consulta, sesion, lectura, caso, firmas, claves, etiquetas };
