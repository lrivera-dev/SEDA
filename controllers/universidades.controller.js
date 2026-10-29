
"use strict";

const supabase = require("../supabaseClient");

const CAMPOS_OBLIGATORIOS = [
    "nombre",
    "ubicacion",
    "correo_contacto",
    "telefono_contacto",
    "correo",
    "contrasena"
];

const MENSAJE_ERROR_REGISTRO =
    "No se pudo registrar la universidad. Intenta de nuevo.";

// HU-11 E5, CA4 y RN5:
// Si PostgreSQL falla, intentar eliminar la cuenta creada en Auth.
async function compensarCuentaAuth(idUsuario) {
    try {
        const { error } = await supabase.auth.admin.deleteUser(idUsuario);

        if (error) {
            registrarErrorCompensacion(idUsuario, error);
            return false;
        }

        return true;
    } catch (error) {
        registrarErrorCompensacion(idUsuario, error);
        return false;
    }
}

// HU-11 RN6:
// Registrar incidencias para permitir su recuperación manual.
// No se registran contraseñas ni credenciales.
function registrarErrorCompensacion(idUsuario, error) {
    console.error("HU11_COMPENSACION_AUTH_FALLIDA", {
        id_usuario: idUsuario,
        fecha: new Date().toISOString(),
        codigo: error?.code || "ERROR_DESCONOCIDO",
        detalle: error?.message || "Sin detalle disponible"
    });
}

async function registrarUniversidad(req, res) {
    const datos =
        req.body &&
        typeof req.body === "object" &&
        !Array.isArray(req.body)
            ? req.body
            : {};

    // Validar campos obligatorios.
    const faltantes = CAMPOS_OBLIGATORIOS.filter(
        campo =>
            typeof datos[campo] !== "string" ||
            datos[campo].trim() === ""
    );

    if (faltantes.length > 0) {
        return res.status(400).json({
            error: "Campos obligatorios faltantes o inválidos",
            campos: faltantes
        });
    }

    // Verificar si la universidad ya existe.
    let existente;

    try {
        const { data, error } = await supabase
            .from("universidad")
            .select("id_universidad")
            .eq("nombre", datos.nombre)
            .maybeSingle();

        if (error) {
            throw error;
        }

        existente = data;
    } catch (error) {
        console.error("HU11_ERROR_CONSULTA_UNIVERSIDAD", {
            codigo: error?.code || "ERROR_DESCONOCIDO"
        });

        return res.status(500).json({
            error: MENSAJE_ERROR_REGISTRO
        });
    }

    if (existente) {
        return res.status(409).json({
            error:
                "Ya existe una universidad registrada con ese nombre. Verifique los datos."
        });
    }

    // Paso 1: crear la cuenta en Supabase Auth.
    let authData;
    let authError;

    try {
        const resultado = await supabase.auth.admin.createUser({
            email: datos.correo,
            password: datos.contrasena,
            email_confirm: true
        });

        authData = resultado.data;
        authError = resultado.error;
    } catch (error) {
        console.error("HU11_ERROR_CREACION_AUTH", {
            codigo: error?.code || "ERROR_DESCONOCIDO"
        });

        return res.status(500).json({
            error: MENSAJE_ERROR_REGISTRO
        });
    }

    if (authError) {
        return res.status(400).json({
            error: "No se pudo crear la cuenta de la universidad."
        });
    }

    const idUsuario = authData?.user?.id;

    if (!idUsuario) {
        console.error("HU11_AUTH_SIN_IDENTIFICADOR");

        return res.status(500).json({
            error: MENSAJE_ERROR_REGISTRO
        });
    }

    // Paso 2: registrar usuario y universidad en una sola
    // transacción PostgreSQL mediante Supabase RPC.

    // Solo compensaremos Auth cuando PostgreSQL devuelva
    // explícitamente un error de registro.
    let falloConfirmadoEnPostgres = false;

    try {
        const { data: universidad, error: errorRegistro } =
            await supabase.rpc(
                "registrar_universidad_transaccional",
                {
                    p_id_usuario: idUsuario,
                    p_correo: datos.correo,
                    p_nombre: datos.nombre,
                    p_ubicacion: datos.ubicacion,
                    p_correo_contacto: datos.correo_contacto,
                    p_telefono_contacto: datos.telefono_contacto
                }
            );

        if (errorRegistro) {
            falloConfirmadoEnPostgres = true;
            throw errorRegistro;
        }

        // Si la respuesta es incompleta, no podemos asegurar
        // si PostgreSQL confirmó o no el registro.
        // NO debemos eliminar la cuenta de Auth.
        if (!universidad || !universidad.id_universidad) {
            console.error("HU11_REGISTRO_ESTADO_INCIERTO", {
                id_usuario: idUsuario,
                motivo: "RESPUESTA_RPC_INCOMPLETA"
            });

            return res.status(500).json({
                error: MENSAJE_ERROR_REGISTRO
            });
        }

        // Registro completado correctamente.
        return res.status(201).json({
            mensaje: "Universidad registarada exitosamente",
            universidad
        });

    } catch (error) {

        // Una excepción de comunicación no demuestra
        // que PostgreSQL haya revertido la transacción.
        if (!falloConfirmadoEnPostgres) {
            console.error("HU11_REGISTRO_ESTADO_INCIERTO", {
                id_usuario: idUsuario,
                motivo: "EXCEPCION_RPC",
                codigo: error?.code || "ERROR_DESCONOCIDO"
            });

            return res.status(500).json({
                error: MENSAJE_ERROR_REGISTRO
            });
        }

        // PostgreSQL devolvió un error explícito.
        // La operación SQL falló: intentar compensar Auth.
        console.error("HU11_ERROR_REGISTRO_POSTGRESQL", {
            id_usuario: idUsuario,
            codigo: error?.code || "ERROR_DESCONOCIDO"
        });

        await compensarCuentaAuth(idUsuario);

        return res.status(500).json({
            error: MENSAJE_ERROR_REGISTRO
        });
    }
}
module.exports = { registrarUniversidad };
