const form = document.getElementById('loginForm');
const errorElement = document.getElementById('loginError');
const button = document.getElementById('loginButton');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorElement.hidden = true;
    errorElement.textContent = '';

    const perfil = document.querySelector('input[name="perfil"]:checked');

    if (!perfil || perfil.value !== 'ministerio') {
        errorElement.textContent =
            'El inicio de sesión para universidades todavía no está disponible.';
        errorElement.hidden = false;
        return;
    }

    const correo = document.getElementById('email').value.trim();
    const contrasena = document.getElementById('password').value;

    button.disabled = true;
    button.textContent = 'Ingresando...';

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ correo, contrasena })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            errorElement.textContent =
                data.error || 'No se pudo iniciar sesión. Intenta de nuevo.';
            errorElement.hidden = false;
            return;
        }

        if (!data.access_token) {
            throw new Error('El servidor no devolvió el token de acceso.');
        }

        sessionStorage.setItem('seda_access_token', data.access_token);
        window.location.href = '/mined.html';
    } catch (error) {
        errorElement.textContent =
            'No se pudo conectar con el servidor. Intenta de nuevo.';
        errorElement.hidden = false;
    } finally {
        button.disabled = false;
        button.textContent = 'Ingresar →';
    }
});