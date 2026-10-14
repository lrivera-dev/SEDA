const express = require('express');
const router = express.Router();
const validarMined = require('../middlewares/validarMined');
const { revisarCaso } = require('../controllers/casos.controller');

router.patch('/:id_caso/revision', validarMined, revisarCaso);
const { obtenerCaso } = require('../controllers/casos.controller');

router.get('/:id_caso', validarMined, obtenerCaso);

module.exports = router;