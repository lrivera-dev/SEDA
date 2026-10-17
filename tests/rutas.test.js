require('./entorno-prueba');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');

const ID_CASO = '00000000-0000-0000-0000-000000000000';
const MENSAJE_NO_AUTORIZADO = 'No autorizado.';
const MENSAJE_NO_COMPATIBLE = 'El archivo no es compatible, formatos aceptados: PDF o Word';
const TIEMPO_MAXIMO_MS = 5000;

const PDF_VALIDO = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

let servidor;
let urlBase;

async function pedir(metodo, ruta, { cuerpo, token, formulario } = {}) {
    const encabezados = {};
    let contenido;

    // GET y HEAD no pueden llevar cuerpo
    if (cuerpo !== undefined && metodo !== 'GET' && metodo !== 'HEAD') {
        encabezados['Content-Type'] = 'application/json';
        contenido = JSON.stringify(cuerpo);
    }

    if (formulario) {
        contenido = formulario;
    }

    if (token) {
        encabezados.Authorization = `Bearer ${token}`;
    }

    const respuesta = await fetch(urlBase + ruta, {
        method: metodo,
        headers: encabezados,
        body: contenido,
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });

    const texto = await respuesta.text();
    let datos = null;

    try {
        datos = JSON.parse(texto);
    } catch (error) {
        // La respuesta no es JSON (por ejemplo, una página HTML)
    }

    return { estado: respuesta.status, datos, texto };
}

function crearFormulario(contenido, tipoMime, campos = {}) {
    const formulario = new FormData();

    for (const [clave, valor] of Object.entries(campos)) {
        formulario.append(clave, valor);
    }

    formulario.append('archivo', new Blob([contenido], { type: tipoMime }), 'documento');

    return formulario;
}

describe('Rutas de la API (sin base de datos real)', () => {
    before(async () => {
        servidor = app.listen(0, '127.0.0.1');
        await once(servidor, 'listening');
        urlBase = `http://127.0.0.1:${servidor.address().port}`;
    });

    after(() => {
        servidor.closeAllConnections();
        servidor.close();
    });

    describe('Arranque', () => {
        it('sirve la página de inicio', async () => {
            const { estado, texto } = await pedir('GET', '/');

            assert.equal(estado, 200);
            assert.match(texto, /<html/i);
        });

        it('sirve la pantalla de subida de archivos', async () => {
            const { estado } = await pedir('GET', '/subir-archivos');

            assert.equal(estado, 200);
        });

        it('responde 404 en una ruta que no existe', async () => {
            const { estado } = await pedir('GET', '/ruta-que-no-existe');

            assert.equal(estado, 404);
        });
    });

    describe('Rutas protegidas (solo MINED)', () => {
        const RUTAS_PROTEGIDAS = [
            ['GET', '/panel'],
            ['GET', `/casos/${ID_CASO}`],
            ['PATCH', `/casos/${ID_CASO}/revision`]
        ];

        for (const [metodo, ruta] of RUTAS_PROTEGIDAS) {
            it(`${metodo} ${ruta} sin token responde 401`, async () => {
                const { estado, datos } = await pedir(metodo, ruta, { cuerpo: {} });

                assert.equal(estado, 401);
                assert.equal(datos.error, MENSAJE_NO_AUTORIZADO);
            });

            it(`${metodo} ${ruta} con token inválido responde 401`, async () => {
                const { estado, datos } = await pedir(metodo, ruta, { cuerpo: {}, token: 'token-falso' });

                assert.equal(estado, 401);
                assert.equal(datos.error, MENSAJE_NO_AUTORIZADO);
            });
        }
    });

    describe('Inicio de sesión', () => {
        it('sin datos responde 400', async () => {
            const { estado, datos } = await pedir('POST', '/auth/login', { cuerpo: {} });

            assert.equal(estado, 400);
            assert.equal(datos.error, 'Ingresa tu correo y contraseña');
        });

        it('con el correo pero sin contraseña responde 400', async () => {
            const { estado, datos } = await pedir('POST', '/auth/login', { cuerpo: { correo: 'mined@ejemplo.com' } });

            assert.equal(estado, 400);
            assert.equal(datos.error, 'Ingresa tu correo y contraseña');
        });
    });

    describe('Validación de datos obligatorios', () => {
        it('POST /universidades sin datos lista los campos faltantes', async () => {
            const { estado, datos } = await pedir('POST', '/universidades', { cuerpo: {} });

            assert.equal(estado, 400);
            assert.deepEqual(
                datos.campos,
                ['nombre', 'ubicacion', 'correo_contacto', 'telefono_contacto', 'correo', 'contrasena']
            );
        });

        it('POST /equivalencias sin datos lista los campos faltantes', async () => {
            const { estado, datos } = await pedir('POST', '/equivalencias', { cuerpo: {} });

            assert.equal(estado, 400);
            assert.deepEqual(
                datos.campos,
                ['id_materia_origen', 'id_materia_destino', 'descripcion', 'id_universidad']
            );
        });
    });

    describe('Subida de archivos', () => {
        it('sin archivo responde 400', async () => {
            const { estado, datos } = await pedir('POST', '/archivos', { cuerpo: {} });

            assert.equal(estado, 400);
            assert.match(datos.error, /No se recibió ningún archivo/);
        });

        it('rechaza una imagen con el mensaje de formato no compatible', async () => {
            const formulario = crearFormulario(PDF_VALIDO, 'image/png', { tipo: 'pensum' });
            const { estado, datos } = await pedir('POST', '/archivos', { formulario });

            assert.equal(estado, 400);
            assert.equal(datos.error, MENSAJE_NO_COMPATIBLE);
        });

        it('rechaza un PDF dañado antes de subirlo', async () => {
            const formulario = crearFormulario('esto no es un pdf', 'application/pdf', { tipo: 'pensum' });
            const { estado, datos } = await pedir('POST', '/archivos', { formulario });

            assert.equal(estado, 400);
            assert.equal(datos.error, MENSAJE_NO_COMPATIBLE);
        });

        it('rechaza un archivo de más de 20 MB', async () => {
            const archivoGrande = Buffer.alloc(21 * 1024 * 1024);
            const formulario = crearFormulario(archivoGrande, 'application/pdf', { tipo: 'pensum' });
            const { estado, datos } = await pedir('POST', '/archivos', { formulario });

            assert.equal(estado, 400);
            assert.match(datos.error, /supera el tamaño máximo/);
        });

        it('un PDF válido sin tipo de documento llega al controlador y pide el tipo', async () => {
            const formulario = crearFormulario(PDF_VALIDO, 'application/pdf');
            const { estado, datos } = await pedir('POST', '/archivos', { formulario });

            assert.equal(estado, 400);
            assert.match(datos.error, /tipo de documento/);
        });
    });
});