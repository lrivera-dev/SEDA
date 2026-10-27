const express = require('express');
const router = express.Router();

const validarUniversidad = require('../middlewares/validarUniversidad');
const {
    listarMaterias,
    listarMateriasCatalogo,
    crearMateria,
    actualizarMateria
} = require('../controllers/materias.controller');

router.get('/catalogo', validarUniversidad, listarMateriasCatalogo);
router.get('/', validarUniversidad, listarMaterias);
router.post('/', validarUniversidad, crearMateria);
router.patch('/:id_materia', validarUniversidad, actualizarMateria);

module.exports = router;