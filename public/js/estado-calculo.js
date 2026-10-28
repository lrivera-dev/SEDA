
"use strict";

// HU-3: visualización del resultado de coincidencia.
// Todos los datos recibidos de la IA se escriben con textContent.

(() => {
  function obtenerTokenUniversidad() {
    return sessionStorage.getItem("seda_access_token");
  }

  function cerrarSesionUniversidad() {
    sessionStorage.removeItem("seda_access_token");
    sessionStorage.removeItem("seda_rol");
    window.location.href = "/index.html";
  }

  const SECCIONES = [
    ["resumen", "Resumen"],
    ["contenidos_coincidentes", "Contenidos coincidentes"],
    ["metodologia", "Metodología"],
    ["diferencias", "Diferencias"],
    ["contexto_pensum", "Contexto del pensum"],
    ["conclusion", "Conclusión"]
  ];

  const ESTADOS = {
    SIN_CALCULAR: "Sin calcular",
    EN_CALCULO: "En evaluación",
    CALCULADO: "Calculado",
    ERROR: "Error",
    NO_APLICA: "Propuesta manual"
  };

  function crearElemento(etiqueta, clase, texto) {



    const elemento = document.createElement(etiqueta);

    if (clase) elemento.className = clase;

    if (texto !== undefined && texto !== null) {
      elemento.textContent = String(texto);
    }

    return elemento;
  }

  function leerReporte(reporte) {
    if (reporte && typeof reporte === "object"
      && !Array.isArray(reporte)) {
      return reporte;
    }

    if (typeof reporte === "string") {
      try {
        const resultado = JSON.parse(reporte);
        return resultado && typeof resultado === "object"
          && !Array.isArray(resultado) ? resultado : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  function renderizar(contenedor, caso) {
    contenedor.replaceChildren();

    const estado = caso.estado_calculo || "SIN_CALCULAR";
    const esManual = caso.modalidad === "MANUAL";

    const etiqueta = crearElemento(
      "span",
      `hu3-estado hu3-estado--${esManual ? "manual" : estado.toLowerCase()}`,
      esManual ? "Propuesta manual" : ESTADOS[estado] || "Estado desconocido"
    );

    contenedor.appendChild(etiqueta);

    if (esManual) {
      const valorPropuesto = caso.porcentaje_propuesto;
      const porcentaje =
        valorPropuesto === null ||
          valorPropuesto === undefined ||
          valorPropuesto === ""
          ? NaN
          : Number(valorPropuesto);

      if (
        Number.isFinite(porcentaje) &&
        porcentaje >= 0 &&
        porcentaje <= 100
      ) {
        contenedor.appendChild(
          crearElemento(
            "strong",
            "hu3-porcentaje",
            `${porcentaje}% propuesto por la universidad`
          )
        );
      }

      const justificacion = crearElemento("details", "hu3-seccion");
      const encabezado = crearElemento(
        "summary",
        "",
        "Justificación de la universidad"
      );
      const contenido = crearElemento(
        "p",
        "hu3-texto-ia",
        caso.justificacion_manual || "No se registró una justificación."
      );

      justificacion.append(encabezado, contenido);
      contenedor.appendChild(justificacion);
      return;
    }

    if (estado === "EN_CALCULO") {
      const mensaje = crearElemento(
        "p",
        "hu3-mensaje",
        "La evaluación de coincidencia está en proceso."
      );
      mensaje.setAttribute("role", "status");
      contenedor.appendChild(mensaje);
    }

    if (estado === "CALCULADO") {
      const porcentaje = Number(caso.porcentaje_coincidencia);

      if (!Number.isFinite(porcentaje) ||
        porcentaje < 0 || porcentaje > 100 ||
        caso.porcentaje_coincidencia == null) {
        contenedor.appendChild(
          crearElemento("p", "hu3-error",
            "El porcentaje calculado no está disponible.")
        );
        return;
      }

      contenedor.appendChild(
        crearElemento(
          "strong",
          "hu3-porcentaje",
          `${porcentaje}% de coincidencia`
        )
      );

      const barra = crearElemento(
        "progress",
        "hu3-barra"
      );

      barra.max = 100;
      barra.value = porcentaje;
      barra.setAttribute(
        "aria-label",
        "Porcentaje de coincidencia"
      );

      contenedor.appendChild(barra);

      if (porcentaje < 60) {
        const advertencia = crearElemento(
          "p",
          "hu3-advertencia",
          "Coincidencia baja: se recomienda revisión manual"
        );
        advertencia.setAttribute("role", "status");
        contenedor.appendChild(advertencia);
      }

      const reporte = leerReporte(caso.reporte);

      const titulo = crearElemento(
        "h4",
        "hu3-titulo-reporte",
        "Reporte de análisis de IA"
      );

      contenedor.appendChild(titulo);

      for (const [clave, nombre] of SECCIONES) {
        const desplegable = crearElemento(
          "details",
          "hu3-seccion"
        );

        const encabezado = crearElemento(
          "summary",
          "",
          nombre
        );

        const contenido = crearElemento(
          "p",
          "hu3-texto-ia",
          typeof reporte?.[clave] === "string"
            ? reporte[clave]
            : "Información no disponible."
        );

        desplegable.append(encabezado, contenido);
        contenedor.appendChild(desplegable);
      }
    }

    if (estado === "ERROR" || estado === "SIN_CALCULAR") {
      const motivo = caso.motivo ||
        "No se recibió un motivo del error.";

      const mensaje = String(motivo).startsWith(
        "No se pudo calcular la coincidencia:"
      )
        ? String(motivo)
        : `No se pudo calcular la coincidencia: ${motivo}`;

      const error = crearElemento(
        "p",
        "hu3-error",
        mensaje
      );

      error.setAttribute("role", "alert");
      let errorMostrado = estado === "ERROR";

      const boton = crearElemento(
        "button",
        "hu3-btn-reintentar",
        "Reintentar"
      );
      boton.type = "button";

      boton.addEventListener("click", async () => {
        boton.disabled = true;
        boton.textContent = "Reintentando...";

        try {
          const token = obtenerTokenUniversidad();

          if (!token) {
            cerrarSesionUniversidad();
            return;
          }

          const respuesta = await fetch(
            `/coincidencia/${encodeURIComponent(caso.id_caso)}/reintentar`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          const datos = await respuesta.json().catch(() => ({}));

          if (respuesta.status === 401) {
            cerrarSesionUniversidad();
            return;
          }

          if (!respuesta.ok) {
            throw new Error(
              datos.error || "No se pudo reintentar."
            );
          }

          if (respuesta.status !== 202) {
            throw new Error(
              "El servidor no confirmó el reintento."
            );
          }

          renderizar(contenedor, {
            ...caso,
            estado_calculo: "EN_CALCULO",
            motivo: null,
            porcentaje_coincidencia: null,
            reporte: null
          });
          // Avisar al checklist que debe reanudar las consultas.
          window.dispatchEvent?.(
            new Event("seda:reintento-confirmado")
          );
        } catch (fallo) {
          error.textContent = fallo.message;

          if (!errorMostrado) {
            contenedor.appendChild(error);
            errorMostrado = true;
          }

          boton.disabled = false;
          boton.textContent = "Reintentar";
        }
      });

      if (estado === "ERROR") {
        contenedor.append(error, boton);
      } else {
        contenedor.appendChild(boton);
      }
    }
  }

  window.SEDAEstadoCalculo = { renderizar };
})();
