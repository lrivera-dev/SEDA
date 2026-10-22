const express = require('express');
const router = express.Router();
const limitarReintentos = require('../middlewares/limitarReintentos');
const { reintentarCoincidencia } = require('../controllers/coincidencia.controller');

router.post('/:id_caso/reintentar', limitarReintentos, reintentarCoincidencia);

module.exports = router;