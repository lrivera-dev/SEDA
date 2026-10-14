const express = require('express');
const router = express.Router();
const validarMined = require('../middlewares/validarMined')
const { obtenerPanel } = require('../controllers/panel.controller');

router.get('/', validarMined, obtenerPanel);

module.exports = router;