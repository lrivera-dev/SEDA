const express = require('express');
const router = express.Router();
const { obtenerChecklist, confirmarEquivalencias } = require('../controllers/checklist.controller');

const validarUniversidad = require('../middlewares/validarUniversidad');

router.get('/', validarUniversidad, obtenerChecklist);
router.post('/confirmar', validarUniversidad, confirmarEquivalencias);

module.exports = router;