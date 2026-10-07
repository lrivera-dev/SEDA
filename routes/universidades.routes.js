const express = require('express');
const router = express.Router();
const { registrarUniversidad } = require('../controllers/universidades.controller');

router.post('/', registrarUniversidad);

module.exports = router;