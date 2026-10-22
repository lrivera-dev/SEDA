const MAX_REINTENTOS = 5;
const VENTANA_MS = 60_000;
const MENSAJE_LIMITE = 'Demasiados intentos, intenta de nuevo en un minuto';

// Guarda, por conexión (IP), la hora de cada intento reciente
const intentosPorConexion = new Map();

function limitarReintentos(req, res, next) {
    const conexion = req.ip;
    const ahora = Date.now();

    const recientes = (intentosPorConexion.get(conexion) || []).filter(
        (hora) => ahora - hora < VENTANA_MS
    );

    if (recientes.length >= MAX_REINTENTOS) {
        intentosPorConexion.set(conexion, recientes);
        return res.status(429).json({ error: MENSAJE_LIMITE });
    }

    recientes.push(ahora);
    intentosPorConexion.set(conexion, recientes);
    return next();
}

module.exports = limitarReintentos;