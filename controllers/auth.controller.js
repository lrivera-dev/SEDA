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

const intentosPorCorreo = new Map();

const MAX_INTENTOS = 3;
const DURACION_BLOQUEO_MS = 5 * 60 * 1000;

async function iniciarSesion(req, res) {
    const correoRecibido = req.body?.correo;
    const contrasena = req.body?.contrasena;

    if (
        typeof correoRecibido !== 'string' ||
        typeof contrasena !== 'string' ||
        !correoRecibido.trim() ||
        contrasena === ''
    ) {
        return res.status(400).json({
            error: 'Ingresa tu correo y contraseña'
        });
    }

    const correo = correoRecibido.trim().toLowerCase();
    const ahora = Date.now();
    let registro = intentosPorCorreo.get(correo);

    if (registro?.bloqueadoHasta > ahora) {
        return res.status(429).json({
            error: 'Demasiados intentos. Intenta de nuevo en 5 minutos'
        });
    }

    if (registro?.bloqueadoHasta && registro.bloqueadoHasta <= ahora) {
        intentosPorCorreo.delete(correo);
        registro = undefined;
    }

    const { data: authData, error: authError } =
        await supabaseAuth.auth.signInWithPassword({
            email: correo,
            password: contrasena
        });

    if (authError || !authData.user || !authData.session) {
        return registrarFallo(res, correo);
    }

    const { data: usuario, error: errorUsuario } = await supabaseAdmin
        .from('usuario')
        .select('id_usuario, rol, estado')
        .eq('id_usuario', authData.user.id)
        .maybeSingle();

    if (
        errorUsuario ||
        !usuario ||
        usuario.estado !== 'ACTIVO' ||
        !['MINED', 'UNIVERSIDAD'].includes(usuario.rol)
    ) {
        return registrarFallo(res, correo);
    }

    if (usuario.rol === 'UNIVERSIDAD') {
        const { data: universidad, error: errorUniversidad } = await supabaseAdmin
            .from('universidad')
            .select('estado')
            .eq('id_usuario', usuario.id_usuario)
            .maybeSingle();

        if (
            errorUniversidad ||
            !universidad ||
            universidad.estado !== 'ACTIVA'
        ) {
            return registrarFallo(res, correo);
        }
    }

    intentosPorCorreo.delete(correo);

    return res.status(200).json({
        access_token: authData.session.access_token,
        rol: usuario.rol
    });
}

function registrarFallo(res, correo) {
    const registro = intentosPorCorreo.get(correo) || {
        intentosFallidos: 0,
        bloqueadoHasta: null
    };

    registro.intentosFallidos += 1;

    if (registro.intentosFallidos >= MAX_INTENTOS) {
        registro.bloqueadoHasta = Date.now() + DURACION_BLOQUEO_MS;
        intentosPorCorreo.set(correo, registro);

        return res.status(429).json({
            error: 'Demasiados intentos. Intenta de nuevo en 5 minutos'
        });
    }

    intentosPorCorreo.set(correo, registro);

    const intentosRestantes = MAX_INTENTOS - registro.intentosFallidos;

    return res.status(401).json({
        error: `Correo o contraseña incorrectos. Te quedan ${intentosRestantes} intentos`
    });
}

module.exports = { iniciarSesion };