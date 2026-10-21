const supabase = require('../supabaseClient');

const BUCKET_DOCUMENTOS = 'documentos-carreras';

// RN8: límites de texto que se envían a la IA y mínimo para considerar legible un documento.
const MAX_CARACTERES_PROGRAMA = 15000;
const MAX_CARACTERES_PENSUM = 8000;
const MIN_CARACTERES_LEGIBLES = 200;

const DOCUMENTOS_CASO = [
    {
        clave: 'pensum_origen',
        descripcion: 'el pensum de la carrera de origen',
        maxCaracteres: MAX_CARACTERES_PENSUM,
        obtenerRuta: (caso) => caso.materia_origen?.carrera?.pensum_url
    },
    {
        clave: 'programa_origen',
        descripcion: 'el programa de la materia de origen',
        maxCaracteres: MAX_CARACTERES_PROGRAMA,
        obtenerRuta: (caso) => caso.materia_origen?.programa_url
    },
    {
        clave: 'pensum_destino',
        descripcion: 'el pensum de la carrera de destino',
        maxCaracteres: MAX_CARACTERES_PENSUM,
        obtenerRuta: (caso) => caso.materia_destino?.carrera?.pensum_url
    },
    {
        clave: 'programa_destino',
        descripcion: 'el programa de la materia de destino',
        maxCaracteres: MAX_CARACTERES_PROGRAMA,
        obtenerRuta: (caso) => caso.materia_destino?.programa_url
    }
];

function crearErrorDocumento(codigo, documento, detalle) {
    const error = new Error(`${codigo}: ${documento.descripcion}${detalle ? ` (${detalle})` : ''}`);
    error.code = codigo;
    error.documento = documento.descripcion;
    return error;
}

async function descargarDocumento(ruta, documento) {
    if (typeof ruta !== 'string' || ruta.trim() === '') {
        throw crearErrorDocumento('DOCUMENTO_NO_DISPONIBLE', documento, 'sin ruta registrada');
    }

    const { data, error } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .download(ruta);

    if (error || !data) {
        throw crearErrorDocumento('DOCUMENTO_NO_DISPONIBLE', documento, error?.message);
    }

    return Buffer.from(await data.arrayBuffer());
}

function esPdf(buffer) {
    return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

function esDocx(buffer) {
    return buffer.length >= 4 &&
        buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
}

async function extraerTextoPdf(buffer) {
    const { PDFParse } = require('pdf-parse');
    const lector = new PDFParse({ data: buffer });

    try {
        const resultado = await lector.getText();
        return resultado.text;
    } finally {
        await lector.destroy();
    }
}

async function extraerTextoWord(buffer) {
    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
}

function normalizarTexto(texto) {
    return String(texto ?? '')
        .replace(/\0/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '')
        .replace(/[ \t\f\v\u00a0]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function prepararDocumento(documento, caso) {
    const buffer = await descargarDocumento(documento.obtenerRuta(caso), documento);

    let textoExtraido;

    try {
        if (esPdf(buffer)) {
            textoExtraido = await extraerTextoPdf(buffer);
        } else if (esDocx(buffer)) {
            textoExtraido = await extraerTextoWord(buffer);
        }
    } catch (error) {
        console.error(`No se pudo extraer el texto de ${documento.descripcion}:`, error.message);
        throw crearErrorDocumento('DOCUMENTO_ILEGIBLE', documento, 'falló la extracción');
    }

    const texto = normalizarTexto(textoExtraido);

    if (texto.length < MIN_CARACTERES_LEGIBLES) {
        throw crearErrorDocumento('DOCUMENTO_ILEGIBLE', documento, `${texto.length} caracteres de texto`);
    }

    return texto.slice(0, documento.maxCaracteres);
}


async function prepararDocumentos(caso) {
    const resultados = await Promise.allSettled(
        DOCUMENTOS_CASO.map((documento) => prepararDocumento(documento, caso))
    );

    const fallido = resultados.find((resultado) => resultado.status === 'rejected');

    if (fallido) {
        throw fallido.reason;
    }

    const documentos = {};

    DOCUMENTOS_CASO.forEach((documento, indice) => {
        documentos[documento.clave] = resultados[indice].value;
    });

    return documentos;
}

module.exports = {
    prepararDocumentos,
    MAX_CARACTERES_PROGRAMA,
    MAX_CARACTERES_PENSUM,
    MIN_CARACTERES_LEGIBLES
};