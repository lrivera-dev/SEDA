const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const validarArchivo = require('../middlewares/validarArchivo');

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MENSAJE_RECHAZO = 'El archivo no es compatible, formatos aceptados: PDF o Word';
const MENSAJE_ADVERTENCIA = 'El archivo fue cargado, pero su lectura podría tardar o fallar';

const PDF_VALIDO = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const PDF_CORTADO = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');

// Un DOCX es un ZIP: empieza con "PK\x03\x04", contiene word/document.xml y termina con "PK\x05\x06"
const INICIO_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const CIERRE_ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)]);
const DOCX_VALIDO = Buffer.concat([INICIO_ZIP, Buffer.from('....word/document.xml....'), CIERRE_ZIP]);
const DOCX_CORTADO = Buffer.concat([INICIO_ZIP, Buffer.from('....word/document.xml....')]);

// Simula la petición, la respuesta y next() de Express
function ejecutarValidador(archivo) {
    const req = archivo === undefined ? {} : { file: archivo };
    const resultado = { siguio: false, estado: null, cuerpo: null };

    const res = {
        status(codigo) {
            resultado.estado = codigo;
            return this;
        },
        json(cuerpo) {
            resultado.cuerpo = cuerpo;
            return this;
        }
    };

    validarArchivo(req, res, () => {
        resultado.siguio = true;
    });

    return { ...resultado, advertencia: req.advertenciaArchivo };
}

function assertRechazado(resultado) {
    assert.equal(resultado.siguio, false);
    assert.equal(resultado.estado, 400);
    assert.deepEqual(resultado.cuerpo, { error: MENSAJE_RECHAZO });
}

describe('validarArchivo', () => {
    it('deja pasar un PDF válido sin advertencia', () => {
        const resultado = ejecutarValidador({ buffer: PDF_VALIDO, mimetype: MIME_PDF });

        assert.equal(resultado.siguio, true);
        assert.equal(resultado.advertencia, undefined);
    });

    it('deja pasar un Word válido con la advertencia de lectura', () => {
        const resultado = ejecutarValidador({ buffer: DOCX_VALIDO, mimetype: MIME_DOCX });

        assert.equal(resultado.siguio, true);
        assert.equal(resultado.advertencia, MENSAJE_ADVERTENCIA);
    });

    it('rechaza un PDF cortado (dañado)', () => {
        assertRechazado(ejecutarValidador({ buffer: PDF_CORTADO, mimetype: MIME_PDF }));
    });

    it('rechaza un Word cortado (dañado)', () => {
        assertRechazado(ejecutarValidador({ buffer: DOCX_CORTADO, mimetype: MIME_DOCX }));
    });

    it('rechaza un archivo vacío', () => {
        assertRechazado(ejecutarValidador({ buffer: Buffer.alloc(0), mimetype: MIME_PDF }));
    });

    it('rechaza texto disfrazado de PDF o de Word', () => {
        const texto = Buffer.from('esto no es un documento');

        assertRechazado(ejecutarValidador({ buffer: texto, mimetype: MIME_PDF }));
        assertRechazado(ejecutarValidador({ buffer: texto, mimetype: MIME_DOCX }));
    });

    it('rechaza un Word renombrado como PDF', () => {
        assertRechazado(ejecutarValidador({ buffer: DOCX_VALIDO, mimetype: MIME_PDF }));
    });

    it('rechaza formatos no soportados (imagen)', () => {
        assertRechazado(ejecutarValidador({ buffer: PDF_VALIDO, mimetype: 'image/png' }));
    });

    it('si no llegó archivo, continúa para que el controlador responda', () => {
        assert.equal(ejecutarValidador(undefined).siguio, true);
    });
});