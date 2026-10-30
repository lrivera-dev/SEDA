
"use strict";

const path = require("node:path");
const { verificarInventario } = require("./verificar-inventario.cjs");

const BUCKET = "documentos-carreras";

function prepararDocumentos() {
    verificarInventario();

    const inventario = require("./inventario.json");
    const documentos = new Map();

    for (const registro of inventario) {
        documentos.set(registro.pensum_url, {
            tipo: "pensum",
            tabla: "carrera",
            columna: "pensum_url",
            columnaId: "id_carrera",
            idRegistro: registro.id_carrera,
            ruta: registro.pensum_url
        });

        documentos.set(registro.programa_url, {
            tipo: "programa",
            tabla: "materia",
            columna: "programa_url",
            columnaId: "id_materia",
            idRegistro: registro.id_materia,
            ruta: registro.programa_url
        });
    }

    return [...documentos.values()];
}

async function comprobarDocumento(supabase, documento) {
    try {
        const { data, error } = await supabase
            .from(documento.tabla)
            .select(documento.columna)
            .eq(documento.columnaId, documento.idRegistro)
            .single();

        if (error || !data) {
            return {
                estado: "ERROR_BD",
                ruta: documento.ruta
            };
        }

        const rutaRegistrada = data[documento.columna];

        if (rutaRegistrada !== documento.ruta) {
            return {
                estado: "REFERENCIA_DIFERENTE",
                ruta: documento.ruta
            };
        }

        return {
            estado: "REFERENCIA_CORRECTA",
            ruta: documento.ruta
        };
    } catch (error) {
        return {
            estado: "ERROR_BD",
            ruta: documento.ruta
        };
    }
}

async function comprobarStorage(supabase, documento) {
    try {
        const segmentos = documento.ruta.split("/");
        const nombreArchivo = segmentos.pop();
        const carpeta = segmentos.join("/");

        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(carpeta, {
                limit: 100,
                search: nombreArchivo
            });

        if (error) {
            return {
                estado: "ERROR_STORAGE",
                ruta: documento.ruta
            };
        }

        const existe = Array.isArray(data) &&
            data.some(archivo => archivo.name === nombreArchivo);

        return {
            estado: existe ? "EXISTE" : "NO_EXISTE",
            ruta: documento.ruta
        };
    } catch (error) {
        return {
            estado: "ERROR_STORAGE",
            ruta: documento.ruta
        };
    }
}

async function comprobarDocumentoCompleto(supabase, documento) {
    // Primero comprueba la referencia en PostgreSQL.
    const referencia = await comprobarDocumento(supabase, documento);

    if (referencia.estado !== "REFERENCIA_CORRECTA") {
        return {
            estado: referencia.estado,
            ruta: documento.ruta
        };
    }

    // Solo si la referencia es correcta, consulta Storage.
    const almacenamiento = await comprobarStorage(supabase, documento);

    if (almacenamiento.estado === "ERROR_STORAGE") {
        return {
            estado: "ERROR_STORAGE",
            ruta: documento.ruta
        };
    }

    if (almacenamiento.estado === "NO_EXISTE") {
        return {
            estado: "ARCHIVO_FALTANTE",
            ruta: documento.ruta
        };
    }

    return {
        estado: "DOCUMENTO_COMPLETO",
        ruta: documento.ruta
    };
}

async function copiarDocumentoSeguro(supabase, origen, destino) {
    if (
        typeof origen !== "string" ||
        typeof destino !== "string" ||
        !origen.trim() ||
        !destino.trim() ||
        origen === destino ||
        !origen.endsWith(".pdf") ||
        !destino.endsWith(".pdf")
    ) {
        return { estado: "RUTAS_INVALIDAS" };
    }

    const origenVerificado = await comprobarStorage(
        supabase,
        { ruta: origen }
    );

    if (origenVerificado.estado === "ERROR_STORAGE") {
        return { estado: "ERROR_VERIFICACION_ORIGEN" };
    }

    if (origenVerificado.estado !== "EXISTE") {
        return { estado: "ORIGEN_NO_EXISTE" };
    }

    const destinoVerificado = await comprobarStorage(
        supabase,
        { ruta: destino }
    );

    if (destinoVerificado.estado === "ERROR_STORAGE") {
        return { estado: "ERROR_VERIFICACION" };
    }

    if (destinoVerificado.estado === "EXISTE") {
        return { estado: "DESTINO_EXISTENTE" };
    }

    try {
        const almacenamiento = supabase.storage.from(BUCKET);

        const { data: archivo, error: errorDescarga } =
            await almacenamiento.download(origen);

        if (errorDescarga || !archivo) {
            return { estado: "ERROR_DESCARGA" };
        }

        const contenido = Buffer.from(
            await archivo.arrayBuffer()
        );

        if (contenido.length === 0) {
            return { estado: "ARCHIVO_VACIO" };
        }

        const { error: errorSubida } = await almacenamiento.upload(
            destino,
            contenido,
            {
                contentType: "application/pdf",
                upsert: false
            }
        );

        if (errorSubida) {
            return { estado: "ERROR_COPIA" };
        }

        return {
            estado: "COPIA_REALIZADA",
            origen,
            destino
        };
    } catch (error) {
        return { estado: "ERROR_COPIA" };
    }
}

