const express = require('express');
const router = express.Router();
const limitarReintentos = require('../middlewares/limitarReintentos');
const { reintentarCoincidencia } = require('../controllers/coincidencia.controller');

const validarUniversidad = require('../middlewares/validarUniversidad');

router.post(
    '/:id_caso/reintentar',
    validarUniversidad,
    limitarReintentos,
    reintentarCoincidencia
);

module.exports = router;