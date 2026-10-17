const universidad = {
    nombre: 'Universidad QA Ficticia', ubicacion: 'Ciudad de pruebas',
    correo_contacto: 'contacto@example.test', telefono_contacto: '00000000',
    correo: 'qa@example.test', contrasena: 'solo-dato-ficticio-QA'
};
const equivalencia = { id_materia_origen: 1, id_materia_destino: 2, descripcion: 'Caso ficticio', id_universidad: 10 };
const materia = { programa_url: 'qa/programa.pdf', carrera: { id_universidad: 10, pensum_url: 'qa/pensum.pdf' } };
const consulta = (data = null, error = null, verificar) => ({ operacion: 'consulta', resultado: { data, error }, verificar });
const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// PDF de una página con offsets y tabla xref calculados, sin datos reales.
function crearPdf() {
    let contenido = '%PDF-1.4\n';
    const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',
        '<< /Length 0 >>\nstream\nendstream'];
    const offsets = [0];
    objetos.forEach((objeto, i) => { offsets.push(Buffer.byteLength(contenido)); contenido += `${i + 1} 0 obj\n${objeto}\nendobj\n`; });
    const xref = Buffer.byteLength(contenido);
    contenido += 'xref\n0 5\n0000000000 65535 f \n';
    contenido += offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
    return Buffer.from(contenido + `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
// Contenedor ZIP sin compresión con los tres componentes mínimos de un DOCX.
function crearDocx() {
    const archivos = {
        '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        'word/document.xml': '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>QA ficticio</w:t></w:r></w:p></w:body></w:document>'
    };
    const locales = [], centrales = [];
    let offset = 0;
    for (const [nombre, texto] of Object.entries(archivos)) {
        const name = Buffer.from(nombre), data = Buffer.from(texto);
        let crc = 0xffffffff;
        for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
        crc = (crc ^ 0xffffffff) >>> 0;
        const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
        const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
        locales.push(local, name, data); centrales.push(central, name); offset += local.length + name.length + data.length;
    }
    const directorio = Buffer.concat(centrales), fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50); fin.writeUInt16LE(3, 8); fin.writeUInt16LE(3, 10); fin.writeUInt32LE(directorio.length, 12); fin.writeUInt32LE(offset, 16);
    return Buffer.concat([...locales, directorio, fin]);
}
module.exports = { universidad, equivalencia, materia, consulta, MIME_PDF, MIME_DOCX, pdf: crearPdf(), docx: crearDocx() };
