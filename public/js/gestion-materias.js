"use strict";

const TOKEN_SESION = "seda_access_token";

const formulario = document.getElementById("form-materia");
const selectorCarrera = document.getElementById("carrera-materia");
const etiquetaCarrera = formulario.querySelector('label[for="carrera-materia"]');
const campoNombre = document.getElementById("nombre-materia");
const campoPrograma = document.getElementById("archivo-programa");
const etiquetaPrograma = formulario.querySelector('label[for="archivo-programa"]');
const botonEnviar = document.getElementById("boton-crear-materia");
const botonAbrir = document.getElementById("abrir-form-materia");
const botonCancelar = document.getElementById("cancelar-form-materia");
const estadoFormulario = document.getElementById("estado-materia");
const estadoTabla = document.getElementById("estado-materias");
const tabla = document.getElementById("tabla-materias");

let carrerasPorId = new Map();
let materiaPendientePrograma = null;
let materiaEnEdicion = null;

function cerrarSesion() {
    window.SEDAAuthUniversidad.cerrarSesion();
}

async function solicitar(url, opciones = {}) {
    const token = sessionStorage.getItem(TOKEN_SESION);

    if (!token) {
        cerrarSesion();
        throw new Error("La sesión terminó. Inicia sesión nuevamente.");
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
        throw new Error("La sesión terminó. Inicia sesión nuevamente.");
    }

    if (!respuesta.ok) {
        throw new Error(datos.error || "No se pudo completar la solicitud.");
    }

    return datos;
}

function validarPrograma(archivo) {
    if (!archivo) {
        throw new Error("Selecciona el programa de la materia.");
    }

    const extension = archivo.name.split(".").pop().toLowerCase();

    if (!["pdf", "docx"].includes(extension)) {
        throw new Error("El programa debe ser un archivo PDF o DOCX.");
    }

    if (archivo.size > 20 * 1024 * 1024) {
        throw new Error("El archivo no puede superar los 20 MB.");
    }
}

async function subirPrograma(idMateria, archivo) {
    const datos = new FormData();
    datos.append("tipo", "programa");
    datos.append("id_materia", idMateria);
    datos.append("archivo", archivo);

    await solicitar("/archivos", {
        method: "POST",
        body: datos
    });
}

function crearCelda(texto) {
    const celda = document.createElement("td");
    celda.textContent = texto;
    return celda;
}

function crearBotonAccion(texto, clase, accion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = texto;
    if (clase) boton.className = clase;
    boton.addEventListener("click", accion);
    return boton;
}

function mostrarCarreras(carreras) {
    carrerasPorId = new Map(
        carreras.map((carrera) => [carrera.id_carrera, carrera.nombre])
    );

    selectorCarrera.replaceChildren();

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = carreras.length
        ? "Selecciona una carrera"
        : "Registra una carrera primero";
    selectorCarrera.appendChild(opcionInicial);

    for (const carrera of carreras) {
        const opcion = document.createElement("option");
        opcion.value = carrera.id_carrera;
        opcion.textContent = carrera.nombre;
        selectorCarrera.appendChild(opcion);
    }

    selectorCarrera.disabled = carreras.length === 0;
    botonAbrir.disabled = carreras.length === 0;
}

function mostrarMaterias(materias) {
    tabla.replaceChildren();

    if (materias.length === 0) {
        const fila = document.createElement("tr");
        const celda = crearCelda("Aún no hay materias registradas.");
        celda.colSpan = 4;
        fila.appendChild(celda);
        tabla.appendChild(fila);
        estadoTabla.textContent = "";
        return;
    }

    for (const materia of materias) {
        const fila = document.createElement("tr");
        const acciones = document.createElement("td");
        acciones.className = "tabla-acciones";

        acciones.append(
            crearBotonAccion("Editar", "", () => editarMateria(materia)),
            crearBotonAccion(
                "Eliminar",
                "boton-peligro",
                () => eliminarMateria(materia)
            )
        );

        fila.append(
            crearCelda(materia.nombre),
            crearCelda(carrerasPorId.get(materia.id_carrera) || "Carrera"),
            crearCelda(materia.programa_url ? "Cargado" : "Pendiente"),
            acciones
        );

        tabla.appendChild(fila);
    }

    estadoTabla.textContent = `${materias.length} materia(s)`;
}

async function cargarDatos() {
    estadoTabla.textContent = "Cargando materias...";

    const [datosCarreras, datosMaterias] = await Promise.all([
        solicitar("/carreras"),
        solicitar("/materias")
    ]);

    const carreras = Array.isArray(datosCarreras.carreras)
        ? datosCarreras.carreras
        : [];
    const materias = Array.isArray(datosMaterias.materias)
        ? datosMaterias.materias
        : [];

    mostrarCarreras(carreras);
    mostrarMaterias(materias);
}

function prepararFormularioAlta() {
    materiaEnEdicion = null;
    selectorCarrera.disabled = false;
    selectorCarrera.hidden = false;
    selectorCarrera.required = true;
    etiquetaCarrera.hidden = false;
    campoNombre.disabled = false;
    campoPrograma.hidden = false;
    campoPrograma.required = true;
    etiquetaPrograma.hidden = false;
    botonEnviar.textContent = "Registrar materia";
}

