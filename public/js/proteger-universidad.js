(() => {
    const TOKEN = 'seda_access_token';
    const ROL = 'seda_rol';

    function cerrarSesion() {
        sessionStorage.removeItem(TOKEN);
        sessionStorage.removeItem(ROL);
        window.location.replace('/index.html');
    }

    const token = sessionStorage.getItem(TOKEN);
    const rol = sessionStorage.getItem(ROL);

    if (!token || rol !== 'UNIVERSIDAD') {
        cerrarSesion();
        return;
    }

    window.SEDAAuthUniversidad = {
        cerrarSesion
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.logout').forEach((boton) => {
            boton.addEventListener('click', cerrarSesion);
        });
    });
})();