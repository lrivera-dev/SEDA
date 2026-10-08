const MAX_MB = 20;
const EXT_OK = ['pdf', 'docx'];

const form = document.getElementById('form-archivo');
const tipo = document.getElementById('tipo');
const campoCarrera = document.getElementById('campo-carrera');
const campoMateria = document.getElementById('campo-materia');
const inputArchivo = document.getElementById('archivo');
const info = document.getElementById('info-archivo');
const errorForm = document.getElementById('error-form');
const btn = document.getElementById('btn-enviar');
const status = document.getElementById('status');

const ICONOS = { loading: '<span class="spin" aria-hidden="true"></span>', ok: '✓', warn: '!', err: '✕' };

function mostrar(tipoEstado, titulo, mensaje) {
    status.className = 'status show ' + tipoEstado;
    status.innerHTML = `<span class="ico">${ICONOS[tipoEstado]}</span><div><b></b><p></p></div>`;
    status.querySelector('b').textContent = titulo;
    status.querySelector('p').textContent = mensaje;
}

// Mostrar el campo de ID según el tipo de documento
tipo.addEventListener('change', () => {
    campoCarrera.hidden = tipo.value !== 'pensum';
    campoMateria.hidden = tipo.value !== 'programa';
});

inputArchivo.addEventListener('change', () => {
    const f = inputArchivo.files[0];
    info.textContent = f ? `${f.name} (${(f.size / 1048576).toFixed(2)} MB)` : 'Ningún archivo seleccionado.';
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorForm.textContent = '';
    status.className = 'status';

    const archivo = inputArchivo.files[0];
    const idCarrera = document.getElementById('id_carrera').value.trim();
    const idMateria = document.getElementById('id_materia').value.trim();

    // Validaciones en el navegador (antes de enviar)
    if (!tipo.value) return (errorForm.textContent = 'Seleccione el tipo de documento.');
    if (tipo.value === 'pensum' && !idCarrera) return (errorForm.textContent = 'Ingrese el ID de la carrera.');
    if (tipo.value === 'programa' && !idMateria) return (errorForm.textContent = 'Ingrese el ID de la materia.');
    if (!archivo) return (errorForm.textContent = 'Seleccione un archivo.');

    const ext = archivo.name.split('.').pop().toLowerCase();
    if (!EXT_OK.includes(ext)) {
        return mostrar('err', 'Archivo rechazado', 'El archivo no es compatible, formatos aceptados: PDF o Word');
    }
    if (archivo.size > MAX_MB * 1048576) {
        return mostrar('err', 'Archivo rechazado', `El archivo supera el tamaño máximo permitido (${MAX_MB} MB).`);
    }

    const datos = new FormData();
    datos.append('tipo', tipo.value);
    if (tipo.value === 'pensum') datos.append('id_carrera', idCarrera);
    if (tipo.value === 'programa') datos.append('id_materia', idMateria);
    datos.append('archivo', archivo); // el campo debe llamarse "archivo"

    btn.disabled = true;
    mostrar('loading', 'Cargando…', 'Estamos subiendo su archivo, por favor espere.');

    try {
        const resp = await fetch('/archivos', { method: 'POST', body: datos });
        const json = await resp.json().catch(() => ({}));

        if (resp.ok && json.advertencia) {
            mostrar('warn', 'Aceptado con advertencia', json.advertencia);
        } else if (resp.ok) {
            mostrar('ok', 'Archivo aceptado', json.mensaje || 'El archivo se cargó correctamente.');
            form.reset();
            campoCarrera.hidden = campoMateria.hidden = true;
            info.textContent = 'Ningún archivo seleccionado. Formatos: PDF o DOCX, hasta 20 MB.';
        } else if (resp.status === 400) {
            mostrar('err', 'Archivo rechazado', json.error || 'El archivo no cumple los requisitos.');
        } else {
            mostrar('err', 'No se pudo subir', json.error || 'Ocurrió un error en el servidor. Intente de nuevo.');
        }
    } catch (err) {
        mostrar('err', 'Sin conexión', 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.');
    }
    btn.disabled = false;
});