const express = require('express');
const router = express.Router();
const { obtenerCaso } = require('../controllers/casos.controller');

// PENDIENTE (RN1): proteger con validarMined cuando esté integrado en development.
router.get('/:id_caso', obtenerCaso);

module.exports = router;