const express = require('express');
const router = express.Router();
const { obtenerPanel } = require('../controllers/panel.controller');
const { verificarRolMined } = require('../middlewares/verificarRolMined');

router.get('/', verificarRolMined, obtenerPanel);

module.exports = router;