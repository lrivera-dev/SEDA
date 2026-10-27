const express = require('express');
const router = express.Router();
const validarMined = require('../middlewares/validarMined')
const { obtenerPanel } = require('../controllers/panel.controller');
const {
    listarUniversidadesMined,
    obtenerUniversidadMined
} = require('../controllers/mined-universidades.controller');

router.get('/', validarMined, obtenerPanel);
router.get('/universidades', validarMined, listarUniversidadesMined);
router.get(
    '/universidades/:id_universidad',
    validarMined,
    obtenerUniversidadMined
);


module.exports = router;