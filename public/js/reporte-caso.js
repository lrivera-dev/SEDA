const CLAVE_TOKEN = 'seda_access_token';
const RUTA_INICIO_SESION = '/';

const MENSAJE_CASO_NO_EXISTE = 'El caso solicitado no existe o fue eliminado';
const MENSAJE_ERROR_GENERICO = 'No se pudo cargar el reporte del caso. Intenta de nuevo.';
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Intenta de nuevo.';
const TEXTO_SIN_PORCENTAJE = 'Pendiente de cálculo';
const TEXTO_SIN_INFORMACION = 'Sin información';

const ETIQUETAS_ESTADO = {
    PENDIENTE: 'Pendiente',
    EN_REVISION: 'En revisión',
    ACEPTADO: 'Aceptado',
    ADVERTENCIA: 'Advertencia'
};

const ESTADO_REVISABLE = 'PENDIENTE';
const MIN_CARACTERES_OBSERVACION = 10;

const MENSAJE_SIN_DECISION = 'Debe elegir una decisión: Aceptar o emitir advertencia';
const MENSAJE_SIN_OBSERVACION = 'Indica el motivo de la advertencia';
const MENSAJE_OBSERVACION_CORTA = `La observación debe tener al menos ${MIN_CARACTERES_OBSERVACION} caracteres`;
const MENSAJE_YA_REVISADO = 'Este caso ya fue revisado';
const MENSAJE_ERROR_REVISION = 'No se pudo registrar la revisión. Intenta de nuevo.';

function obtenerElemento(id) {
    return document.getElementById(id);
}

function redirigirAInicioSesion() {
    sessionStorage.removeItem(CLAVE_TOKEN);
    window.location.replace(RUTA_INICIO_SESION);
}


/* ESTADOS DE LA PANTALLA */

function mostrarError(titulo, mensaje) {
    obtenerElemento('reporte-error-titulo').textContent = titulo;
    obtenerElemento('reporte-error-mensaje').textContent = mensaje;

    obtenerElemento('reporte-cargando').hidden = true;
    obtenerElemento('reporte-contenido').hidden = true;
    obtenerElemento('reporte-error').hidden = false;
}

function mostrarReporte(datos) {
    const { caso, enlaces, documentos_faltantes: documentosFaltantes } = datos;
    const {
        id_caso: idCaso,
        descripcion,
        estado,
        fecha_registro: fechaRegistro,
        porcentaje_coincidencia: porcentajeCoincidencia,
        origen,
        destino
    } = caso;

    // Todo se escribe con textContent: la descripción la escribe una universidad.
    obtenerElemento('caso-id').textContent = idCaso;
    obtenerElemento('caso-fecha').textContent = formatearFecha(fechaRegistro);
    obtenerElemento('caso-descripcion').textContent = descripcion ?? TEXTO_SIN_INFORMACION;

    llenarEstado(estado);
    llenarMateria('origen', origen);
    llenarMateria('destino', destino);
    llenarPorcentaje(porcentajeCoincidencia);
    llenarDocumentos(enlaces ?? {});
    llenarAvisoFaltantes(Array.isArray(documentosFaltantes) ? documentosFaltantes : []);
    prepararRevision(estado, idCaso);
    obtenerElemento('reporte-cargando').hidden = true;
    obtenerElemento('reporte-error').hidden = true;
    obtenerElemento('reporte-contenido').hidden = false;
}


/* RELLENO DE DATOS */

function formatearFecha(fechaIso) {
    const fecha = new Date(fechaIso);
    return Number.isNaN(fecha.getTime()) ? TEXTO_SIN_INFORMACION : fecha.toLocaleDateString('es-SV');
}

function llenarEstado(estado) {
    const elementoEstado = obtenerElemento('caso-estado');
    elementoEstado.textContent = ETIQUETAS_ESTADO[estado] ?? estado ?? TEXTO_SIN_INFORMACION;

    elementoEstado.className = 'estado';

    if (ETIQUETAS_ESTADO[estado]) {
        elementoEstado.classList.add(`estado--${estado.toLowerCase().replace(/_/g, '-')}`);
    }
}

