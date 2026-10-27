const express = require('express');
const router = express.Router();
const { registrarEquivalencias, listarEquivalencias } = require('../controllers/equivalencias.controller')

const validarUniversidad = require('../middlewares/validarUniversidad');

router.post('/', validarUniversidad, registrarEquivalencias);
router.get('/', validarUniversidad, listarEquivalencias);

module.exports = router;