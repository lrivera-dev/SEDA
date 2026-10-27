const express = require('express');
const router = express.Router();

const validarUniversidad = require('../middlewares/validarUniversidad');
const {
    listarMaterias,
    listarMateriasCatalogo,
    crearMateria,
    actualizarMateria,
    eliminarMateria
} = require('../controllers/materias.controller');

router.get('/catalogo', validarUniversidad, listarMateriasCatalogo);
router.get('/', validarUniversidad, listarMaterias);
router.post('/', validarUniversidad, crearMateria);
router.patch('/:id_materia', validarUniversidad, actualizarMateria);
router.delete('/:id_materia', validarUniversidad, eliminarMateria);

module.exports = router;