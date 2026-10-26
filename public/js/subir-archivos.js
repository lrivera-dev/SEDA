const MAX_MB = 20;
const EXT_OK = ['pdf', 'docx'];

const form = document.getElementById('form-archivo');
const tipo = document.getElementById('tipo');
const campoCarrera = document.getElementById('campo-carrera');
const campoMateria = document.getElementById('campo-materia');
const selectorCarrera = document.getElementById('id_carrera');
const selectorMateria = document.getElementById('id_materia');
const inputArchivo = document.getElementById('archivo');
const info = document.getElementById('info-archivo');
const errorForm = document.getElementById('error-form');
const btn = document.getElementById('btn-enviar');
const status = document.getElementById('status');

const ICONOS = {
    loading: '<span class="spin" aria-hidden="true"></span>',
    ok: '✓',
    warn: '!',
    err: '✕'
};

function cerrarSesionUniversidad() {
    sessionStorage.removeItem('seda_access_token');
    sessionStorage.removeItem('seda_rol');
    window.location.replace('/index.html');
}

function mostrar(tipoEstado, titulo, mensaje) {
    status.className = 'status show ' + tipoEstado;
    status.innerHTML =
        `<span class="ico">${ICONOS[tipoEstado]}</span><div><b></b><p></p></div>`;
    status.querySelector('b').textContent = titulo;
    status.querySelector('p').textContent = mensaje;
}

async function solicitar(url) {
    const token = sessionStorage.getItem('seda_access_token');

    if (!token) {
        cerrarSesionUniversidad();
        throw new Error('La sesión terminó. Inicia sesión nuevamente.');
    }

    const respuesta = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401) {
        cerrarSesionUniversidad();
        throw new Error('La sesión terminó. Inicia sesión nuevamente.');
    }

    if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudieron cargar tus registros.');
    }

    return datos;
}

function llenarSelector(selector, registros, claveId, mensajeVacio) {
    selector.replaceChildren();

    const opcionInicial = document.createElement('option');
    opcionInicial.value = '';
    opcionInicial.textContent = registros.length
        ? 'Selecciona una opción'
        : mensajeVacio;
    selector.appendChild(opcionInicial);

    for (const registro of registros) {
        const opcion = document.createElement('option');
        opcion.value = registro[claveId];
        opcion.textContent = registro.nombre;
        selector.appendChild(opcion);
    }

    selector.disabled = registros.length === 0;
}

async function cargarRegistros() {
    errorForm.textContent = '';

    try {
        const datosCarreras = await solicitar('/carreras');
        const datosMaterias = await solicitar('/materias');

        const carreras = Array.isArray(datosCarreras.carreras)
            ? datosCarreras.carreras
            : [];

        const materias = Array.isArray(datosMaterias.materias)
            ? datosMaterias.materias
            : [];

        llenarSelector(
            selectorCarrera,
            carreras,
            'id_carrera',
            'Registra una carrera primero'
        );

        llenarSelector(
            selectorMateria,
            materias,
            'id_materia',
            'Registra una materia primero'
        );
    } catch (error) {
        errorForm.textContent = error.message;
    }
}

tipo.addEventListener('change', () => {
    campoCarrera.hidden = tipo.value !== 'pensum';
    campoMateria.hidden = tipo.value !== 'programa';
});

inputArchivo.addEventListener('change', () => {
    const archivo = inputArchivo.files[0];
    info.textContent = archivo
        ? `${archivo.name} (${(archivo.size / 1048576).toFixed(2)} MB)`
        : 'Ningún archivo seleccionado. Formatos: PDF o DOCX, hasta 20 MB.';
});

function limpiarFormulario() {
    form.reset();
    campoCarrera.hidden = true;
    campoMateria.hidden = true;
    info.textContent =
        'Ningún archivo seleccionado. Formatos: PDF o DOCX, hasta 20 MB.';
}

form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorForm.textContent = '';
    status.className = 'status';

    const archivo = inputArchivo.files[0];
    const idCarrera = selectorCarrera.value;
    const idMateria = selectorMateria.value;

    if (!tipo.value) {
        errorForm.textContent = 'Seleccione el tipo de documento.';
        return;
    }

    if (tipo.value === 'pensum' && !idCarrera) {
        errorForm.textContent = 'Seleccione la carrera.';
        return;
    }

    if (tipo.value === 'programa' && !idMateria) {
        errorForm.textContent = 'Seleccione la materia.';
        return;
    }

    if (!archivo) {
        errorForm.textContent = 'Seleccione un archivo.';
        return;
    }

    const extension = archivo.name.split('.').pop().toLowerCase();

    if (!EXT_OK.includes(extension)) {
        mostrar(
            'err',
            'Archivo rechazado',
            'Formato no compatible. Se acepta PDF o Word.'
        );
        return;
    }

    if (archivo.size > MAX_MB * 1048576) {
        mostrar(
            'err',
            'Archivo rechazado',
            `El archivo supera el tamaño máximo de ${MAX_MB} MB.`
        );
        return;
    }

    const datos = new FormData();
    datos.append('tipo', tipo.value);

    if (tipo.value === 'pensum') {
        datos.append('id_carrera', idCarrera);
    }

    if (tipo.value === 'programa') {
        datos.append('id_materia', idMateria);
    }

    datos.append('archivo', archivo);

    btn.disabled = true;
    mostrar('loading', 'Cargando…', 'Estamos subiendo su archivo, por favor espere.');

    try {
        const token = sessionStorage.getItem('seda_access_token');

        if (!token) {
            cerrarSesionUniversidad();
            return;
        }

        const respuesta = await fetch('/archivos', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: datos
        });

        const resultado = await respuesta.json().catch(() => ({}));

        if (respuesta.status === 401) {
            cerrarSesionUniversidad();
            return;
        }

        if (respuesta.ok && resultado.advertencia) {
            mostrar('warn', 'Aceptado con advertencia', resultado.advertencia);
            limpiarFormulario();
        } else if (respuesta.ok) {
            mostrar(
                'ok',
                'Archivo aceptado',
                resultado.mensaje || 'El archivo se cargó correctamente.'
            );
            limpiarFormulario();
        } else {
            mostrar(
                'err',
                'No se pudo subir',
                resultado.error || 'Ocurrió un error en el servidor.'
            );
        }
    } catch {
        mostrar(
            'err',
            'Sin conexión',
            'No se pudo conectar con el servidor. Intente de nuevo.'
        );
    } finally {
        btn.disabled = false;
    }
});

cargarRegistros();