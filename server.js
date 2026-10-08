const express = require('express');
const app = express();

app.use(express.static('public'));

app.use(express.json());

const supabase = require('./supabaseClient');

const universidadesRoutes = require('./routes/universidades.routes')
app.use('/universidades', universidadesRoutes);

const panelRoutes = require('./routes/panel.routes');
app.use('/panel', panelRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});