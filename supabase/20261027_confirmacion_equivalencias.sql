-- HU-5: confirmación y registro formal de equivalencias por la universidad.

ALTER TABLE public.caso_equivalencia
    ADD COLUMN confirmada_universidad BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN fecha_confirmacion TIMESTAMPTZ,
    ADD COLUMN id_usuario_confirmacion UUID
        REFERENCES public.usuario (id_usuario),
    ADD CONSTRAINT ck_caso_confirmacion CHECK (
        (confirmada_universidad = FALSE
            AND fecha_confirmacion IS NULL
            AND id_usuario_confirmacion IS NULL)
        OR
        (confirmada_universidad = TRUE
            AND fecha_confirmacion IS NOT NULL
            AND id_usuario_confirmacion IS NOT NULL)
    );

-- Confirma varios casos en una sola transacción: si uno falla, ninguno se guarda.
-- Los errores se lanzan con un código en el mensaje; el backend los traduce a 403, 404 o 409.
CREATE FUNCTION public.confirmar_equivalencias(
    p_id_universidad TEXT,
    p_id_usuario UUID,
    p_ids_caso UUID[]
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_ids UUID[];
    v_existentes INTEGER;
    v_caso RECORD;
    v_fecha TIMESTAMPTZ;
BEGIN
    SELECT array_agg(DISTINCT id) INTO v_ids FROM unnest(p_ids_caso) AS id;

    IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
        RAISE EXCEPTION 'SIN_SELECCION';
    END IF;

    SELECT count(*) INTO v_existentes
    FROM public.caso_equivalencia
    WHERE id_caso = ANY (v_ids);

    IF v_existentes <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'CASO_NO_EXISTE';
    END IF;

    -- Bloquea los casos para que dos confirmaciones al mismo tiempo no se pisen.
    FOR v_caso IN
        SELECT
            c.id_caso,
            c.estado,
            c.estado_calculo,
            c.porcentaje_coincidencia,
            c.confirmada_universidad,
            ca_o.id_universidad AS id_universidad_origen,
            ca_o.pensum_url AS pensum_origen,
            mo.programa_url AS programa_origen,
            ca_d.pensum_url AS pensum_destino,
            md.programa_url AS programa_destino
        FROM public.caso_equivalencia c
        LEFT JOIN public.materia mo ON mo.id_materia = c.id_materia_origen
        LEFT JOIN public.carrera ca_o ON ca_o.id_carrera = mo.id_carrera
        LEFT JOIN public.materia md ON md.id_materia = c.id_materia_destino
        LEFT JOIN public.carrera ca_d ON ca_d.id_carrera = md.id_carrera
        WHERE c.id_caso = ANY (v_ids)
        ORDER BY c.id_caso
        FOR UPDATE OF c
    LOOP
        -- E3 / CA5: el caso es de otra universidad.
        IF v_caso.id_universidad_origen IS NULL
            OR v_caso.id_universidad_origen::TEXT <> p_id_universidad THEN
            RAISE EXCEPTION 'CASO_AJENO' USING DETAIL = v_caso.id_caso::TEXT;
        END IF;

        -- E5: el MINED ya revisó el caso.
        IF v_caso.estado <> 'PENDIENTE' THEN
            RAISE EXCEPTION 'CASO_YA_REVISADO' USING DETAIL = v_caso.id_caso::TEXT;
        END IF;

        -- E4: ya estaba confirmado.
        IF v_caso.confirmada_universidad THEN
            RAISE EXCEPTION 'CASO_YA_CONFIRMADO' USING DETAIL = v_caso.id_caso::TEXT;
        END IF;

        -- E2 / RN4: la evaluación no está terminada.
        IF v_caso.estado_calculo <> 'CALCULADO'
            OR v_caso.porcentaje_coincidencia IS NULL THEN
            RAISE EXCEPTION 'CALCULO_INCOMPLETO' USING DETAIL = v_caso.id_caso::TEXT;
        END IF;

        -- RN4: los 4 documentos deben estar cargados.
        IF coalesce(btrim(v_caso.pensum_origen), '') = ''
            OR coalesce(btrim(v_caso.programa_origen), '') = ''
            OR coalesce(btrim(v_caso.pensum_destino), '') = ''
            OR coalesce(btrim(v_caso.programa_destino), '') = '' THEN
            RAISE EXCEPTION 'DOCUMENTOS_INCOMPLETOS' USING DETAIL = v_caso.id_caso::TEXT;
        END IF;
    END LOOP;

    v_fecha := now();

    -- RN8: solo se registra la confirmación; el estado del caso (decisión del MINED) no cambia.
    UPDATE public.caso_equivalencia AS c
    SET confirmada_universidad = TRUE,
        fecha_confirmacion = v_fecha,
        id_usuario_confirmacion = p_id_usuario
    WHERE c.id_caso = ANY (v_ids);

    RETURN v_fecha;
END;
$$;

REVOKE ALL ON FUNCTION
public.confirmar_equivalencias(TEXT, UUID, UUID[])
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.confirmar_equivalencias(TEXT, UUID, UUID[])
FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.confirmar_equivalencias(TEXT, UUID, UUID[])
TO service_role;