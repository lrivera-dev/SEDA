
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Cargamos el componente real de la HU-3.
const codigo = fs.readFileSync(
    path.join(__dirname, "../../public/js/estado-calculo.js"),
    "utf8"
);

// DOM simulado para probar sin abrir un navegador.
class ElementoSimulado {
    constructor(etiqueta) {
        this.etiqueta = etiqueta;
        this.className = "";
        this.textContent = "";
        this.children = [];
        this.atributos = {};
        this.eventos = {};
        this.disabled = false;
    }

    append(...elementos) {
        this.children.push(...elementos);
    }

    appendChild(elemento) {
        this.children.push(elemento);
        return elemento;
    }

    replaceChildren(...elementos) {
        this.children = elementos;
    }

    setAttribute(nombre, valor) {
        this.atributos[nombre] = valor;
    }

    addEventListener(nombre, funcion) {
        this.eventos[nombre] = funcion;
    }

    querySelectorAll(selector) {
        const encontrados = [];

        const coincide = (elemento) => {
            if (selector.startsWith(".")) {
                return elemento.className
                    .split(/\s+/)
                    .includes(selector.slice(1));
            }

            return elemento.etiqueta === selector;
        };

        const recorrer = (elemento) => {
            for (const hijo of elemento.children) {
                if (coincide(hijo)) encontrados.push(hijo);
                recorrer(hijo);
            }
        };

        recorrer(this);
        return encontrados;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    async click() {
        if (this.eventos.click) {
            await this.eventos.click();
        }
    }
}

function prepararCaso(caso, opciones = {}) {
    const ventana = { location: { href: "" } };
    const almacenamiento = new Map();
    if (opciones.tokenUniversidad !== "") {
        almacenamiento.set(
            "seda_access_token",
            opciones.tokenUniversidad || "token-universidad-prueba"
        );
    }
    const sessionStorage = {
        getItem: clave => almacenamiento.get(clave) ?? null,
        removeItem: clave => almacenamiento.delete(clave)
    };

    const documento = {
        createElement: (etiqueta) =>
            new ElementoSimulado(etiqueta)
    };

    // Ejecutamos el JS real con un DOM aislado.
    vm.runInNewContext(codigo, {
        window: ventana,
        document: documento,
        sessionStorage,
        fetch: opciones.fetch || (async () => {
            throw new Error("Solicitud no simulada");
        }),
        console
    });

    const contenedor = new ElementoSimulado("div");
    contenedor.ventana = ventana;

    ventana.SEDAEstadoCalculo.renderizar(contenedor, caso);

    return contenedor;
}

function caso(estado, porcentaje = null, extras = {}) {
    return {
        id_caso: "caso-prueba",
        estado_calculo: estado,
        porcentaje_coincidencia: porcentaje,
        reporte: null,
        motivo: null,
        ...extras
    };
}

// PRUEBA 1
test("SIN_CALCULAR no muestra porcentaje", () => {
    const vista = prepararCaso(caso("SIN_CALCULAR"));

    assert.equal(
        vista.querySelector(".hu3-estado").textContent,
        "Sin calcular"
    );

    assert.equal(vista.querySelector(".hu3-barra"), null);
});

// PRUEBA 2
test("EN_CALCULO muestra mensaje de evaluación", () => {
    const vista = prepararCaso(caso("EN_CALCULO"));

    assert.equal(
        vista.querySelector(".hu3-estado").textContent,
        "En evaluación"
    );

    assert.ok(vista.querySelector(".hu3-mensaje"));
});

// PRUEBA 3
test("0% y 100% son porcentajes válidos", () => {
    for (const porcentaje of [0, 100]) {
        const vista = prepararCaso(
            caso("CALCULADO", porcentaje)
        );

        assert.equal(
            vista.querySelector(".hu3-barra").value,
            porcentaje
        );
    }
});

// PRUEBA 4
test("59% muestra advertencia y 60% no", () => {
    const bajo = prepararCaso(caso("CALCULADO", 59));
    const limite = prepararCaso(caso("CALCULADO", 60));

    assert.ok(bajo.querySelector(".hu3-advertencia"));
    assert.equal(
        limite.querySelector(".hu3-advertencia"),
        null
    );
});

// PRUEBA 5
test("Rechaza un porcentaje fuera de rango", () => {
    const vista = prepararCaso(caso("CALCULADO", 105));

    assert.ok(vista.querySelector(".hu3-error"));
    assert.equal(vista.querySelector(".hu3-barra"), null);
});

// PRUEBA 6
test("Reporte muestra seis secciones y texto seguro", () => {
    const textoIA = "<img src=x onerror=alert(1)>";

    const vista = prepararCaso(
        caso("CALCULADO", 85, {
            reporte: {
                resumen: textoIA,
                contenidos_coincidentes: "Coincidencias",
                metodologia: "Metodología",
                diferencias: "Diferencias",
                contexto_pensum: "Contexto",
                conclusion: "Conclusión"
            }
        })
    );

    assert.equal(
        vista.querySelectorAll(".hu3-seccion").length,
        6
    );

    assert.equal(
        vista.querySelector(".hu3-texto-ia").textContent,
        textoIA
    );

    // El texto de la IA nunca se convirtió en HTML.
    assert.equal(vista.querySelector("img"), null);
});

// PRUEBA 7
test("ERROR muestra motivo y botón Reintentar", () => {
    const vista = prepararCaso(
        caso("ERROR", null, {
            motivo: "Servicio de IA no disponible"
        })
    );

    assert.match(
        vista.querySelector(".hu3-error").textContent,
        /Servicio de IA no disponible/
    );

    assert.ok(vista.querySelector(".hu3-btn-reintentar"));
});

// PRUEBA 8
test("Reintentar envía POST y cambia a EN_CALCULO", async () => {
    let solicitud;

    const fetchSimulado = async (url, opciones) => {
        solicitud = { url, opciones };

        return {
            ok: true,
            status: 202,
            json: async () => ({
                mensaje: "Caso puesto en evaluación"
            })
        };
    };

    const vista = prepararCaso(
        caso("ERROR", null, {
            id_caso: "caso-123",
            motivo: "Error de IA"
        }),
        {
            fetch: fetchSimulado,
        }
    );

    await vista.querySelector(".hu3-btn-reintentar").click();

    assert.equal(
        solicitud.url,
        "/coincidencia/caso-123/reintentar"
    );

    assert.equal(solicitud.opciones.method, "POST");

    assert.equal(solicitud.opciones.headers.Authorization, "Bearer token-universidad-prueba");
    assert.equal(solicitud.opciones.body, undefined);

    assert.equal(
        vista.querySelector(".hu3-estado").textContent,
        "En evaluación"
    );

    assert.equal(
        vista.querySelector(".hu3-btn-reintentar"),
        null
    );
});

// PRUEBA 9
test("Un error del servidor mantiene Reintentar", async () => {
    const fetchSimulado = async () => ({
        ok: false,
        status: 429,
        json: async () => ({
            error: "Demasiados intentos, intenta de nuevo en un minuto"
        })
    });

    const vista = prepararCaso(
        caso("ERROR", null, {
            motivo: "Error de IA"
        }),
        { fetch: fetchSimulado }
    );

    await vista.querySelector(".hu3-btn-reintentar").click();

    assert.match(
        vista.querySelector(".hu3-error").textContent,
        /Demasiados intentos/
    );

    assert.equal(
        vista.querySelector(".hu3-btn-reintentar").disabled,
        false
    );
});

// PRUEBA 10
test("Sin token de sesión redirige al login y no envía el reintento", async () => {
    let llamadas = 0;

    const vista = prepararCaso(
        caso("ERROR", null, {
            motivo: "Error de IA"
        }),
        {
            tokenUniversidad: "",
            fetch: async () => {
                llamadas++;
            }
        }
    );

    await vista.querySelector(".hu3-btn-reintentar").click();

    assert.equal(llamadas, 0);

    assert.equal(vista.ventana.location.href, "/index.html");
});


test("SIN_CALCULAR muestra Reintentar sin error ficticio", () => {
    const vista = prepararCaso(caso("SIN_CALCULAR"));

    assert.ok(
        vista.querySelector(".hu3-btn-reintentar")
    );

    assert.equal(
        vista.querySelector(".hu3-error"),
        null
    );
});

test("SIN_CALCULAR permite reintentar y cambia a EN_CALCULO", async () => {
    let llamadas = 0;

    const vista = prepararCaso(
        caso("SIN_CALCULAR"),
        {
            fetch: async (url, opciones) => {
                llamadas++;

                assert.equal(
                    url,
                    "/coincidencia/caso-prueba/reintentar"
                );

                assert.equal(opciones.method, "POST");

                return {
                    ok: true,
                    status: 202,
                    json: async () => ({})
                };
            }
        }
    );

    await vista.querySelector(".hu3-btn-reintentar").click();

    assert.equal(llamadas, 1);

    assert.equal(
        vista.querySelector(".hu3-estado").textContent,
        "En evaluación"
    );

    assert.equal(
        vista.querySelector(".hu3-btn-reintentar"),
        null
    );
});
