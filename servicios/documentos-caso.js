const supabase = require('../supabaseClient');

const BUCKET_DOCUMENTOS = 'documentos-carreras';
const VIGENCIA_ENLACE_SEGUNDOS = 3600; // 1 hora (RN4)

// RN3: los 4 documentos del caso, en el orden en que se reportan los faltantes.
const DOCUMENTOS_CASO = [
    {
        clave: 'pensum_origen',
        nombre: 'Pensum de la carrera de origen',
        obtenerRuta: (caso) => caso.materia_origen?.carrera?.pensum_url
    },
    {
        clave: 'programa_origen',
        nombre: 'Programa de la materia de origen',
        obtenerRuta: (caso) => caso.materia_origen?.programa_url
    },
    {
        clave: 'pensum_destino',
        nombre: 'Pensum de la carrera de destino',
        obtenerRuta: (caso) => caso.materia_destino?.carrera?.pensum_url
    },
    {
        clave: 'programa_destino',
        nombre: 'Programa de la materia de destino',
        obtenerRuta: (caso) => caso.materia_destino?.programa_url
    }
];

// Devuelve la URL firmada o null si la ruta está vacía o Storage no pudo firmarla.
async function generarEnlaceTemporal(ruta) {
    if (typeof ruta !== 'string' || ruta.trim() === '') {
        return null;
    }

    const { data, error } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .createSignedUrl(ruta, VIGENCIA_ENLACE_SEGUNDOS);

    if (error || !data?.signedUrl) {
        // Solo al log del servidor: la ruta interna no debe llegar al cliente (RN4).
        console.error(`No se pudo generar el enlace temporal de "${ruta}":`, error?.message);
        return null;
    }

    return data.signedUrl;
}

/**
 * Genera los enlaces temporales de los 4 documentos de un caso de equivalencia.
 *
 * `caso` debe traer, como en obtenerPanel:
 *   materia_origen:  { programa_url, carrera: { pensum_url } }
 *   materia_destino: { programa_url, carrera: { pensum_url } }
 *
 * Devuelve:
 *   {
 *     enlaces: { pensum_origen, programa_origen, pensum_destino, programa_destino }, // URL o null
 *     documentos_faltantes: ['Pensum de la carrera de origen', ...]                  // [] si no falta nada
 *   }
 */
async function generarEnlacesDocumentos(caso) {
    const urls = await Promise.all(
        DOCUMENTOS_CASO.map((documento) => generarEnlaceTemporal(documento.obtenerRuta(caso)))
    );

    const enlaces = {};
    const documentosFaltantes = [];

    DOCUMENTOS_CASO.forEach((documento, indice) => {
        enlaces[documento.clave] = urls[indice];
        if (!urls[indice]) {
            documentosFaltantes.push(documento.nombre);
        }
    });

    return { enlaces, documentos_faltantes: documentosFaltantes };
}

async function descargarDocumento(ruta) {
    if (typeof ruta !== 'string' || ruta.trim() === '') {
        const error = new Error('DOCUMENTO_NO_DISPONIBLE');
        error.code = 'DOCUMENTO_NO_DISPONIBLE';
        throw error;
    }

    const { data, error: errorDescarga } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .download(ruta);

    if (errorDescarga || !data) {
        console.error('No se pudo descargar un documento desde Storage:', errorDescarga?.message);

        const error = new Error('DOCUMENTO_NO_DISPONIBLE');
        error.code = 'DOCUMENTO_NO_DISPONIBLE';
        throw error;
    }

    return Buffer.from(await data.arrayBuffer());
}

async function descargarDocumentosCaso(caso) {
    const documentos = {};

    await Promise.all(
        DOCUMENTOS_CASO.map(async (documento) => {
            const ruta = documento.obtenerRuta(caso);
            documentos[documento.clave] = await descargarDocumento(ruta);
        })
    );

    return documentos;
}

module.exports = {
    generarEnlacesDocumentos,
    descargarDocumentosCaso
};