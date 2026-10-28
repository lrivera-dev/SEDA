
"use strict";

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// Reutilizamos los mocks y helpers existentes de Hachi.
const entorno = require("../helpers/entorno.cjs");
const request = require("supertest");
const app = entorno.cargarApp();

// Identificadores completamente ficticios.
const TOKEN = "token-ficticio-hu5";
const ID_USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_UNIVERSIDAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const CASO_1 = "11111111-1111-4111-8111-111111111111";
const CASO_2 = "22222222-2222-4222-8222-222222222222";

// Simula la autenticación de una universidad activa.
function sesionUniversidad() {
    return [
        {
            operacion: "getUser",
            verificar: args => {
                assert.equal(args.token, TOKEN);
            },
            resultado: {
                data: { user: { id: ID_USUARIO } },
                error: null
            }
        },
        {
            operacion: "consulta",
            verificar: args => {
                assert.equal(args.tabla, "usuario");
                assert.deepEqual(args.eq, [
                    ["id_usuario", ID_USUARIO]
                ]);
            },
            resultado: {
                data: {
                    id_usuario: ID_USUARIO,
                    correo: "universidad@example.test",
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
                    ["id_usuario", ID_USUARIO]
                ]);
            },
            resultado: {
                data: {
                    id_universidad: ID_UNIVERSIDAD,
                    estado: "ACTIVA"
                },
                error: null
            }
        }
    ];
}

// Se limpia el entorno antes y después de cada prueba.
beforeEach(() => entorno.preparar());
afterEach(() => entorno.verificarConsumo());

// ============================================================
// HU5-01: CONFIRMACIÓN EXITOSA
// CA1, RN1, RN5 y RN6
// ============================================================

test("HU5-01 CA1: confirma dos equivalencias y registra la operación", async () => {
    const fecha = "2026-10-28T10:00:00.000Z";

    entorno.preparar([
        ...sesionUniversidad(),
        {
            operacion: "rpc",
            verificar: args => {
                assert.equal(
                    args.nombre,
                    "confirmar_equivalencias"
                );

                assert.deepEqual(args.parametros, {
                    p_id_universidad: ID_UNIVERSIDAD,
                    p_id_usuario: ID_USUARIO,
                    p_ids_caso: [CASO_1, CASO_2]
                });
            },
            resultado: {
                data: fecha,
                error: null
            }
        }
    ]);

    const respuesta = await request(app)
        .post("/checklist/confirmar")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
            ids_caso: [CASO_1, CASO_2]
        })
        .expect(200);

    assert.deepEqual(respuesta.body, {
        mensaje: "Equivalencias confirmadas y registradas exitosamente",
        confirmadas: 2,
        fecha_confirmacion: fecha,
        ids_caso: [CASO_1, CASO_2]
    });

    // Dos casos deben procesarse mediante una sola operación RPC.
    const llamadasRPC = entorno.llamadas.filter(
        llamada => llamada.operacion === "rpc"
    );

    assert.equal(llamadasRPC.length, 1);
});

 // ============================================================
 // HU5-02: SELECCIÓN VACÍA
 // CA2 y E1
 // ============================================================

 test("HU5-02 CA2: rechaza selección vacía sin registrar equivalencias", async () => {
     // La universidad está autenticada, pero no selecciona materias.
     entorno.preparar([
         ...sesionUniversidad()
     ]);

     const respuesta = await request(app)
         .post("/checklist/confirmar")
         .set("Authorization", `Bearer ${TOKEN}`)
         .send({
             ids_caso: []
         })
         .expect(400);

     // Verificamos el mensaje de error establecido en HU-05.
     assert.deepEqual(respuesta.body, {
         error: "Selecciona al menos una equivalencia para confirmar"
     });

     // No debe ejecutarse ninguna operación de confirmación.
     const llamadasRPC = entorno.llamadas.filter(
         llamada => llamada.operacion === "rpc"
     );

     assert.equal(llamadasRPC.length, 0);

     // Solo deben existir las tres llamadas de autenticación.
     assert.equal(entorno.llamadas.length, 3);
 });

 // ============================================================
 // HU5-03: CASOS DE OTRAS UNIVERSIDADES
 // CA5, E3 y RN1
 // ============================================================

 test("HU5-03 CA5: rechaza confirmar casos de otra universidad", async () => {
     entorno.preparar([
         ...sesionUniversidad(),
         {
             operacion: "rpc",
             verificar: args => {
                 // Verificamos que se utilice la función correcta.
                 assert.equal(
                     args.nombre,
                     "confirmar_equivalencias"
                 );

                 // La universidad debe identificarse desde la sesión.
                 assert.equal(
                     args.parametros.p_id_universidad,
                     ID_UNIVERSIDAD
                 );

                 assert.equal(
                     args.parametros.p_id_usuario,
                     ID_USUARIO
                 );

                 assert.deepEqual(
                     args.parametros.p_ids_caso,
                     [CASO_1]
                 );
             },
             // Simulamos que PostgreSQL detectó un caso ajeno.
             resultado: {
                 data: null,
                 error: {
                     message: "CASO_AJENO",
                     details: CASO_1
                 }
             }
         }
     ]);

     const respuesta = await request(app)
         .post("/checklist/confirmar")
         .set("Authorization", `Bearer ${TOKEN}`)
         .send({
             ids_caso: [CASO_1],
             // Este valor falso no debe reemplazar la sesión.
             id_universidad: "universidad-ajena"
         })
         .expect(403);

     // El servidor debe rechazar la operación.
     assert.deepEqual(respuesta.body, {
         error: "No tienes permiso para confirmar uno o más de los casos seleccionados.",
         ids_afectados: [CASO_1]
     });

     // Solo se debe realizar una llamada RPC.
     const llamadasRPC = entorno.llamadas.filter(
         llamada => llamada.operacion === "rpc"
     );

     assert.equal(llamadasRPC.length, 1);
 });

 // ============================================================
 // HU5-04: CONFIRMACIÓN DUPLICADA
 // CA4, E4 y RN7
 // ============================================================

 test("HU5-04 CA4: rechaza una equivalencia ya confirmada", async () => {
     entorno.preparar([
         ...sesionUniversidad(),
         {
             operacion: "rpc",
             verificar: args => {
                 // Debe utilizar la función correcta de Supabase.
                 assert.equal(
                     args.nombre,
                     "confirmar_equivalencias"
                 );

                 // La confirmación debe pertenecer a la sesión actual.
                 assert.equal(
                     args.parametros.p_id_universidad,
                     ID_UNIVERSIDAD
                 );

                 assert.equal(
                     args.parametros.p_id_usuario,
                     ID_USUARIO
                 );

                 assert.deepEqual(
                     args.parametros.p_ids_caso,
                     [CASO_1]
                 );
             },

             // Simulamos que PostgreSQL detecta una
             // equivalencia previamente confirmada.
             resultado: {
                 data: null,
                 error: {
                     message: "CASO_YA_CONFIRMADO",
                     details: CASO_1
                 }
             }
         }
     ]);

     const respuesta = await request(app)
         .post("/checklist/confirmar")
         .set("Authorization", `Bearer ${TOKEN}`)
         .send({
             ids_caso: [CASO_1]
         })
         .expect(409);

     // El sistema debe informar que ya fue confirmada.
     assert.deepEqual(respuesta.body, {
         error: "Una o más equivalencias ya fueron confirmadas.",
         ids_afectados: [CASO_1]
     });

     // Solo debe existir una llamada RPC.
     const llamadasRPC = entorno.llamadas.filter(
         llamada => llamada.operacion === "rpc"
     );

     assert.equal(llamadasRPC.length, 1);

     // No debe devolver una confirmación exitosa.
     assert.equal(respuesta.body.confirmadas, undefined);
     assert.equal(respuesta.body.fecha_confirmacion, undefined);
 });

 // ============================================================
 // HU5-05: FALLO DURANTE EL REGISTRO
 // CA3, E6 y RN6
 // ============================================================

