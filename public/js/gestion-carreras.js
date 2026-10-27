"use strict";

const TOKEN_SESION = "seda_access_token";

const formulario = document.getElementById("form-carrera");
const campoNombre = document.getElementById("nombre-carrera");
const campoPensum = document.getElementById("archivo-pensum");
const etiquetaPensum = formulario.querySelector('label[for="archivo-pensum"]');
const botonEnviar = document.getElementById("boton-crear-carrera");
const botonAbrir = document.getElementById("abrir-form-carrera");
const botonCancelar = document.getElementById("cancelar-form-carrera");
const estadoFormulario = document.getElementById("estado-carrera");
const estadoTabla = document.getElementById("estado-carreras");
const tabla = document.getElementById("tabla-carreras");

let carreraPendientePensum = null;
let carreraEnEdicion = null;

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

function validarPensum(archivo) {
    if (!archivo) {
        throw new Error("Selecciona el archivo del pénsum.");
    }

    const extension = archivo.name.split(".").pop().toLowerCase();

    if (!["pdf", "docx"].includes(extension)) {
        throw new Error("El pénsum debe ser un archivo PDF o DOCX.");
    }

    if (archivo.size > 20 * 1024 * 1024) {
        throw new Error("El archivo no puede superar los 20 MB.");
    }
}

async function subirPensum(idCarrera, archivo) {
    const datos = new FormData();
    datos.append("tipo", "pensum");
    datos.append("id_carrera", idCarrera);
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
    tabla.replaceChildren();

    if (carreras.length === 0) {
        const fila = document.createElement("tr");
        const celda = crearCelda("Aún no hay carreras registradas.");
        celda.colSpan = 3;
        fila.appendChild(celda);
        tabla.appendChild(fila);
        estadoTabla.textContent = "";
        return;
    }

    for (const carrera of carreras) {
        const fila = document.createElement("tr");
        const acciones = document.createElement("td");
        acciones.className = "tabla-acciones";

        acciones.append(
            crearBotonAccion("Editar", "", () => editarCarrera(carrera)),
            crearBotonAccion(
                "Eliminar",
                "boton-peligro",
                () => eliminarCarrera(carrera)
            )
        );

        fila.append(
            crearCelda(carrera.nombre),
            crearCelda(carrera.pensum_url ? "Cargado" : "Pendiente"),
            acciones
        );

        tabla.appendChild(fila);
    }

    estadoTabla.textContent = `${carreras.length} carrera(s)`;
}

async function cargarCarreras() {
    estadoTabla.textContent = "Cargando carreras...";

    const datos = await solicitar("/carreras");
    mostrarCarreras(Array.isArray(datos.carreras) ? datos.carreras : []);
}

function prepararFormularioAlta() {
    carreraEnEdicion = null;
    campoNombre.disabled = false;
    campoPensum.hidden = false;
    campoPensum.required = true;
    etiquetaPensum.hidden = false;
    botonEnviar.textContent = "Registrar carrera";
    etiquetaPensum.textContent =
        "Pénsum de la carrera (PDF o DOCX, máximo 20 MB)";
}

function editarCarrera(carrera) {
    if (carreraPendientePensum) {
        estadoFormulario.textContent =
            "Primero termina de subir el pénsum pendiente.";
        formulario.hidden = false;
        return;
    }

    formulario.reset();
    prepararFormularioAlta();
    carreraEnEdicion = carrera;
    campoNombre.value = carrera.nombre;
    campoPensum.hidden = false;
    campoPensum.required = false;
    etiquetaPensum.hidden = false;
    etiquetaPensum.textContent =
        "Reemplazar pénsum (opcional, PDF o DOCX, máximo 20 MB)";
    botonEnviar.textContent = "Guardar cambios";
    formulario.hidden = false;
    campoNombre.focus();
}

