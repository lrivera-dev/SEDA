const supabase = require('../supabaseClient');

const ROL_PERMITIDO = 'MINED';

async function verificarRolMined(req, res, next) {
    const encabezado = req.headers.authorization || '';
    const [tipo, token] = encabezado.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Debe iniciar sesión para consultar el panel de control.' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
        return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const { data: usuario, error: errorUsuario } = await supabase
        .from('usuario')
        .select('rol')
        .eq('id_usuario', authData.user.id)
        .maybeSingle();

    if (errorUsuario) {
        return res.status(500).json({ error: errorUsuario.message });
    }

    if (!usuario || usuario.rol !== ROL_PERMITIDO) {
        return res.status(403).json({ error: 'No tiene permiso para consultar el panel de control.' });
    }

    next();
}

module.exports = { verificarRolMined };