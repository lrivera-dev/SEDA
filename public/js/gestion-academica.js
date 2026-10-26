const TOKEN_SESION = 'seda_access_token';

const formularioCarrera = document.getElementById('form-carrera');
const campoNombreCarrera = document.getElementById('nombre-carrera');
const botonCrearCarrera = document.getElementById('boton-crear-carrera');
const estadoCarrera = document.getElementById('estado-carrera');
const listaCarreras = document.getElementById('lista-carreras');

const formularioMateria = document.getElementById('form-materia');
const selectorCarrera = document.getElementById('carrera-materia');
const campoNombreMateria = document.getElementById('nombre-materia');
const botonCrearMateria = document.getElementById('boton-crear-materia');
const estadoMateria = document.getElementById('estado-materia');
const listaMaterias = document.getElementById('lista-materias');
const campoArchivoPensum = document.getElementById('archivo-pensum');
const campoArchivoPrograma = document.getElementById('archivo-programa');

let carreraPendientePensum = null;
let materiaPendientePrograma = null;

function cerrarSesion() {
    if (window.SEDAAuthUniversidad) {
        window.SEDAAuthUniversidad.cerrarSesion();
        return;
    }

    sessionStorage.removeItem('seda_access_token');
    sessionStorage.removeItem('seda_rol');
    window.location.replace('/index.html');
}

async function solicitar(url, opciones = {}) {
    const token = sessionStorage.getItem(TOKEN_SESION);

    if (!token) {
        cerrarSesion();
        throw new Error('La sesión terminó. Inicia sesión nuevamente.');
    }

    const respuesta = await fetch(url, {
        ...opciones,
        headers: {
            ...(opciones.headers || {}),
            Authorization: `Bearer ${token}`
        }
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401) {
        cerrarSesion();
        throw new Error('La sesión terminó. Inicia sesión nuevamente.');
    }

    if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo completar la solicitud.');
    }

    return datos;
}

function validarArchivo(archivo, tipoDocumento) {
    if (!archivo) {
        throw new Error(`Selecciona el archivo ${tipoDocumento}.`);
    }

    const extension = archivo.name.split('.').pop().toLowerCase();

    if (!['pdf', 'docx'].includes(extension)) {
        throw new Error('El archivo debe ser PDF o DOCX.');
    }

    if (archivo.size > 20 * 1024 * 1024) {
        throw new Error('El archivo no puede superar los 20 MB.');
    }
}

async function subirDocumento(tipo, idRegistro, archivo) {
    const datos = new FormData();
    datos.append('tipo', tipo);
    datos.append(tipo === 'pensum' ? 'id_carrera' : 'id_materia', idRegistro);
    datos.append('archivo', archivo);

    return solicitar('/archivos', {
        method: 'POST',
        body: datos
    });
}


function mostrarElementoVacio(lista, texto) {
    const elemento = document.createElement('li');
    elemento.textContent = texto;
    lista.appendChild(elemento);
}

async function cargarCarreras() {
    estadoCarrera.textContent = 'Cargando carreras...';

    const datos = await solicitar('/carreras');
    const carreras = Array.isArray(datos.carreras) ? datos.carreras : [];

    listaCarreras.replaceChildren();
    selectorCarrera.replaceChildren();

    const opcionInicial = document.createElement('option');
    opcionInicial.value = '';
    opcionInicial.textContent = carreras.length
        ? 'Selecciona una carrera'
        : 'Registra una carrera primero';
    selectorCarrera.appendChild(opcionInicial);

    for (const carrera of carreras) {
        const opcion = document.createElement('option');
        opcion.value = carrera.id_carrera;
        opcion.textContent = carrera.nombre;
        selectorCarrera.appendChild(opcion);

        const elemento = document.createElement('li');
        elemento.textContent = carrera.nombre;
        listaCarreras.appendChild(elemento);
    }

    if (carreras.length === 0) {
        mostrarElementoVacio(listaCarreras, 'Aún no hay carreras registradas.');
    }

    selectorCarrera.disabled = carreras.length === 0;
    botonCrearMateria.disabled = carreras.length === 0;
    estadoCarrera.textContent = '';
}

