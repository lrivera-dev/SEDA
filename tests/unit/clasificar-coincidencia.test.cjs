const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  clasificarCoincidencia
} = require('../../servicios/clasificar-coincidencia');

const casos = [
  [59.99, { nivel: 'BAJA', estado_checklist: 'PENDIENTE_ANALISIS' }],
  [60, { nivel: 'MEDIA', estado_checklist: 'PENDIENTE_ANALISIS' }],
  [79.99, { nivel: 'MEDIA', estado_checklist: 'PENDIENTE_ANALISIS' }],
  [80, { nivel: 'ALTA', estado_checklist: 'APROBADA' }],
  [null, { nivel: 'SIN_CALCULAR', estado_checklist: 'PENDIENTE_ANALISIS' }]
];

for (const [porcentaje, esperado] of casos) {
  test(`clasifica ${porcentaje} correctamente`, () => {
    assert.deepEqual(clasificarCoincidencia(porcentaje), esperado);
  });
}