async function eliminarCarrera(carrera) {
    const confirmar = window.confirm(
        `¿Eliminar la carrera "${carrera.nombre}"? ` +
        "Solo se puede eliminar si no tiene materias asociadas."
    );

    if (!confirmar) return;

    estadoTabla.textContent = `Eliminando "${carrera.nombre}"…`;

    try {
        const resultado = await solicitar(
            `/carreras/${encodeURIComponent(carrera.id_carrera)}`,
            { method: "DELETE" }
        );

        await cargarCarreras();
        estadoTabla.textContent = resultado.advertencia
            ? resultado.advertencia
            : resultado.mensaje;
    } catch (error) {
        estadoTabla.textContent = error.message;
    }
}

botonAbrir.addEventListener("click", () => {
    if (carreraPendientePensum) {
        estadoFormulario.textContent =
            "Primero termina de subir el pénsum pendiente.";
        formulario.hidden = false;
        return;
    }

    formulario.reset();
    prepararFormularioAlta();
    estadoFormulario.textContent = "";
    formulario.hidden = false;
    campoNombre.focus();
});

botonCancelar.addEventListener("click", () => {
    if (carreraPendientePensum) {
        estadoFormulario.textContent =
            "Selecciona el pénsum y reintenta la subida antes de cerrar el formulario.";
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
        if (carreraEnEdicion) {
            const carrera = carreraEnEdicion;
            const archivo = campoPensum.files[0];

            if (archivo) {
                validarPensum(archivo);
            }

            await solicitar(
                `/carreras/${encodeURIComponent(carrera.id_carrera)}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nombre: campoNombre.value.trim()
                    })
                }
            );

            if (archivo) {
                try {
                    await subirPensum(carrera.id_carrera, archivo);
                } catch (error) {
                    estadoFormulario.textContent =
                        `El nombre se actualizó, pero no se pudo reemplazar el pénsum: ${error.message}`;
                    return;
                }
            }

            formulario.reset();
            prepararFormularioAlta();
            formulario.hidden = true;

            try {
                await cargarCarreras();
                estadoTabla.textContent = archivo
                    ? "Carrera y pénsum actualizados correctamente."
                    : "Carrera actualizada correctamente.";
            } catch (error) {
                estadoTabla.textContent =
                    `La carrera se actualizó, pero no se pudo refrescar la tabla. ${error.message}`;
            }

            return;
        }

        const archivo = campoPensum.files[0];
        validarPensum(archivo);

        if (!carreraPendientePensum) {
            const resultado = await solicitar("/carreras", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: campoNombre.value.trim()
                })
            });

            if (!resultado.carrera?.id_carrera) {
                throw new Error(
                    "La carrera se registró, pero no se recibió su identificador."
                );
            }

            carreraPendientePensum = resultado.carrera;
            campoNombre.disabled = true;
        }

        try {
            await subirPensum(carreraPendientePensum.id_carrera, archivo);
        } catch (error) {
            estadoFormulario.textContent =
                `La carrera "${carreraPendientePensum.nombre}" se creó, pero no se pudo subir el pénsum. ` +
                `${error.message} Selecciona el archivo e inténtalo de nuevo; no se creará otra carrera.`;
            return;
        }

        carreraPendientePensum = null;
        formulario.reset();
        prepararFormularioAlta();
        formulario.hidden = true;

        try {
            await cargarCarreras();
            estadoTabla.textContent = "Carrera y pénsum registrados correctamente.";
        } catch (error) {
            estadoTabla.textContent =
                `La carrera y el pénsum se guardaron, pero no se pudo actualizar la tabla. ${error.message}`;
        }
    } catch (error) {
        estadoFormulario.textContent = error.message;
    } finally {
        botonEnviar.disabled = false;

        if (carreraEnEdicion) {
            botonEnviar.textContent = "Guardar cambios";
        } else if (carreraPendientePensum) {
            botonEnviar.textContent = "Reintentar subida del pénsum";
        } else {
            botonEnviar.textContent = "Registrar carrera";
        }
    }
});

cargarCarreras().catch((error) => {
    estadoTabla.textContent = error.message;
});