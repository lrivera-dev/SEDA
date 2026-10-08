const form = document.getElementById("loginForm");

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const perfil = document.querySelector(
        'input[name="perfil"]:checked'
    );

    if (perfil.value === "universidad") {
        window.location.href = "universidades.html";
    }

    if (perfil.value === "ministerio") {
        window.location.href = "mined.html";
    }
});