async function cargarMaterias() {
    estadoMateria.textContent = 'Cargando materias...';

    const datos = await solicitar('/materias');
    const materias = Array.isArray(datos.materias) ? datos.materias : [];

    listaMaterias.replaceChildren();

    if (materias.length === 0) {
        mostrarElementoVacio(listaMaterias, 'Aún no hay materias registradas.');
        estadoMateria.textContent = '';
        return;
    }

    const carreras = await solicitar('/carreras');
    const nombresCarreras = new Map(
        (carreras.carreras || []).map((carrera) => [
            carrera.id_carrera,
            carrera.nombre
        ])
    );

    for (const materia of materias) {
        const elemento = document.createElement('li');
        const nombreCarrera = nombresCarreras.get(materia.id_carrera) || 'Carrera';
        elemento.textContent = `${materia.nombre} — ${nombreCarrera}`;
        listaMaterias.appendChild(elemento);
    }

    estadoMateria.textContent = '';
}

formularioCarrera.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    estadoCarrera.textContent = '';
    botonCrearCarrera.disabled = true;

    try {
        const archivo = campoArchivoPensum.files[0];
        validarArchivo(archivo, 'del pensum');

        if (!carreraPendientePensum) {
            const resultado = await solicitar('/carreras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: campoNombreCarrera.value.trim()
                })
            });

            if (!resultado.carrera?.id_carrera) {
                throw new Error('La carrera se registró, pero no se recibió su identificador.');
            }

            carreraPendientePensum = resultado.carrera;
            campoNombreCarrera.disabled = true;
        }

        const carrera = carreraPendientePensum;
        estadoCarrera.textContent = `Carrera registrada. Subiendo el pensum de ${carrera.nombre}…`;

        try {
            await subirDocumento('pensum', carrera.id_carrera, archivo);
        } catch (error) {
            estadoCarrera.textContent =
                `La carrera "${carrera.nombre}" se creó, pero no se pudo subir el pensum. ` +
                `${error.message} Selecciona el archivo e inténtalo de nuevo; no se creará otra carrera.`;
            return;
        }

        carreraPendientePensum = null;
        campoNombreCarrera.disabled = false;
        formularioCarrera.reset();

        try {
            await cargarCarreras();
            estadoCarrera.textContent = 'Carrera y pensum registrados correctamente.';
        } catch (error) {
            estadoCarrera.textContent =
                `La carrera y el pensum se guardaron, pero no se pudo actualizar la lista. ${error.message}`;
        }
    } catch (error) {
        estadoCarrera.textContent = error.message;
    } finally {
        botonCrearCarrera.disabled = false;
        botonCrearCarrera.textContent = carreraPendientePensum
            ? 'Reintentar subida del pensum'
            : 'Registrar carrera';
    }
});


formularioMateria.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    estadoMateria.textContent = '';
    botonCrearMateria.disabled = true;

    try {
        const archivo = campoArchivoPrograma.files[0];
        validarArchivo(archivo, 'del programa de la materia');

        if (!materiaPendientePrograma) {
            const idCarrera = selectorCarrera.value;

            const resultado = await solicitar('/materias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_carrera: idCarrera,
                    nombre: campoNombreMateria.value.trim()
                })
            });

            if (!resultado.materia?.id_materia) {
                throw new Error('La materia se registró, pero no se recibió su identificador.');
            }

            materiaPendientePrograma = resultado.materia;
            selectorCarrera.disabled = true;
            campoNombreMateria.disabled = true;
        }

        const materia = materiaPendientePrograma;
        estadoMateria.textContent =
            `Materia registrada. Subiendo su programa…`;

        try {
            await subirDocumento('programa', materia.id_materia, archivo);
        } catch (error) {
            estadoMateria.textContent =
                `La materia "${materia.nombre}" se creó, pero no se pudo subir su programa. ` +
                `${error.message} Selecciona el archivo e inténtalo de nuevo; no se creará otra materia.`;
            return;
        }

        materiaPendientePrograma = null;
        selectorCarrera.disabled = false;
        campoNombreMateria.disabled = false;
        formularioMateria.reset();

        try {
            await cargarCarreras();
            await cargarMaterias();
            estadoMateria.textContent = 'Materia y programa registrados correctamente.';
        } catch (error) {
            estadoMateria.textContent =
                `La materia y su programa se guardaron, pero no se pudo actualizar la lista. ${error.message}`;
        }
    } catch (error) {
        estadoMateria.textContent = error.message;
    } finally {
        botonCrearMateria.disabled = false;
        botonCrearMateria.textContent = materiaPendientePrograma
            ? 'Reintentar subida del programa'
            : 'Registrar materia';

        if (!materiaPendientePrograma) {
            botonCrearMateria.disabled = selectorCarrera.options.length <= 1;
        }
    }
});

async function iniciarPantalla() {
    try {
        await cargarCarreras();
        await cargarMaterias();
    } catch (error) {
        estadoCarrera.textContent = error.message;
    }
}

iniciarPantalla();