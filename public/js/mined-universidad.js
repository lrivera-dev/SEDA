"use strict";

const TOKEN_SESION = "seda_access_token";
const idUniversidad = new URLSearchParams(window.location.search).get("id");

const titulo = document.getElementById("tituloUniversidad");
const estado = document.getElementById("estadoDetalle");
const detalle = document.getElementById("detalleUniversidad");

function crearElemento(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);

    if (clase) elemento.className = clase;
    if (texto !== undefined && texto !== null) {
        elemento.textContent = String(texto);
    }

    return elemento;
}

function cerrarSesion() {
    sessionStorage.removeItem("seda_access_token");
    sessionStorage.removeItem("seda_rol");
    window.location.replace("/index.html");
}

function agregarContacto(contenedor, etiqueta, valor) {
    contenedor.append(
        crearElemento(
            "p",
            "",
            `${etiqueta}: ${valor || "No registrado"}`
        )
    );
}

function mostrarUniversidad(universidad) {
    titulo.textContent = universidad.nombre || "Detalle de universidad";
    detalle.replaceChildren();
    detalle.className = "detalle-universidad";
    detalle.hidden = false;

    const contacto = crearElemento("div", "detalle-contacto");
    agregarContacto(contacto, "Ubicación", universidad.ubicacion);
    agregarContacto(contacto, "Correo de contacto", universidad.correo_contacto);
    agregarContacto(contacto, "Teléfono", universidad.telefono_contacto);

    const estadoUniversidad = crearElemento(
        "p",
        `estado-universidad estado-universidad--${String(universidad.estado || "").toLowerCase()}`,
        `Estado: ${universidad.estado || "Sin estado"}`
    );

    const tituloCarreras = crearElemento(
        "h3",
        "",
        `Carreras registradas (${universidad.cantidad_carreras ?? 0})`
    );

    const carrerasContenedor = crearElemento("div", "detalle-carreras");
    const carreras = Array.isArray(universidad.carreras)
        ? universidad.carreras
        : [];

    if (carreras.length === 0) {
        carrerasContenedor.append(
            crearElemento("p", "", "Esta universidad aún no registra carreras.")
        );
    }

    for (const carrera of carreras) {
        const tarjeta = crearElemento("article", "detalle-carrera");

        tarjeta.append(
            crearElemento("h5", "", carrera.nombre || "Carrera sin nombre"),
            crearElemento(
                "p",
                "",
                `Pénsum: ${carrera.tiene_pensum ? "Cargado" : "Pendiente"}`
            )
        );

        const materias = Array.isArray(carrera.materias)
            ? carrera.materias
            : [];

        if (materias.length === 0) {
            tarjeta.append(
                crearElemento("p", "", "Sin materias registradas.")
            );
        } else {
            const listaMaterias = document.createElement("ul");

            for (const materia of materias) {
                const elemento = document.createElement("li");
                elemento.textContent =
                    `${materia.nombre || "Materia sin nombre"} — ` +
                    `Programa: ${materia.tiene_programa ? "Cargado" : "Pendiente"}`;
                listaMaterias.append(elemento);
            }

            tarjeta.append(listaMaterias);
        }

        carrerasContenedor.append(tarjeta);
    }

    detalle.append(
        contacto,
        estadoUniversidad,
        tituloCarreras,
        carrerasContenedor
    );

    estado.textContent = "";
}

async function cargarDetalle() {
    if (!idUniversidad) {
        estado.textContent = "Falta el identificador de la universidad.";
        return;
    }

    const token = sessionStorage.getItem(TOKEN_SESION);

    if (!token) {
        cerrarSesion();
        return;
    }

    try {
        const respuesta = await fetch(
            `/panel/universidades/${encodeURIComponent(idUniversidad)}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const datos = await respuesta.json().catch(() => ({}));

        if (respuesta.status === 401) {
            cerrarSesion();
            return;
        }

        if (!respuesta.ok) {
            throw new Error(
                datos.error || "No se pudo cargar la universidad."
            );
        }

        if (!datos.universidad) {
            throw new Error("No se encontró la universidad.");
        }

        mostrarUniversidad(datos.universidad);
    } catch (error) {
        estado.textContent = error.message;
    }
}

document
    .getElementById("logoutButton")
    .addEventListener("click", cerrarSesion);

cargarDetalle();