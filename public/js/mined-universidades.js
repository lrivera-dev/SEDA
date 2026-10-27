"use strict";

const TOKEN_SESION = "seda_access_token";
const tabla = document.getElementById("universidadesBody");
const estado = document.getElementById("estadoUniversidades");
const total = document.getElementById("totalUniversidades");

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

async function solicitar(url) {
    const token = sessionStorage.getItem(TOKEN_SESION);

    if (!token) {
        cerrarSesion();
        throw new Error("La sesión terminó.");
    }

    const respuesta = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401) {
        cerrarSesion();
        throw new Error("La sesión terminó.");
    }

    if (!respuesta.ok) {
        throw new Error(datos.error || "No se pudo completar la consulta.");
    }

    return datos;
}

function agregarCelda(fila, contenido, clase = "") {
    const celda = document.createElement("td");

    if (clase) celda.className = clase;
    celda.append(contenido);
    fila.append(celda);
}

function agregarUniversidad(universidad) {
    const fila = document.createElement("tr");

    agregarCelda(
        fila,
        crearElemento("strong", "", universidad.nombre || "Sin nombre")
    );

    agregarCelda(fila, universidad.ubicacion || "No registrada");

    agregarCelda(
        fila,
        String(universidad.cantidad_carreras ?? 0)
    );

    const estadoUniversidad = crearElemento(
        "span",
        `estado-universidad estado-universidad--${String(universidad.estado || "").toLowerCase()}`,
        universidad.estado || "Sin estado"
    );
    agregarCelda(fila, estadoUniversidad);

    const enlace = crearElemento("a", "boton-detalle", "Ver detalle");
    enlace.href =
        `/mined-universidad.html?id=${encodeURIComponent(universidad.id_universidad)}`;
    agregarCelda(fila, enlace);

    tabla.append(fila);
}

async function cargarUniversidades() {
    try {
        const datos = await solicitar("/panel/universidades");
        const universidades = Array.isArray(datos.universidades)
            ? datos.universidades
            : [];

        tabla.replaceChildren();
        total.textContent =
            `${universidades.length} ` +
            `${universidades.length === 1 ? "universidad" : "universidades"}`;

        if (universidades.length === 0) {
            estado.textContent = "No hay universidades registradas.";
            return;
        }

        estado.textContent = "";

        for (const universidad of universidades) {
            agregarUniversidad(universidad);
        }
    } catch (error) {
        estado.textContent = error.message;
    }
}

document.getElementById("logoutButton").addEventListener("click", cerrarSesion);
cargarUniversidades();