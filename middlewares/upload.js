const multer = require('multer');

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
];

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limit: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (TIPOS_PERMITIDOS.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('FORMATO_INVALIDO'), false);
        }
    }
});

module.exports = upload;