test("HU5-05 CA3: fallo al registrar varias equivalencias devuelve 500", async (t) => {
    // Evitamos que el error simulado ensucie la terminal.
    const erroresRegistrados = [];

    t.mock.method(console, "error", (...mensajes) => {
        erroresRegistrados.push(mensajes.join(" "));
    });

    entorno.preparar([
        ...sesionUniversidad(),
        {
            operacion: "rpc",
            verificar: args => {
                // Debe utilizar la función transaccional.
                assert.equal(
                    args.nombre,
                    "confirmar_equivalencias"
                );

                // Los dos casos deben enviarse juntos.
                assert.deepEqual(args.parametros, {
                    p_id_universidad: ID_UNIVERSIDAD,
                    p_id_usuario: ID_USUARIO,
                    p_ids_caso: [CASO_1, CASO_2]
                });
            },

            // Simulamos un fallo de escritura en PostgreSQL.
            resultado: {
                data: null,
                error: {
                    message: "ERROR_ESCRITURA_SIMULADO"
                }
            }
        }
    ]);

    const respuesta = await request(app)
        .post("/checklist/confirmar")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
            ids_caso: [CASO_1, CASO_2]
        })
        .expect(500);

    // E6: debe mostrar el mensaje de error establecido.
    assert.deepEqual(respuesta.body, {
        error: "No se pudieron registrar las equivalencias. Intenta de nuevo"
    });

    // No debe informar ninguna confirmación exitosa.
    assert.equal(respuesta.body.confirmadas, undefined);
    assert.equal(respuesta.body.fecha_confirmacion, undefined);
    assert.equal(respuesta.body.ids_caso, undefined);

    // Ambos casos deben procesarse en una sola RPC.
    const llamadasRPC = entorno.llamadas.filter(
        llamada => llamada.operacion === "rpc"
    );

    assert.equal(llamadasRPC.length, 1);

    // El controlador no debe realizar escrituras independientes.
    const escriturasDirectas = entorno.llamadas.filter(
        llamada => llamada.argumentos.update || llamada.argumentos.insert
    );

    assert.equal(escriturasDirectas.length, 0);

    // El servidor debe registrar internamente el error.
    assert.ok(
        erroresRegistrados.some(mensaje =>
            mensaje.includes("ERROR_ESCRITURA_SIMULADO")
        )
    );
});