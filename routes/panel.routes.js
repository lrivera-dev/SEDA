const express = require('express');
const router = express.Router();
const { obtenerPanel } = require('../controllers/panel.controller');

router.get('/', obtenerPanel);

module.exports = router;