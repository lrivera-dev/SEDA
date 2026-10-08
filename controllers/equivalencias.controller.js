const supabase = require('../supabaseClient');

const CAMPOS_OBLIGATORIOS = ['id_materia_origen', 'id_materia_destino', 'descripcion', 'id_universidad'];

async function registrarEquivalencias(req, res) {
    const datos = req.body;

    // Validar campos obligatorios
    const faltantes = CAMPOS_OBLIGATORIOS.filter(campo => !datos[campo] || String(datos[campo]).trim() === '');

    if (faltantes.length > 0) {
        return res.status(400).json({
            error: 'Campos obligatorios faltantes o inválidos',
            campos: faltantes
        });
    }

    const { id_materia_origen, id_materia_destino, descripcion, id_universidad } = datos;

    // Materias no pueden ser la misma
    if (id_materia_origen === id_materia_destino) {
        return res.json(400).json({ error: 'La materia de origen y destino no pueden ser la misma.' })
    }

    // Obtener materia_origen junto con su carrera y universidad
    const { data: materiaOrigen, error: errorOrigen } = await supabase
        .from('materia')
        .select('id_materia, programa_url, carrera:id_carrera(id_carrera, pensum_url, id_universidad)')
        .eq('id_materia', id_materia_origen)
        .maybeSingle();

    if (errorOrigen) {
        return res.status(500).json({ error: errorOrigen.message });
    }

    if (!materiaOrigen) {
        return res.status(400).json({ error: 'La materia de origen indicada no existe.' });
    }

    // Obtener materia_destino junto con su carrera
    const { data: materiaDestino, error: errorDestino } = await supabase
        .from('materia')
        .select('id_materia, programa_url, carrera:id_carrera(id_carrera, pensum_url, id_universidad)')
        .eq('id_materia', id_materia_destino)
        .maybeSingle();

    if (errorDestino) {
        return res.status(500).json({ error: errorDestino.message })
    }

    if (!materiaDestino) {
        return res.status(400).json({ error: 'La materia de destino indicada no existe.' })
    }

    // Validar que la universidad asociada sea dueña de la materia de origen
    if (materiaOrigen.carrera.id_universidad !== id_universidad) {
        return res.status(403).json({ error: 'La universidad indicada no tiene permiso sobre la materia de origen. ' })
    }

    // Valida que existen archivos cargados (pensum y programa) para ambas materias
    const faltanArchivos = [];

    if (!materiaOrigen.carrera.pensum_url) faltanArchivos.push('pensum de la carrera de orifen');
    if (!materiaOrigen.programa_url) faltanArchivos.push('programa de la materia de origen');
    if (!materiaDestino.carrera.pensum_url) faltanArchivos.push('pensum de la carrera de destino');
    if (!materiaDestino.programa_url) faltanArchivos.push('programa de la materia de destino');

    if (faltanArchivos.length > 0) {
        return res.status(400).json({
            error: 'No se puede registrar la equivalencia: faltan archivos por cargar.',
            archivos_faltantes: faltanArchivos
        })
    }

    // 7. Insertar la equivalencia
    const { data: equivalencia, error: errorInsert } = await supabase
        .from('caso_equivalencia')
        .insert({
            id_materia_origen,
            id_materia_destino,
            descripcion,
            estado: 'PENDIENTE'
        })
        .select()
        .single();

    if (errorInsert) {
        return res.status(500).json({ error: errorInsert.message });
    }

    return res.status(201).json({
        mensaje: 'Equivalencia registrada exitosamente',
        equivalencia
    });

}

module.exports = { registrarEquivalencias };