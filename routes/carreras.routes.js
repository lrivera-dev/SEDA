const express = require('express');
const router = express.Router();

const validarUniversidad = require('../middlewares/validarUniversidad');
const {
    listarCarreras,
    crearCarrera,
    actualizarCarrera,
    eliminarCarrera
} = require('../controllers/carreras.controller');

router.get('/', validarUniversidad, listarCarreras);
router.post('/', validarUniversidad, crearCarrera);
router.patch('/:id_carrera', validarUniversidad, actualizarCarrera);
router.delete('/:id_carrera', validarUniversidad, eliminarCarrera);

module.exports = router;