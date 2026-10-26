const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = require('../supabaseClient');

const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

async function validarUniversidad(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado.' });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
        return res.status(401).json({ error: 'No autorizado.' });
    }

    const { data: authData, error: authError } =
        await supabaseAuth.auth.getUser(token);

    if (authError || !authData.user) {
        return res.status(401).json({ error: 'No autorizado.' });
    }

    const { data: usuario, error: errorUsuario } = await supabaseAdmin
        .from('usuario')
        .select('id_usuario, correo, rol, estado')
        .eq('id_usuario', authData.user.id)
        .maybeSingle();

    if (
        errorUsuario ||
        !usuario ||
        usuario.rol !== 'UNIVERSIDAD' ||
        usuario.estado !== 'ACTIVO'
    ) {
        return res.status(401).json({ error: 'No autorizado.' });
    }

    const { data: universidad, error: errorUniversidad } = await supabaseAdmin
        .from('universidad')
        .select('id_universidad, estado')
        .eq('id_usuario', usuario.id_usuario)
        .maybeSingle();

    if (
        errorUniversidad ||
        !universidad ||
        universidad.estado !== 'ACTIVA'
    ) {
        return res.status(401).json({ error: 'No autorizado.' });
    }

    req.usuario = {
        id: usuario.id_usuario,
        correo: usuario.correo,
        rol: usuario.rol,
        id_universidad: universidad.id_universidad
    };

    return next();
}

module.exports = validarUniversidad;