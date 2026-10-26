const express = require('express');
const router = express.Router();

const validarUniversidad = require('../middlewares/validarUniversidad');
const {
    listarCarreras,
    crearCarrera
} = require('../controllers/carreras.controller');

router.get('/', validarUniversidad, listarCarreras);
router.post('/', validarUniversidad, crearCarrera);

module.exports = router;