(() => {
    const API_EQUIVALENCIAS = '/equivalencias';
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

    function actualizarOpcionesFila(fila) {
        const selectUniversidad = fila.querySelector('.f-universidad-destino');
        const selectCarrera = fila.querySelector('.f-carrera-destino');
        const selectMateria = fila.querySelector('.f-destino');

        llenarSelect(
            fila.querySelector('.f-origen'),
            materiasOrigen,
            materiasOrigen.length
                ? 'Selecciona una materia'
                : 'No hay materias propias con documentos completos',
            (materia) => materia.id_materia,
            (materia) => `${materia.nombre} — ${materia.carrera}`
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
            const control = campo.querySelector('select, input, textarea');
            if (!control) return;

            const id = `fila-campo-${++contadorIds}`;
            control.id = id;
            campo.querySelector('label').htmlFor = id;
        });

        fila.querySelector('.btn-quitar').addEventListener('click', () => {
            fila.remove();
            refrescarBotonesQuitar();
        });

        const selectUniversidad = fila.querySelector('.f-universidad-destino');
        const selectCarrera = fila.querySelector('.f-carrera-destino');
        const selectMateria = fila.querySelector('.f-destino');

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
        refrescarBotonesQuitar();
    }

    function validar() {
        let valido = true;
        const origenesUsados = new Set();

        filas().forEach((fila) => {
            const origen = fila.querySelector('.f-origen').value;
            const universidad = fila.querySelector('.f-universidad-destino').value;
            const carrera = fila.querySelector('.f-carrera-destino').value;
            const destino = fila.querySelector('.f-destino').value;
            const descripcion = fila.querySelector('.f-descripcion').value.trim();
            let mensaje = '';

            if (!origen || !universidad || !carrera || !destino) {
                mensaje = 'Selecciona la materia de origen, universidad, carrera y materia destino.';
            } else if (origen === destino) {
                mensaje = 'La materia cursada y la equivalente no pueden ser la misma.';
            } else if (!descripcion) {
                mensaje = 'Ingresa la descripción de esta equivalencia.';
            } else if (origenesUsados.has(origen)) {
                mensaje = 'Esta materia cursada ya está en otra fila.';
            }

            origenesUsados.add(origen);
            fila.querySelector('.fila-error').textContent = mensaje;

            if (mensaje) valido = false;
        });

        return valido;
    }
    function construirCuerpo(fila) {
        return {
            id_materia_origen: fila.querySelector('.f-origen').value,
            id_materia_destino: fila.querySelector('.f-destino').value,
            descripcion: fila.querySelector('.f-descripcion').value.trim()
        };
    }

    function mensajeError(respuesta, json) {
        if (respuesta.status === 404) {
            return 'No se encontró el servicio de equivalencias en el servidor (POST /equivalencias).';
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

        const lista = filas();
        let guardadas = 0;
        let fallo = false;
        btnGuardar.disabled = true;

        try {
            for (const fila of lista) {
                mostrarEq(
                    'loading',
                    'Guardando…',
                    `Registrando equivalencia (${guardadas + 1} de ${lista.length}).`
                );

                const respuesta = await fetch(API_EQUIVALENCIAS, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(construirCuerpo(fila))
                });

                const json = await respuesta.json().catch(() => null);

                if (respuesta.ok && json?.equivalencia) {
                    guardadas++;
                    fila.remove();
                    continue;
                }

                if (respuesta.status === 401) {
                    cerrarSesionUniversidad();
                    return;
                }

                const mensaje = mensajeError(respuesta, json);
                fila.querySelector('.fila-error').textContent = mensaje;

                const avisoPrevio = guardadas
                    ? ` Se guardaron ${guardadas} de ${lista.length} materias; corrige la fila marcada y vuelve a guardar.`
                    : '';

                mostrarEq('err', 'No se guardó la equivalencia', mensaje + avisoPrevio);
                fallo = true;
                break;
            }

            if (!fallo) {
                reiniciar();
                mostrarEq(
                    'ok',
                    'Equivalencia registrada',
                    'El caso quedó pendiente de revisión del MINED.'
                );
            } else {
                refrescarBotonesQuitar();
            }
        } catch (error) {
            mostrarEq(
                'err',
                'No se pudieron cargar o guardar las materias',
                error.message || 'Revisa tu conexión e intenta de nuevo.'
            );
        } finally {
            btnGuardar.disabled = false;
        }
    });

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