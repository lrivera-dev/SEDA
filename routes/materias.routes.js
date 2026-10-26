const express = require('express');
const router = express.Router();

const validarUniversidad = require('../middlewares/validarUniversidad');
const {
    listarMaterias,
    crearMateria
} = require('../controllers/materias.controller');

router.get('/', validarUniversidad, listarMaterias);
router.post('/', validarUniversidad, crearMateria);

module.exports = router;