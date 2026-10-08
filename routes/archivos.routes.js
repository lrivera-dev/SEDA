const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const validarArchivo = require('../middlewares/validarArchivo');
const { subirArchivo } = require('../controllers/archivos.controller');

router.post('/', upload.single('archivo'), validarArchivo, subirArchivo);

module.exports = router;