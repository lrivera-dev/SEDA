const MENSAJE_RECHAZO = 'El archivo no es compatible, formatos aceptados: PDF o Word';
const MENSAJE_ADVERTENCIA = 'El archivo fue cargado, pero su lectura podría tardar o fallar';

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function esPdfValido(buffer) {
    const inicio = buffer.subarray(0, 5).toString('latin1');
    const final = buffer.subarray(Math.max(0, buffer.length - 1024)).toString('latin1');
    return inicio === '%PDF-' && final.includes('%%EOF');
}

function esDocxValido(buffer) {
    const esZip = buffer.length >= 4 &&
        buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!esZip || !buffer.includes('word/document.xml')) return false;

    const cola = buffer.subarray(Math.max(0, buffer.length - 65557));
    return cola.includes(Buffer.from([0x50, 0x4B, 0x05, 0x06]));
}

function validarArchivo(req, res, next) {
    if (!req.file) return next();

    const { buffer, mimetype } = req.file;

    if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: MENSAJE_RECHAZO });
    }

    if (mimetype === MIME_PDF) {
        if (!esPdfValido(buffer)) {
            return res.status(400).json({ error: MENSAJE_RECHAZO });
        }
        return next();
    }

    if (mimetype === MIME_DOCX) {
        if (!esDocxValido(buffer)) {
            return res.status(400).json({ error: MENSAJE_RECHAZO });
        }
        req.advertenciaArchivo = MENSAJE_ADVERTENCIA;
        return next();
    }

    return res.status(400).json({ error: MENSAJE_RECHAZO });
}

module.exports = validarArchivo;