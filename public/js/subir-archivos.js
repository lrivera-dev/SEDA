/*---Inicio de equivalencia Manual---*/
(() => {
    const API_EQUIVALENCIAS = '/equivalencias';
    const ICONOS = { loading: '<span class="spin" aria-hidden="true"></span>', ok: '✓', warn: '!', err: '✕' };

    const $ = (id) => document.getElementById(id);
    const formEq = $('form-equivalencia');
    const contFilas = $('eq-filas');
    const btnGuardar = $('btn-guardar-eq');
    const errorEq = $('error-equivalencia');
    const statusEq = $('status-equivalencia');
    let contadorIds = 0;

    // ---------- Utilidades ----------
    function mostrarEq(estado, titulo, mensaje) {
        statusEq.className = 'status show ' + estado;
        statusEq.innerHTML = `<span class="ico">${ICONOS[estado]}</span><div><b></b><p></p></div>`;
        statusEq.querySelector('b').textContent = titulo;
        statusEq.querySelector('p').textContent = mensaje;
    }

    // El backend compara ids con ===: solo dígitos -> número; otro texto (uuid) -> texto.
    const idValor = (v) => (/^\d+$/.test(v) ? Number(v) : v);

    // TODO(login): devolver el id de la universidad autenticada.
    // Mientras tanto: en la consola del navegador -> localStorage.setItem('id_universidad', '...')
    function obtenerIdUniversidad() {
        try { return localStorage.getItem('id_universidad'); } catch { return null; }
    }

    // ---------- Filas de materias ----------
    const filas = () => [...contFilas.querySelectorAll('.fila')];

    function refrescarBotonesQuitar() {
        const lista = filas();
        lista.forEach((f) => (f.querySelector('.btn-quitar').hidden = lista.length === 1));
    }

    function agregarFila() {
        const fila = $('tpl-fila').content.firstElementChild.cloneNode(true);
        fila.querySelectorAll('.field').forEach((campo) => {
            const id = `fila-campo-${++contadorIds}`;
            campo.querySelector('input, textarea').id = id;
            campo.querySelector('label').htmlFor = id;
        });
        fila.querySelector('.btn-quitar').addEventListener('click', () => {
            fila.remove();
            refrescarBotonesQuitar();
        });
        contFilas.append(fila);
        refrescarBotonesQuitar();
    }

    // ---------- Validación ----------
    function validar() {
        let ok = true;

        const usadas = new Set();
        filas().forEach((f) => {
            const o = f.querySelector('.f-origen').value.trim();
            const d = f.querySelector('.f-destino').value.trim();
            const desc = f.querySelector('.f-descripcion').value.trim();
            let msg = '';
            if (!o || !d) msg = 'Complete los dos IDs de materia.';
            else if (o === d) msg = 'La materia cursada y la equivalente no pueden ser la misma.';
            else if (!desc) msg = 'Ingrese la descripción de esta equivalencia.';
            else if (usadas.has(o)) msg = 'Esta materia cursada ya está en otra fila.';
            usadas.add(o);
            f.querySelector('.fila-error').textContent = msg;
            if (msg) ok = false;
        });
        return ok;
    }

    // ---------- Envío ----------
    // Un POST por materia: el endpoint actual recibe un solo par de materias.
    function construirCuerpo(fila, idUniversidad) {
        return {
            id_materia_origen: idValor(fila.querySelector('.f-origen').value.trim()),
            id_materia_destino: idValor(fila.querySelector('.f-destino').value.trim()),
            descripcion: fila.querySelector('.f-descripcion').value.trim(),
            id_universidad: idValor(idUniversidad)
        };
    }

    function mensajeError(resp, json) {
        if (resp.status === 404) return 'No se encontró el servicio de equivalencias en el servidor (POST /equivalencias).';
        if (Array.isArray(json?.archivos_faltantes)) return `Faltan archivos por cargar: ${json.archivos_faltantes.join(', ')}.`;
        if (Array.isArray(json?.campos)) return `Campos faltantes o inválidos: ${json.campos.join(', ')}.`;
        return json?.error || 'Ocurrió un error en el servidor. Intente de nuevo.';
    }

    function reiniciar() {
        formEq.reset();
        contFilas.replaceChildren();
        agregarFila();
    }

    formEq.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEq.textContent = '';
        statusEq.className = 'status';

        if (!validar()) {
            errorEq.textContent = 'Revise los campos marcados antes de guardar.';
            return;
        }
        const idUniversidad = obtenerIdUniversidad();
        if (!idUniversidad) {
            return mostrarEq('err', 'Sin sesión de universidad', 'No se encontró la universidad que inició sesión. Inicie sesión de nuevo.');
        }

        const lista = filas();
        let guardadas = 0;
        let fallo = false;
        btnGuardar.disabled = true;

        try {
            for (const fila of lista) {
                mostrarEq('loading', 'Guardando…', `Registrando equivalencia (${guardadas + 1} de ${lista.length}).`);
                const resp = await fetch(API_EQUIVALENCIAS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(construirCuerpo(fila, idUniversidad))
                });
                const json = await resp.json().catch(() => null);

                if (resp.ok && json?.equivalencia) {
                    guardadas++;
                    fila.remove(); // ya guardada: un reintento no la duplica
                    continue;
                }
                const msg = mensajeError(resp, json);
                fila.querySelector('.fila-error').textContent = msg;
                const previo = guardadas ? ` Se guardaron ${guardadas} de ${lista.length} materias; corrija la fila marcada y guarde de nuevo.` : '';
                mostrarEq('err', 'No se guardó la equivalencia', msg + previo);
                fallo = true;
                break;
            }

            if (!fallo) {
                reiniciar();
                mostrarEq('ok', 'Equivalencia registrada', 'El caso quedó pendiente de revisión del MINED.');
            } else {
                refrescarBotonesQuitar();
            }
        } catch {
            mostrarEq('err', 'Sin conexión', 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.');
        }
        btnGuardar.disabled = false;
    });

    $('btn-agregar-fila').addEventListener('click', agregarFila);
    agregarFila();
})();
/*-- Fin equivalencia manual-- */