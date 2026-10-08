const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload')
const {subirArchivo} = require('../controllers/archivos.controller');

router.post('/', upload.single('archivo'), subirArchivo);

module.exports = router;