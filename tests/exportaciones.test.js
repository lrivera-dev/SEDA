require('./entorno-prueba');

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const FUNCIONES_ESPERADAS = {
    '../controllers/archivos.controller': ['subirArchivo'],
    '../controllers/auth.controller': ['iniciarSesion'],
    '../controllers/casos.controller': ['obtenerCaso', 'revisarCaso'],
    '../controllers/equivalencias.controller': ['registrarEquivalencias'],
    '../controllers/panel.controller': ['obtenerPanel'],
    '../controllers/universidades.controller': ['registrarUniversidad'],
    '../servicios/documentos-caso': ['generarEnlacesDocumentos']
};

describe('Exportaciones de controladores y servicios', () => {
    for (const [modulo, funciones] of Object.entries(FUNCIONES_ESPERADAS)) {
        it(`${modulo} exporta: ${funciones.join(', ')}`, () => {
            const exportado = require(modulo);

            for (const nombre of funciones) {
                assert.equal(
                    typeof exportado[nombre],
                    'function',
                    `${modulo} no exporta la función "${nombre}"`
                );
            }
        });
    }

    it('validarMined exporta una función middleware', () => {
        assert.equal(typeof require('../middlewares/validarMined'), 'function');
    });
});