const express = require('express');
const router = express.Router();
const { registrarEquivalencias } = require('../controllers/equivalencias.controller')

const validarUniversidad = require('../middlewares/validarUniversidad');

router.post('/', validarUniversidad, registrarEquivalencias);

module.exports = router;