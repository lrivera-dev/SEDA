const express = require('express');
const router = express.Router();
const {
    registrarEquivalencias,
    listarEquivalencias,
    registrarSolicitudEquivalencia
} = require('../controllers/equivalencias.controller');
const validarUniversidad = require('../middlewares/validarUniversidad');

router.post('/', validarUniversidad, registrarEquivalencias);
router.get('/', validarUniversidad, listarEquivalencias);
router.post('/solicitudes', validarUniversidad, registrarSolicitudEquivalencia);

module.exports = router;