const UMBRAL_APROBACION = 80;
const UMBRAL_BAJO = 60;

function clasificarCoincidencia(porcentaje) {
  if (porcentaje === null) {
    return {
      nivel: 'SIN_CALCULAR',
      estado_checklist: 'PENDIENTE_ANALISIS'
    };
  }

  if (
    typeof porcentaje !== 'number' ||
    !Number.isFinite(porcentaje) ||
    porcentaje < 0 ||
    porcentaje > 100
  ) {
    throw new TypeError('El porcentaje debe ser un número entre 0 y 100, o null.');
  }

  let nivel;

  if (porcentaje >= UMBRAL_APROBACION) {
    nivel = 'ALTA';
  } else if (porcentaje >= UMBRAL_BAJO) {
    nivel = 'MEDIA';
  } else {
    nivel = 'BAJA';
  }

  return {
    nivel,
    estado_checklist:
      porcentaje >= UMBRAL_APROBACION
        ? 'APROBADA'
        : 'PENDIENTE_ANALISIS'
  };
}

module.exports = {
  clasificarCoincidencia,
  UMBRAL_APROBACION,
  UMBRAL_BAJO
};