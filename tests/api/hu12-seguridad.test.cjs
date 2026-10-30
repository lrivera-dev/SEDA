"use strict";

const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// Instalar el entorno simulado antes de importar SEDA.
const e = require("../helpers/entorno.cjs");
const request = require("supertest");

const app = e.cargarApp();

// Identificadores ficticios exclusivos para las pruebas.
const UNIVERSIDAD_UCA = "11111111-1111-4111-8111-111111111111";
const UNIVERSIDAD_UDB = "22222222-2222-4222-8222-222222222222";

const TOKEN = "token-ficticio-hu12";

describe("HU-12: seguridad y aislamiento universitario", { concurrency: false }, () => {

    beforeEach(() => {
        e.preparar();
    });

    afterEach(() => {
        e.verificarConsumo();

        assert.deepEqual(
            e.seguridad.bloqueos,
            [],
            "No deben existir conexiones externas ni lecturas de .env"
        );
    });
    
    test("HU12-01: rechaza acceso a pensum sin autenticacion", async () => {
        const respuesta = await request(app)
            .get(`/archivos/pensum/${UNIVERSIDAD_UCA}/enlace`)
            .expect("Content-Type", /json/);

        assert.equal(respuesta.status, 401);

        assert.deepEqual(respuesta.body, {
            error: "No autorizado."
        });

        assert.equal(
            e.llamadas.length,
            0,
            "No deben realizarse operaciones en Supabase"
        );
    });
    
    test("HU12-02: rechaza token invalido al solicitar un pensum", async () => {
        // Simulamos un token rechazado por Supabase Auth.
        e.preparar([
            {
                operacion: "getUser",
                verificar: (args) => {
                    assert.equal(args.token, TOKEN);
                },
                resultado: {
                    data: { user: null },
                    error: { message: "Token ficticio invalido" }
                }
            }
        ]);

        const respuesta = await request(app)
            .get(`/archivos/pensum/${UNIVERSIDAD_UCA}/enlace`)
            .set("Authorization", `Bearer ${TOKEN}`)
            .expect("Content-Type", /json/);

        assert.equal(respuesta.status, 401);

        assert.deepEqual(respuesta.body, {
            error: "No autorizado."
        });

        assert.equal(
            e.llamadas.length,
            1,
            "Solo debe consultarse la autenticacion simulada"
        );
    });
    
    test("HU12-03: rechaza acceso a pensum de otra universidad", async () => {
        const ID_CARRERA_UDB = "33333333-3333-4333-8333-333333333333";

        e.preparar([
            {
                operacion: "getUser",
                verificar: (args) => {
                    assert.equal(args.token, TOKEN);
                },
                resultado: {
                    data: { user: { id: "usuario-uca-qa" } },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: (args) => {
                    assert.equal(args.tabla, "usuario");
                    assert.deepEqual(args.eq, [
                        ["id_usuario", "usuario-uca-qa"]
                    ]);
                },
                resultado: {
                    data: {
                        id_usuario: "usuario-uca-qa",
                        correo: "uca@example.test",
                        rol: "UNIVERSIDAD",
                        estado: "ACTIVO"
                    },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: (args) => {
                    assert.equal(args.tabla, "universidad");
                    assert.deepEqual(args.eq, [
                        ["id_usuario", "usuario-uca-qa"]
                    ]);
                },
                resultado: {
                    data: {
                        id_universidad: UNIVERSIDAD_UCA,
                        estado: "ACTIVA"
                    },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: (args) => {
                    assert.equal(args.tabla, "carrera");
                    assert.deepEqual(args.eq, [
                        ["id_carrera", ID_CARRERA_UDB],
                        ["id_universidad", UNIVERSIDAD_UCA]
                    ]);
                },
                resultado: {
                    data: null,
                    error: null
                }
            }
        ]);

        const respuesta = await request(app)
            .get(`/archivos/pensum/${ID_CARRERA_UDB}/enlace`)
            .set("Authorization", `Bearer ${TOKEN}`)
            .expect("Content-Type", /json/);

        assert.equal(respuesta.status, 404);

        assert.deepEqual(respuesta.body, {
            error: "No se encontró el documento solicitado."
        });

        assert.equal(
            e.llamadas.length,
            4,
            "No debe generarse un enlace firmado para documentos ajenos"
        );
    });
    
    // ============================================================
    // Helpers: autenticacion universitaria simulada
    // ============================================================

    const ID_CARRERA_UCA = "44444444-4444-4444-8444-444444444444";
    const ID_CARRERA_UDB = "33333333-3333-4333-8333-333333333333";
    const ID_MATERIA_UCA = "55555555-5555-4555-8555-555555555555";
    const ID_MATERIA_UDB = "66666666-6666-4666-8666-666666666666";

    const RUTA_PENSUM_UCA = `${ID_CARRERA_UCA}/pensum/prueba.pdf`;
    const RUTA_PROGRAMA_UCA =
        `${ID_CARRERA_UCA}/materias/${ID_MATERIA_UCA}/prueba.pdf`;

    const URL_FICTICIA = "https://supabase.invalid/documento-ficticio";

    function sesionUniversidad(idUniversidad = UNIVERSIDAD_UCA) {
        return [
            {
                operacion: "getUser",
                verificar: args => assert.equal(args.token, TOKEN),
                resultado: {
                    data: { user: { id: "usuario-uca-qa" } },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "usuario");
                    assert.deepEqual(args.eq, [
                        ["id_usuario", "usuario-uca-qa"]
                    ]);
                },
                resultado: {
                    data: {
                        id_usuario: "usuario-uca-qa",
                        correo: "uca@example.test",
                        rol: "UNIVERSIDAD",
                        estado: "ACTIVO"
                    },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "universidad");
                    assert.deepEqual(args.eq, [
                        ["id_usuario", "usuario-uca-qa"]
                    ]);
                },
                resultado: {
                    data: {
                        id_universidad: idUniversidad,
                        estado: "ACTIVA"
                    },
                    error: null
                }
            }
        ];
    }

    function enlaceFirmado(ruta) {
        return {
            operacion: "createSignedUrl",
            verificar: args => {
                assert.equal(args.bucket, "documentos-carreras");
                assert.deepEqual(args.datos, [ruta, 3600]);
            },
            resultado: {
                data: { signedUrl: URL_FICTICIA },
                error: null
            }
        };
    }

    // ============================================================
    // HU12-04: Programa academico de otra universidad
    // ============================================================

    test("HU12-04: rechaza programa de otra universidad", async () => {
        e.preparar([
            ...sesionUniversidad(),
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "materia");
                    assert.deepEqual(args.eq, [
                        ["id_materia", ID_MATERIA_UDB]
                    ]);
                },
                resultado: {
                    data: {
                        id_carrera: ID_CARRERA_UDB,
                        programa_url: "udb/programa.pdf"
                    },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "carrera");
                    assert.deepEqual(args.eq, [
                        ["id_carrera", ID_CARRERA_UDB],
                        ["id_universidad", UNIVERSIDAD_UCA]
                    ]);
                },
                resultado: { data: null, error: null }
            }
        ]);

        const respuesta = await request(app)
            .get(`/archivos/programa/${ID_MATERIA_UDB}/enlace`)
            .set("Authorization", `Bearer ${TOKEN}`);

        assert.equal(respuesta.status, 404);
        assert.deepEqual(respuesta.body, {
            error: "No se encontró el documento solicitado."
        });

        assert.equal(e.llamadas.length, 5);
        assert.ok(
            !e.llamadas.some(x => x.operacion === "createSignedUrl")
        );
    });

    // ============================================================
    // HU12-05: Acceso a pensum propio
    // ============================================================

    test("HU12-05: permite consultar pensum propio", async () => {
        e.preparar([
            ...sesionUniversidad(),
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "carrera");
                    assert.deepEqual(args.eq, [
                        ["id_carrera", ID_CARRERA_UCA],
                        ["id_universidad", UNIVERSIDAD_UCA]
                    ]);
                },
                resultado: {
                    data: { pensum_url: RUTA_PENSUM_UCA },
                    error: null
                }
            },
            enlaceFirmado(RUTA_PENSUM_UCA)
        ]);

        const respuesta = await request(app)
            .get(`/archivos/pensum/${ID_CARRERA_UCA}/enlace`)
            .set("Authorization", `Bearer ${TOKEN}`);

        assert.equal(respuesta.status, 200);
        assert.deepEqual(respuesta.body, {
            url: URL_FICTICIA
        });

        assert.equal(e.llamadas.length, 5);
    });

    // ============================================================
    // HU12-06: Acceso a programa propio
    // ============================================================

    test("HU12-06: permite consultar programa propio", async () => {
        e.preparar([
            ...sesionUniversidad(),
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "materia");
                    assert.deepEqual(args.eq, [
                        ["id_materia", ID_MATERIA_UCA]
                    ]);
                },
                resultado: {
                    data: {
                        id_carrera: ID_CARRERA_UCA,
                        programa_url: RUTA_PROGRAMA_UCA
                    },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "carrera");
                    assert.deepEqual(args.eq, [
                        ["id_carrera", ID_CARRERA_UCA],
                        ["id_universidad", UNIVERSIDAD_UCA]
                    ]);
                },
                resultado: {
                    data: { id_carrera: ID_CARRERA_UCA },
                    error: null
                }
            },
            enlaceFirmado(RUTA_PROGRAMA_UCA)
        ]);

        const respuesta = await request(app)
            .get(`/archivos/programa/${ID_MATERIA_UCA}/enlace`)
            .set("Authorization", `Bearer ${TOKEN}`);

        assert.equal(respuesta.status, 200);
        assert.deepEqual(respuesta.body, {
            url: URL_FICTICIA
        });

        assert.equal(e.llamadas.length, 6);
    });

    // ============================================================
    // HU12-07: Usuario inactivo o rol incorrecto
    // ============================================================

    for (const [caso, rol, estado] of [
        ["usuario inactivo", "UNIVERSIDAD", "INACTIVO"],
        ["rol incorrecto", "MINED", "ACTIVO"]
    ]) {
        test(`HU12-07: rechaza ${caso}`, async () => {
            e.preparar([
                {
                    operacion: "getUser",
                    resultado: {
                        data: { user: { id: "usuario-qa" } },
                        error: null
                    }
                },
                {
                    operacion: "consulta",
                    verificar: args => {
                        assert.equal(args.tabla, "usuario");
                    },
                    resultado: {
                        data: {
                            id_usuario: "usuario-qa",
                            correo: "qa@example.test",
                            rol,
                            estado
                        },
                        error: null
                    }
                }
            ]);

            const respuesta = await request(app)
                .get(`/archivos/pensum/${ID_CARRERA_UCA}/enlace`)
                .set("Authorization", `Bearer ${TOKEN}`);

            assert.equal(respuesta.status, 401);
            assert.deepEqual(respuesta.body, {
                error: "No autorizado."
            });

            assert.equal(e.llamadas.length, 2);
        });
    }
    
    test("HU12-07: rechaza usuario sin universidad asociada", async () => {
        e.preparar([
            {
                operacion: "getUser",
                resultado: {
                    data: { user: { id: "usuario-qa" } },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "usuario");
                },
                resultado: {
                    data: {
                        id_usuario: "usuario-qa",
                        correo: "qa@example.test",
                        rol: "UNIVERSIDAD",
                        estado: "ACTIVO"
                    },
                    error: null
                }
            },
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "universidad");
                    assert.deepEqual(args.eq, [
                        ["id_usuario", "usuario-qa"]
                    ]);
                },
                resultado: {
                    data: null,
                    error: null
                }
            }
        ]);

        const respuesta = await request(app)
            .get(`/archivos/pensum/${ID_CARRERA_UCA}/enlace`)
            .set("Authorization", `Bearer ${TOKEN}`);

        assert.equal(respuesta.status, 401);
        assert.deepEqual(respuesta.body, {
            error: "No autorizado."
        });

        // No debe consultar carreras ni generar enlaces.
        assert.equal(e.llamadas.length, 3);
    });

    // ============================================================
    // HU12-08: Documento inexistente
    // ============================================================

    test("HU12-08: rechaza documento inexistente sin generar enlace", async () => {
        const ID_INEXISTENTE = "77777777-7777-4777-8777-777777777777";

        e.preparar([
            ...sesionUniversidad(),
            {
                operacion: "consulta",
                verificar: args => {
                    assert.equal(args.tabla, "carrera");
                    assert.deepEqual(args.eq, [
                        ["id_carrera", ID_INEXISTENTE],
                        ["id_universidad", UNIVERSIDAD_UCA]
                    ]);
                },
                resultado: {
                    data: null,
                    error: null
                }
            }
        ]);

        const respuesta = await request(app)
            .get(`/archivos/pensum/${ID_INEXISTENTE}/enlace`)
            .set("Authorization", `Bearer ${TOKEN}`);

        assert.equal(respuesta.status, 404);
        assert.deepEqual(respuesta.body, {
            error: "No se encontró el documento solicitado."
        });

        assert.equal(e.llamadas.length, 4);
        assert.ok(
            !e.llamadas.some(x => x.operacion === "createSignedUrl")
        );
    });
});