async function comprobarAsociacionDisponible(supabase, documento) {
    try {
        const { data, error } = await supabase
            .from(documento.tabla)
            .select(documento.columna)
            .eq(documento.columnaId, documento.idRegistro)
            .single();

        if (error || !data) {
            return {
                estado: "ERROR_BD",
                ruta: documento.ruta
            };
        }

        const actual = data[documento.columna];

        if (actual === documento.ruta) {
            return {
                estado: "YA_ASOCIADO",
                ruta: documento.ruta
            };
        }

        if (actual !== null && actual !== "") {
            return {
                estado: "REFERENCIA_EXISTENTE",
                ruta: documento.ruta
            };
        }

        return {
            estado: "ASOCIACION_DISPONIBLE",
            ruta: documento.ruta
        };
    } catch (error) {
        return {
            estado: "ERROR_BD",
            ruta: documento.ruta
        };
    }
}

async function asociarDocumentoSeguro(supabase, documento) {
    const verificacion = await comprobarAsociacionDisponible(
        supabase,
        documento
    );

    if (verificacion.estado !== "ASOCIACION_DISPONIBLE") {
        return verificacion;
    }

    // No escribir si el archivo no existe en Storage.
    const almacenamiento = await comprobarStorage(supabase, documento);

    if (almacenamiento.estado !== "EXISTE") {
        return {
            estado: almacenamiento.estado === "NO_EXISTE"
                ? "ARCHIVO_FALTANTE"
                : "ERROR_STORAGE",
            ruta: documento.ruta
        };
    }

    try {
        // Actualización condicional: solo si la referencia sigue siendo NULL.
        const { data, error } = await supabase
            .from(documento.tabla)
            .update({ [documento.columna]: documento.ruta })
            .eq(documento.columnaId, documento.idRegistro)
            .is(documento.columna, null)
            .select(documento.columnaId);

        if (error) {
            return { estado: "ERROR_BD", ruta: documento.ruta };
        }

        if (!Array.isArray(data) || data.length !== 1) {
            return { estado: "SIN_ACTUALIZACION", ruta: documento.ruta };
        }

        return { estado: "ASOCIADO", ruta: documento.ruta };
    } catch (error) {
        return { estado: "ERROR_BD", ruta: documento.ruta };
    }
}

async function cargarDocumentoCoordinado(
    supabase,
    documento,
    rutaOrigen,
    rutaDestino
) {
    // Solo se permiten destinos que correspondan al documento
    // académico seleccionado.
    if (rutaDestino !== documento.ruta) {
        return { estado: "DESTINO_NO_AUTORIZADO" };
    }

    // Si la referencia y el archivo ya existen, no hacemos nada.
    const actual = await comprobarDocumentoCompleto(
        supabase,
        documento
    );

    if (actual.estado === "DOCUMENTO_COMPLETO") {
        return {
            estado: "YA_COMPLETO",
            ruta: documento.ruta
        };
    }

    const asociacion = await comprobarAsociacionDisponible(
        supabase,
        documento
    );

    if (asociacion.estado !== "ASOCIACION_DISPONIBLE") {
        return {
            estado: "REVISION_REQUERIDA",
            detalle: asociacion.estado
        };
    }
    
    // Solo se permite continuar si PostgreSQL no tiene
    // una referencia previa y la asociacion esta disponible.
    if (actual.estado === "ERROR_BD" ||
        actual.estado === "ERROR_STORAGE") {
        return {
            estado: "REVISION_REQUERIDA",
            detalle: actual.estado
        };
    }

    // El origen y destino deben ser diferentes.
    if (!rutaOrigen || rutaOrigen === rutaDestino) {
        return { estado: "RUTAS_INVALIDAS" };
    }

    const copia = await copiarDocumentoSeguro(
        supabase,
        rutaOrigen,
        rutaDestino
    );

    if (copia.estado !== "COPIA_REALIZADA") {
        return {
            estado: "COPIA_NO_REALIZADA",
            detalle: copia.estado
        };
    }

    const resultado = await asociarDocumentoSeguro(
        supabase,
        documento
    );

    if (resultado.estado !== "ASOCIADO") {
        return {
            estado: "ASOCIACION_PENDIENTE",
            ruta: documento.ruta,
            detalle: resultado.estado,
            requiereRevisionManual: true
        };
    }

    return {
        estado: "CARGA_COMPLETA",
        ruta: documento.ruta
    };
}

async function ejecutarSimulacion(supabase) {
    const documentos = prepararDocumentos();
    const resultados = [];

    for (const documento of documentos) {
        resultados.push(
            await comprobarDocumentoCompleto(supabase, documento)
        );
    }

    return {
        bucket: BUCKET,
        documentos: resultados,
        total: resultados.length,
        correctos: resultados.filter(
            r => r.estado === "DOCUMENTO_COMPLETO"
        ).length
    };
}

if (require.main === module) {
    console.log("HU-12 - Cargador documental");
    console.log("Modo: PREPARACION SEGURA");
    console.log("Bucket:", BUCKET);

    const documentos = prepararDocumentos();

    console.log("Documentos preparados:", documentos.length);
    console.log("Operaciones en Supabase: 0");
    console.log("Archivos modificados: 0");
}

module.exports = {
    prepararDocumentos,
    comprobarDocumento,
    comprobarStorage,
    comprobarDocumentoCompleto,
    copiarDocumentoSeguro,
    comprobarAsociacionDisponible,
    asociarDocumentoSeguro,
    cargarDocumentoCoordinado,
    ejecutarSimulacion
};
