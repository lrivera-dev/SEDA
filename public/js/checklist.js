
"use strict";

// HU-3: integración del componente de resultados
// con los casos reales del checklist de SEDA.

(() => {
    const lista = document.getElementById("lista-casos");
    const mensaje = document.getElementById("estado-checklist");

    const selecciones = new Map();
    let ultimaRespuesta = null;
    let consultando = false;
    let temporizador = null;
    let hayCasosEnEvaluacion = false;

    function crearElemento(etiqueta, clase, texto) {
        const elemento = document.createElement(etiqueta);

        if (clase) {
            elemento.className = clase;
        }

        if (texto !== undefined) {
            elemento.textContent = String(texto);
        }

        return elemento;
    }

    function obtenerTokenUniversidad() {
        return sessionStorage.getItem('seda_access_token');
    }

    function cerrarSesionUniversidad() {
        sessionStorage.removeItem('seda_access_token');
        sessionStorage.removeItem('seda_rol');
        window.location.href = '/index.html';
    }

    const token = obtenerTokenUniversidad();

    function crearFila(caso) {
        const fila = crearElemento("article", "hu3-caso");

        const nombreOrigen = caso.materia_origen || "Materia de origen";
        const nombreDestino = caso.materia_destino || "Materia de destino";

        const titulo = crearElemento(
            "h3",
            "hu3-nombre-caso",
            `${nombreOrigen} → ${nombreDestino}`
        );

        // Selección visual del checklist (HU-4).
        const etiqueta = crearElemento("label", "hu3-seleccion");

        const casilla = document.createElement("input");
        casilla.type = "checkbox";

        const aprobada = caso.estado_checklist === "APROBADA";

        // Usar el estado del backend, salvo que el usuario
        // haya modificado manualmente esta casilla.
        casilla.checked = selecciones.has(caso.id_caso)
            ? selecciones.get(caso.id_caso)
            : aprobada;

        // Guardar únicamente los cambios manuales.
        casilla.addEventListener("change", () => {
            selecciones.set(caso.id_caso, casilla.checked);
        });

        const textoSeleccion = crearElemento(
            "span",
            "",
            "Seleccionar equivalencia"
        );

        etiqueta.append(casilla, textoSeleccion);

        // Contenedor exclusivo del componente HU-3.
        const resultado = crearElemento(
            "div",
            "hu3-resultado"
        );

        window.SEDAEstadoCalculo.renderizar(resultado, caso);

        fila.append(titulo, etiqueta);

        // Mostrar el motivo de las equivalencias pendientes.
        if (!aprobada) {
            const motivo = crearElemento(
                "p",
                "hu3-motivo-pendiente",
                caso.motivo || "Pendiente de análisis"
            );

            fila.appendChild(motivo);
        }

        // Mantener los estados y reportes de HU-3.
        fila.appendChild(resultado);

        return fila;
    }

    function mostrarChecklist(datos) {
        lista.replaceChildren();

        const casos = Array.isArray(datos.casos)
            ? datos.casos
            : [];

        const incompletos = Array.isArray(datos.datos_incompletos)
            ? datos.datos_incompletos
            : [];

        const resumen = datos.resumen || {};

        if (casos.length === 0 && incompletos.length === 0) {
            mensaje.textContent =
                datos.mensaje || "Aún no tienes equivalencias registradas.";
            return;
        }

        const aprobadas = resumen.aprobadas ?? 0;
        const pendientes = resumen.pendientes ?? 0;

        mensaje.textContent = pendientes === 0 && casos.length > 0
            ? "Todas las materias están aprobadas"
            : `${aprobadas} aprobadas y ${pendientes} pendientes de análisis`;

        for (const caso of casos) {
            lista.appendChild(crearFila(caso));
        }

        // Los casos sin documentos no pueden seleccionarse.
        if (incompletos.length > 0) {
            const aviso = crearElemento(
                "section",
                "hu3-documentos-incompletos"
            );

            aviso.appendChild(crearElemento(
                "h3",
                "",
                "Casos con documentos faltantes"
            ));

            for (const caso of incompletos) {
                const nombres = caso.documentos_faltantes || [];

                const detalle = crearElemento(
                    "p",
                    "",
                    `${caso.materia_origen || "Materia"} → ` +
                    `${caso.materia_destino || "Materia"}: ` +
                    `faltan ${nombres.join(", ")}`
                );

                aviso.appendChild(detalle);
            }

            lista.appendChild(aviso);
        }
    }

    async function cargarChecklist() {
        if (consultando) return;

        consultando = true;

        try {
            const respuesta = await fetch('/checklist', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const datos = await respuesta.json().catch(() => ({}));

            if (respuesta.status === 401) {
                hayCasosEnEvaluacion = false;
                cerrarSesionUniversidad();
                return;
            }

            if (!respuesta.ok) {
                throw new Error(
                    datos.error || "No se pudo cargar el checklist."
                );
            }
            // Solo continuar consultando mientras haya casos en evaluación.
            hayCasosEnEvaluacion = Array.isArray(datos.casos) &&
                datos.casos.some(
                    caso => caso.estado_calculo === "EN_CALCULO"
                );

            const firma = JSON.stringify(datos);

            // Evita cerrar los reportes desplegados
            // cuando la información sigue siendo igual.
            if (firma !== ultimaRespuesta) {
                mostrarChecklist(datos);
                ultimaRespuesta = firma;
            }

        } catch (error) {
            mensaje.textContent = error.message;
        } finally {
            consultando = false;

            // Evitar múltiples temporizadores simultáneos.
            clearTimeout(temporizador);
            temporizador = null;

            // Consultar de nuevo únicamente si hay casos en evaluación.
            if (hayCasosEnEvaluacion) {
                temporizador = setTimeout(cargarChecklist, 5000);
            }
        }
    }

    if (!token) {
        cerrarSesionUniversidad();
        return;
    }

    if (!window.SEDAEstadoCalculo) {
        mensaje.textContent =
            "No se pudo cargar el componente de evaluación.";
        return;
    }
    // Reactivar las consultas cuando HU-3 confirma un reintento.
    window.addEventListener("seda:reintento-confirmado", () => {
        hayCasosEnEvaluacion = true;

        clearTimeout(temporizador);

        temporizador = setTimeout(cargarChecklist, 5000);
    });
    // Primera carga. Las siguientes consultas se programan
    // únicamente cuando existen casos en evaluación.
    cargarChecklist();
})();
