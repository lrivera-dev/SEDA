const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = require('../supabaseClient');

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function validarMined(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  // 1. Verificar que el token sea válido
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);

  if (authError || !authData.user) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  // 2. Verificar rol y estado en la tabla usuario
  const { data: usuario, error: errorUsuario } = await supabaseAdmin
    .from('usuario')
    .select('id_usuario, correo, rol, estado')
    .eq('id_usuario', authData.user.id)
    .maybeSingle();

  if (errorUsuario || !usuario) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (usuario.rol !== 'MINED' || usuario.estado !== 'ACTIVO') {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  req.usuario = {
    id: usuario.id_usuario,
    correo: usuario.correo
  };

  next();
}

module.exports = validarMined;