const express = require('express');
const router = express.Router();
const { obtenerChecklist } = require('../controllers/checklist.controller');

// TODO(login): la universidad se identifica con el id_universidad de la URL hasta que exista el login.
// La ruta sin id también entra al controlador para responder 400 con un mensaje claro.
router.get(['/', '/:id_universidad'], obtenerChecklist);

module.exports = router;