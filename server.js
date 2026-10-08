const express = require('express');
const app = express();

app.use(express.static('public'));

app.use(express.json());

const supabase = require('./supabaseClient');

const universidadesRoutes = require('./routes/universidades.routes')
app.use('/universidades', universidadesRoutes);

const archivosRoutes = require('./routes/archivos.routes');
app.use('/archivos', archivosRoutes);
app.use((err, req, res, next) => {
    if (err.message === 'FORMATO_INVALIDO') {
        return res.status(400).json({ error: 'Formato no compatible. Solo se aceptan archivos PDF o DOCX.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido (20 MB).' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error inesperado al procesar el archivo.' });
});

const equivalenciasRoutes = require('./routes/equivalencias.routes');
app.use('/equivalencias', equivalenciasRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});