// prefijo: 'origen' o 'destino' (coincide con los id del HTML)
function llenarMateria(prefijo, lado) {
    obtenerElemento(`${prefijo}-materia`).textContent = lado?.materia ?? TEXTO_SIN_INFORMACION;
    obtenerElemento(`${prefijo}-carrera`).textContent = lado?.carrera ?? TEXTO_SIN_INFORMACION;
    obtenerElemento(`${prefijo}-universidad`).textContent = lado?.universidad ?? TEXTO_SIN_INFORMACION;
}

// Devuelve un número, o null si el caso aún no tiene porcentaje ("Pendiente de cálculo").
function obtenerPorcentajeNumerico(valor) {
    if (typeof valor === 'number' && Number.isFinite(valor)) {
        return valor;
    }

    if (typeof valor === 'string' && valor.trim() !== '' && Number.isFinite(Number(valor))) {
        return Number(valor);
    }

    return null;
}

function llenarPorcentaje(porcentajeCoincidencia) {
    const porcentaje = obtenerPorcentajeNumerico(porcentajeCoincidencia);
    const elementoTexto = obtenerElemento('caso-porcentaje');
    const elementoBarra = obtenerElemento('caso-porcentaje-barra');

    if (porcentaje === null) {
        elementoTexto.textContent = TEXTO_SIN_PORCENTAJE;
        elementoBarra.style.width = '0%';
        return;
    }

    elementoTexto.textContent = `${porcentaje}%`;
    elementoBarra.style.width = `${Math.min(Math.max(porcentaje, 0), 100)}%`;
}

// Solo se aceptan enlaces http(s); cualquier otra cosa se trata como documento no disponible.
function esUrlSegura(valor) {
    if (typeof valor !== 'string' || valor.trim() === '') {
        return false;
    }

    try {
        const { protocol } = new URL(valor);
        return protocol === 'https:' || protocol === 'http:';
    } catch (error) {
        return false;
    }
}

function llenarDocumentos(enlaces) {
    document.querySelectorAll('[data-documento]').forEach((elementoDocumento) => {
        const url = enlaces[elementoDocumento.dataset.documento];
        const tieneEnlace = esUrlSegura(url);

        const enlace = elementoDocumento.querySelector('.documento__enlace');
        const textoFaltante = elementoDocumento.querySelector('.documento__faltante');

        if (tieneEnlace) {
            enlace.href = url;
        }

        enlace.hidden = !tieneEnlace;
        textoFaltante.hidden = tieneEnlace;
    });
}

function llenarAvisoFaltantes(documentosFaltantes) {
    const aviso = obtenerElemento('aviso-documentos-faltantes');

    if (documentosFaltantes.length === 0) {
        aviso.hidden = true;
        return;
    }

    obtenerElemento('aviso-documentos-faltantes-texto').textContent =
        `Documentos faltantes: ${documentosFaltantes.join(', ')}`;
    aviso.hidden = false;
}


/* CARGA DEL REPORTE */

