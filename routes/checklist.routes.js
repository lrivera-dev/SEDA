const express = require('express');
const router = express.Router();
const { obtenerChecklist } = require('../controllers/checklist.controller');

const validarUniversidad = require('../middlewares/validarUniversidad');

router.get('/', validarUniversidad, obtenerChecklist);

module.exports = router;