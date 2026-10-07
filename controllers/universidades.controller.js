const supabase = require('../supabaseClient');
const supbase = require('../supabaseClient');

const CAMPOS_OBLIGATORIOS = ['nombre', 'ubicacion', 'correo_contacto', 'telefono_contacto', 'correo', 'contrasena'];

async function registrarUniversidad(req, res) {
    const datos = req.body;

    // Validar campos
    const faltantes = CAMPOS_OBLIGATORIOS.filter(campo => !datos[campo] || datos[campo].trim() === '');

    if (faltantes.length > 0) {
        return res.status(400).json({

            error: 'Campos obligatorios faltantes o inválidos',
            campos: faltantes
        });
    }

    // Verificar si la universidad ya fue registrada
    const { data: existente, error: errorBusqueda } = await supbase
        .from('universidad')
        .select('id_universidad')
        .eq('nombre', datos.nombre)
        .maybeSingle();

    if (errorBusqueda) {
        return res.status(500).json({ error: errorBusqueda.message });
    }

    if (existente) {
        return res.status(409).json({
            error: 'Ya existe una universidad registrada con ese nombre. Verifique los datos.'
        });
    }

    // Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: datos.correo,
        password: datos.contrasena,
        email_confirm: true
    });

    if (authError) {
        return res.status(400).json({ error: authError.message });
    }

    const idUsuario = authData.user.id;

    // Insertar en la tabla usuario (con rol) para el login
    const { error: errorUsuario } = await supabase
        .from('usuario')
        .insert({
            id_usuario: idUsuario,
            correo: datos.correo,
            rol: 'UNIVERSIDAD'
        });

    if (errorUsuario) {
        return res.status(500).json({ error: errorUsuario.message })
    }

    // Insertar en la tabla universidad
    const { data: universidad, error: errorUniversidad } = await supabase
        .from('universidad')
        .insert({
            id_usuario: idUsuario,
            nombre: datos.nombre,
            ubicacion: datos.ubicacion,
            correo_contacto: datos.correo_contacto,
            telefono_contacto: datos.telefono_contacto
        })
        .select()
        .single();

    if (errorUniversidad) {
        return res.status(500).json({ error: errorUniversidad.message });
    }

    return res.status(201).json({
        mensaje: 'Universidad registarada exitosamente',
        universidad
    });
}

module.exports = { registrarUniversidad };