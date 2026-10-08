const express = require('express');
const router = express.Router();
const { registrarEquivalencias } = require('../controllers/equivalencias.controller')

router.post('/', registrarEquivalencias);

module.exports = router;