function editarMateria(materia) {
    if (materiaPendientePrograma) {
        estadoFormulario.textContent =
            "Primero termina de subir el programa pendiente.";
        formulario.hidden = false;
        return;
    }

    formulario.reset();
    prepararFormularioAlta();
    materiaEnEdicion = materia;
    campoNombre.value = materia.nombre;
    selectorCarrera.hidden = true;
    selectorCarrera.required = false;
    etiquetaCarrera.hidden = true;
    campoPrograma.hidden = true;
    campoPrograma.required = false;
    etiquetaPrograma.hidden = true;
    botonEnviar.textContent = "Guardar cambios";
    estadoFormulario.textContent =
        "La carrera y el programa actuales se conservarán.";
    formulario.hidden = false;
    campoNombre.focus();
}

async function eliminarMateria(materia) {
    const confirmar = window.confirm(
        `¿Eliminar la materia "${materia.nombre}"? ` +
        "No se puede eliminar si está asociada a una equivalencia."
    );

    if (!confirmar) return;

    estadoTabla.textContent = `Eliminando "${materia.nombre}"…`;

    try {
        const resultado = await solicitar(
            `/materias/${encodeURIComponent(materia.id_materia)}`,
            { method: "DELETE" }
        );

        await cargarDatos();
        estadoTabla.textContent = resultado.advertencia
            ? resultado.advertencia
            : resultado.mensaje;
    } catch (error) {
        estadoTabla.textContent = error.message;
    }
}

botonAbrir.addEventListener("click", () => {
    if (materiaPendientePrograma) {
        estadoFormulario.textContent =
            "Primero termina de subir el programa pendiente.";
        formulario.hidden = false;
        return;
    }

    formulario.reset();
    prepararFormularioAlta();
    estadoFormulario.textContent = "";
    formulario.hidden = false;
    selectorCarrera.focus();
});

botonCancelar.addEventListener("click", () => {
    if (materiaPendientePrograma) {
        estadoFormulario.textContent =
            "Selecciona el programa y reintenta la subida antes de cerrar el formulario.";
        return;
    }

    formulario.reset();
    prepararFormularioAlta();
    formulario.hidden = true;
    estadoFormulario.textContent = "";
});

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    estadoFormulario.textContent = "";
    botonEnviar.disabled = true;

    try {
        if (materiaEnEdicion) {
            const materia = materiaEnEdicion;

            await solicitar(
                `/materias/${encodeURIComponent(materia.id_materia)}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nombre: campoNombre.value.trim()
                    })
                }
            );

            formulario.reset();
            prepararFormularioAlta();
            formulario.hidden = true;

            try {
                await cargarDatos();
                estadoTabla.textContent = "Materia actualizada correctamente.";
            } catch (error) {
                estadoTabla.textContent =
                    `La materia se actualizó, pero no se pudo refrescar la tabla. ${error.message}`;
            }

            return;
        }

        const archivo = campoPrograma.files[0];
        validarPrograma(archivo);

        if (!materiaPendientePrograma) {
            const resultado = await solicitar("/materias", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_carrera: selectorCarrera.value,
                    nombre: campoNombre.value.trim()
                })
            });

            if (!resultado.materia?.id_materia) {
                throw new Error(
                    "La materia se registró, pero no se recibió su identificador."
                );
            }

            materiaPendientePrograma = resultado.materia;
            selectorCarrera.disabled = true;
            campoNombre.disabled = true;
        }

        try {
            await subirPrograma(
                materiaPendientePrograma.id_materia,
                archivo
            );
        } catch (error) {
            estadoFormulario.textContent =
                `La materia "${materiaPendientePrograma.nombre}" se creó, pero no se pudo subir su programa. ` +
                `${error.message} Selecciona el archivo e inténtalo de nuevo; no se creará otra materia.`;
            return;
        }

        materiaPendientePrograma = null;
        formulario.reset();
        prepararFormularioAlta();
        formulario.hidden = true;

        try {
            await cargarDatos();
            estadoTabla.textContent =
                "Materia y programa registrados correctamente.";
        } catch (error) {
            estadoTabla.textContent =
                `La materia y su programa se guardaron, pero no se pudo actualizar la tabla. ${error.message}`;
        }
    } catch (error) {
        estadoFormulario.textContent = error.message;
    } finally {
        botonEnviar.disabled = false;

        if (materiaEnEdicion) {
            botonEnviar.textContent = "Guardar cambios";
        } else if (materiaPendientePrograma) {
            botonEnviar.textContent = "Reintentar subida del programa";
        } else {
            botonEnviar.textContent = "Registrar materia";
        }

        if (!materiaPendientePrograma) {
            selectorCarrera.disabled = selectorCarrera.options.length <= 1;
        }
    }
});

cargarDatos().catch((error) => {
    estadoTabla.textContent = error.message;
});