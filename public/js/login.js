const form = document.getElementById('loginForm');
const errorElement = document.getElementById('loginError');
const button = document.getElementById('loginButton');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorElement.hidden = true;
    errorElement.textContent = '';

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

        if (!data.access_token || !['MINED', 'UNIVERSIDAD'].includes(data.rol)) {
            throw new Error('El servidor no devolvió una sesión válida.');
        }

        sessionStorage.setItem('seda_access_token', data.access_token);
        sessionStorage.setItem('seda_rol', data.rol);

        window.location.href =
            data.rol === 'UNIVERSIDAD'
                ? '/universidades.html'
                : '/mined.html';
    } catch (error) {
        errorElement.textContent =
            'No se pudo conectar con el servidor. Intenta de nuevo.';
        errorElement.hidden = false;
    } finally {
        button.disabled = false;
        button.textContent = 'Ingresar →';
    }
});