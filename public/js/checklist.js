(() => {
    const API_CHECKLIST = '/checklist';
    const INTERVALO_MS = 5000;
    const ICONOS = { loading: '<span class="spin" aria-hidden="true"></span>', ok: '✓', warn: '!', err: '✕' };

    const $ = (id) => document.getElementById(id);
    const estadoPantalla = $('status-checklist');
    const contenido = $('contenido');
    const resumen = $('resumen');
    const mensajeTodas = $('mensaje-todas');
    const lista = $('lista-casos');
    const avisoIncompletos = $('aviso-incompletos');
    const textoIncompletos = $('texto-incompletos');
    const listaIncompletos = $('lista-incompletos');
    const plantilla = $('tpl-caso');

    // RN3: la marca de "validar" solo vive en la pantalla; aquí se recuerda lo que la universidad cambió.
    const marcas = new Map();
    let temporizador = null;

    // Mismo mecanismo que subir-equivalencia.js.
    // TODO(login): devolver el id de la universidad autenticada.
    // Mientras tanto: en la consola del navegador -> localStorage.setItem('id_universidad', '...')
    function obtenerIdUniversidad() {
        try { return localStorage.getItem('id_universidad'); } catch { return null; }
    }

    function mostrarEstado(tipo, titulo, mensaje) {
        estadoPantalla.className = 'status show ' + tipo;
        estadoPantalla.innerHTML = `<span class="ico">${ICONOS[tipo]}</span><div><b></b><p></p></div>`;
        estadoPantalla.querySelector('b').textContent = titulo;
        estadoPantalla.querySelector('p').textContent = mensaje;
    }

    function ocultarEstado() {
        estadoPantalla.className = 'status';
        estadoPantalla.replaceChildren();
    }

    function textoPorcentaje(valor) {
        return typeof valor === 'number' ? `${Math.round(valor * 100) / 100}%` : 'Sin calcular';
    }

    // HU-3 tarea 8: aquí se agregan la etiqueta del estado del cálculo, la barra y el reporte de la IA.
    // Recibe el contenedor .detalle-ia de la fila y los datos del caso (caso.estado_calculo, caso.reporte).
    // Todo texto de la IA se escribe con textContent.
    function completarDetalleIa(contenedor, caso) {}

    function pintarCaso(caso) {
        const fila = plantilla.content.firstElementChild.cloneNode(true);
        const casilla = fila.querySelector('.validar');
        const etiquetaMaterias = fila.querySelector('.materias');
        const etiqueta = fila.querySelector('.etiqueta');
        const motivo = fila.querySelector('.motivo');
        const aprobada = caso.estado_checklist === 'APROBADA';

        // RN4: las aprobadas vienen marcadas y las pendientes sin marcar, salvo que la universidad ya las cambió.
        const idCasilla = `validar-${caso.id_caso}`;
        casilla.id = idCasilla;
        etiquetaMaterias.htmlFor = idCasilla;
        casilla.checked = marcas.has(caso.id_caso) ? marcas.get(caso.id_caso) : aprobada;
        casilla.addEventListener('change', () => marcas.set(caso.id_caso, casilla.checked));

        etiquetaMaterias.textContent = `${caso.materia_origen ?? '—'} → ${caso.materia_destino ?? '—'}`;

        etiqueta.textContent = aprobada ? 'Aprobada' : 'Pendiente de análisis';
        etiqueta.classList.add(aprobada ? 'etiqueta--aprobada' : 'etiqueta--pendiente');

        fila.querySelector('.porcentaje').textContent = textoPorcentaje(caso.porcentaje_coincidencia);

        if (caso.motivo) {
            motivo.textContent = caso.motivo;
            motivo.hidden = false;
        }

        completarDetalleIa(fila.querySelector('.detalle-ia'), caso);
        return fila;
    }

    function pintarIncompletos(incompletos) {
        if (incompletos.length === 0) {
            avisoIncompletos.hidden = true;
            return;
        }

        textoIncompletos.textContent = 'No se puede generar el checklist completo: faltan materias o datos necesarios:';
        listaIncompletos.replaceChildren(
            ...incompletos.map((caso) => {
                const item = document.createElement('li');
                item.textContent = `${caso.materia_origen ?? '—'} → ${caso.materia_destino ?? '—'} (falta: ${(caso.documentos_faltantes || []).join(', ')})`;
                return item;
            })
        );
        avisoIncompletos.hidden = false;
    }

    function pintar(datos) {
        const casos = datos.casos || [];
        const incompletos = datos.datos_incompletos || [];
        const cuenta = datos.resumen || { total: 0, aprobadas: 0, pendientes: 0 };

        // E2: la universidad no tiene casos.
        if (casos.length === 0 && incompletos.length === 0) {
            contenido.hidden = true;
            avisoIncompletos.hidden = true;
            mostrarEstado('warn', 'Sin equivalencias', datos.mensaje || 'Aún no tienes equivalencias registradas');
            return;
        }

        ocultarEstado();
        contenido.hidden = false;

        resumen.textContent = `${cuenta.aprobadas} aprobadas y ${cuenta.pendientes} pendientes de análisis`;
        mensajeTodas.hidden = !(cuenta.total > 0 && cuenta.pendientes === 0);
        lista.replaceChildren(...casos.map(pintarCaso));

        pintarIncompletos(incompletos);
    }

    async function cargarChecklist(silencioso = false) {
        clearTimeout(temporizador);

        const idUniversidad = (obtenerIdUniversidad() || '').trim();

        // E3: sin universidad identificada.
        if (!idUniversidad) {
            contenido.hidden = true;
            avisoIncompletos.hidden = true;
            mostrarEstado('warn', 'Universidad no identificada', 'Debes identificar a tu universidad para ver el checklist.');
            return;
        }

        if (!silencioso) {
            mostrarEstado('loading', 'Cargando checklist', 'Consultando tus equivalencias…');
        }

        try {
            const respuesta = await fetch(`${API_CHECKLIST}/${encodeURIComponent(idUniversidad)}`);
            const datos = await respuesta.json().catch(() => ({}));

            if (!respuesta.ok) {
                contenido.hidden = true;
                avisoIncompletos.hidden = true;
                mostrarEstado('err', 'No se pudo cargar el checklist', datos.error || 'Intenta de nuevo.');
                return;
            }

            pintar(datos);

            // A2 / RN6: mientras haya casos en evaluación, la pantalla se actualiza sola cada 5 segundos.
            if ((datos.casos || []).some((caso) => caso.estado_calculo === 'EN_CALCULO')) {
                temporizador = setTimeout(() => cargarChecklist(true), INTERVALO_MS);
            }
        } catch (error) {
            contenido.hidden = true;
            avisoIncompletos.hidden = true;
            mostrarEstado('err', 'Sin conexión', 'No se pudo conectar con el servidor. Intenta de nuevo.');
        }
    }

    cargarChecklist();
})();