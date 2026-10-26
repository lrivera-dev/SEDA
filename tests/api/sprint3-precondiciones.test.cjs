const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
// Las barreras y la fábrica simulada se instalan antes de importar SEDA.
const e = require('../helpers/entorno.cjs');
const d = require('../helpers/datos.cjs');
const request = require('supertest');
const app = e.cargarApp();
const TOKEN_UNIVERSIDAD = 'token-universidad-sprint3-qa';
const ID_USUARIO = 'usuario-universidad-sprint3-qa';
beforeEach(() => e.preparar());
afterEach(() => e.verificarConsumo());

function pasosSesionUniversidad() {
    return [
        {
            operacion: 'getUser',
            resultado: { data: { user: { id: ID_USUARIO } }, error: null },
            verificar: args => assert.equal(args.token, TOKEN_UNIVERSIDAD)
        },
        d.consulta({
            id_usuario: ID_USUARIO,
            correo: 'qa@example.test',
            rol: 'UNIVERSIDAD',
            estado: 'ACTIVO'
        }, null, args => assert.equal(args.tabla, 'usuario')),
        d.consulta({ id_universidad: 10, estado: 'ACTIVA' }, null,
            args => assert.equal(args.tabla, 'universidad'))
    ];
}

// Precondición de HU-3, implementada por HU-2. No evalúa IA ni checklist.
// Bits presentes: pensum origen, programa origen, pensum destino, programa destino.
for (let mask = 0; mask < 15; mask++) {
    const id = String(mask + 1).padStart(2, '0');
    test(`S3-PRE-${id}: registro rechaza documentos incompletos máscara ${mask} sin insertar`, async () => {
        const origen = structuredClone(d.materia);
        const destino = structuredClone(d.materia);
        origen.carrera.pensum_url = mask & 1 ? 'ficticio/pensum-origen.pdf' : null;
        origen.programa_url = mask & 2 ? 'ficticio/programa-origen.pdf' : null;
        destino.carrera.pensum_url = mask & 4 ? 'ficticio/pensum-destino.docx' : null;
        destino.programa_url = mask & 8 ? 'ficticio/programa-destino.docx' : null;
        const lectura = (data, idMateria) => d.consulta(data, null, a => {
            assert.equal(a.tabla, 'materia');
            assert.deepEqual(a.eq, [['id_materia', idMateria]]);
            assert.ok(a.select);
            assert.equal(a.insert, undefined);
            assert.equal(a.update, undefined);
        });
        e.preparar([
            ...pasosSesionUniversidad(),
            lectura(origen, d.equivalencia.id_materia_origen),
            lectura(destino, d.equivalencia.id_materia_destino)
        ]);
        const r = await request(app).post('/equivalencias')
            .set('Authorization', `Bearer ${TOKEN_UNIVERSIDAD}`)
            .send(d.equivalencia).expect(400).expect('Content-Type', /json/);
        assert.equal(r.body.error, 'No se puede registrar la equivalencia: faltan archivos por cargar.');
        assert.ok(Array.isArray(r.body.archivos_faltantes));
        assert.equal(r.body.archivos_faltantes.length, 4 - [1, 2, 4, 8].filter(bit => mask & bit).length);
        assert.ok(r.body.archivos_faltantes.every(x => typeof x === 'string' && x.length > 0));
        assert.equal(r.body.equivalencia, undefined);
        assert.equal(e.llamadas.length, 5, 'Auth valida la sesión y solo se consultan las dos materias');
        assert.ok(e.llamadas.slice(3).every(x => x.operacion === 'consulta' && x.argumentos.tabla === 'materia'));
    });
}
