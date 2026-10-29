
-- ============================================================
-- SEDA - HU-11, Tarea 2
-- Registro transaccional de usuario y universidad
-- ============================================================
-- CA3: Evitar registros parcialmente creados.
-- CA4: Permitir compensación de Auth desde el backend.
-- RN4: Usar una transacción para registros dependientes.
-- RN5: La compensación de Auth se gestiona por separado.
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_universidad_transaccional(
    p_id_usuario UUID,
    p_correo TEXT,
    p_nombre TEXT,
    p_ubicacion TEXT,
    p_correo_contacto TEXT,
    p_telefono_contacto TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_universidad public.universidad%ROWTYPE;
BEGIN

    -- Validar los datos recibidos.
    IF p_id_usuario IS NULL
        OR NULLIF(BTRIM(p_correo), '') IS NULL
        OR NULLIF(BTRIM(p_nombre), '') IS NULL
        OR NULLIF(BTRIM(p_ubicacion), '') IS NULL
        OR NULLIF(BTRIM(p_correo_contacto), '') IS NULL
        OR NULLIF(BTRIM(p_telefono_contacto), '') IS NULL
    THEN
        RAISE EXCEPTION 'DATOS_UNIVERSIDAD_INVALIDOS';
    END IF;

    -- Paso 1: registrar el usuario vinculado a Supabase Auth.
    INSERT INTO public.usuario (
        id_usuario,
        correo,
        rol
    )
    VALUES (
        p_id_usuario,
        p_correo,
        'UNIVERSIDAD'
    );

    -- Paso 2: registrar la universidad relacionada.
    INSERT INTO public.universidad (
        id_usuario,
        nombre,
        ubicacion,
        correo_contacto,
        telefono_contacto
    )
    VALUES (
        p_id_usuario,
        p_nombre,
        p_ubicacion,
        p_correo_contacto,
        p_telefono_contacto
    )
    RETURNING * INTO v_universidad;

    -- Devolver la universidad creada.
    RETURN TO_JSONB(v_universidad);

END;
$$;

-- ============================================================
-- SEGURIDAD
-- Solo el backend con service_role puede ejecutar la función.
-- ============================================================

REVOKE ALL ON FUNCTION public.registrar_universidad_transaccional(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_universidad_transaccional(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT
)
TO service_role;

COMMIT;
