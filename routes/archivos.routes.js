const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const validarArchivo = require('../middlewares/validarArchivo');
const {
    subirArchivo,
    obtenerEnlaceDocumento
} = require('../controllers/archivos.controller');

const validarUniversidad = require('../middlewares/validarUniversidad');

router.get(
    '/:tipo/:id_registro/enlace',
    validarUniversidad,
    obtenerEnlaceDocumento
);

router.post(
    '/',
    validarUniversidad,
    upload.single('archivo'),
    validarArchivo,
    subirArchivo
);

module.exports = router;