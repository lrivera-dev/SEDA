
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    prepararDocumentos,
    comprobarDocumento,
    comprobarStorage,
    comprobarDocumentoCompleto,
    copiarDocumentoSeguro,
    comprobarAsociacionDisponible,
    asociarDocumentoSeguro,
    cargarDocumentoCoordinado,
    ejecutarSimulacion
} = require("../../scripts/hu12/cargar-documentos.cjs");

function crearSupabaseSimulado({
    error = false,
    rutaDiferente = false,
    archivoFaltante = false,
    errorStorage = false
} = {}) {
    const consultas = [];
    const consultasStorage = [];

    const documentos = prepararDocumentos();

    return {
        consultas,
        consultasStorage,

        from(tabla) {
            return {
                select(columna) {
                    return {
                        eq(columnaId, idRegistro) {
                            return {
                                async single() {
                                    consultas.push({
                                        tabla,
                                        columna,
                                        columnaId,
                                        idRegistro
                                    });

                                    if (error) {
                                        return {
                                            data: null,
                                            error: { message: "Error simulado de PostgreSQL" }
                                        };
                                    }

                                    const documento = documentos.find(
                                        d => d.tabla === tabla &&
                                             d.columnaId === columnaId &&
                                             d.idRegistro === idRegistro
                                    );

                                    if (!documento) {
                                        return {
                                            data: null,
                                            error: { message: "Registro inexistente" }
                                        };
                                    }

                                    return {
                                        data: {
                                            [columna]: rutaDiferente
                                                ? "ruta-diferente.pdf"
                                                : documento.ruta
                                        },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                }
            };
        },

        storage: {
            from(bucket) {
                assert.equal(bucket, "documentos-carreras");

                return {
                    async list(carpeta, opciones) {
                        consultasStorage.push({ carpeta, opciones });

                        if (errorStorage) {
                            return {
                                data: null,
                                error: { message: "Error simulado de Storage" }
                            };
                        }

                        if (archivoFaltante) {
                            return { data: [], error: null };
                        }

                        return {
                            data: [{ name: opciones.search }],
                            error: null
                        };
                    }
                };
            }
        }
    };
}

test("HU-12: prepara exactamente 16 documentos", () => {
    const documentos = prepararDocumentos();

    assert.equal(documentos.length, 16);
    assert.equal(documentos.filter(d => d.tipo === "pensum").length, 4);
    assert.equal(documentos.filter(d => d.tipo === "programa").length, 12);
});

test("HU-12: acepta referencias correctas en PostgreSQL", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado();

    const resultado = await comprobarDocumento(supabase, documento);

    assert.equal(resultado.estado, "REFERENCIA_CORRECTA");
    assert.equal(supabase.consultas.length, 1);
});

test("HU-12: detecta referencias diferentes", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado({ rutaDiferente: true });

    const resultado = await comprobarDocumento(supabase, documento);

    assert.equal(resultado.estado, "REFERENCIA_DIFERENTE");
});

test("HU-12: controla errores de PostgreSQL", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado({ error: true });

    const resultado = await comprobarDocumento(supabase, documento);

    assert.equal(resultado.estado, "ERROR_BD");
});

test("HU-12: valida las 16 referencias sin realizar escrituras", async () => {
    const supabase = crearSupabaseSimulado();

    const resultado = await ejecutarSimulacion(supabase);

    assert.equal(resultado.total, 16);
    assert.equal(resultado.correctos, 16);
    assert.equal(supabase.consultas.length, 16);
    assert.equal(supabase.consultasStorage.length, 16);
});

test("HU-12: una referencia correcta no demuestra existencia en Storage", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado();

    const resultado = await comprobarDocumento(supabase, documento);

    assert.equal(resultado.estado, "REFERENCIA_CORRECTA");

    // El resultado actual solo acredita la referencia en PostgreSQL.
    assert.equal(resultado.storageVerificado, undefined);
});

test("HU-12: confirma un documento existente en Storage", async () => {
    const documento = prepararDocumentos()[0];
    const nombre = documento.ruta.split("/").pop();

    const supabase = {
        storage: {
            from(bucket) {
                assert.equal(bucket, "documentos-carreras");

                return {
                    async list() {
                        return {
                            data: [{ name: nombre }],
                            error: null
                        };
                    }
                };
            }
        }
    };

    const resultado = await comprobarStorage(supabase, documento);

    assert.equal(resultado.estado, "EXISTE");
});

test("HU-12: detecta un documento faltante en Storage", async () => {
    const documento = prepararDocumentos()[0];

    const supabase = {
        storage: {
            from() {
                return {
                    async list() {
                        return {
                            data: [],
                            error: null
                        };
                    }
                };
            }
        }
    };

    const resultado = await comprobarStorage(supabase, documento);

    assert.equal(resultado.estado, "NO_EXISTE");
});

test("HU-12: controla errores de Storage", async () => {
    const documento = prepararDocumentos()[0];

    const supabase = {
        storage: {
            from() {
                return {
                    async list() {
                        return {
                            data: null,
                            error: { message: "Error simulado de Storage" }
                        };
                    }
                };
            }
        }
    };

    const resultado = await comprobarStorage(supabase, documento);

    assert.equal(resultado.estado, "ERROR_STORAGE");
});

test("HU-12: detecta archivo faltante aunque la referencia sea correcta", async () => {
    const supabase = crearSupabaseSimulado({
        archivoFaltante: true
    });

    const resultado = await ejecutarSimulacion(supabase);

    assert.equal(resultado.total, 16);
    assert.equal(resultado.correctos, 0);
    assert.ok(resultado.documentos.every(
        d => d.estado === "ARCHIVO_FALTANTE"
    ));
});

test("HU-12: detiene la verificacion ante errores de Storage", async () => {
    const supabase = crearSupabaseSimulado({
        errorStorage: true
    });

    const resultado = await ejecutarSimulacion(supabase);

    assert.equal(resultado.correctos, 0);
    assert.ok(resultado.documentos.every(
        d => d.estado === "ERROR_STORAGE"
    ));
});

test("HU-12: no consulta Storage cuando PostgreSQL tiene otra referencia", async () => {
    const supabase = crearSupabaseSimulado({
        rutaDiferente: true
    });

    const resultado = await ejecutarSimulacion(supabase);

    assert.equal(resultado.correctos, 0);
    assert.equal(supabase.consultasStorage.length, 0);
    assert.ok(resultado.documentos.every(
        d => d.estado === "REFERENCIA_DIFERENTE"
    ));
});

test("HU-12: controla excepciones inesperadas de PostgreSQL", async () => {
    const documento = prepararDocumentos()[0];

    const supabase = {
        from() {
            throw new Error("Fallo inesperado simulado");
        }
    };

    const resultado = await comprobarDocumento(supabase, documento);

    assert.equal(resultado.estado, "ERROR_BD");
    assert.equal(resultado.ruta, documento.ruta);
});

test("HU-12: no sobrescribe un destino existente", async () => {
    let descargas = 0;
    let subidas = 0;

    const supabase = {
        storage: {
            from() {
                return {
                    async list(carpeta, opciones) {
                        return {
                            data: [{ name: opciones.search }],
                            error: null
                        };
                    },
                    async download() {
                        descargas++;
                        return { data: null, error: null };
                    },
                    async upload() {
                        subidas++;
                        return { data: {}, error: null };
                    }
                };
            }
        }
    };

    const resultado = await copiarDocumentoSeguro(
        supabase,
        "original/origen.pdf",
        "pruebas/destino.pdf"
    );

    assert.equal(resultado.estado, "DESTINO_EXISTENTE");
    assert.equal(descargas, 0);
    assert.equal(subidas, 0);
});

test("HU-12: no copia si falla la verificacion del origen", async () => {
    let subidas = 0;

    const supabase = {
        storage: {
            from() {
                return {
                    async list() {
                        return {
                            data: null,
                            error: { message: "Error simulado" }
                        };
                    },
                    async upload() {
                        subidas++;
                        return { data: {}, error: null };
                    }
                };
            }
        }
    };

    const resultado = await copiarDocumentoSeguro(
        supabase,
        "original/origen.pdf",
        "pruebas/destino.pdf"
    );

    assert.equal(resultado.estado, "ERROR_VERIFICACION_ORIGEN");
    assert.equal(subidas, 0);
});

test("HU-12: copia con upsert deshabilitado", async () => {
    const llamadas = [];
    const contenidoOriginal = Buffer.from("PDF de prueba");

    const supabase = {
        storage: {
            from(bucket) {
                assert.equal(bucket, "documentos-carreras");

                return {
                    async list(carpeta, opciones) {
                        if (carpeta === "original") {
                            return {
                                data: [{ name: "origen.pdf" }],
                                error: null
                            };
                        }

                        return { data: [], error: null };
                    },

                    async download(ruta) {
                        assert.equal(ruta, "original/origen.pdf");

                        return {
                            data: new Blob(
                                [contenidoOriginal],
                                { type: "application/pdf" }
                            ),
                            error: null
                        };
                    },

                    async upload(ruta, contenido, opciones) {
                        llamadas.push({ ruta, contenido, opciones });

                        return { data: {}, error: null };
                    }
                };
            }
        }
    };

    const resultado = await copiarDocumentoSeguro(
        supabase,
        "original/origen.pdf",
        "pruebas/destino.pdf"
    );

    assert.equal(resultado.estado, "COPIA_REALIZADA");
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].ruta, "pruebas/destino.pdf");
    assert.deepEqual(llamadas[0].contenido, contenidoOriginal);
    assert.equal(llamadas[0].opciones.upsert, false);
    assert.equal(
        llamadas[0].opciones.contentType,
        "application/pdf"
    );
});

