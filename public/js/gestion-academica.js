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
        await solicitar('/carreras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: campoNombreCarrera.value.trim()
            })
        });

        formularioCarrera.reset();
        estadoCarrera.textContent = 'Carrera registrada.';
        await cargarCarreras();
    } catch (error) {
        estadoCarrera.textContent = error.message;
    } finally {
        botonCrearCarrera.disabled = false;
    }
});

formularioMateria.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    estadoMateria.textContent = '';
    botonCrearMateria.disabled = true;

    try {
        await solicitar('/materias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_carrera: selectorCarrera.value,
                nombre: campoNombreMateria.value.trim()
            })
        });

        formularioMateria.reset();
        estadoMateria.textContent = 'Materia registrada.';
        await cargarMaterias();
    } catch (error) {
        estadoMateria.textContent = error.message;
    } finally {
        botonCrearMateria.disabled = selectorCarrera.options.length <= 1;
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