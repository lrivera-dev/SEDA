const express = require('express');
const path = require('path');

// Carga las variables de entorno (.env) a través del cliente de Supabase
require('./supabaseClient');

const universidadesRoutes = require('./routes/universidades.routes');
const archivosRoutes = require('./routes/archivos.routes');
const equivalenciasRoutes = require('./routes/equivalencias.routes');
const panelRoutes = require('./routes/panel.routes');
const casosRoutes = require('./routes/casos.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(express.static('public'));
app.use(express.json());

// Páginas
app.get('/subir-archivos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'subir-archivos.html'));
});

app.get('/subir-equivalencia', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'subir-equivalencia.html'));
});

// API (cada ruta se registra una sola vez)
app.use('/universidades', universidadesRoutes);
app.use('/archivos', archivosRoutes);
app.use('/equivalencias', equivalenciasRoutes);
app.use('/panel', panelRoutes);
app.use('/casos', casosRoutes);
app.use('/auth', authRoutes);

// Manejador de errores: siempre después de todas las rutas
app.use((err, req, res, next) => {
    if (err.message === 'FORMATO_INVALIDO') {
        return res.status(400).json({ error: 'El archivo no es compatible, formatos aceptados: PDF o Word' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido (20 MB).' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error inesperado al procesar el archivo.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});