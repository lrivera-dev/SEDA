"use strict";

// HU-3: integración del componente de resultados
// con los casos reales del checklist de SEDA.
// HU-5: confirmación formal de las equivalencias seleccionadas.

(() => {
    const lista = document.getElementById("lista-casos");
    const mensaje = document.getElementById("estado-checklist");

    // HU-5: elementos de la confirmación.
    const barraConfirmacion = document.getElementById("barra-confirmacion");
    const mensajeConfirmacion = document.getElementById("mensaje-confirmacion");
    const contadorSeleccion = document.getElementById("contador-seleccion");
    const botonConfirmar = document.getElementById("boton-confirmar");
    const dialogo = document.getElementById("dialogo-confirmacion");
    const textoResumen = document.getElementById("texto-resumen");
    const listaResumen = document.getElementById("resumen-seleccion");
    const avisoBajaCoincidencia = document.getElementById("aviso-baja-coincidencia");
    const casillaAceptoBaja = document.getElementById("acepto-baja-coincidencia");
    const botonCancelar = document.getElementById("boton-cancelar-confirmacion");
    const botonRegistrar = document.getElementById("boton-registrar-confirmacion");

    const MENSAJE_SIN_SELECCION = "Selecciona al menos una equivalencia para confirmar";
    const MENSAJE_EVALUACION_PENDIENTE =
        "Debes completar la evaluación antes de confirmar esta equivalencia";
    const MENSAJE_ERROR_GUARDADO =
        "No se pudieron registrar las equivalencias. Intenta de nuevo";
    const TEXTO_BOTON_REGISTRAR = "Confirmar y registrar";

    const selecciones = new Map();
    let ultimosCasos = [];
    let casosEnConfirmacion = [];
    let confirmando = false;
    let ultimaRespuesta = null;
    let consultando = false;
    let temporizador = null;
    let hayCasosEnEvaluacion = false;
    let casoDesdeHashEnfocado = false;

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

    function enfocarCasoDesdeHash() {
        if (casoDesdeHashEnfocado) return;

        const idCaso = window.location.hash.slice(1);

        if (!idCaso.startsWith("caso-")) return;

        const elemento = document.getElementById(idCaso);

        if (!elemento) return;

        elemento.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
        elemento.classList.add("hu3-caso--resaltado");
        casoDesdeHashEnfocado = true;
    }

    function cerrarSesionUniversidad() {
        sessionStorage.removeItem('seda_access_token');
        sessionStorage.removeItem('seda_rol');
        window.location.href = '/index.html';
    }

    const token = obtenerTokenUniversidad();

    // ---------- HU-5: confirmación de equivalencias ----------

    function nombreCaso(caso) {
        return `${caso.materia_origen || "Materia de origen"} → ` +
            `${caso.materia_destino || "Materia de destino"}`;
    }

    function formatearFecha(valor) {
        const fecha = new Date(valor);

        return Number.isNaN(fecha.getTime())
            ? String(valor)
            : fecha.toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
    }

    function casoRevisadoPorMined(caso) {
        return Boolean(caso.estado_caso) && caso.estado_caso !== "PENDIENTE";
    }

    // Solo se pueden seleccionar los casos que aún no se confirmaron ni revisó el MINED.
    function casoConfirmable(caso) {
        return caso.confirmada_universidad !== true && !casoRevisadoPorMined(caso);
    }

    // RN2: las aprobadas (80% o más) arrancan marcadas; el usuario puede cambiarlo.
    function estaSeleccionado(caso) {
        return selecciones.has(caso.id_caso)
            ? selecciones.get(caso.id_caso)
            : caso.estado_checklist === "APROBADA";
    }

    function casosSeleccionados() {
        return ultimosCasos.filter(
            (caso) => casoConfirmable(caso) && estaSeleccionado(caso)
        );
    }

    function actualizarBarra() {
        barraConfirmacion.hidden = ultimosCasos.length === 0;

        const seleccionadas = casosSeleccionados().length;
        const confirmadas = ultimosCasos.filter(
            (caso) => caso.confirmada_universidad === true
        ).length;

        let texto = seleccionadas === 1
            ? "1 equivalencia seleccionada"
            : `${seleccionadas} equivalencias seleccionadas`;

        if (confirmadas > 0) {
            texto += ` · ${confirmadas} ${confirmadas === 1 ? "ya confirmada" : "ya confirmadas"}`;
        }

        contadorSeleccion.textContent = texto;
    }

    function ocultarMensajeConfirmacion() {
        mensajeConfirmacion.hidden = true;
        mensajeConfirmacion.textContent = "";
    }

    function mostrarMensajeConfirmacion(texto, tipo) {
        mensajeConfirmacion.textContent = texto;
        mensajeConfirmacion.className = `mensaje-confirmacion mensaje-confirmacion--${tipo}`;
        mensajeConfirmacion.setAttribute("role", tipo === "error" ? "alert" : "status");
        mensajeConfirmacion.hidden = false;
        barraConfirmacion.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function crearEstadoConfirmacion(caso) {
        const contenedor = crearElemento("div", "hu5-confirmacion");

        if (caso.confirmada_universidad === true) {
            contenedor.appendChild(crearElemento(
                "span", "hu5-estado hu5-estado--confirmada", "Confirmada por la universidad"
            ));

            if (caso.fecha_confirmacion) {
                contenedor.appendChild(crearElemento(
                    "p", "hu5-detalle",
                    `Fecha de confirmación: ${formatearFecha(caso.fecha_confirmacion)}`
                ));
            }

            if (caso.id_usuario_confirmacion) {
                contenedor.appendChild(crearElemento(
                    "p", "hu5-detalle",
                    `Usuario responsable: ${caso.id_usuario_confirmacion}`
                ));
            }

            return contenedor;
        }

        if (casoRevisadoPorMined(caso)) {
            contenedor.appendChild(crearElemento(
                "span", "hu5-estado hu5-estado--revisada", "Revisada por el MINED"
            ));
            return contenedor;
        }

        contenedor.appendChild(crearElemento(
            "span", "hu5-estado hu5-estado--pendiente", "Pendiente de confirmar"
        ));

        return contenedor;
    }

    function actualizarBotonRegistrar() {
        botonRegistrar.disabled =
            confirmando || (!avisoBajaCoincidencia.hidden && !casillaAceptoBaja.checked);
    }

    // Arma el mensaje de error y, si el backend indica qué casos fallaron, los nombra.
    function describirErrorConfirmacion(datos) {
        const base = datos.error || MENSAJE_ERROR_GUARDADO;
        const ids = Array.isArray(datos.ids_afectados) ? datos.ids_afectados : [];
        const nombres = ids
            .map((id) => ultimosCasos.find((caso) => caso.id_caso === id))
            .filter(Boolean)
            .map(nombreCaso);

        return nombres.length > 0 ? `${base} (${nombres.join(", ")})` : base;
    }

    // Abre el resumen de la selección, después de las validaciones E1 y E2.
    function abrirResumen() {
        if (confirmando) return;

        ocultarMensajeConfirmacion();

        const seleccion = casosSeleccionados();

        // E1: sin materias seleccionadas.
        if (seleccion.length === 0) {
            mostrarMensajeConfirmacion(MENSAJE_SIN_SELECCION, "error");
            return;
        }

        // E2: la evaluación no está terminada.
        const sinEvaluar = seleccion.filter((caso) =>
            caso.estado_calculo !== "CALCULADO" ||
            caso.porcentaje_coincidencia === null ||
            caso.porcentaje_coincidencia === undefined
        );

        if (sinEvaluar.length > 0) {
            mostrarMensajeConfirmacion(
                `${MENSAJE_EVALUACION_PENDIENTE} (${sinEvaluar.map(nombreCaso).join(", ")})`,
                "error"
            );
            return;
        }

        // Se guarda lo que se muestra, para que las actualizaciones de fondo no cambien el envío.
        casosEnConfirmacion = seleccion;
        listaResumen.replaceChildren();

        let hayBajas = false;

        for (const caso of seleccion) {
            const baja = caso.estado_checklist !== "APROBADA";
            hayBajas = hayBajas || baja;

            const item = crearElemento(
                "li",
                baja
                    ? "dialogo-confirmacion__item dialogo-confirmacion__item--baja"
                    : "dialogo-confirmacion__item"
            );

            item.appendChild(crearElemento("span", "dialogo-confirmacion__materia", nombreCaso(caso)));
            item.appendChild(crearElemento(
                "strong", "dialogo-confirmacion__porcentaje", `${caso.porcentaje_coincidencia}%`
            ));

            if (baja) {
                item.appendChild(crearElemento(
                    "span", "dialogo-confirmacion__etiqueta", "Menor al 80%"
                ));
            }

            listaResumen.appendChild(item);
        }

        textoResumen.textContent = seleccion.length === 1
            ? "Vas a confirmar 1 equivalencia."
            : `Vas a confirmar ${seleccion.length} equivalencias.`;

        // A1: coincidencia menor al 80%, requiere confirmación explícita.
        avisoBajaCoincidencia.hidden = !hayBajas;
        casillaAceptoBaja.checked = false;
        actualizarBotonRegistrar();

        dialogo.showModal();
    }

    // Espera a que termine una consulta en curso para no omitir la recarga.
    async function recargarChecklist() {
        while (consultando) {
            await new Promise((resolver) => setTimeout(resolver, 100));
        }

        ultimaRespuesta = null;
        await cargarChecklist();
    }

    async function registrarConfirmacion() {
        if (confirmando || casosEnConfirmacion.length === 0) return;

        confirmando = true;
        botonRegistrar.disabled = true;
        botonCancelar.disabled = true;
        botonRegistrar.textContent = "Registrando...";

        let texto = MENSAJE_ERROR_GUARDADO;
        let tipo = "error";
        let recargar = false;

        try {
            const respuesta = await fetch("/checklist/confirmar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ids_caso: casosEnConfirmacion.map((caso) => caso.id_caso)
                })
            });

            const datos = await respuesta.json().catch(() => ({}));

            if (respuesta.status === 401) {
                cerrarSesionUniversidad();
                return;
            }

            // Con cualquier respuesta del servidor se recarga para mostrar el estado real.
            recargar = true;

            if (respuesta.ok) {
                texto = datos.mensaje || "Equivalencias confirmadas y registradas exitosamente";
                tipo = "exito";

                for (const caso of casosEnConfirmacion) {
                    selecciones.delete(caso.id_caso);
                }
            } else {
                texto = describirErrorConfirmacion(datos);
            }
        } catch (error) {
            // E6: error de red; no se registró nada.
            texto = MENSAJE_ERROR_GUARDADO;
        } finally {
            confirmando = false;
            botonCancelar.disabled = false;
            botonRegistrar.textContent = TEXTO_BOTON_REGISTRAR;
            actualizarBotonRegistrar();
            dialogo.close();
        }

        mostrarMensajeConfirmacion(texto, tipo);

        if (recargar) {
            await recargarChecklist();
        }
    }

    function crearFila(caso) {
        const fila = crearElemento("article", "hu3-caso");
        fila.id = `caso-${caso.id_caso}`;
        const nombreOrigen = caso.materia_origen || "Materia de origen";
        const nombreDestino = caso.materia_destino || "Materia de destino";

        const titulo = crearElemento(
            "h3",
            "hu3-nombre-caso",
            `${nombreOrigen} → ${nombreDestino}`
        );

        const contexto = crearElemento("div", "hu3-contexto-caso");

        const carreraOrigen = crearElemento(
            "p",
            "hu3-contexto-lado",
            `Origen · ${caso.carrera_origen || "Carrera no especificada"}`
        );

        const destino = crearElemento(
            "p",
            "hu3-contexto-lado",
            `Destino · ${caso.universidad_destino || "Universidad no especificada"} · ` +
            `${caso.carrera_destino || "Carrera no especificada"}`
        );

        contexto.append(carreraOrigen, destino);

        // Selección visual del checklist (HU-4).
        const etiqueta = crearElemento("label", "hu3-seleccion");

        const casilla = document.createElement("input");
        casilla.type = "checkbox";

        const aprobada = caso.estado_checklist === "APROBADA";

        // HU-5: una equivalencia confirmada (o ya revisada por el MINED) no se puede cambiar.
        const confirmada = caso.confirmada_universidad === true;
        const revisada = casoRevisadoPorMined(caso);

        // Usar el estado del backend, salvo que el usuario
        // haya modificado manualmente esta casilla.
        casilla.checked = confirmada || estaSeleccionado(caso);
        casilla.disabled = confirmada || revisada;

        // Guardar únicamente los cambios manuales.
        casilla.addEventListener("change", () => {
            selecciones.set(caso.id_caso, casilla.checked);
            actualizarBarra();
        });

        const textoSeleccion = crearElemento(
            "span",
            "",
            confirmada
                ? "Equivalencia confirmada"
                : revisada
                    ? "Revisada por el MINED: ya no se puede confirmar"
                    : "Seleccionar equivalencia"
        );

        etiqueta.append(casilla, textoSeleccion);

        // Contenedor exclusivo del componente HU-3.
        const resultado = crearElemento(
            "div",
            "hu3-resultado"
        );

        window.SEDAEstadoCalculo.renderizar(resultado, caso);

        fila.append(titulo, contexto, crearEstadoConfirmacion(caso), etiqueta);

        // Mostrar el motivo pendiente, excepto cuando el resultado calculado
        // ya presenta la advertencia de coincidencia baja.
        const porcentaje = Number(caso.porcentaje_coincidencia);
        const coincidenciaBaja =
            caso.estado_calculo === "CALCULADO" &&
            Number.isFinite(porcentaje) &&
            porcentaje >= 0 &&
            porcentaje < 60;

        if (!aprobada && !coincidenciaBaja) {
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

        // HU-5: la barra de confirmación depende de los casos mostrados.
        ultimosCasos = casos;
        actualizarBarra();

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
                detalle.id = `caso-${caso.id_caso}`;

                aviso.appendChild(detalle);
            }

            lista.appendChild(aviso);
        }
        enfocarCasoDesdeHash();
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
    // HU-5: eventos de la confirmación.
    botonConfirmar.addEventListener("click", abrirResumen);
    botonCancelar.addEventListener("click", () => dialogo.close());
    casillaAceptoBaja.addEventListener("change", actualizarBotonRegistrar);
    botonRegistrar.addEventListener("click", registrarConfirmacion);

    // No se permite cerrar el diálogo con Escape mientras se registra.
    dialogo.addEventListener("cancel", (evento) => {
        if (confirmando) evento.preventDefault();
    });

    // Primera carga. Las siguientes consultas se programan
    // únicamente cuando existen casos en evaluación.
    cargarChecklist();
})();