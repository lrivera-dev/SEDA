const supabase = require('../supabaseClient');
const { randomUUID } = require('node:crypto');
const { BUCKET_DOCUMENTOS } = require('./documentos-caso');

// Dónde se guarda en PostgreSQL la referencia de cada tipo de documento.
const REFERENCIAS_POR_TIPO = {
    pensum: { tabla: 'carrera', columna: 'pensum_url', columnaId: 'id_carrera' },
    programa: { tabla: 'materia', columna: 'programa_url', columnaId: 'id_materia' }
};

function construirRutaDocumento({ tipo, idCarrera, idRegistro, extension }) {
    const nombreArchivo = `${randomUUID()}.${extension}`;

    return tipo === 'pensum'
        ? `${idCarrera}/pensum/${nombreArchivo}`
        : `${idCarrera}/materias/${idRegistro}/${nombreArchivo}`;
}

// RN6: un fallo de limpieza nunca se ignora. Queda en el log del servidor con los
// datos necesarios para borrar el archivo a mano. No se envía al cliente (RN7).
function registrarIncidenciaLimpieza({ ruta, tipo, idRegistro, motivo }) {
    console.error(
        '[documentos] No se pudo eliminar un archivo huérfano de Storage, requiere limpieza manual:',
        JSON.stringify({
            ruta_storage: ruta,
            tipo_documento: tipo,
            id_registro: idRegistro,
            motivo_error: motivo,
            fecha_error: new Date().toISOString()
        })
    );
}

// Acción de compensación: nunca lanza, para no tapar el error original que la provocó.
// Devuelve true solo si Storage confirmó la eliminación.
async function eliminarArchivoCompensatorio(contexto) {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_DOCUMENTOS)
            .remove([contexto.ruta]);

        if (error) {
            registrarIncidenciaLimpieza({ ...contexto, motivo: error.message });
            return false;
        }

        // Storage responde sin error y con lista vacía cuando no encontró el objeto.
        if (Array.isArray(data) && data.length === 0) {
            registrarIncidenciaLimpieza({
                ...contexto,
                motivo: 'Storage no confirmó la eliminación del archivo'
            });
            return false;
        }

        return true;
    } catch (error) {
        registrarIncidenciaLimpieza({ ...contexto, motivo: error.message });
        return false;
    }
}

/**
 * Sube el archivo a Storage y registra su ruta en PostgreSQL.
 *
 * El controlador ya validó el archivo, el tipo y que el recurso pertenece a la universidad.
 *
 * Devuelve { path } si todo salió bien o { error } (con .message) si falló:
 *   - Falla la subida: no se registra ninguna referencia (E1).
 *   - Falla el registro en PostgreSQL: se elimina el archivo recién subido y, si esa
 *     limpieza también falla, se registra la incidencia (E2, E3).
 *
 * RN3: el documento anterior no se toca, así que se conserva aunque falle el reemplazo.
 */
async function guardarDocumento({ tipo, idRegistro, idCarrera, extension, archivo }) {
    const { tabla, columna, columnaId } = REFERENCIAS_POR_TIPO[tipo];
    const ruta = construirRutaDocumento({ tipo, idCarrera, idRegistro, extension });
    const contexto = { ruta, tipo, idRegistro };

    const { error: errorSubida } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .upload(ruta, archivo.buffer, {
            contentType: archivo.mimetype
        });

    if (errorSubida) {
        return { error: errorSubida };
    }

    let errorRegistro;

    try {
        ({ error: errorRegistro } = await supabase
            .from(tabla)
            .update({ [columna]: ruta })
            .eq(columnaId, idRegistro));
    } catch (errorInesperado) {
        // El archivo ya está en Storage: se limpia y se deja que el manejador global responda.
        await eliminarArchivoCompensatorio(contexto);
        throw errorInesperado;
    }

    if (errorRegistro) {
        await eliminarArchivoCompensatorio(contexto);
        return { error: errorRegistro };
    }

    return { path: ruta };
}

module.exports = {
    guardarDocumento
};