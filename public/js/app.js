// =========================================================
// Registro de universidad -> POST /universidades
// =========================================================

const form = document.getElementById('form-registro');
const btn = document.getElementById('btn-registrar');
const cajaGeneral = document.getElementById('error-general');
const tituloGeneral = document.getElementById('error-general-titulo');
const listaGeneral = document.getElementById('error-general-lista');
const cajaDuplicado = document.getElementById('error-duplicado');
const tarjetaFormulario = document.getElementById('tarjeta-formulario');
const confirmacion = document.getElementById('confirmacion');

const pass = document.getElementById('contrasena');
const pass2 = document.getElementById('contrasena2');
const correoContacto = document.getElementById('correo_contacto');
const correoAcceso = document.getElementById('correo');
const mismoCorreo = document.getElementById('mismo-correo');

const CAMPOS_BACKEND = {
  nombre: ['nombre'],
  ubicacion: ['departamento', 'direccion'],
  correo_contacto: ['correo_contacto'],
  telefono_contacto: ['telefono_contacto'],
  correo: ['correo'],
  contrasena: ['contrasena'],
};

const ETIQUETAS = {
  nombre: 'Nombre de la universidad',
  ubicacion: 'Departamento y dirección',
  correo_contacto: 'Correo de contacto',
  telefono_contacto: 'Teléfono de contacto',
  correo: 'Correo de acceso',
  contrasena: 'Contraseña',
};

// ---------- Utilidades de mensajes ----------
function limpiarMensajes() {
  cajaGeneral.hidden = true;
  cajaDuplicado.hidden = true;
  listaGeneral.innerHTML = '';
  form.querySelectorAll('.campo--invalido').forEach((c) => c.classList.remove('campo--invalido'));
}

function mostrarError(titulo, items = []) {
  tituloGeneral.textContent = titulo;
  listaGeneral.innerHTML = '';
  items.forEach((texto) => {
    const li = document.createElement('li');
    li.textContent = texto;
    listaGeneral.appendChild(li);
  });
  cajaGeneral.hidden = false;
  cajaGeneral.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function marcarCampoInvalido(idInput) {
  const input = document.getElementById(idInput);
  if (input) input.closest('.campo').classList.add('campo--invalido');
}

// Quita la marca roja cuando el usuario corrige el campo
form.addEventListener('input', (e) => {
  const campo = e.target.closest('.campo');
  if (campo) campo.classList.remove('campo--invalido');
});

// ---------- Validaciones extra ----------
function validarCoincidencia() {
  pass2.setCustomValidity(pass.value !== pass2.value ? 'Las contraseñas no coinciden' : '');
}
pass.addEventListener('input', validarCoincidencia);
pass2.addEventListener('input', validarCoincidencia);

// "Usar el mismo correo de contacto"
function sincronizarCorreo() {
  if (mismoCorreo.checked) correoAcceso.value = correoContacto.value;
}
mismoCorreo.addEventListener('change', () => {
  correoAcceso.disabled = mismoCorreo.checked;
  sincronizarCorreo();
});
correoContacto.addEventListener('input', sincronizarCorreo);

// ---------- Envío ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarMensajes();
  validarCoincidencia();

  // 1) Validación en cliente: marca cada campo inválido con su mensaje
  if (!form.checkValidity()) {
    const invalidos = [...form.elements].filter((el) => el.willValidate && !el.validity.valid);
    invalidos.forEach((el) => el.closest('.campo')?.classList.add('campo--invalido'));
    mostrarError('Revisa los campos marcados en rojo antes de continuar.');
    invalidos[0].focus();
    return;
  }

  // 2) Armar el body exactamente como lo espera el backend
  const val = (id) => document.getElementById(id).value.trim();
  const payload = {
    nombre: val('nombre'),
    ubicacion: `${val('direccion')}, ${val('departamento')}`,
    correo_contacto: val('correo_contacto'),
    telefono_contacto: val('telefono_contacto'),
    correo: val('correo'),
    contrasena: pass.value,
  };

  btn.disabled = true;
  btn.textContent = 'Registrando...';

  try {
    const res = await fetch('/universidades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    // Éxito
    if (res.status === 201) {
      form.reset();
      correoAcceso.disabled = false;
      tarjetaFormulario.hidden = true;
      confirmacion.hidden = false;
      document.getElementById('confirmacion-texto').textContent =
        `${data.universidad?.nombre || 'La universidad'} fue registrada correctamente.`;
      confirmacion.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Duplicado 
    if (res.status === 409) {
      marcarCampoInvalido('nombre');
      cajaDuplicado.hidden = false;
      cajaDuplicado.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Campos faltantes o inválidos 
    if (res.status === 400 && Array.isArray(data.campos)) {
      data.campos.forEach((c) => (CAMPOS_BACKEND[c] || []).forEach(marcarCampoInvalido));
      mostrarError(
        'No se pudo completar el registro, revisa los siguientes campos:',
        data.campos.map((c) => ETIQUETAS[c] || c)
      );
      return;
    }

    // 400 de Supabase Auth (correo ya registrado, contraseña débil, etc.)
    if (res.status === 400) {
      marcarCampoInvalido('correo');
      mostrarError('No se pudo crear la cuenta de acceso:', [data.error || 'Datos no válidos.']);
      return;
    }

    // 500 u otros
    mostrarError('Ocurrió un error en el servidor. Intenta de nuevo.', data.error ? [data.error] : []);
  } catch (err) {
    mostrarError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registrar';
  }
});