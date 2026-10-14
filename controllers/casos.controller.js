const supabase = require('../supabaseClient');
const { generarEnlacesDocumentos } = require('../servicios/documentos-caso');

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENSAJE_NO_EXISTE = 'El caso solicitado no existe o fue eliminado';
const TEXTO_SIN_PORCENTAJE = 'Pendiente de cálculo';

function describirLado(materia) {
    return {
        materia: materia?.nombre ?? null,
        carrera: materia?.carrera?.nombre ?? null,
        universidad: materia?.carrera?.universidad?.nombre ?? null
    };
}

async function obtenerCaso(req, res) {
    const { id_caso } = req.params;

    if (!REGEX_UUID.test(id_caso)) {
        return res.status(404).json({ error: MENSAJE_NO_EXISTE });
    }

    const { data: caso, error } = await supabase
        .from('caso_equivalencia')
        .select(`
            id_caso,
            descripcion,
            estado,
            porcentaje_coincidencia,
            fecha_registro,
            materia_origen:materia!caso_equivalencia_id_materia_origen_fkey (
                nombre,
                programa_url,
                carrera ( nombre, pensum_url, universidad ( nombre ) )
            ),
            materia_destino:materia!caso_equivalencia_id_materia_destino_fkey (
                nombre,
                programa_url,
                carrera ( nombre, pensum_url, universidad ( nombre ) )
            )
        `)
        .eq('id_caso', id_caso)
        .maybeSingle();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    if (!caso) {
        return res.status(404).json({ error: MENSAJE_NO_EXISTE });
    }

    const { enlaces, documentos_faltantes } = await generarEnlacesDocumentos(caso);

    return res.status(200).json({
        caso: {
            id_caso: caso.id_caso,
            descripcion: caso.descripcion,
            estado: caso.estado,
            fecha_registro: caso.fecha_registro,
            porcentaje_coincidencia: caso.porcentaje_coincidencia ?? TEXTO_SIN_PORCENTAJE,
            origen: describirLado(caso.materia_origen),
            destino: describirLado(caso.materia_destino)
        },
        enlaces,
        documentos_faltantes
    });
}

module.exports = { obtenerCaso };