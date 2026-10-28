(() => {
    const API_EQUIVALENCIAS = '/equivalencias/solicitudes';
    const ICONOS = {
        loading: '<span class="spin" aria-hidden="true"></span>',
        ok: '✓',
        warn: '!',
        err: '✕'
    };

    const $ = (id) => document.getElementById(id);
    const formEq = $('form-equivalencia');
    const contFilas = $('eq-filas');
    const btnGuardar = $('btn-guardar-eq');
    const errorEq = $('error-equivalencia');
    const statusEq = $('status-equivalencia');
    const nombreEstudiante = $('nombre-estudiante');
    const codigoInstitucional = $('codigo-institucional');
    const modalidadInput = $('modalidad-equivalencia');
    const ayudaModalidad = $('ayuda-modalidad');

    let materiasOrigen = [];
    let materiasDestino = [];
    let contadorIds = 0;

    function mostrarEq(estado, titulo, mensaje) {
        statusEq.className = 'status show ' + estado;
        statusEq.innerHTML = `<span class="ico">${ICONOS[estado]}</span><div><b></b><p></p></div>`;
        statusEq.querySelector('b').textContent = titulo;
        statusEq.querySelector('p').textContent = mensaje;
    }

    function obtenerTokenUniversidad() {
        return sessionStorage.getItem('seda_access_token');
    }

    function cerrarSesionUniversidad() {
        sessionStorage.removeItem('seda_access_token');
        sessionStorage.removeItem('seda_rol');
        window.location.href = '/index.html';
    }

    async function obtenerJson(url, token) {
        const respuesta = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (respuesta.status === 401) {
            cerrarSesionUniversidad();
            throw new Error('La sesión expiró. Vuelve a iniciar sesión.');
        }

        const json = await respuesta.json().catch(() => null);

        if (!respuesta.ok) {
            throw new Error(json?.error || 'No se pudieron cargar las materias.');
        }

        return json;
    }

    async function cargarMaterias() {
        const token = obtenerTokenUniversidad();

        if (!token) {
            cerrarSesionUniversidad();
            return;
        }

        const [respuestaCarreras, respuestaMaterias, respuestaCatalogo] =
            await Promise.all([
                obtenerJson('/carreras', token),
                obtenerJson('/materias', token),
                obtenerJson('/materias/catalogo', token)
            ]);

        const carrerasConPensum = new Set(
            (respuestaCarreras.carreras || [])
                .filter((carrera) => carrera.pensum_url)
                .map((carrera) => carrera.id_carrera)
        );

        materiasOrigen = (respuestaMaterias.materias || [])
            .filter((materia) =>
                materia.programa_url && carrerasConPensum.has(materia.id_carrera)
            )
            .map((materia) => {
                const carrera = (respuestaCarreras.carreras || [])
                    .find((item) => item.id_carrera === materia.id_carrera);

                return {
                    id_materia: materia.id_materia,
                    id_carrera: materia.id_carrera,
                    nombre: materia.nombre,
                    carrera: carrera?.nombre || 'Carrera'
                };

            });

        const idsMateriasPropias = new Set(
            (respuestaMaterias.materias || []).map((materia) => materia.id_materia)
        );

        materiasDestino = (respuestaCatalogo.materias || [])
            .filter((materia) => !idsMateriasPropias.has(materia.id_materia));

        actualizarOpciones();
    }

    function agregarOpcion(select, valor, texto) {
        const opcion = document.createElement('option');
        opcion.value = valor;
        opcion.textContent = texto;
        select.append(opcion);
    }

    function llenarSelect(
        select,
        elementos,
        textoVacio,
        obtenerValor,
        obtenerTexto
    ) {
        const valorSeleccionado = select.value;

        select.replaceChildren();
        agregarOpcion(select, '', textoVacio);

        elementos.forEach((elemento) => {
            agregarOpcion(
                select,
                obtenerValor(elemento),
                obtenerTexto(elemento)
            );
        });

        select.disabled = elementos.length === 0;
        select.value = elementos.some(
            (elemento) => obtenerValor(elemento) === valorSeleccionado
        ) ? valorSeleccionado : '';
    }


    function filas() {
        return [...contFilas.querySelectorAll('.fila')];
    }

    function actualizarCamposModalidad() {
        const esManual = modalidadInput.value === 'MANUAL';

        ayudaModalidad.textContent = esManual
            ? 'Propón un porcentaje y respáldalo con una justificación académica.'
            : 'SEDA calculará el porcentaje y generará el análisis con IA.';

        filas().forEach((fila) => {
            const camposManuales = fila.querySelector('.datos-manuales');
            const porcentaje = fila.querySelector('.f-porcentaje-propuesto');
            const justificacion = fila.querySelector('.f-justificacion-manual');

            camposManuales.hidden = !esManual;
            porcentaje.required = esManual;
            justificacion.required = esManual;
        });
    }

    function actualizarOpcionesFila(fila) {
        const selectUniversidad = fila.querySelector('.f-universidad-destino');
        const selectCarrera = fila.querySelector('.f-carrera-destino');
        const selectMateria = fila.querySelector('.f-destino');

        const selectCarreraOrigen = fila.querySelector('.f-carrera-origen');
        const selectMateriaOrigen = fila.querySelector('.f-origen');

        const carrerasOrigen = [...new Map(
            materiasOrigen.map((materia) => [
                materia.id_carrera,
                {
                    id_carrera: materia.id_carrera,
                    nombre: materia.carrera
                }
            ])
        ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

        llenarSelect(
            selectCarreraOrigen,
            carrerasOrigen,
            carrerasOrigen.length
                ? 'Selecciona una carrera'
                : 'No hay carreras con documentos completos',
            (carrera) => carrera.id_carrera,
            (carrera) => carrera.nombre
        );

        const carreraOrigenElegida = selectCarreraOrigen.value;
        const materiasDeCarreraOrigen = materiasOrigen.filter(
            (materia) => materia.id_carrera === carreraOrigenElegida
        );

        llenarSelect(
            selectMateriaOrigen,
            materiasDeCarreraOrigen,
            carreraOrigenElegida
                ? 'Selecciona una materia'
                : 'Primero selecciona una carrera',
            (materia) => materia.id_materia,
            (materia) => materia.nombre
        );

        const universidades = [...new Set(
            materiasDestino.map((materia) => materia.universidad)
        )].sort((a, b) => a.localeCompare(b));

        llenarSelect(
            selectUniversidad,
            universidades,
            universidades.length
                ? 'Selecciona una universidad'
                : 'No hay universidades disponibles con documentos completos',
            (universidad) => universidad,
            (universidad) => universidad
        );

        const universidadElegida = selectUniversidad.value;
        const carreras = [...new Set(
            materiasDestino
                .filter((materia) => materia.universidad === universidadElegida)
                .map((materia) => materia.carrera)
        )].sort((a, b) => a.localeCompare(b));

        llenarSelect(
            selectCarrera,
            carreras,
            universidadElegida
                ? 'Selecciona una carrera'
                : 'Primero selecciona una universidad',
            (carrera) => carrera,
            (carrera) => carrera
        );

        const carreraElegida = selectCarrera.value;
        const materias = materiasDestino.filter((materia) =>
            materia.universidad === universidadElegida &&
            materia.carrera === carreraElegida
        );

        llenarSelect(
            selectMateria,
            materias,
            carreraElegida
                ? 'Selecciona una materia'
                : 'Primero selecciona una carrera',
            (materia) => materia.id_materia,
            (materia) => materia.nombre
        );
    }

    function actualizarOpciones() {
        filas().forEach(actualizarOpcionesFila);
    }

    function refrescarBotonesQuitar() {
        const lista = filas();
        lista.forEach((fila) => {
            fila.querySelector('.btn-quitar').hidden = lista.length === 1;
        });
    }

    function agregarFila() {
        const fila = $('tpl-fila').content.firstElementChild.cloneNode(true);

        fila.querySelectorAll('.field').forEach((campo) => {
            const controles = campo.querySelectorAll('select, input, textarea');
            const etiquetas = campo.querySelectorAll('label');

            controles.forEach((control, indice) => {
                const id = `fila-campo-${++contadorIds}`;
                control.id = id;

                if (etiquetas[indice]) {
                    etiquetas[indice].htmlFor = id;
                }
            });
        });

        fila.querySelector('.btn-quitar').addEventListener('click', () => {
            fila.remove();
            refrescarBotonesQuitar();
        });

        const selectUniversidad = fila.querySelector('.f-universidad-destino');
        const selectCarrera = fila.querySelector('.f-carrera-destino');
        const selectMateria = fila.querySelector('.f-destino');
        const selectCarreraOrigen = fila.querySelector('.f-carrera-origen');
        const selectMateriaOrigen = fila.querySelector('.f-origen');

        selectCarreraOrigen.addEventListener('change', () => {
            selectMateriaOrigen.value = '';
            actualizarOpcionesFila(fila);
        });

        selectUniversidad.addEventListener('change', () => {
            selectCarrera.value = '';
            selectMateria.value = '';
            actualizarOpcionesFila(fila);
        });

        selectCarrera.addEventListener('change', () => {
            selectMateria.value = '';
            actualizarOpcionesFila(fila);
        });

        contFilas.append(fila);
        actualizarOpcionesFila(fila);
        actualizarCamposModalidad();
        refrescarBotonesQuitar();
    }

    function validar() {
        let valido = true;
        const origenesUsados = new Set();
        const esManual = modalidadInput.value === 'MANUAL';

        if (!nombreEstudiante.value.trim()) {
            errorEq.textContent = 'Ingresa el nombre del estudiante.';
            return false;
        }

        if (!codigoInstitucional.value.trim()) {
            errorEq.textContent = 'Ingresa el código institucional del estudiante.';
            return false;
        }

        filas().forEach((fila, indice) => {
            const origen = fila.querySelector('.f-origen').value;
            const universidad = fila.querySelector('.f-universidad-destino').value;
            const carrera = fila.querySelector('.f-carrera-destino').value;
            const destino = fila.querySelector('.f-destino').value;
            const carreraOrigen = fila.querySelector('.f-carrera-origen').value;
            const notaInput = fila.querySelector('.f-nota-obtenida');
            const notaMaximaInput = fila.querySelector('.f-nota-maxima');
            const nota = Number(notaInput.value);
            const notaMaxima = Number(notaMaximaInput.value);
            const porcentajeInput = fila.querySelector('.f-porcentaje-propuesto');
            const justificacionInput = fila.querySelector('.f-justificacion-manual');
            const porcentaje = Number(porcentajeInput.value);
            const justificacion = justificacionInput.value.trim();
            let mensaje = '';

            if (!carreraOrigen || !origen || !universidad || !carrera || !destino) {
                mensaje = 'Selecciona las materias de origen y destino.';

            } else if (
                notaInput.value === '' ||
                notaMaximaInput.value === '' ||
                !Number.isFinite(nota) ||
                !Number.isFinite(notaMaxima) ||
                nota < 0 ||
                notaMaxima <= 0 ||
                nota > notaMaxima
            ) {
                mensaje = 'La nota debe estar entre 0 y la nota máxima indicada.';
            } else if (origen === destino) {
                mensaje = 'La materia de origen y destino no pueden ser la misma.';
            } else if (origenesUsados.has(origen)) {
                mensaje = 'Esta materia de origen ya aparece en otra fila.';
            } else if (
                esManual &&
                (
                    porcentajeInput.value === '' ||
                    !Number.isFinite(porcentaje) ||
                    porcentaje < 0 ||
                    porcentaje > 100
                )
            ) {
                mensaje = 'Ingresa un porcentaje propuesto de 0 a 100.';
            } else if (
                esManual &&
                (justificacion.length < 10 || justificacion.length > 500)
            ) {
                mensaje = 'La justificación debe tener entre 10 y 500 caracteres.';
            }

            if (origen) origenesUsados.add(origen);
            fila.querySelector('.fila-error').textContent = mensaje;

            if (mensaje) valido = false;
        });

        return valido;
    }

    function construirCuerpo() {
        const esManual = modalidadInput.value === 'MANUAL';

        return {
            nombre_estudiante: nombreEstudiante.value.trim(),
            codigo_institucional: codigoInstitucional.value.trim(),
            modalidad: modalidadInput.value,
            equivalencias: filas().map((fila) => ({
                id_materia_origen: fila.querySelector('.f-origen').value,
                id_materia_destino: fila.querySelector('.f-destino').value,
                nota_obtenida: Number(fila.querySelector('.f-nota-obtenida').value),
                nota_maxima: Number(fila.querySelector('.f-nota-maxima').value),
                porcentaje_propuesto: esManual
                    ? Number(fila.querySelector('.f-porcentaje-propuesto').value)
                    : null,
                justificacion_manual: esManual
                    ? fila.querySelector('.f-justificacion-manual').value.trim()
                    : null
            }))
        };
    }

    function mensajeError(respuesta, json) {
        if (respuesta.status === 404) {
            return 'No se encontró el servicio de solicitudes (POST /equivalencias/solicitudes).';
        }

        if (Array.isArray(json?.archivos_faltantes)) {
            return `Faltan archivos por cargar: ${json.archivos_faltantes.join(', ')}.`;
        }

        if (Array.isArray(json?.campos)) {
            return `Campos faltantes o inválidos: ${json.campos.join(', ')}.`;
        }

        return json?.error || 'Ocurrió un error en el servidor. Intenta de nuevo.';
    }

    function reiniciar() {
        formEq.reset();
        contFilas.replaceChildren();
        agregarFila();
        actualizarCamposModalidad();
    }

    formEq.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const token = obtenerTokenUniversidad();

        if (!token) {
            cerrarSesionUniversidad();
            return;
        }

        errorEq.textContent = '';
        statusEq.className = 'status';

        if (!validar()) {
            errorEq.textContent = 'Revisa los campos marcados antes de guardar.';
            return;
        }

        btnGuardar.disabled = true;

        try {
            mostrarEq(
                'loading',
                'Guardando solicitud…',
                'Registrando los datos del estudiante y sus equivalencias.'
            );

            const respuesta = await fetch(API_EQUIVALENCIAS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(construirCuerpo())
            });

            const json = await respuesta.json().catch(() => null);

            if (respuesta.status === 401) {
                cerrarSesionUniversidad();
                return;
            }

            if (!respuesta.ok) {
                const mensaje = mensajeError(respuesta, json);
                const primeraFila = filas()[0];

                if (primeraFila) {
                    primeraFila.querySelector('.fila-error').textContent = mensaje;
                }

                mostrarEq('err', 'No se registró la solicitud', mensaje);
                return;
            }

            const fueManual = modalidadInput.value === 'MANUAL';
            const cantidad = json?.solicitud?.ids_caso?.length || filas().length;

            reiniciar();

            mostrarEq(
                'ok',
                'Solicitud registrada',
                fueManual
                    ? `Se registró la propuesta manual con ${cantidad} equivalencia(s), pendiente de revisión del MINED.`
                    : `Se registró la solicitud con ${cantidad} equivalencia(s); SEDA iniciará el análisis con IA.`
            );
        } catch (error) {
            mostrarEq(
                'err',
                'No se pudo guardar la solicitud',
                error.message || 'Revisa tu conexión e intenta de nuevo.'
            );
        } finally {
            btnGuardar.disabled = false;
        }
    });

    modalidadInput.addEventListener('change', actualizarCamposModalidad);

    $('btn-agregar-fila').addEventListener('click', agregarFila);
    agregarFila();

    cargarMaterias().catch((error) => {
        mostrarEq(
            'err',
            'No se pudieron cargar las materias',
            error.message || 'Revisa tu conexión e intenta de nuevo.'
        );
    });
})();