async function consultarCaso(idCaso, token) {
    const respuesta = await fetch(`/casos/${encodeURIComponent(idCaso)}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const datos = await respuesta.json().catch(() => ({}));

    return { codigoHttp: respuesta.status, esExitoso: respuesta.ok, datos };
}

async function cargarReporte() {
    const token = sessionStorage.getItem(CLAVE_TOKEN);

    if (!token) {
        redirigirAInicioSesion();
        return;
    }

    const idCaso = new URLSearchParams(window.location.search).get('id');

    if (!idCaso) {
        mostrarError('Caso no encontrado', MENSAJE_CASO_NO_EXISTE);
        return;
    }

    let resultado;

    try {
        resultado = await consultarCaso(idCaso, token);
    } catch (error) {
        mostrarError('No se pudo cargar el reporte', MENSAJE_SIN_CONEXION);
        return;
    }

    const { codigoHttp, esExitoso, datos } = resultado;

    if (codigoHttp === 401) {
        redirigirAInicioSesion();
        return;
    }

    if (codigoHttp === 404) {
        mostrarError('Caso no encontrado', MENSAJE_CASO_NO_EXISTE);
        return;
    }

    if (!esExitoso) {
        mostrarError('No se pudo cargar el reporte', datos.error || MENSAJE_ERROR_GENERICO);
        return;
    }

    mostrarReporte(datos);
}

/* REVISIÓN DEL CASO (HU-09) */

function mostrarResultadoRevision(tipo, mensaje) {
    const resultado = obtenerElemento('revision-resultado');

    resultado.className = `aviso aviso--${tipo}`;
    obtenerElemento('revision-resultado-texto').textContent = mensaje;
    resultado.hidden = false;
}

function mostrarErrorRevision(mensaje) {
    const elementoError = obtenerElemento('revision-error');

    elementoError.textContent = mensaje;
    elementoError.hidden = false;
}

function ocultarErrorRevision() {
    obtenerElemento('revision-error').hidden = true;
}

function obtenerDecisionElegida() {
    const seleccionada = document.querySelector('input[name="decision"]:checked');
    return seleccionada ? seleccionada.value : null;
}

// Si el caso no está PENDIENTE no se muestran las opciones (RN2)
function prepararRevision(estado, idCaso) {
    if (estado !== ESTADO_REVISABLE) {
        obtenerElemento('revision').hidden = true;
        mostrarResultadoRevision('info', MENSAJE_YA_REVISADO);
        return;
    }

    obtenerElemento('form-revision').dataset.idCaso = idCaso;
    obtenerElemento('revision').hidden = false;
}

function alternarCampoObservacion() {
    obtenerElemento('campo-observacion').hidden = obtenerDecisionElegida() !== 'ADVERTENCIA';
    ocultarErrorRevision();
}

// Devuelve el mensaje de error, o null si la revisión es válida.
function validarRevision(decision, observacion) {
    if (!decision) {
        return MENSAJE_SIN_DECISION;
    }

    if (decision === 'ADVERTENCIA' && observacion.length === 0) {
        return MENSAJE_SIN_OBSERVACION;
    }

    if (decision === 'ADVERTENCIA' && observacion.length < MIN_CARACTERES_OBSERVACION) {
        return MENSAJE_OBSERVACION_CORTA;
    }

    return null;
}

function deshabilitarFormularioRevision() {
    obtenerElemento('form-revision')
        .querySelectorAll('input, textarea, button')
        .forEach((elemento) => {
            elemento.disabled = true;
        });
}

async function enviarRevision(idCaso, token, decision, observacion) {
    const cuerpo = { decision };

    if (observacion) {
        cuerpo.observacion = observacion;
    }

    const respuesta = await fetch(`/casos/${encodeURIComponent(idCaso)}/revision`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cuerpo)
    });

    const datos = await respuesta.json().catch(() => ({}));

    return { codigoHttp: respuesta.status, esExitoso: respuesta.ok, datos };
}

async function manejarEnvioRevision(evento) {
    evento.preventDefault();
    ocultarErrorRevision();

    const token = sessionStorage.getItem(CLAVE_TOKEN);

    if (!token) {
        redirigirAInicioSesion();
        return;
    }

    const decision = obtenerDecisionElegida();
    const observacion = obtenerElemento('observacion').value.trim();
    const mensajeError = validarRevision(decision, observacion);

    if (mensajeError) {
        mostrarErrorRevision(mensajeError);
        return;
    }

    const botonConfirmar = obtenerElemento('boton-confirmar-revision');
    const idCaso = obtenerElemento('form-revision').dataset.idCaso;
    const observacionEnviada = decision === 'ADVERTENCIA' ? observacion : '';

    botonConfirmar.disabled = true;

    let resultado;

    try {
        resultado = await enviarRevision(idCaso, token, decision, observacionEnviada);
    } catch (error) {
        mostrarErrorRevision(MENSAJE_SIN_CONEXION);
        botonConfirmar.disabled = false;
        return;
    }

    const { codigoHttp, esExitoso, datos } = resultado;

    if (codigoHttp === 401) {
        redirigirAInicioSesion();
        return;
    }

    if (esExitoso) {
        llenarEstado(datos.caso?.estado);
        deshabilitarFormularioRevision();
        mostrarResultadoRevision('exito', datos.mensaje);
        return;
    }

    if (codigoHttp === 409) {
        obtenerElemento('revision').hidden = true;
        mostrarResultadoRevision('info', datos.error || MENSAJE_YA_REVISADO);
        return;
    }

    mostrarErrorRevision(datos.error || MENSAJE_ERROR_REVISION);
    botonConfirmar.disabled = false;
}

obtenerElemento('boton-cerrar-sesion').addEventListener('click', redirigirAInicioSesion);

document.querySelectorAll('input[name="decision"]').forEach((opcion) => {
    opcion.addEventListener('change', alternarCampoObservacion);
});

obtenerElemento('form-revision').addEventListener('submit', manejarEnvioRevision);

cargarReporte();
