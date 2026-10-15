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


obtenerElemento('boton-cerrar-sesion').addEventListener('click', redirigirAInicioSesion);

cargarReporte();