test("HU-12: reconoce un documento ya asociado", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado();

    const resultado = await comprobarAsociacionDisponible(
        supabase, documento
    );

    assert.equal(resultado.estado, "YA_ASOCIADO");
});

test("HU-12: protege una referencia existente", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado({
        rutaDiferente: true
    });

    const resultado = await comprobarAsociacionDisponible(
        supabase, documento
    );

    assert.equal(resultado.estado, "REFERENCIA_EXISTENTE");
});

test("HU-12: controla errores al verificar asociaciones", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado({
        error: true
    });

    const resultado = await comprobarAsociacionDisponible(
        supabase, documento
    );

    assert.equal(resultado.estado, "ERROR_BD");
});

test("HU-12: permite asociar cuando no existe referencia previa", async () => {
    const documento = prepararDocumentos()[0];

    const supabase = {
        from(tabla) {
            assert.equal(tabla, documento.tabla);

            return {
                select(columna) {
                    return {
                        eq(columnaId, idRegistro) {
                            assert.equal(columnaId, documento.columnaId);
                            assert.equal(idRegistro, documento.idRegistro);

                            return {
                                async single() {
                                    return {
                                        data: { [columna]: null },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                }
            };
        }
    };

    const resultado = await comprobarAsociacionDisponible(
        supabase,
        documento
    );

    assert.equal(resultado.estado, "ASOCIACION_DISPONIBLE");
});

test("HU-12: asocia documento cuando el campo esta vacio", async () => {
    const documento = prepararDocumentos()[0];
    const llamadas = [];

    const supabase = {
        from() {
            return {
                select(columna) {
                    return {
                        eq() {
                            return {
                                async single() {
                                    return {
                                        data: { [columna]: null },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                },
                update(valores) {
                    llamadas.push({ operacion: "update", valores });

                    return {
                        eq(columnaId, idRegistro) {
                            return {
                                is(columna, valor) {
                                    llamadas.push({
                                        columnaId,
                                        idRegistro,
                                        columna,
                                        valor
                                    });

                                    return {
                                        async select() {
                                            return {
                                                data: [{ [columnaId]: idRegistro }],
                                                error: null
                                            };
                                        }
                                    };
                                }
                            };
                        }
                    };
                }
            };
        },
        storage: {
            from() {
                return {
                    async list(carpeta, opciones) {
                        return {
                            data: [{ name: opciones.search }],
                            error: null
                        };
                    }
                };
            }
        }
    };

    const resultado = await asociarDocumentoSeguro(supabase, documento);

    assert.equal(resultado.estado, "ASOCIADO");
    assert.equal(llamadas[0].valores[documento.columna], documento.ruta);
    assert.equal(llamadas[1].columna, documento.columna);
    assert.equal(llamadas[1].valor, null);
});

test("HU-12: no sobrescribe una asociacion existente", async () => {
    const documento = prepararDocumentos()[0];
    let actualizaciones = 0;

    const supabase = {
        from() {
            return {
                select(columna) {
                    return {
                        eq() {
                            return {
                                async single() {
                                    return {
                                        data: { [columna]: "documento-anterior.pdf" },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                },
                update() {
                    actualizaciones++;
                    throw new Error("No debe actualizar");
                }
            };
        }
    };

    const resultado = await asociarDocumentoSeguro(supabase, documento);

    assert.equal(resultado.estado, "REFERENCIA_EXISTENTE");
    assert.equal(actualizaciones, 0);
});

test("HU-12: no actualiza cuando Storage no encuentra el archivo", async () => {
    const documento = prepararDocumentos()[0];
    let actualizaciones = 0;

    const supabase = {
        from() {
            return {
                select(columna) {
                    return {
                        eq() {
                            return {
                                async single() {
                                    return {
                                        data: { [columna]: null },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                },
                update() {
                    actualizaciones++;
                    throw new Error("No debe actualizar");
                }
            };
        },
        storage: {
            from() {
                return {
                    async list() {
                        return { data: [], error: null };
                    }
                };
            }
        }
    };

    const resultado = await asociarDocumentoSeguro(supabase, documento);

    assert.equal(resultado.estado, "ARCHIVO_FALTANTE");
    assert.equal(actualizaciones, 0);
});

test("HU-12: no reporta exito cuando otro proceso cambia la referencia", async () => {
    const documento = prepararDocumentos()[0];

    const supabase = {
        from() {
            return {
                select(columna) {
                    return {
                        eq() {
                            return {
                                async single() {
                                    return {
                                        data: { [columna]: null },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                },
                update() {
                    return {
                        eq() {
                            return {
                                is() {
                                    return {
                                        async select() {
                                            return { data: [], error: null };
                                        }
                                    };
                                }
                            };
                        }
                    };
                }
            };
        },
        storage: {
            from() {
                return {
                    async list(carpeta, opciones) {
                        return {
                            data: [{ name: opciones.search }],
                            error: null
                        };
                    }
                };
            }
        }
    };

    const resultado = await asociarDocumentoSeguro(supabase, documento);

    assert.equal(resultado.estado, "SIN_ACTUALIZACION");
});

test("HU-12: no duplica documentos que ya estan completos", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado();

    const resultado = await cargarDocumentoCoordinado(
        supabase,
        documento,
        "originales/documento.pdf",
        documento.ruta
    );

    assert.equal(resultado.estado, "YA_COMPLETO");
    assert.equal(resultado.ruta, documento.ruta);

    // Solo deben realizarse consultas de lectura.
    assert.equal(supabase.consultas.length, 1);
    assert.equal(supabase.consultasStorage.length, 1);
});

test("HU-12: la coordinacion no copia si existe otra referencia", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado({
        rutaDiferente: true
    });

    const resultado = await cargarDocumentoCoordinado(
        supabase,
        documento,
        "originales/documento.pdf",
        documento.ruta
    );

    assert.equal(resultado.estado, "REVISION_REQUERIDA");
    assert.equal(resultado.detalle, "REFERENCIA_EXISTENTE");

    // No debe intentar consultar ni copiar archivos.
    assert.equal(supabase.consultasStorage.length, 0);
});

test("HU-12: la coordinacion no copia si PostgreSQL falla", async () => {
    const documento = prepararDocumentos()[0];
    const supabase = crearSupabaseSimulado({
        error: true
    });

    const resultado = await cargarDocumentoCoordinado(
        supabase,
        documento,
        "originales/documento.pdf",
        documento.ruta
    );

    assert.equal(resultado.estado, "REVISION_REQUERIDA");
    assert.equal(resultado.detalle, "ERROR_BD");

    // No debe consultar Storage ni intentar cargar archivos.
    assert.equal(supabase.consultasStorage.length, 0);
});

test("HU-12: coordina copia y asociacion de un documento nuevo", async () => {
    const documento = prepararDocumentos()[0];
    const acciones = [];

    let referencia = null;
    let destinoExiste = false;

    const supabase = {
        from(tabla) {
            assert.equal(tabla, documento.tabla);

            return {
                select(columna) {
                    return {
                        eq() {
                            return {
                                async single() {
                                    return {
                                        data: { [columna]: referencia },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                },

                update(valores) {
                    return {
                        eq() {
                            return {
                                is(columna, esperado) {
                                    return {
                                        async select() {
                                            assert.equal(esperado, null);

                                            if (referencia !== null) {
                                                return { data: [], error: null };
                                            }

                                            referencia = valores[columna];
                                            acciones.push("ASOCIAR");

                                            return {
                                                data: [{
                                                    [documento.columnaId]: documento.idRegistro
                                                }],
                                                error: null
                                            };
                                        }
                                    };
                                }
                            };
                        }
                    };
                }
            };
        },

        storage: {
            from() {
                return {
                    async list(carpeta, opciones) {
                        const nombre = opciones.search;

                        if (nombre === "origen.pdf") {
                            return {
                                data: [{ name: nombre }],
                                error: null
                            };
                        }

                        return {
                            data: destinoExiste
                                ? [{ name: nombre }]
                                : [],
                            error: null
                        };
                    },

                    async download() {
                        acciones.push("DESCARGAR");

                        return {
                            data: new Blob(
                                [Buffer.from("%PDF-1.4 prueba")],
                                { type: "application/pdf" }
                            ),
                            error: null
                        };
                    },

                    async upload(ruta, contenido, opciones) {
                        assert.equal(ruta, documento.ruta);
                        assert.equal(opciones.upsert, false);

                        destinoExiste = true;
                        acciones.push("COPIAR");

                        return { data: {}, error: null };
                    }
                };
            }
        }
    };

    const resultado = await cargarDocumentoCoordinado(
        supabase,
        documento,
        "originales/origen.pdf",
        documento.ruta
    );

    assert.equal(resultado.estado, "CARGA_COMPLETA");
    assert.equal(referencia, documento.ruta);
    assert.deepEqual(acciones, [
        "DESCARGAR",
        "COPIAR",
        "ASOCIAR"
    ]);
});

test("HU-12: conserva la copia para revision si falla la asociacion", async () => {
    const documento = prepararDocumentos()[0];

    let referencia = null;
    let destinoExiste = false;
    let eliminaciones = 0;

    const supabase = {
        from() {
            return {
                select(columna) {
                    return {
                        eq() {
                            return {
                                async single() {
                                    return {
                                        data: { [columna]: referencia },
                                        error: null
                                    };
                                }
                            };
                        }
                    };
                },

                update() {
                    return {
                        eq() {
                            return {
                                is() {
                                    return {
                                        async select() {
                                            return {
                                                data: null,
                                                error: {
                                                    message: "Error de BD simulado"
                                                }
                                            };
                                        }
                                    };
                                }
                            };
                        }
                    };
                }
            };
        },

        storage: {
            from() {
                return {
                    async list(carpeta, opciones) {
                        if (opciones.search === "origen.pdf") {
                            return {
                                data: [{ name: "origen.pdf" }],
                                error: null
                            };
                        }

                        return {
                            data: destinoExiste
                                ? [{ name: opciones.search }]
                                : [],
                            error: null
                        };
                    },

                    async download() {
                        return {
                            data: new Blob(
                                [Buffer.from("%PDF-1.4 prueba")],
                                { type: "application/pdf" }
                            ),
                            error: null
                        };
                    },

                    async upload() {
                        destinoExiste = true;
                        return { data: {}, error: null };
                    },

                    async remove() {
                        eliminaciones++;
                        return { data: [], error: null };
                    }
                };
            }
        }
    };

    const resultado = await cargarDocumentoCoordinado(
        supabase,
        documento,
        "originales/origen.pdf",
        documento.ruta
    );

    assert.equal(resultado.estado, "ASOCIACION_PENDIENTE");
    assert.equal(resultado.detalle, "ERROR_BD");
    assert.equal(resultado.requiereRevisionManual, true);

    assert.equal(referencia, null);
    assert.equal(destinoExiste, true);
    assert.equal(eliminaciones, 0);
});
