"use strict";

const TOKEN_SESION = "seda_access_token";

const tabla = document.getElementById("tabla-equivalencias");
const estadoPagina = document.getElementById("estado-equivalencias");
const filtroDictamen = document.getElementById("filtro-dictamen");

let equivalencias = [];

const ETIQUETAS_DICTAMEN = {
    PENDIENTE: ["Pendiente", "dictamen--pendiente"],
    EN_REVISION: ["En revisión", "dictamen--revision"],
    ACEPTADO: ["Aceptada", "dictamen--aceptado"],
    ADVERTENCIA: ["Con advertencia", "dictamen--advertencia"]
};

const ETIQUETAS_CALCULO = {
    SIN_CALCULAR: "Sin calcular",
    EN_CALCULO: "En evaluación",
    CALCULADO: "Calculado",
    ERROR: "Error"
};

function cerrarSesion() {
    window.SEDAAuthUniversidad.cerrarSesion();
}

function crearElemento(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);

    if (clase) elemento.className = clase;
    if (texto !== undefined && texto !== null) {
        elemento.textContent = String(texto);
    }

    return elemento;
}

async function solicitarEquivalencias() {
    const token = sessionStorage.getItem(TOKEN_SESION);

    if (!token) {
        cerrarSesion();
        return;
    }

    const respuesta = await fetch("/equivalencias", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401) {
        cerrarSesion();
        return;
    }

    if (!respuesta.ok) {
        throw new Error(
            datos.error || "No se pudieron cargar las equivalencias."
        );
    }

    equivalencias = Array.isArray(datos.casos) ? datos.casos : [];
    mostrarTabla();
}

function crearCeldaEstudiante(caso) {
    const celda = document.createElement("td");

    celda.appendChild(
        crearElemento(
            "span",
            "equivalencia-principal",
            caso.nombre_estudiante || "Registro anterior"
        )
    );

    celda.appendChild(
        crearElemento(
            "span",
            "equivalencia-secundaria",
            caso.codigo_institucional
                ? `Código: ${caso.codigo_institucional}`
                : "Código no disponible"
        )
    );

    return celda;
}

function crearCeldaModalidad(modalidad) {
    const celda = document.createElement("td");
    const etiqueta = modalidad === "MANUAL"
        ? "Manual"
        : "Automática con IA";

    celda.appendChild(
        crearElemento("span", "coincidencia-estado", etiqueta)
    );

    return celda;
}

function crearCeldaMateria(nombre, carrera, universidad = null) {
    const celda = document.createElement("td");

    celda.appendChild(
        crearElemento(
            "span",
            "equivalencia-principal",
            nombre || "Materia no disponible"
        )
    );

    const contexto = [universidad, carrera].filter(Boolean).join(" · ");

    celda.appendChild(
        crearElemento(
            "span",
            "equivalencia-secundaria",
            contexto || "Contexto académico no disponible"
        )
    );

    return celda;
}

function crearCeldaCoincidencia(caso) {
    const celda = document.createElement("td");
    const esManual = caso.modalidad === "MANUAL";
    const porcentaje = esManual
        ? caso.porcentaje_propuesto
        : caso.porcentaje_coincidencia;

    if (typeof porcentaje === "number") {
        celda.appendChild(
            crearElemento("span", "coincidencia-valor", `${porcentaje}%`)
        );

        celda.appendChild(
            crearElemento(
                "span",
                "coincidencia-estado",
                esManual ? "Propuesta de la universidad" : "Calculado por IA"
            )
        );

        if (!esManual) {
            const barra = document.createElement("progress");
            barra.className = "coincidencia-barra";
            barra.max = 100;
            barra.value = porcentaje;
            barra.setAttribute(
                "aria-label",
                `Coincidencia calculada por IA: ${porcentaje}%`
            );
            celda.appendChild(barra);
        }

        return celda;
    }

    celda.appendChild(
        crearElemento(
            "span",
            "coincidencia-valor",
            esManual
                ? "Sin porcentaje propuesto"
                : ETIQUETAS_CALCULO[caso.estado_calculo] || "Sin calcular"
        )
    );

    if (!esManual && caso.estado_calculo === "ERROR" && caso.motivo_error_calculo) {
        celda.appendChild(
            crearElemento(
                "span",
                "coincidencia-estado",
                caso.motivo_error_calculo
            )
        );
    }

    return celda;
}

function crearCeldaDictamen(estado) {
    const celda = document.createElement("td");
    const [etiqueta, clase] = ETIQUETAS_DICTAMEN[estado] ||
        ["Estado desconocido", "dictamen--pendiente"];

    celda.appendChild(
        crearElemento("span", `dictamen-badge ${clase}`, etiqueta)
    );

    return celda;
}

function crearCeldaAccion(caso) {
    const celda = document.createElement("td");
    const enlace = crearElemento(
        "a",
        "accion-equivalencia",
        "Ver análisis"
    );

    enlace.href = `/checklist.html#caso-${encodeURIComponent(caso.id_caso)}`;
    celda.appendChild(enlace);

    return celda;
}

function mostrarTabla() {
    tabla.replaceChildren();

    const filtro = filtroDictamen.value;
    const filtradas = filtro === "TODAS"
        ? equivalencias
        : equivalencias.filter((caso) => caso.estado === filtro);

    if (filtradas.length === 0) {
        const fila = document.createElement("tr");
        const celda = crearElemento(
            "td",
            "",
            equivalencias.length === 0
                ? "Aún no tienes equivalencias registradas."
                : "No hay equivalencias con ese dictamen."
        );
        celda.colSpan = 7;
        fila.appendChild(celda);
        tabla.appendChild(fila);

        estadoPagina.textContent = equivalencias.length === 0
            ? ""
            : "Prueba otro filtro.";
        return;
    }

    for (const caso of filtradas) {
        const fila = document.createElement("tr");
        fila.dataset.estado = caso.estado || "";

        fila.append(
            crearCeldaEstudiante(caso),
            crearCeldaMateria(
                caso.materia_origen,
                caso.carrera_origen
            ),
            crearCeldaMateria(
                caso.materia_destino,
                caso.carrera_destino,
                caso.universidad_destino
            ),
            crearCeldaModalidad(caso.modalidad),
            crearCeldaCoincidencia(caso),
            crearCeldaDictamen(caso.estado),
            crearCeldaAccion(caso)
        );

        tabla.appendChild(fila);
    }

    estadoPagina.textContent = `${filtradas.length} equivalencia(s)`;
}

filtroDictamen.addEventListener("change", mostrarTabla);

solicitarEquivalencias().catch((error) => {
    estadoPagina.textContent = error.message;
});